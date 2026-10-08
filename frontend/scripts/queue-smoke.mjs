/* Headless render smoke test for the merged Maintenance Work Queue.
   Renders every saved view + legacy deep link with mocked auth/data so any
   runtime error in the component body surfaces here instead of in a browser.
   Run: node scripts/queue-smoke.mjs                                        */
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
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

const tickets = [
  {
    id: 'R-1',
    controlNo: 'TRK-2026-0001',
    title: 'Aircon unit not cooling',
    description: 'Split-type unit blows warm air.',
    location: 'CEA Building - Room 204',
    category: 'Air Conditioning',
    urgency: 'Urgent',
    status: 'Ongoing',
    requestedBy: 'Engr. Diaz',
    requesterEmail: 'diaz@isatu.edu.ph',
    department: 'Engineering',
    assignedTo: 'Mark Villanueva',
    contactNumber: '0917 000 0000',
    qrCodeRef: 'QR-CEA-204',
    date: '2026-09-20',
    notes: 'Isolated breaker, R410A low.'
  },
  {
    id: 'R-2',
    controlNo: 'TRK-2026-0002',
    title: 'Flickering corridor lights',
    description: 'Panel B circuits trip intermittently.',
    location: 'Gymnasium',
    category: 'Electrical',
    urgency: 'High',
    status: 'Approved',
    requestedBy: 'Facilities Crew',
    requesterEmail: 'crew@isatu.edu.ph',
    department: 'Facilities',
    assignedTo: 'Rina Santos',
    date: '2026-09-18'
  },
  {
    id: 'R-3',
    controlNo: 'TRK-2026-0003',
    title: 'Replace burnt motor coil',
    description: 'Motor coil burnt out.',
    location: 'Library - Basement',
    category: 'Mechanical',
    urgency: 'Medium',
    status: 'Completed',
    requestedBy: 'Dr. Lim',
    requesterEmail: 'lim@isatu.edu.ph',
    department: 'Research',
    assignedTo: 'Mark Villanueva',
    date: '2026-09-11',
    notes: 'Replaced compressor. Tested load at 220V.'
  },
  {
    id: 'R-4',
    controlNo: 'TRK-2026-0004',
    title: 'Archived ticket',
    description: 'Should never render.',
    location: 'Old Wing',
    category: 'Electrical',
    urgency: 'Low',
    status: 'Completed',
    requestedBy: 'Someone',
    requesterEmail: 'x@isatu.edu.ph',
    department: 'None',
    assignedTo: 'Mark Villanueva',
    isArchived: true,
    date: '2026-01-01'
  }
];

const { configureAuth } = await server.ssrLoadModule('/scripts/__mocks__/authContext.jsx');
const { configureData } = await server.ssrLoadModule('/scripts/__mocks__/dataContext.jsx');

configureAuth({
  currentUser: { name: 'Mark Villanueva', email: 'maintenance@isatu.edu.ph', role: 'maintenance' },
  isMaintenance: true
});

configureData({
  requisitions: tickets,
  updateRequisitionStatus: () => {},
  updateRequisitionForm: () => {},
  raiseMaintenanceFlag: () => {},
  raiseReplacementFlag: () => {},
  evaluations: [
    {
      reqId: 'R-3',
      controlNo: 'TRK-2026-0003',
      functionalSuitability: 4.5,
      usability: 5,
      reliability: 4.5,
      performanceEfficiency: 4
    }
  ],
  focusedTicketRef: null,
  setFocusedTicketRef: () => {},
  ticketSearch: '',
  setTicketSearch: () => {}
});

const { WorkQueue } = await server.ssrLoadModule('/src/views/maintenance/WorkQueue.jsx');
const { QUEUE_VIEWS, buildMyQueue, buildAssigneeOptions, toStatusSlug } = await server.ssrLoadModule(
  '/src/components/maintenance/queueConfig.js'
);

const render = (activeTab) =>
  renderToStaticMarkup(React.createElement(WorkQueue, { activeTab, onTabChange: () => {} }));

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

console.log('\nqueue logic');
check('archived tickets never reach the queue', () => {
  const q = buildMyQueue(tickets, { name: 'Mark Villanueva' });
  if (q.some((t) => t.isArchived)) throw new Error('archived ticket leaked into the queue');
  if (q.length !== 3) throw new Error(`expected 3 tickets, got ${q.length}`);
});
check('assignee options come from real tickets', () => {
  const names = buildAssigneeOptions(buildMyQueue(tickets, { name: 'Mark Villanueva' }));
  if (!names.includes('Mark Villanueva') || !names.includes('Rina Santos')) {
    throw new Error(`unexpected assignees: ${JSON.stringify(names)}`);
  }
});
check('status slugs normalise', () => {
  if (toStatusSlug('In Progress') !== 'in-progress') throw new Error('bad slug for "In Progress"');
  if (toStatusSlug('On Hold') !== 'on-hold') throw new Error('bad slug for "On Hold"');
});
check('saved view filters partition the queue', () => {
  const q = buildMyQueue(tickets, { name: 'Mark Villanueva' });
  const counts = QUEUE_VIEWS.map((v) => q.filter(v.filter).length);
  // urgent=2 (R-1 Urgent + R-2 High), in-progress=1 (R-1), completed=1 (R-3), all=3
  const map = Object.fromEntries(QUEUE_VIEWS.map((v, i) => [v.id, counts[i]]));
  if (map.all !== 3) throw new Error(`all=${map.all}, expected 3`);
  if (map.urgent !== 2) throw new Error(`urgent=${map.urgent}, expected 2`);
  if (map['in-progress'] !== 1) throw new Error(`in-progress=${map['in-progress']}, expected 1`);
  if (map.completed !== 1) throw new Error(`completed=${map.completed}, expected 1`);
});

console.log('\npage renders (active tab + legacy deep links)');
for (const tab of ['tech-tasks', 'tech-emergency', 'tech-history']) {
  check(`tab "${tab}"`, () => {
    const html = render(tab);
    if (!html.includes('Maintenance Work Queue')) throw new Error('page did not render');
    if (!html.includes('Field Operations')) throw new Error('breadcrumb missing');
  });
}

console.log('\nall six toolbar controls on one row');
check('search, category, urgency, status, staff, sort', () => {
  const html = render('tech-tasks');
  for (const id of ['queue-search', 'queue-category', 'queue-urgency', 'queue-status', 'queue-staff', 'queue-sort']) {
    if (!html.includes(`id="${id}"`)) throw new Error(`missing control #${id}`);
  }
  if (!html.includes('class="queue-toolbar"')) throw new Error('toolbar wrapper missing');
});

console.log('\nqueue cards double as the view switcher');
check('four saved views with live counts', () => {
  const html = render('tech-tasks');
  for (const v of QUEUE_VIEWS) {
    if (!html.includes(`queue-tab-${v.id}`)) throw new Error(`missing view card "${v.id}"`);
  }
  if (!html.includes('role="tablist"')) throw new Error('view cards are not a tablist');
  if (!html.includes('role="tabpanel"')) throw new Error('no tabpanel for the shared list');
});

console.log('\nwork order card content');
check('staff, evaluation and lock state render', () => {
  const html = render('tech-history');
  if (!html.includes('wo-card')) throw new Error('no work order card');
  if (!html.includes('Mark Villanueva')) throw new Error('assigned staff not shown');
  if (!html.includes('wo-card--locked')) throw new Error('completed card not marked read-only');
  if (!html.includes('4.5')) throw new Error('evaluation average not shown');
  if (html.includes('Archived ticket')) throw new Error('archived ticket leaked into the list');
});
check('assigned staff filter is populated from the queue', () => {
  const html = render('tech-tasks');
  if (!html.includes('Rina Santos')) throw new Error('other technicians missing from staff filter');
  if (!html.includes('All staff')) throw new Error('staff filter has no "all" option');
});

await server.close();
console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures} failing check${failures === 1 ? '' : 's'})`}\n`);
process.exit(failures === 0 ? 0 : 1);
