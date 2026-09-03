import React, { useState } from 'react';
import { Clock, Search, CheckCircle2, XCircle, ShieldCheck, Download } from 'lucide-react';
import { useData } from '../context/DataContext';

export const ApprovalHistory = () => {
  const { approvalHistory } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredHistory = approvalHistory.filter(item => {
    const matchesSearch = 
      item.controlNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.remarks.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.actionBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'all' || item.action.toLowerCase() === actionFilter.toLowerCase();
    return matchesSearch && matchesAction;
  });

  const exportCSV = () => {
    const headers = ['Approval ID', 'Control No', 'Decision', 'Approver', 'Timestamp', 'Remarks'];
    const rows = filteredHistory.map(h => [
      h.id,
      h.controlNo,
      h.action,
      h.actionBy,
      `"${h.timestamp}"`,
      `"${h.remarks}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PDAS_Approval_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Approval History & Audit Trail</h1>
          <p className="page-subtitle">Official administrative decision records, timestamps, and authorization remarks</p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={exportCSV}
        >
          <Download size={15} />
          Export Audit Log (CSV)
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by control no, remark, or approver..."
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
                <th>CONTROL NO.</th>
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
                  <tr key={log.id}>
                    <td style={{ fontWeight: '700', color: '#64748b' }}>
                      {log.id}
                    </td>
                    <td style={{ fontWeight: '700', color: '#001f9c' }}>
                      {log.controlNo}
                    </td>
                    <td>
                      {log.action === 'Approved' ? (
                        <span className="badge status-completed">
                          <CheckCircle2 size={12} />
                          Authorized
                        </span>
                      ) : (
                        <span className="badge status-rejected">
                          <XCircle size={12} />
                          Disapproved
                        </span>
                      )}
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
    </div>
  );
};
