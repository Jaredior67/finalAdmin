import { Router } from 'express';
import pool from '../config/db.js';
import { generateJobRequestDocx } from '../utils/docxJobRequestGenerator.js';
import { generateOfficialJobRequestPdf } from '../utils/pdfGenerator.js';

const router = Router();

// POST /api/job-requests-doc/generate-pdf
// Open to verified users (or with fallback for instant requisition generation)
router.post('/generate-pdf', async (req, res) => {
  try {
    const data = req.body || {};
    const { pdfBuffer, pdfFileName } = await generateOfficialJobRequestPdf(data);

    if (req.query.json === 'true') {
      return res.json({
        success: true,
        fileName: pdfFileName,
        pdfBase64: pdfBuffer.toString('base64')
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFileName}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('generate-pdf error:', err);
    res.status(500).json({ message: 'Failed to generate official PDF: ' + err.message });
  }
});

// POST /api/job-requests-doc/generate-docx
router.post('/generate-docx', async (req, res) => {
  try {
    const data = req.body || {};
    const { buffer, fileName } = await generateJobRequestDocx(data);

    if (req.query.json === 'true') {
      return res.json({
        success: true,
        fileName,
        docxBase64: buffer.toString('base64')
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    console.error('generate-docx error:', err);
    res.status(500).json({ message: 'Failed to generate official Word document: ' + err.message });
  }
});

// GET /api/job-requests-doc/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT jr.*, 
              CONCAT(req.first_name, ' ', req.last_name) AS requester_name,
              req.department AS requester_dept,
              cl.building, cl.floor, cl.room
       FROM job_requests jr
       LEFT JOIN users req ON req.id = jr.requester_id
       LEFT JOIN campus_locations cl ON cl.id = jr.location_id
       WHERE jr.id = ? OR jr.ticket_no = ?`,
      [req.params.id, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Job request not found.' });
    }

    const row = rows[0];

    // Map database record to document fields
    const docData = {
      trackingNumber: row.ticket_no,
      dateOfRequest: new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      nameOfClient: row.requester_name || 'Requester',
      officeOfClient: row.requester_dept || (row.building ? `${row.building} - ${row.room}` : 'ISAT U Campus'),
      immediateSupervisor: row.immediate_supervisor || '',
      description: row.description
    };

    // Category mapping
    const cat = (row.category || '').toLowerCase();
    if (cat === 'electrical') {
      docData.electrical = { selected: ['Repair'], description: row.description };
    } else if (cat === 'plumbing') {
      docData.waterSanitary = { selected: ['Repair'], description: row.description };
    } else if (cat === 'carpentry') {
      docData.physicalStructures = { selected: ['Rehabilitation/Repair'], description: row.description };
    } else {
      docData.physicalStructures = { selected: ['Other Services'], description: row.description };
    }

    const { pdfBuffer, pdfFileName } = await generateOfficialJobRequestPdf(docData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFileName}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('GET /:id/pdf error:', err);
    res.status(500).json({ message: 'Failed to fetch official PDF.' });
  }
});

export default router;
