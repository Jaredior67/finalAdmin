/* Read-only diagnostic: list every account and why login would be refused.
   Run: node scripts/check-login.mjs                                            */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [rows] = await pool.query(`
  SELECT id, email, role, status, failed_login_attempts, locked_until,
         password_hash IS NOT NULL AS has_hash, LENGTH(password_hash) AS hash_len
    FROM users ORDER BY role, email
`);

console.log('\nid  email                              role           status        fails  locked_until            hash');
console.log('-'.repeat(100));
for (const u of rows) {
  console.log(
    [
      String(u.id).padEnd(3),
      String(u.email).padEnd(34),
      String(u.role).padEnd(14),
      String(u.status).padEnd(13),
      String(u.failed_login_attempts ?? 0).padEnd(6),
      String(u.locked_until ?? '-').padEnd(23),
      u.has_hash ? `yes(${u.hash_len})` : 'NO'
    ].join(' ')
  );
}
console.log(`\n${rows.length} account(s)\n`);
await pool.end();
