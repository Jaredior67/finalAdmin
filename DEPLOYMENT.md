# FixIt PDAS — Deployment Guide

## Local Development (XAMPP)

### Prerequisites
- XAMPP installed (Apache + MySQL running)
- Node.js 18+
- MySQL `fixit_pdas` database imported

### Quick Start
1. **Double-click** `start-fixit.bat` — it checks services, builds if needed, starts the backend, and opens the browser
2. Access the system at: **http://localhost/FixIT**

### Manual Steps
```bash
# 1. Build frontend (only needed once or after code changes)
npm run build

# 2. Start backend API server (keep this running)
npm run start:backend

# 3. Open browser → http://localhost/FixIT
```

---

## Access URLs

| URL | Description |
|-----|-------------|
| `http://localhost/FixIT` | **Primary (recommended)** |
| `http://localhost/capstoneSystem` | Alternative alias |
| `http://localhost:5000/api/health` | Backend API health check |
| `http://localhost:5173/` | Vite dev server (coding mode) |

---

## Environment Variables (backend/.env)

```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=fixit_pdas
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=1d
FRONTEND_ORIGIN=http://localhost:5173
```

> **For web hosting:** Change `FRONTEND_ORIGIN` to your domain, e.g. `https://fixit-pdas.edu.ph`

---

## Web Hosting Deployment (cPanel / Apache)

### Option A: cPanel Shared Hosting (PHP + Node.js)

1. **Upload** the entire project folder to your public web directory (e.g. `public_html/fixit`)
2. **Import** `backend/database/schema.sql` via phpMyAdmin
3. **Edit** `backend/.env` with your hosting database credentials
4. **Install dependencies** via SSH:
   ```bash
   cd public_html/fixit/backend && npm install --production
   cd ../frontend && npm install && npm run build
   ```
5. **Start Node.js app** using cPanel Node.js Selector → Entry point: `backend/src/server.js`
6. The `.htaccess` file is already configured for Apache rewrite rules

### Option B: VPS / Cloud (Node.js standalone)

1. Upload the project
2. Configure `.env` with production values
3. Build frontend: `npm run build`
4. Start with PM2 for persistence:
   ```bash
   npm install -g pm2
   pm2 start backend/src/server.js --name fixit-pdas
   pm2 save && pm2 startup
   ```
5. Configure Nginx/Apache to proxy `http://localhost:5000`

---

## Auto-Save Offline Feature

Every form in the system (Job Request, Evaluation, Messages) automatically saves drafts to the browser's `localStorage`:

- **Key format:** `fixit_draft_<formKey>` (e.g. `fixit_draft_faculty_req_1`)
- **Works offline:** The `🔴 Offline Mode` banner appears when internet is lost — drafts are preserved
- **Restored on reload:** If a user refreshes mid-form, data is automatically re-filled
- **Cleared on submit:** Drafts are purged after successful form submission
- **Manual clear:** A "Clear draft" button appears below the form when a draft is active

---

## Security Notes

- `.env` files are blocked by `.htaccess` (returns `403 Forbidden`)
- `backend/src/` and `backend/database/` are blocked from direct HTTP access
- `node_modules/` is blocked from direct HTTP access
- JWT tokens expire after 1 day (configurable via `JWT_EXPIRES_IN`)

---

## Production Checklist

- [ ] Change `JWT_SECRET` to a strong random secret (min 48 chars)
- [ ] Set a MySQL password for the `root` account
- [ ] Enable HTTPS (SSL certificate from Let's Encrypt or hosting provider)
- [ ] Set `FRONTEND_ORIGIN` to your production domain in `.env`
- [ ] Remove admin seed credentials or change them immediately
- [ ] Run `npm audit` on both `frontend/` and `backend/` before deployment
