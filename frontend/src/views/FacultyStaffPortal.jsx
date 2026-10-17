import React, { useState, useEffect } from 'react';
import {
  Clock,
  AlertTriangle,
  Printer,
  Eye,
  Send,
  History,
  Star,
  Download,
  Check,
  CheckCircle,
  X,
  Edit
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { CommunicationBox } from './CommunicationBox';
import { EvaluationForm } from './EvaluationForm';
import {
  useRequestIntake,
  RequestIntake,
  RequestIntakePanel
} from '../components/common/RequestIntake';
import { LimitedTextArea } from '../components/common/LimitedTextArea';
import { PageHeader } from '../components/common/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { formatTicketDate } from '../components/common/TimeGreeting';
import { CATEGORY_OPTIONS, buildScopeOfWorks } from '../utils/jobRequestIntake';
import { filterMyRequests } from '../utils/myRequests';
import { SupervisorDashboard } from './supervisor/SupervisorDashboard';


/* Shared filter options. My Open Tickets and Request History render the SAME
   control set in the SAME order at the SAME size, so switching tabs does not
   move anything around. The only difference is the actions slot on the right.
   The category list is the shared one, so a category you can file is always a
   category you can filter by. */
const URGENCY_OPTIONS = ['High Risk', 'Medium Risk', 'Low Risk'];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'pending-final-approval', label: 'Pending Final Approval' },
  { value: 'awaiting-signatures', label: 'Awaiting Signatures' },
  { value: 'approved', label: 'Approved' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'returned', label: 'Returned for Revision' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' }
];

/* One horizontal filter row. `statusLabel` differs per tab because the two
   pages hold different sets of tickets; everything else is identical. */
const TicketFilterBar = ({
  category,
  onCategoryChange,
  urgency,
  onUrgencyChange,
  status,
  onStatusChange,
  statusLabel,
  onReset,
  isFiltered,
  actions
}) => (
  <div className="ticket-filter-bar">
    <select
      aria-label="Filter by category"
      className="form-select"
      value={category}
      onChange={(e) => onCategoryChange(e.target.value)}
    >
      <option value="all">All Categories</option>
      {CATEGORY_OPTIONS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>

    <select
      aria-label="Filter by risk level"
      className="form-select"
      value={urgency}
      onChange={(e) => onUrgencyChange(e.target.value)}
    >
      <option value="all">All Risk Levels</option>
      {URGENCY_OPTIONS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>

    <select
      aria-label="Filter by status"
      className="form-select"
      value={status}
      onChange={(e) => onStatusChange(e.target.value)}
    >
      <option value="all">{statusLabel}</option>
      {STATUS_OPTIONS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>

    {isFiltered && (
      <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>
        <X size={13} /> Clear
      </button>
    )}

    <div className="ticket-filter-bar__actions">{actions}</div>
  </div>
);

export const FacultyStaffPortal = ({ activeTab = 'faculty-submit', onTabChange, initialRequestType }) => {
  const { currentUser } = useAuth();
  const { 
    requisitions, 
    completeStandardFormForUrgent, 
    messages, 
    sendMessage, 
    evaluations, 
    submitEvaluation, 
    offices,
    ticketSearch: searchTerm,
    focusedTicketRef,
    setFocusedTicketRef,
    reviseRequisition
  } = useData();

  const [selectedTicketDetail, setSelectedTicketDetail] = useState(null);
  const [evaluationRequest, setEvaluationRequest] = useState(null);
  const [revisionTarget, setRevisionTarget] = useState(null);

  // Revision Form State
  const [revTitle, setRevTitle] = useState('');
  const [revCategory, setRevCategory] = useState('');
  const [revLocation, setRevLocation] = useState('');
  const [revUrgency, setRevUrgency] = useState('');
  const [revDescription, setRevDescription] = useState('');
  const [revNotes, setRevNotes] = useState('');
  const [revPhotoUrl, setRevPhotoUrl] = useState('');
  const [revPhotoName, setRevPhotoName] = useState('');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [revError, setRevError] = useState('');

  useEffect(() => {
    if (revisionTarget) {
      setRevTitle(revisionTarget.title || '');
      setRevCategory(revisionTarget.category || 'Carpentry');
      setRevLocation(revisionTarget.location || '');
      setRevUrgency(revisionTarget.urgency || 'Medium Risk');
      setRevDescription(revisionTarget.description || '');
      setRevNotes('');
      setRevPhotoUrl(revisionTarget.photoUrl || '');
      setRevPhotoName(revisionTarget.photoName || '');
      setRevError('');
    }
  }, [revisionTarget]);

  const handleSubmitRevision = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!revDescription.trim()) {
      setRevError('Please provide a detailed description of the work needed.');
      return;
    }
    setIsSubmittingRevision(true);
    setRevError('');
    try {
      await reviseRequisition(revisionTarget.id, {
        title: revTitle.trim() || revCategory,
        category: revCategory,
        location: revLocation.trim(),
        urgency: revUrgency,
        description: revDescription.trim(),
        revisionNotes: revNotes.trim(),
        photoUrl: revPhotoUrl || null,
        photoName: revPhotoName || null
      });
      setRevisionTarget(null);
    } catch (err) {
      setRevError(err?.message || 'Failed to submit revision. Please try again.');
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  // Filters State (search text comes from the navbar global search box)
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 8;

  // Reset table pagination whenever the tab or filters change
  useEffect(() => { setTablePage(1); }, [activeTab, searchTerm, categoryFilter, urgencyFilter, statusFilter]);

  const handleResetFilters = () => {
    setCategoryFilter('all');
    setUrgencyFilter('all');
    setStatusFilter('all');
  };

  const isFiltered = categoryFilter !== 'all' || urgencyFilter !== 'all' || statusFilter !== 'all';

  const paginate = (list) => {
    const totalPages = Math.max(1, Math.ceil(list.length / tablePageSize));
    const safe = Math.min(Math.max(tablePage, 1), totalPages);
    return { totalPages, safe, rows: list.slice((safe - 1) * tablePageSize, safe * tablePageSize) };
  };

  // Location is NOT preselected. Per the conceptual framework the requester must
  // identify the location (QR or manual) as step 1 of the form, so defaulting to
  // "first room in the building" would silently file the wrong location.
  const [selectedOffice] = useState(() => currentUser?.department || offices?.[0] || 'Office of the Campus Administrator');

  // Urgent Standard Form Completion Modal State
  const [isUrgentModalOpen, setIsUrgentModalOpen] = useState(false);
  const [urgentTargetReq, setUrgentTargetReq] = useState(null);
  const [urgentModalSupervisor, setUrgentModalSupervisor] = useState('');
  const [urgentModalOptions, setUrgentModalOptions] = useState([]);
  const [urgentModalDesc, setUrgentModalDesc] = useState('');

  // The request-intake flow is the shared one — the same component, buttons and
  // record shape the PDAS Administration dashboard uses. Nothing about filing a
  // request may depend on which account is signed in.
  const intake = useRequestIntake({
    requester: {
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      role: currentUser?.role === 'staff' ? 'Staff' : currentUser?.role === 'admin' ? 'Admin' : 'Faculty',
      department: currentUser?.department || '',
      phone: currentUser?.phone || '',
      idNumber: currentUser?.idNumber || ''
    },
    office: selectedOffice
  });

  // The urgent tab opens the lightweight fast path instead of
  // the full form, so a hazard is never gated behind a long form.
  // Standard submit tabs show the launcher first — the form opens
  // only when the user explicitly clicks a button.
  useEffect(() => {
    if (intake.filed) return;
    if (activeTab === 'faculty-urgent' || initialRequestType === 'Urgent Request') {
      intake.openUrgent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, initialRequestType]);

  // Messaging State
  const [msgText, setMsgText] = useState('');

  // Deep link: a clicked notification stores its ticket ref here — open the
  // exact record in the details modal, then clear so it never reopens.
  useEffect(() => {
    if (!focusedTicketRef) return;
    const all = [...(requisitions || [])];
    const refStr = String(focusedTicketRef || '').trim();
    const found = all.find(r =>
      String(r.controlNo || '') === refStr ||
      String(r.id || '') === refStr ||
      String(r.ticket_no || '') === refStr
    );
    if (found) {
      if (onTabChange) onTabChange('faculty-tickets');
      setSelectedTicketDetail(found);
    }
    setFocusedTicketRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTicketRef]);

  // Requisition Partitioning (most recent first)
  const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
  /* The shared predicate — see utils/myRequests. This list and the Dashboard
     tile counts read from the same source, so they cannot drift apart. */
  const myTickets = filterMyRequests(requisitions, currentUser);
  const activeTickets = myTickets.filter(r => r.status !== 'Completed' && r.status !== 'Rejected');
  const completedTickets = myTickets.filter(r => r.status === 'Completed' || r.status === 'Rejected');

  // Filtered Active Tickets
  const filteredActiveTickets = activeTickets.filter(req => {
    const matchesSearch = 
      String(req.controlNo || req.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.title && req.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.description && req.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.location && req.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
    const matchesUrgency = urgencyFilter === 'all' || req.urgency === urgencyFilter;
    const matchesStatus = statusFilter === 'all' || req.status.toLowerCase().replace(/\s+/g, '-') === statusFilter || (statusFilter === 'pending-final-approval' && (req.status === 'Pending Final Approval' || req.status === 'Awaiting Signatures'));
    return matchesSearch && matchesCategory && matchesUrgency && matchesStatus;
  }).sort(byDateDesc);

  // Filtered History Tickets
  const filteredHistoryTickets = completedTickets.filter(req => {
    const matchesSearch = 
      String(req.controlNo || req.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.title && req.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.description && req.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.location && req.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.assignedTo && req.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
    const matchesUrgency = urgencyFilter === 'all' || req.urgency === urgencyFilter;
    return matchesSearch && matchesCategory && matchesUrgency;
  }).sort(byDateDesc);

  const pagedActive = paginate(filteredActiveTickets);
  const pagedHistory = paginate(filteredHistoryTickets);

  // Export the rows currently listed to CSV, so the download always matches
  // what the filters and search are showing.
  const handleExportCSV = () => {
    if (filteredHistoryTickets.length === 0) return;
    const headers = ['Tracking No', 'Title', 'Location', 'Category', 'Urgency', 'Status', 'Date Filed', 'Serviced By', 'Evaluation Rating'];
    const rows = filteredHistoryTickets.map(req => {
      const evalData = evaluations.find(e => e.reqId === req.id || e.controlNo === req.controlNo);
      let avgScore = 'Unrated';
      if (evalData) {
        const scores = [evalData.functionalSuitability, evalData.usability, evalData.reliability, evalData.performanceEfficiency, evalData.security].filter(Boolean);
        avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'Rated';
      }
      return [
        `"${req.controlNo || req.id}"`,
        `"${(req.title || req.description || '').replace(/"/g, '""')}"`,
        `"${req.location}"`,
        `"${req.category}"`,
        `"${req.urgency}"`,
        `"${req.status}"`,
        `"${req.date}"`,
        `"${req.assignedTo || 'PDAS Team'}"`,
        `"${avgScore}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ISATU_Request_History_${currentUser?.idNumber || 'Report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (activeTab === 'supervisor-approvals' || activeTab === 'supervisor') {
    return <SupervisorDashboard />;
  }

  if (activeTab === 'faculty-messages') {
    return <CommunicationBox />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
      
      {/* Page Header. The Scan QR / New Request pair belongs to the Dashboard
          only — the same two buttons were repeated on every list page below. */}
      <PageHeader
        breadcrumbs={['My Requests', activeTab === 'faculty-history' ? 'History' : activeTab === 'faculty-tickets' ? 'Open Tickets' : 'New Request']}
        title={activeTab === 'faculty-history' ? 'Request History' : activeTab === 'faculty-tickets' ? 'My Open Tickets' : 'New Request'}
      />

      {/* Summary KPI cards live on the Dashboard tab only (faculty-dashboard). */}

      {/* TAB 1: FILE A REQUEST — the shared intake flow */}
      {(activeTab === 'faculty-submit' || activeTab === 'faculty-urgent' || activeTab === 'submit') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', alignItems: 'start' }}>
          <div className="content-card" style={{ padding: '28px' }}>
            <RequestIntakePanel
              intake={intake}
              requesterName={currentUser?.name}
              department={currentUser?.department || selectedOffice}
              onTrack={() => { if (onTabChange) onTabChange('faculty-tickets'); }}
            />
          </div>
        </div>
      )}


      {/* TAB 2: MY ACTIVE TICKETS & TRACKING */}
      {(activeTab === 'faculty-tickets' || activeTab === 'my-tickets') && (
        <div className="content-card" style={{ paddingTop: '20px' }}>

          {/* URGENT PENDING STANDARD FORM WARNING BANNER */}
          {activeTickets.some(r => r.urgentPendingStandardForm) && (
            <div style={{
              background: '#fff1f2',
              border: '2px solid #fecdd3',
              borderRadius: '12px',
              padding: '16px 20px',
              margin: '0 24px 20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              boxShadow: '0 4px 12px rgba(225, 29, 72, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#ffe4e6',
                  color: '#e11d48',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#9f1239' }}>
                    Action needed: complete the standard form
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#881337', marginTop: '2px' }}>
                    Some urgent requests still need the full QF-PDAS-DC-01 form. Please complete it within the day.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const targetReq = activeTickets.find(r => r.urgentPendingStandardForm);
                  if (targetReq) {
                    setUrgentTargetReq(targetReq);
                    setUrgentModalSupervisor(targetReq.immediateSupervisor || '');
                    setUrgentModalOptions([]);
                    setUrgentModalDesc(targetReq.description || '');
                    setIsUrgentModalOpen(true);
                  }
                }}
                style={{ background: '#e11d48', borderColor: '#be123c', color: '#ffffff', flexShrink: 0, fontWeight: '700' }}
              >
                Complete Standard Form Now
              </button>
            </div>
          )}

          {/* Filter Bar (search lives in the top navbar) */}
          <TicketFilterBar
            category={categoryFilter}
            onCategoryChange={setCategoryFilter}
            urgency={urgencyFilter}
            onUrgencyChange={setUrgencyFilter}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            statusLabel="All Active Status"
            onReset={handleResetFilters}
            isFiltered={isFiltered}
            actions={
              <span className="ticket-filter-bar__result">
                {filteredActiveTickets.length} open
              </span>
            }
          />

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">TRACKING NO</th>
                  <th scope="col">SUBJECT & LOCATION</th>
                  <th scope="col">CATEGORY</th>
                  <th scope="col">URGENCY</th>
                  <th scope="col">CURRENT STATUS</th>
                  <th scope="col">DATE FILED</th>
                  <th scope="col">ASSIGNED TECH</th>
                  <th scope="col" style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredActiveTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
                      <Clock size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>No active tickets matching your criteria</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        {activeTickets.length === 0 ? 'You currently have no pending or ongoing maintenance requests.' : 'Try changing your search or filter settings.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedActive.rows.map(req => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: '700', color: '#001f9c' }}>
                        {req.controlNo || req.id}
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{req.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{req.location}</div>
                        {req.status === 'Returned' && (
                          <div style={{
                            marginTop: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            color: '#b45309',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            <AlertTriangle size={11} /> Returned for Revision
                          </div>
                        )}
                        {req.replacementFlag?.isFlagged && (
                          <div style={{
                            marginTop: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#b91c1c',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            <AlertTriangle size={11} />
                            Irreparable Item Flagged (Procurement in Progress)
                          </div>
                        )}
                      </td>
                      <td>
                        <CategoryPill category={req.category} />
                      </td>
                      <td>
                        <UrgencyBadge urgency={req.urgency} />
                      </td>
                      <td>
                        <StatusBadge status={req.status} />
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#64748b' }}>
                        {formatTicketDate(req.date)}
                      </td>
                      <td style={{ fontSize: '12.5px', color: req.assignedTo ? '#0f172a' : '#94a3b8' }}>
                        {req.assignedTo || 'Pending Assignment'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {req.status === 'Returned' && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setRevisionTarget(req)}
                              style={{
                                background: '#f59e0b',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 9px',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              title="Edit and resubmit this returned request"
                            >
                              <Edit size={13} />
                              Revise
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedTicketDetail(req)}
                            title="View full progress timeline & details"
                          >
                            <Eye size={13} />
                            Details
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setSelectedReqForPrint(req); setIsPrintModalOpen(true); }}
                            title="Print official QF-PDAS-DC-01 form"
                          >
                            <Printer size={13} />
                            Slip
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0 24px 20px 24px' }}>
            <Pagination
              page={pagedActive.safe}
              totalPages={pagedActive.totalPages}
              onPageChange={setTablePage}
              pageSize={tablePageSize}
              total={filteredActiveTickets.length}
              itemLabel="requests"
            />
          </div>
        </div>
      )}

      {/* TAB 3: REQUEST HISTORY & COMPLETED LOGS */}
      {activeTab === 'faculty-history' && (
        <div className="content-card" style={{ paddingTop: '20px' }}>
          {/* Filter Bar — identical control set and order as My Open Tickets,
              with Export CSV sitting inline after the status filter. */}
          <TicketFilterBar
            category={categoryFilter}
            onCategoryChange={setCategoryFilter}
            urgency={urgencyFilter}
            onUrgencyChange={setUrgencyFilter}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            statusLabel="All Closed Status"
            onReset={handleResetFilters}
            isFiltered={isFiltered}
            actions={
              <>
                <span className="ticket-filter-bar__result">
                  {filteredHistoryTickets.length} record{filteredHistoryTickets.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleExportCSV}
                  disabled={filteredHistoryTickets.length === 0}
                  title="Export the records currently listed to CSV"
                >
                  <Download size={14} /> Export CSV
                </button>
              </>
            }
          />

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">TRACKING NO</th>
                  <th scope="col">SUBJECT & LOCATION</th>
                  <th scope="col">CATEGORY</th>
                  <th scope="col">FINAL STATUS</th>
                  <th scope="col">DATE COMPLETED</th>
                  <th scope="col">SERVICED BY</th>
                  <th scope="col">ISO 25010 EVALUATION</th>
                  <th scope="col" style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistoryTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
                      <History size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>No completed request history records found</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        Once pending repairs are finished and closed by the PDAS team, they will appear here.
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedHistory.rows.map(req => {
                    const evalData = evaluations.find(e => e.reqId === req.id || e.controlNo === req.controlNo);
                    let avgRating = null;
                    if (evalData) {
                      const scores = [evalData.functionalSuitability, evalData.usability, evalData.reliability, evalData.performanceEfficiency, evalData.security].filter(Boolean);
                      avgRating = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '5.0';
                    }

                    return (
                      <tr key={req.id}>
                        <td style={{ fontWeight: '700', color: '#001f9c' }}>
                          {req.controlNo || req.id}
                        </td>
                        <td>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>{req.title}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{req.location}</div>
                        </td>
                        <td>
                          <CategoryPill category={req.category} />
                        </td>
                        <td>
                          <StatusBadge status={req.status} />
                        </td>
                        <td style={{ fontSize: '12.5px', color: '#64748b' }}>
                          {formatTicketDate(req.date)}
                        </td>
                        <td style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: '600' }}>
                          {req.assignedTo || 'PDAS Maintenance Team'}
                        </td>
                        <td>
                          {req.status === 'Completed' ? (
                            evalData ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700' }}>
                                <Star size={12} fill="#047857" /> {avgRating} / 5.0 (Evaluated)
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => setEvaluationRequest(req)}
                                style={{ background: '#f59e0b', color: '#0f172a', fontWeight: '700', border: 'none', padding: '3px 10px', fontSize: '11.5px' }}
                              >
                                <Star size={12} /> Rate Service
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>N/A ({req.status})</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedTicketDetail(req)}
                            >
                              <Eye size={13} /> Details
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => { setSelectedReqForPrint(req); setIsPrintModalOpen(true); }}
                            >
                              <Printer size={13} /> Slip
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0 24px 20px 24px' }}>
            <Pagination
              page={pagedHistory.safe}
              totalPages={pagedHistory.totalPages}
              onPageChange={setTablePage}
              pageSize={tablePageSize}
              total={filteredHistoryTickets.length}
              itemLabel="requests"
            />
          </div>
        </div>
      )}

      {/* TAB 4: DIRECT MESSAGING DESK */}
      {(activeTab === 'faculty-messages' || activeTab === 'messages') && (
        <div className="content-card" style={{ padding: '24px' }}>
          <h2 className="card-title" style={{ marginBottom: '16px' }}>Direct Communication Desk with PDAS</h2>
          <div style={{
            background: 'var(--bg-sunken)',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '16px'
          }}>
            {messages[0]?.thread?.map((t, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: t.sender.includes('Director') ? 'flex-start' : 'flex-end',
                  maxWidth: '75%',
                  background: t.sender.includes('Director') ? '#ffffff' : '#001f9c',
                  color: t.sender.includes('Director') ? '#0f172a' : '#ffffff',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: t.sender.includes('Director') ? '1px solid #e2e8f0' : 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ fontSize: '11px', color: t.sender.includes('Director') ? '#64748b' : '#bfdbfe', marginBottom: '4px' }}>
                  {t.sender} • {t.time}
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  {t.text}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (msgText.trim()) {
                sendMessage(messages[0]?.id || 'msg_001', msgText, currentUser?.name || 'Faculty Member');
                setMsgText('');
              }
            }}
            style={{ display: 'flex', gap: '10px' }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="Send a message or query to PDAS Director & Maintenance Dispatch..."
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">
              <Send size={15} /> Send Message
            </button>
          </form>
        </div>
      )}

      {/* Interactive Ticket Details & Progress Stepper Modal */}
      <Modal
        isOpen={Boolean(selectedTicketDetail)}
        onClose={() => setSelectedTicketDetail(null)}
        title={`Request Details: ${selectedTicketDetail?.controlNo || selectedTicketDetail?.id || ''}`}
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedTicketDetail(null)}
            >
              Close
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedTicketDetail?.status === 'Returned' && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const target = selectedTicketDetail;
                    setSelectedTicketDetail(null);
                    setRevisionTarget(target);
                  }}
                  style={{
                    background: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Edit size={14} /> Revise Request
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setSelectedReqForPrint(selectedTicketDetail);
                  setIsPrintModalOpen(true);
                }}
              >
                <Printer size={14} /> Print Official Slip (PDF)
              </button>
            </div>
          </div>
        }
      >
        {selectedTicketDetail && (
          <div>
            {/* Returned for Revision Notice Banner */}
            {selectedTicketDetail.status === 'Returned' && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: '800', fontSize: '13.5px', marginBottom: '6px' }}>
                  <AlertTriangle size={18} /> Returned for Revision by {selectedTicketDetail.rejectionStage === 'supervisor' ? 'Immediate Supervisor' : 'PDAS Administration'}
                </div>
                <div style={{ fontSize: '13px', color: '#92400e', lineHeight: 1.5, background: '#fef3c7', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' }}>
                  <strong>Reviewer Remarks:</strong> {selectedTicketDetail.rejectionRemarks || selectedTicketDetail.supervisorRemarks || selectedTicketDetail.adminRemarks || 'Please review and update the problem scope and specifications.'}
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const target = selectedTicketDetail;
                    setSelectedTicketDetail(null);
                    setRevisionTarget(target);
                  }}
                  style={{
                    background: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Edit size={14} /> Edit &amp; Resubmit Request
                </button>
              </div>
            )}

            {/* Visual Lifecycle Stepper */}
            <div style={{
              background: 'var(--bg-sunken)',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '14px' }}>
                Request Lifecycle Progress
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
                {[
                  { step: 1, label: '1. Request Filed', done: true, active: false },
                  { step: 2, label: '2. Under Review', done: ['Under Review', 'Pending Final Approval', 'Awaiting Signatures', 'Approved', 'In Progress', 'Ongoing', 'On Hold', 'Completed'].includes(selectedTicketDetail.status), active: selectedTicketDetail.status === 'Under Review' },
                  { step: 3, label: '3. Approved & Assigned', done: ['Approved', 'In Progress', 'Ongoing', 'On Hold', 'Completed'].includes(selectedTicketDetail.status), active: selectedTicketDetail.status === 'Approved' || selectedTicketDetail.status === 'In Progress' || selectedTicketDetail.status === 'Ongoing' || selectedTicketDetail.status === 'On Hold' },
                  { step: 4, label: '4. Serviced & Closed', done: selectedTicketDetail.status === 'Completed', active: false }
                ].map(s => (
                  <div key={s.step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: s.done ? '#10b981' : '#e2e8f0',
                      color: s.done ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '700',
                      marginBottom: '6px'
                    }}>
                      {s.done ? <Check size={14} /> : s.step}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: s.done ? '700' : '500', color: s.done ? '#0f172a' : '#94a3b8' }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Meta Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Subject:</span>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>{selectedTicketDetail.title}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Facility Location:</span>
                <div style={{ fontWeight: '600', color: '#0f172a' }}>{selectedTicketDetail.location}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Category:</span>
                <div><CategoryPill category={selectedTicketDetail.category} /></div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Urgency Level:</span>
                <div><UrgencyBadge urgency={selectedTicketDetail.urgency} /></div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Current Status:</span>
                <div><StatusBadge status={selectedTicketDetail.status} /></div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Assigned Technician:</span>
                <div style={{ fontWeight: '600', color: '#001f9c' }}>{selectedTicketDetail.assignedTo || 'Pending Dispatch'}</div>
              </div>
            </div>
            
            {/* Electronic Approval Block */}
            {(selectedTicketDetail.campusAdminApproved || ['Approved', 'In Progress', 'Ongoing', 'On Hold', 'Completed'].includes(selectedTicketDetail.status) || selectedTicketDetail.finalAction?.status === 'Approved') && (
              <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <CheckCircle size={18} color="#059669" />
                  <span style={{ fontWeight: '800', color: '#047857', fontSize: '14px' }}>APPROVED ✓</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px', color: '#047857' }}>
                  <div>
                    <span style={{ fontWeight: '700' }}>Approved by:</span> {selectedTicketDetail.approverName || 'Not recorded'}
                  </div>
                  <div>
                    <span style={{ fontWeight: '700' }}>Position:</span> Campus Administrator
                  </div>
                  <div>
                    <span style={{ fontWeight: '700' }}>Date &amp; Time:</span> {selectedTicketDetail.campusAdminApprovedAt ? new Date(selectedTicketDetail.campusAdminApprovedAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not recorded'}
                  </div>
                  <div>
                    <span style={{ fontWeight: '700' }}>Method:</span> Electronic Approval
                  </div>
                </div>
              </div>
            )}

            {/* Problem Description */}
            <div style={{ background: 'var(--bg-sunken)', padding: '14px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Problem Scope & Detailed Description:
              </div>
              <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.5 }}>
                {selectedTicketDetail.description}
              </div>
            </div>

            {/* Photo Attachment Preview if available */}
            {selectedTicketDetail.photoUrl && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Attached Defect Photo:
                </div>
                <img
                  src={selectedTicketDetail.photoUrl}
                  alt="Defect visual evidence"
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>
            )}

            {selectedTicketDetail.completionPhotoUrl && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Completion Photo (Technician):
                </div>
                <img
                  src={selectedTicketDetail.completionPhotoUrl}
                  alt="Completed work evidence"
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>
            )}

            {/* Irreparable / Replacement Notice if flagged */}
            {selectedTicketDetail.replacementFlag?.isFlagged && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '12px 16px',
                color: '#991b1b',
                fontSize: '12.5px'
              }}>
                <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <AlertTriangle size={15} color="#dc2626" />
                  Irreparable Item Flagged for Replacement
                </div>
                <div><strong>Technician Reason:</strong> {selectedTicketDetail.replacementFlag.reason}</div>
                <div><strong>Recommended Unit:</strong> {selectedTicketDetail.replacementFlag.itemSpecs}</div>
                <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#b91c1c' }}>
                  Procurement Stage: <strong>{selectedTicketDetail.replacementFlag.procurementStatus || 'Pending Director PR Approval'}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ISO/IEC 25010 Evaluation Modal */}
      <Modal
        isOpen={Boolean(evaluationRequest)}
        onClose={() => setEvaluationRequest(null)}
        title={`ISO/IEC 25010 Service Evaluation: ${evaluationRequest?.controlNo || evaluationRequest?.id || ''}`}
        maxWidth="640px"
      >
        {evaluationRequest && (
          <EvaluationForm
            request={evaluationRequest}
            requesterName={currentUser?.name}
            submitEvaluation={submitEvaluation}
            onSubmitted={() => setEvaluationRequest(null)}
          />
        )}
      </Modal>

      {/* The shared intake dialogs: standard overlay, urgent fast path, print sheet. */}
      <RequestIntake intake={intake} />

      {/* Requester Revision & Resubmission Modal */}
      <Modal
        isOpen={Boolean(revisionTarget)}
        onClose={() => { if (!isSubmittingRevision) setRevisionTarget(null); }}
        title={`Revise Request: ${revisionTarget?.controlNo || revisionTarget?.id || ''}`}
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRevisionTarget(null)}
              disabled={isSubmittingRevision}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmitRevision}
              disabled={isSubmittingRevision || !revDescription.trim()}
              style={{
                background: '#d97706',
                borderColor: '#d97706',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Send size={14} />
              {isSubmittingRevision ? 'Submitting Revision...' : 'Submit Revision & Resend'}
            </button>
          </div>
        }
      >
        {revisionTarget && (
          <form onSubmit={handleSubmitRevision} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Return Remarks Alert */}
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '14px 16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: '800', fontSize: '13.5px', marginBottom: '6px' }}>
                <AlertTriangle size={18} />
                Revision Requested by {revisionTarget.rejectionStage === 'supervisor' ? 'Immediate Supervisor' : 'PDAS Administration'}
              </div>
              <div style={{ fontSize: '13px', color: '#92400e', lineHeight: 1.5, background: '#fef3c7', padding: '10px 12px', borderRadius: '8px' }}>
                <strong>Reviewer Instructions:</strong> {revisionTarget.rejectionRemarks || revisionTarget.supervisorRemarks || revisionTarget.adminRemarks || 'Please review and update the problem scope and specifications.'}
              </div>
            </div>

            {revError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#b91c1c',
                fontSize: '13px'
              }}>
                {revError}
              </div>
            )}

            {/* Grid: Subject & Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Request Subject / Title *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={revTitle}
                  onChange={(e) => setRevTitle(e.target.value)}
                  placeholder="e.g. Leaking Aircon Unit"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Work Category *
                </label>
                <select
                  className="form-select"
                  value={revCategory}
                  onChange={(e) => setRevCategory(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid: Location & Risk Level */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Facility Location *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={revLocation}
                  onChange={(e) => setRevLocation(e.target.value)}
                  placeholder="e.g. CEA Building - Room 204"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Risk / Urgency Level *
                </label>
                <select
                  className="form-select"
                  value={revUrgency}
                  onChange={(e) => setRevUrgency(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {URGENCY_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Problem Description with Word Count */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                Updated Problem Scope &amp; Details *
              </label>
              <LimitedTextArea
                value={revDescription}
                onChange={(val) => setRevDescription(val)}
                placeholder="Provide detailed description of the maintenance or repair needed..."
                maxWords={300}
                rows={4}
              />
            </div>

            {/* Explanation of changes */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                Revision Note (What was changed/clarified)
              </label>
              <input
                type="text"
                className="form-input"
                value={revNotes}
                onChange={(e) => setRevNotes(e.target.value)}
                placeholder="e.g. Clarified the exact room number and unit serial number."
                style={{ width: '100%' }}
              />
            </div>

            {/* Photo Attachment preview/upload */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                Defect Photo (Optional)
              </label>
              {revPhotoUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-sunken)', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <img
                    src={revPhotoUrl}
                    alt="Preview"
                    style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {revPhotoName || 'Attached Photo'}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setRevPhotoUrl(''); setRevPhotoName(''); }}
                      style={{ marginTop: '4px', fontSize: '11px', padding: '2px 8px' }}
                    >
                      Remove / Replace
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setRevPhotoUrl(reader.result);
                      setRevPhotoName(file.name);
                    };
                    reader.readAsDataURL(file);
                  }}
                  style={{ width: '100%' }}
                />
              )}
            </div>
          </form>
        )}
      </Modal>


      {/* Urgent Request Standard Form Completion Modal */}
      <Modal
        isOpen={isUrgentModalOpen}
        onClose={() => setIsUrgentModalOpen(false)}
        title="Complete the standard form"
        maxWidth="640px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsUrgentModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (urgentTargetReq) {
                  const updatedScope = buildScopeOfWorks(urgentTargetReq.category, urgentModalOptions, urgentModalDesc);
                  completeStandardFormForUrgent(urgentTargetReq.id, {
                    immediateSupervisor: urgentModalSupervisor,
                    scopeOfWorks: updatedScope,
                    description: urgentModalDesc.trim() || undefined
                  });
                  setIsUrgentModalOpen(false);
                }
              }}
            >
              Submit the standard form
            </button>
          </div>
        }
      >
        {urgentTargetReq && (
          <div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px', color: '#1e40af' }}>
              <strong>Tracking Number:</strong> {urgentTargetReq.controlNo || urgentTargetReq.id}<br />
              <strong>Urgent Subject:</strong> {urgentTargetReq.title}<br />
              <strong>Location:</strong> {urgentTargetReq.location}
            </div>

            <div className="form-group">
              <label className="form-label">Immediate Supervisor Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Dr. Maria Santos / Department Chair"
                value={urgentModalSupervisor}
                onChange={(e) => setUrgentModalSupervisor(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Scope Options for {urgentTargetReq.category}:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-sunken)', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                {(
                  urgentTargetReq.category === 'Drawing/Design' ? ['Floor Plans', 'Detailed Drawings', 'Perspective', 'Specifications', 'List of Materials', 'Other Services'] :
                  urgentTargetReq.category === 'Physical Structures' ? ['New Structure', 'Rehabilitation/Repair', 'Renovation', 'Partial', 'Full', 'Other Services'] :
                  ['New Installation', 'Repair', 'Rehabilitation', 'Other Services']
                ).map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={urgentModalOptions.includes(opt)}
                      onChange={(e) => {
                        if (e.target.checked) setUrgentModalOptions(prev => [...prev, opt]);
                        else setUrgentModalOptions(prev => prev.filter(o => o !== opt));
                      }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <LimitedTextArea
                id="urgent-complete-desc"
                label="Complete Work Description"
                rows={3}
                value={urgentModalDesc}
                onChange={setUrgentModalDesc}
                style={{ minHeight: '90px' }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
