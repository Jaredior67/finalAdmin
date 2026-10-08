import React, { useState, useEffect } from 'react';
import {
  Landmark,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Check,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { UrgencyBadge, CategoryPill } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { JobRequestFormOverlay } from '../../components/common/JobRequestFormOverlay';
import { JobRequestPrintSheet } from '../../components/common/JobRequestPrintSheet';
import { PageHeader } from '../../components/common/PageHeader';
import {
  useRequestIntake,
  RequestIntake,
  RequestIntakeActions,
  RequestIntakePanel
} from '../../components/common/RequestIntake';
import { formatHeaderDate, formatTicketDate } from '../../components/common/TimeGreeting';
import { LimitedTextArea, REMARKS_WORD_LIMIT } from '../../components/common/LimitedTextArea';
import { validateWordLimit } from '../../utils/wordLimit';
import { ChartsRow, DonutCard, BarCard } from '../../components/common/DashboardCharts';

export const CampusAdminDashboard = () => {
  const { currentUser } = useAuth();
  const { requisitions, updateFinalAction, peekNextTrackingNumber, focusedTicketRef, setFocusedTicketRef, ticketSearch: searchTerm } = useData();

  const [dispatchMessage, setDispatchMessage] = useState('');

  // Filing a request is the same flow every other account gets: the same two
  // buttons, the same QF-PDAS-DC-01 form, the same urgent fast path and the
  // same print sheet. Only the requester's identity differs. The backend has
  // deliberately no role gate on POST / — the row records who filed it.
  const intake = useRequestIntake({
    requester: {
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      role: 'Campus Administrator',
      department: currentUser?.department || 'Office of the Campus Administrator',
      phone: currentUser?.phone || '',
      idNumber: currentUser?.idNumber || ''
    },
    onFiled: (created) => {
      if (!created) return;
      setDispatchMessage(
        `${created.requestType} ${created.id} filed. Tracking PENDING, issued when the work order is assigned, after final approval. ` +
        'Requester must pass the signed QF-PDAS-DC-01 hardcopy to the PDAS Office within 24 hours.'
      );
    }
  });

  const now = new Date();
  const formattedDate = formatHeaderDate(now);

  const [selectedReq, setSelectedReq] = useState(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionStatus, setDecisionStatus] = useState('Approved');
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [decisionError, setDecisionError] = useState('');
  // The decision is a network call now, so the confirm button is disabled while
  // it is in flight. Without it a double click issues two approvals.
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tabFilter, setTabFilter] = useState('pending'); // 'pending' | 'approved' | 'disapproved' | 'all'
  const [successToast, setSuccessToast] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Requisitions filtering
  const activeRequisitions = requisitions.filter(r => !r.isArchived);

  // Group by Final Action status. The approver queue only lists tickets PDAS
  // has already acted on (past Pending/Under Review) — brand-new filings stay
  // with PDAS until review, preserving the process order.
  const needsFinalAction = (r) => {
    const faStatus = r.finalAction?.status;
    return (!faStatus || faStatus === 'Pending') && !['Pending', 'Under Review'].includes(r.status);
  };
  const pendingFinalAction = activeRequisitions.filter(needsFinalAction);

  /* An Approver's decline no longer writes the terminal 'Rejected': the
     manuscript sends it back THROUGH the System Administrator, so the row comes
     back as 'Under Review' carrying rejection_stage = 'approver'. Keying only
     on 'Rejected' emptied this list for every decline actually made here. */
  const isDisapproved = (r) =>
    r.finalAction?.status === 'Disapproved' || r.rejectionStage === 'approver' || r.status === 'Rejected';

  /* Where a ticket sits in THIS screen's pipeline: the label the Final Action
     donut draws and the tint the category bars beside it inherit, plus the one
     palette both read. A segment and a bar describing the same ticket must
     never come out different colours, so neither of them gets its own copy. */
  const finalActionStage = (r) => (
    r.finalAction?.status === 'Approved'
      ? 'Approved'
      : isDisapproved(r)
        ? 'Returned for revision'
        : needsFinalAction(r)
          ? 'Awaiting my decision'
          : 'With PDAS for review'
  );
  const FINAL_ACTION_COLORS = {
    Approved: '#001f9c',
    'Returned for revision': '#f2a33a',
    'Awaiting my decision': '#f59e0b',
    'With PDAS for review': '#3b82f6'
  };

  const approvedFinalAction = activeRequisitions.filter(r => r.finalAction?.status === 'Approved' || r.status === 'Approved' || r.status === 'Ongoing' || r.status === 'Completed');
  const disapprovedFinalAction = activeRequisitions.filter(isDisapproved);

  const filteredRequisitions = activeRequisitions.filter(r => {
    const s = String(searchTerm || '').trim().toLowerCase();
    const matchesSearch = !s ||
      String(r.controlNo || r.ticket_no || r.id || '').toLowerCase().includes(s) ||
      String(r.title || r.category || '').toLowerCase().includes(s) ||
      String(r.description || '').toLowerCase().includes(s) ||
      String(r.requestedBy || '').toLowerCase().includes(s) ||
      String(r.department || '').toLowerCase().includes(s) ||
      String(r.location || '').toLowerCase().includes(s);

    const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;

    let matchesTab = true;
    if (tabFilter === 'pending') {
      matchesTab = needsFinalAction(r);
    } else if (tabFilter === 'approved') {
      matchesTab = r.finalAction?.status === 'Approved' || r.status === 'Approved' || r.status === 'Ongoing' || r.status === 'Completed';
    } else if (tabFilter === 'disapproved') {
      matchesTab = isDisapproved(r);
    }

    return matchesSearch && matchesCategory && matchesTab;
  }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  // Deep link: a clicked notification stores its ticket ref here — open the
  // exact record in the decision modal, then clear so it never reopens.
  useEffect(() => {
    if (!focusedTicketRef) return;
    const refStr = String(focusedTicketRef || '').trim();
    const found = (requisitions || []).find(r =>
      String(r.controlNo || '') === refStr ||
      String(r.id || '') === refStr ||
      String(r.ticket_no || '') === refStr
    );
    if (found) handleOpenDecision(found);
    setFocusedTicketRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTicketRef]);

  const handleOpenDecision = (req) => {
    setSelectedReq(req);
    setDecisionError('');
    setDecisionStatus(req.finalAction?.status || 'Approved');
    setDecisionRemarks(req.finalAction?.remarks || (req.finalAction?.status === 'Approved' ? 'Approved for execution & issuance of work order' : ''));
    setIsDecisionModalOpen(true);
  };

  /* The final decision is one server call, awaited.
     This used to read updateFinalAction's return synchronously and report
     "Approved. Tracking number X issued." whether or not anything was written;
     the function was local-state only, so the approval existed in the browser
     until the next reload. It also handled the failure case as success, because
     a null return (request not found) was treated like a successful approval
     with no number. */
  const handleApplyDecision = async () => {
    if (!selectedReq) return;
    // Word cap, enforced client-side to match the API.
    const overLimit = validateWordLimit(decisionRemarks, REMARKS_WORD_LIMIT, 'Your remarks');
    if (overLimit) {
      setDecisionError(overLimit);
      return;
    }
    // A disapproval without written grounds is not actionable — require remarks.
    if (decisionStatus === 'Disapproved' && !decisionRemarks.trim()) {
      setDecisionError('Disapproval requires written grounds — state the reason so PDAS and the requester can act on it.');
      return;
    }
    setDecisionError('');
    setIsConfirmOpen(true);
  };

  const proceedWithDecision = async () => {
    setIsConfirmOpen(false);
    setDecisionBusy(true);

    const ref = selectedReq.controlNo || selectedReq.ticket_no || selectedReq.id;
    const { ok, trackingNo } = await updateFinalAction(selectedReq.id, decisionStatus, decisionRemarks);
    setDecisionBusy(false);

    if (!ok) {
      // updateFinalAction has already toasted the server's reason. Leave the
      // dialog open so the approver can read it against the request.
      return;
    }

    setSuccessToast(decisionStatus === 'Approved'
      ? (trackingNo
        ? `Approved. It is now with PDAS to assign. Control number ${trackingNo}.`
        : 'Approved. It is now with PDAS to assign.')
      : `Request ${ref} returned to PDAS.`);
    if (trackingNo) setSelectedReq(prev => (prev ? { ...prev, controlNo: trackingNo } : prev));
    setIsDecisionModalOpen(false);
    setTimeout(() => setSuccessToast(''), 5000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
      {/* Executive Page Header */}
      <PageHeader
        breadcrumbs={['Approvals', 'Work Order Approvals']}
        title="Work Order Approvals"
        description={`ISAT U Dumangas Campus — final approval queue | ${formattedDate}`}
        action={<RequestIntakeActions intake={intake} />}
      />

      {/* Filing confirmation — the same banner the PDAS dashboard shows, so the
          filer's next step is stated in the same words on both sides. */}
      {dispatchMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={20} />
            <span>{dispatchMessage}</span>
          </div>
          <button onClick={() => setDispatchMessage('')} style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontSize: '13px' }}>Dismiss</button>
        </div>
      )}

      {/* Confirmation after filing — the same screen every filer gets, shown
          ahead of the approver queue. "View my requests" clears it and opens
          the All tab, because a fresh filing sits at Pending/Under Review and
          so is deliberately absent from the Pending Final Action tab. */}
      {intake.filed ? (
        <div className="content-card" style={{ padding: '28px' }}>
          <RequestIntakePanel
            intake={intake}
            requesterName={currentUser?.name}
            department={currentUser?.department}
            onTrack={() => setTabFilter('all')}
          />
        </div>
      ) : null}

      {/* Success Notification Toast */}
      {successToast && (
        <div className="animate-scale-in" style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: '10px',
          padding: '12px 18px',
          color: '#047857',
          fontSize: '13px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={18} color="#059669" />
          <span>{successToast}</span>
        </div>
      )}

      {/* KPI Overview Cards - semantic border accents, interactive tab shortcuts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px'
      }}>
        <div
          onClick={() => setTabFilter('pending')}
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #f59e0b',
            boxShadow: tabFilter === 'pending' ? '0 0 0 2px #f59e0b, var(--shadow-subtle)' : 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, border-color 0.15s'
          }}
          onMouseEnter={(e) => { if (tabFilter !== 'pending') e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { if (tabFilter !== 'pending') e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Pending Approval
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: pendingFinalAction.length > 0 ? '#92400e' : '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {pendingFinalAction.length}
          </div>

        </div>

        <div
          onClick={() => setTabFilter('approved')}
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #001f9c',
            boxShadow: tabFilter === 'approved' ? '0 0 0 2px #001f9c, var(--shadow-subtle)' : 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, border-color 0.15s'
          }}
          onMouseEnter={(e) => { if (tabFilter !== 'approved') e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { if (tabFilter !== 'approved') e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Approved
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: approvedFinalAction.length > 0 ? '#001f9c' : '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {approvedFinalAction.length}
          </div>

        </div>

        <div
          onClick={() => setTabFilter('disapproved')}
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #f2a33a',
            boxShadow: tabFilter === 'disapproved' ? '0 0 0 2px #f2a33a, var(--shadow-subtle)' : 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, border-color 0.15s'
          }}
          onMouseEnter={(e) => { if (tabFilter !== 'disapproved') e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { if (tabFilter !== 'disapproved') e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Rejected / Returned
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: disapprovedFinalAction.length > 0 ? '#92400e' : '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {disapprovedFinalAction.length}
          </div>

        </div>

        <div
          onClick={() => setTabFilter('all')}
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #5b6a82',
            boxShadow: tabFilter === 'all' ? '0 0 0 2px #5b6a82, var(--shadow-subtle)' : 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, border-color 0.15s'
          }}
          onMouseEnter={(e) => { if (tabFilter !== 'all') e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { if (tabFilter !== 'all') e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            All Requests
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {activeRequisitions.length}
          </div>

        </div>
      </div>

      {/* Statistics — an approver's view: what has already been decided, and
          what is sitting in the queue waiting for a signature. */}
      <ChartsRow
        isEmpty={activeRequisitions.length === 0}
        emptyTitle="Approval statistics"
        emptyCopy="No approvals to chart yet."
      >
        <DonutCard
          title="Final Action Record"
          icon="decision"
          list={activeRequisitions}
          pick={finalActionStage}
          palette={FINAL_ACTION_COLORS}
          unit="REQUESTS"
        />
        <DonutCard
          title="Awaiting Signature by Urgency"
          icon="signature"
          list={pendingFinalAction}
          pick={(r) => r.urgency}
          palette="urgency"
          unit="TO SIGN"
          emptyCopy="Nothing is waiting for your signature."
        />
        <BarCard
          title="Awaiting Signature by Category"
          icon="category"
          list={pendingFinalAction}
          pick={(r) => r.category}
          colorPick={finalActionStage}
          colorPalette={FINAL_ACTION_COLORS}
          totalLabel="awaiting final action"
          emptyCopy="Nothing is waiting for your signature."
        />
      </ChartsRow>

      {/* Main Approval Table Card */}
      <div className="content-card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', padding: '20px 24px' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '18px', fontWeight: '800' }}>
              Approval Queue ({filteredRequisitions.length})
            </h2>
          </div>

          {/* Filters (search lives in the top navbar) */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ height: '36px', fontSize: '12.5px' }}
            >
              <option value="all">All Categories</option>
              <option value="Drawing/Design">Drawing/Design</option>
              <option value="Physical Structures">Physical Structures</option>
              <option value="Electrical">Electrical</option>
              <option value="Mechanical">Mechanical</option>
              <option value="Water/Sanitary">Water/Sanitary</option>
              <option value="Air Conditioning">Air Conditioning</option>
            </select>
          </div>
        </div>

        {/* Tab Filters */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '0 24px 14px 24px',
          borderBottom: '1px solid #f1f5f9',
          overflowX: 'auto'
        }}>
          {[
            { id: 'pending', label: 'Pending Approval', count: pendingFinalAction.length, color: '#f59e0b' },
            { id: 'approved', label: 'Approved', count: approvedFinalAction.length, color: '#001f9c' },
            { id: 'disapproved', label: 'Rejected', count: disapprovedFinalAction.length, color: '#ef4444' },
            { id: 'all', label: 'All Requests', count: activeRequisitions.length, color: '#001f9c' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: tabFilter === tab.id ? `1.5px solid ${tab.color}` : '1px solid #cbd5e1',
                background: tabFilter === tab.id ? `${tab.color}15` : '#ffffff',
                color: tabFilter === tab.id ? tab.color : '#475569',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                background: tabFilter === tab.id ? tab.color : '#e2e8f0',
                color: tabFilter === tab.id ? '#ffffff' : '#475569',
                fontSize: '11px',
                fontWeight: '800',
                padding: '1px 6px',
                borderRadius: '10px'
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Table of Requisitions */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Tracking No.</th>
                <th scope="col">Subject &amp; Location</th>
                <th scope="col">Category</th>
                <th scope="col">Requester &amp; Dept</th>
                <th scope="col">PDAS Review</th>
                <th scope="col">Final Action Status</th>
                <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequisitions.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700' }}>No requests match your filters.</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Change the tab or clear the filters to see more.</div>
                  </td>
                </tr>
              ) : (
                filteredRequisitions.map(req => {
                  const finalStatus = req.finalAction?.status || 'Pending';
                  const actionTaken = req.actionTaken || {};
                  const isEndorsedGsm = actionTaken.endorsedGSMHead?.checked;
                  const isEndorsedDesign = actionTaken.endorsedDesignTeam?.checked;

                  return (
                    <tr key={req.id}>
                      <td style={{ fontWeight: '800', color: '#001f9c' }}>
                        {req.controlNo || req.id}
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                          {formatTicketDate(req.date)}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: '#0f172a', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.title}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#475569' }}>
                          {req.location}
                        </div>
                      </td>
                      <td>
                        <CategoryPill category={req.category} />
                        <div style={{ marginTop: '4px' }}>
                          <UrgencyBadge urgency={req.urgency} />
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: '#1e293b' }}>{req.requestedBy}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>{req.department}</div>
                      </td>
                      <td>
                        {isEndorsedGsm ? (
                          <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                            Endorsed to GSM Head
                          </span>
                        ) : isEndorsedDesign ? (
                          <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                            Endorsed to Design Team
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            Under PDAS review
                          </span>
                        )}
                      </td>
                      <td>
                        {finalStatus === 'Approved' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '800' }}>
                            <CheckCircle2 size={13} /> Approved
                          </span>
                        ) : finalStatus === 'Disapproved' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef2f2', color: '#b91c1c', padding: '3px 8px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '800' }}>
                            <XCircle size={13} /> Disapproved
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fffbeb', color: '#92400e', padding: '3px 8px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700' }}>
                            <Clock size={13} /> Awaiting Approval
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setSelectedReq(req); setIsPrintOpen(true); }}
                          title="View official automated form QF-PDAS-DC-01"
                          style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', marginRight: '6px' }}
                        >
                          <Printer size={13} />
                          Form
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenDecision(req)}
                          style={{
                            background: '#1e3a8a',
                            border: 'none',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Landmark size={13} /> Review &amp; Approve
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FINAL ACTION REVIEW & APPROVE MODAL WITH LIVE QF-PDAS-DC-01 PREVIEW */}
      <Modal
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        title={`Approve Request — ${selectedReq?.controlNo || selectedReq?.id}`}
        maxWidth="1240px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {selectedReq?.controlNo ? <>Tracking: <strong>{selectedReq.controlNo}</strong></> : <>Next tracking number: <strong>{peekNextTrackingNumber?.() || '—'}</strong></>}
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setIsDecisionModalOpen(false); setIsEditOpen(true); }}>
                Edit Request
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setIsDecisionModalOpen(false); setIsPrintOpen(true); }}>
                <Printer size={14} /> Print Preview
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsDecisionModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleApplyDecision}
                disabled={decisionBusy}
                style={{ background: decisionStatus === 'Approved' ? '#059669' : '#dc2626', border: 'none', opacity: decisionBusy ? 0.6 : 1 }}
              >
                <Check size={14} />
                {decisionBusy ? 'Recording…' : decisionStatus === 'Approved' ? 'Approve' : 'Disapprove'}
              </button>
            </div>
          </div>
        }
      >
        {selectedReq && (
          <div className="decision-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: '20px', alignItems: 'start' }}>
            {/* Left column: summary + description + endorsement + decision form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            {/* Top: ticket summary strip — key facts at a glance */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requester</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '3px' }}>{selectedReq.requestedBy || '—'}</div>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Office</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '3px' }}>{selectedReq.department || '—'}</div>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scope</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '3px' }}>{selectedReq.category || '—'}</div>
              </div>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '3px' }}>{selectedReq.urgency || '—'}</div>
              </div>
            </div>

            {/* Issue description + PDAS endorsement */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderLeft: '4px solid #f59e0b', borderRadius: '10px', padding: '12px 16px', fontSize: '13.5px', color: '#334155', lineHeight: 1.55 }}>
              <strong style={{ color: '#0f172a' }}>Description: </strong>{selectedReq.description || '—'}
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', color: '#1e3a8a' }}>
              <strong>PDAS Review (Kristine J. Amar): </strong>
              {selectedReq.actionTaken?.endorsedGSMHead?.checked ? 'Endorsed to GSM Head — work order to be issued' :
               selectedReq.actionTaken?.endorsedDesignTeam?.checked ? 'Endorsed to Design Team for plans and estimate' :
               selectedReq.actionTaken?.returnedToClient?.checked ? 'Returned to requester for preparation' :
               'Routine maintenance — no endorsement needed.'}
            </div>

              {/* Decision Form */}
              <div style={{ background: 'var(--bg-sunken)', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '22px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Landmark size={18} /> Your Decision
                </div>

              {/* Decision Radio Buttons */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', display: 'block' }}>
                  Decision *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{
                    padding: '14px 12px',
                    borderRadius: '10px',
                    border: decisionStatus === 'Approved' ? '2px solid #059669' : '1px solid #cbd5e1',
                    background: decisionStatus === 'Approved' ? '#ecfdf5' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '14.5px',
                    fontWeight: '700',
                    whiteSpace: 'nowrap',
                    color: decisionStatus === 'Approved' ? '#047857' : '#334155'
                  }}>
                    <input
                      type="radio"
                      name="decisionRadio"
                      value="Approved"
                      checked={decisionStatus === 'Approved'}
                      onChange={() => setDecisionStatus('Approved')}
                      style={{ accentColor: '#059669', width: '16px', height: '16px' }}
                    />
                    Approved
                  </label>

                  <label style={{
                    padding: '14px 12px',
                    borderRadius: '10px',
                    border: decisionStatus === 'Disapproved' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    background: decisionStatus === 'Disapproved' ? '#fef2f2' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '14.5px',
                    fontWeight: '700',
                    whiteSpace: 'nowrap',
                    color: decisionStatus === 'Disapproved' ? '#b91c1c' : '#334155'
                  }}>
                    <input
                      type="radio"
                      name="decisionRadio"
                      value="Disapproved"
                      checked={decisionStatus === 'Disapproved'}
                      onChange={() => setDecisionStatus('Disapproved')}
                      style={{ accentColor: '#dc2626', width: '16px', height: '16px' }}
                    />
                    Rejected
                  </label>
                </div>
              </div>

              {/* Remarks Textarea */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <LimitedTextArea
                  id="decision-remarks"
                  label="Remarks"
                  required
                  rows={5}
                  value={decisionRemarks}
                  onChange={(v) => { setDecisionRemarks(v); if (decisionError) setDecisionError(''); }}
                  placeholder="e.g. Approved for immediate procurement of replacement parts and work order issuance..."
                  style={{ minHeight: '120px', fontSize: '13.5px' }}
                />
                {decisionError && (
                  <div role="alert" style={{ marginTop: '6px', fontSize: '12.5px', color: '#b91c1c', fontWeight: '600' }}>
                    {decisionError}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--bg-muted)', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                This decision is recorded on the request and in the audit log.
              </div>
            </div>

            </div>
            {/* Right column: live QF-PDAS-DC-01 document preview */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: 'var(--bg-sunken)' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Form Preview
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#001f9c', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '9999px', padding: '3px 10px' }}>
                  {selectedReq.controlNo || selectedReq.id} • {decisionStatus}
                </span>
              </div>
              <div style={{ maxHeight: '640px', overflow: 'auto', padding: '20px', background: '#ffffff' }}>
                <JobRequestPrintSheet req={{ ...selectedReq, finalAction: { status: decisionStatus, remarks: decisionRemarks } }} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <JobRequestFormOverlay
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setIsDecisionModalOpen(true); }}
        initialReq={selectedReq || {}}
        allowActionTaken
        allowFinalAction
        title="Edit Request (QF-PDAS-DC-01)"
        onSave={(edited) => { setSelectedReq(prev => ({ ...prev, ...edited })); setDecisionStatus(edited.finalAction?.status || decisionStatus); setDecisionRemarks(edited.finalAction?.remarks || decisionRemarks); setIsEditOpen(false); setIsDecisionModalOpen(true); }}
        onSaveAndPrint={(edited) => { setSelectedReq(prev => ({ ...prev, ...edited })); setIsEditOpen(false); setIsPrintOpen(true); }}
      />

      <Modal isOpen={isPrintOpen} onClose={() => setIsPrintOpen(false)} title="Print Preview — QF-PDAS-DC-01" maxWidth="800px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPrintOpen(false)}>Close</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={14} /> Print / Save PDF</button>
          </div>
        }>
        {selectedReq && <JobRequestPrintSheet req={selectedReq} />}
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={proceedWithDecision}
        title="Approve Job Request?"
        message={`You are about to ${decisionStatus === 'Approved' ? 'approve' : 'reject'} this Job Request. This will record your electronic approval and notify the relevant parties.`}
        confirmText={decisionStatus === 'Approved' ? 'Approve' : 'Reject'}
        isDanger={decisionStatus === 'Disapproved'}
        isLoading={decisionBusy}
      />

      {selectedReq && isPrintOpen && (
        <div className="jr-print-only" aria-hidden="true"><JobRequestPrintSheet req={selectedReq} /></div>
      )}

      {/* The shared intake dialogs: standard overlay, urgent fast path, print sheet. */}
      <RequestIntake intake={intake} allowActionTaken />
    </div>
  );
};
