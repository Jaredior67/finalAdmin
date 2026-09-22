/**
 * auditLog — Phase 2 security trail (who did what, when).
 * Accepts either the pool or a transaction connection; both expose .query().
 */
export async function auditLog(db, { actorId = null, action, entity, entityId = null, details = null }) {
  await db.query(
    'INSERT INTO audit_log (actor_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
    [actorId, action, entity, entityId === null || entityId === undefined ? null : String(entityId), details]
  );
}
