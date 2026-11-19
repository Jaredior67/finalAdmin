import React from 'react';
import { ArrowRight, FileText, ChevronRight } from 'lucide-react';
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

/* Stat tiles share one surface + renderer, driven by the `tiles` array so the
   dashboard cannot drift back into copy-pasted markup. */
const cardSurface = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '16px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  minWidth: 0
};

const StatCard = ({ label, value, accent, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    style={{
      ...cardSurface,
      borderLeft: `4px solid ${accent}`,
      cursor: 'pointer',
      textAlign: 'left'
    }}
  >
    <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </div>
    <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </div>
  </button>
);

export const FacultyStaffDashboard = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { requisitions, setFocusedTicketRef } = useData();

  /* The same intake every other role uses. The header pair opens the chooser
     right here, so filing never routes away from the dashboard. */
  const intake = useRequestIntake({
    requester: currentUser,
    onTrack: () => { if (onNavigate) onNavigate('faculty-history'); }
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
  const highRiskTickets = myTickets.filter(r => /high|urgent|emergency|critical/i.test(String(r.urgency || '')) || r.requestType === 'Urgent Request' || r.category === 'Urgent Hazard');
  const mediumRiskTickets = myTickets.filter(r => /medium|moderate/i.test(String(r.urgency || '')));
  const lowRiskTickets = myTickets.filter(r => /low/i.test(String(r.urgency || '')) || (!/high|urgent|emergency|critical|medium|moderate/i.test(String(r.urgency || ''))));

  const recentTickets = [...myTickets]
    .sort((a, b) => {
      const isUrgentA = /high|urgent|emergency/i.test(String(a.urgency || '')) || a.requestType === 'Urgent Request' || a.category === 'Urgent Hazard';
      const isUrgentB = /high|urgent|emergency/i.test(String(b.urgency || '')) || b.requestType === 'Urgent Request' || b.category === 'Urgent Hazard';
      if (isUrgentA && !isUrgentB) return -1;
      if (!isUrgentA && isUrgentB) return 1;
      // First-come, first-served (earliest submitted first)
      const dateCmp = String(a.date || '').localeCompare(String(b.date || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(a.controlNo || a.id || '').localeCompare(String(b.controlNo || b.id || ''));
    })
    .slice(0, 5);

  const goTickets = () => onNavigate('faculty-history');
  const goHistory = () => onNavigate('faculty-history');

  /* The four lifecycle tiles. Labels describe a state, never a nav item. */
  const tiles = [
    { label: 'Open Requests', value: openTickets.length, accent: '#001f9c', onClick: goTickets },
    { label: 'Pending Review', value: pendingReview.length, accent: '#f59e0b', onClick: goTickets },
    { label: 'Urgent Priority', value: urgentOpen.length, accent: '#ef4444', onClick: goTickets },
    { label: 'Completed', value: completedTickets.length, accent: '#10b981', onClick: goHistory }
  ];

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
      <PageHeader
        breadcrumbs={['Faculty & Staff Portal', 'Dashboard']}
        title={`Welcome, ${currentUser?.name || 'Faculty Member'}!`}
        description={`Facility Service Requests · ${formattedDate}`}
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

      {/* Summary tiles — lifecycle counts, data-driven from the list above. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        {tiles.map((tile) => (
          <StatCard key={tile.label} {...tile} />
        ))}
      </div>

      {/* Statistics — consolidated pipeline breakdown without top redundant tiles */}
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
          showLegend={false}
          onSegmentClick={(label) => {
            if (label === 'Completed') goHistory();
            else goTickets();
          }}
          footer={
            <div style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <span>Operational Pipeline</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'none' }}>Click to filter</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={goHistory}
                  aria-label="View all my requests"
                  style={{
                    background: 'var(--bg-sunken)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#001f9c'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#475569' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>Total Requests</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{myTickets.length}</span>
                </button>

                <button
                  type="button"
                  onClick={goTickets}
                  aria-label="Filter pending review"
                  style={{
                    background: pendingReview.length > 0 ? '#fffbeb' : '#f8fafc',
                    border: `1px solid ${pendingReview.length > 0 ? '#fde68a' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.background = '#fef3c7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = pendingReview.length > 0 ? '#fde68a' : '#e2e8f0'; e.currentTarget.style.background = pendingReview.length > 0 ? '#fffbeb' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: pendingReview.length > 0 ? '#92400e' : '#334155' }}>Pending</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: pendingReview.length > 0 ? '#b45309' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{pendingReview.length}</span>
                </button>

                <button
                  type="button"
                  onClick={goTickets}
                  aria-label="Filter ongoing work orders"
                  style={{
                    background: (openTickets.length - pendingReview.length) > 0 ? '#eef2ff' : '#f8fafc',
                    border: `1px solid ${(openTickets.length - pendingReview.length) > 0 ? '#c7d2fe' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#e0e7ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = (openTickets.length - pendingReview.length) > 0 ? '#c7d2fe' : '#e2e8f0'; e.currentTarget.style.background = (openTickets.length - pendingReview.length) > 0 ? '#eef2ff' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: (openTickets.length - pendingReview.length) > 0 ? '#3730a3' : '#334155' }}>Ongoing</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: (openTickets.length - pendingReview.length) > 0 ? '#4338ca' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{openTickets.length - pendingReview.length}</span>
                </button>

                <button
                  type="button"
                  onClick={goHistory}
                  aria-label="Filter completed repairs"
                  style={{
                    background: completedTickets.length > 0 ? '#f0fdf4' : '#f8fafc',
                    border: `1px solid ${completedTickets.length > 0 ? '#bbf7d0' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = '#dcfce7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = completedTickets.length > 0 ? '#bbf7d0' : '#e2e8f0'; e.currentTarget.style.background = completedTickets.length > 0 ? '#f0fdf4' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: completedTickets.length > 0 ? '#166534' : '#334155' }}>Completed</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: completedTickets.length > 0 ? '#15803d' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{completedTickets.length}</span>
                </button>
              </div>

              {/* Urgent Priority Action Row */}
              <button
                type="button"
                onClick={goTickets}
                aria-label="View urgent and emergency priority tickets"
                style={{
                  background: urgentOpen.length > 0 ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${urgentOpen.length > 0 ? '#fecdd3' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  padding: '9px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = urgentOpen.length > 0 ? '#fecdd3' : '#e2e8f0'; e.currentTarget.style.background = urgentOpen.length > 0 ? '#fef2f2' : '#f8fafc'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: urgentOpen.length > 0 ? '#991b1b' : '#475569' }}>
                    Urgent Priority Requests
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    color: urgentOpen.length > 0 ? '#b91c1c' : '#64748b',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {urgentOpen.length} {urgentOpen.length === 1 ? 'ticket' : 'tickets'}
                  </span>
                  <ChevronRight size={13} color={urgentOpen.length > 0 ? '#b91c1c' : '#94a3b8'} />
                </div>
              </button>
            </div>
          }
        />
        <DonutCard
          title="My Requests by Urgency"
          icon="urgency"
          list={myTickets}
          pick={(r) => r.urgency}
          palette="urgency"
          unit="REQUESTS"
          showLegend={false}
          onSegmentClick={() => goTickets()}
          footer={
            <div style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <span>Priority Breakdown</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'none' }}>Click to filter</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={goTickets}
                  aria-label="Filter high risk and urgent requests"
                  style={{
                    background: highRiskTickets.length > 0 ? '#fef2f2' : '#f8fafc',
                    border: `1px solid ${highRiskTickets.length > 0 ? '#fecdd3' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.background = '#fee2e2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = highRiskTickets.length > 0 ? '#fecdd3' : '#e2e8f0'; e.currentTarget.style.background = highRiskTickets.length > 0 ? '#fef2f2' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: highRiskTickets.length > 0 ? '#991b1b' : '#334155' }}>High Risk</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: highRiskTickets.length > 0 ? '#b91c1c' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{highRiskTickets.length}</span>
                </button>

                <button
                  type="button"
                  onClick={goTickets}
                  aria-label="Filter medium risk requests"
                  style={{
                    background: mediumRiskTickets.length > 0 ? '#fffbeb' : '#f8fafc',
                    border: `1px solid ${mediumRiskTickets.length > 0 ? '#fde68a' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d97706'; e.currentTarget.style.background = '#fef3c7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = mediumRiskTickets.length > 0 ? '#fde68a' : '#e2e8f0'; e.currentTarget.style.background = mediumRiskTickets.length > 0 ? '#fffbeb' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: mediumRiskTickets.length > 0 ? '#92400e' : '#334155' }}>Medium Risk</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: mediumRiskTickets.length > 0 ? '#b45309' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{mediumRiskTickets.length}</span>
                </button>

                <button
                  type="button"
                  onClick={goTickets}
                  aria-label="Filter low risk requests"
                  style={{
                    background: lowRiskTickets.length > 0 ? '#f0fdf4' : '#f8fafc',
                    border: `1px solid ${lowRiskTickets.length > 0 ? '#bbf7d0' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = '#dcfce7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = lowRiskTickets.length > 0 ? '#bbf7d0' : '#e2e8f0'; e.currentTarget.style.background = lowRiskTickets.length > 0 ? '#f0fdf4' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: lowRiskTickets.length > 0 ? '#166534' : '#334155' }}>Low Risk</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: lowRiskTickets.length > 0 ? '#15803d' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{lowRiskTickets.length}</span>
                </button>

                <button
                  type="button"
                  onClick={goTickets}
                  aria-label="View all requests by priority"
                  style={{
                    background: 'var(--bg-sunken)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#001f9c'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#475569' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>Total Requests</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{myTickets.length}</span>
                </button>
              </div>

              {/* Immediate Attention Callout */}
              <button
                type="button"
                onClick={goTickets}
                aria-label="View active urgent tickets requiring attention"
                style={{
                  background: urgentOpen.length > 0 ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${urgentOpen.length > 0 ? '#fecdd3' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  padding: '9px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = urgentOpen.length > 0 ? '#fecdd3' : '#e2e8f0'; e.currentTarget.style.background = urgentOpen.length > 0 ? '#fef2f2' : '#f8fafc'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: urgentOpen.length > 0 ? '#991b1b' : '#475569' }}>
                    Active Urgent / Emergency
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    color: urgentOpen.length > 0 ? '#b91c1c' : '#64748b',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {urgentOpen.length} {urgentOpen.length === 1 ? 'ticket' : 'tickets'}
                  </span>
                  <ChevronRight size={13} color={urgentOpen.length > 0 ? '#b91c1c' : '#94a3b8'} />
                </div>
              </button>
            </div>
          }
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
          footer={
            <div style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11.5px',
              color: '#64748b'
            }}>
              <span>Average Monthly Activity:</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>
                {(myTickets.length / 6).toFixed(1)} requests / mo
              </span>
            </div>
          }
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
                onClick={() => {
                  if (setFocusedTicketRef) setFocusedTicketRef(req.controlNo || req.id);
                  goHistory();
                }}
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
