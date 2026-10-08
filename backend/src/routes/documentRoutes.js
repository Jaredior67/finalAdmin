import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { verifyToken } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Never reuse the client filename. The base is a CSPRNG value rather than
    // Date.now() + Math.random(): the old generator mixed a guessable timestamp
    // with a non-cryptographic PRNG, and the resulting names were the only
    // thing standing between an unauthenticated caller and a signed document.
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${req._validatedExt || ''}`);
  },
});

// Phase 2: allow-list by extension AND client MIME (never trust MIME alone —
// the extension gate is what keeps executables/scripts out of /uploads).
const ALLOWED_UPLOADS = {
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.png': ['image/png'],
  '.pdf': ['application/pdf'],
};
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = String(path.extname(file.originalname || '')).toLowerCase();
    const allowedMimes = ALLOWED_UPLOADS[ext];
    if (!allowedMimes || !allowedMimes.includes(String(file.mimetype || '').toLowerCase())) {
      const err = new Error('Only JPG, PNG, or PDF files are allowed.');
      err.status = 400;
      return cb(err);
    }
    req._validatedExt = ext;
    cb(null, true);
  },
});

const router = Router();
router.use(verifyToken);

/* Shared ownership check for a job request, used by every route below that is
   keyed on a jobRequestId. Admins (and campus admins) may touch any ticket;
   everyone else only a ticket they submitted or one assigned to them — without
   this, any authenticated account could read, download from, or attach a file
   to any other person's ticket by guessing its id.

   Returns 'ok', 'forbidden' or 'not_found' so each caller can translate that
   into its own status code and message without re-running the query. */
async function jobRequestAccess(user, jobRequestId) {
  if (['admin', 'campus_admin'].includes(user.role)) return 'ok';
  const [jr] = await pool.query(
    'SELECT requester_id, assigned_to FROM job_requests WHERE id = ?',
    [jobRequestId]
  );
  if (jr.length === 0) return 'not_found';
  return jr[0].requester_id === user.id || jr[0].assigned_to === user.id ? 'ok' : 'forbidden';
}

// POST /api/documents - upload a file, optionally tied to a job request
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded (field name must be "file").' });
    }
    const { jobRequestId } = req.body;

    // Attaching to a ticket is a write on someone else's record, so it needs
    // the same ownership rule as reading that ticket's documents. An upload
    // with no jobRequestId is an unattached file owned by the uploader and is
    // left alone.
    if (jobRequestId) {
      const access = await jobRequestAccess(req.user, jobRequestId);
      if (access === 'not_found') {
        return res.status(404).json({ message: 'Job request not found.' });
      }
      if (access === 'forbidden') {
        return res.status(403).json({ message: 'You do not have permission to attach files to this job request.' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO documents (job_request_id, uploaded_by, file_name, file_path, file_type, file_size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [jobRequestId || null, req.user.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size || null]
    );

    res.status(201).json({ message: 'File uploaded.', id: result.insertId, fileName: req.file.filename });
  } catch (err) {
    console.error('POST /documents error:', err);
    res.status(500).json({ message: 'Failed to upload file.' });
  }
});

// GET /api/documents/job-request/:jobRequestId
router.get('/job-request/:jobRequestId', async (req, res) => {
  try {
    // Ownership guard: admins see all; others must be the requester or the
    // technician assigned to that ticket (shared helper above).
    const access = await jobRequestAccess(req.user, req.params.jobRequestId);
    if (access === 'not_found') return res.status(404).json({ message: 'Job request not found.' });
    if (access === 'forbidden') return res.status(403).json({ message: 'You do not have permission to view these documents.' });
    const [rows] = await pool.query(
      'SELECT * FROM documents WHERE job_request_id = ? ORDER BY created_at DESC',
      [req.params.jobRequestId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /documents/job-request/:id error:', err);
    res.status(500).json({ message: 'Failed to fetch documents.' });
  }
});

// GET /api/documents/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    const doc = rows[0];
    if (!doc) {
      return res.status(404).json({ message: 'Document not found.' });
    }
    // Ownership: admins see all; otherwise the uploader, the requester,
    // or the assigned technician of the linked ticket (shared helper above).
    let allowed = doc.uploaded_by === req.user.id;
    if (!allowed && doc.job_request_id) {
      allowed = (await jobRequestAccess(req.user, doc.job_request_id)) === 'ok';
    }
    if (!allowed) {
      return res.status(403).json({ message: 'You do not have permission to download this document.' });
    }
    res.download(path.join(uploadDir, doc.file_path), doc.file_name);
  } catch (err) {
    console.error('GET /documents/:id/download error:', err);
    res.status(500).json({ message: 'Failed to download document.' });
  }
});

export default router;
