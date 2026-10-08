# 01 — Architecture Map

Read-only map of `C:\xampp\htdocs\capstoneSystem` as it exists at HEAD `aa8adf9`.
No file was modified to produce this map.

---

## 1. Top level

```
capstoneSystem/
├── AUDIT.md                     Phase-0 findings log (2026-09-21) — NOT the A–L checklist
├── README.md                    setup, lifecycle diagram, manual MySQL backup
├── DEPLOYMENT.md                hosting checklist (HTTPS step is a manual checkbox)
├── docs/API.md                  endpoint reference
├── audit/                       ← created by this audit; the only addition
├── backend/                     Node/Express API + MySQL schema
└── frontend/                    React 19 + Vite 8 SPA
```

Working tree at audit start: **101 changed entries**, HEAD `aa8adf9`, 28 untracked paths.

---

## 2. Backend

### 2.1 Process & middleware — `backend/src/server.js`

| Concern | Evidence |
|---|---|
| Route mounts | `server.js:118-128` — `/api/auth`, `/api/users`, `/api/lookups`, `/api/job-requests`, `/api/job-requests-doc`, `/api/notifications`, `/api/evaluations`, `/api/preventive-schedules`, `/api/messages`, `/api/documents`, `/api/audit-log` |
| CORS **fail-fast** (refuses to start with an unset origin) | `server.js:31-41`, `server.js:43` |
| Baseline security headers, hand-rolled (no `helmet` dependency) | `server.js:61-79` — `X-Content-Type-Options: nosniff` (`:66`), `X-Frame-Options: SAMEORIGIN` (`:67`), `Referrer-Policy: no-referrer` (`:68`), `Content-Security-Policy` (`:69-77`) with `script-src 'self'` |
| `/uploads` static mount **removed**; explicit deny handler | `server.js:81-100` (comment `:81-91`, deny `:96-100`) |
| JSON body limit | `server.js:59` — `15mb` |
| Preventive reminder scheduler | `server.js:184` run once at boot, `server.js:185` every **6 h** |
| `JWT_SECRET` required at boot; refuses to start if absent | `server.js:200-204` |
| MySQL connect retry loop | `server.js:187-197` |

### 2.2 Authentication — `backend/src/middleware/auth.js`

| Export | Evidence | Behaviour |
|---|---|---|
| `revokeToken(token)` | `auth.js:9` | deny-list |
| `invalidateUserCache(id)` | `auth.js:58` | cache drop |
| `verifyToken(req,res,next)` | `auth.js:62` | re-reads `id, role, is_supervisor, email, first_name, last_name, department, status` from `users` on every request (`auth.js:35`); the DB — not the JWT payload — is authoritative for role (`auth.js:14-20`, `:91`) |
| `requireRole(...roles)` | `auth.js:101-115` | role check **plus** the designated-supervisor pass-through: a `faculty`/`staff` row with `is_supervisor = 1` clears any gate that lists `'supervisor'` (`auth.js:107-110`) |

**Every** API router opens with `router.use(verifyToken)` (verified in `requisitionRoutes.js`,
`userRoutes.js`, `lookupRoutes.js:8/19/37/60/74/79`, `messageRoutes.js:6`,
`documentRoutes.js:51`, `jobRequestDocRoutes.js:31`, `auditRoutes.js:6`).

Extra role gates:

* `userRoutes.js:10` — `router.use(verifyToken, requireRole('admin'))` → the entire user and
  registration surface is admin-only.
* `auditRoutes.js:6` — `router.use(verifyToken, requireRole('admin'))`.
* `requisitionRoutes.js:636` supervisor-action `requireRole('supervisor')`;
  `:729` admin-action `requireRole('admin')`; `:827` approver-action `requireRole('campus_admin')`;
  `:936` assign-technician `requireRole('admin')`; `:1037` replacement-flag
  `requireRole('maintenance','technician','admin')`; `:1216` signed-form
  `requireRole('admin','campus_admin')`; `:1420` archive / `:1456` unarchive `requireRole('admin')`.
* `requisitionRoutes.js` itself has **no** router-level role gate — visibility and status writes are
  enforced per-route by `canViewTicket` / `authorizeStatusChange` / `assertAgainstPolicy`.

### 2.3 The single ticket policy — `backend/src/utils/ticketPolicy.js`

This file is the only place the lifecycle is defined; it is deliberately free of Express/DB so it is
unit-testable (`ticketPolicy.js:1-29`).

| Export | Line | Role |
|---|---|---|
| `TRANSITIONS` | `:31-59` | 12 statuses and their allowed successors |
| `terminalStatuses()` / `isTerminalStatus()` | `:62-65` | `Completed`, `Rejected` |
| `isPrivileged` / `isTech` / `isSupervisor` / `isUserSupervisor` | `:70-76` | role predicates |
| `canViewTicket()` | `:79-91` | **IDOR guard** — requesters see only their own (`:90`), techs only `assigned_to = self` (`:89`) |
| `canSuperviseTicket()` | `:102-119` | supervisor may act only on their own ticket; the old blanket `status === 'Pending'` fall-through was removed (`:112-118`) |
| `missingApprovalFor()` | `:146-172` | which of the three approvals must already be recorded |
| `authorizeStatusChange()` | `:178-237` | generic status write: role → terminal → vocabulary → transition → approval prerequisites |
| `assertAgainstPolicy()` | `:250-297` | same guarantees for the dedicated action endpoints |

Consumers: `requisitionRoutes.js:662, 755, 855, 973, 1123`.

### 2.4 Routes — `backend/src/routes/`

| File | Endpoints of note |
|---|---|
| `authRoutes.js` | login rate limit `:11` (`10/min`), register limit `:12` (`20/min`), password rule `:15-23` (8+ chars, 1 letter, 1 digit), lockout 5 fails / 15 min `:35-37`, timing-equalisation `DUMMY_HASH` `:39-43`, register `:105-177` |
| `userRoutes.js` | list `:13`, registrations `:28`, **approve `:45`** (notify `:88-96`), **reject `:110-127`**, create user `:130`, bulk supervisor `:245`, update `:299`, status `:357`, delete `:380`, supervisor designation `:421`, assign supervisor `:488`. `auditLog` appears only at `:279, :401, :463, :527` |
| `requisitionRoutes.js` | see §2.5 |
| `lookupRoutes.js` | `campus-locations` CRUD `:8-71`, `categories` `:74-76`, `priorities` `:79-81` — **the location CRUD is never called by the frontend** |
| `documentRoutes.js` | multer 10 MB `:36`, allow-list `:37`, `POST /` `:72`, `GET /job-request/:id` `:107`, `GET /:id/download` `:126` — **no frontend caller** |
| `jobRequestDocRoutes.js` | `POST /generate-pdf` `:35`, `POST /generate-docx` `:58`, `GET /:id/pdf` `:81`; own rate limiter `:24-29`; auth added after an earlier unauthenticated exposure (`:11-19`) |
| `evaluationRoutes.js` | `POST /` `:10` (Completed-only `:40`, ownership `:44`), `GET /job-request/:id` `:96`, `GET /` `:125` |
| `notificationRoutes.js` | list `:16-17`, unread count `:28-29`, mark one `:43-44`, mark all `:59`, delete one `:71-72`, delete all `:87` — all scoped to `req.user.id` |
| `preventiveRoutes.js` | create `:36`, update `:101`, `runAutomatedPreventiveReminders()` `:158-201` (window `BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)` `:165`, one reminder per tech per day `:170-181`) |
| `messageRoutes.js` | participants `:15` gated `requireRole('admin','campus_admin','maintenance','technician')`; inbox `:36` |
| `auditRoutes.js` | `GET /` `:10`, admin-only, newest-first, capped 500 (`:12`) |

### 2.5 `requisitionRoutes.js` — the workflow spine

| Line | Endpoint | Gate |
|---|---|---|
| `:127-155` | `applyVisibilityScope()` | requesters → own only (`:148`); techs → `assigned_to = self` (`:131`); supervisors → status/owner/dept clauses (`:133-146`); unknown role → caller 403 (`:152`) |
| `:158` | `GET /` list | scope + **High-Risk-first ordering** `:205-213` |
| `:247` | `GET /stats` | counts |
| `:286` | `GET /:id` | `canViewTicket` |
| `:332` | `POST /` create | idempotency `:348-375`; body reads `locationId, category, description, urgencyLevel, priority, requestType, isStandardFormFilled, immediateSupervisor, idempotencyKey` `:336-346`; supervisor resolution `:442-471`; auto-endorse `:473-551`; INSERT `:496-516`; status history `:518-521`; notifications `:556-594`; audit `:602` |
| `:636` | `POST /:id/supervisor-action` | `assertAgainstPolicy` `:662` → approve = `Under Review`, reject = `Returned` (`:668`) |
| `:729` | `POST /:id/admin-action` | `assertAgainstPolicy` `:755`; targets `{evaluate:'Under Review', approve:'Pending Final Approval', reject:'Returned'}` `:739` |
| `:827` | `POST /:id/approver-action` | `assertAgainstPolicy` `:855`; approve = `Approved`, decline = back through PDAS (`'Under Review'`) `:848-860` |
| `:936` | `POST /:id/assign-technician` | `assertAgainstPolicy(target:'Ongoing')` `:973`; mints `TRK-YYYY-NNNN` from `tracking_sequences` `:984-997`; writes `status='Ongoing'` `:999-1007`; history `:1009-1012`; three notifications `:1014-1022`; audit `:1024` |
| `:1037` | `POST /:id/replacement-flag` | tech/admin |
| `:1099` | `PUT /:id/status` | `normalizeStatus` `:1104`, `authorizeStatusChange` `:1123`; **tri-party notifications** `:1161-1189`; Completed → evaluation reminder `:1192-1200` |
| `:1216` | `PUT /:id/signed-form` | only in `Under Review` / `Awaiting Signatures` (`:1228-1230`) |
| `:1259` | `PUT /:id/complete-standard-form` | ownership guard `:1285` |
| `:1348` | `PUT /:id/replacement-flag` | update |
| `:1420` | `PUT /:id/archive` | `requireRole('admin')`, audited `:1440` |
| `:1456` | `PUT /:id/unarchive` | `requireRole('admin')` |

`normalizeStatus()` `:102-117` maps synonyms onto the canonical 12.

`auditLog` writes inside this file: `:602, 693, 715, 790, 810, 886, 920, 1024, 1086`.

---

## 3. Database — `fixit_pdas` (MySQL, XAMPP, `127.0.0.1:3306`)

Schema authority: `backend/database/schema.sql`; runtime column-ensuring:
`backend/src/scripts/autoSetup.js`.

**14 tables** (`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='fixit_pdas'` → `14`):

```
audit_log                     campus_locations (0 rows)     documents (0 rows)
evaluations (0 rows)          job_request_status_history    job_requests (2 rows)
message_replies               messages (0 rows)             notifications
preventive_maintenance_schedules   registration_requests (1 row)
ticket_sequences              tracking_sequences             users (7 rows)
```

### 3.1 `users` — 22 columns

`role enum('admin','campus_admin','faculty','staff','maintenance','technician')` — **6 values**.
`status enum('active','inactive')`. `is_supervisor tinyint(1)`.
`consent_at datetime` (`schema.sql:48`) — **never written**.
`id_photo_url varchar(500)` (`schema.sql:38`).

### 3.2 `registration_requests`

`role enum('faculty','staff')` — self-registration is structurally limited to those two.
`consent_at datetime` (`schema.sql:78`) — **never written**.
`id_photo_url varchar(500)` (`schema.sql:74`).
Live row: `id=1, faculty, approved, consent_at=NULL, id_photo_url=NULL`.

### 3.3 `job_requests` — 43 columns

Identity/routing: `id, ticket_no, requester_id, location_id, category, description, urgency_level,
request_type, is_standard_form_filled, immediate_supervisor, priority, status, assigned_to,
approved_by, scheduled_date, completed_at, created_at, updated_at`.

Approval chain: `supervisor_id, supervisor_approved, supervisor_approved_at, supervisor_remarks,
admin_approved, admin_approved_at, admin_remarks, admin_field_remarks, campus_admin_approved,
campus_admin_approved_at, campus_admin_remarks, requester_approved, requester_approved_at`.

Rejections/other: `rejection_stage, rejection_remarks, official_tracking_no, idempotency_key,
signed_form_confirmed, signed_form_confirmed_by, signed_form_confirmed_at, is_archived, archived_at,
is_replacement_flagged, replacement_reason, replacement_item_specs, replacement_procurement_status`.

**Absent:** any photo column, any building/floor/room column, any `qr_code` column,
any department/title column.

Enums:
* `category enum('Electrical','Air Conditioning','Mechanical','Water/Sanitary','Physical Structures','Drawing/Design','Safety & Compliance','Urgent Hazard')`
* `urgency_level enum('Low Risk','Medium Risk','High Risk')` — matches `ch1.md:99`.
* `request_type enum('Standard Request','Urgent Request')`
* `priority enum('low','medium','high','urgent')` — normalised away at create time
  (`requisitionRoutes.js:423`), a redundant twin of `urgency_level`.
* `status` **12 values**: `Draft, Pending Supervisor Approval, Pending, Under Review,
  Pending Final Approval, Awaiting Signatures, Approved, Ongoing, On Hold, Returned, Completed,
  Rejected`. Source of truth for the list: `backend/src/scripts/autoSetup.js` (`REQUEST_STATUSES`).

Live rows: `JR-2026-0001 Pending location_id=NULL`, `JR-2026-0008 Ongoing location_id=NULL`.

### 3.4 `campus_locations` — **0 rows**

```sql
id INT AI PK, building VARCHAR(150) NOT NULL, floor VARCHAR(50),
room VARCHAR(100), description VARCHAR(255), created_at TIMESTAMP
```

**No `qr_code` column** (`schema.sql:88-95`; grep `qr_code|campus_locations` in `autoSetup.js` → no
matches). `job_requests.location_id` → FK `fk_jr_location` → `campus_locations(id) ON DELETE SET NULL`
(`schema.sql:171`).

### 3.5 `preventive_maintenance_schedules`

`location VARCHAR(255) NOT NULL` (`schema.sql:230`) — a **string, not an FK**.
`assigned_to` FK → `users` (`schema.sql:235`).
**No `created_by`** — the paper requires the schedule be "linked … to the administrator who created
the schedule" (`ch3.md:116`).

### 3.6 `documents`

`id, job_request_id FK, uploaded_by FK, file_name, file_path, file_type, file_size, created_at`
(`schema.sql:268-279`) — **0 rows**, and no frontend caller.

### 3.7 Server configuration observed (read-only)

```
sql_mode = NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION
```

**Strict mode is OFF.** Over-length `VARCHAR` values are silently truncated, and unknown `ENUM`
values are stored as `''`, with the API still reporting success. `schema.sql:114-116` documents this
exact hazard.

---

## 4. Frontend

### 4.1 Shell — `frontend/src/App.jsx`

There is **no `react-router`** (grep in `frontend/package.json` → absent; `frontend/src` → no
`react-router` imports). Navigation is a single shell with role workspaces:

* lazy + `Suspense`: `AdminRoutes`, `FacultyRoutes`, `MaintenanceRoutes`, `CampusAdminRoutes`
  (`App.jsx:16-19`, fallback `:20-24`, used `:77, :99, :122, :144`)
* `SupervisorRoutes.jsx` exists but is **never imported** — grep `SupervisorRoutes` across
  `frontend/src` → only its own definition (`frontend/src/routes/SupervisorRoutes.jsx:7`). Designated
  supervisors are handled inside the Faculty workspace instead (`App.jsx:43-45`).
* `components/auth/AdminGuard.jsx` exports `AdminGuard` (`:7`) and is **never imported anywhere** —
  dead code.

### 4.2 Dependencies — `frontend/package.json:13-28`

```
html5-qrcode 2.3.8 | jsqr 1.4.0 | jszip 3.10.2 | lucide-react 1.39.0
qrcode 1.5.4 | react 19.2.8 | react-dom 19.2.8
dev: @types/react, @types/react-dom, @vitejs/plugin-react 6.1.0, oxlint 1.79.0, vite 8.2.2
```

**No Tailwind.** `grep tailwind frontend/package.json` → no matches.
Ch3 Table 4 and the methodology text specify *"React.js with Tailwind CSS"* (`ch3.md:41`,
`ch3.md:146`). Styling is a custom token CSS system in `frontend/src/index.css`
(46 `@media` rules; one `prefers-reduced-motion` at `:1820`).

Scripts: `dev`, `build`, `lint` (= `oxlint`), `preview`, `test` (= 7 node smoke scripts).

### 4.3 Views

```
views/  CommunicationBox | EvaluationForm | FacultyStaffPortal | OfficialDocuments
        PreventiveCalendar | PrintLabels | ReplacementRequests | SettingsPage
views/admin/        AnalyticsReports | ApprovalHistory | ArchivedRequests | AuditTrail
                     ExecutiveDashboard | JobRequests | PrintLabels | ReplacementRequests
                     SettingsPage | UserManagement
views/campusAdmin/  CampusAdminDashboard
views/faculty/      ActiveTickets | CampusMaintenance | FacultyCommunication
                     FacultyStaffDashboard | RequisitionHistory | SubmitJobRequest
views/maintenance/  WorkQueue
views/supervisor/   SupervisorDashboard
```

Navigation tables: `frontend/src/navigation/{admin,campusAdmin,faculty,maintenance,supervisor}Navigation.js`.

### 4.4 State — `frontend/src/context/DataContext.jsx`

| Concern | Line |
|---|---|
| `campusLocations` = `localStorage['fixit_pdas_campus_locations_v5']` | `:730`, persisted `:733-735` |
| `approvalHistory` = `localStorage['fixit_pdas_approvals_v3']` | `:398`, persisted `:747-749` — **`setApprovalHistory` is never called anywhere** (grep → 0 call sites), so the Approval History screen reads a frozen snapshot instead of `job_request_status_history` |
| `evaluations` = `localStorage['fixit_pdas_evaluations_v3']` | `:721` (server write happens first, `:1666-1675`) |
| Requisition list refresh | on mount `:556-557` + after the caller's own action (`:1063, 1112, 1133, 1164, 1281, 1407, 1437, 1587, 1610, 1628`) — **no interval, no push** |
| **Notification poll — the only timer** | `:604-608`, every **30 s** |
| Preventive reminder client timer | `:615-665`, hourly `:665` |
| Requisition read-model mapping, incl. `'Campus Facilities'` fallback | `:478-490` |
| Submit payload (no photo, no `locationId` value) | `:1006-1021` |
| `submitEvaluation` | `:1642-1684` |
| `archiveRequisition` / `unarchive` | `:1601`, `:1626` |
| `addCampusLocation` / `update` / `delete` (browser-local) | `:1836`, `:1858`, `:1875` |

`grep frontend/src` for `EventSource | WebSocket | socket.io | io(` → **no matches**. Real-time is
poll-only.

### 4.5 Request intake — the single definition

`frontend/src/utils/jobRequestIntake.js`
* `CATEGORY_OPTIONS` `:24-32` (7 values; DB has 8 — `Urgent Hazard` is set by the fast path only)
* `SCOPE_SECTIONS` `:34+`
* `buildRequisitionPayload()` `:90-151` returns `title, description, building, floor, room,
  location, qrCodeRef, category, urgency, requestType, isStandardFormFilled, immediateSupervisor,
  scopeOfWorks, actionTaken, finalAction, pdasFormName, requestedBy, requesterEmail, requesterRole,
  department, contactNumber, idNumber, photoUrl, isDraft` — **no `locationId`**.

Shared UI: `components/common/{RequestIntake,JobRequestFormOverlay,JobRequestLocationStep,
QrCodeScannerModal,UrgentIssueReport,JobRequestPrintSheet,PDASJobRequestFormDocument}.jsx`.

### 4.6 Offline — `frontend/src/utils/outbox.js`

| Item | Line |
|---|---|
| Storage key, cap 20 entries | `:22-23` |
| `newIdempotencyKey()` 16 random bytes → 32 hex | `:26-34` |
| `enqueue` | `:63-81` |
| `flushOutbox()` sequential retry, gives up after 5 attempts | `:91-126` |
| `isOffline()` | `:129-130` |
| `submitOrQueue()` — queues on `navigator.onLine === false` or on 0/5xx, never on 4xx | `:138-167` |

Flush triggers: `components/common/OfflineBanner.jsx:40, 122`, on the `online` event (`:52`).

Server counterpart: `idempotency_key` unique column, replay returns the original ticket
(`requisitionRoutes.js:348-375`).

---

## 5. Documents / PDF path

| Piece | Evidence | Wired? |
|---|---|---|
| DOCX generator | `backend/src/utils/docxJobRequestGenerator.js` | fills `trackingNumber` `:37`, `qrPayload = 'FIXIT-REQ:'+tracking` `:38`, `dateOfRequest/nameOfClient/officeOfClient/immediateSupervisor` `:125-128`, six scope sections `:245-362` — **no approval fields** |
| PDF via Word/PowerShell | `backend/src/utils/pdfGenerator.js:31-34`, script `backend/src/utils/exportToPdf.ps1`, template `backend/templates/job-request-master.docx`, 30 s timeout `pdfGenerator.js:34` | Windows + MS Word dependent |
| Endpoints | `jobRequestDocRoutes.js:35` (pdf), `:58` (docx), `:81` (`GET /:id/pdf`) | server-side ready |
| Frontend client | `frontend/src/backend/api.js:391` `apiGetJobRequestDocPdf` | **defined and never called** — grep `apiGetJobRequestDocPdf` across `frontend/src` → 1 match (the definition) |
| What the UI actually prints | `window.print()` in 10 places (`SupervisorDashboard.jsx:590`, `OfficialDocuments.jsx:113`, `PrintLabels.jsx:261`, `WorkOrderDialogs.jsx:486`, `RequestIntake.jsx:564`, `CampusAdminDashboard.jsx:816`, `JobRequests.jsx:998`, `ModularFormPreviewPanel.jsx:33`) | browser print of a React component |
| Approver names in that component | `JobRequestPrintSheet.jsx:134` `KRISTINE J. AMAR`, `:151` fallback `RAMIL G. LUMAUAG, Ed.D., DIT`; `PDASJobRequestFormDocument.jsx:251,254` and `:273,276` | **hardcoded** |

---

## 6. Verification surface (all read-only observations)

| Suite | Command | State observed |
|---|---|---|
| Frontend lint | `npm.cmd run lint` (oxlint, from `frontend/`) | baseline 46 warnings / 0 errors |
| Frontend build | `npm.cmd run build` | 0 errors |
| Frontend smokes | `npm.cmd test` → 7 `scripts/*.mjs` | 2 pre-existing failures in `calendar-smoke.mjs` |
| Backend tests | `npm test` (node:test) | 93 passing — **not run during this audit** (it writes fixtures; see §7) |
| Backend test files | `backend/tests/{ticketPolicy,enumVocabulary,wordLimit,reviewAssign,surfaceRamp}.test.js` | policy + enum coverage exists |
| Live smoke | `backend/scripts/smokeLive.mjs`, `backend/scripts/chainSmoke.mjs` | `chainSmoke` archives tickets — **writes** |

---

## 7. What this audit did *not* do

* No file outside `audit/` was created, edited, renamed, moved or deleted.
* No migration, seeder, `npm install`, `npm audit fix`, formatter, or `--fix` linter.
* No server started, no test executed (backend tests and both smoke scripts insert/update/delete
  rows; they were therefore **not** run).
* No git commit, push, branch, stash, checkout or index change.
* Reads against `fixit_pdas` were limited to `SELECT` / `SHOW` / `DESCRIBE` /
  `information_schema`.
* One credential location exists in the repository — `backend/.env` (and the placeholder
  `backend/.env.example`). **No value from either file is printed anywhere in this audit**; only the
  fact of their existence and the placeholder's *length* was inspected.
