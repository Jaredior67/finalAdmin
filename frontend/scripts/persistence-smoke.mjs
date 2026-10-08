/* Guards the class of bug where a UI action looks like it saved and no API call
 * is ever made.
 *
 * Four DataContext actions — status change, archive, evaluation submission and
 * replacement flag — mutated local React state and fired a success toast without
 * ever calling the server. A technician completing a work order, an admin
 * archiving a ticket, a requester submitting a service evaluation and a
 * technician flagging an irreparable item all reported success while writing
 * nothing to MySQL. The next refreshRequisitions() discarded the change, and the
 * server's status history, audit log and notifications never happened.
 *
 * These checks fail if any of them stops calling its endpoint again.
 *
 * Run: node scripts/persistence-smoke.mjs                                      */
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..', 'src');
const read = (...p) => fs.readFileSync(path.join(src, ...p), 'utf8');

const dataContext = read('context', 'DataContext.jsx');
const api = read('backend', 'api.js');

let failures = 0;
const check = async (label, fn) => {
  try {
    await fn();
    console.log(`  ok   ${label}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL ${label}\n       ${err.message}`);
  }
};

/** The body of `const <name> = (args) => { ... }` up to the next top-level `const`. */
function functionBody(source, name) {
  const start = source.indexOf(`const ${name} = `);
  if (start === -1) return null;
  const next = source.indexOf('\n  const ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

console.log('\nevery state-changing action reaches the server');

const REQUIRED = [
  ['updateRequisitionStatus', 'apiUpdateJobRequestStatus', 'PUT /job-requests/:id/status'],
  ['archiveRequisition', 'apiArchiveJobRequest', 'PUT /job-requests/:id/archive'],
  ['unarchiveRequisition', 'apiUnarchiveJobRequest', 'PUT /job-requests/:id/unarchive'],
  ['submitEvaluation', 'apiSubmitEvaluation', 'POST /evaluations'],
  ['raiseReplacementFlag', 'apiFlagReplacement', 'POST /job-requests/:id/replacement-flag'],
  ['confirmSignatures', 'apiUpdateJobRequestStatus', 'PUT /job-requests/:id/status']
];

for (const [fn, endpoint, route] of REQUIRED) {
  await check(`${fn} calls ${endpoint} (${route})`, async () => {
    const body = functionBody(dataContext, fn);
    if (!body) throw new Error(`${fn} is not defined in DataContext`);
    if (!body.includes(endpoint)) {
      throw new Error(`${fn} never calls ${endpoint} — the write is local only`);
    }
    if (!/\bawait\b/.test(body)) {
      throw new Error(`${fn} is not async; it cannot await the endpoint`);
    }
  });
}

await check('the endpoint each action relies on actually exists in the api client', async () => {
  for (const [, endpoint] of REQUIRED) {
    if (!new RegExp(`export const ${endpoint}\\b`).test(api)) {
      throw new Error(`${endpoint} is not exported from backend/api.js`);
    }
  }
});

console.log('\na failed write is never reported as success');
await check('updateRequisitionStatus reports failure instead of toasting success', async () => {
  const body = functionBody(dataContext, 'updateRequisitionStatus');
  if (!/catch[\s\S]*toast\([^)]*'error'/.test(body)) {
    throw new Error('the catch block does not surface an error toast');
  }
  // The old version returned true unconditionally and fired a success toast.
  if (!/return false/.test(body)) {
    throw new Error('updateRequisitionStatus must return false on failure');
  }
});
await check('addRequisition does not swallow a rejected create', async () => {
  const body = functionBody(dataContext, 'addRequisition');
  if (/console\.warn\([^)]*fallback/.test(body)) {
    throw new Error('addRequisition still swallows the API error and carries on');
  }
  if (!/return null/.test(body)) {
    throw new Error('addRequisition must abort when the server rejects the request');
  }
});

console.log('\nthe category is sent verbatim');
await check('the create payload does not lowercase the category', async () => {
  if (/\(newReq\.category\s*\|\|\s*'other'\)\.toLowerCase\(\)/.test(dataContext)) {
    throw new Error("the category is still lowercased, so 'Drawing/Design' never matches the enum");
  }
  if (!/category:\s*newReq\.category/.test(dataContext)) {
    throw new Error('the create payload should send the category verbatim');
  }
});
await check('the slug fallback vocabulary is gone', async () => {
  if (/category \|\| 'other'/.test(dataContext)) {
    throw new Error("'other' is not a member of the category enum any more");
  }
});

console.log('\nlocation is actually recorded');
await check('the create payload includes locationId', async () => {
  if (!/locationId:\s*newReq\.locationId/.test(dataContext)) {
    throw new Error('locationId is never sent, so every ticket stores location_id = NULL');
  }
});

console.log('\ncache reads cannot brick the app');
await check('localStorage reads go through a guarded helper', async () => {
  // Comments describe the pattern they replaced, so strip them first.
  const code = dataContext
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const bare = code.match(/JSON\.parse\(localStorage\.getItem\(/g) || [];
  if (bare.length > 0) {
    throw new Error(
      `${bare.length} unguarded JSON.parse(localStorage.getItem(...)) in a useState initialiser — ` +
      'a corrupt cache value would throw during render and blank every screen'
    );
  }
  if (!/const readJson = \(/.test(code)) throw new Error('the readJson helper is missing');
});
await check('no fabricated data is presented as real', async () => {
  // An empty cache used to fall back to sample approvals and sample calendar
  // events, which rendered invented records on a live system. A cache that is
  // no longer read at all is a stronger guarantee than a guarded read, so a
  // removed key passes — but one that is still read must go through readJson
  // and must not name the old sample table. Comments are stripped first
  // because they describe the pattern they replaced.
  const code = dataContext
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const [key, sample] of [
    ['fixit_pdas_approvals_v3', 'INITIAL_APPROVAL_HISTORY'],
    ['fixit_pdas_calendar_v3', 'INITIAL_CALENDAR_EVENTS']
  ]) {
    if (!code.includes(key)) continue; // the cache is gone — nothing can be faked
    const line = code.split('\n').find((l) => l.includes(key));
    if (!line.includes('readJson')) {
      throw new Error(`${key} is read without the guarded readJson helper`);
    }
    if (line.includes(sample)) {
      throw new Error(`${key} still falls back to ${sample} — invented records on a live system`);
    }
  }
});

console.log('\n"today" is a local calendar day');
await check('no UTC date is compared against a local calendar date', async () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(jsx?|js)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      // toISOString() is UTC. Against a locally-produced YYYY-MM-DD it is the
      // wrong day for the eight hours after midnight at UTC+8.
      if (/toISOString\(\)\.(slice|split)\('T'\)\[0\]|toISOString\(\)\.slice\(0,\s*10\)/.test(text)) {
        offenders.push(path.relative(src, full));
      }
    }
  };
  walk(src);
  if (offenders.length) {
    throw new Error(
      `UTC "today" in: ${offenders.join(', ')} — use toLocalISODate(new Date())`
    );
  }
});

console.log('\nthe offline banner tells the truth');
await check('no promise of background synchronisation', async () => {
  const banner = read('components', 'common', 'OfflineBanner.jsx');
  if (/will sync once connectivity returns/i.test(banner)) {
    throw new Error('the banner still promises submissions sync on reconnect — nothing does that');
  }
  if (!/sent when the connection is back/i.test(banner)) {
    throw new Error('the banner should say what actually happens to a queued request');
  }
  if (!/flushOutbox/.test(banner)) {
    throw new Error('the banner does not drain the outbox, so nothing is ever sent');
  }
});

console.log('\nthere is a real outbox behind that promise');
const backendRoutes = fs.readFileSync(
  path.resolve(here, '..', '..', 'backend', 'src', 'routes', 'requisitionRoutes.js'),
  'utf8'
);
const autoSetupSrc = fs.readFileSync(
  path.resolve(here, '..', '..', 'backend', 'src', 'scripts', 'autoSetup.js'),
  'utf8'
);

await check('utils/outbox.js exists and queues rather than drops', async () => {
  const outbox = read('utils', 'outbox.js');
  for (const fn of ['submitOrQueue', 'enqueue', 'flushOutbox', 'outboxSize', 'newIdempotencyKey']) {
    if (!new RegExp(`export (const|function|async function) ${fn}\\b`).test(outbox)) {
      throw new Error(`${fn} is missing from the outbox`);
    }
  }
});

await check('addRequisition goes through the outbox', async () => {
  const body = functionBody(dataContext, 'addRequisition');
  if (!/submitOrQueue\(/.test(body)) {
    throw new Error('addRequisition bypasses the outbox');
  }
  if (!/outcome\.queued/.test(body)) {
    throw new Error('addRequisition does not handle the queued case');
  }
});

await check('a retry carries a key the server can deduplicate on', async () => {
  const outbox = read('utils', 'outbox.js');
  if (!/idempotencyKey/.test(outbox)) {
    throw new Error('the outbox does not send an idempotency key');
  }
  if (!/idempotencyKey/.test(backendRoutes)) {
    throw new Error('the API does not read idempotencyKey');
  }
  if (!/WHERE idempotency_key = \?/.test(backendRoutes)) {
    throw new Error('the API does not look for an existing request with the same key');
  }
  if (!/ER_DUP_ENTRY/.test(backendRoutes)) {
    throw new Error('a concurrent duplicate is unhandled — the unique-index race returns 500');
  }
});

await check('the server stores and constrains the key', async () => {
  if (!/'idempotency_key'/.test(autoSetupSrc)) {
    throw new Error('the boot migration never adds the idempotency_key column');
  }
  if (!/uq_jr_idempotency_key/.test(autoSetupSrc)) {
    throw new Error('the boot migration never adds the unique index');
  }
});

await check('the list endpoint reports a total, not just a page', async () => {
  if (!/res\.json\(\{\s*rows,\s*total/.test(backendRoutes)) {
    throw new Error('GET /job-requests does not return { rows, total }');
  }
  if (!/COUNT\(\*\) AS total/.test(backendRoutes)) {
    throw new Error('there is no COUNT for the scoped set');
  }
  const api = read('backend', 'api.js');
  if (!/Array\.isArray\(data\)/.test(api)) {
    throw new Error('the api client does not normalise the new response shape');
  }
});

console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures} failing check${failures === 1 ? '' : 's'})`}\n`);
process.exit(failures === 0 ? 0 : 1);
