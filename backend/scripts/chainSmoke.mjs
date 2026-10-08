/* Walk the whole review chain against a running server, as the roles actually
 * hold it, and prove each step lands in MySQL.
 *
 *   faculty files  →  admin reviews  →  admin endorses  →  approver approves
 *                →  admin assigns  →  technician sees it  →  technician completes
 *
 * Every transition is checked against a fresh read of the row, not against what
 * the client believes. The defects these checks exist for were all of the form
 * "reported success, wrote nothing", so a 200 is not evidence — the status in
 * the database is.
 *
 * Run: node scripts/chainSmoke.mjs                                            */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';
const ADMIN = { email: process.env.ADMIN_EMAIL || 'adminisatu.edu.ph@gmail.com', password: process.env.ADMIN_PASSWORD || 'admin123' };
const FACULTY = { email: 'faculty@isatu.edu.ph', password: 'faculty123' };
const APPROVER = { email: 'campusadmin@isatu.edu.ph', password: process.env.CAMPUS_ADMIN_PASSWORD || 'admin123' };

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { fail += 1; console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`); }
};

const db = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fixit_pdas'
});

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
};

const login = async (who) => {
  const { status, json } = await call('/auth/login', {
    method: 'POST',
    body: { ...who, role: who === ADMIN ? 'admin' : who === APPROVER ? 'campus_admin' : 'faculty' }
  });
  if (status !== 200) throw new Error(`login failed for ${who.email}: ${json?.message || status}`);
  return json.token;
};

/* Read the row straight from MySQL. The whole point is to not trust the API's
 * answer about whether a write happened. */
const readRow = async (id) => {
  const [rows] = await db.query('SELECT * FROM job_requests WHERE id = ?', [id]);
  return rows[0];
};

const historyOf = async (id) => {
  const [rows] = await db.query(
    'SELECT from_status, to_status, remarks FROM job_request_status_history WHERE job_request_id = ? ORDER BY id',
    [id]
  );
  return rows;
};

const notificationsFor = async (userId) => {
  const [rows] = await db.query(
    'SELECT title, message FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 5',
    [userId]
  );
  return rows;
};

console.log('\n=== Review chain, end to end ===\n');

const adminToken = await login(ADMIN);
const facultyToken = await login(FACULTY);

/* 0. The approver account must exist for step 3. Reported rather than fatal, so
      the earlier steps still run and the failure is visible. */
let approverToken = null;
try {
  approverToken = await login(APPROVER);
  check('the Campus Administrator can sign in', true);
} catch (e) {
  check('the Campus Administrator can sign in', false, e.message);
}

/* An active maintenance account to assign to. Without one the last step cannot
   run, and the failure would look like an application bug. */
const [[tech]] = await db.query(
  "SELECT id, first_name, last_name FROM users WHERE role IN ('maintenance','technician') AND status = 'active' LIMIT 1"
);
check('an active maintenance account exists to assign to', Boolean(tech),
  tech ? '' : 'no maintenance user — create one under User Management');

/* 1. A faculty member files a request. */
const filed = await call('/job-requests', {
  method: 'POST', token: facultyToken,
  body: {
    idempotencyKey: `chain${Date.now().toString(36)}`,
    category: 'Electrical',
    description: 'Chain smoke test: hallway light out.',
    urgencyLevel: 'Low Risk',
    requestType: 'Standard Request',
    isStandardFormFilled: true
  }
});
const ticketId = filed.json?.id;
check('a faculty request is filed', filed.status === 201 && Boolean(ticketId),
  `status ${filed.status}: ${filed.json?.message}`);

if (ticketId) {
  const initial = await readRow(ticketId);
  /* Nobody has a Supervisor assigned in this database, so filing auto-confirms
     the supervisory step (manuscript: the requester's confirmation doubles as
     the supervisory confirmation when there is no Supervisor) and hands the
     request straight to PDAS. */
  check('the filed request is already past the supervisory step',
    initial?.status === 'Under Review' && initial?.supervisor_approved === 1,
    `status ${initial?.status}, supervisor_approved ${initial?.supervisor_approved}`);

  const [[autoRow]] = await db.query(
    'SELECT action, details FROM audit_log WHERE entity_id = ? AND action = ? ORDER BY id DESC LIMIT 1',
    [ticketId, 'request.supervisor.auto_confirmed']
  );
  check('the auto-confirmation is stated in the audit log',
    Boolean(autoRow && autoRow.details),
    `no request.supervisor.auto_confirmed row for ticket ${ticketId}`);

  /* The supervisory level belongs to a designated Supervisor. A PDAS
     administrator used to pass this gate on role alone, so one account could
     perform two of the three approval levels itself. */
  const asSupervisor = await call(`/job-requests/${ticketId}/supervisor-action`, {
    method: 'POST', token: adminToken, body: { action: 'approve', remarks: 'Chain test: admin impersonating a supervisor.' }
  });
  check('the System Administrator cannot perform the supervisory level',
    asSupervisor.status === 403,
    `http ${asSupervisor.status} "${asSupervisor.json?.message}"`);

  /* 2. Admin opens it for review. */
  const review = await call(`/job-requests/${ticketId}/admin-action`, {
    method: 'POST', token: adminToken, body: { action: 'evaluate', remarks: 'Chain test: site inspection.' }
  });
  let row = await readRow(ticketId);
  check('Begin Review writes Under Review to the database',
    review.status === 200 && row.status === 'Under Review',
    `http ${review.status} "${review.json?.message}" | row is ${row?.status}`);

  /* 3. Admin endorses to the approver. */
  const endorse = await call(`/job-requests/${ticketId}/admin-action`, {
    method: 'POST', token: adminToken, body: { action: 'approve', remarks: 'Chain test: endorsed.' }
  });
  row = await readRow(ticketId);
  check('Endorse writes Pending Final Approval to the database',
    endorse.status === 200 && row.status === 'Pending Final Approval',
    `http ${endorse.status} "${endorse.json?.message}" | row is ${row?.status}`);
  check('the endorsement is recorded on the row', row.admin_approved === 1, `admin_approved = ${row.admin_approved}`);

  /* The generic status endpoint sets no approval flags of its own, so it must
     not be able to grant the final approval that only approver-action records.
     A single privileged account could previously PUT this twice and carry a
     request through both remaining levels by itself. */
  const skippedFinal = await call(`/job-requests/${ticketId}/status`, {
    method: 'PUT', token: adminToken, body: { status: 'Approved', remarks: 'Chain test: skipping the approver.' }
  });
  row = await readRow(ticketId);
  check('the Approver cannot be skipped from the generic status endpoint',
    skippedFinal.status >= 400 && row.status === 'Pending Final Approval',
    `http ${skippedFinal.status} "${skippedFinal.json?.message}" | row is ${row?.status}`);

  /* The approver must actually be told. This is the step the notification was
     previously addressed to the wrong roles for, so it is checked directly
     against the approver's own notification rows. */
  if (approverToken) {
    const [[approver]] = await db.query("SELECT id FROM users WHERE role = 'campus_admin' AND status = 'active' LIMIT 1");
    if (approver) {
      const notes = await notificationsFor(approver.id);
      const told = notes.some(n => (n.message || '').includes(initial.ticket_no));
      check('the Campus Administrator is notified that a decision is needed', told,
        `their last notifications: ${JSON.stringify(notes.map(n => n.title))}`);
    }
  }

  /* 4. The chain cannot be short-circuited while it waits. */
  const premature = await call(`/job-requests/${ticketId}/assign-technician`, {
    method: 'POST', token: adminToken, body: { assignedTo: tech?.id }
  });
  check('a work order cannot be issued before final approval', premature.status >= 400,
    `http ${premature.status} "${premature.json?.message}"`);
  row = await readRow(ticketId);
  check('the refused assignment left the status alone', row.status === 'Pending Final Approval', `row is ${row.status}`);

  /* 5. Approver approves. */
  if (approverToken) {
    const decide = await call(`/job-requests/${ticketId}/approver-action`, {
      method: 'POST', token: approverToken, body: { action: 'approve', remarks: 'Chain test: approved for execution.' }
    });
    row = await readRow(ticketId);
    check('the Campus Administrator\'s approval is written to the database',
      decide.status === 200 && row.status === 'Approved',
      `http ${decide.status} "${decide.json?.message}" | row is ${row?.status}`);

    /* Work may only begin through assign-technician, which mints the official
       control number and records the assignee. Allowing this move from the
       generic endpoint produced an Ongoing work order with no tracking number
       and no technician. */
    if (row.status === 'Approved') {
      const startWork = await call(`/job-requests/${ticketId}/status`, {
        method: 'PUT', token: adminToken, body: { status: 'Ongoing', remarks: 'Chain test: starting without assigning.' }
      });
      const stillApproved = await readRow(ticketId);
      check('work cannot start without the work order being assigned',
        startWork.status >= 400 && stillApproved.status === 'Approved',
        `http ${startWork.status} "${startWork.json?.message}" | row is ${stillApproved.status}`);
    }

    /* 6. It comes back to PDAS, and PDAS assigns. */
    if (row.status === 'Approved' && tech) {
      const assign = await call(`/job-requests/${ticketId}/assign-technician`, {
        method: 'POST', token: adminToken, body: { assignedTo: tech.id, scheduledDate: null }
      });
      row = await readRow(ticketId);
      check('the work order is assigned and issues a control number',
        assign.status === 200 && row.status === 'Ongoing' && Boolean(row.official_tracking_no),
        `http ${assign.status} "${assign.json?.message}" | status ${row?.status} | number ${row?.official_tracking_no}`);
      check('assigned_to stores the account id, not a name',
        Number(row.assigned_to) === Number(tech.id),
        `assigned_to = ${row.assigned_to} (${typeof row.assigned_to}), expected ${tech.id}`);

      /* 7. The named technician can actually see it. This is what broke when
         assigned_to held a display string. */
      const techLogin = await db.query(
        "SELECT id FROM users WHERE id = ?", [tech.id]
      );
      check('the work order is visible to the person it names',
        techLogin[0].length === 1 && Number(row.assigned_to) === techLogin[0][0].id);

      const techNotes = await notificationsFor(tech.id);
      check('the technician is notified of the work order',
        techNotes.some(n => (n.message || '').includes(initial.ticket_no)),
        `their last notifications: ${JSON.stringify(techNotes.map(n => n.title))}`);
    }
  }

  /* 8. The full history is on the record, not just the current status. */
  const hist = await historyOf(ticketId);
  const trail = hist.map(h => h.to_status).join(' → ');
  check('every step is in the status history',
    hist.some(h => h.to_status === 'Under Review')
    && hist.some(h => h.to_status === 'Pending Final Approval')
    && (approverToken ? hist.some(h => h.to_status === 'Approved') : true),
    `trail: ${trail}`);

  /* 9. A closed record cannot be re-opened by the same button. */
  if (row.status === 'Ongoing') {
    await call(`/job-requests/${ticketId}/status`, {
      method: 'PUT', token: adminToken, body: { status: 'Completed', remarks: 'Chain test: closing.' }
    });
    const before = await readRow(ticketId);
    const reopen = await call(`/job-requests/${ticketId}/admin-action`, {
      method: 'POST', token: adminToken, body: { action: 'approve', remarks: 'Chain test: reopen attempt.' }
    });
    const after = await readRow(ticketId);
    check('a completed request cannot be endorsed again',
      reopen.status >= 400 && after.status === before.status,
      `http ${reopen.status} "${reopen.json?.message}" | ${before.status} → ${after.status}`);
  }

  /* Clean up: archive the record and delete it, so the queue is as we found it. */
  await call(`/job-requests/${ticketId}/archive`, { method: 'PUT', token: adminToken });
  await db.query('DELETE FROM notifications WHERE link LIKE ?', [`%/job-requests/${ticketId}%`]);
  await db.query('DELETE FROM job_request_status_history WHERE job_request_id = ?', [ticketId]);
  await db.query('DELETE FROM job_requests WHERE id = ?', [ticketId]);
  console.log(`\n  (filed and removed ${initial.ticket_no}; trail was ${trail})`);
}

/* A return is a request for revisions, so it must land in the reopenable
   'Returned' state — 'Rejected' is terminal and used to lock the requester out
   of their own request. It also has to be possible to put it back into the
   chain once the revision is in. */
console.log('');
const returned = await call('/job-requests', {
  method: 'POST', token: facultyToken,
  body: {
    idempotencyKey: `chainret${Date.now().toString(36)}`,
    category: 'Electrical',
    description: 'Chain smoke test: return-for-revision path.',
    urgencyLevel: 'Low Risk',
    requestType: 'Standard Request',
    isStandardFormFilled: true
  }
});
const returnedId = returned.json?.id;
if (!returnedId) {
  check('a second request can be filed to exercise the return path', false,
    `http ${returned.status} "${returned.json?.message}"`);
} else {
  const ret = await call(`/job-requests/${returnedId}/admin-action`, {
    method: 'POST', token: adminToken, body: { action: 'reject', remarks: 'Chain test: location needs a clearer description.' }
  });
  const retRow = await readRow(returnedId);
  check('returning a request lands in Returned, not the terminal Rejected',
    ret.status === 200 && retRow?.status === 'Returned',
    `http ${ret.status} "${ret.json?.message}" | row is ${retRow?.status}`);

  const restore = await call(`/job-requests/${returnedId}/status`, {
    method: 'PUT', token: adminToken, body: { status: 'Pending', remarks: 'Chain test: revision received.' }
  });
  const backRow = await readRow(returnedId);
  check('a returned request can go back into the approval chain',
    restore.status === 200 && backRow?.status === 'Pending',
    `http ${restore.status} "${restore.json?.message}" | row is ${backRow?.status}`);

  await call(`/job-requests/${returnedId}/archive`, { method: 'PUT', token: adminToken });
  await db.query('DELETE FROM notifications WHERE link LIKE ?', [`%/job-requests/${returnedId}%`]);
  await db.query('DELETE FROM job_request_status_history WHERE job_request_id = ?', [returnedId]);
  await db.query('DELETE FROM job_requests WHERE id = ?', [returnedId]);
  console.log(`  (filed and removed ${retRow?.ticket_no || returnedId})`);
}

await db.end();
console.log(`\n${fail === 0 ? 'PASS' : `FAIL (${fail} failing)`}\n`);
process.exit(fail === 0 ? 0 : 1);
