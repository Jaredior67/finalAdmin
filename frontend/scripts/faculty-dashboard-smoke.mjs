/* Render smoke test for the Faculty & Staff "My Requests" dashboard.
   Guards the de-duplication and the formal-terminology pass:
     - ONE call to action, not three (header + empty state + sidebar)
     - summary tiles report a STATE, never a verbatim copy of a nav label
     - the four tiles are data-driven, not copy-pasted markup
     - informal copy ("submissions", "|", "File a Request") stays out
   Run: node scripts/faculty-dashboard-smoke.mjs                               */
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
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

const ticket = (over) => ({
  scopeOfWorks: {},
  actionTaken: {},
  finalAction: {},
  timeline: [],
  isArchived: false,
  ...over
});

const mine = [
  ticket({
    id: 'T-1', controlNo: 'TRK-2026-0001', title: 'Aircon not cooling',
    urgency: 'High Risk', status: 'Ongoing',
    requestedBy: 'Elena Ramos', requesterEmail: 'faculty@isatu.edu.ph', date: '2026-09-20'
  }),
  ticket({
    id: 'T-2', controlNo: 'TRK-2026-0002', title: 'Flickering lights',
    urgency: 'Medium Risk', status: 'Pending',
    requestedBy: 'Elena Ramos', requesterEmail: 'faculty@isatu.edu.ph', date: '2026-09-18'
  }),
  ticket({
    id: 'T-3', controlNo: 'TRK-2026-0003', title: 'Flickering lights',
    urgency: 'Low Risk', status: 'Completed',
    requestedBy: 'Elena Ramos', requesterEmail: 'faculty@isatu.edu.ph', date: '2026-09-11'
  }),
  ticket({
    id: 'T-9', controlNo: 'TRK-2026-0009', title: 'Someone else request',
    urgency: 'High Risk', status: 'Ongoing',
    requestedBy: 'Other Person', requesterEmail: 'other@isatu.edu.ph', date: '2026-09-19'
  })
];

const { configureAuth } = await server.ssrLoadModule('/scripts/__mocks__/authContext.jsx');
const { configureData } = await server.ssrLoadModule('/scripts/__mocks__/dataContext.jsx');

configureAuth({
  currentUser: { name: 'Elena Ramos', email: 'faculty@isatu.edu.ph', department: 'CEA', role: 'faculty' }
});
configureData({ requisitions: mine });

const { FacultyStaffDashboard } = await server.ssrLoadModule(
  '/src/views/faculty/FacultyStaffDashboard.jsx'
);

const dashSrc = fs.readFileSync(
  path.join(src, 'views', 'faculty', 'FacultyStaffDashboard.jsx'),
  'utf8'
);
const navSrc = fs.readFileSync(path.join(src, 'navigation', 'facultyNavigation.js'), 'utf8');
const intakeSrc = fs.readFileSync(
  path.join(src, 'components', 'common', 'RequestIntake.jsx'),
  'utf8'
);

const render = () =>
  renderToStaticMarkup(React.createElement(FacultyStaffDashboard, { onNavigate: () => {} }));

const withRows = render();
// Reconfigure, then re-render, to exercise the genuinely empty state.
configureData({ requisitions: [] });
const noRows = render();

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

console.log('\nonly one call to action');
check('exactly one "New Request" button on the page', () => {
  const matches = withRows.match(/>\s*New Request\s*</g) || [];
  if (matches.length !== 1) throw new Error(`expected 1, found ${matches.length}`);
});
check('the duplicate empty-state button is gone', () => {
  if (/File a Request/.test(dashSrc)) throw new Error('"File a Request" still exists');
  if (/>\s*File a Request\s*</.test(noRows)) {
    throw new Error('the empty state still renders a second request button');
  }
});
check('the empty state points at the one button instead of duplicating it', () => {
  if (!/No requests yet/.test(noRows)) throw new Error('the empty state copy is missing');
  if (!/Use New Request/.test(noRows)) {
    throw new Error('the empty state should reference the single existing action');
  }
});

console.log('\nScan QR sits beside New Request');
check('the header carries the shared pair, Scan QR first', () => {
  // The pair is defined once in RequestIntake.jsx so every dashboard renders
  // the same two buttons; the dashboard must reference it, not re-draw it.
  if (!/action=\{<RequestIntakeActions intake=\{intake\} \/>\}/.test(dashSrc)) {
    throw new Error('the header does not render the shared RequestIntakeActions pair');
  }
  const scan = withRows.indexOf('Scan QR');
  const req = withRows.indexOf('New Request');
  if (scan === -1) throw new Error('Scan QR did not render');
  if (req === -1) throw new Error('New Request did not render');
  if (scan > req) throw new Error('Scan QR should sit beside — not after — New Request');
});
check('it hands off to the one scanner instead of mounting a second', () => {
  if (/<QrCodeScannerModal/.test(dashSrc)) {
    throw new Error('the dashboard mounts its own scanner — the location step owns it');
  }
  if (!/setPendingScanIntent\(true\)/.test(intakeSrc)) {
    throw new Error('the shared Scan QR button does not signal the intake flow');
  }
  if (!/onClick=\{intake\.requestScan\}/.test(intakeSrc)) {
    throw new Error('the Scan QR button is not wired to the intake flow');
  }
});

console.log('\nsummary tiles report state, not a nav label');
check('no tile is a verbatim copy of a sidebar label', () => {
  const navLabels = [...navSrc.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
  const tileLabels = [...dashSrc.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
  const clash = tileLabels.filter((l) => navLabels.includes(l));
  if (clash.length) {
    throw new Error(`tile label(s) duplicate a nav item: ${clash.join(', ')}`);
  }
});
check('the vague "Awaiting Action" label is replaced by a lifecycle stage', () => {
  if (dashSrc.includes('Awaiting Action')) throw new Error('"Awaiting Action" is still present');
  if (!/label: 'Pending Review'/.test(dashSrc)) throw new Error('"Pending Review" tile is missing');
});

console.log('\nthe four tiles are data-driven, not copy-pasted');
check('tiles come from an array rendered by one component', () => {
  if (!/const tiles = \[/.test(dashSrc)) throw new Error('no tiles array');
  if (!/tiles\.map\(\(tile\)/.test(dashSrc)) throw new Error('tiles are not mapped');
  if (!/const StatCard = /.test(dashSrc)) throw new Error('no shared StatCard component');
});
check('the card style is defined once, not repeated per tile', () => {
  const borderLeftInline = (dashSrc.match(/borderLeft:/g) || []).length;
  if (borderLeftInline > 1) {
    throw new Error(`borderLeft is still inlined ${borderLeftInline} times`);
  }
  if (!/const cardSurface = \{/.test(dashSrc)) throw new Error('cardSurface is missing');
});
check('the open-state test is written once', () => {
  if (!/const isOpen = /.test(dashSrc)) throw new Error('isOpen helper is missing');
  const inlineOpen = (dashSrc.match(/status !== 'Completed' && r?\.?status !== 'Rejected'/g) || []).length;
  if (inlineOpen > 1) {
    throw new Error(`the open/closed test is inlined ${inlineOpen} times — use isOpen()`);
  }
});

console.log('\nformal copy');
check('no pipe separator in the page subtitle', () => {
  if (/\| \$\{formattedDate\}/.test(dashSrc)) {
    throw new Error('the subtitle still uses a pipe before the date');
  }
  if (!/· \$\{formattedDate\}/.test(dashSrc)) throw new Error('the date is not set in the subtitle');
  if (/\|\s*&nbsp;|&amp;\s*\|\s*&nbsp;/.test(dashSrc) || /&amp;\s*\|\s/.test(dashSrc)) {
    throw new Error('an ampersand-pipe separator survived');
  }
});
check('"submissions" is not used as a section term', () => {
  if (/Recent submissions/.test(dashSrc)) throw new Error('"Recent submissions" is still present');
  if (!/Recent Requests/.test(dashSrc)) throw new Error('"Recent Requests" heading is missing');
  if (/>\s*View history\s*</.test(withRows)) {
    throw new Error('the truncated "View history" link is still there');
  }
  if (!/View Request History/.test(withRows)) {
    throw new Error('the link should name the destination formally');
  }
});
check('the breadcrumb agrees with the sidebar', () => {
  const crumb = dashSrc.match(/breadcrumbs=\{\['([^']+)', '([^']+)'\]\}/);
  if (!crumb) throw new Error('breadcrumbs prop not found');
  if (crumb[2] !== 'Dashboard') {
    throw new Error(`breadcrumb says "${crumb[2]}" but the sidebar item is "Dashboard"`);
  }
});

console.log('\ncounts still derive from the right set');
check('only this user\'s requests are counted', () => {
  if (withRows.includes('Someone else request')) {
    throw new Error("another user's request leaked into the dashboard");
  }
});
check('tile counts are correct for the seeded data', () => {
  // 3 of mine are filed: 2 open (1 ongoing + 1 pending), 1 pending review,
  // 1 urgent open, 1 completed.
  const expect = [
    ['Open Requests', 2],
    ['Pending Review', 1],
    ['Urgent Priority', 1],
    ['Completed', 1]
  ];
  for (const [label, count] of expect) {
    const re = new RegExp(`${label}</div><div[^>]*>${count}<`);
    if (!re.test(withRows)) throw new Error(`${label} should read ${count}`);
  }
});

await server.close();
console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures} failing check${failures === 1 ? '' : 's'})`}\n`);
process.exit(failures === 0 ? 0 : 1);
