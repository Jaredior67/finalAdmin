# FixIT — Phase 0 Audit (2026-09-21)

Scope: `frontend/` (React 19 + Vite 8, custom CSS tokens, no Tailwind) and
`backend/` (Express 4 + mysql2 raw parameterized queries, JWT, bcryptjs,
multer). Database: MySQL (`backend/database/schema.sql`).
Prior uncommitted work in the tree (sidebar restyle, dashboard cleanup,
offline banner, overlay validation, reports filters) is included below as seen.

Severity: **High** = exploitable or blocks use · **Med** = should fix soon ·
**Low** = polish / hygiene.

## (b) Security

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| S1 | **High** | IDOR: ticket detail has no ownership/role check — any logged-in user can fetch any ticket by id/ticket no. | `backend/src/routes/requisitionRoutes.js:102` |
| S2 | **High** | No authorization on status transitions — any authenticated role can set ANY status (incl. jumping straight to Approved/Completed); no transition validation. | `backend/src/routes/requisitionRoutes.js:215` |
| S3 | **High** | No server-side signed-form gate — nothing enforces "confirmed signed form before Approved/Ongoing" (frontend-only warnings). | `backend/src/routes/requisitionRoutes.js:215` |
| S4 | **High** | `complete-standard-form` and `replacement-flag` endpoints lack ownership/role checks. | `backend/src/routes/requisitionRoutes.js:304,328` |
| S5 | **High** | File uploads: multer has no type allow-list, keeps attacker-controlled extension, files served statically under `/uploads`. Malicious `.html/.svg` upload = stored XSS/phishing. | `backend/src/routes/documentRoutes.js:13-20`, `backend/src/server.js:51` |
| S6 | **High** | No rate limiting or lockout on login; no password-strength rules on register. | `backend/src/routes/authRoutes.js:11,85` |
| S7 | **High** | JWT stored in `localStorage` (stealable via any XSS); hardcoded fallback `JWT_SECRET`; 1-day expiry; logout is client-only (token stays valid); no idle timeout. | `frontend/src/backend/api.js:103-110`, `backend/src/routes/authRoutes.js:123-127`, `frontend/src/context/AuthContext.jsx` |
| S8 | Med | Central error handler returns `err.message` — can leak SQL/driver details to clients. | `backend/src/server.js:98-101` |
| S9 | Med | Evaluation POST checks `Completed` but not ownership; no duplicate-evaluation guard (one user can rate anyone's ticket repeatedly). | `backend/src/routes/evaluationRoutes.js:9` |
| S10 | Med | No `helmet`/security headers (CSP, X-Frame-Options, HSTS, no-sniff). | `backend/src/server.js` |
| S11 | Med | Hard `DELETE FROM users` (prefer archive/soft-delete); no audit-log table for status changes, approvals, archive, deletions (only `job_request_status_history` exists). | `backend/src/routes/userRoutes.js:243-246`, `backend/database/schema.sql` |
| S12 | Med | `GET /api/documents/:id/download` and `GET /job-request/:jobRequestId` have no ownership check. | `backend/src/routes/documentRoutes.js:47,61` |
| S13 | Med | `.env.example` ships a real-looking `JWT_SECRET` value — must be a placeholder. (`.env` itself is gitignored ✓.) | `backend/.env.example` |
| S14 | Med | `POST /api/job-requests` validates only `description` presence — no type/length/format limits server-side. | `backend/src/routes/requisitionRoutes.js:138-154` |
| S15 | Low | CORS allows any localhost origin with `credentials: true`; JSON body limit 15 MB is generous. | `backend/src/server.js:30-44` |
| S16 | Low | Ownership checks on notifications/messages/preventive `PUT /:id` not yet verified — re-check in Phase 2. | `backend/src/routes/notificationRoutes.js`, `messageRoutes.js`, `preventiveRoutes.js:60` |

Verified good: bcrypt hashing (cost 10) everywhere; parameterized queries throughout (no string-concatenated SQL found); generic login failure messages; `userRoutes` correctly gated with `requireRole('admin')`; self-registration restricted to faculty/staff; `npm audit`: 0 vulnerabilities (backend and frontend).

## (a) UI inconsistency

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| U1 | Med | Terminology mix: "Request" vs "Requisition" vs "work order" in ~100 user-visible strings (nav, headings, notifications, timeline notes). | e.g. `frontend/src/navigation/facultyNavigation.js:19`, `frontend/src/views/FacultyStaffPortal.jsx`, `frontend/src/context/DataContext.jsx:132,1222` |
| U2 | Med | Date formats mixed: raw `YYYY-MM-DD` in tables, `toLocaleString` timestamps, `Sep 2, 2026` vs `September 2, 2026`. | `frontend/src/views/*`, `TimeGreeting.jsx:12` |
| U3 | Med | Styling is one-off inline styles per view instead of shared components/tokens; duplicated portals (`FacultyStaffPortal` vs `views/faculty/*`, `MaintenanceFieldPortal` vs `views/maintenance/*`). | `frontend/src/views/` |
| U4 | Low | Dead components: `StatCard`, `DataTable` defined but never imported. | `frontend/src/components/common/` |
| U5 | Low | Submit button has no loading/disabled double-submit guard (`isSubmitting` declared but unused). | `frontend/src/views/FacultyStaffPortal.jsx:149` |
| — | — | Already fixed in working tree (verify + commit): stat-card icon slot/2-line labels, table `overflow-x` + category hide <1200px, sidebar scroll + pinned Sign Out, hamburger toggle, hover/focus states, 1366/1024/mobile breakpoints. | `ExecutiveDashboard.jsx`, `Sidebar.jsx`, `index.css` |

## (c) Accessibility (WCAG 2.1 AA)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| A1 | Med | No "skip to main content" link. | `frontend/src/App.jsx` |
| A2 | Med | Modal has Esc + `aria-modal` but no focus trap, no initial focus, no `aria-labelledby`, no focus return. | `frontend/src/components/common/Modal.jsx:4-24` |
| A3 | Med | Sidebar nav rows (~32px) and icon buttons below 44px touch target on mobile. | `frontend/src/components/layout/Sidebar.jsx` |
| A4 | Low | Global search input has no associated `<label>`; overlay labels lack `htmlFor`; tables lack `th scope`; inline field errors don't use `aria-describedby`. | `Navbar.jsx`, `JobRequestFormOverlay.jsx` |
| A5 | Low | Amber `#d97706` small text on light backgrounds must be contrast-checked (4.5:1) in Phase 3. | `index.css`, badges |
| — | — | Already OK: global `:focus-visible` ring, `prefers-reduced-motion`, badges use icon + text (not color alone), modal close has `aria-label`, `aria-live` on banners. | `index.css`, `StatusBadge.jsx` |

## (d) Usability (Nielsen)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| N1 | Med | Tables have search/filter but no sorting or pagination (`DataTable` with those features is dead code). | `views/admin/JobRequests.jsx`, `FacultyStaffPortal.jsx` |
| N2 | Med | Toasts are scattered local states, not one system — some actions give no feedback. | various views |
| N3 | Low | Offline banner exists but only counts local drafts; real queued submission sync is not implemented. | `frontend/src/components/common/OfflineBanner.jsx` |
| — | — | Already OK: confirm dialogs on destructive actions, inline validation on the request overlay, skeletons/empty states, stepper on details, archive + post-completion evaluation flow. | — |

## (e) Code quality

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| Q1 | Med | `DataContext.jsx` (~2000 lines) is a god module: state, seed data, API sync, derived stats. Split in Phase 5. | `frontend/src/context/DataContext.jsx` |
| Q2 | Low | `oxlint`: 0 errors, **121 warnings** — mostly unused imports/variables (`MaintenanceDashboard`, `FacultyStaffPortal`, `ReplacementRequests`, `CommunicationBox`, `PrintLabels`, `UserManagement`, `JobRequests`, `CampusAdminDashboard`, `ExecutiveDashboard`, `DataContext`, `SettingsModal`). | repo-wide |
| Q3 | Low | Backend tests cover QR helpers only; no API/auth tests; no frontend tests. `npm test` = `node --test tests/`. | `backend/tests/` |
| Q4 | Low | `console.warn` only in `useOfflineAutoSave.js` (acceptable); verify no debug logs remain elsewhere before release. | `frontend/src/utils/useOfflineAutoSave.js` |
| Q5 | Low | README exists; needs env/roles/lifecycle refresh per Phase 5. | `README.md`, `DEPLOYMENT.md` |

## Phase 1–5 plan (for approval)

- **Phase 1 — Design system & consistency.** Token audit of `index.css`; build `FormField/Input/Select/Textarea/Button/Table/Badge/Toast/Breadcrumb` from existing pieces; migrate views off inline styles page by page; unify terminology to "Request" + long-date `Sep 2, 2026`; add table sort/pagination; commit per page.
- **Phase 2 — Security (highest priority).** Ownership + `requireRole` on every endpoint; server-side transition map + signed-form gate; login rate-limit + lockout columns; password rules; move JWT toward httpOnly cookie (or document accepted risk) + remove fallback secret + shorter expiry + server logout denylist; generic error handler; multer allow-list (jpg/png/pdf), size cap, random names, non-executable serving; audit-log table; replace hard user delete with soft-delete; placeholder secret in `.env.example`; helmet; evaluation ownership + dedupe; server-side input limits.
- **Phase 3 — Accessibility.** Skip link, modal focus trap/labels/return, 44px targets, label/`htmlFor`/`aria-describedby`/`th scope`, contrast fixes, keyboard dropdowns, 200% zoom check.
- **Phase 4 — Usability.** Global toast system, double-submit guards, table sort/pagination/empty-state actions, offline outbox sync, keep stepper/archive/evaluation flows.
- **Phase 5 — Quality & docs.** Split `DataContext`, remove dead code, fix all 121 lint warnings, API/auth tests, README update, Lighthouse report.

Manual test baseline for every phase: `npm run dev:backend` + `npm run dev:frontend`, log in as admin/faculty/maintenance seed accounts, file → review → sign → approve → complete → evaluate one ticket.

## Phase completion record

- **Phase 1 — DONE.** Type/spacing tokens (`index.css`); `ui/FormField`, `ui/Pagination`,
  `ui/Toast` shared primitives adopted by Reports, request overlay, all main tables;
  terminology unified to "Request"; `formatTicketDate` ("Sep 2, 2026") + recent-first
  everywhere; admin table sort + pagination everywhere; stat/table/sidebar bugs fixed.
- **Phase 2 — DONE.** Ownership on ticket/message/document reads; server transition map
  + signed-form gate (`ticketPolicy.js`, 11 unit tests green); login rate-limit +
  15-min lockout; password rules; JWT boot-secret check + 8h default; upload
  JPG/PNG/PDF allow-list + renamed files + nosniff; security headers; generic errors;
  user soft-delete; `audit_log` table; evaluation owner-only + dedupe; token logout
  revocation + 30-min idle timeout. `npm audit`: 0 vulns. Deferred: httpOnly-cookie
  JWT (Bearer kept; short expiry + revocation mitigate), HSTS (plain-HTTP XAMPP).
- **Phase 3 — DONE.** Skip link + `main` landmarks; modal focus trap/labels/return;
  44px mobile targets; search `aria-label`; `th scope="col"` on all main tables;
  verified icon+text badges, focus rings, reduced-motion.
- **Phase 4 — DONE.** Global toasts on all 9 core actions; double-submit guard on the
  request overlay; table sort/pagination/empty states; offline banner + draft count +
  back-online toast; archive + post-completion evaluation flows kept.
- **Phase 5 — DONE except noted.** Lint 121 → 26 warnings (0 errors; remainder are
  accepted React-compiler stylistic hints, not bugs); dead seed/imports removed;
  README refreshed. Deferred: `DataContext` split (high regression risk, no test
  harness for its UI wiring — recommended next); Lighthouse run (no tooling in this
  environment — run manually: `npm run build`, serve `dist/`, Chrome DevTools →
  Lighthouse → Accessibility + Best Practices).

- **Phase 6 - DONE (2026-09-25).** Critical bugs and security gaps resolved:
  1. campus_admin ENUM: users.role updated in schema.sql and live DB; autoSetup migration confirmed.
  2. Ticket race condition: COUNT-based generator replaced with atomic ON DUPLICATE KEY UPDATE on new ticket_sequences table; existing tickets seeded.
  3. Notifications live API: notificationRoutes rewritten with pagination, unread_count, DELETE endpoints; DataContext wired to MySQL with 30s polling; localStorage removed.
  4. Requisitions live API: DataContext loads from /api/job-requests on login; refreshRequisitions exported; localStorage sync removed.
  5. api.js: apiGetNotifications, apiMarkNotificationRead, apiMarkAllNotificationsRead, apiDeleteNotification, apiClearAllNotifications added.
  6. Document upload: file_size saved; ownership guard on GET /documents/job-request/:id.
  7. Preventive schedule PUT: requireRole(admin,campus_admin) enforced; status allow-list and length caps added (closes S16).
  8. User role allow-list: POST and PUT user endpoints reject unknown roles (privilege escalation prevention).
  9. autoSetup.js: ticket_sequences and file_size migrations added.
  10. Build verified: vite build completes 1918 modules, 0 errors.
  Remaining/deferred: httpOnly-cookie JWT, DataContext full split, API test suite, password reset, Lighthouse audit.
