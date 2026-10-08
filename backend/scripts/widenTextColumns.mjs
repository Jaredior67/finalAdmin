/* Widen every free-text column to TEXT so no user input is length-capped.
 *
 * Free-text fields (request description, approval remarks, rejection reasons)
 * must not carry a character limit. Older databases shipped
 * job_request_status_history.remarks as VARCHAR(255), which silently truncated
 * approver remarks past 255 characters.
 *
 * Idempotent — a no-op once the column is already TEXT.
 * Run: node scripts/widenTextColumns.mjs                                      */
import 'dotenv/config';
import mysql from 'mysql2/promise';

// Free-text columns only. Deliberately excludes short identifier/name fields
// (ticket_no, immediate_supervisor, tracking refs) where a bound is correct.
const TARGETS = [
  { table: 'job_requests', column: 'description' },
  { table: 'job_requests', column: 'replacement_reason' },
  { table: 'job_requests', column: 'replacement_item_specs' },
  { table: 'job_requests', column: 'supervisor_remarks' },
  { table: 'job_requests', column: 'admin_remarks' },
  { table: 'job_requests', column: 'admin_field_remarks' },
  { table: 'job_requests', column: 'campus_admin_remarks' },
  { table: 'job_requests', column: 'rejection_remarks' },
  { table: 'job_request_status_history', column: 'remarks' },
  { table: 'evaluations', column: 'comments' },
  { table: 'messages', column: 'body' },
  { table: 'message_replies', column: 'body' }
];

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

let changed = 0;
let skipped = 0;

for (const { table, column } of TARGETS) {
  const [rows] = await pool.query(
    `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS max_len
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_NAME, table, column]
  );

  const col = rows[0];
  if (!col) {
    console.log(`  --  ${table}.${column} does not exist (skipped)`);
    continue;
  }
  if (col.DATA_TYPE !== 'varchar') {
    console.log(`  ok  ${table}.${column} is already ${col.DATA_TYPE}`);
    skipped += 1;
    continue;
  }

  await pool.query(
    `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` TEXT DEFAULT NULL`
  );
  console.log(`  ++  ${table}.${column}  VARCHAR(${col.max_len}) -> TEXT`);
  changed += 1;
}

console.log(`\n${changed} widened, ${skipped} already fine.\n`);
await pool.end();
