# FixIT / PDAS — Software Audit Summary

**Audit date:** 2026-10-02
**Repository:** `C:\xampp\htdocs\capstoneSystem`
**HEAD at audit time:** `aa8adf9` — *Phase-6-critical-bugs-security-gaps-and-live-api-wiring*
**Audit mode:** READ-ONLY. No project file was edited, renamed, moved or deleted. No migration,
seeder, `npm install`, `npm audit fix`, formatter or `--fix` linter was run. No server or test that
writes data was executed. Only `SELECT` / `SHOW` / `DESCRIBE` / `information_schema` queries were
run against the local dev database `fixit_pdas`. No git branch, commit, push or working-tree change
was made. The **only** thing created by this audit is the `audit/` folder and the eight reports in it.

---

## 1. Sources used, and two substitutions you must know about

### 1.1 The papers

The brief specified `~/fixit_papers/ch{1,2,3}.md`.

> **NOT FOUND** on disk. Search terms used: `~/fixit_papers`, `fixit_papers`, `ch1.md`, `ch2.md`,
> `ch3.md` under the user profile, `Downloads`, `Desktop`, `Documents`.

The authoritative source actually used is the earlier extraction of the three source documents:

| File | Source document | Size |
|---|---|---|
| `C:\Users\Ma_Dr\AppData\Local\Temp\opencode\papers\ch1.md` | `C:\Users\Ma_Dr\Downloads\thesis1_revised.docx` (Chapter 1) | 38,288 chars |
| `C:\Users\Ma_Dr\AppData\Local\Temp\opencode\papers\ch2.md` | `C:\Users\Ma_Dr\Downloads\thesis2_revised.docx` (Chapter 2) | 31,456 chars |
| `C:\Users\Ma_Dr\AppData\Local\Temp\opencode\papers\ch3.md` | `C:\Users\Ma_Dr\Downloads\thesis3_revised_v4.docx` (Chapter 3) | 42,957 chars |

All three were read in full. **Where the papers and any checklist disagree, the papers win.**

### 1.2 The A–L checklist

> **NOT FOUND.** Search terms used: `*checklist*`, `*audit*`, `*conform*`, `*requirement*` (recursive)
> over `C:\Users\Ma_Dr\Downloads`, `C:\Users\Ma_Dr\Desktop`, `C:\Users\Ma_Dr\Documents`, and the
> whole temp/opencode tree. The only hits were unrelated WordPress core files
> (`class-walker-*-checklist.php`), two exported CSVs (`PDAS_Approval_Audit_2026-10-02*.csv`), and
> the repository's own `AUDIT.md` (a Phase-0 findings log from 2026-09-21, not an A–L checklist).

**Consequence:** checklist items **A–L are reconstructed by this audit** from the papers' own
requirement statements — chiefly Chapter 1's eleven stated objectives (`ch1.md:31-42`), Chapter 1's
scope section (`ch1.md:99-106`), Chapter 1's process narrative (`ch1.md:102-104`), and Chapter 3's
Requirements Analysis paragraph (`ch3.md:118`). Every A–L item below is labelled
**[RECONSTRUCTED]** so it is never mistaken for the original wording.

---

## 2. Headline result

**Overall conformance rating: PARTIAL — the core approval workflow is genuinely implemented and
server-enforced, but four of the system's headline features are present only in the UI or not at
all: QR/location, request photos, auto-archiving, and the PDF with approvals.**

| Area | Rating |
|---|---|
| A. Roles & access control | **MATCH** |
| B. Registration, approval & data privacy | **DIFFERENT** (consent never recorded; ID photo broken) |
| C. Location by QR / manual | **PARTIAL → effectively MISSING** (registry is browser-local, table empty, labels not scannable) |
| D. Request form + photo | **PARTIAL** (form matches; photo never persisted) |
| E. Four-level electronic approval | **MATCH** (order enforced server-side); self-approval guard absent |
| F. Statuses, tracking, notifications | **DIFFERENT** (12 statuses vs paper's 6+3; no list auto-refresh) |
| G. Work orders / assignment | **DIFFERENT** (assignment jumps straight to `Ongoing`) |
| H. PDF of the official form with 4 approvals | **PARTIAL → DIFFERENT** (endpoint never called; approvals not rendered; names hardcoded) |
| I. Archive / feedback / log / reports | **PARTIAL** (feedback + log + reports present; **no auto-archiving**) |
| J. ERD (10 tables) | **DIFFERENT** (14 live tables) |
| K. Architecture | **DIFFERENT** (no Tailwind; papers say "React.js with Tailwind CSS") |
| L. Non-functional (ISO/IEC 25010) | **PARTIAL** |

Counts across the 12 checklist items: **2 MATCH · 4 PARTIAL · 5 DIFFERENT · 1 MISSING-in-substance.**

---

## 3. The eight findings that matter most

1. **The campus location registry lives in `localStorage`, not the database.**
   `campus_locations` holds **0 rows** (`SELECT COUNT(*)` → `0`), and the frontend **never calls**
   `/api/lookups/campus-locations` (grep for `api/lookups|campus-locations|apiCampusLocation` across
   `frontend/src` → **no matches**). The registry the whole app uses is
   `fixit_pdas_campus_locations_v5` in the browser
   (`frontend/src/context/DataContext.jsx:730`, writer `:1836-1856`). The backend CRUD at
   `backend/src/routes/lookupRoutes.js:8-71` is **dead code**.

2. **`job_requests.location_id` is NULL on 100% of tickets** (`SELECT location_id` → `NULL`,
   `NULL`). The payload field is `locationId: newReq.locationId || null`
   (`frontend/src/context/DataContext.jsx:1020`) but `buildRequisitionPayload()`
   (`frontend/src/utils/jobRequestIntake.js:112-151`) **never returns `locationId`**, so it is
   always `null`. On read-back the location degrades to the literal `'Campus Facilities'`
   (`frontend/src/context/DataContext.jsx:490`). The paper requires *"Each request belongs to one
   requester and one location"* (`ch3.md:115`).

3. **Printed QR labels are decorative — nothing scannable is ever produced.**
   `frontend/src/views/PrintLabels.jsx:548` renders a **lucide-react `<QrCode>` icon** plus the
   words `SCAN ME` (`:550`) inside a comment literally labelled *"QR simulation"* (`:535`). The file
   imports `QrCode` from `lucide-react` (`:3`) and has **no** `qrcode` import. The `qrcode` package
   is used in exactly one place — `frontend/src/components/common/JobRequestPrintSheet.jsx:18-19` —
   and only encodes `FIXIT-REQ:<tracking>` for the printed slip, not a location tag.

4. **Request photos are captured but never stored.** The overlay writes `photoUrl`
   (`frontend/src/components/common/JobRequestFormOverlay.jsx:256`), `buildRequisitionPayload`
   returns it (`jobRequestIntake.js:149`), but the submit payload omits it
   (`DataContext.jsx:1006-1021`), `POST /` does not destructure it
   (`backend/src/routes/requisitionRoutes.js:336-346`), and `job_requests` has **no photo column**
   (`SHOW COLUMNS`). The frontend never constructs `FormData` (grep `new FormData(` → no matches),
   so `POST /api/documents` (`backend/src/routes/documentRoutes.js:72`) and the `documents` table
   (**0 rows**) are dead. The paper requires *"submit a maintenance request with a photo"*
   (`ch3.md:118`).

5. **Data-privacy consent is never recorded, and the ID photo path is broken end to end.**
   `consent_at` exists on both `users` and `registration_requests`
   (`backend/database/schema.sql:48,78`; `backend/src/scripts/autoSetup.js:192-193`) but grep for
   `consent_at|consent` in `backend/src` returns **only those column-creation lines** — it is never
   written. All 7 users and the 1 registration row have `consent_at = NULL`. There is **no privacy
   notice anywhere in the frontend** (grep `10173|Data Privacy|privacy notice|PrivacyNotice|consent`
   in `frontend/src` → no matches). Meanwhile `RegisterModal.jsx:62` does `readAsDataURL` with no
   size cap, the base64 string is sent as `idPhotoUrl` (`api.js:207`) into
   `id_photo_url VARCHAR(500)` (`schema.sql:38,74`) — and the DB runs **without strict mode**
   (`sql_mode` = `NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION`), so anything longer is
   **silently truncated** (`schema.sql:114-116` documents exactly this failure mode).

6. **The admin's ID-photo review pane reads a field that is never set.**
   `frontend/src/views/admin/UserManagement.jsx:1247` renders
   `src={selectedPendingReg.idPreviewUrl}` and `:1258` shows `selectedPendingReg.idFileName`,
   but `normalizeRegistration()` (`frontend/src/backend/api.js:86-106`) emits **only `idPhotoUrl`**.
   The image therefore never renders and the filename is `undefined`. `RegisterModal.jsx:98-99`
   does send `idFileName`/`idPreviewUrl`, but the normaliser drops them.

7. **Archiving is manual-only.** The paper says a Completed *"ticket is archived without being
   deleted"* automatically, and rejected requests likewise (`ch1.md:104`, `ch1.md:114`,
   `ch2.md:32`). The only archive writes are `PUT /:id/archive` (`requireRole('admin')`,
   `requisitionRoutes.js:1420`) and `PUT /:id/unarchive` (`:1456`), triggered from exactly one UI
   confirmation (`frontend/src/views/admin/JobRequests.jsx:1034`). Nothing runs on `Completed` or
   `Rejected`.

8. **There is no requester-side revise-and-resubmit.** `Returned` is a real, non-terminal state
   (`ticketPolicy.js:56` → `['Pending','Rejected']`), but the Faculty/Staff portal's ticket rows
   offer only **Details** and **Slip** (`FacultyStaffPortal.jsx:485-502`) — no edit action. The only
   way out of `Returned` is the **admin's** "Restore to Pending"
   (`JobRequests.jsx:315-316`) or "Close" (`:318-319`). The paper's loop — *"the user revises it and
   submits it again"* (`ch3.md:70`) — is not reachable by the user it is written for.

---

## 4. Report index

| # | File | Contents |
|---|---|---|
| 00 | `00_summary.md` | This file: scope, method, substitutions, headline result |
| 01 | `01_architecture_map.md` | Project map — backend routes, frontend workspaces, DB, build/test surface |
| 02 | `02_conformance_matrix.md` | Checklist **A–L [RECONSTRUCTED]** with MATCH / PARTIAL / DIFFERENT / MISSING / EXTRA |
| 03 | `03_workflow_traces.md` | Ten workflows traced end to end with file:line evidence |
| 04 | `04_gap_analysis.md` | Every gap, severity-ranked, each cited to `path:line` or table/column/route |
| 05 | `05_extra_and_paper_corrections.md` | What the code has that the papers do not, **and** where the papers contradict themselves |
| 06 | `06_implementation_plan.md` | Plan only — phases, task IDs, migrations, rollback, do-not-touch, first five, open decisions |
| 07 | `07_improvement_recommendations.md` | Rating + prioritised recommendations |

---

## 5. Evidence conventions

* Every finding cites `path/to/file:line`, or a table/column, or an API route.
* Statements this audit could **not** verify are written **NOT FOUND**, with the exact search terms.
* Nothing is called **MATCH** on naming alone. `tbl_location` vs `campus_locations` is judged on
  *behaviour* (does it hold the QR codes and is it used?), not on the name.
* Where a database value was needed, the query and its result are shown.

## 6. Provenance of the working tree

The working tree already carried **101 changed entries** at `git status` **before** this audit began
(28 untracked paths including `.agents/`, `.git - Copy/`, `DashboardCharts.jsx`,
`JobRequestLocationStep.jsx`, `outbox.js`, `WorkQueue.jsx`, `supervisorNavigation.js`, plus
extensive uncommitted UI/colour edits). That is prior user work and it was **not** touched, reverted
or committed. The closing `git status` in §7 proves `audit/` is the only *new* addition.
