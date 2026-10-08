# 03 — Workflow Traces

Ten workflows traced end to end through the code. Every hop cites `path:line`, a table/column, or
an API route. Trace method: start at the UI entry point, follow the state update, then the network
call, then the SQL statement, then the read-back. Where a hop is absent the trace says so and cites
the search terms used.

Statuses used: **MATCH** (paper behaviour reached), **PARTIAL** (reached with a missing hop),
**DIFFERENT** (reached by a different route than the paper describes), **BLOCKED** (cannot be
completed by the actor the paper gives the step to).

---

## W1 — Submitting a maintenance request (requester → Immediate Supervisor)

**Paper:** `ch1.md:99` (identify location by QR or manual → fill the form → `ch1.md:102` requester
confirmation), `ch3.md:94` (Faculty/Staff sequence), `ch3.md:115` (one requester, one location).

| # | Hop | Evidence |
|---|---|---|
| 1 | Faculty/Staff opens **New Request** | `RequestIntakeActions` → `RequestIntake.jsx:43-49` |
| 2 | Location step: scan QR or pick from dropdown | `JobRequestLocationStep.jsx:15-31` (`buildBuildingIndex`, fallback to `CAMPUS_ROOM_QR_PRESETS`), floor/room selects `:44+`, manual dropdown fallback `:83-97` |
| 3 | Scanner resolves the payload | `QrCodeScannerModal.jsx:246-302` (`qrCodeRef` direct `:250-252`, JSON `:268`, URL `:284`, `ISATU-…` delimited `:294/:302`); preset table `:11-103` |
| 4 | Overlay collects category, description, urgency, photo, supervisor | `JobRequestFormOverlay.jsx:95` (photo input), `:183-210` (resize + `toDataURL('image/jpeg',0.7)` at `:210`), `:236-291` (confirmation prompt) |
| 5 | Payload assembled | `jobRequestIntake.js:90-151` — `title, description, building, floor, room, location, qrCodeRef, category, urgency, requestType, isStandardFormFilled, immediateSupervisor, scopeOfWorks, actionTaken, finalAction, pdasFormName, requestedBy, requesterEmail, requesterRole, department, contactNumber, idNumber, photoUrl, isDraft` |
| 6 | **Hop removed:** payload slimmed before send | `DataContext.jsx:1006-1021` sends only `category, description, urgencyLevel, requestType, isStandardFormFilled, immediateSupervisor, isDraft, locationId`. **`photoUrl`, `building`, `floor`, `room`, `location`, `qrCodeRef` are all dropped here.** |
| 7 | Offline? queue instead of failing | `outbox.js:138-167` `submitOrQueue` — queues when `navigator.onLine === false` or on 0/5xx, never on 4xx; key minted per attempt `:26-34` |
| 8 | POST `/api/job-requests` | `api.js` `apiCreateJobRequest` → `requisitionRoutes.js:332` |
| 9 | Idempotency check (replay returns the original ticket) | `requisitionRoutes.js:348-375`, unique index `idempotency_key` |
| 10 | Supervisor resolution: explicit `supervisor_id`, else name match | `requisitionRoutes.js:442-471` |
| 11 | Auto-endorse if the requester *is* the supervisor or has none | `requisitionRoutes.js:473-551`; the reason string `"the requester is the Supervisor of their own unit and no other Supervisor is assigned to them"` at `:474-476`; admins told at `:568-576` |
| 12 | Ticket number minted in-transaction | `requisitionRoutes.js:494`, sequence `ticket_sequences` |
| 13 | **Hop removed:** `locationId` | `requisitionRoutes.js:503` `locationId ?? null` — and step 6 never supplies one, so it is `NULL`. `POST /` body reads it at `:337` |
| 14 | INSERT | `requisitionRoutes.js:496-516` — columns `(ticket_no, requester_id, location_id, category, description, urgency_level, request_type, is_standard_form_filled, immediate_supervisor, supervisor_id, status, requester_approved, requester_approved_at, idempotency_key)` |
| 15 | Status = `Pending Supervisor Approval` (or auto-endorsed onward) | `requisitionRoutes.js:489-491` |
| 16 | Status history row | `requisitionRoutes.js:518-521` → `job_request_status_history` |
| 17 | Notifications: approvers, supervisors-or-endorsement notice, requester | `requisitionRoutes.js:556-566` (admins + approvers), `:579-584` (`notifySupervisors`), `:588-594` (requester) |
| 18 | Audit row inside the same commit | `requisitionRoutes.js:602` |
| 19 | Read-back | `GET /` `requisitionRoutes.js:158`, scope `:127-155`, High-Risk-first `:205-213`, mapping `DataContext.jsx:478-490` |

**Status: PARTIAL.** The request is filed and routed correctly, but `location_id` is `NULL` on
write (hop 13) and the photo never leaves the browser (hop 6), so read-back degrades to
`'Campus Facilities'` (`DataContext.jsx:490`) and the ticket has no image.

---

## W2 — Requester confirmation of the form (electronic approval level 1 of 4)

**Paper:** `ch1.md:102` — "the requester confirms through a prompt… If the requester does not
confirm, the request stays as a draft."

| # | Hop | Evidence |
|---|---|---|
| 1 | Overlay opens with the prefilled form | `JobRequestFormOverlay.jsx:556-626` |
| 2 | Prompt rendered with the exact wording | `JobRequestFormOverlay.jsx:236-291` |
| 3 | Decline → stays a draft | `JobRequestFormOverlay.jsx:268-277` sets draft; server `requisitionRoutes.js:490-491` `requesterApproved = isDraft ? 0 : 1` |
| 4 | Accept → flag + timestamp written | `requisitionRoutes.js:496, 499` (`requester_approved`, `requester_approved_at`) |
| 5 | Cannot proceed without it | `ticketPolicy.js:158-161` — `Under Review`/`Pending Final Approval` blocked unless `supervisor_approved`, which itself presupposes a filed (confirmed) request |

**Status: MATCH.**

---

## W3 — Four-level approval sequence, including returns with remarks

**Paper:** `ch1.md:102-103`, `ch3.md:7` "four electronic approvals **in sequence**… a request that
is not approved is returned to the requester with remarks for revision", `ch3.md:70` "the requester
edits the request, submits it again."

### W3a Forward path

| Level | Paper actor | Route | Gate | Result status | Evidence |
|---|---|---|---|---|---|
| 1 | Immediate Supervisor (designated faculty/staff) | `POST /:id/supervisor-action` `requisitionRoutes.js:636` | `requireRole('supervisor')` + `assertAgainstPolicy` `:662` + `canSuperviseTicket` `ticketPolicy.js:102-119` | `Under Review` | `requisitionRoutes.js:668`; requester told `:692`; audit `:693` |
| 2 | System Administrator (PDAS Head) | `POST /:id/admin-action` `requisitionRoutes.js:729` | `requireRole('admin')` + `assertAgainstPolicy` `:755` | `Pending Final Approval` | targets `{evaluate:'Under Review', approve:'Pending Final Approval', reject:'Returned'}` `:739`; requester told `:789`; audit `:790` |
| 3 | Approver (Campus Administrator) | `POST /:id/approver-action` `requisitionRoutes.js:827` | `requireRole('campus_admin')` + `assertAgainstPolicy` `:855` | `Approved` | `:858`; requester told `:885`; audit `:886` |
| 4 | (Work-order assignment by the System Administrator) | `POST /:id/assign-technician` `requisitionRoutes.js:936` | `requireRole('admin')` + `assertAgainstPolicy(target:'Ongoing')` `:973` | see W6 | audit `:1024` |

Ordering is not left to the UI: `missingApprovalFor()` requires `supervisor_approved` before
`Under Review` and `Pending Final Approval` (`ticketPolicy.js:158-161`), `admin_approved` **and**
`campus_admin_approved` before `Approved` (`:162-165`), and `campus_admin_approved` before
`Ongoing` (`:168-170`). The generic write path applies the same rules through
`authorizeStatusChange` at `requisitionRoutes.js:1123`.

### W3b Return path

| Hop | Evidence |
|---|---|
| Supervisor declines with remarks | `requisitionRoutes.js:670-686`, target `'Returned'` `:668` |
| PDAS admin returns with combined remarks | `requisitionRoutes.js:799-810`, target `'Returned'` `:739`, audit `:810` |
| Approver declines → routed back **through PDAS**, not straight to the requester | `requisitionRoutes.js:848-860` target `'Under Review'`, comment at `:844-847` |
| `Returned` is non-terminal | `ticketPolicy.js:53-56` `'Returned': ['Pending', 'Rejected']` |
| Requester told with the remarks | `requisitionRoutes.js:714` (supervisor), `:809` (PDAS), `:919` (approver-decline variant) |
| **BLOCKED: requester edits and resubmits** | No edit action exists for the requester: `FacultyStaffPortal.jsx:485-502` renders only **Details** and **Slip**. Grep `updateRequisitionsStatus\|updateRequisitionStatus(` call sites → `WorkQueue.jsx:242,269` and `JobRequests.jsx:316,319,334` — **none is the requester**. Server side: `authorizeStatusChange` returns 403 for non-privileged actors unless the assigned tech marks their own `Ongoing → Completed` (`ticketPolicy.js:182-190`), and the transition `Returned → Pending` (`ticketPolicy.js:56`) can only be triggered from the admin's "Restore to Pending" (`JobRequests.jsx:315-316`) |

**Status: MATCH on the sequence and its server-side enforcement. BLOCKED on the revise-and-resubmit
leg, which the paper assigns to the requester (`ch3.md:70`).**

---

## W4 — Urgent / High Risk fast path

**Paper:** `ch1.md:103` — "High Risk requests can be reported immediately using only the essential
details (**location and issue type**)… the requester is still expected to complete the full form
**within the same day**."

| # | Hop | Evidence |
|---|---|---|
| 1 | Entry point | `RequestIntakeActions` → `RequestIntake.jsx:195-201` |
| 2 | Dialog states the rule verbatim | `UrgentIssueReport.jsx:10-16` |
| 3 | Only location + issue type + optional notes are collected | `UrgentIssueReport.jsx:18-27` `URGENT_ISSUE_TYPES`, fields `:39-41` |
| 4 | Submitted as a partial request | `RequestIntake.jsx:206-224` → `category:'Urgent Hazard'`, `requestType:'Urgent Request'`, `isStandardFormFilled:false` (`jobRequestIntake.js:130`), `urgency` forced `'High Risk'` (`jobRequestIntake.js:128`) |
| 5 | Server forces the same values | `requisitionRoutes.js:96` maps `urgent` → `'High Risk'`; `:423` `finalReqType = 'Urgent Request'` |
| 6 | Admin alerted with a distinct title | `requisitionRoutes.js:556-560` `"High Risk request filed"` |
| 7 | Sorts to the top of the queue | `requisitionRoutes.js:205-213` `ORDER BY CASE jr.urgency_level WHEN 'High Risk' THEN 1 …` |
| 8 | Deadline recorded on the client | `DataContext.jsx:952` `urgentDeadline: 'Within Today (24 Hours)'`; banner `FacultyStaffPortal.jsx:340-375` |
| 9 | **Missing: same-day enforcement** | Grep `urgentDeadline` across `frontend/src` → **1 match only** (`DataContext.jsx:952`), never read back for a deadline check. Grep `expiry\|overdue\|deadline.*enforce\|isPastDay` in `backend/src` → **no matches**. `PUT /:id/complete-standard-form` (`requisitionRoutes.js:1259`) has no day-boundary guard at `:1259-1346` |
| 10 | Full form completed later | `completeStandardFormForUrgent` `DataContext.jsx:1296`, admin helper `ModularFormPreviewPanel.jsx:63-66` |

**Status: PARTIAL.** The fast path conforms exactly; the "within the same day" obligation is
recorded as a string but never enforced.

---

## W5 — Technician assignment and the official tracking number

**Paper:** `ch1.md:103` "the System Administrator generates the official tracking number, the
request becomes Approved, and it is assigned to maintenance personnel"; `ch3.md:106` "When the
personnel **start the work**, the module saves the **Ongoing** status"; `ch3.md:88` "the system
creates the work order, generates the PDF form, **sets the status to Approved**".

| # | Hop | Evidence |
|---|---|---|
| 1 | Admin opens assignment dialog | `WorkOrderDialogs.jsx` (opened from `JobRequests.jsx` / `CampusAdminDashboard.jsx`) |
| 2 | POST `/assign-technician` | `requisitionRoutes.js:936`, `requireRole('admin')` |
| 3 | Assignee resolved to a real FK | `requisitionRoutes.js:952-961` — rejects non-maintenance accounts with an explicit message |
| 4 | `assertAgainstPolicy` (requires `campus_admin_approved`) | `requisitionRoutes.js:973`, rule `ticketPolicy.js:168-170` |
| 5 | Official tracking minted **here**, not earlier | `requisitionRoutes.js:984-997` from `tracking_sequences`; reuses `jr.official_tracking_no` if already present `:985` |
| 6 | **`status = 'Ongoing'` written at assignment** | `requisitionRoutes.js:999-1007` |
| 7 | Status history row | `requisitionRoutes.js:1009-1012` |
| 8 | Notifications to requester, assignee, admins | `requisitionRoutes.js:1014-1022` |
| 9 | Audit row with the tracking number | `requisitionRoutes.js:1024` `"Tracking: ${officialTracking}, Assignee: …"` |
| 10 | Technician's own "start work" button | `WorkQueue.jsx:242` → `updateRequisitionStatus` → `requisitionRoutes.js:1099`; `authorizeStatusChange` re-records `Ongoing → Ongoing` (allowed, `ticketPolicy.js:209`) |
| 11 | Technician completes | `ticketPolicy.js:183-186` (assigned tech, `Ongoing → Completed` only), UI `WorkQueue.jsx:269`, `completed_at` set `requisitionRoutes.js:1134` |

**Status: DIFFERENT on step 6.** Tracking-number timing MATCHES (`ch3.md:59` "generates the
tracking number as part of assigning the work order"). But the paper separates *assignment sets
Approved* (`ch3.md:88`) from *personnel set Ongoing when they start* (`ch3.md:106`); the code
collapses them at `requisitionRoutes.js:999-1007`, so the ticket never rests in `Approved` after
assignment and step 10 is a no-op re-record.

---

## W6 — Replacement / disposal flagging

**Paper:** `ch1.md:103` "If maintenance personnel determine that an item cannot be repaired, they
can raise a replacement or disposal flag, which prompts the System Administrator to start
procurement procedures."

| # | Hop | Evidence |
|---|---|---|
| 1 | Technician raises the flag in the work queue | `WorkQueue.jsx:308` |
| 2 | POST `/replacement-flag` | `requisitionRoutes.js:1037`, `requireRole('maintenance','technician','admin')` |
| 3 | Reason recorded with actor + timestamp | `requisitionRoutes.js:1044-1077` (`reason`, `replacement_item_specs`); audit `:1086` |
| 4 | Response tells the tech the admin was alerted | `requisitionRoutes.js:1088` `"Replacement flagged. PDAS was notified."` |
| 5 | Procurement stage visible downstream | `replacement_procurement_status` column (DB `SHOW COLUMNS`), surfaced at `FacultyStaffPortal.jsx:907-915` |
| 6 | Admin can update the flag | `PUT /:id/replacement-flag` `requisitionRoutes.js:1348` |
| 7 | Client state | `DataContext.jsx:1510` |

**Status: MATCH.**

---

## W7 — Completion → post-completion feedback → archiving

**Paper:** `ch1.md:104` "Once a ticket is marked Completed, the system **automatically sends** the
requester a post-completion feedback form, and the ticket **is archived** without being deleted,
while **rejected requests are archived in the same way**."

| # | Hop | Evidence |
|---|---|---|
| 1 | Status reaches `Completed` | `requisitionRoutes.js:1104` normalise → `:1123` `authorizeStatusChange` → `:1130-1136` (`completed_at` `:1134`) |
| 2 | Tri-party notification | `requisitionRoutes.js:1161-1189` |
| 3 | Feedback prompt sent to the requester | `requisitionRoutes.js:1192-1200` — title `'Service Evaluation Available'` |
| 4 | Pending evaluations derived on the client | `DataContext.jsx:1920-1923` — completed tickets with no matching evaluation |
| 5 | Requester opens the form | `FacultyStaffPortal.jsx:922-937`, criteria `EvaluationForm.jsx:6-11` |
| 6 | Submission validated server-side | `evaluationRoutes.js:40` (must be `Completed`) and `:44` (non-privileged must be `requester_id === req.user.id`) |
| 7 | Server write first, local copy second | `DataContext.jsx:1666-1675` (`apiSubmitEvaluation`), failure returns early `:1676-1679` |
| 8 | **Missing: automatic archive on `Completed`** | Grep `is_archived = TRUE\|SET is_archived` in `backend/src` → **2 hits only**: `requisitionRoutes.js:1435` (the manual archive endpoint) and `:1471` (unarchive). The `Completed` branch `requisitionRoutes.js:1192-1200` does **not** touch `is_archived` |
| 9 | **Missing: automatic archive on `Rejected`** | Same two hits; `Rejected` is terminal (`ticketPolicy.js:58`) but never archived |
| 10 | Manual archive exists as a fallback | `PUT /:id/archive` `requisitionRoutes.js:1420` (`requireRole('admin')`, audited `:1440`), sole UI call `JobRequests.jsx:1034` |
| 11 | Archived records retrievable | `?archived=true` on `GET /` (`requisitionRoutes.js:160`), `ArchivedRequests.jsx` |
| 12 | **Missing: scheduler** | Grep `setInterval\|cron` in `backend/src/server.js` → only `server.js:184-185`, the preventive reminder |

**Status: PARTIAL → MISSING on archiving.** Feedback conforms; the paper's *automatic* archiving
has no trigger.

---

## W8 — Rejection of an account registration

**Paper:** `ch1.md:97` "The System Administrator reviews each application and approves or rejects
it"; `ch1.md:104` "every action… including **approvals, rejections**… is timestamped and logged";
`ch3.md:110` the Auth module "updates the status and role… and notifies the applicant".

| # | Hop | Evidence |
|---|---|---|
| 1 | Admin opens pending registrations | `apiGetPendingRegistrations` `api.js:233` → `userRoutes.js:28` |
| 2 | ID photo preview | **BROKEN** — `UserManagement.jsx:1247` reads `idPreviewUrl`, `:1258` reads `idFileName`; `normalizeRegistration` (`api.js:86-106`) emits only `idPhotoUrl` |
| 3a | **Approve** | `userRoutes.js:45-107`; `FOR UPDATE` lock `:51`; INSERT into `users` `:62-73`; old row flipped to `approved` `:77-83` |
| 3a-i | Notification to the applicant | `userRoutes.js:88-96` ✅ |
| 3a-ii | Audit row | **absent** — grep `auditLog` in `userRoutes.js` → `:279, :401, :463, :527` only |
| 3b | **Reject** | `userRoutes.js:110-127` — UPDATE to `rejected` with reason `:113-118` |
| 3b-i | Notification to the applicant | **absent** — the handler body `userRoutes.js:110-127` contains no `notifications` INSERT; grep `notify` in that range → no matches |
| 3b-ii | Audit row | **absent** (same grep as above) |
| 4 | Applicant sees the outcome | `apiGetMyRegistration` `api.js:238` → `userRoutes.js:76-96`; `RegisterModal.jsx:151-176` rejection panel with `rejection_reason` |
| 5 | Consent timestamp | **absent** — `consent_at` never written (grep `consent` in `backend/src` → `autoSetup.js:192-193` only); INSERT column list `authRoutes.js:148-150` and `userRoutes.js:62-63` both omit it; live rows all `NULL` |

**Status: DIFFERENT.** Approval is complete apart from the audit row; rejection is silent and
unlogged, and consent is never captured.

---

## W9 — Role management and Supervisor designation

**Paper:** `ch1.md:98` "The System Administrator can designate any approved Faculty/Staff account as
a Supervisor… **does not create a separate account**"; `ch1.md:152` Supervisor uses the same login.

| # | Hop | Evidence |
|---|---|---|
| 1 | Admin-only entry | `userRoutes.js:10` `router.use(verifyToken, requireRole('admin'))` |
| 2 | Toggle the flag | `userRoutes.js:421` `PUT /:id/supervisor-designation`, audit `:463` |
| 3 | Bulk assignment of a supervisor's unit | `userRoutes.js:245`, audit `:279` |
| 4 | Per-user assignment | `userRoutes.js:488`, audit `:527` |
| 5 | Flag read back on every request | `auth.js:41` `Boolean(row.is_supervisor \|\| row.role === 'supervisor')`, cached then invalidated (`invalidateUserCache` `auth.js:58`) |
| 6 | Flag clears `requireRole('supervisor')` gates | `auth.js:107-110` |
| 7 | No separate account anywhere | `users.role` enum has no `supervisor` value (DB `SHOW COLUMNS`) |
| 8 | Supervisor may act only on their own unit's tickets | `ticketPolicy.js:102-119`; the blanket fall-through is explicitly removed at `:112-118` |
| 9 | Designation revocable | same endpoint toggles back; `invalidateUserCache` `userRoutes.js:468` |

**Status: MATCH.**

---

## W10 — Preventive maintenance scheduling and reminders

**Paper:** `ch1.md:39` "preventive maintenance scheduling and automated reminders for maintenance
personnel"; `ch3.md:116` the table is "linked to a location, to the assigned personnel, and **to
the administrator who created the schedule**"; `ch3.md:159` "a scheduled backup… [and] the
scheduler for preventive maintenance reminders".

| # | Hop | Evidence |
|---|---|---|
| 1 | Admin creates a schedule | `POST /` `preventiveRoutes.js:36` |
| 2 | Audit of creation | `preventiveRoutes.js:84` ✅ |
| 3 | Location stored as a **string**, not an FK | `preventiveRoutes.js:44` `location: location \|\| null`; schema `VARCHAR(255) NOT NULL` (`schema.sql:230`) |
| 4 | **No `created_by`** | grep `created_by` in `backend/src/routes/preventiveRoutes.js` → **no matches**; `schema.sql:224-236` has no such column |
| 5 | Server scheduler | `server.js:184` (once at boot) + `server.js:185` (every 6 h) |
| 6 | Window | `preventiveRoutes.js:165` `BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)` |
| 7 | One reminder per technician per day | `preventiveRoutes.js:170-181` (checked against `notifications` for today) |
| 8 | Client-side hourly sweep | `DataContext.jsx:615-665`, interval `:665` |
| 9 | Calendar view | `PreventiveCalendar.jsx` |
| 10 | Status changes on completion | `preventiveRoutes.js:213, 245` |

**Status: PARTIAL.** Scheduling and reminders work; the ERD linkage the paper specifies
(location FK, creator FK) is not modelled.

---

## Cross-cutting observations

1. **Every workflow that touches `location_id` loses it.** W1 hop 13 is the single point of
   failure; there is no later repair path.
2. **Every workflow that touches the photo loses it** at `DataContext.jsx:1006-1021`.
3. **No workflow auto-archives** (W7 hops 8–9, 12).
4. **No requester-side workflow can move a ticket out of `Returned`** (W3b).
5. **The only timer in the whole client is the 30-second notification poll**
   (`DataContext.jsx:604-608`); grep `EventSource|WebSocket|socket.io` across `frontend/src` and
   `backend/src` → no matches, so no workflow updates another viewer's screen without a reload.
