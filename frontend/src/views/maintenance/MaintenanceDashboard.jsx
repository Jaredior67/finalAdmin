import React, { useState, useMemo } from 'react';
import {
  Wrench,
  PlayCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  MessageSquare,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData, toLocalISODate } from '../../context/DataContext';
import { apiUpdateMyAvailability } from '../../backend/api';
import { PageHeader } from '../../components/common/PageHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { ChartsRow, DonutCard, BarCard, ColumnCard } from '../../components/common/DashboardCharts';
import { formatHeaderDate } from '../../components/common/TimeGreeting';
import { buildMyQueue } from '../../components/maintenance/queueConfig';

export const MaintenanceDashboard = ({ onTabChange }) => {
  const { currentUser, updateCurrentUser } = useAuth();
  const {
    requisitions,
    calendarEvents,
    setFocusedTicketRef
  } = useData();

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  const dutyStatus = currentUser?.availabilityStatus || 'available';
  const technicianName = currentUser?.name || 'Maintenance Specialist';
  const formattedDate = formatHeaderDate(new Date());

  // Handle live duty availability toggle
  const handleDutyStatusChange = async (nextStatus) => {
    setIsUpdatingStatus(true);
    try {
      await apiUpdateMyAvailability(nextStatus);
      if (updateCurrentUser) {
        updateCurrentUser({ availabilityStatus: nextStatus });
      }
      setActionNotice(`Duty status updated to ${nextStatus === 'available' ? 'Available' : nextStatus === 'busy' ? 'Busy on Job' : 'Off Duty'}.`);
      setTimeout(() => setActionNotice(''), 4000);
    } catch (err) {
      console.error('Failed to update duty status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Build the technician's relevant work orders
  const myQueue = useMemo(() => {
    return buildMyQueue(requisitions, currentUser);
  }, [requisitions, currentUser]);

  // Metric counts
  const ongoingTasks = useMemo(() => {
    return myQueue.filter(t => t.status === 'Ongoing' || t.status === 'In Progress');
  }, [myQueue]);

  const pendingTasks = useMemo(() => {
    return myQueue.filter(t => t.status === 'Approved' || t.status === 'Pending' || t.status === 'Under Review');
  }, [myQueue]);

  const urgentTasks = useMemo(() => {
    return myQueue.filter(t =>
      (t.urgency === 'Urgent' || t.urgency === 'High' || t.urgency === 'High Risk' || t.requestType === 'Urgent Request') &&
      t.status !== 'Completed' && t.status !== 'Rejected'
    );
  }, [myQueue]);

  const completedTasks = useMemo(() => {
    return myQueue.filter(t => t.status === 'Completed');
  }, [myQueue]);

  const upcomingPreventiveCount = useMemo(() => {
    const today = toLocalISODate(new Date());
    const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'campus_admin';
    const myId = currentUser?.id != null ? String(currentUser.id) : '';
    const myName = String(currentUser?.name || `${currentUser?.firstName || currentUser?.first_name || ''} ${currentUser?.lastName || currentUser?.last_name || ''}`).trim().toLowerCase();

    return (calendarEvents || []).filter(e => {
      const d = String(e.scheduledDate || e.date || e.scheduled_date || '').slice(0, 10);
      if (d < today || e.status === 'Completed' || e.status === 'Cancelled') return false;
      if (isPrivileged) return true;
      const assignedId = e.assignedTo != null ? String(e.assignedTo) : '';
      const inCharge = String(e.inCharge || e.assignedTechName || '').trim().toLowerCase();
      return (myId && assignedId === myId) || (myName && inCharge.includes(myName));
    }).length;
  }, [calendarEvents, currentUser]);

  const replacementFlaggedCount = useMemo(() => {
    return myQueue.filter(r => r.maintenanceFlag?.isFlagged || r.replacementFlag?.isFlagged).length;
  }, [myQueue]);

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>

        {/* ── Page Header ────────────────────────────────────────────── */}
        <PageHeader
          breadcrumbs={['Facility Maintenance', 'Overview']}
          title={`Welcome, ${currentUser?.name || 'Maintenance Specialist'}!`}
          description={`Field Operations & Technical Services · ${formattedDate}`}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Duty Status:</span>
                <select
                  value={dutyStatus}
                  onChange={(e) => handleDutyStatusChange(e.target.value)}
                  disabled={isUpdatingStatus}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: dutyStatus === 'available' ? '1px solid #a7f3d0' : dutyStatus === 'busy' ? '1px solid #fde68a' : '1px solid #cbd5e1',
                    background: dutyStatus === 'available' ? '#ecfdf5' : dutyStatus === 'busy' ? '#fffbeb' : '#f8fafc',
                    color: dutyStatus === 'available' ? '#047857' : dutyStatus === 'busy' ? '#b45309' : '#475569',
                    outline: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <option value="available">● Available for Dispatch</option>
                  <option value="busy">▲ Busy · On Field Job</option>
                  <option value="off_duty">■ Off Duty · Break / Shift Ended</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => onTabChange?.('tech-tasks')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  background: '#071746',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(7, 23, 70, 0.22)'
                }}
              >
                <Wrench size={15} />
                <span>Go to Work Queue ({myQueue.length})</span>
              </button>
            </div>
          }
        />

        {/* ── Toast notice if status or action updated ──────────────── */}
        {actionNotice && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderRadius: '8px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> {actionNotice}
            </span>
            <button
              type="button"
              onClick={() => setActionNotice('')}
              style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontSize: '12px' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Urgent Alert Banner (Only when urgent tickets pending) ── */}
        {urgentTasks.length > 0 && (
          <div
            onClick={() => {
              if (urgentTasks[0] && setFocusedTicketRef) {
                setFocusedTicketRef(urgentTasks[0].controlNo || urgentTasks[0].id);
              }
              onTabChange?.('tech-tasks');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderRadius: '10px',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderLeft: '5px solid #dc2626',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={18} color="#b91c1c" />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#991b1b' }}>
                  Safety Alert: {urgentTasks.length} urgent hazard work order{urgentTasks.length > 1 ? 's' : ''} require immediate response
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                  2-hour institutional safety response target • Click to view in Work Queue
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#dc2626',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              <span>Open Work Queue</span>
              <ChevronRight size={14} />
            </div>
          </div>
        )}

        {/* ── KPI Metric Cards: 1 Horizontal Line, 5 Placeholders ──── */}
        <div className="queue-views--5" role="region" aria-label="Maintenance overview metrics">
          {/* 1. ASSIGNED */}
          <button
            type="button"
            className="queue-view"
            style={{ '--queue-accent': '#0f172a' }}
            onClick={() => onTabChange?.('tech-tasks')}
            title="View all assigned work orders"
          >
            <span className="queue-view__head">
              <span className="queue-view__icon">
                <Wrench size={15} aria-hidden="true" />
              </span>
              <span className="queue-view__label">ASSIGNED</span>
            </span>
            <span className="queue-view__count">{myQueue.length}</span>
          </button>

          {/* 2. URGENT */}
          <button
            type="button"
            className="queue-view"
            style={{ '--queue-accent': '#dc2626' }}
            onClick={() => onTabChange?.('tech-emergency')}
            title="View urgent work orders"
          >
            <span className="queue-view__head">
              <span className="queue-view__icon">
                <AlertTriangle size={15} aria-hidden="true" />
              </span>
              <span className="queue-view__label">URGENT</span>
            </span>
            <span className="queue-view__count">{urgentTasks.length}</span>
          </button>

          {/* 3. IN PROGRESS */}
          <button
            type="button"
            className="queue-view"
            style={{ '--queue-accent': '#4f46e5' }}
            onClick={() => onTabChange?.('tech-tasks')}
            title="View in progress work orders"
          >
            <span className="queue-view__head">
              <span className="queue-view__icon">
                <PlayCircle size={15} aria-hidden="true" />
              </span>
              <span className="queue-view__label">IN PROGRESS</span>
            </span>
            <span className="queue-view__count">{ongoingTasks.length}</span>
          </button>

          {/* 4. COMPLETED */}
          <button
            type="button"
            className="queue-view"
            style={{ '--queue-accent': '#059669' }}
            onClick={() => onTabChange?.('tech-history')}
            title="View completed work orders"
          >
            <span className="queue-view__head">
              <span className="queue-view__icon">
                <CheckCircle2 size={15} aria-hidden="true" />
              </span>
              <span className="queue-view__label">COMPLETED</span>
            </span>
            <span className="queue-view__count">{completedTasks.length}</span>
          </button>

          {/* 5. PREVENTIVE */}
          <button
            type="button"
            className="queue-view"
            style={{ '--queue-accent': '#0284c7' }}
            onClick={() => onTabChange?.('tech-calendar')}
            title="View scheduled preventive tasks"
          >
            <span className="queue-view__head">
              <span className="queue-view__icon">
                <Calendar size={15} aria-hidden="true" />
              </span>
              <span className="queue-view__label">PREVENTIVE</span>
            </span>
            <span className="queue-view__count">{upcomingPreventiveCount}</span>
          </button>
        </div>

        {/* ── Statistics Charts Section (Brought back to Dashboard) ──── */}
        <ChartsRow
          isEmpty={myQueue.length === 0}
          emptyTitle="Work order statistics"
          emptyCopy="No work orders in your queue yet."
        >
          {/* Chart 1: Donut breakdown with interactive operational pipeline */}
          <DonutCard
            title="Work Order Status"
            icon="status"
            list={myQueue}
            pick={(r) => r.status}
            palette="status"
            unit="ORDERS"
            showLegend={false}
            onSegmentClick={() => onTabChange?.('tech-tasks')}
            footer={
              <div style={{
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid var(--border-subtle, #e2e8f0)',
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
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'none' }}>Click to view in Work Queue</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => onTabChange?.('tech-tasks')}
                    title="View all assigned work orders in Work Queue"
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
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>Total Orders</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{myQueue.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTabChange?.('tech-tasks')}
                    title="View ongoing work orders in Work Queue"
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
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#e0e7ff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#3730a3' }}>Ongoing</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#4338ca', fontVariantNumeric: 'tabular-nums' }}>{ongoingTasks.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTabChange?.('tech-tasks')}
                    title="View urgent safety queue in Work Queue"
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
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#991b1b' }}>Urgent</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>{urgentTasks.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTabChange?.('tech-history')}
                    title="View completed repairs in Work History"
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
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = '#dcfce7'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#166534' }}>Completed</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>{completedTasks.length}</span>
                  </button>
                </div>

                {/* Maintenance Outcome / Replacement Flag Row */}
                <div
                  style={{
                    background: replacementFlaggedCount > 0 ? '#fef2f2' : 'var(--bg-sunken)',
                    border: `1px solid ${replacementFlaggedCount > 0 ? '#fecdd3' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '9px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: replacementFlaggedCount > 0 ? '#991b1b' : '#475569' }}>
                      Replacement / Disposal Recommended
                    </span>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    color: replacementFlaggedCount > 0 ? '#b91c1c' : '#64748b',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {replacementFlaggedCount} flagged
                  </span>
                </div>
              </div>
            }
          />

          {/* Chart 2: Column volume over time */}
          <ColumnCard
            title="Monthly Volume"
            icon="time"
            list={myQueue}
            dateKey="date"
            months={6}
            pick={(r) => r.status}
            palette="status"
            totalLabel="orders in this window"
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
                <span>Monthly Handled:</span>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>
                  {(myQueue.length / 6).toFixed(1)} orders / mo
                </span>
              </div>
            }
          />

          {/* Chart 3: Work Orders by Technical Category */}
          <BarCard
            title="Work Orders by Category"
            icon="category"
            list={myQueue}
            pick={(r) => r.category}
            colorPick={(r) => r.status}
            colorPalette="status"
            totalLabel="work orders"
            onBarClick={() => onTabChange?.('tech-tasks')}
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
                <span>Active Trades:</span>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>
                  {new Set(myQueue.map(r => r.category || 'General')).size} disciplines
                </span>
              </div>
            }
          />
        </ChartsRow>

        {/* ── Work Queue Launch Panel (Directing Assigned Orders to Work Queue) ─ */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#eff6ff',
              color: '#001f9c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Wrench size={24} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                Field Work Queue &amp; Assigned Orders ({myQueue.length} Orders)
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                All assigned work orders, task filters, completion labor logs, attached photos, and outcome flags are managed in the Work Queue.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onTabChange?.('tech-tasks')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#071746',
              color: '#ffffff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(7, 23, 70, 0.22)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Open Work Queue</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* ── Operational Jump Desk ──────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '12px'
        }}>
          <div
            onClick={() => onTabChange?.('tech-tasks')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#001f9c'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,31,156,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#001f9c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wrench size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Field Work Queue</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Start repairs & log labor/photos</div>
              </div>
            </div>
            <ArrowRight size={15} color="#94a3b8" />
          </div>

          <div
            onClick={() => onTabChange?.('tech-calendar')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0284c7'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(2,132,199,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Preventive Calendar</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Routine maintenance schedule</div>
              </div>
            </div>
            <ArrowRight size={15} color="#94a3b8" />
          </div>

          <div
            onClick={() => onTabChange?.('tech-messages')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#d97706'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(217,119,6,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Team Messages</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Coordinate with dispatch desk</div>
              </div>
            </div>
            <ArrowRight size={15} color="#94a3b8" />
          </div>

          <div
            onClick={() => onTabChange?.('tech-history')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(5,150,105,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Completed Work History</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Browse finished service records</div>
              </div>
            </div>
            <ArrowRight size={15} color="#94a3b8" />
          </div>
        </div>

      </div>
    </PageTransition>
  );
};
