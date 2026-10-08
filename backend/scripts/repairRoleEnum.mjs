/* Repair: widen the users.role ENUM to the exact set of roles the app ships,
   and re-stamp any account that was written with an invalid (empty) role.

   Symptom this fixes: "This account is not authorized for the supervisor
   portal." (HTTP 403 on POST /api/auth/login). A database created before the
   current role list existed still has a narrower ENUM, so MySQL silently
   coerced the account's role to the empty enum value ''.

   'supervisor' is deliberately NOT one of these roles. It is an admin-managed
   DESIGNATION (users.is_supervisor) on a faculty/staff account — see
   database/schema.sql and the autoSetup migration, which converts role
   'supervisor' rows to role='faculty' + is_supervisor=1. This script used to
   re-add the value to the ENUM, undoing that migration the next time it ran.

   Idempotent — safe to re-run. Run: node scripts/repairRoleEnum.mjs          */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const ROLES = ['admin', 'campus_admin', 'faculty', 'staff', 'maintenance', 'technician'];

/* Local parts that still mean "the supervisor account" even though the role
   itself no longer exists. Inference maps them to the role that replaced it. */
const EMAIL_ROLE_ALIASES = { supervisor: 'faculty' };

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: false
});

const readEnum = async () => {
  // INFORMATION_SCHEMA rather than `SHOW COLUMNS ... LIKE` — MariaDB rejects
  // the backticked pattern there.
  const [cols] = await pool.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`,
    [process.env.DB_NAME]
  );
  return (cols[0]?.COLUMN_TYPE || '')
    .replace(/^enum\(/i, '')
    .replace(/\)$/, '')
    .split(',')
    .map((v) => v.trim().replace(/^'|'$/g, ''));
};

const before = await readEnum();
console.log('role ENUM before:', before.join(', ') || '(none)');

/* A leftover role='supervisor' row must be converted BEFORE the ENUM loses the
   value, otherwise the MODIFY coerces it to '' and the account is stranded with
   no usable role. This mirrors the autoSetup migration. */
const [legacySupervisors] = await pool.query(
  "SELECT id, email FROM `users` WHERE `role` = 'supervisor'"
);
for (const u of legacySupervisors) {
  await pool.query("UPDATE `users` SET `role` = 'faculty', `is_supervisor` = 1 WHERE `id` = ?", [u.id]);
  console.log(`  -> id=${u.id} ${u.email} role 'supervisor' moved to 'faculty' with is_supervisor = 1`);
}

const wanted = [...ROLES].sort().join(',');
const actual = before.filter((r) => r !== 'supervisor').sort().join(',');
if (actual !== wanted || before.includes('supervisor')) {
  // Rebuild in the canonical order so the column matches schema.sql exactly.
  await pool.query(
    `ALTER TABLE \`users\` MODIFY COLUMN \`role\` ENUM(${ROLES.map((r) => `'${r}'`).join(',')}) NOT NULL DEFAULT 'faculty'`
  );
  const missing = ROLES.filter((r) => !before.includes(r));
  const removed = before.filter((r) => !ROLES.includes(r));
  console.log('  -> rewritten:', [
    missing.length ? `added ${missing.join(', ')}` : null,
    removed.length ? `removed ${removed.join(', ')}` : null
  ].filter(Boolean).join('; ') || 'no role values changed');
} else {
  console.log('  -> already complete, no ALTER needed');
}

// Any account still sitting on the empty enum value has no usable role.
const [broken] = await pool.query(
  "SELECT id, email FROM `users` WHERE `role` = '' OR `role` IS NULL"
);
if (broken.length) {
  for (const u of broken) {
    // Infer the role from the local part of the email where it is unambiguous.
    const local = String(u.email).split('@')[0].toLowerCase();
    const guess = ROLES.find((r) => local === r || local === r.replace('_', ''))
      || EMAIL_ROLE_ALIASES[local]
      || null;
    if (!guess) {
      console.log(`  ?? id=${u.id} ${u.email} has an empty role and it cannot be inferred — set it manually`);
      continue;
    }
    // A role that resolves to faculty/staff from a supervisor address is still
    // the Supervisor of their unit, so keep the designation.
    const designate = EMAIL_ROLE_ALIASES[local] === guess ? 1 : 0;
    await pool.query(
      'UPDATE `users` SET `role` = ?' + (designate ? ', `is_supervisor` = 1' : '') + ' WHERE `id` = ?',
      [guess, u.id]
    );
    console.log(`  -> id=${u.id} ${u.email} role set to '${guess}'${designate ? ' (is_supervisor = 1)' : ''}`);
  }
} else {
  console.log('  -> no accounts with an empty role');
}

// Clear any lockout left over from the failed attempts that caused this.
const [locked] = await pool.query(
  'UPDATE `users` SET `failed_login_attempts` = 0, `locked_until` = NULL WHERE `failed_login_attempts` > 0 OR `locked_until` IS NOT NULL'
);
console.log(`  -> cleared lockouts on ${locked.affectedRows} account(s)`);

const after = await readEnum();
console.log('role ENUM after: ', after.join(', '));

const [all] = await pool.query('SELECT email, role, status FROM `users` ORDER BY role, email');
console.log('\naccounts:');
all.forEach((u) => console.log(`  ${String(u.role).padEnd(13)} ${u.email}  [${u.status}]`));

await pool.end();
console.log('\nDone. Retry the login.\n');
