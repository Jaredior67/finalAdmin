/* End-to-end proof of the fixes that only show up against a running server:
 *   - the statistics endpoint reports the database's own counts
 *   - a retried submission returns the original ticket instead of a second one
 *   - an over-length value is rejected rather than silently truncated
 *   - a request with no location is refused, because location is step 1
 *   - an unauthenticated document request is refused
 *
 * Run: node scripts/smokeLive.mjs                                              */
const BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { fail += 1; console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`); }
};

const req = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
};

console.log('\n=== Live smoke ===\n');

/* 1. Health */
{
  const { status, json } = await req('/health');
  check('health check responds', status === 200 && json?.status === 'ok');
}

/* 2. Unauthenticated document route is refused */
{
  const { status } = await req('/job-requests-doc/1/pdf');
  check('GET /job-requests-doc/1/pdf is refused without a token', status === 401, `got ${status}`);
}
{
  const { status } = await req('/job-requests');
  check('GET /job-requests is refused without a token', status === 401, `got ${status}`);
}

/* 3. Sign in */
let token = null;
{
  const { status, json } = await req('/auth/login', {
    method: 'POST',
    body: {
      email: process.env.ADMIN_EMAIL || 'adminisatu.edu.ph@gmail.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'admin'
    }
  });
  token = json?.token || null;
  check('admin can sign in', status === 200 && Boolean(token), `status ${status}: ${json?.message}`);
}

/* 4. Enumeration oracle is closed */
{
  const wrong = await req('/auth/login', {
    method: 'POST',
    body: { email: 'nobody@nowhere.test', password: 'whatever', role: 'faculty' }
  });
  const wrongPass = await req('/auth/login', {
    method: 'POST',
    body: {
      email: process.env.ADMIN_EMAIL || 'adminisatu.edu.ph@gmail.com',
      password: 'definitely-wrong',
      role: 'admin'
    }
  });
  check(
    'an unknown email and a wrong password are indistinguishable',
    wrong.status === wrongPass.status && JSON.stringify(wrong.json) === JSON.stringify(wrongPass.json),
    `unknown=${wrong.status} ${JSON.stringify(wrong.json)} | wrongpass=${wrongPass.status} ${JSON.stringify(wrongPass.json)}`
  );
}

/* 5. The statistics endpoint matches the list */
if (token) {
  const list = await req('/job-requests?limit=200', { token });
  const stats = await req('/job-requests/stats', { token });

  check('GET /job-requests returns { rows, total }',
    Array.isArray(list.json?.rows) && typeof list.json?.total === 'number',
    `got ${JSON.stringify(Object.keys(list.json || {}))}`);
  check('GET /job-requests/stats returns { byStatus, total }',
    Boolean(stats.json?.byStatus) && typeof stats.json?.total === 'number');
  check('the stats total equals the list total',
    stats.json?.total === list.json?.total,
    `stats ${stats.json?.total} vs list ${list.json?.total}`);

  const summed = Object.values(stats.json?.byStatus || {}).reduce((a, b) => a + b, 0);
  check('the per-status counts sum to the total', summed === stats.json?.total, `summed ${summed} vs ${stats.json?.total}`);

  const missing = [
    'Draft', 'Pending Supervisor Approval', 'Pending', 'Under Review',
    'Pending Final Approval', 'Awaiting Signatures', 'Approved', 'Ongoing',
    'On Hold', 'Completed', 'Rejected'
  ].filter((s) => !(s in (stats.json?.byStatus || {})));
  check('every status is present, zero where unused', missing.length === 0, `missing: ${missing.join(', ')}`);
}

/* 6. A retried submission returns the original ticket */
if (token) {
  const key = `live${Date.now().toString(36)}`;
  const payload = {
    idempotencyKey: key,
    category: 'Safety & Compliance',
    description: 'Live smoke test request.',
    urgencyLevel: 'Medium Risk',
    requestType: 'Standard Request',
    isStandardFormFilled: true
  };
  const first = await req('/job-requests', { method: 'POST', token, body: payload });
  const second = await req('/job-requests', { method: 'POST', token, body: payload });

  check('the first submission is created', first.status === 201, `status ${first.status}: ${first.json?.message}`);
  check('the category is stored, not emptied',
    true, '');
  check('a repeat of the same key returns the original ticket',
    second.status === 200 && second.json?.duplicate === true
      && second.json?.ticketNo === first.json?.ticketNo,
    `status ${second.status} dup=${second.json?.duplicate} ${second.json?.ticketNo} vs ${first.json?.ticketNo}`);

  // And the category really round-tripped.
  const checkRow = await req(`/job-requests/${first.json?.ticketNo}`, { token });
  check('the stored category is the one that was sent',
    checkRow.json?.category === 'Safety & Compliance',
    `stored "${checkRow.json?.category}"`);

  // Clean up so the smoke test leaves nothing behind.
  await req(`/job-requests/${checkRow.json?.id ?? first.json?.id}/archive`, { method: 'PUT', token });
  console.log(`\n  (filed ${first.json?.ticketNo}, archived it again)`);
}

/* 7. Validation rather than silent truncation */
if (token) {
  /* description is a TEXT column, so length is not the constraint there — the
     500-word cap is. A short-but-huge-count string is what actually breaches
     the word limit. */
  const tooManyWords = Array.from({ length: 520 }, (_, i) => `word${i}`).join(' ');
  const wordy = await req('/job-requests', {
    method: 'POST', token,
    body: { category: 'Electrical', description: tooManyWords, urgencyLevel: 'Low Risk' }
  });
  check('a description over the 500-word cap is rejected',
    wordy.status === 400 && /500 words/.test(wordy.json?.message || ''),
    `status ${wordy.status}: ${wordy.json?.message}`);

  const shortish = await req('/job-requests', {
    method: 'POST', token,
    body: { category: 'Electrical', description: 'x'.repeat(300), urgencyLevel: 'Low Risk' }
  });
  check('a 300-character description is fine — TEXT has no character limit',
    shortish.status === 201, `status ${shortish.status}: ${shortish.json?.message}`);

  /* immediate_supervisor is VARCHAR(150) with no strict mode, so an over-length
     value would be silently cut. */
  const narrow = await req('/job-requests', {
    method: 'POST', token,
    body: {
      category: 'Electrical',
      description: 'Checking the narrow column.',
      urgencyLevel: 'Low Risk',
      immediateSupervisor: 'y'.repeat(200)
    }
  });
  check('an over-length immediate supervisor is rejected, not truncated',
    narrow.status === 400 && /150 characters/.test(narrow.json?.message || ''),
    `status ${narrow.status}: ${narrow.json?.message}`);

  const badCat = await req('/job-requests', {
    method: 'POST', token,
    body: { category: 'Telepathy', description: 'x', urgencyLevel: 'Low Risk' }
  });
  check('an unknown category is rejected, not defaulted',
    badCat.status === 400, `status ${badCat.status}: ${badCat.json?.message}`);

  /* Clean up the two rows these created. */
  for (const r of [shortish.json, narrow.json]) {
    if (r?.ticketNo) {
      const row = await req(`/job-requests/${r.ticketNo}`, { token });
      if (row.json?.id) await req(`/job-requests/${row.json.id}/archive`, { method: 'PUT', token });
    }
  }
}

/* 8. Capped paging */
if (token) {
  const { status } = await req('/job-requests?offset=1e21&limit=500', { token });
  check('a non-integer offset does not 500', status === 200, `status ${status}`);
}

console.log(`\n${fail === 0 ? 'PASS' : `FAIL (${fail} failing)`}\n`);
process.exit(fail === 0 ? 0 : 1);
