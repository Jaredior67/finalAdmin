/**
 * autoSetup.js
 * Runs on every server startup.
 * - Creates the fixit_pdas database if it doesn't exist.
 * - Imports schema.sql if the `users` table is missing.
 * - Runs non-destructive column/table migrations for existing schemas.
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

async function ensureColumn(conn, dbName, tableName, columnName, columnDefinition) {
  const [rows] = await conn.query(
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
      await ensureColumn(rootConn, dbName, 'users', 'id_photo_url', 'VARCHAR(500) DEFAULT NULL');

      // 2. registration_requests columns
      await ensureColumn(rootConn, dbName, 'registration_requests', 'middle_name', 'VARCHAR(100) DEFAULT NULL AFTER first_name');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'gender', 'VARCHAR(30) DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'address', 'TEXT DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'birthday', 'DATE DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'age', 'INT DEFAULT NULL');
      await ensureColumn(rootConn, dbName, 'registration_requests', 'id_photo_url', 'VARCHAR(500) DEFAULT NULL');

      // 3. job_requests columns & enums
      await ensureColumn(rootConn, dbName, 'job_requests', 'urgency_level', "ENUM('Low Risk','Medium Risk','High Risk') NOT NULL DEFAULT 'Medium Risk' AFTER description");
      await ensureColumn(rootConn, dbName, 'job_requests', 'request_type', "ENUM('Standard Request','Urgent Request') NOT NULL DEFAULT 'Standard Request' AFTER urgency_level");
      await ensureColumn(rootConn, dbName, 'job_requests', 'is_standard_form_filled', "BOOLEAN NOT NULL DEFAULT TRUE AFTER request_type");
      await ensureColumn(rootConn, dbName, 'job_requests', 'immediate_supervisor', "VARCHAR(150) DEFAULT NULL AFTER is_standard_form_filled");
      await ensureColumn(rootConn, dbName, 'job_requests', 'is_archived', "BOOLEAN NOT NULL DEFAULT FALSE");
      await ensureColumn(rootConn, dbName, 'job_requests', 'archived_at', "DATETIME DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'is_replacement_flagged', "BOOLEAN NOT NULL DEFAULT FALSE");
      await ensureColumn(rootConn, dbName, 'job_requests', 'replacement_reason', "TEXT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'replacement_item_specs', "TEXT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'replacement_procurement_status', "VARCHAR(100) DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'signed_form_confirmed', "BOOLEAN NOT NULL DEFAULT FALSE");
      await ensureColumn(rootConn, dbName, 'job_requests', 'signed_form_confirmed_by', "INT DEFAULT NULL");
      await ensureColumn(rootConn, dbName, 'job_requests', 'signed_form_confirmed_at', "DATETIME DEFAULT NULL");

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

      // Update status enum for job_requests
      try {
        await rootConn.query(
          `ALTER TABLE \`job_requests\` MODIFY COLUMN \`status\`
           ENUM('Pending','Under Review','Awaiting Signatures','Approved','Ongoing','Completed','Rejected')
           NOT NULL DEFAULT 'Pending'`
        );
      } catch (e) {
        console.warn('[migration] Notice on job_requests status enum update:', e.message);
      }

      // 4. evaluations columns (ISO/IEC 25010)
      await ensureColumn(rootConn, dbName, 'evaluations', 'functional_suitability', 'TINYINT NOT NULL DEFAULT 5');
      await ensureColumn(rootConn, dbName, 'evaluations', 'usability', 'TINYINT NOT NULL DEFAULT 5');
      await ensureColumn(rootConn, dbName, 'evaluations', 'reliability', 'TINYINT NOT NULL DEFAULT 5');
      await ensureColumn(rootConn, dbName, 'evaluations', 'performance_efficiency', 'TINYINT NOT NULL DEFAULT 5');

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
      // Update role enum for users and registration_requests if needed
      try {
        await rootConn.query(
          `ALTER TABLE \`users\` MODIFY COLUMN \`role\`
           ENUM('admin','campus_admin','faculty','staff','maintenance','technician')
           NOT NULL DEFAULT 'faculty'`
        );
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
    const testAccounts = [
      { firstName: 'Dr. Ramil G.', lastName: 'Lumauag',      email: 'campusadmin@isatu.edu.ph', password: 'admin123',   role: 'campus_admin', department: 'Office of the Campus Administrator' },
      { firstName: 'Mark',         lastName: 'Villanueva',   email: 'maintenance@isatu.edu.ph', password: 'tech123',     role: 'maintenance',  department: 'PDAS Maintenance' },
      { firstName: 'Elena',        lastName: 'Ramos',         email: 'faculty@isatu.edu.ph',     password: 'faculty123', role: 'faculty',      department: 'College of Engineering & Architecture (CEA)' },
      { firstName: 'Juan',         lastName: 'Santos',        email: 'staff@isatu.edu.ph',        password: 'staff123',   role: 'staff',        department: 'PDAS Central Office' },
    ];

    for (const acct of testAccounts) {
      const [ex] = await rootConn.query('SELECT id FROM users WHERE email = ?', [acct.email]);
      if (ex.length === 0) {
        const h = await bcrypt.hash(acct.password, 10);
        await rootConn.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, role, department, status)
           VALUES (?, ?, ?, ?, ?, ?, 'active')`,
          [acct.firstName, acct.lastName, acct.email, h, acct.role, acct.department || null]
        );
        console.log(`[setup] Test account created (${acct.role}): ${acct.email}`);
      }
    }

    console.log('[setup] Auto-setup & migrations complete.');
  } finally {
    await rootConn.end();
  }
}
