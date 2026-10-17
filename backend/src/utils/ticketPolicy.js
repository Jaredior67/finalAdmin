/**
 * ticketPolicy — the single server-side ticket lifecycle policy.
 *
 * Kept free of Express/DB so it can be unit-tested with node:test.
 * Roles: admin, campus_admin (privileged) A→ maintenance, technician (tech) A→
 * faculty, staff (requesters — read own only, never change status).
 *
 * WHY THIS FILE IS THE ONLY PLACE THE LIFECYCLE IS DEFINED
 *
 * Every status write in the application must go through authorizeStatusChange()
 * or assertAgainstPolicy(). The dedicated action endpoints
 * (supervisor-action, admin-action, approver-action, assign-technician) used to
 * hardcode their target status and skip this policy entirely, which meant:
 *
 *   - a supervisor could approve any ticket in the system, not just their own
 *   - a ticket already in 'Completed' or 'Rejected' could be dragged back into
 *     the workflow, so "terminal" was not terminal on those paths
 *   - the endorsement chain could be short-circuited
 *
 * terminalStatuses() and assertAgainstPolicy() exist so those endpoints get the
 * same guarantees as PUT /:id/status.
 *
 * missingApprovalFor() is the second half of that guarantee: TRANSITIONS says
 * which statuses may follow which, missingApprovalFor() says which of the three
 * approvals (Immediate Supervisor, System Administrator, Campus Administrator)
 * must already be on record before that step is allowed. Without it, a single
 * privileged caller could walk a request through every level by calling the
 * generic endpoint three times.
 */

export const TRANSITIONS = {
  'Draft': ['Pending', 'Returned', 'Rejected'],
  // A request waits here for its Immediate Supervisor. The supervisor queue is
  // driven by this exact string, so it must match what the app writes.
  'Pending Supervisor Approval': ['Under Review', 'Returned', 'Pending', 'On Hold'],
  'Pending': ['Under Review', 'Returned', 'Rejected', 'On Hold'],
  'Under Review': ['Pending Final Approval', 'Awaiting Signatures', 'Returned', 'Rejected', 'On Hold'],
  /* 'Awaiting Signatures' deliberately does NOT lead to 'Approved'. It used to,
     which meant confirming the wet-ink hardcopy skipped the Approver's final
     approval entirely (and approver-action would accept it too, because it only
     consults this map). It now funnels into 'Pending Final Approval' where the
     Campus Administrator must still act. */
  'Awaiting Signatures': ['Pending Final Approval', 'Returned', 'Rejected', 'On Hold'],
  /* 'Under Review' is listed here so an Approver's DECLINE can hand the request
     back to the System Administrator: the manuscript requires the return to
     travel through the PDAS office rather than jumping straight to the
     requester. */
  'Pending Final Approval': ['Approved', 'Returned', 'Rejected', 'Under Review', 'On Hold'],
  'Approved': ['Ongoing', 'On Hold'],
  'Ongoing': ['Completed', 'On Hold'],
  // An admin may put work on hold and later release it.
  'On Hold': ['Ongoing', 'Rejected'],
  /* 'Returned for Revision' — what a supervisor/admin return produces. Unlike
     'Rejected' it is NOT terminal: the requester revises and the request goes
     back to 'Pending'. 'Rejected' stays terminal for an outright refusal. */
  'Returned': ['Pending', 'Rejected'],
  'Completed': [],
  'Rejected': []
};

/** Statuses a ticket can never leave. */
export const terminalStatuses = () =>
  Object.keys(TRANSITIONS).filter((s) => (TRANSITIONS[s] || []).length === 0);

export const isTerminalStatus = (status) => terminalStatuses().includes(status);

/** Every status the policy knows about. */
export const allStatuses = () => Object.keys(TRANSITIONS);

export const isPrivileged = (role) => role === 'admin' || role === 'campus_admin';
export const isTech = (role) => role === 'maintenance' || role === 'technician';
export const isSupervisor = (role) => role === 'supervisor';
// Accept a full user object so callers can check both the role and the
// is_supervisor designation flag without duplicating the logic everywhere.
export const isUserSupervisor = (user) =>
  !!(user && (user.role === 'supervisor' || user.isSupervisor || user.is_supervisor));

/**
 * Statuses that record an APPROVAL of the request rather than a return, a
 * refusal, or a work-log note.
 *
 * Separation of duties: nobody may approve a request they filed themselves.
 * The manuscript never states this rule in as many words (the papers are silent
 * on it), but a lifecycle whose whole purpose is independent endorsement is
 * meaningless if the endorsement can come from the applicant. A ticket reaching
 * `Approved` releases the work order, so the check belongs in the policy file
 * rather than in any single endpoint.
 *
 * Returns/refusals are deliberately NOT listed: a requester may still withdraw
 * their own request by rejecting or returning it.
 */
const APPROVAL_STATUSES = ['Under Review', 'Awaiting Signatures', 'Pending Final Approval', 'Approved'];

/**
 * Is this caller trying to approve their own request?
 *
 * @param {object|null} user the authenticated caller
 * @param {object}      row  the job request row
 * @param {string}      target the status about to be written
 * @returns {boolean}
 */
export function isSelfApproval(user, row, target) {
  if (!user || !row) return false;
  if (row.requester_id === null || row.requester_id === undefined) return false;
  if (Number(row.requester_id) !== Number(user.id)) return false;
  return APPROVAL_STATUSES.includes(target);
}

/** The refusal returned when someone attempts to approve their own request. */
export const SELF_APPROVAL_MESSAGE =
  'This request was filed by you, so you cannot approve it. A different PDAS Administrator or the Campus Administrator (Approver) must record this approval.';

/** Visibility / IDOR guard. */
export function canViewTicket(user, row) {
  if (!user || !row) return false;
  if (isPrivileged(user.role)) return true;
  if (isUserSupervisor(user)) {
    return row.status === 'Pending Supervisor Approval'
      || row.requester_id === user.id
      || row.supervisor_id === user.id
      || Boolean(row.immediate_supervisor && user.name && String(row.immediate_supervisor).toLowerCase().includes(String(user.name).toLowerCase()))
      || Boolean(row.department && user.department && row.department === user.department);
  }
  if (isTech(user.role)) {
    return (
      (row.assigned_to != null && (Number(row.assigned_to) === Number(user.id) || String(row.assigned_to) === String(user.id))) ||
      Boolean(row.assigned_to && user.name && String(row.assigned_to).toLowerCase().includes(String(user.name).toLowerCase()))
    );
  }
  return row.requester_id === user.id;
}

/**
 * Is this supervisor allowed to act on this ticket?
 *
 * canViewTicket() is deliberately permissive for supervisors (their department
 * queue, or anything naming them). Taking an ACTION is narrower: a supervisor
 * may only act on a ticket that is actually waiting for their endorsement, or
 * that they personally own. Without this, any supervisor account could approve
 * or reject every ticket in the system.
 */
export function canSuperviseTicket(user, row) {
  if (!user || !row) return false;
  if (!isUserSupervisor(user)) return false;
  if (row.supervisor_id && Number(row.supervisor_id) === Number(user.id)) return true;
  if (row.supervisor_id && Number(row.supervisor_id) !== Number(user.id)) return false;
  if (row.immediate_supervisor && user.name) {
    // The free-text supervisor named on the filing must identify this account.
    // (A supervisor_id recorded on the ticket has already been handled above.)
    return String(row.immediate_supervisor).toLowerCase().includes(String(user.name).toLowerCase());
  }
  /* No supervisor is recorded on the ticket and the free-text name identifies
     nobody. This used to fall through to a blanket `status === 'Pending'`
     allowance, so any designated supervisor could endorse any unclaimed
     request — including one they filed themselves. Requests with no
     identifiable Supervisor are auto-endorsed at filing instead (see
     POST /api/job-requests), so nothing legitimately reaches this branch. */
  return false;
}

/**
 * Which earlier approval must already be on record before `targetStatus` may
 * be written, or null when nothing further is required.
 *
 * WHY `actor` MATTERS
 *
 * The dedicated action endpoints write their own approval flag in the SAME
 * statement that writes the status, so they must not be blocked by the flag
 * they are about to write — that flag's name is waived for them. Every OTHER
 * prerequisite still applies, which is what stops an approver signing off a
 * request the System Administrator never endorsed, or a privileged account
 * driving a status change straight past a level.
 *
 * The generic PUT /:id/status sets no flags at all, so it passes no actor and
 * is held to the full requirement. Because each flag is only ever written by
 * the endpoint that also performs that level's transition, a caller who reaches
 * `Pending Final Approval` or `Approved` through the generic endpoint has no
 * flag to satisfy and is refused — which is the point: those two moves are
 * performed by admin-action and approver-action respectively.
 *
 * @param {object} row     the job request row, read BEFORE the write
 * @param {string} targetStatus the status about to be written
 * @param {string|null} actor 'supervisor' | 'admin' | 'campus_admin' | null
 * @returns {string|null} a human description of the missing approval, or null
 */
export function missingApprovalFor(row, targetStatus, actor = null) {
  if (!row) return null;
  const missing = (flag) => {
    if (actor === 'supervisor' && flag === 'supervisor_approved') return false;
    if (actor === 'campus_admin' && flag === 'campus_admin_approved') return false;
    return !Boolean(row[flag]);
  };

  // Reaching PDAS review at all — whether by the supervisor endorsing it or by
  // the admin opening the evaluation — presupposes the supervisory
  // confirmation. (Requests with no Supervisor are auto-confirmed at filing, so
  // they satisfy this like any other.)
  if ((targetStatus === 'Under Review' || targetStatus === 'Pending Final Approval')
      && missing('supervisor_approved')) {
    return 'the Immediate Supervisor';
  }
  if (targetStatus === 'Approved') {
    if (missing('admin_approved')) return 'the System Administrator';
    if (missing('campus_admin_approved')) return 'the Campus Administrator (Approver)';
  }
  // Work only starts once the Approver has signed off, and only via
  // assign-technician, which mints the official tracking number.
  if (targetStatus === 'Ongoing' && row.status === 'Approved' && missing('campus_admin_approved')) {
    return 'the Campus Administrator (Approver)';
  }
  return null;
}

/**
 * Authorize a status change. Returns { ok: true } or
 * { ok: false, status: <http code>, message }.
 */
export function authorizeStatusChange(user, row, targetStatus) {
  if (!row) return { ok: false, status: 404, message: 'Job request not found.' };
  const current = row.status;

  if (!isPrivileged(user.role)) {
    const isAssignedTech = isTech(user.role) && (
      (row.assigned_to != null && (Number(row.assigned_to) === Number(user.id) || String(row.assigned_to) === String(user.id))) ||
      Boolean(row.assigned_to && user.name && String(row.assigned_to).toLowerCase().includes(String(user.name).toLowerCase()))
    );
    const techAllowedStatus = ['Ongoing', 'In Progress', 'Completed'].includes(targetStatus) && ['Approved', 'Ongoing', 'In Progress', 'On Hold'].includes(current);
    const techCompletion = isAssignedTech && techAllowedStatus;
    if (!techCompletion) {
      return { ok: false, status: 403, message: 'Only assigned maintenance personnel or PDAS Admin can update this ticket.' };
    }
  }

  // A ticket in a terminal state is closed. Re-opening it is a separate,
  // deliberate act (unarchive), never a side effect of an action endpoint.
  if (isTerminalStatus(current)) {
    return {
      ok: false,
      status: 409,
      message: `This request is already ${current} and cannot be moved to "${targetStatus}".`
    };
  }

  if (!allStatuses().includes(targetStatus)) {
    return { ok: false, status: 400, message: `"${targetStatus}" is not a recognised status.` };
  }

  // Re-recording the stage a ticket is already in (saving work-log notes
  // without advancing it, confirming a hardcopy twice) is not a jump, so it is
  // not rejected as one — but it still writes history, audit and notifications.
  if (targetStatus === current) return { ok: true };

  // Nobody approves a request they filed themselves (see isSelfApproval).
  if (isSelfApproval(user, row, targetStatus)) {
    return { ok: false, status: 403, message: SELF_APPROVAL_MESSAGE };
  }

  if (!(TRANSITIONS[current] || []).includes(targetStatus)) {
    return { ok: false, status: 422, message: `Cannot move a request from "${current}" to "${targetStatus}".` };
  }

  /* Approved -> Ongoing through THIS endpoint would skip the step that issues
     the official control number and records the assignee. assign-technician
     does both and calls assertAgainstPolicy instead, so it is unaffected;
     releasing a held ticket (On Hold -> Ongoing) is unaffected too. */
  if (current === 'Approved' && targetStatus === 'Ongoing') {
    return {
      ok: false,
      status: 409,
      message: 'Assign the work order first — issuing the official tracking number happens when the work is assigned.'
    };
  }

  const missingApproval = missingApprovalFor(row, targetStatus);
  if (missingApproval) {
    return {
      ok: false,
      status: 403,
      message: `This request cannot move to "${targetStatus}" yet: ${missingApproval} has not recorded its approval.`
    };
  }

  return { ok: true };
}

/**
 * Guard for the dedicated action endpoints, which know their own target status
 * and their own role requirement but must not skip the lifecycle rules.
 *
 * @param {object} opts
 * @param {object} opts.user    the authenticated caller
 * @param {object} opts.row     the job request row
 * @param {string} opts.target the status this action will set
 * @param {string} opts.actor  'supervisor' | 'admin' | 'campus_admin' | 'technician'
 * @returns {{ok:true}|{ok:false,status:number,message:string}}
 */
export function assertAgainstPolicy({ user, row, target, actor }) {
  if (!row) return { ok: false, status: 404, message: 'Job request not found.' };

  // 1. Terminal state comes first. A closed request is closed for everyone, and
  //    reporting that before the permission check keeps the answer from
  //    depending on who is asking.
  if (isTerminalStatus(row.status)) {
    return {
      ok: false,
      status: 409,
      message: `This request is already ${row.status} and can no longer be actioned.`
    };
  }

  // 2. Ownership: the actor must actually be responsible for this ticket.
  //    Note that a PDAS administrator is NOT implicitly the ticket's supervisor:
  //    the manuscript requires this level to be performed by the designated
  //    Immediate Supervisor, so nothing here waives the check for a role.
  if (actor === 'supervisor' && !canSuperviseTicket(user, row)) {
    return {
      ok: false,
      status: 403,
      message: 'This request is not assigned to you. Only its designated Immediate Supervisor may endorse or return it.'
    };
  }
  if (actor === 'technician' && !isTech(user.role)) {
    return { ok: false, status: 403, message: 'Only maintenance personnel may perform this action.' };
  }

  // 3. Re-recording the stage the ticket is already in is not a jump. It still
  //    writes its own history/audit rows, so it must not be refused as an
  //    invalid transition.
  if (target === row.status) return { ok: true };

  // 3b. Separation of duties: the caller must not be approving a request they
  //     filed themselves. Placed after the same-status check above so a
  //     work-log note on one's own ticket is still allowed, exactly as in
  //     authorizeStatusChange().
  if (isSelfApproval(user, row, target)) {
    return { ok: false, status: 403, message: SELF_APPROVAL_MESSAGE };
  }

  // 4. The transition itself must be one the policy allows from here.
  if (!(TRANSITIONS[row.status] || []).includes(target)) {
    return {
      ok: false,
      status: 409,
      message: `"${target}" is not a valid step from "${row.status}". Refresh the request — it may already have moved on.`
    };
  }

  // 5. The earlier levels of the endorsement chain must already have signed off.
  //    This is what stops an Approver approving a request the System
  //    Administrator never endorsed, or an admin opening an evaluation on a
  //    request no Supervisor has confirmed.
  const missingApproval = missingApprovalFor(row, target, actor);
  if (missingApproval) {
    return {
      ok: false,
      status: 403,
      message: `This request cannot move to "${target}" yet: ${missingApproval} has not recorded its approval.`
    };
  }

  return { ok: true };
}
