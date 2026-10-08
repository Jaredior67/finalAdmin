# 06 — Implementation Plan (PLAN ONLY)

> **Nothing in this file has been implemented.** It is a plan. No code, schema, migration, seeder,
> dependency, or configuration change was made while producing it. The `audit/` folder and these
> eight reports are the only artefacts this audit created.

**Effort scale:** XS < 1 h · S < 4 h · M < 1 day · L < 3 days · XL ≥ 3 days.

**Phase order (fixed by the brief):**
`P0 Security/Privacy + Data Integrity` → `P1 Core Workflow` → `P2 Missing Features` →
`P3 UX/Performance` → `P4 Documentation`.

Gap IDs link to `04_gap_analysis.md`; paper line refs link to the extracted chapters; checklist
letters link to `02_conformance_matrix.md`.

---

## Phase 0 — Security, privacy and data integrity

### T-01 · Block self-approval on every approval leg
* **Gap:** G-12 · **Checklist:** E9 · **Type:** 🔒 security (papers silent — `05_extra` B6)
* **Files:** `backend/src/routes/requisitionRoutes.js` (handlers at `:636`, `:729`, `:827`);
  possibly `backend/src/utils/ticketPolicy.js`
* **Exact change:** in each of `supervisor-action`, `admin-action`, `approver-action`, after the row
  is fetched `FOR UPDATE`, reject when `Number(jr.requester_id) === Number(req.user.id)` with
  `403` and a message naming the rule. Add the same check inside `assertAgainstPolicy`
  (`ticketPolicy.js:250`) so it cannot be forgotten in a future endpoint — the function already
  receives `row` and `user`.
  *Nuance to preserve:* the **requester's own confirmation** (`requisitionRoutes.js:490-491`) must
  keep working, and the auto-endorse path (`:473-476`) must keep recording it as the supervisory
  confirmation — that is paper-mandated (`ch1.md:102`). Only the *later* legs are blocked.
* **Migration / backward-compat:** none (no schema change). Existing rows unaffected; a ticket
  already self-approved stays approved (do not retro-void live data).
* **Effort:** S · **Depends on:** nothing · **Regression risk:** Medium — admin and Approver are
  also the test fixtures' requesters in some seeds. Verify fixtures use a distinct requester.
* **Verification:** unit test in `backend/tests/ticketPolicy.test.js` asserting 403 for
  `requester_id === user.id` on all three actors and 200/allowed for a different actor; a manual
  trace of `chainSmoke`-style flow **not run here** (it writes — needs your approval first).

### T-02 · Capture consent at registration (`consent_at`)
* **Gap:** G-05 · **Checklist:** A5, L10 · **Type:** 🔒📄
* **Files:** `frontend/src/components/auth/RegisterModal.jsx`; `frontend/src/backend/api.js:207`;
  `frontend/src/context/DataContext.jsx:842-852`; `backend/src/routes/authRoutes.js:147-167`;
  `backend/src/routes/userRoutes.js:62-73`; UI copy component (new, small)
* **Exact change:**
  1. Add a required checkbox + short privacy notice to the registration form (RA 10173 wording —
     `ch2.md:34` already states the three principles: transparency, legitimate purpose,
     proportionality). No checkbox → no submit.
  2. Send `consentAt: new Date().toISOString()` in the register payload.
  3. Server: add `consent_at` to the INSERT column list at `authRoutes.js:148-150` and to
     `userRoutes.js:62-63` (copy it from `registration_requests` into `users` on approve).
  4. Reject a request with no `consentAt` (`400`).
* **Migration / backward-compat:** columns already exist (`schema.sql:48`, `:78`), **no migration
  needed**. Existing rows stay `NULL` — that is truthful (they never consented). Add a nullable
  backfill only if you decide old accounts must be re-prompted; recommended: show a one-time
  consent banner to `NULL`-consent accounts on next login instead of silently backfilling.
* **Effort:** M · **Depends on:** nothing · **Regression risk:** Low (registration is a single
  flow; the smoke `frontend/scripts/*` tests do not cover the modal — see verification).
* **Verification:** manual register once against the dev DB (writes one row — **ask first**); assert
  `SELECT consent_at FROM registration_requests ORDER BY id DESC LIMIT 1` is non-NULL; assert
  `users.consent_at` non-NULL after approve.

### T-03 · Fix the ID-photo path (size cap + correct field name + truncation safety)
* **Gap:** G-06, G-07 · **Checklist:** A6, A7, A8 · **Type:** 🔒
* **Files:** `frontend/src/components/auth/RegisterModal.jsx:56-66, 84, 98-100`;
  `frontend/src/views/admin/UserManagement.jsx:1247, 1258`; `frontend/src/backend/api.js:86-106`;
  `backend/src/routes/authRoutes.js:147-167`
* **Exact change:**
  1. Client: cap the file at ~200 KB before `readAsDataURL`; downscale with the same canvas trick
     already used at `JobRequestFormOverlay.jsx:183-210`; reject larger files with a message.
  2. Client: `normalizeRegistration` must also emit `idPreviewUrl` and `idFileName` (alias to
     `idPhotoUrl` / a stored filename), **or** change `UserManagement.jsx:1247` to read
     `selectedPendingReg.idPhotoUrl` and `:1258` to derive a filename. Prefer fixing the view —
     one line each, no API-shape churn.
  3. Server: validate `idPhotoUrl` length ≤ 500 and reject with `413`/`400` rather than letting
     non-strict MySQL truncate (this is the failure mode `schema.sql:114-116` warns about).
  4. *Optional but recommended:* move the image out of the row — store a file under the existing
     (unused) `documents` table and keep only a path in `id_photo_url`. Larger change; see T-11.
* **Migration / backward-compat:** none required for (1)–(3). If (4) is done, a one-off backfill
  script is needed — **a migration, which this audit did not run and the plan does not execute.**
* **Effort:** S for (1)–(3); L for (4) · **Depends on:** nothing for (1)–(3); T-11 for (4)
* **Regression risk:** Low (1)–(2); Medium (4) because every reader of `id_photo_url` must change.
* **Verification:** register with a 5 MB photo → client rejects before upload; register with a
  small photo → admin pane renders it (`UserManagement.jsx:1247`); `SELECT LENGTH(id_photo_url)
  FROM registration_requests` ≤ 500.

### T-04 · Log and notify registration approve *and* reject
* **Gap:** G-11 · **Checklist:** A9, A10, E10 · **Type:** 📄 (`ch1.md:104`, `ch3.md:110`)
* **Files:** `backend/src/routes/userRoutes.js:45-107`, `:110-127`
* **Exact change:**
  1. In the reject handler, after the UPDATE succeeds, insert a `notifications` row for
     `reviewed_by`'s counterpart — the registrant does not yet have a `users` account, so either
     (a) store the message in `notifications` keyed to a `pending` marker, or (b) (simpler, and
     what the frontend already polls) surface the outcome through the existing
     `GET /api/users/my-registration` (`userRoutes.js:76-96`) **and** add a row to `audit_log`.
     Recommend: **audit row is mandatory; applicant-facing notice is best delivered by email or by
     the existing registration-status screen** (`RegisterModal.jsx:151-176` already shows
     `rejection_reason`).
  2. Add `auditLog(...)` calls to both handlers: action `registration.approved` /
     `registration.rejected`, entity `registration_request`, `entityId = id`, details = role or
     reason. Mirror the call shape used at `userRoutes.js:279`.
  3. Wrap approve in the same transaction discipline already used (`FOR UPDATE` at `:51`).
* **Migration / backward-compat:** none.
* **Effort:** S · **Depends on:** nothing · **Regression risk:** Low.
* **Verification:** `SELECT action FROM audit_log WHERE entity = 'registration_request'` returns
  both values after one approve + one reject (writes — **ask before running**).

### T-05 · Persist the request's location (fix `location_id`)
* **Gap:** G-01 · **Checklist:** C10, C11 · **Type:** 📄 (`ch3.md:115`)
* **Files:** `frontend/src/utils/jobRequestIntake.js:112-151`;
  `frontend/src/context/DataContext.jsx:1006-1021`; `backend/src/routes/requisitionRoutes.js:336-346`
* **Exact change:** three lines that make an existing field actually flow:
  1. `buildRequisitionPayload` returns `locationId` (accept it as a parameter or read it off
     `form`).
  2. The overlay's location step must carry the resolved id: `JobRequestLocationStep` /
     `QrCodeScannerModal` resolve a scanned code to a location record — pass its `id` up.
  3. `DataContext.jsx:1020` then receives a real value; the server already reads it (`:337`) and
     stores it (`:503`).
* **Sequencing:** this needs a populated `campus_locations` (T-06) **or** it must fall back to
  creating a row on first use. Do T-06 first, or bundle both.
* **Migration / backward-compat:** column and FK already exist and are nullable (`schema.sql:124`,
  `:171`). Existing tickets keep `NULL` — do **not** bulk-update history from a display string;
  that would invent data. Add an admin tool to backfill old tickets by hand if wanted.
* **Effort:** M · **Depends on:** T-06 · **Regression risk:** Medium — the read-back at
  `DataContext.jsx:490` must keep its fallback for historical `NULL` rows.
* **Verification:** file one ticket; `SELECT location_id FROM job_requests ORDER BY id DESC LIMIT 1`
  non-NULL; `AnalyticsReports.jsx:86` `uniqueLocations` now shows >1 value.

### T-06 · Make `campus_locations` the real registry (and add `qr_code`)
* **Gap:** G-21, G-22 (and unblocks G-01, G-04) · **Checklist:** C1–C4 · **Type:** 📄
* **Files:** `backend/database/schema.sql:88-95`;
  `backend/src/scripts/autoSetup.js` (its `ensureColumn` pattern, see `:191-201`);
  `backend/src/routes/lookupRoutes.js`; `frontend/src/context/DataContext.jsx:730, 1836-1887`;
  `frontend/src/backend/api.js` (new lookup functions); admin UI for the registry
* **Exact change:**
  1. **Migration (pre-approved for editing, not for running):** add
     `qr_code VARCHAR(64) UNIQUE NULL` to `campus_locations` in `schema.sql`, and add an
     `ensureColumn(...)` line in `autoSetup.js` so a dev box picks it up without a manual migration.
  2. Populate from the existing presets: the 27 entries in `QrCodeScannerModal.jsx:11-103` and
     `CAMPUS_ROOM_QR_PRESETS` (`JobRequestLocationStep.jsx:15-31`) give building/floor/room and an
     `ISATU-…` reference. Insert them as a **seed script** (a file, run once, **not** run by this
     audit).
  3. Wire the frontend to `GET /api/lookups/campus-locations` on boot and to POST/PUT/DELETE from
     the admin registry screen; keep the localStorage cache as an **offline mirror** (the offline
     objective `ch1.md:40` still needs it), with the server as source of truth.
  4. Remove the duplication: `PrintLabels.jsx:12-17` and `RequestIntake.jsx:235` read
     `campusLocations` from context — repoint that context at the merged server+cache list.
* **Migration / backward-compat:** additive column + new rows; `location_id` FK already
  `ON DELETE SET NULL`. Old tickets unaffected. The localStorage key (`v5`) should be versioned to
  `v6` when its role changes to cache-only, so stale browser data cannot masquerade as authority.
* **Effort:** L · **Depends on:** nothing (but T-05 depends on it) · **Regression risk:** High —
  this touches intake, scanner, print labels and admin in one move. Ship behind a feature flag or
  in two commits (server first, client second).
* **Verification:** `SELECT COUNT(*) FROM campus_locations` ≈ 27; scan a printed code and confirm it
  resolves to a DB row, not a preset.

### T-07 · Move `approvalHistory` to the database
* **Gap:** G-23 · **Checklist:** E10 · **Type:** 📄
* **Files:** `frontend/src/context/DataContext.jsx:398, 747-749`; `frontend/src/views/admin/ApprovalHistory.jsx`
* **Exact change:** fetch `job_request_status_history` through an existing or new read endpoint
  (there is already `GET /:id` per-ticket history), replace the `fixit_pdas_approvals_v3` state
  with the fetched rows, and delete the never-called `setApprovalHistory` path. Keep localStorage
  only as an offline mirror if desired.
* **Migration:** none. **Effort:** S · **Depends on:** nothing · **Regression risk:** Low-Medium
  (column names differ: history has `from_status/to_status/changed_by/remarks`; the screen expects
  approval-shaped records — write an adapter).
* **Verification:** approve one ticket as admin, reload, confirm it appears without any local write.

### T-08 · Align client and server password rules
* **Gap:** G-25 · **Checklist:** A11, L22 · **Type:** 🔒
* **Files:** `frontend/src/components/auth/RegisterModal.jsx:84-91`; any other signup surface
* **Exact change:** mirror `authRoutes.js:15-23` exactly — ≥8 chars, ≥1 letter, ≥1 digit — and show
  all three requirements as live hints.
* **Migration:** none. **Effort:** XS · **Depends on:** nothing · **Regression risk:** Very low.
* **Verification:** 6-char password now blocked client-side with the same wording the server uses.

### T-09 · Harden token storage *(optional, decide first)*
* **Gap:** G-30 · **Checklist:** L8 · **Type:** 🔒 (papers specify no mechanism)
* **Files:** `frontend/src/backend/api.js:111-118`
* **Exact change:** consider `httpOnly; Secure; SameSite=strict` cookie instead of
  `localStorage`, which requires a CORS/credentials change at `server.js:43` and a CSRF posture
  decision. **This is a design change, not a patch.**
* **Migration / backward-compat:** old `localStorage` tokens must be accepted for one release or
  all sessions invalidated (users re-login).
* **Effort:** L · **Depends on:** a decision from you · **Regression risk:** High — touches every
  request path. **Recommend deferring** unless a threat model demands it.

**Phase 0 exit criteria:** G-05, G-06, G-07, G-11, G-25 closed; G-01, G-21, G-22 closed or in
progress; G-12 closed; G-23 closed.

---

## Phase 1 — Core workflow

### T-10 · Assign → `Approved`, then technician starts → `Ongoing`
* **Gap:** G-09 · **Checklist:** G2 · **Type:** 📄 (`ch3.md:88`, `ch3.md:106`)
* **Files:** `backend/src/routes/requisitionRoutes.js:999-1007`;
  `backend/src/utils/ticketPolicy.js:31-59, 146-172`; `frontend/src/views/maintenance/WorkQueue.jsx:242`
* **Exact change:**
  1. `assign-technician` writes `status = 'Approved'` (not `'Ongoing'`) while still minting the
     tracking number at `:984-997` and writing `assigned_to`.
  2. Confirm `'Approved' → 'Ongoing'` is already legal (`ticketPolicy.js:49`) ✅ and that
     `missingApprovalFor` still requires `campus_admin_approved` for that hop (`:168-170`) ✅.
  3. Add a technician-facing "Start work" action that performs `Approved → Ongoing`
     (`WorkQueue.jsx`), notifying requester + admin as `ch3.md:106` specifies — the notification
     helper already exists at `requisitionRoutes.js:1161-1189`.
  4. Keep `authorizeStatusChange`'s tech carve-out (`ticketPolicy.js:183-186`) but extend it to
     allow the tech's own `Approved → Ongoing` as well as `Ongoing → Completed`.
* **Migration / backward-compat:** **no schema change.** Do **not** rewrite live rows: the ticket
  currently sitting in `Ongoing` stays there (rewriting history would falsify
  `job_request_status_history`). One sentence in the release note is enough.
* **Effort:** M · **Depends on:** nothing · **Regression risk:** **High** — this changes what the
  technician's queue shows. `WorkQueue.jsx:242` currently assumes `Ongoing`; `workOrders` selectors
  and the supervisor/campus-admin dashboards filter on status.
* **Verification:** grep every consumer of `'Ongoing'` before editing; run the enum test
  (`backend/tests/enumVocabulary.test.js`, non-writing) and `ticketPolicy.test.js`; trace one
  assignment → start → complete cycle (writes — **ask first**).

### T-11 · Requester can revise and resubmit a Returned ticket
* **Gap:** G-08 · **Checklist:** E6 · **Type:** 📄 (`ch3.md:70`)
* **Files:** `frontend/src/views/FacultyStaffPortal.jsx:485-502`; the ticket-detail modal;
  `backend/src/utils/ticketPolicy.js:182-190`
* **Exact change:**
  1. Add an **Edit & Resubmit** action visible to the requester only when
     `status === 'Returned'`.
  2. Server: allow a *narrow* requester carve-out in `authorizeStatusChange` — requester may move
     **their own** `Returned → Pending` and nothing else. The transition already exists
     (`ticketPolicy.js:56`). Everything else stays 403.
  3. Reuse the existing overlay (`JobRequestFormOverlay`) prefilled from the ticket; on save call
     `PUT /:id/status` with `Pending` plus remarks, which already writes history
     (`requisitionRoutes.js:1161`) and notifies the supervisor chain.
  4. Ensure `requester_approved` is refreshed (`requisitionRoutes.js:496-499`) so the confirmation
     prompt is not stale.
* **Migration:** none. **Effort:** M · **Depends on:** T-10 helps but is not required
* **Regression risk:** Medium-High — the requester carve-out must be *exhaustively* narrow or it
  becomes a privilege escalation. Unit-test the exact matrix.
* **Verification:** new cases in `backend/tests/ticketPolicy.test.js`: requester can move only
  `Returned → Pending` on their own row; requester 403 on every other cell; admin unaffected.

### T-12 · Supervisor notification scoped to the unit
* **Gap:** G-15 · **Checklist:** F8 · **Type:** 📄 (`ch3.md:74`)
* **Files:** `backend/src/routes/requisitionRoutes.js:81-87, 579-584`
* **Exact change:** `notifySupervisors` should prefer the ticket's resolved `supervisor_id`
  (written at `:462`) and only broadcast when that is null (the auto-endorse case already has its
  own branch at `:568-576`). Keep a broadcast fallback for unassigned supervisors.
* **Migration:** none. **Effort:** S · **Depends on:** nothing · **Regression risk:** Low.
* **Verification:** two supervisor accounts; file a ticket for unit A; assert only A's supervisor
  gets the row (`SELECT COUNT(*) FROM notifications WHERE title='Awaiting your endorsement'`).

### T-13 · Real-time list refresh
* **Gap:** G-13 · **Checklist:** F5 · **Type:** 📄 (`ch1.md:35`, `ch1.md:104`)
* **Files:** `frontend/src/context/DataContext.jsx:556-608`
* **Exact change (staged):**
  1. **Cheap:** reuse the existing 30-second notification poll to *also* call
     `refreshRequisitions()` when the visible notification count changes, or run a 30 s list poll
     while the tab is visible (`document.visibilityState === 'visible'`).
  2. **Proper (optional):** add SSE (`GET /api/job-requests/stream`) emitting an event on commit —
     `requisitionRoutes.js` already has a single commit point per mutation. No new dependency
     needed (`res.writeHead` + `retry:`); a WebSocket would add one.
  3. Always throttle on `visibilitychange` and skip when offline (the offline objective
     `ch1.md:40` must keep working).
* **Migration:** none. **Effort:** S for (1), L for (2) · **Depends on:** nothing
* **Regression risk:** Medium — polling increases `GET /` traffic; the endpoint already pages
  (`requisitionRoutes.js:195-214`) and scopes (`:127-155`), so cost stays bounded.
* **Verification:** two browsers, change a status in one, confirm the other updates ≤ 30 s later
  with no manual reload.

### T-14 · Approve/reject audit coverage across the whole lifecycle
* **Gap:** G-27 (and completes G-11) · **Checklist:** E10, I3 · **Type:** 📄 (`ch1.md:104`)
* **Files:** `backend/src/routes/requisitionRoutes.js:1099-1204` (generic status write has no
  `auditLog`), `:1456-1478` (unarchive); `backend/src/routes/userRoutes.js` (T-04)
* **Exact change:** add `auditLog` at the generic status endpoint and at unarchive, mirroring the
  existing call shape (`requisitionRoutes.js:790`). Also emit an audit row for archive **and**
  unarchive so the pair is symmetric.
* **Migration:** none. **Effort:** S · **Depends on:** T-04 · **Regression risk:** Very low
  (append-only).
* **Verification:** `SELECT action, COUNT(*) FROM audit_log GROUP BY action` shows the new actions.

**Phase 1 exit criteria:** G-08, G-09, G-13, G-15 closed; G-12 and G-14 verified; E3/E10 (order
enforcement) still passing.

---

## Phase 2 — Missing features

### T-15 · Automatic archiving on `Completed` and `Rejected`
* **Gap:** G-03 · **Checklist:** H3, H4 · **Type:** 📄 (`ch1.md:104`, `ch1.md:114`)
* **Files:** `backend/src/routes/requisitionRoutes.js:1192-1200` (the `Completed` branch) and the
  point where `Rejected` is written; optionally `backend/src/server.js:184-185`
* **Exact change (two options — decide):**
  * **(a) Immediate (recommended):** inside the same transaction that writes the terminal status,
    set `is_archived = 1, archived_at = NOW()`. Simple, transactional, needs no scheduler, and
    matches `ch3.md:115` ("archived records stay in the same table").
  * **(b) Deferred:** a nightly job that archives tickets terminal for > N days. Closer to the
    "let the ink dry" mental model but adds a scheduler and a state window.
  Apply to **both** `Completed` and `Rejected` (`ticketPolicy.js:57-58`). Keep the manual archive
  and `unarchive` as-is — `ch3.md:115` requires retrievability, already satisfied by
  `?archived=true` (`requisitionRoutes.js:160`).
* **Migration / backward-compat:** **no schema change** (`is_archived`, `archived_at` exist).
  Do **not** retro-archive existing terminal tickets without asking — that changes what users see
  today. If you want history cleaned up, do it as a separate, reversible UPDATE with a written
  `WHERE` clause and a recorded row count.
* **Effort:** S for (a), M for (b) · **Depends on:** T-14 (archive should be audited)
* **Regression risk:** Medium — `ArchivedRequests.jsx`, the default list filter
  (`requisitionRoutes.js:160, 249`) and every dashboard count (`/stats`, `:247`) will see tickets
  move out of the default view. Confirm the dashboards exclude archived the same way.
* **Verification:** complete a ticket → it appears under Archived and disappears from the active
  list; `unarchive` restores it; both directions audited.

### T-16 · Store the request photo
* **Gap:** G-02 · **Checklist:** D5, D6 · **Type:** 📄 (`ch1.md:99`, `ch3.md:118`)
* **Files:** `frontend/src/context/DataContext.jsx:1006-1021`;
  `backend/src/routes/requisitionRoutes.js:336-346, 496-516`;
  `backend/database/schema.sql` (`job_requests` block); `backend/src/scripts/autoSetup.js`;
  `backend/src/routes/documentRoutes.js` (already complete)
* **Exact change (two options — decide):**
  * **(a) Reference (recommended, matches `ch3.md:115` "photo reference"):** upload via the
    already-built `POST /api/documents` (`documentRoutes.js:72`, 10 MB, allow-list, auth at
    `:51`), store `document.id` (or `file_path`) on the ticket, and add **one nullable column**
    `photo_document_id INT NULL` + FK to `documents` on `job_requests`.
  * **(b) Inline:** add `photo_url VARCHAR(500)` and keep base64 — repeats the G-07 truncation
    hazard and bloats `SELECT /`; **not recommended**.
  Then: send `photoUrl`/`documentId` in the payload (it is already built at
  `jobRequestIntake.js:149` and dropped at `DataContext.jsx:1006-1021`), read it at
  `requisitionRoutes.js:336`, include it in the INSERT, and render it in the ticket detail +
  `PDASJobRequestFormDocument`.
* **Migration / backward-compat:** **(a) needs a real migration** — one nullable column, no
  backfill (historical tickets have no photo; that is the truth). Add the `ensureColumn` line to
  `autoSetup.js` so dev boxes self-heal, the pattern used at `autoSetup.js:191-201`.
  Nullable + FK `ON DELETE SET NULL` keeps old rows valid.
* **Effort:** M · **Depends on:** nothing (T-03 if you also move the ID photo)
* **Regression risk:** Medium — `express.json({limit:'15mb'})` (`server.js:59`) already tolerates
  inline images, but switching to multipart means the frontend finally needs `FormData` (grep
  `new FormData(` in `frontend/src` → none today).
* **Verification:** file a ticket with a photo; assert `documents` count increments; open the
  ticket and see the image; download it through `GET /api/documents/:id/download` (auth-checked).

### T-17 · Generate the official PDF with all four approvals
* **Gap:** G-10 · **Checklist:** E11, H9 · **Type:** 📄 (`ch1.md:36`, `ch1.md:103`)
* **Files:** `frontend/src/backend/api.js:391` (already defined, unused);
  the print sheet entry points (`JobRequests.jsx:998`, `RequestIntake.jsx:564`,
  `OfficialDocuments.jsx:113`, `WorkOrderDialogs.jsx:486`); `frontend/src/components/common/
  JobRequestPrintSheet.jsx:82-155`; `PDASJobRequestFormDocument.jsx:85-276`;
  `backend/src/utils/docxJobRequestGenerator.js:125-362`
* **Exact change:**
  1. **Kill the hardcoded names first (cheap, high value):** replace
     `KRISTINE J. AMAR` (`JobRequestPrintSheet.jsx:134`,
     `PDASJobRequestFormDocument.jsx:251,254`) and the `RAMIL G. LUMAUAG` fallback
     (`JobRequestPrintSheet.jsx:151`, `PDASJobRequestFormDocument.jsx:273,276`) with the real
     names + timestamps from `supervisor_approved_at`, `admin_approved*`, `campus_admin_approved*`
     on the ticket — exactly what `ch1.md:120` defines ("the approver's name, date, and time").
  2. **Then wire the endpoint:** call `apiGetJobRequestDocPdf` (`api.js:391`) from the "Download
     PDF" affordance instead of / alongside `window.print()`.
  3. **Teach the DOCX generator the approval block:** `docxJobRequestGenerator.js` currently has
     no approval fields (grep `approv` → 5 hits, all `immediateSupervisor`/QR). Add four
     `Electronically Approved by …` lines with name/date/time.
* **Migration:** none. **Effort:** M · **Depends on:** nothing
* **Regression risk:** **Medium-High and environment-specific** — the PDF path is
  Windows/PowerShell/Word (`pdfGenerator.js:31-34`, `exportToPdf.ps1`, 30 s timeout,
  `templates/job-request-master.docx`). It will fail on any box without Word. Decide whether the
  browser print (`window.print()` + `@media print` at `index.css:2957`) becomes the primary and
  the server PDF the optional extra. There is also a rate limiter on the endpoint
  (`jobRequestDocRoutes.js:24-29`) to respect.
* **Verification:** hit `POST /api/job-requests-doc/generate-pdf` once (writes a temp file under
  `uploads/temp/` — **ask first**); open the result and confirm four distinct names/dates.

### T-18 · Enforce the urgent same-day deadline
* **Gap:** G-16 · **Checklist:** D8 · **Type:** 📄 (`ch1.md:103`)
* **Files:** `backend/src/routes/requisitionRoutes.js:1259-1346`;
  `frontend/src/context/DataContext.jsx:952`; `frontend/src/views/FacultyStaffPortal.jsx:340-375`
* **Exact change:** compute the deadline server-side from `created_at` (never trust the client
  string): if `request_type = 'Urgent Request'` and `is_standard_form_filled = 0` and
  `created_at < CURDATE()` → either (a) reject completion with a clear message, or (b) allow but
  flag overdue and notify admins — **decide which**; the paper says "expected to", which reads as
  (b) with a nag rather than a hard block. Render the remaining time from the server value.
* **Migration:** none. **Effort:** S · **Depends on:** nothing · **Regression risk:** Low.
* **Verification:** unit test with a fixed clock; manual: an urgent ticket dated yesterday shows
  "overdue".

### T-19 · Preventive-maintenance relationships (`created_by`, location FK)
* **Gap:** G-17 · **Checklist:** J · **Type:** 📄 (`ch3.md:116`)
* **Files:** `backend/database/schema.sql:224-236`;
  `backend/src/scripts/autoSetup.js`; `backend/src/routes/preventiveRoutes.js:36, 44`
* **Exact change:** add `created_by INT NULL` + FK → `users(id)`, populate it from `req.user.id` on
  create; consider changing `location VARCHAR(255)` to `location_id INT NULL` FK →
  `campus_locations(id)` — **only after T-06 populates the table**, otherwise every schedule would
  point nowhere.
* **Migration / backward-compat:** both columns must be **nullable** so existing rows remain
  valid; backfill `created_by` as `NULL` (unknown) rather than guessing. If the location becomes
  an FK, keep the old string column alongside for one release (`location_legacy`) and read
  `location_id ?? location_legacy`.
* **Effort:** M · **Depends on:** T-06 for the location FK · **Regression risk:** Medium.
* **Verification:** create a schedule → `SELECT created_by` non-NULL; old schedules still render.

### T-20 · Recurring-issues report
* **Gap:** G-26 (part) · **Checklist:** L20 · **Type:** 📄 (`ch1.md:104` names it explicitly)
* **Files:** `frontend/src/views/admin/AnalyticsReports.jsx`; possibly a read endpoint
* **Exact change:** a "recurring issues" grouping — count tickets by `(location, category)` and
  surface those above a threshold, or show repeat tickets on the same `location_id` within N days.
  Depends on T-05 for meaningful `location_id` values.
* **Migration:** none. **Effort:** M · **Depends on:** T-05 · **Regression risk:** Low (read-only).
* **Verification:** with ≥3 tickets in one location, the report ranks it.

**Phase 2 exit criteria:** G-02, G-03, G-10, G-16, G-17, G-26 closed.

---

## Phase 3 — UX and performance

### T-21 · Print genuinely scannable QR labels
* **Gap:** G-04 · **Checklist:** C7, C8 · **Type:** 📄 (`ch3.md:115`, `ch3.md:159`)
* **Files:** `frontend/src/views/PrintLabels.jsx:3, 535-551`; the label grid
* **Exact change:** replace the lucide `<QrCode>` icon at `:548` with a real encoding —
  `import('qrcode').then(m => m.toDataURL(...))`, the exact pattern already used at
  `JobRequestPrintSheet.jsx:18-19`. Payload: the location's `qr_code` from `campus_locations`
  (T-06), not a decorative string. Fix the `:535` comment that says *"QR simulation"*.
* **Migration:** none. **Effort:** S · **Depends on:** T-06 (needs real `qr_code` values)
* **Regression risk:** Low — purely additive rendering.
* **Verification:** print a label, scan it with a phone, confirm `QrCodeScannerModal.jsx:246-302`
  resolves it to the right location.

### T-22 · Unify status labels across UI
* **Gap:** G-14 (labels) · **Checklist:** F2 · **Type:** 📄
* **Files:** `frontend/src/components/common/StatusBadge.jsx:37, 41`;
  `frontend/src/views/admin/JobRequests.jsx:396`;
  `frontend/src/views/FacultyStaffPortal.jsx:50`; `README.md:15-16`; `docs/API.md:32`
* **Exact change:** pick the paper's labels — "Returned for Revision" and "On-hold" — or the
  badge's shorter ones, and use **one** map everywhere (a shared `statusLabels.js`). Then update
  the two docs (`G-29`).
* **Migration:** none (display only). **Effort:** XS · **Depends on:** nothing
* **Regression risk:** Very low, but grep for any logic that compares *labels* rather than values
  first (the code has been bitten by this before — see the comment at `DataContext.jsx:1007-1010`).
* **Verification:** `npm.cmd run lint`; visual check of every status chip.

### T-23 · Reduce critical-path bundle
* **Gap:** G-31 · **Checklist:** L16 · **Type:** neutral
* **Files:** `frontend/src/index.css`; `frontend/src/context/DataContext.jsx`;
  `frontend/src/App.jsx:16-19`
* **Exact change:** profile first (needs a dev server — **ask before running**). Candidates: split
  `index.css` (68 KB) so non-critical chunks load lazily; move `SettingsPage`'s 489 KB chunk's
  shared vendor code into `index` only if it is actually shared; check `qrcode`, `jszip`,
  `html5-qrcode` are all dynamically imported (`JobRequestPrintSheet.jsx:18` already does this
  right).
* **Effort:** M · **Depends on:** a profiling run you approve · **Regression risk:** Medium
  (render regressions are easy to introduce).
* **Verification:** compare `frontend/dist/assets` sizes before/after; smoke scripts pass.

### T-24 · Review the two gloss deviations and remaining Phase-1 UI groups
* **Gap:** carried over from the earlier UI-alignment workstream (not from this audit)
* **Files:** wherever the two `System Administrator (Administrator)` glosses appear
* **Exact change:** your decision — see "Open decisions" below.
* **Effort:** XS · **Depends on:** your call · **Regression risk:** Very low.

**Phase 3 exit criteria:** G-04, G-14 (labels), G-31 addressed; T-24 resolved.

---

## Phase 4 — Documentation and papers

| ID | Task | Files | Effort |
|---|---|---|---|
| T-25 | Refresh lifecycle docs to the real 12-state model | `README.md:15-16`, `docs/API.md:32-34` | XS |
| T-26 | Record the manual backup, or implement a scheduled one (B11 / K10) | `README.md:317-318`, new `backend/scripts/backup.mjs`, `server.js` scheduler | S / M |
| T-27 | Note the two maintenance role values as one paper role | `README.md`, `docs/API.md` | XS |
| T-28 | Remove dead code **or** document why it stays | `AdminGuard.jsx:7`, `SupervisorRoutes.jsx:7`, `lookupRoutes.js:8-71` (after T-06), `documentRoutes.js` (after T-16), `api.js:391` (after T-17), stale comment `DataContext.jsx:837-841` | S |
| T-29 | Apply the eleven paper corrections (B1–B11) | `thesis1_revised.docx`, `thesis3_revised_v4.docx` — **outside this repo** | L |
| T-30 | Add `helmet` (optional) or document why headers are hand-rolled | `backend/package.json`, `server.js:61-79` | XS |

**Phase 4 exit criteria:** docs match code; paper corrections sent to you for the manuscripts.

---

## Regression checklist (run at the end of every phase)

**Non-writing (safe to run unattended):**

- [ ] `cd frontend && npm.cmd run lint` — baseline 46 warnings / 0 errors; **no new errors**
- [ ] `cd frontend && npm.cmd run build` — must exit 0
- [ ] `cd backend && npm test` — baseline **93 passing** *(writes fixture rows — **ask before
      running**; if approved, note it mutates `fixit_pdas`)*
- [ ] `node backend/tests/ticketPolicy.test.js` and `enumVocabulary.test.js` specifically — these
      guard the exact code T-10 and T-11 touch *(same caveat)*
- [ ] Grep guards, expected to stay **empty** unless a task deliberately changed them:
  - [ ] `grep -r "KRISTINE J. AMAR" frontend/src` → 0 after T-17
  - [ ] `grep -r "setApprovalHistory" frontend/src` → 0 after T-07
  - [ ] `grep -r "consent" backend/src` → more than the 2 `ensureColumn` hits after T-02
  - [ ] `grep -r "locationId" frontend/src` → more than the 1 hit after T-05
  - [ ] `grep -rn "from 'lucide-react'" frontend/src/views/PrintLabels.jsx` and confirm the
        `qrcode` import exists after T-21

**Writing (run only with explicit approval, in a scratch DB if possible):**

- [ ] One full happy path: register → approve → file → supervisor → admin → approver → assign →
      start → complete → evaluate → archive
- [ ] One return path: admin returns with remarks → requester resubmits (T-11) → supervisor
- [ ] One offline path: disconnect, file, reconnect, confirm exactly one ticket (idempotency)
- [ ] `SELECT COUNT(*) FROM job_requests` before/after — no unexpected duplicates
- [ ] `SELECT action, COUNT(*) FROM audit_log GROUP BY action` — every new action present
- [ ] Frontend smoke suite `cd frontend && npm.cmd test` — baseline has **2 pre-existing failures
      in `calendar-smoke.mjs`**; do not mistake them for regressions

**Data-integrity spot checks (read-only):**

- [ ] `SELECT COUNT(*) FROM job_requests WHERE location_id IS NULL` — should trend to 0 for new
      tickets after T-05 (historical NULLs are expected)
- [ ] `SELECT COUNT(*) FROM campus_locations` — should be ≈27 after T-06
- [ ] `SELECT COUNT(*) FROM users WHERE consent_at IS NULL` — should fall after T-02
- [ ] `SELECT COUNT(*) FROM job_requests WHERE LENGTH(COALESCE(photo_document_id,'')) > 500` —
      n/a after T-16(a)

---

## Rollback, per phase

Each phase should be **one commit** (or a small stack) so it can be reverted as a unit. Nothing has
been committed by this audit.

| Phase | Rollback |
|---|---|
| **P0** | `git revert` the phase commit. Schema changes in T-06 are **additive and nullable** — reverting code leaves the column in place, which is harmless. **Never** drop a column to roll back; that destroys data. T-09 (if done) invalidates sessions — roll forward, not back. |
| **P1** | Revert the commit. T-10's status change is **not** reversible by revert for rows already moved: a ticket assigned under the new rule sits in `Approved`. Hand-fix with a single, recorded `UPDATE ... WHERE id = ? AND status = 'Approved'` if you must. Document the ticket ids first. |
| **P1 T-11 specifically** | The requester carve-out is the risky bit. Revert independently — it is designed to be one function in `ticketPolicy.js` plus one button. |
| **P2** | Revert. T-15's auto-archive writes `is_archived`; to undo, `UPDATE job_requests SET is_archived = 0, archived_at = NULL WHERE archived_at >= '<phase start>'` — capture that timestamp **before** the phase ships. T-16's nullable column stays (harmless). |
| **P3** | Revert freely; display-only. |
| **P4** | Documentation only; no rollback needed. |

**Global guard-rail:** before *any* phase, record
`SELECT COUNT(*) FROM job_requests, audit_log, notifications, documents` into the phase notes.
Every rollback decision afterwards is a comparison against that number.

---

## The "do not touch" list

Explicitly out of scope for this plan, and out of scope for whoever executes it:

1. **No data deletion.** Never `DELETE` from `job_requests`, `audit_log`, `job_request_status_history`,
   `notifications`, `users`, or `evaluations`. No `DROP TABLE`, no `TRUNCATE`.
2. **No retroactive rewriting of history.** Do not backfill `location_id` on old tickets from a
   display string; do not retro-archive; do not "fix" `consent_at` on existing users; do not
   rewrite `job_request_status_history` to make the timeline look right.
3. **`frontend/src/context/ExecutiveDashboard.jsx` and its palette decisions** — untouched by the
   earlier UI workstream; keep it that way.
4. **`ticketPolicy.js` as the single source of lifecycle truth.** Do not add status transitions in
   route handlers. Every write goes through `authorizeStatusChange` or `assertAgainstPolicy`.
5. **`outbox.js` idempotency semantics** — do not change key minting or the "remove only on
   server confirmation" rule (`outbox.js:16`).
6. **`server.js` fail-fast behaviours** — CORS (`:31-41`), `JWT_SECRET` (`:200-204`), MySQL retry
   (`:187-197`), the `/uploads` deny (`:96-100`). These are deliberate.
7. **The `idempotency_key` unique index** (`requisitionRoutes.js:348-375`).
8. **Colour tokens in `frontend/src/index.css`** — the earlier colour-source-of-truth decision
   stands; badge colours remain canonical.
9. **No dependency churn without asking:** no `npm install`, no `npm audit fix`, no lockfile
   changes. T-30 (`helmet`) and T-09 are the only tasks that would add/change a dependency, and
   both are gated on your approval.
10. **No framework migration.** Tailwind is *not* to be adopted as a fix for B2 — the paper
    changes, not the stack.
11. **The chat module is not to be deleted** (A1) — fix or retire it by decision, not by accident.
12. **No commits, pushes, branches, or git-state changes** unless you ask for them.

---

## The first five tasks

If only five things get done, do these — they close 5 of the 7 S1 gaps and one S2, with the
lowest risk-to-value ratio:

| # | Task | Closes | Effort | Why first |
|---|---|---|---|---|
| **1** | **T-05 + T-06 — persist location and make `campus_locations` real** | G-01, G-21, G-22 (S1+S3+S3) | M+L | One field was dropped for the whole life of the project; every location report is currently meaningless. The QR feature cannot be demonstrated without it. |
| **2** | **T-03 — fix the ID-photo path** | G-06, G-07 (both S1) | S | Two-line view fix plus a size cap; closes two S1s almost immediately, and unblocks the privacy story. |
| **3** | **T-02 — capture consent** | G-05 (S1) | M | The columns already exist and are `NULL` everywhere; this is a checkbox, an INSERT column, and a copy step. |
| **4** | **T-15 — automatic archiving** | G-03 (S1) | S | A single `is_archived = 1` inside the existing terminal-status transaction, option (a). The paper's word is "automatic" three times over. |
| **5** | **T-17 step 1 — replace the hardcoded approver names** | part of G-10 (S2) | S | Independent of the Windows/Word PDF dependency; immediately makes every printed form truthful. |

Runner-up: **T-11** (requester revise/resubmit) — it is the most user-visible broken loop, but it
is S2 and depends on nothing, so it can wait one turn.

---

## Open decisions for you

| # | Decision | Options | My recommendation |
|---|---|---|---|
| **D1** | Self-approval (T-01): block outright, or allow with an explicit "self-approved" audit flag? | block / flag / leave | **Block** on the admin and Approver legs; keep the requester-confirmation-as-supervisory-confirmation path (`ch1.md:102`) untouched |
| **D2** | Photo storage (T-16): reference into `documents`, or inline base64? | (a) FK reference / (b) inline | **(a)** — it is what `ch3.md:115` says ("photo reference") and avoids repeating G-07 |
| **D3** | Urgent deadline (T-18): hard block or overdue nag? | block / nag / leave | **Nag + flag** — `ch1.md:103` says "expected to", not "must" |
| **D4** | Archiving (T-15): immediate on terminal, or deferred nightly? | immediate / deferred | **Immediate** — transactional, no scheduler, matches `ch3.md:115` |
| **D5** | PDF (T-17): is the Windows/Word path acceptable, or should browser print be primary? | server PDF primary / browser primary | **Browser primary, server PDF optional** — `pdfGenerator.js:31-34` fails anywhere without Word |
| **D6** | Token storage (T-09): adopt httpOnly cookies now, or defer? | now / defer | **Defer** — high blast radius, no paper requirement driving it |
| **D7** | Tailwind (B2): reword the papers, or adopt Tailwind? | reword / adopt | **Reword** — three sentences vs a re-platform |
| **D8** | Feedback form (B8): four criteria or five? | four / five | **Four** — `ch3.md:160` already separates it from the study questionnaire; add a note to `ch1.md:42` |
| **D9** | Chat module (A1): widen the gate, or retire the feature? | widen / retire | **Widen** to faculty+staff (`messageRoutes.js:15`) — the UI already ships `FacultyCommunication.jsx` |
| **D10** | Old data: backfill `location_id` / `consent_at` / retro-archive? | backfill / leave NULL | **Leave NULL** — the absence is the honest record; offer a manual admin tool instead |
| **D11** | Reminder window (G-18): keep 2 days, or specify one in the paper? | keep / specify | **Keep** — the papers state no number (B10) |
| **D12** | Tests: may I run `cd backend && npm test` during execution? It writes fixture rows to `fixit_pdas`. | approve / refuse / use a scratch DB | **Scratch DB** if one can be provisioned; otherwise approve with a `SELECT COUNT(*)` before/after |
| **D13** | Earlier UI workstream leftovers: the two `System Administrator (Administrator)` gloss deviations, ~13 remaining Phase-1 groups, gating Analytics & Reports behind an "Export Request Data" preview dialog, and the faculty-sidebar default | keep / change | **Your call** — unchanged from before; nothing in this audit depends on them |
