/* Render smoke test for the Faculty & Staff ticket tabs.
   Guards the requirement that My Open Tickets and Request History expose the
   SAME filter control set, in the same order, with Export CSV inline in the
   filter row (not stacked above it).

   Run: node scripts/faculty-smoke.mjs                                        */
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..', 'src');
const mocks = path.resolve(here, '__mocks__');

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

const ticket = (over) => ({
  requestType: 'Standard Request',
  scopeOfWorks: {},
  actionTaken: {},
  finalAction: {},
  timeline: [],
  isArchived: false,
  ...over
});

const tickets = [
  ticket({
    id: 'T-1',
    controlNo: 'TRK-2026-0001',
    title: 'Aircon not cooling',
    description: 'Blows warm air.',
    location: 'CEA 204',
    category: 'Air Conditioning',
    urgency: 'High Risk',
    status: 'Ongoing',
    requestedBy: 'Elena Ramos',
    requesterEmail: 'faculty@isatu.edu.ph',
    department: 'CEA',
    assignedTo: 'Mark Villanueva',
    date: '2026-09-20'
  }),
  ticket({
    id: 'T-2',
    controlNo: 'TRK-2026-0002',
    title: 'Flickering lights',
    description: 'Panel B trips.',
    location: 'Gymnasium',
    category: 'Electrical',
    urgency: 'Medium Risk',
    status: 'Completed',
    requestedBy: 'Elena Ramos',
    requesterEmail: 'faculty@isatu.edu.ph',
    department: 'CEA',
    assignedTo: 'Rina Santos',
    date: '2026-09-11'
  }),
  ticket({
    id: 'T-3',
    controlNo: 'TRK-2026-0003',
    title: 'Burnt motor coil',
    description: 'Coil burnt out.',
    location: 'Library Basement',
    category: 'Mechanical',
    urgency: 'Low Risk',
    status: 'Rejected',
    requestedBy: 'Elena Ramos',
    requesterEmail: 'faculty@isatu.edu.ph',
    department: 'CEA',
    date: '2026-09-05'
  })
];

const { configureAuth } = await server.ssrLoadModule('/scripts/__mocks__/authContext.jsx');
const { configureData } = await server.ssrLoadModule('/scripts/__mocks__/dataContext.jsx');

configureAuth({
  currentUser: {
    name: 'Elena Ramos',
    email: 'faculty@isatu.edu.ph',
    department: 'College of Engineering',
    role: 'faculty'
  }
});

configureData({
  requisitions: tickets,
  addRequisition: () => ({}),
  completeStandardFormForUrgent: () => {},
  messages: [],
  sendMessage: () => {},
  evaluations: [],
  submitEvaluation: () => {},
  campusLocations: [
    { building: 'CEA', floor: '2nd Floor', room: 'CEA 204' }
  ],
  offices: ['Office of the Campus Administrator'],
  ticketSearch: '',
  focusedTicketRef: null,
  setFocusedTicketRef: () => {}
});

const { FacultyStaffPortal } = await server.ssrLoadModule('/src/views/FacultyStaffPortal.jsx');

const render = (activeTab) =>
  renderToStaticMarkup(
    React.createElement(FacultyStaffPortal, { activeTab, onTabChange: () => {} })
  );

let failures = 0;
const check = (label, fn) => {
  try {
    fn();
    console.log(`  ok   ${label}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL ${label}\n       ${err.message}`);
  }
};

const active = render('faculty-tickets');
const history = render('faculty-history');

console.log('\nboth tabs render the same three filters');
check('category, risk and status selects on both tabs', () => {
  for (const [name, html] of [['My Open Tickets', active], ['Request History', history]]) {
    for (const id of ['All Categories', 'All Risk Levels']) {
      if (!html.includes(id)) throw new Error(`${name} is missing "${id}"`);
    }
    if (!/aria-label="Filter by status"/.test(html)) {
      throw new Error(`${name} is missing the status filter`);
    }
    if (!html.includes('class="ticket-filter-bar"')) {
      throw new Error(`${name} is not using the shared filter bar`);
    }
  }
});

check('identical status options on both tabs', () => {
  const grab = (html) => {
    const m = html.match(/aria-label="Filter by status"[\s\S]*?<\/select>/);
    return [...(m ? m[0].matchAll(/<option[^>]*value="([^"]+)"/g) : [])].map((x) => x[1]);
  };
  const a = grab(active);
  const h = grab(history);
  if (a.length === 0) throw new Error('no status options parsed from My Open Tickets');
  if (a.join(',') !== h.join(',')) {
    throw new Error(`status options differ:\n    open   : ${a.join(',')}\n    history: ${h.join(',')}`);
  }
  // Completed/Rejected must be selectable on both tabs.
  for (const v of ['completed', 'rejected']) {
    if (!a.includes(v)) throw new Error(`status option "${v}" missing`);
  }
});

console.log('\nExport CSV sits inline in the filter row');
check('export button is inside the filter bar, not stacked above it', () => {
  if (!/class="ticket-filter-bar"[\s\S]*?Export CSV[\s\S]*?<\/div>/.test(history)) {
    throw new Error('Export CSV is not inside the filter bar on Request History');
  }
  if (/display:\s*'flex',\s*justifyContent:\s*'flex-end'[^}]*Export/.test(history)) {
    throw new Error('Export CSV is still in its own right-aligned row');
  }
  // It must come after the status filter, not before the filters.
  const bar = history.match(/class="ticket-filter-bar"[\s\S]*?<\/select>\s*<div class="ticket-filter-bar__actions"/);
  if (!bar) throw new Error('Export is not in the actions slot after the filters');
});
check('My Open Tickets has no stray export button', () => {
  if (active.includes('Export CSV')) throw new Error('Export CSV leaked onto My Open Tickets');
});

console.log('\nrecord counts reflect the filtered set');
check('history counts only closed records', () => {
  if (!/2 records/.test(history)) throw new Error('expected "2 records" (2 closed tickets)');
  if (!/1 open/.test(active)) throw new Error('expected "1 open" (1 ongoing ticket)');
});
check('CSV export button carries a disabled guard for empty results', () => {
  // With rows present the button is enabled; the guard is the `disabled`
  // prop, asserted structurally on the source rather than the markup.
  const portalSrc = fs.readFileSync(
    path.join(src, 'views', 'FacultyStaffPortal.jsx'),
    'utf8'
  );
  if (!/disabled=\{filteredHistoryTickets\.length === 0\}/.test(portalSrc)) {
    throw new Error('export button is not disabled when the filtered set is empty');
  }
  if (!/if \(filteredHistoryTickets\.length === 0\) return;/.test(portalSrc)) {
    throw new Error('handleExportCSV has no empty-set early return');
  }
});

console.log('\ntables populate from the right source set');
check('open tickets table lists the ongoing ticket only', () => {
  if (!active.includes('Aircon not cooling')) throw new Error('ongoing ticket missing');
  if (active.includes('Burnt motor coil')) throw new Error('rejected ticket leaked into open table');
  if (active.includes('Flickering lights')) throw new Error('completed ticket leaked into open table');
});
check('history table lists closed tickets only', () => {
  if (!history.includes('Flickering lights')) throw new Error('completed ticket missing from history');
  if (!history.includes('Burnt motor coil')) throw new Error('rejected ticket missing from history');
  if (history.includes('Aircon not cooling')) throw new Error('ongoing ticket leaked into history');
});

await server.close();
console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures} failing check${failures === 1 ? '' : 's'})`}\n`);
process.exit(failures === 0 ? 0 : 1);
