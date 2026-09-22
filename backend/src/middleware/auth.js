import jwt from 'jsonwebtoken';

// Phase 2: server-side logout invalidation. Revoked tokens are rejected until
// they naturally expire. In-memory by design for the single-instance XAMPP
// deployment (cleared on restart; pair with short JWT expiry).
const revokedTokens = new Set();

export function revokeToken(token) {
  if (token) revokedTokens.add(token);
  if (revokedTokens.size > 10000) revokedTokens.clear();
}

export function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header.' });
  }
  if (revokedTokens.has(token)) {
    return res.status(401).json({ message: 'Session has been signed out. Please sign in again.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, email }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}
