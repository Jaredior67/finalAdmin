# FixIt PDAS Admin Portal

This project is a role-based facilities and maintenance management system for ISAT U Dumangas. It supports three main user types:

- Admin / PDAS Director
- Faculty and Staff requisitioners
- Maintenance personnel

The application is built as a full-stack system with a React frontend and an Express + MySQL backend.

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
finalfinalfinaladmin/
├── README.md
├── package.json
├── backend/
│   ├── package.json
│   ├── database/
│   │   ├── schema.sql
│   │   └── seed.sql
│   └── src/
│       ├── server.js
│       ├── config/
│       │   └── db.js
│       ├── middleware/
│       │   └── auth.js
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── documentRoutes.js
│       │   ├── evaluationRoutes.js
│       │   ├── lookupRoutes.js
│       │   ├── messageRoutes.js
│       │   ├── notificationRoutes.js
│       │   ├── requisitionRoutes.js
│       │   └── userRoutes.js
│       ├── scripts/
│       │   └── seedAdmin.js
│       └── uploads/
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   ├── forms/
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── index.css
│       ├── main.jsx
│       ├── assets/
│       ├── backend/
│       │   └── api.js
│       ├── components/
│       │   ├── auth/
│       │   ├── common/
│       │   └── layout/
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── DataContext.jsx
│       ├── navigation/
│       │   ├── adminNavigation.js
│       │   ├── facultyNavigation.js
│       │   └── maintenanceNavigation.js
│       ├── routes/
│       │   ├── AdminRoutes.jsx
│       │   ├── FacultyRoutes.jsx
│       │   └── MaintenanceRoutes.jsx
│       └── views/
│           ├── admin/
│           ├── faculty/
│           ├── maintenance/
│           ├── CommunicationBox.jsx
│           ├── EvaluationForm.jsx
│           ├── FacultyStaffPortal.jsx
│           ├── MaintenanceFieldPortal.jsx
│           ├── OfficialDocuments.jsx
│           ├── PreventiveCalendar.jsx
│           ├── PrintLabels.jsx
│           ├── ReplacementRequests.jsx
│           └── SettingsPage.jsx
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
JWT_SECRET=your_secret_key_here
FRONTEND_ORIGIN=http://localhost:5173
```

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

- `POST /api/auth/register`
- `POST /api/auth/login`

### Users

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `PUT /api/users/:id/status`
- `DELETE /api/users/:id`
- `GET /api/users/registrations`
- `PUT /api/users/registrations/:id/approve`
- `PUT /api/users/registrations/:id/reject`

### Job Requests / Requisitions

- `GET /api/job-requests`
- `POST /api/job-requests`
- `GET /api/job-requests/:id`
- `PUT /api/job-requests/:id`
- `DELETE /api/job-requests/:id`

### Notifications

- `GET /api/notifications`
- `POST /api/notifications`

### Messages

- `GET /api/messages`
- `POST /api/messages`

### Documents

- `POST /api/documents/upload`
- `GET /api/documents`

### Evaluations

- `POST /api/evaluations`
- `GET /api/evaluations`

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
