# 02 — Conformance Matrix (Checklist A–L)

## ⚠ Provenance of this checklist

> **The verbatim A–L checklist was NOT FOUND.**
> Search terms used: `*checklist*`, `*audit*`, `*conform*`, `*requirement*` (recursive) across
> `C:\Users\Ma_Dr\Downloads`, `C:\Users\Ma_Dr\Desktop`, `C:\Users\Ma_Dr\Documents`, and the whole
> `C:\Users\Ma_Dr\AppData\Local\Temp\opencode` tree. Hits were only unrelated WordPress files
> (`class-walker-*-checklist.php`), two exported CSVs, and the repository's own `AUDIT.md`
> (a Phase-0 findings log, not an A–L checklist).

**A–L below are therefore [RECONSTRUCTED]** by this audit from the papers' requirement statements:

* `ch1.md:31-42` — the eleven stated objectives
* `ch1.md:99` — location by QR or manual, form fields, pre-fill, role split on the admin side
* `ch1.md:102-104` — the process narrative (approval sequence, PDF, urgent, six stages, archiving)
* `ch1.md:97-98` — registration, account approval, Supervisor designation
* `ch1.md:151-152` — scope statement
* `ch3.md:118` — the Requirements Analysis paragraph (functional + ISO/IEC 25010 + RA 10173)
* `ch3.md:7, 106, 110` — the sequence-diagram narratives
* `ch3.md:158-160` — the three-tier architecture and the ten-table data tier

**Papers outrank any checklist.** Where a paper statement and a reconstructed item disagree, the
paper is quoted and followed.

### Status vocabulary

| Status | Meaning |
|---|---|
| **MATCH** | Implemented, and the observable behaviour matches the cited paper statement |
| **PARTIAL** | Implemented but materially incomplete against the cited statement |
| **DIFFERENT** | Implemented, but the behaviour diverges from the cited statement |
| **MISSING** | Required by the cited statement; no implementation found |
| **EXTRA** | Present in the code; not required by any cited statement |

---

## A. Registration, account approval, and data-privacy consent — **DIFFERENT**

**[RECONSTRUCTED] Source statements**

* `ch1.md:97` — "faculty and staff register an account by submitting their full name, department or
  office, contact number, gender, address, birthday, age, email, password, and a valid ID photo…
  their accounts [maintenance] are created and encoded by the System Administrator instead of
  through self-registration… The System Administrator reviews each application and approves or
  rejects it… only approved accounts gain role-based access."
* `ch1.md:99` — "users are informed at registration of what data are collected and why, and **their
  consent is obtained**."
* `ch3.md:118` — "The system must also be secure and protect the personal data it holds, including
  the ID photos, in line with the **Data Privacy Act of 2012 (RA 10173)**. In particular, the ID
  images should be **visible only to the System Administrator**."

| Sub-item | Status | Evidence |
|---|---|---|
| A1 Registration collects the full field set | MATCH | `RegisterModal.jsx:9-23` (names, userType, department, office, contact, gender, address, birthday, age, gmail, password), `:54` file input; DB `registration_requests` holds all of them (`schema.sql` columns + `autoSetup` ensures) |
| A2 Maintenance accounts are admin-created, not self-registered | MATCH | `authRoutes.js:122-129` rejects any role other than faculty/staff; admin creation at `userRoutes.js:130` (behind `requireRole('admin')`, `userRoutes.js:10`) |
| A3 Admin approves or rejects each application | MATCH | `userRoutes.js:45` approve, `userRoutes.js:110` reject, both admin-gated `userRoutes.js:10` |
| A4 Only approved accounts gain access | MATCH | `users.status enum('active','inactive')`; `verifyToken` re-reads status from DB per request (`auth.js:35`) |
| A5 **Consent is informed and obtained** | **MISSING** | `consent_at` declared at `schema.sql:48` (users) and `schema.sql:78` (registration_requests), ensured by `autoSetup.js:192-193`, with the comment "Data Privacy Act compliance: store timestamp when user gave consent" (`autoSetup.js:191`). Grep `consent_at\|consent` in `backend/src` returns **only those two ensureColumn lines** — never written. Registration INSERT lists 14 columns, `consent_at` not among them (`authRoutes.js:148-150`). Approval INSERT copies 14 columns, no `consent_at` (`userRoutes.js:62-63`). **DB read: all 7 `users` rows and the 1 `registration_requests` row have `consent_at = NULL`.** Frontend: grep `10173\|Data Privacy\|privacy notice\|PrivacyNotice\|consent` in `frontend/src` → **no matches**. |
| A6 **ID image visible only to the System Administrator** | **PARTIAL** | Backend: every route that returns `id_photo_url` sits behind `requireRole('admin')` — `userRoutes.js:10` covers `userRoutes.js:17` (users list) and `:33` (registrations). No other route selects it. So the *backend* honours it. But see A8 — the admin's own view is broken, and A7 below shows the image may be silently destroyed before it is ever stored. |
| A7 ID photo survives storage | **DIFFERENT** | `RegisterModal.jsx:62` `reader.readAsDataURL(file)` with **no size cap**; `RegisterModal.jsx:100` sends the whole data-URL as `idPhotoUrl`; `api.js:207` passes it through; `authRoutes.js:149,165` writes it into `id_photo_url VARCHAR(500)` (`schema.sql:38,74`). Server `sql_mode` = `NO_ZERO_IN_DATE,NO_ZERO_DATE,NO_ENGINE_SUBSTITUTION` — **no strict mode** — so >500 bytes is *silently truncated*, and `schema.sql:114-116` documents this exact failure mode. A base64 JPEG of any realistic size far exceeds 500 chars. Live data point: `registration_requests.id_photo_url` is currently `NULL` (`LENGTH = NULL`), i.e. nothing was stored for the one registration on record. |
| A8 Admin can actually review the ID photo | **DIFFERENT (broken)** | `UserManagement.jsx:1247` `src={selectedPendingReg.idPreviewUrl}` and `:1258` `File: <code>{selectedPendingReg.idFileName}</code>` — but `normalizeRegistration()` (`api.js:86-106`) emits **only `idPhotoUrl`** (`api.js:106`), never `idPreviewUrl` or `idFileName`. The image never renders; the filename shows `undefined`. `RegisterModal.jsx:98-99` does send both, and `api.js:207` drops them on the way in. |
| A9 Rejection reaches the applicant | **MISSING** | Approve notifies (`userRoutes.js:88-96`). Reject (`userRoutes.js:110-127`) contains **no `notifications` INSERT** — confirmed by reading the whole handler. The paper's sequence-diagram text says the module "notifies the applicant" for approval *and* rejection (`ch3.md:110`: "approves an account registration, after which the Auth module updates the status and role in the database and notifies the applicant"; `ch1.md:104`/`ch3.md:110` for the general rule that "every action… is timestamped and logged"). |
| A10 Registration decisions are audited | **PARTIAL** | `auditLog` in `userRoutes.js` appears only at `:279, :401, :463, :527` (bulk-supervisor, deactivate, supervisor-designation, assign-supervisor). Approve `:45` and reject `:110` write **no audit row**, despite `ch1.md:104`: "every action across the system, including **approvals, rejections, role designations**, assignments, status changes, flags, and scheduling, is timestamped and logged". |
| A11 Client and server password rules agree | **EXTRA / defect** | Client: `RegisterModal.jsx:84` `formData.password.length < 6`. Server: `authRoutes.js:15-23` requires ≥8 **and** a letter **and** a digit. A 6-char password passes the client and is then rejected by the API with a generic error. |

**Verdict: DIFFERENT.** Account creation and approval are faithful; the privacy half of the
requirement (informed consent, working ID-photo review, rejection notification, audit of the
decision) is not.

---

## B. Role model and role-based access control — **MATCH**

**[RECONSTRUCTED] Source statements**

* `ch1.md:97` — four user roles: Faculty/Staff, Maintenance Personnel, System Administrator,
  Approver.
* `ch1.md:98` — "The System Administrator can designate any approved Faculty/Staff account as a
  Supervisor and assign the Faculty/Staff accounts… This designation **does not create a separate
  account**."
* `ch1.md:152`, `ch3.md:6` — "Supervisors are not a separate role… same login… only the
  supervisory confirmation step."
* `ch3.md:118` — "control access by role".

| Sub-item | Status | Evidence |
|---|---|---|
| B1 Four paper roles exist | MATCH | `users.role enum('admin','campus_admin','faculty','staff','maintenance','technician')` (DB). `admin` = System Administrator/PDAS Head, `campus_admin` = Approver. The two extra values (`maintenance`,`technician`) are aliases for the one paper role "Maintenance Personnel" — see `05_extra…` §2. |
| B2 Supervisor is a flag, not a role | MATCH | `users.is_supervisor tinyint(1)`; `auth.js:41` `Boolean(row.is_supervisor \|\| row.role === 'supervisor')`; pass-through `auth.js:107-110` lets a designated faculty/staff account clear any `requireRole('supervisor')` gate. |
| B3 Supervisor designation is admin-managed and revocable | MATCH | `userRoutes.js:421` `PUT /:id/supervisor-designation`, `userRoutes.js:245` bulk assignment, `userRoutes.js:488` per-user assignment — all behind `requireRole('admin')` (`userRoutes.js:10`), all audited (`userRoutes.js:279, :527`). |
| B4 Supervisor may act only on their own unit's tickets | MATCH | `ticketPolicy.js:102-119` `canSuperviseTicket` — explicit `supervisor_id` match `:105-106`, free-text name match `:107-111`, and the blanket fall-through deliberately removed `:112-118` with the comment "so any designated supervisor could endorse any unclaimed request — including one they filed themselves". Used at `requisitionRoutes.js:662` and `ticketPolicy.js:268`. |
| B5 Requesters can read only their own tickets (IDOR) | MATCH | `ticketPolicy.js:79-91` `canViewTicket` — `:90` `return row.requester_id === user.id`; techs `:89` `row.assigned_to === user.id`. Applied on `GET /:id` (`requisitionRoutes.js:286`) and on the list via `applyVisibilityScope` `requisitionRoutes.js:148`. |
| B6 Role is not trusted from the JWT | MATCH | `auth.js:14-20, :35, :91` — role and active flag re-read from `users` on every request. |
| B7 Requesters never change status server-side | MATCH | `ticketPolicy.js:182-190` — non-privileged callers get 403 unless they are the assigned tech marking their own `Ongoing → Completed`. |

**Verdict: MATCH.** Note `EXTRA`: a literal `role = 'supervisor'` value is accepted by the
predicate (`ticketPolicy.js:72, :75-76`) though no seed or route creates one — see `05_extra…` §2.

---

## C. Location identification — QR code with manual fallback — **MISSING in substance**

**[RECONSTRUCTED] Source statements**

* `ch1.md:34` objective — "implement QR-code scanning for room and building identification, with
  manual location selection as a fallback".
* `ch1.md:99` — "by scanning a posted QR code or by selecting the building, office, or area
  manually."
* `ch3.md:115` — "The **tbl_location** table lists the buildings, offices, and areas of the campus
  **together with their QR codes**."
* `ch3.md:59` — the System Administrator "maintains the list of locations and their QR codes."
* `ch3.md:159` — "Supporting services **generate the QR codes** of the rooms and buildings."
* `ch1.md:152` — "QR code scanning for room and building identification with a **manual dropdown as
  a fallback**."

| Sub-item | Status | Evidence |
|---|---|---|
| C1 A server-side location registry exists | **DIFFERENT** | `campus_locations` table exists (`schema.sql:88-95`) but holds **0 rows** (`SELECT COUNT(*) FROM fixit_pdas.campus_locations` → `0`). |
| C2 The registry stores QR codes | **MISSING** | `schema.sql:88-95` columns are `id, building, floor, room, description, created_at` — **no `qr_code` column**. Grep `qr_code\|campus_locations` in `backend/src/scripts/autoSetup.js` → **no matches**. |
| C3 The application reads/writes that registry | **MISSING (dead backend)** | Backend CRUD is complete at `lookupRoutes.js:8-71` (GET/POST/PUT/DELETE `/api/lookups/campus-locations`), mounted at `server.js:120`. Grep `api/lookups\|campus-locations\|apiCampusLocation` across `frontend/src` → **no matches**. Grep `lookups` in `frontend/src` → **no matches**. Nothing in `frontend/src/backend/api.js` calls it. |
| C4 The registry the app actually uses | **DIFFERENT (browser-local)** | `DataContext.jsx:730` `useState(() => readJson('fixit_pdas_campus_locations_v5', INITIAL_CAMPUS_LOCATIONS))`, persisted at `:733-735`. Writers `addCampusLocation:1836`, `updateCampusLocation:1858`, `deleteCampusLocation:1875`. Consumed by `PrintLabels.jsx:12-17` and `RequestIntake.jsx:235`. Per-browser, per-device, never shared, never on the server. |
| C5 QR scanning is implemented | MATCH (mechanism) | `QrCodeScannerModal.jsx:3` `import { Html5Qrcode } from 'html5-qrcode'`; payload parsing `:246-284` handles `qrCodeRef` direct match `:250-252`, JSON `:268`, URL `:284`, `ISATU-…` delimited `:294, :302`. |
| C6 Scanning resolves to a real registered location | **PARTIAL** | `QrCodeScannerModal.jsx:11-103` is a **hardcoded preset table** (`CAMPUS_ROOM_QR_PRESETS`, ~27 entries: `ISATU-ADM-ADMIN-OFFICE`, `ISATU-SCI-CHEMLAB`, …) merged with browser-local rows at `:225-229`. It does not consult `campus_locations`. |
| C7 Printed labels carry a **scannable** QR | **MISSING** | `PrintLabels.jsx:548` renders `<QrCode size={…} color="#001f9c" />` and `:550` renders the text `SCAN ME` inside a box the comment at `:535` calls *"QR simulation"*. `QrCode` is imported from **`lucide-react`** (`PrintLabels.jsx:3`), an icon font, not a barcode. Grep `from 'qrcode'` across `frontend` → **no matches**. |
| C8 Some real QR is generated somewhere | **PARTIAL (wrong payload)** | `JobRequestPrintSheet.jsx:18-19` `import('qrcode').then(m => m.toDataURL(payload,…))`, payload `FIXIT-REQ:<tracking>` (`JobRequestPrintSheet.jsx:17`, mirrored server-side at `docxJobRequestGenerator.js:38`). That is a *ticket verification* QR on the printed slip, **not** a location tag. |
| C9 Manual dropdown fallback | MATCH | `JobRequestLocationStep.jsx:15-31` `buildBuildingIndex` with the comment *"The manual dropdown must NEVER be empty — not even offline"*, and fallback to `CAMPUS_ROOM_QR_PRESETS` at `:19-20`. Floor/room selects `:44+`. |
| C10 The chosen location reaches the database | **MISSING (functional break)** | `buildRequisitionPayload()` (`jobRequestIntake.js:112-151`) returns `building`, `floor`, `room`, `location`, `qrCodeRef` — **not `locationId`**. The submit payload sends `locationId: newReq.locationId \|\| null` (`DataContext.jsx:1020`), so it is **always `null`**. `POST /` reads it (`requisitionRoutes.js:337`) and stores `locationId \|\| null` (`requisitionRoutes.js:503`). **DB read: `location_id IS NULL` on both live tickets.** On read-back the display falls back to the literal `'Campus Facilities'` (`DataContext.jsx:490`). |
| C11 "One request belongs to one location" | **MISSING** | `ch3.md:115`. `job_requests.location_id` is nullable (`schema.sql:124`) and 100% NULL in live data. Building/floor/room are not persisted anywhere — `job_requests` has no such columns (`SHOW COLUMNS FROM fixit_pdas.job_requests`). |

**Verdict: MISSING in substance.** The scanner, the dropdown and the label screen all exist and are
usable, but the *location data* never enters the database, the server registry is empty and
unreachable from the UI, and the printed "QR" is an icon. See `04_gap_analysis.md` G-01…G-04.

---

## D. Job request form, photo, and urgent fast path — **PARTIAL**

**[RECONSTRUCTED] Source statements**

* `ch1.md:99` — "fills out the job request form with the maintenance category, a description of the
  issue, the urgency level (Low Risk, Medium Risk, or High Risk), and **an optional photo**.
  Personal and institutional details are pre-filled from the requester's account."
* `ch1.md:100` — "faculty and staff register… **Registration collects** the full name, age, gender,
  address, birthday, office or department, contact number, email, and a valid ID." (pre-fill source)
* `ch1.md:103` — "High Risk requests can be reported immediately using only the essential details
  (**location and issue type**)… the requester is still expected to complete the full form
  **within the same day**."
* `ch3.md:118` — "submit a maintenance request with a photo".

| Sub-item | Status | Evidence |
|---|---|---|
| D1 Category field | MATCH | `jobRequestIntake.js:24-32` `CATEGORY_OPTIONS` (7); DB enum has 8 (`Urgent Hazard` added by the fast path, `requisitionRoutes.js:423`) |
| D2 Description field | MATCH | required at `requisitionRoutes.js:377` |
| D3 Urgency = Low/Medium/High Risk | MATCH | `urgency_level enum('Low Risk','Medium Risk','High Risk')` in DB; normaliser `requisitionRoutes.js:94-98`; client default `jobRequestIntake.js:128` |
| D4 Personal details pre-filled from the account | MATCH | `jobRequestIntake.js:142-147` `requestedBy/requesterEmail/requesterRole/department/contactNumber/idNumber`; `RegisterModal.jsx:34-52` keeps the record |
| D5 **Optional photo attached to the request** | **MISSING** | Captured: `JobRequestFormOverlay.jsx:183-210` (`handlePhotoSelect`, canvas downscale + `toDataURL('image/jpeg',0.7)` `:210`), preview `:419-421`, returned as `photoUrl` `:256`. Built: `jobRequestIntake.js:149`. **Dropped:** the payload object `DataContext.jsx:1006-1021` does not include `photoUrl`. `POST /` destructures `locationId, category, description, urgencyLevel, priority, requestType, isStandardFormFilled, immediateSupervisor, idempotencyKey` only (`requisitionRoutes.js:336-346`). `INSERT` columns (`requisitionRoutes.js:497-499`) have no photo. `SHOW COLUMNS FROM job_requests` → no photo column. |
| D6 File storage path available | **EXTRA (unused)** | `documents` table (`schema.sql:268-279`, **0 rows**), `POST /api/documents` (`documentRoutes.js:72`, multer 10 MB `:36`, allow-list `:37`, auth `:51`). Grep `new FormData(` in `frontend/src` → **no matches**; grep `apiUploadDocument\|apiGetDocuments\|/documents` → **no matches**. |
| D7 Urgent fast path needs only location + issue type | MATCH | `UrgentIssueReport.jsx:10-16` states the rule; fields are location + issue type + optional notes (`:39-41`); `URGENT_ISSUE_TYPES` `:18-27`; submit `RequestIntake.jsx:206-224` builds `category:'Urgent Hazard'`, `requestType:'Urgent Request'`, `isStandardFormFilled:false` (`jobRequestIntake.js:130`) |
| D8 Full form completed within the same day | **PARTIAL (unenforced)** | The *flag* is set: `DataContext.jsx:952` `urgentDeadline: isUrgent ? 'Within Today (24 Hours)' : null`; the reminder banner `FacultyStaffPortal.jsx:340-375` shows "Please complete it within the day". Grep for any deadline/expiry/overdue computation against that value → **no enforcement code**. `completeStandardFormForUrgent` (`DataContext.jsx:1296`) and `PUT /:id/complete-standard-form` (`requisitionRoutes.js:1259`) can be invoked at any time, with no day boundary. |
| D9 Same-day action alerts the System Administrator immediately | MATCH | `requisitionRoutes.js:556-560` title `High Risk request filed` when `finalUrgency === 'High Risk'`; `notifyAdmins` |
| D10 High Risk tickets sort to the top | MATCH | `requisitionRoutes.js:205-213` `ORDER BY CASE jr.urgency_level WHEN 'High Risk' THEN 1 …` |

**Verdict: PARTIAL.** The form and the urgent path conform; the photo — an explicit paper
requirement appearing in `ch1.md:99`, `ch1.md:106`, `ch1.md:148` and `ch3.md:118` — is never
persisted.

---

## E. Four-level electronic approval and the audit log — **MATCH (order) / PARTIAL (log)**

**[RECONSTRUCTED] Source statements**

* `ch1.md:36` objective — "implement a four-level electronic approval process (requester, immediate
  supervisor, System Administrator, and Approver) with a **timestamped audit log** and automatic
  generation of the PDAS job request form in **PDF format**".
* `ch1.md:102` — the requester confirms via a prompt ("If the requester does not confirm, the
  request stays as a draft"); the Supervisor "goes through the same confirmation step"; a refusal
  "is returned to the requester for revision"; where the requester *is* the Supervisor or has none,
  "the requester's confirmation is also recorded as the supervisory confirmation, and the audit log
  states this".
* `ch1.md:103` — "Electronically Approved by" above the Administrator's name, then the same at
  Approver level; then "the System Administrator generates the official tracking number, the request
  becomes Approved, and it is assigned to maintenance personnel."
* `ch3.md:7` — "four electronic approvals **in sequence**… a request that is not approved is
  returned to the requester with remarks for revision."
* `ch1.md:104` — "every action across the system… is timestamped and logged in the centralized
  database."

| Sub-item | Status | Evidence |
|---|---|---|
| E1 Requester confirmation prompt | MATCH | `JobRequestFormOverlay.jsx:236-291` confirm dialog, re-rendered `:556-626`; declining leaves a draft (`requisitionRoutes.js:490-491` `requesterApproved = isDraft ? 0 : 1`) |
| E2 Approval **order** enforced server-side | MATCH | `ticketPolicy.js:31-59` `TRANSITIONS`; `missingApprovalFor()` `:146-172` requires `supervisor_approved` before `Under Review`/`Pending Final Approval` (`:158-161`), `admin_approved` + `campus_admin_approved` before `Approved` (`:162-165`), `campus_admin_approved` before `Ongoing` from `Approved` (`:168-170`). Wired at `requisitionRoutes.js:662, 755, 855, 973, 1123`. |
| E3 Level 1 = Supervisor (designated faculty/staff) | MATCH | `requisitionRoutes.js:636` `requireRole('supervisor')` + `ticketPolicy.js:102-119` ownership |
| E4 Level 2 = System Administrator | MATCH | `requisitionRoutes.js:729` `requireRole('admin')`, target `Pending Final Approval` (`:739`) |
| E5 Level 3 = Approver (Campus Administrator) | MATCH | `requisitionRoutes.js:827` `requireRole('campus_admin')`, target `Approved` (`:858`); decline routes back **through** PDAS to `Under Review` (`:848-860` comment) |
| E6 Refusal returns to requester with remarks | MATCH (backend) / **MISSING (frontend)** | Backend: target `'Returned'` at `requisitionRoutes.js:668` and `:739`; `TRANSITIONS` keeps `Returned` non-terminal → `['Pending','Rejected']` (`ticketPolicy.js:53-56`). Frontend: the Faculty/Staff ticket row offers only **Details** and **Slip** (`FacultyStaffPortal.jsx:485-502`) — no edit/resubmit. The only exits are the **admin's** "Restore to Pending" (`JobRequests.jsx:315-316`) and "Close" (`:318-319`). `grep updateRequisitionStatus(` call sites → `WorkQueue.jsx:242,269` and `JobRequests.jsx:316,319,334` — **none is the requester**. Paper: "the user revises it and submits it again" (`ch3.md:70`). |
| E7 Requester-is-Supervisor auto-endorsement | MATCH | `requisitionRoutes.js:473-476` `autoEndorseReason = 'the requester is the Supervisor of their own unit and no other Supervisor is assigned to them'`; recorded to admins `:568-576`; written into history `:518-521`. Paper explicitly requires "the audit log states this" (`ch1.md:102`). |
| E8 "Electronically Approved by" marker | PARTIAL | Browser: `JobRequestPrintSheet.jsx:82, 90, 134, 151` and `PDASJobRequestFormDocument.jsx:85, 96, 251, 273`. **But** level-3 is the literal string `KRISTINE J. AMAR` (`JobRequestPrintSheet.jsx:134`; `PDASJobRequestFormDocument.jsx:251,254`) and level-4 falls back to `RAMIL G. LUMAUAG, Ed.D., DIT` (`JobRequestPrintSheet.jsx:151`; `PDASJobRequestFormDocument.jsx:273,276`) rather than reading `supervisor_approved_at` / `admin_*` / `campus_admin_*` from the ticket. |
| E9 **Self-approval is blocked** | **MISSING — but NOT a paper gap** | Grep `requester_id !== req\.user\.id\|self-approv\|own request` in `backend/src` → only `evaluationRoutes.js:44` and `requisitionRoutes.js:1285`, neither an approval endpoint. `supervisor-action` `:636`, `admin-action` `:729`, `approver-action` `:827` never compare `jr.requester_id` to `req.user.id`. ⚠ **Papers never prohibit it** — grep `own request\|self-approv\|separation of duties` across `ch1.md,ch2.md,ch3.md` → no match. Reported as a **security/integrity gap**, not a conformance failure. |
| E10 Timestamped audit log | MATCH (workflow) / **PARTIAL (whole-system)** | `requisitionRoutes.js:602, 693, 715, 790, 810, 886, 920, 1024, 1086` cover submitted / supervisor-approved / supervisor-returned / admin-approved / admin-returned / approver-approved / approver-rejected / assigned / replacement-flag. Admin-only read `auditRoutes.js:6, :10`. Gaps against `ch1.md:104`: registration approve/reject (`userRoutes.js:45,110`), archive (`requisitionRoutes.js:1440` **is** audited), unarchive (`:1456`, no audit call), generic status change (`:1099`, no audit call — it writes `job_request_status_history` at `:1161` area but no `audit_log` row), preventive scheduling (`preventiveRoutes.js:84` **is** audited). |
| E11 **Automatic PDF with all four approvals** | **PARTIAL → DIFFERENT** | Server endpoints exist: `jobRequestDocRoutes.js:35` (pdf), `:58` (docx), `:81` (`GET /:id/pdf`). Frontend client `api.js:391` `apiGetJobRequestDocPdf` — grep across `frontend/src` returns **1 match, the definition itself**. The DOCX generator carries no approval data at all (`docxJobRequestGenerator.js:125-128, 245-362`; grep `approv` → 5 hits, all `immediateSupervisor`/QR). Actual printing is `window.print()` of a React component with hardcoded names. Paper: "auto-generates a PDF… carrying **all four** electronic approvals" (`ch1.md:103`). |

**Verdict: MATCH on the sequence and its enforcement — the strongest area of the system.**
PARTIAL on the audit log's coverage and the PDF.

---

## F. Ticket lifecycle, statuses, tracking and notifications — **DIFFERENT**

**[RECONSTRUCTED] Source statements**

* `ch1.md:35` objective — "ticket generation, **real-time** tracking, automated notifications, and
  status updates".
* `ch1.md:104` / `ch3.md:8` — "Tickets move through **six stages**: Pending, Under Review, Pending
  Final Approval, Approved, Ongoing, and Completed. A request that is sent back for correction is
  marked **Returned for Revision**, a request that is declined is marked **Rejected**, and a request
  that cannot proceed… may be marked **On-hold** by the System Administrator."
* `ch1.md:104` — "all parties can track ticket status in **real time**, and the system sends
  automated notifications at every stage change."
* `ch3.md:8` — "The system sends a notification to the parties concerned each time the status
  changes."

| Sub-item | Status | Evidence |
|---|---|---|
| F1 The paper's 6 + 3 statuses exist | MATCH | All present inside the DB enum: `Pending, Under Review, Pending Final Approval, Approved, Ongoing, Completed, Returned, Rejected, On Hold` (`SHOW COLUMNS`), normalised at `requisitionRoutes.js:102-117`. |
| F2 Status vocabulary = paper's vocabulary | **DIFFERENT** | DB enum has **12** values — the 9 above plus `Draft`, `Pending Supervisor Approval`, `Awaiting Signatures`. Naming also differs: DB `Returned` vs paper *"Returned for Revision"* (display label matches the paper at `JobRequests.jsx:396` and `FacultyStaffPortal.jsx:50`, badge label is `Returned` at `StatusBadge.jsx:41`); DB `On Hold` vs paper *"On-hold"* (`StatusBadge.jsx:37` `On Hold`). No `Emergency` urgency exists (correct — paper has only 3 levels). |
| F3 Six-stage sequence respected | MATCH | `TRANSITIONS` `ticketPolicy.js:31-59` admits `Pending → Under Review → Pending Final Approval → Approved → Ongoing → Completed` as a legal path; `Awaiting Signatures` deliberately funnels back into `Pending Final Approval` rather than skipping the Approver (`ticketPolicy.js:38-43`). |
| F4 On-hold set by the System Administrator | MATCH | `ticketPolicy.js:52` `'On Hold': ['Ongoing','Rejected']`; reachable via `PUT /:id/status` which requires privileged (`ticketPolicy.js:182-190`); UI `JobRequests.jsx:334` |
| F5 **Real-time status tracking** | **PARTIAL** | Only timer: `DataContext.jsx:604-608` a **30-second notification poll**. `refreshRequisitions()` runs on mount (`:556-557`) and after the caller's own action (`:1063,1112,1133,1164,1281,1407,1437,1587,1610,1628`) — **never on an interval**. Grep `EventSource\|WebSocket\|socket.io\|io(` in `frontend/src` and `backend/src` → **no matches**. Another user's status change does not appear until the viewer reloads or acts. |
| F6 Notification on every status change | MATCH | `requisitionRoutes.js:1161-1189` — requester `:1163-1169`, assigned tech `:1172-1180`, PDAS admins `:1183-1189`; Completed → evaluation prompt `:1192-1200` |
| F7 Notification recipients are scoped | MATCH | `notificationRoutes.js:16-17, 28-29, 43-44, 59, 71-72, 87` — every query filters on `user_id = req.user.id` |
| F8 Supervisor is notified of their unit's pending tickets | **PARTIAL** | `requisitionRoutes.js:579-584` calls `notifySupervisors` — which selects **every** active supervisor, not just the ticket's: `requisitionRoutes.js:81-87` `SELECT id FROM users WHERE (role='supervisor' OR is_supervisor=1) AND status='active'`. Compare `ch3.md:74`: the supervisor is notified "for each pending request of the employees **assigned to it**". |
| F9 Ticket number generation | MATCH | `generateTicketNo(conn)` inside a transaction at `requisitionRoutes.js:494`, sequence table `ticket_sequences` (`schema.sql:286`); `idempotency_key` unique index `:348-375` |
| F10 Official tracking number timing | MATCH | Minted **only** at assignment: `requisitionRoutes.js:984-997` from `tracking_sequences`, reusing `jr.official_tracking_no` if present `:985`. Paper: "After the last approval, the System Administrator generates the official tracking number, the request becomes Approved, and it is assigned to maintenance personnel" (`ch1.md:103`). |

**Verdict: DIFFERENT** — primarily on vocabulary (12 vs 9) and on "real time" (poll-only).

---

## G. Work orders, assignment and replacement/disposal flagging — **DIFFERENT**

**[RECONSTRUCTED] Source statements**

* `ch1.md:37` objective — "implement replacement and disposal flagging for items assessed as
  irreparable".
* `ch1.md:103` — "If maintenance personnel determine that an item cannot be repaired, they can raise
  a replacement or disposal flag, which prompts the System Administrator to start procurement
  procedures."
* `ch3.md:106` — "When the personnel **start the work**, the module saves the **Ongoing** status,
  logs the action, and notifies the requester and the System Administrator."
* `ch3.md:88` — after the Approver approves, the admin "generates the tracking number and assigns
  the request… the system **creates the work order**, generates the PDF form, **sets the status to
  Approved**, and sends the notifications."
* `ch3.md:116` — `tbl_work_order` "records the assignment… and the assigned and completion dates";
  `tbl_replacement_flag` "records items that cannot be repaired and the status of the flag".

| Sub-item | Status | Evidence |
|---|---|---|
| G1 Assignment to a maintenance account | MATCH | `requisitionRoutes.js:936-1034`; resolves and validates the account `:952-961` ("That person is not an active maintenance account"), stores the FK not a display string `:999-1007` |
| G2 **Status after assignment** | **DIFFERENT** | `requisitionRoutes.js:999-1007` writes `status = 'Ongoing'` at the moment of assignment. `ch3.md:88` says the system "sets the status to **Approved**" at assignment and `ch3.md:106` says personnel set **Ongoing** "when they start the work". The implementation collapses those two steps: the ticket never rests in `Approved` after a tracking number is issued, and the technician's own "start work" action (`WorkQueue.jsx:242`) re-records a status that is already `Ongoing`. |
| G3 Work order "record" | **DIFFERENT** | No `work_orders` table. `ch3.md:116` describes `tbl_work_order`. The live schema folds the fields into `job_requests`: `assigned_to`, `scheduled_date`, `completed_at` (`SHOW COLUMNS`). Functionally equivalent, structurally not the paper's ERD — see §J. |
| G4 Assigned + completion dates | MATCH | `scheduled_date` written `requisitionRoutes.js:1003`; `completed_at` set when status becomes `Completed` `requisitionRoutes.js:1134` |
| G5 Technician marks completion | MATCH | `ticketPolicy.js:183-186` allows only the assigned tech, `Ongoing → Completed`; UI `WorkQueue.jsx:269` |
| G6 Replacement/disposal flag by personnel | MATCH | `POST /:id/replacement-flag` `requisitionRoutes.js:1037` `requireRole('maintenance','technician','admin')`; audit `:1086`; UI `WorkQueue.jsx:308`, client `DataContext.jsx:1510` |
| G7 Flag prompts the System Administrator to start procurement | MATCH | `requisitionRoutes.js:1088` response `"Replacement flagged. PDAS was notified."`; procurement status column `replacement_procurement_status` (`SHOW COLUMNS`), surfaced to the requester at `FacultyStaffPortal.jsx:907-915` (`"Procurement Stage: …"`) |
| G8 Update flag state | MATCH | `PUT /:id/replacement-flag` `requisitionRoutes.js:1348` |
| G9 The PDF is produced with the work order | **MISSING** | See E11 — no caller of `jobRequestDocRoutes` from the UI. |

**Verdict: DIFFERENT** — G2 alone changes the meaning of the `Approved` stage.

---

## H. Archiving of completed and rejected requests — **MISSING (automatic) / PARTIAL (manual)**

**[RECONSTRUCTED] Source statements**

* `ch1.md:41` objective — "implement a centralized database, an **archiving feature** for
  maintenance request records…"
* `ch1.md:104` — "Once a ticket is marked Completed… the ticket **is archived** without being
  deleted, while **rejected requests are archived in the same way**."
* `ch1.md:114` — "Archiving… moves completed or rejected maintenance requests into a separate,
  retrievable record store…"
* `ch3.md:115` — "`is_archived` and `archived_at` fields mark archived tickets, so archived records
  stay in the same table and can be retrieved later."

| Sub-item | Status | Evidence |
|---|---|---|
| H1 Archive flag + timestamp on the ticket | MATCH | `is_archived tinyint(1) NOT NULL DEFAULT 0`, `archived_at datetime` (`SHOW COLUMNS`; ensured by `autoSetup.js:200-201`); in the same table as live rows (`schema.sql` `job_requests` block) — exactly as `ch3.md:115` describes |
| H2 Manual archive / restore | MATCH | `PUT /:id/archive` `requisitionRoutes.js:1420` `requireRole('admin')`, 409 if already archived `:1430-1432`, audited `:1440`; `PUT /:id/unarchive` `:1456`; client `DataContext.jsx:1601, 1626` |
| H3 **Auto-archive on Completed** | **MISSING** | Grep `is_archived = TRUE\|SET is_archived` in `backend/src` → **2 hits only**: `requisitionRoutes.js:1435` (archive endpoint) and `:1471` (unarchive). Nothing runs on the `Completed` transition — the `targetStatus === 'Completed'` branch `requisitionRoutes.js:1192-1200` only sends the evaluation reminder. |
| H4 **Auto-archive on Rejected** | **MISSING** | Same evidence as H3; `Rejected` is terminal (`ticketPolicy.js:58`) but never archived. |
| H5 Scheduled job / cron for archiving | **MISSING** | The only scheduler in the process is the preventive reminder: `server.js:184-185`. Grep `setInterval\|cron\|schedule` in `backend/src/server.js` → only those two lines. |
| H6 Archived records retrievable | MATCH | Archived view `frontend/src/views/admin/ArchivedRequests.jsx`; `GET /` accepts `?archived=true` (`requisitionRoutes.js:160, 249`) |
| H7 Only one UI path to archive | **EXTRA observation** | `JobRequests.jsx:1034` is the single call site of `archiveRequisition` in the whole UI (grep → `DataContext.jsx:1601` definition, `:1609` API call, `JobRequests.jsx:1034` usage) |

**Verdict: PARTIAL → effectively MISSING.** The paper's defining word is *automatic* ("the ticket
**is archived**"); the implementation is a manual admin button.

---

## I. Post-completion feedback form (ISO/IEC 25010) — **PARTIAL**

**[RECONSTRUCTED] Source statements**

* `ch1.md:41` — "an automated **post-completion feedback form**".
* `ch1.md:104` — "Once a ticket is marked Completed, the system **automatically sends** the
  requester a post-completion feedback form".
* `ch2.md:13` — "an evaluation form is **sent automatically** to the r[equester]… right after a
  service is completed."
* `ch3.md:116` — `tbl_evaluation` "stores the feedback that the requester submits through the
  post-completion feedback form **for a completed request**."

| Sub-item | Status | Evidence |
|---|---|---|
| I1 Evaluation table exists | MATCH | `evaluations` table present (14-table list), currently **0 rows** |
| I2 Form is presented on completion | MATCH | `FacultyStaffPortal.jsx:922-937` the `EvaluationForm` modal; opener `:930`; pending list derived at `DataContext.jsx:1920-1923` from completed tickets with no matching evaluation |
| I3 Submission is server-validated to Completed + requester | MATCH | `evaluationRoutes.js:40` `jobRequest.status !== 'Completed'` → reject; `:44` non-privileged caller must be `requester_id === req.user.id` |
| I4 Payload is written server-side first | MATCH | `DataContext.jsx:1666-1675` calls `apiSubmitEvaluation` and only on success does `setEvaluations` (`:1681`); failure returns early `:1676-1679` |
| I5 The **requester is prompted automatically** on completion | **PARTIAL** | `requisitionRoutes.js:1192-1200` sends a notification titled `'Service Evaluation Available'` — but only on the generic `PUT /:id/status` path. The dedicated action endpoints that can reach `Completed` are not shown to send it; `WorkQueue.jsx:269` uses `updateRequisitionStatus`, which does. |
| I6 Four ISO/IEC 25010 criteria | MATCH (scope) / **DIFFERENT (from papers)** | `EvaluationForm.jsx:6-11` scores Functional Suitability, Usability, Reliability, Performance Efficiency. `ch3.md:118` asks for **five** characteristics for the *acceptability* study (adds Security), but `ch3.md:165` and `ch1.md:104` treat the in-system feedback form as **separate** from the questionnaire, and `ch3.md:160` says the feedback form "collects feedback on individual maintenance requests". So four is defensible — flagged for the user to confirm. |
| I7 Reminders for unanswered feedback | **EXTRA (UI only)** | `SettingsPage.jsx:830` "ISO/IEC 25010 Post-Completion Feedback Reminders" toggle bound to `notifPrefs.evaluationReminders` (`:65, :839-840`); no server-side reminder job exists for it. |

**Verdict: PARTIAL.**

---

## J. Data model vs the paper's 10-table ERD — **DIFFERENT**

**[RECONSTRUCTED] Source statement** — `ch3.md:112` "the ERD, which has **ten tables**";
`ch3.md:115-116` names and describes all ten; `ch3.md:160` "the MySQL database, [which] stores the
**ten tables** described in the ERD (Figure 17), and file storage for the request photos, ID images,
and generated PDFs."

| Paper table | Live counterpart | Status | Evidence |
|---|---|---|---|
| `tbl_user` | `users` (22 cols) | **MATCH** (supervisor_id present, `consent_at` present but unused) | `schema.sql`; DB `SHOW COLUMNS` |
| `tbl_location` + QR codes | `campus_locations` | **DIFFERENT** | table exists, **0 rows**, **no `qr_code` column** (`schema.sql:88-95`) |
| `tbl_maintenance_request` | `job_requests` (43 cols) | **PARTIAL** | has `location_id` (always NULL), `is_archived`, `archived_at`, `official_tracking_no`, **but no photo reference** — `ch3.md:115` says the request "holds the… photo reference" |
| `tbl_approval` (level, decision, remarks, time) | `job_request_status_history` + 6 `*_approved*` column triples | **DIFFERENT** | no `tbl_approval`; `job_request_status_history` holds `from_status,to_status,changed_by,remarks` — no approval *level* or *decision* column |
| `tbl_work_order` | folded into `job_requests` (`assigned_to`,`scheduled_date`,`completed_at`) | **DIFFERENT** | no table |
| `tbl_replacement_flag` | folded into `job_requests` (`is_replacement_flagged`,`replacement_reason`,`replacement_item_specs`,`replacement_procurement_status`) | **DIFFERENT** | no table |
| `tbl_evaluation` | `evaluations` | **MATCH** | present, 0 rows |
| `tbl_preventive_maintenance` | `preventive_maintenance_schedules` | **PARTIAL** | `location` is `VARCHAR(255)` not an FK (`schema.sql:230`); **no `created_by`**, though `ch3.md:116` requires the link "to the administrator who created the schedule" |
| `tbl_notification` | `notifications` | **MATCH** | `notificationRoutes.js` |
| `tbl_activity_log` | `audit_log` | **MATCH** | `auditRoutes.js`, `requisitionRoutes.js` audit calls |
| — | `registration_requests` | **EXTRA** | approval queue needed by `ch1.md:97`, but not in the ERD |
| — | `documents` | **EXTRA** | 0 rows, no caller |
| — | `messages`, `message_replies` | **EXTRA** | see `05_extra…` §1 |
| — | `ticket_sequences`, `tracking_sequences` | **EXTRA** | concurrency aids, not in the ERD |

**Live table count: 14** (`SELECT COUNT(*)` → `14`). **Paper: 10.**
Naming: the code uses no `tbl_` prefix anywhere — grep `tbl_` in `backend/` and `frontend/` → **no
matches**.

**Verdict: DIFFERENT.** Naming alone is not the issue: `tbl_location` is judged DIFFERENT because it
lacks QR codes and is empty, and `tbl_approval` because no equivalent structure exists.

---

## K. Architecture and technology stack — **DIFFERENT (styling) / MATCH (tiers)**

**[RECONSTRUCTED] Source statements**

* `ch3.md:158` — "FixIT follows a **three-tier client-server design**… the browser loads the
  **React.js** front end, reads QR codes through the device camera, and keeps a local copy of
  requests prepared without an internet connection… Requests travel over **HTTPS**."
* `ch3.md:159` — "The **Node.js with Express** back end… organized into the **five modules**… Auth,
  Request, Approval, Work Order, Notification."
* `ch3.md:160` — data tier = "the MySQL database… and **file storage** for the request photos, ID
  images, and generated PDFs… A **scheduled backup** of the database and the stored files protects
  against loss."
* `ch3.md:41`, `ch3.md:146` — "Node.js with Express, **React.js with Tailwind CSS**, and MySQL".
* `ch1.md:40` objective — "support **offline request drafting** through local browser caching, with
  automatic synchronization".

| Sub-item | Status | Evidence |
|---|---|---|
| K1 Client tier = browser, React | MATCH | `App.jsx:16-19` lazy role workspaces, `package.json:19-20` react 19.2.8 |
| K2 Application tier = Node + Express | MATCH | `backend/src/server.js`; route modules listed in §2.4 |
| K3 Data tier = MySQL | MATCH | `backend/src/config/db.js` pool; `schema.sql`; XAMPP MySQL on 3306 |
| K4 **React.js with Tailwind CSS** | **DIFFERENT** | `grep tailwind frontend/package.json` → **no matches**; grep `@tailwind\|tailwindcss` in `frontend/` → no matches. Styling is hand-written tokens: `frontend/src/index.css` (46 `@media` rules). Papers: `ch3.md:41` and `ch3.md:146` (Table 4) both say Tailwind. → paper-correction candidate, `05_extra…` §4. |
| K5 Five modules | **PARTIAL (mapping)** | The code has 11 route files (§2.4), not five. Auth→`authRoutes.js`+`userRoutes.js`; Request→`requisitionRoutes.js`; Approval→`requisitionRoutes.js` action endpoints + `ticketPolicy.js`; Work Order→`requisitionRoutes.js` assign/replacement + `preventiveRoutes.js`; Notification→`notificationRoutes.js`. Functionally covered, not structurally mirrored. |
| K6 QR reading through the device camera | MATCH | `QrCodeScannerModal.jsx:3` `Html5Qrcode`; deps `package.json:14-15` (`html5-qrcode`, `jsqr`) |
| K7 **Offline drafting + automatic sync** | MATCH | `outbox.js:22-167` (queue, idempotency key `:26-34`, flush `:91-126`, `submitOrQueue` `:138-167`); flush on `online` event `OfflineBanner.jsx:40, 52, 122`; server replay `requisitionRoutes.js:348-375` |
| K8 **HTTPS** | **PARTIAL (deployment only)** | `DEPLOYMENT.md:52` (`FRONTEND_ORIGIN=https://…`) and `DEPLOYMENT.md:111` (`- [ ] Enable HTTPS`) — a manual checklist item. The dev loop is `http://localhost:5173` → `http://localhost:5000` (`server.js:180`, `api.js`). Grep `https\|TLS\|SSL` in `backend/src` → no TLS termination code. |
| K9 **File storage** for photos, ID images, PDFs | **PARTIAL** | ID images: stored *inline* as base64 in `VARCHAR(500)`, not as files (A7). Request photos: not stored at all (D5). PDFs: written to `backend/src/uploads/temp/` by `pdfGenerator.js:10, 25-28`; `/uploads` is deliberately **not** served (`server.js:96-100`), only `GET /api/documents/:id/download` (`documentRoutes.js:126`). |
| K10 **Scheduled backup** | **MISSING** | `ch3.md:160`. Grep `mysqldump\|backup` in `backend/` → no script. Only `README.md:317-318` documents a *manual* `mysqldump` command. |

**Verdict: DIFFERENT on the stack statement (Tailwind), MATCH on the three tiers and offline.**

---

## L. Non-functional requirements (ISO/IEC 25010 + RA 10173) — **PARTIAL**

**[RECONSTRUCTED] Source statements** — `ch3.md:118`: "the system should **perform its functions
correctly**, be **easy to learn on a phone or a computer**, **stay available during normal use**,
and **respond quickly** to ordinary requests. The system must also be **secure** and protect the
personal data it holds, including the ID photos, in line with the **Data Privacy Act of 2012**."
Plus `ch1.md:42` (five characteristics: functional suitability, usability, reliability, performance
efficiency, security) and `ch1.md:106` (responsive web, desktop/laptop/tablet/smartphone).

| Sub-item | Status | Evidence |
|---|---|---|
| L1 **Security — baseline HTTP headers** | MATCH | `server.js:61-79`: `nosniff` `:66`, `X-Frame-Options` `:67`, `Referrer-Policy` `:68`, CSP with `script-src 'self'` `:69-77`. Hand-rolled; `helmet` is not a dependency (not in `backend/package.json`). |
| L2 **Security — CORS** | MATCH | fail-fast `server.js:31-41`, configured `:43` |
| L3 **Security — no unauthenticated static file serving** | MATCH | `/uploads` mount removed, explicit deny `server.js:81-100` |
| L4 **Security — credential handling** | MATCH | bcrypt hash on register `authRoutes.js:145`; JWT required at boot `server.js:200-204`; DB-authoritative role `auth.js:35` |
| L5 **Security — login brute force** | MATCH | rate limit 10/min `authRoutes.js:11`; lockout 5 fails/15 min `authRoutes.js:35-37`; timing-equalised `DUMMY_HASH` `authRoutes.js:39-43` |
| L6 **Security — upload abuse** | MATCH | 10 MB cap `documentRoutes.js:36`, MIME allow-list `:37`, auth `:51` |
| L7 **Security — IDOR** | MATCH | `ticketPolicy.js:79-91` |
| L8 **Security — token storage** | **PARTIAL (risk)** | JWT in `localStorage`: `api.js:111-118` `TOKEN_STORAGE_KEY`, `getToken`, `setToken`. Readable by any XSS. Papers do not prescribe a mechanism — reported as a hardening item, not a conformance gap. |
| L9 **Security — self-approval** | **MISSING** | see E9 |
| L10 **Privacy — RA 10173 consent** | **MISSING** | see A5 |
| L11 **Privacy — ID images visible only to the System Administrator** | PARTIAL | see A6 |
| L12 **Availability — login rate limits / lockout** | MATCH | A/L5 above |
| L13 **Availability — atomic ticket-number generation** | MATCH | `requisitionRoutes.js:23-35` transaction + `ticket_sequences`; idempotency `:348-375` |
| L14 **Availability — DB reconnect/backoff** | MATCH | `server.js:187-197` retry loop, refuses to start after `MAX_RETRIES` |
| L15 **Availability — scheduled DB + file backup** | **MISSING** | see K10 |
| L16 **Performance — response to ordinary requests** | PARTIAL (measured statically) | Built bundle: `SettingsPage-*.js` **489.2 KB**, `index-*.js` **326.2 KB**, `AdminRoutes-*.js` **109.5 KB**, `index-*.css` **68.4 KB** (plus three logo PNGs 231.7/195.8/66.7 KB). `SettingsPage` and `AdminRoutes` are lazy chunks, but `index` (326 KB) is on the critical path. No profiling was run (a server run would be needed and was not permitted). |
| L17 **Performance — list paging** | MATCH | `requisitionRoutes.js:195-214` `LIMIT ? OFFSET ?` with `MAX_OFFSET` clamp `:200-203` |
| L18 **Usability — responsive on phone/computer** | MATCH | 46 `@media` rules in `frontend/src/index.css` (breakpoints 420/480/560/580/600/620/639/760/768/769/860/899/900/975/1024/1100/1180/1199/1366 px); `prefers-reduced-motion` `:1820`; `@media print` `:2957` |
| L19 **Usability — accessibility affordances** | **EXTRA (good)** | `SkipLink.jsx`, `SystemFooter`, labelled `FormField`s |
| L20 **Functional suitability — reporting by location, category, resolution status** | PARTIAL | `AnalyticsReports.jsx:117` building volume, `:131-132` groups by `category\|location\|resolutionStatus`, `:373` renders them, CSV export `:139-155`. But `r.location` is the display fallback `'Campus Facilities'` (`DataContext.jsx:490`) because `location_id` is NULL — so the location axis is currently degenerate. |
| L21 **Reliability — offline path** | MATCH | K7 above |
| L22 **Security — password policy consistency** | **PARTIAL (defect)** | see A11 |

**Verdict: PARTIAL.** The server-side security baseline is genuinely solid (L1–L7, L12–L14, L17).
The gaps are privacy (L10), backup (L15), self-approval (L9), token storage (L8) and bundle weight
(L16).

---

## Summary table

| # | Checklist item (reconstructed) | Status |
|---|---|---|
| **A** | Registration, account approval, data-privacy consent | **DIFFERENT** |
| **B** | Role model and role-based access control | **MATCH** |
| **C** | Location identification — QR with manual fallback | **MISSING** (in substance) |
| **D** | Job request form, photo, urgent fast path | **PARTIAL** |
| **E** | Four-level electronic approval + audit log | **MATCH** (order) / **PARTIAL** (log, PDF) |
| **F** | Ticket lifecycle, statuses, tracking, notifications | **DIFFERENT** |
| **G** | Work orders, assignment, replacement flagging | **DIFFERENT** |
| **H** | Archiving of completed and rejected requests | **MISSING** (automatic) |
| **I** | Post-completion feedback form | **PARTIAL** |
| **J** | Data model vs the 10-table ERD | **DIFFERENT** |
| **K** | Architecture and technology stack | **DIFFERENT** (Tailwind) / **MATCH** (tiers) |
| **L** | Non-functional (ISO/IEC 25010 + RA 10173) | **PARTIAL** |

**Tally:** 2 MATCH · 4 PARTIAL · 5 DIFFERENT · 1 MISSING-in-substance (with C and H partially
overlapping the PARTIAL column at sub-item level).
