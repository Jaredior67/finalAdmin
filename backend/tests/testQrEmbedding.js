import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { execSync } from 'child_process';

async function testQr() {
  const masterPath = 'c:/xampp/htdocs/capstoneSystem/backend/templates/job-request-master.docx';
  const outDocx = 'C:/Users/Ma_Dr/.gemini/antigravity-ide/brain/4eaae800-2f5a-4787-a1b8-116425185d2c/scratch/test_qr.docx';
  const outPdf = 'C:/Users/Ma_Dr/.gemini/antigravity-ide/brain/4eaae800-2f5a-4787-a1b8-116425185d2c/scratch/test_qr.pdf';

  const data = fs.readFileSync(masterPath);
  const zip = await JSZip.loadAsync(data);

  // Generate QR code PNG
  const qrPngBuffer = await QRCode.toBuffer('JR-2026-0001', {
    width: 150,
    margin: 1,
    errorCorrectionLevel: 'M'
  });

  // Save qr.png in word/media/
  zip.file('word/media/qr.png', qrPngBuffer);

  // Add relationship in word/_rels/document.xml.rels
  let rels = await zip.file('word/_rels/document.xml.rels').async('string');
  if (!rels.includes('Id="rIdQR"')) {
    rels = rels.replace('</Relationships>', '<Relationship Id="rIdQR" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qr.png"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', rels);
  }

  // Add QR code drawing in P3 (Office of Client) on the right side
  // 576000 EMUs = 0.6 inch (~1.5 cm)
  const qrDrawingXml = `
  <w:r>
    <w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="14"/><w:szCs w:val="14"/></w:rPr>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="576000" cy="576000"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="101" name="QRCode"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="102" name="qr.png"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdQR"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="576000" cy="576000"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>`;

  let docXml = await zip.file('word/document.xml').async('string');

  // Let's place it at the end of P3 (Office of Client)
  docXml = docXml.replace(/(<w:t xml:space="preserve">Office of Client:\s*<\/w:t>[\s\S]*?)(<\/w:p>)/, `$1${qrDrawingXml}$2`);

  zip.file('word/document.xml', docXml);

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(outDocx, buf);
  console.log('Saved test docx with QR:', outDocx);

  const psCmd = `powershell -ExecutionPolicy Bypass -File "c:\\xampp\\htdocs\\capstoneSystem\\backend\\src\\utils\\exportToPdf.ps1" -DocxPath "${outDocx}" -PdfPath "${outPdf}"`;
  execSync(psCmd, { stdio: 'inherit' });
  console.log('Exported PDF with QR:', outPdf);
}

testQr();
