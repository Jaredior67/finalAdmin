import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { verifyToken, requireRole, invalidateUserCache } from '../middleware/auth.js';
import { auditLog } from '../utils/auditLog.js';

const router = Router();

// All routes below require a logged-in admin.
router.use(verifyToken, requireRole('admin'));

// GET /api/users - all active accounts
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, middle_name, last_name, email, role, is_supervisor, department, office, contact_number,
              gender, address, birthday, age, id_photo_url, status, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /users error:', err);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// GET /api/users/registrations?status=pending|approved|rejected
router.get('/registrations', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const [rows] = await pool.query(
      `SELECT id, first_name, middle_name, last_name, email, role, department, office, contact_number,
              gender, address, birthday, age, id_photo_url, status, rejection_reason, created_at, reviewed_at
       FROM registration_requests WHERE status = ? ORDER BY created_at DESC`,
      [status]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /users/registrations error:', err);
    res.status(500).json({ message: 'Failed to fetch registration requests.' });
  }
});

// PUT /api/users/registrations/:id/approve
router.put('/registrations/:id/approve', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT * FROM registration_requests WHERE id = ? AND status = 'pending' FOR UPDATE",
      [req.params.id]
    );
    const reg = rows[0];
    if (!reg) {
      await conn.rollback();
      return res.status(404).json({ message: 'Pending registration request not found.' });
    }

    const [result] = await conn.query(
      `INSERT INTO users
        (first_name, middle_name, last_name, email, password_hash, role, department, office, contact_number, gender, address, birthday, age, id_photo_url, consent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reg.first_name,
        reg.middle_name,
        reg.last_name,
        reg.email,
        reg.password_hash,
        reg.role,
        reg.department,
        reg.office,
        reg.contact_number,
        reg.gender,
        reg.address,
        reg.birthday,
        reg.age,
        reg.id_photo_url,
        // Carried across so the account keeps the RA 10173 consent timestamp
        // the registrant gave. NULL stays NULL: consent cannot be invented.
        reg.consent_at ?? null,
      ]
    );

    await conn.query(
      "UPDATE registration_requests SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [req.user.id, reg.id]
    );

    // Create confirmation notification for the newly approved user
    await conn.query(
      'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
      [
        result.insertId,
        'Account Approved by PDAS Admin',
        'Your institutional registration has been verified and activated. You can now access the FixIT portal.',
        '/dashboard',
      ]
    );

    // ch1: "every action across the system, including approvals, rejections,
    // role designations … is timestamped and logged in the centralized database."
    await auditLog(conn, {
      actorId: req.user.id,
      action: 'registration.approved',
      entity: 'registration_request',
      entityId: reg.id,
      details: `${reg.email} → ${reg.role}`,
    });

    await conn.commit();
    res.json({ message: 'Registration approved.', userId: result.insertId });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /users/registrations/:id/approve error:', err);
    res.status(500).json({ message: 'Failed to approve registration.' });
  } finally {
    conn.release();
  }
});

// PUT /api/users/registrations/:id/reject
router.put('/registrations/:id/reject', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { reason } = req.body;
    const [rows] = await conn.query(
      "SELECT id, email, role FROM registration_requests WHERE id = ? AND status = 'pending' FOR UPDATE",
      [req.params.id]
    );
    const reg = rows[0];
    if (!reg) {
      await conn.rollback();
      return res.status(404).json({ message: 'Pending registration not found.' });
    }

    await conn.query(
      `UPDATE registration_requests
       SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [reason || 'Application rejected by administrator.', req.user.id, reg.id]
    );

    /* The applicant has no `users` row yet, so there is nowhere to put a
       `notifications` entry (user_id is a foreign key) and no account to log in
       with. Their outcome reaches them through the registration-status screen,
       which reads `rejection_reason`. What was missing entirely — and what the
       manuscript requires — is the timestamped audit entry for the decision. */
    await auditLog(conn, {
      actorId: req.user.id,
      action: 'registration.rejected',
      entity: 'registration_request',
      entityId: reg.id,
      details: `${reg.email} → ${reason || 'Application rejected by administrator.'}`,
    });

    await conn.commit();
    res.json({ message: 'Registration rejected.' });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /users/registrations/:id/reject error:', err);
    res.status(500).json({ message: 'Failed to reject registration.' });
  } finally {
    conn.release();
  }
});

// POST /api/users - admin directly creates a user (e.g. maintenance personnel or administrator)
router.post('/', async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      email,
      password,
      role,
      department,
      office,
      contactNumber,
      gender,
      address,
      birthday,
      age,
      idPhotoUrl,
    } = req.body;

    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: 'firstName, lastName, email, password, and role are required.' });
    }

    // Role allow-list — prevents privilege escalation via crafted API body.
    // 'supervisor' is NOT a role; it is a designation flag (is_supervisor) on faculty/staff.
    const allowedRoles = ['admin', 'campus_admin', 'faculty', 'staff', 'maintenance', 'technician'];
    if (!allowedRoles.includes(String(role).toLowerCase())) {
      return res.status(400).json({ message: `role must be one of: ${allowedRoles.join(', ')}.` });
    }

    // Same password rules as self-registration.
    if (typeof password !== 'string' || password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and include a letter and a number.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users
        (first_name, middle_name, last_name, email, password_hash, role, department, office, contact_number, gender, address, birthday, age, id_photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstName,
        middleName || null,
        lastName,
        email,
        passwordHash,
        role,
        department || null,
        office || null,
        contactNumber || null,
        gender || null,
        address || null,
        birthday || null,
        age ? Number(age) : null,
        idPhotoUrl || null,
      ]
    );

    res.status(201).json({ message: 'User created.', id: result.insertId });
  } catch (err) {
    console.error('POST /users error:', err);
    res.status(500).json({ message: 'Failed to create user.' });
  }
});

// Route order note: every literal path above is registered before PUT /:id on
// purpose. Express matches in registration order, and a single-segment path
// such as "bulk-assign-supervisor" would otherwise be swallowed by PUT /:id
// (req.params.id === 'bulk-assign-supervisor'), leaving the route unreachable.

// GET /api/users/supervisors — list all Faculty/Staff users with is_supervisor=1
router.get('/supervisors', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, middle_name, last_name, email, department, office, status
       FROM users WHERE is_supervisor = 1 AND status = 'active'
       ORDER BY last_name ASC, first_name ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /users/supervisors error:', err);
    res.status(500).json({ message: 'Failed to fetch supervisors.' });
  }
});

// GET /api/users/supervisor-assignments — supervisors with their assigned employees, plus unassigned warning list
router.get('/supervisor-assignments', async (req, res) => {
  try {
    const [supervisors] = await pool.query(
      `SELECT id, CONCAT(first_name, ' ', last_name) AS name, email, department, office
       FROM users WHERE is_supervisor = 1 AND status = 'active' ORDER BY last_name ASC`
    );
    const [employees] = await pool.query(
      `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name, u.email,
              u.department, u.office, u.supervisor_id,
              CONCAT(s.first_name, ' ', s.last_name) AS supervisor_name
       FROM users u
       LEFT JOIN users s ON s.id = u.supervisor_id
       WHERE u.role IN ('faculty', 'staff') AND u.status = 'active'
       ORDER BY u.last_name ASC`
    );
    const unassigned = employees.filter(e => !e.supervisor_id);
    res.json({ supervisors, employees, unassigned });
  } catch (err) {
    console.error('GET /users/supervisor-assignments error:', err);
    res.status(500).json({ message: 'Failed to fetch supervisor assignments.' });
  }
});

// PUT /api/users/bulk-assign-supervisor — assign one supervisor to a whole department/office
router.put('/bulk-assign-supervisor', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { supervisorId, department, office } = req.body;
    if (!supervisorId) {
      await conn.rollback();
      return res.status(400).json({ message: 'supervisorId is required.' });
    }
    if (!department && !office) {
      await conn.rollback();
      return res.status(400).json({ message: 'department or office is required for bulk assignment.' });
    }

    // Verify supervisor designation
    const [supRows] = await conn.query(
      'SELECT id, is_supervisor FROM users WHERE id = ? AND status = \'active\'',
      [supervisorId]
    );
    if (!supRows[0] || !supRows[0].is_supervisor) {
      await conn.rollback();
      return res.status(400).json({ message: 'The selected user does not have the Supervisor designation.' });
    }

    let whereClause = 'role IN (\'faculty\', \'staff\') AND id != ?';
    const params = [supervisorId];
    if (department) { whereClause += ' AND department = ?'; params.push(department); }
    if (office)      { whereClause += ' AND office = ?';     params.push(office); }

    const [result] = await conn.query(
      `UPDATE users SET supervisor_id = ? WHERE ${whereClause}`,
      [supervisorId, ...params]
    );

    await auditLog(conn, {
      actorId: req.user.id,
      action: 'user.bulk_supervisor_assigned',
      entity: 'user',
      entityId: 'bulk',
      details: JSON.stringify({ supervisorId, department, office, affectedRows: result.affectedRows })
    });

    await conn.commit();
    res.json({ message: `Supervisor assigned to ${result.affectedRows} account(s).`, affectedRows: result.affectedRows });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /users/bulk-assign-supervisor error:', err);
    res.status(500).json({ message: 'Failed to bulk-assign supervisor.' });
  } finally {
    conn.release();
  }
});

// PUT /api/users/:id - update profile fields
router.put('/:id', async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      department,
      office,
      contactNumber,
      role,
      isSupervisor,
      is_supervisor,
      gender,
      address,
      birthday,
      age,
    } = req.body;

    const isSupVal = isSupervisor !== undefined ? (isSupervisor ? 1 : 0) : (is_supervisor !== undefined ? (is_supervisor ? 1 : 0) : undefined);

    // Role allow-list guard — prevents privilege escalation via crafted API body.
    // 'supervisor' is NOT a role; designation is controlled via PUT /:id/supervisor-designation.
    if (role !== undefined && role !== null) {
      const allowedRoles = ['admin', 'campus_admin', 'faculty', 'staff', 'maintenance', 'technician'];
      if (!allowedRoles.includes(String(role).toLowerCase())) {
        return res.status(400).json({ message: `role must be one of: ${allowedRoles.join(', ')}.` });
      }
    }
    const [result] = await pool.query(
      `UPDATE users SET
         first_name = COALESCE(?, first_name),
         middle_name = COALESCE(?, middle_name),
         last_name = COALESCE(?, last_name),
         department = COALESCE(?, department),
         office = COALESCE(?, office),
         contact_number = COALESCE(?, contact_number),
         role = COALESCE(?, role),
         is_supervisor = COALESCE(?, is_supervisor),
         gender = COALESCE(?, gender),
         address = COALESCE(?, address),
         birthday = COALESCE(?, birthday),
         age = COALESCE(?, age)
       WHERE id = ?`,
      [firstName, middleName, lastName, department, office, contactNumber, role, isSupVal, gender, address, birthday, age, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    // A role change must not wait for the caller's token to expire.
    invalidateUserCache(Number(req.params.id));
    res.json({ message: 'User updated.' });
  } catch (err) {
    console.error('PUT /users/:id error:', err);
    res.status(500).json({ message: 'Failed to update user.' });
  }
});

// PUT /api/users/:id/status - activate/deactivate
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: "status must be 'active' or 'inactive'." });
    }
    const [result] = await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    // Deactivation takes effect on the user's very next request rather than
    // when their token happens to expire.
    invalidateUserCache(Number(req.params.id));
    res.json({ message: `User marked ${status}.` });
  } catch (err) {
    console.error('PUT /users/:id/status error:', err);
    res.status(500).json({ message: 'Failed to update user status.' });
  }
});

// DELETE /api/users/:id — Phase 2: soft delete (deactivate) instead of hard
// delete so history, tickets, and audit trails stay intact. Reactivate via
// PUT /:id/status. The users table has no deleted flag; 'inactive' is it.
router.delete('/:id', async (req, res) => {
  let conn;
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ message: 'You cannot deactivate your own account.' });
    }
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [result] = await conn.query(
      "UPDATE users SET status = 'inactive' WHERE id = ? AND status <> 'inactive'",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'User not found or already inactive.' });
    }

    // The audit row goes in the same transaction. It used to be written through
    // the pool afterwards, so a failure there left a deactivated account with no
    // record of who did it.
    await auditLog(conn, {
      actorId: req.user.id,
      action: 'user.deactivated',
      entity: 'user',
      entityId: req.params.id
    });
    await conn.commit();
    invalidateUserCache(Number(req.params.id));

    res.json({ message: 'User deactivated.' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('DELETE /users/:id error:', err);
    res.status(500).json({ message: 'Failed to remove user.' });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /api/users/:id/supervisor-designation — toggle is_supervisor flag (admin only)
router.put('/:id/supervisor-designation', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const userId = Number(req.params.id);
    const { isSupervisor } = req.body;
    if (typeof isSupervisor !== 'boolean' && isSupervisor !== 0 && isSupervisor !== 1) {
      await conn.rollback();
      return res.status(400).json({ message: 'isSupervisor must be true or false.' });
    }
    const newVal = isSupervisor ? 1 : 0;

    // Cannot self-designate
    if (userId === req.user.id) {
      await conn.rollback();
      return res.status(400).json({ message: 'You cannot change your own supervisor designation.' });
    }

    // Fetch current state for audit
    const [rows] = await conn.query(
      'SELECT id, first_name, last_name, role, is_supervisor FROM users WHERE id = ?',
      [userId]
    );
    if (!rows[0]) {
      await conn.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }
    const target = rows[0];
    if (!['faculty', 'staff'].includes(target.role)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Supervisor designation can only be set on Faculty or Staff accounts.' });
    }

    // If removing designation, clear supervisor_id for all their supervisees
    if (!newVal && target.is_supervisor) {
      await conn.query('UPDATE users SET supervisor_id = NULL WHERE supervisor_id = ?', [userId]);
      console.log(`[supervisor] Cleared supervisees of user ${userId} (designation removed).`);
    }

    await conn.query('UPDATE users SET is_supervisor = ? WHERE id = ?', [newVal, userId]);
    invalidateUserCache(userId);

    await auditLog(conn, {
      actorId: req.user.id,
      action: newVal ? 'user.supervisor_designated' : 'user.supervisor_designation_removed',
      entity: 'user',
      entityId: String(userId),
      details: JSON.stringify({
        targetName: `${target.first_name} ${target.last_name}`,
        oldValue: target.is_supervisor ? true : false,
        newValue: Boolean(newVal),
        changedBy: req.user.name || req.user.email
      })
    });

    await conn.commit();
    res.json({ message: newVal ? 'Supervisor designation granted.' : 'Supervisor designation removed. Supervisees have been cleared.' });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /users/:id/supervisor-designation error:', err);
    res.status(500).json({ message: 'Failed to update supervisor designation.' });
  } finally {
    conn.release();
  }
});

// PUT /api/users/:id/assign-supervisor — assign/reassign a supervisor to a Faculty/Staff member
router.put('/:id/assign-supervisor', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const userId = Number(req.params.id);
    const { supervisorId } = req.body; // null to unassign

    if (userId === req.user.id && supervisorId === userId) {
      await conn.rollback();
      return res.status(400).json({ message: 'A user cannot be their own supervisor.' });
    }

    // Validate target user exists and is faculty/staff
    const [uRows] = await conn.query('SELECT id, role, supervisor_id FROM users WHERE id = ?', [userId]);
    if (!uRows[0]) {
      await conn.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }

    if (supervisorId !== null && supervisorId !== undefined) {
      if (Number(supervisorId) === userId) {
        await conn.rollback();
        return res.status(400).json({ message: 'A user cannot be their own supervisor.' });
      }
      // Verify the assigned supervisor actually has the designation
      const [supRows] = await conn.query(
        'SELECT id, is_supervisor FROM users WHERE id = ? AND status = \'active\'',
        [supervisorId]
      );
      if (!supRows[0] || !supRows[0].is_supervisor) {
        await conn.rollback();
        return res.status(400).json({ message: 'The selected user does not have the Supervisor designation.' });
      }
    }

    const oldSupervisorId = uRows[0].supervisor_id;
    await conn.query('UPDATE users SET supervisor_id = ? WHERE id = ?', [supervisorId || null, userId]);
    invalidateUserCache(userId);

    await auditLog(conn, {
      actorId: req.user.id,
      action: 'user.supervisor_assigned',
      entity: 'user',
      entityId: String(userId),
      details: JSON.stringify({
        oldSupervisorId,
        newSupervisorId: supervisorId || null,
        changedBy: req.user.name || req.user.email
      })
    });

    await conn.commit();
    res.json({ message: supervisorId ? 'Supervisor assigned.' : 'Supervisor unassigned.' });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /users/:id/assign-supervisor error:', err);
    res.status(500).json({ message: 'Failed to assign supervisor.' });
  } finally {
    conn.release();
  }
});

export default router;
