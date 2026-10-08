import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSITIONS,
  canViewTicket,
  canSuperviseTicket,
  authorizeStatusChange,
  assertAgainstPolicy,
  terminalStatuses,
  isTerminalStatus
} from '../src/utils/ticketPolicy.js';

const admin = { id: 1, role: 'admin' };
const campusAdmin = { id: 2, role: 'campus_admin' };
const tech = { id: 7, role: 'maintenance' };
const technician = { id: 8, role: 'technician' };
const faculty = { id: 9, role: 'faculty' };
const supervisor = { id: 5, role: 'supervisor', name: 'Dr. Maria Santos', department: 'CEA' };

const row = (over = {}) => ({
  id: 1,
  status: 'Pending',
  requester_id: 9,
  assigned_to: 7,
  signed_form_confirmed: 0,
  ...over,
});

describe('TRANSITIONS', () => {
  it('covers every non-terminal status the database can hold', () => {
    // A status with no entry is a ticket that can never move again.
    for (const s of [
      'Draft', 'Pending Supervisor Approval', 'Pending', 'Under Review',
      'Pending Final Approval', 'Awaiting Signatures', 'Approved',
      'Ongoing', 'On Hold', 'Returned', 'Completed', 'Rejected'
    ]) {
      assert.ok(s in TRANSITIONS, `TRANSITIONS has no entry for "${s}"`);
    }
  });

  it('treats Completed and Rejected as the only terminal states', () => {
    assert.deepEqual(terminalStatuses().sort(), ['Completed', 'Rejected']);
    assert.equal(isTerminalStatus('Completed'), true);
    assert.equal(isTerminalStatus('Rejected'), true);
    assert.equal(isTerminalStatus('On Hold'), false);
    // Returned for Revision is deliberately NOT terminal — the requester
    // revises and resubmits. Folding it into 'Rejected' made a return
    // permanent and locked the requester out of their own request.
    assert.equal(isTerminalStatus('Returned'), false);
  });

  it('lets a returned request be resubmitted or closed', () => {
    assert.deepEqual(TRANSITIONS['Returned'].sort(), ['Pending', 'Rejected']);
  });

  it('lets a held ticket be released or rejected', () => {
    assert.deepEqual(TRANSITIONS['On Hold'].sort(), ['Ongoing', 'Rejected']);
  });

  it('routes a ticket awaiting signatures onward', () => {
    // This path was unreachable: the value was folded into
    // 'Pending Final Approval' before it reached the database, so the
    // signature-confirmation step could never run. It must land in
    // 'Pending Final Approval' — never jump straight to 'Approved', which is
    // the Approver's call alone.
    assert.ok(TRANSITIONS['Awaiting Signatures'].includes('Pending Final Approval'));
    assert.ok(TRANSITIONS['Awaiting Signatures'].includes('Rejected'));
    assert.equal(
      TRANSITIONS['Awaiting Signatures'].includes('Approved'),
      false,
      'confirming the signed hardcopy must not skip the Approver'
    );
  });

  it('lets an Approver hand a declined request back to PDAS', () => {
    // The manuscript requires a decline to travel THROUGH the System
    // Administrator rather than jumping straight to the requester.
    assert.ok(TRANSITIONS['Pending Final Approval'].includes('Under Review'));
  });
});

describe('canViewTicket (IDOR guard)', () => {
  it('lets privileged roles see everything', () => {
    assert.equal(canViewTicket(admin, row()), true);
    assert.equal(canViewTicket(campusAdmin, row()), true);
  });
  it('lets both technician roles see only assigned tickets', () => {
    assert.equal(canViewTicket(tech, row()), true);
    assert.equal(canViewTicket(tech, row({ assigned_to: 8 })), false);
    // 'technician' is a first-class role in the users enum and was missing
    // from the list endpoint's filter chain, which returned every ticket.
    assert.equal(canViewTicket(technician, row({ assigned_to: 8 })), true);
    assert.equal(canViewTicket(technician, row({ assigned_to: 7 })), false);
  });
  it('lets supervisors see their queue', () => {
    assert.equal(canViewTicket(supervisor, row({ status: 'Pending Supervisor Approval' })), true);
    assert.equal(canViewTicket(supervisor, row({ supervisor_id: 5 })), true);
    assert.equal(canViewTicket(supervisor, row({ immediate_supervisor: 'Dr. Maria Santos' })), true);
    assert.equal(
      canViewTicket(supervisor, row({ immediate_supervisor: 'Prof. Other', status: 'Ongoing' })),
      false
    );
  });
  it('lets faculty see only their own tickets', () => {
    assert.equal(canViewTicket(faculty, row()), true);
    assert.equal(canViewTicket(faculty, row({ requester_id: 10 })), false);
  });
  it('denies an unknown or missing caller', () => {
    assert.equal(canViewTicket(null, row()), false);
    assert.equal(canViewTicket({ role: 'intern' }, row()), false);
  });
});

describe('canSuperviseTicket (acting, not just viewing)', () => {
  it('lets a supervisor act on a ticket waiting for their endorsement', () => {
    // Filing now records which Supervisor must endorse, so the ticket carries
    // the assignment rather than relying on a queue-wide free-for-all.
    assert.equal(
      canSuperviseTicket(supervisor, row({ status: 'Pending Supervisor Approval', supervisor_id: 5 })),
      true
    );
  });
  it('lets a supervisor act on a ticket assigned to them', () => {
    assert.equal(canSuperviseTicket(supervisor, row({ supervisor_id: 5, status: 'Ongoing' })), true);
  });
  it('lets a supervisor act on a ticket that names them on the form', () => {
    assert.equal(
      canSuperviseTicket(supervisor, row({ immediate_supervisor: 'Dr. Maria Santos' })),
      true
    );
  });
  it('stops a supervisor acting on another supervisor\'s ticket', () => {
    // The route this guards previously had no ownership check at all, so any
    // supervisor account could approve or reject any ticket in the system.
    assert.equal(
      canSuperviseTicket(supervisor, row({ supervisor_id: 99, immediate_supervisor: 'Prof. Other' })),
      false
    );
  });
  it('does not let faculty or technicians supervise', () => {
    assert.equal(canSuperviseTicket(faculty, row({ status: 'Pending Supervisor Approval' })), false);
    assert.equal(canSuperviseTicket(tech, row({ status: 'Pending Supervisor Approval' })), false);
  });
  it('does not let a PDAS administrator stand in as the supervisor', () => {
    // 'admin' used to short-circuit to true here, so one privileged account
    // could perform the supervisory level as well as its own — which is
    // exactly the chain-skipping the manuscript forbids. requireRole() no
    // longer admits 'admin' to supervisor-action either.
    assert.equal(canSuperviseTicket(admin, row({ supervisor_id: 99 })), false);
    assert.equal(canSuperviseTicket(admin, row({ status: 'Pending Supervisor Approval' })), false);
    assert.equal(canSuperviseTicket(campusAdmin, row({ supervisor_id: 5 })), false);
  });
  it('refuses a ticket no supervisor can be identified for', () => {
    // The old fallback returned true for any Pending ticket, so any
    // designated supervisor could endorse (or self-endorse) an unclaimed
    // request. Filing auto-confirms those instead, so none should arrive —
    // and if one does, nobody may endorse it silently.
    assert.equal(
      canSuperviseTicket(supervisor, row({ status: 'Pending', supervisor_id: null })),
      false
    );
    assert.equal(
      canSuperviseTicket(supervisor, row({ status: 'Pending Supervisor Approval', immediate_supervisor: 'Prof. Other' })),
      false
    );
  });
});

describe('authorizeStatusChange', () => {
  it('blocks faculty from any status change', () => {
    const r = authorizeStatusChange(faculty, row({ status: 'Ongoing', assigned_to: 9 }), 'Completed');
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });
  it('blocks invalid jumps (Pending -> Completed)', () => {
    const r = authorizeStatusChange(admin, row(), 'Completed');
    assert.equal(r.ok, false);
    assert.equal(r.status, 422);
  });
  it('allows Approved on Pending Final Approval only once the Approver approved', () => {
    // The generic endpoint sets no approval flags of its own, so it must refuse
    // the final step until approver-action has recorded it. Without this a
    // single privileged account could walk a request through all three levels
    // by calling PUT /:id/status three times.
    const endorsed = row({ status: 'Pending Final Approval', supervisor_approved: 1, admin_approved: 1 });
    const refused = authorizeStatusChange(admin, endorsed, 'Approved');
    assert.equal(refused.ok, false);
    assert.equal(refused.status, 403);

    const approved = { ...endorsed, campus_admin_approved: 1 };
    assert.equal(authorizeStatusChange(admin, approved, 'Approved').ok, true);
  });
  it('blocks a status change that would skip the supervisory confirmation', () => {
    const r = authorizeStatusChange(admin, row({ status: 'Pending' }), 'Under Review');
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
    assert.match(r.message, /Immediate Supervisor/);
    assert.equal(
      authorizeStatusChange(admin, row({ status: 'Pending', supervisor_approved: 1 }), 'Under Review').ok,
      true
    );
  });
  it('sends an admin who tries to start work without an assignee to assign it first', () => {
    // Approved -> Ongoing through the generic endpoint would mint no control
    // number and record no technician. assign-technician does both.
    const r = authorizeStatusChange(
      admin,
      row({ status: 'Approved', campus_admin_approved: 1 }),
      'Ongoing'
    );
    assert.equal(r.ok, false);
    assert.equal(r.status, 409);
    assert.match(r.message, /tracking number/);
  });
  it('lets the assigned technician complete their own ticket', () => {
    assert.equal(authorizeStatusChange(tech, row({ status: 'Ongoing' }), 'Completed').ok, true);
    assert.equal(authorizeStatusChange(technician, row({ status: 'Ongoing', assigned_to: 8 }), 'Completed').ok, true);
  });
  it('blocks technicians from completing unassigned tickets', () => {
    const r = authorizeStatusChange(tech, row({ status: 'Ongoing', assigned_to: 8 }), 'Completed');
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });
  it('blocks moves out of terminal states with a conflict, not a bad-jump', () => {
    const done = authorizeStatusChange(admin, row({ status: 'Completed' }), 'Ongoing');
    assert.equal(done.ok, false);
    assert.equal(done.status, 409);
    assert.equal(authorizeStatusChange(admin, row({ status: 'Rejected' }), 'Pending').ok, false);
  });
  it('rejects a status the policy does not know at all', () => {
    const r = authorizeStatusChange(admin, row({ status: 'Pending' }), 'Teleported');
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
  });
});

describe('assertAgainstPolicy (dedicated action endpoints)', () => {
  it('refuses to move a closed ticket, whatever the actor', () => {
    for (const actor of ['supervisor', 'admin', 'campus_admin', 'technician']) {
      const r = assertAgainstPolicy({
        user: admin, row: row({ status: 'Completed' }), target: 'Ongoing', actor
      });
      assert.equal(r.ok, false, `${actor} re-opened a Completed ticket`);
      assert.equal(r.status, 409);
    }
  });
  it('refuses a supervisor acting on someone else\'s ticket', () => {
    const r = assertAgainstPolicy({
      user: supervisor,
      row: row({ status: 'Pending', supervisor_id: 99, immediate_supervisor: 'Prof. Other' }),
      target: 'Under Review',
      actor: 'supervisor'
    });
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });
  it('allows a supervisor to approve a ticket awaiting their endorsement', () => {
    const r = assertAgainstPolicy({
      user: supervisor,
      row: row({ status: 'Pending Supervisor Approval', supervisor_id: 5 }),
      target: 'Under Review',
      actor: 'supervisor'
    });
    assert.equal(r.ok, true);
  });
  it('refuses a final approval that skips the chain', () => {
    // A campus admin could previously approve a Draft straight to Approved,
    // skipping the Immediate Supervisor and PDAS evaluation entirely.
    for (const from of ['Draft', 'Pending', 'Under Review']) {
      const r = assertAgainstPolicy({
        user: campusAdmin, row: row({ status: from }), target: 'Approved', actor: 'campus_admin'
      });
      assert.equal(r.ok, false, `approved from "${from}"`);
      assert.equal(r.status, 409);
    }
  });
  it('allows a final approval from Pending Final Approval', () => {
    assert.equal(
      assertAgainstPolicy({
        user: campusAdmin,
        row: row({ status: 'Pending Final Approval', admin_approved: 1 }),
        target: 'Approved',
        actor: 'campus_admin'
      }).ok, true
    );
  });
  it('refuses a final approval the System Administrator never endorsed', () => {
    // approver-action only ever read TRANSITIONS, so the Approver could sign
    // off a request that had never been endorsed — the exact chain-skip the
    // manuscript forbids. The Approver waives only their OWN flag.
    const r = assertAgainstPolicy({
      user: campusAdmin,
      row: row({ status: 'Pending Final Approval', supervisor_approved: 1 }),
      target: 'Approved',
      actor: 'campus_admin'
    });
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
    assert.match(r.message, /System Administrator/);
  });
  it('refuses an evaluation opened before the Supervisor confirmed', () => {
    const r = assertAgainstPolicy({
      user: admin, row: row({ status: 'Pending' }), target: 'Under Review', actor: 'admin'
    });
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });
  it('only assigns work through the maintenance roles', () => {
    // assign-technician is an admin action; the 'technician' actor is reserved
    // for a technician acting on their own ticket.
    const asFaculty = assertAgainstPolicy({
      user: faculty, row: row({ status: 'Approved' }), target: 'Ongoing', actor: 'technician'
    });
    assert.equal(asFaculty.ok, false);
    assert.equal(asFaculty.status, 403);
    // Assignment is the step that mints the official tracking number, so it
    // may only follow the Approver's final approval.
    assert.equal(
      assertAgainstPolicy({
        user: admin, row: row({ status: 'Approved', campus_admin_approved: 1 }), target: 'Ongoing', actor: 'admin'
      }).ok, true
    );
    assert.equal(
      assertAgainstPolicy({
        user: admin, row: row({ status: 'Approved' }), target: 'Ongoing', actor: 'admin'
      }).ok, false
    );
  });
  it('reports a missing ticket as 404', () => {
    const r = assertAgainstPolicy({ user: admin, row: null, target: 'Ongoing', actor: 'admin' });
    assert.equal(r.status, 404);
  });
});
