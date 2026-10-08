/**
 * autoSetup.js
 * Runs on every server startup.
 * - Creates the fixit_pdas database if it doesn't exist.
 * - Imports schema.sql if the `users` table is missing.
 * - Runs non-destructive column/table migrations for existing schemas.
 * - Widens free-text columns (description, remarks) to TEXT so user input is
 *   never length-capped.
 * - Seeds the admin user from .env if no admin exists.
 * - Seeds default role accounts for testing.
 *
 * All steps are idempotent and safe to re-run.
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'database', 'schema.sql');

/* ============================================================================
   The controlled vocabularies.

   These are the values the application can actually write. The database ENUMs
   must be a superset of them, because this MariaDB runs WITHOUT
   STRICT_TRANS_TABLES: an ENUM value that does not match is not rejected, it
   is silently stored as '' with no error and no warning, and the API still
   reports success. That is how job_requests.category lost every value except
   "Electrical", and how users.role once locked a supervisor out of login.

   Keep these lists, schema.sql and the frontend filters in step. The
   enumVocabulary.test.js suite fails if they drift.
   ========================================================================== */

/** Every category a request can be filed under. */
export const REQUEST_CATEGORIES = [
  'Electrical',
  'Air Conditioning',
  'Mechanical',
  'Water/Sanitary',
  'Physical Structures',
  'Drawing/Design',
  'Safety & Compliance',
  // Set by the urgent fast path; there is no trade selector on that screen.
  'Urgent Hazard'
];

/** Every status a ticket can be in. */
export const REQUEST_STATUSES = [
  'Draft',
  'Pending Supervisor Approval',
  'Pending',
  'Under Review',
  'Pending Final Approval',
  'Awaiting Signatures',
  'Approved',
  'Ongoing',
  'On Hold',
  /* 'Returned for Revision' is what a supervisor, admin or approver return
     writes. It is deliberately NOT terminal — the requester revises and the
     request goes back to 'Pending' — so it must be a real value rather than
     being smuggled in as 'Rejected'. */
  'Returned',
  'Completed',
  'Rejected'
];

/** Rendered for use inside an ENUM(...) declaration. */
const enumMembers = (values) => values.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');
const CATEGORY_ENUM_MEMBERS = enumMembers(REQUEST_CATEGORIES);
const LIFECYCLE_STATUS_ENUM = `ENUM(${enumMembers(REQUEST_STATUSES)})`;

/* MariaDB reports a duplicate foreign key or unique key as errno 121
   ("Duplicate key on write or update") rather than a clean "already exists". */
const ALREADY_PRESENT = /Duplicate key name|already exists|1091|errno:\s*121|121 Duplicate/i;

/**
 * Widen an existing column that is too small.
 *
 * `ensureColumn` only handles *missing* columns. Free-text fields such as the
 * request description and the approval remarks must never carry a length cap,
 * so this widens any VARCHAR(255)-style column to TEXT. Idempotent: it is a
 * no-op once the column is already TEXT.
 *
 * `targetType` exists for columns that must hold more than TEXT's 65,535 bytes
 * — base64-encoded images. `MEDIUMTEXT` caps at 16MB, which no photo will reach
 * once the client downscales, but which no VARCHAR ever could.
 */
async function widenTextColumn(conn, dbName, tableName, columnName, targetType = 'TEXT') {
  try {
    const [rows] = await conn.query(
      `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS max_len
         FROM information_schema.columns
        WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
      [dbName, tableName, columnName]
    );
    const col = rows[0];
    if (!col) return;
    // Already TEXT / MEDIUMTEXT / LONGTEXT — nothing to do.
    if (col.DATA_TYPE !== 'varchar') return;

    await conn.query(
      `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${targetType} DEFAULT NULL`
    );
    console.log(
      `[migration] Widened \`${tableName}\`.\`${columnName}\` from VARCHAR(${col.max_len}) to ${targetType} (no length limit).`
    );
  } catch (err) {
    console.warn(`[migration] Could not widen \`${tableName}\`.\`${columnName}\`:`, err.message);
  }
}

async function ensureColumn(conn, dbName, tableName, columnName, columnDefinition) {  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [dbName, tableName, columnName]
  );
  if (rows[0].cnt === 0) {
    try {
      await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
      console.log(`[migration] Added column \`${columnName}\` to \`${tableName}\`.`);
    } catch (err) {
      console.warn(`[migration] Could not add \`${columnName}\` to \`${tableName}\`:`, err.message);
    }
  }
}

export async function autoSetup() {
  const dbName = process.env.DB_NAME || 'fixit_pdas';

  let rootConn;
  rootConn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    // ── Step 1: Create DB if missing ──────────────────────────
    await rootConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await rootConn.query(`USE \`${dbName}\``);
    console.log(`[setup] Database "${dbName}" ready.`);

    // ── Step 2: Import schema if tables don't exist ────────────
    const [tables] = await rootConn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'users'`,
      [dbName]
    );
    const usersTableExists = tables[0].cnt > 0;

    if (!usersTableExists) {
      console.log('[setup] Tables not found — importing schema.sql...');
      if (!fs.existsSync(SCHEMA_PATH)) {
        console.warn(`[setup] WARNING: schema.sql not found at ${SCHEMA_PATH}. Skipping.`);
      } else {
        const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
        await rootConn.query(sql);
        console.log('[setup] Schema imported successfully.');
      }
    } else {
      console.log('[setup] Tables exist — verifying schema migrations...');
      
      // Run dynamic non-destructive schema migrations for existing DB
      // 1. users columns
      await ensureColumn(rootConn, dbName, 'users', 'middle_name', 'VARCHAR(100) DEFAULT NULL AFTER first_name');
      await ensureColumn(rootConn, dbName, 'users', 'gender', 'VARCHAR(30) DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'users', 'address', 'TEXT DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'users', 'birthday', 'DATE DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'users', 'age', 'INT DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'users', 'id_photo_url', 'MEDIUMTEXT DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'users', 'office', 'VARCHAR(150) DEFAULT NULL AFTER department');
      await ensureColumn(rootConn, dbName, 'users', 'is_supervisor', 'TINYINT(1) NOT NULL DEFAULT 0');
      // supervisor_id: nullable FK to users(id), used to record which designated
      // supervisor is responsible for a given Faculty/Staff member. The FK is
      // added as a deferred step after the column exists.
      await ensureColumn(rootConn, dbName, 'users', 'supervisor_id', 'INT DEFAULT NULL');

      // 2. registration_requests columns
      await ensureColumn(rootConn, dbName, 'registration_requests', 'middle_name', 'VARCHAR(100) DEFAULT NULL AFTER first_name');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'gender', 'VARCHAR(30) DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'address', 'TEXT DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'birthday', 'DATE DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'age', 'INT DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'id_photo_url', 'MEDIUMTEXT DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'office', 'VARCHAR(150) DEFAULT NULL AFTER department');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'is_supervisor', 'TINYINT(1) NOT NULL DEFAULT 0');
      // Data Privacy Act compliance: store timestamp when user gave consent
      await ensureColumn(rootConn, dbName, 'registration_requests', 'consent_at', 'DATETIME DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'users', 'consent_at', 'DATETIME DEFAULT NULL');

      // 2b. campus_locations: the QR payload printed on each room/building tag.
      // Chapter 3 states the location table lists campus areas "together with
      // their QR codes", so this is part of the requirement. The UNIQUE index
      // lets the scanner resolve a scan to exactly one place.
      await ensureColumn(rootConn, dbName, 'campus_locations', 'qr_code', 'VARCHAR(64) DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'campus_locations', 'description', 'VARCHAR(255) DEFAULT NULL');
      try {
        await rootConn.query('ALTER TABLE `campus_locations` ADD UNIQUE KEY `uq_cl_qr_code` (`qr_code`)');
      } catch (err) {
        if (!ALREADY_PRESENT.test(String(err.message))) {
          console.warn('[migration] Could not add uq_cl_qr_code:', err.message);
        }
      }

      // 3. job_requests columns & enums
      await ensureColumn(rootConn, dbName, 'job_requests', 'urgency_level', "ENUM('Low Risk','Medium Risk','High Risk') NOT NULL DEFAULT 'Medium Risk' AFTER description");
      await ensureColumn(rootConn, dbName, 'job_requests', 'request_type', "ENUM('Standard Request','Urgent Request') NOT NULL DEFAULT 'Standard Request' AFTER urgency_level");
      await ensureColumn(rootConn, dbName, 'job_requests', 'is_standard_form_filled', "BOOLEAN NOT NULL DEFAULT TRUE AFTER request_type");
      await ensureColumn(rootConn, dbName, 'job_requests', 'immediate_supervisor', "VARCHAR(150) DEFAULT NULL AFTER is_standard_form_filled");
      // The optional photo the requester attaches (ch1: "an optional photo",
      // ch3: "submit a maintenance request with a photo").
      await ensureColumn(rootConn, dbName, 'job_requests', 'photo_url', "MEDIUMTEXT DEFAULT NULL AFTER immediate_supervisor");
      await ensureColumn(rootConn, dbName, 'job_requests', 'photo_name', "VARCHAR(255) DEFAULT NULL AFTER photo_url");
      // The QR tag the request was filed against — the link back to the
      // physical tag on the wall. Not unique: many tickets may share a room.
      await ensureColumn(rootConn, dbName, 'job_requests', 'qr_code_ref', "VARCHAR(64) DEFAULT NULL AFTER photo_name");
      await ensureColumn(rootConn, dbName, 'job_requests', 'is_archived', "BOOLEAN NOT NULL DEFAULT FALSE");
      await ensureColumn(rootConn, dbName, 'job_requests', 'archived_at', "DATETIME DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'is_replacement_flagged', "BOOLEAN NOT NULL DEFAULT FALSE");
      await ensureColumn(rootConn, dbName, 'job_requests', 'replacement_reason', "TEXT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'replacement_item_specs', "TEXT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'replacement_procurement_status', "VARCHAR(100) DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'signed_form_confirmed', "BOOLEAN NOT NULL DEFAULT FALSE");
      await ensureColumn(rootConn, dbName, 'job_requests', 'signed_form_confirmed_by', "INT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'signed_form_confirmed_at', "DATETIME DEFAULT NULL");

      // 4-Party Approval Chain & Tracking columns
      await ensureColumn(rootConn, dbName, 'job_requests', 'requester_approved', "TINYINT(1) NOT NULL DEFAULT 0");
      await ensureColumn(rootConn, dbName, 'job_requests', 'requester_approved_at', "DATETIME DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'supervisor_id', "INT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'supervisor_approved', "TINYINT(1) NOT NULL DEFAULT 0");
      await ensureColumn(rootConn, dbName, 'job_requests', 'supervisor_approved_at', "DATETIME DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'supervisor_remarks', "TEXT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'admin_approved', "TINYINT(1) NOT NULL DEFAULT 0");
      await ensureColumn(rootConn, dbName, 'job_requests', 'admin_approved_at', "DATETIME DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'admin_remarks', "TEXT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'admin_field_remarks', "TEXT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'campus_admin_approved', "TINYINT(1) NOT NULL DEFAULT 0");
      await ensureColumn(rootConn, dbName, 'job_requests', 'campus_admin_approved_at', "DATETIME DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'campus_admin_remarks', "TEXT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'official_tracking_no', "VARCHAR(50) DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'rejection_stage', "VARCHAR(50) DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'rejection_remarks', "TEXT DEFAULT NULL");

      // Free-text fields must have no length cap. Older databases shipped
      // job_request_status_history.remarks as VARCHAR(255), which silently
      // truncated every approval remark past 255 characters.
      await widenTextColumn(rootConn, dbName, 'job_requests', 'description');
      await widenTextColumn(rootConn, dbName, 'job_requests', 'replacement_reason');
      await widenTextColumn(rootConn, dbName, 'job_requests', 'replacement_item_specs');
      await widenTextColumn(rootConn, dbName, 'job_request_status_history', 'remarks');

      // ID photos used to sit in VARCHAR(500) on a server with strict mode OFF,
      // so any real photo was silently truncated to garbage while the API still
      // reported success. MEDIUMTEXT holds 16MB and cannot truncate.
      await widenTextColumn(rootConn, dbName, 'users', 'id_photo_url', 'MEDIUMTEXT');
      await widenTextColumn(rootConn, dbName, 'registration_requests', 'id_photo_url', 'MEDIUMTEXT');

      // Client-generated key for a request that was filed while the network was
      // down and is being retried. Without it a retry — whether automatic or
      // the user pressing submit twice — creates a second ticket, and a
      // facilities office does not quietly receive duplicates.
      await ensureColumn(rootConn, dbName, 'job_requests', 'idempotency_key', 'VARCHAR(64) DEFAULT NULL');
      try {
        await rootConn.query(
          'ALTER TABLE `job_requests` ADD UNIQUE KEY `uq_jr_idempotency_key` (`idempotency_key`)'
        );
      } catch (e) {
        if (!ALREADY_PRESENT.test(e.message)) {
          console.warn('[migration] Notice on idempotency_key unique index:', e.message);
        }
      }

      // Login hardening columns (Phase 2)
      await ensureColumn(rootConn, dbName, 'users', 'failed_login_attempts', "INT NOT NULL DEFAULT 0");
      await ensureColumn(rootConn, dbName, 'users', 'locked_until', "DATETIME DEFAULT NULL");

      // Audit log table (Phase 2: who did what, when)
      await rootConn.query(`
        CREATE TABLE IF NOT EXISTS \`audit_log\` (
          \`id\`         INT AUTO_INCREMENT PRIMARY KEY,
          \`actor_id\`   INT DEFAULT NULL,
          \`action\`     VARCHAR(100) NOT NULL,
          \`entity\`     VARCHAR(50) NOT NULL,
          \`entity_id\`  VARCHAR(50) DEFAULT NULL,
          \`details\`    TEXT DEFAULT NULL,
          \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_audit_actor\` (\`actor_id\`),
          INDEX \`idx_audit_entity\` (\`entity\`, \`entity_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // ticket_sequences table: atomic, race-condition-safe ticket numbering.
      await rootConn.query(`
        CREATE TABLE IF NOT EXISTS \`ticket_sequences\` (
          \`year\`    YEAR NOT NULL PRIMARY KEY,
          \`last_no\` INT  NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // tracking_sequences table: atomic official TRK-YYYY-NNNN generation.
      // Issued once on final approval + technician assignment to avoid conflicts.
      await rootConn.query(`
        CREATE TABLE IF NOT EXISTS \`tracking_sequences\` (
          \`year\`    YEAR NOT NULL PRIMARY KEY,
          \`last_no\` INT  NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // documents: add file_size for storage quota tracking
      await ensureColumn(rootConn, dbName, 'documents', 'file_size', 'INT UNSIGNED DEFAULT NULL');

      // Update status enum for job_requests
      try {
        await rootConn.query(
          `ALTER TABLE \`job_requests\` MODIFY COLUMN \`status\`
           ${LIFECYCLE_STATUS_ENUM}
           NOT NULL DEFAULT 'Pending'`
        );
      } catch (e) {
        console.warn('[migration] Notice on job_requests status enum update:', e.message);
      }

      // The category enum was still the original six trade slugs
      // (electrical/plumbing/carpentry/ict/janitorial/other) while the app
      // writes the human-readable trade names. This MariaDB runs without
      // STRICT_TRANS_TABLES, so an unmatched ENUM value is NOT an error: it is
      // silently stored as '' with no warning and the API still answers 201.
      // Every ticket except "Electrical" therefore lost its category, and the
      // category filters and analytics had nothing left to group by.
      // Widen the enum to the real vocabulary so a value the app can produce is
      // always a value the column accepts.
      try {
        await rootConn.query(
          `ALTER TABLE \`job_requests\` MODIFY COLUMN \`category\`
           ENUM(${CATEGORY_ENUM_MEMBERS}) NOT NULL DEFAULT 'Electrical'`
        );
        console.log('[migration] job_requests.category enum aligned with the app vocabulary.');
      } catch (e) {
        console.warn('[migration] Notice on job_requests category enum update:', e.message);
      }

      // The official control number is the identifier printed on the signed
      // QF-PDAS-DC-01 form. It is generated from an atomic sequence, but an
      // admin can also override it by hand, and without a unique index two
      // tickets can end up carrying the same control number on paper. MySQL
      // allows many NULLs in a UNIQUE index, so existing un-numbered rows are
      // unaffected.
      try {
        await rootConn.query(
          'ALTER TABLE `job_requests` ADD UNIQUE KEY `uq_jr_official_tracking_no` (`official_tracking_no`)'
        );
      } catch (e) {
        // 1061 = duplicate key name (already present), 1062 = existing duplicate
        // values. Either way there is nothing further to do at boot; pre-existing
        // duplicates are reported by `npm run check:duplicates`.
        if (!ALREADY_PRESENT.test(e.message)) {
          console.warn('[migration] Notice on official_tracking_no unique index:', e.message);
        }
      }

      // 4. evaluations columns (ISO/IEC 25010)
      await ensureColumn(rootConn, dbName, 'evaluations', 'functional_suitability', 'TINYINT NOT NULL DEFAULT 5');
      await ensureColumn(rootConn, dbName, 'evaluations', 'usability', 'TINYINT NOT NULL DEFAULT 5');
      await ensureColumn(rootConn, dbName, 'evaluations', 'reliability', 'TINYINT NOT NULL DEFAULT 5');
      await ensureColumn(rootConn, dbName, 'evaluations', 'performance_efficiency', 'TINYINT NOT NULL DEFAULT 5');
      // The fifth characteristic the paper evaluates (ch1.md:42, ch3.md:162).
      // The other four were the only ones implemented, so objective 9 could not
      // be answered for security. Runs before app.listen (server.js:171), so the
      // column exists before the first INSERT can reference it.
      await ensureColumn(rootConn, dbName, 'evaluations', 'security', 'TINYINT NOT NULL DEFAULT 5');

      /* One evaluation per person per request.
         The POST handler checks for an existing row before inserting, but two
         submissions in flight both read "none found" and both insert. This
         constraint is the real guard; the handler turns a violation into the
         same 409 the check would have produced. */
      try {
        await rootConn.query(
          'ALTER TABLE `evaluations` ADD UNIQUE KEY `uq_eval_job_user` (`job_request_id`, `evaluated_by`)'
        );
      } catch (e) {
        if (!ALREADY_PRESENT.test(e.message) && !/1062|Duplicate entry/i.test(e.message)) {
          console.warn('[migration] Notice on evaluations unique index:', e.message);
        }
      }

      // 5. preventive_maintenance_schedules table
      await rootConn.query(`
        CREATE TABLE IF NOT EXISTS \`preventive_maintenance_schedules\` (
          \`id\`             INT AUTO_INCREMENT PRIMARY KEY,
          \`title\`          VARCHAR(255) NOT NULL,
          \`category\`       VARCHAR(100) NOT NULL,
          \`scheduled_date\` DATE NOT NULL,
          \`time_window\`    VARCHAR(100) DEFAULT '08:00 AM - 12:00 PM',
          \`location\`       VARCHAR(255) NOT NULL,
          \`assigned_to\`    INT DEFAULT NULL,
          \`in_charge_name\` VARCHAR(150) DEFAULT NULL,
          \`status\`         ENUM('Scheduled','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
          \`created_at\`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_pms_assigned\` FOREIGN KEY (\`assigned_to\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      // ── Supervisor role migration (one-time, idempotent) ─────────────────
      // Any user whose role is 'supervisor' becomes role='faculty' (or 'staff')
      // with is_supervisor=1. The 'supervisor' role value is then removed from
      // the ENUM. This is done before the MODIFY so no live row uses the old value.
      try {
        const [supRows] = await rootConn.query(
          "SELECT id, role FROM users WHERE role = 'supervisor'"
        );
        if (supRows.length > 0) {
          await rootConn.query(
            "UPDATE users SET role = 'faculty', is_supervisor = 1 WHERE role = 'supervisor'"
          );
          console.log(`[migration] Migrated ${supRows.length} user(s) from role='supervisor' to role='faculty' with is_supervisor=1.`);
        } else {
          console.log('[migration] No legacy supervisor role accounts found (already migrated or not yet seeded).');
        }
      } catch (e) {
        console.warn('[migration] Notice on supervisor role migration:', e.message);
      }

      // Add the supervisor_id FK constraint (deferred so column & data exist first).
      try {
        await rootConn.query(
          'ALTER TABLE `users` ADD CONSTRAINT `fk_user_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL'
        );
      } catch (e) {
        if (!ALREADY_PRESENT.test(e.message)) {
          console.warn('[migration] Notice on users.supervisor_id FK:', e.message);
        }
      }

      // Update role enum — remove 'supervisor', keep all other values.
      try {
        await rootConn.query(
          `ALTER TABLE \`users\` MODIFY COLUMN \`role\`
           ENUM('admin','campus_admin','faculty','staff','maintenance','technician')
           NOT NULL DEFAULT 'faculty'`
        );
        console.log('[migration] users.role ENUM: removed supervisor value.');
      } catch (e) {
        console.warn('[migration] Notice on users role enum update:', e.message);
      }

      try {
        await rootConn.query(
          `ALTER TABLE \`registration_requests\` MODIFY COLUMN \`role\`
           ENUM('faculty','staff')
           NOT NULL DEFAULT 'faculty'`
        );
      } catch (e) {
        console.warn('[migration] Notice on registration_requests role enum update:', e.message);
      }
    }

    // ── Step 3: Seed admin user if none exists ─────────────────
    const adminEmail = process.env.ADMIN_EMAIL || 'adminisatu.edu.ph@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminFirst = process.env.ADMIN_FIRST_NAME || 'Kristine J.';
    const adminLast = process.env.ADMIN_LAST_NAME || 'Amar';

    if (adminEmail && adminPassword) {
      const [existing] = await rootConn.query(
        'SELECT id FROM users WHERE email = ?',
        [adminEmail]
      );

      if (existing.length === 0) {
        const hash = await bcrypt.hash(adminPassword, 10);
        await rootConn.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, role, status)
           VALUES (?, ?, ?, ?, 'admin', 'active')`,
          [adminFirst, adminLast, adminEmail, hash]
        );
        console.log(`[setup] Admin account created: ${adminEmail}`);
      } else {
        console.log(`[setup] Admin account already exists: ${adminEmail}`);
      }
    }

    // ── Step 4: Seed default test accounts for all roles ───────
    /* These accounts have published, well-known passwords and were re-created
       on every boot. That is fine for a thesis demo on a laptop and dangerous
       anywhere else, so production never seeds them and never falls back to a
       hard-coded admin password. */
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      console.log('[setup] NODE_ENV=production — skipping demo account seeding.');
      if (!process.env.ADMIN_PASSWORD) {
        console.error('[setup] WARNING: ADMIN_PASSWORD is not set and the demo admin');
        console.error('        seed is disabled in production. Create the first admin');
        console.error('        with: npm run seed:admin');
      }
    } else {
      const testAccounts = [
        { firstName: 'Dr. Ramil G.', lastName: 'Lumauag',      email: 'campusadmin@isatu.edu.ph',  password: 'admin123',     role: 'campus_admin', department: 'Office of the Campus Administrator' },
        // Note: supervisor@isatu.edu.ph is now a faculty account with is_supervisor=1
        { firstName: 'Engr. Roberto D.', lastName: 'Cruz',    email: 'supervisor@isatu.edu.ph',   password: 'supervisor123', role: 'faculty',      department: 'Office of Instruction', isSupervisor: 1 },
        { firstName: 'Mark',         lastName: 'Villanueva',   email: 'maintenance@isatu.edu.ph',  password: 'tech123',      role: 'maintenance',  department: 'Planning, Development, and Auxiliary Services' },
        { firstName: 'Elena',        lastName: 'Ramos',         email: 'faculty@isatu.edu.ph',      password: 'faculty123',   role: 'faculty',      department: 'BSIT' },
        { firstName: 'Juan',         lastName: 'Santos',        email: 'staff@isatu.edu.ph',        password: 'staff123',     role: 'staff',        department: 'Planning, Development, and Auxiliary Services Office' },
      ];

      for (const acct of testAccounts) {
        const [ex] = await rootConn.query('SELECT id FROM users WHERE email = ?', [acct.email]);
        if (ex.length === 0) {
          const h = await bcrypt.hash(acct.password, 10);
          await rootConn.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, role, is_supervisor, department, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
            [acct.firstName, acct.lastName, acct.email, h, acct.role, acct.isSupervisor || 0, acct.department || null]
          );
          console.log(`[setup] Test account created (${acct.role}${acct.isSupervisor ? ' [Supervisor designation]' : ''}): ${acct.email}`);
        } else if (acct.isSupervisor) {
          // If the account already exists (prior seeding as 'supervisor' role),
          // ensure is_supervisor flag is set after migration.
          await rootConn.query(
            'UPDATE users SET role = ?, is_supervisor = 1 WHERE email = ? AND (role = ? OR role = ?)',
            [acct.role, acct.email, acct.role, 'supervisor']
          );
        }
      }
    }

    console.log('[setup] Auto-setup & migrations complete.');
  } finally {
    await rootConn.end();
  }
}
