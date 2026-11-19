import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { verifyToken, requireRole, invalidateUserCache } from '../middleware/auth.js';
import { auditLog } from '../utils/auditLog.js';

const router = Router();

// ── Public (any authenticated user) routes ──────────────────────────────────
// Must be registered BEFORE the admin middleware below.

// GET /api/users/supervisors/list — any logged-in user can call this.
// Faculty/Staff need it to populate the Immediate Supervisor dropdown on the
// job request form. The admin-scoped GET /supervisors route exists further
// below but is unreachable to non-admin roles.
router.get('/supervisors/list', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, middle_name, last_name, ext_name, email, department, office
       FROM users WHERE (is_supervisor = 1 OR role = 'supervisor') AND status = 'active'
       ORDER BY last_name ASC, first_name ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /users/supervisors/list error:', err);
    res.status(500).json({ message: 'Failed to fetch supervisors.' });
  }
});

// All routes below require authentication.
router.use(verifyToken);

// GET /api/users - all active accounts (accessible by superadmin and admin for technician assignment)
router.get('/', requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, middle_name, last_name, ext_name, id_number, email, role, is_supervisor, department, office, academic_rank, contact_number,
              gender, address, birthday, age, id_photo_url, status, availability_status, specialization, created_at, updated_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /users error:', err);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// GET /api/users/registrations?status=pending|approved|rejected
router.get('/registrations', requireRole('superadmin'), async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const [rows] = await pool.query(
      `SELECT id, first_name, middle_name, last_name, ext_name, id_number, email, role, department, office, contact_number,
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
router.put('/registrations/:id/approve', requireRole('superadmin'), async (req, res) => {
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
        (first_name, middle_name, last_name, ext_name, id_number, email, password_hash, role, department, office, contact_number, gender, address, birthday, age, id_photo_url, consent_at, is_supervisor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reg.first_name,
        reg.middle_name,
        reg.last_name,
        reg.ext_name ?? null,
        reg.id_number ?? null,
        reg.email,
        reg.password_hash,
        reg.role === 'supervisor' ? 'faculty' : reg.role,
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
        Boolean(reg.is_supervisor || reg.role === 'supervisor') ? 1 : 0,
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
router.put('/registrations/:id/reject', requireRole('superadmin'), async (req, res) => {
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

// POST /api/users - superadmin or admin directly creates a user
router.post('/', requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      extName,
      ext_name,
      idNumber,
      id_number,
      email,
      password,
      role,
      department,
      office,
      academicRank,
      academic_rank,
      contactNumber,
      gender,
      address,
      birthday,
      age,
      idPhotoUrl,
      specialization,
    } = req.body;

    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: 'firstName, lastName, email, password, and role are required.' });
    }

    // Role allow-list — prevents privilege escalation via crafted API body.
    // 'supervisor' is NOT a role; it is a designation flag (is_supervisor) on faculty/staff.
    const allowedRoles = ['superadmin', 'admin', 'campus_admin', 'faculty', 'staff', 'maintenance', 'technician'];
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

    const isSupervisorVal = Boolean(
      req.body.isSupervisor ||
      req.body.is_supervisor ||
      String(role).toLowerCase() === 'supervisor'
    );

    const [result] = await pool.query(
      `INSERT INTO users
        (first_name, middle_name, last_name, ext_name, id_number, email, password_hash, role, department, office, academic_rank, contact_number, gender, address, birthday, age, id_photo_url, is_supervisor, specialization, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        firstName,
        middleName || null,
        lastName,
        extName || ext_name || null,
        idNumber || id_number || null,
        email,
        passwordHash,
        String(role).toLowerCase() === 'supervisor' ? 'faculty' : role,
        department || null,
        office || null,
        academicRank || academic_rank || null,
        contactNumber || null,
        gender || null,
        address || null,
        birthday || null,
        age ? Number(age) : null,
        idPhotoUrl || null,
        isSupervisorVal ? 1 : 0,
        specialization || null,
      ]
    );

    await auditLog(pool, {
      actorId: req.user.id,
      action: 'user.created',
      entity: 'user',
      entityId: String(result.insertId),
      details: `${email} (${role})`,
    });

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
router.get('/supervisors', requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, middle_name, last_name, email, department, office, status
       FROM users WHERE (is_supervisor = 1 OR role = 'supervisor') AND status = 'active'
       ORDER BY last_name ASC, first_name ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /users/supervisors error:', err);
    res.status(500).json({ message: 'Failed to fetch supervisors.' });
  }
});

// GET /api/users/supervisor-assignments — supervisors with their assigned employees, plus unassigned warning list
router.get('/supervisor-assignments', requireRole('superadmin'), async (req, res) => {
  try {
    const [supervisors] = await pool.query(
      `SELECT id, TRIM(CONCAT(first_name, ' ', last_name, ' ', COALESCE(ext_name, ''))) AS name, email, department, office
       FROM users WHERE is_supervisor = 1 AND status = 'active' ORDER BY last_name ASC`
    );
    const [employees] = await pool.query(
      `SELECT u.id, TRIM(CONCAT(u.first_name, ' ', u.last_name, ' ', COALESCE(u.ext_name, ''))) AS name, u.email,
              u.department, u.office, u.supervisor_id,
              TRIM(CONCAT(s.first_name, ' ', s.last_name, ' ', COALESCE(s.ext_name, ''))) AS supervisor_name
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

async function notify(conn, userId, title, message, link = null) {
  if (!userId) return;
  await conn.query(
    'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
    [userId, title, message, link]
  );
}

async function notifyMany(conn, userIds, title, message, link = null) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  const placeholders = unique.map(() => '(?, ?, ?, ?)').join(', ');
  const values = unique.flatMap((id) => [id, title, message, link]);
  await conn.query(
    `INSERT INTO notifications (user_id, title, message, link) VALUES ${placeholders}`,
    values
  );
}

// PUT /api/users/bulk-assign-supervisor — assign one supervisor to a whole department/office
router.put('/bulk-assign-supervisor', requireRole('superadmin'), async (req, res) => {
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
      "SELECT id, first_name, last_name, is_supervisor FROM users WHERE id = ? AND status = 'active'",
      [supervisorId]
    );
    if (!supRows[0] || !supRows[0].is_supervisor) {
      await conn.rollback();
      return res.status(400).json({ message: 'The selected user does not have the Supervisor designation.' });
    }
    const supName = [supRows[0].first_name, supRows[0].last_name].filter(Boolean).join(' ') || 'Assigned Supervisor';

    let whereClause = "role IN ('faculty', 'staff') AND id != ? AND status = 'active'";
    const params = [supervisorId];
    if (department) { whereClause += ' AND department = ?'; params.push(department); }
    if (office)      { whereClause += ' AND office = ?';     params.push(office); }

    const [targetUsers] = await conn.query(
      `SELECT id, first_name, last_name FROM users WHERE ${whereClause}`,
      params
    );

    const [result] = await conn.query(
      `UPDATE users SET supervisor_id = ? WHERE ${whereClause}`,
      [supervisorId, ...params]
    );

    const targetGroup = department ? `Department of ${department}` : `Office of ${office}`;

    if (targetUsers.length > 0) {
      const userIds = targetUsers.map(u => u.id);
      await notifyMany(
        conn,
        userIds,
        'Immediate Supervisor Assigned',
        `${supName} has been assigned as your Immediate Supervisor for ${targetGroup}.`,
        '/settings'
      );
      await notify(
        conn,
        supervisorId,
        `Supervision Assigned: ${targetGroup}`,
        `You have been assigned as Immediate Supervisor for ${targetUsers.length} account(s) in ${targetGroup}.`,
        '/supervisor-queue'
      );
    }

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
// Superadmin can update any field. The account owner can update their own
// non-privileged fields (name, contact, photo, academicRank, etc.) but cannot
// change their own role, status, or is_supervisor flag.
router.put('/:id', verifyToken, async (req, res) => {
  const targetId = Number(req.params.id);
  const isSelf = req.user.id === targetId;
  const isSuperAdmin = req.user.role === 'superadmin';

  // Only superadmin OR the account owner may update this profile.
  if (!isSuperAdmin && !isSelf) {
    return res.status(403).json({ message: 'Forbidden.' });
  }

  try {
    const {
      firstName,
      middleName,
      lastName,
      extName,
      idNumber,
      id_number,
      department,
      office,
      academicRank,
      academic_rank,
      contactNumber,
      role,
      isSupervisor,
      is_supervisor,
      gender,
      address,
      birthday,
      age,
      idPhotoUrl,
      id_photo_url,
      specialization,
      availabilityStatus,
      availability_status,
    } = req.body;

    const finalIdNumber = idNumber !== undefined ? idNumber : id_number;
    const finalPhotoUrl = idPhotoUrl !== undefined ? idPhotoUrl : id_photo_url;
    const finalAcademicRank = academicRank !== undefined ? academicRank : academic_rank;

    // Self-update: block privileged fields
    const effectiveRole = isSelf && !isSuperAdmin ? undefined : role;
    const effectiveIsSupVal = isSelf && !isSuperAdmin
      ? undefined
      : (isSupervisor !== undefined ? (isSupervisor ? 1 : 0) : (is_supervisor !== undefined ? (is_supervisor ? 1 : 0) : undefined));

    const rawAvail = availabilityStatus || availability_status;
    const finalAvail = rawAvail !== undefined && rawAvail !== null ? (['available', 'busy', 'off_duty'].includes(String(rawAvail).toLowerCase()) ? String(rawAvail).toLowerCase() : null) : null;

    // Role allow-list guard — prevents privilege escalation via crafted API body.
    // 'supervisor' is NOT a role; designation is controlled via PUT /:id/supervisor-designation.
    if (effectiveRole !== undefined && effectiveRole !== null) {
      const allowedRoles = ['superadmin', 'admin', 'campus_admin', 'faculty', 'staff', 'maintenance', 'technician'];
      if (!allowedRoles.includes(String(effectiveRole).toLowerCase())) {
        return res.status(400).json({ message: `role must be one of: ${allowedRoles.join(', ')}.` });
      }
    }
    const [result] = await pool.query(
      `UPDATE users SET
         first_name = COALESCE(?, first_name),
         middle_name = COALESCE(?, middle_name),
         last_name = COALESCE(?, last_name),
         ext_name = COALESCE(?, ext_name),
         id_number = COALESCE(?, id_number),
         department = COALESCE(?, department),
         office = COALESCE(?, office),
         academic_rank = COALESCE(?, academic_rank),
         contact_number = COALESCE(?, contact_number),
         role = COALESCE(?, role),
         is_supervisor = COALESCE(?, is_supervisor),
         gender = COALESCE(?, gender),
         address = COALESCE(?, address),
         birthday = COALESCE(?, birthday),
         age = COALESCE(?, age),
         id_photo_url = COALESCE(?, id_photo_url),
         specialization = COALESCE(?, specialization),
         availability_status = COALESCE(?, availability_status)
       WHERE id = ?`,
      [firstName, middleName, lastName, extName ?? undefined, finalIdNumber, department, office, finalAcademicRank, contactNumber, effectiveRole, effectiveIsSupVal, gender, address, birthday, age, finalPhotoUrl, specialization, finalAvail, targetId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    // A role change must not wait for the caller's token to expire.
    invalidateUserCache(targetId);
    await auditLog(pool, {
      actorId: req.user.id,
      action: 'user.updated',
      entity: 'user',
      entityId: String(targetId),
      details: `Updated user profile #${targetId}`,
    });
    res.json({ message: 'User updated.' });
  } catch (err) {
    console.error('PUT /users/:id error:', err);
    res.status(500).json({ message: 'Failed to update user.' });
  }
});

// PUT /api/users/:id/status - activate/deactivate
router.put('/:id/status', requireRole('superadmin'), async (req, res) => {
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
    await auditLog(pool, {
      actorId: req.user.id,
      action: status === 'active' ? 'user.activated' : 'user.deactivated',
      entity: 'user',
      entityId: String(req.params.id),
      details: `User status set to ${status}`,
    });
    res.json({ message: `User marked ${status}.` });
  } catch (err) {
    console.error('PUT /users/:id/status error:', err);
    res.status(500).json({ message: 'Failed to update user status.' });
  }
});

// PUT /api/users/:id/availability - update technician availability (available, busy, off_duty)
router.put('/:id/availability', requireRole('superadmin', 'admin', 'maintenance', 'technician'), async (req, res) => {
  try {
    const { availabilityStatus } = req.body;
    if (!['available', 'busy', 'off_duty'].includes(availabilityStatus)) {
      return res.status(400).json({ message: "availabilityStatus must be 'available', 'busy', or 'off_duty'." });
    }
    const [result] = await pool.query('UPDATE users SET availability_status = ? WHERE id = ?', [availabilityStatus, req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    invalidateUserCache(Number(req.params.id));
    res.json({ message: `Availability status updated to ${availabilityStatus}.`, availabilityStatus });
  } catch (err) {
    console.error('PUT /users/:id/availability error:', err);
    res.status(500).json({ message: 'Failed to update user availability.' });
  }
});

// DELETE /api/users/:id — Phase 2: soft delete (deactivate) instead of hard
// delete so history, tickets, and audit trails stay intact. Reactivate via
// PUT /:id/status. The users table has no deleted flag; 'inactive' is it.
router.delete('/:id', requireRole('superadmin'), async (req, res) => {
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
router.put('/:id/supervisor-designation', requireRole('superadmin'), async (req, res) => {
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
router.put('/:id/assign-supervisor', requireRole('superadmin'), async (req, res) => {
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
    const [uRows] = await conn.query('SELECT id, first_name, last_name, role, department, office, supervisor_id FROM users WHERE id = ?', [userId]);
    if (!uRows[0]) {
      await conn.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }

    let supName = null;
    if (supervisorId !== null && supervisorId !== undefined) {
      if (Number(supervisorId) === userId) {
        await conn.rollback();
        return res.status(400).json({ message: 'A user cannot be their own supervisor.' });
      }
      // Verify the assigned supervisor actually has the designation
      const [supRows] = await conn.query(
        "SELECT id, first_name, last_name, is_supervisor FROM users WHERE id = ? AND status = 'active'",
        [supervisorId]
      );
      if (!supRows[0] || !supRows[0].is_supervisor) {
        await conn.rollback();
        return res.status(400).json({ message: 'The selected user does not have the Supervisor designation.' });
      }
      supName = [supRows[0].first_name, supRows[0].last_name].filter(Boolean).join(' ') || 'Assigned Supervisor';
    }

    const oldSupervisorId = uRows[0].supervisor_id;
    await conn.query('UPDATE users SET supervisor_id = ? WHERE id = ?', [supervisorId || null, userId]);
    invalidateUserCache(userId);

    const userName = [uRows[0].first_name, uRows[0].last_name].filter(Boolean).join(' ') || 'Employee';
    const userUnit = uRows[0].department || uRows[0].office || 'Faculty/Staff';

    if (supervisorId) {
      // 1. Notify the employee
      await notify(
        conn,
        userId,
        'Immediate Supervisor Assigned',
        `${supName} has been assigned as your Immediate Supervisor.`,
        '/settings'
      );
      // 2. Notify the supervisor
      await notify(
        conn,
        supervisorId,
        'New Supervisee Assigned',
        `${userName} (${userUnit}) has been assigned under your supervision.`,
        '/supervisor-queue'
      );
    } else {
      // Unassigned
      await notify(
        conn,
        userId,
        'Supervisor Assignment Updated',
        'Your Immediate Supervisor assignment has been updated by the Administrator.',
        '/settings'
      );
    }

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
