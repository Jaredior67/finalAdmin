import React, { useState } from 'react';
import { Archive, Search, Download, RotateCcw, CheckCircle2, Eye } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatusBadge, CategoryPill } from '../../components/common/StatusBadge';
import { formatTicketDate } from '../../components/common/TimeGreeting';

export const ArchivedRequests = () => {
  const { requisitions, unarchiveRequisition } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const archivedItems = requisitions.filter(r => r.isArchived === true);

  const filtered = archivedItems.filter(r => {
    const matchesSearch =
      String(r.controlNo || r.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'all' || r.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  }).sort((a, b) => String(b.archivedAt || b.date || '').localeCompare(String(a.archivedAt || a.date || '')));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Archived Requests & Historical Records</h1>
          <p className="page-subtitle">
            Long-term repository of resolved, completed, and closed facility requests ({archivedItems.length} archived)
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search archive by tracking number, location, or issue..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

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
        </select>

        <select
          className="select-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="Completed">Completed</option>
          <option value="Rejected">Rejected</option>
          <option value="Unable to Complete">Unable to Complete</option>
        </select>
      </div>

      <div className="content-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">TRACKING NUMBER</th>
                <th scope="col">LOCATION</th>
                <th scope="col">WORK TITLE</th>
                <th scope="col">CATEGORY</th>
                <th scope="col">COMPLETION STATUS</th>
                <th scope="col">ARCHIVED ON</th>
                <th scope="col" style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No archived records found. Use the Archive button on completed or rejected tickets to move them here.
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
                    <td style={{ color: '#64748b', fontSize: '12.5px' }}>{formatTicketDate(String(req.archivedAt || req.date || '').split(',')[0])}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => unarchiveRequisition(req.id)}
                        title="Restore from archive"
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
    </div>
  );
};
