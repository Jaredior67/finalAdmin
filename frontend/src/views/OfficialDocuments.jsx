import React, { useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  Eye,
  Search,
  X,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Settings,
  Star,
  RotateCcw,
  Save,
  Check,
  Sparkles,
  Move,
  Archive
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { JobRequestFormOverlay } from '../components/common/JobRequestFormOverlay';
import { JobRequestPrintSheet } from '../components/common/JobRequestPrintSheet';
import { ClientSatisfactionPrintSheet } from '../components/common/ClientSatisfactionPrintSheet';
import { PrintPortal } from '../components/common/PrintPortal';
import { printDocument } from '../utils/print';
import { LiveDocumentCanvasEditor } from '../components/common/LiveDocumentCanvasEditor';
import { PageHeader } from '../components/common/PageHeader';
import { CategoryPill } from '../components/common/StatusBadge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const OfficialDocuments = () => {
  const {
    requisitions,
    archiveRequisition,
    updateRequisitionForm,
    ticketSearch,
    setTicketSearch,
    evaluations,
    formTemplateConfig,
    updateFormTemplateConfig,
    resetFormTemplateConfig,
    csmTemplateConfig,
    updateCsmTemplateConfig,
    resetCsmTemplateConfig
  } = useData();

  const { currentUser, isAdmin, isSuperAdmin, isCampusAdmin, isMaintenance } = useAuth();

  // Top Tabs: 'job-requests' | 'csm-feedback'
  const [activeDocType, setActiveDocType] = useState('job-requests');

  // Search and Filters
  const [localSearch, setLocalSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Job Request Modals
  const [selectedDocReq, setSelectedDocReq] = useState(requisitions[0] || null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);

  // CSM Print Modal
  const [selectedCsmRecord, setSelectedCsmRecord] = useState(null);
  const [isCsmPreviewOpen, setIsCsmPreviewOpen] = useState(false);

  // Manage Forms Modal
  const [isManageFormsOpen, setIsManageFormsOpen] = useState(false);
  const [isLiveEditorOpen, setIsLiveEditorOpen] = useState(false);
  const [selectedFormToManage, setSelectedFormToManage] = useState('job-request'); // 'job-request' | 'csm'
  const [jobFormDraft, setJobFormDraft] = useState(null);
  const [csmFormDraft, setCsmFormDraft] = useState(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const activeSearch = localSearch || ticketSearch || '';

  const canManageForms = !isMaintenance && (isAdmin || isCampusAdmin);
  const canArchiveDocuments = isAdmin || isSuperAdmin;

  const isRequester = Boolean(
    currentUser &&
    selectedDocReq &&
    (
      (currentUser.name && selectedDocReq.requestedBy && selectedDocReq.requestedBy.toLowerCase() === currentUser.name.toLowerCase()) ||
      (currentUser.email && selectedDocReq.requesterEmail && selectedDocReq.requesterEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.id && selectedDocReq.userId && String(selectedDocReq.userId) === String(currentUser.id))
    )
  );

  const canPrint = !isMaintenance && (isAdmin || isCampusAdmin || isRequester);

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

  /* Official documents are generated from job requests, so archiving the
     document means archiving the underlying request. The old handler posted to
     /api/documents/:id/archive, which does not exist, and never touched the
     list — the button silently did nothing. */
  const archiveDoc = (req) => {
    if (!canArchiveDocuments) return;
    setArchiveTarget(req);
  };

  const handleOverlaySave = (edited, printAfter = false) => {
    if (!selectedDocReq) return;
    updateRequisitionForm(selectedDocReq.id, edited);
    setSelectedDocReq(prev => ({ ...prev, ...edited }));
    setIsEditOpen(false);
    if (printAfter) setIsPreviewOpen(true);
  };

  // Filtered Job Requests
  const filteredRequisitions = useMemo(() => {
    const term = activeSearch.trim().toLowerCase();
    return requisitions.filter(r => {
      // Archived documents live in the Archive Center, not the live registry.
      if (r.isArchived) return false;
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

  // Filtered CSM Evaluations
  const filteredEvaluations = useMemo(() => {
    const term = activeSearch.trim().toLowerCase();
    return (evaluations || []).filter(e => {
      if (!term) return true;
      return (
        String(e.controlNo || e.reqId || '').toLowerCase().includes(term) ||
        String(e.submittedBy || '').toLowerCase().includes(term) ||
        String(e.serviceAvailed || '').toLowerCase().includes(term) ||
        String(e.region || '').toLowerCase().includes(term) ||
        String(e.clientType || '').toLowerCase().includes(term)
      );
    });
  }, [evaluations, activeSearch]);

  // Statistics (live registry only — archived records are counted in the Archive Center)
  const activeDocuments = requisitions.filter(r => !r.isArchived);
  const totalCount = activeDocuments.length;
  const approvedCount = activeDocuments.filter(r => r.status === 'Approved' || r.finalAction?.status === 'Approved').length;
  const csmCount = (evaluations || []).length;
  const hasActiveFilter = Boolean(activeSearch || categoryFilter !== 'all' || statusFilter !== 'all');

  // Open Manage Forms Modal & initialize drafts
  const handleOpenManageForms = (formKey = 'job-request') => {
    setSelectedFormToManage(formKey);
    setJobFormDraft({ ...formTemplateConfig });
    setCsmFormDraft({ ...csmTemplateConfig });
    setSaveSuccessMsg('');
    setIsManageFormsOpen(true);
  };

  const handleSaveJobForm = () => {
    if (!jobFormDraft) return;
    updateFormTemplateConfig(jobFormDraft);
    setSaveSuccessMsg('Job Request Form (QF-PDAS-DC-01) template updated successfully.');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleResetJobForm = () => {
    if (window.confirm('Reset Job Request template to institutional defaults?')) {
      const def = resetFormTemplateConfig();
      setJobFormDraft({ ...def });
      setSaveSuccessMsg('Job Request Form reset to institutional defaults.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    }
  };

  const handleSaveCsmForm = () => {
    if (!csmFormDraft) return;
    updateCsmTemplateConfig(csmFormDraft);
    setSaveSuccessMsg('Client Satisfaction Form (QF-HRM-15) template updated successfully.');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleResetCsmForm = () => {
    if (window.confirm('Reset Client Satisfaction Measurement template to official standards?')) {
      const def = resetCsmTemplateConfig();
      setCsmFormDraft({ ...def });
      setSaveSuccessMsg('Client Satisfaction Measurement form reset to official defaults.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    }
  };

  const openCsmPreview = (evaluation) => {
    const matchedReq = requisitions.find(r => r.id === evaluation.reqId || r.controlNo === evaluation.controlNo) || {};
    setSelectedCsmRecord({ eval: evaluation, req: matchedReq });
    setIsCsmPreviewOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Executive Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <PageHeader
          breadcrumbs={['Official Documents', 'Forms']}
          title="Official Documents & Forms"
          description="Manage, inspect, and generate official facility documents and client feedback forms."
        />

        {canManageForms && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelectedFormToManage(activeDocType === 'csm-feedback' ? 'csm' : 'job-request');
              setIsLiveEditorOpen(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #001f9c 0%, #1e3a8a 100%)',
              boxShadow: '0 2px 8px rgba(0, 31, 156, 0.25)',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <Settings size={16} /> Manage Forms
          </button>
        )}
      </div>

      {/* Summary KPI Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #001f9c', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Job Request Forms</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{totalCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #059669', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Approved &amp; Ready</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>{approvedCount}</div>
        </div>
        {isAdmin && (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #f59e0b', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CSM Feedback Forms</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#d97706', marginTop: '2px' }}>{csmCount}</div>
          </div>
        )}
      </div>

      {/* Primary Form Selector Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setActiveDocType('job-requests')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeDocType === 'job-requests' ? '3px solid #001f9c' : '3px solid transparent',
            color: activeDocType === 'job-requests' ? '#001f9c' : '#64748b',
            fontWeight: '800',
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} /> Job Request Forms (QF-PDAS-DC-01)
          <span style={{ fontSize: '11px', background: activeDocType === 'job-requests' ? '#dbeafe' : '#f1f5f9', color: activeDocType === 'job-requests' ? '#1e40af' : '#64748b', padding: '2px 8px', borderRadius: '12px' }}>
            {totalCount}
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveDocType('csm-feedback')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeDocType === 'csm-feedback' ? '3px solid #001f9c' : '3px solid transparent',
              color: activeDocType === 'csm-feedback' ? '#001f9c' : '#64748b',
              fontWeight: '800',
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Star size={16} color={activeDocType === 'csm-feedback' ? '#f59e0b' : '#64748b'} /> Client Satisfaction Measurement (QF-HRM-15)
            <span style={{ fontSize: '11px', background: activeDocType === 'csm-feedback' ? '#fef3c7' : '#f1f5f9', color: activeDocType === 'csm-feedback' ? '#92400e' : '#64748b', padding: '2px 8px', borderRadius: '12px' }}>
              {csmCount}
            </span>
          </button>
        )}
      </div>

      {/* Content Card with Search & Table */}
      <div className="content-card">
        {/* Controls Bar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h2 className="card-title" style={{ fontSize: '16.5px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={18} color="#001f9c" />
              {activeDocType === 'job-requests'
                ? `Job Request Registry (${filteredRequisitions.length})`
                : `Client Satisfaction Feedback Registry (${filteredEvaluations.length})`}
            </h2>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '5px 10px', background: 'var(--bg-sunken)', color: '#475569',
                  border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px',
                  fontWeight: '600', cursor: 'pointer'
                }}
              >
                <X size={13} /> Reset Filters
              </button>
            )}
          </div>

          {/* Search Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder={activeDocType === 'job-requests' ? "Search tracking no, requester, location..." : "Search tracking no, evaluated by, service..."}
                value={activeSearch}
                onChange={e => handleSearchChange(e.target.value)}
                style={{
                  width: '100%', padding: '8px 30px 8px 36px', boxSizing: 'border-box',
                  borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff',
                  fontSize: '13px'
                }}
              />
            </div>

            {activeDocType === 'job-requests' && (
              <>
                <select
                  className="select-filter"
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  style={{ padding: '8px 30px 8px 12px', height: '38px', minHeight: '38px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="all">All Trade Categories</option>
                  <option value="Electrical">Electrical Works</option>
                  <option value="Carpentry & Masonry">Carpentry &amp; Masonry</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Air Conditioning">Air Conditioning</option>
                  <option value="Painting">Painting</option>
                  <option value="General Services">General Services</option>
                </select>

                <select
                  className="select-filter"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ padding: '8px 30px 8px 12px', height: '38px', minHeight: '38px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="all">All Workflow Statuses</option>
                  <option value="approved">Approved &amp; Ready</option>
                  <option value="pending">Pending Review</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Tab 1: Job Requests Table */}
        {activeDocType === 'job-requests' && (
          <div className="table-responsive">
            <table className="data-table data-table-stacked" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid #e2e8f0' }}>
                  <th scope="col" style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', fontSize: '10.5px', textTransform: 'uppercase' }}>TRACKING NO.</th>
                  <th scope="col" style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', fontSize: '10.5px', textTransform: 'uppercase' }}>REQUEST TITLE &amp; LOCATION</th>
                  <th scope="col" style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', fontSize: '10.5px', textTransform: 'uppercase' }}>CATEGORY</th>
                  <th scope="col" style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', fontSize: '10.5px', textTransform: 'uppercase' }}>REQUESTER</th>
                  <th scope="col" style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', fontSize: '10.5px', textTransform: 'uppercase' }}>STATUS</th>
                  <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#475569', fontSize: '10.5px', textTransform: 'uppercase' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No official job request documents match your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRequisitions.map(r => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => openPreview(r)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td data-label="Tracking No." style={{ padding: '10px 12px', fontWeight: '700', color: '#001f9c', fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.controlNo || r.id || 'PENDING'}
                      </td>
                      <td data-label="Request Title & Location" style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title || 'Job Request'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.location || '—'}
                        </div>
                      </td>
                      <td data-label="Category" style={{ padding: '10px 12px' }}>
                        <CategoryPill category={r.category} />
                      </td>
                      <td data-label="Requester" style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '12px' }}>{r.requestedBy}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{r.department}</div>
                      </td>
                      <td data-label="Status" style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                          background: r.status === 'Approved' ? '#ecfdf5' : r.status === 'Completed' ? '#f0fdf4' : '#fffbeb',
                          color: r.status === 'Approved' ? '#047857' : r.status === 'Completed' ? '#15803d' : '#b45309'
                        }}>
                          {r.status === 'Approved' || r.status === 'Completed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {r.status}
                        </span>
                      </td>
                      <td className="stacked-actions" data-label="Actions" style={{ textAlign: 'right', whiteSpace: 'nowrap', padding: '10px 12px' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={(e) => { e.stopPropagation(); openPreview(r); }}
                          title="View and print official form QF-PDAS-DC-01"
                          style={{ background: '#001f9c', border: 'none', marginRight: '4px' }}
                        >
                          <Eye size={13} /> View
                        </button>
                        {canArchiveDocuments && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => { e.stopPropagation(); archiveDoc(r); }}
                            title="Move this document and its request record to the archive"
                            style={{ background: '#6b7280', border: 'none' }}
                          >
                            <Archive size={13} /> Archive
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Client Satisfaction Measurement Table — Admin only */}
        {isAdmin && activeDocType === 'csm-feedback' && (
          <div className="table-responsive">
            <table className="data-table data-table-stacked" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid #e2e8f0' }}>
                  <th scope="col" style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>TRACKING / REF</th>
                  <th scope="col" style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>SERVICE AVAILED</th>
                  <th scope="col" style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>EVALUATED BY</th>
                  <th scope="col" style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>DATE SUBMITTED</th>
                  <th scope="col" style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>SATISFACTION RATING</th>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvaluations.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      No Client Satisfaction Measurement (CSM) records found.
                    </td>
                  </tr>
                ) : (
                  filteredEvaluations.map((ev, idx) => {
                    const avgScore = ev.sqd0 !== undefined ? Number(ev.sqd0) : 5;
                    return (
                      <tr
                        key={ev.id || idx}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                        onClick={() => openCsmPreview(ev)}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td data-label="Tracking / Ref" style={{ fontWeight: '800', color: '#001f9c' }}>
                          {ev.controlNo || ev.reqId || 'CSM-REC'}
                        </td>
                        <td data-label="Service Availed">
                          <div style={{ fontWeight: '700', color: '#0f172a', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev.serviceAvailed || ev.category || 'Maintenance Service'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                            {ev.region || 'Region VI - Western Visayas'}
                          </div>
                        </td>
                        <td data-label="Evaluated By">
                          <div style={{ fontWeight: '700', color: '#1e293b' }}>{ev.submittedBy || 'Requester'}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{ev.clientType || 'Government'}</div>
                        </td>
                        <td data-label="Date Submitted" style={{ fontSize: '12px', color: '#475569' }}>
                          {ev.submittedAt || 'Recent'}
                        </td>
                        <td data-label="Satisfaction Rating">
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700',
                            background: avgScore >= 4 ? '#ecfdf5' : avgScore >= 3 ? '#fffbeb' : '#fef2f2',
                            color: avgScore >= 4 ? '#047857' : avgScore >= 3 ? '#b45309' : '#b91c1c'
                          }}>
                            <Star size={12} fill="currentColor" /> {avgScore} / 5.0 (SQD0)
                          </span>
                        </td>
                        <td className="stacked-actions" data-label="Actions" style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={(e) => { e.stopPropagation(); openCsmPreview(ev); }}
                            title="View and print official form QF-HRM-15"
                            style={{ background: '#001f9c', border: 'none' }}
                          >
                            <Eye size={13} /> View Form
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Job Request Print Preview */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={canPrint ? "Official Document Preview — QF-PDAS-DC-01" : "Official Document (QF-PDAS-DC-01) — Read-Only View"}
        maxWidth="820px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Tracking: <strong>{selectedDocReq?.controlNo || 'PENDING'}</strong>
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPreviewOpen(false)}>Close</button>
              {canPrint && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => printDocument()}>
                  <Printer size={15} /> Print / Save PDF
                </button>
              )}
            </div>
          </div>
        }
      >
        {selectedDocReq && <JobRequestPrintSheet req={selectedDocReq} />}
      </Modal>

      {canPrint && selectedDocReq && (
        <PrintPortal active={isPreviewOpen}>
          <JobRequestPrintSheet req={selectedDocReq} />
        </PrintPortal>
      )}

      {/* Modal 2: Client Satisfaction Measurement Print Preview */}
      <Modal
        isOpen={isCsmPreviewOpen}
        onClose={() => setIsCsmPreviewOpen(false)}
        title="Official Document (QF-HRM-15) — Client Satisfaction Measurement"
        maxWidth="840px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Tracking: <strong>{selectedCsmRecord?.req?.controlNo || selectedCsmRecord?.eval?.controlNo || '—'}</strong>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsCsmPreviewOpen(false)}>Close</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => printDocument()}>
                <Printer size={15} /> Print / Save PDF
              </button>
            </div>
          </div>
        }
      >
        {selectedCsmRecord && (
          <ClientSatisfactionPrintSheet
            evaluation={selectedCsmRecord.eval}
            request={selectedCsmRecord.req}
          />
        )}
      </Modal>

      {selectedCsmRecord && (
        <PrintPortal active={isCsmPreviewOpen}>
          <ClientSatisfactionPrintSheet
            evaluation={selectedCsmRecord.eval}
            request={selectedCsmRecord.req}
          />
        </PrintPortal>
      )}

      {/* Modal 3: Manage Forms & Templates */}
      <Modal
        isOpen={isManageFormsOpen}
        onClose={() => setIsManageFormsOpen(false)}
        title="Manage Official Forms & Document Templates"
        maxWidth="840px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Live Word Canvas Launch Card */}
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
            border: '1.5px solid #93c5fd',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="#2563eb" /> Live Microsoft Word-Style Canvas Editor
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                Drag the ISAT U logo, click on any words to edit live, adjust font sizes, and view real-time document re-flow!
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setIsManageFormsOpen(false);
                setIsLiveEditorOpen(true);
              }}
              style={{
                background: '#001f9c',
                border: 'none',
                color: '#ffffff',
                fontWeight: '700',
                padding: '8px 16px',
                fontSize: '12.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Move size={14} /> Open Live Word Canvas
            </button>
          </div>

          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Configure and maintain institutional codes, document revisions, header metadata, and questions for all generated forms.
          </p>

          {/* Form Selection Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setSelectedFormToManage('job-request')}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: selectedFormToManage === 'job-request' ? '2px solid #001f9c' : '1px solid #cbd5e1',
                background: selectedFormToManage === 'job-request' ? '#eff6ff' : '#ffffff',
                color: selectedFormToManage === 'job-request' ? '#001f9c' : '#334155',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} /> Job Request Form
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                Document Code: QF-PDAS-DC-01
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFormToManage('csm')}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: selectedFormToManage === 'csm' ? '2px solid #001f9c' : '1px solid #cbd5e1',
                background: selectedFormToManage === 'csm' ? '#eff6ff' : '#ffffff',
                color: selectedFormToManage === 'csm' ? '#001f9c' : '#334155',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Star size={16} color="#d97706" /> Feedback / CSM Form
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                Document Code: QF-HRM-15
              </div>
            </button>
          </div>

          {saveSuccessMsg && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={16} /> {saveSuccessMsg}
            </div>
          )}

          {/* Editor for Form 1: Job Request Form (QF-PDAS-DC-01) */}
          {selectedFormToManage === 'job-request' && jobFormDraft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Document Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobFormDraft.documentCode || ''}
                    onChange={e => setJobFormDraft({ ...jobFormDraft, documentCode: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Revision Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobFormDraft.revisionNo || ''}
                    onChange={e => setJobFormDraft({ ...jobFormDraft, revisionNo: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Effective Date</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobFormDraft.effectiveDate || ''}
                    onChange={e => setJobFormDraft({ ...jobFormDraft, effectiveDate: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Department</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobFormDraft.department || ''}
                    onChange={e => setJobFormDraft({ ...jobFormDraft, department: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Republic Line</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobFormDraft.republicLine || ''}
                    onChange={e => setJobFormDraft({ ...jobFormDraft, republicLine: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Institution Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobFormDraft.institutionName || ''}
                    onChange={e => setJobFormDraft({ ...jobFormDraft, institutionName: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Campus Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobFormDraft.campusName || ''}
                    onChange={e => setJobFormDraft({ ...jobFormDraft, campusName: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Campus Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobFormDraft.campusAddress || ''}
                    onChange={e => setJobFormDraft({ ...jobFormDraft, campusAddress: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Document Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={jobFormDraft.documentTitle || ''}
                  onChange={e => setJobFormDraft({ ...jobFormDraft, documentTitle: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>PDAS Head Signatory Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobFormDraft.pdasHeadTitle || ''}
                    onChange={e => setJobFormDraft({ ...jobFormDraft, pdasHeadTitle: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Campus Approver Signatory Title</label>
                  <input
                    type="text"
                    className="form-input"
                    value={jobFormDraft.approverTitle || ''}
                    onChange={e => setJobFormDraft({ ...jobFormDraft, approverTitle: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Copy Distribution</label>
                <input
                  type="text"
                  className="form-input"
                  value={jobFormDraft.copyDistribution || ''}
                  onChange={e => setJobFormDraft({ ...jobFormDraft, copyDistribution: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetJobForm}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RotateCcw size={14} /> Reset Defaults
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveJobForm}
                  style={{ background: '#001f9c', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={15} /> Save Job Request Form Template
                </button>
              </div>
            </div>
          )}

          {/* Editor for Form 2: Client Satisfaction Measurement (QF-HRM-15) */}
          {selectedFormToManage === 'csm' && csmFormDraft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Document Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={csmFormDraft.documentCode || ''}
                    onChange={e => setCsmFormDraft({ ...csmFormDraft, documentCode: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Revision Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={csmFormDraft.revisionNo || ''}
                    onChange={e => setCsmFormDraft({ ...csmFormDraft, revisionNo: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Effective Date</label>
                  <input
                    type="text"
                    className="form-input"
                    value={csmFormDraft.effectiveDate || ''}
                    onChange={e => setCsmFormDraft({ ...csmFormDraft, effectiveDate: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Department</label>
                  <input
                    type="text"
                    className="form-input"
                    value={csmFormDraft.department || ''}
                    onChange={e => setCsmFormDraft({ ...csmFormDraft, department: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Office Transacted With</label>
                  <input
                    type="text"
                    className="form-input"
                    value={csmFormDraft.officeTransactedWith || ''}
                    onChange={e => setCsmFormDraft({ ...csmFormDraft, officeTransactedWith: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Default Region</label>
                  <input
                    type="text"
                    className="form-input"
                    value={csmFormDraft.defaultRegion || ''}
                    onChange={e => setCsmFormDraft({ ...csmFormDraft, defaultRegion: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Introductory Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={csmFormDraft.introText || ''}
                  onChange={e => setCsmFormDraft({ ...csmFormDraft, introText: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>Data Privacy Statement (RA 10173)</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={csmFormDraft.dataPrivacyText || ''}
                  onChange={e => setCsmFormDraft({ ...csmFormDraft, dataPrivacyText: e.target.value })}
                />
              </div>

              {/* SQD Dimensions Customization */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: '800', color: '#001f9c', display: 'block', marginBottom: '8px' }}>
                  Service Quality Dimensions (SQD 0–8 Questions)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    ['sqd0', 'SQD0 (Overall Satisfaction)'],
                    ['sqd1', 'SQD1 (Time / Speed)'],
                    ['sqd2', 'SQD2 (Requirements & Steps)'],
                    ['sqd3', 'SQD3 (Ease of Steps)'],
                    ['sqd4', 'SQD4 (Information Access)'],
                    ['sqd5', 'SQD5 (Fees / Costs)'],
                    ['sqd6', 'SQD6 (Fairness / Walang Palakasan)'],
                    ['sqd7', 'SQD7 (Courtesy & Helpful Staff)'],
                    ['sqd8', 'SQD8 (Outcome / Resolution)']
                  ].map(([k, label]) => (
                    <div key={k} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>{label}:</span>
                      <input
                        type="text"
                        className="form-input"
                        value={csmFormDraft[k] || ''}
                        onChange={e => setCsmFormDraft({ ...csmFormDraft, [k]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetCsmForm}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RotateCcw size={14} /> Reset Defaults
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveCsmForm}
                  style={{ background: '#001f9c', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={15} /> Save Feedback Form Template
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          if (archiveTarget) {
            await archiveRequisition(archiveTarget.id_raw ?? archiveTarget.id);
          }
          setArchiveTarget(null);
        }}
        title="Archive Official Document?"
        message={archiveTarget
          ? `Move ${archiveTarget.controlNo || archiveTarget.id} (${archiveTarget.title}) to the archive? It will be removed from the live registry but kept in the Archive Center with the underlying request record.`
          : ''}
        confirmText="Archive Document"
        isDanger={false}
      />

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

      {/* Full-Screen Live Word-Style Interactive Document Canvas */}
      <LiveDocumentCanvasEditor
        isOpen={isLiveEditorOpen}
        onClose={() => setIsLiveEditorOpen(false)}
        initialForm={selectedFormToManage}
      />
    </div>
  );
};
