import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Edit,
  ChevronDown,
  Plus,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { JobRequestPrintSheet } from '../components/common/JobRequestPrintSheet';
import { JobRequestFormOverlay } from '../components/common/JobRequestFormOverlay';
import { ClientSatisfactionPrintSheet } from '../components/common/ClientSatisfactionPrintSheet';
import { PrintPortal } from '../components/common/PrintPortal';
import { printDocument } from '../utils/print';
import { EvaluationForm } from './EvaluationForm';
import { CommunicationBox } from './CommunicationBox';
import {
  useRequestIntake,
  RequestIntake,
  RequestIntakePanel
} from '../components/common/RequestIntake';
import { LimitedTextArea } from '../components/common/LimitedTextArea';
import { PageHeader } from '../components/common/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { formatTicketDate } from '../components/common/TimeGreeting';
import { CATEGORY_OPTIONS, isUrgentReq } from '../utils/jobRequestIntake';
import { filterMyRequests } from '../utils/myRequests';
import { SupervisorDashboard } from './supervisor/SupervisorDashboard';
import { apiGetSupervisorsList } from '../backend/api';
import { DashboardSkeleton, useDelayedLoading } from '../components/common/Skeleton';



/* Shared filter options. My Open Tickets and Request History render the SAME
   control set in the SAME order at the SAME size, so switching tabs does not
   move anything around. The only difference is the actions slot on the right.
   The category list is the shared one, so a category you can file is always a
   category you can filter by. */
const URGENCY_OPTIONS = ['High', 'Medium', 'Low'];

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
      aria-label="Filter by urgency"
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
    reviseRequisition,
    isLoadingRequisitions
  } = useData();
  const showSkeleton = useDelayedLoading(isLoadingRequisitions && (!requisitions || requisitions.length === 0));

  const [selectedTicketDetail, setSelectedTicketDetail] = useState(null);
  const [evaluationRequest, setEvaluationRequest] = useState(null);
  const [selectedCsmPrint, setSelectedCsmPrint] = useState(null);
  const [revisionTarget, setRevisionTarget] = useState(null);
  const [selectedReqForPrint, setSelectedReqForPrint] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Completed requests requiring CSM feedback
  const userPendingFeedback = useMemo(() => {
    return requisitions.filter(r => {
      const isCompleted = r.status === 'Completed' || r.status === 'completed';
      if (!isCompleted) return false;
      const isMine = Boolean(
        currentUser &&
        ((currentUser.name && r.requestedBy && r.requestedBy.toLowerCase() === currentUser.name.toLowerCase()) ||
         (currentUser.email && r.requesterEmail && r.requesterEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
         (currentUser.id && r.userId && String(r.userId) === String(currentUser.id)))
      );
      if (!isMine) return false;
      const alreadyEvaluated = (evaluations || []).some(e => e.reqId === r.id || e.controlNo === r.controlNo);
      return !alreadyEvaluated;
    });
  }, [requisitions, currentUser, evaluations]);

  // Revision Form State
  const [revTitle, setRevTitle] = useState('');
  const [revCategory, setRevCategory] = useState('');
  const [revLocation, setRevLocation] = useState('');
  const [revUrgency, setRevUrgency] = useState('');
  const [revSupervisor, setRevSupervisor] = useState('');
  const [revDescription, setRevDescription] = useState('');
  const [revNotes, setRevNotes] = useState('');
  const [revPhotoUrl, setRevPhotoUrl] = useState('');
  const [revPhotoName, setRevPhotoName] = useState('');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [revError, setRevError] = useState('');

  // Supervisor dropdown state and helpers (declared before revisionTarget effect)
  const [supervisorList, setSupervisorList] = useState([]);
  const [supDropOpen, setSupDropOpen] = useState(false);
  const supDropRef = useRef(null);
  const [revSupDropOpen, setRevSupDropOpen] = useState(false);
  const revSupDropRef = useRef(null);
  const [isTypingRevSup, setIsTypingRevSup] = useState(false);

  const refreshSupervisors = useCallback(() => {
    apiGetSupervisorsList()
      .then((list) => setSupervisorList(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshSupervisors();
  }, [refreshSupervisors]);

  useEffect(() => {
    if (revisionTarget) {
      setRevTitle(revisionTarget.title || '');
      setRevCategory(revisionTarget.category || 'Carpentry');
      setRevLocation(revisionTarget.location || '');
      const rawUrg = revisionTarget.urgency || '';
      const normUrg = /high/i.test(rawUrg) ? 'High' : (/low/i.test(rawUrg) ? 'Low' : 'Medium');
      setRevUrgency(normUrg);
      setRevSupervisor(revisionTarget.immediateSupervisor || '');
      setRevDescription(revisionTarget.description || '');
      setRevNotes('');
      setRevPhotoUrl(revisionTarget.photoUrl || '');
      setRevPhotoName(revisionTarget.photoName || '');
      setRevError('');
      setIsTypingRevSup(false);
      refreshSupervisors();
    }
  }, [revisionTarget, refreshSupervisors]);

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
        immediateSupervisor: revSupervisor.trim(),
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

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  // Request History opens on the closed records by default; the scope pills
  // still let the user widen the view to active or all records.
  const [historyScope, setHistoryScope] = useState('completed'); // 'all' | 'active' | 'completed'
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 8;

  // Reset table pagination whenever the tab or filters change
  useEffect(() => { setTablePage(1); }, [activeTab, searchTerm, categoryFilter, urgencyFilter, statusFilter, historyScope]);

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

  // Dropdown outside click handlers (for revision modal supervisor dropdown)
  useEffect(() => {
    if (!supDropOpen) return;
    const handler = (e) => {
      if (supDropRef.current && !supDropRef.current.contains(e.target)) setSupDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [supDropOpen]);

  useEffect(() => {
    if (!revSupDropOpen) return;
    const handler = (e) => {
      if (revSupDropRef.current && !revSupDropRef.current.contains(e.target)) setRevSupDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [revSupDropOpen]);

  const filteredRevSupList = useMemo(() => {
    if (!revSupDropOpen) return supervisorList;
    if (!isTypingRevSup) return supervisorList;
    const q = revSupervisor.trim().toLowerCase();
    if (!q) return supervisorList;
    return supervisorList.filter((s) => {
      const full = `${s.firstName} ${s.middleName ? s.middleName + ' ' : ''}${s.lastName}`.toLowerCase();
      return full.includes(q);
    });
  }, [supervisorList, revSupervisor, revSupDropOpen, isTypingRevSup]);

  const selectRevSupFromList = useCallback((sup) => {
    const fullName = `${sup.firstName} ${sup.middleName ? sup.middleName + ' ' : ''}${sup.lastName}`.trim();
    setRevSupervisor(fullName);
    setIsTypingRevSup(false);
    setRevSupDropOpen(false);
  }, []);

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

  // Standard submit tabs show the launcher or open form directly
  useEffect(() => {
    if (intake.filed) return;
    if (activeTab === 'faculty-urgent' || activeTab === 'faculty-submit') {
      intake.openStandard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, initialRequestType]);

  // Messaging State
  const [msgText, setMsgText] = useState('');

  // Deep link: a clicked notification stores its ticket ref here — open the
  // exact record in the details modal, then clear so it never reopens.
  useEffect(() => {
    if (!focusedTicketRef) return;
    if (!requisitions || requisitions.length === 0) return;
    const all = [...(requisitions || [])];
    const refStr = String(focusedTicketRef || '').trim().toLowerCase();
    const found = all.find(r =>
      String(r.controlNo || '').toLowerCase() === refStr ||
      String(r.id || '').toLowerCase() === refStr ||
      String(r.ticket_no || '').toLowerCase() === refStr ||
      String(r.id_raw || '').toLowerCase() === refStr ||
      String(r.officialTrackingNo || '').toLowerCase() === refStr
    );
    if (found) {
      if (onTabChange) onTabChange('faculty-history');
      const isCompleted = found.status === 'Completed' || found.status === 'completed';
      const alreadyEvaluated = (evaluations || []).some(e => e.reqId === found.id || e.controlNo === found.controlNo);
      if (isCompleted && !alreadyEvaluated) {
        setEvaluationRequest(found);
      } else {
        setSelectedTicketDetail(found);
      }
    }
    setFocusedTicketRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTicketRef, requisitions]);

  // Requisition Partitioning (First-come, first-served: earliest first)
  const byDateAsc = (a, b) => {
    const d = String(a.date || '').localeCompare(String(b.date || ''));
    if (d !== 0) return d;
    return String(a.controlNo || a.id || '').localeCompare(String(b.controlNo || b.id || ''));
  };
  const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
  /* The shared predicate — see utils/myRequests. This list and the Dashboard
     tile counts read from the same source, so they cannot drift apart. */
  const myTickets = useMemo(() => filterMyRequests(requisitions, currentUser), [requisitions, currentUser]);
  const activeTickets = useMemo(() => myTickets.filter(r => r.status !== 'Completed' && r.status !== 'Rejected'), [myTickets]);
  const completedTickets = useMemo(() => myTickets.filter(r => r.status === 'Completed' || r.status === 'Rejected'), [myTickets]);

  const scopedTickets = useMemo(() => {
    if (historyScope === 'active') return activeTickets;
    if (historyScope === 'completed') return completedTickets;
    return myTickets;
  }, [historyScope, activeTickets, completedTickets, myTickets]);

  // Filtered Active Tickets
  const filteredActiveTickets = activeTickets.filter(req => {
    const matchesSearch = 
      String(req.controlNo || req.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.title && req.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.description && req.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.location && req.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
    const matchesUrgency = urgencyFilter === 'all' ||
      (urgencyFilter === 'High' && /high|urgent|emergency/i.test(String(req.urgency || ''))) ||
      (urgencyFilter === 'Medium' && (/medium/i.test(String(req.urgency || '')) || !req.urgency)) ||
      (urgencyFilter === 'Low' && /low/i.test(String(req.urgency || ''))) ||
      req.urgency === urgencyFilter;
    const matchesStatus = statusFilter === 'all' || req.status.toLowerCase().replace(/\s+/g, '-') === statusFilter || (statusFilter === 'pending-final-approval' && (req.status === 'Pending Final Approval' || req.status === 'Awaiting Signatures'));
    return matchesSearch && matchesCategory && matchesUrgency && matchesStatus;
  }).sort(byDateDesc);

  // Filtered History & Tracking Tickets (Scoped by All / Active / Completed)
  const filteredHistoryTickets = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    return scopedTickets.filter(req => {
      const matchesSearch = 
        !q ||
        String(req.controlNo || req.id || req.ticket_no || '').toLowerCase().includes(q) ||
        (req.title && req.title.toLowerCase().includes(q)) ||
        (req.description && req.description.toLowerCase().includes(q)) ||
        (req.location && req.location.toLowerCase().includes(q)) ||
        (req.assignedTo && req.assignedTo.toLowerCase().includes(q));
      const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
      const matchesUrgency = urgencyFilter === 'all' ||
        (urgencyFilter === 'High' && /high|urgent|emergency/i.test(String(req.urgency || ''))) ||
        (urgencyFilter === 'Medium' && (/medium/i.test(String(req.urgency || '')) || !req.urgency)) ||
        (urgencyFilter === 'Low' && /low/i.test(String(req.urgency || ''))) ||
        req.urgency === urgencyFilter;
      const matchesStatus = statusFilter === 'all' || 
        req.status.toLowerCase().replace(/\s+/g, '-') === statusFilter || 
        (statusFilter === 'pending-final-approval' && (req.status === 'Pending Final Approval' || req.status === 'Awaiting Signatures'));
      return matchesSearch && matchesCategory && matchesUrgency && matchesStatus;
    }).sort(byDateDesc);
  }, [scopedTickets, searchTerm, categoryFilter, urgencyFilter, statusFilter]);

  const pagedActive = paginate(filteredActiveTickets);
  const pagedHistory = paginate(filteredHistoryTickets);

  /* My Open Tickets lists active work; Request History lists closed records.
     Both tabs reuse the same filter bar, search and status vocabulary. */
  const isHistoryTab = activeTab === 'faculty-history';
  const visibleTickets = isHistoryTab ? filteredHistoryTickets : filteredActiveTickets;
  const visiblePage = isHistoryTab ? pagedHistory : pagedActive;

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

  if (showSkeleton) {
    return <div style={{ paddingTop: '16px' }}><DashboardSkeleton /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
      
      {/* Page Header. The Scan QR / New Request pair belongs to the Dashboard
          only — the same two buttons were repeated on every list page below. */}
      <PageHeader
        breadcrumbs={['My Requests', activeTab === 'faculty-history' ? 'History' : activeTab === 'faculty-tickets' || activeTab === 'my-tickets' ? 'Open Tickets' : 'New Request']}
        title={activeTab === 'faculty-history' ? 'Request History' : activeTab === 'faculty-tickets' || activeTab === 'my-tickets' ? 'My Open Tickets' : 'New Request'}
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
              onTrack={() => { if (onTabChange) onTabChange('faculty-history'); }}
            />
          </div>
        </div>
      )}


      {/* UNIFIED REQUEST HISTORY & LIVE TRACKING TAB */}
      {(activeTab === 'faculty-history' || activeTab === 'faculty-tickets' || activeTab === 'my-tickets') && (
        <div className="content-card" style={{ paddingTop: '20px' }}>

          {/* Pending CSM Feedback Banner */}
          {userPendingFeedback.length > 0 && (
            <div style={{
              margin: '0 24px 20px 24px',
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
              border: '1.5px solid #93c5fd',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#001f9c',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Star size={22} fill="#fbbf24" stroke="#fbbf24" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Client Satisfaction Feedback Required</span>
                    <span style={{
                      fontSize: '11px',
                      background: '#dbeafe',
                      color: '#1e40af',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: '700'
                    }}>
                      {userPendingFeedback.length} Completed {userPendingFeedback.length === 1 ? 'Request' : 'Requests'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '3px', lineHeight: 1.4 }}>
                    Your request <strong>{userPendingFeedback[0].controlNo || userPendingFeedback[0].id}</strong> has been marked completed by the PDAS team. Please fill in the official <strong>Client Satisfaction Measurement (CSM / QF-HRM-15)</strong> form to help maintain service excellence.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setEvaluationRequest(userPendingFeedback[0])}
                style={{
                  background: '#071746',
                  borderColor: '#071746',
                  color: '#ffffff',
                  fontWeight: '700',
                  padding: '9px 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Star size={14} fill="#fbbf24" stroke="#fbbf24" /> Complete Feedback Form (CSM)
              </button>
            </div>
          )}

          {/* Scope Selection Pills (Request History only) */}
          {isHistoryTab && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px 16px 24px',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'inline-flex', background: 'var(--bg-sunken)', padding: '3px', borderRadius: '10px', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setHistoryScope('all')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: historyScope === 'all' ? '700' : '500',
                  color: historyScope === 'all' ? '#ffffff' : '#475569',
                  background: historyScope === 'all' ? '#071746' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>All Requests</span>
                <span style={{
                  fontSize: '11px',
                  background: historyScope === 'all' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  color: historyScope === 'all' ? '#ffffff' : '#475569',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: '700'
                }}>
                  {myTickets.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryScope('active')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: historyScope === 'active' ? '700' : '500',
                  color: historyScope === 'active' ? '#ffffff' : '#475569',
                  background: historyScope === 'active' ? '#071746' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Active &amp; Tracking</span>
                <span style={{
                  fontSize: '11px',
                  background: historyScope === 'active' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  color: historyScope === 'active' ? '#ffffff' : '#475569',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: '700'
                }}>
                  {activeTickets.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHistoryScope('completed')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: historyScope === 'completed' ? '700' : '500',
                  color: historyScope === 'completed' ? '#ffffff' : '#475569',
                  background: historyScope === 'completed' ? '#071746' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Completed</span>
                <span style={{
                  fontSize: '11px',
                  background: historyScope === 'completed' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                  color: historyScope === 'completed' ? '#ffffff' : '#475569',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: '700'
                }}>
                  {completedTickets.length}
                </span>
              </button>
            </div>
          </div>
          )}

          {/* Filter Bar */}
          <TicketFilterBar
            category={categoryFilter}
            onCategoryChange={setCategoryFilter}
            urgency={urgencyFilter}
            onUrgencyChange={setUrgencyFilter}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            statusLabel="All Statuses"
            onReset={handleResetFilters}
            isFiltered={isFiltered}
            actions={
              <>
                <span className="ticket-filter-bar__result">
                  {visibleTickets.length} {isHistoryTab
                    ? `record${visibleTickets.length === 1 ? '' : 's'}`
                    : 'open'}
                </span>
                {isHistoryTab && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleExportCSV}
                    disabled={filteredHistoryTickets.length === 0}
                    title="Export the records currently listed to CSV"
                  >
                    <Download size={14} /> Export CSV
                  </button>
                )}
              </>
            }
          />

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">TRACKING NO</th>
                  <th scope="col">SUBJECT &amp; LOCATION</th>
                  <th scope="col">CATEGORY</th>
                  <th scope="col">URGENCY</th>
                  <th scope="col">CURRENT STATUS</th>
                  <th scope="col">DATE FILED</th>
                  <th scope="col">ASSIGNED TECH</th>
                  <th scope="col">SERVICE EVALUATION</th>
                  <th scope="col" style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visibleTickets.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
                      <History size={36} style={{ margin: '0 auto 10px auto', opacity: 0.35, color: '#001f9c' }} />
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                        {myTickets.length === 0 ? 'No maintenance requests filed yet' : 'No requests match your current filters'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', maxWidth: '420px', marginInline: 'auto' }}>
                        {myTickets.length === 0 ? (
                          'Submit a new request or scan a QR code to track maintenance, repairs, and service evaluations in real-time.'
                        ) : (
                          'Try clearing your search query or adjusting your category, risk level, and status filters.'
                        )}
                      </div>
                      {myTickets.length === 0 ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => { if (onTabChange) onTabChange('faculty-submit'); else intake.openStandard(); }}
                          style={{ marginTop: '16px' }}
                        >
                          <Plus size={14} /> File a Request Now
                        </button>
                      ) : isFiltered ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleResetFilters}
                          style={{ marginTop: '14px' }}
                        >
                          Clear Filters
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  visiblePage.rows.map(req => {
                    const evalData = evaluations.find(e => e.reqId === req.id || e.controlNo === req.controlNo);
                    let avgRating = null;
                    if (evalData) {
                      const scores = [evalData.functionalSuitability, evalData.usability, evalData.reliability, evalData.performanceEfficiency, evalData.security].filter(Boolean);
                      avgRating = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '5.0';
                    }

                    return (
                      <tr
                        key={req.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedTicketDetail(req)}
                      >
                        <td style={{ fontWeight: '700', color: '#001f9c', whiteSpace: 'nowrap' }}>
                          {req.controlNo || req.ticket_no || req.id}
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
                              <AlertTriangle size={11} /> Irreparable Item Flagged
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
                        <td style={{ fontSize: '12.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {formatTicketDate(req.date)}
                        </td>
                        <td style={{ fontSize: '12.5px', color: req.assignedTo ? '#0f172a' : '#94a3b8' }}>
                          {req.assignedTo || 'Pending Assignment'}
                        </td>
                        <td>
                          {req.status === 'Completed' ? (
                            evalData ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700' }}>
                                  <Star size={12} fill="#047857" /> {avgRating} / 5.0 (Evaluated)
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={(e) => { e.stopPropagation(); setSelectedCsmPrint({ eval: evalData, req }); }}
                                  style={{ padding: '2px 8px', fontSize: '11px', color: '#001f9c', fontWeight: '700' }}
                                  title="View official Client Satisfaction Measurement form (QF-HRM-15)"
                                >
                                  <Eye size={12} /> View CSM
                                </button>
                              </div>
                            ) : Boolean(
                              currentUser && (
                                (req.userId && String(req.userId) === String(currentUser.id)) ||
                                (req.requesterId && String(req.requesterId) === String(currentUser.id)) ||
                                (currentUser.name && req.requestedBy && req.requestedBy.toLowerCase() === currentUser.name.toLowerCase()) ||
                                (currentUser.email && req.requesterEmail && req.requesterEmail.toLowerCase() === currentUser.email.toLowerCase())
                              )
                            ) ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={(e) => { e.stopPropagation(); setEvaluationRequest(req); }}
                                style={{ background: '#f59e0b', color: '#0f172a', fontWeight: '700', border: 'none', padding: '4px 10px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                              >
                                <Star size={12} fill="#0f172a" /> Fill Feedback (CSM)
                              </button>
                            ) : (
                              <span style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic' }}>
                                Awaiting Requester Feedback
                              </span>
                            )
                          ) : req.status === 'Rejected' ? (
                            <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>Closed (Rejected)</span>
                          ) : req.status === 'Returned' ? (
                            <span style={{ fontSize: '11.5px', color: '#d97706', fontWeight: '600' }}>Awaiting Revision</span>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#0284c7', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '6px', fontWeight: '600' }}>
                              <Clock size={11} /> Live Tracking
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
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
                              title="Track progress and view lifecycle stepper"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={13} /> Track
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => { setSelectedReqForPrint(req); setIsPrintModalOpen(true); }}
                              title="Print official QF-PDAS-DC-01 form"
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
          <div style={{ padding: '14px 24px', borderTop: '1px solid #edf1f7', background: 'var(--bg-card, #ffffff)' }}>
            <Pagination
              page={visiblePage.safe}
              totalPages={visiblePage.totalPages}
              onPageChange={setTablePage}
              pageSize={tablePageSize}
              total={visibleTickets.length}
              itemLabel={isHistoryTab ? 'records' : 'open requests'}
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
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {selectedTicketDetail?.status === 'Completed' && (
                (() => {
                  const evalData = (evaluations || []).find(e => e.reqId === selectedTicketDetail.id || e.controlNo === selectedTicketDetail.controlNo);
                  const isRequester = Boolean(
                    currentUser && (
                      (selectedTicketDetail.userId && String(selectedTicketDetail.userId) === String(currentUser.id)) ||
                      (selectedTicketDetail.requesterId && String(selectedTicketDetail.requesterId) === String(currentUser.id)) ||
                      (currentUser.name && selectedTicketDetail.requestedBy && selectedTicketDetail.requestedBy.toLowerCase() === currentUser.name.toLowerCase()) ||
                      (currentUser.email && selectedTicketDetail.requesterEmail && selectedTicketDetail.requesterEmail.toLowerCase() === currentUser.email.toLowerCase())
                    )
                  );
                  if (evalData) {
                    return (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedCsmPrint({ eval: evalData, req: selectedTicketDetail })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#001f9c', fontWeight: '700' }}
                        title="View official Client Satisfaction Measurement form (QF-HRM-15)"
                      >
                        <Eye size={14} /> View CSM Form
                      </button>
                    );
                  }
                  if (isRequester) {
                    return (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          const target = selectedTicketDetail;
                          setSelectedTicketDetail(null);
                          setEvaluationRequest(target);
                        }}
                        style={{
                          background: '#f59e0b',
                          color: '#0f172a',
                          border: 'none',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Star size={14} fill="#0f172a" /> Complete Feedback (CSM)
                      </button>
                    );
                  }
                  return null;
                })()
              )}
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
                  Attached Photo:
                </div>
                <img
                  src={selectedTicketDetail.photoUrl}
                  alt="Facility visual evidence"
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

      {/* Client Satisfaction Measurement (CSM) Evaluation Modal */}
      <Modal
        isOpen={Boolean(evaluationRequest)}
        onClose={() => setEvaluationRequest(null)}
        title={`Client Satisfaction Measurement (QF-HRM-15): ${evaluationRequest?.controlNo || evaluationRequest?.id || ''}`}
        maxWidth="820px"
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

      {/* CSM Official Form Print / View Modal */}
      <Modal
        isOpen={Boolean(selectedCsmPrint)}
        onClose={() => setSelectedCsmPrint(null)}
        title="Official Document (QF-HRM-15) — Client Satisfaction Measurement"
        maxWidth="840px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Tracking: <strong>{selectedCsmPrint?.req?.controlNo || selectedCsmPrint?.req?.id || '—'}</strong>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedCsmPrint(null)}>Close</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => printDocument()}>
                <Printer size={14} /> Print / Save PDF
              </button>
            </div>
          </div>
        }
      >
        {selectedCsmPrint && (
          <ClientSatisfactionPrintSheet
            evaluation={selectedCsmPrint.eval}
            request={selectedCsmPrint.req}
          />
        )}
      </Modal>

      {selectedCsmPrint && (
        <PrintPortal active={Boolean(selectedCsmPrint)}>
          <ClientSatisfactionPrintSheet
            evaluation={selectedCsmPrint.eval}
            request={selectedCsmPrint.req}
          />
        </PrintPortal>
      )}

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
                  Urgency Level *
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

            {/* Immediate Supervisor */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                Immediate Supervisor *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  value={revSupervisor || currentUser?.assignedSupervisor || currentUser?.supervisorName || 'Assigned Immediate Supervisor'}
                  disabled
                  style={{ width: '100%', background: 'var(--bg-sunken)', color: '#0f172a', fontWeight: '600', cursor: 'default', paddingRight: '140px' }}
                />
                <span style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: '#eff6ff',
                  color: '#071746',
                  fontSize: '11px', fontWeight: '700',
                  padding: '2px 8px', borderRadius: '9999px',
                  border: '1px solid #bfdbfe',
                  whiteSpace: 'nowrap'
                }}>
                  ✓ Assigned Supervisor
                </span>
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
                Photo Attachment (Optional)
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


      {/* Official QF-PDAS-DC-01 Print Slip Modal */}
      {isPrintModalOpen && selectedReqForPrint && (
        <Modal
          isOpen={isPrintModalOpen}
          onClose={() => { setIsPrintModalOpen(false); setSelectedReqForPrint(null); }}
          title={`Official Job Request Slip (QF-PDAS-DC-01) — ${selectedReqForPrint.controlNo || selectedReqForPrint.id}`}
          maxWidth="920px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                ISAT U Dumangas Quality Management System (ISO 9001:2015 Compliant)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setIsPrintModalOpen(false); setSelectedReqForPrint(null); }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => printDocument()}
                >
                  <Printer size={14} /> Print / Save PDF
                </button>
              </div>
            </div>
          }
        >
          <div style={{ maxHeight: '72vh', overflowY: 'auto', padding: '8px' }}>
            <JobRequestPrintSheet req={selectedReqForPrint} />
          </div>
        </Modal>
      )}

      {/* Print-only official form rendered next to <body> for a clean sheet */}
      {selectedReqForPrint && (
        <PrintPortal active={isPrintModalOpen}>
          <JobRequestPrintSheet req={selectedReqForPrint} />
        </PrintPortal>
      )}
    </div>
  );
};
