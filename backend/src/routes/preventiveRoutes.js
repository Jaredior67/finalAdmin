import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { auditLog } from '../utils/auditLog.js';
import { lengthErrors, VARCHAR_LIMITS } from '../utils/wordLimit.js';
import { sendNotification } from '../utils/emailService.js';

const router = Router();
router.use(verifyToken);

// GET /api/preventive-schedules
router.get('/', requireRole('superadmin', 'admin', 'campus_admin', 'maintenance', 'technician'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pms.*, 
              CONCAT(u.first_name, ' ', u.last_name) AS assigned_tech_name,
              CONCAT(u2.first_name, ' ', u2.last_name) AS completed_by_name
       FROM preventive_maintenance_schedules pms
       LEFT JOIN users u ON u.id = pms.assigned_to
       LEFT JOIN users u2 ON u2.id = pms.completed_by
       ORDER BY pms.scheduled_date ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /preventive-schedules error:', err);
    res.status(500).json({ message: 'Failed to fetch preventive maintenance schedules.' });
  }
});

// POST /api/preventive-schedules - schedule preventive maintenance
router.post('/', requireRole('superadmin', 'admin', 'campus_admin', 'maintenance', 'technician'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { 
      title, 
      category, 
      scheduledDate, 
      timeWindow, 
      location, 
      assignedTo, 
      inChargeName,
      description,
      recurrence,
      reminderLead 
    } = req.body;
    if (!title || !category || !scheduledDate || !location) {
      return res.status(400).json({ message: 'Title, category, scheduled date, and location are required.' });
    }
    const tooLong = lengthErrors([
      ['Title', title, VARCHAR_LIMITS.scheduleTitle],
      ['Location', location, VARCHAR_LIMITS.scheduleLocation],
      ['Time window', timeWindow, VARCHAR_LIMITS.scheduleTimeWindow],
      ['Category', category, VARCHAR_LIMITS.scheduleCategory],
      ['In-charge name', inChargeName, VARCHAR_LIMITS.inChargeName]
    ]);
    if (tooLong) {
      return res.status(400).json(tooLong);
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO preventive_maintenance_schedules
        (title, category, scheduled_date, time_window, location, assigned_to, in_charge_name, status, description, recurrence, reminder_lead)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?)`,
      [
        title, 
        category, 
        scheduledDate, 
        timeWindow || '08:00 AM - 12:00 PM', 
        location, 
        assignedTo || null, 
        inChargeName || null,
        description || null,
        recurrence || 'Quarterly',
        reminderLead || '1 day before'
      ]
    );

    if (assignedTo) {
      await conn.query(
        'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
        [
          assignedTo,
          'Work scheduled',
          `"${title}" is scheduled for ${scheduledDate}, ${timeWindow || '08:00 AM - 12:00 PM'}, at ${location}.`,
          '/calendar'
        ]
      );
    }

    await auditLog(conn, {
      actorId: req.user.id,
      action: 'preventive.scheduled',
      entity: 'preventive_schedule',
      entityId: result.insertId,
      details: `Scheduled "${title}" on ${scheduledDate} at ${location}`
    });

    await conn.commit();
    res.status(201).json({ message: 'Scheduled.', id: result.insertId });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('POST /preventive-schedules error:', err);
    res.status(500).json({ message: 'Failed to schedule preventive maintenance.' });
  } finally {
    if (conn) conn.release();
  }
});

// POST /api/preventive-schedules/:id/complete - Mark preventive task as done with remarks & optional photo
router.post('/:id/complete', requireRole('superadmin', 'admin', 'campus_admin', 'maintenance', 'technician'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { remarks, photoUrl, photoName } = req.body;
    const scheduleId = req.params.id;

    if (photoUrl && typeof photoUrl === 'string' && photoUrl.length > 5 * 1024 * 1024) {
      return res.status(413).json({ message: 'The attached photo is too large. Please attach one under 5MB.' });
    }

    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT * FROM preventive_maintenance_schedules WHERE id = ? FOR UPDATE',
      [scheduleId]
    );

    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    const current = existing[0];
    const isTechUser = ['maintenance', 'technician'].includes(req.user.role);
    if (isTechUser && current.assigned_to && Number(current.assigned_to) !== Number(req.user.id)) {
      const callerName = String(req.user.name || `${req.user.first_name || ''} ${req.user.last_name || ''}`).trim().toLowerCase();
      const inCharge = String(current.in_charge_name || '').trim().toLowerCase();
      if (!inCharge || !callerName || !inCharge.includes(callerName)) {
        await conn.rollback();
        return res.status(403).json({ message: 'Only the assigned technician or an administrator may mark this preventive task as completed.' });
      }
    }

    await conn.query(
      `UPDATE preventive_maintenance_schedules SET
         status = 'Completed',
         completed_at = NOW(),
         completed_by = ?,
         completion_notes = ?,
         completion_photo = ?,
         completion_photo_name = ?
       WHERE id = ?`,
      [req.user.id, remarks || null, photoUrl || null, photoName || null, scheduleId]
    );

    await auditLog(conn, {
      actorId: req.user.id,
      action: 'preventive.completed',
      entity: 'preventive_schedule',
      entityId: scheduleId,
      details: `Marked preventive task "${current.title}" as completed`
    });

    // Generate the next schedule row when completing a recurring preventive schedule
    const rec = String(current.recurrence || '').trim();
    if (rec && !['None', 'One-time', 'Once'].includes(rec)) {
      const baseDate = current.scheduled_date ? new Date(current.scheduled_date) : new Date();
      if (!Number.isNaN(baseDate.getTime())) {
        const nextDateObj = new Date(baseDate);
        if (rec === 'Weekly') nextDateObj.setDate(nextDateObj.getDate() + 7);
        else if (rec === 'Monthly') nextDateObj.setMonth(nextDateObj.getMonth() + 1);
        else if (rec === 'Quarterly') nextDateObj.setMonth(nextDateObj.getMonth() + 3);
        else if (rec === 'Semi-Annual') nextDateObj.setMonth(nextDateObj.getMonth() + 6);
        else if (rec === 'Annual' || rec === 'Yearly') nextDateObj.setFullYear(nextDateObj.getFullYear() + 1);
        else nextDateObj.setMonth(nextDateObj.getMonth() + 3);

        const nextDateStr = nextDateObj.toISOString().slice(0, 10);
        const [dupNext] = await conn.query(
          `SELECT id FROM preventive_maintenance_schedules
           WHERE title = ? AND location = ? AND scheduled_date = ? AND status = 'Scheduled' LIMIT 1`,
          [current.title, current.location, nextDateStr]
        );
        if (dupNext.length === 0) {
          const [nextIns] = await conn.query(
            `INSERT INTO preventive_maintenance_schedules
              (title, category, scheduled_date, time_window, location, assigned_to, in_charge_name, status, description, recurrence, reminder_lead)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?)`,
            [
              current.title,
              current.category,
              nextDateStr,
              current.time_window || '08:00 AM - 12:00 PM',
              current.location,
              current.assigned_to || null,
              current.in_charge_name || null,
              current.description || null,
              current.recurrence,
              current.reminder_lead || '1 day before',
            ]
          );
          await auditLog(conn, {
            actorId: req.user.id,
            action: 'preventive.recurrence_generated',
            entity: 'preventive_schedule',
            entityId: nextIns.insertId,
            details: `Auto-generated next ${rec} occurrence of "${current.title}" on ${nextDateStr}`,
          });
        }
      }
    }

    // Notify admins that the task was marked done
    const [admins] = await conn.query(
      "SELECT id FROM users WHERE role IN ('superadmin', 'admin', 'campus_admin') AND status = 'active'"
    );
    for (const admin of admins) {
      await conn.query(
        'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
        [
          admin.id,
          'Preventive task completed',
          `"${current.title}" scheduled for ${current.scheduled_date} at ${current.location} was marked done.`,
          '/calendar'
        ]
      );
    }

    await conn.commit();
    res.json({ message: 'Task marked as completed.', id: scheduleId });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('POST /preventive-schedules/:id/complete error:', err);
    res.status(500).json({ message: 'Failed to complete preventive maintenance task.' });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /api/preventive-schedules/:id - Update status or assignment (Admin/CampusAdmin only)
router.put('/:id', requireRole('superadmin', 'admin', 'campus_admin'), async (req, res) => {
  try {
    const { 
      title, 
      category, 
      scheduledDate, 
      timeWindow, 
      location, 
      assignedTo, 
      inChargeName, 
      status,
      description,
      recurrence,
      reminderLead 
    } = req.body;

    const tooLong = lengthErrors([
      ['Title', title, VARCHAR_LIMITS.scheduleTitle],
      ['Location', location, VARCHAR_LIMITS.scheduleLocation],
      ['Time window', timeWindow, VARCHAR_LIMITS.scheduleTimeWindow],
      ['Category', category, VARCHAR_LIMITS.scheduleCategory],
      ['In-charge name', inChargeName, VARCHAR_LIMITS.inChargeName]
    ]);
    if (tooLong) return res.status(400).json(tooLong);
    const allowedStatuses = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${allowedStatuses.join(', ')}.` });
    }

    const [result] = await pool.query(
      `UPDATE preventive_maintenance_schedules SET
         title = COALESCE(?, title),
         category = COALESCE(?, category),
         scheduled_date = COALESCE(?, scheduled_date),
         time_window = COALESCE(?, time_window),
         location = COALESCE(?, location),
         assigned_to = COALESCE(?, assigned_to),
         in_charge_name = COALESCE(?, in_charge_name),
         status = COALESCE(?, status),
         description = COALESCE(?, description),
         recurrence = COALESCE(?, recurrence),
         reminder_lead = COALESCE(?, reminder_lead)
       WHERE id = ?`,
      [title, category, scheduledDate, timeWindow, location, assignedTo, inChargeName, status, description, recurrence, reminderLead, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    await auditLog(pool, {
      actorId: req.user.id,
      action: 'preventive.updated',
      entity: 'preventive_schedule',
      entityId: req.params.id,
      details: `Updated schedule ID ${req.params.id} (Status: ${status || 'unchanged'})`
    });

    res.json({ message: 'Schedule updated.' });
  } catch (err) {
    console.error('PUT /preventive-schedules/:id error:', err);
    res.status(500).json({ message: 'Failed to update schedule.' });
  }
});

// DELETE /api/preventive-schedules/:id - withdraw a schedule (Admin/CampusAdmin only)
// The calendar is add-only without this: a mistyped date had no way back out.
// The row is read first so the audit entry names what was withdrawn, and the
// read, the delete and the audit share one transaction so a failed audit cannot
// leave a schedule removed with no record of who removed it.
router.delete('/:id', requireRole('superadmin', 'admin', 'campus_admin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT title, scheduled_date FROM preventive_maintenance_schedules WHERE id = ?',
      [req.params.id]
    );
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Schedule not found.' });
    }

    await conn.query('DELETE FROM preventive_maintenance_schedules WHERE id = ?', [req.params.id]);

    await auditLog(conn, {
      actorId: req.user.id,
      action: 'preventive.removed',
      entity: 'preventive_schedule',
      entityId: req.params.id,
      details: `Removed "${existing[0].title}" scheduled for ${existing[0].scheduled_date}`
    });

    await conn.commit();
    res.json({ message: 'Schedule removed.' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('DELETE /preventive-schedules/:id error:', err);
    res.status(500).json({ message: 'Failed to remove schedule.' });
  } finally {
    if (conn) conn.release();
  }
});

/* One reminder per schedule per day.
   This used to run one "has this user already been reminded today?" query per
   row, keyed on the USER rather than the schedule. Two consequences: it was an
   N+1 over the whole window, and a technician with three schedules in the
   two-day window was notified about only the first — the other two were
   silently dropped. The set of users already reminded today is now fetched
   once, and every schedule is judged on its own. */
export async function runAutomatedPreventiveReminders() {
  try {
    const [rows] = await pool.query(
      `SELECT pms.*, u.id AS tech_id, u.email AS tech_email,
              DATEDIFF(pms.scheduled_date, CURDATE()) AS days_until
       FROM preventive_maintenance_schedules pms
       INNER JOIN users u ON u.id = pms.assigned_to
       WHERE pms.status = 'Scheduled'
         AND pms.scheduled_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`
    );
    if (rows.length === 0) return;

    const leadDaysFor = (leadStr) => {
      const s = String(leadStr || '').toLowerCase();
      if (s.includes('week') || s.includes('7')) return 7;
      if (s.includes('3')) return 3;
      if (s.includes('2')) return 2;
      return 1;
    };

    const dueRows = rows.filter((r) => Number(r.days_until) <= leadDaysFor(r.reminder_lead));
    if (dueRows.length === 0) return;

    const techIds = [...new Set(dueRows.map((r) => r.tech_id))];
    const [already] = await pool.query(
      `SELECT user_id, message FROM notifications
        WHERE user_id IN (?)
          AND title LIKE '%Upcoming Preventive Maintenance%'
          AND created_at >= CURDATE()`,
      [techIds]
    );
    const remindedToday = new Set();
    for (const notif of already) {
      for (const s of dueRows) {
        if (notif.user_id === s.tech_id && String(notif.message || '').includes(`"${s.title}"`)) {
          remindedToday.add(`${s.tech_id}:${s.id}`);
        }
      }
    }

    for (const schedule of dueRows) {
      const key = `${schedule.tech_id}:${schedule.id}`;
      if (remindedToday.has(key)) {
        continue;
      }
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
        [
          schedule.tech_id,
          'Upcoming Preventive Maintenance Reminder',
          `"${schedule.title}" is scheduled for ${schedule.scheduled_date} (${schedule.time_window}) at ${schedule.location}.`,
          '/calendar'
        ]
      );
      remindedToday.add(key);
      console.log(`[reminder] Sent approaching preventive reminder for "${schedule.title}" to tech ID ${schedule.tech_id}`);

      if (schedule.tech_email) {
        sendNotification({
          to: schedule.tech_email,
          subject: `Upcoming Preventive Maintenance: ${schedule.title}`,
          text: `Reminder: "${schedule.title}" is scheduled for ${schedule.scheduled_date} (${schedule.time_window}) at ${schedule.location}.`,
          html: `<p>Hello,</p>
            <p>This is an automated reminder from FixIT that you have an upcoming preventive maintenance assignment:</p>
            <table style="font-size:13px;border-collapse:collapse;width:100%">
              <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600;width:30%">Task</td><td style="padding:6px 12px">${schedule.title}</td></tr>
              <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">Date</td><td style="padding:6px 12px">${schedule.scheduled_date} (${schedule.time_window})</td></tr>
              <tr><td style="padding:6px 12px;background:#f8fafc;font-weight:600">Location</td><td style="padding:6px 12px">${schedule.location}</td></tr>
            </table>
            <p style="margin-top:16px"><a href="${process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173'}/maintenance-dashboard" style="background:#1e40af;color:#fff;text-decoration:none;padding:8px 16px;border-radius:4px;font-size:13px">View in FixIT</a></p>`
        }).catch((e) => console.warn('[reminder] Email reminder failed:', e.message));
      }
    }
  } catch (err) {
    console.warn('[reminder] Error running preventive maintenance reminder scan:', err.message);
  }
}

export default router;
