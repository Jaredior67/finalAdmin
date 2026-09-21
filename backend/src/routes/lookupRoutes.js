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
    const { building, floor, room, description } = req.body;
    if (!building) {
      return res.status(400).json({ message: 'building is required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO campus_locations (building, floor, room, description) VALUES (?, ?, ?, ?)',
      [building, floor || null, room || null, description || null]
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
    const { building, floor, room, description } = req.body;
    const [result] = await pool.query(
      `UPDATE campus_locations SET
         building = COALESCE(?, building),
         floor = COALESCE(?, floor),
         room = COALESCE(?, room),
         description = COALESCE(?, description)
       WHERE id = ?`,
      [building, floor, room, description, req.params.id]
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
