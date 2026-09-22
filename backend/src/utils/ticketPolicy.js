/**
 * ticketPolicy — pure server-side ticket lifecycle policy (Phase 2).
 * Kept free of Express/DB so it can be unit-tested with node:test.
 * Roles: admin, campus_admin (privileged) · maintenance, technician (tech) ·
 * faculty, staff (requesters — read own only, never change status).
 */

export const TRANSITIONS = {
  'Pending': ['Under Review', 'Rejected'],
  'Under Review': ['Awaiting Signatures', 'Rejected'],
  'Awaiting Signatures': ['Approved', 'Rejected'],
  'Approved': ['Ongoing', 'Rejected'],
  'Ongoing': ['Completed'],
  'Completed': [],
  'Rejected': [],
};

export const isPrivileged = (role) => role === 'admin' || role === 'campus_admin';
export const isTech = (role) => role === 'maintenance' || role === 'technician';

/** Visibility / IDOR guard. */
export function canViewTicket(user, row) {
  if (!user || !row) return false;
  if (isPrivileged(user.role)) return true;
  if (isTech(user.role)) return row.assigned_to === user.id;
  return row.requester_id === user.id;
}

/**
 * Authorize a status change. Returns { ok: true } or
 * { ok: false, status: <http code>, message }.
 */
export function authorizeStatusChange(user, row, targetStatus) {
  if (!row) return { ok: false, status: 404, message: 'Job request not found.' };
  const current = row.status;

  if (!isPrivileged(user.role)) {
    const techCompletion = isTech(user.role)
      && current === 'Ongoing'
      && targetStatus === 'Completed'
      && row.assigned_to === user.id;
    if (!techCompletion) {
      return { ok: false, status: 403, message: 'Only PDAS Admin can change ticket status (assigned technicians may only mark their own ticket Completed).' };
    }
  }

  if (!(TRANSITIONS[current] || []).includes(targetStatus)) {
    return { ok: false, status: 422, message: `Cannot move a ticket from "${current}" to "${targetStatus}".` };
  }

  // Signed-form gate: no digital signatures; the physical hardcopy must be
  // confirmed by PDAS Admin before Approved or Ongoing.
  if ((targetStatus === 'Approved' || targetStatus === 'Ongoing') && !row.signed_form_confirmed) {
    return { ok: false, status: 422, message: 'The physically signed PDAS form must be confirmed by PDAS Admin before approval or dispatch.' };
  }

  return { ok: true };
}
