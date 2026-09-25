import { Router } from 'express';
import multer from 'multer';
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
    // Phase 2: never reuse the client filename — rebuild from a random base
    // plus the validated allow-list extension only.
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
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

// POST /api/documents - upload a file, optionally tied to a job request
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded (field name must be "file").' });
    }
    const { jobRequestId } = req.body;

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
    // Ownership guard: admins see all; others must own the ticket.
    if (!['admin', 'campus_admin'].includes(req.user.role)) {
      const [jr] = await pool.query(
        'SELECT requester_id, assigned_to FROM job_requests WHERE id = ?',
        [req.params.jobRequestId]
      );
      if (jr.length === 0) return res.status(404).json({ message: 'Job request not found.' });
      const allowed = jr[0].requester_id === req.user.id || jr[0].assigned_to === req.user.id;
      if (!allowed) return res.status(403).json({ message: 'You do not have permission to view these documents.' });
    }
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
    // or the assigned technician of the linked ticket.
    if (!['admin', 'campus_admin'].includes(req.user.role)) {
      let allowed = doc.uploaded_by === req.user.id;
      if (!allowed && doc.job_request_id) {
        const [jr] = await pool.query('SELECT requester_id, assigned_to FROM job_requests WHERE id = ?', [doc.job_request_id]);
        allowed = jr.length > 0 && (jr[0].requester_id === req.user.id || jr[0].assigned_to === req.user.id);
      }
      if (!allowed) {
        return res.status(403).json({ message: 'You do not have permission to download this document.' });
      }
    }
    res.download(path.join(uploadDir, doc.file_path), doc.file_name);
  } catch (err) {
    console.error('GET /documents/:id/download error:', err);
    res.status(500).json({ message: 'Failed to download document.' });
  }
});

export default router;
