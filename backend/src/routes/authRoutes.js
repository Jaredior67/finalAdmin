import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/db.js';
import { verifyToken, revokeToken, invalidateUserCache } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { auditLog } from '../utils/auditLog.js';
import { sendPasswordResetOtpEmail, sendPasswordResetSuccessEmail } from '../utils/emailService.js';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
const registerLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
const otpLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });

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
  await pool.query(
    `UPDATE users
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE
              WHEN failed_login_attempts + 1 >= ? THEN COALESCE(locked_until, DATE_ADD(NOW(), INTERVAL ? MINUTE))
              ELSE locked_until
            END
      WHERE id = ?`,
    [MAX_FAILED_ATTEMPTS, LOCK_MINUTES, user.id]
  );
  const [rows] = await pool.query(
    'SELECT failed_login_attempts FROM users WHERE id = ?',
    [user.id]
  );

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
      extName,
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

    const idNumber = req.body.idNumber || req.body.id_number || req.body.idNo || null;

    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: 'First name, last name, email, password, and role are required.' });
    }
    if (!idNumber || !String(idNumber).trim()) {
      return res.status(400).json({ message: 'ID number is required.' });
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
        message: 'The profile photo is too large. Please attach a photo under 2MB.',
      });
    }

    const weakPassword = passwordError(password);
    if (weakPassword) {
      return res.status(400).json({ message: weakPassword });
    }

    // Manuscript compliance: Only faculty and staff can self-register.
    // Maintenance personnel and admin accounts must be created directly by administrators.
    let normalizedRole = String(role || '').trim().toLowerCase();
    const isSupervisor = Boolean(
      req.body.isSupervisor ||
      req.body.is_supervisor ||
      String(req.body.userType || '').toLowerCase() === 'supervisor' ||
      ['supervisor', 'immediate supervisor', 'dept head', 'department head'].includes(normalizedRole)
    );

    if (['supervisor', 'immediate supervisor', 'dept head', 'department head', 'faculty member', 'teacher', 'instructor'].includes(normalizedRole)) {
      normalizedRole = 'faculty';
    } else if (['administrative staff', 'staff member', 'employee'].includes(normalizedRole)) {
      normalizedRole = 'staff';
    }

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
        (first_name, middle_name, last_name, ext_name, id_number, email, password_hash, role, department, office, contact_number, gender, address, birthday, age, id_photo_url, consent_at, is_supervisor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstName,
        middleName || null,
        lastName,
        extName || null,
        String(idNumber).trim(),
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
        isSupervisor ? 1 : 0,
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
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required.' });
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

    if (role && role !== 'auto') {
      const roleKey = String(role).toLowerCase();
      let requestedRoles = [roleKey];
      if (roleKey === 'faculty_staff') {
        // Supervisors (is_supervisor=1 designation) log in through the Faculty/Staff tab.
        // Their DB role is 'faculty' or 'staff' — NOT 'supervisor'.
        requestedRoles = ['faculty', 'staff'];
      } else if (roleKey === 'superadmin' || roleKey === 'super_admin') {
        requestedRoles = ['superadmin'];
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
    user.firstName = user.first_name;
    user.middleName = user.middle_name;
    user.lastName = user.last_name;
    user.extName = user.ext_name;
    user.idNumber = user.id_number || user.idNumber || '';
    user.avatarUrl = user.id_photo_url || user.avatarUrl || '';
    user.academicRank = user.academic_rank || null;
    user.name = user.name || [user.first_name, user.middle_name, user.last_name, user.ext_name].filter(Boolean).join(' ').trim() || user.email;

    // Resolve assigned immediate supervisor
    user.assignedSupervisor = null;
    if (user.supervisor_id) {
      const [supRows] = await pool.query(
        "SELECT id, first_name, middle_name, last_name, ext_name FROM users WHERE id = ?",
        [user.supervisor_id]
      );
      if (supRows[0]) {
        user.assignedSupervisor = [supRows[0].first_name, supRows[0].middle_name, supRows[0].last_name, supRows[0].ext_name].filter(Boolean).join(' ').trim();
      }
    }
    if (!user.assignedSupervisor && user.department) {
      const [deptSups] = await pool.query(
        "SELECT id, first_name, middle_name, last_name, ext_name FROM users WHERE (is_supervisor = 1 OR role = 'supervisor') AND status = 'active' AND department = ? LIMIT 1",
        [user.department]
      );
      if (deptSups[0]) {
        user.assignedSupervisor = [deptSups[0].first_name, deptSups[0].middle_name, deptSups[0].last_name, deptSups[0].ext_name].filter(Boolean).join(' ').trim();
        user.supervisor_id = deptSups[0].id;
      }
    }
    user.supervisorName = user.assignedSupervisor;
    user.immediateSupervisor = user.assignedSupervisor;

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

    // Revoke the old token and issue a fresh JWT so the active session remains authenticated.
    const header = req.headers.authorization || '';
    const oldToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    revokeToken(oldToken);
    invalidateUserCache(user.id);

    const secret = jwtSecretOrFail(res);
    if (!secret) return;
    const token = jwt.sign(
      { id: user.id, role: req.user.role, email: req.user.email },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

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

    res.json({ message: 'Password changed successfully.', token });
  } catch (err) {
    console.error('PUT /auth/password error:', err);
    res.status(500).json({ message: 'Failed to change password.' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Public endpoint to request a 6-digit password reset OTP via Gmail.
 */
router.post('/forgot-password', otpLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Anti-flood check: max 1 request every 60 seconds per email
    const [recent] = await pool.query(
      'SELECT id, created_at FROM password_resets WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND) ORDER BY id DESC LIMIT 1',
      [cleanEmail]
    );
    if (recent.length > 0) {
      return res.status(429).json({ message: 'A verification code was recently dispatched. Please wait at least 60 seconds before requesting a new one.' });
    }

    // Verify user exists and is active
    const [users] = await pool.query(
      "SELECT id, first_name, last_name, email, status FROM users WHERE LOWER(email) = ?",
      [cleanEmail]
    );
    const user = users[0];

    // Generate cryptographically random 6-digit OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otpCode, 8);

    // Clear any previous reset tokens for this email
    await pool.query('DELETE FROM password_resets WHERE email = ?', [cleanEmail]);

    // Insert new 15-minute OTP
    await pool.query(
      'INSERT INTO password_resets (email, otp_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
      [cleanEmail, otpHash]
    );

    // If account exists and is active, send the real email via Gmail SMTP
    if (user && user.status === 'active') {
      const recipientName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
      await sendPasswordResetOtpEmail({
        to: cleanEmail,
        recipientName,
        otpCode,
      });

      await auditLog(pool, {
        actorId: user.id,
        action: 'auth.password_reset_otp_requested',
        entity: 'user',
        entityId: String(user.id),
        details: `Password reset OTP generated and emailed to ${cleanEmail}`
      }).catch(() => {});
    } else {
      // Do not expose plaintext OTP in logs when SMTP is configured
      const hasSmtp = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
      console.log(
        hasSmtp
          ? `[AUTH GMAIL OTP] Notice: Password reset requested for unregistered/inactive email ${cleanEmail}`
          : `[AUTH GMAIL OTP] Notice: OTP generated for unregistered/inactive email ${cleanEmail} (dev fallback): ${otpCode}`
      );
    }

    return res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}. Please check your inbox and spam folder.`
    });
  } catch (err) {
    console.error('POST /auth/forgot-password error:', err);
    res.status(500).json({ message: 'Failed to process password reset request. Please try again.' });
  }
});

/**
 * POST /api/auth/verify-reset-code
 * Public endpoint to verify that the 6-digit OTP is valid before showing the new password form.
 */
router.post('/verify-reset-code', otpLimiter, async (req, res) => {
  const { email, otp } = req.body || {};

  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }
  if (!otp || String(otp).trim().length !== 6) {
    return res.status(400).json({ message: 'A 6-digit verification code is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  try {
    const [resets] = await pool.query(
      'SELECT id, otp_hash, attempts, expires_at FROM password_resets WHERE email = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [cleanEmail]
    );
    const resetRecord = resets[0];

    if (!resetRecord) {
      return res.status(400).json({ message: 'Invalid or expired verification code. Please request a new code.' });
    }

    if (resetRecord.attempts >= 5) {
      await pool.query('DELETE FROM password_resets WHERE email = ?', [cleanEmail]);
      return res.status(400).json({ message: 'Too many incorrect attempts. This code has been revoked. Please request a new one.' });
    }

    const otpMatches = await bcrypt.compare(cleanOtp, resetRecord.otp_hash);
    if (!otpMatches) {
      await pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', [resetRecord.id]);
      const remaining = 4 - resetRecord.attempts;
      return res.status(400).json({
        message: remaining > 0
          ? `Incorrect verification code. ${remaining} attempt(s) remaining.`
          : 'Incorrect verification code. Maximum attempts reached.'
      });
    }

    return res.json({
      success: true,
      message: 'Verification code confirmed. You may now enter your new password.'
    });
  } catch (err) {
    console.error('POST /auth/verify-reset-code error:', err);
    res.status(500).json({ message: 'Failed to verify code. Please try again.' });
  }
});

/**
 * POST /api/auth/verify-reset-password
 * Public endpoint to verify the 6-digit OTP and reset password.
 */
router.post('/verify-reset-password', otpLimiter, async (req, res) => {
  const { email, otp, newPassword } = req.body || {};

  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }
  if (!otp || String(otp).trim().length !== 6) {
    return res.status(400).json({ message: 'A 6-digit verification code is required.' });
  }
  const pwErr = passwordError(newPassword);
  if (pwErr) {
    return res.status(400).json({ message: pwErr });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  try {
    // Find active reset token
    const [resets] = await pool.query(
      'SELECT id, otp_hash, attempts, expires_at FROM password_resets WHERE email = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [cleanEmail]
    );
    const resetRecord = resets[0];

    if (!resetRecord) {
      return res.status(400).json({ message: 'Invalid or expired verification code. Please request a new code.' });
    }

    // Brute force protection: max 5 attempts per code
    if (resetRecord.attempts >= 5) {
      await pool.query('DELETE FROM password_resets WHERE email = ?', [cleanEmail]);
      return res.status(400).json({ message: 'Too many incorrect attempts. This verification code has been revoked. Please request a new one.' });
    }

    // Verify OTP
    const otpMatches = await bcrypt.compare(cleanOtp, resetRecord.otp_hash);
    if (!otpMatches) {
      await pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', [resetRecord.id]);
      const remaining = 4 - resetRecord.attempts;
      return res.status(400).json({
        message: remaining > 0
          ? `Incorrect verification code. ${remaining} attempt(s) remaining.`
          : 'Incorrect verification code. Maximum attempts reached.'
      });
    }

    // Check user account in database
    const [users] = await pool.query(
      'SELECT id, first_name, last_name, email FROM users WHERE LOWER(email) = ?',
      [cleanEmail]
    );
    const user = users[0];
    if (!user) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    // Update user password and unlock account
    const newHash = await bcrypt.hash(String(newPassword), 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [newHash, user.id]
    );

    // Delete all reset tokens for this email
    await pool.query('DELETE FROM password_resets WHERE email = ?', [cleanEmail]);

    // Invalidate user cache
    invalidateUserCache(user.id);

    // Audit log
    await auditLog(pool, {
      actorId: user.id,
      action: 'auth.password_reset_completed',
      entity: 'user',
      entityId: String(user.id),
      details: `Password reset successfully via Gmail OTP authentication for ${cleanEmail}`
    }).catch(() => {});

    // Send confirmation alert via Gmail
    const recipientName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
    sendPasswordResetSuccessEmail({ to: cleanEmail, recipientName }).catch(() => {});

    return res.json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('POST /auth/verify-reset-password error:', err);
    res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
});

export default router;

