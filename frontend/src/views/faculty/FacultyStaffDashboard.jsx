import React from 'react';
import {
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { getTimeGreeting, getDisplayFirstName } from '../../components/common/TimeGreeting';
import { PageHeader } from '../../components/common/PageHeader';

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const statCard = {
  background: '#ffffff',
  borderRadius: '12px',
  padding: '18px',
  border: '1px solid #e2e8f0',
  boxShadow: 'var(--shadow-subtle)',
  cursor: 'pointer',
};

const statLabel = {
  flex: '1 1 auto',
  minWidth: 0,
  fontSize: '13px',
  fontWeight: '500',
  color: '#64748b',
  lineHeight: 1.35,
};

export const FacultyStaffDashboard = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { requisitions } = useData();

  const now = new Date();
  const timeGreeting = getTimeGreeting(now);
  const firstName = getDisplayFirstName(currentUser?.name, 'Faculty');

  // Requests filed by this faculty / staff member
  const myTickets = (requisitions || []).filter(r =>
    (currentUser?.email && r.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
    (currentUser?.name && r.requestedBy?.toLowerCase().includes(currentUser.name.toLowerCase()))
  );

  const activeTickets = myTickets.filter(r => r.status !== 'Completed' && r.status !== 'Rejected');
  const awaitingAction = myTickets.filter(r =>
    ['Pending', 'Under Review', 'Awaiting Signatures'].includes(r.status)
  );
  const completedTickets = myTickets.filter(r => r.status === 'Completed');
  const urgentOpen = myTickets.filter(r =>
    r.status !== 'Completed' && r.status !== 'Rejected' &&
    /high|urgent|emergency/i.test(String(r.urgency || ''))
  );

  const recentTickets = [...myTickets].slice(0, 5);

  const stats = [
    {
      key: 'active',
      label: 'My active tickets',
      value: activeTickets.length,
      accent: '#001f9c',
      iconBg: '#eff4ff',
      Icon: FileText,
      target: 'faculty-tickets',
    },
    {
      key: 'awaiting',
      label: 'Awaiting action',
      value: awaitingAction.length,
      accent: '#d97706',
      iconBg: '#fffbeb',
      Icon: Clock,
      target: 'faculty-tickets',
    },
    {
      key: 'completed',
      label: 'Completed',
      value: completedTickets.length,
      accent: '#059669',
      iconBg: '#ecfdf5',
      Icon: CheckCircle2,
      target: 'faculty-history',
    },
    {
      key: 'urgent',
      label: 'Urgent open',
      value: urgentOpen.length,
      accent: '#dc2626',
      iconBg: '#fef2f2',
      Icon: AlertTriangle,
      target: 'faculty-tickets',
    },
  ];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '36px' }}>
      <PageHeader
        breadcrumbs={['Dashboard', 'Overview']}
        title={`${timeGreeting}, ${firstName}`}
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('faculty-submit')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: '#001f9c',
              color: '#ffffff',
              border: 'none',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} /> New Request
          </button>
        }
      />

      {/* Stat cards — one horizontal line */}
      <div className="faculty-stats-grid" style={{ marginBottom: '20px' }}>
        {stats.map(s => (
          <div
            key={s.key}
            onClick={() => onNavigate(s.target)}
            style={{ ...statCard, borderTop: `4px solid ${s.accent}` }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <span style={statLabel}>{s.label}</span>
              <span style={{
                width: '36px',
                height: '36px',
                flex: '0 0 36px',
                borderRadius: '8px',
                background: s.iconBg,
                color: s.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <s.Icon size={18} />
              </span>
            </div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: '#0f172a', lineHeight: 1 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Recent submissions */}
      <div className="content-card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            Recent submissions
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('faculty-history')}
            style={{ background: 'none', border: 'none', color: '#001f9c', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            View history <ArrowRight size={15} />
          </button>
        </div>

        {recentTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: '#64748b' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>No submissions yet</div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: '12px' }}
              onClick={() => onNavigate('faculty-submit')}
            >
              <Plus size={14} /> File a Request
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentTickets.map(req => (
              <div
                key={req.id}
                onClick={() => onNavigate('faculty-tickets')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  background: '#f8fafc',
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
                    {req.controlNo || req.id} &nbsp;·&nbsp; {fmtDate(req.date)}
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
    </div>
  );
};
