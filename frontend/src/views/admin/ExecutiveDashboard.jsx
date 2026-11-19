import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Eye,
  Calendar,
  Activity,
  ClipboardList
} from 'lucide-react';
import { useData, toLocalISODate } from '../../context/DataContext';
import { apiGetPreventiveSchedules, apiGetAuditLog } from '../../backend/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../../components/common/StatusBadge';
import { PageHeader } from '../../components/common/PageHeader';
import { formatHeaderDate, formatTicketDate } from '../../components/common/TimeGreeting';
import {
  useRequestIntake,
  RequestIntake,
  RequestIntakeActions,
  RequestIntakePanel
} from '../../components/common/RequestIntake';
import { ChartsRow, DonutCard, BarCard, ColumnCard } from '../../components/common/DashboardCharts';
import { PageTransition } from '../../components/common/PageTransition';
import { DashboardSkeleton, useDelayedLoading } from '../../components/common/Skeleton';



export const ExecutiveDashboard = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { 
    requisitions = [], 
    totalRequisitions = 0, 
    pendingApprovals = 0, 
    ongoingWorkOrders = 0,
    completedRepairs = 0,
    ticketSearch: searchTerm,
    calendarEvents = [],
    evaluations = [],
    setFocusedTicketRef,
    isLoadingRequisitions
  } = useData();
  const showSkeleton = useDelayedLoading(isLoadingRequisitions && requisitions.length === 0);

    const [dispatchMessage, setDispatchMessage] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  
  // Filing a request is the same flow every other account gets: the same two
  // buttons, the same QF-PDAS-DC-01 form, the same urgent fast path and the same
  // print sheet. Only the requester's identity differs.
  const intake = useRequestIntake({
    requester: {
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      role: 'Admin',
      department: currentUser?.department || 'PDAS Office',
      phone: currentUser?.phone || '',
      idNumber: currentUser?.idNumber || ''
    },
    onFiled: (created) => {
      if (!created) return;
      setDispatchMessage(
        `${created.requestType} ${created.id} filed. Tracking PENDING, issued when the work order is assigned, after final approval. ` +
        'Request has entered the electronic approval workflow.'
      );
    }
  });

  // Filtered recent requests (most recent first)
  const filteredRequisitions = requisitions.filter(req => {
    const matchesSearch = 
      String(req.controlNo || req.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.location && req.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.title && req.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = filterCategory === 'all' || (req.category && req.category.toLowerCase().includes(filterCategory.toLowerCase()));
    return matchesSearch && matchesCat;
  }).sort((a, b) => {
    // High Risk tickets prioritized first at the top of the Admin dashboard ahead of lower-priority requests
    const uA = /high|urgent|emergency/i.test(String(a.urgency || '')) ? 1 : (/low/i.test(String(a.urgency || '')) ? 3 : 2);
    const uB = /high|urgent|emergency/i.test(String(b.urgency || '')) ? 1 : (/low/i.test(String(b.urgency || '')) ? 3 : 2);
    if (uA !== uB) return uA - uB;
    // Within priority tier, first-come first-served (earliest submitted first)
    const dateCmp = String(a.date || '').localeCompare(String(b.date || ''));
    if (dateCmp !== 0) return dateCmp;
    return String(a.controlNo || a.id || '').localeCompare(String(b.controlNo || b.id || ''));
  });

  // The statistics row reads the whole unfiltered pipeline, the way the KPI
  // cards do — scoping it to the toolbar's search would let the charts
  // disagree with the tiles directly above them.
  const chartScope = requisitions.filter(r => !r.isArchived);

  // Pending approval items needing administrative triage & assignment
  const pendingAttention = requisitions.filter(
    r => !r.isArchived && (r.status === 'Pending' || r.status === 'Pending Supervisor Approval' || r.status === 'Under Review')
  ).sort((a, b) => {
    const uA = /high|urgent|emergency/i.test(String(a.urgency || '')) ? 1 : (/low/i.test(String(a.urgency || '')) ? 3 : 2);
    const uB = /high|urgent|emergency/i.test(String(b.urgency || '')) ? 1 : (/low/i.test(String(b.urgency || '')) ? 3 : 2);
    if (uA !== uB) return uA - uB;
    return String(a.date || '').localeCompare(String(b.date || ''));
  });

  // Header date. The greeting and first-name helpers are intentionally not
  // used here — the shared PageHeader renders its own.
  const now = new Date();
  const formattedDate = formatHeaderDate(now);

  // Live preventive schedules (MySQL) with on-device calendar fallback.
  const [liveSchedules, setLiveSchedules] = useState(null);
  useEffect(() => {
    let cancelled = false;
    apiGetPreventiveSchedules()
      .then(rows => { if (!cancelled) setLiveSchedules(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setLiveSchedules(null); });
    return () => { cancelled = true; };
  }, []);

  const upcomingPreventive = ((liveSchedules || calendarEvents || [])
    .map(ev => ({
      title: ev.title || ev.assetName || 'Scheduled maintenance',
      location: ev.location || '—',
      date: String(ev.scheduled_date || ev.scheduledDate || ev.date || '').slice(0, 10),
      status: ev.status || 'Scheduled',
    }))
    // Local calendar date. The UTC form of this comparison made "upcoming"
    // include yesterday's schedules for the first eight hours of the day.
    .filter(ev => /^\d{4}-\d{2}-\d{2}$/.test(ev.date) && ev.date >= toLocalISODate(new Date()) && ev.status !== 'Completed' && ev.status !== 'Cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4));

  // Live recent activity feed (MySQL audit_log)
  const [recentActivities, setRecentActivities] = useState([]);
  useEffect(() => {
    let cancelled = false;
    apiGetAuditLog(5)
      .then(rows => { if (!cancelled) setRecentActivities(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setRecentActivities([]); });
    return () => { cancelled = true; };
  }, [requisitions]);

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diffSec = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (isNaN(diffSec) || diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const formatActivityLabel = (item) => {
    const actor = item.actor_name || 'System';
    const target = item.ticket_no || item.official_tracking_no || item.details || '';
    switch (item.action) {
      case 'request.submitted':
        return { text: target ? `New request filed: ${target}` : 'New request filed', sub: `By ${actor}` };
      case 'request.supervisor.approved':
        return { text: target ? `Supervisor endorsed: ${target}` : 'Request endorsed by supervisor', sub: `By ${actor}` };
      case 'request.supervisor.returned':
        return { text: target ? `Supervisor returned: ${target}` : 'Request returned by supervisor', sub: `By ${actor}` };
      case 'request.admin.approved':
        return { text: target ? `Admin approved: ${target}` : 'Request approved by admin', sub: `By ${actor}` };
      case 'request.admin.returned':
        return { text: target ? `Admin returned: ${target}` : 'Request returned by admin', sub: `By ${actor}` };
      case 'request.approver.approved':
        return { text: target ? `Final approval granted: ${target}` : 'Final approval granted', sub: `By ${actor}` };
      case 'request.approver.rejected':
        return { text: target ? `Request rejected: ${target}` : 'Request rejected', sub: `By ${actor}` };
      case 'request.assigned':
        return { text: target ? `Assigned to technician: ${target}` : 'Technician assigned', sub: `By ${actor}` };
      case 'request.completed':
      case 'request.status_change':
        return { text: target ? `Status updated: ${target}` : 'Status updated', sub: `By ${actor}` };
      default: {
        const cleanAction = (item.action || 'system.event').replace(/^request\./, '').replace(/_/g, ' ');
        return { text: target ? `${target} — ${cleanAction}` : cleanAction, sub: `By ${actor}` };
      }
    }
  };

  const statusToTab = (status) => {
    switch (status) {
      case 'Pending':
      case 'Pending Supervisor Approval':
        return 'pending';
      case 'Under Review':
        return 'under-review';
      case 'Pending Final Approval':
      case 'Awaiting Signatures':
        return 'pending-final';
      case 'Approved':
        return 'approved';
      case 'Ongoing':
      case 'In Progress':
        return 'in-progress';
      case 'On Hold':
        return 'on-hold';
      case 'Returned':
        return 'returned';
      case 'Completed':
        return 'completed';
      default:
        return 'all';
    }
  };

  const handleOpenDetail = (req) => {
    // Dashboard Manage opens the full approver-style review modal on the
    // Job Requests tab: jump there and deep-open this exact ticket.
    if (setFocusedTicketRef) setFocusedTicketRef(req.controlNo || req.ticket_no || req.id);
    const targetStatus = statusToTab(req?.status);
    if (onNavigate) onNavigate('job-requests', targetStatus);
  };

  if (showSkeleton) {
    return <PageTransition><DashboardSkeleton /></PageTransition>;
  }

  return (
    <PageTransition>
    <div className="admin-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>

      {/* Page Header */}
      <PageHeader
        breadcrumbs={['PDAS Administration', 'Overview']}
        title={`Welcome, ${currentUser?.name || 'System Administrator'}`}
        description={`Physical Development & Auxiliary Services · ${formattedDate}`}
        action={<RequestIntakeActions intake={intake} />}
      />

      {/* Success Notification Banner */}
      {dispatchMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            fontSize: '15px',
            fontWeight: '600'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} />
            <span>{dispatchMessage}</span>
          </div>
          <button onClick={() => setDispatchMessage('')} style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontSize: '13px' }}>Dismiss</button>
        </div>
      )}


      {/* Confirmation after filing — the same screen faculty gets. Shown here
          instead of the stat grid so the filer's next step is the first thing
          on the page. */}
      {intake.filed ? (
        <div className="content-card" style={{ padding: '28px' }}>
          <RequestIntakePanel
            intake={intake}
            requesterName={currentUser?.name}
            department={currentUser?.department}
            onTrack={() => { setDispatchMessage(''); if (onNavigate) onNavigate('job-requests', 'all'); }}
          />
        </div>
      ) : null}

      {/* Statistics — clicking a donut segment, bar, or status tile navigates to the matching filter. */}
      {/* ── KPI Summary Tiles (Consistent 4px Left Accent Bar Layout) ── */}
      <div
        role="region"
        aria-label="Executive KPI Overview"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px'
        }}
      >
        {[
          {
            label: 'Total Requests',
            value: chartScope.length,
            accent: '#001f9c',
            onClick: () => onNavigate && onNavigate('job-requests', 'all')
          },
          {
            label: 'Pending',
            value: chartScope.filter(r => r.status === 'Pending' || r.status === 'Pending Supervisor Approval').length,
            accent: '#f59e0b',
            onClick: () => onNavigate && onNavigate('job-requests', 'pending')
          },
          {
            label: 'Under Review',
            value: chartScope.filter(r => r.status === 'Under Review').length,
            accent: '#8b5cf6',
            onClick: () => onNavigate && onNavigate('job-requests', 'under-review')
          },
          {
            label: 'Ongoing',
            value: chartScope.filter(r => r.status === 'Ongoing' || r.status === 'In Progress').length,
            accent: '#3b82f6',
            onClick: () => onNavigate && onNavigate('job-requests', 'in-progress')
          },
          {
            label: 'Completed',
            value: chartScope.filter(r => r.status === 'Completed').length,
            accent: '#10b981',
            onClick: () => onNavigate && onNavigate('job-requests', 'completed')
          },
          {
            label: 'CSM Response Rate',
            value:
              chartScope.filter(r => r.status === 'Completed').length > 0 && (evaluations?.length || 0) > 0
                ? `${Math.round(((evaluations?.length || 0) / chartScope.filter(r => r.status === 'Completed').length) * 100)}%`
                : '—',
            accent: '#d97706',
            onClick: () => onNavigate && onNavigate('analytics-reports')
          }
        ].map((tile) => (
          <button
            key={tile.label}
            type="button"
            onClick={tile.onClick}
            title={tile.label}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderLeft: `4px solid ${tile.accent}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              minWidth: 0,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {tile.label}
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
              {tile.value}
            </div>
          </button>
        ))}
      </div>

      <ChartsRow isEmpty={chartScope.length === 0}>
        <DonutCard
          title="Pipeline by Status"
          icon="status"
          list={chartScope}
          pick={(r) => r.status}
          palette="status"
          unit="REQUESTS"
          showLegend={false}
          onSegmentClick={(label) => {
            onNavigate && onNavigate('job-requests', statusToTab(label));
          }}
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
              <span>Active Pipeline:</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>
                {chartScope.filter(r => r.status !== 'Completed' && r.status !== 'Rejected').length} active requests
              </span>
            </div>
          }
        />
        <ColumnCard
          title="Monthly Volume"
          icon="time"
          list={chartScope}
          dateKey="date"
          months={6}
          pick={(r) => r.status}
          palette="status"
          totalLabel="requests filed in this window"
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
              <span>Average Intake:</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>
                {(chartScope.length / 6).toFixed(1)} requests / mo
              </span>
            </div>
          }
        />
        <BarCard
          title="Workload by Category"
          icon="category"
          list={chartScope}
          pick={(r) => r.category}
          colorPick={(r) => r.status}
          colorPalette="status"
          totalLabel="requests filed"
          onBarClick={() => { onNavigate && onNavigate('job-requests', 'all'); }}
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
              <span>Categorized Services:</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>
                {new Set(chartScope.map(r => r.category || 'General')).size} disciplines
              </span>
            </div>
          }
        />
      </ChartsRow>

      {/* ── Needs Your Attention Section (Matching Prototype) ── */}
      <div style={{
        background: '#fffdf0',
        border: '1.5px solid #fde68a',
        borderRadius: '14px',
        padding: '18px 20px',
        boxShadow: 'var(--shadow-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: pendingAttention.length > 0 ? '14px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontSize: '15px', fontWeight: '800' }}>
            <Clock size={18} color="#d97706" />
            <span>Needs Your Attention ({pendingAttention.length} Pending Approval)</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('job-requests', 'pending')}
            style={{
              background: 'none', border: 'none', color: '#b45309', fontWeight: '700',
              fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
            }}
          >
            View all pending <ChevronRight size={14} />
          </button>
        </div>

        {pendingAttention.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontSize: '13.5px', fontWeight: '600', padding: '6px 0' }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>All caught up — no pending requests requiring action</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingAttention.slice(0, 3).map(req => (
              <div
                key={req.id}
                onClick={() => handleOpenDetail(req)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  background: 'var(--bg-card)',
                  border: '1px solid #fed7aa',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                  transition: 'border-color 0.15s, box-shadow 0.15s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(245,158,11,0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#fed7aa'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#001f9c', fontSize: '13px' }}>
                    {req.controlNo || req.ticket_no || req.id}
                  </span>
                  <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f172a' }}>
                    {req.location || 'Campus Facilities'} — {req.title || req.category}
                  </span>
                  <UrgencyBadge urgency={req.urgency} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    {formatTicketDate(req.date)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleOpenDetail(req); }}
                    style={{
                      background: '#071746',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '7px 14px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Eye size={13} /> Review &amp; Assign
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Card: Open Requests Table (Streamlined 5-Column Layout Matching Prototype) */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: 'var(--shadow-subtle)' }}>
        {/* Single Toolbar Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Open requests</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              aria-label="Filter by category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: 'var(--bg-sunken)', color: '#334155' }}
            >
              <option value="all">All Categories</option>
              <option value="Electrical">Electrical</option>
              <option value="Air Conditioning">Air Conditioning</option>
              <option value="Water/Sanitary">Water/Sanitary</option>
              <option value="Physical Structures">Physical Structures</option>
              <option value="Mechanical">Mechanical</option>
            </select>

            <button
              type="button"
              style={{ background: 'none', border: 'none', color: '#001f9c', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => onNavigate && onNavigate('job-requests', 'all')}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table className="table-nowrap" style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid #e2e8f0' }}>
                <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>TRACKING NO</th>
                <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>LOCATION</th>
                <th scope="col" className="col-category" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>CATEGORY</th>
                <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>REQUESTER</th>
                <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequisitions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontWeight: '400' }}>
                    <ClipboardList size={32} style={{ margin: '0 auto 8px auto', color: '#94a3b8' }} />
                    <div style={{ fontWeight: '600', color: '#334155' }}>No open requests</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Create a new request to track facility maintenance.</div>
                  </td>
                </tr>
              ) : (
                filteredRequisitions.slice(0, 5).map(req => (
                  <tr
                    key={req.id}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                    onClick={() => handleOpenDetail(req)}
                  >
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '700', color: '#001f9c', fontSize: '13px' }}>
                      {req.controlNo || req.ticket_no || req.id}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: '500', color: '#0f172a', fontSize: '13px' }}>{req.location || 'Campus Facilities'}</div>
                      {req.title && <div style={{ fontSize: '11.5px', color: '#64748b' }}>{req.title}</div>}
                    </td>
                    <td className="col-category" style={{ padding: '12px 14px' }}>
                      <CategoryPill category={req.category} />
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155', fontWeight: '500', fontSize: '13px' }}>
                      {req.requestedBy || req.requesterName || req.clientName || 'Staff'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <StatusBadge status={req.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Lower Cards (NO charts): Preventive Maintenance & Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Upcoming Preventive Maintenance Card */}
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: 'var(--shadow-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#001f9c" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Upcoming Preventive Maintenance</h3>
            </div>
            <button 
              onClick={() => onNavigate && onNavigate('preventive-calendar')}
              style={{ background: 'none', border: 'none', color: '#001f9c', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}
            >
              View calendar →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcomingPreventive.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>No upcoming schedules</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {liveSchedules === null ? 'Could not reach the server — showing on-device calendar.' : 'Schedule preventive work from the calendar.'}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '12px' }}
                  onClick={() => onNavigate && onNavigate('preventive-calendar')}
                >
                  <Calendar size={14} /> Open Calendar
                </button>
              </div>
            ) : (
              upcomingPreventive.map((evt, idx) => (
                <div key={`${evt.date}-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.title}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.location}</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: '#eff4ff', color: '#001f9c', border: '1px solid #bfdbfe', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {formatTicketDate(evt.date)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Feed Card */}
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: 'var(--shadow-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#475569" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Recent Activity</h3>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('audit-log')}
                style={{ background: 'none', border: 'none', color: '#001f9c', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}
              >
                View all →
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentActivities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#475569' }}>No recent activity</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>System actions and requests will appear here as they occur.</div>
              </div>
            ) : (
              recentActivities.map((act) => {
                const info = formatActivityLabel(act);
                return (
                  <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7', marginTop: '6px', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {info.text}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '400' }}>
                        {info.sub}{act.created_at ? ` — ${timeAgo(act.created_at)}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* The shared intake dialogs: standard overlay, urgent fast path, print sheet. */}
      <RequestIntake intake={intake} allowActionTaken />

    </div>
    </PageTransition>
  );
};
