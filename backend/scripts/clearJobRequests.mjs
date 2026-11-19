import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fixit_pdas',
});

const conn = await pool.getConnection();

try {
  await conn.beginTransaction();

  // 1. Check existing counts
  const [[{ reqCount }]] = await conn.query('SELECT COUNT(*) AS reqCount FROM job_requests');
  const [[{ histCount }]] = await conn.query('SELECT COUNT(*) AS histCount FROM job_request_status_history');
  console.log(`Before cleanup: ${reqCount} job_requests, ${histCount} status history records.`);

  // 2. Delete child records
  await conn.query('DELETE FROM job_request_status_history');
  await conn.query('DELETE FROM evaluations');
  await conn.query('DELETE FROM documents');

  // 3. Delete job_requests
  await conn.query('DELETE FROM job_requests');

  // 4. Reset auto increment
  await conn.query('ALTER TABLE job_requests AUTO_INCREMENT = 1');

  // 5. Reset ticket & tracking sequences to 0
  await conn.query('UPDATE ticket_sequences SET last_no = 0');
  await conn.query('UPDATE tracking_sequences SET last_no = 0');

  // 6. Delete all request & system notifications
  const [notifResult] = await conn.query('DELETE FROM notifications');
  await conn.query('ALTER TABLE notifications AUTO_INCREMENT = 1');
  console.log(`Cleared ${notifResult.affectedRows} notifications.`);

  // 7. Delete audit_log (recent activity)
  const [auditResult] = await conn.query('DELETE FROM audit_log');
  await conn.query('ALTER TABLE audit_log AUTO_INCREMENT = 1');
  console.log(`Cleared ${auditResult.affectedRows} audit log (recent activity) records.`);

  await conn.commit();

  // 7. Verification
  const [[{ finalReqCount }]] = await conn.query('SELECT COUNT(*) AS finalReqCount FROM job_requests');
  const [[{ finalHistCount }]] = await conn.query('SELECT COUNT(*) AS finalHistCount FROM job_request_status_history');
  const [seqs] = await conn.query('SELECT * FROM ticket_sequences');

  console.log(`After cleanup: ${finalReqCount} job_requests remaining, ${finalHistCount} history records remaining.`);
  console.log('Ticket sequences state:', seqs);
  console.log('Database successfully reset for new job requests!');
} catch (err) {
  await conn.rollback();
  console.error('Error during cleanup, transaction rolled back:', err);
  process.exit(1);
} finally {
  conn.release();
  await pool.end();
}
