import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { canViewTicket, isPrivileged } from '../utils/ticketPolicy.js';

const router = Router();
router.use(verifyToken);

// POST /api/evaluations - requester rates a completed job request based on ISO/IEC 25010 (4 criteria)
router.post('/', async (req, res) => {
  try {
    const {
      jobRequestId,
      functionalSuitability,
      usability,
      reliability,
      performanceEfficiency,
      security,
      rating, // fallback single rating if passed
      comments,
      // CSM Fields (Client Satisfaction Measurement QF-HRM-15)
      consent,
      clientType,
      region,
      serviceAvailed,
      cc1,
      cc2,
      cc3,
      sqd0,
      sqd1,
      sqd2,
      sqd3,
      sqd4,
      sqd5,
      sqd6,
      sqd7,
      sqd8,
      suggestions,
      csmData
    } = req.body;

    if (!jobRequestId) {
      return res.status(400).json({ message: 'jobRequestId is required.' });
    }

    // Calculate fallback score from SQDs if ISO criteria not directly provided (0 = N/A, excluded from mean)
    const validSqd = [sqd0, sqd1, sqd2, sqd3, sqd4, sqd5, sqd6, sqd7, sqd8]
      .map(v => (v === undefined || v === null || v === '' ? NaN : Number(v)))
      .filter(v => !isNaN(v) && v >= 1 && v <= 5);
    const avgSqd = validSqd.length > 0 ? Math.round(validSqd.reduce((a, b) => a + b, 0) / validSqd.length) : 5;

    const pickScore = (primary, ratingVal, sqdVal, fallbackAvg) => {
      for (const candidate of [primary, ratingVal, sqdVal]) {
        if (candidate !== undefined && candidate !== null && candidate !== '') {
          const n = Number(candidate);
          if (!isNaN(n) && n >= 1 && n <= 5) return Math.round(n);
        }
      }
      return fallbackAvg;
    };

    const fs = Math.max(1, Math.min(5, pickScore(functionalSuitability, rating, sqd2, avgSqd)));
    const us = Math.max(1, Math.min(5, pickScore(usability, rating, sqd3, avgSqd)));
    const rel = Math.max(1, Math.min(5, pickScore(reliability, rating, sqd1, avgSqd)));
    const pe = Math.max(1, Math.min(5, pickScore(performanceEfficiency, rating, sqd4, avgSqd)));
    const sec = Math.max(1, Math.min(5, pickScore(security, rating, sqd6, avgSqd)));

    const [jobRows] = await pool.query(
      'SELECT * FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ?',
      [jobRequestId, jobRequestId, jobRequestId]
    );
    const jobRequest = jobRows[0];
    if (!jobRequest) {
      return res.status(404).json({ message: 'Job request not found.' });
    }
    if (jobRequest.status !== 'Completed' && jobRequest.status !== 'completed') {
      return res.status(400).json({ message: 'Only completed job requests can be evaluated.' });
    }
    // Ownership: strictly restrict to the original requester who filed the ticket.
    const isOriginalRequester = Boolean(
      (jobRequest.requester_id && Number(jobRequest.requester_id) === Number(req.user.id)) ||
      (jobRequest.requester_email && req.user.email && jobRequest.requester_email.toLowerCase() === req.user.email.toLowerCase()) ||
      (jobRequest.requester_name && req.user.name && jobRequest.requester_name.toLowerCase() === req.user.name.toLowerCase())
    );
    if (!isOriginalRequester) {
      return res.status(403).json({ message: 'Only the original requester who filed this job request can submit Client Satisfaction (CSM) feedback.' });
    }

    const overallRating = Math.max(1, Math.min(5, Number(rating || Math.round((fs + us + rel + pe + sec) / 5))));

    /* One evaluation per user per ticket. */
    let result;
    try {
      const csmPayload = csmData ? (typeof csmData === 'string' ? csmData : JSON.stringify(csmData)) : JSON.stringify({
        consent: consent ?? 1,
        clientType: clientType || 'Government',
        region: region || 'Region VI - Western Visayas',
        serviceAvailed: serviceAvailed || jobRequest.ticket_no,
        cc1, cc2, cc3,
        sqd: { sqd0, sqd1, sqd2, sqd3, sqd4, sqd5, sqd6, sqd7, sqd8 },
        suggestions: suggestions || comments || null
      });

      [result] = await pool.query(
        `INSERT INTO evaluations
          (job_request_id, evaluated_by, rating, functional_suitability, usability, reliability, performance_efficiency, security, comments,
           consent, client_type, region, service_availed, cc1, cc2, cc3, sqd0, sqd1, sqd2, sqd3, sqd4, sqd5, sqd6, sqd7, sqd8, suggestions, csm_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          jobRequest.id, req.user.id, overallRating, fs, us, rel, pe, sec, comments || suggestions || null,
          consent ?? 1, clientType || 'Government', region || 'Region VI - Western Visayas', serviceAvailed || jobRequest.ticket_no,
          cc1 || null, cc2 || null, cc3 || null,
          sqd0 !== undefined ? Number(sqd0) : null,
          sqd1 !== undefined ? Number(sqd1) : null,
          sqd2 !== undefined ? Number(sqd2) : null,
          sqd3 !== undefined ? Number(sqd3) : null,
          sqd4 !== undefined ? Number(sqd4) : null,
          sqd5 !== undefined ? Number(sqd5) : null,
          sqd6 !== undefined ? Number(sqd6) : null,
          sqd7 !== undefined ? Number(sqd7) : null,
          sqd8 !== undefined ? Number(sqd8) : null,
          suggestions || comments || null,
          csmPayload
        ]
      );
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'You have already submitted an evaluation for this job request.' });
      }
      // If table doesn't have the columns yet, fallback to original query
      if (err?.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('Evaluations table missing CSM columns, falling back to base columns:', err.message);
        [result] = await pool.query(
          `INSERT INTO evaluations
            (job_request_id, evaluated_by, rating, functional_suitability, usability, reliability, performance_efficiency, security, comments)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [jobRequest.id, req.user.id, overallRating, fs, us, rel, pe, sec, comments || suggestions || null]
        );
      } else {
        throw err;
      }
    }

    // Notify PDAS Admins that evaluation was submitted
    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'");
    for (const admin of admins) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
        [
          admin.id,
          'Evaluation submitted',
          `Evaluation for ${jobRequest.ticket_no} submitted with an average rating of ${((fs + us + rel + pe + sec) / 5).toFixed(1)} out of 5.`,
          `/job-requests/${jobRequest.id}`
        ]
      );
    }

    // Notify assigned technician of the client rating
    if (jobRequest.assigned_to) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
        [
          jobRequest.assigned_to,
          `Client Feedback: ${jobRequest.ticket_no}`,
          `The client submitted feedback for ${jobRequest.ticket_no} (Rating: ${((fs + us + rel + pe + sec) / 5).toFixed(1)}/5).`,
          `/job-requests/${jobRequest.id}`
        ]
      );
    }

    res.status(201).json({ message: 'Evaluation submitted.', id: result.insertId });
  } catch (err) {
    console.error('POST /evaluations error:', err);
    res.status(500).json({ message: 'Failed to submit evaluation.' });
  }
});

// GET /api/evaluations/job-request/:jobRequestId
router.get('/job-request/:jobRequestId', async (req, res) => {
  try {
    const [jrRows] = await pool.query(
      'SELECT id, requester_id, assigned_to, supervisor_id, status FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ?',
      [req.params.jobRequestId, req.params.jobRequestId, req.params.jobRequestId]
    );
    if (jrRows.length === 0) {
      return res.status(404).json({ message: 'Job request not found.' });
    }
    const realJobRequestId = jrRows[0].id;
    if (!canViewTicket(req.user, jrRows[0]) && !isPrivileged(req.user.role)) {
      return res.status(403).json({ message: 'You do not have access to this request.' });
    }

    const [rows] = await pool.query(
      `SELECT e.*, CONCAT(u.first_name, ' ', u.last_name) AS evaluated_by_name
       FROM evaluations e
       LEFT JOIN users u ON u.id = e.evaluated_by
       WHERE e.job_request_id = ? ORDER BY e.created_at DESC`,
      [realJobRequestId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /evaluations/job-request/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch evaluations.' });
  }
});

// GET /api/evaluations - all evaluations for analytics (or user's own / department's evaluations)
router.get('/', async (req, res) => {
  try {
    const isAdminLevel = ['superadmin', 'admin', 'campus_admin'].includes(req.user.role);
    const isSupervisorUser = req.user.role === 'supervisor' || Boolean(req.user.is_supervisor);
    let query = `SELECT e.*, 
              jr.ticket_no, jr.category, jr.urgency_level, jr.status AS resolution_status,
              cl.building, cl.floor, cl.room,
              CONCAT(u.first_name, ' ', u.last_name) AS evaluated_by_name
       FROM evaluations e
       LEFT JOIN job_requests jr ON jr.id = e.job_request_id
       LEFT JOIN campus_locations cl ON cl.id = jr.location_id
       LEFT JOIN users u ON u.id = e.evaluated_by
       LEFT JOIN users req_u ON req_u.id = jr.requester_id`;
    const params = [];
    if (isAdminLevel) {
      // Full campus visibility
    } else if (isSupervisorUser) {
      // Scope supervisor to their department or tickets they supervise
      query += ' WHERE e.evaluated_by = ? OR jr.requester_id = ? OR jr.supervisor_id = ? OR (req_u.department IS NOT NULL AND req_u.department = ?)';
      params.push(req.user.id, req.user.id, req.user.id, req.user.department || '');
    } else {
      query += ' WHERE e.evaluated_by = ? OR jr.requester_id = ?';
      params.push(req.user.id, req.user.id);
    }
    query += ' ORDER BY e.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /evaluations error:', err);
    res.status(500).json({ message: 'Failed to fetch all evaluations.' });
  }
});

export default router;
