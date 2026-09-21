import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateJobRequestDocx } from './docxJobRequestGenerator.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
fs.mkdirSync(tempDir, { recursive: true });

/**
 * Generate official PDF with embedded QR code from the master template
 * using Microsoft Word native PDF engine.
 *
 * @param {Object} data Client request data
 * @returns {Promise<{ pdfBuffer: Buffer, docxBuffer: Buffer, pdfFileName: string, docxFileName: string }>}
 */
export async function generateOfficialJobRequestPdf(data) {
  const { buffer: docxBuffer, fileName: docxFileName } = await generateJobRequestDocx(data);
  const pdfFileName = docxFileName.replace(/\.docx$/, '.pdf');

  const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const tempDocxPath = path.join(tempDir, `${uniqueId}_${docxFileName}`);
  const tempPdfPath = path.join(tempDir, `${uniqueId}_${pdfFileName}`);

  fs.writeFileSync(tempDocxPath, docxBuffer);

  const psScriptPath = path.join(__dirname, 'exportToPdf.ps1');
  const psCmd = `powershell -ExecutionPolicy Bypass -File "${psScriptPath}" -DocxPath "${tempDocxPath}" -PdfPath "${tempPdfPath}"`;

  try {
    await execAsync(psCmd, { timeout: 30000 });

    if (!fs.existsSync(tempPdfPath)) {
      throw new Error('PDF file was not created by Word export.');
    }

    const pdfBuffer = fs.readFileSync(tempPdfPath);

    // Clean up temporary files asynchronously
    setTimeout(() => {
      try {
        if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
        if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
      } catch {
        // Ignore async cleanup error
      }
    }, 2000);

    return {
      pdfBuffer,
      docxBuffer,
      pdfFileName,
      docxFileName
    };
  } catch (err) {
    // If Word COM times out or fails, clean up temp files
    try {
      if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath);
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
    } catch {
      // Ignore cleanup error
    }
    console.warn(`[PDF Generator] Word COM PDF export unavailable (${err.message}). Word or PowerShell may not be installed in this environment.`);
    throw new Error(`PDF generation unavailable: ${err.message}. Please use the Word (.docx) download option.`);
  }
}
