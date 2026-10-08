import { Router } from 'express';
import pool from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/lookups/campus-locations - any authenticated user
router.get('/campus-locations', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM campus_locations ORDER BY building, floor, room');
    res.json(rows);
  } catch (err) {
    console.error('GET /lookups/campus-locations error:', err);
    res.status(500).json({ message: 'Failed to fetch campus locations.' });
  }
});

// POST /api/lookups/campus-locations - admin only
router.post('/campus-locations', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { building, floor, room, description, qrCode } = req.body;
    if (!building) {
      return res.status(400).json({ message: 'building is required.' });
    }
    /* The tag is what the scanner matches on, and the database enforces
       uniqueness on it — so a duplicate is rejected here with a readable
       message instead of surfacing as an opaque ER_DUP_ENTRY 500. */
    const tag = typeof qrCode === 'string' ? qrCode.trim().slice(0, 64) : null;
    if (tag) {
      const [dupe] = await pool.query('SELECT id FROM campus_locations WHERE qr_code = ?', [tag]);
      if (dupe.length > 0) {
        return res.status(409).json({ message: `QR tag ${tag} is already registered to another location.` });
      }
    }
    const [result] = await pool.query(
      'INSERT INTO campus_locations (building, floor, room, description, qr_code) VALUES (?, ?, ?, ?, ?)',
      [building, floor || null, room || null, description || null, tag]
    );
    res.status(201).json({ message: 'Location added.', id: result.insertId });
  } catch (err) {
    console.error('POST /lookups/campus-locations error:', err);
    res.status(500).json({ message: 'Failed to add location.' });
  }
});

// PUT /api/lookups/campus-locations/:id - admin only
router.put('/campus-locations/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { building, floor, room, description, qrCode } = req.body;
    const tag = qrCode === undefined || qrCode === null ? null : String(qrCode).trim().slice(0, 64);
    if (tag) {
      const [dupe] = await pool.query(
        'SELECT id FROM campus_locations WHERE qr_code = ? AND id <> ?',
        [tag, req.params.id]
      );
      if (dupe.length > 0) {
        return res.status(409).json({ message: `QR tag ${tag} is already registered to another location.` });
      }
    }
    const [result] = await pool.query(
      `UPDATE campus_locations SET
         building = COALESCE(?, building),
         floor = COALESCE(?, floor),
         room = COALESCE(?, room),
         description = COALESCE(?, description),
         qr_code = COALESCE(?, qr_code)
       WHERE id = ?`,
      [building, floor, room, description, tag, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Location not found.' });
    }
    res.json({ message: 'Location updated.' });
  } catch (err) {
    console.error('PUT /lookups/campus-locations/:id error:', err);
    res.status(500).json({ message: 'Failed to update location.' });
  }
});

// DELETE /api/lookups/campus-locations/:id - admin only
router.delete('/campus-locations/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM campus_locations WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Location not found.' });
    }
    res.json({ message: 'Location removed.' });
  } catch (err) {
    console.error('DELETE /lookups/campus-locations/:id error:', err);
    res.status(500).json({ message: 'Failed to remove location.' });
  }
});

// GET /api/lookups/categories - static reference data used by the frontend
router.get('/categories', verifyToken, (req, res) => {
  res.json(['electrical', 'plumbing', 'carpentry', 'ict', 'janitorial', 'other']);
});

// GET /api/lookups/priorities
router.get('/priorities', verifyToken, (req, res) => {
  res.json(['low', 'medium', 'high', 'urgent']);
});

export default router;
