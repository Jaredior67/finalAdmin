import React from 'react';
import { ArrowRight, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatHeaderDate, formatTicketDate } from '../../components/common/TimeGreeting';
import { PageHeader } from '../../components/common/PageHeader';
import { ChartsRow, DonutCard, ColumnCard } from '../../components/common/DashboardCharts';
import { PageTransition } from '../../components/common/PageTransition';
import {
  useRequestIntake,
  RequestIntakeActions,
  RequestIntakePanel,
  RequestIntake
} from '../../components/common/RequestIntake';
import { filterMyRequests } from '../../utils/myRequests';

/* One surface style for every summary tile. These used to be copy-pasted
   four times over, so a change to the card had to be made four times. */
const cardSurface = {
  background: '#ffffff',
  borderRadius: '10px',
  padding: '14px 16px',
  border: '1px solid #e2e8f0',
  boxShadow: 'var(--shadow-subtle)',
  cursor: 'pointer',
  transition: 'box-shadow 0.15s, border-color 0.15s'
};

const tileLabel = {
  fontSize: '11px',
  fontWeight: '700',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '6px'
};

const tileValue = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#0f172a',
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums'
};

const tileCaption = {
  fontSize: '11px',
  color: '#94a3b8',
  marginTop: '4px',
  fontWeight: '400'
};

const StatCard = ({ label, value, accent, highlight, onClick }) => (
  <div
    onClick={onClick}
    style={{ ...cardSurface, borderLeft: `3px solid ${accent}` }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
  >
    <div style={tileLabel}>{label}</div>
    <div style={{ ...tileValue, color: highlight || tileValue.color }}>{value}</div>
  </div>
);

export const FacultyStaffDashboard = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { requisitions } = useData();

  /* The same intake every other role uses. The header pair opens the chooser
     right here, so filing never routes away from the dashboard. */
  const intake = useRequestIntake({
    requester: currentUser,
    onTrack: () => { if (onNavigate) onNavigate('faculty-tickets'); }
  });

  const now = new Date();
  const formattedDate = formatHeaderDate(now);

  // Requests filed by this faculty / staff member. The shared predicate, so a
  // tile here never counts a request the ticket list would not show.
  const myTickets = filterMyRequests(requisitions, currentUser);

  const isOpen = (r) => r.status !== 'Completed' && r.status !== 'Rejected';
  const openTickets = myTickets.filter(isOpen);
  const pendingReview = myTickets.filter(r =>
    ['Pending', 'Under Review', 'Pending Final Approval', 'Awaiting Signatures'].includes(r.status)
  );
  const completedTickets = myTickets.filter(r => r.status === 'Completed');
  const urgentOpen = myTickets.filter(r =>
    isOpen(r) && (/high|urgent|emergency/i.test(String(r.urgency || '')) || r.requestType === 'Urgent Request' || r.category === 'Urgent Hazard')
  );

  const recentTickets = [...myTickets]
    .sort((a, b) => {
      const isUrgentA = /high|urgent|emergency/i.test(String(a.urgency || '')) || a.requestType === 'Urgent Request' || a.category === 'Urgent Hazard';
      const isUrgentB = /high|urgent|emergency/i.test(String(b.urgency || '')) || b.requestType === 'Urgent Request' || b.category === 'Urgent Hazard';
      if (isUrgentA && !isUrgentB) return -1;
      if (!isUrgentA && isUrgentB) return 1;
      return String(b.date || '').localeCompare(String(a.date || ''));
    })
    .slice(0, 5);

  const goTickets = () => onNavigate('faculty-tickets');
  const goHistory = () => onNavigate('faculty-history');

  /* 2 Stat Cards — Total and Completed. The per-status breakdown
     (Pending, Under Review, Ongoing) lives in the "My Requests by Status"
     donut chart below, and urgency breakdown lives in "My Requests by Urgency",
     so repeating them as extra tiles is redundant. */
  const tiles = [
    {
      label: 'Open Requests',
      value: openTickets.length,
      caption: 'Active service tickets currently ongoing or in queue',
      accent: '#001f9c',
      onClick: goTickets
    },
    {
      label: 'Pending Review',
      value: pendingReview.length,
      caption: 'Awaiting administrative or supervisor review',
      accent: '#f59e0b',
      onClick: goTickets
    },
    {
      label: 'Urgent Priority',
      value: urgentOpen.length,
      caption: 'Immediate safety or infrastructure attention required',
      accent: '#dc2626',
      highlight: urgentOpen.length > 0 ? '#b91c1c' : null,
      onClick: goTickets
    },
    {
      label: 'Completed',
      value: completedTickets.length,
      caption: 'Repairs verified, completed, and closed',
      accent: '#10b981',
      highlight: completedTickets.length > 0 ? '#047857' : null,
      onClick: goHistory
    }
  ];

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
      <PageHeader
        breadcrumbs={['Faculty & Staff', 'Dashboard']}
        title="My Requests"
        description={`ISAT U Dumangas Campus — Facility Service Requests · ${formattedDate}`}
        action={<RequestIntakeActions intake={intake} />}
      />

      {/* Filing confirmation — the same screen the PDAS and approver dashboards
          show, so the filer's next step reads identically from every role. */}
      {intake.filed ? (
        <div className="content-card" style={{ padding: '28px' }}>
          <RequestIntakePanel
            intake={intake}
            requesterName={currentUser?.name}
            department={currentUser?.department}
          />
        </div>
      ) : null}

      <div
        className="faculty-stats-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}
      >
        {tiles.map((tile) => (
          <StatCard key={tile.label} {...tile} />
        ))}
      </div>

      {/* Statistics — a requester's view: clicking segments navigates to active tickets or history */}
      <ChartsRow
        isEmpty={myTickets.length === 0}
        emptyTitle="My request statistics"
        emptyCopy="File your first request and this fills in."
      >
        <DonutCard
          title="My Requests by Status"
          icon="status"
          list={myTickets}
          pick={(r) => r.status}
          palette="status"
          unit="REQUESTS"
          onSegmentClick={(label) => {
            if (label === 'Completed') goHistory();
            else goTickets();
          }}
        />
        <DonutCard
          title="My Requests by Urgency"
          icon="urgency"
          list={myTickets}
          pick={(r) => r.urgency}
          palette="urgency"
          unit="REQUESTS"
          onSegmentClick={() => goTickets()}
        />
        <ColumnCard
          title="Filed by Month"
          icon="filed"
          list={myTickets}
          dateKey="date"
          months={6}
          pick={(r) => r.status}
          palette="status"
          totalLabel="your requests in this window"
        />
      </ChartsRow>

      <div className="content-card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            Recent Requests
          </h2>
          <button
            type="button"
            onClick={goHistory}
            style={{ background: 'none', border: 'none', color: '#001f9c', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            View Request History <ArrowRight size={15} />
          </button>
        </div>

        {recentTickets.length === 0 ? (
          /* No second call to action here. "New Request" in the header and
             "Job Request" in the sidebar already open the form; a third
             button 400px away did the identical thing. */
          <div style={{ textAlign: 'center', padding: '30px 16px', color: '#64748b' }}>
            <FileText size={26} style={{ color: '#cbd5e1', marginBottom: '10px' }} />
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
              No requests yet
            </div>
            <div style={{ fontSize: '12.5px', marginTop: '5px' }}>
              Use New Request to file one.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentTickets.map(req => (
              <div
                key={req.id}
                onClick={goTickets}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  background: 'var(--bg-sunken)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {req.title}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '400', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                    {req.controlNo || req.id} &nbsp;·&nbsp; {formatTicketDate(req.date)}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <StatusBadge status={req.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The dialogs host — the chooser, both forms and the print sheet.
          Mounted exactly once, last, exactly as the admin dashboard does. */}
      <RequestIntake intake={intake} />
    </div>
    </PageTransition>
  );
};
