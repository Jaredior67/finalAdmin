import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(verifyToken);

// GET /api/preventive-schedules
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pms.*, CONCAT(u.first_name, ' ', u.last_name) AS assigned_tech_name
       FROM preventive_maintenance_schedules pms
       LEFT JOIN users u ON u.id = pms.assigned_to
       ORDER BY pms.scheduled_date ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /preventive-schedules error:', err);
    res.status(500).json({ message: 'Failed to fetch preventive maintenance schedules.' });
  }
});

// POST /api/preventive-schedules - Admin schedules preventive maintenance
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { title, category, scheduledDate, timeWindow, location, assignedTo, inChargeName } = req.body;
    if (!title || !category || !scheduledDate || !location) {
      return res.status(400).json({ message: 'Title, category, scheduled date, and location are required.' });
    }

    const [result] = await pool.query(
      `INSERT INTO preventive_maintenance_schedules
        (title, category, scheduled_date, time_window, location, assigned_to, in_charge_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled')`,
      [title, category, scheduledDate, timeWindow || '08:00 AM - 12:00 PM', location, assignedTo || null, inChargeName || null]
    );

    // Notify assigned technician immediately
    if (assignedTo) {
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
        [
          assignedTo,
          'Preventive Maintenance Scheduled',
          `You are assigned to "${title}" on ${scheduledDate} at ${location}.`,
          '/calendar'
        ]
      );
    }

    res.status(201).json({ message: 'Preventive maintenance scheduled successfully.', id: result.insertId });
  } catch (err) {
    console.error('POST /preventive-schedules error:', err);
    res.status(500).json({ message: 'Failed to schedule preventive maintenance.' });
  }
});

// PUT /api/preventive-schedules/:id - Update status or assignment
router.put('/:id', async (req, res) => {
  try {
    const { title, category, scheduledDate, timeWindow, location, assignedTo, inChargeName, status } = req.body;
    const [result] = await pool.query(
      `UPDATE preventive_maintenance_schedules SET
         title = COALESCE(?, title),
         category = COALESCE(?, category),
         scheduled_date = COALESCE(?, scheduled_date),
         time_window = COALESCE(?, time_window),
         location = COALESCE(?, location),
         assigned_to = COALESCE(?, assigned_to),
         in_charge_name = COALESCE(?, in_charge_name),
         status = COALESCE(?, status)
       WHERE id = ?`,
      [title, category, scheduledDate, timeWindow, location, assignedTo, inChargeName, status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    res.json({ message: 'Preventive maintenance schedule updated.' });
  } catch (err) {
    console.error('PUT /preventive-schedules/:id error:', err);
    res.status(500).json({ message: 'Failed to update schedule.' });
  }
});

// Function to check approaching dates and send automated reminders
export async function runAutomatedPreventiveReminders() {
  try {
    const [rows] = await pool.query(
      `SELECT pms.*, u.id AS tech_id, u.email AS tech_email
       FROM preventive_maintenance_schedules pms
       INNER JOIN users u ON u.id = pms.assigned_to
       WHERE pms.status = 'Scheduled'
         AND pms.scheduled_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)`
    );

    for (const schedule of rows) {
      // Check if reminder was already sent today
      const [existingNotifs] = await pool.query(
        `SELECT id FROM notifications
         WHERE user_id = ? AND title LIKE '%Upcoming Preventive Maintenance%'
           AND created_at >= CURDATE()`,
        [schedule.tech_id]
      );

      if (existingNotifs.length === 0) {
        await pool.query(
          'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
          [
            schedule.tech_id,
            '⏰ Upcoming Preventive Maintenance Reminder',
            `Reminder: "${schedule.title}" is scheduled for ${schedule.scheduled_date} (${schedule.time_window}) at ${schedule.location}.`,
            '/calendar'
          ]
        );
        console.log(`[reminder] Sent approaching preventive reminder for "${schedule.title}" to tech ID ${schedule.tech_id}`);
      }
    }
  } catch (err) {
    console.warn('[reminder] Error running preventive maintenance reminder scan:', err.message);
  }
}

export default router;
