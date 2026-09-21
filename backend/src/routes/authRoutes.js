import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const router = Router();

// POST /api/auth/register
// Self-registration is allowed strictly for faculty and staff members only.
// Submissions await PDAS Admin approval.
router.post('/register', async (req, res) => {
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
      return res.status(400).json({ message: 'First name, last name, email, password, and role are required.' });
    }

    // Manuscript compliance: Only faculty and staff can self-register.
    // Maintenance personnel and admin accounts must be created directly by administrators.
    const normalizedRole = String(role).toLowerCase();
    if (!['faculty', 'staff'].includes(normalizedRole)) {
      return res.status(403).json({
        message: 'Self-registration is only available for Faculty and Administrative Staff. Maintenance personnel accounts are issued directly by the PDAS Administrator.',
      });
    }

    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    const [existingRequests] = await pool.query(
      "SELECT id FROM registration_requests WHERE email = ? AND status = 'pending'",
      [email]
    );
    if (existingUsers.length > 0 || existingRequests.length > 0) {
      return res.status(409).json({ message: 'An account or pending registration request already exists for this email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO registration_requests
        (first_name, middle_name, last_name, email, password_hash, role, department, contact_number, gender, address, birthday, age, id_photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstName,
        middleName || null,
        lastName,
        email,
        passwordHash,
        normalizedRole,
        department || null,
        contactNumber || null,
        gender || null,
        address || null,
        birthday || null,
        age ? Number(age) : null,
        idPhotoUrl || null,
      ]
    );

    res.status(201).json({
      message: 'Registration submitted successfully. The PDAS Administrator will review your credentials and valid ID.',
      id: result.insertId,
    });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    res.status(500).json({ message: 'Failed to submit registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ message: 'email, password, and role are required.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact the PDAS office.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const roleKey = String(role).toLowerCase();
    let requestedRoles = [roleKey];
    if (roleKey === 'faculty_staff') {
      requestedRoles = ['faculty', 'staff'];
    } else if (roleKey === 'admin') {
      requestedRoles = ['admin', 'campus_admin'];
    } else if (roleKey === 'campus_admin' || roleKey === 'campus_administrator') {
      requestedRoles = ['campus_admin', 'admin'];
    } else if (roleKey === 'maintenance') {
      requestedRoles = ['maintenance', 'technician'];
    }

    if (!requestedRoles.includes(String(user.role).toLowerCase())) {
      return res.status(403).json({ message: `This account is not authorized for the ${role} portal.` });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'fixit_pdas_secure_jwt_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    delete user.password_hash;
    res.json({ token, user });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    res.status(500).json({ message: 'Login failed.' });
  }
});

export default router;
