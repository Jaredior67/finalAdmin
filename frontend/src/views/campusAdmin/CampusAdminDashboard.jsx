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
import { JobRequestFormOverlay } from '../../components/common/JobRequestFormOverlay';
import { JobRequestPrintSheet } from '../../components/common/JobRequestPrintSheet';
import { PageHeader } from '../../components/common/PageHeader';
import { getTimeGreeting, formatHeaderDate, getDisplayFirstName, formatTicketDate } from '../../components/common/TimeGreeting';

export const CampusAdminDashboard = () => {
  const { currentUser } = useAuth();
  const { requisitions, updateFinalAction, peekNextTrackingNumber, focusedTicketRef, setFocusedTicketRef, ticketSearch: searchTerm } = useData();

  // Header greeting — same pattern as the admin dashboard.
  const now = new Date();
  const timeGreeting = getTimeGreeting(now);
  const formattedDate = formatHeaderDate(now);
  const firstName = getDisplayFirstName(currentUser?.name, 'Campus Admin');

  const [selectedReq, setSelectedReq] = useState(null);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionStatus, setDecisionStatus] = useState('Approved');
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tabFilter, setTabFilter] = useState('pending'); // 'pending' | 'approved' | 'disapproved' | 'all'
  const [successToast, setSuccessToast] = useState('');

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

  const approvedFinalAction = activeRequisitions.filter(r => r.finalAction?.status === 'Approved' || r.status === 'Approved' || r.status === 'Ongoing' || r.status === 'Completed');
  const disapprovedFinalAction = activeRequisitions.filter(r => r.finalAction?.status === 'Disapproved' || r.status === 'Rejected');

  const filteredRequisitions = activeRequisitions.filter(r => {
    const matchesSearch = 
      String(r.controlNo || r.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requestedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.location?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;

    let matchesTab = true;
    if (tabFilter === 'pending') {
      matchesTab = needsFinalAction(r);
    } else if (tabFilter === 'approved') {
      matchesTab = r.finalAction?.status === 'Approved' || r.status === 'Approved' || r.status === 'Ongoing' || r.status === 'Completed';
    } else if (tabFilter === 'disapproved') {
      matchesTab = r.finalAction?.status === 'Disapproved' || r.status === 'Rejected';
    }

    return matchesSearch && matchesCategory && matchesTab;
  }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  // Deep link: a clicked notification stores its ticket ref here — open the
  // exact record in the decision modal, then clear so it never reopens.
  useEffect(() => {
    if (!focusedTicketRef) return;
    const found = (requisitions || []).find(r =>
      r.controlNo === focusedTicketRef || r.id === focusedTicketRef || r.ticket_no === focusedTicketRef
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

  const handleApplyDecision = () => {
    if (!selectedReq) return;
    // A disapproval without written grounds is not actionable — require remarks.
    if (decisionStatus === 'Disapproved' && !decisionRemarks.trim()) {
      setDecisionError('Disapproval requires written grounds — state the reason so PDAS and the requester can act on it.');
      return;
    }
    setDecisionError('');
    const issued = updateFinalAction(selectedReq.id, decisionStatus, decisionRemarks);
    setSuccessToast(decisionStatus === 'Approved'
      ? `Approved. Tracking ${issued || '(range exhausted — set in Settings → Tracking Numbers)'} issued for Ticket ${selectedReq.id}.`
      : `Final Action decision "${decisionStatus}" recorded for Ticket ${selectedReq.controlNo || selectedReq.id}`);
    setSelectedReq(prev => (prev && issued ? { ...prev, controlNo: issued } : prev));
    setIsDecisionModalOpen(false);
    setTimeout(() => setSuccessToast(''), 5000);
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Executive Page Header */}
      <PageHeader
        breadcrumbs={['Executive Oversight', 'Campus Administrator Approvals']}
        title={`${timeGreeting}, ${firstName}`}
        description={`ISAT U Dumangas Campus — Executive Approval Overview | ${formattedDate}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e3a8a',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Landmark size={15} /> Final Signatory Authority
            </span>
          </div>
        }
      />

      {/* Success Notification Toast */}
      {successToast && (
        <div className="animate-scale-in" style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: '10px',
          padding: '12px 18px',
          marginBottom: '20px',
          color: '#065f46',
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

      {/* KPI Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '18px',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #f59e0b',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Awaiting Final Action
          </div>
          <div style={{ fontSize: '26px', fontWeight: '900', color: '#b45309', marginTop: '4px' }}>
            {pendingFinalAction.length}
          </div>
          <div style={{ fontSize: '11px', color: '#78350f', marginTop: '4px' }}>
            PDAS requests awaiting Campus Admin approval
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '18px',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #10b981',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Final Approved Orders
          </div>
          <div style={{ fontSize: '26px', fontWeight: '900', color: '#047857', marginTop: '4px' }}>
            {approvedFinalAction.length}
          </div>
          <div style={{ fontSize: '11px', color: '#065f46', marginTop: '4px' }}>
            Authorized for GSM Work Order / Execution
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '18px',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #ef4444',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Disapproved / Returned
          </div>
          <div style={{ fontSize: '26px', fontWeight: '900', color: '#b91c1c', marginTop: '4px' }}>
            {disapprovedFinalAction.length}
          </div>
          <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px' }}>
            Returned for scope or procurement review
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '18px',
          border: '1px solid #e2e8f0',
          borderLeft: '4px solid #001f9c',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Total Registered Requests
          </div>
          <div style={{ fontSize: '26px', fontWeight: '900', color: '#001f9c', marginTop: '4px' }}>
            {activeRequisitions.length}
          </div>
          <div style={{ fontSize: '11px', color: '#1e3a8a', marginTop: '4px' }}>
            Campus-wide repair &amp; physical plant volume
          </div>
        </div>
      </div>

      {/* Main Approval Table Card */}
      <div className="content-card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', padding: '20px 24px' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '18px', fontWeight: '800' }}>
              Final Action Approval Queue ({filteredRequisitions.length})
            </h2>
            <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
              Review the official QF-PDAS-DC-01 form, verify PDAS director endorsements, and issue final action
            </p>
          </div>

          {/* Filters (search lives in the top navbar) */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ height: '36px', fontSize: '12.5px' }}
            >
              <option value="all">All Scope Categories</option>
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
            { id: 'pending', label: '⏳ Awaiting Final Action', count: pendingFinalAction.length, color: '#f59e0b' },
            { id: 'approved', label: '✓ Approved', count: approvedFinalAction.length, color: '#10b981' },
            { id: 'disapproved', label: '✕ Disapproved', count: disapprovedFinalAction.length, color: '#ef4444' },
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
                <th scope="col">Scope Area</th>
                <th scope="col">Requester &amp; Dept</th>
                <th scope="col">PDAS Head Action</th>
                <th scope="col">Final Action Status</th>
                <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequisitions.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700' }}>No requests found matching criteria.</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Switch tabs or clear filters to view requests.</div>
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
                            Under PDAS Review
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
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fffbeb', color: '#b45309', padding: '3px 8px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700' }}>
                            <Clock size={13} /> Awaiting Approval
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
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
        title={`Final Action Review & Approval — Ticket ${selectedReq?.controlNo || selectedReq?.id}`}
        maxWidth="1240px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {selectedReq?.controlNo ? <>Tracking: <strong>{selectedReq.controlNo}</strong></> : <>Next tracking on Approve: <strong>{peekNextTrackingNumber?.() || '—'}</strong></>}
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setIsDecisionModalOpen(false); setIsEditOpen(true); }}>
                Edit All Fields
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setIsDecisionModalOpen(false); setIsPrintOpen(true); }}>
                <Printer size={14} /> Preview Print
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
                style={{ background: decisionStatus === 'Approved' ? '#059669' : '#dc2626', border: 'none' }}
              >
                <Check size={14} /> Submit Final Action ({decisionStatus})
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
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client</div>
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
              <strong style={{ color: '#0f172a' }}>Issue Description: </strong>{selectedReq.description || '—'}
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', color: '#1e3a8a' }}>
              <strong>PDAS Head Endorsement (Kristine J. Amar): </strong>
              {selectedReq.actionTaken?.endorsedGSMHead?.checked ? 'Endorsed to GSM Head for issuance of Work Order' :
               selectedReq.actionTaken?.endorsedDesignTeam?.checked ? 'Endorsed to Design Team for POW & Detailed Plan' :
               selectedReq.actionTaken?.returnedToClient?.checked ? 'Returned to Client for Purchase/Job Request Preparation' :
               'Regular maintenance review passed.'}
            </div>

              {/* Decision Form */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '22px' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Landmark size={18} /> Campus Administrator Decision Panel
                </div>

              {/* Final Action Radio Buttons */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', display: 'block' }}>
                  Final Action Decision *
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
                    [✓] Approved
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
                    [✕] Disapproved
                  </label>
                </div>
              </div>

              {/* Remarks Textarea */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: '700' }}>
                  Official Remarks &amp; Directives *
                </label>
                <textarea
                  className="form-textarea"
                  value={decisionRemarks}
                  onChange={(e) => { setDecisionRemarks(e.target.value); if (decisionError) setDecisionError(''); }}
                  placeholder="e.g. Approved for immediate procurement of replacement parts and work order issuance..."
                  style={{ minHeight: '120px', fontSize: '13.5px' }}
                />
                {decisionError && (
                  <div role="alert" style={{ marginTop: '6px', fontSize: '12.5px', color: '#b91c1c', fontWeight: '600' }}>
                    {decisionError}
                  </div>
                )}
              </div>

              <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                🔒 This decision will be stamped onto the official QF-PDAS-DC-01 master record and archived in the institutional registry.
              </div>
            </div>

            </div>
            {/* Right column: live QF-PDAS-DC-01 document preview */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live QF-PDAS-DC-01 Preview
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
        title="Edit + Final Action (QF-PDAS-DC-01)"
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
      {selectedReq && isPrintOpen && (
        <div className="jr-print-only" aria-hidden="true"><JobRequestPrintSheet req={selectedReq} /></div>
      )}
    </div>
  );
};
