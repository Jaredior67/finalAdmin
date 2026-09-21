import fs from 'fs';
import JSZip from 'jszip';

async function run() {
  const data = fs.readFileSync('c:/xampp/htdocs/capstoneSystem/backend/templates/job-request-master.docx');
  const zip = await JSZip.loadAsync(data);
  const docXml = await zip.file('word/document.xml').async('string');
  const tblMatch = docXml.match(/<w:tbl[\s\S]*?<\/w:tbl>/);
  const rows = tblMatch[0].match(/<w:tr[\s\S]*?<\/w:tr>/g);
  const row3 = rows[2];
  const cells = row3.match(/<w:tc[\s\S]*?<\/w:tc>/g);
  console.log('Row 3 Cell 2 full XML:');
  console.log(cells[1]);
}

run();
