import React, { useState, useMemo } from 'react';
import { FileText, Printer, Eye, Pencil, Search, X, Filter, CheckCircle2, Clock, FileSpreadsheet } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Modal } from '../components/common/Modal';
import { JobRequestFormOverlay } from '../components/common/JobRequestFormOverlay';
import { JobRequestPrintSheet } from '../components/common/JobRequestPrintSheet';
import { PageHeader } from '../components/common/PageHeader';
import { CategoryPill } from '../components/common/StatusBadge';

export const OfficialDocuments = () => {
  const { requisitions, updateRequisitionForm, ticketSearch, setTicketSearch } = useData();

  const [localSearch, setLocalSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedDocReq, setSelectedDocReq] = useState(requisitions[0] || null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const activeSearch = localSearch || ticketSearch || '';

  const handleSearchChange = (val) => {
    setLocalSearch(val);
    if (setTicketSearch) setTicketSearch(val);
  };

  const handleClearFilters = () => {
    setLocalSearch('');
    if (setTicketSearch) setTicketSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const openPreview = (r) => { setSelectedDocReq(r); setIsPreviewOpen(true); };
  const openEdit = (r) => { setSelectedDocReq(r); setIsEditOpen(true); };

  const handleOverlaySave = (edited, printAfter = false) => {
    if (!selectedDocReq) return;
    updateRequisitionForm(selectedDocReq.id, edited);
    setSelectedDocReq(prev => ({ ...prev, ...edited }));
    setIsEditOpen(false);
    if (printAfter) setIsPreviewOpen(true);
  };

  // Filtered documents
  const filteredRequisitions = useMemo(() => {
    const term = activeSearch.trim().toLowerCase();
    return requisitions.filter(r => {
      const matchesSearch = !term ||
        String(r.controlNo || r.ticket_no || r.id || '').toLowerCase().includes(term) ||
        String(r.title || '').toLowerCase().includes(term) ||
        String(r.location || '').toLowerCase().includes(term) ||
        String(r.requestedBy || '').toLowerCase().includes(term) ||
        String(r.department || '').toLowerCase().includes(term) ||
        String(r.category || '').toLowerCase().includes(term);

      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'approved' && (r.status === 'Approved' || r.finalAction?.status === 'Approved')) ||
        (statusFilter === 'pending' && (r.status === 'Pending' || r.status === 'Under Review')) ||
        (statusFilter === 'in-progress' && (r.status === 'Ongoing' || r.status === 'In Progress')) ||
        (statusFilter === 'completed' && r.status === 'Completed');

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [requisitions, activeSearch, categoryFilter, statusFilter]);

  // Statistics
  const totalCount = requisitions.length;
  const approvedCount = requisitions.filter(r => r.status === 'Approved' || r.finalAction?.status === 'Approved').length;
  const pendingCount = requisitions.filter(r => r.status === 'Pending' || r.status === 'Under Review').length;
  const hasActiveFilter = Boolean(activeSearch || categoryFilter !== 'all' || statusFilter !== 'all');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Executive Page Header */}
      <PageHeader
        breadcrumbs={['Documents', 'QF-PDAS-DC-01 Registry']}
        title="Official Documents & Job Requests"
        description="Search, inspect, edit, and generate official PDAS hardcopy forms (QF-PDAS-DC-01) for ISAT U Dumangas Campus"
      />

      {/* Summary KPI Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #001f9c', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Official Forms</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{totalCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #059669', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Approved &amp; Ready</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>{approvedCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #f59e0b', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Review</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#d97706', marginTop: '2px' }}>{pendingCount}</div>
        </div>
      </div>

      {/* Content Card with Search & Filters */}
      <div className="content-card">
        {/* Header & Filter Controls Bar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h2 className="card-title" style={{ fontSize: '16.5px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={18} color="#001f9c" /> Document Registry ({filteredRequisitions.length})
            </h2>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '5px 10px', background: '#f1f5f9', color: '#475569',
                  border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px',
                  fontWeight: '600', cursor: 'pointer'
                }}
              >
                <X size={13} /> Reset Filters
              </button>
            )}
          </div>

          {/* Search & Select Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', alignItems: 'center' }}>
            {/* Search Box */}
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search tracking no, requester, location..."
                value={activeSearch}
                onChange={e => handleSearchChange(e.target.value)}
                style={{
                  width: '100%', padding: '8px 30px 8px 36px', boxSizing: 'border-box',
                  borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff',
                  fontSize: '13px', color: '#0f172a', outline: 'none', transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#001f9c'}
                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
              />
              {activeSearch && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <select
              className="form-select"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ height: '36px', fontSize: '12.5px', padding: '0 10px' }}
            >
              <option value="all">All Trade Categories</option>
              <option value="Electrical">Electrical</option>
              <option value="Air Conditioning">Air Conditioning</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Water/Sanitary">Water/Sanitary</option>
              <option value="Physical Structures">Physical Structures</option>
              <option value="Drawing/Design">Drawing/Design</option>
              <option value="Safety &amp; Compliance">Safety &amp; Compliance</option>
            </select>

            {/* Status Filter */}
            <select
              className="form-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ height: '36px', fontSize: '12.5px', padding: '0 10px' }}
            >
              <option value="all">All Document Statuses</option>
              <option value="approved">Approved &amp; Ready</option>
              <option value="pending">Pending Review</option>
              <option value="in-progress">In Progress / Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Table of Requisitions */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>TRACKING NUMBER</th>
                <th>SUBJECT &amp; LOCATION</th>
                <th>CATEGORY</th>
                <th>REQUESTED BY</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequisitions.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No documents found matching your search</div>
                    <div style={{ fontSize: '12px', marginTop: '4px', color: '#94a3b8' }}>Try clearing your search query or changing filters</div>
                    {hasActiveFilter && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        style={{
                          marginTop: '12px', padding: '6px 14px', borderRadius: '6px',
                          background: '#001f9c', color: '#ffffff', border: 'none',
                          fontSize: '12px', fontWeight: '700', cursor: 'pointer'
                        }}
                      >
                        Clear All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRequisitions.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: '800', color: '#001f9c' }}>
                      {r.controlNo || r.id || 'PENDING'}
                    </td>
                    <td>
                      <div style={{ fontWeight: '700', color: '#0f172a', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title || 'Job Request'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {r.location || '—'}
                      </div>
                    </td>
                    <td>
                      <CategoryPill category={r.category} />
                    </td>
                    <td>
                      <div style={{ fontWeight: '700', color: '#1e293b' }}>{r.requestedBy}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>{r.department}</div>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700',
                        background: r.status === 'Approved' ? '#ecfdf5' : r.status === 'Completed' ? '#f0fdf4' : '#fffbeb',
                        color: r.status === 'Approved' ? '#047857' : r.status === 'Completed' ? '#15803d' : '#b45309'
                      }}>
                        {r.status === 'Approved' || r.status === 'Completed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {r.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(r)}
                          title="Edit form fields"
                          style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => openPreview(r)}
                          title="View and print official form QF-PDAS-DC-01"
                          style={{ background: '#001f9c', border: 'none' }}
                        >
                          <Eye size={13} /> View Form
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

      {/* Print Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Official Document Print Preview — QF-PDAS-DC-01"
        maxWidth="800px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Tracking: <strong>{selectedDocReq?.controlNo || 'PENDING (issued upon work order assignment)'}</strong>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setIsPreviewOpen(false); setIsEditOpen(true); }}>
                <Pencil size={14} /> Edit Fields
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPreviewOpen(false)}>Close</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                <Printer size={15} /> Print / Save PDF
              </button>
            </div>
          </div>
        }
      >
        {selectedDocReq && <JobRequestPrintSheet req={selectedDocReq} />}
      </Modal>

      {selectedDocReq && isPreviewOpen && (
        <div className="jr-print-only" aria-hidden="true">
          <JobRequestPrintSheet req={selectedDocReq} />
        </div>
      )}

      {/* Edit Form Overlay */}
      <JobRequestFormOverlay
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        initialReq={selectedDocReq || {}}
        allowActionTaken
        allowFinalAction={false}
        title="Edit Job Request Fields (QF-PDAS-DC-01) — All Fields Editable"
        onSave={(edited) => handleOverlaySave(edited, false)}
        onSaveAndPrint={(edited) => handleOverlaySave(edited, true)}
      />
    </div>
  );
};
