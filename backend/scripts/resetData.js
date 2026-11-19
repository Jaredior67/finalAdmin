/**
 * FixIt PDAS — Full Transactional Data Reset Script
 * Run: node backend/scripts/resetData.js
 *
 * Clears ALL transactional data (job_requests, notifications, messages,
 * audit_log, evaluations, documents, pm_schedules, ticket/tracking sequences)
 * while preserving: users, registration_requests, campus_locations.
 */

import db from '../src/config/db.js';

const TABLES_TO_CLEAR = [
  'audit_log',
  'job_request_status_history',
  'evaluations',
  'documents',
  'message_replies',
  'messages',
  'notifications',
  'preventive_maintenance_schedules',
  'job_requests',
  'ticket_sequences',
  'tracking_sequences',
];

const TABLES_TO_PRESERVE = [
  'users',
  'registration_requests',
  'campus_locations',
];

async function run() {
  const conn = await db.getConnection();
  try {
    console.log('\n🔴 FixIt PDAS — Transactional Data Reset\n');
    console.log('Disabling FK checks...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of TABLES_TO_CLEAR) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`  ✅ TRUNCATED: ${table}`);
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\nRe-enabled FK checks.');

    // Confirmation counts
    console.log('\n── Verification ───────────────────────────────');
    for (const table of [...TABLES_TO_CLEAR, ...TABLES_TO_PRESERVE]) {
      const [[{ count }]] = await conn.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      const icon = TABLES_TO_CLEAR.includes(table)
        ? (count === 0 ? '✅' : '❌')
        : '👤';
      console.log(`  ${icon} ${table}: ${count} rows`);
    }

    console.log('\n✅ Reset complete. All transactional data has been cleared.');
    console.log('   Users, locations, and registration requests are preserved.');
    console.log('   Next ticket will be TRK-YYYY-0001.\n');
  } catch (err) {
    console.error('\n❌ Reset failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
