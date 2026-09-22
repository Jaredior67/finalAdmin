import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { verifyToken, revokeToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
const registerLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

// Phase 2: password rules — minimum 8 chars with at least one letter and number.
function passwordError(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}

function jwtSecretOrFail(res) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('FATAL: JWT_SECRET is not set. Refusing to issue tokens.');
    res.status(500).json({ message: 'Server is misconfigured. Please contact the administrator.' });
    return null;
  }
  return secret;
}

// Account lockout policy: 5 failed attempts locks the account for 15 minutes.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// POST /api/auth/register
// Self-registration is allowed strictly for faculty and staff members only.
// Submissions await PDAS Admin approval.
router.post('/register', registerLimiter, async (req, res) => {
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

    const weakPassword = passwordError(password);
    if (weakPassword) {
      return res.status(400).json({ message: weakPassword });
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
router.post('/login', loginLimiter, async (req, res) => {
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
    // Account lockout check (generic message — never reveal lock state specifics).
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      return res.status(429).json({ message: 'Too many failed attempts. Please try again later.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact the PDAS office.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const updates = ['failed_login_attempts = ?'];
      const params = [attempts];
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        updates.push('locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)');
        params.push(LOCK_MINUTES);
      }
      params.push(user.id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
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

    // Successful login resets the failed-attempt counter.
    if (user.failed_login_attempts || user.locked_until) {
      await pool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
    }

    const secret = jwtSecretOrFail(res);
    if (!secret) return;
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    delete user.password_hash;
    res.json({ token, user });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    res.status(500).json({ message: 'Login failed.' });
  }
});

// POST /api/auth/logout — server-side session invalidation (Phase 2).
// The Bearer token is added to the revocation set; the client also discards it.
router.post('/logout', verifyToken, (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  revokeToken(token);
  res.json({ message: 'Signed out.' });
});

export default router;
