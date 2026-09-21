import fs from 'fs';
import path from 'path';
import { generateJobRequestDocx } from './docxJobRequestGenerator.js';
import { execSync } from 'child_process';

async function run() {
  const sampleData = {
    trackingNumber: '',
    dateOfRequest: 'February 18, 2025',
    nameOfClient: 'Engr. Juan Dela Cruz',
    officeOfClient: 'College of Engineering & Architecture (CEA)',
    immediateSupervisor: 'Dr. Maria Santos',
    drawingDesign: {
      selected: ['Floor Plans', 'Detailed Drawings', 'Specifications'],
      otherServicesText: '',
      description: 'Need complete architectural revisions for CEA 201 Drafting Hall.'
    },
    physicalStructures: {
      selected: ['Renovation'],
      renovationType: 'Partial',
      otherServicesText: '',
      description: 'Partial wall renovation and repainting of interior partitions.'
    },
    electrical: {
      selected: ['Repair'],
      otherServicesText: '',
      description: 'Replace flickering fluorescent fixtures with 18W LED tubes.'
    },
    mechanical: {
      selected: [],
      otherServicesText: '',
      description: ''
    },
    waterSanitary: {
      selected: ['Repair'],
      otherServicesText: '',
      description: 'Fix leaking faucet in CEA East Wing Restroom.'
    },
    airConditioning: {
      selected: ['Repair'],
      otherServicesText: '',
      description: 'Routine cleaning and check refrigerant level of 2HP split unit.'
    }
  };

  const { buffer, fileName } = await generateJobRequestDocx(sampleData);
  const outDocx = `C:/Users/Ma_Dr/.gemini/antigravity-ide/brain/4eaae800-2f5a-4787-a1b8-116425185d2c/scratch/${fileName}`;
  const outPdf = outDocx.replace('.docx', '.pdf');

  fs.writeFileSync(outDocx, buffer);
  console.log('Generated Docx:', outDocx);

  // Convert to PDF using Word COM
  const psCmd = `powershell -ExecutionPolicy Bypass -File "c:\\xampp\\htdocs\\capstoneSystem\\backend\\src\\utils\\exportToPdf.ps1" -DocxPath "${outDocx}" -PdfPath "${outPdf}"`;
  execSync(psCmd, { stdio: 'inherit' });
  console.log('Generated PDF:', outPdf);
}

run();
