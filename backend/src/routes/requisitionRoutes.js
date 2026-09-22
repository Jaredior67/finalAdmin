import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { auditLog } from '../utils/auditLog.js';

const router = Router();
router.use(verifyToken);

// --- Phase 2: server-side ticket lifecycle ---------------------------------
// Allowed forward transitions. Completed and Rejected are terminal.
const TRANSITIONS = {
  'Pending': ['Under Review', 'Rejected'],
  'Under Review': ['Awaiting Signatures', 'Rejected'],
  'Awaiting Signatures': ['Approved', 'Rejected'],
  'Approved': ['Ongoing', 'Rejected'],
  'Ongoing': ['Completed'],
  'Completed': [],
  'Rejected': [],
};

const isPrivileged = (role) => role === 'admin' || role === 'campus_admin';
const isTech = (role) => role === 'maintenance' || role === 'technician';

// Ownership / visibility: admins see all; technicians see assigned;
// faculty/staff see only their own requests (blocks IDOR).
function canViewTicket(user, row) {
  if (isPrivileged(user.role)) return true;
  if (isTech(user.role)) return row.assigned_to === user.id;
  return row.requester_id === user.id;
}

async function generateTicketNo(conn) {
  const year = new Date().getFullYear();
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS count FROM job_requests WHERE ticket_no LIKE ?",
    [`JR-${year}-%`]
  );
  const next = (rows[0].count || 0) + 1;
  return `JR-${year}-${String(next).padStart(4, '0')}`;
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

// Normalize urgency string to exact manuscript enums
function normalizeUrgency(u) {
  const str = String(u || '').toLowerCase();
  if (str.includes('high') || str.includes('urgent') || str.includes('emergency')) return 'High Risk';
  if (str.includes('low')) return 'Low Risk';
  return 'Medium Risk';
}

// Normalize status string to exact manuscript lifecycle statuses.
// Returns null when unrecognized so callers reject it instead of silently
// mapping it to 'Pending' (the previous fallthrough corrupted intent,
// e.g. 'On Hold' is not part of the server lifecycle).
function normalizeStatus(s) {
  const str = String(s || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (str === 'pending') return 'Pending';
  if (str === 'underreview' || str === 'review') return 'Under Review';
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
    }

    // High risk tickets prioritized first, then latest submitted
    query += ` ORDER BY 
      CASE jr.urgency_level 
        WHEN 'High Risk' THEN 1 
        WHEN 'Medium Risk' THEN 2 
        WHEN 'Low Risk' THEN 3 
        ELSE 4 
      END ASC, jr.created_at DESC`;

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

    await conn.beginTransaction();
    const ticketNo = await generateTicketNo(conn);

    const [result] = await conn.query(
      `INSERT INTO job_requests
        (ticket_no, requester_id, location_id, category, description, urgency_level, request_type, is_standard_form_filled, immediate_supervisor, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        ticketNo,
        req.user.id,
        locationId || null,
        finalCategory,
        description,
        finalUrgency,
        finalReqType,
        finalFormFilled,
        immediateSupervisor || null
      ]
    );

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, NULL, ?, ?, ?)',
      [result.insertId, 'Pending', req.user.id, finalReqType === 'Urgent Request' ? 'Urgent Request Submitted' : 'Standard Request Submitted']
    );

    // Tri-party notification: Notify PDAS Admins of new ticket
    const alertPrefix = finalUrgency === 'High Risk' ? '🚨 High Risk Facility Alert' : 'New Job Request';
    await notifyAdmins(
      conn,
      alertPrefix,
      `${ticketNo} was submitted by ${req.user.email} (${finalUrgency}).`,
      `/job-requests/${result.insertId}`
    );

    // Notify requester of successful submission
    await notify(
      conn,
      req.user.id,
      'Job Request Submitted',
      `Your request ${ticketNo} has been queued for PDAS Admin review.`,
      `/job-requests/${result.insertId}`
    );

    await conn.commit();
    await auditLog(pool, { actorId: req.user.id, action: 'request.submitted', entity: 'job_request', entityId: result.insertId, details: ticketNo });
    res.status(201).json({ message: 'Job request submitted.', id: result.insertId, ticketNo });
  } catch (err) {
    await conn.rollback();
    console.error('POST /job-requests error:', err);
    res.status(500).json({ message: 'Failed to submit job request.' });
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

    // --- Role gate: faculty/staff can never change status. Technicians may
    // only mark their own assigned ticket Completed. All other moves are admin.
    if (!isPrivileged(role)) {
      const techCompletion = isTech(role)
        && currentStatus === 'Ongoing'
        && targetStatus === 'Completed'
        && jobRequest.assigned_to === req.user.id;
      if (!techCompletion) {
        await conn.rollback();
        return res.status(403).json({ message: 'Only PDAS Admin can change ticket status (assigned technicians may only mark their own ticket Completed).' });
      }
    }
    // Technicians may never reassign tickets.
    if (isTech(role) && assignedTo !== undefined && assignedTo !== jobRequest.assigned_to) {
      await conn.rollback();
      return res.status(403).json({ message: 'Technicians cannot reassign tickets.' });
    }

    // --- Transition gate: block invalid jumps (e.g. Pending -> Completed).
    if (!(TRANSITIONS[currentStatus] || []).includes(targetStatus)) {
      await conn.rollback();
      return res.status(422).json({ message: `Cannot move a ticket from "${currentStatus}" to "${targetStatus}".` });
    }

    // --- Signed-form gate: digital signatures are NOT allowed. The official
    // PDAS form is printed and physically signed; PDAS Admin must confirm it
    // (PUT /:id/signed-form) before Approved or Ongoing.
    if ((targetStatus === 'Approved' || targetStatus === 'Ongoing') && !jobRequest.signed_form_confirmed) {
      await conn.rollback();
      return res.status(422).json({ message: 'The physically signed PDAS form must be confirmed by PDAS Admin before approval or dispatch.' });
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
    const { immediateSupervisor, description, scopeOfWorks } = req.body;
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
