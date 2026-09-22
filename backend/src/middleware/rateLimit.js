/**
 * Minimal in-memory sliding-window rate limiter (Phase 2).
 * No extra dependency; per-process state is fine for a single-instance
 * XAMPP deployment. Keys combine IP + email so one attacker cannot
 * exhaust the bucket for everyone.
 */
const buckets = new Map();

function prune(now) {
  for (const [key, entry] of buckets) {
    entry.hits = entry.hits.filter(t => now - t < entry.windowMs);
    if (entry.hits.length === 0) buckets.delete(key);
  }
}

export function rateLimit({ windowMs = 60 * 1000, max = 10, keyOf = null, message = 'Too many attempts. Please wait a minute and try again.' }) {
  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 5000 && Math.random() < 0.01) prune(now);
    const key = keyOf
      ? keyOf(req)
      : `${req.ip}|${String(req.body?.email || '').toLowerCase()}`;
    let entry = buckets.get(key);
    if (!entry) {
      entry = { hits: [], windowMs };
      buckets.set(key, entry);
    }
    entry.hits = entry.hits.filter(t => now - t < windowMs);
    if (entry.hits.length >= max) {
      return res.status(429).json({ message });
    }
    entry.hits.push(now);
    next();
  };
}
