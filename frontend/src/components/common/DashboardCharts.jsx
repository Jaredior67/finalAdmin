/* ============================================================================
   DashboardCharts — statistics for the role dashboards.

   The row is shared, the content is not: each role declares the three cards
   that answer its own questions, so an approver sees decisions while a
   technician sees priority. Nothing here is a chart library — it is inline
   SVG and CSS, so the dependency tree stays as it was, and every figure is
   counted from the same requisitions the table beside it renders.

   Role line-up:
     Administrator    Pipeline by Status · Monthly Volume · Workload by Category
     Campus Admin     Final Action Record · Awaiting Signature (urgency/category)
     Faculty & Staff  My Status · My Urgency · Filed by Month
     Supervisor       Endorsement Record · Endorsements (urgency/category)
     Maintenance      Work Order Priority · Work Order Status · By Category

   Usage:

     <ChartsRow isEmpty={scope.length === 0}>
       <DonutCard title="..." icon="status" list={scope} pick={r => r.status} palette="status" />
       <ColumnCard title="..." icon="time" list={scope} />
       <BarCard title="..." icon="category" list={scope} pick={r => r.category} />
     </ChartsRow>
   ========================================================================== */
import React from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Landmark,
  UserCheck,
  Wrench
} from 'lucide-react';

/* Icons are named by role rather than imported at every call site, so adding a
   card never means editing a dashboard's import block. */
const ICONS = {
  status: Activity,
  urgency: AlertTriangle,
  priority: AlertTriangle,
  category: ClipboardList,
  time: Calendar,
  filed: Calendar,
  decision: Landmark,
  signature: Clock,
  endorse: UserCheck,
  approved: CheckCircle2,
  work: Wrench
};

const ChartIcon = ({ name }) => {
  const Glyph = ICONS[name] || Activity;
  return <Glyph size={17} />;
};

/* A status keeps one colour on every dashboard, so two roles' charts stay
   comparable at a glance and a segment never changes meaning between pages.

   THIS MAP MIRRORS index.css — the --status-* tokens the .badge.status-* rules
   read from. The badge on a row and the segment drawn for that row must never
   disagree, so the tokens are the source of truth and this is their copy.
   scripts/palette-smoke.mjs fails if the two drift.

   Two pairs deliberately share a colour because the badge does: Awaiting
   Signatures and Pending Final Approval are one state in StatusBadge, and
   Pending Supervisor Approval is a Pending. The legend still lists them
   separately; only the colour is common. */
const STATUS_COLORS = {
  Pending: '#f59e0b',
  Draft: '#f59e0b',
  'Pending Supervisor Approval': '#f59e0b',
  'Under Review': '#3b82f6',
  'Awaiting Signatures': '#f97316',
  'Pending Final Approval': '#f97316',
  Approved: '#001f9c',
  Ongoing: '#6366f1',
  'In Progress': '#6366f1',
  'On Hold': '#ea580c',
  Completed: '#10b981',
  Returned: '#f2a33a',
  Archived: '#768499',
  Rejected: '#ef4444'
};

/* Ordered so a label matching two meanings lands on the more specific one:
   "Pending Review" is pending, "Under Review" is review, "Awaiting Countersign"
   is awaiting, and only a bare approval reaches the brand blue. */
const AUTO_PALETTE = ['#001f9c', '#f2a33a', '#10b981', '#6366f1', '#3b82f6', '#ef4444', '#f59e0b', '#768499'];
const FALLBACK = '#768499';  /* = --text-light, the documented legibility floor */

/* The neutral a zero-count bucket sits on — the very track the Bars fill runs
   along — so a month or a category that filed nothing reads as "nothing"
   rather than quietly claiming a status it never had. */
const EMPTY_TRACK = '#dde3ed';

/* Unknown statuses still get a sensible colour instead of silently vanishing:
   the enum has been extended before (Returned) and will be again. */
const statusColor = (label) => {
  const exact = STATUS_COLORS[label];
  if (exact) return exact;
  const s = String(label || '');
  if (/reject|declin|disapprov/i.test(s)) return '#ef4444';
  if (/return/i.test(s)) return '#f2a33a';
  if (/hold/i.test(s)) return '#ea580c';
  if (/complet|closed|done|endor/i.test(s)) return '#10b981';
  if (/await|signature|final/i.test(s)) return '#f97316';
  if (/pending|draft|decis/i.test(s)) return '#f59e0b';
  if (/review/i.test(s)) return '#3b82f6';
  if (/approv/i.test(s)) return '#001f9c';
  if (/ongoing|progress|active/i.test(s)) return '#6366f1';
  return FALLBACK;
};

/* Urgency labels are free text in places, so match on meaning rather than an
   exact string — a request tagged "Urgent" must not fall through to grey.
   StatusBadge folds high/urgent/emergency into the one red emergency pill, so
   the chart does the same rather than splitting them the badge does not. The
   three values are the --urgency-* solids in index.css, not the badge's dark
   text colours, which are chosen to sit on a tinted pill. */
const urgencyColor = (label) => {
  const s = String(label || '');
  if (/high|urgent|emergency|critical/i.test(s)) return '#dc2626';
  if (/medium|moderate/i.test(s)) return '#d97706';
  if (/low/i.test(s)) return '#059669';
  return FALLBACK;
};

/* palette: 'status' | 'urgency' | 'auto' | an explicit { label: colour } map
   for role-specific buckets such as "Awaiting my decision". */
const colorFor = (palette, label, index) => {
  if (palette && typeof palette === 'object') {
    return palette[label] || AUTO_PALETTE[index % AUTO_PALETTE.length];
  }
  if (palette === 'status') return statusColor(label);
  if (palette === 'urgency') return urgencyColor(label);
  return AUTO_PALETTE[index % AUTO_PALETTE.length];
};

/* Group `rows` by `bucketOf`, then return a function that colours one bucket
   with the palette entry for the value that dominates it. Ranked the way
   countBy ranks a series — highest first, ties broken on the label — so the
   same data tints the same way on every render.

   This is the single rule behind both the ranked bars and the columns: a
   bucket's colour is what is actually in that bucket, never a decorative
   choice, which is why those two cards cannot drift apart from each other or
   from the donut. */
const dominantTint = (rows, bucketOf, colorOf, palette) => {
  const mix = new Map();
  (rows || []).forEach((row) => {
    const bucket = bucketOf(row);
    if (!mix.has(bucket)) mix.set(bucket, new Map());
    const tally = mix.get(bucket);
    const label = String(colorOf(row) || 'Unspecified');
    tally.set(label, (tally.get(label) || 0) + 1);
  });
  return (bucket) => {
    const ranked = [...(mix.get(bucket) || new Map()).entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    if (ranked.length === 0) return EMPTY_TRACK;
    return colorFor(palette, ranked[0].label, 0);
  };
};

/* Count occurrences of pick over the list. Ties break on the label so the
   order is deterministic — the same data must draw the same chart every render. */
const countBy = (list, pick) => {
  const counts = new Map();
  (list || []).forEach((item) => {
    const key = String(pick(item) || 'Unspecified');
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
};

/* Percentages that round independently can read 101% for a handful of rows,
   which looks like a bug on an otherwise finished dashboard. Largest remainder
   hands the leftover points to the biggest fractions, so the column always
   sums to exactly 100 while every figure stays a whole number. */
const withPercent = (segments, total) => {
  if (total <= 0) return segments.map((s) => ({ ...s, pct: 0 }));
  const exact = segments.map((s) => (s.value / total) * 100);
  const pcts = exact.map((v) => Math.floor(v));
  let leftover = 100 - pcts.reduce((sum, v) => sum + v, 0);
  exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
    .forEach(({ i }) => {
      if (leftover > 0) {
        pcts[i] += 1;
        leftover -= 1;
      }
    });
  return segments.map((s, i) => ({ ...s, pct: pcts[i] }));
};

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #dde3ed',
  borderRadius: '12px',
  padding: '18px 20px 20px',
  boxShadow: 'var(--shadow-subtle)',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column'
};

const CardHeading = ({ title, icon, total }) => (
  <header style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
    <span style={{ color: '#0d2150', display: 'inline-flex' }} aria-hidden="true"><ChartIcon name={icon} /></span>
    <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: '#0f172a', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {title}
    </h3>
    {total !== undefined && total !== null && (
      <span style={{ marginLeft: 'auto', fontSize: '15px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
        {total}
      </span>
    )}
  </header>
);

const ChartCard = ({ title, icon, total, children }) => (
  <section style={cardStyle}>
    <CardHeading title={title} icon={icon} total={total} />
    {children}
  </section>
);

const EmptyNote = ({ copy = 'No data for this breakdown yet.' }) => (
  <p style={{ margin: 0, fontSize: '13px', color: '#768499', padding: '6px 0 4px', lineHeight: 1.6 }}>{copy}</p>
);

/* The ring. The centre total is decorative — the legend beside it carries the
   same numbers as text, so the SVG is hidden from assistive tech rather than
   described twice. */
const Donut = ({ segments, total, unit }) => {
  const size = 134;
  const thickness = 20;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  const arcs = segments.map((seg, i) => {
    const len = (seg.value / total) * circ;
    // A hairline gap keeps neighbouring segments legible where they share a hue.
    const gap = segments.length > 1 ? Math.min(3, len / 4) : 0;
    const dash = Math.max(len - gap, 0.75);
    // Each arc starts where the segments before it end — derived, never accumulated,
    // so nothing is mutated between renders.
    const start = segments
      .slice(0, i)
      .reduce((sum, s) => sum + (s.value / total) * circ, 0);
    return (
      <circle
        key={seg.label}
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth={thickness}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={-start}
      />
    );
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#dde3ed" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${c} ${c})`}>{arcs}</g>
      </svg>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {total}
        </div>
        <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#768499', letterSpacing: '0.08em', marginTop: '4px' }}>
          {unit}
        </div>
      </div>
    </div>
  );
};

const Legend = ({ segments }) => (
  <div style={{ flex: '1 1 150px', minWidth: 0 }}>
    {segments.map((seg) => (
      <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4.5px 0', fontSize: '13px' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
        <span
          style={{ flex: 1, minWidth: 0, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={seg.label}
        >
          {seg.label}
        </span>
        <span style={{ fontWeight: '700', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{seg.value}</span>
        <span style={{ width: 40, textAlign: 'right', color: '#768499', fontVariantNumeric: 'tabular-nums' }}>{seg.pct}%</span>
      </div>
    ))}
  </div>
);

const Bars = ({ items }) => (
  <div>
    {items.map((item) => (
      <div key={item.label} style={{ marginBottom: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '13px', marginBottom: 5 }}>
          <span style={{ color: '#475569', fontWeight: '600', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
            {item.label}
          </span>
          <span style={{ color: '#5b6a82', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {item.value} · {item.pct}%
          </span>
        </div>
        <div style={{ height: 6, background: EMPTY_TRACK, borderRadius: 9999, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${item.pct}%`,
              borderRadius: 9999,
              /* One solid per bar: the --status-* colour of whatever dominates
                 that bucket, handed over by dominantTint. No ramp — six pixels
                 of track never held two colours, it only ever said "gradient",
                 and the label above the bar already says which category this
                 is. */
              background: item.color || EMPTY_TRACK
            }}
          />
        </div>
      </div>
    ))}
  </div>
);

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ---------------------------------------------------------------------------
   ChartsRow — the responsive grid. `isEmpty` collapses it to one quiet card,
   because an account with nothing filed should read as calm, not as three
   blank boxes.
   --------------------------------------------------------------------------- */
export const ChartsRow = ({
  children,
  isEmpty = false,
  emptyTitle = 'Statistics',
  emptyCopy = 'Nothing to chart yet. The breakdowns appear as soon as the first record exists.',
  style = {}
}) => {
  if (isEmpty) {
    return (
      <div style={{ ...cardStyle, ...style }}>
        <CardHeading title={emptyTitle} icon="status" />
        <p style={{ margin: 0, fontSize: '13.5px', color: '#5b6a82', lineHeight: 1.6 }}>{emptyCopy}</p>
      </div>
    );
  }
  return (
    <div
      aria-label="Dashboard statistics"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        ...style
      }}
    >
      {children}
    </div>
  );
};

/* ---------------------------------------------------------------------------
   DonutCard — a share/stack breakdown: how the whole divides.
   --------------------------------------------------------------------------- */
export const DonutCard = ({
  title,
  icon,
  list,
  pick,
  palette = 'auto',
  unit = 'TOTAL',
  emptyCopy
}) => {
  const rows = (list || []).filter(Boolean);
  const total = rows.length;
  if (total === 0) return <ChartCard title={title} icon={icon}><EmptyNote copy={emptyCopy} /></ChartCard>;

  const segments = withPercent(countBy(rows, pick), total)
    .map((s, i) => ({ ...s, color: colorFor(palette, s.label, i) }));

  return (
    <ChartCard title={title} icon={icon}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <Donut segments={segments} total={total} unit={unit} />
        <Legend segments={segments} />
      </div>
    </ChartCard>
  );
};

/* ---------------------------------------------------------------------------
   BarCard — ranked categories, longest bar first. Bars stay sized by how many
   rows a bucket holds; the tint comes from the status that dominates that
   bucket, so this card reads off the same --status-* palette as the donut and
   the columns beside it. Colour here never means "this is a category" — the
   label already says that — it means "this is where that work sits".
   --------------------------------------------------------------------------- */
export const BarCard = ({
  title,
  icon,
  list,
  pick,
  /* The field that decides the tint, not the field that decides the bucket:
     status by default, because colour in this row is always a status. */
  colorPick = (r) => r.status,
  colorPalette = 'status',
  totalLabel = 'in total',
  emptyCopy
}) => {
  const rows = (list || []).filter(Boolean);
  const total = rows.length;
  if (total === 0) return <ChartCard title={title} icon={icon}><EmptyNote copy={emptyCopy} /></ChartCard>;

  const fillFor = dominantTint(rows, (row) => String(pick(row) || 'Unspecified'), colorPick, colorPalette);
  const items = withPercent(countBy(rows, pick), total)
    .map((item) => ({ ...item, color: fillFor(item.label) }));
  return (
    <ChartCard title={title} icon={icon} total={total}>
      <Bars items={items} />
      <span style={{ fontSize: '11px', color: '#768499', marginTop: '2px' }}>{totalLabel}</span>
    </ChartCard>
  );
};

/* ---------------------------------------------------------------------------
   ColumnCard — volume over the last few months. Each column is tinted with the
   status that dominated that month, so the time series and the Pipeline by
   Status donut next to it read off one --status-* palette instead of a status
   chart sitting beside a differently-coloured one: "March filed 3, mostly
   Ongoing" needs no second key to follow. Months with nothing filed keep the
   empty track colour rather than borrowing a status they never had.
   --------------------------------------------------------------------------- */
export const ColumnCard = ({
  title,
  icon,
  list,
  dateKey = 'date',
  months = 6,
  /* Same contract as DonutCard — status is the default because every caller
     that draws this chart means "by status". */
  pick = (r) => r.status,
  palette = 'status',
  totalLabel = 'filed in this window',
  emptyCopy
}) => {
  const rows = (list || []).filter(Boolean);
  if (rows.length === 0) return <ChartCard title={title} icon={icon}><EmptyNote copy={emptyCopy} /></ChartCard>;

  const now = new Date();
  const window = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    window.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      month: d.getMonth(),
      year: d.getFullYear()
    });
  }

  const counts = new Map(window.map((w) => [w.key, 0]));
  const keyOf = (row) => String(row[dateKey] || '').slice(0, 7);
  rows.forEach((row) => {
    const key = keyOf(row);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });
  /* One shared ranking rule: this month's colour is whatever dominates this
     month's rows. Out-of-window rows land in buckets nothing asks for, so
     they cost nothing to leave in. */
  const fillFor = dominantTint(rows, keyOf, pick, palette);

  const newestYear = window[window.length - 1].year;
  const data = window.map((w) => ({
    key: w.key,
    value: counts.get(w.key),
    /* A month with no rows never gets a status colour — an empty column is
       empty, not "pending". */
    color: counts.get(w.key) > 0 ? fillFor(w.key) : EMPTY_TRACK,
    label: w.year === newestYear ? MONTHS_SHORT[w.month] : `${MONTHS_SHORT[w.month]} ’${String(w.year).slice(2)}`,
    full: `${MONTHS_LONG[w.month]} ${w.year}`
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ChartCard title={title} icon={icon} total={total}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '112px' }}>
        {data.map((d) => (
          <div
            key={d.key}
            style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}
          >
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a', marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>
              {d.value}
            </div>
            <div
              title={`${d.full}: ${d.value} filed`}
              style={{
                width: '100%',
                height: `${Math.max(3, Math.round((d.value / max) * 74))}px`,
                borderRadius: '4px 4px 0 0',
                /* One solid per column — the month's dominant --status-* token,
                   the same value the donut beside it draws. No ramp: the height
                   is already doing the comparing, and a column this narrow held
                   two colours only long enough to blur into neither. */
                background: d.color
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
        {data.map((d) => (
          <div
            key={d.key}
            title={d.full}
            style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: '10px', color: '#768499', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {d.label}
          </div>
        ))}
      </div>
      <span style={{ fontSize: '11px', color: '#768499', marginTop: '6px' }}>{totalLabel}</span>
    </ChartCard>
  );
};
