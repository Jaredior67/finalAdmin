# FixIT: Facility Issue eXpress and Integrated Tracking System

Role-based facility maintenance system for ISAT U Dumangas Campus (PDAS Office).
It digitizes maintenance requests, replacing manual, verbal, and handwritten reporting.

## Roles

- **PDAS Admin** — reviews requests, manages approvals, assigns technicians, reports, archive.
- **Campus Admin** — final action (Approved/Disapproved) on the official job request form.
- **Faculty / Staff** — submits requests, tracks status, views history, evaluates completed work.
- **Maintenance Personnel** — assigned tasks, progress updates, completion, replacement flags.

## Ticket lifecycle (enforced on the server)

`Pending → Under Review → Awaiting Signatures → Approved → Ongoing → Completed`
(`Rejected` is terminal from Pending / Under Review / Awaiting Signatures / Approved.)

- Risk levels: **Low Risk / Medium Risk / High Risk** (colored badges with icons).
- **No digital signatures.** The official QF-PDAS-DC-01 form is printed and physically
  signed (client, immediate supervisor, PDAS Head, Campus Administrator).
- A ticket **cannot** move to Approved or Ongoing until PDAS Admin confirms the
  signed hardcopy (`PUT /api/job-requests/:id/signed-form`).
- Every status change is written to `job_request_status_history` **and** `audit_log`.

---

## 1. Project Overview

This system handles:

- User registration and approval
- Job request / requisition creation and tracking
- Maintenance assignments and status updates
- Communication between users
- Document upload and records
- Notifications and approval history
- Reports, archived records, and print labels
- Campus location and maintenance workflows

The app is organized around a central PDAS portal where each role sees a different workspace and navigation menu.

---

## 2. Tech Stack Used

### Frontend

| Item | Use |
| --- | --- |
| React 19 | Main UI framework |
| React DOM | Rendering into the browser |
| Vite | Local development server and production build |
| JavaScript + JSX | Frontend logic and component structure |
| CSS | Styling, layout, responsiveness, and themes |
| Lucide React | Icons used throughout the UI |
| HTML | Root document shell |

### Backend

| Item | Use |
| --- | --- |
| Node.js | JavaScript runtime for the API server |
| Express | REST API server |
| MySQL2 | MySQL database driver |
| JWT | Authentication token generation/verification |
| bcryptjs | Password hashing |
| dotenv | Environment configuration |
| CORS | Allow frontend to call the backend |
| Multer | File upload handling |

### Database

| Item | Use |
| --- | --- |
| MySQL | Main relational database |
| XAMPP / phpMyAdmin | Local database setup and management |

### Development Tools

| Item | Use |
| --- | --- |
| npm | Package management |
| Vite CLI | Frontend development commands |
| Oxlint | Linting |
| VS Code | Development environment |

### Not Used in this project

- TypeScript
- Tailwind CSS
- Redux / Zustand
- PostgreSQL
- MongoDB

---

## 3. Project Structure

```text
capstoneSystem/
├── README.md / AUDIT.md / DEPLOYMENT.md
├── backend/
│   ├── package.json
│   ├── .env.example (copy to .env — never commit real secrets)
│   ├── database/
│   │   ├── schema.sql
│   │   └── seed.sql
│   └── src/
│       ├── server.js (security headers, static uploads, generic error handler)
│       ├── config/db.js
│       ├── middleware/
│       │   ├── auth.js (Bearer JWT + server-side logout revocation)
│       │   └── rateLimit.js (login/register throttling)
│       ├── utils/
│       │   ├── auditLog.js
│       │   └── ticketPolicy.js (lifecycle map + RBAC, unit-tested)
│       ├── routes/
│       │   ├── authRoutes.js (register, login with lockout, logout)
│       │   ├── documentRoutes.js (JPG/PNG/PDF allow-list uploads)
│       │   ├── evaluationRoutes.js (owner-only, one per ticket)
│       │   ├── lookupRoutes.js
│       │   ├── messageRoutes.js (participant-only threads)
│       │   ├── notificationRoutes.js
│       │   ├── requisitionRoutes.js (ownership + transition + signed-form gates)
│       │   ├── userRoutes.js (admin-only; soft-delete)
│       │   ├── jobRequestDocRoutes.js / preventiveRoutes.js
│       ├── scripts/ (autoSetup migrations, seedAdmin, seedTestAccounts)
│       ├── tests/ (ticketPolicy.test.js + QR helper tests)
│       └── uploads/ (allow-listed files only, nosniff)
├── frontend/
│   ├── package.json / index.html / vite.config.js
│   └── src/
│       ├── App.jsx (role shells + skip link + toast/offline providers)
│       ├── index.css (design tokens: type scale, 8px spacing, status-only colors)
│       ├── assets/ / backend/api.js
│       ├── components/
│       │   ├── auth/ / layout/
│       │   ├── common/ (Modal with focus trap, badges, skeletons, banners…)
│       │   └── ui/ (FormField, Pagination, Toast — shared primitives)
│       ├── context/ (AuthContext with idle timeout, DataContext)
│       ├── navigation/ / routes/ (per-role)
│       └── views/ (admin/, faculty/, maintenance/, campusAdmin/, shared)
```

---

## 4. Main Application Modules

### Frontend modules

- `src/App.jsx` - main app shell and role routing
- `src/context/AuthContext.jsx` - login state, session, and user role checks
- `src/context/DataContext.jsx` - application data and notification logic
- `src/components/layout/` - navbar, sidebar, footer, drawers
- `src/components/auth/` - login and registration UI
- `src/routes/` - role-specific route selection
- `src/views/` - page-level screens for admin, faculty, and maintenance workspaces

### Backend modules

- `server.js` - Express app and route registration
- `config/db.js` - MySQL connection pool
- `routes/authRoutes.js` - login and registration endpoints
- `routes/userRoutes.js` - admin user and registration management
- `routes/requisitionRoutes.js` - job requests and work orders
- `routes/notificationRoutes.js` - notifications
- `routes/messageRoutes.js` - communications
- `routes/documentRoutes.js` - file/document uploads
- `routes/evaluationRoutes.js` - service evaluation data
- `routes/lookupRoutes.js` - lookup tables and campus metadata

---

## 5. Roles and Permissions

### Admin

- Manage users and approvals
- Review registration requests
- Track job requests
- Approve or reject requests
- View analytics and reports
- Manage archived items and settings

### Faculty / Staff

- Submit requisitions
- View job request status
- Communicate with the offices
- Access campus maintenance workflows
- Manage required documents and forms

### Maintenance

- Receive assigned work orders
- Update job progress
- Handle emergency queue tasks
- Record preventive maintenance tasks
- Access equipment safety and maintenance documents

---

## 6. Database Design

The database is created in `backend/database/schema.sql`.

Main tables include:

- `users` - active system accounts
- `registration_requests` - pending sign-up requests
- `campus_locations` - building/floor/room references
- `job_requests` - requisitions or maintenance work orders
- `job_request_status_history` - status changes audit log
- `evaluations` - user ratings after work completion
- `messages` - internal communications
- `message_replies` - replies to messages
- `documents` - uploaded files
- `notifications` - app notifications

This is a MySQL relational system, not a NoSQL database.

---

## 7. Authentication Flow

The app uses token-based authentication:

1. User logs in through the frontend form.
2. Frontend sends email + password to the backend.
3. Backend checks `users` table and compares password with bcrypt hash.
4. Backend creates a JWT token.
5. Frontend stores the token locally.
6. Every protected request includes the token in the Authorization header.

The backend is configured to reject inactive or invalid accounts and to fail clearly if the database is not reachable.

---

## 8. Frontend and Backend Communication

The frontend API helper is located in:

- `frontend/src/backend/api.js`

It uses `fetch` to call the backend at:

- `http://localhost:5000/api`

By default, the frontend connects to the backend on port 5000.

---

## 9. Setup Instructions

### Step 1: Install project dependencies

From the root folder:

```bash
npm install
```

Then install frontend dependencies:

```bash
cd frontend
npm install
```

Then install backend dependencies:

```bash
cd backend
npm install
```

### Step 2: Start MySQL using XAMPP

Make sure:

- Apache is running
- MySQL is running
- phpMyAdmin is available

### Step 3: Import the database

Open phpMyAdmin and import:

- `backend/database/schema.sql`

This creates the `fixit_pdas` database.

### Step 4: Configure environment variables

Create a `.env` file inside `backend/` with variables such as:

```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=fixit_pdas
JWT_SECRET=<output of: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_EXPIRES_IN=8h
FRONTEND_ORIGIN=http://localhost:5173
```

Security notes: passwords are bcrypt-hashed (cost 10, min 8 chars with letter+number);
login is rate-limited with 15-minute lockout after 5 failures; JWT default expiry is
8h with 30-minute client idle timeout; logout revokes the token server-side;
uploads accept JPG/PNG/PDF only; error responses are generic outside development.

### Backup (MySQL)

```bash
# Nightly dump (Windows Task Scheduler or cron)
mysqldump -h 127.0.0.1 -u root fixit_pdas > fixit_pdas_%DATE%.sql
# Restore
mysql -h 127.0.0.1 -u root fixit_pdas < fixit_pdas_YYYYMMDD.sql
```
Keep at least 7 daily dumps off-machine. Browser `localStorage` is a cache only —
the database is the system of record for users; ticket writes should target the
API (see item 1 below) so dumps capture everything.

### Step 5: Start the backend

```bash
cd backend
npm run dev
```

### Step 6: Start the frontend

```bash
cd frontend
npm run dev
```

Then open the frontend in your browser, usually at:

- `http://localhost:5173`

---

## 10. Useful Commands

### Root

```bash
npm --prefix frontend run dev
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run preview
```

### Backend

```bash
cd backend
npm run dev
npm run start
npm run seed:admin
npm test
```

---

## 11. Main API Routes

The backend registers the following main routes:

### Authentication

- `POST /api/auth/register` (faculty/staff only, rate-limited, min 8-char letter+number password)
- `POST /api/auth/login` (rate-limited; 5 failures lock the account 15 min)
- `POST /api/auth/logout` (revokes the Bearer token server-side)

### Users (PDAS Admin only)

- `GET /api/users`
- `POST /api/users` (same password rules)
- `PUT /api/users/:id`
- `PUT /api/users/:id/status`
- `DELETE /api/users/:id` (soft-delete → `inactive`; self-deactivation blocked)
- `GET /api/users/registrations`
- `PUT /api/users/registrations/:id/approve`
- `PUT /api/users/registrations/:id/reject`

### Job Requests (ownership enforced: requester / assignee / admin)

- `GET /api/job-requests`
- `POST /api/job-requests` (description ≤ 5000 chars, allow-listed category)
- `GET /api/job-requests/:id`
- `PUT /api/job-requests/:id/status` (role + transition map + signed-form gate)
- `PUT /api/job-requests/:id/signed-form` (admin: confirm physical hardcopy)
- `PUT /api/job-requests/:id/complete-standard-form` (requester or admin)
- `PUT /api/job-requests/:id/replacement-flag` (admin or assigned technician)

### Notifications

- `GET /api/notifications`
- `POST /api/notifications`

### Messages

- `GET /api/messages`
- `POST /api/messages`

### Documents (JPG/PNG/PDF only, ≤10 MB, renamed server-side)

- `POST /api/documents`
- `GET /api/documents/job-request/:jobRequestId`
- `GET /api/documents/:id/download` (uploader / requester / assignee / admin)

### Evaluations (requester-only, one per completed ticket)

- `POST /api/evaluations`
- `GET /api/evaluations`
- `GET /api/evaluations/job-request/:jobRequestId`

### Lookups

- `GET /api/lookups/*`

---

## 12. Current Architecture Summary

This project uses:

- React for the interface
- CSS for styling
- Express for the API layer
- MySQL for persistent data storage
- JWT and bcrypt for auth security
- role-based route logic for admin, faculty/staff, and maintenance flows

It is not just a static frontend demo anymore; it is designed as a real multi-role facilities management application with database-backed authentication and workflow operations.

---

## 13. Development Notes

- Keep reusable UI components inside `frontend/src/components/`
- Keep business logic and shared state in `frontend/src/context/`
- Keep route mappings in `frontend/src/routes/`
- Keep menu definitions in `frontend/src/navigation/`
- Keep backend logic in `backend/src/routes/`
- Always import the database schema before testing login or requests

---

## 14. Quick Start Summary

```bash
# 1) install frontend deps
cd frontend
npm install

# 2) install backend deps
cd ../backend
npm install

# 3) import schema.sql into MySQL

# 4) create backend/.env

# 5) run backend
npm run dev

# 6) run frontend in another terminal
cd ../frontend
npm run dev
```

---

## 15. Final Notes

This project is a complete maintenance and facilities workflow system for institutional operations. It includes both the user-facing portal and the backend data layer needed for real account management, requests, notifications, and operational tracking.

If you want, the next step can be to add:

- a full API documentation page,
- a developer onboarding guide,
- a deployment guide for hosting,
- or a separate `docs/` folder for technical documentation.
