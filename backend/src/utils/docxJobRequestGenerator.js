import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'job-request-master.docx');

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate a filled copy of the official Job Request Form (QF-PDAS-DC-01)
 * from the master template, complete with an anchored QR code.
 *
 * @param {Object} data Client input data
 * @param {string} [templatePath] Optional path to master template
 * @returns {Promise<{ buffer: Buffer, fileName: string }>}
 */
export async function generateJobRequestDocx(data, templatePath = DEFAULT_TEMPLATE_PATH) {
  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  let numberingXml = await zip.file('word/numbering.xml').async('string');
  let docXml = await zip.file('word/document.xml').async('string');
  let relsXml = await zip.file('word/_rels/document.xml.rels').async('string');

  // 1. Generate & Embed QR Code uniquely associated with this tracking number
  const trackingNumberVal = data.trackingNumber || data.ticketNo || data.controlNo || data.id || 'JR-PENDING';
  const qrPayload = `FIXIT-REQ:${trackingNumberVal}`;

  const qrPngBuffer = await QRCode.toBuffer(qrPayload, {
    width: 140,
    margin: 1,
    errorCorrectionLevel: 'M'
  });

  zip.file('word/media/qr.png', qrPngBuffer);

  if (!relsXml.includes('Id="rIdQR"')) {
    relsXml = relsXml.replace(
      '</Relationships>',
      '<Relationship Id="rIdQR" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qr.png"/></Relationships>'
    );
    zip.file('word/_rels/document.xml.rels', relsXml);
  }

  // Floating anchor drawing for QR code (placed in whitespace at right of Office of Client line)
  // cx=504000, cy=504000 is approx 1.33cm x 1.33cm. wrapNone ensures zero page layout displacement.
  const qrAnchorDrawingXml = `
  <w:r>
    <w:drawing>
      <wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
        <wp:simplePos x="0" y="0"/>
        <wp:positionH relativeFrom="column">
          <wp:align>right</wp:align>
        </wp:positionH>
        <wp:positionV relativeFrom="paragraph">
          <wp:posOffset>-60000</wp:posOffset>
        </wp:positionV>
        <wp:extent cx="504000" cy="504000"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:wrapNone/>
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
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="504000" cy="504000"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:anchor>
    </w:drawing>
  </w:r>`;

  // Ensure checked bullet definition (abstractNumId="10" & numId="10") exists in numbering.xml
  // Wingdings font 0xF0FE is ballot box with checkmark ()
  if (!numberingXml.includes('w:abstractNumId="10"')) {
    const checkedAbstract = `
  <w:abstractNum w:abstractNumId="10" w15:restartNumberingAfterBreak="0">
    <w:nsid w:val="10101010"/>
    <w:multiLevelType w:val="multilevel"/>
    <w:tmpl w:val="10101010"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="&#xF0FE;"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Wingdings" w:hAnsi="Wingdings" w:hint="default"/></w:rPr>
    </w:lvl>
  </w:abstractNum>`;

    numberingXml = numberingXml.replace(
      '</w:numbering>',
      `${checkedAbstract}<w:num w:numId="10"><w:abstractNumId w:val="10"/></w:num></w:numbering>`
    );
    zip.file('word/numbering.xml', numberingXml);
  }

  // 2. Top Block Client Details
  const trackingNumber = escapeXml(trackingNumberVal !== 'JR-PENDING' ? trackingNumberVal : '');
  const dateOfRequest = data.dateOfRequest ? escapeXml(data.dateOfRequest) : '';
  const nameOfClient = data.nameOfClient ? escapeXml(data.nameOfClient) : '';
  const officeOfClient = data.officeOfClient ? escapeXml(data.officeOfClient) : '';
  const immediateSupervisor = data.immediateSupervisor ? escapeXml(data.immediateSupervisor) : '';

  // Paragraph 1: Tracking Number & Date of Request
  docXml = docXml.replace(
    /(<w:p [^>]*>[\s\S]*?<w:t[^>]*>Tracking Number:\s*<\/w:t>[\s\S]*?<\/w:p>)/,
    (pContent) => {
      let updated = pContent;
      if (trackingNumber) {
        updated = updated.replace(
          /(<w:t[^>]*>Tracking Number:\s*<\/w:t><\/w:r>)([\s\S]*?)(<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow"[^>]*\/><w:sz w:val="22"\/><\/w:rPr><w:tab\/><w:t xml:space="preserve">Date of Request:)/,
          `$1<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> ${trackingNumber} </w:t></w:r>$3`
        );
      }
      if (dateOfRequest) {
        updated = updated.replace(
          /(<w:t xml:space="preserve">Date of Request:\s*<\/w:t><\/w:r>)([\s\S]*?)(<\/w:p>)/,
          `$1<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> ${dateOfRequest} </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:tab/></w:r>$3`
        );
      }
      return updated;
    }
  );

  // Paragraph 2: Name of Client & Signature (signature left blank)
  docXml = docXml.replace(
    /(<w:p [^>]*>[\s\S]*?<w:t[^>]*>Name of Client:\s*<\/w:t>[\s\S]*?<\/w:p>)/,
    (pContent) => {
      let updated = pContent;
      if (nameOfClient) {
        updated = updated.replace(
          /(<w:t xml:space="preserve">Name of Client:\s*<\/w:t><\/w:r>)([\s\S]*?)(<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow"[^>]*\/><w:sz w:val="22"\/><\/w:rPr><w:t xml:space="preserve">Signature:\s*<\/w:t>)/,
          `$1<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:b/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> ${nameOfClient} </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:tab/></w:r>$3`
        );
      }
      return updated;
    }
  );

  // Paragraph 3: Office of Client + Anchored QR Code
  docXml = docXml.replace(
    /(<w:p [^>]*>[\s\S]*?<w:t[^>]*>Office of Client:\s*<\/w:t>[\s\S]*?)(<\/w:p>)/,
    (m, pBeforeEnd, pEnd) => {
      let updated = pBeforeEnd;
      if (officeOfClient) {
        updated = updated.replace(
          /(<w:t xml:space="preserve">Office of Client:\s*<\/w:t><\/w:r>)([\s\S]*)/,
          `$1<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> ${officeOfClient} </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:tab/></w:r>`
        );
      }
      return `${updated}${qrAnchorDrawingXml}${pEnd}`;
    }
  );

  // Paragraph 4: Immediate Supervisor & Signature (signature left blank)
  docXml = docXml.replace(
    /(<w:p [^>]*>[\s\S]*?<w:t[^>]*>Immediate Supervisor<\/w:t>[\s\S]*?<\/w:p>)/,
    (pContent) => {
      let updated = pContent;
      if (immediateSupervisor) {
        updated = updated.replace(
          /(<w:t xml:space="preserve">:\s*<\/w:t><\/w:r>)([\s\S]*?)(<w:r w:rsidRPr="00EF02EB"><w:rPr><w:rFonts w:ascii="Arial Narrow"[^>]*\/><w:sz w:val="22"\/><\/w:rPr><w:t>_______<\/w:t>)/,
          `$1<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> ${immediateSupervisor} </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr><w:tab/></w:r>`
        );
      }
      return updated;
    }
  );

  // 3. Scope of Works - 6 Sections in the main table
  const tblMatch = docXml.match(/<w:tbl[\s\S]*?<\/w:tbl>/);
  if (tblMatch) {
    let tblXml = tblMatch[0];

    // Helper to check bullet item strictly within a single paragraph
    const checkBulletInCell = (cellXml, label) => {
      return cellXml.replace(/<w:p [^>]*>[\s\S]*?<\/w:p>/g, (pXml) => {
        if (
          pXml.includes(`>${label}<`) ||
          pXml.includes(`>${label} <`) ||
          pXml.includes(`>${label}</w:t>`) ||
          pXml.includes(`>${label} </w:t>`)
        ) {
          return pXml.replace(/<w:numId w:val="[23]"\s*\/>/, '<w:numId w:val="10"/>');
        }
        return pXml;
      });
    };

    // Helper to inject "Other Services" text
    const setOtherServicesInCell = (cellXml, text) => {
      if (!text) return cellXml;
      const escaped = escapeXml(text);
      return cellXml.replace(
        /(<w:t xml:space="preserve">Other Services\s*<\/w:t><\/w:r>)([\s\S]*?)(<\/w:p>)/,
        `$1<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> ${escaped} </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:u w:val="single"/></w:rPr><w:tab/></w:r>$3`
      );
    };

    // Helper to inject "Description of Work" text
    const setDescriptionInCell = (cellXml, text) => {
      if (!text) return cellXml;
      const escaped = escapeXml(text);
      return cellXml.replace(
        /(<w:t xml:space="preserve">Description of Work:\s*<\/w:t><\/w:r>)([\s\S]*?)(<\/w:p>)/,
        `$1<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> ${escaped} </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:u w:val="single"/></w:rPr><w:tab/></w:r>$3`
      );
    };

    const rows = tblXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
    if (rows.length >= 7) {
      // Row 3: Cell 1 (DRAWING/DESIGN) & Cell 2 (PHYSICAL STRUCTURES)
      let row3 = rows[2];
      let row3Cells = row3.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];

      if (row3Cells.length >= 2) {
        // Cell 1: DRAWING/DESIGN
        let c1 = row3Cells[0];
        const dd = data.drawingDesign || {};
        const ddSelected = dd.selected || [];
        [
          'Floor Plans',
          'Detailed Drawings',
          'Perspective',
          'Specifications',
          'List of Materials',
          'Other Services'
        ].forEach((item) => {
          if (ddSelected.includes(item)) {
            c1 = checkBulletInCell(c1, item);
          }
        });
        if (dd.otherServicesText) {
          c1 = setOtherServicesInCell(c1, dd.otherServicesText);
        }
        if (dd.description) {
          c1 = setDescriptionInCell(c1, dd.description);
        }

        // Cell 2: PHYSICAL STRUCTURES
        let c2 = row3Cells[1];
        const ps = data.physicalStructures || {};
        const psSelected = ps.selected || [];
        ['New Structure', 'Rehabilitation/Repair', 'Renovation', 'Other Services'].forEach((item) => {
          if (psSelected.includes(item)) {
            c2 = checkBulletInCell(c2, item);
          }
        });
        if (psSelected.includes('Partial') || ps.renovationType === 'Partial') {
          c2 = c2.replace(
            /(<w:t xml:space="preserve">Partial\s*<\/w:t>)/,
            `<w:t xml:space="preserve">[&#x2713;] Partial </w:t>`
          );
        }
        if (psSelected.includes('Full') || ps.renovationType === 'Full') {
          c2 = c2.replace(
            /(<w:t xml:space="preserve">Full\s*<\/w:t>)/,
            `<w:t xml:space="preserve">[&#x2713;] Full </w:t>`
          );
        }
        if (ps.otherServicesText) {
          c2 = setOtherServicesInCell(c2, ps.otherServicesText);
        }
        if (ps.description) {
          c2 = setDescriptionInCell(c2, ps.description);
        }

        row3 = row3.replace(row3Cells[0], c1).replace(row3Cells[1], c2);
        tblXml = tblXml.replace(rows[2], row3);
      }

      // Row 5: Cell 1 (ELECTRICAL) & Cell 2 (MECHANICAL)
      let row5 = rows[4];
      let row5Cells = row5.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];

      if (row5Cells.length >= 2) {
        // Cell 1: ELECTRICAL
        let c1 = row5Cells[0];
        const el = data.electrical || {};
        const elSelected = el.selected || [];
        ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'].forEach((item) => {
          if (elSelected.includes(item)) {
            c1 = checkBulletInCell(c1, item);
          }
        });
        if (el.otherServicesText) {
          c1 = setOtherServicesInCell(c1, el.otherServicesText);
        }
        if (el.description) {
          c1 = setDescriptionInCell(c1, el.description);
        }

        // Cell 2: MECHANICAL
        let c2 = row5Cells[1];
        const mc = data.mechanical || {};
        const mcSelected = mc.selected || [];
        ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'].forEach((item) => {
          if (mcSelected.includes(item)) {
            c2 = checkBulletInCell(c2, item);
          }
        });
        if (mc.otherServicesText) {
          c2 = setOtherServicesInCell(c2, mc.otherServicesText);
        }
        if (mc.description) {
          c2 = setDescriptionInCell(c2, mc.description);
        }

        row5 = row5.replace(row5Cells[0], c1).replace(row5Cells[1], c2);
        tblXml = tblXml.replace(rows[4], row5);
      }

      // Row 7: Cell 1 (WATER/SANITARY) & Cell 2 (AIR CONDITIONING)
      let row7 = rows[6];
      let row7Cells = row7.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];

      if (row7Cells.length >= 2) {
        // Cell 1: WATER/SANITARY
        let c1 = row7Cells[0];
        const ws = data.waterSanitary || {};
        const wsSelected = ws.selected || [];
        ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'].forEach((item) => {
          if (wsSelected.includes(item)) {
            c1 = checkBulletInCell(c1, item);
          }
        });
        if (ws.otherServicesText) {
          c1 = setOtherServicesInCell(c1, ws.otherServicesText);
        }
        if (ws.description) {
          c1 = setDescriptionInCell(c1, ws.description);
        }

        // Cell 2: AIR CONDITIONING
        let c2 = row7Cells[1];
        const ac = data.airConditioning || {};
        const acSelected = ac.selected || [];
        ['New Installation', 'Repair', 'Rehabilitation', 'Other Services'].forEach((item) => {
          if (acSelected.includes(item)) {
            c2 = checkBulletInCell(c2, item);
          }
        });
        if (ac.otherServicesText) {
          c2 = setOtherServicesInCell(c2, ac.otherServicesText);
        }
        if (ac.description) {
          c2 = setDescriptionInCell(c2, ac.description);
        }

        row7 = row7.replace(row7Cells[0], c1).replace(row7Cells[1], c2);
        tblXml = tblXml.replace(rows[6], row7);
      }
    }

    docXml = docXml.replace(tblMatch[0], tblXml);
  }

  zip.file('word/document.xml', docXml);

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const safeClient = (data.nameOfClient || 'Client')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  const dateStr = data.dateOfRequest
    ? data.dateOfRequest.replace(/[^a-zA-Z0-9_-]/g, '_')
    : new Date().toISOString().split('T')[0];
  const fileName = `JobRequest_${safeClient}_${dateStr}.docx`;

  return { buffer, fileName };
}
