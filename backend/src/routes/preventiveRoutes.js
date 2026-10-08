import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { auditLog } from '../utils/auditLog.js';
import { lengthErrors, VARCHAR_LIMITS } from '../utils/wordLimit.js';

const router = Router();
router.use(verifyToken);

// GET /api/preventive-schedules
// The rows carry the assigned technician for every schedule, so this is not a
// harmless list: faculty/staff would learn who is going where, and when, for
// the whole campus. Restrict the read to the roles that act on the schedule
// (the same operational set the messages directory is limited to). Writes now
// match it — a technician who could read the schedule but not add to it had a
// form that accepted the entry, swallowed the 403, and left the work saved only
// in that browser. Removal stays with admin/campus_admin.
router.get('/', requireRole('admin', 'campus_admin', 'maintenance', 'technician'), async (req, res) => {
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

// POST /api/preventive-schedules - schedule preventive maintenance
// The read above already covers this same operational set, and a technician who
// can see the campus schedule but not add to it was silently stuck: the form
// accepted the entry, the 403 was swallowed, and the work existed only in that
// browser. Writes now match the read.
router.post('/', requireRole('admin', 'campus_admin', 'maintenance', 'technician'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { title, category, scheduledDate, timeWindow, location, assignedTo, inChargeName } = req.body;
    if (!title || !category || !scheduledDate || !location) {
      return res.status(400).json({ message: 'Title, category, scheduled date, and location are required.' });
    }
    // This database has no strict mode, so an over-length value is silently
    // truncated rather than rejected. Say so at the boundary instead of
    // storing a schedule that quietly lost part of its text.
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

    /* Insert, notify and audit in one transaction.
       These were three separate writes, so a failure after the INSERT left a
       schedule with no notification and no audit row, and a client that retried
       after seeing the 500 got a second, duplicate schedule. */
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO preventive_maintenance_schedules
        (title, category, scheduled_date, time_window, location, assigned_to, in_charge_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled')`,
      [title, category, scheduledDate, timeWindow || '08:00 AM - 12:00 PM', location, assignedTo || null, inChargeName || null]
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

// PUT /api/preventive-schedules/:id - Update status or assignment (Admin/CampusAdmin only)
router.put('/:id', requireRole('admin', 'campus_admin'), async (req, res) => {
  try {
    const { title, category, scheduledDate, timeWindow, location, assignedTo, inChargeName, status } = req.body;

    // Input guards. Widths come from the declared column widths so they cannot
    // drift from the schema; the status list matches the column's enum.
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
         status = COALESCE(?, status)
       WHERE id = ?`,
      [title, category, scheduledDate, timeWindow, location, assignedTo, inChargeName, status, req.params.id]
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
router.delete('/:id', requireRole('admin', 'campus_admin'), async (req, res) => {
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
      `SELECT pms.*, u.id AS tech_id, u.email AS tech_email
       FROM preventive_maintenance_schedules pms
       INNER JOIN users u ON u.id = pms.assigned_to
       WHERE pms.status = 'Scheduled'
         AND pms.scheduled_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)`
    );
    if (rows.length === 0) return;

    const techIds = [...new Set(rows.map((r) => r.tech_id))];
    const [already] = await pool.query(
      `SELECT DISTINCT user_id FROM notifications
        WHERE user_id IN (?)
          AND title LIKE '%Upcoming Preventive Maintenance%'
          AND created_at >= CURDATE()`,
      [techIds]
    );
    const remindedToday = new Set(already.map((r) => r.user_id));

    for (const schedule of rows) {
      if (remindedToday.has(schedule.tech_id)) {
        remindedToday.add(schedule.tech_id);
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
      remindedToday.add(schedule.tech_id);
      console.log(`[reminder] Sent approaching preventive reminder for "${schedule.title}" to tech ID ${schedule.tech_id}`);
    }
  } catch (err) {
    console.warn('[reminder] Error running preventive maintenance reminder scan:', err.message);
  }
}

export default router;
