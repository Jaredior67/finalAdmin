import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  RotateCcw, 
  Download, 
  FileText, 
  UserCheck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Key, 
  Settings, 
  Layers,
  ArrowRight,
  Filter
} from 'lucide-react';
import { apiGetAuditLog } from '../../backend/api';
// toLocalISODate reads the local calendar day; new Date().toISOString() is UTC,
// so a filename built from it can show tomorrow's or yesterday's date for users
// near midnight. Same helper the other admin CSV exports use.
import { toLocalISODate } from '../../context/DataContext';
import { Pagination } from '../../components/ui/Pagination';
import { TableSkeleton, useDelayedLoading } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

const fmtWhen = (value) => {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const formatRoleLabel = (role) => {
  if (!role) return 'System';
  const map = {
    admin: 'Administrative Officer',
    supervisor: 'Immediate Supervisor',
    approver: 'Campus Director',
    maintenance: 'Maintenance Staff',
    requester: 'Faculty / Staff',
    faculty: 'Faculty / Staff',
    system: 'System Service'
  };
  return map[role.toLowerCase()] || role;
};

/* Master action mapping to standard human-readable labels, categories, and audit badges */
const ACTION_CONFIG = {
  'request.draft': { label: 'Draft Created', category: 'Requisition', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  'request.submitted': { label: 'Request Submitted', category: 'Requisition', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  'request.supervisor.approved': { label: 'Supervisor Endorsement', category: 'Approval Workflow', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  'request.supervisor.returned': { label: 'Supervisor Revision Request', category: 'Approval Workflow', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  'request.admin.approved': { label: 'Admin Clearance & Approval', category: 'Approval Workflow', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  'request.admin.returned': { label: 'Admin Revision Request', category: 'Approval Workflow', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  'request.approver.approved': { label: 'Director Final Approval', category: 'Approval Workflow', color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
  'request.approver.rejected': { label: 'Director Disapproval', category: 'Approval Workflow', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  'request.assigned': { label: 'Personnel Assignment', category: 'Work Dispatch', color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
  'request.replacement_flag': { label: 'Flagged for Replacement', category: 'Work Dispatch', color: '#c2410c', bg: '#fff7ed', border: '#ffedd5' },
  'request.status_change': { label: 'Job Status Updated', category: 'Work Progress', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  'request.archived': { label: 'Record Archived', category: 'Data Management', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  'request.unarchived': { label: 'Record Restored', category: 'Data Management', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
  'user.created': { label: 'User Account Created', category: 'User Management', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  'user.updated': { label: 'User Profile Updated', category: 'User Management', color: '#4c1d95', bg: '#f5f3ff', border: '#ddd6fe' },
  'user.supervisor_assigned': { label: 'Supervisor Assigned', category: 'User Management', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  'auth.login': { label: 'System Login', category: 'Authentication', color: '#334155', bg: '#f8fafc', border: '#e2e8f0' },
  'auth.logout': { label: 'System Logout', category: 'Authentication', color: '#334155', bg: '#f8fafc', border: '#e2e8f0' },
  'auth.password_reset': { label: 'Password Reset', category: 'Authentication', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  'preventive.scheduled': { label: 'Preventive Task Scheduled', category: 'Preventive Maint.', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  'preventive.updated': { label: 'Preventive Task Updated', category: 'Preventive Maint.', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  'preventive.removed': { label: 'Preventive Task Removed', category: 'Preventive Maint.', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' }
};

const getActionMeta = (actionCode) => {
  if (!actionCode) return { label: 'System Event', category: 'General', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
  
  if (ACTION_CONFIG[actionCode]) {
    return ACTION_CONFIG[actionCode];
  }

  // Fallback for dynamic/unlisted action strings (e.g. "foo.bar_baz")
  const parts = String(actionCode).split('.');
  const categoryRaw = parts.length > 1 ? parts[0] : 'System';
  const category = categoryRaw.charAt(0).toUpperCase() + categoryRaw.slice(1);
  const actionName = parts.pop().replace(/_/g, ' ');
  const label = actionName.charAt(0).toUpperCase() + actionName.slice(1);

  return {
    label,
    category,
    color: '#334155',
    bg: '#f1f5f9',
    border: '#cbd5e1'
  };
};

/* Smart detail formatter: transforms raw JSON strings or structured detail text into clean, readable sentences */
const formatDetails = (rawDetails) => {
  if (!rawDetails) return null;
  const str = String(rawDetails).trim();
  if (!str) return null;

  // Try parsing JSON
  if (str.startsWith('{') || str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed === 'object' && parsed !== null) {
        const items = [];
        if (parsed.oldStatus || parsed.newStatus) {
          items.push(`Status: ${parsed.oldStatus || 'N/A'} → ${parsed.newStatus || 'N/A'}`);
        }
        if (parsed.oldSupervisorId !== undefined || parsed.newSupervisorId !== undefined) {
          const oldSup = parsed.oldSupervisorId ? `#${parsed.oldSupervisorId}` : 'None';
          const newSup = parsed.newSupervisorId ? `#${parsed.newSupervisorId}` : 'None';
          items.push(`Supervisor: ${oldSup} → ${newSup}`);
        }
        if (parsed.changedBy) {
          items.push(`Changed by: ${parsed.changedBy}`);
        }
        if (parsed.reason) {
          items.push(`Reason: ${parsed.reason}`);
        }
        if (parsed.remarks) {
          items.push(`Remarks: "${parsed.remarks}"`);
        }
        if (parsed.assignedTo) {
          items.push(`Assigned To: ${parsed.assignedTo}`);
        }
        if (parsed.location) {
          items.push(`Location: ${parsed.location}`);
        }

        if (items.length > 0) {
          return items.join(' | ');
        }

        // Generic object fallback
        return Object.entries(parsed)
          .filter(([_, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => {
            const formattedKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            return `${formattedKey}: ${typeof v === 'object' ? JSON.stringify(v) : v}`;
          })
          .join(' | ');
      }
    } catch {
      // Ignore JSON parse errors and proceed to raw string
    }
  }

  return str;
};

const DETAIL_CLAMP_CHARS = 180;

const AuditDetail = ({ detail, isOpen, onToggle, rawAction }) => {
  const formattedText = formatDetails(detail);
  
  if (!formattedText) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No additional details</span>;

  const isLong = formattedText.length > DETAIL_CLAMP_CHARS;
  const displayText = isOpen ? formattedText : (isLong ? `${formattedText.slice(0, DETAIL_CLAMP_CHARS).trimEnd()}…` : formattedText);

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: '12.5px',
          color: '#334155',
          lineHeight: 1.5,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {displayText}
      </div>
      {rawAction && (
        <div style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
          code: {rawAction}
        </div>
      )}
      {isLong && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 0',
            marginTop: '2px',
            color: '#001f9c',
            fontSize: '11.5px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          {isOpen ? 'Collapse detail' : 'Expand full detail'}
        </button>
      )}
    </div>
  );
};

export const AuditTrail = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedLoading(loading, 200);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTabState] = useState(() => {
    return (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fixit_audit_trail_tab')) || 'all';
  });
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    try { sessionStorage.setItem('fixit_audit_trail_tab', tab); } catch {}
  };
  const [page, setPage] = useState(1);
  const [openDetailId, setOpenDetailId] = useState(null);
  const pageSize = 15;

  const loadTrail = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await apiGetAuditLog(500);
      setEntries(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setLoadError(err.message || 'Could not fetch audit trail logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTrail(); }, [loadTrail]);
  useEffect(() => { setPage(1); }, [searchTerm, activeTab]);

  // Statistics calculation for audit overview cards
  const stats = useMemo(() => {
    let approvalsCount = 0;
    let userCount = 0;
    let rejectionsCount = 0;

    entries.forEach(e => {
      const act = String(e.action || '');
      if (act.includes('approved') || act.includes('submitted') || act.includes('assigned')) approvalsCount++;
      if (act.includes('user') || act.includes('auth')) userCount++;
      if (act.includes('returned') || act.includes('rejected')) rejectionsCount++;
    });

    return {
      total: entries.length,
      approvals: approvalsCount,
      users: userCount,
      rejections: rejectionsCount
    };
  }, [entries]);

  // Filtered dataset based on tab & search query
  const filtered = useMemo(() => {
    return entries.filter(e => {
      const meta = getActionMeta(e.action);
      
      // Tab filtering
      if (activeTab === 'approval' && meta.category !== 'Approval Workflow' && meta.category !== 'Requisition' && meta.category !== 'Work Dispatch') {
        return false;
      }
      if (activeTab === 'user' && meta.category !== 'User Management' && meta.category !== 'Authentication') {
        return false;
      }
      if (activeTab === 'maintenance' && meta.category !== 'Preventive Maint.' && meta.category !== 'Work Progress') {
        return false;
      }

      // Search query filtering
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;

      const recordId = String(e.official_tracking_no || e.ticket_no || e.entity_id || '').toLowerCase();
      const actorName = String(e.actor_name || '').toLowerCase();
      const actorRole = String(e.actor_role || '').toLowerCase();
      const actionCode = String(e.action || '').toLowerCase();
      const actionLabel = String(meta.label || '').toLowerCase();
      const detailStr = String(formatDetails(e.details) || e.details || '').toLowerCase();

      return (
        recordId.includes(q) ||
        actorName.includes(q) ||
        actorRole.includes(q) ||
        actionCode.includes(q) ||
        actionLabel.includes(q) ||
        detailStr.includes(q)
      );
    });
  }, [entries, activeTab, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Download official CSV Audit Log Report
  const exportCSV = () => {
    if (filtered.length === 0) return;
    
    const headers = [
      'Audit Event ID', 
      'Timestamp', 
      'Actor Name', 
      'Actor Role', 
      'Action Code', 
      'Action Name', 
      'Category', 
      'Tracking / Control No', 
      'Details'
    ];

    const csvRows = filtered.map(e => {
      const meta = getActionMeta(e.action);
      const record = e.official_tracking_no || e.ticket_no || (e.entity === 'user' ? `User #${e.entity_id}` : e.entity_id ? `${e.entity} #${e.entity_id}` : '—');
      const detText = formatDetails(e.details) || e.details || '';

      return [
        e.id,
        fmtWhen(e.created_at),
        e.actor_name || `User #${e.actor_id}` || 'System',
        formatRoleLabel(e.actor_role),
        e.action || '',
        meta.label,
        meta.category,
        record,
        detText
      ].map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FixIT_Audit_Trail_${toLocalISODate(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header section */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <ShieldCheck size={22} color="#001f9c" />
            <h1 className="page-title" style={{ margin: 0 }}>System Audit Trail</h1>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Official ISAT U Dumangas System Audit Log
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={exportCSV}
            disabled={loading || filtered.length === 0}
            title="Export filtered audit log to CSV for compliance"
          >
            <Download size={14} /> Export CSV
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadTrail} disabled={loading}>
            <RotateCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Audit Stats Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="content-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#001f9c' }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Total Audit Events</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{stats.total}</div>
          </div>
        </div>

        <div className="content-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
            <UserCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Approvals & Workflow</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{stats.approvals}</div>
          </div>
        </div>

        <div className="content-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
            <Key size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Account & User Actions</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{stats.users}</div>
          </div>
        </div>

        <div className="content-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Revisions & Returns</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{stats.rejections}</div>
          </div>
        </div>
      </div>

      {loading && showSkeleton ? (
        <div className="content-card" style={{ padding: '20px' }}>
          <TableSkeleton rows={8} cols={5} />
        </div>
      ) : loadError && entries.length === 0 ? (
        <EmptyState
          title="Audit trail log unavailable"
          description={loadError}
          action={<button type="button" className="btn btn-secondary btn-sm" onClick={loadTrail}>Retry Connection</button>}
        />
      ) : (
        <div className="content-card">
          {/* Filter Bar & Search Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('all')}
                  style={{ fontSize: '12.5px', padding: '6px 12px' }}
                >
                  All Events ({entries.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'approval' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('approval')}
                  style={{ fontSize: '12.5px', padding: '6px 12px' }}
                >
                  Approvals & Requisitions
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'user' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('user')}
                  style={{ fontSize: '12.5px', padding: '6px 12px' }}
                >
                  User & Access
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'maintenance' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab('maintenance')}
                  style={{ fontSize: '12.5px', padding: '6px 12px' }}
                >
                  Work Order & Maintenance
                </button>
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search actor, tracking #, or detail..."
                  aria-label="Search audit trail"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: '36px', height: '36px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
              <span>Showing {filtered.length} of {entries.length} recorded audit events</span>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ background: 'none', border: 'none', color: '#001f9c', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}
                >
                  Clear search
                </button>
              )}
            </div>
          </div>

          {/* Audit Log Data Table */}
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '15%' }}>WHEN</th>
                  <th scope="col" style={{ width: '20%' }}>ACTOR & ROLE</th>
                  <th scope="col" style={{ width: '22%' }}>ACTION</th>
                  <th scope="col" style={{ width: '15%' }}>CONTROL / RECORD</th>
                  <th scope="col" style={{ width: '28%' }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Filter size={24} color="#cbd5e1" />
                        <div style={{ fontWeight: '500', color: '#334155' }}>No matching audit events found</div>
                        <div style={{ fontSize: '12px' }}>Try adjusting your search keyword or selected event tab.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map(e => {
                    const meta = getActionMeta(e.action);
                    const recordLabel = e.official_tracking_no 
                      || e.ticket_no 
                      || (e.entity === 'user' ? `User #${e.entity_id}` : e.entity_id ? `${e.entity} #${e.entity_id}` : '—');

                    return (
                      <tr key={e.id}>
                        {/* Timestamp */}
                        <td style={{ whiteSpace: 'nowrap', fontSize: '12.5px', color: '#475569' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={13} color="#94a3b8" />
                            <span>{fmtWhen(e.created_at)}</span>
                          </div>
                        </td>

                        {/* Actor & Role */}
                        <td style={{ fontSize: '13px' }}>
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>
                            {e.actor_name || (e.actor_id ? `User #${e.actor_id}` : 'System Automated Process')}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                            {formatRoleLabel(e.actor_role)}
                          </div>
                        </td>

                        {/* Action Badge & Category */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                            <span 
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                padding: '3px 9px', 
                                borderRadius: '6px',
                                fontSize: '12px', 
                                fontWeight: '600',
                                color: meta.color,
                                background: meta.bg,
                                border: `1px solid ${meta.border}`
                              }}
                            >
                              {meta.label}
                            </span>
                            <span style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', tracking: '0.05em', fontWeight: '600', paddingLeft: '2px' }}>
                              {meta.category}
                            </span>
                          </div>
                        </td>

                        {/* Record / Tracking No */}
                        <td style={{ fontSize: '12.5px' }}>
                          {recordLabel !== '—' ? (
                            <span 
                              style={{ 
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', 
                                fontWeight: '600', 
                                color: '#001f9c',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                display: 'inline-block'
                              }}
                            >
                              {recordLabel}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* Details */}
                        <td>
                          <AuditDetail
                            detail={e.details}
                            rawAction={e.action}
                            isOpen={openDetailId === e.id}
                            onToggle={() => setOpenDetailId(openDetailId === e.id ? null : e.id)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer & Pagination */}
          <div style={{ padding: '12px 20px 16px 20px', borderTop: '1px solid #f1f5f9' }}>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              total={filtered.length}
              itemLabel="events"
            />
          </div>
        </div>
      )}
    </div>
  );
};
