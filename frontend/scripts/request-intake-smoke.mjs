/* Consistency test for the request-intake flow.
   The requirement: "New Request" must behave identically for every account,
   and each role gets the entry pair once — on that role's dashboard. The
   Faculty portal carries three more page titles (Job Request, Active Tickets,
   Request History) and used to repeat the same two buttons under each one, so
   the pair now lives on the Dashboard alone. These checks fail if a page grows
   a private intake path again, or if the pair comes back anywhere it does not
   belong.

   Run: node scripts/request-intake-smoke.mjs                                   */
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..', 'src');
const mocks = path.resolve(here, '__mocks__');
const read = (...p) => fs.readFileSync(path.join(src, ...p), 'utf8');

const server = await createServer({
  configFile: path.resolve(here, '..', 'vite.config.js'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  resolve: {
    alias: [
      { find: /^.*[\\/]context[\\/]AuthContext$/, replacement: path.join(mocks, 'authContext.jsx') },
      { find: /^.*[\\/]context[\\/]DataContext$/, replacement: path.join(mocks, 'dataContext.jsx') }
    ]
  }
});

const facultySrc = read('views', 'FacultyStaffPortal.jsx');
const facultyDashSrc = read('views', 'faculty', 'FacultyStaffDashboard.jsx');
const adminSrc = read('views', 'admin', 'ExecutiveDashboard.jsx');
const approverSrc = read('views', 'campusAdmin', 'CampusAdminDashboard.jsx');
const intakeSrc = read('components', 'common', 'RequestIntake.jsx');
const utilSrc = read('utils', 'jobRequestIntake.js');

const { configureAuth } = await server.ssrLoadModule('/scripts/__mocks__/authContext.jsx');
const { configureData } = await server.ssrLoadModule('/scripts/__mocks__/dataContext.jsx');

configureData({
  requisitions: [],
  addRequisition: () => ({ id: 'REQ-1', controlNo: null, requestType: 'Standard Request' }),
  campusLocations: [{ building: 'CEA', floor: '2nd Floor', room: 'CEA 204' }],
  offices: ['PDAS Office'],
  ticketSearch: '',
  setFocusedTicketRef: () => {},
  focusedTicketRef: null,
  calendarEvents: []
});

let failures = 0;
const check = async (label, fn) => {
  try {
    await fn();
    console.log(`  ok   ${label}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL ${label}\n       ${err.message}`);
  }
};

console.log('\nboth roles use the same intake module');
await check('the shared module exists and owns the flow', async () => {
  for (const fn of ['useRequestIntake', 'RequestIntakeActions', 'RequestIntakePanel', 'RequestIntake']) {
    if (!new RegExp(`export (const|function) ${fn}\\b`).test(intakeSrc)) {
      throw new Error(`${fn} is not exported from RequestIntake.jsx`);
    }
  }
});
await check('the Faculty portal mounts the shared flow without a second entry pair', async () => {
  if (!/useRequestIntake/.test(facultySrc)) throw new Error('useRequestIntake is not used');
  if (!/<RequestIntake intake=\{intake\}/.test(facultySrc)) {
    throw new Error('the dialogs host is not mounted');
  }
  if (!/<RequestIntakePanel/.test(facultySrc)) throw new Error('the panel is not used');
  // The entry pair belongs to the Dashboard alone. The portal renders the same
  // two buttons under every one of its page titles.
  if (/<RequestIntakeActions/.test(facultySrc)) {
    throw new Error('the portal repeats the Scan QR / New Request pair');
  }
});
await check('the Faculty dashboard imports and mounts the shared flow', async () => {
  if (!/useRequestIntake/.test(facultyDashSrc)) throw new Error('useRequestIntake is not used');
  if (!/<RequestIntake intake=\{intake\}/.test(facultyDashSrc)) {
    throw new Error('the dialogs host is not mounted');
  }
  if (!/<RequestIntakeActions intake=\{intake\}/.test(facultyDashSrc)) {
    throw new Error('the header entry buttons are not the shared ones');
  }
  // "New Request" must open the chooser in place, not walk the filer through
  // the job-request module first.
  if (/onNavigate\('faculty-submit'\)/.test(facultyDashSrc)) {
    throw new Error('the dashboard still routes to the job-request module');
  }
});
await check('the Admin dashboard imports and mounts the shared flow', async () => {
  if (!/useRequestIntake/.test(adminSrc)) throw new Error('useRequestIntake is not used');
  if (!/<RequestIntake intake=\{intake\}/.test(adminSrc)) {
    throw new Error('the dialogs host is not mounted');
  }
  if (!/<RequestIntakeActions intake=\{intake\}/.test(adminSrc)) {
    throw new Error('the header entry buttons are not the shared ones');
  }
  if (!/<RequestIntakePanel/.test(adminSrc)) throw new Error('the panel is not used');
});
await check('the Approver dashboard imports and mounts the shared flow', async () => {
  if (!/useRequestIntake/.test(approverSrc)) throw new Error('useRequestIntake is not used');
  if (!/<RequestIntake intake=\{intake\}/.test(approverSrc)) {
    throw new Error('the dialogs host is not mounted');
  }
  if (!/<RequestIntakeActions intake=\{intake\}/.test(approverSrc)) {
    throw new Error('the header entry buttons are not the shared ones');
  }
  if (!/<RequestIntakePanel/.test(approverSrc)) throw new Error('the panel is not used');
});

console.log('\nneither role keeps a private intake path');
await check('no hand-rolled request form survives on either dashboard', async () => {
  for (const [name, text] of [
    ['FacultyStaffPortal', facultySrc],
    ['ExecutiveDashboard', adminSrc],
    ['CampusAdminDashboard', approverSrc]
  ]) {
    for (const dead of [
      'File New Facility Request',
      'handleCreateRequisition',
      'createFromOverlay',
      'overlayDraft',
      'buildScopeOfWorks('
    ]) {
      // A call to the shared util is fine; a local definition is not.
      if (new RegExp(`(const|function)\\s+${dead.replace(/[()]/g, '\\$&')}`).test(text)) {
        throw new Error(`${name} still defines its own ${dead}`);
      }
    }
  }
});
await check('the Admin no longer builds a record by hand', async () => {
  if (/addRequisition\(\{/.test(adminSrc)) {
    throw new Error('ExecutiveDashboard still calls addRequisition directly');
  }
  if (/addRequisition\(\{/.test(facultySrc)) {
    throw new Error('FacultyStaffPortal still calls addRequisition directly');
  }
  if (/addRequisition\(\{/.test(approverSrc)) {
    throw new Error('CampusAdminDashboard still calls addRequisition directly');
  }
});
await check('neither role keeps a standalone QR scanner mount', async () => {
  for (const [name, text] of [['FacultyStaffPortal', facultySrc], ['ExecutiveDashboard', adminSrc]]) {
    if (/<QrCodeScannerModal/.test(text)) {
      throw new Error(`${name} mounts its own scanner â€” the location step owns it`);
    }
  }
});

console.log('\nthe entry pair is identical wherever it appears');
await check('every dashboard shows the same two buttons, in the same order', async () => {
  const cases = {
    facultyDashboard: {
      user: { name: 'Elena Ramos', email: 'faculty@isatu.edu.ph', role: 'faculty', department: 'CEA' },
      file: '/src/views/faculty/FacultyStaffDashboard.jsx',
      comp: 'FacultyStaffDashboard',
      props: { onNavigate: () => {} }
    },
    admin: {
      user: { name: 'Rina Santos', email: 'admin@isatu.edu.ph', role: 'admin', department: 'PDAS' },
      file: '/src/views/admin/ExecutiveDashboard.jsx',
      comp: 'ExecutiveDashboard',
      props: { onNavigate: () => {} }
    },
    approver: {
      user: {
        name: 'Ramil Lumauag',
        email: 'campusadmin@isatu.edu.ph',
        role: 'campus_admin',
        department: 'Office of the Campus Administrator'
      },
      file: '/src/views/campusAdmin/CampusAdminDashboard.jsx',
      comp: 'CampusAdminDashboard',
      props: {}
    }
  };
  for (const [role, spec] of Object.entries(cases)) {
    configureAuth({ currentUser: spec.user });
    const mod = await server.ssrLoadModule(spec.file);
    const Comp = mod[spec.comp];
    const html = renderToStaticMarkup(React.createElement(Comp, spec.props));

    // Strip the icon SVGs so the label sits flush against the element edges,
    // then anchor each match to its own button.
    const text = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
    const btnWith = (label) =>
      new RegExp(`<button[^>]*>\\s*${label}\\s*</button>`).test(text);

    // The pair, in this order. "New Request" opens the chooser overlay in
    // place; "Scan QR" opens the standard form already scanning.
    const scanAt = text.search(/<button[^>]*>\s*Scan QR\s*<\/button>/);
    const newAt = text.search(/<button[^>]*>\s*New Request\s*<\/button>/);

    if (scanAt === -1) throw new Error(`${role} is missing the Scan QR button`);
    if (newAt === -1) throw new Error(`${role} is missing the New Request button`);
    if (scanAt > newAt) {
      throw new Error(`${role} shows New Request before Scan QR; the order must match`);
    }

    // The two request types live inside the chooser, which is closed while the
    // page renders, so neither may survive as a header button. The launcher
    // cards carry the same words but nest them in divs, so a button whose only
    // content is the label is the thing that must be gone.
    for (const stale of ['Standard Request', 'Report Urgent Issue']) {
      if (btnWith(stale)) {
        throw new Error(`${role} still has a "${stale}" header button; use the chooser`);
      }
    }
  }
});

await check('the Faculty portal renders neither entry button', async () => {
  // The pair is asserted absent at render time too, not just in the source:
  // the portal's own launcher cards carry similar wording and must not be
  // mistaken for it.
  configureAuth({
    currentUser: { name: 'Elena Ramos', email: 'faculty@isatu.edu.ph', role: 'faculty', department: 'CEA' }
  });
  const mod = await server.ssrLoadModule('/src/views/FacultyStaffPortal.jsx');
  const html = renderToStaticMarkup(
    React.createElement(mod.FacultyStaffPortal, {
      activeTab: 'faculty-submit',
      onTabChange: () => {}
    })
  );
  const text = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  for (const label of ['Scan QR', 'New Request']) {
    if (new RegExp(`<button[^>]*>\\s*${label}\\s*</button>`).test(text)) {
      throw new Error(`the portal still renders a "${label}" button`);
    }
  }
});

console.log('\nNew Request opens an overlay, never a route');
await check('"New Request" opens the chooser overlay rather than a route', async () => {
  if (!/isOpen=\{intake\.isChooserOpen\}/.test(intakeSrc)) {
    throw new Error('RequestIntake does not mount the chooser overlay');
  }
  if (!/onClick=\{intake\.openChooser\}/.test(intakeSrc)) {
    throw new Error('the New Request button does not open the chooser');
  }
  if (!/onClick=\{intake\.requestScan\}/.test(intakeSrc)) {
    throw new Error('the Scan QR button does not park a scan intent');
  }
  // Choosing a type must swap this overlay for that form, not stack them.
  if (!/setIsChooserOpen\(false\)/.test(intakeSrc)) {
    throw new Error('opening a form does not close the chooser');
  }
});

console.log('\nthe record shape is defined once');
await check('one category list, and it includes Safety & Compliance', async () => {
  if (!/Safety & Compliance/.test(utilSrc)) {
    throw new Error('Safety & Compliance is missing from the shared list');
  }
  // The list is DEFINED once. Importing it elsewhere is the whole point.
  for (const [name, text] of [
    ['RequestIntake', intakeSrc],
    ['FacultyStaffPortal', facultySrc],
    ['ExecutiveDashboard', adminSrc]
  ]) {
    if (/(const|let|var)\s+CATEGORY_OPTIONS\s*=/.test(text)) {
      throw new Error(`${name} declares its own CATEGORY_OPTIONS; import the shared one`);
    }
  }
  // Anything that can be filed must also be filterable.
  if (!/CATEGORY_OPTIONS/.test(facultySrc)) {
    throw new Error('the ticket filter no longer uses the shared category list');
  }
});
await check('a category with no trade section is not silently filed as Electrical', async () => {
  // Pre-ticking ELECTRICAL on a Safety & Compliance request is a false
  // statement on the official form.
  if (/CATEGORY_SCOPE_KEY\[category\]\s*\|\|\s*'electrical'/.test(utilSrc)) {
    throw new Error('buildScopeOfWorks still falls back to electrical');
  }
  const { buildScopeOfWorks, CATEGORY_OPTIONS } = await import(
    pathToFileURL(path.join(src, 'utils', 'jobRequestIntake.js')).href
  );
  for (const cat of CATEGORY_OPTIONS) {
    const scope = buildScopeOfWorks(cat, 'x');
    const ticked = Object.values(scope).filter((v) => v.options.length || v.description);
    if (cat === 'Safety & Compliance') {
      if (ticked.length) throw new Error('Safety & Compliance ticked a trade section');
    } else if (ticked.length !== 1) {
      throw new Error(`${cat} ticked ${ticked.length} sections, expected 1`);
    }
  }
});
await check('the shared builder never overrides DataContext-derived fields', async () => {
  // urgentPendingStandardForm is derived inside addRequisition; passing it
  // explicitly used to suppress the "complete the standard form" reminder for
  // admin-filed urgent requests. Comments are stripped so the doc block that
  // explains the rule does not count as a violation.
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (/urgentPendingStandardForm\s*:/.test(stripComments(utilSrc))) {
    throw new Error('the payload builder sets urgentPendingStandardForm');
  }
  if (/urgentPendingStandardForm:\s*false/.test(stripComments(adminSrc))) {
    throw new Error('ExecutiveDashboard still forces urgentPendingStandardForm: false');
  }
});
await check('both entry paths produce the same payload shape', async () => {
  // Standard and urgent must both go through buildRequisitionPayload, or the
  // record drifts again.
  const calls = (intakeSrc.match(/buildRequisitionPayload\(/g) || []).length;
  if (calls < 2) {
    throw new Error(`buildRequisitionPayload is called ${calls}x â€” urgent and standard must both use it`);
  }
  if (!/submitUrgent[\s\S]*buildRequisitionPayload/.test(intakeSrc)) {
    throw new Error('the urgent path does not use the shared payload builder');
  }
});

await server.close();
console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures} failing check${failures === 1 ? '' : 's'})`}\n`);
process.exit(failures === 0 ? 0 : 1);


