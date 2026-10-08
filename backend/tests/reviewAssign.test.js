/* Guards for the Review & Assign flow.
 *
 * The defect this file exists for: the review modal called 13 setters that were
 * never declared, so clicking "Review & Assign" threw a ReferenceError and the
 * dialog never opened. Vite does not catch that — an undeclared name is a global
 * reference, and Rollup warns rather than fails. The build passed, the table
 * rendered, and the only evidence was a broken button.
 *
 * So these checks are static and textual: they fail in CI rather than in front
 * of a user. Run: node --test tests/reviewAssign.test.js                  */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments, declaredNames, functionBody } from './helpers/jsSource.js';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const jobRequests = read('frontend', 'src', 'views', 'admin', 'JobRequests.jsx');
const campusAdmin = read('frontend', 'src', 'views', 'campusAdmin', 'CampusAdminDashboard.jsx');
const dataContext = read('frontend', 'src', 'context', 'DataContext.jsx');
const requisitionRoutes = read('backend', 'src', 'routes', 'requisitionRoutes.js');

const code = stripComments;

/* ------------------------------------------------------------------ *
 * The undeclared-setter class of bug
 * ------------------------------------------------------------------ */

/* Setters that are not local state. A method call on an object is not a
   reference to a binding in this file — `today.setHours(0, 0, 0)` is Date —
   and a handful of `setX` names are genuine globals. */
const GLOBALS = new Set(['setTimeout', 'setInterval', 'setImmediate', 'setPrototypeOf']);

function localSettersCalled(src) {
  const called = new Set();
  for (const m of stripComments(src).matchAll(/(?<![.\w$])(set[A-Z]\w*)\s*\(/g)) called.add(m[1]);
  return called;
}

function undeclaredSetters(src) {
  const declared = declaredNames(src);
  return [...localSettersCalled(src)]
    .filter((n) => !declared.has(n) && !GLOBALS.has(n))
    .sort();
}

test('every setter the review modal calls is declared in the same file', () => {
  const missing = undeclaredSetters(jobRequests);
  assert.deepEqual(missing, [],
    `called but never declared — each throws a ReferenceError when its code path runs: ${missing.join(', ')}`);
});

test('the same check passes on the approver dashboard', () => {
  // It had the same shape of defect waiting to happen, and the fix is the check
  // rather than one file at a time.
  const missing = undeclaredSetters(campusAdmin);
  assert.deepEqual(missing, [], missing.join(', '));
});

test('the helper agrees with itself on a known-good and known-bad input', () => {
  // A guard that cannot fail is worse than no guard, since it reports the
  // undeclared-setter bug as fixed.
  const good = `
    import React, { useState } from 'react';
    const Widget = ({ initial }) => {
      const [open, setOpen] = useState(false);
      return <button onClick={() => setOpen(!open)}>{initial}</button>;
    };
  `;
  assert.deepEqual(undeclaredSetters(good), []);

  const bad = `
    import React, { useState } from 'react';
    const Widget = () => {
      const [open] = useState(false);
      return <button onClick={() => setOpen(true)}>x</button>;
    };
  `;
  assert.deepEqual(undeclaredSetters(bad), ['setOpen']);

  // A method call is not a missing binding.
  const withDate = `const f = (d) => { const t = new Date(); t.setHours(0, 0, 0); return t; };`;
  assert.deepEqual(undeclaredSetters(withDate), []);
});

/* ------------------------------------------------------------------ *
 * The write paths
 * ------------------------------------------------------------------ */

test('every review decision reaches the server', () => {
  for (const [fn, endpoint] of [
    ['submitAdminAction', 'apiAdminAction'],
    ['submitApproverAction', 'apiApproverAction'],
    ['assignTechnician', 'apiAssignTechnician'],
    ['updateFinalAction', 'apiApproverAction'],
  ]) {
    const body = functionBody(dataContext, fn);
    assert.ok(body !== null, `${fn} is missing or not a function expression`);
    assert.ok(body.includes(endpoint), `${fn} never calls ${endpoint}`);
  }
});

test('a failed write is never reported as a success', () => {
  for (const fn of ['submitAdminAction', 'submitApproverAction', 'assignTechnician', 'updateFinalAction']) {
    const body = functionBody(dataContext, fn);
    assert.ok(body !== null, `${fn} is missing`);
    // The old shape caught the error, logged a warning, and carried on to the
    // local state mutation and the success toast.
    assert.ok(
      /catch\s*\([^)]*\)\s*\{[\s\S]*?toast\([^)]*'error'/.test(body),
      `${fn} has no error branch that reports the failure to the user`
    );
    assert.ok(
      !/console\.warn\(\s*['"`]/.test(body),
      `${fn} still swallows its API error with console.warn instead of reporting it`
    );
    // A local status mutation after the call is the optimistic-update shape that
    // hides a refusal. The server owns the status; the client re-reads.
    assert.ok(
      !/setRequisitions\(/.test(body),
      `${fn} still mutates local status instead of re-reading the server`
    );
  }
});

test('the review modal offers only transitions the policy allows', () => {
  const src = code(jobRequests);
  // A free status dropdown stood in for this: it offered every status at every
  // stage, and the server refused most of them.
  assert.ok(!/<label[^>]*>\s*Workflow Status/.test(src),
    'the "Workflow Status" dropdown is back — it offers transitions the policy forbids');
  assert.ok(/const stageFor = /.test(src), 'the stage is not derived from the ticket status');
  // Every status the policy can hold needs a case, or a ticket lands on the
  // "no action available" branch and the admin cannot move it.
  for (const status of [
    'Pending', 'Pending Supervisor Approval', 'Under Review',
    'Pending Final Approval', 'Awaiting Signatures', 'Approved',
    'Ongoing', 'On Hold', 'Completed', 'Rejected'
  ]) {
    assert.ok(
      src.includes(`'${status}'`),
      `stageFor has no case for "${status}" — the admin gets no actions for such a ticket`
    );
  }
});

test('the assignment select offers account ids, not display strings', () => {
  const src = code(jobRequests);
  // assigned_to is a foreign key and canViewTicket matches on it, so sending
  // "Juan Cruz (Electrical)" left the work order invisible to its own assignee.
  assert.ok(
    /value=\{String\(t\.id\)\}/.test(src),
    'the technician <option> value must be the account id'
  );
  assert.ok(
    !/value=\{`\$\{name\} \(\$\{spec\}\)`\}/.test(src),
    'the technician <option> value is a display string again'
  );
});

test('the server refuses an assignee that is not an active maintenance account', () => {
  const src = code(requisitionRoutes);
  assert.ok(
    /role IN \('maintenance', 'technician'\) AND status = 'active'/.test(src),
    'assign-technician does not verify the assignee is an active maintenance account'
  );
  assert.ok(
    /not an active maintenance account/.test(src),
    'the rejection is not reported to the admin'
  );
  // The notification must go to the resolved user, not to whatever the client sent.
  assert.ok(
    /await notify\(conn, technician\.id,/.test(src),
    'the work order notification is not addressed to the resolved technician'
  );
});

test('the control number is issued by the server, never by the browser', () => {
  const src = code(dataContext);
  // Two admins assigning at once would collide on a client-minted number; the
  // sequence is allocated inside the transaction.
  for (const fn of ['updateFinalAction', 'assignTechnician']) {
    const at = src.indexOf(`const ${fn} =`);
    const body = src.slice(at, src.indexOf('\n\n', at));
    assert.ok(
      !body.includes('generateNextTrackingNumber('),
      `${fn} still mints a control number in the browser`
    );
  }
  assert.ok(
    /tracking_sequences/.test(requisitionRoutes),
    'the server no longer allocates control numbers from a sequence'
  );
});

test('the approver is notified when a request needs their decision', () => {
  // The notification was addressed to faculty and staff only, so the approver's
  // bell stayed silent on exactly the step that requires them.
  const src = code(requisitionRoutes);
  assert.ok(
    /await notifyApprovers\(conn, 'Pending Final Approval'/.test(src),
    'the admin endorsement does not notify the approvers'
  );
  const ctx = code(dataContext);
  assert.ok(
    /targetRoles: \['campus_admin'/.test(ctx),
    "the client-side approver notice does not address 'campus_admin'"
  );
});

test('the final decision tells the approver where it went', () => {
  // The old text claimed a control number was issued at approval. It is issued
  // when the work order is created, so that promise was false.
  const src = code(campusAdmin);
  assert.ok(
    /await updateFinalAction\(/.test(src),
    'the approver dialog does not await the server'
  );
  assert.ok(
    /const \{ ok, trackingNo \} = await updateFinalAction/.test(src),
    'the caller cannot tell a recorded decision from a refused one'
  );
  assert.ok(
    /it is now with PDAS to assign/i.test(src) || /now with PDAS to assign/i.test(src),
    'the confirmation does not say the request returns to PDAS for assignment'
  );
  assert.ok(
    /decisionBusy/.test(src) && /disabled=\{decisionBusy\}/.test(src),
    'the confirm button is not disabled while the decision is in flight'
  );
});

test('the review form renders and the modal is reachable', () => {
  const src = code(jobRequests);
  // The requirement: clicking Review shows the automated form, with a decision
  // to make on it.
  assert.ok(/Review &amp; Assign|Review & Assign/.test(jobRequests), 'the Review button is gone');
  assert.ok(
    /<JobRequestPrintSheet/.test(src),
    'the QF-PDAS-DC-01 form does not render in the review modal'
  );
  assert.ok(/isOpen=\{isModalOpen\}/.test(src), 'the modal is not bound to its open flag');
  assert.ok(
    /onClick=\{\(\) => handleOpenDetail\(req\)\}/.test(src),
    'the Review button does not open the modal'
  );
  assert.ok(
    /setIsModalOpen\(true\)/.test(functionBody(jobRequests, 'handleOpenDetail') || ''),
    'handleOpenDetail does not open the modal'
  );
});

test('the actions in the footer and the decision panel come from one place', () => {
  // If the footer and the panel each built their own button list they would
  // disagree, and the admin would see two different sets of what is possible.
  const src = code(jobRequests);
  assert.ok(
    /stage\.actions\.map\(/.test(src),
    'the modal footer does not render the stage actions'
  );
  assert.ok(
    /\{stage\.heading\}/.test(src) && /\{stage\.note\}/.test(src),
    'the decision panel does not render the stage heading and note'
  );
  assert.ok(/const stage = stageFor\(/.test(src), 'the stage is not computed once');
});

test('the stage is computed after the handlers its actions name', () => {
  /* Ordering, not just presence. stageFor() builds object literals that name
     onBeginReview, onEndorse, onReturn and friends. If `const stage =
     stageFor(selectedReq)` runs above them, those reads happen in the temporal
     dead zone and throw. The page still loads — selectedReq is null, so
     stageFor takes the default branch and names nothing — which is why the
     fault only appears on the click that opens the modal, looking exactly like
     a broken button. Textual order is what catches that; `declaredNames` alone
     reports every one of them as fine. */
  const src = code(jobRequests);
  const at = src.indexOf('const stage = stageFor(');
  assert.ok(at > -1, 'the stage is no longer computed in one place');

  const body = src.slice(src.indexOf('const stageFor'), at);
  const named = new Set(
    [...body.matchAll(/onClick:\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1])
  );
  assert.ok(named.size >= 3, `stageFor names only ${named.size} action handlers`);

  for (const fn of named) {
    const decl = src.indexOf(`const ${fn} =`);
    assert.ok(decl > -1, `${fn} is referenced by stageFor but never declared`);
    assert.ok(
      decl < at,
      `${fn} is declared after \`const stage = stageFor(...)\`, so opening the modal reads it in the temporal dead zone and throws ReferenceError`
    );
  }
});
