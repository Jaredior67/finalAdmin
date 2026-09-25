import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// GET /api/notifications — paginated, user-scoped
// Query params: ?limit=50&offset=0&unread=true
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const unreadOnly = req.query.unread === 'true';

    let where = 'WHERE user_id = ?';
    const params = [req.user.id];
    if (unreadOnly) {
      where += ' AND is_read = FALSE';
    }

    const [rows] = await pool.query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    // Include total unread count so the bell badge stays accurate after pagination
    const [[{ unread_count }]] = await pool.query(
      'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );

    res.json({ notifications: rows, unread_count, limit, offset });
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    console.error('PUT /notifications/:id/read error:', err);
    res.status(500).json({ message: 'Failed to update notification.' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('PUT /notifications/read-all error:', err);
    res.status(500).json({ message: 'Failed to update notifications.' });
  }
});

// DELETE /api/notifications/:id — user deletes their own notification
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    res.json({ message: 'Notification deleted.' });
  } catch (err) {
    console.error('DELETE /notifications/:id error:', err);
    res.status(500).json({ message: 'Failed to delete notification.' });
  }
});

// DELETE /api/notifications — clear all of the user's notifications
router.delete('/', async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'All notifications cleared.' });
  } catch (err) {
    console.error('DELETE /notifications error:', err);
    res.status(500).json({ message: 'Failed to clear notifications.' });
  }
});

export default router;
