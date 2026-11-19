import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
const contactLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

// POST /api/messages/contact - public intake from landing page Contact Us form
router.post('/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, message, subject } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Message content is required.' });
    }
    if (String(name).trim().length > 150) {
      return res.status(400).json({ message: 'Name must be 150 characters or fewer.' });
    }
    if (String(email).trim().length > 150) {
      return res.status(400).json({ message: 'Email must be 150 characters or fewer.' });
    }
    if (String(message).trim().length > 5000) {
      return res.status(400).json({ message: 'Message must be 5000 characters or fewer.' });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim();
    const cleanMessage = String(message).trim();
    const cleanSubject = (subject && String(subject).trim()) || `Public Inquiry: ${cleanName}`;

    // Find system administrator accounts
    const [admins] = await pool.query(
      `SELECT id, first_name, last_name, email FROM users WHERE role = 'admin' ORDER BY id ASC`
    );

    const targetAdminId = admins.length > 0 ? admins[0].id : null;

    // Store in messages table with NULL sender_id and contact details
    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, contact_name, contact_email, subject, body, is_read)
       VALUES (NULL, ?, ?, ?, ?, ?, FALSE)`,
      [targetAdminId, cleanName, cleanEmail, cleanSubject, cleanMessage]
    );

    // Notify all system administrators
    const preview = cleanMessage.length > 100 ? `${cleanMessage.slice(0, 97)}...` : cleanMessage;
    for (const admin of admins) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, link, is_read)
         VALUES (?, ?, ?, ?, FALSE)`,
        [
          admin.id,
          `New Contact Inquiry from ${cleanName}`,
          `Visitor ${cleanName} (${cleanEmail}) wrote: "${preview}"`,
          '/communication-box'
        ]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Message delivered to the System Administrator.',
      id: result.insertId
    });
  } catch (err) {
    console.error('POST /messages/contact error:', err);
    res.status(500).json({ message: 'Failed to deliver message to System Administrator.' });
  }
});

router.use(verifyToken);

router.get('/participants', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, role, department, status
       FROM users
       WHERE status = 'active'
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
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const [rows] = await pool.query(
      `SELECT m.*,
              COALESCE(CONCAT(s.first_name, ' ', s.last_name), m.contact_name, 'Visitor') AS sender_name,
              COALESCE(s.email, m.contact_email) AS sender_email,
              CONCAT(r.first_name, ' ', r.last_name) AS recipient_name
       FROM messages m
       LEFT JOIN users s ON s.id = m.sender_id
       LEFT JOIN users r ON r.id = m.recipient_id
       WHERE m.sender_id = ? OR m.recipient_id = ? OR (? = TRUE AND m.sender_id IS NULL)
       ORDER BY m.created_at DESC
       LIMIT 200`,
      [req.user.id, req.user.id, isAdmin]
    );

    if (rows.length > 0) {
      const msgIds = rows.map(r => r.id);
      const [replies] = await pool.query(
        `SELECT mr.*, CONCAT(u.first_name, ' ', u.last_name) AS sender_name
         FROM message_replies mr
         LEFT JOIN users u ON u.id = mr.sender_id
         WHERE mr.message_id IN (?)
         ORDER BY mr.created_at ASC`,
        [msgIds]
      );
      const replyMap = {};
      for (const rep of replies) {
        if (!replyMap[rep.message_id]) replyMap[rep.message_id] = [];
        replyMap[rep.message_id].push(rep);
      }
      for (const row of rows) {
        row.replies = replyMap[row.id] || [];
      }
    }

    res.json(rows);
  } catch (err) {
    console.error('GET /messages error:', err);
    res.status(500).json({ message: 'Failed to fetch messages.' });
  }
});

// GET /api/messages/:id - a thread (message + replies)
router.get('/:id', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const [msgRows] = await pool.query(
      `SELECT m.*,
              COALESCE(CONCAT(s.first_name, ' ', s.last_name), m.contact_name, 'Visitor') AS sender_name,
              COALESCE(s.email, m.contact_email) AS sender_email,
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
    // Participant guard: sender, recipient, or admin viewing public inquiry
    const isParticipant =
      msgRows[0].sender_id === req.user.id ||
      msgRows[0].recipient_id === req.user.id ||
      (isAdmin && msgRows[0].sender_id === null);

    if (!isParticipant) {
      return res.status(403).json({ message: 'You do not have permission to view this message.' });
    }

    const [replies] = await pool.query(
      `SELECT mr.*, CONCAT(u.first_name, ' ', u.last_name) AS sender_name
       FROM message_replies mr
       LEFT JOIN users u ON u.id = mr.sender_id
       WHERE mr.message_id = ? ORDER BY mr.created_at ASC`,
      [req.params.id]
    );

    if ((msgRows[0].recipient_id === req.user.id || (isAdmin && msgRows[0].sender_id === null)) && !msgRows[0].is_read) {
      await pool.query('UPDATE messages SET is_read = TRUE WHERE id = ?', [req.params.id]);
      msgRows[0].is_read = 1;
    }

    res.json({ ...msgRows[0], replies });
  } catch (err) {
    console.error('GET /messages/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch message.' });
  }
});

// PUT /api/messages/:id/read - mark message as read
router.put('/:id/read', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const [rows] = await pool.query('SELECT sender_id, recipient_id FROM messages WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Message not found.' });
    }
    if (rows[0].recipient_id !== req.user.id && !(isAdmin && rows[0].sender_id === null)) {
      return res.status(403).json({ message: 'You do not have permission to update this message.' });
    }
    await pool.query('UPDATE messages SET is_read = TRUE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Message marked as read.' });
  } catch (err) {
    console.error('PUT /messages/:id/read error:', err);
    res.status(500).json({ message: 'Failed to mark message as read.' });
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

    if (recipientId) {
      try {
        const senderName = [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || req.user.email || 'A user';
        await pool.query(
          'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
          [
            recipientId,
            `New Message: ${subject.slice(0, 50)}`,
            `${senderName}: ${body.slice(0, 100)}`,
            '/messages'
          ]
        );
      } catch (notifErr) {
        console.warn('Failed to create message notification:', notifErr.message);
      }
    }

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
    // Participant guard: sender, recipient, or admin replying to public message
    const [parent] = await pool.query('SELECT sender_id, recipient_id, subject FROM messages WHERE id = ?', [req.params.id]);
    if (parent.length === 0) {
      return res.status(404).json({ message: 'Message not found.' });
    }
    const isAdmin = req.user.role === 'admin';
    const isParticipant =
      parent[0].sender_id === req.user.id ||
      parent[0].recipient_id === req.user.id ||
      (isAdmin && parent[0].sender_id === null);

    if (!isParticipant) {
      return res.status(403).json({ message: 'You do not have permission to reply to this message.' });
    }
    const [result] = await pool.query(
      'INSERT INTO message_replies (message_id, sender_id, body) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, body]
    );

    const notifyUserId = parent[0].sender_id === req.user.id ? parent[0].recipient_id : parent[0].sender_id;
    if (notifyUserId) {
      try {
        const senderName = [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || req.user.email || 'A user';
        await pool.query(
          'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
          [
            notifyUserId,
            `Reply: ${String(parent[0].subject || 'Direct Message').slice(0, 45)}`,
            `${senderName}: ${body.slice(0, 100)}`,
            '/messages'
          ]
        );
      } catch (notifErr) {
        console.warn('Failed to create reply notification:', notifErr.message);
      }
    }

    res.status(201).json({ message: 'Reply sent.', id: result.insertId });
  } catch (err) {
    console.error('POST /messages/:id/replies error:', err);
    res.status(500).json({ message: 'Failed to send reply.' });
  }
});

export default router;
