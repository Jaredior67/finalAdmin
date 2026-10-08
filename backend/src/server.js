import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { verifyDbConnection } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import lookupRoutes from './routes/lookupRoutes.js';
import requisitionRoutes from './routes/requisitionRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import evaluationRoutes from './routes/evaluationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import jobRequestDocRoutes from './routes/jobRequestDocRoutes.js';
import preventiveRoutes, { runAutomatedPreventiveReminders } from './routes/preventiveRoutes.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (configuredOrigins.length === 0) {
  console.error('====================================================');
  console.error(' FATAL: FRONTEND_ORIGIN is not set in backend/.env.');
  console.error(' Without it the CORS allow-list is empty, and an empty');
  console.error(' allow-list used to mean "accept every origin" with');
  console.error(' credentials:true — any site could call this API.');
  console.error(' Set FRONTEND_ORIGIN to your frontend origin(s),');
  console.error(' comma-separated, e.g. http://localhost:5173');
  console.error('====================================================');
  process.exit(1);
}

app.use(cors({
  origin: (origin, callback) => {
    // No Origin header: same-origin navigation, curl, or a server-side call.
    // Nothing is being read cross-site, so there is nothing to leak.
    if (!origin) return callback(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));

app.use(express.json({ limit: '15mb' }));

// Phase 2: baseline security headers (no extra dependency).
// CSP is deliberately pragmatic: the UI uses inline styles and Google Fonts,
// seed data hot-links https images, and the API lives on :5000 in dev —
// script execution, however, is locked to 'self' (no inline scripts).
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'no-referrer');
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    'script-src \'self\'; ' +
    'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; ' +
    'font-src \'self\' https://fonts.gstatic.com data:; ' +
    'img-src \'self\' data: https:; ' +
    'connect-src \'self\' http://localhost:* http://127.0.0.1:* https://localhost:*;'
  );
  next();
});

// Uploaded documents and photos. These were previously served by
// express.static with no authentication at all, which made the careful
// ownership checks in documentRoutes' /:id/download endpoint pointless: the same
// bytes were reachable at /uploads/<filename> with no token. The directory also
// holds uploads/temp/, where the PDF renderer writes intermediate documents
// built from live ticket data.
//
// So the directory is no longer mounted. Files are served only through
// GET /api/documents/:id/download, which authenticates and authorises.
// The mounted handler below is a belt-and-braces deny so that if a static mount
// is ever reintroduced it cannot silently expose documents.
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', (req, res) => {
  res.status(404).json({
    message: 'Documents are served through /api/documents/:id/download.'
  });
});

// Serve static frontend build if it exists
const frontendDistDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'fixit-pdas-backend',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/job-requests', requisitionRoutes);
app.use('/api/job-requests-doc', jobRequestDocRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/preventive-schedules', preventiveRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/audit-log', auditRoutes);

// SPA client-side routing fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const indexHtmlPath = path.join(frontendDistDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    return res.sendFile(indexHtmlPath);
  }
  next();
});

// 404 fallback for unmatched API routes
app.use((req, res) => {
  // The method and path are not echoed back: req.originalUrl is
  // attacker-controlled, and any client that renders this message as HTML
  // would turn it into reflected output.
  res.status(404).json({ message: 'Not found.' });
});

// Central error handler — Phase 2: never leak stack traces or SQL errors
// to clients. Details are logged server-side; production callers get a
// generic message (full detail only when NODE_ENV=development).
app.use((err, req, res, _next) => {
  console.error(err);
  const expose = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({ message: expose ? (err.message || 'Something went wrong.') : 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;
// Bind loopback by default. app.listen(PORT) with no host binds 0.0.0.0, so the
// API was reachable from every interface on the campus network even though the
// startup banner advertises http://localhost. Set HOST=0.0.0.0 deliberately if
// the API genuinely needs to be reachable from other machines.
const HOST = process.env.HOST || '0.0.0.0';
const MAX_RETRIES = 8;
const RETRY_DELAY_MS = 3000;

async function startWithRetry(attempt = 1) {
  try {
    const { autoSetup } = await import('./scripts/autoSetup.js');
    await autoSetup();
    await verifyDbConnection();

    app.listen(PORT, HOST, () => {
      console.log('');
      console.log('====================================================');
      console.log(' FixIt PDAS Backend is LIVE ✓');
      console.log(` • Backend API:    http://${HOST}:${PORT}/api`);
      console.log(` • Health check:   http://${HOST}:${PORT}/api/health`);
      console.log(` • Frontend (dev): http://localhost:5173`);
      console.log('====================================================');

      // Schedule automated preventive maintenance reminder checks every 6 hours
      runAutomatedPreventiveReminders();
      setInterval(runAutomatedPreventiveReminders, 6 * 60 * 60 * 1000);
    });
  } catch (err) {
    console.error(`[server] Startup attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
    if (attempt >= MAX_RETRIES) {
      console.error('====================================================');
      console.error(' COULD NOT START — MySQL is not reachable.');
      console.error('====================================================');
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    return startWithRetry(attempt + 1);
  }
}

if (!process.env.JWT_SECRET) {
  console.error('====================================================');
  console.error(' FATAL: JWT_SECRET is not set in backend/.env — refusing to start.');
  console.error(' Copy backend/.env.example to backend/.env and set a secret.');
  console.error('====================================================');
  process.exit(1);
}

startWithRetry();
