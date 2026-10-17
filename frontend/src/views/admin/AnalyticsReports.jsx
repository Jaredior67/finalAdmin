import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, CheckCircle2, Download, Filter, RotateCcw, WifiOff, TrendingUp, Calendar } from 'lucide-react';
import { useData, toLocalISODate } from '../../context/DataContext';
import { apiGetJobRequests, apiGetEvaluations } from '../../backend/api';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { FormField, TextInput, SelectInput } from '../../components/ui/FormField';
import { PageHeader } from '../../components/common/PageHeader';

// Backend (MySQL) rows use snake_case — normalize to the report shape.
const mapJobRow = (r) => ({
  controlNo: r.ticket_no || r.controlNo,
  date: String(r.created_at || r.date || '').slice(0, 10),
  location: [r.building, r.room].filter(Boolean).join(' - ') || r.location || '—',
  category: r.category || 'General',
  urgency: r.urgency_level || r.urgency || 'Medium Risk',
  status: r.status,
  requestType: r.request_type || r.requestType || 'Standard Request',
  requestedBy: r.requester_name || r.requestedBy || '—',
});

const mapEvalRow = (e) => ({
  functionalSuitability: e.functional_suitability ?? e.functionalSuitability,
  usability: e.usability,
  reliability: e.reliability,
  performanceEfficiency: e.performance_efficiency ?? e.performanceEfficiency,
  security: e.security,
  category: e.category || 'General',
  location: e.building || e.location || 'Unknown',
  resolutionStatus: e.resolution_status || e.resolutionStatus || 'Unknown',
});

const fmtMonth = (ym) => {
  const d = new Date(`${ym}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? ym : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

/* ── Shared card style — matches ExecutiveDashboard stat cards ── */
const statCardStyle = (borderColor) => ({
  background: '#ffffff',
  borderRadius: '10px',
  padding: '14px 16px',
  border: '1px solid #e2e8f0',
  borderLeft: `3px solid ${borderColor}`,
  boxShadow: 'var(--shadow-subtle)',
  transition: 'box-shadow 0.15s, border-color 0.15s',
});

/* ── Consistent section card — matches dashboard content cards ── */
const sectionCardStyle = {
  background: '#ffffff',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  padding: '20px',
  boxShadow: 'var(--shadow-subtle)',
};

export const AnalyticsReports = () => {
  const { requisitions: localRequisitions, evaluations: localEvaluations } = useData();

  // Live backend data with on-device fallback (works offline).
  const [liveRequests, setLiveRequests] = useState(null);
  const [liveEvals, setLiveEvals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [usingLive, setUsingLive] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [jr, ev] = await Promise.all([apiGetJobRequests(), apiGetEvaluations()]);
      /* /job-requests answers { rows, total, limit, offset } while /evaluations
         still answers a bare array. Unwrapping both defensively means a shape
         change on either endpoint degrades to "no live data" instead of
         throwing and putting the "Live server unreachable" banner up on every
         visit — which is exactly what `(jr || []).map` did, because `jr` was a
         truthy object and `.map` is not a function. */
      setLiveRequests((Array.isArray(jr) ? jr : (jr?.rows || [])).map(mapJobRow));
      setLiveEvals((Array.isArray(ev) ? ev : (ev?.rows || ev?.evaluations || [])).map(mapEvalRow));
      setUsingLive(true);
    } catch (err) {
      setLoadError(err.message || 'Could not reach the server.');
      setUsingLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const requisitions = liveRequests || localRequisitions;
  const evaluations = liveEvals || localEvaluations;

  // Monthly totals derived from whichever source is active.
  const monthlyRequestTotals = {};
  requisitions.forEach(r => {
    const m = String(r.date || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(m)) monthlyRequestTotals[m] = (monthlyRequestTotals[m] || 0) + 1;
  });

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  const uniqueStatuses = [...new Set(requisitions.map(r => r.status).filter(Boolean))];
  const uniqueLocations = [...new Set(requisitions.map(r => r.location).filter(Boolean))].sort();

  const filteredRequisitions = requisitions.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (locationFilter !== 'all' && r.location !== locationFilter) return false;
    if (dateFrom && String(r.date || '') < dateFrom) return false;
    if (dateTo && String(r.date || '') > dateTo) return false;
    return true;
  });

  const isFiltered = dateFrom !== '' || dateTo !== '' || statusFilter !== 'all' || locationFilter !== 'all';

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
    setLocationFilter('all');
  };

  const categoryCounts = {};
  filteredRequisitions.forEach(r => {
    const name = r.category || 'General';
    categoryCounts[name] = (categoryCounts[name] || 0) + 1;
  });
  const categories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const totalCatCount = Math.max(filteredRequisitions.length, 1);
  const filteredCompleted = filteredRequisitions.filter(r => r.status === 'Completed').length;
  const completionRate = filteredRequisitions.length > 0 ? Math.round((filteredCompleted / filteredRequisitions.length) * 100) : 0;

  const buildingVolume = uniqueLocations.map(loc => {
    const count = filteredRequisitions.filter(r => r.location === loc).length;
    return { bldg: loc, count, pct: Math.round((count / totalCatCount) * 100) };
  });
  const evaluationCriteria = [
    ['functionalSuitability', 'Functional Suitability'],
    ['usability', 'Usability'],
    ['reliability', 'Reliability'],
    ['performanceEfficiency', 'Performance Efficiency'],
    ['security', 'Security']
  ];
  const evaluationAverage = (key, rows = evaluations) => {
    const values = rows.map(item => Number(item[key])).filter(value => value > 0);
    return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2) : '—';
  };
  const evaluationGroups = Object.values(evaluations.reduce((groups, item) => {
    const groupKey = `${item.category || 'General'}|${item.location || 'Unknown'}|${item.resolutionStatus || 'Unknown'}`;
    groups[groupKey] = groups[groupKey] || { ...item, count: 0 };
    groups[groupKey].count += 1;
    return groups;
  }, {}));

  const exportRequests = () => {
    const headers = ['Tracking Number', 'Date', 'Location', 'Category', 'Request Type', 'Urgency', 'Status', 'Requested By'];
    const rows = filteredRequisitions.map(request => [
      request.controlNo,
      request.date,
      request.location,
      request.category,
      request.requestType || 'Standard Request',
      request.urgency,
      request.status,
      request.requestedBy
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value || '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `pdas-requests-${toLocalISODate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>

      {/* Page Header — same component the dashboard uses */}
      <PageHeader
        breadcrumbs={['PDAS Administration', 'Analytics & Reports']}
        title="Analytics & Operational Reports"
        description="Request volumes, completion, and service evaluation"
        action={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportRequests}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            Export Request Data
          </button>
        }
      />

      {/* Loading state */}
      {loading && (
        <div style={sectionCardStyle}>
          <TableSkeleton rows={4} cols={3} />
        </div>
      )}

      {/* Offline fallback banner */}
      {!loading && !usingLive && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '14px',
          padding: '14px 20px'
        }}>
          <WifiOff size={16} color="#b45309" />
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#92400e', flex: '1 1 auto', minWidth: '200px' }}>
            Live server unreachable{loadError ? ` (${loadError})` : ''}. Showing on-device data.
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadReports}>
            Retry Live Data
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && usingLive && requisitions.length === 0 && (
        <EmptyState
          title="No requests in the database"
          description="Filed requests will appear here with live totals, breakdowns, and evaluation results."
        />
      )}

      {/* ── Stat Cards — same grid & accent-border treatment as the dashboard ── */}
      {!loading && (requisitions.length > 0 || !usingLive) && (
        <div className="admin-stats-grid" style={{ display: 'grid', gap: '10px' }}>
          {/* Requests in View */}
          <div
            style={statCardStyle('#001f9c')}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requests in View</span>
              <Filter size={18} color="#001f9c" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{filteredRequisitions.length}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>of {requisitions.length} total requests</div>
          </div>

          {/* Completion Rate */}
          <div
            style={statCardStyle('#10b981')}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Completion Rate</span>
              <CheckCircle2 size={18} color="#059669" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: completionRate > 0 ? '#047857' : '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{completionRate}%</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{filteredCompleted} of {filteredRequisitions.length} completed</div>
          </div>

          {/* Completed Requests */}
          <div
            style={statCardStyle('#6366f1')}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Completed Requests</span>
              <TrendingUp size={18} color="#6366f1" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{filteredCompleted}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>out of {filteredRequisitions.length} in current view</div>
          </div>

          {/* Categories */}
          <div
            style={statCardStyle('#f59e0b')}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Categories</span>
              <BarChart3 size={18} color="#d97706" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{categories.length}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>service types tracked</div>
          </div>

          {/* Evaluation Responses */}
          <div
            style={statCardStyle('#ef4444')}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Evaluations</span>
              <CheckCircle2 size={18} color="#ef4444" />
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: evaluations.length > 0 ? '#b91c1c' : '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{evaluations.length}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>ISO 25010 responses</div>
          </div>
        </div>
      )}

      {/* ── Monthly Volume Strip — same card treatment as dashboard ── */}
      {!loading && (requisitions.length > 0 || !usingLive) && Object.keys(monthlyRequestTotals).length > 0 && (
        <div style={sectionCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#001f9c" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Requests per Month</h3>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(monthlyRequestTotals).sort(([a], [b]) => b.localeCompare(a)).map(([month, count]) => {
              const maxCount = Math.max(...Object.values(monthlyRequestTotals), 1);
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={month} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', minWidth: '90px' }}>{fmtMonth(month)}</span>
                  <div style={{ flex: 1, height: '8px', background: 'var(--bg-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(pct, 4)}%`, height: '100%', background: '#001f9c', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', minWidth: '80px', textAlign: 'right' }}>{count} requests</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filter Report — consistent card ── */}
      <div style={{ ...sectionCardStyle, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Filter size={15} color="#001f9c" />
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Filter Report</span>
          <span style={{ fontSize: '12px', fontWeight: '400', color: '#64748b' }}>
            Showing {filteredRequisitions.length} of {requisitions.length} requests
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
          <FormField label="Date from" htmlFor="report-date-from" style={{ marginBottom: 0 }}>
            <TextInput
              id="report-date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ height: '38px' }}
            />
          </FormField>
          <FormField label="Date to" htmlFor="report-date-to" style={{ marginBottom: 0 }}>
            <TextInput
              id="report-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ height: '38px' }}
            />
          </FormField>
          <FormField label="Status" htmlFor="report-status" style={{ marginBottom: 0 }}>
            <SelectInput
              id="report-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: '38px', minWidth: '170px' }}
            >
              <option value="all">All statuses</option>
              {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          </FormField>
          <FormField label="Location" htmlFor="report-location" style={{ marginBottom: 0 }}>
            <SelectInput
              id="report-location"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              style={{ height: '38px', minWidth: '200px' }}
            >
              <option value="all">All locations</option>
              {uniqueLocations.map(l => <option key={l} value={l}>{l}</option>)}
            </SelectInput>
          </FormField>
          {isFiltered && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters} style={{ height: '38px' }}>
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Breakdown Charts — two-column grid matching dashboard layout ── */}
      {!loading && (requisitions.length > 0 || !usingLive) && (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Category Breakdown */}
        <div style={sectionCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BarChart3 size={18} color="#001f9c" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Requests by Category</h3>
          </div>
          {categories.length === 0 && (
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No requests match the current filters.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {categories.map(cat => {
              const pct = Math.round((cat.count / totalCatCount) * 100);
              return (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                    <span style={{ color: '#0f172a' }}>{cat.name}</span>
                    <span style={{ color: '#64748b' }}>{cat.count} requests ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(pct, 4)}%`, height: '100%', background: '#001f9c', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Building Request Volume */}
        <div style={sectionCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BarChart3 size={18} color="#6366f1" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Requests by Campus Building</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {buildingVolume.length === 0 && (
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No requests match the current filters.</p>
            )}
            {buildingVolume.map(b => (
              <div key={b.bldg}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                  <span style={{ color: '#0f172a' }}>{b.bldg}</span>
                  <span style={{ color: '#64748b' }}>{b.count} requests</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-muted)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(b.pct, 4)}%`, height: '100%', background: '#6366f1', borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ISO/IEC 25010 Evaluation Section ── */}
      <div style={sectionCardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <CheckCircle2 size={18} color="#059669" />
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>ISO/IEC 25010 Service Evaluation Results</h3>
        </div>
        {evaluations.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No request evaluations have been submitted.</p>
        ) : (
          <>
            {/* Score cards — same accent-border treatment as the stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
              {evaluationCriteria.map(([key, label]) => {
                const avg = evaluationAverage(key);
                const numAvg = parseFloat(avg);
                const accentColor = !isNaN(numAvg)
                  ? numAvg >= 4 ? '#10b981' : numAvg >= 3 ? '#f59e0b' : '#ef4444'
                  : '#64748b';
                return (
                  <div key={key} style={statCardStyle(accentColor)}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {avg}<span style={{ fontSize: '12px', color: '#64748b', fontWeight: '400' }}> / 5</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Evaluation detail table */}
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table className="table-nowrap" style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid #e2e8f0' }}>
                    <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>CATEGORY</th>
                    <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>LOCATION</th>
                    <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>RESOLUTION STATUS</th>
                    <th scope="col" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>RESPONSES</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluationGroups.map(group => (
                    <tr
                      key={`${group.category}-${group.location}-${group.resolutionStatus}`}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: '500', color: '#0f172a' }}>{group.category}</td>
                      <td style={{ padding: '12px 14px', color: '#334155' }}>{group.location}</td>
                      <td style={{ padding: '12px 14px', color: '#334155' }}>{group.resolutionStatus}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{group.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
};
