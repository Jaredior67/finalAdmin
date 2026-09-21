import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

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

// Normalize status string to exact manuscript lifecycle statuses
function normalizeStatus(s) {
  const str = String(s || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (str === 'pending') return 'Pending';
  if (str === 'underreview' || str === 'review') return 'Under Review';
  if (str === 'awaitingsignatures' || str === 'awaiting') return 'Awaiting Signatures';
  if (str === 'approved') return 'Approved';
  if (str === 'ongoing' || str === 'inprogress') return 'Ongoing';
  if (str === 'completed' || str === 'resolved') return 'Completed';
  if (str === 'rejected' || str === 'cancelled') return 'Rejected';
  return 'Pending';
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
        category || 'other',
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

    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jobRequest = rows[0];
    if (!jobRequest) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    const currentStatus = jobRequest.status;
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

// PUT /api/job-requests/:id/complete-standard-form - Urgent requests completing full form details
router.put('/:id/complete-standard-form', async (req, res) => {
  try {
    const { immediateSupervisor, description, scopeOfWorks } = req.body;
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
