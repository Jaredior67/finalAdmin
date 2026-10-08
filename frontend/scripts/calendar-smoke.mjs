/* Render smoke test for the Preventive Maintenance Calendar.
   Guards the de-duplication and the date-source-of-truth fix:
     - exactly ONE scheduling action, not two
     - the dialog targets the selected day (no stale hard-coded date)
     - the month grid and the day panel cannot drift apart on category colour
   Run: node scripts/calendar-smoke.mjs                                      */
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const here = path.dirname(fileURLToPath(import.meta.url));
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

const { configureData } = await server.ssrLoadModule('/scripts/__mocks__/dataContext.jsx');

/* PreventiveCalendar takes no month prop and opens on new Date(), so seeding a
   fixed month only passes while the machine clock is inside it. Seed the month
   the component will actually display. */
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
configureData({
  calendarEvents: [
    { id: 'E-1', title: 'Campus Generator Load Test', category: 'Electrical', date: `${month}-08`, time: '08:00 AM - 12:00 PM', location: 'Admin Hall', inCharge: 'Mark Villanueva' },
    { id: 'E-2', title: 'Quarterly Fire Extinguisher Check', category: 'Safety & Compliance', date: `${month}-12`, time: '01:00 PM - 05:00 PM', location: 'CEA', inCharge: 'PDAS Safety Committee' },
    { id: 'E-3', title: 'Roof Drainage Clearing', category: 'Mechanical', date: `${month}-18`, time: '07:00 AM - 11:00 AM', location: 'CEA Roofdeck', inCharge: 'Rina Santos' }
  ],
  addCalendarEvent: () => {},
  removeCalendarEvent: () => {},
  users: [
    { id: 'U-1', name: 'Mark Villanueva', title: 'Lead Maintenance Specialist', role: 'maintenance' }
  ]
});

const { PreventiveCalendar } = await server.ssrLoadModule('/src/views/PreventiveCalendar.jsx');
const src = (await import('node:fs')).readFileSync(
  path.resolve(here, '..', 'src', 'views', 'PreventiveCalendar.jsx'),
  'utf8'
);

const editable = renderToStaticMarkup(React.createElement(PreventiveCalendar, {}));
const readOnly = renderToStaticMarkup(React.createElement(PreventiveCalendar, { isReadOnly: true }));

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

console.log('\nno duplicated scheduling action');
check('exactly one "schedule" button on the page', () => {
  const matches = editable.match(/>\s*(Schedule for this day|Add another schedule)\s*</g) || [];
  if (matches.length !== 1) {
    throw new Error(`expected 1 scheduling button, found ${matches.length}`);
  }
});
check('the old duplicate header CTA is gone', () => {
  if (editable.includes('Schedule Maintenance</')) {
    throw new Error('the header still has a second "Schedule Maintenance" button');
  }
  if (/>\s*Schedule this day\s*</.test(editable)) {
    throw new Error('the old "Schedule this day" label is still present');
  }
});
check('read-only mode exposes no scheduling action', () => {
  if (/>\s*(Schedule for this day|Add another schedule)\s*</.test(readOnly)) {
    throw new Error('read-only calendar still offers a schedule button');
  }
});

console.log('\nthe date has a single source of truth');
check('no hard-coded 2026-09-15 default remains', () => {
  if (src.includes("'2026-09-15'")) {
    throw new Error('a hard-coded default date is still in the form state');
  }
});
check('the dialog targets the selected day, not a form field', () => {
  if (!/date:\s*selectedDate/.test(src)) {
    throw new Error('handleAddEvent must submit selectedDate');
  }
  // A second date input in the dialog would let the two disagree again.
  if (/id="pm-date"/.test(src) || /type="date"/.test(src)) {
    throw new Error('the dialog must not carry its own date input');
  }
});

console.log('\ngrid and day panel stay consistent');
check('scheduled events appear in the month grid', () => {
  for (const title of ['Campus Generator Load Test', 'Quarterly Fire Extinguisher Check', 'Roof Drainage Clearing']) {
    if (!editable.includes(title)) throw new Error(`missing from the grid: ${title}`);
  }
});
check('month total is reported', () => {
  if (!/3 scheduled this month/.test(editable)) {
    throw new Error('expected "3 scheduled this month"');
  }
});
check('category colour is defined once, not duplicated inline', () => {
  const inlineTones = (src.match(/category === 'Electrical'/g) || []).length;
  if (inlineTones > 0) {
    throw new Error(`category tint logic is still inline in ${inlineTones} place(s) — use toneFor()`);
  }
  if (!/const CATEGORY_TONES/.test(src)) throw new Error('CATEGORY_TONES is missing');
});
check('the grid does not re-filter all events per cell', () => {
  if (/calendarEvents\.filter\(event => event\.date === date\)/.test(src)) {
    throw new Error('the day cells still filter the whole event list — use the eventsByDate index');
  }
  if (!/eventsByDate = useMemo/.test(src)) throw new Error('eventsByDate index is missing');
});

console.log('\naccessibility + labelling');
check('day cells expose an accessible name and selected state', () => {
  if (!/aria-pressed=\{isSelected\}/.test(src)) throw new Error('day cells are missing aria-pressed');
  if (!/aria-label=\{`\$\{date\}/.test(src)) throw new Error('day cells are missing a descriptive label');
});
check('the technician row uses a person icon, not a tick', () => {
  if (/CheckCircle2/.test(src)) throw new Error('CheckCircle2 is still used for the technician');
  if (!/<User size=\{14\} \/> \{event\.inCharge\}/.test(src)) {
    throw new Error('the in-charge row should use the User icon');
  }
});
check('the day panel states the count', () => {
  if (!/scheduled<\/span>/.test(editable)) throw new Error('the day panel is missing its count');
});

console.log('\nreads the shared schedule, not only this browser');
check('the calendar loads the schedule from the server', () => {
  if (!/apiGetPreventiveSchedules/.test(src)) {
    throw new Error('the calendar never reads /preventive-schedules, so other people\'s work cannot appear');
  }
  if (!/serverSchedules/.test(src)) throw new Error('no state holds the server rows');
  if (!/removeCalendarEvent/.test(src)) throw new Error('no remove path is wired to the context');
});
check('a posted schedule is not shown twice', () => {
  if (!/scheduleKey/.test(src)) {
    throw new Error('no key for reconciling the device copy against the server copy');
  }
  if (!/serverId/.test(src)) throw new Error('the row\'s server id is not kept, so removal cannot reach it');
});
check('the reminder job is given a user to notify', () => {
  // assigned_to is a FK the reminder job joins on; sending only the name left
  // it NULL and no reminder was ever delivered.
  if (!/assignedTo/.test(src)) throw new Error('assignedTo is not sent when scheduling');
});

console.log('\nlayout holds together');
check('the responsive class sits on the element, not inside the style object', () => {
  if (/className:\s*'preventive-layout'/.test(src)) {
    throw new Error('className is still inside style={{}} — the media query below 900px never applies');
  }
  if (!/className="preventive-layout"/.test(src)) throw new Error('the preventive-layout class is missing');
});
check('every week the grid starts is also closed', () => {
  if (!/Math\.ceil/.test(src)) {
    throw new Error('trailing days are not padded to a full week, so the last row goes ragged');
  }
});
check('moving to another month keeps the day panel on screen', () => {
  if (!/setSelectedDate\(toISODate\(next\)\)/.test(src)) {
    throw new Error('the panel can point at a date that is no longer in the grid');
  }
});

console.log('\nstatus and colour');
check('every category the form offers has a tone', () => {
  const block = src.match(/const CATEGORY_TONES = \{[\s\S]*?\n\};/);
  if (!block) throw new Error('CATEGORY_TONES is missing');
  for (const c of ['Electrical', 'Air Conditioning', 'Mechanical', 'Water/Sanitary', 'Physical Structures', 'Drawing/Design', 'Safety & Compliance']) {
    if (!block[0].includes(`'${c}'`) && !block[0].includes(`${c}:`)) {
      throw new Error(`no tone defined for ${c}`);
    }
  }
});
check('the schedule status is shown on the day panel', () => {
  if (!/STATUS_TONES/.test(src)) throw new Error('no status tones');
  if (!/\{status\}/.test(src)) throw new Error('the status label is not rendered');
});
check('a legend is drawn from the categories on the board', () => {
  if (!/legendCategories/.test(src)) throw new Error('the colour chips have no legend');
});

console.log('\nscheduling survives without an administrator roster');
check('the technician picker is not an empty select', () => {
  if (/<select[^>]*id="pm-incharge"/.test(src)) {
    throw new Error('the in-charge control is still a select, which is empty for every non-admin');
  }
  if (!/pm-incharge-list/.test(src)) throw new Error('no datalist backs the in-charge field');
});

await server.close();
console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures} failing check${failures === 1 ? '' : 's'})`}\n`);
process.exit(failures === 0 ? 0 : 1);
