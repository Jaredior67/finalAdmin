# 04 — Gap Analysis

Every gap found, severity-ranked, each cited to `path/to/file:line`, a table/column, or an API
route. Search terms are recorded where a negative result is the finding.

**Severity scale**

| Level | Meaning |
|---|---|
| **S1 — Critical** | Data loss, a paper-mandated feature that does not function, or a security/privacy exposure with real impact |
| **S2 — High** | Paper behaviour reachable but wrong, or a broken user path |
| **S3 — Medium** | Divergence that degrades a feature without breaking it |
| **S4 — Low** | Cosmetic, documentation, dead code, maintainability |

**Paper-requirement gaps** are marked 📄 (the papers demand it). **Security/privacy gaps** are
marked 🔒 (the papers are silent or only mildly prescriptive — these are *not* scored as
conformance failures).

---

## S1 — Critical

### G-01 📄 Location is never persisted — `job_requests.location_id` is NULL on 100% of tickets

* **Paper:** `ch3.md:115` "Each request belongs to one requester and **one location**";
  `ch1.md:34` objective "QR-code scanning for room and building identification, with manual
  location selection as a fallback".
* **Evidence:**
  * `buildRequisitionPayload()` returns `building, floor, room, location, qrCodeRef` but **not
    `locationId`** — `frontend/src/utils/jobRequestIntake.js:112-151`.
  * The submit payload reads `locationId: newReq.locationId || null` —
    `frontend/src/context/DataContext.jsx:1020`. Grep `locationId` in `frontend/src` → **1 match**,
    this line. It is therefore always `null`.
  * Server reads it at `backend/src/routes/requisitionRoutes.js:337` and stores
    `locationId ?? null` at `:503`.
  * Column is nullable — `schema.sql:124`.
  * **DB read:** `SELECT id, ticket_no, location_id FROM fixit_pdas.job_requests` →
    `162 | JR-2026-0001 | NULL`, `169 | JR-2026-0008 | NULL`.
  * Read-back falls back to a literal: `DataContext.jsx:490`
    `location: [r.building, r.floor, r.room].filter(Boolean).join(' - ') || r.location || 'Campus Facilities'`
    — and `job_requests` has **no** `building/floor/room` columns (DB `SHOW COLUMNS`), so the
    fallback always fires.
* **Impact:** every location-based report is degenerate (`AnalyticsReports.jsx:86`
  `uniqueLocations` collapses to one value; `:117` building volume; `:287` the Location filter).
  The FK `fk_jr_location` (`schema.sql:171`) is inert.

### G-02 📄 Request photos are captured but never stored

* **Paper:** `ch1.md:99` "…and an optional photo"; `ch1.md:106`, `ch1.md:148`,
  `ch3.md:118` "submit a maintenance request with a photo".
* **Evidence:**
  * Captured — `frontend/src/components/common/JobRequestFormOverlay.jsx:183-210`
    (`toDataURL('image/jpeg', 0.7)` at `:210`), preview `:419-421`, returned as `photoUrl` `:256`.
  * Returned by the builder — `jobRequestIntake.js:149`.
  * **Dropped** — `DataContext.jsx:1006-1021` payload omits it.
  * Server never reads it — `requisitionRoutes.js:336-346` destructures
    `locationId, category, description, urgencyLevel, priority, requestType,
    isStandardFormFilled, immediateSupervisor, idempotencyKey`.
  * INSERT columns — `requisitionRoutes.js:496-516`; **no photo column exists**
    (DB `SHOW COLUMNS FROM fixit_pdas.job_requests`, 43 columns, none is a photo reference —
    contrast `ch3.md:115` "holds the… photo reference").
* **Related dead endpoint:** `POST /api/documents` `backend/src/routes/documentRoutes.js:72`
  (multer 10 MB `:36`, allow-list `:37`, auth `:51`); `documents` table **0 rows**
  (`SELECT COUNT(*)` → `0`). Grep `new FormData(` in `frontend/src` → **no matches**; grep
  `apiUploadDocument|apiGetDocuments|/documents` → **no matches**.

### G-03 📄 Automatic archiving does not exist

* **Paper:** `ch1.md:104` "the ticket **is archived** without being deleted, while **rejected
  requests are archived in the same way**"; `ch1.md:114`; `ch1.md:41` objective;
  `ch3.md:115` `is_archived` / `archived_at`.
* **Evidence:**
  * Grep `is_archived = TRUE|SET is_archived` in `backend/src` → **2 matches only**:
    `requisitionRoutes.js:1435` (manual archive) and `requisitionRoutes.js:1471` (unarchive).
  * The `Completed` branch — `requisitionRoutes.js:1192-1200` — only sends the evaluation
    reminder.
  * The only scheduler in the process is the preventive reminder — grep `setInterval|cron` in
    `backend/src/server.js` → `server.js:184-185` only.
  * Single UI call site — grep `archiveRequisition` in `frontend/src` →
    `DataContext.jsx:1601` (def), `:1609` (call), `JobRequests.jsx:1034` (usage).
* **Impact:** the archive is a manual admin button; `ArchivedRequests.jsx` will stay empty unless
  someone clicks.

### G-04 📄 Printed "QR" labels are decorative — nothing scannable is ever produced

* **Paper:** `ch1.md:34` objective; `ch3.md:115` "tbl_location… together with **their QR codes**";
  `ch3.md:159` "Supporting services **generate the QR codes** of the rooms and buildings";
  `ch1.md:152` "manual dropdown as a fallback" for a posted code.
* **Evidence:**
  * `frontend/src/views/PrintLabels.jsx:548` renders `<QrCode size={…} color="#001f9c" />` and
    `:550` renders the literal text `SCAN ME`.
  * `PrintLabels.jsx:3` — `import { … QrCode … } from 'lucide-react'` → an **icon font**, not a
    barcode encoder.
  * The comment at `PrintLabels.jsx:535` calls the block *"QR simulation"*.
  * Grep `from 'qrcode'` across `frontend/` → **1 match**: `JobRequestPrintSheet.jsx:18-19`,
    whose payload is `FIXIT-REQ:<tracking>` (`JobRequestPrintSheet.jsx:17`), a *ticket verification*
    code, not a location tag. Server twin: `docxJobRequestGenerator.js:38`.
* **Impact:** the physical posting step the whole QR feature depends on cannot happen.

### G-05 🔒 Consent under RA 10173 is never captured

* **Paper (prescriptive but mild):** `ch1.md:99` "users are informed at registration of what data
  are collected and why, and **their consent is obtained**"; `ch2.md:34` "informs users at
  registration, obtains their consent"; `ch3.md:118` "in line with the Data Privacy Act of 2012".
* **Evidence:**
  * Columns exist — `schema.sql:48` (`users.consent_at`), `schema.sql:78`
    (`registration_requests.consent_at`); comments at `schema.sql:47, 77` and
    `backend/src/scripts/autoSetup.js:191-193`.
  * Grep `consent_at|consent` in `backend/src` → **only** `autoSetup.js:192-193` (column
    creation). Never written.
  * Registration INSERT column list — `authRoutes.js:148-150` (14 columns, no `consent_at`).
  * Approval INSERT — `userRoutes.js:62-63` (14 columns, no `consent_at`).
  * Grep `10173|Data Privacy|privacy notice|PrivacyNotice|consent` in `frontend/src` → **no
    matches**.
  * **DB read:** `SELECT consent_at IS NULL FROM fixit_pdas.users` → `1` for all 7 rows;
    `registration_requests.consent_at` → `NULL`.
* **Impact:** the stated compliance mechanism exists only as an unused column.

### G-06 🔒 Admin's ID-photo review is broken end to end

* **Evidence:**
  * `frontend/src/views/admin/UserManagement.jsx:1247` `src={selectedPendingReg.idPreviewUrl}`;
    `:1258` `File: <code>{selectedPendingReg.idFileName}</code>`.
  * `normalizeRegistration()` — `frontend/src/backend/api.js:86-106` — emits `idPhotoUrl` at
    `:106` and **never** `idPreviewUrl` / `idFileName`.
  * `RegisterModal.jsx:98-99` does send `idFileName` / `idPreviewUrl`, and `api.js:207` keeps only
    `idPhotoUrl`.
* **Impact:** the admin approving an account cannot see the ID the paper requires them to verify
  (`ch1.md:97` "reviews each application and approves or rejects it based on **completeness and
  validity**").

### G-07 🔒 ID photo base64 into `VARCHAR(500)` under a non-strict SQL mode → silent truncation

* **Evidence:**
  * `RegisterModal.jsx:62` `reader.readAsDataURL(file)` — **no size cap** (grep `size` in that
    handler → only unrelated matches at `:151, :184, :257…`).
  * Sent as `idPhotoUrl` — `RegisterModal.jsx:100`, `api.js:207`, `authRoutes.js:149, 165`.
  * Column — `schema.sql:38` and `schema.sql:74` `id_photo_url varchar(500)`.
  * **DB read:** `SELECT @@sql_mode` → `NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION` —
    **no `STRICT_TRANS_TABLES`**. `schema.sql:114-116` documents this exact hazard.
  * Body limit is generous — `server.js:59` `express.json({ limit: '15mb' })`.
* **Impact:** any realistic JPEG data-URL exceeds 500 chars and is truncated to garbage *with a
  200 response*. Live row currently has `id_photo_url = NULL` (`LENGTH = NULL`).

---

## S2 — High

### G-08 📄 Requester cannot revise and resubmit a Returned ticket

* **Paper:** `ch3.md:70` "a request that is returned is sent back… the requester **edits the
  request, submits it again**"; `ch1.md:102` "returned to the requester for revision";
  `ch1.md:104` status "Returned for Revision".
* **Evidence:**
  * Faculty/Staff row actions — `frontend/src/views/FacultyStaffPortal.jsx:485-502` — only
    **Details** and **Slip**.
  * Grep `updateRequisitionStatus(` call sites → `WorkQueue.jsx:242`, `WorkQueue.jsx:269`,
    `JobRequests.jsx:316`, `JobRequests.jsx:319`, `JobRequests.jsx:334` — **no requester path**.
  * Server: `ticketPolicy.js:182-190` — non-privileged callers get
    `403 Only PDAS Admin can change ticket status…`.
  * The only exits from `Returned` are the admin's "Restore to Pending"
    (`JobRequests.jsx:315-316`) and "Close" (`:318-319`).
  * Transition itself is legal — `ticketPolicy.js:56` `'Returned': ['Pending', 'Rejected']`.
* **Impact:** the loop the paper describes is closed by an administrator, not the requester.

### G-09 📄 Assignment jumps straight to `Ongoing`, skipping `Approved`

* **Paper:** `ch3.md:88` "creates the work order… **sets the status to Approved**";
  `ch3.md:106` "When the personnel **start the work**, the module saves the **Ongoing** status".
* **Evidence:** `requisitionRoutes.js:999-1007` writes `status = 'Ongoing'` inside
  `POST /:id/assign-technician`; the technician's own start action (`WorkQueue.jsx:242`) then
  re-records `Ongoing → Ongoing` (permitted by `ticketPolicy.js:209`).
* **Impact:** `Approved` never survives assignment; the "personnel start work" event described in
  `ch3.md:106` is not observable.

### G-10 📄 The PDF with all four electronic approvals is never produced

* **Paper:** `ch1.md:36` objective "automatic generation of the PDAS job request form in **PDF
  format**"; `ch1.md:103` "auto-generates a PDF… carrying **all four** electronic approvals".
* **Evidence:**
  * Endpoints exist — `backend/src/routes/jobRequestDocRoutes.js:35` (`POST /generate-pdf`),
    `:58` (`POST /generate-docx`), `:81` (`GET /:id/pdf`); rate limiter `:24-29`.
  * Frontend client defined — `frontend/src/backend/api.js:391` `apiGetJobRequestDocPdf`. Grep
    that symbol across `frontend/src` → **1 match, the definition**.
  * What actually prints — `window.print()` at 10 call sites (`SupervisorDashboard.jsx:590`,
    `OfficialDocuments.jsx:113`, `PrintLabels.jsx:261`, `WorkOrderDialogs.jsx:486`,
    `RequestIntake.jsx:564`, `CampusAdminDashboard.jsx:816`, `JobRequests.jsx:998`,
    `ModularFormPreviewPanel.jsx:33`, plus the overlay/sheet pair).
  * DOCX generator carries **no approval data** — grep `approv` in
    `backend/src/utils/docxJobRequestGenerator.js` → 5 hits, all `immediateSupervisor` or QR
    (`:37, :38, :124, :135, :138`).
* **Related — hardcoded approver names (S2):**
  * `frontend/src/components/common/JobRequestPrintSheet.jsx:134`
    `✓ Electronically Approved by KRISTINE J. AMAR`; `:151` fallback
    `RAMIL G. LUMAUAG, Ed.D., DIT`.
  * `frontend/src/components/common/PDASJobRequestFormDocument.jsx:251, 254` and `:273, 276`.
  * `ch1.md:120` defines the marker as "with **the approver's name**, date, and time" read from
    the recorded confirmation — not a constant.

### G-11 📄 Rejected registration: no notification and no audit row

* **Paper:** `ch1.md:104` "every action… including approvals, **rejections**… is timestamped and
  logged"; `ch3.md:110` the Auth module "notifies the applicant".
* **Evidence:**
  * Handler — `backend/src/routes/userRoutes.js:110-127`. Reads in full: UPDATE `:113-118`,
    404 `:119-121`, `res.json` `:122`. **No `notifications` INSERT, no `auditLog`.**
  * Approve contrast — notification at `userRoutes.js:88-96` ✅ but **also no audit row**.
  * Grep `auditLog` in `userRoutes.js` → `:279, :401, :463, :527` only.

### G-12 🔒 Self-approval is not blocked (papers are silent — scored as security, not conformance)

* **Paper:** grep `own request|self-approv|separation of duties` across
  `ch1.md, ch2.md, ch3.md` → **no match**. The papers never prohibit it.
* **Evidence:**
  * `POST /:id/supervisor-action` `requisitionRoutes.js:636`;
    `POST /:id/admin-action` `:729`; `POST /:id/approver-action` `:827` — none compares
    `jr.requester_id` to `req.user.id`.
  * Grep `requester_id !== req\.user\.id` in `backend/src` → **2 matches**:
    `evaluationRoutes.js:44` and `requisitionRoutes.js:1285` — neither is an approval endpoint.
  * Partial mitigations already present: `canSuperviseTicket` blocks the supervisor leg
    (`ticketPolicy.js:102-119`, comment at `:112-118` names the exact concern) and
    `canViewTicket` (`:79-91`) blocks read-side IDOR.
* **Impact:** an admin or Approver who files a request can approve every remaining stage of their
  own ticket. Recommend as a hardening task; **not** counted against paper conformance.

### G-13 📄 Real-time tracking is a 30-second poll of notifications only

* **Paper:** `ch1.md:35` objective "real-time tracking"; `ch1.md:104` "all parties can track
  ticket status in **real time**".
* **Evidence:**
  * The only timer — `DataContext.jsx:604-608` (notifications, 30 s).
  * `refreshRequisitions()` runs on mount (`DataContext.jsx:556-557`) and after the caller's own
    action (`:1063, 1112, 1133, 1164, 1281, 1407, 1437, 1587, 1610, 1628`) — **never on an
    interval**.
  * Grep `EventSource|WebSocket|socket\.io|io(` in `frontend/src` → no matches (only
    `setBio` false positives in `SettingsPage.jsx`); same grep in `backend/src` → only
    `cors(` at `server.js:43`.

---

## S3 — Medium

### G-14 📄 Status vocabulary is 12 values, the paper's is 6 + 3

* **Paper:** `ch1.md:104`, `ch3.md:8` — Pending, Under Review, Pending Final Approval, Approved,
  Ongoing, Completed; exceptions Returned for Revision, Rejected, On-hold.
* **Evidence:** live enum `SHOW COLUMNS` → `Draft, Pending Supervisor Approval, Pending,
  Under Review, Pending Final Approval, Awaiting Signatures, Approved, Ongoing, On Hold, Returned,
  Completed, Rejected` (12). Source list `backend/src/scripts/autoSetup.js` (`REQUEST_STATUSES`);
  normaliser `requisitionRoutes.js:102-117`.
* **Label drift:** `JobRequests.jsx:396` tab label "Returned for Revision" vs badge `Returned`
  (`StatusBadge.jsx:41`); paper "On-hold" vs `StatusBadge.jsx:37` "On Hold".
* **`Awaiting Signatures` is EXTRA** — grep `Awaiting|signed form|hardcopy` across the papers →
  no match (see `05_extra…` §3).

### G-15 📄 Supervisor notification goes to *all* supervisors, not the unit's

* **Paper:** `ch3.md:74` the supervisor is notified "for each pending request of the employees
  **assigned to it**".
* **Evidence:** `notifySupervisors` — `requisitionRoutes.js:81-87`
  `SELECT id FROM users WHERE (role = 'supervisor' OR is_supervisor = 1) AND status = 'active'`,
  used at `:579`. Compare the ticket's own `supervisor_id` written at `:462`.

### G-16 📄 Status vocabulary — 12 vs 9 already covered; here: urgent same-day deadline unenforced

* **Paper:** `ch1.md:103` "the requester is still expected to complete the full form **within the
  same day**".
* **Evidence:** `DataContext.jsx:952` sets `urgentDeadline: 'Within Today (24 Hours)'`; grep
  `urgentDeadline` in `frontend/src` → **1 match** (that line), never read. Grep
  `expiry|overdue|isPastDay|deadline` in `backend/src` → **no matches**.
  `PUT /:id/complete-standard-form` (`requisitionRoutes.js:1259-1346`) has no day guard.

### G-17 📄 `preventive_maintenance_schedules` does not model the ERD relationships

* **Paper:** `ch3.md:116` "linked to a location, to the assigned personnel, and **to the
  administrator who created the schedule**".
* **Evidence:** `schema.sql:224-236` — `location varchar(255) NOT NULL` (`:230`, a string),
  `assigned_to` FK (`:235`), **no `created_by`**. Grep `created_by` in
  `backend/src/routes/preventiveRoutes.js` → **no matches**.

### G-18 📄 Reminder window is 2 days; papers do not state a number

* **Paper:** `ch1.md:39` "automated reminders for maintenance personnel"; `ch3.md:83` "When the
  scheduled date of a task **approaches**". Grep `one day|day before|24 hours` near the reminder
  text → **no match**.
* **Evidence:** `preventiveRoutes.js:165`
  `BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)`; server cadence `server.js:185`
  (6 h); client sweep `DataContext.jsx:615-665` (hourly).
* **Note:** the earlier working note that the papers say "one day" is **NOT FOUND** — search terms
  `one day|day before|24 hours|advance` across `ch1.md, ch2.md, ch3.md` gave no reminder-specific
  hit. Reported as an implementation choice, not a conformance failure.

### G-19 📄 `tbl_approval` has no structural equivalent

* **Paper:** `ch3.md:116` "`tbl_approval` records each electronic approval, with the **level of
  approval, the decision, the remarks, and the time**."
* **Evidence:** no table of that shape. The closest is `job_request_status_history`
  (`from_status, to_status, changed_by, remarks`), plus six column triples on `job_requests`
  (`supervisor_approved*`, `admin_approved*`, `campus_admin_approved*`, `requester_approved*` —
  `SHOW COLUMNS`). `requisitionRoutes.js:518-521` and `:662` region write history rows with no
  "level" or "decision" column.

### G-20 📄 `tbl_work_order` and `tbl_replacement_flag` are folded into `job_requests`

* **Paper:** `ch3.md:116` two separate tables with assigned/completion dates and flag status.
* **Evidence:** live `job_requests` carries `assigned_to, scheduled_date, completed_at,
  is_replacement_flagged, replacement_reason, replacement_item_specs,
  replacement_procurement_status` (DB `SHOW COLUMNS`). No tables by those names (14-table list).

### G-21 📄 `tbl_location` has no `qr_code` column and holds 0 rows

* **Paper:** `ch3.md:115`.
* **Evidence:** `schema.sql:88-95` columns `id, building, floor, room, description, created_at`;
  grep `qr_code` in `backend/` → **no matches**; **DB read** `SELECT COUNT(*) FROM
  fixit_pdas.campus_locations` → `0`.

### G-22 📄 Backend location CRUD is dead code

* **Evidence:** `backend/src/routes/lookupRoutes.js:8-71` (GET `:8`, POST `:19`, PUT `:37`,
  DELETE `:60`), mounted `server.js:120`. Grep `api/lookups|campus-locations|apiCampusLocation`
  in `frontend/src` → **no matches**; grep `lookups` in `frontend/src` → **no matches**. The
  registry the UI uses is `localStorage['fixit_pdas_campus_locations_v5']`
  (`DataContext.jsx:730`, writers `:1836, :1858, :1875`).

### G-23 📄 Approval History screen reads a frozen localStorage snapshot

* **Evidence:** `DataContext.jsx:398` `useState(() => readJson('fixit_pdas_approvals_v3', []))`,
  persisted `:747-749`. Grep `setApprovalHistory` in `frontend/src` → **0 call sites**.
  Consumer `frontend/src/views/admin/ApprovalHistory.jsx:7` and `:25`. The live source
  `job_request_status_history` (6 rows) is never read by that screen.
* **Impact:** approvals appear not to have happened, or show stale data from another browser.

### G-24 📄 Evaluations list is browser-local even though submissions go to the server

* **Evidence:** `DataContext.jsx:721` `readJson('fixit_pdas_evaluations_v3', [])`; the submit path
  *does* write server-side first (`:1666-1675`). Grep `apiGetEvaluations` → `api.js:377` and
  `AnalyticsReports.jsx:50` only — `DataContext` never calls it.
* **Impact:** a feedback form filed in one browser is invisible in another and to
  `FacultyStaffPortal.jsx:272, 584`.

### G-25 📄 Client and server password rules disagree

* **Evidence:** `RegisterModal.jsx:84` `formData.password.length < 6`; server
  `authRoutes.js:15-23` requires ≥8 with a letter and a digit.
* **Impact:** a 6-char password passes client validation and is rejected by the API with a generic
  message.

### G-26 📄 Reporting axis "location" is degenerate

* **Paper:** `ch1.md:104` "reports covering ticket volume, resolution status, recurring issues,
  and **requests by location** and category".
* **Evidence:** `AnalyticsReports.jsx:86` builds `uniqueLocations` from `r.location`, which comes
  from `DataContext.jsx:490` → always `'Campus Facilities'`. Grep `recurring` in
  `frontend/src` → **no matches**; in the papers → no report by recurring issues exists either
  (only `ch1.md:104` names it). **Recurring-issues report: NOT FOUND** — search terms
  `recurring|repeat|duplicate` in `frontend/src` and `backend/src`.

### G-27 📄 Archiving has no scheduler and unarchive is not audited

* **Evidence:** archive audited at `requisitionRoutes.js:1440`; grep `auditLog` in the
  `:1456` unarchive handler → **no call**. No scheduler (see G-03).

---

## S4 — Low

### G-28 Dead code

| Item | Evidence |
|---|---|
| `AdminGuard` | `frontend/src/components/auth/AdminGuard.jsx:7` exports it; grep `AdminGuard` in `frontend/src` → **1 match**, its own file |
| `SupervisorRoutes` | `frontend/src/routes/SupervisorRoutes.jsx:7`; grep `SupervisorRoutes` → **1 match**. The shell routes supervisors through the Faculty workspace (`App.jsx:43-45`) |
| `lookupRoutes` location CRUD | see G-22 |
| `documentRoutes` upload/list | see G-02 |
| `apiGetJobRequestDocPdf` | see G-10 |
| `priority` column | `job_requests.priority enum('low','medium','high','urgent')` normalised away at `requisitionRoutes.js:423`; it duplicates `urgency_level` |
| Stale comment | `DataContext.jsx:837-841` claims "the ID-photo upload… isn't sent to the backend yet" — but `api.js:207` sends `idPhotoUrl` |

### G-29 Documentation drift

| Item | Evidence |
|---|---|
| README lifecycle omits the supervisor stage and the 3 extras | `README.md:15-16` |
| `docs/API.md` lifecycle is stale | `docs/API.md:32` `Pending → Under Review → Awaiting Signatures → Approved → Ongoing → Completed` — omits `Pending Supervisor Approval`, `Pending Final Approval`, `Returned`, `Rejected`, `On Hold`, `Draft` |
| Backup is manual only | `README.md:317-318` documents a `mysqldump` command; grep `mysqldump|backup` in `backend/` → **no script**. `ch3.md:160` "A **scheduled backup** of the database and the stored files protects against loss" |

### G-30 Token storage in `localStorage`

* `frontend/src/backend/api.js:111-118` (`TOKEN_STORAGE_KEY`, `getToken`, `setToken`).
* The papers specify no mechanism — hardening item only.

### G-31 Bundle weight

* Built assets: `SettingsPage-*.js` 489.2 KB, `index-*.js` 326.2 KB, `AdminRoutes-*.js` 109.5 KB,
  `index-*.css` 68.4 KB, logos 231.7 / 195.8 / 66.7 KB (`frontend/dist/assets`).
* `SettingsPage` and `AdminRoutes` are lazy (`App.jsx:16-19`); `index` (326 KB) is on the critical
  path. No profiling was run — starting a server to profile was not permitted.

### G-32 No `helmet`

* Headers are hand-rolled and adequate — `server.js:61-79`. Absence of `helmet` is a
  maintainability note, not a defect.

---

## Gap index

| ID | Sev | Type | Title | Primary citation |
|---|---|---|---|---|
| G-01 | S1 | 📄 | `location_id` always NULL | `DataContext.jsx:1020` |
| G-02 | S1 | 📄 | Request photo never stored | `DataContext.jsx:1006-1021` |
| G-03 | S1 | 📄 | No automatic archiving | `requisitionRoutes.js:1192-1200` |
| G-04 | S1 | 📄 | Printed QR labels are decorative | `PrintLabels.jsx:548` |
| G-05 | S1 | 🔒📄 | Consent never captured | `authRoutes.js:148-150` |
| G-06 | S1 | 🔒 | ID photo preview broken | `UserManagement.jsx:1247` |
| G-07 | S1 | 🔒 | base64 → `VARCHAR(500)`, non-strict SQL | `schema.sql:74` + `@@sql_mode` |
| G-08 | S2 | 📄 | No requester revise/resubmit | `FacultyStaffPortal.jsx:485-502` |
| G-09 | S2 | 📄 | Assignment → `Ongoing` not `Approved` | `requisitionRoutes.js:999-1007` |
| G-10 | S2 | 📄 | PDF with 4 approvals never generated; names hardcoded | `JobRequestPrintSheet.jsx:134` |
| G-11 | S2 | 📄 | Reject registration: unnotified, unlogged | `userRoutes.js:110-127` |
| G-12 | S2 | 🔒 | Self-approval not blocked (papers silent) | `requisitionRoutes.js:729, 827` |
| G-13 | S2 | 📄 | No real-time list updates | `DataContext.jsx:604-608` |
| G-14 | S3 | 📄 | 12 statuses vs 6+3 | `autoSetup.js` `REQUEST_STATUSES` |
| G-15 | S3 | 📄 | Broadcast to all supervisors | `requisitionRoutes.js:81-87` |
| G-16 | S3 | 📄 | Urgent same-day deadline unenforced | `DataContext.jsx:952` |
| G-17 | S3 | 📄 | Preventive table missing `created_by`, location FK | `schema.sql:224-236` |
| G-18 | S3 | — | Reminder window 2 days (papers silent) | `preventiveRoutes.js:165` |
| G-19 | S3 | 📄 | No `tbl_approval` equivalent | `ch3.md:116` vs live schema |
| G-20 | S3 | 📄 | Work-order / flag tables folded in | `ch3.md:116` vs live schema |
| G-21 | S3 | 📄 | `campus_locations` empty, no `qr_code` col | `schema.sql:88-95` |
| G-22 | S3 | 📄 | Location CRUD dead | `lookupRoutes.js:8-71` |
| G-23 | S3 | 📄 | Approval History reads frozen localStorage | `DataContext.jsx:398` |
| G-24 | S3 | 📄 | Evaluations list browser-local | `DataContext.jsx:721` |
| G-25 | S3 | 🔒 | Password rules disagree | `RegisterModal.jsx:84` vs `authRoutes.js:15` |
| G-26 | S3 | 📄 | Location reporting degenerate; no recurring report | `AnalyticsReports.jsx:86` |
| G-27 | S3 | 📄 | Unarchive unaudited; no archive scheduler | `requisitionRoutes.js:1456` |
| G-28 | S4 | — | Dead code + stale comment | see table |
| G-29 | S4 | — | Documentation drift | `docs/API.md:32` |
| G-30 | S4 | 🔒 | JWT in `localStorage` | `api.js:111-118` |
| G-31 | S4 | — | Bundle weight | `frontend/dist/assets` |
| G-32 | S4 | — | No `helmet` | `server.js:61-79` |

**Tally:** 7 × S1 · 6 × S2 · 14 × S3 · 5 × S4 = **32 gaps** (23 📄 paper, 6 🔒 security/privacy,
3 neutral).
