import React, { useState, useMemo } from 'react';
import {
  Landmark,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Filter,
  BarChart3,
  TrendingUp,
  Star,
  Building,
  Calendar,
  Layers,
  Award
} from 'lucide-react';
import { useData, toLocalISODate } from '../../context/DataContext';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';

const statCardStyle = (accentColor) => ({
  background: '#ffffff',
  borderRadius: '12px',
  padding: '16px 18px',
  border: '1px solid #e2e8f0',
  borderLeft: `4px solid ${accentColor}`,
  boxShadow: 'var(--shadow-subtle, 0 1px 3px rgba(0,0,0,0.05))',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  cursor: 'default',
});

const sectionCardStyle = {
  background: '#ffffff',
  borderRadius: '14px',
  border: '1px solid #e2e8f0',
  padding: '22px',
  boxShadow: 'var(--shadow-subtle, 0 1px 3px rgba(0,0,0,0.05))',
};

export const CampusAdminAnalytics = () => {
  const { requisitions = [], evaluations = [] } = useData();

  const [dateRange, setDateRange] = useState('all'); // 'all' | '30' | '90' | 'year'
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Filter requests according to time window
  const filteredRequisitions = useMemo(() => {
    let list = requisitions.filter(r => !r.isArchived);

    if (dateRange !== 'all') {
      const now = new Date();
      const cutoffDays = dateRange === '30' ? 30 : dateRange === '90' ? 90 : 365;
      const cutoff = new Date(now.getTime() - cutoffDays * 24 * 60 * 60 * 1000);
      list = list.filter(r => {
        if (!r.date) return true;
        const d = new Date(r.date);
        return isNaN(d.getTime()) || d >= cutoff;
      });
    }

    if (departmentFilter !== 'all') {
      list = list.filter(r => (r.department || r.office || 'Unknown') === departmentFilter);
    }

    return list;
  }, [requisitions, dateRange, departmentFilter]);

  // Governance & Approvals Metrics
  const totalRequisitions = filteredRequisitions.length;
  
  // Requisitions that reached campus administrator level
  const campusAdminPool = useMemo(() => {
    return filteredRequisitions.filter(r => 
      r.campus_admin_approved || 
      r.campusAdminApproved || 
      r.status === 'Approved' || 
      r.status === 'Pending Final Approval' || 
      r.status === 'Awaiting Signatures' ||
      r.finalAction?.status === 'Approved' ||
      r.rejectionStage === 'approver' ||
      (r.status === 'Completed' || r.status === 'Ongoing')
    );
  }, [filteredRequisitions]);

  const approvedCount = campusAdminPool.filter(r => 
    r.campus_admin_approved || r.campusAdminApproved || r.status === 'Approved' || r.status === 'Ongoing' || r.status === 'Completed' || r.finalAction?.status === 'Approved'
  ).length;

  const pendingApprovalsCount = filteredRequisitions.filter(r => 
    r.status === 'Pending Final Approval' || r.status === 'Awaiting Signatures'
  ).length;

  const returnedByApproverCount = filteredRequisitions.filter(r => 
    r.rejectionStage === 'approver' || r.status === 'Returned'
  ).length;

  const approvalRate = campusAdminPool.length > 0 
    ? Math.round((approvedCount / campusAdminPool.length) * 100) 
    : 100;

  // Department Breakdown
  const departmentStats = useMemo(() => {
    const counts = {};
    filteredRequisitions.forEach(r => {
      const dept = r.department || r.office || 'General Campus';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalRequisitions > 0 ? Math.round((count / totalRequisitions) * 100) : 0
      }));
  }, [filteredRequisitions, totalRequisitions]);

  // Unique departments for filter
  const departmentsList = useMemo(() => {
    const set = new Set(requisitions.map(r => r.department || r.office || 'General Campus').filter(Boolean));
    return Array.from(set).sort();
  }, [requisitions]);

  // CSM Quality Ratings
  const csmStats = useMemo(() => {
    if (!evaluations || evaluations.length === 0) {
      return { avgTotal: '5.0', fs: '5.0', us: '5.0', rel: '5.0', pe: '5.0', sec: '5.0', totalCount: 0 };
    }
    const calcAvg = (key) => {
      const valid = evaluations.map(e => Number(e[key])).filter(v => v > 0);
      return valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2) : '5.0';
    };
    const fs = calcAvg('functionalSuitability');
    const us = calcAvg('usability');
    const rel = calcAvg('reliability');
    const pe = calcAvg('performanceEfficiency');
    const sec = calcAvg('security');
    const overall = ((Number(fs) + Number(us) + Number(rel) + Number(pe) + Number(sec)) / 5).toFixed(2);
    return {
      avgTotal: overall,
      fs,
      us,
      rel,
      pe,
      sec,
      totalCount: evaluations.length
    };
  }, [evaluations]);

  // Export Executive Summary
  const handleExportCSV = () => {
    const headers = ['Tracking No', 'Department', 'Category', 'Urgency', 'Date Filed', 'Current Status', 'Approval Status'];
    const rows = filteredRequisitions.map(r => [
      `"${r.controlNo || r.id || '—'}"`,
      `"${r.department || r.office || 'General Campus'}"`,
      `"${r.category || 'General'}"`,
      `"${r.urgency || 'Normal'}"`,
      `"${r.date || '—'}"`,
      `"${r.status || '—'}"`,
      `"${r.campusAdminApproved ? 'Approved by Campus Admin' : r.status === 'Pending Final Approval' ? 'Awaiting Campus Admin' : 'In Review Chain'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `campus-admin-governance-report-${toLocalISODate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', paddingTop: '16px', fontFamily: "'Inter', sans-serif" }}>
      {/* Page Header */}
      <PageHeader
        breadcrumbs={['Office of the Campus Administrator', 'Executive Governance & Analytics']}
        title="Campus Facility & Governance Analytics"
        description="Institutional oversight of facility requisitions, final executive approvals, and campus satisfaction measurement."
        action={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}
          >
            <Download size={15} /> Export Governance Data
          </button>
        }
      />

      {/* Filter Toolbar */}
      <div style={{
        ...sectionCardStyle,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={16} color="#001f9c" />
          <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>Scope &amp; Period Filter:</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="#64748b" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="form-select"
              style={{ fontSize: '12.5px', padding: '5px 10px', borderRadius: '6px' }}
            >
              <option value="all">All Time Records</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last Quarter (90 Days)</option>
              <option value="year">Past 12 Months</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building size={14} color="#64748b" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="form-select"
              style={{ fontSize: '12.5px', padding: '5px 10px', borderRadius: '6px' }}
            >
              <option value="all">All Departments / Offices</option>
              {departmentsList.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top Executive KPI Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px'
      }}>
        {/* Total Campus Requisitions */}
        <div style={statCardStyle('#001f9c')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Total Campus Requests
            </span>
            <Layers size={18} color="#001f9c" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>
            {totalRequisitions}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
            Facilities &amp; maintenance tickets
          </div>
        </div>

        {/* Executive Approvals Rate */}
        <div style={statCardStyle('#059669')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Final Approval Rate
            </span>
            <CheckCircle2 size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#059669', lineHeight: 1 }}>
            {approvalRate}%
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
            {approvedCount} approved of {campusAdminPool.length} endorsed
          </div>
        </div>

        {/* Pending Executive Action */}
        <div style={statCardStyle(pendingApprovalsCount > 0 ? '#d97706' : '#10b981')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Awaiting Campus Admin
            </span>
            <Landmark size={18} color={pendingApprovalsCount > 0 ? '#d97706' : '#10b981'} />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: pendingApprovalsCount > 0 ? '#b45309' : '#047857', lineHeight: 1 }}>
            {pendingApprovalsCount}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
            {pendingApprovalsCount > 0 ? 'Action required in final approval queue' : 'All endorsed tickets resolved'}
          </div>
        </div>

        {/* Returned for Revision */}
        <div style={statCardStyle('#dc2626')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Returned for Revision
            </span>
            <AlertTriangle size={18} color="#dc2626" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: returnedByApproverCount > 0 ? '#b91c1c' : '#0f172a', lineHeight: 1 }}>
            {returnedByApproverCount}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
            Sent back to PDAS or requester
          </div>
        </div>

        {/* Institutional Quality Score */}
        <div style={statCardStyle('#f59e0b')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Campus CSM Rating
            </span>
            <Award size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: '30px', fontWeight: '800', color: '#d97706', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Star size={24} fill="#d97706" /> {csmStats.avgTotal}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
            Out of 5.0 ({csmStats.totalCount} client evaluations)
          </div>
        </div>
      </div>

      {/* Main Dual Panels: Department Distribution & CSM Quality Scorecard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '20px'
      }}>
        {/* Department / College Request Distribution */}
        <div style={sectionCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18} color="#001f9c" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Requisitions by College / Department
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
              {departmentStats.length} Academic &amp; Admin Units
            </span>
          </div>

          {departmentStats.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8' }}>
              No department records match current scope.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {departmentStats.slice(0, 7).map((dept) => (
                <div key={dept.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ fontWeight: '600', color: '#1e293b' }}>{dept.name}</span>
                    <span style={{ fontWeight: '700', color: '#001f9c' }}>
                      {dept.count} <span style={{ fontWeight: '400', color: '#64748b' }}>({dept.percentage}%)</span>
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-sunken)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(dept.percentage, 3)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #001f9c 0%, #2563eb 100%)',
                        borderRadius: '4px',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Client Satisfaction Measurement (QF-HRM-15 / ISO 25010) Institutional Scorecard */}
        <div style={sectionCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="#d97706" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                ISO/IEC 25010 Institutional Service Quality
              </h3>
            </div>
            <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
              QF-HRM-15 Standard
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Functional Suitability (Work scope completely resolved)', score: csmStats.fs, color: '#2563eb' },
              { label: 'Usability & Professional Demeanor', score: csmStats.us, color: '#059669' },
              { label: 'Reliability & Repair Durability', score: csmStats.rel, color: '#d97706' },
              { label: 'Performance Efficiency & Turnaround Speed', score: csmStats.pe, color: '#7c3aed' },
              { label: 'Safety, Cleanliness & Security Protocol', score: csmStats.sec, color: '#0284c7' },
            ].map(item => {
              const num = Number(item.score);
              const pct = Math.min(100, Math.round((num / 5.0) * 100));
              return (
                <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ color: '#334155', fontWeight: '500' }}>{item.label}</span>
                    <span style={{ fontWeight: '700', color: '#0f172a' }}>{item.score} / 5.0</span>
                  </div>
                  <div style={{ width: '100%', height: '7px', background: 'var(--bg-sunken)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: item.color,
                        borderRadius: '4px',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: '18px',
            padding: '12px 14px',
            background: 'var(--bg-surface)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#475569',
            lineHeight: 1.5
          }}>
            <strong>Institutional Quality Assurance:</strong> Ratings are submitted directly by verified requesters following work order resolution. This official data supports AACCUP accreditation and ISO 9001:2015 institutional audits.
          </div>
        </div>
      </div>
    </div>
  );
};
