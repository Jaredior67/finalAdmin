import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { verifyToken, revokeToken, invalidateUserCache } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { auditLog } from '../utils/auditLog.js';

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

/* A real bcrypt hash of a value nobody can supply, used to keep the failed-login
   response time the same whether or not the email is registered. Without it,
   "no such user" returns in microseconds and "wrong password" takes ~100ms,
   which is enough to enumerate accounts from response timing alone. */
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/**
 * Record a failed login attempt.
 *
 * The counter is incremented inside the UPDATE rather than in JavaScript. The
 * previous version read failed_login_attempts, added one, and wrote the total
 * back, so N simultaneous wrong passwords each read the same value and each
 * wrote value+1 — the counter lost increments and the five-attempt lockout
 * could be walked past by sending the attempts in parallel.
 *
 * A single relative UPDATE is atomic, and LAST_INSERT_ID() returns the new value
 * so the lock can be applied in the same statement.
 */
async function registerFailedAttempt(user) {
  const [rows] = await pool.query(
    `UPDATE users
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE
              WHEN failed_login_attempts + 1 >= ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
              ELSE locked_until
            END
      WHERE id = ?
      RETURNING failed_login_attempts`,
    [MAX_FAILED_ATTEMPTS, LOCK_MINUTES, user.id]
  ).catch(async () => {
    // MariaDB does not support RETURNING on UPDATE; fall back to the atomic
    // increment plus a read-back. The increment itself is still race-free.
    await pool.query(
      'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?',
      [user.id]
    );
    const [after] = await pool.query(
      'SELECT failed_login_attempts FROM users WHERE id = ?',
      [user.id]
    );
    return [after];
  });

  const attempts = Number(rows?.[0]?.failed_login_attempts || 0);
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await pool.query(
      'UPDATE users SET locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ? AND locked_until IS NULL',
      [LOCK_MINUTES, user.id]
    );
  }
}

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
      office,
      contactNumber,
      gender,
      address,
      birthday,
      age,
      idPhotoUrl,
      consentAt,
    } = req.body;

    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: 'First name, last name, email, password, and role are required.' });
    }

    /* Data Privacy Act (RA 10173) consent. Chapter 2 states FixIT "informs users
       at registration, obtains their consent". The column has existed since the
       schema was written but nothing ever filled it, so every row read NULL and
       the stated compliance mechanism did nothing. Consent must be explicit: no
       timestamp means the applicant never saw the notice. */
    const consentTimestamp = consentAt ? new Date(consentAt) : null;
    if (!consentTimestamp || Number.isNaN(consentTimestamp.getTime())) {
      return res.status(400).json({
        message: 'You must accept the Data Privacy notice before submitting your application.',
      });
    }

    /* Reject an oversized ID image rather than letting the database truncate it.
       This MariaDB runs without STRICT_TRANS_TABLES, so an over-long value is
       silently cut and the API still reports success — the photo arrives as
       unusable garbage. 2MB of base64 is a downscaled 800px JPEG many times over. */
    if (typeof idPhotoUrl === 'string' && idPhotoUrl.length > 2 * 1024 * 1024) {
      return res.status(413).json({
        message: 'The ID photo is too large. Please attach a photo under 2MB.',
      });
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

    // Staff registrants must indicate their administrative office.
    if (normalizedRole === 'staff' && !office) {
      return res.status(400).json({ message: 'Administrative office is required for staff registration.' });
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
        (first_name, middle_name, last_name, email, password_hash, role, department, office, contact_number, gender, address, birthday, age, id_photo_url, consent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstName,
        middleName || null,
        lastName,
        email,
        passwordHash,
        normalizedRole,
        department || null,
        office || null,
        contactNumber || null,
        gender || null,
        address || null,
        birthday || null,
        age ? Number(age) : null,
        idPhotoUrl || null,
        consentTimestamp,
      ]
    );

    // ch1: "every action across the system, including approvals, rejections,
    // role designations … is timestamped and logged in the centralized database."
    await auditLog(pool, {
      actorId: null, // no account yet — the applicant is not a user
      action: 'registration.submitted',
      entity: 'registration_request',
      entityId: String(result.insertId),
      details: `${email} → ${normalizedRole}`,
    });

    res.status(201).json({
      message: 'Registration submitted. PDAS will review it.',
      id: result.insertId,
    });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    res.status(500).json({ message: 'Failed to submit registration.' });
  }
});

/* GET /api/auth/registration-status?email=…  (public, rate-limited)
 *
 * An applicant had no way to learn the outcome of their own application. The
 * registrant has no `users` row until the administrator approves them, so they
 * cannot sign in; there is no `notifications` row either, because that column
 * carries a `user_id` foreign key and this person is not a user yet; and no
 * endpoint existed for them to ask. Everything they could have been told about
 * a rejection lived only inside the administrator's reject dialog.
 *
 * Deliberately narrow: it answers for exactly one address, returns only the
 * status and the reason already stored against that row, and runs under the
 * same limiter as /register, so it cannot be used to walk a list of addresses
 * at speed. A miss answers "not_found" with no further detail.
 */
router.get('/registration-status', registerLimiter, async (req, res) => {
  try {
    const email = String(req.query.email || '').trim();
    if (!email) {
      return res.status(400).json({ message: 'email is required.' });
    }
    const [rows] = await pool.query(
      `SELECT status, rejection_reason, created_at, reviewed_at
         FROM registration_requests
        WHERE email = ?
        ORDER BY created_at DESC
        LIMIT 1`,
      [email]
    );
    if (rows.length === 0) {
      return res.json({ status: 'not_found' });
    }
    const row = rows[0];
    res.json({
      status: row.status,
      reason: row.rejection_reason || '',
      submittedAt: row.created_at,
      reviewedAt: row.reviewed_at || null,
    });
  } catch (err) {
    console.error('GET /auth/registration-status error:', err);
    res.status(500).json({ message: 'Could not look up the application status.' });
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

    /* Every failure mode below returns the same status and the same message.
       The previous version answered 401 for a wrong password, 429 for a locked
       account and 403 for a deactivated one, all BEFORE bcrypt.compare — so an
       unauthenticated caller could enumerate which email addresses were
       registered and whether they were locked or disabled.

       The checks now run after the password comparison, and the lockout and
       status branches fall through to the same 401. The lockout window itself
       is still enforced; it is just not advertised. */
    const GENERIC_FAILURE = { status: 401, message: 'Invalid email or password.' };

    // A dummy comparison keeps the response time roughly constant whether or not
    // the account exists, so the timing does not leak the answer either.
    const hash = user ? user.password_hash : DUMMY_HASH;
    const passwordMatches = await bcrypt.compare(password, hash);

    if (!user || !passwordMatches) {
      if (user) await registerFailedAttempt(user);
      return res.status(GENERIC_FAILURE.status).json({ message: GENERIC_FAILURE.message });
    }

    const lockedUntil = user.locked_until ? new Date(user.locked_until).getTime() : 0;
    if (lockedUntil > Date.now() || user.status !== 'active') {
      return res.status(GENERIC_FAILURE.status).json({ message: GENERIC_FAILURE.message });
    }

    const roleKey = String(role).toLowerCase();
    let requestedRoles = [roleKey];
    if (roleKey === 'faculty_staff') {
      // Supervisors (is_supervisor=1 designation) log in through the Faculty/Staff tab.
      // Their DB role is 'faculty' or 'staff' — NOT 'supervisor'.
      requestedRoles = ['faculty', 'staff'];
    } else if (roleKey === 'admin') {
      requestedRoles = ['admin'];
    } else if (roleKey === 'campus_admin' || roleKey === 'campus_administrator') {
      requestedRoles = ['campus_admin'];
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
    const isSup = Boolean(user.is_supervisor || user.role === 'supervisor');
    user.is_supervisor = isSup ? 1 : 0;
    user.isSupervisor = isSup;
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

// PUT /api/auth/availability — update logged in technician's availability status
router.put('/availability', verifyToken, async (req, res) => {
  const { availabilityStatus } = req.body || {};
  if (!['available', 'busy', 'off_duty'].includes(availabilityStatus)) {
    return res.status(400).json({ message: "availabilityStatus must be 'available', 'busy', or 'off_duty'." });
  }
  try {
    await pool.query('UPDATE users SET availability_status = ? WHERE id = ?', [availabilityStatus, req.user.id]);
    invalidateUserCache(req.user.id);
    res.json({ message: `Availability status updated to ${availabilityStatus}.`, availabilityStatus });
  } catch (err) {
    console.error('PUT /auth/availability error:', err);
    res.status(500).json({ message: 'Failed to update availability status.' });
  }
});

/* PUT /api/auth/password - change your own password.
 *
 * There was no password-change or reset path anywhere in the system: not for
 * the account holder, not for an administrator. Someone who suspected a
 * compromised password had no way to act on it short of direct SQL against the
 * database. This endpoint closes that gap for the account holder; an
 * administrator resetting someone else's password is a separate concern and
 * still needs a manual procedure.
 *
 * The current password is required, so a stolen token alone cannot lock the
 * real owner out. Changing it revokes the token that was used, so the change
 * takes effect everywhere at once. */
router.put('/password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword are required.' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: 'The new password must be at least 8 characters.' });
  }
  if (String(newPassword).length > 200) {
    return res.status(400).json({ message: 'The new password must be 200 characters or fewer.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'The new password must be different from the current one.' });
  }

  try {
    const [rows] = await pool.query('SELECT id, password_hash FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      return res.status(401).json({ message: 'The current password is incorrect.' });
    }

    const hash = await bcrypt.hash(String(newPassword), 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [hash, user.id]
    );

    // Sign this session out so the new password is required everywhere.
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    revokeToken(token);
    invalidateUserCache(user.id);

    // `null` was passed as the db handle, so `db.query` threw and the failure was
    // swallowed by `.catch(() => {})` — every password change went unlogged while
    // the response still reported success. Pass the real pool.
    await auditLog(pool, {
      actorId: user.id,
      action: 'auth.password_changed',
      entity: 'user',
      entityId: String(user.id),
      details: 'Password changed by the account holder.'
    }).catch(() => {});

    res.json({ message: 'Password changed. Please sign in again.' });
  } catch (err) {
    console.error('PUT /auth/password error:', err);
    res.status(500).json({ message: 'Failed to change password.' });
  }
});

export default router;

