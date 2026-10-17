import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Printer,
  FileText,
  MapPin,
  Check,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { JobRequestPrintSheet } from '../../components/common/JobRequestPrintSheet';
import { PageHeader } from '../../components/common/PageHeader';
import { PDASJobRequestFormDocument } from '../../components/common/PDASJobRequestFormDocument';
import { CATEGORY_OPTIONS } from '../../utils/jobRequestIntake';
import { formatHeaderDate } from '../../components/common/TimeGreeting';
import { ChartsRow, DonutCard, BarCard } from '../../components/common/DashboardCharts';
import { Spinner } from '../../components/ui/Spinner';
import { useOptionalToast } from '../../components/ui/Toast';

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

  const [selectedReq, setSelectedReq] = useState(null);
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

  // Deep link: a clicked notification opens that exact ticket in preview modal
  useEffect(() => {
    if (!focusedTicketRef) return;
    const refStr = String(focusedTicketRef || '').trim();
    const found = (requisitions || []).find(r =>
      String(r.controlNo || '') === refStr ||
      String(r.id || '') === refStr ||
      String(r.ticket_no || '') === refStr
    );
    if (found) {
      setSelectedReq(found);
      setIsPreviewOpen(true);
    }
    setFocusedTicketRef(null);
  }, [focusedTicketRef, requisitions, setFocusedTicketRef]);

  // Requisitions relevant to supervisor:
  // Either assigned supervisor matches, department matches, or currently in Pending Supervisor Approval
  const supervisorRequisitions = (requisitions || []).filter(r => !r.isArchived);

  /* Where a request sits in THIS screen's pipeline: the label the Endorsement
     Record donut draws and the tint the category bars beside it inherit, plus
     the one palette both read. 'Awaiting endorsement' is pending amber here —
     deliberately not the awaiting-signatures orange — so the two cards cannot
     drift into two different oranges sitting side by side. */
  const endorseStage = (r) => (
    (r.status === 'Returned' || r.status === 'Rejected') && r.rejectionStage === 'supervisor'
      ? 'Returned for revision'
      : r.supervisorApproved ||
        ['Under Review', 'Pending Final Approval', 'Approved', 'Ongoing', 'Completed'].includes(r.status)
        ? 'Endorsed'
        : 'Awaiting endorsement'
  );
  /* Endorsed is brand blue, not green: green means Completed everywhere else
     in this app, and endorsement is mid-pipeline — it hands the request to
     PDAS, it does not close it. Same hex the Approved badge carries. */
  const ENDORSE_STAGE_COLORS = {
    'Awaiting endorsement': '#f59e0b',
    Endorsed: '#001f9c',
    'Returned for revision': '#f2a33a'
  };

  /* One definition of "waiting on this supervisor", shared by the tab counts
     and by the row's action buttons. Both used to be written out twice and the
     copies disagreed: a request with no named immediate supervisor is not
     something this queue can endorse, so it is left out of the count rather
     than counted with no button to press. The sidebar badge applies the same
     rule, so its number and this tab's number always agree. */
  const isPendingReview = (r) =>
    !r.supervisorApproved &&
    (r.status === 'Pending Supervisor Approval' ||
      (r.status === 'Pending' && Boolean(r.immediateSupervisor)));

  const pendingApproval = supervisorRequisitions.filter(isPendingReview);

  const approvedBySupervisor = supervisorRequisitions.filter(r =>
    r.supervisorApproved ||
    ['Under Review', 'Pending Final Approval', 'Approved', 'Ongoing', 'Completed'].includes(r.status)
  );

  /* A return is no longer the terminal 'Rejected' state — it lands in
     'Returned', which stays in the requester's active list so they can revise.
     Keying this on 'Rejected' left the supervisor's own "returned" queue empty
     for every return they made. */
  const rejectedBySupervisor = supervisorRequisitions.filter(r =>
    (r.status === 'Returned' || r.status === 'Rejected') && r.rejectionStage === 'supervisor'
  );

  const filteredRequisitions = supervisorRequisitions.filter(r => {
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
    const isUrgentA = /high|urgent|emergency/i.test(String(a.urgency || '')) || a.requestType === 'Urgent Request' || a.category === 'Urgent Hazard';
    const isUrgentB = /high|urgent|emergency/i.test(String(b.urgency || '')) || b.requestType === 'Urgent Request' || b.category === 'Urgent Hazard';
    const uA = isUrgentA ? 0 : (a.urgency === 'High Risk' ? 1 : a.urgency === 'Medium Risk' ? 2 : 3);
    const uB = isUrgentB ? 0 : (b.urgency === 'High Risk' ? 1 : b.urgency === 'Medium Risk' ? 2 : 3);
    if (uA !== uB) return uA - uB;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  const handleOpenAction = (req, type) => {
    setSelectedReq(req);
    setActionType(type);
    setActionError('');
    setRemarks(type === 'approve' ? 'Electronically approved' : '');
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const toastCtx = useOptionalToast();
  const toast = toastCtx?.toast;

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
      <PageHeader
        breadcrumbs={['Supervisor', 'Supervisor Approvals']}
        title="Supervisor Approvals"
        description={`ISAT U Dumangas Campus — Departmental Review & Endorsements | ${formattedDate}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'var(--bg-muted)',
              border: '1px solid #e2e8f0',
              color: '#334155',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '700',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <UserCheck size={14} /> Immediate Supervisor Authority
            </span>
          </div>
        }
      />

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

      {/* Metrics Row — 2 cards: Pending Supervisor Review and Total Subordinate Tickets.
          The intermediate breakdown (Approved & Forwarded, Returned for Revision)
          lives in the Endorsement Record donut below. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
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
            Pending Supervisor Review
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: pendingApproval.length > 0 ? '#92400e' : '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {pendingApproval.length}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontWeight: '400' }}>
            Action required · Click to filter
          </div>
        </div>

        <div 
          onClick={() => { setTabFilter('all'); setCategoryFilter('all'); }}
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            padding: '14px 16px',
            border: '1px solid #e2e8f0',
            borderLeft: '3px solid #5b6a82',
            boxShadow: tabFilter === 'all' && categoryFilter === 'all' ? '0 0 0 2px #5b6a82, var(--shadow-subtle)' : 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'box-shadow 0.15s, border-color 0.15s'
          }}
          onMouseEnter={(e) => { if (tabFilter !== 'all' || categoryFilter !== 'all') e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { if (tabFilter !== 'all' || categoryFilter !== 'all') e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Total Subordinate Tickets
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {supervisorRequisitions.length}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontWeight: '400' }}>
            All departmental work orders · Click to view all
          </div>
        </div>
      </div>

      {/* Statistics — interactive charts: clicking a segment or category filters the review queue */}
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
        />
        <DonutCard
          title="Endorsements by Urgency"
          icon="urgency"
          list={supervisorRequisitions}
          pick={(r) => r.urgency}
          palette="urgency"
          unit="REQUESTS"
          onSegmentClick={() => setTabFilter('all')}
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
          {/* The shared list. These options were hand-copied from an older
              scheme (Plumbing, Carpentry, ICT, Other) that no request is ever
              filed under, so five of the six returned an empty queue. */}
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
                  <th style={{ padding: '12px 16px', fontWeight: '700' }}>Category & Location</th>
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
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            title="View official document"
                            onClick={() => { setSelectedReq(req); setIsPreviewOpen(true); }}
                          >
                            <FileText size={14} /> View
                          </button>

                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                onClick={() => handleOpenAction(req, 'reject')}
                              >
                                <XCircle size={14} /> Return
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '700' }}
                                onClick={() => handleOpenAction(req, 'approve')}
                              >
                                <Check size={14} /> Approve & Route
                              </button>
                            </>
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

      {/* Confirmation / Remarks Modal */}
      {isActionModalOpen && selectedReq && (
        <Modal
          isOpen={isActionModalOpen}
          onClose={() => setIsActionModalOpen(false)}
          onBack={() => setIsActionModalOpen(false)}
          title={actionType === 'approve'
            ? 'Immediate Supervisor Approval Confirmation'
            : 'Return Request for Revision'}
          maxWidth="600px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsActionModalOpen(false)} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${actionType === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                style={{ fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                onClick={handleApplyAction}
                disabled={isSubmitting}
              >
                {isSubmitting && <Spinner size={16} color="#ffffff" />}
                {isSubmitting 
                  ? 'Processing…' 
                  : (actionType === 'approve' ? 'Confirm & Electronically Approve' : 'Confirm & Return for Revision')}
              </button>
            </div>
          }
        >
          <div>
            <div style={{
              background: actionType === 'approve' ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${actionType === 'approve' ? '#a7f3d0' : '#fecaca'}`,
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '16px',
              fontSize: '13.5px',
              color: actionType === 'approve' ? '#047857' : '#b91c1c',
              lineHeight: 1.5
            }}>
              {actionType === 'approve' ? (
                <div>
                  <strong>Endorsement Step:</strong> Are you sure you want to approve this request?
                  <div style={{ marginTop: '6px', fontSize: '12.5px' }}>
                    Upon confirmation, your electronic approval will be stamped on the official form and routed to the <strong>System Administrator</strong>.
                  </div>
                </div>
              ) : (
                <div>
                  <strong>Revision Step:</strong> This request will be returned to the requester. Please enter specific remarks or instructions on what needs revision.
                </div>
              )}
            </div>

            {actionError && (
              <div style={{ color: '#b91c1c', fontSize: '12.5px', fontWeight: '700', marginBottom: '10px' }}>
                {actionError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontWeight: '700', fontSize: '12.5px' }}>
                {actionType === 'approve' ? 'Supervisor Remarks / Endorsement Note (Optional)' : 'Remarks for Revision (Required) *'}
              </label>
              <textarea
                className="form-control"
                rows={4}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={actionType === 'approve' ? 'e.g., Verified necessity. Recommended for execution.' : 'e.g., Please clarify specific room number and attach photo of damaged pipe.'}
                style={{ width: '100%', fontSize: '13px' }}
              />
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
              <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print</button>
            </div>
          }
        >
          <div style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            <JobRequestPrintSheet req={selectedReq} />
          </div>
        </Modal>
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
    </div>
  );
};
