import React from 'react';
import { 
  Wrench, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  MapPin, 
  ArrowRight, 
  Zap, 
  Tags, 
  CheckCircle, 
  Sparkles, 
  ShieldAlert 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../../components/common/StatusBadge';
import { getTimeGreeting, formatHeaderDate, getDisplayFirstName } from '../../components/common/TimeGreeting';
import { PageHeader } from '../../components/common/PageHeader';

export const MaintenanceDashboard = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { requisitions, updateRequisitionStatus } = useData();

  // Header greeting — same pattern as the admin dashboard.
  const now = new Date();
  const timeGreeting = getTimeGreeting(now);
  const formattedDate = formatHeaderDate(now);
  const firstName = getDisplayFirstName(currentUser?.name, 'Maintenance');

  // Maintenance tickets assigned to current user or active queue
  const myTasks = (requisitions || []).filter(r => 
    !currentUser?.name || 
    r.assignedTo?.toLowerCase().includes(currentUser.name.toLowerCase()) || 
    r.assignedTo?.toLowerCase().includes('mark') ||
    r.assignedTo?.toLowerCase().includes('villanueva') ||
    r.status === 'Ongoing' ||
    r.status === 'In Progress' ||
    r.status === 'Approved'
  );

  const activeTasks = myTasks.filter(r => r.status !== 'Completed' && r.status !== 'Rejected');
  const urgentTasks = activeTasks.filter(r => r.urgency === 'High Risk' || r.urgency === 'Urgent' || r.urgency === 'High');
  const completedTasks = (requisitions || []).filter(r => r.status === 'Completed');
  const replacementFlagged = (requisitions || []).filter(r => r.replacementFlag?.isFlagged);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '36px' }}>
      {/* Page Header */}
      <PageHeader
        breadcrumbs={['Maintenance Field Desk', 'Overview Dashboard']}
        title={`${timeGreeting}, ${firstName}`}
        description={`ISAT U Dumangas Campus — Field Work Overview | ${formattedDate}`}
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate('tech-tasks')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#001f9c',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Wrench size={15} /> Assigned Work Orders
            </button>

            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onNavigate('tech-emergency')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <AlertTriangle size={15} /> Urgent Queue ({urgentTasks.length})
            </button>
          </div>
        }
      />

      {/* KPI Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #001f9c',
          boxShadow: 'var(--shadow-subtle)',
          cursor: 'pointer'
        }} onClick={() => onNavigate('tech-tasks')}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Assigned Active Tasks
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#001f9c', marginTop: '4px' }}>
            {activeTasks.length}
          </div>
          <div style={{ fontSize: '11px', color: '#1e3a8a', marginTop: '4px' }}>
            On-site repair orders in progress
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #dc2626',
          boxShadow: 'var(--shadow-subtle)',
          cursor: 'pointer'
        }} onClick={() => onNavigate('tech-emergency')}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Urgent Hazards
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#dc2626', marginTop: '4px' }}>
            {urgentTasks.length}
          </div>
          <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px' }}>
            1-2h Priority response queue
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #059669',
          boxShadow: 'var(--shadow-subtle)',
          cursor: 'pointer'
        }} onClick={() => onNavigate('tech-history')}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Completed Work Logs
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#059669', marginTop: '4px' }}>
            {completedTasks.length}
          </div>
          <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px' }}>
            Finished maintenance records
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #d97706',
          boxShadow: 'var(--shadow-subtle)',
          cursor: 'pointer'
        }} onClick={() => onNavigate('replacement-requests')}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Replacement Items Flagged
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#d97706', marginTop: '4px' }}>
            {replacementFlagged.length}
          </div>
          <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>
            Pending PR / JR procurement
          </div>
        </div>
      </div>

      {/* Quick Access Task Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        {/* Card 1: Assigned Work Orders */}
        <div
          onClick={() => onNavigate('tech-tasks')}
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1.5px solid #cbd5e1',
            borderRadius: '12px',
            padding: '18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#001f9c',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Wrench size={18} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: '700', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '10px' }}>
              {activeTasks.length} Active
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Field Work Orders Queue</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
            View assigned repair tickets, update on-site status, upload repair proof photos and post diagnosis notes.
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: '#001f9c', fontWeight: '700', fontSize: '12px' }}>
            <span>Open Work Orders Desk</span> <ArrowRight size={14} />
          </div>
        </div>

        {/* Card 2: Emergency Response Queue */}
        <div
          onClick={() => onNavigate('tech-emergency')}
          style={{
            background: 'linear-gradient(135deg, #fff1f2 0%, #ffffff 100%)',
            border: '1.5px solid #fecdd3',
            borderRadius: '12px',
            padding: '18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#dc2626',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={18} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: '800', background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '10px' }}>
              High Priority
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#9f1239' }}>Emergency Hazard Triage</div>
          <div style={{ fontSize: '12px', color: '#881337', marginTop: '4px', lineHeight: 1.4 }}>
            Immediate dispatch response for critical water main bursts, electrical sparks, and structural risks.
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontWeight: '700', fontSize: '12px' }}>
            <span>View Urgent Queue</span> <ArrowRight size={14} />
          </div>
        </div>

        {/* Card 3: Preventive Maintenance Calendar */}
        <div
          onClick={() => onNavigate('tech-calendar')}
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '12px',
            padding: '18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#059669',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Calendar size={18} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: '700', background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '10px' }}>
              Scheduled
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Preventive Maintenance</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
            Check scheduled generator tests, AC filter washings, campus circuit breaker inspections.
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: '700', fontSize: '12px' }}>
            <span>Open Calendar Schedule</span> <ArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* Active Work Orders Table */}
      <div className="content-card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '16px', fontWeight: '800' }}>Current Field Work Orders</h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Active repair orders needing immediate on-site attention</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('tech-tasks')}
            style={{ fontSize: '12px', fontWeight: '700' }}
          >
            View All ({activeTasks.length})
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tracking No.</th>
                <th>Subject &amp; Location</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeTasks.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '700' }}>No active tasks in your queue right now.</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>All assigned facility work orders have been completed.</div>
                  </td>
                </tr>
              ) : (
                activeTasks.slice(0, 5).map(req => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: '800', color: '#001f9c' }}>
                      {req.controlNo || req.id}
                    </td>
                    <td>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{req.title}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>{req.location}</div>
                    </td>
                    <td>
                      <CategoryPill category={req.category} />
                    </td>
                    <td>
                      <UrgencyBadge urgency={req.urgency} />
                    </td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onNavigate('tech-tasks')}
                        style={{ fontSize: '11.5px', fontWeight: '700' }}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
