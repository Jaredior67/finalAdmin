import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSITIONS, canViewTicket, authorizeStatusChange } from '../src/utils/ticketPolicy.js';

const admin = { id: 1, role: 'admin' };
const tech = { id: 7, role: 'maintenance' };
const faculty = { id: 9, role: 'faculty' };

const row = (over = {}) => ({
  id: 1,
  status: 'Pending',
  requester_id: 9,
  assigned_to: 7,
  signed_form_confirmed: 0,
  ...over,
});

describe('TRANSITIONS', () => {
  it('covers the full manuscript lifecycle with terminal states', () => {
    assert.deepEqual(Object.keys(TRANSITIONS).sort(), [
      'Approved', 'Awaiting Signatures', 'Completed',
      'Ongoing', 'Pending', 'Rejected', 'Under Review',
    ].sort());
    assert.deepEqual(TRANSITIONS['Completed'], []);
    assert.deepEqual(TRANSITIONS['Rejected'], []);
  });
});

describe('canViewTicket (IDOR guard)', () => {
  it('lets admins see everything', () => {
    assert.equal(canViewTicket(admin, row()), true);
  });
  it('lets technicians see only assigned tickets', () => {
    assert.equal(canViewTicket(tech, row()), true);
    assert.equal(canViewTicket(tech, row({ assigned_to: 8 })), false);
  });
  it('lets faculty see only their own tickets', () => {
    assert.equal(canViewTicket(faculty, row()), true);
    assert.equal(canViewTicket(faculty, row({ requester_id: 10 })), false);
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
  it('blocks Approved without confirmed signed form', () => {
    const r = authorizeStatusChange(admin, row({ status: 'Awaiting Signatures' }), 'Approved');
    assert.equal(r.ok, false);
    assert.equal(r.status, 422);
  });
  it('allows Approved once the signed form is confirmed', () => {
    const r = authorizeStatusChange(admin, row({ status: 'Awaiting Signatures', signed_form_confirmed: 1 }), 'Approved');
    assert.equal(r.ok, true);
  });
  it('lets the assigned technician complete their own ticket', () => {
    const r = authorizeStatusChange(tech, row({ status: 'Ongoing' }), 'Completed');
    assert.equal(r.ok, true);
  });
  it('blocks technicians from completing unassigned tickets', () => {
    const r = authorizeStatusChange(tech, row({ status: 'Ongoing', assigned_to: 8 }), 'Completed');
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });
  it('blocks moves out of terminal states', () => {
    assert.equal(authorizeStatusChange(admin, row({ status: 'Completed' }), 'Ongoing').ok, false);
    assert.equal(authorizeStatusChange(admin, row({ status: 'Rejected' }), 'Pending').ok, false);
  });
});
