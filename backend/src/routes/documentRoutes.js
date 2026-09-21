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
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

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
      `INSERT INTO documents (job_request_id, uploaded_by, file_name, file_path, file_type)
       VALUES (?, ?, ?, ?, ?)`,
      [jobRequestId || null, req.user.id, req.file.originalname, req.file.filename, req.file.mimetype]
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
    res.download(path.join(uploadDir, doc.file_path), doc.file_name);
  } catch (err) {
    console.error('GET /documents/:id/download error:', err);
    res.status(500).json({ message: 'Failed to download document.' });
  }
});

export default router;
