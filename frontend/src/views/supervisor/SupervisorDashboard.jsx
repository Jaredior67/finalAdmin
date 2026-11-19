import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Printer,
  FileText,
  MapPin,
  Check,
  CheckCircle,
  Landmark,
  Info,
  ChevronRight,
  Columns
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { JobRequestPrintSheet } from '../../components/common/JobRequestPrintSheet';
import { PrintPortal } from '../../components/common/PrintPortal';
import { printDocument } from '../../utils/print';
import { PageHeader } from '../../components/common/PageHeader';
import { PDASJobRequestFormDocument } from '../../components/common/PDASJobRequestFormDocument';
import { LimitedTextArea } from '../../components/common/LimitedTextArea';
import { REMARKS_WORD_LIMIT } from '../../utils/wordLimit';
import { CATEGORY_OPTIONS, isUrgentReq } from '../../utils/jobRequestIntake';
import { formatHeaderDate } from '../../components/common/TimeGreeting';
import { ChartsRow, DonutCard, BarCard } from '../../components/common/DashboardCharts';
import { useOptionalToast } from '../../components/ui/Toast';
import {
  useRequestIntake,
  RequestIntakeActions,
  RequestIntakePanel,
  RequestIntake
} from '../../components/common/RequestIntake';
import { PageTransition } from '../../components/common/PageTransition';

export const SupervisorDashboard = () => {
  const { currentUser } = useAuth();
  const {
    requisitions,
    submitSupervisorAction,
    ticketSearch: searchTerm,
    focusedTicketRef,
    setFocusedTicketRef
  } = useData();

  const now = new Date();
  const formattedDate = formatHeaderDate(now);

  /* Shared Request Intake hook — provides Scan QR and New Request buttons */
  const intake = useRequestIntake({
    requester: currentUser
  });

  const [selectedReq, setSelectedReq] = useState(null);
  const [modalTab, setModalTab] = useState('form'); // 'form' | 'decision' | 'split'
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState('approve'); // 'approve' | 'reject'
  const [remarks, setRemarks] = useState('');
  const [actionError, setActionError] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [tabFilter, setTabFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [successToast, setSuccessToast] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toastCtx = useOptionalToast();
  const toast = toastCtx?.toast;

  // Deep link: a clicked notification opens that exact ticket in preview modal
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
      setSelectedReq(found);
      setIsPreviewOpen(true);
      setFocusedTicketRef(null);
    }
  }, [focusedTicketRef, requisitions, setFocusedTicketRef]);

  // Requisitions relevant to supervisor:
  // Either assigned supervisor matches, department matches, or currently in Pending Supervisor Approval
  const supervisorRequisitions = useMemo(() => {
    return (requisitions || []).filter(r => !r.isArchived);
  }, [requisitions]);

  /* Where a request sits in THIS screen's pipeline: the label the Endorsement
     Record donut draws and the tint the category bars beside it inherit, plus
     the one palette both read. */
  const endorseStage = (r) => (
    (r.status === 'Returned' || r.status === 'Rejected') && r.rejectionStage === 'supervisor'
      ? 'Returned for revision'
      : r.supervisorApproved ||
        ['Under Review', 'Pending Final Approval', 'Approved', 'Ongoing', 'Completed'].includes(r.status)
        ? 'Endorsed'
        : 'Awaiting endorsement'
  );

  const ENDORSE_STAGE_COLORS = {
    'Awaiting endorsement': '#f59e0b',
    Endorsed: '#001f9c',
    'Returned for revision': '#f2a33a'
  };

  const isPendingReview = (r) =>
    !r.supervisorApproved &&
    (r.status === 'Pending Supervisor Approval' ||
      (r.status === 'Pending' && Boolean(r.immediateSupervisor)));

  const pendingApproval = useMemo(() => {
    return supervisorRequisitions.filter(isPendingReview);
  }, [supervisorRequisitions]);

  const approvedBySupervisor = useMemo(() => {
    return supervisorRequisitions.filter(r =>
      r.supervisorApproved ||
      ['Under Review', 'Pending Final Approval', 'Approved', 'Ongoing', 'Completed'].includes(r.status)
    );
  }, [supervisorRequisitions]);

  const rejectedBySupervisor = useMemo(() => {
    return supervisorRequisitions.filter(r =>
      (r.status === 'Returned' || r.status === 'Rejected') && r.rejectionStage === 'supervisor'
    );
  }, [supervisorRequisitions]);

  const isUrgentReq = (r) =>
    /high|urgent|emergency|critical/i.test(String(r?.urgency || '')) ||
    r?.requestType === 'Urgent Request' ||
    r?.category === 'Urgent Hazard';

  const deptHighRisk = useMemo(() => supervisorRequisitions.filter(isUrgentReq), [supervisorRequisitions]);
  const deptMediumRisk = useMemo(() => supervisorRequisitions.filter(r => /medium|moderate/i.test(String(r.urgency || ''))), [supervisorRequisitions]);
  const deptLowRisk = useMemo(() => supervisorRequisitions.filter(r => /low/i.test(String(r.urgency || '')) || (!/high|urgent|emergency|critical|medium|moderate/i.test(String(r.urgency || '')))), [supervisorRequisitions]);

  const filteredRequisitions = useMemo(() => {
    return supervisorRequisitions.filter(r => {
      const searchLower = String(searchTerm || '').toLowerCase();
      const matchesSearch =
        !searchTerm ||
        String(r.controlNo || r.id).toLowerCase().includes(searchLower) ||
        String(r.title || '').toLowerCase().includes(searchLower) ||
        String(r.requestedBy || '').toLowerCase().includes(searchLower) ||
        String(r.department || '').toLowerCase().includes(searchLower) ||
        String(r.location || '').toLowerCase().includes(searchLower);

      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;

      let matchesTab = true;
      if (tabFilter === 'pending') {
        matchesTab = isPendingReview(r);
      } else if (tabFilter === 'approved') {
        matchesTab = r.supervisorApproved || ['Under Review', 'Pending Final Approval', 'Approved', 'Ongoing', 'Completed'].includes(r.status);
      } else if (tabFilter === 'rejected') {
        matchesTab = (r.status === 'Returned' || r.status === 'Rejected') && r.rejectionStage === 'supervisor';
      }

      return matchesSearch && matchesCategory && matchesTab;
    }).sort((a, b) => {
      // Default sorting: Newest requests first
      const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(b.controlNo || b.id || '').localeCompare(String(a.controlNo || a.id || ''));
    });
  }, [supervisorRequisitions, searchTerm, categoryFilter, tabFilter]);

  const handleOpenAction = (req, type) => {
    setSelectedReq(req);
    setActionType(type);
    setActionError('');
    setRemarks(type === 'approve' ? 'Electronically signed' : '');
    setIsActionModalOpen(true);
  };

  const handleApplyAction = async () => {
    if (!selectedReq) return;
    if (actionType === 'reject' && !remarks.trim()) {
      setActionError('Remarks are required when returning a request for revision.');
      return;
    }

    setActionError('');
    setIsConfirmOpen(true);
  };

  const proceedWithAction = async () => {
    setIsConfirmOpen(false);
    setIsSubmitting(true);
    try {
      await submitSupervisorAction(selectedReq.id || selectedReq.controlNo, actionType, remarks.trim());
      const msg = actionType === 'approve'
        ? `Request ${selectedReq.controlNo || selectedReq.id} approved and routed to PDAS Admin.`
        : `Request ${selectedReq.controlNo || selectedReq.id} returned to requester for revision.`;
      setSuccessToast(msg);
      if (toast) toast(msg, actionType === 'approve' ? 'success' : 'info');
      setIsActionModalOpen(false);
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err) {
      if (toast) toast(err.message || 'Action failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
        {/* Page Header — Replaced static authority badge with Scan QR and New Request buttons */}
        <PageHeader
          breadcrumbs={['Immediate Supervisor', 'Overview']}
          title={`Welcome, ${currentUser?.name || 'Immediate Supervisor'}!`}
          description={`Departmental Review & Endorsements · ${formattedDate}`}
          action={<RequestIntakeActions intake={intake} />}
        />

        {/* Filing Confirmation Banner if request was just filed */}
        {intake.filed ? (
          <div className="content-card" style={{ padding: '28px' }}>
            <RequestIntakePanel
              intake={intake}
              requesterName={currentUser?.name}
              department={currentUser?.department}
            />
          </div>
        ) : null}

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

        {/* Statistics — consolidated pipeline breakdown without top redundant tiles */}
        {/* ── KPI Metric Cards Row (Consistent 4px Left Accent Bar Layout) ── */}
        <div
          role="region"
          aria-label="Supervisor KPI Overview"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px'
          }}
        >
          {[
            {
              label: 'Total in Department',
              value: supervisorRequisitions.length,
              accent: '#001f9c',
              onClick: () => setTabFilter('all')
            },
            {
              label: 'Awaiting Endorsement',
              value: pendingApproval.length,
              accent: '#f59e0b',
              onClick: () => setTabFilter('pending')
            },
            {
              label: 'Urgent Priority',
              value: deptHighRisk.length,
              accent: '#ef4444',
              onClick: () => setTabFilter('pending')
            },
            {
              label: 'Endorsed to PDAS',
              value: approvedBySupervisor.length,
              accent: '#10b981',
              onClick: () => setTabFilter('approved')
            },
            {
              label: 'Returned / Revision',
              value: rejectedBySupervisor.length,
              accent: '#64748b',
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
          isEmpty={supervisorRequisitions.length === 0}
          emptyTitle="Endorsement statistics"
          emptyCopy="No departmental work orders to endorse yet."
        >
          <DonutCard
            title="Endorsement Record"
            icon="endorse"
            list={supervisorRequisitions}
            pick={endorseStage}
            palette={ENDORSE_STAGE_COLORS}
            unit="REQUESTS"
            showLegend={false}
            onSegmentClick={(label) => {
              const lower = String(label).toLowerCase();
              if (lower.includes('awaiting') || lower.includes('pending')) {
                setTabFilter('pending');
              } else if (lower.includes('endorsed') || lower.includes('approved')) {
                setTabFilter('approved');
              } else if (lower.includes('returned') || lower.includes('revision') || lower.includes('rejected')) {
                setTabFilter('rejected');
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
                    aria-label="View all subordinate tickets"
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
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{supervisorRequisitions.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabFilter('pending')}
                    aria-label="Filter pending immediate supervisor review"
                    style={{
                      background: pendingApproval.length > 0 ? '#fffbeb' : '#f8fafc',
                      border: `1px solid ${pendingApproval.length > 0 ? '#fde68a' : '#e2e8f0'}`,
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
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = pendingApproval.length > 0 ? '#fde68a' : '#e2e8f0'; e.currentTarget.style.background = pendingApproval.length > 0 ? '#fffbeb' : '#f8fafc'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: pendingApproval.length > 0 ? '#92400e' : '#334155' }}>Pending</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: pendingApproval.length > 0 ? '#b45309' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{pendingApproval.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabFilter('approved')}
                    aria-label="Filter approved and endorsed tickets"
                    style={{
                      background: approvedBySupervisor.length > 0 ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${approvedBySupervisor.length > 0 ? '#bbf7d0' : '#e2e8f0'}`,
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
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = approvedBySupervisor.length > 0 ? '#bbf7d0' : '#e2e8f0'; e.currentTarget.style.background = approvedBySupervisor.length > 0 ? '#f0fdf4' : '#f8fafc'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: approvedBySupervisor.length > 0 ? '#166534' : '#334155' }}>Endorsed</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: approvedBySupervisor.length > 0 ? '#15803d' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{approvedBySupervisor.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabFilter('rejected')}
                    aria-label="Filter returned for revision"
                    style={{
                      background: rejectedBySupervisor.length > 0 ? '#fff7ed' : '#f8fafc',
                      border: `1px solid ${rejectedBySupervisor.length > 0 ? '#fed7aa' : '#e2e8f0'}`,
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
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = rejectedBySupervisor.length > 0 ? '#fed7aa' : '#e2e8f0'; e.currentTarget.style.background = rejectedBySupervisor.length > 0 ? '#fff7ed' : '#f8fafc'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f2a33a' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: rejectedBySupervisor.length > 0 ? '#c2410c' : '#334155' }}>Returned</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: rejectedBySupervisor.length > 0 ? '#ea580c' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{rejectedBySupervisor.length}</span>
                  </button>
                </div>

                {/* Departmental Urgent Work Orders Callout */}
                <button
                  type="button"
                  onClick={() => setTabFilter('all')}
                  aria-label="Review urgent departmental work orders"
                  style={{
                    background: supervisorRequisitions.filter(isUrgentReq).length > 0 ? '#fef2f2' : '#f8fafc',
                    border: `1px solid ${supervisorRequisitions.filter(isUrgentReq).length > 0 ? '#fecdd3' : '#e2e8f0'}`,
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
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = supervisorRequisitions.filter(isUrgentReq).length > 0 ? '#fecdd3' : '#e2e8f0'; e.currentTarget.style.background = supervisorRequisitions.filter(isUrgentReq).length > 0 ? '#fef2f2' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: supervisorRequisitions.filter(isUrgentReq).length > 0 ? '#991b1b' : '#475569' }}>
                      Urgent Departmental Requests
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '800',
                      color: supervisorRequisitions.filter(isUrgentReq).length > 0 ? '#b91c1c' : '#64748b',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {supervisorRequisitions.filter(isUrgentReq).length} urgent
                    </span>
                    <ChevronRight size={13} color={supervisorRequisitions.filter(isUrgentReq).length > 0 ? '#b91c1c' : '#94a3b8'} />
                  </div>
                </button>
              </div>
            }
          />
          <DonutCard
            title="Endorsements by Urgency"
            icon="urgency"
            list={supervisorRequisitions}
            pick={(r) => r.urgency}
            palette="urgency"
            unit="REQUESTS"
            showLegend={false}
            onSegmentClick={() => setTabFilter('all')}
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
                    onClick={() => setTabFilter('all')}
                    aria-label="Filter high urgency departmental requests"
                    style={{
                      background: deptHighRisk.length > 0 ? '#fef2f2' : 'var(--bg-sunken)',
                      border: `1px solid ${deptHighRisk.length > 0 ? '#fecdd3' : 'var(--border-color, #e2e8f0)'}`,
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
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = deptHighRisk.length > 0 ? '#fecdd3' : 'var(--border-color, #e2e8f0)'; e.currentTarget.style.background = deptHighRisk.length > 0 ? '#fef2f2' : 'var(--bg-sunken)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: deptHighRisk.length > 0 ? '#991b1b' : '#334155' }}>High</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: deptHighRisk.length > 0 ? '#b91c1c' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{deptHighRisk.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabFilter('all')}
                    aria-label="Filter medium urgency departmental requests"
                    style={{
                      background: deptMediumRisk.length > 0 ? '#fffbeb' : 'var(--bg-sunken)',
                      border: `1px solid ${deptMediumRisk.length > 0 ? '#fde68a' : 'var(--border-color, #e2e8f0)'}`,
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
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = deptMediumRisk.length > 0 ? '#fde68a' : 'var(--border-color, #e2e8f0)'; e.currentTarget.style.background = deptMediumRisk.length > 0 ? '#fffbeb' : 'var(--bg-sunken)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: deptMediumRisk.length > 0 ? '#92400e' : '#334155' }}>Medium</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: deptMediumRisk.length > 0 ? '#b45309' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{deptMediumRisk.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabFilter('all')}
                    aria-label="Filter low urgency departmental requests"
                    style={{
                      background: deptLowRisk.length > 0 ? '#f0fdf4' : 'var(--bg-sunken)',
                      border: `1px solid ${deptLowRisk.length > 0 ? '#bbf7d0' : 'var(--border-color, #e2e8f0)'}`,
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
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = deptLowRisk.length > 0 ? '#bbf7d0' : 'var(--border-color, #e2e8f0)'; e.currentTarget.style.background = deptLowRisk.length > 0 ? '#f0fdf4' : 'var(--bg-sunken)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: deptLowRisk.length > 0 ? '#166534' : '#334155' }}>Low</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: deptLowRisk.length > 0 ? '#15803d' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{deptLowRisk.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabFilter('all')}
                    aria-label="View all requests by priority"
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
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{supervisorRequisitions.length}</span>
                  </button>
                </div>

                {/* Urgent Priority Callout */}
                <button
                  type="button"
                  onClick={() => setTabFilter('all')}
                  aria-label="View urgent departmental requests requiring attention"
                  style={{
                    background: deptHighRisk.length > 0 ? '#fef2f2' : '#f8fafc',
                    border: `1px solid ${deptHighRisk.length > 0 ? '#fecdd3' : '#e2e8f0'}`,
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
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = deptHighRisk.length > 0 ? '#fecdd3' : '#e2e8f0'; e.currentTarget.style.background = deptHighRisk.length > 0 ? '#fef2f2' : '#f8fafc'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: deptHighRisk.length > 0 ? '#991b1b' : '#475569' }}>
                      Urgent Departmental Attention
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '800',
                      color: deptHighRisk.length > 0 ? '#b91c1c' : '#64748b',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      {deptHighRisk.length} urgent
                    </span>
                    <ChevronRight size={13} color={deptHighRisk.length > 0 ? '#b91c1c' : '#94a3b8'} />
                  </div>
                </button>
              </div>
            }
          />
          <BarCard
            title="Endorsements by Category"
            icon="category"
            list={supervisorRequisitions}
            pick={(r) => r.category}
            colorPick={endorseStage}
            colorPalette={ENDORSE_STAGE_COLORS}
            totalLabel="departmental work orders"
            onBarClick={(cat) => setCategoryFilter(cat)}
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
                <span>Department Disciplines:</span>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>
                  {new Set(supervisorRequisitions.map(r => r.category || 'General')).size} disciplines
                </span>
              </div>
            }
          />
        </ChartsRow>

        {/* Tabs & Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#64748b' }}>Queue View:</span>
            <select
              aria-label="Queue View"
              className="form-select form-select-sm"
              value={tabFilter}
              onChange={(e) => setTabFilter(e.target.value)}
              style={{ minWidth: '210px', fontWeight: '700', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', background: '#ffffff', border: '1px solid #cbd5e1' }}
            >
              <option value="pending">Pending Review ({pendingApproval.length})</option>
              <option value="approved">Approved &amp; Endorsed ({approvedBySupervisor.length})</option>
              <option value="rejected">Returned for Revision ({rejectedBySupervisor.length})</option>
              <option value="all">All Assigned Tickets ({supervisorRequisitions.length})</option>
            </select>
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="form-control"
            style={{ width: 'auto', minWidth: '160px', padding: '8px 12px', fontSize: '13px' }}
          >
            <option value="all">All Categories</option>
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Requests List */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {filteredRequisitions.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
              <CheckCircle2 size={40} color="#94a3b8" style={{ marginBottom: '12px' }} />
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>No requests in this queue</div>
              <div style={{ fontSize: '13px' }}>All subordinate requests have been addressed or no matching filters found.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Control / Ref</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Requester</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Category &amp; Location</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Urgency</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequisitions.map((req) => {
                    const isPending = isPendingReview(req);
                    return (
                      <tr key={req.id || req.controlNo} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: '800', color: '#0f172a' }}>{req.controlNo || req.id}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{req.date}</div>
                          {req.urgency === 'High Risk' && (
                            <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '10.5px', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                              Priority
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: '700', color: '#1e293b' }}>{req.requestedBy || 'Faculty / Staff'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{req.department || 'Department'}</div>
                          {req.contactNumber && (
                            <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{req.contactNumber}</div>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', verticalAlign: 'top', maxWidth: '280px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <CategoryPill category={req.category} />
                          </div>
                          <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <MapPin size={13} color="#94a3b8" />
                            <span>{req.location || 'Campus Facilities'}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {req.description || req.title || 'No description provided'}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                          <UrgencyBadge urgency={req.urgency} />
                        </td>

                        <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                          <StatusBadge status={req.status} />
                          {req.supervisorApproved && (
                            <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '700', marginTop: '4px' }}>
                              Endorsed
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                            {/* Primary action button — blue in all cases, matching admin 'Review & Assign' */}
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              title={req.status === 'Completed' ? 'Review completed request' : 'Review request and take action'}
                              onClick={() => {
                                setSelectedReq(req);
                                if (isPending) {
                                  handleOpenAction(req, 'approve');
                                } else {
                                  setIsPreviewOpen(true);
                                }
                              }}
                            >
                              <FileText size={14} /> {isPending ? 'Review & Endorse' : 'Review'}
                            </button>

                            {/* Return button only appears when the request is still pending */}
                            {isPending && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                onClick={() => handleOpenAction(req, 'reject')}
                              >
                                <XCircle size={14} /> Return
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FINAL ACTION REVIEW & APPROVE MODAL WITH LIVE QF-PDAS-DC-01 PREVIEW */}
        {isActionModalOpen && selectedReq && (
          <Modal
            isOpen={isActionModalOpen}
            onClose={() => setIsActionModalOpen(false)}
            title={`Approve Request — ${selectedReq?.controlNo || selectedReq?.id}`}
            maxWidth="1240px"
            footer={
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Tracking: <strong>{selectedReq?.controlNo || selectedReq?.id}</strong>
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setIsActionModalOpen(false); setIsPrintOpen(true); }}
                  >
                    <Printer size={14} /> Print Preview
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsActionModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleApplyAction}
                    disabled={isSubmitting}
                    style={{ background: actionType === 'approve' ? '#059669' : '#dc2626', border: 'none', opacity: isSubmitting ? 0.6 : 1 }}
                  >
                    <Check size={14} />
                    {isSubmitting ? 'Recording…' : actionType === 'approve' ? 'Approve' : 'Reject'}
                  </button>
                </div>
              </div>
            }
          >
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
                {/* Decision Panel Column */}
                {(modalTab === 'decision' || modalTab === 'split') && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    minWidth: 0,
                    maxWidth: modalTab === 'decision' ? '780px' : undefined,
                    margin: modalTab === 'decision' ? '0 auto' : undefined
                  }}>
                    {/* Blue review banner */}
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', color: '#1e3a8a' }}>
                      <strong>PDAS Review (Kristine J. Amar): </strong>
                      {selectedReq.actionTaken?.endorsedGSMHead?.checked ? 'Endorsed to GSM Head — work order to be issued.' :
                        selectedReq.actionTaken?.endorsedDesignTeam?.checked ? 'Endorsed to Design Team for plans and estimate.' :
                          selectedReq.actionTaken?.returnedToClient?.checked ? 'Returned to requester for preparation.' :
                            'Routine maintenance — no endorsement needed.'}
                    </div>

                    {/* If this is a follow-up request for a resolved urgent incident: INFORMATIONAL ONLY */}
                    {isUrgentReq(selectedReq) && (selectedReq.status === 'Completed' || selectedReq.status === 'resolved') ? (
                      <div style={{ background: 'var(--bg-sunken)', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase' }}>
                          <Info size={18} style={{ color: '#001f9c' }} /> INFORMATION ONLY — NO ENDORSEMENT NEEDED
                        </div>
                        <p style={{ fontSize: '13px', color: '#334155', marginTop: '10px', lineHeight: 1.6 }}>
                          This is an official follow-up QF-PDAS-DC-01 form submitted for a resolved urgent incident. By institutional policy, follow-up forms are submitted for information only to immediate supervisors and campus approvers; <strong>only the PDAS Administrator can electronically approve</strong> this form.
                        </p>
                        <div style={{ marginTop: '12px', padding: '10px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', fontSize: '12px', color: '#065f46', fontWeight: '600' }}>
                          Status: Follow-up Form Submitted • Awaiting Admin Electronic Approval
                        </div>
                      </div>
                    ) : (
                      /* Standard Decision Form Container */
                      <div style={{ background: 'var(--bg-sunken)', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '22px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Landmark size={18} /> YOUR DECISION
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
                              border: actionType === 'approve' ? '2px solid #059669' : '1px solid #cbd5e1',
                              background: actionType === 'approve' ? '#ecfdf5' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              fontSize: '14.5px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              color: actionType === 'approve' ? '#047857' : '#334155'
                            }}>
                              <input
                                type="radio"
                                name="supervisorDecisionRadio"
                                value="approve"
                                checked={actionType === 'approve'}
                                onChange={() => {
                                  setActionType('approve');
                                  if (!remarks || remarks === 'Please revise as per notes.') {
                                    setRemarks('Electronically signed');
                                  }
                                  setActionError('');
                                }}
                                style={{ accentColor: '#059669', width: '16px', height: '16px' }}
                              />
                              Approved
                            </label>

                            <label style={{
                              padding: '14px 12px',
                              borderRadius: '10px',
                              border: actionType === 'reject' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                              background: actionType === 'reject' ? '#fef2f2' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              fontSize: '14.5px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              color: actionType === 'reject' ? '#b91c1c' : '#334155'
                            }}>
                              <input
                                type="radio"
                                name="supervisorDecisionRadio"
                                value="reject"
                                checked={actionType === 'reject'}
                                onChange={() => {
                                  setActionType('reject');
                                  if (remarks === 'Electronically signed' || remarks === 'Electronically approved') {
                                    setRemarks('');
                                  }
                                  setActionError('');
                                }}
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
                            required={actionType === 'reject'}
                            rows={5}
                            value={remarks}
                            onChange={(v) => { setRemarks(v); if (actionError) setActionError(''); }}
                            placeholder="e.g. Approved for immediate procurement of replacement parts and work order issuance..."
                            style={{ minHeight: '120px', fontSize: '13.5px' }}
                            limit={REMARKS_WORD_LIMIT}
                          />
                          {actionError && (
                            <div role="alert" style={{ marginTop: '6px', fontSize: '12.5px', color: '#b91c1c', fontWeight: '600' }}>
                              {actionError}
                            </div>
                          )}
                        </div>

                        <div style={{ background: 'var(--bg-muted)', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                          This decision is recorded on the request and in the audit log.
                        </div>
                      </div>
                    )}
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
                        color: isUrgentReq(selectedReq) ? '#991b1b' : actionType === 'approve' ? '#047857' : '#b91c1c',
                        background: isUrgentReq(selectedReq) ? '#fff1f2' : actionType === 'approve' ? '#ecfdf5' : '#fef2f2',
                        border: `1px solid ${isUrgentReq(selectedReq) ? '#fecdd3' : actionType === 'approve' ? '#a7f3d0' : '#fecaca'}`,
                        borderRadius: '9999px',
                        padding: '3px 10px'
                      }}>
                        {selectedReq.controlNo || selectedReq.id} • {actionType === 'approve' ? 'Approved' : 'Rejected'}
                      </span>
                    </div>
                    <div style={{ maxHeight: '72vh', overflowY: 'auto', overflowX: 'hidden', padding: '20px', background: 'var(--bg-sunken)' }}>
                      <JobRequestPrintSheet req={{
                        ...selectedReq,
                        supervisorApproved: actionType === 'approve',
                        supervisorApprovedAt: new Date().toISOString(),
                        supervisorApprovedBy: currentUser?.name || selectedReq.immediateSupervisor || 'Immediate Supervisor',
                        supervisorRemarks: remarks,
                        finalAction: selectedReq.finalAction || { status: actionType === 'approve' ? 'Approved' : 'Disapproved', remarks: remarks }
                      }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* Document Preview Modal */}
        {isPreviewOpen && selectedReq && (
          <Modal
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            onBack={() => setIsPreviewOpen(false)}
            title={`Official Form Preview — ${selectedReq.controlNo || selectedReq.id}`}
            maxWidth="900px"
            footer={
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setIsPreviewOpen(false); setIsPrintOpen(true); }}
                >
                  <Printer size={15} /> Print / Save PDF
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPreviewOpen(false)}>
                  Close Preview
                </button>
              </div>
            }
          >
            <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '10px' }}>
              <PDASJobRequestFormDocument req={selectedReq} />
            </div>
          </Modal>
        )}

        {/* Print Sheet Modal */}
        {isPrintOpen && selectedReq && (
          <Modal
            isOpen={isPrintOpen}
            onClose={() => setIsPrintOpen(false)}
            onBack={() => setIsPrintOpen(false)}
            title={`Print Official Form — ${selectedReq.controlNo || selectedReq.id}`}
            maxWidth="900px"
            footer={
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPrintOpen(false)}>Close</button>
                <button type="button" className="btn btn-primary" onClick={() => printDocument()}><Printer size={15} /> Print</button>
              </div>
            }
          >
            <div style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <JobRequestPrintSheet req={selectedReq} />
            </div>
          </Modal>
        )}

        {/* Print-only official form — mounted next to <body> so the modal and
          page chrome are excluded from the printout. */}
        {selectedReq && (
          <PrintPortal active={isPrintOpen}>
            <JobRequestPrintSheet req={selectedReq} />
          </PrintPortal>
        )}

        <ConfirmDialog
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={proceedWithAction}
          title="Approve Job Request?"
          message={`You are about to ${actionType === 'approve' ? 'approve' : 'reject'} this Job Request. This will record your electronic approval and notify the relevant parties.`}
          confirmText={actionType === 'approve' ? 'Approve' : 'Reject'}
          isDanger={actionType === 'reject'}
        />

        {/* Mount Shared Request Intake Flow (Scan QR & New Request modals) */}
        <RequestIntake intake={intake} />
      </div>
    </PageTransition>
  );
};
