import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';

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
      rating, // fallback single rating if passed
      comments
    } = req.body;

    if (!jobRequestId) {
      return res.status(400).json({ message: 'jobRequestId is required.' });
    }

    const fs = Number(functionalSuitability || rating || 5);
    const us = Number(usability || rating || 5);
    const rel = Number(reliability || rating || 5);
    const pe = Number(performanceEfficiency || rating || 5);

    if ([fs, us, rel, pe].some(v => v < 1 || v > 5)) {
      return res.status(400).json({ message: 'All ISO/IEC 25010 ratings must be between 1 and 5.' });
    }

    const [jobRows] = await pool.query('SELECT * FROM job_requests WHERE id = ?', [jobRequestId]);
    const jobRequest = jobRows[0];
    if (!jobRequest) {
      return res.status(404).json({ message: 'Job request not found.' });
    }
    if (jobRequest.status !== 'Completed' && jobRequest.status !== 'completed') {
      return res.status(400).json({ message: 'Only completed job requests can be evaluated.' });
    }
    // Ownership: only the requester who filed the ticket may evaluate it.
    if (!['admin', 'campus_admin'].includes(req.user.role) && jobRequest.requester_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the requester can evaluate this job request.' });
    }
    // One evaluation per user per ticket.
    const [existing] = await pool.query(
      'SELECT id FROM evaluations WHERE job_request_id = ? AND evaluated_by = ?',
      [jobRequestId, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'You have already submitted an evaluation for this job request.' });
    }

    const [result] = await pool.query(
      `INSERT INTO evaluations
        (job_request_id, evaluated_by, functional_suitability, usability, reliability, performance_efficiency, comments)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [jobRequestId, req.user.id, fs, us, rel, pe, comments || null]
    );

    // Notify PDAS Admins that evaluation was submitted
    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'");
    for (const admin of admins) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
        [
          admin.id,
          'ISO/IEC 25010 Evaluation Submitted',
          `Evaluation for ${jobRequest.ticket_no} submitted with avg rating ${((fs + us + rel + pe) / 4).toFixed(1)}/5.`,
          `/job-requests/${jobRequestId}`
        ]
      );
    }

    res.status(201).json({ message: 'Evaluation submitted successfully.', id: result.insertId });
  } catch (err) {
    console.error('POST /evaluations error:', err);
    res.status(500).json({ message: 'Failed to submit evaluation.' });
  }
});

// GET /api/evaluations/job-request/:jobRequestId
router.get('/job-request/:jobRequestId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, CONCAT(u.first_name, ' ', u.last_name) AS evaluated_by_name
       FROM evaluations e
       LEFT JOIN users u ON u.id = e.evaluated_by
       WHERE e.job_request_id = ? ORDER BY e.created_at DESC`,
      [req.params.jobRequestId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /evaluations/job-request/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch evaluations.' });
  }
});

// GET /api/evaluations - all evaluations for analytics
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, 
              jr.ticket_no, jr.category, jr.urgency_level, jr.status AS resolution_status,
              cl.building, cl.floor, cl.room,
              CONCAT(u.first_name, ' ', u.last_name) AS evaluated_by_name
       FROM evaluations e
       LEFT JOIN job_requests jr ON jr.id = e.job_request_id
       LEFT JOIN campus_locations cl ON cl.id = jr.location_id
       LEFT JOIN users u ON u.id = e.evaluated_by
       ORDER BY e.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /evaluations error:', err);
    res.status(500).json({ message: 'Failed to fetch all evaluations.' });
  }
});

export default router;
