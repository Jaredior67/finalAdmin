import React, { useState } from 'react';
import { Archive, Search, Download, RotateCcw, CheckCircle2, Eye } from 'lucide-react';
import { useData } from '../context/DataContext';
import { StatusBadge, CategoryPill } from '../components/common/StatusBadge';

export const ArchivedRequests = () => {
  const { requisitions } = useData();
  const [searchTerm, setSearchTerm] = useState('');

  const completedOrArchived = requisitions.filter(r => r.status === 'Completed' || r.status === 'Rejected');

  const filtered = completedOrArchived.filter(r => 
    r.controlNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Archived Requests & Historical Records</h1>
          <p className="page-subtitle">Long-term repository of resolved, completed, and closed facility requisitions</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search archive by control no, location, or issue..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="content-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>CONTROL NO.</th>
                <th>LOCATION</th>
                <th>WORK TITLE</th>
                <th>CATEGORY</th>
                <th>COMPLETION STATUS</th>
                <th>COMPLETED DATE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No completed or archived records found. Completed jobs automatically sync here.
                  </td>
                </tr>
              ) : (
                filtered.map(req => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: '700', color: '#001f9c' }}>{req.controlNo}</td>
                    <td>{req.location}</td>
                    <td style={{ fontWeight: '500' }}>{req.title}</td>
                    <td><CategoryPill category={req.category} /></td>
                    <td><StatusBadge status={req.status} /></td>
                    <td style={{ color: '#64748b', fontSize: '12.5px' }}>{req.date}</td>
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
