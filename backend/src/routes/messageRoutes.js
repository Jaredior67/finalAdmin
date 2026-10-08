import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// GET /api/messages/participants - approved users available for messaging
// This answers with id, name, email, ROLE and department for every active
// account, i.e. a full directory dump rather than a message-related read — so
// it needs the same gate as any other directory listing. Operational roles
// (admin, campus_admin, maintenance, technician) keep the compose box;
// faculty/staff, who only need to answer people already writing to them, get
// 403 instead of an enumerable account list.
router.get('/participants', requireRole('admin', 'campus_admin', 'maintenance', 'technician'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, role, department, status
       FROM users
       WHERE status = 'active'
         /* Every role in the users enum is a legitimate correspondent. This
            list omitted campus_admin, supervisor and technician, so those
            people simply did not exist as far as the compose box was
            concerned. */
         AND role IN ('admin', 'campus_admin', 'supervisor', 'faculty', 'staff', 'maintenance', 'technician')
       ORDER BY first_name ASC, last_name ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /messages/participants error:', err);
    res.status(500).json({ message: 'Failed to fetch message participants.' });
  }
});

// GET /api/messages - inbox + sent, for the logged-in user
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.*,
              CONCAT(s.first_name, ' ', s.last_name) AS sender_name,
              CONCAT(r.first_name, ' ', r.last_name) AS recipient_name
       FROM messages m
       LEFT JOIN users s ON s.id = m.sender_id
       LEFT JOIN users r ON r.id = m.recipient_id
       WHERE m.sender_id = ? OR m.recipient_id = ?
       ORDER BY m.created_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /messages error:', err);
    res.status(500).json({ message: 'Failed to fetch messages.' });
  }
});

// GET /api/messages/:id - a thread (message + replies)
router.get('/:id', async (req, res) => {
  try {
    const [msgRows] = await pool.query(
      `SELECT m.*,
              CONCAT(s.first_name, ' ', s.last_name) AS sender_name,
              CONCAT(r.first_name, ' ', r.last_name) AS recipient_name
       FROM messages m
       LEFT JOIN users s ON s.id = m.sender_id
       LEFT JOIN users r ON r.id = m.recipient_id
       WHERE m.id = ?`,
      [req.params.id]
    );
    if (msgRows.length === 0) {
      return res.status(404).json({ message: 'Message not found.' });
    }
    // Participant guard: only the sender or recipient may open a thread.
    if (msgRows[0].sender_id !== req.user.id && msgRows[0].recipient_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to view this message.' });
    }

    const [replies] = await pool.query(
      `SELECT mr.*, CONCAT(u.first_name, ' ', u.last_name) AS sender_name
       FROM message_replies mr
       LEFT JOIN users u ON u.id = mr.sender_id
       WHERE mr.message_id = ? ORDER BY mr.created_at ASC`,
      [req.params.id]
    );

    if (msgRows[0].recipient_id === req.user.id && !msgRows[0].is_read) {
      await pool.query('UPDATE messages SET is_read = TRUE WHERE id = ?', [req.params.id]);
    }

    res.json({ ...msgRows[0], replies });
  } catch (err) {
    console.error('GET /messages/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch message.' });
  }
});

// POST /api/messages - start a new thread
router.post('/', async (req, res) => {
  try {
    const { recipientId, subject, body } = req.body;
    if (!subject || !body) {
      return res.status(400).json({ message: 'subject and body are required.' });
    }
    if (String(subject).length > 200 || String(body).length > 5000) {
      return res.status(400).json({ message: 'subject must be 200 characters or fewer and body 5000 or fewer.' });
    }
    const [result] = await pool.query(
      'INSERT INTO messages (sender_id, recipient_id, subject, body) VALUES (?, ?, ?, ?)',
      [req.user.id, recipientId || null, subject, body]
    );
    res.status(201).json({ message: 'Message sent.', id: result.insertId });
  } catch (err) {
    console.error('POST /messages error:', err);
    res.status(500).json({ message: 'Failed to send message.' });
  }
});

// POST /api/messages/:id/replies
router.post('/:id/replies', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body) {
      return res.status(400).json({ message: 'body is required.' });
    }
    if (String(body).length > 5000) {
      return res.status(400).json({ message: 'Reply must be 5000 characters or fewer.' });
    }
    // Participant guard: only sender/recipient may reply (also 404s bad ids).
    const [parent] = await pool.query('SELECT sender_id, recipient_id FROM messages WHERE id = ?', [req.params.id]);
    if (parent.length === 0) {
      return res.status(404).json({ message: 'Message not found.' });
    }
    if (parent[0].sender_id !== req.user.id && parent[0].recipient_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not have permission to reply to this message.' });
    }
    const [result] = await pool.query(
      'INSERT INTO message_replies (message_id, sender_id, body) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, body]
    );
    res.status(201).json({ message: 'Reply sent.', id: result.insertId });
  } catch (err) {
    console.error('POST /messages/:id/replies error:', err);
    res.status(500).json({ message: 'Failed to send reply.' });
  }
});

export default router;
