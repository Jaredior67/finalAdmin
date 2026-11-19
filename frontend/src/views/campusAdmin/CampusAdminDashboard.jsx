import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Check,
  CheckCircle,
  Eye,
  ChevronRight,
  FileText,
  Columns,
  Bell,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { JobRequestFormOverlay } from '../../components/common/JobRequestFormOverlay';
import { JobRequestPrintSheet } from '../../components/common/JobRequestPrintSheet';
import { PrintPortal } from '../../components/common/PrintPortal';
import { printDocument } from '../../utils/print';
import { PageHeader } from '../../components/common/PageHeader';
import { isUrgentReq } from '../../utils/jobRequestIntake';
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
import { PageTransition } from '../../components/common/PageTransition';

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
        'Request has entered the electronic approval workflow.'
      );
    }
  });

  const now = new Date();
  const formattedDate = formatHeaderDate(now);

  const [selectedReq, setSelectedReq] = useState(null);
  const [modalTab, setModalTab] = useState('form'); // 'form' | 'decision' | 'split'
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
  const [tabFilter, setTabFilter] = useState('pending'); // 'pending' | 'supervisor-endorsed' | 'approved' | 'disapproved' | 'all'
  const [successToast, setSuccessToast] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Requisitions filtering
  const activeRequisitions = requisitions.filter(r => !r.isArchived);

  // Approver decision state helpers
  const isApproved = (r) =>
    r.finalAction?.status === 'Approved' ||
    r.status === 'Approved' ||
    r.status === 'Ongoing' ||
    r.status === 'Completed' ||
    Boolean(r.campusAdminApproved);

  const isDisapproved = (r) =>
    r.finalAction?.status === 'Disapproved' ||
    r.rejectionStage === 'approver' ||
    r.status === 'Rejected';

  // Group by Final Action status. The approver queue only lists tickets PDAS
  // has already acted on (past Pending/Under Review) — brand-new filings stay
  // with PDAS until review, preserving the process order.
  const needsFinalAction = (r) => {
    if (isApproved(r)) return false;
    if (isDisapproved(r)) return false;
    if (['Draft', 'Pending', 'Pending Supervisor Approval', 'Under Review'].includes(r.status)) return false;
    return r.status === 'Pending Final Approval' || r.status === 'Awaiting Signatures';
  };
  const pendingFinalAction = activeRequisitions.filter(needsFinalAction);
  const pendingHighRisk = pendingFinalAction.filter(r => /high|urgent|emergency|critical/i.test(String(r.urgency || '')) || r.requestType === 'Urgent Request' || r.category === 'Urgent Hazard');
  const pendingMediumRisk = pendingFinalAction.filter(r => /medium|moderate/i.test(String(r.urgency || '')));
  const pendingLowRisk = pendingFinalAction.filter(r => /low/i.test(String(r.urgency || '')) || (!/high|urgent|emergency|critical|medium|moderate/i.test(String(r.urgency || ''))));

  // Supervisor-endorsed pipeline tracking: allows Campus Administrator to immediately
  // see requests endorsed by immediate supervisors as they progress through PDAS to executive signoff
  const isSupervisorEndorsed = (r) => Boolean(
    r.supervisorApproved || r.supervisor_approved || r.supervisorApprovedAt || r.supervisor_approved_at || r.supervisorRemarks
  );

  const supervisorEndorsedPipeline = activeRequisitions.filter(r =>
    isSupervisorEndorsed(r) &&
    (r.status === 'Under Review' || r.status === 'Pending Final Approval' || r.status === 'Awaiting Signatures' || needsFinalAction(r))
  );

  // Local storage tracking for supervisor-approved alert popup
  const [dismissedSupAlertIds, setDismissedSupAlertIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('campus_admin_dismissed_sup_ids') || '[]');
    } catch {
      return [];
    }
  });

  const unacknowledgedSupervisorRequests = useMemo(() => {
    return activeRequisitions.filter(r =>
      isSupervisorEndorsed(r) &&
      (r.status === 'Under Review' || r.status === 'Pending Final Approval' || r.status === 'Awaiting Signatures' || needsFinalAction(r)) &&
      !dismissedSupAlertIds.includes(String(r.id_raw || r.id || r.controlNo || r.ticket_no))
    );
  }, [activeRequisitions, dismissedSupAlertIds]);

  const handleDismissSupAlert = (reqId) => {
    setDismissedSupAlertIds(prev => {
      const updated = [...new Set([...prev, String(reqId)])];
      try {
        localStorage.setItem('campus_admin_dismissed_sup_ids', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  /* An Approver's decline no longer writes the terminal 'Rejected': the
     manuscript sends it back THROUGH the System Administrator, so the row comes
     back as 'Under Review' carrying rejection_stage = 'approver'. */

  /* Where a ticket sits in THIS screen's pipeline: the label the Final Action
     donut draws and the tint the category bars beside it inherit, plus the one
     palette both read. A segment and a bar describing the same ticket must
     never come out different colours, so neither of them gets its own copy. */
  const finalActionStage = (r) => (
    isApproved(r)
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

  const approvedFinalAction = activeRequisitions.filter(isApproved);
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
    } else if (tabFilter === 'supervisor-endorsed') {
      matchesTab = isSupervisorEndorsed(r);
    } else if (tabFilter === 'approved') {
      matchesTab = isApproved(r);
    } else if (tabFilter === 'disapproved') {
      matchesTab = isDisapproved(r);
    }

    return matchesSearch && matchesCategory && matchesTab;
  }).sort((a, b) => {
    const isUrgentA = /high|urgent|emergency/i.test(String(a.urgency || '')) || a.requestType === 'Urgent Request' || a.category === 'Urgent Hazard';
    const isUrgentB = /high|urgent|emergency/i.test(String(b.urgency || '')) || b.requestType === 'Urgent Request' || b.category === 'Urgent Hazard';
    if (isUrgentA && !isUrgentB) return -1;
    if (!isUrgentA && isUrgentB) return 1;
    // Priority sorting: Urgent requests first, then newest submitted first
    const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateCmp !== 0) return dateCmp;
    return String(b.controlNo || b.id || '').localeCompare(String(a.controlNo || a.id || ''));
  });

  // Deep link: a clicked notification stores its ticket ref here — open the
  // exact record in the decision modal, then clear so it never reopens.
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
      handleOpenDecision(found);
      setFocusedTicketRef(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTicketRef, requisitions]);

  const handleOpenDecision = (req) => {
    setSelectedReq(req);
    setDecisionError('');
    const reqApproved = isApproved(req);
    const reqDisapproved = isDisapproved(req);
    setDecisionStatus(reqApproved ? 'Approved' : (reqDisapproved ? 'Disapproved' : (req.finalAction?.status || 'Approved')));
    setDecisionRemarks(req.campusAdminRemarks || req.finalAction?.remarks || (reqApproved ? 'Approved for execution & issuance of work order' : ''));
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

    const targetId = selectedReq.id_raw ?? selectedReq.id;
    const ref = selectedReq.controlNo || selectedReq.ticket_no || selectedReq.id;
    const { ok, trackingNo } = await updateFinalAction(targetId, decisionStatus, decisionRemarks);
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
    if (trackingNo) setSelectedReq(prev => (prev ? { ...prev, controlNo: trackingNo, status: decisionStatus, campusAdminApproved: decisionStatus === 'Approved' } : prev));
    setIsDecisionModalOpen(false);
    setTimeout(() => setSuccessToast(''), 5000);
  };

  return (
    <PageTransition>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
      {/* Executive Page Header */}
      <PageHeader
        breadcrumbs={['Campus Administration', 'Overview']}
        title={`Welcome, ${currentUser?.name || 'Campus Administrator'}!`}
        description={`Campus Executive Signoff & Approvals · ${formattedDate}`}
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

      {/* Real-time Pop-up Alert Banner for Supervisor Endorsements */}
      {unacknowledgedSupervisorRequests.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
          border: '1.5px solid #c4b5fd',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 4px 14px rgba(124, 58, 237, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0
              }}>
                <Landmark size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#4c1d95' }}>
                  Immediate Supervisor Endorsement Alert ({unacknowledgedSupervisorRequests.length} pending awareness)
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#6d28d9' }}>
                  Department supervisors have approved these job requests. They are now progressing toward executive signoff.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const ids = unacknowledgedSupervisorRequests.map(r => String(r.id_raw || r.id || r.controlNo || r.ticket_no));
                setDismissedSupAlertIds(prev => {
                  const updated = [...new Set([...prev, ...ids])];
                  try { localStorage.setItem('campus_admin_dismissed_sup_ids', JSON.stringify(updated)); } catch {}
                  return updated;
                });
              }}
              style={{
                background: '#ffffff',
                border: '1px solid #ddd6fe',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: '700',
                color: '#6d28d9',
                cursor: 'pointer'
              }}
            >
              Dismiss Alerts
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {unacknowledgedSupervisorRequests.slice(0, 3).map(req => (
              <div
                key={req.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #ddd6fe',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: '800', fontSize: '12px', color: '#6d28d9' }}>
                      {req.controlNo || req.ticket_no || req.id}
                    </span>
                    <span style={{ fontSize: '10px', background: '#ecfdf5', color: '#047857', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      Supervisor Approved
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b', marginTop: '2px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {req.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {req.department || req.requestedBy}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleDismissSupAlert(req.id_raw || req.id || req.controlNo || req.ticket_no);
                      handleOpenDecision(req);
                    }}
                    style={{
                      background: '#7c3aed',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismissSupAlert(req.id_raw || req.id || req.controlNo || req.ticket_no)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px',
                      fontSize: '14px'
                    }}
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prominent Supervisor-Endorsed Pipeline Section */}
      {supervisorEndorsedPipeline.length > 0 && (
        <div style={{
          background: '#ffffff',
          border: '1.5px solid #e0e7ff',
          borderRadius: '12px',
          padding: '18px 22px',
          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4338ca'
              }}>
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1e1b4b' }}>
                  Supervisor-Endorsed Pipeline ({supervisorEndorsedPipeline.length})
                </h3>
                <p style={{ margin: 0, fontSize: '11.5px', color: '#6366f1' }}>
                  Endorsed by Immediate Supervisors and tracking towards final executive approval
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTabFilter('supervisor-endorsed')}
              style={{
                background: tabFilter === 'supervisor-endorsed' ? '#4338ca' : '#eef2ff',
                color: tabFilter === 'supervisor-endorsed' ? '#ffffff' : '#4338ca',
                border: '1px solid #c7d2fe',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{tabFilter === 'supervisor-endorsed' ? 'Showing in Table Below' : 'Filter Table Below'}</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '12px'
          }}>
            {supervisorEndorsedPipeline.slice(0, 4).map(req => (
              <div
                key={req.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#1e3a8a' }}>
                      {req.controlNo || req.ticket_no || req.id}
                    </span>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {formatTicketDate(req.date)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: req.status === 'Under Review' ? '#fef3c7' : '#ecfdf5',
                    color: req.status === 'Under Review' ? '#92400e' : '#047857'
                  }}>
                    {req.status === 'Under Review' ? 'PDAS Reviewing' : req.status}
                  </span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {req.title}
                </div>

                <div style={{ fontSize: '11.5px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{req.department}</span>
                  <span style={{ fontWeight: '600' }}>By: {req.requestedBy}</span>
                </div>

                {req.supervisorRemarks && (
                  <div style={{
                    fontSize: '11px',
                    background: '#ede9fe',
                    color: '#5b21b6',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontStyle: 'italic'
                  }}>
                    &quot;{req.supervisorRemarks}&quot;
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedReq(req); setIsPrintOpen(true); }}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    View Form
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDecision(req)}
                    style={{
                      background: '#1e3a8a',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    Review &amp; Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics — consolidated pipeline breakdown without top redundant tiles */}
      {/* ── KPI Metric Cards Row (Consistent 4px Left Accent Bar Layout) ── */}
      <div
        role="region"
        aria-label="Campus Approver KPI Overview"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px'
        }}
      >
        {[
          {
            label: 'Total in Scope',
            value: activeRequisitions.length,
            accent: '#001f9c',
            onClick: () => setTabFilter('all')
          },
          {
            label: 'Awaiting Signature',
            value: pendingFinalAction.length,
            accent: '#f59e0b',
            onClick: () => setTabFilter('pending')
          },
          {
            label: 'Supervisor Endorsed',
            value: supervisorEndorsedPipeline.length,
            accent: '#8b5cf6',
            onClick: () => setTabFilter('supervisor-endorsed')
          },
          {
            label: 'Approved & Active',
            value: activeRequisitions.filter(r => r.campusAdminApproved || r.status === 'Approved' || r.status === 'Ongoing' || r.status === 'Completed').length,
            accent: '#10b981',
            onClick: () => setTabFilter('approved')
          },
          {
            label: 'Returned / Revision',
            value: activeRequisitions.filter(r => r.status === 'Returned' || r.status === 'Rejected').length,
            accent: '#ef4444',
            onClick: () => setTabFilter('rejected')
          }
        ].map((tile) => (
          <button
            key={tile.label}
            type="button"
            onClick={tile.onClick}
            title={tile.label}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderLeft: `4px solid ${tile.accent}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              minWidth: 0,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {tile.label}
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
              {tile.value}
            </div>
          </button>
        ))}
      </div>

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
          showLegend={false}
          onSegmentClick={(label) => {
            const lower = String(label).toLowerCase();
            if (lower.includes('awaiting') || lower.includes('pending')) {
              setTabFilter('pending');
            } else if (lower.includes('approved')) {
              setTabFilter('approved');
            } else if (lower.includes('disapproved') || lower.includes('rejected') || lower.includes('returned')) {
              setTabFilter('disapproved');
            } else {
              setTabFilter('all');
            }
          }}
          footer={
            <div style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <span>Operational Pipeline</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'none' }}>Click to filter</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setTabFilter('all'); setCategoryFilter('all'); }}
                  aria-label="View all requests"
                  style={{
                    background: 'var(--bg-sunken)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#001f9c'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#475569' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>Total Requests</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{activeRequisitions.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTabFilter('pending')}
                  aria-label="Filter by awaiting signature"
                  style={{
                    background: pendingFinalAction.length > 0 ? '#fffbeb' : '#f8fafc',
                    border: `1px solid ${pendingFinalAction.length > 0 ? '#fde68a' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.background = '#fef3c7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = pendingFinalAction.length > 0 ? '#fde68a' : '#e2e8f0'; e.currentTarget.style.background = pendingFinalAction.length > 0 ? '#fffbeb' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: pendingFinalAction.length > 0 ? '#92400e' : '#334155' }}>Pending</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: pendingFinalAction.length > 0 ? '#b45309' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{pendingFinalAction.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTabFilter('approved')}
                  aria-label="Filter by approved requests"
                  style={{
                    background: approvedFinalAction.length > 0 ? '#f0fdf4' : '#f8fafc',
                    border: `1px solid ${approvedFinalAction.length > 0 ? '#bbf7d0' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = '#dcfce7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = approvedFinalAction.length > 0 ? '#bbf7d0' : '#e2e8f0'; e.currentTarget.style.background = approvedFinalAction.length > 0 ? '#f0fdf4' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: approvedFinalAction.length > 0 ? '#166534' : '#334155' }}>Approved</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: approvedFinalAction.length > 0 ? '#15803d' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{approvedFinalAction.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTabFilter('disapproved')}
                  aria-label="Filter by returned or revision requests"
                  style={{
                    background: disapprovedFinalAction.length > 0 ? '#fff7ed' : '#f8fafc',
                    border: `1px solid ${disapprovedFinalAction.length > 0 ? '#fed7aa' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f2a33a'; e.currentTarget.style.background = '#ffedd5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = disapprovedFinalAction.length > 0 ? '#fed7aa' : '#e2e8f0'; e.currentTarget.style.background = disapprovedFinalAction.length > 0 ? '#fff7ed' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f2a33a' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: disapprovedFinalAction.length > 0 ? '#c2410c' : '#334155' }}>Returned</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: disapprovedFinalAction.length > 0 ? '#ea580c' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{disapprovedFinalAction.length}</span>
                </button>
              </div>

              {/* Awaiting Executive Action Callout */}
              <button
                type="button"
                onClick={() => setTabFilter('pending')}
                aria-label="Review requests awaiting executive signature"
                style={{
                  background: pendingFinalAction.length > 0 ? '#fffbeb' : '#f8fafc',
                  border: `1px solid ${pendingFinalAction.length > 0 ? '#fde68a' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  padding: '9px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.background = '#fef3c7'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = pendingFinalAction.length > 0 ? '#fde68a' : '#e2e8f0'; e.currentTarget.style.background = pendingFinalAction.length > 0 ? '#fffbeb' : '#f8fafc'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: pendingFinalAction.length > 0 ? '#92400e' : '#475569' }}>
                    Awaiting Executive Action
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    color: pendingFinalAction.length > 0 ? '#b45309' : '#64748b',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {pendingFinalAction.length} to sign
                  </span>
                  <ChevronRight size={13} color={pendingFinalAction.length > 0 ? '#b45309' : '#94a3b8'} />
                </div>
              </button>
            </div>
          }
        />
        <DonutCard
          title="Awaiting Signature by Urgency"
          icon="signature"
          list={pendingFinalAction}
          pick={(r) => r.urgency}
          palette="urgency"
          unit="TO SIGN"
          showLegend={false}
          emptyCopy="Nothing is waiting for your signature."
          onSegmentClick={() => setTabFilter('pending')}
          footer={
            <div style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <span>Priority Breakdown</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'none' }}>Click to filter</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTabFilter('pending')}
                  aria-label="Filter high urgency requests awaiting signature"
                  style={{
                    background: pendingHighRisk.length > 0 ? '#fef2f2' : 'var(--bg-sunken)',
                    border: `1px solid ${pendingHighRisk.length > 0 ? '#fecdd3' : 'var(--border-color, #e2e8f0)'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.background = '#fee2e2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = pendingHighRisk.length > 0 ? '#fecdd3' : 'var(--border-color, #e2e8f0)'; e.currentTarget.style.background = pendingHighRisk.length > 0 ? '#fef2f2' : 'var(--bg-sunken)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: pendingHighRisk.length > 0 ? '#991b1b' : '#334155' }}>High</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: pendingHighRisk.length > 0 ? '#b91c1c' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{pendingHighRisk.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTabFilter('pending')}
                  aria-label="Filter medium urgency requests awaiting signature"
                  style={{
                    background: pendingMediumRisk.length > 0 ? '#fffbeb' : 'var(--bg-sunken)',
                    border: `1px solid ${pendingMediumRisk.length > 0 ? '#fde68a' : 'var(--border-color, #e2e8f0)'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d97706'; e.currentTarget.style.background = '#fef3c7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = pendingMediumRisk.length > 0 ? '#fde68a' : 'var(--border-color, #e2e8f0)'; e.currentTarget.style.background = pendingMediumRisk.length > 0 ? '#fffbeb' : 'var(--bg-sunken)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: pendingMediumRisk.length > 0 ? '#92400e' : '#334155' }}>Medium</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: pendingMediumRisk.length > 0 ? '#b45309' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{pendingMediumRisk.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTabFilter('pending')}
                  aria-label="Filter low urgency requests awaiting signature"
                  style={{
                    background: pendingLowRisk.length > 0 ? '#f0fdf4' : 'var(--bg-sunken)',
                    border: `1px solid ${pendingLowRisk.length > 0 ? '#bbf7d0' : 'var(--border-color, #e2e8f0)'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = '#dcfce7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = pendingLowRisk.length > 0 ? '#bbf7d0' : 'var(--border-color, #e2e8f0)'; e.currentTarget.style.background = pendingLowRisk.length > 0 ? '#f0fdf4' : 'var(--bg-sunken)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: pendingLowRisk.length > 0 ? '#166534' : '#334155' }}>Low</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: pendingLowRisk.length > 0 ? '#15803d' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{pendingLowRisk.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTabFilter('pending')}
                  aria-label="View all requests awaiting signature"
                  style={{
                    background: 'var(--bg-sunken)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#001f9c'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#475569' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>Total to Sign</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{pendingFinalAction.length}</span>
                </button>
              </div>

              {/* High Priority Callout */}
              <button
                type="button"
                onClick={() => setTabFilter('pending')}
                aria-label="View high priority requests awaiting executive signature"
                style={{
                  background: pendingHighRisk.length > 0 ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${pendingHighRisk.length > 0 ? '#fecdd3' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  padding: '9px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = pendingHighRisk.length > 0 ? '#fecdd3' : '#e2e8f0'; e.currentTarget.style.background = pendingHighRisk.length > 0 ? '#fef2f2' : '#f8fafc'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: pendingHighRisk.length > 0 ? '#991b1b' : '#475569' }}>
                    Immediate Signature Required
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    color: pendingHighRisk.length > 0 ? '#b91c1c' : '#64748b',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {pendingHighRisk.length} high priority
                  </span>
                  <ChevronRight size={13} color={pendingHighRisk.length > 0 ? '#b91c1c' : '#94a3b8'} />
                </div>
              </button>
            </div>
          }
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
          onBarClick={(cat) => {
            setCategoryFilter(cat);
            setTabFilter('pending');
          }}
          footer={
            <div style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11.5px',
              color: '#64748b'
            }}>
              <span>Pending Disciplines:</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>
                {new Set(pendingFinalAction.map(r => r.category || 'General')).size} disciplines
              </span>
            </div>
          }
        />
      </ChartsRow>

      {/* Main Approval Table Card */}
      <div className="content-card">
        <div className="card-header queue-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', padding: '20px 24px' }}>
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
        <div className="queue-tab-filters" style={{
          display: 'flex',
          gap: '8px',
          padding: '0 24px 14px 24px',
          borderBottom: '1px solid #f1f5f9',
          overflowX: 'auto'
        }}>
          {[
            { id: 'pending', label: 'Pending Approval', count: pendingFinalAction.length, color: '#f59e0b' },
            { id: 'supervisor-endorsed', label: '⭐ Supervisor Endorsed', count: supervisorEndorsedPipeline.length, color: '#7c3aed' },
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

        {/* Subtle mobile hint */}
        <div className="table-mobile-hint">
          <span>👉 Swipe horizontally to view all details &amp; actions</span>
        </div>

        {/* Table of Requisitions */}
        <div className="table-responsive">
          <table className="data-table data-table-stacked">
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
                  const isRowApproved = isApproved(req);
                  const isRowDisapproved = isDisapproved(req);
                  const actionTaken = req.actionTaken || {};
                  const isEndorsedGsm = actionTaken.endorsedGSMHead?.checked;
                  const isEndorsedDesign = actionTaken.endorsedDesignTeam?.checked;

                  return (
                    <tr key={req.id}>
                      <td data-label="Tracking No." style={{ fontWeight: '800', color: '#001f9c' }}>
                        {req.controlNo || req.id}
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                          {formatTicketDate(req.date)}
                        </div>
                      </td>
                      <td data-label="Subject & Location">
                        <div style={{ fontWeight: '700', color: '#0f172a', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.title}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#475569' }}>
                          {req.location}
                        </div>
                      </td>
                      <td data-label="Category">
                        <CategoryPill category={req.category} />
                        <div style={{ marginTop: '4px' }}>
                          <UrgencyBadge urgency={req.urgency} />
                        </div>
                      </td>
                      <td data-label="Requester & Dept">
                        <div style={{ fontWeight: '700', color: '#1e293b' }}>{req.requestedBy}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>{req.department}</div>
                      </td>
                      <td data-label="PDAS Review">
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
                      <td data-label="Final Action Status">
                        {isRowApproved ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '800' }}>
                            <CheckCircle2 size={13} /> Approved
                          </span>
                        ) : isRowDisapproved ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef2f2', color: '#b91c1c', padding: '3px 8px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '800' }}>
                            <XCircle size={13} /> Disapproved
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fffbeb', color: '#92400e', padding: '3px 8px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700' }}>
                            <Clock size={13} /> Awaiting Approval
                          </span>
                        )}
                      </td>
                      <td data-label="Actions" className="stacked-actions" style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setSelectedReq(req); setIsPrintOpen(true); }}
                          title="View official automated form QF-PDAS-DC-01"
                          style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', marginRight: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Eye size={13} /> View Form
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenDecision(req)}
                          style={{
                            background: isRowApproved ? '#059669' : '#1e3a8a',
                            border: 'none',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {isRowApproved ? (
                            <><CheckCircle2 size={13} /> View Decision</>
                          ) : (
                            <><Landmark size={13} /> Review &amp; Approve</>
                          )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Modal Tab Switcher */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
              padding: '8px 12px',
              background: 'var(--bg-sunken)',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
              {/* Decision Column */}
              {(modalTab === 'decision' || modalTab === 'split') && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  minWidth: 0,
                  maxWidth: modalTab === 'decision' ? '780px' : undefined,
                  margin: modalTab === 'decision' ? '0 auto' : undefined
                }}>
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
                      color: isUrgentReq(selectedReq) ? '#991b1b' : '#001f9c',
                      background: isUrgentReq(selectedReq) ? '#fff1f2' : '#eff6ff',
                      border: `1px solid ${isUrgentReq(selectedReq) ? '#fecdd3' : '#bfdbfe'}`,
                      borderRadius: '9999px',
                      padding: '3px 10px'
                    }}>
                      {selectedReq.controlNo || selectedReq.id} • {decisionStatus}
                    </span>
                  </div>
                  <div style={{ maxHeight: '72vh', overflowY: 'auto', overflowX: 'hidden', padding: '20px', background: 'var(--bg-sunken)' }}>
                    <JobRequestPrintSheet req={{ ...selectedReq, finalAction: { status: decisionStatus, remarks: decisionRemarks } }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>



      <Modal isOpen={isPrintOpen} onClose={() => setIsPrintOpen(false)} title="Print Preview — QF-PDAS-DC-01" maxWidth="800px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPrintOpen(false)}>Close</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => printDocument()}><Printer size={14} /> Print / Save PDF</button>
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

      {selectedReq && (
        <PrintPortal active={isPrintOpen}>
          <JobRequestPrintSheet req={selectedReq} />
        </PrintPortal>
      )}

      {/* The shared intake dialogs: standard overlay, urgent fast path, print sheet. */}
      <RequestIntake intake={intake} allowActionTaken />
    </div>
    </PageTransition>
  );
};
