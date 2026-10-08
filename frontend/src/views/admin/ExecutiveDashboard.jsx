import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle,
  Eye,
  Clock,
  Calendar,
  Activity,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { useData, toLocalISODate } from '../../context/DataContext';
import { apiGetPreventiveSchedules } from '../../backend/api';
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
    setFocusedTicketRef
  } = useData();

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
        'Requester must pass the signed QF-PDAS-DC-01 hardcopy to the PDAS Office within 24 hours.'
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
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  const pendingList = requisitions.filter(r => r.status === 'Pending').slice(0, 3);
  const flaggedReplacements = requisitions.filter(r => r.replacementFlag?.isFlagged || r.maintenanceFlag?.type === 'Disposal');

  // The statistics row reads the whole unfiltered pipeline, the way the KPI
  // cards do — scoping it to the toolbar's search would let the charts
  // disagree with the tiles directly above them.
  const chartScope = requisitions.filter(r => !r.isArchived);

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
    .filter(ev => /^\d{4}-\d{2}-\d{2}$/.test(ev.date) && ev.date >= toLocalISODate(new Date()))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4));

  const handleOpenDetail = (req) => {
    // Dashboard Manage opens the full approver-style review modal on the
    // Job Requests tab: jump there and deep-open this exact ticket.
    if (setFocusedTicketRef) setFocusedTicketRef(req.controlNo || req.ticket_no || req.id);
    const targetStatus = (req.status === 'Pending' || req.status === 'Pending Supervisor Approval') ? 'pending' : 'all';
    if (onNavigate) onNavigate('job-requests', targetStatus);
  };

  return (
    <div className="admin-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>

      {/* Page Header */}
      <PageHeader
        breadcrumbs={['PDAS Administration', 'Overview']}
        title="Work Order Dashboard"
        description={`ISAT U Dumangas — Physical Development & Auxiliary Services | ${formattedDate}`}
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

      {/* 5 Stat Cards — colors are semantic only: amber=attention, green=complete, red=critical, brand=navigational */}
      <div className="admin-stats-grid" style={{ display: 'grid', gap: '10px' }}>
        {/* Total Requests — deliberately not a status colour: a count of every
            state, so it must not borrow one state's hue. */}
        <div
          onClick={() => onNavigate && onNavigate('job-requests', 'all')}
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #5b6a82',
            boxShadow: 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, border-color 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Total Requests</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{totalRequisitions}</div>
        </div>

        {/* Pending Approval — amber: requires attention */}
        <div
          onClick={() => onNavigate && onNavigate('job-requests', 'pending')}
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #f59e0b',
            boxShadow: 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Pending Approval</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: pendingApprovals > 0 ? '#92400e' : '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{pendingApprovals}</div>
        </div>

        {/* Ongoing Work Orders — status-progress indigo: active/in-progress */}
        <div
          onClick={() => onNavigate && onNavigate('job-requests', 'in-progress')}
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #6366f1',
            boxShadow: 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Ongoing Work Orders</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{ongoingWorkOrders}</div>
        </div>

        {/* Completed Repairs — green: success/done status */}
        <div
          onClick={() => onNavigate && onNavigate('job-requests', 'completed')}
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #10b981',
            boxShadow: 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Completed Repairs</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: completedRepairs > 0 ? '#047857' : '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{completedRepairs}</div>
        </div>

        {/* Replacement & Disposal — StatusBadge maps this to status-rejected */}
        <div
          onClick={() => onNavigate && onNavigate('replacement-requests')}
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #ef4444',
            boxShadow: 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Replacement / Disposal</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: flaggedReplacements.length > 0 ? '#b91c1c' : '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{flaggedReplacements.length}</div>
        </div>
      </div>

      {/* Statistics — an operator's view: where the whole pipeline sits, how
          much is arriving, and which trades the work falls to. */}
      <ChartsRow isEmpty={chartScope.length === 0}>
        <DonutCard title="Pipeline by Status" icon="status" list={chartScope} pick={(r) => r.status} palette="status" unit="REQUESTS" />
        <ColumnCard
          title="Monthly Volume"
          icon="time"
          list={chartScope}
          dateKey="date"
          months={6}
          pick={(r) => r.status}
          palette="status"
          totalLabel="requests filed in this window"
        />
        <BarCard title="Workload by Category" icon="category" list={chartScope} pick={(r) => r.category} colorPick={(r) => r.status} colorPalette="status" totalLabel="requests filed" />
      </ChartsRow>

      {/* "Needs Your Attention" Strip (Shortcut strip when pending exists) */}
      {pendingList.length > 0 && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '14px',
          padding: '16px 20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#d97706" />
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#92400e' }}>Needs Your Attention ({pendingApprovals} Pending Approval)</span>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('job-requests', 'pending')}
              style={{ background: 'none', border: 'none', color: '#92400e', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View all pending <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingList.map(req => (
              <div
                key={req.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  border: '1px solid #fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#001f9c', fontSize: '13.5px' }}>{req.controlNo || req.ticket_no || req.id}</span>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>{req.location} — {req.title}</div>
                  <UrgencyBadge urgency={req.urgency} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '400', color: '#64748b' }}>{formatTicketDate(req.date)}</span>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenDetail(req)}
                    title="Review request & assign maintenance personnel"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Eye size={13} /> Review & Assign
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Card: Recent Facility Requests Table */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: 'var(--shadow-subtle)' }}>
        {/* Single Toolbar Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Recent Facility Requests</h2>
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
          <table className="table-nowrap" style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid #e2e8f0' }}>
                <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>TRACKING NO.</th>
                <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>LOCATION &amp; ISSUE</th>
                <th scope="col" className="col-category" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>CATEGORY</th>
                <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>URGENCY</th>
                <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>STATUS</th>
                <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>DATE</th>
                <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontWeight: '400' }}>
                      <ClipboardList size={32} style={{ margin: '0 auto 8px auto', color: '#94a3b8' }} />
                      <div style={{ fontWeight: '600', color: '#334155' }}>No requests yet</div>
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
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '600', color: '#001f9c', fontSize: '13px' }}>{req.controlNo}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: '500', color: '#0f172a', fontSize: '13px' }}>{req.location}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '400' }}>{req.title}</div>
                    </td>
                    <td className="col-category" style={{ padding: '12px 14px' }}><CategoryPill category={req.category} /></td>
                    <td style={{ padding: '12px 14px' }}><UrgencyBadge urgency={req.urgency} /></td>
                    <td style={{ padding: '12px 14px' }}><StatusBadge status={req.status} /></td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontWeight: '400', whiteSpace: 'nowrap' }}>{formatTicketDate(req.date)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleOpenDetail(req); }}
                        className="btn btn-secondary btn-sm"
                        title="Review request & assign maintenance personnel"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      >
                        <Eye size={13} /> Review & Assign
                      </button>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Activity size={18} color="#475569" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Recent Activity</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginTop: '6px' }} />
              <div>
                <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '400' }}>Request REQ-2026-004 completed</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '400' }}>By Mark Villanueva — 25 mins ago</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', marginTop: '6px' }} />
              <div>
                <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '400' }}>REQ-2026-003 assigned to Technician</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '400' }}>By PDAS Director — 2 hours ago</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', marginTop: '6px' }} />
              <div>
                <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '400' }}>New request filed from CEA Bldg</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '400' }}>By Dr. Elena Ramos — 4 hours ago</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* The shared intake dialogs: standard overlay, urgent fast path, print sheet. */}
      <RequestIntake intake={intake} allowActionTaken />

    </div>
  );
};
