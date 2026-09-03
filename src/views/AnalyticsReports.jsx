import React from 'react';
import { BarChart3, TrendingUp, Clock, CheckCircle2, Download } from 'lucide-react';
import { useData } from '../context/DataContext';

export const AnalyticsReports = () => {
  const { requisitions, totalRequisitions, completedRepairs, monthlyRequestTotals } = useData();

  const categories = [
    { name: 'Electrical', count: requisitions.filter(r => r.category.includes('Electrical')).length, color: '#3b82f6' },
    { name: 'HVAC / Aircon', count: requisitions.filter(r => r.category.includes('HVAC')).length, color: '#06b6d4' },
    { name: 'Plumbing', count: requisitions.filter(r => r.category.includes('Plumbing')).length, color: '#10b981' },
    { name: 'Carpentry', count: requisitions.filter(r => r.category.includes('Carpentry')).length, color: '#f59e0b' },
    { name: 'IT / Network', count: requisitions.filter(r => r.category.includes('IT')).length, color: '#8b5cf6' },
  ];

  const totalCatCount = Math.max(requisitions.length, 1);

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
          onClick={() => alert('Executive Summary PDF generation initiated.')}
        >
          <Download size={15} />
          Export Executive Report
        </button>
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
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Requests Per Month</span>
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
            {[
              { bldg: 'CEA Building (Engineering & Arch)', count: 2, pct: 50 },
              { bldg: 'Admin Hall & Executive Offices', count: 1, pct: 25 },
              { bldg: 'University Library Services', count: 1, pct: 25 },
              { bldg: 'Tech Lab 105 & Workshops', count: 1, pct: 25 },
              { bldg: 'Campus Gymnasium & Grounds', count: 0, pct: 0 },
            ].map(b => (
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
    </div>
  );
};
