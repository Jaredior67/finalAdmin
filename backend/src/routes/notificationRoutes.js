import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// GET /api/notifications — paginated, user-scoped
// Query params: ?limit=50&offset=0&unread=true&archived=true
// The default view is the active inbox; archived records are only returned when
// explicitly requested so the bell badge and inbox never show archive entries.
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const unreadOnly = req.query.unread === 'true';
    const archivedOnly = req.query.archived === 'true';

    let where = 'WHERE user_id = ? AND is_archived = ?';
    const params = [req.user.id, archivedOnly];
    if (unreadOnly && !archivedOnly) {
      where += ' AND is_read = FALSE';
    }

    const [rows] = await pool.query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    // The badge counts active unread notifications only.
    const [[{ unread_count }]] = await pool.query(
      'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE AND is_archived = FALSE',
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
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_archived = FALSE',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('PUT /notifications/read-all error:', err);
    res.status(500).json({ message: 'Failed to update notifications.' });
  }
});

// PUT /api/notifications/:id/archive — move one notification to the user's archive
router.put('/:id/archive', async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE notifications SET is_archived = TRUE, archived_at = NOW() WHERE id = ? AND user_id = ? AND is_archived = FALSE',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found or already archived.' });
    }
    res.json({ message: 'Notification archived.' });
  } catch (err) {
    console.error('PUT /notifications/:id/archive error:', err);
    res.status(500).json({ message: 'Failed to archive notification.' });
  }
});

// PUT /api/notifications/:id/unarchive — restore one notification to the inbox
router.put('/:id/unarchive', async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE notifications SET is_archived = FALSE, archived_at = NULL, is_read = TRUE WHERE id = ? AND user_id = ? AND is_archived = TRUE',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found or not archived.' });
    }
    res.json({ message: 'Notification restored to inbox.' });
  } catch (err) {
    console.error('PUT /notifications/:id/unarchive error:', err);
    res.status(500).json({ message: 'Failed to restore notification.' });
  }
});

// DELETE /api/notifications/:id — permanently delete one of the user's notifications
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
