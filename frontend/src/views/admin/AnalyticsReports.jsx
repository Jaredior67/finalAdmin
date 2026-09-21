import React, { useState } from 'react';
import { BarChart3, TrendingUp, Clock, CheckCircle2, Download, Filter, RotateCcw } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { FormField, TextInput, SelectInput } from '../../components/ui/FormField';

export const AnalyticsReports = () => {
  const { requisitions, totalRequisitions, completedRepairs, monthlyRequestTotals, evaluations } = useData();

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

  const categories = [
    { name: 'Electrical', count: filteredRequisitions.filter(r => r.category.includes('Electrical')).length, color: '#3b82f6' },
    { name: 'HVAC / Aircon', count: filteredRequisitions.filter(r => r.category.includes('HVAC')).length, color: '#06b6d4' },
    { name: 'Plumbing', count: filteredRequisitions.filter(r => r.category.includes('Plumbing')).length, color: '#10b981' },
    { name: 'Carpentry', count: filteredRequisitions.filter(r => r.category.includes('Carpentry')).length, color: '#f59e0b' },
    { name: 'IT / Network', count: filteredRequisitions.filter(r => r.category.includes('IT')).length, color: '#8b5cf6' },
  ];

  const totalCatCount = Math.max(filteredRequisitions.length, 1);

  const buildingVolume = uniqueLocations.map(loc => {
    const count = filteredRequisitions.filter(r => r.location === loc).length;
    return { bldg: loc, count, pct: Math.round((count / totalCatCount) * 100) };
  });
  const evaluationCriteria = [
    ['functionalSuitability', 'Functional Suitability'],
    ['usability', 'Usability'],
    ['reliability', 'Reliability'],
    ['performanceEfficiency', 'Performance Efficiency']
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
    link.download = `pdas-requests-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Operational Reports</h1>
          <p className="page-subtitle">Campus facility performance, repair turnaround SLAs, and maintenance distribution</p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={exportRequests}
        >
          <Download size={15} />
          Export Request Data
        </button>
      </div>

      {/* Report Filters: date range, status, location */}
      <div className="content-card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Filter size={15} color="#001f9c" />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Filter Report</span>
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

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
        <div className="content-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Avg Resolution SLA</span>
            <Clock size={20} color="#001f9c" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>28.4 hrs</div>
          <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px', fontWeight: '600' }}>
            ⚡ 18% faster than previous quarter target
          </div>
        </div>

        <div className="content-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Completion Efficiency</span>
            <CheckCircle2 size={20} color="#059669" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>
            {totalRequisitions > 0 ? Math.round((completedRepairs / totalRequisitions) * 100) : 100}%
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {completedRepairs} of {totalRequisitions} jobs resolved
          </div>
        </div>

        <div className="content-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Requests per Month</span>
            <BarChart3 size={20} color="#001f9c" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {Object.entries(monthlyRequestTotals).sort(([a], [b]) => b.localeCompare(a)).map(([month, count]) => (
              <div key={month} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}><span>{month}</span><strong>{count} requests</strong></div>
            ))}
          </div>
        </div>
      </div>

      {/* Breakdown Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Category Breakdown Bar */}
        <div className="content-card" style={{ padding: '24px' }}>
          <h2 className="card-title" style={{ marginBottom: '20px' }}>Workload Distribution by Category</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {categories.map(cat => {
              const pct = Math.round((cat.count / totalCatCount) * 100);
              return (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                    <span>{cat.name}</span>
                    <span>{cat.count} requests ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(pct, 8)}%`, height: '100%', background: cat.color, borderRadius: '4px' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Building Requisition Volume */}
        <div className="content-card" style={{ padding: '24px' }}>
          <h2 className="card-title" style={{ marginBottom: '20px' }}>Facility Volume by Campus Building</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {buildingVolume.length === 0 && (
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No requests match the current filters.</p>
            )}
            {buildingVolume.map(b => (
              <div key={b.bldg}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                  <span>{b.bldg}</span>
                  <span style={{ color: '#64748b' }}>{b.count} requests</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(b.pct, 4)}%`, height: '100%', background: '#001f9c', borderRadius: '4px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="content-card" style={{ padding: '24px', marginTop: '24px' }}>
        <h2 className="card-title" style={{ marginBottom: '16px' }}>ISO/IEC 25010 Service Evaluation Results</h2>
        {evaluations.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No requester evaluations have been submitted.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
              {evaluationCriteria.map(([key, label]) => (
                <div key={key} style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>{label}</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{evaluationAverage(key)}<span style={{ fontSize: '12px', color: '#64748b' }}> / 5</span></div>
                </div>
              ))}
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>CATEGORY</th><th>LOCATION</th><th>RESOLUTION STATUS</th><th>RESPONSES</th></tr></thead>
                <tbody>{evaluationGroups.map(group => <tr key={`${group.category}-${group.location}-${group.resolutionStatus}`}><td>{group.category}</td><td>{group.location}</td><td>{group.resolutionStatus}</td><td>{group.count}</td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
