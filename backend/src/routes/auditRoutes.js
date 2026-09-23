import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken, requireRole('admin'));

// GET /api/audit-log — read-only accountability trail for PDAS Admin.
// Newest first, capped to keep the response small.
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const [rows] = await pool.query(
      `SELECT a.*,
              CONCAT(u.first_name, ' ', u.last_name) AS actor_name,
              u.role AS actor_role
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
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
