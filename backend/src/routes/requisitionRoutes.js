import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { auditLog } from '../utils/auditLog.js';
import { isPrivileged, isTech, canViewTicket, authorizeStatusChange, assertAgainstPolicy, isTerminalStatus } from '../utils/ticketPolicy.js';
import { wordLimitError, lengthError, lengthErrors, DESCRIPTION_WORD_LIMIT, REMARKS_WORD_LIMIT, VARCHAR_LIMITS } from '../utils/wordLimit.js';
import { REQUEST_CATEGORIES, REQUEST_STATUSES } from '../scripts/autoSetup.js';
import {
  emailNewRequest,
  emailSupervisorEndorsed,
  emailSupervisorReturned,
  emailAdminApproved,
  emailFinalApproved,
  emailFinalRejected,
  emailAssigned,
  emailCompleted,
  emailUrgentFollowUpRequired,
  emailUrgentAssignedReminder,
  emailUrgentOverdueRequester,
  emailUrgentOverdueSupervisor,
} from '../utils/emailService.js';

const router = Router();
router.use(verifyToken);

/* Deepest page any client may request. Past this the server returns an empty
   set rather than making the database walk an arbitrary number of rows. */
const MAX_OFFSET = 100000;
/* Largest page a client may ask for in one round trip. */
const MAX_LIMIT = 200;

/**
 * generateTicketNo - atomic, race-condition-safe ticket numbering.
 * Uses ticket_sequences with an atomic UPSERT so concurrent inserts
 * never produce the same ticket number (unlike COUNT(*) which had a TOCTOU gap).
 */
async function generateTicketNo(conn) {
  const year = new Date().getFullYear();
  // Upsert: insert the year row if missing, otherwise atomically bump counter.
  await conn.query(
    'INSERT INTO ticket_sequences (`year`, last_no) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1',
    [year]
  );
  const [[{ last_no }]] = await conn.query(
    'SELECT last_no FROM ticket_sequences WHERE `year` = ?',
    [year]
  );
  return `JR-${year}-${String(last_no).padStart(4, '0')}`;
}

async function notify(conn, userId, title, message, link = null) {
  if (!userId) return;
  await conn.query(
    'INSERT INTO notifications (user_id, title, message, link) VALUES (?, ?, ?, ?)',
    [userId, title, message, link]
  );
}

/* Fan out one notification to a set of recipients in a single statement.
 *
 * The role fan-outs below used to run one INSERT per recipient, inside the
 * caller's transaction and while it held a FOR UPDATE lock on the ticket. Every
 * status change therefore cost 1 + N round trips with the record locked, which
 * is exactly when other writers should be holding the lock for as short a time
 * as possible. One multi-row INSERT is one round trip regardless of how many
 * people are notified. */
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

async function activeUserIdsByRole(conn, role) {
  const [rows] = await conn.query(
    'SELECT id FROM users WHERE role = ? AND status = \'active\'',
    [role]
  );
  return rows.map((r) => r.id);
}

async function notifyAdmins(conn, title, message, link = null, excludeUserId = null) {
  const ids = await activeUserIdsByRole(conn, 'admin');
  await notifyMany(
    conn,
    excludeUserId ? ids.filter((id) => id !== excludeUserId) : ids,
    title, message, link
  );
}

async function notifySupervisors(conn, title, message, link = null) {
  const [rows] = await conn.query(
    "SELECT id FROM users WHERE (role = 'supervisor' OR is_supervisor = 1) AND status = 'active'"
  );
  const ids = rows.map((r) => r.id);
  await notifyMany(conn, ids, title, message, link);
}

async function notifyApprovers(conn, title, message, link = null) {
  await notifyMany(conn, await activeUserIdsByRole(conn, 'campus_admin'), title, message, link);
}

async function activeEmailsByRole(connOrPool, role) {
  const [rows] = await connOrPool.query(
    'SELECT email FROM users WHERE role = ? AND status = "active"',
    [role]
  );
  return rows.map((r) => r.email).filter(Boolean);
}

async function userEmailById(connOrPool, userId) {
  if (!userId) return null;
  const [rows] = await connOrPool.query('SELECT email FROM users WHERE id = ?', [userId]);
  return rows[0]?.email || null;
}

export async function checkAndRemindOverdueUrgentRequests(connOrPool) {
  try {
    const [overdueList] = await connOrPool.query(
      `SELECT jr.id, jr.ticket_no, jr.official_tracking_no, jr.requester_id, jr.supervisor_id, jr.immediate_supervisor, jr.urgent_assigned_at,
              u.email AS requester_email, u.first_name AS requester_first, u.last_name AS requester_last
       FROM job_requests jr
       JOIN users u ON jr.requester_id = u.id
       WHERE (jr.request_type = 'Urgent Request' OR jr.urgency_level = 'High Risk' OR jr.category = 'Urgent Hazard')
         AND jr.is_standard_form_filled = 0
         AND jr.urgent_assigned_at IS NOT NULL
         AND jr.urgent_assigned_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         AND jr.urgent_overdue_notified = 0`
    );

    for (const item of overdueList) {
      const tracking = item.official_tracking_no || item.ticket_no;
      const requesterName = [item.requester_first, item.requester_last].filter(Boolean).join(' ') || item.requester_email;

      // 1. Remind requester: Tracking number stays permanently assigned, standard form overdue
      await notify(
        connOrPool,
        item.requester_id,
        'OVERDUE: Urgent Request Standard Form Required',
        `The 24-hour deadline to submit the standard form (QF-PDAS-DC-01) for urgent request ${tracking} has elapsed. Your tracking number remains permanently assigned to avoid any conflict, but please submit the form immediately.`,
        '/faculty-staff-portal'
      );

      // 2. Notify Immediate Supervisor
      let targetSupervisorId = item.supervisor_id;
      let targetSupervisorEmail = null;
      if (!targetSupervisorId && item.immediate_supervisor) {
        const [sups] = await connOrPool.query(
          "SELECT id, first_name, last_name, email FROM users WHERE (is_supervisor = 1 OR role = 'supervisor') AND status = 'active'"
        );
        const nameClean = item.immediate_supervisor.toLowerCase();
        const hit = sups.find((s) => {
          const full = `${s.first_name} ${s.last_name}`.toLowerCase();
          return full === nameClean || nameClean.includes(full) || full.includes(nameClean);
        });
        if (hit) {
          targetSupervisorId = hit.id;
          targetSupervisorEmail = hit.email;
        }
      } else if (targetSupervisorId) {
        const [[sUser]] = await connOrPool.query('SELECT email FROM users WHERE id = ?', [targetSupervisorId]);
        if (sUser) targetSupervisorEmail = sUser.email;
      }

      if (targetSupervisorId) {
        await notify(
          connOrPool,
          targetSupervisorId,
          `Notice: Urgent Form Overdue (${tracking})`,
          `Requester ${requesterName} has not submitted the standard form (QF-PDAS-DC-01) within 24 hours for urgent incident ${tracking}. Tracking number remains assigned. Please remind them to submit.`,
          '/supervisor-dashboard'
        );
      } else {
        await notifySupervisors(
          connOrPool,
          `Notice: Urgent Form Overdue (${tracking})`,
          `Requester ${requesterName} has not submitted the standard form (QF-PDAS-DC-01) within 24 hours for urgent incident ${tracking}. Tracking number remains assigned. Please remind them to submit.`,
          '/supervisor-dashboard'
        );
      }

      // Mark as notified so we do not duplicate notifications
      await connOrPool.query(
        'UPDATE job_requests SET urgent_overdue_notified = 1 WHERE id = ?',
        [item.id]
      );

      // Send emails asynchronously
      (async () => {
        try {
          if (item.requester_email) {
            await emailUrgentOverdueRequester(item.requester_email, {
              ticketNo: item.ticket_no,
              officialTracking: tracking
            });
          }
          if (targetSupervisorEmail) {
            await emailUrgentOverdueSupervisor(targetSupervisorEmail, {
              requesterName,
              ticketNo: item.ticket_no,
              officialTracking: tracking
            });
          }
        } catch (e) {
          console.warn('[UrgentReminder] Overdue email sending failed:', e.message);
        }
      })();
    }
  } catch (err) {
    console.warn('[UrgentReminder] checkAndRemindOverdueUrgentRequests failed:', err.message);
  }
}

// Normalize urgency string to exact manuscript enums
function normalizeUrgency(u) {
  const str = String(u || '').toLowerCase();
  if (str.includes('high') || str.includes('urgent') || str.includes('emergency')) return 'High Risk';
  if (str.includes('low')) return 'Low Risk';
  return 'Medium Risk';
}

// Normalize status string to exact manuscript lifecycle statuses.
function normalizeStatus(s) {
  const str = String(s || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (str === 'draft') return 'Draft';
  if (str === 'pendingsupervisorapproval' || str === 'supervisorapproval' || str === 'supervisor') return 'Pending Supervisor Approval';
  if (str === 'pending') return 'Pending';
  if (str === 'underreview' || str === 'review') return 'Under Review';
  if (str === 'pendingfinalapproval' || str === 'finalapproval') return 'Pending Final Approval';
  if (str === 'awaitingsignatures' || str === 'awaiting' || str === 'awaitsignature') return 'Awaiting Signatures';
  if (str === 'approved') return 'Approved';
  if (str === 'ongoing' || str === 'inprogress') return 'Ongoing';
  if (str === 'onhold' || str === 'hold' || str === 'paused') return 'On Hold';
  if (str === 'completed' || str === 'resolved') return 'Completed';
  if (str === 'returned' || str === 'returnedforrevision' || str === 'return') return 'Returned';
  if (str === 'rejected' || str === 'cancelled') return 'Rejected';
  return null;
}

export function matchCategory(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const exact = REQUEST_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  return null;
}

function applyVisibilityScope(query, params, user) {
  if (isPrivileged(user.role)) {
    // no filter — the PDAS office sees the whole queue
  } else if (isTech(user.role)) {
    query += ' AND (jr.assigned_to = ? OR jr.assigned_to IS NULL OR jr.status IN ("Approved", "Ongoing", "Completed", "On Hold") OR jr.urgency_level = "High Risk" OR jr.request_type = "Urgent Request")';
    params.push(user.id);
  } else if (user.role === 'faculty' || user.role === 'staff' || user.role === 'supervisor') {
    if (user.is_supervisor || user.isSupervisor || user.role === 'supervisor') {
      const clauses = ['jr.requester_id = ?', 'jr.supervisor_id = ?'];
      const supervisorParams = [user.id, user.id];
      if (user.lastName) {
        clauses.push('jr.immediate_supervisor LIKE ?');
        supervisorParams.push(`%${user.lastName}%`);
      }
      if (user.department) {
        clauses.push('req.department = ?');
        supervisorParams.push(user.department);
      }
      query += ` AND (jr.status = "Pending Supervisor Approval" OR ${clauses.join(' OR ')})`;
      params.push(...supervisorParams);
    } else {
      query += ' AND jr.requester_id = ?';
      params.push(user.id);
    }
  } else {
    return null; // caller answers 403
  }
  return query;
}

const JOB_REQUEST_LIST_FIELDS = `
  jr.id, jr.ticket_no, jr.requester_id, jr.location_id, jr.category, jr.description,
  jr.urgency_level, jr.request_type, jr.is_standard_form_filled, jr.immediate_supervisor,
  NULL AS photo_url, jr.photo_name, jr.materials_used, NULL AS completion_photo_url,
  jr.qr_code_ref, jr.priority, jr.status, jr.assigned_to,
  jr.approved_by, jr.scheduled_date, jr.completed_at, jr.created_at, jr.updated_at,
  jr.is_archived, jr.archived_at, jr.is_replacement_flagged, jr.replacement_reason,
  jr.replacement_item_specs, jr.replacement_procurement_status, jr.replacement_disposition,
  jr.replacement_flagged_by, jr.replacement_flagged_at, jr.signed_form_confirmed,
  jr.signed_form_confirmed_by, jr.signed_form_confirmed_at, jr.requester_approved,
  jr.requester_approved_at, jr.supervisor_id, jr.supervisor_approved, jr.supervisor_approved_at,
  jr.supervisor_remarks, jr.admin_approved, jr.admin_approved_at, jr.admin_remarks,
  jr.admin_field_remarks, jr.campus_admin_approved, jr.campus_admin_approved_at,
  jr.campus_admin_remarks, jr.official_tracking_no, jr.rejection_stage, jr.rejection_remarks,
  jr.request_details,
  CONCAT(req.first_name, ' ', req.last_name) AS requester_name,
  req.department AS requester_dept,
  req.email AS requester_email,
  CONCAT(tech.first_name, ' ', tech.last_name) AS assignee_name,
  CONCAT(appr.first_name, ' ', appr.last_name) AS approver_name,
  appr.role AS approver_role,
  cl.building, cl.floor, cl.room
`;

// GET /api/job-requests - filtered by role and archive status
router.get('/', async (req, res) => {
  try {
    const isArchived = req.query.archived === 'true' ? 1 : 0;
    let query = `
      SELECT ${JOB_REQUEST_LIST_FIELDS}
      FROM job_requests jr
      LEFT JOIN users req ON req.id = jr.requester_id
      LEFT JOIN users tech ON tech.id = jr.assigned_to
      LEFT JOIN users appr ON appr.id = jr.approved_by
      LEFT JOIN campus_locations cl ON cl.id = jr.location_id
      WHERE jr.is_archived = ?
    `;
    const params = [isArchived];

    const scoped = applyVisibilityScope(query, params, req.user);
    if (scoped === null) {
      return res.status(403).json({ message: 'Your account role cannot list job requests.' });
    }
    query = scoped;

    /* The same query shape without the paging clause, for COUNT(*). Filtering
       and ordering are irrelevant to a count, so only the WHERE is reused. */
    const whereSql = query;

    /* Server-side paging. limit was clamped but offset was not, so `?offset=1e21`
       reached the driver as the literal `1e+21` and the statement failed to
       parse (500), while `?offset=5000000000` was accepted and forced InnoDB
       to scan and discard five billion rows. Both are now bounded, and
       non-integer input falls back to the default rather than propagating. */
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(
      Math.max(Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 100, 1),
      MAX_LIMIT
    );
    const offset = Math.min(
      Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0,
      MAX_OFFSET
    );

    const sortOrder = String(req.query.sortOrder || req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Prioritize high risk tickets first, then sort by submission date (newest first by default)
    query += ` ORDER BY
      CASE jr.urgency_level
        WHEN 'High Risk' THEN 1
        WHEN 'Medium Risk' THEN 2
        WHEN 'Low Risk' THEN 3
        ELSE 4
      END ASC, jr.created_at ${sortOrder}, jr.id ${sortOrder}
      LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    /* The response carries the total as well as the page.

       Returning a bare array meant the client could not tell "this page is
       empty" from "this is the end of the list", and every tab counter was
       derived from the rows that happened to be in the 200-row window. Past
       that, tickets quietly disappeared from the queues while the UI still
       reported a count. */
    const [rows] = await pool.query(query, params);
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM (${whereSql.replace(/ORDER BY[\s\S]*$/, '')}) AS scoped`,
      params.slice(0, -2)
    );
    const total = Number(countRows[0]?.total || 0);

    /* The photo is a base64 blob and a page of tickets is not a page of
       images. `SELECT jr.*` would otherwise hand every viewer every attached
       photo on every poll; the detail endpoint still returns it. */
    for (const row of rows) delete row.photo_url;

    res.json({ rows, total, limit, offset });
  } catch (err) {
    console.error('GET /job-requests error:', err);
    res.status(500).json({ message: 'Failed to fetch job requests.' });
  }
});

/* GET /api/job-requests/stats - counts by status, from the database.
 *
 * The dashboard tiles used to be computed in the browser from whatever rows the
 * list endpoint happened to return — a 200-row window. Past that, a tile could
 * read 4 while the queue held 31, and nothing looked wrong. The counts are
 * issued here instead, under the same visibility scope as the list, so a number
 * on screen always matches the number in the table.
 *
 * Declared before router.get('/:id') so "stats" is not swallowed as an id.
 */
router.get('/stats', async (req, res) => {
  try {
    const isArchived = req.query.archived === 'true' ? 1 : 0;
    let query = `
      FROM job_requests jr
      LEFT JOIN users req ON req.id = jr.requester_id
      WHERE jr.is_archived = ?
    `;
    const params = [isArchived];

    const scoped = applyVisibilityScope(query, params, req.user);
    if (scoped === null) {
      return res.status(403).json({ message: 'Your account role cannot list job requests.' });
    }

    const [rows] = await pool.query(
      `SELECT jr.status AS status, COUNT(*) AS n ${scoped} GROUP BY jr.status`,
      params
    );

    const byStatus = {};
    for (const s of REQUEST_STATUSES) byStatus[s] = 0;
    let total = 0;
    for (const r of rows) {
      const n = Number(r.n || 0);
      // A status the policy does not know (a legacy value, say) still appears
      // in the table rather than being silently dropped from the total.
      byStatus[r.status ?? 'Unknown'] = (byStatus[r.status ?? 'Unknown'] || 0) + n;
      total += n;
    }

    res.json({ byStatus, total });
  } catch (err) {
    console.error('GET /job-requests/stats error:', err);
    res.status(500).json({ message: 'Failed to fetch job request counts.' });
  }
});

// GET /api/job-requests/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT jr.*,
              CONCAT(req.first_name, ' ', req.last_name) AS requester_name,
              req.department AS requester_dept,
              req.email AS requester_email,
              CONCAT(tech.first_name, ' ', tech.last_name) AS assignee_name,
              CONCAT(appr.first_name, ' ', appr.last_name) AS approver_name,
              appr.role AS approver_role,
              cl.building, cl.floor, cl.room
       FROM job_requests jr
       LEFT JOIN users req ON req.id = jr.requester_id
       LEFT JOIN users tech ON tech.id = jr.assigned_to
       LEFT JOIN users appr ON appr.id = jr.approved_by
       LEFT JOIN campus_locations cl ON cl.id = jr.location_id
       WHERE jr.id = ? OR jr.ticket_no = ?`,
      [req.params.id, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Job request not found.' });
    }
    // IDOR guard: only privileged roles, the assignee, or the requester.
    if (!canViewTicket(req.user, rows[0])) {
      return res.status(403).json({ message: 'You do not have permission to view this job request.' });
    }

    const [history] = await pool.query(
      `SELECT h.*, CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name
       FROM job_request_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.job_request_id = ? ORDER BY h.created_at ASC`,
      [rows[0].id]
    );

    res.json({ ...rows[0], history });
  } catch (err) {
    console.error('GET /job-requests/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch job request.' });
  }
});

// POST /api/job-requests - faculty/staff submit a new request
// Anyone with an account may file on behalf of someone else (the PDAS office
// does this routinely), so there is no role gate on this route — the row
// records who actually filed it.
router.post('/', async (req, res) => {
  let conn;
  let key = '';
  try {
    conn = await pool.getConnection();
    const {
      locationId,
      qrCodeRef,
      title,
      building,
      floor,
      room,
      photoUrl,
      photoName,
      category,
      description,
      urgencyLevel,
      priority,
      requestType,
      isStandardFormFilled,
      immediateSupervisor,
      idempotencyKey,
      scopeOfWorks,
      actionTaken,
      finalAction
    } = req.body;

    /* Idempotency.
       A request filed while the network was down sits in the local outbox and
       is retried when the connection returns. A user may also press Submit
       twice, or a retry may race a manual re-submission. Either way the second
       attempt must not create a second ticket, so the client sends a key that
       was generated once, when the form was filled in, and a repeat of that key
       returns the ticket that already exists. */
    key = String(idempotencyKey || '').trim();
    if (key) {
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) {
        return res.status(400).json({ message: 'idempotencyKey must be 8-64 characters of A-Z, a-z, 0-9, hyphen or underscore.' });
      }
      const [existing] = await conn.query(
        'SELECT id, ticket_no, status, official_tracking_no FROM job_requests WHERE idempotency_key = ?',
        [key]
      );
      if (existing.length > 0) {
        return res.status(200).json({
          duplicate: true,
          ticketNo: existing[0].ticket_no,
          status: existing[0].status,
          officialTrackingNo: existing[0].official_tracking_no,
          message: 'This request was already filed.'
        });
      }
    }

    if (!description) {
      return res.status(400).json({ message: 'description is required.' });
    }
    // Server-side input validation.
    if (typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ message: 'description must be a non-empty string.' });
    }
    // Word cap, mirrored from the client so a hand-crafted request cannot
    // write an unbounded blob into the record or the audit log.
    const descLimitError = wordLimitError(description, DESCRIPTION_WORD_LIMIT, 'description');
    if (descLimitError) {
      return res.status(400).json(descLimitError);
    }
    /* immediate_supervisor is a narrow VARCHAR(150). description is TEXT and
       has no character limit, so only the narrow column needs checking here —
       without it, a long supervisor name is silently cut to 150 characters. */
    const narrowTooLong = lengthError(
      immediateSupervisor,
      VARCHAR_LIMITS.immediateSupervisor,
      'Immediate supervisor'
    );
    if (narrowTooLong) {
      return res.status(400).json(narrowTooLong);
    }
    /* Category is allow-listed against the SAME vocabulary the database enum
       uses (see REQUEST_CATEGORIES in scripts/autoSetup.js).

       This used to allow-list the original six trade slugs
       (electrical/plumbing/carpentry/ict/janitorial/other) and lowercase
       whatever arrived. The client sends human-readable trade names, so
       'Drawing/Design' became 'drawing/design' and 'Urgent Hazard' became
       'urgent hazard' — neither in the list, so every one of them silently
       collapsed to 'other'. Once the enum was widened to the real names,
       'other' matched nothing and MariaDB stored '' instead, with no error and
       no warning. Net effect: every ticket in the system lost its category.

       Matching is now case-insensitive on the real vocabulary, and an
       unrecognised value is a 400 rather than a silent substitution. */
    const finalCategory = matchCategory(category);
    if (!finalCategory) {
      return res.status(400).json({
        message: `category must be one of: ${REQUEST_CATEGORIES.join(', ')}.`
      });
    }

    const finalUrgency = normalizeUrgency(urgencyLevel || priority);
    const finalReqType = 'Standard Request';
    const finalFormFilled = 1;
    const isDraft = Boolean(req.body.isDraft);

    /* Step 1 of the approval chain — work out WHO must endorse this filing.
       A ticket that never names a supervisor sat waiting for an endorsement
       nobody could give: the queue was open to any designated supervisor (a
       self-endorsement included) or, more often, to nobody at all.

       Resolution order:
         1. the Supervisor assigned to the requester on their user account
         2. a designated Supervisor whose name matches the free-text typed on
            the form (matched exactly the way ticketPolicy matches it later)
       If neither yields anyone, there is by definition no Supervisor who can
       confirm this — so the requester's own electronic approval doubles as the
       supervisory confirmation, and the audit row says so by name. That is the
       documented behaviour for a requester who is the Supervisor of their own
       unit, and for a requester with no Supervisor assigned. */
    let supervisorId = null;
    let resolvedImmediateSupervisor = immediateSupervisor;
    if (!isDraft) {
      const [meRows] = await conn.query(
        'SELECT id, role, supervisor_id, is_supervisor, department FROM users WHERE id = ?',
        [req.user.id]
      );
      const me = meRows[0] || null;

      if (me && me.supervisor_id && Number(me.supervisor_id) !== Number(me.id)) {
        const [assigned] = await conn.query(
          "SELECT id FROM users WHERE id = ? AND status = 'active'",
          [me.supervisor_id]
        );
        if (assigned.length) supervisorId = assigned[0].id;
      }

      if (!supervisorId) {
        const named = String(immediateSupervisor || '').trim().toLowerCase();
        if (named) {
          const [candidates] = await conn.query(
            "SELECT id, first_name, last_name FROM users WHERE is_supervisor = 1 AND status = 'active'"
          );
          const hit = candidates.find((u) => {
            const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').toLowerCase();
            return Boolean(fullName) && (named.includes(fullName) || fullName.includes(named));
          });
          if (hit) supervisorId = hit.id;
        }
      }

      if (!supervisorId && me && me.department) {
        const [deptSupervisors] = await conn.query(
          "SELECT id, first_name, last_name FROM users WHERE department = ? AND is_supervisor = 1 AND status = 'active' LIMIT 1",
          [me.department]
        );
        if (deptSupervisors.length) {
          supervisorId = deptSupervisors[0].id;
          if (!resolvedImmediateSupervisor) {
            resolvedImmediateSupervisor = [deptSupervisors[0].first_name, deptSupervisors[0].last_name].filter(Boolean).join(' ');
          }
        }
      }

      // Only populate resolvedImmediateSupervisor if the user actually had an assigned or department supervisor
      // or if they explicitly provided one. Never fabricate an immediate supervisor from another department.
      if (supervisorId && !resolvedImmediateSupervisor) {
        const [supUser] = await conn.query('SELECT first_name, last_name FROM users WHERE id = ?', [supervisorId]);
        if (supUser.length) {
          resolvedImmediateSupervisor = [supUser[0].first_name, supUser[0].last_name].filter(Boolean).join(' ');
        }
      }

      // SA-2: Block request submission for regular faculty/staff who are not themselves a supervisor
      // if their department has no designated active Immediate Supervisor.
      const isRegularRequester =
        ['faculty', 'staff'].includes(String(req.user.role || '').toLowerCase()) &&
        !Boolean(me?.is_supervisor || req.user.is_supervisor || req.user.isSupervisor);
      if (isRegularRequester && !supervisorId) {
        return res.status(422).json({
          message:
            'Your department does not have a designated active Immediate Supervisor yet. Request submission is blocked until the Super Administrator designates a supervisor for your department.'
        });
      }
    }

    // ── Campus Admin self-filed request: auto-approve ──────────────────────
    // When a campus_admin files a request they simultaneously act as requester,
    // immediate supervisor, and approver. The request skips Pending and
    // Pending Supervisor Approval stages and is created directly as 'Approved'.
    const isCampusAdminFiling = !isDraft && req.user.role === 'campus_admin';

    if (isCampusAdminFiling) {
      // Self-endorse: override whatever was typed (or left blank) in the form.
      // req.user.name is the full name from auth middleware (first_name + last_name).
      const adminFullName = req.user.name || req.user.email;
      resolvedImmediateSupervisor = adminFullName;
      // Self-assign as supervisor so all supervisor FK lookups resolve correctly
      supervisorId = req.user.id;
    }

    // All submitted job requests enter the workflow in 'Pending' status,
    // unless the filer is a campus_admin who self-approves immediately.
    // High / Urgent priority requests enter as 'Pending' and are prioritized at the top of the queues.
    const initialStatus = isDraft
      ? 'Draft'
      : (isCampusAdminFiling ? 'Approved' : 'Pending');
    const requesterApproved = isDraft ? 0 : 1;
    const requesterApprovedAt = isDraft ? null : new Date();

    /* ── Location ───────────────────────────────────────────────────────────
       `job_requests.location_id` is a real foreign key and the list, detail,
       evaluation and document queries all join through it, but no code path
       ever produced a value: the client sent none and `campus_locations` was
       never written to, so every ticket stored NULL and every join came back
       blank. Resolve it here from the id the client holds, then from the QR tag
       the request was filed against, then from the place as typed. */
    let resolvedLocationId = null;
    const qrRefValue = qrCodeRef
      ? String(qrCodeRef).slice(0, 64)
      : room
        ? `ISATU-${String(room).replace(/\s+/g, '-').slice(0, 10).toUpperCase()}`.slice(0, 64)
        : null;
    if (locationId) {
      const [byId] = await conn.query('SELECT id FROM campus_locations WHERE id = ?', [locationId]);
      if (byId.length) resolvedLocationId = byId[0].id;
    }
    if (!resolvedLocationId && qrCodeRef) {
      const [byQr] = await conn.query('SELECT id FROM campus_locations WHERE qr_code = ?', [String(qrCodeRef)]);
      if (byQr.length) resolvedLocationId = byQr[0].id;
    }
    if (!resolvedLocationId && building && room) {
      const [byText] = await conn.query(
        `SELECT id FROM campus_locations
          WHERE building = ? AND COALESCE(floor, '') = COALESCE(?, '') AND room = ?
          LIMIT 1`,
        [building, floor || null, room]
      );
      if (byText.length) {
        resolvedLocationId = byText[0].id;
      } else if (qrRefValue) {
        /* Nothing registers this place yet. Leaving it NULL is what made the
           column useless, so the location the requester actually chose is
           registered here — idempotently, reusing the tag when one already
           carries it. The admin can edit or merge it from Print Labels. */
        const [byTag] = await conn.query('SELECT id FROM campus_locations WHERE qr_code = ?', [qrRefValue]);
        if (byTag.length) {
          resolvedLocationId = byTag[0].id;
        } else {
          const [ins] = await conn.query(
            'INSERT INTO campus_locations (building, floor, room, qr_code) VALUES (?, ?, ?, ?)',
            [building, floor || null, room, qrRefValue]
          );
          resolvedLocationId = ins.insertId;
        }
      }
    }

    /* The requester's photo. Reject a payload too large to store rather than
       letting this MariaDB (strict mode off) cut it silently mid-write. */
    if (typeof photoUrl === 'string' && photoUrl.length > 2 * 1024 * 1024) {
      return res.status(413).json({ message: 'The attached photo is too large. Please attach one under 2MB.' });
    }
    /* Same reasoning for the file name: `photo_name` is VARCHAR(255), and a
       longer name used to be cut to 255 on the way in with no error, so the
       record claimed a save that had quietly lost part of the name. */
    const photoNameError = lengthError(photoName, VARCHAR_LIMITS.photoName, 'File name');
    if (photoNameError) {
      return res.status(400).json(photoNameError);
    }

    await conn.beginTransaction();
    const ticketNo = await generateTicketNo(conn);

    const initialDetails = JSON.stringify({
      title: title || '',
      scopeOfWorks: scopeOfWorks || null,
      actionTaken: actionTaken || null,
      finalAction: finalAction || null,
      building: building || '',
      floor: floor || '',
      room: room || '',
      location: req.body.location || ''
    });

    const [result] = await conn.query(
      `INSERT INTO job_requests
        (ticket_no, requester_id, location_id, category, description, urgency_level, request_type, is_standard_form_filled, immediate_supervisor, supervisor_id, photo_url, photo_name, qr_code_ref, status, requester_approved, requester_approved_at, supervisor_approved, supervisor_approved_at, campus_admin_approved, campus_admin_approved_at, approved_by, idempotency_key, request_details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticketNo,
        req.user.id,
        resolvedLocationId,
        finalCategory,
        description,
        finalUrgency,
        finalReqType,
        finalFormFilled,
        resolvedImmediateSupervisor || null,
        supervisorId,
        photoUrl || null,
        // Length-checked above; slicing here would hide an over-long name again.
        typeof photoName === 'string' && photoName ? photoName : null,
        qrRefValue,
        initialStatus,
        requesterApproved,
        requesterApprovedAt,
        // campus_admin self-filing: also marked as supervisor-approved immediately
        isCampusAdminFiling ? 1 : 0,
        isCampusAdminFiling ? new Date() : null,
        // campus_admin self-filing: mark as self-approved immediately
        isCampusAdminFiling ? 1 : 0,
        isCampusAdminFiling ? new Date() : null,
        isCampusAdminFiling ? req.user.id : null,
        key || null,
        initialDetails
      ]
    );

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, NULL, ?, ?, ?)',
      [
        result.insertId,
        initialStatus,
        req.user.id,
        isDraft
          ? 'Saved as Draft'
          : isCampusAdminFiling
            ? 'Filed, self-endorsed and self-approved by Campus Administrator — routed directly to PDAS Admin for technician assignment'
            : (finalUrgency === 'High Risk' || finalCategory === 'Urgent Hazard')
              ? 'High / Urgent priority job request submitted & electronically signed'
              : 'Submitted & Electronically signed'
      ]
    );

    let finalStatus = initialStatus;

    if (!isDraft) {
      const isUrgentIncident = finalUrgency === 'High Risk' || finalCategory === 'Urgent Hazard';
      const adminFullName = req.user.name || req.user.email;

      if (isCampusAdminFiling) {
        // Campus Admin self-filed: already approved — notify admins only for technician assignment.
        // No supervisor or approver notification needed (they are both the campus admin themselves).
        await notifyAdmins(
          conn,
          'Approved Request Ready for Assignment',
          `${ticketNo} was filed and self-approved by Campus Administrator ${adminFullName} (${finalCategory}, ${finalUrgency}). Please assign a technician.`,
          `/job-requests/${result.insertId}`,
          req.user.id // exclude the campus admin themselves from admin notifications if they also hold admin role
        );
        // Confirmation to the campus admin themselves
        await notify(
          conn,
          req.user.id,
          'Request Filed & Auto-Approved',
          `${ticketNo} has been filed and automatically approved. It has been forwarded to the System Administrator for technician assignment.`,
          `/job-requests/${result.insertId}`
        );
      } else {
        if (isUrgentIncident) {
          // Priority notifications: highlight urgent priority to supervisor and admins
          await notifyAdmins(
            conn,
            '[PRIORITY] High / Urgent Request Filed',
            `${ticketNo} filed with High / Urgent priority by ${req.user.email} (${finalCategory}). Prioritized for expedited triage and technician dispatch.`,
            `/job-requests/${result.insertId}`
          );

          await notifySupervisors(
            conn,
            '[PRIORITY] Action Required: Endorse High-Priority Request',
            `${ticketNo} was filed with High / Urgent priority by ${req.user.email} (${finalCategory}). Please review and endorse immediately for expedited dispatch.`,
            `/job-requests/${result.insertId}`
          );

          await notifyApprovers(
            conn,
            '[PRIORITY] High-Priority Request Submitted',
            `${ticketNo} was filed with High / Urgent priority by ${req.user.email} (${finalCategory}).`,
            `/job-requests/${result.insertId}`
          );

          await notify(
            conn,
            req.user.id,
            'Job Request Submitted (High Priority)',
            `${ticketNo} has been submitted with High / Urgent priority and sent to your Immediate Supervisor for expedited review.`,
            `/job-requests/${result.insertId}`
          );
        } else {
          // Admin receives standard notification
          await notifyAdmins(
            conn,
            'New Job Request Filed',
            `${ticketNo} was filed by ${req.user.email} (${finalCategory}, ${finalUrgency}).`,
            `/job-requests/${result.insertId}`
          );
          // Standard request: notify approvers and supervisors for action
          await notifyApprovers(
            conn,
            'New Job Request Filed',
            `${ticketNo} was filed by ${req.user.email} (${finalCategory}, ${finalUrgency}).`,
            `/job-requests/${result.insertId}`
          );
          if (supervisorId) {
            const requesterName = [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || req.user.email;
            await notify(
              conn,
              supervisorId,
              'Awaiting your endorsement',
              `${ticketNo} was filed by your supervisee ${requesterName} and is awaiting your endorsement.`,
              `/job-requests/${result.insertId}`
            );
          } else {
            await notifySupervisors(
              conn,
              'Awaiting your endorsement',
              `${ticketNo} was filed by ${req.user.email} and is awaiting endorsement.`,
              `/job-requests/${result.insertId}`
            );
          }
          // Notify requester
          await notify(
            conn,
            req.user.id,
            'Request Submitted',
            `${ticketNo} has been filed successfully and is awaiting supervisor endorsement.`,
            `/job-requests/${result.insertId}`
          );
        }
      }
    }

    await conn.commit();
    // The audit row goes through the same connection, inside the same commit.
    // It used to be written through the pool AFTER the commit, so a failure
    // there left a filed request with no audit entry and nothing reported to
    // the caller.
    await auditLog(conn, { actorId: req.user.id, action: isDraft ? 'request.draft' : 'request.submitted', entity: 'job_request', entityId: result.insertId, details: ticketNo });

    if (!isDraft) {
      (async () => {
        try {
          const adminEmails = await activeEmailsByRole(pool, 'admin');
          const requesterName = [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || req.user.email;
          const isUrgent = finalUrgency === 'High Risk' || finalReqType === 'Urgent Request' || finalCategory === 'Urgent Hazard';
          await emailNewRequest(adminEmails, {
            ticketNo,
            category: finalCategory,
            urgency: finalUrgency,
            requesterName,
            isUrgent,
          });
        } catch (e) {
          console.warn('[Email] POST / notification error:', e.message);
        }
      })();
    }

    res.status(201).json({ message: isDraft ? 'Saved as draft.' : 'Request filed.', id: result.insertId, ticketNo, status: finalStatus });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch {}
    }
    /* Two concurrent retries with the same key: the unique index is the real
       guard, because the pre-INSERT check cannot see an uncommitted row. The
       loser reports the winner's ticket rather than a 500. */
    if (err?.code === 'ER_DUP_ENTRY' && key) {
      const [existing] = await pool.query(
        'SELECT id, ticket_no, status, official_tracking_no FROM job_requests WHERE idempotency_key = ?',
        [key]
      );
      if (existing.length) {
        return res.status(200).json({
          duplicate: true,
          ticketNo: existing[0].ticket_no,
          status: existing[0].status,
          officialTrackingNo: existing[0].official_tracking_no,
          message: 'This request was already filed.'
        });
      }
    }
    console.error('POST /job-requests error:', err);
    res.status(500).json({ message: 'Failed to submit job request.' });
  } finally {
    if (conn) conn.release();
  }
});

// Step 3 (2): POST /api/job-requests/:id/supervisor-action
// Only the designated Immediate Supervisor may endorse or return here — a PDAS
// administrator is not implicitly this ticket's supervisor, so 'admin' is
// deliberately not a permitted role (requireRole still admits a faculty/staff
// account carrying the is_supervisor designation).
router.post('/:id/supervisor-action', requireRole('supervisor'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { action, remarks } = req.body; // action: 'approve' | 'reject'
    const remarksLimitError = wordLimitError(remarks, REMARKS_WORD_LIMIT, 'remarks');
    if (remarksLimitError) {
      return res.status(400).json(remarksLimitError);
    }
    // Anything other than the two documented actions is a caller bug, not a
    // rejection: the old `else` branch silently rejected the ticket.
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ message: "action must be 'approve' or 'reject'." });
    }
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    // The lifecycle policy is the single source of truth. This route used to
    // hardcode its target status, so any supervisor could approve or reject
    // ANY ticket in the system, and a closed ticket could be dragged back into
    // the workflow. assertAgainstPolicy enforces ownership + terminal state.
    const guard = assertAgainstPolicy({
      user: req.user,
      row: jr,
      // A return is a request for revisions, not a refusal: it lands in
      // 'Returned', which the requester can revise and resubmit. 'Rejected'
      // stays terminal for an outright refusal.
      target: action === 'approve' ? 'Under Review' : 'Returned',
      actor: 'supervisor'
    });
    if (!guard.ok) {
      await conn.rollback();
      return res.status(guard.status).json({ message: guard.message });
    }

    if (action === 'approve') {
      await conn.query(
        `UPDATE job_requests SET 
           supervisor_approved = 1, 
           supervisor_approved_at = NOW(), 
           supervisor_remarks = ?, 
           supervisor_id = ?, 
           status = 'Under Review' 
         WHERE id = ?`,
        [remarks || 'Electronically signed', req.user.id, req.params.id]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, jr.status, 'Under Review', req.user.id, `Approved by Immediate Supervisor: ${remarks || 'Approved'}`]
      );
      await notifyAdmins(conn, 'Job Request Approved by Supervisor', `${jr.ticket_no} was endorsed by the Immediate Supervisor. It is now with PDAS.`, `/job-requests/${jr.id}`);
      await notifyApprovers(conn, 'Job Request Approved by Supervisor', `${jr.ticket_no} was endorsed by the Immediate Supervisor and is now under PDAS review.`, `/job-requests/${jr.id}`);
      await notify(conn, jr.requester_id, 'Supervisor Approved Request', `${jr.ticket_no} was endorsed by your Immediate Supervisor and is now with PDAS.`, `/job-requests/${jr.id}`);
      await auditLog(conn, { actorId: req.user.id, action: 'request.supervisor.approved', entity: 'job_request', entityId: jr.id, details: remarks || 'Approved' });
      await conn.commit();
      (async () => {
        try {
          const requesterEmail = await userEmailById(pool, jr.requester_id);
          const supervisorName = [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || req.user.email;
          await emailSupervisorEndorsed(requesterEmail, { ticketNo: jr.ticket_no, supervisorName });
        } catch (e) {
          console.warn('[Email] supervisor-action approve notification error:', e.message);
        }
      })();
      return res.json({ message: 'Endorsed. Now with PDAS.', status: 'Under Review' });
    } else {
      if (!remarks || !remarks.trim()) {
        await conn.rollback();
        return res.status(400).json({ message: 'Rejection requires remarks.' });
      }
      await conn.query(
        `UPDATE job_requests SET 
           status = 'Returned', 
           rejection_stage = 'supervisor', 
           rejection_remarks = ?, 
           supervisor_remarks = ? 
         WHERE id = ?`,
        [remarks.trim(), remarks.trim(), req.params.id]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, jr.status, 'Returned', req.user.id, `Returned by Immediate Supervisor: ${remarks.trim()}`]
      );
      await notify(conn, jr.requester_id, 'Request Returned by Supervisor', `${jr.ticket_no} was returned for revision: ${remarks.trim()}`, `/job-requests/${jr.id}`);
      await auditLog(conn, { actorId: req.user.id, action: 'request.supervisor.returned', entity: 'job_request', entityId: jr.id, details: remarks.trim() });
      await conn.commit();
      (async () => {
        try {
          const requesterEmail = await userEmailById(pool, jr.requester_id);
          await emailSupervisorReturned(requesterEmail, { ticketNo: jr.ticket_no, remarks: remarks.trim() });
        } catch (e) {
          console.warn('[Email] supervisor-action return notification error:', e.message);
        }
      })();
      return res.json({ message: 'Request returned to requester for revision.', status: 'Returned' });
    }
  } catch (err) {
    await conn.rollback();
    console.error('POST /supervisor-action error:', err);
    res.status(500).json({ message: 'Failed to process supervisor action.' });
  } finally {
    conn.release();
  }
});

// Step 3 (3): POST /api/job-requests/:id/admin-action
router.post('/:id/admin-action', requireRole('admin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { action, remarks, fieldRemarks } = req.body; // action: 'approve' | 'reject' | 'evaluate'
    const remarksLimitError = wordLimitError(remarks, REMARKS_WORD_LIMIT, 'remarks');
    if (remarksLimitError) {
      await conn.rollback();
      return res.status(400).json(remarksLimitError);
    }
    const ADMIN_TARGET = { evaluate: 'Under Review', approve: 'Pending Final Approval', reject: 'Returned' };
    if (!Object.prototype.hasOwnProperty.call(ADMIN_TARGET, action)) {
      await conn.rollback();
      return res.status(400).json({ message: "action must be 'evaluate', 'approve' or 'reject'." });
    }
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    // Same lifecycle policy as every other status write: a closed request is
    // never reopened by an admin action, and the endorsement chain cannot be
    // short-circuited.
    const guard = assertAgainstPolicy({
      user: req.user, row: jr, target: ADMIN_TARGET[action], actor: 'admin'
    });
    if (!guard.ok) {
      await conn.rollback();
      return res.status(guard.status).json({ message: guard.message });
    }

    if (action === 'evaluate') {
      await conn.query('UPDATE job_requests SET status = "Under Review" WHERE id = ?', [req.params.id]);
      await conn.query('INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Under Review", ?, ?)',
        [req.params.id, jr.status, req.user.id, 'Admin evaluation begun']);
      await notify(conn, jr.requester_id, 'Evaluation Underway', `PDAS has started work on ${jr.ticket_no}.`, `/job-requests/${jr.id}`);
      await conn.commit();
      return res.json({ message: 'Evaluation begun. Status is Under Review.', status: 'Under Review' });
    }

    if (action === 'approve') {
      const fRemarksStr = fieldRemarks ? (typeof fieldRemarks === 'object' ? JSON.stringify(fieldRemarks) : String(fieldRemarks)) : null;
      await conn.query(
        `UPDATE job_requests SET 
           admin_approved = 1, 
           admin_approved_at = NOW(), 
           admin_remarks = ?, 
           admin_field_remarks = ?, 
           status = 'Pending Final Approval' 
         WHERE id = ?`,
        [remarks || 'Electronically signed', fRemarksStr, req.params.id]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Pending Final Approval", ?, ?)',
        [req.params.id, jr.status, req.user.id, `Admin Approved & Routed to Campus Admin: ${remarks || 'Approved'}`]
      );
      await notifyApprovers(conn, 'Pending Final Approval', `${jr.ticket_no} is waiting for your final approval.`, `/campus-admin-dashboard`);
      await notify(conn, jr.requester_id, 'PDAS Admin Approved', `${jr.ticket_no} was approved by PDAS. It is now with the Campus Administrator.`, `/job-requests/${jr.id}`);
      if (jr.supervisor_id) {
        await notify(conn, jr.supervisor_id, 'Request Endorsed to Campus Admin', `${jr.ticket_no} was evaluated by PDAS and submitted to the Campus Administrator for final approval.`, `/job-requests/${jr.id}`);
      }
      await auditLog(conn, { actorId: req.user.id, action: 'request.admin.approved', entity: 'job_request', entityId: jr.id, details: remarks || 'Admin approved' });
      await conn.commit();
      (async () => {
        try {
          const approverEmails = await activeEmailsByRole(pool, 'campus_admin');
          const requesterEmail = await userEmailById(pool, jr.requester_id);
          await emailAdminApproved(approverEmails, requesterEmail, { ticketNo: jr.ticket_no });
        } catch (e) {
          console.warn('[Email] admin-action approve notification error:', e.message);
        }
      })();
      return res.json({ message: 'Approved by PDAS. Now with the Campus Administrator.', status: 'Pending Final Approval' });
    } else {
      const combinedRemarks = remarks || (fieldRemarks ? JSON.stringify(fieldRemarks) : 'Needs revision');
      await conn.query(
        `UPDATE job_requests SET 
           status = 'Returned', 
           rejection_stage = 'admin', 
           rejection_remarks = ?, 
           admin_remarks = ?, 
           admin_field_remarks = ? 
         WHERE id = ?`,
        [combinedRemarks, remarks || null, fieldRemarks ? JSON.stringify(fieldRemarks) : null, req.params.id]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Returned", ?, ?)',
        [req.params.id, jr.status, req.user.id, `Returned by PDAS Admin: ${combinedRemarks}`]
      );
      await notify(conn, jr.requester_id, 'Request Returned for Revision', `${jr.ticket_no} was returned for revision: ${combinedRemarks}`, `/job-requests/${jr.id}`);
      await auditLog(conn, { actorId: req.user.id, action: 'request.admin.returned', entity: 'job_request', entityId: jr.id, details: combinedRemarks });
      await conn.commit();
      (async () => {
        try {
          const requesterEmail = await userEmailById(pool, jr.requester_id);
          await emailSupervisorReturned(requesterEmail, { ticketNo: jr.ticket_no, remarks: combinedRemarks });
        } catch (e) {
          console.warn('[Email] admin-action return notification error:', e.message);
        }
      })();
      return res.json({ message: 'Request returned to requester for revision.', status: 'Returned' });
    }
  } catch (err) {
    await conn.rollback();
    console.error('POST /admin-action error:', err);
    res.status(500).json({ message: 'Failed to process admin action.' });
  } finally {
    conn.release();
  }
});

// Step 3 (4): POST /api/job-requests/:id/approver-action
// Final approval belongs to the Approver alone. The System Administrator
// endorses at the previous level, so letting 'admin' in here as well would let
// one account both endorse and finally approve the same request.
router.post('/:id/approver-action', requireRole('campus_admin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { action, remarks } = req.body; // action: 'approve' | 'reject'
    const remarksLimitError = wordLimitError(remarks, REMARKS_WORD_LIMIT, 'remarks');
    if (remarksLimitError) {
      return res.status(400).json(remarksLimitError);
    }
    if (action !== 'approve' && action !== 'reject') {
      await conn.rollback();
      return res.status(400).json({ message: "action must be 'approve' or 'reject'." });
    }
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT * FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ? FOR UPDATE',
      [req.params.id, req.params.id, req.params.id]
    );
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }
    const realId = jr.id;

    /* Final approval is the last gate before a work order exists. Without this
       guard a campus admin could approve a ticket straight out of Draft or
       Pending, skipping both the Immediate Supervisor and PDAS evaluation, and
       could re-open a Completed or Rejected ticket. A DECLINE is not sent
       straight to the requester: the manuscript routes it back THROUGH the
       System Administrator, so the target is 'Under Review' (PDAS) rather than
       a terminal state — the admin then returns it onward with remarks. */
    const guard = assertAgainstPolicy({
      user: req.user,
      row: jr,
      target: action === 'approve' ? 'Approved' : 'Under Review',
      actor: 'campus_admin'
    });
    if (!guard.ok) {
      await conn.rollback();
      return res.status(guard.status).json({ message: guard.message });
    }

    let existingDetails = {};
    try {
      existingDetails = typeof jr.request_details === 'string'
        ? JSON.parse(jr.request_details)
        : (jr.request_details || {});
    } catch {}

    if (action === 'approve') {
      existingDetails.finalAction = {
        status: 'Approved',
        remarks: remarks || 'Electronically signed',
        approvedBy: [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || req.user.name || 'Campus Administrator',
        approvedAt: new Date().toISOString()
      };

      await conn.query(
        `UPDATE job_requests SET 
           campus_admin_approved = 1, 
           campus_admin_approved_at = NOW(), 
           campus_admin_remarks = ?, 
           signed_form_confirmed = 1, 
           signed_form_confirmed_by = ?, 
           signed_form_confirmed_at = NOW(), 
           status = 'Approved', 
           approved_by = ?,
           request_details = ?
         WHERE id = ?`,
        [remarks || 'Electronically signed', req.user.id, req.user.id, JSON.stringify(existingDetails), realId]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Approved", ?, ?)',
        [realId, jr.status, req.user.id, `Campus Admin Final Approval: ${remarks || 'Approved'}`]
      );
      const isUrgent = jr.request_type === 'Urgent Request' || jr.urgency_level === 'High Risk' || jr.category === 'Urgent Hazard';
      await notifyAdmins(
        conn,
        isUrgent ? 'URGENT: Maintenance Dispatch Required' : 'Action Required: Assign Maintenance',
        isUrgent
          ? `URGENT INCIDENT: ${jr.ticket_no} has been approved by the Campus Administrator. Please assign maintenance personnel immediately to begin emergency work.`
          : `${jr.ticket_no} was approved by the Campus Administrator. Please assign maintenance personnel to begin work.`,
        `/job-requests/${jr.id}`
      );
      await notify(conn, jr.requester_id, 'Final Approval Granted', `${jr.ticket_no} was approved by the Campus Administrator. Maintenance is being assigned.`, `/job-requests/${jr.id}`);
      if (jr.supervisor_id) {
        await notify(conn, jr.supervisor_id, 'Final Approval Granted', `${jr.ticket_no} was granted final approval by the Campus Administrator. PDAS is assigning maintenance personnel.`, `/job-requests/${jr.id}`);
      }
      await auditLog(conn, { actorId: req.user.id, action: 'request.approver.approved', entity: 'job_request', entityId: realId, details: remarks || 'Approved' });
      /* The control number is issued when the work order is created, not here:
         approving a request that may never be assigned would consume a number
         from the sequence for a work order that does not exist. Return the
         existing one if the request already carries it, so the approver's dialog
         can show the number the request will be filed under. */
      await conn.commit();
      (async () => {
        try {
          const requesterEmail = await userEmailById(pool, jr.requester_id);
          const adminEmails = await activeEmailsByRole(pool, 'admin');
          await emailFinalApproved(requesterEmail, adminEmails, { ticketNo: jr.ticket_no });
        } catch (e) {
          console.warn('[Email] approver-action approve notification error:', e.message);
        }
      })();
      return res.json({
        message: 'Final approval recorded. Now with PDAS for assignment.',
        status: 'Approved',
        officialTrackingNo: jr.official_tracking_no || null
      });
    } else {
      if (!remarks || !remarks.trim()) {
        await conn.rollback();
        return res.status(400).json({ message: 'A reason is required.' });
      }

      existingDetails.finalAction = {
        status: 'Disapproved',
        remarks: remarks.trim(),
        disapprovedBy: [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || req.user.name || 'Campus Administrator',
        disapprovedAt: new Date().toISOString()
      };

      await conn.query(
        `UPDATE job_requests SET 
           status = 'Under Review', 
           rejection_stage = 'approver', 
           rejection_remarks = ?, 
           campus_admin_remarks = ?,
           request_details = ?
         WHERE id = ?`,
        [remarks.trim(), remarks.trim(), JSON.stringify(existingDetails), realId]
      );
      await conn.query(
        'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Under Review", ?, ?)',
        [realId, jr.status, req.user.id, `Disapproved by Campus Administrator — back to PDAS: ${remarks.trim()}`]
      );
      // The System Administrator is the one who now carries it: they decide
      // whether to return it to the requester or to revise it themselves.
      await notifyAdmins(conn, 'Request Disapproved by Campus Admin', `${jr.ticket_no} was not approved and is back with PDAS: ${remarks.trim()}`, `/job-requests/${jr.id}`);
      await notify(conn, jr.requester_id, 'Request Disapproved via PDAS Admin', `${jr.ticket_no} was not approved: ${remarks.trim()} It is back with the PDAS office, which will return it to you for revision.`, `/job-requests/${jr.id}`);
      await auditLog(conn, { actorId: req.user.id, action: 'request.approver.rejected', entity: 'job_request', entityId: realId, details: remarks.trim() });
      await conn.commit();
      (async () => {
        try {
          const adminEmails = await activeEmailsByRole(pool, 'admin');
          const requesterEmail = await userEmailById(pool, jr.requester_id);
          await emailFinalRejected(adminEmails, requesterEmail, { ticketNo: jr.ticket_no, remarks: remarks.trim() });
        } catch (e) {
          console.warn('[Email] approver-action reject notification error:', e.message);
        }
      })();
      return res.json({ message: 'Not approved. Returned to the System Administrator.', status: 'Under Review' });
    }
  } catch (err) {
    await conn.rollback();
    console.error('POST /approver-action error:', err);
    res.status(500).json({ message: 'Failed to process approver action.' });
  } finally {
    conn.release();
  }
});

// Step 4: POST /api/job-requests/:id/assign-technician
// Generates an official TRK-YYYY-NNNN tracking number atomically from
// tracking_sequences (race-condition-safe) and sets the ticket to Ongoing.
router.post('/:id/assign-technician', requireRole('admin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { assignedTo, assignedToName, scheduledDate } = req.body;
    if (!assignedTo) {
      return res.status(400).json({ message: 'Maintenance personnel assignment is required.' });
    }

    /* assigned_to is a foreign key, not a name.
       The client used to send the <select>'s display value
       ("Juan Cruz — Electrical") and, when it sent nothing at all, NULL. Either
       way the row was unusable: canViewTicket() matches assigned_to = user.id, so
       the technician the work order named could never open it, and the admin
       table showed a name the database did not hold. Resolve the person and
       fail loudly if they are not a maintenance account. */
    const [[technician]] = await conn.query(
      "SELECT id, first_name, last_name FROM users WHERE id = ? AND role IN ('maintenance', 'technician') AND status = 'active'",
      [assignedTo]
    );
    if (!technician) {
      await conn.rollback();
      return res.status(400).json({
        message: 'That person is not an active maintenance account, so the work order cannot be assigned to them.'
      });
    }
    const displayName = [technician.first_name, technician.last_name].filter(Boolean).join(' ') || String(assignedToName || '');
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }
    /* This hand-rolled `jr.status !== 'Approved'` duplicated a rule that already
       existed in ticketPolicy, so it could drift from it. Use the shared guard:
       same preimage, plus the terminal-state protection. */
    const guard = assertAgainstPolicy({
      user: req.user,
      row: jr,
      target: 'Ongoing',
      actor: 'admin'
    });
    if (!guard.ok) {
      await conn.rollback();
      return res.status(guard.status).json({ message: guard.message });
    }

    // Re-use existing tracking number or generate a new atomic one.
    let officialTracking = jr.official_tracking_no || null;
    if (!officialTracking) {
      const year = new Date().getFullYear();
      await conn.query(
        'INSERT INTO tracking_sequences (`year`, last_no) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1',
        [year]
      );
      const [[{ last_no }]] = await conn.query(
        'SELECT last_no FROM tracking_sequences WHERE `year` = ?',
        [year]
      );
      officialTracking = `TRK-${year}-${String(last_no).padStart(4, '0')}`;
    }

    const isUrgent = jr.request_type === 'Urgent Request' || jr.urgency_level === 'High Risk' || jr.category === 'Urgent Hazard';

    await conn.query(
      `UPDATE job_requests SET
         assigned_to = ?,
         official_tracking_no = ?,
         scheduled_date = COALESCE(?, scheduled_date, CURDATE()),
         status = 'Ongoing',
         admin_approved = 1,
         admin_approved_at = COALESCE(admin_approved_at, NOW()),
         urgent_assigned_at = IF(? = 1, COALESCE(urgent_assigned_at, NOW()), urgent_assigned_at)
       WHERE id = ?`,
      [assignedTo, officialTracking, scheduledDate || null, isUrgent ? 1 : 0, req.params.id]
    );

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, "Ongoing", ?, ?)',
      [req.params.id, jr.status, req.user.id, `Assigned to ${displayName}. Control number ${officialTracking}.`]
    );

    await notify(conn, technician.id, 'Work Order Assigned',
      `${jr.ticket_no} is assigned to you. Control number ${officialTracking}.`,
      `/job-requests/${jr.id}`);
    await notify(conn, jr.requester_id, 'Maintenance Personnel Dispatched',
      `${jr.ticket_no} has been assigned to ${displayName}. Control number ${officialTracking}.`,
      `/job-requests/${jr.id}`);
    if (jr.supervisor_id) {
      await notify(conn, jr.supervisor_id, 'Maintenance Personnel Dispatched',
        `Maintenance personnel ${displayName} was dispatched for ${jr.ticket_no} (Control no. ${officialTracking}).`,
        `/job-requests/${jr.id}`);
    }
    await notifyAdmins(conn, 'Work order assigned',
      `${jr.ticket_no} is assigned to ${displayName}. Control number ${officialTracking}.`,
      `/job-requests/${jr.id}`, req.user.id);

    await auditLog(conn, { actorId: req.user.id, action: 'request.assigned', entity: 'job_request', entityId: jr.id, details: `Tracking: ${officialTracking}, Assignee: ${displayName} (id ${technician.id})` });
    await conn.commit();
    (async () => {
      try {
        const technicianEmail = await userEmailById(pool, technician.id);
        const requesterEmail = await userEmailById(pool, jr.requester_id);
        await emailAssigned(technicianEmail, requesterEmail, {
          ticketNo: jr.ticket_no,
          officialTracking,
          technicianName: displayName,
        });
      } catch (e) {
        console.warn('[Email] assign-technician notification error:', e.message);
      }
    })();
    res.json({ message: 'Assigned. Control number issued.', officialTrackingNo: officialTracking, status: 'Ongoing' });
  } catch (err) {
    await conn.rollback();
    console.error('POST /assign-technician error:', err);
    res.status(500).json({ message: 'Failed to assign maintenance personnel.' });
  } finally {
    conn.release();
  }
});

// Step 4: POST /api/job-requests/:id/replacement-flag
router.post('/:id/replacement-flag', requireRole('maintenance', 'technician', 'admin', 'superadmin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { reason, itemSpecs, disposition, flaggedBy } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Reason for replacement and disposal flag is required.' });
    }
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ? FOR UPDATE', [req.params.id, req.params.id, req.params.id]);
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    /* Verify that the caller is PDAS Admin/Superadmin or the technician the ticket is actually assigned to. */
    if (!isPrivileged(req.user.role) && !(isTech(req.user.role) && (Number(jr.assigned_to) === Number(req.user.id) || !jr.assigned_to))) {
      await conn.rollback();
      return res.status(403).json({
        message: 'Only PDAS Admin or the assigned maintenance personnel may flag this work order.'
      });
    }

    const isDisposal = disposition === 'disposal';
    const isCannotComplete = disposition === 'cannot_complete';
    const nextStatus = isCannotComplete ? 'On Hold' : jr.status;
    const resolvedFlaggedBy = flaggedBy || `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Maintenance';

    // For 'Cannot Complete': store scheduled follow-up data in request_details
    // JSON column (no schema change required).
    let updatedDetails = null;
    if (isCannotComplete) {
      let existingDetails = {};
      try {
        existingDetails = typeof jr.request_details === 'string'
          ? JSON.parse(jr.request_details)
          : (jr.request_details || {});
      } catch {}
      updatedDetails = JSON.stringify({
        ...existingDetails,
        maintenanceFlagType: 'Cannot Complete',
        maintenanceFlagReason: reason.trim(),
        scheduledWork: req.body.scheduledWork || '',
        scheduledDate: req.body.scheduledDate || '',
        scheduledTime: req.body.scheduledTime || ''
      });
    }

    const detailsClause = updatedDetails !== null ? ', request_details = ?' : '';
    await conn.query(
      `UPDATE job_requests SET
         status = ?,
         is_replacement_flagged = ?,
         replacement_reason = ?,
         replacement_item_specs = ?,
         replacement_procurement_status = ?,
         replacement_disposition = ?,
         replacement_flagged_by = ?,
         replacement_flagged_at = NOW()
         ${detailsClause}
       WHERE id = ?`,
      [
        nextStatus,
        isCannotComplete ? 0 : 1,
        reason.trim(),
        itemSpecs || null,
        (isDisposal || isCannotComplete) ? null : 'Pending Purchase Request (PR)',
        disposition || 'replacement',
        resolvedFlaggedBy,
        ...(updatedDetails !== null ? [updatedDetails] : []),
        jr.id
      ]
    );

    const historyRemarks = isCannotComplete
      ? `Cannot Complete flagged (Moved to On Hold): ${reason.trim()}. Proposed follow-up: ${req.body.scheduledWork || '—'}`
      : isDisposal
        ? `Asset Condemned / For Disposal Flag raised: ${reason.trim()}`
        : `Replacement Flag raised: ${reason.trim()}`;
    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [jr.id, jr.status, nextStatus, req.user.id, historyRemarks]
    );

    const notifTitle = isCannotComplete ? 'Cannot Complete Flagged (Placed On Hold)'
      : isDisposal ? 'Asset Condemned / For Disposal Flagged'
      : 'Replacement Flagged';
    const notifBody = isCannotComplete
      ? `${jr.ticket_no}: ${reason.trim()}. Ticket automatically moved to On Hold for external contractor / PDAS coordination.`
      : isDisposal
      ? `${jr.ticket_no}: Asset condemned for disposal by ${resolvedFlaggedBy}. ${reason.trim()}`
      : `${jr.ticket_no}: ${reason.trim()}. Procurement is required.`;

    // Notify PDAS Admins, Superadmins, and Campus Admins
    await notifyAdmins(conn, notifTitle, notifBody, `/replacement-requests`);
    await notifyMany(conn, await activeUserIdsByRole(conn, 'superadmin'), notifTitle, notifBody, `/replacement-requests`);
    await notifyApprovers(conn, notifTitle, notifBody, `/replacement-requests`);

    // Notify the technician confirming their technical flag report was recorded and escalated
    const techConfirmTitle = isCannotComplete
      ? `Report Recorded: Cannot Complete (${jr.ticket_no})`
      : isDisposal
        ? `Report Recorded: Asset Condemned (${jr.ticket_no})`
        : `Report Recorded: Replacement Flag (${jr.ticket_no})`;
    const techConfirmBody = isCannotComplete
      ? `Your "Cannot Complete" technical report for ${jr.ticket_no} has been recorded and escalated to PDAS Administration. The work order is now On Hold. You may view or print the PDF Technical Assessment Report from the Replacement & Flags registry.`
      : isDisposal
        ? `Your "Asset Condemned / For Disposal" report for ${jr.ticket_no} has been recorded and escalated to PDAS Administration. You may view or print the PDF Technical Assessment Report from the Replacement & Flags registry.`
        : `Your "For Replacement" report for ${jr.ticket_no} has been recorded and escalated to PDAS Administration for procurement. You may view or print the PDF Technical Assessment Report from the Replacement & Flags registry.`;
    await notify(conn, req.user.id, techConfirmTitle, techConfirmBody, `/replacement-requests`);

    await auditLog(conn, { actorId: req.user.id, action: 'request.replacement_flag', entity: 'job_request', entityId: jr.id, details: `${disposition || 'replacement'}: ${reason.trim()}` });
    await conn.commit();
    res.json({
      message: 'Outcome flag recorded. PDAS and your account were notified.',
      isReplacementFlagged: !isCannotComplete,
      status: nextStatus
    });
  } catch (err) {
    await conn.rollback();
    console.error('POST /replacement-flag error:', err);
    res.status(500).json({ message: 'Failed to raise replacement flag.' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-requests/:id/revise - Requester edits and resubmits a Returned ticket
router.put('/:id/revise', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM job_requests WHERE id = ? OR ticket_no = ? FOR UPDATE',
      [req.params.id, req.params.id]
    );
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    // Only the original requester may revise or edit the form
    if (Number(jr.requester_id) !== Number(req.user.id)) {
      await conn.rollback();
      return res.status(403).json({ message: 'Only the original requester may edit or revise this form.' });
    }

    // Once approved, the form cannot be edited
    if (jr.admin_approved === 1 || jr.campus_admin_approved === 1 || ['Approved', 'Ongoing', 'In Progress', 'Completed', 'On Hold'].includes(jr.status)) {
      await conn.rollback();
      return res.status(400).json({ message: 'This job request has already been approved and cannot be edited.' });
    }

    if (jr.status !== 'Returned') {
      await conn.rollback();
      return res.status(400).json({ message: `Only requests with status "Returned" can be revised (current status: ${jr.status}).` });
    }

    const {
      title,
      description,
      category,
      location,
      urgency,
      urgencyLevel,
      scopeOfWorks,
      photoUrl,
      photoName,
      revisionNotes
    } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      await conn.rollback();
      return res.status(400).json({ message: 'Description is required and cannot be empty.' });
    }

    const descLimitError = wordLimitError(description, DESCRIPTION_WORD_LIMIT, 'description');
    if (descLimitError) {
      await conn.rollback();
      return res.status(400).json(descLimitError);
    }

    const finalCategory = category ? matchCategory(category) : jr.category;
    if (category && !finalCategory) {
      await conn.rollback();
      return res.status(400).json({ message: `category must be one of: ${REQUEST_CATEGORIES.join(', ')}.` });
    }

    const validUrgencies = ['Low Risk', 'Medium Risk', 'High Risk'];
    const chosenUrgency = urgency || urgencyLevel || jr.urgency_level;
    const finalUrgency = validUrgencies.includes(chosenUrgency) ? chosenUrgency : normalizeUrgency(chosenUrgency);

    const finalTitle = title !== undefined ? String(title).trim().slice(0, 150) : '';
    const finalLocation = location !== undefined ? String(location).trim() : '';
    const finalSupervisor = req.body.immediateSupervisor !== undefined
      ? String(req.body.immediateSupervisor).trim()
      : (jr.immediate_supervisor || '');

    // Resolve supervisor_id if supervisor was selected or named
    let revisedSupervisorId = jr.supervisor_id;
    if (finalSupervisor) {
      const [sups] = await conn.query(
        "SELECT id, first_name, last_name FROM users WHERE (is_supervisor = 1 OR role = 'supervisor') AND status = 'active'"
      );
      const nameClean = finalSupervisor.toLowerCase();
      const hit = sups.find((s) => {
        const full = `${s.first_name} ${s.last_name}`.toLowerCase();
        return full === nameClean || nameClean.includes(full) || full.includes(nameClean);
      });
      if (hit) revisedSupervisorId = hit.id;
    }

    // Merge updated fields into request_details JSON
    let parsedDetails = {};
    try {
      parsedDetails = typeof jr.request_details === 'string' ? JSON.parse(jr.request_details) : (jr.request_details || {});
    } catch {}
    parsedDetails = {
      ...parsedDetails,
      title: finalTitle || parsedDetails.title || finalCategory || 'Facility Service Request',
      description: description.trim(),
      category: finalCategory,
      location: finalLocation || parsedDetails.location || '',
      urgency: finalUrgency,
      immediateSupervisor: finalSupervisor,
      photoUrl: photoUrl || parsedDetails.photoUrl || null,
      photoName: photoName || parsedDetails.photoName || null,
      scopeOfWorks: scopeOfWorks !== undefined ? scopeOfWorks : parsedDetails.scopeOfWorks
    };

    const resetSupervisor = Boolean(jr.supervisor_id && jr.rejection_stage === 'supervisor');

    await conn.query(
      `UPDATE job_requests SET
         description = ?,
         category = ?,
         urgency_level = ?,
         immediate_supervisor = ?,
         supervisor_id = ?,
         request_details = ?,
         photo_url = COALESCE(?, photo_url),
         photo_name = COALESCE(?, photo_name),
         status = 'Pending',
         rejection_stage = NULL,
         rejection_remarks = NULL,
         supervisor_approved = IF(?, 0, supervisor_approved),
         updated_at = NOW()
       WHERE id = ?`,
      [
        description.trim(),
        finalCategory,
        finalUrgency,
        finalSupervisor || null,
        revisedSupervisorId || null,
        JSON.stringify(parsedDetails),
        photoUrl || null,
        photoName || null,
        resetSupervisor ? 1 : 0,
        jr.id
      ]
    );

    const auditDetail = revisionNotes
      ? `Revised by requester: ${String(revisionNotes).trim()}`
      : 'Revised and resubmitted by requester';

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [jr.id, 'Returned', 'Pending', req.user.id, auditDetail]
    );

    await auditLog(conn, {
      actorId: req.user.id,
      action: 'request.requester.revised',
      entity: 'job_request',
      entityId: jr.id,
      details: auditDetail
    });

    if (resetSupervisor && jr.supervisor_id) {
      await notify(
        conn,
        jr.supervisor_id,
        'Revised Request Submitted',
        `${jr.ticket_no} was revised by ${req.user.name || 'requester'} and is ready for re-review.`,
        `/supervisor-dashboard`
      );
    }
    await notifyAdmins(
      conn,
      'Revised Request Submitted',
      `${jr.ticket_no} was revised by ${req.user.name || 'requester'} and returned to Pending.`,
      `/job-requests/${jr.id}`
    );
    await notify(
      conn,
      jr.requester_id,
      'Request Resubmitted',
      `Your revisions for ${jr.ticket_no} have been submitted for review.`,
      `/job-requests/${jr.id}`
    );

    await conn.commit();
    res.json({
      message: 'Job request revised and resubmitted successfully.',
      status: 'Pending',
      ticketNo: jr.ticket_no
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('PUT /:id/revise error:', err);
    res.status(500).json({ message: 'Failed to revise job request.' });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /api/job-requests/:id/status - Status transitions with Tri-Party Notifications
router.put('/:id/status', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { status, assignedTo, scheduledDate, remarks, materialsUsed, materials_used, completionPhotoUrl, completion_photo_url } = req.body;
    const finalMaterials = materialsUsed !== undefined ? materialsUsed : (materials_used !== undefined ? materials_used : null);
    const finalCompletionPhoto = completionPhotoUrl !== undefined ? completionPhotoUrl : (completion_photo_url !== undefined ? completion_photo_url : null);
    if (typeof finalCompletionPhoto === 'string' && finalCompletionPhoto.length > 5 * 1024 * 1024) {
      return res.status(413).json({ message: 'The attached completion photo is too large. Please attach one under 5MB.' });
    }
    const targetStatus = normalizeStatus(status);
    if (!targetStatus) {
      return res.status(400).json({ message: 'Unrecognized status. Use Pending, Under Review, Awaiting Signatures, Pending Final Approval, Approved, Ongoing, On Hold, Returned, Completed, or Rejected.' });
    }

    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ? FOR UPDATE', [req.params.id, req.params.id, req.params.id]);
    const jobRequest = rows[0];
    if (!jobRequest) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    const currentStatus = jobRequest.status;
    const role = req.user.role;

    // Single source of truth lives in utils/ticketPolicy.js (unit-tested).
    const decision = authorizeStatusChange(req.user, jobRequest, targetStatus);
    if (!decision.ok) {
      await conn.rollback();
      return res.status(decision.status).json({ message: decision.message });
    }
    // Technicians may never reassign tickets.
    if (isTech(role) && assignedTo !== undefined && assignedTo !== jobRequest.assigned_to) {
      await conn.rollback();
      return res.status(403).json({ message: 'Technicians cannot reassign tickets.' });
    }

    const completedAt = targetStatus === 'Completed' ? new Date() : jobRequest.completed_at;
    let effectiveAssignee = assignedTo !== undefined ? (assignedTo || null) : jobRequest.assigned_to;
    if (isTech(role) && !effectiveAssignee) {
      effectiveAssignee = req.user.id;
    }
    const approverId = ['Approved', 'Ongoing', 'Completed'].includes(targetStatus) ? (jobRequest.approved_by || req.user.id) : jobRequest.approved_by;

    let existingDetails = {};
    try {
      existingDetails = typeof jobRequest.request_details === 'string'
        ? JSON.parse(jobRequest.request_details)
        : (jobRequest.request_details || {});
    } catch {}
    if (finalMaterials !== null) {
      existingDetails.materialsUsed = finalMaterials;
    }
    if (finalCompletionPhoto !== null) {
      existingDetails.completionPhotoUrl = finalCompletionPhoto;
    }

    const isUrgent =
      jobRequest.request_type === 'Urgent Request' ||
      jobRequest.urgency_level === 'High Risk' ||
      jobRequest.category === 'Urgent Hazard';
    const shouldSetUrgentAssignedAt = Boolean(isUrgent && (effectiveAssignee || targetStatus === 'Ongoing'));

    await conn.query(
      `UPDATE job_requests SET
         status = ?,
         assigned_to = ?,
         approved_by = ?,
         scheduled_date = COALESCE(?, scheduled_date),
         completed_at = ?,
         materials_used = IF(? IS NOT NULL, ?, materials_used),
         completion_photo_url = IF(? IS NOT NULL, ?, completion_photo_url),
         urgent_assigned_at = IF(? = 1, COALESCE(urgent_assigned_at, NOW()), urgent_assigned_at),
         request_details = ?
       WHERE id = ?`,
      [
        targetStatus,
        effectiveAssignee,
        approverId,
        scheduledDate || null,
        completedAt,
        finalMaterials,
        finalMaterials,
        finalCompletionPhoto,
        finalCompletionPhoto,
        shouldSetUrgentAssignedAt ? 1 : 0,
        JSON.stringify(existingDetails),
        jobRequest.id
      ]
    );

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [jobRequest.id, currentStatus, targetStatus, req.user.id, remarks || `Status changed to ${targetStatus}`]
    );
    await auditLog(conn, {
      actorId: req.user.id,
      action: `request.status.${targetStatus}`,
      entity: 'job_request',
      entityId: jobRequest.id,
      details: `${currentStatus} -> ${targetStatus}${remarks ? `: ${remarks}` : ''}`,
    });

    // ── Manuscript Section 10: TRI-PARTY NOTIFICATIONS ─────────────────────────
    // 1. Notify Requester
    await notify(
      conn,
      jobRequest.requester_id,
      `Ticket Status: ${targetStatus}`,
      `${jobRequest.ticket_no} is now ${targetStatus}.${remarks ? ` ${remarks}` : ''}`,
      `/job-requests/${req.params.id}`
    );

    // 2. Notify Assigned Maintenance Technician (if assigned)
    if (effectiveAssignee) {
      await notify(
        conn,
        effectiveAssignee,
        `Task Update: ${targetStatus}`,
        `${jobRequest.ticket_no} is now ${targetStatus}.`,
        `/job-requests/${req.params.id}`
      );
    }

    // 3. Notify PDAS Admins (if action was performed by technician/requester or to keep all admins in sync)
    await notifyAdmins(
      conn,
      `Status Update: ${jobRequest.ticket_no}`,
      `${jobRequest.ticket_no} moved from ${currentStatus} to ${targetStatus}.`,
      `/job-requests/${req.params.id}`,
      req.user.role === 'admin' ? req.user.id : null // avoid duplicate if performing admin
    );

    // Special: If Completed, notify requester and administrators that work is successfully completed
    if (targetStatus === 'Completed') {
      await notify(
        conn,
        jobRequest.requester_id,
        `Client Satisfaction Feedback Required: ${jobRequest.ticket_no}`,
        `Your maintenance request ${jobRequest.ticket_no} has been marked Completed by maintenance. Please submit your Client Satisfaction Measurement (CSM) feedback.`,
        `/job-requests/${req.params.id}`
      );

      await notifyAdmins(
        conn,
        `Work Completed: ${jobRequest.ticket_no}`,
        `Maintenance for ${jobRequest.ticket_no} was successful and completed by the technician.`,
        `/job-requests/${req.params.id}`
      );

      if (jobRequest.supervisor_id) {
        await notify(
          conn,
          jobRequest.supervisor_id,
          `Work Completed: ${jobRequest.ticket_no}`,
          `Maintenance work for ${jobRequest.ticket_no} has been completed by the technician.`,
          `/job-requests/${req.params.id}`
        );
      }
    }

    await conn.commit();
    if (targetStatus === 'Completed') {
      (async () => {
        try {
          const requesterEmail = await userEmailById(pool, jobRequest.requester_id);
          await emailCompleted(requesterEmail, { ticketNo: jobRequest.ticket_no });
        } catch (e) {
          console.warn('[Email] status update Completed notification error:', e.message);
        }
      })();
    }
    res.json({ message: `Job request updated to ${targetStatus}.`, status: targetStatus });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /job-requests/:id/status error:', err);
    res.status(500).json({ message: 'Failed to update job request.' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-requests/:id/signed-form — Optional archive attachment endpoint
// for recording physical QF-PDAS-DC-01 hardcopy verification when requested.
router.put('/:id/signed-form', requireRole('superadmin', 'admin', 'campus_admin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { confirmed, scanRef = '' } = req.body;
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ? FOR UPDATE', [req.params.id, req.params.id, req.params.id]);
    const jobRequest = rows[0];
    if (!jobRequest) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }
    if (!['Under Review', 'Awaiting Signatures', 'Pending Final Approval'].includes(jobRequest.status)) {
      await conn.rollback();
      return res.status(422).json({ message: 'Signed-form confirmation only applies while a ticket is Under Review, Awaiting Signatures, or Pending Final Approval.' });
    }
    let existingDetails = {};
    try {
      existingDetails = typeof jobRequest.request_details === 'string'
        ? JSON.parse(jobRequest.request_details)
        : (jobRequest.request_details || {});
    } catch {}
    if (scanRef) {
      existingDetails.signedFormScanUrl = String(scanRef);
    }
    await conn.query(
      'UPDATE job_requests SET signed_form_confirmed = ?, signed_form_confirmed_by = ?, signed_form_confirmed_at = ?, request_details = ? WHERE id = ?',
      [confirmed === false ? 0 : 1, req.user.id, new Date(), JSON.stringify(existingDetails), jobRequest.id]
    );
    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [jobRequest.id, jobRequest.status, jobRequest.status, req.user.id, confirmed === false ? 'Signed-form confirmation revoked.' : `Physically signed form confirmed${scanRef ? ` (ref attached)` : ''}.`]
    );
    await auditLog(conn, {
      actorId: req.user.id,
      action: confirmed === false ? 'request.signedform.revoked' : 'request.signedform.confirmed',
      entity: 'job_request',
      entityId: jobRequest.id,
      details: String(scanRef || '').slice(0, 200),
    });
    await conn.commit();
    res.json({ message: confirmed === false ? 'Signed-form confirmation revoked.' : 'Signed form confirmed. The ticket may now proceed to approval.', signedFormConfirmed: confirmed !== false });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /job-requests/:id/signed-form error:', err);
    res.status(500).json({ message: 'Failed to confirm signed form.' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-requests/:id/complete-standard-form - Urgent requests completing full form details
router.put('/:id/complete-standard-form', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const {
      immediateSupervisor,
      description,
      scopeOfWorks,
      title,
      category,
      location,
      building,
      floor,
      room,
      contactNumber,
      photoUrl,
      photoName
    } = req.body;
    // immediate_supervisor is VARCHAR(150) with no strict mode, so an
    // over-length name would be silently cut.
    const tooLong = lengthErrors([
      ['Immediate supervisor', immediateSupervisor, VARCHAR_LIMITS.immediateSupervisor]
    ]);
    if (tooLong) {
      return res.status(400).json(tooLong);
    }
    await conn.beginTransaction();

    /* Lock the row before reading it. Support lookup by id, ticket_no, or official_tracking_no. */
    const [ownerRows] = await conn.query(
      'SELECT id, ticket_no, requester_id, status, description, immediate_supervisor, supervisor_id, request_details FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ? FOR UPDATE',
      [req.params.id, req.params.id, req.params.id]
    );
    if (ownerRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }
    if (Number(ownerRows[0].requester_id) !== Number(req.user.id)) {
      await conn.rollback();
      return res.status(403).json({ message: 'Only the original requester can complete this form.' });
    }
    // Word cap on the completed description, matching the create endpoint so
    // a requester cannot bypass the limit by filing it as a later amendment.
    if (description) {
      const err = wordLimitError(description, DESCRIPTION_WORD_LIMIT, 'description');
      if (err) {
        await conn.rollback();
        return res.status(400).json(err);
      }
    }

    let parsedDetails = {};
    try {
      parsedDetails = typeof ownerRows[0].request_details === 'string'
        ? JSON.parse(ownerRows[0].request_details)
        : (ownerRows[0].request_details || {});
    } catch {}

    if (scopeOfWorks) parsedDetails.scopeOfWorks = scopeOfWorks;
    if (description) parsedDetails.description = description;
    if (immediateSupervisor) parsedDetails.immediateSupervisor = immediateSupervisor;
    if (title) parsedDetails.title = title;
    if (category) parsedDetails.category = category;
    if (location) parsedDetails.location = location;
    if (building) parsedDetails.building = building;
    if (floor) parsedDetails.floor = floor;
    if (room) parsedDetails.room = room;
    if (contactNumber) parsedDetails.contactNumber = contactNumber;
    if (photoUrl) parsedDetails.photoUrl = photoUrl;
    if (photoName) parsedDetails.photoName = photoName;

    // Resolve supervisor_id if a supervisor was named or selected
    let resolvedSupervisorId = ownerRows[0].supervisor_id;
    if (immediateSupervisor) {
      const [sups] = await conn.query(
        "SELECT id, first_name, last_name FROM users WHERE (is_supervisor = 1 OR role = 'supervisor') AND status = 'active'"
      );
      const nameClean = String(immediateSupervisor).toLowerCase();
      const hit = sups.find((s) => {
        const full = `${s.first_name} ${s.last_name}`.toLowerCase();
        return full === nameClean || nameClean.includes(full) || full.includes(nameClean);
      });
      if (hit) resolvedSupervisorId = hit.id;
    }

    await conn.query(
      `UPDATE job_requests SET
         is_standard_form_filled = TRUE,
         urgent_overdue_notified = 0,
         admin_approved = 0,
         immediate_supervisor = COALESCE(?, immediate_supervisor),
         supervisor_id = COALESCE(?, supervisor_id),
         description = COALESCE(?, description),
         photo_url = COALESCE(?, photo_url),
         photo_name = COALESCE(?, photo_name),
         request_details = ?
       WHERE id = ?`,
      [
        immediateSupervisor || null,
        resolvedSupervisorId || null,
        description || null,
        photoUrl || null,
        photoName || null,
        JSON.stringify(parsedDetails),
        ownerRows[0].id
      ]
    );

    /* Traceable audit trail entry */
    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [
        ownerRows[0].id,
        ownerRows[0].status,
        ownerRows[0].status,
        req.user.id,
        'Follow-up QF-PDAS-DC-01 form submitted by requester. Routed to Admin for electronic approval (Supervisor and Approver notified for information only).'
      ]
    );

    // Notify Supervisor for information only (no approval required)
    await notifySupervisors(
      conn,
      `Follow-up Form Submitted: ${ownerRows[0].ticket_no}`,
      `${req.user.email} submitted the official follow-up form for resolved urgent incident ${ownerRows[0].ticket_no}. (For information only — routed to Admin for electronic approval).`,
      `/supervisor-dashboard`
    );

    // Notify Campus Admin Approvers for information only (no approval required)
    await notifyApprovers(
      conn,
      `Follow-up Form Submitted: ${ownerRows[0].ticket_no}`,
      `${req.user.email} submitted the official follow-up form for resolved urgent incident ${ownerRows[0].ticket_no}. (For information only — routed to Admin for electronic approval).`,
      `/campus-admin-dashboard`
    );

    // Notify Admin: Action required for electronic approval
    await notifyAdmins(
      conn,
      `Action Required: Approve Follow-up Form (${ownerRows[0].ticket_no})`,
      `${req.user.email} submitted the follow-up QF-PDAS-DC-01 form for resolved urgent ticket ${ownerRows[0].ticket_no}. Awaiting your electronic approval.`,
      `/job-requests`
    );

    await auditLog(conn, {
      actorId: req.user.id,
      action: 'request.standard_form_completed',
      entity: 'job_request',
      entityId: req.params.id,
      details: ownerRows[0].ticket_no
    });

    await conn.commit();
    res.json({ message: 'Follow-up form submitted and routed to Admin for electronic approval.' });
  } catch (err) {
    await conn.rollback();
    console.error('complete-standard-form error:', err);
    res.status(500).json({ message: 'Failed to update form.' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-requests/:id/approve-follow-up
// Allows PDAS Admin (or Campus Admin) to electronically approve the post-incident follow-up form.
router.put('/:id/approve-follow-up', requireRole('admin', 'campus_admin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }
    const jr = rows[0];
    const remarks = req.body.remarks || 'Follow-up QF-PDAS-DC-01 form electronically signed by PDAS Admin';

    await conn.query(
      `UPDATE job_requests SET
         admin_approved = 1,
         admin_approved_at = NOW(),
         admin_remarks = ?,
         is_standard_form_filled = TRUE
       WHERE id = ?`,
      [remarks, req.params.id]
    );

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, jr.status, jr.status, req.user.id, `Follow-up QF-PDAS-DC-01 Form electronically signed by PDAS Admin: ${remarks}`]
    );

    await notify(
      conn,
      jr.requester_id,
      'Follow-up Form Approved',
      `Your follow-up QF-PDAS-DC-01 form for ${jr.ticket_no} has been electronically signed by PDAS Admin.`,
      `/faculty-staff-portal`
    );

    await notifySupervisors(
      conn,
      `Follow-up Form Approved: ${jr.ticket_no}`,
      `Follow-up form for ${jr.ticket_no} has been electronically signed by PDAS Admin.`,
      `/supervisor-dashboard`
    );

    await notifyApprovers(
      conn,
      `Follow-up Form Approved: ${jr.ticket_no}`,
      `Follow-up form for ${jr.ticket_no} has been electronically signed by PDAS Admin.`,
      `/campus-admin-dashboard`
    );

    await auditLog(conn, {
      actorId: req.user.id,
      action: 'request.follow_up_approved',
      entity: 'job_request',
      entityId: jr.id,
      details: remarks
    });

    await conn.commit();
    res.json({ message: 'Follow-up form electronically signed.' });
  } catch (err) {
    await conn.rollback();
    console.error('approve-follow-up error:', err);
    res.status(500).json({ message: 'Failed to approve follow-up form.' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-requests/:id/replacement-flag - Flag irreparable item for procurement
router.put('/:id/replacement-flag', requireRole('maintenance', 'technician', 'admin', 'superadmin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { reason, itemSpecs, procurementStatus, disposition, flaggedBy } = req.body;
    // replacement_procurement_status is VARCHAR(100) and came straight from the
    // body with no allow-list, so any value could be written and an over-length
    // one would be silently cut.
    if (procurementStatus) {
      const tooLong = lengthError(
        procurementStatus,
        VARCHAR_LIMITS.procurementStatus,
        'Procurement status'
      );
      if (tooLong) {
        await conn.rollback();
        return res.status(400).json(tooLong);
      }
    }
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM job_requests WHERE id = ? FOR UPDATE', [req.params.id]);
    const jobRequest = rows[0];
    if (!jobRequest) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }
    // Only PDAS Admin or maintenance personnel can update replacement flags.
    if (!isPrivileged(req.user.role) && !(isTech(req.user.role) && (Number(jobRequest.assigned_to) === Number(req.user.id) || !jobRequest.assigned_to))) {
      await conn.rollback();
      return res.status(403).json({ message: 'Only PDAS Admin or maintenance personnel can update replacement flags.' });
    }

    const isOnlyProcurementUpdate = Boolean(procurementStatus && !reason);
    const resolvedProcurement = procurementStatus
      ? procurementStatus
      : (disposition === 'disposal' ? null : (jobRequest.replacement_procurement_status || 'Pending Purchase Request (PR)'));

    await conn.query(
      `UPDATE job_requests SET
         is_replacement_flagged = TRUE,
         replacement_reason = ?,
         replacement_item_specs = ?,
         replacement_procurement_status = ?,
         replacement_disposition = COALESCE(?, replacement_disposition, 'replacement'),
         replacement_flagged_by = COALESCE(?, replacement_flagged_by),
         replacement_flagged_at = COALESCE(replacement_flagged_at, NOW())
       WHERE id = ?`,
      [
        reason || jobRequest.replacement_reason || 'Irreparable defect reported.',
        itemSpecs || jobRequest.replacement_item_specs || 'Standard replacement unit',
        resolvedProcurement,
        disposition || null,
        flaggedBy || null,
        req.params.id
      ]
    );

    const historyRemarks = isOnlyProcurementUpdate
      ? `Procurement status updated to: ${procurementStatus}`
      : `Irreparable item / disposal flagged: ${reason || 'Flagged for review'}`;

    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, jobRequest.status, jobRequest.status, req.user.id, historyRemarks]
    );

    if (!isOnlyProcurementUpdate) {
      await notifyAdmins(
        conn,
        disposition === 'disposal' ? 'Asset disposal flagged' : 'Replacement flagged',
        `${jobRequest.ticket_no} was flagged for ${disposition === 'disposal' ? 'disposal' : 'procurement replacement'}.`,
        `/job-requests/${req.params.id}`
      );
    }

    await conn.commit();
    res.json({ message: 'Replacement recorded.' });
  } catch (err) {
    await conn.rollback();
    console.error('replacement-flag error:', err);
    res.status(500).json({ message: 'Failed to flag replacement.' });
  } finally {
    conn.release();
  }
});

/* Archive and restore.
   Both used to be a bare UPDATE with no transaction and no audit row at all,
   even though the audit trail is documented as covering "archive, deletions".
   A record could move in or out of the archive with nobody accountable. Both now
   write the audit entry through the same connection, inside the transaction. */
router.put('/:id/archive', requireRole('admin', 'superadmin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT * FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ? FOR UPDATE',
      [req.params.id, req.params.id, req.params.id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }
    const realId = rows[0].id;
    if (rows[0].is_archived) {
      await conn.rollback();
      return res.status(409).json({ message: 'This request is already archived.' });
    }
    await conn.query(
      'UPDATE job_requests SET is_archived = TRUE, archived_at = NOW() WHERE id = ?',
      [realId]
    );
    await auditLog(conn, {
      actorId: req.user.id,
      action: 'request.archived',
      entity: 'job_request',
      entityId: realId,
      details: rows[0].official_tracking_no || rows[0].ticket_no || String(realId)
    });
    await conn.commit();
    res.json({ message: 'Job request moved to long-term archive.' });
  } catch (err) {
    await conn.rollback();
    console.error('archive error:', err);
    res.status(500).json({ message: 'Failed to archive job request.' });
  } finally {
    conn.release();
  }
});

router.put('/:id/unarchive', requireRole('admin', 'superadmin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT * FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ? FOR UPDATE',
      [req.params.id, req.params.id, req.params.id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }
    const realId = rows[0].id;
    if (!rows[0].is_archived) {
      await conn.rollback();
      return res.status(409).json({ message: 'This request is not archived.' });
    }
    await conn.query(
      'UPDATE job_requests SET is_archived = FALSE, archived_at = NULL WHERE id = ?',
      [realId]
    );
    await auditLog(conn, {
      actorId: req.user.id,
      action: 'request.unarchived',
      entity: 'job_request',
      entityId: realId,
      details: rows[0].official_tracking_no || rows[0].ticket_no || String(realId)
    });
    await conn.commit();
    res.json({ message: 'Job request restored from archive.' });
  } catch (err) {
    await conn.rollback();
    console.error('unarchive error:', err);
    res.status(500).json({ message: 'Failed to restore job request.' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-requests/:id/tracking-no - Admin manual override of official tracking / control number
router.put('/:id/tracking-no', requireRole('admin', 'superadmin'), async (req, res) => {
  let conn;
  try {
    const clean = String(req.body?.officialTrackingNo || req.body?.trackingNo || '').trim().slice(0, 50);
    if (!clean) {
      return res.status(400).json({ message: 'A non-empty tracking number is required.' });
    }
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ? FOR UPDATE',
      [req.params.id, req.params.id, req.params.id]
    );
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    const [conflict] = await conn.query(
      'SELECT id, ticket_no FROM job_requests WHERE id <> ? AND (LOWER(official_tracking_no) = LOWER(?) OR LOWER(ticket_no) = LOWER(?)) LIMIT 1',
      [jr.id, clean, clean]
    );
    if (conflict.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: `Tracking number "${clean}" is already assigned to another request.` });
    }

    await conn.query(
      'UPDATE job_requests SET official_tracking_no = ?, updated_at = NOW() WHERE id = ?',
      [clean, jr.id]
    );
    await conn.query(
      'INSERT INTO job_request_status_history (job_request_id, from_status, to_status, changed_by, remarks) VALUES (?, ?, ?, ?, ?)',
      [jr.id, jr.status, jr.status, req.user.id, `Tracking/control number set to ${clean}`]
    );
    await auditLog(conn, {
      actorId: req.user.id,
      action: 'request.tracking_no.updated',
      entity: 'job_request',
      entityId: jr.id,
      details: `${jr.ticket_no}: official_tracking_no -> ${clean}`,
    });
    await conn.commit();
    res.json({ message: 'Tracking number updated.', officialTrackingNo: clean });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('PUT /:id/tracking-no error:', err);
    res.status(500).json({ message: 'Failed to update tracking number.' });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /api/job-requests/:id/form-details - Persist pre-print form detail edits and completion photo
router.put('/:id/form-details', requireRole('admin', 'superadmin', 'campus_admin', 'maintenance', 'technician'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM job_requests WHERE id = ? OR ticket_no = ? OR official_tracking_no = ? FOR UPDATE',
      [req.params.id, req.params.id, req.params.id]
    );
    const jr = rows[0];
    if (!jr) {
      await conn.rollback();
      return res.status(404).json({ message: 'Job request not found.' });
    }

    let existingDetails = {};
    try {
      existingDetails = typeof jr.request_details === 'string'
        ? JSON.parse(jr.request_details)
        : (jr.request_details || {});
    } catch {}

    const patch = req.body || {};
    const allowedKeys = [
      'title',
      'description',
      'location',
      'building',
      'floor',
      'room',
      'scopeOfWorks',
      'actionTaken',
      'finalAction',
      'notes',
      'materialsUsed',
      'completionPhotoUrl',
      'signedFormScanUrl',
    ];
    for (const k of allowedKeys) {
      if (patch[k] !== undefined) {
        existingDetails[k] = patch[k];
      }
    }

    const nextDescription = typeof patch.description === 'string' && patch.description.trim()
      ? patch.description.trim()
      : jr.description;
    const nextCompletionPhoto = patch.completionPhotoUrl !== undefined
      ? patch.completionPhotoUrl
      : null;

    await conn.query(
      `UPDATE job_requests SET
         description = ?,
         completion_photo_url = IF(? IS NOT NULL, ?, completion_photo_url),
         request_details = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [nextDescription, nextCompletionPhoto, nextCompletionPhoto, JSON.stringify(existingDetails), jr.id]
    );

    await auditLog(conn, {
      actorId: req.user.id,
      action: 'request.form_details.updated',
      entity: 'job_request',
      entityId: jr.id,
      details: `Updated QF-PDAS-DC-01 form details for ${jr.ticket_no}`,
    });

    await conn.commit();
    res.json({ message: 'Form details saved.', details: existingDetails });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('PUT /:id/form-details error:', err);
    res.status(500).json({ message: 'Failed to update form details.' });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
