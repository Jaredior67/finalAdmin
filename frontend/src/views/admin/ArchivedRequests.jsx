import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Archive,
  Bell,
  CheckCircle2,
  FileText,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { StatusBadge, CategoryPill, UrgencyBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Modal } from '../../components/common/Modal';
import { JobRequestPrintSheet } from '../../components/common/JobRequestPrintSheet';
import { PrintPortal } from '../../components/common/PrintPortal';
import { printDocument } from '../../utils/print';
import { formatTicketDate } from '../../components/common/TimeGreeting';

const formatArchiveDate = (value) => {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const sectionButtonStyle = (active) => ({
  padding: '10px 16px',
  borderRadius: '9px',
  border: active ? '1px solid #001f9c' : '1px solid #e2e8f0',
  background: active ? '#001f9c' : '#ffffff',
  color: active ? '#ffffff' : '#475569',
  fontSize: '12.5px',
  fontWeight: active ? '800' : '600',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
});

const countBadgeStyle = (active) => ({
  fontSize: '11px',
  padding: '1px 7px',
  borderRadius: '999px',
  background: active ? 'rgba(255,255,255,0.22)' : 'var(--bg-sunken)',
  color: active ? '#ffffff' : '#64748b',
  fontWeight: '800',
});

export const ArchivedRequests = () => {
  const {
    requisitions,
    users,
    archivedNotifications,
    archiveRequisition,
    unarchiveRequisition,
    toggleUserStatus,
    archiveNotification,
    restoreNotification,
    deleteNotification,
    ticketSearch: searchTerm,
  } = useData();
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const [activeSection, setActiveSection] = useState('requests');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [accountSearch, setAccountSearch] = useState('');
  const [notificationSearch, setNotificationSearch] = useState('');

  // Detail view state
  const [viewingReq, setViewingReq] = useState(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Confirmation targets
  const [restoreRequestTarget, setRestoreRequestTarget] = useState(null);
  const [accountTarget, setAccountTarget] = useState(null);
  const [restoreNotificationTarget, setRestoreNotificationTarget] = useState(null);
  const [notificationTarget, setNotificationTarget] = useState(null);

  // Post-restore Undo banner state
  const [lastRestored, setLastRestored] = useState(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const undoTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const showUndoBanner = (entry) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setLastRestored(entry);
    undoTimerRef.current = setTimeout(() => {
      setLastRestored(null);
    }, 10000);
  };

  const handleUndoRestore = async (entryToUndo) => {
    const target = entryToUndo || lastRestored;
    if (!target || undoBusy) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoBusy(true);
    try {
      if (target.type === 'request') {
        await archiveRequisition(target.id);
      } else if (target.type === 'account') {
        await toggleUserStatus(target.id);
      } else if (target.type === 'notification') {
        await archiveNotification(target.id);
      }
      setLastRestored(null);
    } finally {
      setUndoBusy(false);
    }
  };

  const archivedItems = useMemo(
    () => requisitions.filter(r => r.isArchived === true),
    [requisitions]
  );

  const archivedAccounts = useMemo(
    () => users.filter(u => String(u.status || '').toLowerCase() === 'inactive'),
    [users]
  );

  const filteredRequests = useMemo(() => {
    const term = String(searchTerm || '').toLowerCase();
    return archivedItems.filter(r => {
      const matchesSearch =
        String(r.controlNo || r.id).toLowerCase().includes(term) ||
        String(r.location || '').toLowerCase().includes(term) ||
        String(r.title || '').toLowerCase().includes(term) ||
        String(r.requestedBy || '').toLowerCase().includes(term);
      const matchesCat = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesCat && matchesStatus;
    }).sort((a, b) => String(b.archivedAt || b.date || '').localeCompare(String(a.archivedAt || a.date || '')));
  }, [archivedItems, searchTerm, categoryFilter, statusFilter]);

  const filteredAccounts = useMemo(() => {
    const term = accountSearch.trim().toLowerCase();
    return archivedAccounts.filter(u => {
      if (!term) return true;
      const haystack = [
        u.name,
        u.firstName,
        u.lastName,
        u.email,
        u.roleTitle,
        u.role,
        u.department,
        u.office,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    }).sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
  }, [archivedAccounts, accountSearch]);

  const filteredArchivedNotifications = useMemo(() => {
    const term = notificationSearch.trim().toLowerCase();
    return archivedNotifications.filter(n => {
      if (!term) return true;
      return `${n.title || ''} ${n.text || ''} ${n.link || ''}`.toLowerCase().includes(term);
    });
  }, [archivedNotifications, notificationSearch]);

  const handleConfirmRestoreRequest = async () => {
    if (!restoreRequestTarget) return;
    const req = restoreRequestTarget;
    const refLabel = req.controlNo || req.id;
    setRestoreRequestTarget(null);
    const ok = await unarchiveRequisition(req.id);
    if (ok !== false) {
      const undoEntry = {
        type: 'request',
        id: req.id,
        label: `Request ${refLabel} restored to active Job Requests.`,
      };
      showUndoBanner(undoEntry);
      toast(`Restored ${refLabel} from archive.`, 'success', {
        actionLabel: 'Undo',
        onAction: () => handleUndoRestore(undoEntry),
      });
    }
  };

  const handleRestoreAccount = async () => {
    if (!accountTarget) return;
    const target = accountTarget;
    const displayName = target.name || target.email;
    setAccountTarget(null);
    try {
      await toggleUserStatus(target.id);
      const undoEntry = {
        type: 'account',
        id: target.id,
        label: `Account ${displayName} has been reactivated.`,
      };
      showUndoBanner(undoEntry);
      toast(`${displayName} has been reactivated.`, 'success', {
        actionLabel: 'Undo',
        onAction: () => handleUndoRestore(undoEntry),
      });
    } catch (err) {
      toast(err?.message || 'Could not reactivate this account.', 'error');
    }
  };

  const handleConfirmRestoreNotification = async () => {
    if (!restoreNotificationTarget) return;
    const notif = restoreNotificationTarget;
    const titleLabel = notif.title || 'Notification';
    setRestoreNotificationTarget(null);
    await restoreNotification(notif.id);
    const undoEntry = {
      type: 'notification',
      id: notif.id,
      label: `"${titleLabel}" restored to your active notification inbox.`,
    };
    showUndoBanner(undoEntry);
    toast(`Restored "${titleLabel}" to inbox.`, 'success', {
      actionLabel: 'Undo',
      onAction: () => handleUndoRestore(undoEntry),
    });
  };

  const tabs = [
    { id: 'requests', label: 'Request Records', icon: FileText, count: archivedItems.length },
    { id: 'accounts', label: 'Personnel Accounts', icon: Users, count: archivedAccounts.length },
    { id: 'notifications', label: 'My Notifications', icon: Bell, count: archivedNotifications.length },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Archive Center</h1>
          <p className="page-subtitle">
            One organized repository for archived request records, personnel accounts, and notifications.
          </p>
        </div>
      </div>

      {/* Archive sections */}
      <div
        className="content-card"
        style={{
          padding: '12px',
          marginBottom: '16px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '4px' }}>
          <Archive size={14} /> Archived
        </span>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              style={sectionButtonStyle(isActive)}
              aria-pressed={isActive}
            >
              <Icon size={14} />
              {tab.label}
              <span style={countBadgeStyle(isActive)}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Post-Restore Undo Banner ─────────────────────────────────────── */}
      {lastRestored && (
        <div
          role="status"
          className="animate-scale-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '10px',
            background: '#0f172a',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.16)',
            fontSize: '13.5px',
            fontWeight: '600',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#34d399" />
            <span>{lastRestored.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              disabled={undoBusy}
              onClick={() => handleUndoRestore(lastRestored)}
              style={{
                background: '#f59e0b',
                color: '#071746',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: '800',
                cursor: undoBusy ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <RotateCcw size={13} />
              {undoBusy ? 'Undoing…' : 'Undo'}
            </button>
            <button
              type="button"
              onClick={() => setLastRestored(null)}
              aria-label="Dismiss undo notice"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'inline-flex',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Archived request records ─────────────────────────────────────── */}
      {activeSection === 'requests' && (
        <>
          <div className="filter-bar">
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
              Search from the top navbar to filter this archive. Click any row to open its read-only record.
            </span>
            <select
              className="select-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="Drawing/Design">Drawing/Design</option>
              <option value="Physical Structures">Physical Structures</option>
              <option value="Electrical">Electrical</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Water/Sanitary">Water/Sanitary</option>
              <option value="Air Conditioning">Air Conditioning</option>
              <option value="Safety & Compliance">Safety &amp; Compliance</option>
              <option value="Urgent Hazard">Urgent Hazard</option>
            </select>

            <select
              className="select-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="Ongoing">Ongoing</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="content-card">
            <div className="table-responsive">
              <table className="data-table data-table-stacked">
                <thead>
                  <tr>
                    <th scope="col">TRACKING NUMBER</th>
                    <th scope="col">WORK TITLE &amp; LOCATION</th>
                    <th scope="col">REQUESTER</th>
                    <th scope="col">CATEGORY</th>
                    <th scope="col">COMPLETION STATUS</th>
                    <th scope="col">ARCHIVED ON</th>
                    <th scope="col" style={{ textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        No archived request records found. Use Archive on a job request or Official Document to move it here.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => (
                      <tr
                        key={req.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setViewingReq(req)}
                        title="Click to view archived request details"
                      >
                        <td data-label="Tracking Number" style={{ fontWeight: '700', color: '#001f9c' }}>{req.controlNo || req.id}</td>
                        <td data-label="Title & Location">
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>{req.title}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{req.location}</div>
                        </td>
                        <td data-label="Requester">
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{req.requestedBy}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{req.department}</div>
                        </td>
                        <td data-label="Category"><CategoryPill category={req.category} /></td>
                        <td data-label="Status"><StatusBadge status={req.status} /></td>
                        <td data-label="Archived On" style={{ color: '#64748b', fontSize: '12.5px' }}>
                          {formatTicketDate(String(req.archivedAt || req.date || '').split(',')[0])}
                        </td>
                        <td className="stacked-actions" data-label="Action" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => { e.stopPropagation(); setRestoreRequestTarget(req); }}
                            title="Restore this request from the archive"
                          >
                            <RotateCcw size={13} />
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Archived personnel accounts ──────────────────────────────────── */}
      {activeSection === 'accounts' && (
        <div className="content-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Archived Personnel Accounts</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Deactivated accounts are preserved for institutional history and can be reactivated without losing their records.
              </div>
            </div>
            <div style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-input"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Search archived accounts..."
                style={{ paddingLeft: '30px', height: '34px', fontSize: '12.5px' }}
              />
            </div>
          </div>

          {!isSuperAdmin && archivedAccounts.length > 0 && (
            <div style={{ margin: '14px 20px 0', padding: '10px 12px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '12px' }}>
              Only the System Administrator can reactivate archived personnel accounts.
            </div>
          )}

          <div className="table-responsive">
            <table className="data-table data-table-stacked">
              <thead>
                <tr>
                  <th scope="col">PERSONNEL</th>
                  <th scope="col">ROLE / POSITION</th>
                  <th scope="col">DEPARTMENT / OFFICE</th>
                  <th scope="col">ARCHIVED ON</th>
                  <th scope="col" style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      No archived personnel accounts found. Archived accounts appear here after deactivation in the Personnel Directory.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map(user => (
                    <tr key={user.id}>
                      <td data-label="Personnel">
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{user.name || user.email}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{user.email}</div>
                      </td>
                      <td data-label="Role / Position">
                        <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155' }}>{user.roleTitle || user.role || 'Personnel'}</div>
                        {user.isSupervisor && (
                          <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: '700' }}>Immediate Supervisor</div>
                        )}
                      </td>
                      <td data-label="Department / Office" style={{ fontSize: '12.5px', color: '#475569' }}>
                        {user.department || user.office || '—'}
                      </td>
                      <td data-label="Archived On" style={{ fontSize: '12.5px', color: '#64748b' }}>
                        {formatArchiveDate(user.updated_at || user.created_at)}
                      </td>
                      <td className="stacked-actions" data-label="Action" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setAccountTarget(user)}
                          disabled={!isSuperAdmin}
                          title={isSuperAdmin ? 'Reactivate this account' : 'Only the System Administrator can reactivate accounts'}
                        >
                          <UserCheck size={13} />
                          Reactivate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Archived notifications ───────────────────────────────────────── */}
      {activeSection === 'notifications' && (
        <div className="content-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>My Archived Notifications</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Archived alerts stay available here without cluttering your active notification inbox.
              </div>
            </div>
            <div style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-input"
                value={notificationSearch}
                onChange={(e) => setNotificationSearch(e.target.value)}
                placeholder="Search archived notifications..."
                style={{ paddingLeft: '30px', height: '34px', fontSize: '12.5px' }}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table data-table-stacked">
              <thead>
                <tr>
                  <th scope="col">NOTIFICATION</th>
                  <th scope="col">ARCHIVED ON</th>
                  <th scope="col" style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredArchivedNotifications.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      No archived notifications found. Use the Archive action in Notifications to move alerts here.
                    </td>
                  </tr>
                ) : (
                  filteredArchivedNotifications.map(notification => (
                    <tr key={notification.id}>
                      <td data-label="Notification">
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{notification.title || 'Notification'}</div>
                        <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px', whiteSpace: 'normal' }}>{notification.text}</div>
                      </td>
                      <td data-label="Archived On" style={{ fontSize: '12.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatArchiveDate(notification.archivedAt || notification.time)}
                      </td>
                      <td className="stacked-actions" data-label="Actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setRestoreNotificationTarget(notification)}
                            title="Restore notification to the inbox"
                          >
                            <RotateCcw size={13} />
                            Restore
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setNotificationTarget(notification)}
                            title="Delete notification permanently"
                            style={{ color: '#b91c1c' }}
                          >
                            <Trash2 size={13} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Archived Request Detail Modal (read-only) ── */}
      <Modal
        isOpen={Boolean(viewingReq)}
        onClose={() => setViewingReq(null)}
        onBack={() => setViewingReq(null)}
        title={`Archived Record — ${viewingReq?.controlNo || viewingReq?.id || ''}`}
        maxWidth="900px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ISAT U Dumangas PDAS — Historical Archive Record
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingReq(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setIsPrintOpen(true); }}
              >
                <Printer size={15} />
                Print / PDF
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const target = viewingReq;
                  setViewingReq(null);
                  setRestoreRequestTarget(target);
                }}
                title="Restore from archive"
                style={{ color: '#64748b' }}
              >
                <RotateCcw size={15} />
                Restore Record
              </button>
            </div>
          </div>
        }
      >
        {viewingReq && (
          <div>
            {/* Summary header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '12px',
              background: 'var(--bg-sunken)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '18px',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tracking No.</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#001f9c' }}>{viewingReq.controlNo || viewingReq.id}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                <div style={{ marginTop: '2px' }}><StatusBadge status={viewingReq.status} /></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urgency</div>
                <div style={{ marginTop: '2px' }}><UrgencyBadge urgency={viewingReq.urgency} /></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</div>
                <div style={{ marginTop: '2px' }}><CategoryPill category={viewingReq.category} /></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requester</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{viewingReq.requestedBy}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{viewingReq.department}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</div>
                <div style={{ fontSize: '13px', color: '#0f172a' }}>{viewingReq.location}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Archived On</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  {formatTicketDate(String(viewingReq.archivedAt || viewingReq.date || '').split(',')[0])}
                </div>
              </div>
              {viewingReq.assignedTo && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned To</div>
                  <div style={{ fontSize: '13px', color: '#0f172a' }}>{viewingReq.assignedTo}</div>
                </div>
              )}
            </div>

            {/* Description */}
            {viewingReq.description && (
              <div style={{ marginBottom: '18px', padding: '12px 16px', background: 'var(--bg-sunken)', borderRadius: '10px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Work Description</div>
                <div style={{ fontSize: '13.5px', color: 'var(--text-primary, #1e293b)', lineHeight: 1.6 }}>{viewingReq.description}</div>
              </div>
            )}

            {/* Completion photo if present */}
            {viewingReq.completionPhotoUrl && (
              <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <img
                  src={viewingReq.completionPhotoUrl}
                  alt="Completion photo"
                  style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #a7f3d0' }}
                />
                <span style={{ fontSize: '13px', color: '#047857', fontWeight: '700' }}>Completion photo on record</span>
              </div>
            )}

            {/* Official form preview */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', background: 'var(--bg-sunken)' }}>
                <FileText size={15} color="#001f9c" />
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Official Form Preview (QF-PDAS-DC-01)
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b', fontWeight: '600', background: 'var(--bg-sunken)', padding: '2px 8px', borderRadius: '999px', border: '1px solid #e2e8f0' }}>
                  Read-only — Archived Record
                </span>
              </div>
              <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '20px', background: 'var(--bg-sunken)' }}>
                <JobRequestPrintSheet req={viewingReq} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Print-only sheet */}
      <Modal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        onBack={() => setIsPrintOpen(false)}
        title="Print Official QF-PDAS-DC-01 Form"
        maxWidth="800px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsPrintOpen(false)}>Close</button>
            <button type="button" className="btn btn-primary" onClick={() => printDocument()}>
              <Printer size={15} /> Print / Save PDF
            </button>
          </div>
        }
      >
        {viewingReq && <JobRequestPrintSheet req={viewingReq} />}
      </Modal>

      {viewingReq && (
        <PrintPortal active={isPrintOpen}>
          <JobRequestPrintSheet req={viewingReq} />
        </PrintPortal>
      )}

      <ConfirmDialog
        isOpen={Boolean(restoreRequestTarget)}
        onClose={() => setRestoreRequestTarget(null)}
        onConfirm={handleConfirmRestoreRequest}
        title="Restore Request Record?"
        message={restoreRequestTarget
          ? `Restore ${restoreRequestTarget.controlNo || restoreRequestTarget.id} (${restoreRequestTarget.title || restoreRequestTarget.category || 'Job Request'}) back to active Job Requests?`
          : ''}
        confirmText="Restore Record"
        isDanger={false}
      />

      <ConfirmDialog
        isOpen={Boolean(accountTarget)}
        onClose={() => setAccountTarget(null)}
        onConfirm={handleRestoreAccount}
        title="Reactivate Personnel Account?"
        message={accountTarget
          ? `Reactivate ${accountTarget.name || accountTarget.email}? They will regain system access and their historical records will remain intact.`
          : ''}
        confirmText="Reactivate Account"
        isDanger={false}
      />

      <ConfirmDialog
        isOpen={Boolean(restoreNotificationTarget)}
        onClose={() => setRestoreNotificationTarget(null)}
        onConfirm={handleConfirmRestoreNotification}
        title="Restore Notification?"
        message={restoreNotificationTarget
          ? `Restore "${restoreNotificationTarget.title || 'this notification'}" back to your active notification inbox?`
          : ''}
        confirmText="Restore Notification"
        isDanger={false}
      />

      <ConfirmDialog
        isOpen={Boolean(notificationTarget)}
        onClose={() => setNotificationTarget(null)}
        onConfirm={() => {
          if (notificationTarget) deleteNotification(notificationTarget.id);
          setNotificationTarget(null);
        }}
        title="Delete Archived Notification?"
        message="This permanently removes the notification from your archive. This action cannot be undone."
        confirmText="Delete Permanently"
        isDanger
      />
    </div>
  );
};
