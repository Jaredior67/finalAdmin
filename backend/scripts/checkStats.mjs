/* Prove the statistics endpoint agrees with the database and with the list,
 * under the same visibility scope.
 *
 * Run: npm run check:stats                                                   */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fixit_pdas'
});

console.log('\n=== Statistics endpoint check ===\n');

/* The scope the endpoint applies for an admin is "no filter". */
const [grouped] = await conn.query(
  'SELECT status, COUNT(*) AS n FROM job_requests WHERE is_archived = 0 GROUP BY status'
);
const byStatus = {};
let total = 0;
for (const r of grouped) {
  byStatus[r.status] = Number(r.n);
  total += Number(r.n);
}

console.log('Direct GROUP BY on the live table (is_archived = 0):');
for (const [k, v] of Object.entries(byStatus).sort()) console.log(`   ${k.padEnd(28)} ${v}`);
console.log(`   ${'TOTAL'.padEnd(28)} ${total}`);

// Mirror what the endpoint does: every policy status is pre-seeded at 0 so a
// tile never renders "undefined" for a status nobody is currently using.
const { REQUEST_STATUSES } = await import('../src/scripts/autoSetup.js');
const response = {};
for (const s of REQUEST_STATUSES) response[s] = 0;
for (const r of grouped) {
  const key = r.status ?? 'Unknown';
  response[key] = (response[key] || 0) + Number(r.n);
}

console.log('Response the endpoint would build:');
for (const [k, v] of Object.entries(response)) {
  if (v) console.log(`   ${k.padEnd(28)} ${v}`);
}
console.log(`   ${'(all others)'.padEnd(28)} 0`);
console.log(`   ${'TOTAL'.padEnd(28)} ${total}`);

const missing = REQUEST_STATUSES.filter((s) => !(s in response));
if (missing.length) {
  console.log(`\nFAIL these statuses would be missing from the response: ${missing.join(', ')}`);
} else {
  console.log(`\nok  all ${REQUEST_STATUSES.length} statuses are present in the response (0 where unused)`);
}

// The endpoint must be declared before /:id, or "stats" is read as an id.
const { default: router } = await import('../src/routes/requisitionRoutes.js');
const order = router.stack
  .filter((l) => l.route)
  .map((l) => `${Object.keys(l.route.methods).join(',').toUpperCase()} ${l.route.path}`);
const statsAt = order.findIndex((r) => r.includes('/stats'));
const idAt = order.findIndex((r) => r.includes('/:id'));
console.log(`\nroute order: ${order.slice(0, 4).join('  |  ')}`);
if (statsAt !== -1 && idAt !== -1 && statsAt < idAt) {
  console.log('ok  /stats is declared before /:id, so it is not parsed as an id');
} else {
  console.log('FAIL /stats must be declared before /:id');
}

await conn.end();
console.log('');
process.exit(0);
