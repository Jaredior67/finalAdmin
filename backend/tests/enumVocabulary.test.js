/* Controlled-vocabulary regression tests.
 *
 * This MariaDB runs WITHOUT STRICT_TRANS_TABLES. An ENUM value that does not
 * match a member is not rejected: it is silently stored as '' with no error, no
 * warning, and the API still reports success. That is not hypothetical — it is
 * how job_requests.category lost every value except "Electrical", and how
 * users.role once locked a supervisor out of login entirely.
 *
 * Nothing about that failure is visible from application code, so it is guarded
 * here instead: every value the app can produce must be a value the database
 * definition accepts, in schema.sql AND in the boot migration.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REQUEST_CATEGORIES, REQUEST_STATUSES } from '../src/scripts/autoSetup.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const read = (...p) => fs.readFileSync(path.join(repo, ...p), 'utf8');

const schema = read('backend', 'database', 'schema.sql');
const autoSetup = read('backend', 'src', 'scripts', 'autoSetup.js');
const requisitionRoutes = read('backend', 'src', 'routes', 'requisitionRoutes.js');
const ticketPolicy = read('backend', 'src', 'utils', 'ticketPolicy.js');
const intakeUtil = read('frontend', 'src', 'utils', 'jobRequestIntake.js');

/** Pull the member list out of `ENUM(...)` for one column in schema.sql. */
function schemaEnum(table, column) {
  const re = new RegExp(
    '`' + table + '`[\\s\\S]*?`' + column + '`\\s+ENUM\\(([^)]*)\\)'
  );
  const m = schema.match(re);
  if (!m) return null;
  return m[1].split(',').map((v) => v.trim().replace(/^'/, '').replace(/'$/, ''));
}

/* The literal list the frontend offers, parsed out of the shared util, so the
   two can never drift. Read the CATEGORY_OPTIONS array block specifically —
   scraping every quoted string in the file would also pick up comments. */
const frontendCategories = (() => {
  const block = intakeUtil.slice(
    intakeUtil.indexOf('export const CATEGORY_OPTIONS'),
    intakeUtil.indexOf('];', intakeUtil.indexOf('export const CATEGORY_OPTIONS'))
  );
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
})();

test('the frontend and backend agree on the category list', () => {
  const missing = REQUEST_CATEGORIES.filter(
    (c) => c !== 'Urgent Hazard' && !frontendCategories.includes(c)
  );
  assert.deepEqual(missing, [], `not offered anywhere in the UI: ${missing.join(', ')}`);
});

test('schema.sql category enum accepts every category the app can write', () => {
  const members = schemaEnum('job_requests', 'category');
  assert.ok(members, 'could not find the job_requests.category ENUM in schema.sql');
  const missing = REQUEST_CATEGORIES.filter((c) => !members.includes(c));
  assert.deepEqual(
    missing, [],
    `schema.sql would silently store '' for: ${missing.join(', ')}`
  );
});

test('schema.sql status enum accepts every status the app can write', () => {
  const members = schemaEnum('job_requests', 'status');
  assert.ok(members, 'could not find the job_requests.status ENUM in schema.sql');
  const missing = REQUEST_STATUSES.filter((s) => !members.includes(s));
  assert.deepEqual(
    missing, [],
    `schema.sql would silently store '' for: ${missing.join(', ')}`
  );
});

test('the boot migration installs the same vocabularies', () => {
  // The migration must derive its enums from the exported lists rather than
  // repeating them, or the two can drift again.
  assert.ok(
    /LIFECYCLE_STATUS_ENUM\s*=\s*`ENUM\(\$\{enumMembers\(REQUEST_STATUSES\)\}\)`/.test(autoSetup),
    'the status ALTER should be built from REQUEST_STATUSES'
  );
  assert.ok(
    /ENUM\(\$\{CATEGORY_ENUM_MEMBERS\}\)/.test(autoSetup),
    'the category ALTER should be built from REQUEST_CATEGORIES'
  );
  // A hard-coded copy is exactly the failure mode being guarded.
  const hardCoded = autoSetup.match(/ENUM\('Electrical'/g);
  assert.equal(
    hardCoded, null,
    'a hard-coded category enum reappeared in autoSetup.js; use REQUEST_CATEGORIES'
  );
});

test('the API validates against the shared list, not a private one', () => {
  assert.ok(
    /REQUEST_CATEGORIES/.test(requisitionRoutes),
    'requisitionRoutes should import REQUEST_CATEGORIES'
  );
  assert.ok(
    /matchCategory/.test(requisitionRoutes),
    'requisitionRoutes should resolve categories through matchCategory()'
  );
  // The old slug list silently rewrote every real category to 'other'.
  assert.ok(
    !/allowedCategories\s*=\s*\['electrical'/.test(requisitionRoutes),
    "the old trade-slug allow-list is back; it collapses every category to 'other'"
  );
  assert.ok(
    /import\s*\{[^}]*REQUEST_CATEGORIES[^}]*\}\s*from\s*'\.\.\/scripts\/autoSetup\.js'/.test(requisitionRoutes),
    'REQUEST_CATEGORIES must be imported from scripts/autoSetup.js'
  );
});

test('normalizeStatus can reach every status the enum allows', () => {
  // A status the normaliser can never return is a status the UI can never set.
  // 'On Hold' had no branch and 'Awaiting Signatures' was folded into another
  // value, which made the signature-confirmation step permanently unreachable.
  for (const status of ['On Hold', 'Awaiting Signatures', 'Pending Supervisor Approval', 'Ongoing', 'Completed']) {
    const slug = status.toLowerCase().replace(/[\s_-]+/g, '');
    const body = requisitionRoutes.slice(
      requisitionRoutes.indexOf('function normalizeStatus'),
      requisitionRoutes.indexOf('function matchCategory')
    );
    assert.ok(
      body.includes(`'${slug}'`),
      `normalizeStatus has no branch for "${status}" — the UI can offer it but the API rejects it`
    );
  }
});

test('the ticket policy defines a transition for every non-terminal status', () => {
  // A status with no TRANSITIONS entry and a non-empty successor list is
  // unreachable; a status with neither key at all cannot be left.
  const block = ticketPolicy.slice(ticketPolicy.indexOf('export const TRANSITIONS'));
  const keys = [...block.matchAll(/^\s{2}'([^']+)':\s*\[/gm)].map((m) => m[1]);
  assert.ok(keys.length >= 10, `only found ${keys.length} statuses in TRANSITIONS`);
  for (const status of REQUEST_STATUSES) {
    if (['Completed', 'Rejected'].includes(status)) continue;
    assert.ok(
      keys.includes(status),
      `TRANSITIONS has no entry for "${status}" — a ticket in that state can never move`
    );
  }
});

test('every status write is guarded by the shared policy', () => {
  // The four dedicated action endpoints used to hardcode their target status
  // and skip the policy, so any supervisor could act on any ticket and closed
  // tickets could be re-opened.
  for (const route of [
    '/:id/supervisor-action',
    '/:id/admin-action',
    '/:id/approver-action',
    '/:id/assign-technician'
  ]) {
    const start = requisitionRoutes.indexOf(`router.post('${route}'`);
    assert.ok(start > -1, `${route} not found`);
    const end = requisitionRoutes.indexOf('\n});', start);
    const body = requisitionRoutes.slice(start, end);
    assert.ok(
      /assertAgainstPolicy\(/.test(body),
      `${route} does not call assertAgainstPolicy — it can bypass the lifecycle`
    );
  }
});

test('the official control number is unique at the database level', () => {
  // Two tickets must never carry the same control number on a signed form.
  assert.ok(
    /uq_jr_official_tracking_no/.test(schema),
    'schema.sql is missing the unique index on official_tracking_no'
  );
  assert.ok(
    /uq_jr_official_tracking_no/.test(autoSetup),
    'the boot migration never adds the unique index to an existing database'
  );
});

test('free-text columns that hold user prose are TEXT, not VARCHAR', () => {
  // Without STRICT_TRANS_TABLES an over-length VARCHAR silently truncates.
  for (const [table, column] of [
    ['job_requests', 'description'],
    ['job_requests', 'replacement_reason'],
    ['job_requests', 'rejection_remarks'],
    ['job_request_status_history', 'remarks']
  ]) {
    const re = new RegExp('`' + table + '`[\\s\\S]*?`' + column + '`\\s+(\\w+)');
    const m = schema.match(re);
    assert.ok(m, `could not find ${table}.${column} in schema.sql`);
    assert.notEqual(
      m[1].toUpperCase(), 'VARCHAR',
      `${table}.${column} is ${m[1]} — long entries are silently truncated`
    );
  }
});

/* ---------------------------------------------------------------------------
   Things that need a constraint rather than a read-then-write check. A SELECT
   followed by an INSERT cannot see another transaction's uncommitted row, so
   only a unique index actually stops the duplicate.
   --------------------------------------------------------------------------- */

const wordLimitSrc = read('backend', 'src', 'utils', 'wordLimit.js');
const evaluationRoutes = read('backend', 'src', 'routes', 'evaluationRoutes.js');
const preventiveRoutes = read('backend', 'src', 'routes', 'preventiveRoutes.js');
const userRoutes = read('backend', 'src', 'routes', 'userRoutes.js');

test('a retried submission cannot file the same request twice', () => {
  assert.ok(/idempotencyKey/.test(requisitionRoutes), 'the create endpoint does not read a key');
  assert.ok(
    /WHERE idempotency_key = \?/.test(requisitionRoutes),
    'the create endpoint does not look for an existing request with the same key'
  );
  assert.ok(
    /ER_DUP_ENTRY/.test(requisitionRoutes),
    'a concurrent duplicate is unhandled — the unique-index race returns 500'
  );
  assert.ok(
    /uq_jr_idempotency_key/.test(autoSetup),
    'the boot migration never adds the unique index that makes the key work'
  );
  assert.ok(
    /'idempotency_key'/.test(autoSetup),
    'the boot migration never adds the idempotency_key column'
  );
});

test('one evaluation per person per request is enforced by a constraint', () => {
  assert.ok(
    /uq_eval_job_user/.test(autoSetup),
    'the boot migration never adds the unique index on (job_request_id, evaluated_by)'
  );
  assert.ok(
    /ER_DUP_ENTRY/.test(evaluationRoutes),
    'evaluationRoutes does not handle a duplicate submission'
  );
});

test('narrow VARCHAR columns reject over-length input instead of truncating', () => {
  assert.ok(/export const lengthError/.test(wordLimitSrc), 'lengthError is missing');
  assert.ok(/export const VARCHAR_LIMITS/.test(wordLimitSrc), 'VARCHAR_LIMITS is missing');

  // Every narrow column a person can type into must be checked somewhere.
  assert.ok(
    /lengthErrors\(|lengthError\(/.test(preventiveRoutes),
    'preventiveRoutes does not validate its VARCHAR columns'
  );
  assert.ok(
    /VARCHAR_LIMITS\.immediateSupervisor/.test(requisitionRoutes),
    'immediate_supervisor (VARCHAR 150) is written without a length check'
  );
  assert.ok(
    /VARCHAR_LIMITS\.procurementStatus/.test(requisitionRoutes),
    'replacement_procurement_status (VARCHAR 100) is written without a length check'
  );
});

test('writes that notify and audit do so inside the transaction', () => {
  // A notification or audit row written after the commit can be lost, and the
  // caller has already been told the write succeeded.
  const notifyBlocks = [...requisitionRoutes.matchAll(/await notify\w*\(\s*pool/g)];
  assert.equal(
    notifyBlocks.length, 0,
    'a notification is written through the pool instead of the transaction connection'
  );
  assert.ok(
    /await auditLog\(conn,/.test(preventiveRoutes),
    'the preventive schedule audit row is not inside its transaction'
  );
  assert.ok(
    /await auditLog\(conn,/.test(userRoutes),
    'the deactivation audit row is not inside its transaction'
  );
});

test('the notification fan-out is one statement, not one per recipient', () => {
  // Previously 1 + N round trips, run while the caller held a FOR UPDATE lock.
  assert.ok(
    /INSERT INTO notifications \(user_id, title, message, link\) VALUES \$\{placeholders\}/.test(requisitionRoutes),
    'the multi-recipient insert is missing'
  );
  const loops = [...requisitionRoutes.matchAll(/for \(const \w+ of (admins|supervisors|approvers)\)/g)];
  assert.equal(loops.length, 0, 'a per-recipient notification loop is still present');
});

test('the statistics endpoint is declared before the :id route', () => {
  // Otherwise "stats" is read as an id and the request 404s. Comments are
  // stripped first: the note above the stats route quotes both paths verbatim,
  // and a naive indexOf would match the prose rather than the declaration.
  const code = requisitionRoutes
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const statsAt = code.indexOf("router.get('/stats'");
  const idAt = code.indexOf("router.get('/:id'");
  assert.ok(statsAt > -1, 'GET /stats is missing');
  assert.ok(idAt > -1, 'GET /:id is missing');
  assert.ok(statsAt < idAt, '/stats must be declared before /:id');
  assert.ok(
    /COUNT\(\*\) AS n/.test(code),
    'the statistics endpoint does not count in the database'
  );
  assert.ok(
    /res\.json\(\{\s*byStatus,\s*total/.test(code),
    'the statistics endpoint does not return { byStatus, total }'
  );
});

test('role scoping is written down once and shared by the list and the counts', () => {
  const code = requisitionRoutes
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    /function applyVisibilityScope/.test(code),
    'the visibility scope is not extracted into a function'
  );
  const uses = [...code.matchAll(/applyVisibilityScope\(/g)];
  // definition + list + stats
  assert.ok(uses.length >= 3, `applyVisibilityScope is called ${uses.length} times`);
  // Default deny: a role the chain does not name must get nothing, not everything.
  assert.ok(
    /return null; \/\/ caller answers 403/.test(code),
    'an unrecognised role does not fall through to deny'
  );
});
