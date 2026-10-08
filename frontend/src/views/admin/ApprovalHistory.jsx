import React, { useEffect, useMemo, useState } from 'react';
import { Search, CheckCircle2, XCircle, ShieldCheck, Download, History, AlertTriangle } from 'lucide-react';
import { toLocalISODate } from '../../context/DataContext';
import { apiGetAuditLog } from '../../backend/api';
import { Modal } from '../../components/common/Modal';

/* ---------------------------------------------------------------------------
   Approval decisions only — who approved, returned or rejected each request,
   and when.

   This page used to carry "& Audit Trail" in its title and read every
   `audit_log` row, collapsing logins, account changes and archive flags into a
   "Logged" badge. The Audit Trail page reads the same endpoint, so the two
   admin menu entries rendered the same table twice. Audit Trail is now the
   only full-trail view and admin navigation no longer links here.

   Decisions already land in `audit_log` inside the same transaction as the
   change itself, so this reads them back rather than trusting a local cache.
   --------------------------------------------------------------------------- */

const APPROVED = 'Approved';
const REJECTED = 'Rejected';

/**
 * Reduce an `audit_log` action to the decision this table reports, or `null`
 * when it is not a decision at all — a login, an account change, an archive
 * flag. Returning null is what keeps those rows out: they belong on the Audit
 * Trail page, and listing them here too is what made the pages duplicates.
 */
const decisionFor = (action = '') => {
  const a = String(action);
  if (/\.(rejected|returned)$/.test(a)) return REJECTED;
  if (/\.(approved|auto_confirmed)$/.test(a)) return APPROVED;
  return null;
};

/** One `audit_log` row → one row of this table. */
const mapAuditRow = (row) => ({
  id: row.id,
  controlNo:
    row.official_tracking_no ||
    row.ticket_no ||
    (row.entity === 'registration_request' ? '' : row.entity_id) ||
    '',
  action: decisionFor(row.action),
  actionBy: row.actor_name ? `${row.actor_name} (${row.actor_role || 'user'})` : 'System',
  timestamp: row.created_at
    ? new Date(row.created_at).toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
      })
    : '',
  remarks: row.details || row.action || '',
  // Kept for the CSV and the search box: the raw action code is the most
  // precise thing an auditor can look for.
  rawAction: row.action || ''
});

export const ApprovalHistory = () => {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  // The audit log is an official decision record, so the download is gated
  // behind an explicit confirmation rather than firing on a stray click.
  const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);

  useEffect(() => {
    let live = true;
    apiGetAuditLog(300)
      .then((data) => {
        if (!live) return;
        // Decisions only. Everything else — logins, account changes, archive
        // flags — belongs on the Audit Trail page, and listing it here too is
        // what made the two admin pages render the same rows twice.
        const decisions = (Array.isArray(data) ? data : []).filter((r) => decisionFor(r.action));
        setRows(decisions.map(mapAuditRow));
        setLoadError('');
      })
      .catch((err) => {
        if (!live) return;
        setRows(null);
        setLoadError(err?.message || 'The audit trail could not be loaded.');
      });
    return () => { live = false; };
  }, []);

  // Memoised so the dependency below points at a stable array; built inline it
  // would be a fresh `[]` on every render and defeat the memo entirely. `null`
  // means the request has not succeeded yet, so the table shows its empty state
  // rather than a fallback that nothing in the codebase ever wrote to.
  const source = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  const filteredHistory = useMemo(() => source.filter(item => {
    const controlNo = String(item.controlNo || '');
    const remarks = String(item.remarks || '');
    const actionBy = String(item.actionBy || '');
    const action = String(item.action || '');
    const matchesSearch =
      controlNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      remarks.toLowerCase().includes(searchTerm.toLowerCase()) ||
      actionBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.rawAction || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'all' || action.toLowerCase() === actionFilter.toLowerCase();
    return matchesSearch && matchesAction;
  }), [source, searchTerm, actionFilter]);

  // How many records the preview shows before truncating — enough to verify
  // contents without duplicating the table already sitting behind the dialog.
  const PREVIEW_ROWS = 10;

  // One builder feeds both the on-screen preview and the download, so the file
  // can never drift from what was actually shown before it was saved.
  const buildCsvLines = () => {
    const headers = ['Approval ID', 'Tracking Number', 'Decision', 'Approver', 'Timestamp', 'Remarks'];
    const csvRows = filteredHistory.map(h => [
      h.id || '',
      h.controlNo || '',
      h.action || '',
      h.actionBy || '',
      `"${String(h.timestamp || '').replaceAll('"', '""')}"`,
      `"${String(h.remarks || '').replaceAll('"', '""')}"`
    ]);
    return [headers.join(','), ...csvRows.map(e => e.join(','))];
  };

  const exportFileName = `PDAS_Approval_Audit_${toLocalISODate(new Date())}.csv`;

  const exportCSV = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' + buildCsvLines().join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', exportFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const decisionBadge = (decision) => {
    if (decision === APPROVED) {
      return (
        <span className="badge status-completed">
          <CheckCircle2 size={12} />
          Authorized
        </span>
      );
    }
    if (decision === REJECTED) {
      return (
        <span className="badge status-rejected">
          <XCircle size={12} />
          Disapproved
        </span>
      );
    }
    return (
      <span className="badge status-under-review">
        <History size={12} />
        Logged
      </span>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Approval History</h1>
          <p className="page-subtitle">Official approval and rejection decisions, timestamps, and authorization remarks</p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setIsExportConfirmOpen(true)}
        >
          <Download size={15} />
          Export Decisions (CSV)
        </button>
      </div>

      {loadError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px',
          borderRadius: '10px', background: '#fef3c7', border: '1px solid #f59e0b',
          color: '#92400e', fontSize: '13px', marginBottom: '16px'
        }}>
          <AlertTriangle size={16} />
          <span>
            The server approval history could not be loaded ({loadError}). Nothing is
            shown below until it reconnects.
          </span>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by tracking number, remark, or approver..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="all">All Decisions</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Disapproved / Rejected</option>
        </select>
      </div>

      <div className="content-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>LOG ID</th>
                <th>TRACKING NUMBER</th>
                <th>DECISION</th>
                <th>AUTHORIZED BY</th>
                <th>TIMESTAMP</th>
                <th>ADMIN REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No approval records matching criteria.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(log => (
                  <tr key={log.id ?? `${log.timestamp}-${log.actionBy}`}>
                    <td style={{ fontWeight: '700', color: '#64748b' }}>
                      {log.id ?? '—'}
                    </td>
                    <td style={{ fontWeight: '700', color: '#001f9c' }}>
                      {log.controlNo || '—'}
                    </td>
                    <td>
                      {decisionBadge(log.action)}
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={14} color="#001f9c" />
                        {log.actionBy}
                      </div>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '12.5px' }}>
                      {log.timestamp}
                    </td>
                    <td style={{ color: '#334155', maxWidth: '300px' }}>
                      {log.remarks}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isExportConfirmOpen}
        onClose={() => setIsExportConfirmOpen(false)}
        title="Export audit log — preview"
        maxWidth="820px"
        footer={(
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsExportConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={filteredHistory.length === 0}
              onClick={() => {
                setIsExportConfirmOpen(false);
                exportCSV();
              }}
            >
              <Download size={15} />
              Download CSV
            </button>
          </>
        )}
      >
        <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.6, margin: '0 0 14px' }}>
          This is exactly what will be written to{' '}
          <strong style={{ color: '#0f172a' }}>{exportFileName}</strong>. Nothing on the server
          is changed — a copy is saved to your device.
        </p>

        {filteredHistory.length === 0 ? (
          <p style={{ fontSize: '13.5px', color: '#64748b', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            No records match the current search and decision filter, so there is nothing to export.
          </p>
        ) : (
          <>
            <pre
              style={{
                margin: 0,
                padding: '14px 16px',
                background: 'var(--bg-sunken)',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
                fontSize: '12px',
                lineHeight: 1.7,
                color: '#1e293b',
                whiteSpace: 'pre',
                overflow: 'auto',
                maxHeight: '300px'
              }}
            >
              {buildCsvLines().slice(0, PREVIEW_ROWS + 1).join('\n')}
            </pre>

            {filteredHistory.length > PREVIEW_ROWS && (
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: '10px 0 0' }}>
                Showing the first {PREVIEW_ROWS} of {filteredHistory.length} records. The header row
                is included above; the downloaded file contains all {filteredHistory.length}.
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};
