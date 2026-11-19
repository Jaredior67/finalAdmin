import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Eye,
  CheckCircle2,
  Printer,
  Archive,
  FileSignature,
  FileText,
  Columns,
  RefreshCw,
  Search,
  Calendar,
  X
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { JobRequestPrintSheet } from '../../components/common/JobRequestPrintSheet';
import { TechnicalAssessmentReportSheet } from '../../components/common/TechnicalAssessmentReportSheet';
import { PrintPortal } from '../../components/common/PrintPortal';
import { printDocument } from '../../utils/print';
import { LimitedTextArea } from '../../components/common/LimitedTextArea';
import { Pagination } from '../../components/ui/Pagination';
import { isUrgentReq } from '../../utils/jobRequestIntake';
import { PageHeader } from '../../components/common/PageHeader';

export const JobRequests = ({ initialStatusTab = 'all' }) => {
  const {
    requisitions,
    reviewRequisition,
    approveRequisition,
    rejectRequisition,
    confirmSignatures,
    assignTechnician,
    updateRequisitionStatus,
    updateProcurementStatus,
    updateRequisitionTrackingNo,
    updateRequisitionForm,
    archiveRequisition,
    users,
    focusedTicketRef,
    setFocusedTicketRef,
    ticketSearch: searchTerm,
    refreshRequisitions,
    isLoadingRequisitions
  } = useData();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [sortMode, setSortMode] = useState('newest');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (typeof refreshRequisitions === 'function') {
        await refreshRequisitions();
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const normalizeStatusTab = (tab) => {
    if (tab === 'ongoing') return 'in-progress';
    if (tab === 'under_review') return 'under-review';
    return tab || 'all';
  };

  // Sync tab if parent passes or changes initialStatusTab
  useEffect(() => {
    if (initialStatusTab) {
      setActiveStatusTab(normalizeStatusTab(initialStatusTab));
    }
  }, [initialStatusTab]);

  // Deep link: a clicked notification stores its ticket ref here — open the
  // exact record, then clear so it never reopens.
  useEffect(() => {
    if (!focusedTicketRef) return;
    if (!requisitions || requisitions.length === 0) return;
    const refStr = String(focusedTicketRef || '').trim().toLowerCase();
    const found = (requisitions || []).find(r =>
      String(r.controlNo || '').toLowerCase() === refStr ||
      String(r.id || '').toLowerCase() === refStr ||
      String(r.ticket_no || '').toLowerCase() === refStr ||
      String(r.id_raw || '').toLowerCase() === refStr ||
      String(r.officialTrackingNo || '').toLowerCase() === refStr
    );
    if (found) {
      handleOpenDetail(found);
      setFocusedTicketRef(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTicketRef, requisitions]);

  const [activeStatusTab, setActiveStatusTab] = useState(normalizeStatusTab(initialStatusTab));
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(1);
  const [selectedReq, setSelectedReq] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('split');
  const [dispatchMessage, setDispatchMessage] = useState('');
  const [assignee, setAssignee] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [procurementChoice, setProcurementChoice] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  // Set when an action cannot be taken at this stage, so the reason appears
  // next to the buttons rather than only as a transient toast.
  const [decisionError, setDecisionError] = useState('');
  // Every action is async now; without this the buttons stay live during the
  // round trip and a double click issues the request twice.
  const [busy, setBusy] = useState(false);
  const [signaturesConfirmed, setSignaturesConfirmed] = useState(false);
  const [scanUrl, setScanUrl] = useState('');

  // Print modal state
  const [isPrintDocModalOpen, setIsPrintDocModalOpen] = useState(false);
  const [trackingEdit, setTrackingEdit] = useState('');
  const [trackingMsg, setTrackingMsg] = useState('');

  // Archive confirmation target
  const [archiveTarget, setArchiveTarget] = useState(null);

  // Maintenance personnel list
  const technicians = (users || []).filter(u =>
    u.role === 'technician' ||
    u.role === 'maintenance' ||
    u.userType === 'maintenance'
  );

  // Dynamic availability and workload calculation for realistic dispatch
  const getTechnicianWorkload = (tech) => {
    if (!tech) return null;
    const activeJobs = (requisitions || []).filter(r => {
      const isOngoing = r.status === 'Ongoing' || r.status === 'In Progress' || r.status === 'Approved';
      const matchesId = String(r.assignedTo || '') === String(tech.id || '');
      const matchesName = String(r.assignedTo || '').toLowerCase() === String(tech.name || '').toLowerCase();
      return isOngoing && (matchesId || matchesName);
    });

    const baseStatus = String(tech.availabilityStatus || 'available').toLowerCase();

    if (baseStatus === 'off_duty') {
      return {
        status: 'off_duty',
        label: 'Off Duty / On Leave',
        color: '#ef4444',
        bgColor: '#fee2e2',
        activeCount: activeJobs.length,
        isAvailable: false
      };
    }

    if (baseStatus === 'busy' || activeJobs.length >= 3) {
      return {
        status: 'busy',
        label: `Busy (${activeJobs.length} active ${activeJobs.length === 1 ? 'task' : 'tasks'})`,
        color: '#d97706',
        bgColor: '#fef3c7',
        activeCount: activeJobs.length,
        isAvailable: true
      };
    }

    if (activeJobs.length > 0) {
      return {
        status: 'available',
        label: `On Duty (${activeJobs.length} ongoing)`,
        color: '#059669',
        bgColor: '#ecfdf5',
        activeCount: activeJobs.length,
        isAvailable: true
      };
    }

    return {
      status: 'available',
      label: 'Available (Ready for dispatch)',
      color: '#10b981',
      bgColor: '#d1fae5',
      activeCount: 0,
      isAvailable: true
    };
  };

  /* What the admin may do with this ticket right now, derived from its status.
   *
   * A free "Workflow Status" dropdown used to stand in for this. It offered every
   * status at every stage, and the server refused most of them — so the common
   * case was a 409 the admin could not act on. Naming the available decisions
   * means the buttons on screen are exactly the transitions the policy allows
   * from here, and a ticket that is waiting on someone else says so instead of
   * offering an action that will fail.
   *
   * Mirrors TRANSITIONS in backend/src/utils/ticketPolicy.js. */
  const stageFor = (req) => {
    switch (req?.status) {
      case 'Pending':
      case 'Pending Supervisor Approval':
        return {
          heading: 'PDAS Endorsement & Evaluation',
          note: 'Move this request into PDAS review to begin the assessment, or return to requester if revision is required.',
          actions: [
            { key: 'review', label: 'Begin Review', icon: Eye, onClick: onBeginReview },
            { key: 'return', label: 'Return to Requester', icon: AlertTriangle, onClick: onReturn, variant: 'danger' },
          ],
        };
      case 'Under Review':
        return {
          heading: 'PDAS Assessment',
          note: 'Endorsing routes this to the Campus Administrator for final approval. Returning it sends it back to the requester.',
          actions: [
            { key: 'endorse', label: 'Endorse to Campus Administrator', icon: CheckCircle2, onClick: onEndorse },
            { key: 'return', label: 'Return to Requester', icon: AlertTriangle, onClick: onReturn, variant: 'danger' },
          ],
        };
      case 'Pending Final Approval':
      case 'Awaiting Signatures':
        return {
          heading: 'Awaiting Final Approval',
          note: 'With the Campus Administrator. It returns to this queue once approved, and the work order is issued then.',
          actions: [],
        };
      case 'Approved':
        return {
          heading: 'Issue the Work Order',
          note: 'Assign the approved work. A control number is issued automatically.',
          actions: [
            { key: 'assign', label: 'Assign Work Order', icon: CheckCircle2, onClick: onAssign },
            { key: 'return', label: 'Return to Requester', icon: AlertTriangle, onClick: onReturn, variant: 'danger' },
          ],
        };
      case 'Ongoing':
        return {
          heading: 'Work in progress',
          note: 'Maintenance personnel are carrying out the work. The technician marks it complete.',
          actions: [],
        };
      case 'On Hold':
        return {
          heading: 'On hold',
          note: 'Release the ticket to resume, or return it to the requester.',
          actions: [
            { key: 'hold', label: 'Release to Ongoing', icon: CheckCircle2, onClick: onReleaseHold },
            { key: 'return', label: 'Return to Requester', icon: AlertTriangle, onClick: onReturn, variant: 'danger' },
          ],
        };
      case 'Completed':
      case 'Rejected':
        return {
          heading: req.status === 'Completed' ? 'Closed — completed' : 'Closed — rejected',
          note: 'This record is closed. It cannot be moved; archive it or raise a new request.',
          actions: [],
        };
      case 'Returned':
        return {
          heading: 'Returned for revision',
          note: 'Sent back by a Supervisor, PDAS or the Approver — this is NOT a closed record. Restore it to Pending once the revision is in, or close it outright.',
          actions: [
            { key: 'restore', label: 'Restore to Pending', icon: CheckCircle2, onClick: onRestore },
            { key: 'close', label: 'Close Request', icon: AlertTriangle, onClick: onCloseReturned, variant: 'danger' },
          ],
        };
      default:
        return {
          heading: 'No action available',
          note: `"${req?.status}" is not a stage PDAS can act on.`,
          actions: [],
        };
    }
  };

  // Priority sorting: High Risk -> Medium Risk -> Low Risk
  const priorityOrder = { 'High Risk': 1, 'Urgent': 1, 'High': 1, 'Medium Risk': 2, 'Medium': 2, 'Low Risk': 3, 'Low': 3 };

  // Status segmentation tabs with live counts
  const statusTabs = [
    { id: 'all', label: 'All Requests', count: requisitions.filter(r => !r.isArchived).length },
    { id: 'pending', label: 'Pending Review', count: requisitions.filter(r => !r.isArchived && (r.status === 'Pending' || r.status === 'Pending Supervisor Approval')).length, highlight: true },
    { id: 'under-review', label: 'Under Review', count: requisitions.filter(r => !r.isArchived && r.status === 'Under Review').length },
    { id: 'pending-final', label: 'Pending Final Approval', count: requisitions.filter(r => !r.isArchived && (r.status === 'Pending Final Approval' || r.status === 'Awaiting Signatures')).length },
    { id: 'approved', label: 'Ready to Assign', count: requisitions.filter(r => !r.isArchived && r.status === 'Approved').length, highlight: true },
    { id: 'in-progress', label: 'Ongoing Work', count: requisitions.filter(r => !r.isArchived && (r.status === 'In Progress' || r.status === 'Ongoing')).length },
    { id: 'on-hold', label: 'On Hold', count: requisitions.filter(r => !r.isArchived && r.status === 'On Hold').length },
    { id: 'returned', label: 'Returned', count: requisitions.filter(r => !r.isArchived && r.status === 'Returned').length },
    { id: 'completed', label: 'Completed', count: requisitions.filter(r => !r.isArchived && r.status === 'Completed').length },
  ];

  const filteredList = requisitions
    .filter(req => !req.isArchived) // Exclude archived tickets from all regular tabs
    .filter(req => {
      const matchesTab =
        activeStatusTab === 'all' ||
        (activeStatusTab === 'pending' && (req.status === 'Pending' || req.status === 'Pending Supervisor Approval')) ||
        ((activeStatusTab === 'under-review' || activeStatusTab === 'under_review') && req.status === 'Under Review') ||
        (activeStatusTab === 'pending-final' && (req.status === 'Pending Final Approval' || req.status === 'Awaiting Signatures')) ||
        (activeStatusTab === 'approved' && req.status === 'Approved') ||
        ((activeStatusTab === 'in-progress' || activeStatusTab === 'ongoing') && (req.status === 'In Progress' || req.status === 'Ongoing')) ||
        (activeStatusTab === 'on-hold' && req.status === 'On Hold') ||
        (activeStatusTab === 'returned' && req.status === 'Returned') ||
        (activeStatusTab === 'completed' && req.status === 'Completed') ||
        (activeStatusTab === 'flagged' && (req.replacementFlag?.isFlagged || req.maintenanceFlag?.type));

      const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
      const matchesUrgency = urgencyFilter === 'all' ||
        (urgencyFilter === 'High' && /high|urgent|emergency/i.test(String(req.urgency || ''))) ||
        (urgencyFilter === 'Medium' && (/medium/i.test(String(req.urgency || '')) || !req.urgency)) ||
        (urgencyFilter === 'Low' && /low/i.test(String(req.urgency || ''))) ||
        req.urgency === urgencyFilter;
      const s = String(localSearch || searchTerm || '').trim().toLowerCase();
      const matchesSearch = !s ||
        String(req.controlNo || req.ticket_no || req.id || req.officialTrackingNo || '').toLowerCase().includes(s) ||
        String(req.location || '').toLowerCase().includes(s) ||
        String(req.title || req.category || '').toLowerCase().includes(s) ||
        String(req.description || '').toLowerCase().includes(s) ||
        String(req.requestedBy || req.requesterName || '').toLowerCase().includes(s) ||
        String(req.department || req.office || '').toLowerCase().includes(s) ||
        String(req.assignedTo || '').toLowerCase().includes(s);

      return matchesTab && matchesCategory && matchesUrgency && matchesSearch;
    });

  // Reset to first page whenever the result set changes
  useEffect(() => { setPage(1); }, [searchTerm, localSearch, categoryFilter, urgencyFilter, activeStatusTab, pageSize, sortMode]);

  const sortValue = (req, key) => {
    if (key === 'tracking') return String(req.controlNo || req.id || '');
    if (key === 'urgency') return priorityOrder[req.urgency] || 5;
    if (key === 'status') return String(req.status || '');
    return '';
  };

  const toggleSort = (key) => {
    if (sortKey !== key) { setSortKey(key); setSortDir(1); }
    else if (sortDir === 1) { setSortDir(-1); }
    else { setSortKey(null); setSortDir(1); }
    setPage(1);
  };

  const sortedList = [...filteredList].sort((a, b) => {
    if (sortKey) {
      const vA = sortValue(a, sortKey);
      const vB = sortValue(b, sortKey);
      if (typeof vA === 'number') return (vA - vB) * sortDir;
      return String(vA).localeCompare(String(vB)) * sortDir;
    }

    if (sortMode === 'oldest') {
      const d = String(a.date || '').localeCompare(String(b.date || ''));
      if (d !== 0) return d;
      return String(a.controlNo || a.id || '').localeCompare(String(b.controlNo || b.id || ''));
    }

    if (sortMode === 'urgency') {
      const u = (priorityOrder[a.urgency] || 5) - (priorityOrder[b.urgency] || 5);
      if (u !== 0) return u;
      return String(b.date || '').localeCompare(String(a.date || ''));
    }

    if (sortMode === 'status') {
      const s = String(a.status || '').localeCompare(String(b.status || ''));
      if (s !== 0) return s;
      return String(b.date || '').localeCompare(String(a.date || ''));
    }

    // Default: 'newest' (Newest requests appear first at the top of the table)
    const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateCmp !== 0) return dateCmp;
    return String(b.controlNo || b.id || '').localeCompare(String(a.controlNo || a.id || ''));
  });

  const totalPages = Math.max(1, Math.ceil(sortedList.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedList = sortedList.slice((safePage - 1) * pageSize, safePage * pageSize);

  const sortArrow = (key) => (sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : '');

  const sortThStyle = { cursor: 'pointer', userSelect: 'none' };

  const handleOpenDetail = (req) => {
    setSelectedReq(req);
    setTrackingEdit(req.controlNo || '');
    setTrackingMsg('');
    // The select's value is the account id. Pre-selecting the stored id is what
    // lets the admin see who already holds the work and change it; seeding the
    // name instead would show no selection, because no option value is a name.
    setAssignee(req.assignedToId ? String(req.assignedToId) : '');
    setScheduledDate(req.scheduledDate || '');
    setAdminNotes('');
    setDecisionError('');
    setProcurementChoice(req.replacementFlag?.procurementStatus || 'Pending Purchase Request (PR)');
    setSignaturesConfirmed(Boolean(req.signedFormScanUrl || req.signaturesConfirmed));
    setScanUrl(req.signedFormScanUrl || '');
    setIsModalOpen(true);
  };

  /* Each action is one server call, awaited, and the modal stays open on
     failure so the reason is still on screen.
     handleSaveChanges used to read a free "Workflow Status" dropdown and try to
     infer the right endpoint from the before/after pair, then apply the new
     status to local state before the request had returned. It also called 13
     setters that were never declared, so the modal threw a ReferenceError the
     moment it opened. The lifecycle now lives in ticketPolicy.js on the server;
     the buttons below name the decision the admin is making instead. */
  const runAction = async (label, action) => {
    if (!selectedReq) return;
    setBusy(true);
    setDecisionError('');
    try {
      const ok = await action();
      if (ok) {
        setDispatchMessage(`${selectedReq.controlNo || selectedReq.ticket_no || selectedReq.id} — ${label}`);
        setIsModalOpen(false);
      }
      // A failed action returns false; the write path has already toasted the
      // server's own explanation, so the modal is left open for context.
    } finally {
      setBusy(false);
    }
  };

  const onBeginReview = () => runAction('placed under PDAS review.', () =>
    reviewRequisition(selectedReq.id, adminNotes || 'Placed under PDAS review.'));

  const onEndorse = () => runAction('endorsed to the Campus Administrator.', () =>
    approveRequisition(selectedReq.id, adminNotes || 'Endorsed by PDAS.'));

  const onReturn = () => runAction('returned to the requester.', () =>
    rejectRequisition(selectedReq.id, adminNotes || 'Returned to the requester for revision.'));

  /* 'Returned' is a revise-and-resubmit state, not a closed one, so it needs
     its own two decisions. Neither goes through an approval endpoint: the
     server's generic status change records the move, the history row, the
     audit entry and the notifications. */
  const onRestore = () => runAction('restored to Pending.', () =>
    updateRequisitionStatus(selectedReq.id, 'Pending', 'PDAS Director', adminNotes || 'Revision received — returned to the approval chain.'));

  const onCloseReturned = () => runAction('closed.', () =>
    updateRequisitionStatus(selectedReq.id, 'Rejected', 'PDAS Director', adminNotes || 'Closed without further action.'));

  const onAssign = () => {
    const person = technicians.find(t => String(t.id) === String(assignee));
    if (!person) {
      setDecisionError('Choose the maintenance person who will carry out the work.');
      return;
    }
    return runAction(
      `assigned to ${person.name}.`,
      () => assignTechnician(selectedReq.id, person, person.id, scheduledDate || null)
    );
  };

  const onReleaseHold = () => runAction('released back to ongoing work.', () =>
    updateRequisitionStatus(selectedReq.id, 'Ongoing', 'PDAS Director', adminNotes || 'Released from hold.'));

  const onSaveProcurement = () => {
    if (!selectedReq?.replacementFlag?.isFlagged) return;
    setBusy(true);
    updateProcurementStatus(selectedReq.id, procurementChoice).then(() => {
      setBusy(false);
      setIsModalOpen(false);
    });
  };

  /* Which decisions the currently-open ticket offers. Computed here, after the
     action handlers, and not up with the other derived values: stageFor()
     builds object literals that *name* onBeginReview, onEndorse, onReturn and
     the rest, so running it above them reads bindings that are still in their
     temporal dead zone. The page then loads fine — selectedReq is null, so
     stageFor takes the default branch and touches none of them — and the
     ReferenceError only fires on the click that opens the modal, which is the
     one moment it looks like the button itself is broken. */
  const stage = stageFor(selectedReq);

  return (
    <div>
      <PageHeader
        breadcrumbs={['PDAS Administration', 'Job Requests']}
        title="Job Requests"
        description="ISAT U Dumangas Campus — Manage, review, endorse, and assign facility work orders"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoadingRequisitions}
              title="Refresh requests from database"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
            >
              <RefreshCw
                size={14}
                style={{
                  transition: 'transform 0.5s ease',
                  transform: isRefreshing ? 'rotate(360deg)' : 'none',
                  animation: isRefreshing ? 'spin 0.75s linear infinite' : 'none'
                }}
              />
              <span>{isRefreshing ? 'Syncing…' : 'Sync Live Data'}</span>
            </button>
          </div>
        }
      />

      {dispatchMessage && (
        <div
          role="status"
          className="animate-scale-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            fontSize: '13.5px',
            fontWeight: '600'
          }}
        >
          <CheckCircle size={18} />
          <span>{dispatchMessage}</span>
        </div>
      )}

      {/* Segmented Status Tabs Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          marginBottom: '16px',
        }}
      >
        {statusTabs.map(tab => {
          const isActive = activeStatusTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveStatusTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 11px',
                borderRadius: '9999px',
                fontSize: '12.5px',
                fontWeight: isActive ? '700' : '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                background: isActive ? '#071746' : '#ffffff',
                color: isActive ? '#ffffff' : '#334155',
                border: isActive ? '1.5px solid #071746' : '1.5px solid #cbd5e1',
                boxShadow: isActive ? '0 2px 6px rgba(7, 23, 70, 0.25)' : 'none'
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '20px',
                height: '20px',
                padding: '0 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '800',
                background: isActive ? 'rgba(255, 255, 255, 0.25)' : (tab.highlight && tab.count > 0 ? '#fef3c7' : 'var(--bg-sunken)'),
                color: isActive ? '#ffffff' : (tab.highlight && tab.count > 0 ? '#b45309' : '#64748b'),
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters & Search Control Bar */}
      <div className="filter-bar" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        {/* In-page live search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search tracking #, requester, location..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '34px', paddingRight: localSearch ? '30px' : '12px', height: '40px', fontSize: '13.5px', margin: 0 }}
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => setLocalSearch('')}
              aria-label="Clear search"
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <select
          className="select-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ height: '40px' }}
        >
          <option value="all">All Categories</option>
          <option value="Drawing/Design">Drawing/Design</option>
          <option value="Physical Structures">Physical Structures</option>
          <option value="Electrical">Electrical</option>
          <option value="Mechanical">Mechanical</option>
          <option value="Water/Sanitary">Water/Sanitary</option>
          <option value="Air Conditioning">Air Conditioning</option>
        </select>

        {/* Risk Level filter */}
        <select
          aria-label="Filter by urgency"
          className="select-filter"
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
          style={{ height: '40px' }}
        >
          <option value="all">All Risk Levels</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {/* Sort Order Selector */}
        <select
          className="select-filter"
          value={sortMode}
          onChange={(e) => { setSortMode(e.target.value); setSortKey(null); }}
          style={{ height: '40px', fontWeight: '600', color: '#1e293b', border: '1.5px solid #cbd5e1' }}
          title="Order of requests"
        >
          <option value="newest">Sort: Newest First (Default)</option>
          <option value="oldest">Sort: Oldest First</option>
          <option value="urgency">Sort: High Urgency First</option>
          <option value="status">Sort: By Status</option>
        </select>
      </div>

      {/* Requests Table */}
      <div className="content-card">
        <div className="table-responsive">
          <table className="data-table data-table-stacked">
            <thead>
              <tr>
                <th scope="col" onClick={() => toggleSort('tracking')} style={sortThStyle} title="Sort by tracking number">TRACKING NUMBER &amp; DATE{sortArrow('tracking')}</th>
                <th scope="col">ISSUE &amp; LOCATION</th>
                <th scope="col">REQUESTER</th>
                <th scope="col">CATEGORY</th>
                <th scope="col" onClick={() => toggleSort('urgency')} style={sortThStyle} title="Sort by urgency">URGENCY{sortArrow('urgency')}</th>
                <th scope="col" onClick={() => toggleSort('status')} style={sortThStyle} title="Sort by status">STATUS{sortArrow('status')}</th>
                <th scope="col">ASSIGNED TECHNICIAN</th>
                <th scope="col" style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {sortedList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No matching job requests found in this view.
                  </td>
                </tr>
              ) : (
                pagedList.map(req => {
                  const isFlagged = req.replacementFlag?.isFlagged;
                  const isHighPriority = isUrgentReq(req);

                  return (
                    <tr
                      key={req.id}
                      style={{
                        background: isHighPriority ? 'rgba(239, 68, 68, 0.05)' : 'inherit'
                      }}
                    >
                      <td data-label="Tracking Number" style={{ fontWeight: '700', color: '#001f9c' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '800' }}>{req.controlNo}</div>
                        <div style={{ fontSize: '11.5px', color: '#475569', fontWeight: '500', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} color="#64748b" />
                          <span>{req.date ? new Date(req.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}</span>
                        </div>
                        {req.qrCodeRef && (
                          <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '1px' }}>QR: {req.qrCodeRef}</div>
                        )}
                      </td>
                      <td data-label="Issue & Location">
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{req.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{req.location}</div>
                        {isFlagged && (
                          <div style={{
                            marginTop: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#b91c1c',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            <AlertTriangle size={11} />
                            Irreparable Item • {req.replacementFlag.procurementStatus}
                          </div>
                        )}
                        {req.maintenanceFlag?.type && (
                          <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: '700', color: '#9f1239' }}>
                            Status Flag: {req.maintenanceFlag.type}
                            {req.maintenanceFlag.type === 'Cannot Complete' && req.maintenanceFlag.scheduledDate && (
                              <div style={{ color: '#9a3412', fontWeight: '600' }}>
                                Follow-up: {req.maintenanceFlag.scheduledWork} on {req.maintenanceFlag.scheduledDate} at {req.maintenanceFlag.scheduledTime}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td data-label="Requester">
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{req.requestedBy}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{req.department}</div>
                        <div style={{ fontSize: '10.5px', color: '#001f9c' }}>{req.idNumber}</div>
                      </td>
                      <td data-label="Category">
                        <CategoryPill category={req.category} />
                      </td>
                      <td data-label="Urgency">
                        <UrgencyBadge urgency={req.urgency} />
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={req.status} />
                      </td>
                      <td data-label="Technician" style={{ fontSize: '12.5px', color: req.assignedTo ? '#1e293b' : '#94a3b8' }}>
                        {req.assignedTo ? (
                          (() => {
                            const assignedTech = (technicians || []).find(t =>
                              String(t.id) === String(req.assignedTo) ||
                              String(t.name || '').toLowerCase() === String(req.assignedTo || '').toLowerCase()
                            );
                            const workload = assignedTech ? getTechnicianWorkload(assignedTech) : null;
                            const displayName = assignedTech ? (assignedTech.name || `${assignedTech.firstName || ''} ${assignedTech.lastName || ''}`.trim()) : req.assignedTo;
                            return (
                              <div>
                                <div style={{ fontWeight: '600', color: '#0f172a' }}>{displayName}</div>
                                {workload ? (
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: workload.color,
                                    marginTop: '2px'
                                  }}>
                                    <span>{workload.dot}</span>
                                    <span>{workload.status === 'off_duty' ? 'Off Duty' : workload.label}</span>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>Assigned Personnel</div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <span style={{ color: '#d97706', fontWeight: '600' }}>Pending Assignment</span>
                        )}
                      </td>
                      <td className="stacked-actions" data-label="Actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', width: '100%' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenDetail(req)}
                            title={req.status === 'Completed' || req.status === 'Rejected' ? 'Review request details' : 'Review request & assign maintenance personnel'}
                          >
                            <Eye size={13} />
                            {req.status === 'Completed' || req.status === 'Rejected' ? 'Review' : 'Review & Assign'}
                          </button>
                          {!req.isArchived && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setArchiveTarget(req)}
                              title="Archive this ticket"
                              style={{ color: '#64748b' }}
                            >
                              <Archive size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #edf1f7', background: 'var(--bg-card, #ffffff)' }}>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            total={sortedList.length}
            itemLabel="requests"
          />
        </div>
      </div>

      {/* Review & Dispatch. The form renders on the right; the decision panel on
          the left offers only the actions the ticket's current stage allows. */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onBack={() => setIsModalOpen(false)}
        title={`Review Request ${selectedReq?.controlNo || selectedReq?.ticket_no || ''}`}
        maxWidth={modalTab === 'split' ? '1380px' : '900px'}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ISAT U Dumangas PDAS Central Operations
            </span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={busy}
              >
                Close
              </button>
              {stage.actions.map(({ key, label, icon: Icon, onClick, variant }) => (
                <button
                  key={key}
                  type="button"
                  className={variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
                  onClick={onClick}
                  disabled={busy}
                >
                  {Icon && <Icon size={16} />}
                  {busy ? 'Working…' : label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {selectedReq && stage && (
          <div>
            {/* Modal Navigation Tabs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '10px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${modalTab === 'form' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setModalTab('form')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}
                >
                  <FileText size={15} /> Official Form (QF-PDAS-DC-01)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${modalTab === 'decision' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setModalTab('decision')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}
                >
                  <CheckCircle2 size={15} /> Decision & Action Panel
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${modalTab === 'split' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setModalTab('split')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}
                >
                  <Columns size={15} /> Split View
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e3a8a', background: '#eff6ff', padding: '3px 10px', borderRadius: '999px', border: '1px solid #bfdbfe' }}>
                  {selectedReq.controlNo || selectedReq.ticket_no || selectedReq.id}
                </span>
                <StatusBadge status={selectedReq.status} />
              </div>
            </div>

            <div style={{
              display: modalTab === 'split' ? 'grid' : 'block',
              gridTemplateColumns: modalTab === 'split' ? '380px 1fr' : undefined,
              gap: '20px',
              alignItems: 'start'
            }}>
              {/* Decision panel column */}
              {(modalTab === 'decision' || modalTab === 'split') && (
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: modalTab === 'decision' ? '820px' : undefined, margin: modalTab === 'decision' ? '0 auto' : undefined }}>
                  {/* Tracking number — issued when the work order is assigned (after final approval); admin may correct it */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Tracking Number (auto on assignment, after Final Approval — admin can correct)</label>
                      <input className="form-input" value={trackingEdit ?? ''} onChange={(e) => setTrackingEdit(e.target.value)} placeholder="PENDING, issued when the work order is assigned" style={{ fontSize: '13px', fontWeight: '700' }} />
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                      const ok = updateRequisitionTrackingNo(selectedReq.id, trackingEdit);
                      setTrackingMsg(ok ? `Tracking set to ${trackingEdit.trim()}.` : 'Invalid or duplicate tracking number.');
                      if (ok) setSelectedReq(prev => ({ ...prev, controlNo: trackingEdit.trim() }));
                    }}>Save Tracking</button>
                    {trackingMsg && <span style={{ fontSize: '12px', color: '#1e40af' }}>{trackingMsg}</span>}
                  </div>
                  {/* Header info */}
                  <div style={{ padding: '14px 18px', background: 'var(--bg-sunken)', borderRadius: '12px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>{selectedReq.title}</div>
                      <UrgencyBadge urgency={selectedReq.urgency} />
                    </div>
                    <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{selectedReq.description}</div>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '14px', fontSize: '12px', color: '#64748b' }}>
                      <span><strong>Location:</strong> {selectedReq.location}</span>
                      <span><strong>Requester:</strong> {selectedReq.requestedBy} ({selectedReq.department})</span>
                    </div>
                    {selectedReq.completionPhotoUrl && (
                      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={selectedReq.completionPhotoUrl} alt="Completed work" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                        <span style={{ fontSize: '12px', color: '#047857', fontWeight: '700' }}>Completion photo attached by technician</span>
                      </div>
                    )}
                  </div>

                  {/* Request Review Details */}

                  {/* Hardcopy Archive: optional attachment for physical records */}
                  {(selectedReq.status === 'Pending Final Approval' || selectedReq.status === 'Awaiting Signatures') && (
                    <div style={{ background: 'var(--bg-sunken)', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
                      <div style={{ fontWeight: '800', color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                        <FileSignature size={18} color="#001f9c" />
                        Hardcopy Archive & Scanned Form Attachment (Optional)
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px', lineHeight: 1.5 }}>
                        Electronic approvals are recorded here. If a signed hardcopy has been filed with the PDAS office, record the verification and attach the scan.
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>
                        <input
                          type="checkbox"
                          checked={signaturesConfirmed}
                          onChange={(e) => setSignaturesConfirmed(e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: '#059669' }}
                        />
                        Record hardcopy QF-PDAS-DC-01 archive on file
                      </label>
                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Upload Scanned/Photographed Form or Reference (optional)</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="form-input"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setScanUrl(reader.result);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            style={{ fontSize: '12px', padding: '6px' }}
                          />
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Or enter URL/reference link to scanned signed form..."
                            value={scanUrl.startsWith('data:') ? '' : scanUrl}
                            onChange={(e) => setScanUrl(e.target.value)}
                            style={{ fontSize: '12px' }}
                          />
                        </div>
                        {scanUrl && (
                          <div style={{ marginTop: '6px', fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', padding: '4px 8px', borderRadius: '6px' }}>
                            <CheckCircle size={14} color="#059669" />
                            <span>Signed document attached {scanUrl.startsWith('data:image') ? '(Photo file ready)' : scanUrl.startsWith('data:') ? '(Document file ready)' : `(${scanUrl})`}</span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!signaturesConfirmed}
                        onClick={() => {
                          confirmSignatures(selectedReq.id, adminNotes || 'Signed hardcopy received and verified.', scanUrl);
                          setIsModalOpen(false);
                        }}
                        style={{ opacity: signaturesConfirmed ? 1 : 0.5 }}
                      >
                        <CheckCircle size={15} />
                        Confirm Signatures → Send for Final Approval
                      </button>
                    </div>
                  )}

                  {/* Show verified hardcopy scan notice if already confirmed */}
                  {selectedReq.signedFormScanUrl && selectedReq.status !== 'Awaiting Signatures' && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px', color: '#166534', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle size={16} color="#16a34a" />
                        <span><strong>Physical Signatures Verified:</strong> Signed QF-PDAS-DC-01 hardcopy verified on file.</span>
                      </div>
                      {selectedReq.signedFormScanUrl.startsWith('data:image') ? (
                        <a href={selectedReq.signedFormScanUrl} target="_blank" rel="noreferrer" style={{ color: '#15803d', fontWeight: '700', textDecoration: 'underline', fontSize: '12px' }}>View Scan</a>
                      ) : !selectedReq.signedFormScanUrl.startsWith('data:') && (
                        <a href={selectedReq.signedFormScanUrl} target="_blank" rel="noreferrer" style={{ color: '#15803d', fontWeight: '700', textDecoration: 'underline', fontSize: '12px' }}>View Reference</a>
                      )}
                    </div>
                  )}

                  {/* Irreparable Flag details if present */}
                  {selectedReq.replacementFlag?.isFlagged && (
                    <div style={{
                      background: '#fef2f2',
                      border: '1.5px solid #fecaca',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      marginBottom: '18px',
                      fontSize: '13px',
                      color: '#991b1b'
                    }}>
                      <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <AlertTriangle size={16} color="#dc2626" />
                        FIELD TECHNICIAN FLAGGED THIS AS IRREPARABLE
                      </div>
                      <div><strong>Defect Reason:</strong> {selectedReq.replacementFlag.reason}</div>
                      <div><strong>Recommended Replacement Specs:</strong> {selectedReq.replacementFlag.itemSpecs}</div>
                    </div>
                  )}

                  {/* Decision panel. The heading and the buttons come from stageFor(),
                so what is offered always matches what the policy allows from the
                ticket's current status. */}
                  <div style={{
                    background: stage.actions.length ? 'var(--bg-sunken)' : 'var(--bg-canvas)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px', marginBottom: '4px' }}>
                      {stage.heading}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.5, marginBottom: '12px' }}>
                      {stage.note}
                    </div>

                    {selectedReq.status === 'Approved' && (
                      <>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label className="form-label">Maintenance Personnel *</label>
                          <select
                            className="form-select"
                            value={assignee}
                            onChange={(e) => { setAssignee(e.target.value); setDecisionError(''); }}
                            disabled={busy}
                          >
                            <option value="">Select maintenance personnel</option>
                            {technicians.map(t => {
                              const name = t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim();
                              const spec = t.specialization || t.title || 'General Maintenance';
                              const wl = getTechnicianWorkload(t);
                              return (
                                /* The value is the account id, not the label. The server
                                   stores assigned_to as a foreign key and matches on it
                                   for visibility, so sending the display string left
                                   the work order invisible to the person it named. */
                                <option key={t.id} value={String(t.id)}>
                                  {wl.dot} {name} — {spec} · {wl.label}
                                </option>
                              );
                            })}
                          </select>

                          {/* Interactive Visual Technician Availability & Workload Grid */}
                          {technicians.length > 0 && (
                            <div style={{ marginTop: '10px' }}>
                              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Technician Duty Status &amp; Active Load
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '8px' }}>
                                {technicians.map(t => {
                                  const name = t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim();
                                  const spec = t.specialization || t.title || 'General Maintenance';
                                  const wl = getTechnicianWorkload(t);
                                  const isSelected = String(assignee) === String(t.id);
                                  const isOffDuty = wl.status === 'off_duty';

                                  return (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => {
                                        if (!busy) {
                                          setAssignee(String(t.id));
                                          setDecisionError('');
                                        }
                                      }}
                                      style={{
                                        textAlign: 'left',
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                        background: isSelected ? '#eff6ff' : (isOffDuty ? '#f8fafc' : '#ffffff'),
                                        cursor: 'pointer',
                                        opacity: isOffDuty ? 0.7 : 1,
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12.5px', fontWeight: '700', color: isSelected ? '#1e40af' : '#0f172a' }}>
                                          {name}
                                        </span>
                                        <span style={{
                                          fontSize: '10px',
                                          fontWeight: '700',
                                          padding: '2px 6px',
                                          borderRadius: '999px',
                                          background: wl.bgColor,
                                          color: wl.color
                                        }}>
                                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: wl.color, display: 'inline-block', marginRight: '4px' }} />
                                          {wl.status === 'off_duty' ? 'Off Duty' : (wl.activeCount === 0 ? 'Free' : `${wl.activeCount} active`)}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                        {spec}
                                      </div>
                                      {isSelected ? (
                                        <div style={{ fontSize: '10.5px', color: '#2563eb', fontWeight: '700', marginTop: '4px' }}>
                                          ✓ Selected for assignment
                                        </div>
                                      ) : isOffDuty ? (
                                        <div style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: '500', marginTop: '4px' }}>
                                          Currently marked off-duty
                                        </div>
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {technicians.length === 0 && (
                            <div style={{ marginTop: '6px', fontSize: '12.5px', color: '#b45309', fontWeight: '600' }}>
                              No maintenance accounts exist. Add one under User Management before issuing a work order.
                            </div>
                          )}
                          {decisionError && (
                            <div style={{ marginTop: '6px', fontSize: '12.5px', color: '#b91c1c', fontWeight: '600' }}>{decisionError}</div>
                          )}
                        </div>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label className="form-label">Scheduled Date</label>
                          <input
                            type="date"
                            className="form-input"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            disabled={busy}
                          />
                        </div>
                      </>
                    )}

                    {selectedReq.replacementFlag?.isFlagged && (
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label">Procurement Status</label>
                        <select
                          className="form-select"
                          value={procurementChoice}
                          onChange={(e) => setProcurementChoice(e.target.value)}
                          disabled={busy}
                        >
                          <option value="Pending Purchase Request (PR)">Pending Purchase Request (PR Form Preparation)</option>
                          <option value="PR Submitted to Supply & BAC">PR Submitted to Supply & BAC Office</option>
                          <option value="Canvassing / Purchase Order (PO) Issued">Canvassing / Purchase Order (PO) Issued</option>
                          <option value="Delivered & Awaiting Installation">Delivered to Campus & Awaiting Installation</option>
                        </select>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: '8px' }}
                          disabled={busy}
                          onClick={onSaveProcurement}
                        >
                          Save Procurement Status
                        </button>
                      </div>
                    )}

                    {!selectedReq.replacementFlag?.isFlagged && (
                      <div className="form-group">
                        <LimitedTextArea
                          id="admin-remarks"
                          label="Remarks"
                          rows={3}
                          value={adminNotes}
                          onChange={setAdminNotes}
                          placeholder="Recorded against this decision and shown to the next person in the chain."
                          style={{ minHeight: '80px' }}
                        />
                      </div>
                    )}

                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsPrintDocModalOpen(true)}
                    >
                      <Printer size={15} /> Print Official QF-PDAS-DC-01 Form (PDF)
                    </button>
                  </div>
                </div>
              )}

              {/* Official Form Preview Column */}
              {(modalTab === 'form' || modalTab === 'split') && (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  minWidth: 0,
                  maxWidth: modalTab === 'form' ? '840px' : undefined,
                  margin: modalTab === 'form' ? '0 auto' : undefined
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: 'var(--bg-sunken)' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Official Form Preview (QF-PDAS-DC-01)
                    </span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#001f9c',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '9999px',
                      padding: '3px 10px'
                    }}>
                      {selectedReq.controlNo || selectedReq.ticket_no || selectedReq.id} • {selectedReq.status}
                    </span>
                  </div>
                  <div style={{ maxHeight: '72vh', overflowY: 'auto', overflowX: 'hidden', padding: '20px', background: 'var(--bg-sunken)' }}>
                    <JobRequestPrintSheet
                      req={{
                        ...selectedReq,
                        assignedTo: (() => {
                          const person = technicians.find(t => String(t.id) === String(assignee));
                          return person ? (person.name || `${person.firstName} ${person.lastName}`.trim()) : selectedReq.assignedTo;
                        })(),
                        notes: adminNotes || selectedReq.notes,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* PRINT OFFICIAL QF-PDAS-DC-01 FORM MODAL — print-safe sheet */}
      <Modal
        isOpen={isPrintDocModalOpen}
        onClose={() => setIsPrintDocModalOpen(false)}
        onBack={() => setIsPrintDocModalOpen(false)}
        title="Official PDAS Job Request Form (QF-PDAS-DC-01)"
        maxWidth="800px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {selectedReq?.controlNo || 'PENDING, issued when the work order is assigned'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsPrintDocModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => printDocument()}
              >
                <Printer size={15} /> Print / Save PDF
              </button>
            </div>
          </div>
        }
      >
        {selectedReq && (
          <JobRequestPrintSheet req={selectedReq} />
        )}
      </Modal>
      {selectedReq && (
        <PrintPortal active={isPrintDocModalOpen}>
          <JobRequestPrintSheet req={selectedReq} />
        </PrintPortal>
      )}

      {/* Archive confirmation */}
      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          if (archiveTarget) {
            const success = await archiveRequisition(archiveTarget.id_raw ?? archiveTarget.id);
            if (success) {
              setDispatchMessage(`${archiveTarget.controlNo || archiveTarget.id} moved to archive.`);
            }
          }
          setArchiveTarget(null);
        }}
        title="Archive Ticket?"
        message={archiveTarget ? `Move ${archiveTarget.controlNo || archiveTarget.id} (${archiveTarget.title}) to the archive? It will be hidden from all queues but kept in historical records.` : ''}
        confirmText="Archive Ticket"
        isDanger={false}
      />
    </div>
  );
};
