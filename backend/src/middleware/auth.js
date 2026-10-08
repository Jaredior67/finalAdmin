import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

// Phase 2: server-side logout invalidation. Revoked tokens are rejected until
// they naturally expire. In-memory by design for the single-instance XAMPP
// deployment (cleared on restart; pair with short JWT expiry).
const revokedTokens = new Set();

export function revokeToken(token) {
  if (token) revokedTokens.add(token);
  if (revokedTokens.size > 10000) revokedTokens.clear();
}

/* The token carried { id, role, email } and the role was trusted from it for
   the whole token lifetime. So when an administrator demoted a rogue supervisor
   or deactivated a leaver's account, that account kept passing
   requireRole('supervisor') until the token expired — hours of retained
   privileged access after revocation.

   The role and the account's active flag are now re-read from the database on
   every request, so a demotion or deactivation takes effect immediately. The
   per-request cost is one indexed primary-key lookup.

   The last good row is cached for a few seconds to keep a page full of parallel
   requests from turning into a burst of identical queries. That window is the
   only thing revocation is ever delayed by. */
const HYDRATE_TTL_MS = 5000;
const hydrateCache = new Map(); // userId -> { at, user }

async function loadCurrentUser(id) {
  const cached = hydrateCache.get(id);
  if (cached && Date.now() - cached.at < HYDRATE_TTL_MS) return cached.user;

  const [rows] = await pool.query(
    'SELECT id, role, is_supervisor, email, first_name, last_name, department, status FROM users WHERE id = ?',
    [id]
  );
  const row = rows[0];
  if (!row) return null;

  const isSup = Boolean(row.is_supervisor || row.role === 'supervisor');
  const user = {
    id: row.id,
    role: row.role,
    is_supervisor: isSup ? 1 : 0,
    isSupervisor: isSup,
    email: row.email,
    name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email,
    lastName: row.last_name || '',
    department: row.department || '',
    status: row.status
  };
  hydrateCache.set(id, { at: Date.now(), user });
  return user;
}

/** Drop a cached user so a role/status change is visible on the next request. */
export function invalidateUserCache(id) {
  hydrateCache.delete(id);
}

export async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header.' });
  }
  if (revokedTokens.has(token)) {
    return res.status(401).json({ message: 'Session has been signed out. Please sign in again.' });
  }

  let payload;
  try {
    // Pinned to the algorithm this server issues. Not exploitable with an HMAC
    // secret today, but it removes the whole class of algorithm-confusion
    // attacks if the signing key ever changes shape.
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  try {
    const user = await loadCurrentUser(payload.id);
    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'This account has been deactivated. Please contact the Administrator office.' });
    }
    // The database is authoritative for role, name and department — the token
    // is only proof of which account this is.
    req.user = user;
    next();
  } catch (err) {
    console.error('verifyToken: user lookup failed:', err.message);
    return res.status(503).json({ message: 'Could not verify your session. Please try again.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const hasRole = allowedRoles.includes(req.user.role);
    // Faculty/staff users designated as supervisors (is_supervisor = 1) are
    // allowed through any gate that lists 'supervisor' as a valid role.
    const isDesignatedSupervisor = allowedRoles.includes('supervisor') && (req.user.isSupervisor || req.user.is_supervisor);
    if (!hasRole && !isDesignatedSupervisor) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

