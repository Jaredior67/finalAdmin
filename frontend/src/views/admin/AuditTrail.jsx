import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, RotateCcw } from 'lucide-react';
import { apiGetAuditLog } from '../../backend/api';
import { Pagination } from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';

const fmtWhen = (value) => {
  if (!value) return '—';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export const AuditTrail = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const loadTrail = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await apiGetAuditLog(500);
      setEntries(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setLoadError(err.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTrail(); }, [loadTrail]);
  useEffect(() => { setPage(1); }, [searchTerm]);

  const filtered = entries.filter(e => {
    const q = searchTerm.toLowerCase();
    return !q
      || String(e.action || '').toLowerCase().includes(q)
      || String(e.actor_name || '').toLowerCase().includes(q)
      || String(e.entity_id || '').toLowerCase().includes(q)
      || String(e.details || '').toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Trail</h1>
          <p className="page-subtitle">Who changed what, and when — status changes, approvals, archive, and user actions</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={loadTrail} disabled={loading}>
          <RotateCcw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="content-card" style={{ padding: '20px' }}>
          <TableSkeleton rows={6} cols={4} />
        </div>
      ) : loadError && entries.length === 0 ? (
        <EmptyState
          title="Audit trail unavailable"
          description={loadError}
          action={<button type="button" className="btn btn-secondary btn-sm" onClick={loadTrail}>Retry</button>}
        />
      ) : (
        <div className="content-card">
          <div className="card-header" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '16px 20px' }}>
            <ShieldCheck size={16} color="#001f9c" />
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search action, actor, ticket, or detail..."
                aria-label="Search audit trail"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
              />
            </div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{filtered.length} of {entries.length} events</span>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">WHEN</th>
                  <th scope="col">ACTOR</th>
                  <th scope="col">ACTION</th>
                  <th scope="col">RECORD</th>
                  <th scope="col">DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No audit events match the current search.
                    </td>
                  </tr>
                ) : (
                  rows.map(e => (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12.5px', color: '#64748b' }}>{fmtWhen(e.created_at)}</td>
                      <td style={{ fontSize: '13px', fontWeight: '500', color: '#0f172a' }}>
                        {e.actor_name || `User #${e.actor_id}` || 'System'}
                        {e.actor_role && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '400' }}>{e.actor_role}</div>}
                      </td>
                      <td><span className="category-pill">{e.action}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12.5px', color: '#001f9c' }}>{e.entity_id || '—'}</td>
                      <td style={{ fontSize: '12.5px', color: '#475569', maxWidth: '320px' }}>{e.details || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0 20px 16px 20px' }}>
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
