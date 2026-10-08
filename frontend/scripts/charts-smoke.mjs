/* Render smoke test for the role dashboard statistics.
   Guards two things: that the primitives compute honest numbers, and that each
   role really does get its own chart set rather than one trio reused five times.
   Run: node scripts/charts-smoke.mjs                                         */
import { createServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.join(root, 'src');

const server = await createServer({
  configFile: path.join(root, 'vite.config.js'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error'
});

const { ChartsRow, DonutCard, BarCard, ColumnCard } = await server.ssrLoadModule(
  '/src/components/common/DashboardCharts.jsx'
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

/* Visible text only. Styling lives in attributes, so dropping the tags leaves
   exactly what a person reads on screen. */
const visible = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&middot;|&#183;|&#xb7;|·/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const el = (Comp, props) => renderToStaticMarkup(React.createElement(Comp, props));

/* index.css is the source of truth for colour everywhere in this file — the
   checks below and the palette checks further down both read from here. */
const cssSource = fs.readFileSync(path.join(src, 'index.css'), 'utf8');

/* The non-background solids behind a token family: --status-* is what the badge
   rules, the donut segments and now the bars and columns all read. */
const tokensNamed = (prefix) =>
  new Set(
    [...cssSource.matchAll(new RegExp(`--${prefix}-([a-z-]+):\\s*(#[0-9a-f]{6})`, 'gi'))]
      .filter(([, name]) => !/-bg$/i.test(name))
      .map(([, , hex]) => hex.toLowerCase())
  );

const monthsAgo = (back, day) => {
  const d = new Date();
  // Drop to the 1st first: setMonth on a 29th/30th/31st would spill into the
  // following month on short months and quietly move a row to the wrong bucket.
  d.setDate(1);
  d.setMonth(d.getMonth() - back);
  d.setDate(day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/* Eight rows, spread across the last six months so both the share charts and
   the time series have something real to count. */
const rows = [
  { status: 'Pending', urgency: 'High Risk', category: 'Electrical', date: monthsAgo(5, 9) },
  { status: 'Pending', urgency: 'Medium Risk', category: 'Electrical', date: monthsAgo(4, 12) },
  { status: 'Ongoing', urgency: 'Medium Risk', category: 'Mechanical', date: monthsAgo(3, 4) },
  { status: 'Ongoing', urgency: 'Low Risk', category: 'Mechanical', date: monthsAgo(2, 21) },
  { status: 'Completed', urgency: 'Low Risk', category: 'Water/Sanitary', date: monthsAgo(1, 7) },
  { status: 'Completed', urgency: 'Low Risk', category: 'Water/Sanitary', date: monthsAgo(1, 18) },
  { status: 'Returned', urgency: 'Medium Risk', category: 'Safety & Compliance', date: monthsAgo(0, 3) },
  { status: 'Rejected', urgency: 'High Risk', category: 'Air Conditioning', date: monthsAgo(0, 15) }
];

console.log('\nthe share charts compute honest numbers');
check('a donut draws its ring and reports the row count', () => {
  const html = el(DonutCard, { title: 'T', icon: 'status', list: rows, pick: (r) => r.status, palette: 'status' });
  const text = visible(html);
  const circles = (html.match(/<circle/g) || []).length;
  // 1 track ring + 5 status segments.
  if (circles !== 6) throw new Error(`expected 6 circles, found ${circles}`);
  if (!/\b8\b/.test(text)) throw new Error('the centre does not report 8');
  if (text.includes('NaN') || text.includes('undefined')) throw new Error('NaN/undefined in markup');
});
check('donut percentages sum to exactly 100%', () => {
  const text = visible(el(DonutCard, { title: 'T', list: rows, pick: (r) => r.status, palette: 'status' }));
  const pcts = (text.match(/\d+%/g) || []).map((s) => parseInt(s, 10));
  if (pcts.length !== 5) throw new Error(`expected 5 segments, found ${pcts.length}`);
  const sum = pcts.reduce((a, b) => a + b, 0);
  if (sum !== 100) throw new Error(`sums to ${sum}% (${pcts.join(', ')})`);
  if (pcts.some((p) => !Number.isInteger(p))) throw new Error('a percentage is fractional');
});
check('bar percentages sum to exactly 100%', () => {
  const text = visible(el(BarCard, { title: 'T', list: rows, pick: (r) => r.category }));
  const pcts = (text.match(/\d+%/g) || []).map((s) => parseInt(s, 10));
  if (pcts.length !== 5) throw new Error(`expected 5 categories, found ${pcts.length}`);
  const sum = pcts.reduce((a, b) => a + b, 0);
  if (sum !== 100) throw new Error(`sums to ${sum}% (${pcts.join(', ')})`);
});
check('an explicit palette wins over the default colours', () => {
  const html = el(DonutCard, {
    title: 'T',
    list: [{ k: 'Approved' }, { k: 'Approved' }, { k: 'Returned' }],
    pick: (r) => r.k,
    palette: { Approved: '#059669', Returned: '#f2a33a' }
  });
  if (!html.includes('#059669') || !html.includes('#f2a33a')) throw new Error('palette colours missing');
});

console.log('\nthe time series counts by month');
/* Every column is tinted by the status that dominated its own month, which is
   the same --status-* palette the Pipeline by Status donut draws from. The old
   rule pinned the current month to a lone #f2a33a; the current month now earns
   its colour from its own rows like every other month does. */
const columnFills = (html) =>
  [...html.matchAll(/border-radius:4px 4px 0 0;background:(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase());
const statusHex = (name) =>
  ((cssSource.match(new RegExp(`--status-${name}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1] || '').toLowerCase();
const EMPTY_TRACK_HEX = '#dde3ed';  /* DashboardCharts' zero-count track */

check('every column is tinted from the status palette, never a gradient', () => {
  const html = el(ColumnCard, { title: 'T', list: rows, dateKey: 'date', months: 6, totalLabel: 'W' });
  const fills = columnFills(html);
  if (fills.length !== 6) throw new Error(`expected 6 columns, found ${fills.length}`);
  const strays = fills.filter((hex) => !tokensNamed('status').has(hex) && hex !== EMPTY_TRACK_HEX);
  if (strays.length) throw new Error(`column drawn from outside the --status-* palette: ${strays.join(', ')}`);
  if (/gradient/i.test(html)) throw new Error('a column is still drawn with a gradient');
  if (fills.includes(EMPTY_TRACK_HEX)) throw new Error('a month with rows was drawn in the empty-track colour');
});
check("a month's colour is its own majority", () => {
  const html = el(ColumnCard, { title: 'T', list: rows, dateKey: 'date', months: 6, totalLabel: 'W' });
  const fills = columnFills(html);
  // monthsAgo(1) holds two Completed rows; monthsAgo(0) holds one Returned and
  // one Rejected, and the tie breaks on the label — so the two newest months
  // must read Completed and Rejected, not inherit some "current month" colour.
  const want = [statusHex('completed'), statusHex('rejected')];
  const got = [fills[fills.length - 2], fills[fills.length - 1]];
  if (!want[0] || !want[1]) throw new Error('could not read the status tokens from index.css');
  if (got[0] !== want[0]) throw new Error(`previous month is ${got[0]}, expected its own majority ${want[0]}`);
  if (got[1] !== want[1]) throw new Error(`current month is ${got[1]}, expected its own majority ${want[1]}`);
});
check('the window is six months wide with a label for each', () => {
  const html = el(ColumnCard, { title: 'T', list: rows, dateKey: 'date', months: 6, totalLabel: 'W' });
  // Each month contributes a titled bar and a titled axis label.
  const titled = (html.match(/title="/g) || []).length;
  if (titled !== 12) throw new Error(`expected 12 month titles, found ${titled}`);
  const current = new Date().toLocaleString('en-US', { month: 'short' });
  if (!visible(html).includes(current)) throw new Error(`current month "${current}" not labelled`);
});
check('the header total is the rows that fall inside the window', () => {
  const html = el(ColumnCard, { title: 'T', list: rows, dateKey: 'date', months: 6, totalLabel: 'window total' });
  const text = visible(html);
  if (!text.includes('window total')) throw new Error('missing total label');
  if (!text.includes(' 8 ')) throw new Error(`header total should read 8: "${text}"`);
});

console.log('\nan empty breakdown stays quiet');
check('an empty card says so instead of drawing an empty ring', () => {
  const html = el(DonutCard, { title: 'Awaiting Signature', list: [], pick: (r) => r.status, emptyCopy: 'Nothing waiting.' });
  const text = visible(html);
  if (!text.includes('Nothing waiting.')) throw new Error('missing the empty copy');
  if (html.includes('<circle')) throw new Error('an empty list still drew a ring');
});
check('an empty row collapses to a single card', () => {
  const html = el(ChartsRow, { isEmpty: true, emptyTitle: 'Statistics', emptyCopy: 'Quiet.' });
  if ((html.match(/<section/g) || []).length !== 0) throw new Error('empty row still rendered cards');
  if (!visible(html).includes('Quiet.')) throw new Error('missing the row copy');
});

console.log('\nevery role gets its own chart set');
const expected = {
  'views/admin/ExecutiveDashboard.jsx': ['Pipeline by Status', 'Monthly Volume', 'Workload by Category'],
  'views/campusAdmin/CampusAdminDashboard.jsx': ['Final Action Record', 'Awaiting Signature by Urgency', 'Awaiting Signature by Category'],
  'views/faculty/FacultyStaffDashboard.jsx': ['My Requests by Status', 'My Requests by Urgency', 'Filed by Month'],
  'views/supervisor/SupervisorDashboard.jsx': ['Endorsement Record', 'Endorsements by Urgency', 'Endorsements by Category'],
  'views/maintenance/WorkQueue.jsx': ['Work Order Priority', 'Work Order Status', 'Work Orders by Category']
};
const sourceOf = (rel) => fs.readFileSync(path.join(src, ...rel.split('/')), 'utf8');
/* Only the titles inside <ChartsRow> count — these files carry other title=
   attributes on buttons and would otherwise pollute the list. */
const chartTitles = (rel) => {
  const text = sourceOf(rel);
  const start = text.indexOf('<ChartsRow');
  if (start === -1) return null;
  const end = text.indexOf('</ChartsRow>', start);
  if (end === -1) return null;
  return [...text.slice(start, end).matchAll(/title="([^"]+)"/g)].map((m) => m[1]);
};

const seen = new Map();
for (const [rel, want] of Object.entries(expected)) {
  const role = path.basename(path.dirname(rel));
  check(`${role} declares its own three cards`, () => {
    const got = chartTitles(rel);
    if (!got) throw new Error('no <ChartsRow> block found');
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      throw new Error(`expected [${want.join(' | ')}] but found [${got.join(' | ')}]`);
    }
    if (!/import \{ ChartsRow,/.test(sourceOf(rel))) throw new Error('does not import the chart primitives');
  });
  seen.set(JSON.stringify([...chartTitles(rel) || []].sort()), rel);
}
check('no two roles share the same chart set', () => {
  if (seen.size !== Object.keys(expected).length) {
    throw new Error(`${Object.keys(expected).length - seen.size} role(s) reused another role's charts`);
  }
});

console.log('\nthe badges and the statistics use one palette');
/* index.css is the source of truth: the --status-* and --urgency-* tokens are
   what the badge rules read, and DashboardCharts mirrors them. Three palettes
   had grown side by side and "Approved" alone was navy, blue and green
   depending on where you looked, so every value here is checked against the
   tokens rather than trusted. */
const badgeSource = sourceOf('components/common/StatusBadge.jsx');
const chartSource = sourceOf('components/common/DashboardCharts.jsx');

const hexesIn = (fnName, source) => {
  const body = (source.match(new RegExp(`const ${fnName} = \\(label\\) => \\{([\\s\\S]*?)\\n\\};`)) || [])[1] || '';
  return [...body.matchAll(/'(#[0-9a-f]{6})'/gi)].map((m) => m[1].toLowerCase());
};
const statusColors = [
  ...((chartSource.match(/const STATUS_COLORS = \{([\s\S]*?)\};/) || [])[1] || '').matchAll(
    /(?:'([^']+)'|(\w+)):\s*'(#[0-9a-f]{6})'/gi
  )
].map(([, quoted, bare, hex]) => ({ label: quoted || bare, hex: hex.toLowerCase() }));

check('every chart status colour is a --status-* token', () => {
  if (statusColors.length < 12) throw new Error(`parsed only ${statusColors.length} chart colours`);
  const known = tokensNamed('status');
  const strays = statusColors.filter((c) => !known.has(c.hex));
  if (strays.length) throw new Error(strays.map((c) => `${c.label} = ${c.hex} is not a status token`).join('; '));
});
/* The category bars are the third card in the row, so they are held to the
   same rule as the donut and the columns: one solid each, drawn from the
   status that dominates the bucket, with the empty track as the only other
   colour allowed. */
const barFills = (html) =>
  [...html.matchAll(/border-radius:9999px;background:(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase());
check('every workload bar is tinted from the status palette, never a gradient', () => {
  const html = el(BarCard, { title: 'T', list: rows, pick: (r) => r.category });
  const fills = barFills(html);
  if (fills.length !== 5) throw new Error(`expected 5 category bars, found ${fills.length}`);
  const strays = fills.filter((hex) => !tokensNamed('status').has(hex) && hex !== EMPTY_TRACK_HEX);
  if (strays.length) throw new Error(`bar drawn from outside the --status-* palette: ${strays.join(', ')}`);
  if (/gradient/i.test(html)) throw new Error('a bar is still drawn with a gradient');
  if (new Set(fills).size < 2) throw new Error('every bar got the same colour — the tint is not following the data');
  /* Ranked by count then label, the fixture's first three buckets are
     Electrical (2× Pending), Mechanical (2× Ongoing) and Water/Sanitary
     (2× Completed): the colour must come from each bucket's own majority, not
     from the bar's position in the list. */
  const want = [statusHex('pending'), statusHex('progress'), statusHex('completed')];
  const got = fills.slice(0, 3);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    throw new Error(`first three bars are ${got.join(', ')}, expected their own majorities ${want.join(', ')}`);
  }
});
check('every chart urgency colour is a --urgency-* token', () => {
  const known = tokensNamed('urgency');
  const strays = hexesIn('urgencyColor', chartSource).filter((hex) => !known.has(hex));
  if (strays.length) throw new Error(`not urgency tokens: ${strays.join(', ')}`);
});
check('every badge dot reads its colour from a token, not a literal', () => {
  const rules = [...cssSource.matchAll(/\.badge\.(status-[a-z-]+)\s+\.badge-dot\s*\{\s*background-color:\s*([^;}]+)/gi)]
    .map(([, cls, value]) => ({ cls, value: value.trim() }));
  if (rules.length < 8) throw new Error(`parsed only ${rules.length} badge-dot rules`);
  const literal = rules.filter((r) => !/^var\(--status-[a-z-]+\)$/i.test(r.value));
  if (literal.length) throw new Error(literal.map((r) => `${r.cls} hard-codes ${r.value}`).join('; '));
});
check('every class StatusBadge emits has a rule behind it', () => {
  const emitted = [...new Set([...badgeSource.matchAll(/cls:\s*'([^']+)'/g)].map((m) => m[1]))];
  const defined = new Set([...cssSource.matchAll(/\.badge\.([a-z-]+)\s*\{/gi)].map((m) => m[1]));
  const orphaned = emitted.filter((cls) => !defined.has(cls));
  if (orphaned.length) throw new Error(`StatusBadge emits ${orphaned.join(', ')} but index.css defines no such rule`);
});
check('the chart palette carries no colours from outside the design system', () => {
  const offSystem = ['#94a3b8', '#64748b', '#334155', '#e2e8f0', '#1e3a8a', '#0ea5e9', '#8b5cf6', '#38bdf8'];
  const found = offSystem.filter((hex) => chartSource.toLowerCase().includes(hex));
  if (found.length) throw new Error(`orphan colours left in DashboardCharts: ${found.join(', ')}`);
});
check('the approver reads Approved the same way its own charts do', () => {
  const text = sourceOf('views/campusAdmin/CampusAdminDashboard.jsx');
  const tab = (text.match(/id: 'approved',[^}]*color: '(#[0-9a-f]{6})'/i) || [])[1];
  /* The stage palette is one shared object — the donut and the category bars
     both read it, so there is no second copy to drift — and the tab pill is
     checked against that object rather than against a hand-copied literal. */
  const shared = (text.match(/FINAL_ACTION_COLORS\s*=\s*\{[^}]*Approved: '(#[0-9a-f]{6})'/i) || [])[1];
  const donutWired = /palette=\{FINAL_ACTION_COLORS\}/.test(text);
  const barsWired = /colorPick=\{finalActionStage\}/.test(text) && /colorPalette=\{FINAL_ACTION_COLORS\}/.test(text);
  if (!tab || !shared) throw new Error('could not read the Approved tab pill or the shared stage palette');
  if (!donutWired || !barsWired) throw new Error('the donut and the category bars are not both reading the shared stage palette');
  if (tab.toLowerCase() !== shared.toLowerCase()) {
    throw new Error(`the Approved tab is ${tab} but its chart segment is ${shared}`);
  }
});

console.log('\nno chart library was added');
check('the dependency tree stays chart-free', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const banned = ['recharts', 'chart.js', 'react-chartjs-2', 'victory', 'nivo', 'echarts', 'apexcharts', 'd3'];
  const found = banned.filter((name) => deps[name]);
  if (found.length) throw new Error(`chart library added: ${found.join(', ')}`);
});

await server.close();
console.log(`\n${failures === 0 ? 'PASS' : `FAIL (${failures} failing check${failures === 1 ? '' : 's'})`}\n`);
process.exit(failures === 0 ? 0 : 1);
