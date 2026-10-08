/* Set or reset any account's password, and clear its lockout.
   Useful when someone is locked out (5 failed attempts = 15 min) or when you
   just want a known credential for a demo account.

   Run: node scripts/reset-password.mjs <email> <newPassword>
   e.g. node scripts/reset-password.mjs supervisor@isatu.edu.ph supervisor123 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const [emailArg, passwordArg] = process.argv.slice(2);

if (!emailArg || !passwordArg) {
  console.error('Usage: node scripts/reset-password.mjs <email> <newPassword>');
  process.exit(1);
}

if (passwordArg.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const [rows] = await pool.query('SELECT id, email, role, status FROM `users` WHERE email = ?', [emailArg]);
const user = rows[0];

if (!user) {
  console.error(`No account found for "${emailArg}".`);
  console.error('Run "npm run check:login" to list the accounts that do exist.');
  await pool.end();
  process.exit(1);
}

const hash = bcrypt.hashSync(passwordArg, 10);
await pool.query(
  'UPDATE `users` SET `password_hash` = ?, `failed_login_attempts` = 0, `locked_until` = NULL, `status` = ? WHERE `id` = ?',
  [hash, 'active', user.id]
);

console.log(`Reset ${user.email}`);
console.log(`  role            : ${user.role}`);
console.log(`  password        : ${passwordArg}`);
console.log(`  failed attempts : 0 (cleared)`);
console.log(`  locked until    : cleared`);
console.log(`  status          : active`);

await pool.end();
