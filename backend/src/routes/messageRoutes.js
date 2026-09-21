import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// GET /api/messages/participants - approved users available for messaging
router.get('/participants', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, role, department, status
       FROM users
       WHERE status = 'active'
         AND role IN ('admin', 'faculty', 'staff', 'maintenance')
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
