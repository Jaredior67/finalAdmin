# AGENTS.md

Working notes for coding agents in this repository.

## Project snapshot

FixIT PDAS is a role-based facility/maintenance job-request system for ISAT U Dumangas Campus.
It is a real database-backed application, not a static demo.

- Frontend: React 19 + JSX + Vite + plain CSS (`frontend/`)
- Backend: Node.js + Express + MySQL (`backend/`)
- Database driver: `mysql2`
- Auth: JWT Bearer tokens, bcrypt passwords
- Icons: `lucide-react`
- Lint: `oxlint`
- No TypeScript, Tailwind, Redux/Zustand, PostgreSQL, or MongoDB

Primary roles: `superadmin`, `admin` (PDAS Admin), `campus_admin`, `faculty`, `staff`,
`maintenance`, `technician`. A supervisor is a designation flag (`is_supervisor`) on a
faculty/staff account, not a separate role.

## Commands

Run from the repository root unless noted. On Windows PowerShell, use `npm.cmd` if `npm`
is blocked by execution policy.

```powershell
npm.cmd install                  # root dependencies
npm.cmd --prefix frontend install
npm.cmd --prefix backend install

npm.cmd run dev:backend          # Express + node --watch, port 5000
npm.cmd run dev:frontend         # Vite dev server, port 5173
npm.cmd run dev                  # same as dev:frontend only

npm.cmd test                     # backend tests, then 7 frontend smoke scripts
npm.cmd run build                # production build into frontend/dist
npm.cmd run lint                 # oxlint backend/src + frontend/src
```

Useful backend-only commands:

```powershell
cd backend
npm run start                    # node src/server.js (no watch)
npm test                         # node --test tests/*.test.js
npm run seed:admin
npm run seed:all
npm run check:login
npm run smoke:live               # live API smoke test; inspect before running
npm run smoke:chain              # chained live workflow smoke test; inspect before running
npm run repair:all
```

`npm test` is the normal gate and does not require a running API for the backend tests or
the frontend smoke scripts. The `smoke:*`, `check:*`, and `reset:*` scripts do touch a live
server/database; read them before using them against real data.

## Local startup

1. Start XAMPP MySQL (port 3306). Apache is only needed for the `/pdasFixit` PHP entry point.
2. Import `backend/database/schema.sql` into MySQL if the database is new.
3. Copy `backend/.env.example` to `backend/.env` and set the real values. Never commit `.env`.
   `FRONTEND_ORIGIN` and `JWT_SECRET` are required at boot.
4. Run the backend and frontend:
   - API: `http://localhost:5000/api`
   - Health: `http://localhost:5000/api/health`
   - Vite: `http://localhost:5173`
   - XAMPP entry: `http://localhost/pdasFixit`

The backend serves `frontend/dist` when it exists. After any frontend change that should be
visible through Apache/port 5000, run `npm.cmd run build` and hard-refresh the browser.
Do not hand-edit generated files in `frontend/dist`.

## Repository map

```text
backend/
  database/schema.sql          canonical database shape
  src/server.js                route mounts, CORS/security headers, static dist
  src/config/db.js             MySQL pool
  src/middleware/auth.js       JWT verification, role guards, token revocation
  src/routes/                  auth, users, job requests, notifications, messages, ...
  src/scripts/autoSetup.js     boot-time migrations; keep in sync with schema.sql
  src/utils/ticketPolicy.js    lifecycle transitions + RBAC, unit-tested
  tests/                       backend regression tests
frontend/
  src/App.jsx                  role shells and top-level tab routing
  src/context/AuthContext.jsx  session and role flags
  src/context/DataContext.jsx  application data, API-backed actions, notifications
  src/backend/api.js           frontend API client
  src/routes/                  role route maps
  src/navigation/              per-role menus
  src/views/                   page components by workspace
  src/index.css                design tokens and global styles
  scripts/                     frontend smoke scripts
```

## Architecture rules

- MySQL is the system of record. Browser `localStorage` is only a cache.
- All server writes go through the API client/backend; do not invent local-only records.
- Keep shared state and server actions in `frontend/src/context/DataContext.jsx`.
  Keep HTTP details in `frontend/src/backend/api.js`.
- Keep route maps in `frontend/src/routes/` and menu definitions in
  `frontend/src/navigation/`.
- Keep backend HTTP logic in `backend/src/routes/`; use `ticketPolicy.js` for ticket
  transitions and authorization rather than reimplementing status rules.
- Status changes, archive/restore, and other auditable writes should be transactional and
  write an `audit_log` row.
- Schema changes must be made in **both** `backend/database/schema.sql` and
  `backend/src/scripts/autoSetup.js`. Tests check that the boot migration keeps up with the
  schema/category/status vocabulary.
- Register fixed paths before parameterized ones. For example, `/stats` must stay before
  `/:id` in a router. Keep route guards on every privileged endpoint.
- Uploaded files are served only through authenticated `GET /api/documents/:id/download`.
  Do not reintroduce a public `/uploads` static mount.

## Archive semantics

Archiving is logical, not deletion. There are four archive-like records, and they do not
share one endpoint.

### Job requests / official documents

- `PUT /api/job-requests/:id/archive`
- `PUT /api/job-requests/:id/unarchive`
- Allowed roles: `admin` and `superadmin`.
- Writes `is_archived = TRUE`, `archived_at = NOW()` and an audit row; restore clears both.
- `GET /api/job-requests` is active-only by default. Use `?archived=true` for archived rows.
- The Official Documents screen archives the underlying job request via
  `archiveRequisition`; there is no `POST /api/documents/:id/archive` endpoint.
- Archived requests must stay out of the live request/document registry and stats.

### Notifications

- `PUT /api/notifications/:id/archive`
- `PUT /api/notifications/:id/unarchive`
- `DELETE /api/notifications/:id` permanently deletes one notification.
- `GET /api/notifications` is the active inbox by default; use `?archived=true` for the
  user's archive. The unread badge counts active, unread notifications only.
- These routes are user-scoped by `req.user.id`; one user cannot archive or delete another
  user's notification.
- All roles can archive their own notifications. `NotificationsCenter` exposes Inbox and
  Archived views so non-admin users can restore their own records.
- Admin/superadmin also see notifications in the unified Archive Center.

### Accounts

- There is no separate account archive table. An archived account is `users.status = 'inactive'`.
- `DELETE /api/users/:id` soft-deletes by setting `status = 'inactive'`; it never removes the
  user row, preserving ticket/audit history.
- Restore/reactivate with `PUT /api/users/:id/status` using `{ "status": "active" }`.
- Activation/deactivation is **superadmin-only**. Admins may see inactive accounts in the
  Archive Center but the reactivation action is intentionally disabled for them.
- Self-deactivation is blocked.

### Archive Center UI

- `frontend/src/views/admin/ArchivedRequests.jsx` is presented as **Archive Center**
  (navigation label **Archives**) with Request Records, Personnel Accounts, and My
  Notifications tabs.
- The component export name `ArchivedRequests` and route id `archived-requests` are kept
  intentionally for compatibility; do not rename them just to match the UI label.
- Archive rows are read-only: clicking a request opens details, but the archive view must
  not offer the normal "View" action. Restore is the archive action.
- Admins and superadmins can access the Archive Center; non-admin users restore their own
  notifications from the Inbox/Archived toggle in `NotificationsCenter`.
- Empty states and permission explanations are part of the feature; keep them when editing
  the archive screens.

## Ticket lifecycle

Server-enforced path:

`Pending -> Under Review -> Awaiting Signatures -> Approved -> Ongoing -> Completed`

`Rejected` is terminal from Pending, Under Review, Awaiting Signatures, or Approved.
Do not bypass `ticketPolicy.js` or the signed-form gate in `requisitionRoutes.js`.

## Testing and validation

Before finishing a change, run:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Expected baseline:

- Backend: 93 passing tests (5 suites).
- Frontend: all 7 smoke scripts pass (`queue`, `faculty`, `faculty-dashboard`,
  `calendar`, `request-intake`, `persistence`, `charts`).
- Lint currently reports warnings only. Do not add new errors, and keep new warnings out of
  files you touch where practical.
- `npm.cmd run build` warns about a large main chunk; that warning is pre-existing.

The surface-ramp test rejects hardcoded background greys such as `#f8fafc` and `#f1f5f9`
in components. Use the CSS tokens instead, e.g. `var(--bg-card)`, `var(--bg-sunken)`,
`var(--bg-canvas)`, `var(--border-subtle)`, and the `--status-*` / `--urgency-*` palettes.
When adding hover styles, reset to the same token used at rest.

## Known intentional quirks

- `ArchivedRequests` component name and `archived-requests` route id are legacy-compatible
  names for the Archive Center.
- `npm.cmd run dev` starts only the Vite frontend; use `dev:backend` for the API.
- The backend starts `autoSetup()` before listening. A failed migration prevents startup.
- The current backend can restart under `node --watch`; if a live API check disagrees with
  local code, confirm the process has reloaded before changing code.
- Do not commit real `.env` values, database dumps, uploaded documents, or seed passwords.
