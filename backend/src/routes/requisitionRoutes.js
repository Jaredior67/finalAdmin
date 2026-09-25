import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { auditLog } from '../utils/auditLog.js';
import { isPrivileged, isTech, canViewTicket, authorizeStatusChange } from '../utils/ticketPolicy.js';

const router = Router();
router.use(verifyToken);

/**
 * generateTicketNo - atomic, race-condition-safe ticket numbering.
 * Uses ticket_sequences with an atomic UPSERT so concurrent inserts
 * never produce the same ticket number (unlike COUNT(*) which had a TOCTOU gap).
 */
async function generateTicketNo(conn) {
  const year = new Date().getFullYear();
  // Upsert: insert the year row if missing, otherwise atomically bump counter.
  await conn.query(
    'INSERT INTO ticket_sequences (`year`, last_no) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1',
    [year]
  );
  const [[{ last_no }]] = await conn.query(
    'SELECT last_no FROM ticket_sequences WHERE `year` = ?',
    [year]
  );
  return `JR-${year}-${String(last_no).padStart(4, '0')}`;
}

async function notify(conn, userId, title, message, link = null) {
  if (!userId) return;
  await conn.query(
    'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
    [userId, title, message, link]
  );
}

// Helper to notify all active PDAS administrators
async function notifyAdmins(conn, title, message, link = null, excludeUserId = null) {
  const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'");
  for (const admin of admins) {
    if (admin.id !== excludeUserId) {
      await notify(conn, admin.id, title, message, link);
    }
  }
}

// Helper to notify supervisors
async function notifySupervisors(conn, title, message, link = null) {
  const [supervisors] = await conn.query("SELECT id FROM users WHERE role = 'supervisor' AND status = 'active'");
  for (const sup of supervisors) {
    await notify(conn, sup.id, title, message, link);
  }
}

// Helper to notify campus admin approvers
async function notifyApprovers(conn, title, message, link = null) {
  const [approvers] = await conn.query("SELECT id FROM users WHERE role = 'campus_admin' AND status = 'active'");
  for (const app of approvers) {
    await notify(conn, app.id, title, message, link);
  }
}

// Normalize urgency string to exact manuscript enums
function normalizeUrgency(u) {
  const str = String(u || '').toLowerCase();
  if (str.includes('high') || str.includes('urgent') || str.includes('emergency')) return 'High Risk';
  if (str.includes('low')) return 'Low Risk';
  return 'Medium Risk';
}

// Normalize status string to exact manuscript lifecycle statuses.
function normalizeStatus(s) {
  const str = String(s || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (str === 'draft') return 'Draft';
  if (str === 'pendingsupervisorapproval' || str === 'supervisorapproval' || str === 'supervisor') return 'Pending Supervisor Approval';
  if (str === 'pending') return 'Pending';
  if (str === 'underreview' || str === 'review') return 'Under Review';
  if (str === 'pendingfinalapproval' || str === 'finalapproval') return 'Pending Final Approval';
  if (str === 'awaitingsignatures' || str === 'awaiting') return 'Awaiting Signatures';
  if (str === 'approved') return 'Approved';
  if (str === 'ongoing' || str === 'inprogress') return 'Ongoing';
  if (str === 'completed' || str === 'resolved') return 'Completed';
  if (str === 'rejected' || str === 'cancelled') return 'Rejected';
  return null;
}

// GET /api/job-requests - filtered by role and archive status
router.get('/', async (req, res) => {
  try {
    const isArchived = req.query.archived === 'true' ? 1 : 0;
    let query = `
      SELECT jr.*, 
             CONCAT(req.first_name, ' ', req.last_name) AS requester_name,
             req.department AS requester_dept,
             req.email AS requester_email,
             CONCAT(tech.first_name, ' ', tech.last_name) AS assignee_name,
             cl.building, cl.floor, cl.room
      FROM job_requests jr
      LEFT JOIN users req ON req.id = jr.requester_id
      LEFT JOIN users tech ON tech.id = jr.assigned_to
      LEFT JOIN campus_locations cl ON cl.id = jr.location_id
      WHERE jr.is_archived = ?
    `;
    const params = [isArchived];

    if (req.user.role === 'maintenance') {
      query += ' AND jr.assigned_to = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'faculty' || req.user.role === 'staff') {
      query += ' AND jr.requester_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'supervisor') {
      query += ' AND (jr.status = "Pending Supervisor Approval" OR jr.supervisor_id = ? OR jr.immediate_supervisor LIKE ? OR req.department = ?)';
      params.push(req.user.id, `%${req.user.lastName || ''}%`, req.user.department || '');
    }

    // Server-side paging (Phase 2 follow-up): capped so history downloads stay small.
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    // High risk tickets prioritized first, then latest submitted
    query += ` ORDER BY 
      CASE jr.urgency_level 
        WHEN 'High Risk' THEN 1 
        WHEN 'Medium Risk' THEN 2 
        WHEN 'Low Risk' THEN 3 
        ELSE 4 
      END ASC, jr.created_at DESC
      LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /job-requests error:', err);
    res.status(500).json({ message: 'Failed to fetch job requests.' });
  }
});

// GET /api/job-requests/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT jr.*,
              CONCAT(req.first_name, ' ', req.last_name) AS requester_name,
              req.department AS requester_dept,
              req.email AS requester_email,
              CONCAT(tech.first_name, ' ', tech.last_name) AS assignee_name,
              cl.building, cl.floor, cl.room
       FROM job_requests jr
       LEFT JOIN users req ON req.id = jr.requester_id
       LEFT JOIN users tech ON tech.id = jr.assigned_to
       LEFT JOIN campus_locations cl ON cl.id = jr.location_id
       WHERE jr.id = ? OR jr.ticket_no = ?`,
      [req.params.id, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Job request not found.' });
    }
    // IDOR guard: only privileged roles, the assignee, or the requester.
    if (!canViewTicket(req.user, rows[0])) {
      return res.status(403).json({ message: 'You do not have permission to view this job request.' });
    }

    const [history] = await pool.query(
      `SELECT h.*, CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name
       FROM job_request_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.job_request_id = ? ORDER BY h.created_at ASC`,
      [rows[0].id]
    );

    res.json({ ...rows[0], history });
  } catch (err) {
    console.error('GET /job-requests/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch job request.' });
  }
});

// POST /api/job-requests - faculty/staff submit a new request
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      locationId,
      category,
      description,
      urgencyLevel,
      priority,
      requestType,
      isStandardFormFilled,
      immediateSupervisor
    } = req.body;

    if (!description) {
      return res.status(400).json({ message: 'description is required.' });
    }
    // Phase 2: server-side input limits (type/length). Category is
    // allow-listed; unknown values fall back to 'other'.
    if (typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ message: 'description must be a non-empty string.' });
    }
    if (description.length > 5000) {
      return res.status(400).json({ message: 'description must be 5000 characters or fewer.' });
    }
    const allowedCategories = ['electrical', 'plumbing', 'carpentry', 'ict', 'janitorial', 'other'];
    const finalCategory = allowedCategories.includes(String(category || '').toLowerCase())
      ? String(category).toLowerCase()
      : 'other';
    if (immediateSupervisor && String(immediateSupervisor).length > 150) {
      return res.status(400).json({ message: 'immediateSupervisor must be 150 characters or fewer.' });
    }

    const finalUrgency = normalizeUrgency(urgencyLevel || priority);
    const finalReqType = requestType === 'Urgent Request' || finalUrgency === 'High Risk' ? 'Urgent Request' : 'Standard Request';
    const finalFormFilled = isStandardFormFilled !== undefined ? isStandardFormFilled : (finalReqType !== 'Urgent Request');
    const isDraft = Boolean(req.body.isDraft);

    // All submitted job requests enter the workflow in 'Pending' status.
    const initialStatus = 'Pending';
    const requesterApproved = 1;
    const requesterApprovedAt = new Date();

    await conn.beginTransaction();
    const ticketNo = await generateTicketNo(conn);

    const [result] = await conn.query(
      `INSERT INTO job_requests
        (ticket_no, requester_id, location_id, category, description, urgency_level, request_type, is_standard_form_filled, immediate_supervisor, status, requester_approved, requester_approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticketNo,
        req.user.id,
        locationId || null,
        finalCategory,
        description,
        finalUrgency,
        finalReqType,
        finalFormFilled,
        immediateSupervisor || null,
        initialStatus,
        requesterApproved,
        requesterApprovedAt
      ]
    );

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, NULL, ?, ?, ?)',
      [result.insertId, initialStatus, req.user.id, isDraft ? 'Saved as Draft' : 'Submitted & Electronically Approved by Requester']
    );

    if (!isDraft) {
      // Step 2: High Risk instant notification to Admin for rapid response
      if (finalUrgency === 'High Risk') {
        await notifyAdmins(
          conn,
          '🚨 High Risk Facility Alert',
          `URGENT: ${ticketNo} submitted at location (${finalCategory}). Rapid response required.`,
          `/job-requests/${result.insertId}`
        );
      }

      // Routed directly to PDAS Admin for evaluation
      await notifyAdmins(
        conn,
        'New Job Request for Evaluation',
        `${ticketNo} submitted by ${req.user.email} (${finalUrgency}).`,
        `/job-requests/${result.insertId}`
      );

      // Notify requester
      await notify(
        conn,
        req.user.id,
        'Job Request Submitted',
        `Your request ${ticketNo} was submitted and queued for PDAS Admin review.`,
        `/job-requests/${result.insertId}`
      );
    }

    await conn.commit();
    await auditLog(pool, { actorId: req.user.id, action: isDraft ? 'request.draft' : 'request.submitted', entity: 'job_request', entityId: result.insertId, details: ticketNo });
    res.status(201).json({ message: isDraft ? 'Job request saved as draft.' : 'Job request submitted and approved.', id: result.insertId, ticketNo, status: initialStatus });
  } catch (err) {
    await conn.rollback();
    console.error('POST /job-requests error:', err);
    res.status(500).json({ message: 'Failed to submit job request.' });
  } finally {
    conn.release();
  }
});

// Step 3 (2): POST /api/job-requests/:id/supervisor-action
router.post('/:id/supervisor-action', requireRole('supervisor', 'admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { action, remarks } = req.body; // action: 'approve' | 'reject'
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    if (action === 'approve') {
      await conn.query(
        `UPDATE job_requests SET 
           supervisor_approved = 1, 
           supervisor_approved_at = NOW(), 
           supervisor_remarks = ?, 
           supervisor_id = ?, 
           status = 'Pending' 
         WHERE id = ?`,
        [remarks || 'Electronically Approved by Immediate Supervisor', req.user.id, req.params.id]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, jr.status, 'Pending', req.user.id, `Approved by Immediate Supervisor: ${remarks || 'Approved'}`]
      );
      await notifyAdmins(conn, 'Job Request Approved by Supervisor', `${jr.ticket_no} approved by Immediate Supervisor and routed to PDAS Admin.`, `/job-requests/${jr.id}`);
      await notify(conn, jr.requester_id, 'Supervisor Approved Request', `Your request ${jr.ticket_no} was approved by your Immediate Supervisor and forwarded to PDAS Admin.`, `/job-requests/${jr.id}`);
      await auditLog(conn, { actorId: req.user.id, action: 'request.supervisor.approved', entity: 'job_request', entityId: jr.id, details: remarks || 'Approved' });
      await conn.commit();
      return res.json({ message: 'Request approved by supervisor and routed to PDAS Admin.', status: 'Pending' });
    } else {
      if (!remarks || !remarks.trim()) {
        await conn.rollback();
        return res.status(400).json({ message: 'Rejection requires remarks.' });
      }
      await conn.query(
        `UPDATE job_requests SET 
           status = 'Rejected', 
           rejection_stage = 'supervisor', 
           rejection_remarks = ?, 
           supervisor_remarks = ? 
         WHERE id = ?`,
        [remarks.trim(), remarks.trim(), req.params.id]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, jr.status, 'Rejected', req.user.id, `Returned by Immediate Supervisor: ${remarks.trim()}`]
      );
      await notify(conn, jr.requester_id, 'Request Returned by Supervisor', `Your request ${jr.ticket_no} was returned for revision: ${remarks.trim()}`, `/job-requests/${jr.id}`);
      await auditLog(conn, { actorId: req.user.id, action: 'request.supervisor.rejected', entity: 'job_request', entityId: jr.id, details: remarks.trim() });
      await conn.commit();
      return res.json({ message: 'Request returned to requester for revision.', status: 'Rejected' });
    }
  } catch (err) {
    await conn.rollback();
    console.error('POST /supervisor-action error:', err);
    res.status(500).json({ message: 'Failed to process supervisor action.' });
  } finally {
    conn.release();
  }
});

// Step 3 (3): POST /api/job-requests/:id/admin-action
router.post('/:id/admin-action', requireRole('admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { action, remarks, fieldRemarks } = req.body; // action: 'approve' | 'reject' | 'evaluate'
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    if (action === 'evaluate') {
      await conn.query('UPDATE job_requests SET status = "Under Review" WHERE id = ?', [req.params.id]);
      await conn.query('INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Under Review", ?, ?)',
        [req.params.id, jr.status, req.user.id, 'Admin evaluation begun']);
      await notify(conn, jr.requester_id, 'Evaluation Underway', `PDAS Admin has begun evaluation of ${jr.ticket_no}.`, `/job-requests/${jr.id}`);
      await conn.commit();
      return res.json({ message: 'Evaluation begun. Status is Under Review.', status: 'Under Review' });
    }

    if (action === 'approve') {
      const fRemarksStr = fieldRemarks ? (typeof fieldRemarks === 'object' ? JSON.stringify(fieldRemarks) : String(fieldRemarks)) : null;
      await conn.query(
        `UPDATE job_requests SET 
           admin_approved = 1, 
           admin_approved_at = NOW(), 
           admin_remarks = ?, 
           admin_field_remarks = ?, 
           status = 'Awaiting Signatures' 
         WHERE id = ?`,
        [remarks || 'Electronically Approved by PDAS Head', fRemarksStr, req.params.id]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Awaiting Signatures", ?, ?)',
        [req.params.id, jr.status, req.user.id, `Admin Approved & Routed to Campus Admin: ${remarks || 'Approved'}`]
      );
      await notifyApprovers(conn, 'Awaiting Signatures / Final Approval', `${jr.ticket_no} has received PDAS Admin approval and awaits your final signatory review.`, `/campus-admin-dashboard`);
      await notify(conn, jr.requester_id, 'PDAS Admin Approved', `Your request ${jr.ticket_no} was approved by PDAS Head and is now Awaiting Signatures with Campus Administrator.`, `/job-requests/${jr.id}`);
      await auditLog(conn, { actorId: req.user.id, action: 'request.admin.approved', entity: 'job_request', entityId: jr.id, details: remarks || 'Admin approved' });
      await conn.commit();
      return res.json({ message: 'Request approved by Admin and routed to Campus Administrator.', status: 'Awaiting Signatures' });
    } else {
      const combinedRemarks = remarks || (fieldRemarks ? JSON.stringify(fieldRemarks) : 'Needs revision');
      await conn.query(
        `UPDATE job_requests SET 
           status = 'Rejected', 
           rejection_stage = 'admin', 
           rejection_remarks = ?, 
           admin_remarks = ?, 
           admin_field_remarks = ? 
         WHERE id = ?`,
        [combinedRemarks, remarks || null, fieldRemarks ? JSON.stringify(fieldRemarks) : null, req.params.id]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Rejected", ?, ?)',
        [req.params.id, jr.status, req.user.id, `Returned by PDAS Admin: ${combinedRemarks}`]
      );
      await notify(conn, jr.requester_id, 'Request Returned for Revision', `PDAS Admin returned ${jr.ticket_no} for revision: ${combinedRemarks}`, `/job-requests/${jr.id}`);
      await auditLog(conn, { actorId: req.user.id, action: 'request.admin.rejected', entity: 'job_request', entityId: jr.id, details: combinedRemarks });
      await conn.commit();
      return res.json({ message: 'Request returned to requester for revision.', status: 'Rejected' });
    }
  } catch (err) {
    await conn.rollback();
    console.error('POST /admin-action error:', err);
    res.status(500).json({ message: 'Failed to process admin action.' });
  } finally {
    conn.release();
  }
});

// Step 3 (4): POST /api/job-requests/:id/approver-action
router.post('/:id/approver-action', requireRole('campus_admin', 'admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { action, remarks } = req.body; // action: 'approve' | 'reject'
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    if (action === 'approve') {
      await conn.query(
        `UPDATE job_requests SET 
           campus_admin_approved = 1, 
           campus_admin_approved_at = NOW(), 
           campus_admin_remarks = ?, 
           signed_form_confirmed = 1, 
           signed_form_confirmed_by = ?, 
           signed_form_confirmed_at = NOW(), 
           status = 'Approved', 
           approved_by = ? 
         WHERE id = ?`,
        [remarks || 'Electronically Approved by Campus Administrator', req.user.id, req.user.id, req.params.id]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Approved", ?, ?)',
        [req.params.id, jr.status, req.user.id, `Campus Admin Final Approval: ${remarks || 'Approved'}`]
      );
      await notifyAdmins(conn, 'Final Approval Granted', `${jr.ticket_no} has received final approval from Campus Administrator. Please generate tracking number and assign maintenance personnel.`, `/job-requests/${jr.id}`);
      await notify(conn, jr.requester_id, 'Final Approval Granted', `Your request ${jr.ticket_no} has received Final Approval from Campus Administrator. Work order assignment in progress.`, `/job-requests/${jr.id}`);
      await auditLog(conn, { actorId: req.user.id, action: 'request.approver.approved', entity: 'job_request', entityId: jr.id, details: remarks || 'Approved' });
      await conn.commit();
      return res.json({ message: 'Final approval recorded. Ticket is Approved and returned to Admin for assignment.', status: 'Approved' });
    } else {
      if (!remarks || !remarks.trim()) {
        await conn.rollback();
        return res.status(400).json({ message: 'Disapproval requires written grounds.' });
      }
      await conn.query(
        `UPDATE job_requests SET 
           status = 'Rejected', 
           rejection_stage = 'approver', 
           rejection_remarks = ?, 
           campus_admin_remarks = ? 
         WHERE id = ?`,
        [remarks.trim(), remarks.trim(), req.params.id]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Rejected", ?, ?)',
        [req.params.id, jr.status, req.user.id, `Disapproved by Campus Administrator: ${remarks.trim()}`]
      );
      await notifyAdmins(conn, 'Request Disapproved by Campus Admin', `${jr.ticket_no} was disapproved by Campus Administrator: ${remarks.trim()}`, `/job-requests/${jr.id}`);
      await notify(conn, jr.requester_id, 'Request Disapproved', `${jr.ticket_no} was returned by Campus Administrator: ${remarks.trim()}`, `/job-requests/${jr.id}`);
      await auditLog(conn, { actorId: req.user.id, action: 'request.approver.rejected', entity: 'job_request', entityId: jr.id, details: remarks.trim() });
      await conn.commit();
      return res.json({ message: 'Request disapproved and returned through Admin to requester.', status: 'Rejected' });
    }
  } catch (err) {
    await conn.rollback();
    console.error('POST /approver-action error:', err);
    res.status(500).json({ message: 'Failed to process approver action.' });
  } finally {
    conn.release();
  }
});

// Step 4: POST /api/job-requests/:id/assign-technician
router.post('/:id/assign-technician', requireRole('admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { assignedTo, trackingNo, scheduledDate } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ message: 'Maintenance personnel assignment is required.' });
    }
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    const officialTracking = trackingNo || jr.official_tracking_no || `TRK-${new Date().getFullYear()}-${String(jr.id).padStart(4, '0')}`;

    await conn.query(
      `UPDATE job_requests SET 
         assigned_to = ?, 
         official_tracking_no = ?, 
         scheduled_date = COALESCE(?, scheduled_date, CURDATE()), 
         status = 'Ongoing' 
       WHERE id = ?`,
      [assignedTo, officialTracking, scheduledDate || null, req.params.id]
    );

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Ongoing", ?, ?)',
      [req.params.id, jr.status, req.user.id, `Tracking ${officialTracking} generated and assigned to personnel ID ${assignedTo}`]
    );

    await notify(
      conn,
      assignedTo,
      'Work Order Assigned',
      `You have been assigned to ${jr.ticket_no} (Tracking: ${officialTracking}). Work is now Ongoing.`,
      `/job-requests/${jr.id}`
    );

    await notify(
      conn,
      jr.requester_id,
      'Maintenance Personnel Dispatched',
      `Your request ${jr.ticket_no} (Tracking: ${officialTracking}) has been assigned to PDAS maintenance staff and is now Ongoing.`,
      `/job-requests/${jr.id}`
    );

    await auditLog(conn, { actorId: req.user.id, action: 'request.assigned', entity: 'job_request', entityId: jr.id, details: `Tracking: ${officialTracking}, Assignee: ${assignedTo}` });
    await conn.commit();
    res.json({ message: 'Tracking number generated and maintenance personnel assigned. Status is now Ongoing.', officialTrackingNo: officialTracking, status: 'Ongoing' });
  } catch (err) {
    await conn.rollback();
    console.error('POST /assign-technician error:', err);
    res.status(500).json({ message: 'Failed to assign maintenance personnel.' });
  } finally {
    conn.release();
  }
});

// Step 4: POST /api/job-requests/:id/replacement-flag
router.post('/:id/replacement-flag', requireRole('maintenance', 'technician', 'admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { reason, itemSpecs } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Reason for replacement and disposal flag is required.' });
    }
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    await conn.query(
      `UPDATE job_requests SET 
         is_replacement_flagged = 1, 
         replacement_reason = ?, 
         replacement_item_specs = ?, 
         replacement_procurement_status = 'Pending Procurement' 
       WHERE id = ?`,
      [reason.trim(), itemSpecs || null, req.params.id]
    );

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, jr.status, jr.status, req.user.id, `Replacement and Disposal Flag raised: ${reason.trim()}`]
    );

    await notifyAdmins(
      conn,
      '⚠️ Replacement and Disposal Flag Raised',
      `Item marked irreparable on ${jr.ticket_no} by maintenance staff: ${reason.trim()}. Initiate procurement/replacement.`,
      `/replacement-requests`
    );

    await auditLog(conn, { actorId: req.user.id, action: 'request.replacement_flag', entity: 'job_request', entityId: jr.id, details: reason.trim() });
    await conn.commit();
    res.json({ message: 'Replacement and Disposal Flag raised successfully. PDAS Admin notified.', isReplacementFlagged: true });
  } catch (err) {
    await conn.rollback();
    console.error('POST /replacement-flag error:', err);
    res.status(500).json({ message: 'Failed to raise replacement flag.' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-requests/:id/status - Status transitions with Tri-Party Notifications
router.put('/:id/status', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { status, assignedTo, scheduledDate, remarks } = req.body;
    const targetStatus = normalizeStatus(status);
    if (!targetStatus) {
      await conn.rollback();
      return res.status(400).json({ message: 'Unrecognized status. Use Pending, Under Review, Awaiting Signatures, Approved, Ongoing, Completed, or Rejected.' });
    }

    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jobRequest = rows[0];
    if (!jobRequest) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    const currentStatus = jobRequest.status;
    const role = req.user.role;

    // Single source of truth lives in utils/ticketPolicy.js (unit-tested).
    const decision = authorizeStatusChange(req.user, jobRequest, targetStatus);
    if (!decision.ok) {
      await conn.rollback();
      return res.status(decision.status).json({ message: decision.message });
    }
    // Technicians may never reassign tickets.
    if (isTech(role) && assignedTo !== undefined && assignedTo !== jobRequest.assigned_to) {
      await conn.rollback();
      return res.status(403).json({ message: 'Technicians cannot reassign tickets.' });
    }

    const completedAt = targetStatus === 'Completed' ? new Date() : jobRequest.completed_at;
    const effectiveAssignee = assignedTo !== undefined ? (assignedTo || null) : jobRequest.assigned_to;
    const approverId = ['Approved', 'Ongoing', 'Completed'].includes(targetStatus) ? (jobRequest.approved_by || req.user.id) : jobRequest.approved_by;

    await conn.query(
      `UPDATE job_requests SET
         status = ?,
         assigned_to = ?,
         approved_by = ?,
         scheduled_date = COALESCE(?, scheduled_date),
         completed_at = ?
       WHERE id = ?`,
      [targetStatus, effectiveAssignee, approverId, scheduledDate || null, completedAt, req.params.id]
    );

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, currentStatus, targetStatus, req.user.id, remarks || `Status changed to ${targetStatus}`]
    );
    await auditLog(conn, {
      actorId: req.user.id,
      action: `request.status.${targetStatus}`,
      entity: 'job_request',
      entityId: req.params.id,
      details: `${currentStatus} -> ${targetStatus}${remarks ? `: ${remarks}` : ''}`,
    });

    // ── Manuscript Section 10: TRI-PARTY NOTIFICATIONS ─────────────────────────
    // 1. Notify Requester
    await notify(
      conn,
      jobRequest.requester_id,
      `Ticket Status: ${targetStatus}`,
      `${jobRequest.ticket_no} is now "${targetStatus}". ${remarks ? `(${remarks})` : ''}`,
      `/job-requests/${req.params.id}`
    );

    // 2. Notify Assigned Maintenance Technician (if assigned)
    if (effectiveAssignee) {
      await notify(
        conn,
        effectiveAssignee,
        `Task Update: ${targetStatus}`,
        `Assigned job ${jobRequest.ticket_no} updated to "${targetStatus}".`,
        `/job-requests/${req.params.id}`
      );
    }

    // 3. Notify PDAS Admins (if action was performed by technician/requester or to keep all admins in sync)
    await notifyAdmins(
      conn,
      `Status Update: ${jobRequest.ticket_no}`,
      `${jobRequest.ticket_no} changed from "${currentStatus}" to "${targetStatus}".`,
      `/job-requests/${req.params.id}`,
      req.user.role === 'admin' ? req.user.id : null // avoid duplicate if performing admin
    );

    // Special: If Completed, trigger ISO/IEC 25010 evaluation reminder for requester
    if (targetStatus === 'Completed') {
      await notify(
        conn,
        jobRequest.requester_id,
        'Service Evaluation Available',
        `${jobRequest.ticket_no} has been completed. Please submit your ISO/IEC 25010 service quality feedback.`,
        `/job-requests/${req.params.id}`
      );
    }

    await conn.commit();
    res.json({ message: `Job request updated to ${targetStatus}.`, status: targetStatus });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /job-requests/:id/status error:', err);
    res.status(500).json({ message: 'Failed to update job request.' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-requests/:id/signed-form — PDAS Admin confirms receipt of the
// physically signed hardcopy (wet ink). Digital signatures are NOT allowed.
// Required before a ticket can move to Approved or Ongoing.
router.put('/:id/signed-form', requireRole('admin', 'campus_admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { confirmed, scanRef = '' } = req.body;
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jobRequest = rows[0];
    if (!jobRequest) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }
    if (!['Under Review', 'Awaiting Signatures'].includes(jobRequest.status)) {
      await conn.rollback();
      return res.status(422).json({ message: 'Signed-form confirmation only applies while a ticket is Under Review or Awaiting Signatures.' });
    }
    await conn.query(
      'UPDATE job_requests SET signed_form_confirmed = ?, signed_form_confirmed_by = ?, signed_form_confirmed_at = ? WHERE id = ?',
      [confirmed === false ? 0 : 1, req.user.id, new Date(), req.params.id]
    );
    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, jobRequest.status, jobRequest.status, req.user.id, confirmed === false ? 'Signed-form confirmation revoked.' : `Physically signed form confirmed${scanRef ? ` (ref: ${scanRef})` : ''}.`]
    );
    await auditLog(conn, {
      actorId: req.user.id,
      action: confirmed === false ? 'request.signedform.revoked' : 'request.signedform.confirmed',
      entity: 'job_request',
      entityId: req.params.id,
      details: String(scanRef || '').slice(0, 200),
    });
    await conn.commit();
    res.json({ message: confirmed === false ? 'Signed-form confirmation revoked.' : 'Signed form confirmed. The ticket may now proceed to approval.', signedFormConfirmed: confirmed !== false });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /job-requests/:id/signed-form error:', err);
    res.status(500).json({ message: 'Failed to confirm signed form.' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-requests/:id/complete-standard-form - Urgent requests completing full form details
router.put('/:id/complete-standard-form', async (req, res) => {
  try {
    const { immediateSupervisor, description } = req.body;
    // Ownership guard: only the requester (or PDAS Admin) may complete the form.
    const [ownerRows] = await pool.query('SELECT requester_id FROM job_requests WHERE id = ?', [req.params.id]);
    if (ownerRows.length === 0) {
      return res.status(404).json({ message: 'Job request not found.' });
    }
    if (!isPrivileged(req.user.role) && ownerRows[0].requester_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the requester or PDAS Admin can complete this form.' });
    }
    if (description && String(description).length > 5000) {
      return res.status(400).json({ message: 'description must be 5000 characters or fewer.' });
    }
    if (immediateSupervisor && String(immediateSupervisor).length > 150) {
      return res.status(400).json({ message: 'immediateSupervisor must be 150 characters or fewer.' });
    }
    const [result] = await pool.query(
      `UPDATE job_requests SET
         is_standard_form_filled = TRUE,
         immediate_supervisor = COALESCE(?, immediate_supervisor),
         description = COALESCE(?, description)
       WHERE id = ?`,
      [immediateSupervisor || null, description || null, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Job request not found.' });
    }

    res.json({ message: 'Standard QF-PDAS-DC-01 form completed successfully for urgent request.' });
  } catch (err) {
    console.error('complete-standard-form error:', err);
    res.status(500).json({ message: 'Failed to update form.' });
  }
});

// PUT /api/job-requests/:id/replacement-flag - Flag irreparable item for procurement
router.put('/:id/replacement-flag', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { reason, itemSpecs, procurementStatus } = req.body;
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jobRequest = rows[0];
    if (!jobRequest) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }
    // Only PDAS Admin or the assigned technician may flag for replacement.
    if (!isPrivileged(req.user.role) && !(isTech(req.user.role) && jobRequest.assigned_to === req.user.id)) {
      await conn.rollback();
      return res.status(403).json({ message: 'Only PDAS Admin or the assigned technician can flag a replacement.' });
    }

    await conn.query(
      `UPDATE job_requests SET
         is_replacement_flagged = TRUE,
         replacement_reason = ?,
         replacement_item_specs = ?,
         replacement_procurement_status = ?
       WHERE id = ?`,
      [reason || 'Irreparable defect reported.', itemSpecs || 'Standard replacement unit', procurementStatus || 'Pending Purchase Request (PR)', req.params.id]
    );

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, jobRequest.status, jobRequest.status, req.user.id, `Irreparable item flagged: ${reason}`]
    );

    // Notify PDAS Admins of procurement replacement need
    await notifyAdmins(
      conn,
      '⚠️ Irreparable Item Flagged for Replacement',
      `${jobRequest.ticket_no}: Maintenance reported irreparable equipment. Procurement replacement needed.`,
      `/job-requests/${req.params.id}`
    );

    await conn.commit();
    res.json({ message: 'Replacement flag recorded.' });
  } catch (err) {
    await conn.rollback();
    console.error('replacement-flag error:', err);
    res.status(500).json({ message: 'Failed to flag replacement.' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-requests/:id/archive - Non-destructive archiving
router.put('/:id/archive', requireRole('admin'), async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE job_requests SET is_archived = TRUE, archived_at = NOW() WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Job request not found.' });
    }
    res.json({ message: 'Job request moved to long-term archive.' });
  } catch (err) {
    console.error('archive error:', err);
    res.status(500).json({ message: 'Failed to archive job request.' });
  }
});

// PUT /api/job-requests/:id/unarchive - Restore from archive
router.put('/:id/unarchive', requireRole('admin'), async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE job_requests SET is_archived = FALSE, archived_at = NULL WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Job request not found.' });
    }
    res.json({ message: 'Job request restored from archive.' });
  } catch (err) {
    console.error('unarchive error:', err);
    res.status(500).json({ message: 'Failed to restore job request.' });
  }
});

export default router;
