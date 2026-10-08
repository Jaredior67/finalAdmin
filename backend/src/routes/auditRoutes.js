import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();
/* campus_admin is listed because the Campus Administrator's Approval History
   page reads this same endpoint. It was admin-only, so that page received a
   403 and rendered an empty table behind an error banner. Read-only access,
   and the role already reaches Analytics & Reports and Official Documents. */
router.use(verifyToken, requireRole('admin', 'campus_admin'));

// GET /api/audit-log — read-only accountability trail for PDAS Admin and the
// Campus Administrator.
// Newest first, capped to keep the response small.
//
// The job_requests join exists so a record can be shown against its real
// tracking number. `audit_log.details` carries the ticket number for most
// job_request actions but not for all of them, and a numeric row id means
// nothing on a page headed "Tracking Number".
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const [rows] = await pool.query(
      `SELECT a.*,
              CONCAT(u.first_name, ' ', u.last_name) AS actor_name,
              u.role AS actor_role,
              jr.ticket_no,
              jr.official_tracking_no
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       LEFT JOIN job_requests jr ON a.entity = 'job_request' AND jr.id = a.entity_id
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /audit-log error:', err);
    res.status(500).json({ message: 'Failed to fetch audit trail.' });
  }
});

export default router;
