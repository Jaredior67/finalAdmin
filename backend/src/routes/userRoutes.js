import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

// All routes below require a logged-in admin.
router.use(verifyToken, requireRole('admin'));

// GET /api/users - all active accounts
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, middle_name, last_name, email, role, department, contact_number,
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
      `SELECT id, first_name, middle_name, last_name, email, role, department, contact_number,
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
        (first_name, middle_name, last_name, email, password_hash, role, department, contact_number, gender, address, birthday, age, id_photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reg.first_name,
        reg.middle_name,
        reg.last_name,
        reg.email,
        reg.password_hash,
        reg.role,
        reg.department,
        reg.contact_number,
        reg.gender,
        reg.address,
        reg.birthday,
        reg.age,
        reg.id_photo_url,
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
  try {
    const { reason } = req.body;
    const [result] = await pool.query(
      `UPDATE registration_requests
       SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [reason || 'Application rejected by administrator.', req.user.id, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pending registration not found.' });
    }
    res.json({ message: 'Registration rejected.' });
  } catch (err) {
    console.error('PUT /users/registrations/:id/reject error:', err);
    res.status(500).json({ message: 'Failed to reject registration.' });
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
        (first_name, middle_name, last_name, email, password_hash, role, department, contact_number, gender, address, birthday, age, id_photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstName,
        middleName || null,
        lastName,
        email,
        passwordHash,
        role,
        department || null,
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

// PUT /api/users/:id - update profile fields
router.put('/:id', async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      department,
      contactNumber,
      role,
      gender,
      address,
      birthday,
      age,
    } = req.body;

    const [result] = await pool.query(
      `UPDATE users SET
         first_name = COALESCE(?, first_name),
         middle_name = COALESCE(?, middle_name),
         last_name = COALESCE(?, last_name),
         department = COALESCE(?, department),
         contact_number = COALESCE(?, contact_number),
         role = COALESCE(?, role),
         gender = COALESCE(?, gender),
         address = COALESCE(?, address),
         birthday = COALESCE(?, birthday),
         age = COALESCE(?, age)
       WHERE id = ?`,
      [firstName, middleName, lastName, department, contactNumber, role, gender, address, birthday, age, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
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
    res.json({ message: `User marked ${status}.` });
  } catch (err) {
    console.error('PUT /users/:id/status error:', err);
    res.status(500).json({ message: 'Failed to update user status.' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ message: 'User removed.' });
  } catch (err) {
    console.error('DELETE /users/:id error:', err);
    res.status(500).json({ message: 'Failed to remove user.' });
  }
});

export default router;
