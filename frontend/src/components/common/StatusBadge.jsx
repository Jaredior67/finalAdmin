import React from 'react';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  PlayCircle, 
  FileSearch,
  AlertTriangle,
  ArrowUpRight,
  Minus,
  Archive
} from 'lucide-react';

export const StatusBadge = ({ status }) => {
  const normalized = (status || '').toLowerCase().replace(/[\s_]+/g, '-');
  
  const getBadgeConfig = () => {
    switch (normalized) {
      case 'pending':
        return { cls: 'status-pending', icon: Clock, label: 'Pending' };
      case 'under-review':
      case 'review':
        return { cls: 'status-under-review', icon: FileSearch, label: 'Under Review' };
      case 'pending-final-approval':
      case 'pending-final':
      case 'awaiting-signatures':
      case 'awaiting':
        return { cls: 'status-awaiting', icon: Clock, label: 'Pending Final Approval' };
      case 'approved':
        return { cls: 'status-approved', icon: CheckCircle2, label: 'Approved' };
      case 'in-progress':
      case 'ongoing':
      case 'ongoing-work-orders':
        return { cls: 'status-progress', icon: PlayCircle, label: 'Ongoing' };
      case 'on-hold':
        return { cls: 'status-on-hold', icon: Minus, label: 'On Hold' };
      case 'returned':
      case 'returned-for-revision':
      case 'needs-revision':
        return { cls: 'status-returned', icon: ArrowUpRight, label: 'Returned' };
      case 'completed':
      case 'resolved':
      case 'completed-repairs':
        return { cls: 'status-completed', icon: CheckCircle2, label: 'Completed' };
      case 'rejected':
      case 'cancelled':
        return { cls: 'status-rejected', icon: XCircle, label: 'Rejected' };
      case 'archived':
        return { cls: 'status-archived', icon: Archive, label: 'Archived' };
      case 'replacement-disposal':
      case 'disposal':
        return { cls: 'status-rejected', icon: AlertTriangle, label: 'Replacement Flagged' };
      default:
        return { cls: 'status-pending', icon: Clock, label: status || 'Pending' };
    }
  };

  const { cls, icon: Icon, label } = getBadgeConfig();

  return (
    <span className={`badge ${cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
      <Icon size={13} style={{ flexShrink: 0 }} />
      <span>{label}</span>
    </span>
  );
};

export const UrgencyBadge = ({ urgency }) => {
  const str = String(urgency || '').toLowerCase();
  
  let label = 'Medium Risk';
  let cls = 'urgency-medium';
  let Icon = Minus;

  if (str.includes('high') || str.includes('urgent') || str.includes('emergency')) {
    label = 'High Risk';
    cls = 'urgency-emergency';
    Icon = AlertCircle;
  } else if (str.includes('low')) {
    label = 'Low Risk';
    cls = 'urgency-low';
    Icon = CheckCircle2;
  } else {
    label = 'Medium Risk';
    cls = 'urgency-medium';
    Icon = ArrowUpRight;
  }

  return (
    <span className={`badge ${cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '600' }}>
      <Icon size={12} style={{ flexShrink: 0 }} />
      <span>{label}</span>
    </span>
  );
};

export const CategoryPill = ({ category }) => {
  return (
    <span className="category-pill" style={{ display: 'inline-block', padding: '3px 8px', background: 'var(--bg-muted)', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11.5px', fontWeight: '500', color: '#475569' }}>
      {category || 'General'}
    </span>
  );
};
