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
import jobRequestDocRoutes from './routes/jobRequestDocRoutes.js';
import preventiveRoutes, { runAutomatedPreventiveReminders } from './routes/preventiveRoutes.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (configuredOrigins.length === 0 || configuredOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));

app.use(express.json({ limit: '15mb' }));

// Serve static uploaded documents and photos
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

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
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
});

// Central error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;
const MAX_RETRIES = 8;
const RETRY_DELAY_MS = 3000;

async function startWithRetry(attempt = 1) {
  try {
    const { autoSetup } = await import('./scripts/autoSetup.js');
    await autoSetup();
    await verifyDbConnection();

    app.listen(PORT, () => {
      console.log('');
      console.log('====================================================');
      console.log(' FixIt PDAS Backend is LIVE ✓');
      console.log(` • Backend API:    http://localhost:${PORT}/api`);
      console.log(` • Health check:   http://localhost:${PORT}/api/health`);
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

startWithRetry();
