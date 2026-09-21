import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { execSync } from 'child_process';

async function testBulletCheck() {
  const masterPath = 'c:/xampp/htdocs/capstoneSystem/backend/templates/job-request-master.docx';
  const outDocx = 'C:/Users/Ma_Dr/.gemini/antigravity-ide/brain/4eaae800-2f5a-4787-a1b8-116425185d2c/scratch/test_checked.docx';
  const outPdf = 'C:/Users/Ma_Dr/.gemini/antigravity-ide/brain/4eaae800-2f5a-4787-a1b8-116425185d2c/scratch/test_checked.pdf';

  const data = fs.readFileSync(masterPath);
  const zip = await JSZip.loadAsync(data);
  let numberingXml = await zip.file('word/numbering.xml').async('string');
  let docXml = await zip.file('word/document.xml').async('string');

  // Add checked abstractNumId="10" and numId="10" in numbering.xml
  // Symbol font F07F is empty box. Wingdings F0FE is box with checkmark ()
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

  // Insert before </w:numbering>
  numberingXml = numberingXml.replace('</w:numbering>', `${checkedAbstract}<w:num w:numId="10"><w:abstractNumId w:val="10"/></w:num></w:numbering>`);

  // Let's change "Floor Plans" in docXml to use numId="10" instead of numId="2"
  // Find <w:p containing Floor Plans
  docXml = docXml.replace(
    /(<w:numPr><w:ilvl w:val="0"\s*\/><w:numId w:val="[23]"\s*\/><\/w:numPr>[\s\S]*?<w:t>Floor Plans<\/w:t>)/,
    (m) => m.replace(/w:numId w:val="[23]"/, 'w:numId w:val="10"')
  );

  zip.file('word/numbering.xml', numberingXml);
  zip.file('word/document.xml', docXml);

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(outDocx, buf);
  console.log('Saved test docx:', outDocx);
}

testBulletCheck();
