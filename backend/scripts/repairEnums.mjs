/* Apply the schema migrations to a live database without a full re-import.
 *
 * The category/status ENUM repair lives in scripts/autoSetup.js, which runs on
 * every boot. This script exists so the same change can be applied on demand
 * (and verified) without restarting the server, and so the data-loss check runs
 * against real rows.
 *
 * Run: npm run repair:enums                                              */
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

const CATEGORIES = [
  'Electrical',
  'Air Conditioning',
  'Mechanical',
  'Water/Sanitary',
  'Physical Structures',
  'Drawing/Design',
  'Safety & Compliance',
  'Urgent Hazard'
];

const STATUSES = [
  'Draft',
  'Pending Supervisor Approval',
  'Pending',
  'Under Review',
  'Pending Final Approval',
  'Awaiting Signatures',
  'Approved',
  'Ongoing',
  'On Hold',
  'Returned',
  'Completed',
  'Rejected'
];

const members = (values) => values.map((v) => `'${v}'`).join(',');
const q = (id) => `\`${id}\``;

console.log('\n=== FixIT PDAS — controlled vocabulary repair ===\n');

// 1. Report data that has already been lost, BEFORE we widen anything.
const [lostCategory] = await conn.query(
  "SELECT COUNT(*) AS n FROM job_requests WHERE category = '' OR category IS NULL"
);
const [lostStatus] = await conn.query(
  "SELECT COUNT(*) AS n FROM job_requests WHERE status = '' OR status IS NULL"
);

if (lostCategory[0].n > 0 || lostStatus[0].n > 0) {
  console.log('!! Rows that lost data to the ENUM mismatch:');
  console.log(`   category destroyed on ${lostCategory[0].n} row(s)`);
  console.log(`   status   destroyed on ${lostStatus[0].n} row(s)`);
  const [rows] = await conn.query(
    "SELECT id, ticket_no, category, status FROM job_requests WHERE category = '' OR status = '' LIMIT 20"
  );
  for (const r of rows) {
    console.log(`   - ${r.ticket_no} (id ${r.id}): category='${r.category}' status='${r.status}'`);
  }
  console.log('   These values were never stored, so they cannot be recovered');
  console.log('   automatically. Re-enter them, or restore from a backup.\n');
} else {
  console.log('No rows have lost category or status to the ENUM mismatch.\n');
}

// 2. Duplicate control numbers block the unique index.
const [dupes] = await conn.query(
  `SELECT official_tracking_no, COUNT(*) AS n
     FROM job_requests
    WHERE official_tracking_no IS NOT NULL AND official_tracking_no <> ''
    GROUP BY official_tracking_no
   HAVING n > 1`
);
if (dupes.length) {
  console.log('!! Duplicate official control numbers (blocks the unique index):');
  for (const d of dupes) console.log(`   ${d.official_tracking_no} appears ${d.n} times`);
  console.log('');
}

// 3. Widen the enums.
try {
  await conn.query(
    `ALTER TABLE ${q('job_requests')} MODIFY COLUMN ${q('category')}
       ENUM(${members(CATEGORIES)}) NOT NULL DEFAULT 'Electrical'`
  );
  console.log('ok  job_requests.category widened to the application vocabulary');
} catch (e) {
  console.error('ERR job_requests.category:', e.message);
}

try {
  await conn.query(
    `ALTER TABLE ${q('job_requests')} MODIFY COLUMN ${q('status')}
       ENUM(${members(STATUSES)}) NOT NULL DEFAULT 'Pending'`
  );
  console.log('ok  job_requests.status widened (adds "On Hold")');
} catch (e) {
  console.error('ERR job_requests.status:', e.message);
}

try {
  await conn.query(
    `ALTER TABLE ${q('job_requests')} ADD UNIQUE KEY ${q('uq_jr_official_tracking_no')} (${q('official_tracking_no')})`
  );
  console.log('ok  unique index added on official_tracking_no');
} catch (e) {
  if (/Duplicate key name/i.test(e.message)) {
    console.log('ok  unique index on official_tracking_no already present');
  } else if (/1062|Duplicate entry/i.test(e.message)) {
    console.error('ERR unique index blocked by pre-existing duplicates (listed above)');
  } else {
    console.error('ERR unique index:', e.message);
  }
}

// 4. Referential integrity for the migration-added columns.
// MariaDB reports a duplicate foreign key as errno 121 ("Duplicate key on write
// or update") rather than a clean "already exists", so match on that too.
const ALREADY_PRESENT = /Duplicate key name|already exists|1091|errno:\s*121|121 Duplicate/i;

for (const [col, constraint] of [
  ['supervisor_id', 'fk_jr_supervisor'],
  ['signed_form_confirmed_by', 'fk_jr_signed_by']
]) {
  try {
    await conn.query(
      `ALTER TABLE ${q('job_requests')}
         ADD CONSTRAINT ${q(constraint)}
         FOREIGN KEY (${q(col)}) REFERENCES ${q('users')}(${q('id')}) ON DELETE SET NULL`
    );
    console.log(`ok  foreign key ${constraint} on ${col}`);
  } catch (e) {
    if (ALREADY_PRESENT.test(e.message)) {
      console.log(`ok  foreign key ${constraint} already present`);
    } else {
      console.error(`ERR foreign key ${constraint}:`, e.message);
    }
  }
}

try {
  await conn.query(
    `ALTER TABLE ${q('audit_log')}
       ADD CONSTRAINT ${q('fk_audit_actor')}
       FOREIGN KEY (${q('actor_id')}) REFERENCES ${q('users')}(${q('id')}) ON DELETE SET NULL`
  );
  console.log('ok  foreign key fk_audit_actor (audit trail survives user deletion)');
} catch (e) {
  if (ALREADY_PRESENT.test(e.message)) {
    console.log('ok  foreign key fk_audit_actor already present');
  } else {
    console.error('ERR foreign key fk_audit_actor:', e.message);
  }
}

/* Idempotency key: what stops a retried offline submission from filing the
 * same request a second time. */
try {
  await conn.query(
    `ALTER TABLE ${q('job_requests')} ADD COLUMN ${q('idempotency_key')} VARCHAR(64) DEFAULT NULL`
  );
  console.log('ok  job_requests.idempotency_key added');
} catch (e) {
  if (/Duplicate column|1060/i.test(e.message)) {
    console.log('ok  job_requests.idempotency_key already present');
  } else {
    console.error('ERR idempotency_key column:', e.message);
  }
}

try {
  await conn.query(
    `ALTER TABLE ${q('job_requests')} ADD UNIQUE KEY ${q('uq_jr_idempotency_key')} (${q('idempotency_key')})`
  );
  console.log('ok  unique index on idempotency_key (a retry cannot file twice)');
} catch (e) {
  if (ALREADY_PRESENT.test(e.message)) {
    console.log('ok  unique index on idempotency_key already present');
  } else {
    console.error('ERR idempotency_key unique index:', e.message);
  }
}

/* One evaluation per person per request. The POST handler checks first, but a
 * read-then-write cannot see another transaction's uncommitted row, so only
 * this index actually prevents a double submission. */
const [dupeEvals] = await conn.query(
  `SELECT job_request_id, evaluated_by, COUNT(*) AS n
     FROM evaluations
    GROUP BY job_request_id, evaluated_by
   HAVING n > 1`
);
if (dupeEvals.length) {
  console.log('!! Duplicate evaluations already recorded (these must be resolved by hand):');
  for (const d of dupeEvals) {
    console.log(`   request ${d.job_request_id}, user ${d.evaluated_by}: ${d.n} rows`);
  }
}
try {
  await conn.query(
    `ALTER TABLE ${q('evaluations')} ADD UNIQUE KEY ${q('uq_eval_job_user')} (${q('job_request_id')}, ${q('evaluated_by')})`
  );
  console.log('ok  unique index on evaluations (job_request_id, evaluated_by)');
} catch (e) {
  if (ALREADY_PRESENT.test(e.message)) {
    console.log('ok  unique index on evaluations already present');
  } else if (/1062|Duplicate entry/i.test(e.message)) {
    console.error('ERR unique index on evaluations blocked by pre-existing duplicates (listed above)');
  } else {
    console.error('ERR unique index on evaluations:', e.message);
  }
}

// 5. Prove the repair: every value the app can write must now round-trip.
console.log('\nVerifying that every application value is now storable...');
const [sample] = await conn.query('SELECT id FROM users ORDER BY id LIMIT 1');
const probeId = sample.length ? sample[0].id : null;

if (!probeId) {
  console.log('   skipped — no user rows to probe against');
} else {
  const [before] = await conn.query('SELECT COUNT(*) AS n FROM job_requests');
  // Short, unique, and comfortably inside job_requests.ticket_no VARCHAR(30).
  // An earlier version of this probe used a long descriptive name and every
  // row silently truncated to the same 30 characters — which is the very
  // ENUM/VARCHAR truncation behaviour this whole exercise exists to detect.
  const stamp = Date.now().toString(36);
  let failures = 0;

  for (const [i, c] of CATEGORIES.entries()) {
    try {
      await conn.query(
        `INSERT INTO job_requests (ticket_no, requester_id, category, description, status)
         VALUES (?, ?, ?, 'probe', 'Pending')`,
        [`p${stamp}c${i}`, probeId, c]
      );
    } catch (e) {
      console.error(`   FAIL inserting category "${c}": ${e.message}`);
      failures += 1;
    }
  }

  for (const [i, s] of STATUSES.entries()) {
    try {
      await conn.query(
        `INSERT INTO job_requests (ticket_no, requester_id, category, description, status)
         VALUES (?, ?, 'Electrical', 'probe', ?)`,
        [`p${stamp}s${i}`, probeId, s]
      );
    } catch (e) {
      console.error(`   FAIL inserting status "${s}": ${e.message}`);
      failures += 1;
    }
  }

  const [got] = await conn.query(
    'SELECT category, status FROM job_requests WHERE ticket_no LIKE ?',
    [`p${stamp}%`]
  );
  const storedCats = new Set(got.map((r) => r.category));
  const storedStats = new Set(got.map((r) => r.status));
  for (const c of CATEGORIES) {
    if (!storedCats.has(c)) { console.error(`   FAIL category "${c}" did not round-trip`); failures += 1; }
  }
  for (const s of STATUSES) {
    if (!storedStats.has(s)) { console.error(`   FAIL status "${s}" did not round-trip`); failures += 1; }
  }
  await conn.query('DELETE FROM job_requests WHERE ticket_no LIKE ?', [`p${stamp}%`]);
  const [after] = await conn.query('SELECT COUNT(*) AS n FROM job_requests');
  if (after[0].n !== before[0].n) {
    console.error('   FAIL probe rows were not cleaned up');
    failures += 1;
  }
  if (failures === 0) {
    console.log(`   ok  all ${CATEGORIES.length} categories and ${STATUSES.length} statuses round-trip intact`);
  }
}

await conn.end();
console.log('');
process.exit(0);
