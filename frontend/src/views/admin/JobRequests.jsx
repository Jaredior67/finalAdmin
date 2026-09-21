import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Wrench, 
  Clock, 
  AlertTriangle,
  Eye,
  Calendar,
  UserCheck,
  Zap,
  CheckCircle2,
  Printer,
  Archive,
  FileSignature
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { JobRequestFormOverlay } from '../../components/common/JobRequestFormOverlay';
import { JobRequestPrintSheet } from '../../components/common/JobRequestPrintSheet';

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
    updateActionTaken,
    updateFinalAction,
    updateRequisitionTrackingNo,
    updateRequisitionForm,
    archiveRequisition,
    users 
  } = useData();

  // Signature gate state
  const [signaturesConfirmed, setSignaturesConfirmed] = useState(false);
  const [scanUrl, setScanUrl] = useState('');

  const [activeStatusTab, setActiveStatusTab] = useState(initialStatusTab);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReq, setSelectedReq] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState('');
  const [assignee, setAssignee] = useState('');
  const [statusChoice, setStatusChoice] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [procurementChoice, setProcurementChoice] = useState('');

  // Print modal state
  const [isPrintDocModalOpen, setIsPrintDocModalOpen] = useState(false);
  const [isEditOverlayOpen, setIsEditOverlayOpen] = useState(false);
  const [trackingEdit, setTrackingEdit] = useState('');
  const [trackingMsg, setTrackingMsg] = useState('');

  // Archive confirmation target
  const [archiveTarget, setArchiveTarget] = useState(null);

  // Assignment gate warning (standard tickets need confirmed hardcopy first)
  const [assignWarn, setAssignWarn] = useState('');

  // Action Taken Form State
  const [actionDesignTeam, setActionDesignTeam] = useState(false);
  const [actionDesignDetailedPlan, setActionDesignDetailedPlan] = useState(false);
  const [actionDesignPowBoq, setActionDesignPowBoq] = useState(false);
  const [actionDesignReceivedBy, setActionDesignReceivedBy] = useState('');

  const [actionGsm, setActionGsm] = useState(false);
  const [actionGsmReceivedBy, setActionGsmReceivedBy] = useState('');
  const [actionGsmDate, setActionGsmDate] = useState('');

  const [actionReturn, setActionReturn] = useState(false);
  const [actionReturnReason, setActionReturnReason] = useState('prep_pr');
  const [actionReturnReceivedBy, setActionReturnReceivedBy] = useState('');
  const [actionReturnRemarks, setActionReturnRemarks] = useState('');

  // Final Action Form State
  const [finalStatusChoice, setFinalStatusChoice] = useState('Pending');
  const [finalActionRemarks, setFinalActionRemarks] = useState('');

  // Maintenance personnel list
  const technicians = users.filter(u => 
    u.role === 'technician' || 
    u.role === 'maintenance' || 
    u.userType === 'maintenance'
  );

  // Priority sorting: High Risk -> Medium Risk -> Low Risk
  const priorityOrder = { 'High Risk': 1, 'Urgent': 1, 'High': 1, 'Medium Risk': 2, 'Medium': 2, 'Low Risk': 3, 'Low': 3 };

  const filteredList = requisitions
    .filter(req => !req.isArchived) // Exclude archived tickets from all regular tabs
    .filter(req => {
      const matchesTab = 
        activeStatusTab === 'all' || 
        (activeStatusTab === 'pending' && req.status === 'Pending') ||
        (activeStatusTab === 'under-review' && req.status === 'Under Review') ||
        (activeStatusTab === 'awaiting-signatures' && req.status === 'Awaiting Signatures') ||
        (activeStatusTab === 'approved' && req.status === 'Approved') ||
        (activeStatusTab === 'in-progress' && (req.status === 'In Progress' || req.status === 'Ongoing')) ||
        (activeStatusTab === 'on-hold' && req.status === 'On Hold') ||
        (activeStatusTab === 'completed' && req.status === 'Completed') ||
          (activeStatusTab === 'flagged' && (req.replacementFlag?.isFlagged || req.maintenanceFlag?.type));

      const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
      const matchesUrgency = urgencyFilter === 'all' || req.urgency === urgencyFilter;
      const matchesSearch = 
        String(req.controlNo || req.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.requestedBy.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesTab && matchesCategory && matchesUrgency && matchesSearch;
    })
    .sort((a, b) => {
      // High urgency / Urgent on top
      const pA = priorityOrder[a.urgency] || 5;
      const pB = priorityOrder[b.urgency] || 5;
      return pA - pB;
    });

  const handleOpenDetail = (req) => {
    setSelectedReq(req);
    setTrackingEdit(req.controlNo || '');
    setTrackingMsg('');
    setAssignee(req.assignedTo || '');
    setStatusChoice(req.status);
    setAdminNotes(req.notes || '');
    setAssignWarn('');
    setProcurementChoice(req.replacementFlag?.procurementStatus || 'Pending Purchase Request (PR)');
    setSignaturesConfirmed(false);
    setScanUrl(req.signedFormScanUrl || '');

    // Action Taken State
    const at = req.actionTaken || {};
    setActionDesignTeam(at.endorsedDesignTeam?.checked || false);
    setActionDesignDetailedPlan(at.endorsedDesignTeam?.detailedPlan || false);
    setActionDesignPowBoq(at.endorsedDesignTeam?.powBoq || false);
    setActionDesignReceivedBy(at.endorsedDesignTeam?.receivedBy || '');

    setActionGsm(at.endorsedGSMHead?.checked || false);
    setActionGsmReceivedBy(at.endorsedGSMHead?.receivedBy || '');
    setActionGsmDate(at.endorsedGSMHead?.date || '');

    setActionReturn(at.returnedToClient?.checked || false);
    setActionReturnReason(at.returnedToClient?.reason || 'prep_pr');
    setActionReturnReceivedBy(at.returnedToClient?.receivedBy || '');
    setActionReturnRemarks(at.returnedToClient?.remarks || '');

    // Final Action State
    const fa = req.finalAction || {};
    setFinalStatusChoice(fa.status || (req.status === 'Approved' ? 'Approved' : req.status === 'Rejected' ? 'Disapproved' : 'Pending'));
    setFinalActionRemarks(fa.remarks || req.notes || '');

    setIsModalOpen(true);
  };

  const handleSaveChanges = () => {
    if (selectedReq) {
      const isStandard = selectedReq.requestType !== 'Urgent Request';
      // Standard tickets: the signed hardcopy must be confirmed (Awaiting
      // Signatures gate) before approval or technician assignment.
      if (isStandard && !selectedReq.signedFormScanUrl && (statusChoice === 'Approved' || (assignee && assignee !== selectedReq.assignedTo))) {
        setAssignWarn('Confirm receipt of the fully-signed physical form first (Awaiting Signatures gate) before approving or assigning.');
        return;
      }
      setAssignWarn('');
      let confirmationMessage = '';
      if (selectedReq.status === 'Pending' && !['Under Review', 'Rejected'].includes(statusChoice)) {
        setIsModalOpen(false);
        return;
      }
      if (statusChoice !== selectedReq.status) {
        if (statusChoice === 'Under Review' && selectedReq.status === 'Pending') {
          reviewRequisition(selectedReq.id, adminNotes);
          confirmationMessage = `${selectedReq.controlNo || selectedReq.id} moved under review.`;
        } else if (statusChoice === 'Awaiting Signatures' && selectedReq.status === 'Under Review') {
          approveRequisition(selectedReq.id, adminNotes);
          confirmationMessage = `${selectedReq.controlNo || selectedReq.id} approved successfully.`;
        } else if (statusChoice === 'Rejected' && ['Pending', 'Under Review'].includes(selectedReq.status)) {
          rejectRequisition(selectedReq.id, adminNotes);
          confirmationMessage = `${selectedReq.controlNo || selectedReq.id} rejected.`;
        } else {
          updateRequisitionStatus(selectedReq.id, statusChoice, assignee, adminNotes);
          confirmationMessage = `${selectedReq.controlNo || selectedReq.id} status updated successfully.`;
        }
      }
      if (assignee !== selectedReq.assignedTo && assignee && selectedReq.status === 'Approved') {
        const assignmentSucceeded = assignTechnician(selectedReq.id, assignee);
        if (assignmentSucceeded) {
          confirmationMessage = `${selectedReq.controlNo || selectedReq.id} assigned to ${assignee} successfully.`;
        }
      }
      if (selectedReq.replacementFlag?.isFlagged && procurementChoice !== selectedReq.replacementFlag.procurementStatus) {
        updateProcurementStatus(selectedReq.id, procurementChoice);
      }
      if (confirmationMessage) setDispatchMessage(confirmationMessage);
      setIsModalOpen(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Requests & Work Orders</h1>
        </div>
      </div>

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px', paddingBottom: '2px', overflowX: 'auto' }}>
        {[
          { id: 'all', label: 'All Requests', count: requisitions.filter(r => !r.isArchived).length },
          { id: 'pending', label: 'Pending Submission', count: requisitions.filter(r => !r.isArchived && r.status === 'Pending').length },
          { id: 'under-review', label: 'Under Review', count: requisitions.filter(r => !r.isArchived && r.status === 'Under Review').length },
          { id: 'awaiting-signatures', label: 'Awaiting Signatures', count: requisitions.filter(r => !r.isArchived && r.status === 'Awaiting Signatures').length },
          { id: 'approved', label: 'Approved / Queued', count: requisitions.filter(r => !r.isArchived && r.status === 'Approved').length },
          { id: 'in-progress', label: 'Ongoing (On-Site)', count: requisitions.filter(r => !r.isArchived && (r.status === 'In Progress' || r.status === 'Ongoing')).length },
          { id: 'on-hold', label: 'On Hold', count: requisitions.filter(r => !r.isArchived && r.status === 'On Hold').length },
          { id: 'flagged', label: '⚠️ Maintenance Flags', count: requisitions.filter(r => !r.isArchived && (r.replacementFlag?.isFlagged || r.maintenanceFlag?.type)).length },
          { id: 'completed', label: 'Completed', count: requisitions.filter(r => !r.isArchived && r.status === 'Completed').length },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveStatusTab(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontWeight: activeStatusTab === tab.id ? '700' : '500',
              color: activeStatusTab === tab.id ? '#001f9c' : '#64748b',
              borderBottom: activeStatusTab === tab.id ? '2px solid #001f9c' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13.5px',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
            <span style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: activeStatusTab === tab.id ? '#eff6ff' : '#f1f5f9',
              color: activeStatusTab === tab.id ? '#1d4ed8' : '#64748b',
              fontWeight: '700'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by tracking number, title, location, QR tag, or requestor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="Drawing/Design">Drawing/Design</option>
          <option value="Physical Structures">Physical Structures</option>
          <option value="Electrical">Electrical</option>
          <option value="Mechanical">Mechanical</option>
          <option value="Water/Sanitary">Water/Sanitary</option>
          <option value="Air Conditioning">Air Conditioning</option>
        </select>

        <select
          className="select-filter"
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
        >
          <option value="all">All Risk Levels</option>
          <option value="High Risk">🚨 High Risk (Immediate Hazard)</option>
          <option value="Medium Risk">⚡ Medium Risk (Routine Service)</option>
          <option value="Low Risk">🟢 Low Risk (Minor / Scheduled)</option>
        </select>
      </div>

      {/* Requests Table */}
      <div className="content-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>TRACKING NUMBER</th>
                <th>ISSUE & LOCATION</th>
                <th>REQUISITIONER</th>
                <th>CATEGORY</th>
                <th>URGENCY</th>
                <th>STATUS</th>
                <th>ASSIGNED TECHNICIAN</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No matching job requests found in this view.
                  </td>
                </tr>
              ) : (
                filteredList.map(req => {
                  const isFlagged = req.replacementFlag?.isFlagged;
                  const isEmergency = req.urgency === 'Urgent';
                  const isHigh = req.urgency === 'High';

                  return (
                    <tr 
                      key={req.id}
                      style={{
                        background: isEmergency ? 'rgba(239, 68, 68, 0.03)' : isHigh ? 'rgba(245, 158, 11, 0.02)' : 'inherit'
                      }}
                    >
                      <td style={{ fontWeight: '700', color: '#001f9c' }}>
                        <div>{req.controlNo}</div>
                        {req.qrCodeRef && (
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>QR: {req.qrCodeRef}</div>
                        )}
                      </td>
                      <td>
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
                        {req.urgentPendingStandardForm && (() => {
                          const filed = req.date ? new Date(`${req.date}T00:00:00`) : null;
                          const today = new Date(); today.setHours(0, 0, 0, 0);
                          const overdue = filed && !Number.isNaN(filed.getTime()) && filed < today;
                          return (
                            <div style={{
                              marginTop: '4px',
                              display: 'inline-flex',
                              background: overdue ? '#fef2f2' : '#fffbeb',
                              border: overdue ? '1px solid #fecaca' : '1px solid #fde68a',
                              color: overdue ? '#b91c1c' : '#b45309',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}>
                              {overdue ? 'Hardcopy overdue — follow up' : 'Hardcopy pending — due within 24h'}
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{req.requestedBy}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{req.department}</div>
                        <div style={{ fontSize: '10.5px', color: '#001f9c' }}>{req.idNumber}</div>
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
                      <td style={{ fontSize: '12.5px', color: req.assignedTo ? '#1e293b' : '#94a3b8' }}>
                        {req.assignedTo ? (
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>{req.assignedTo}</div>
                        ) : (
                          <span style={{ color: '#d97706', fontWeight: '600' }}>Pending Assignment</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenDetail(req)}
                          >
                            <Eye size={13} />
                            Review & Assign
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
      </div>

      {/* Manage Requisition Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Work Order Review & Dispatch: ${selectedReq?.controlNo || ''}`}
        maxWidth="740px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ISAT U Dumangas PDAS Central Operations
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveChanges}
              >
                <CheckCircle2 size={16} />
                Save & Dispatch Updates
              </button>
            </div>
          </div>
        }
      >
        {selectedReq && (
          <div>
            {/* Tracking number — issued ONLY on Final Approval; admin may correct it */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label className="form-label" style={{ fontSize: '11px' }}>Tracking Number (auto on Final Approval — admin can correct)</label>
                <input className="form-input" value={trackingEdit} onChange={(e) => setTrackingEdit(e.target.value)} placeholder="PENDING — issued on Final Approval" style={{ fontSize: '13px', fontWeight: '700' }} />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                const ok = updateRequisitionTrackingNo(selectedReq.id, trackingEdit);
                setTrackingMsg(ok ? `Tracking set to ${trackingEdit.trim()}.` : 'Invalid or duplicate tracking number.');
                if (ok) setSelectedReq(prev => ({ ...prev, controlNo: trackingEdit.trim() }));
              }}>Save Tracking</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditOverlayOpen(true)}>Edit All Fields</button>
              {trackingMsg && <span style={{ fontSize: '12px', color: '#1e40af' }}>{trackingMsg}</span>}
            </div>
            {/* Header info */}
            <div style={{ padding: '14px 18px', background: '#f8fafc', borderRadius: '12px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>{selectedReq.title}</div>
                <UrgencyBadge urgency={selectedReq.urgency} />
              </div>
              <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{selectedReq.description}</div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '14px', fontSize: '12px', color: '#64748b' }}>
                <span><strong>Location:</strong> {selectedReq.location}</span>
                <span><strong>Requisitioner:</strong> {selectedReq.requestedBy} ({selectedReq.department})</span>
              </div>
              {selectedReq.completionPhotoUrl && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={selectedReq.completionPhotoUrl} alt="Completed work" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                  <span style={{ fontSize: '12px', color: '#047857', fontWeight: '700' }}>Completion photo attached by technician</span>
                </div>
              )}
            </div>

            {selectedReq.status === 'Pending' && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px', color: '#9a3412', fontSize: '13px' }}>
                {selectedReq.requestType === 'Urgent Request' || selectedReq.urgency === 'Urgent' ? (
                  <div>
                    <strong>🚨 Urgent Request Dispatch Authorized:</strong> Admin can accept and dispatch maintenance personnel immediately for urgent hazard response. The hardcopy QF-PDAS-DC-01 form will be printed, signed by the Immediate Supervisor, and passed to PDAS post-dispatch within the day.
                  </div>
                ) : (
                  <div>
                    <strong>📄 Standard Physical Form Process:</strong> The requester must print the QF-PDAS-DC-01 form, obtain their Immediate Supervisor's physical wet-ink signature, and pass the hardcopy to the PDAS Office. <strong>The request CANNOT move or advance until the hardcopy form is completely signed by all signatories.</strong>
                  </div>
                )}
              </div>
            )}

            {/* Signature Gate: shown when status is Awaiting Signatures */}
            {selectedReq.status === 'Awaiting Signatures' && (
              <div style={{ background: '#fff7ed', border: '1.5px solid #fb923c', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
                <div style={{ fontWeight: '800', color: '#9a3412', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                  <FileSignature size={18} color="#ea580c" />
                  Physical Wet-Ink Signature Verification Gate
                </div>
                <div style={{ fontSize: '13px', color: '#9a3412', marginBottom: '12px', lineHeight: 1.5 }}>
                  The printed <strong>QF-PDAS-DC-01</strong> form must be signed physically in wet ink by the <strong>Requisitioner</strong> and <strong>Immediate Supervisor</strong>, then submitted to the PDAS Office before this ticket can advance to <strong>Approved</strong> and dispatched to maintenance.
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={signaturesConfirmed}
                    onChange={(e) => setSignaturesConfirmed(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#059669' }}
                  />
                  I confirm that the signed hardcopy QF-PDAS-DC-01 form has been received by PDAS
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
                  Confirm Signatures → Advance to Approved
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
                
                <div style={{ marginTop: '10px' }}>
                  <label className="form-label" style={{ color: '#991b1b', fontWeight: '700' }}>
                    University Procurement Status *
                  </label>
                  <select
                    className="form-select"
                    value={procurementChoice}
                    onChange={(e) => setProcurementChoice(e.target.value)}
                    style={{ background: '#ffffff', borderColor: '#fca5a5' }}
                  >
                    <option value="Pending Purchase Request (PR)">Pending Purchase Request (PR Form Preparation)</option>
                    <option value="PR Submitted to Supply & BAC">PR Submitted to Supply & BAC Office</option>
                    <option value="Canvassing / Purchase Order (PO) Issued">Canvassing / Purchase Order (PO) Issued</option>
                    <option value="Delivered & Awaiting Installation">Delivered to Campus & Awaiting Installation</option>
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Workflow Status *</label>
                <select
                  className="form-select"
                  value={statusChoice}
                  onChange={(e) => setStatusChoice(e.target.value)}
                >
                  <option value="Pending">Pending PDAS Review</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Awaiting Signatures">Awaiting Signatures (Print & Sign QF-PDAS-DC-01)</option>
                  <option value="Approved">Approved (Signatures Confirmed)</option>
                  <option value="Ongoing">Ongoing (Technician Dispatched On-Site)</option>
                  <option value="On Hold">On Hold (Paused / Awaiting Parts)</option>
                  <option value="Completed">Completed / Quality Inspected</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Unable to Complete">Unable to Complete</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assign Maintenance Specialist *</label>
                <select
                  className="form-select"
                  value={assignee}
                  onChange={(e) => { setAssignee(e.target.value); setAssignWarn(''); }}
                >
                  <option value="">-- Select Specialist --</option>
                  {technicians.map(t => {
                    const name = t.name || `${t.firstName} ${t.lastName}`;
                    const spec = t.specialization || t.title || 'Maintenance Specialist';
                    return (
                      <option key={t.id} value={`${name} (${spec})`}>
                        {name} — {spec}
                      </option>
                    );
                  })}
                </select>
                {assignWarn && (
                  <div style={{ marginTop: '6px', fontSize: '12.5px', color: '#b91c1c', fontWeight: '600' }}>{assignWarn}</div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Director / Supervisor Field Directives & Remarks</label>
              <textarea
                className="form-textarea"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add specific instructions for technician, safety protocols, or requisitioner feedback..."
                style={{ minHeight: '80px' }}
              />
            </div>
            {/* ACTION TAKEN CONTROL PANEL (PDAS DIRECTOR) */}
            <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
              <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '10px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📋 ACTION TAKEN (Head, PDAS — Kristine J. Amar)</span>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>QF-PDAS-DC-01 Section</span>
              </div>

              {/* Action 1: Design Team */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={actionDesignTeam}
                    onChange={(e) => setActionDesignTeam(e.target.checked)}
                  />
                  Endorsed to Design Team for preparations
                </label>
                {actionDesignTeam && (
                  <div style={{ marginTop: '8px', marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="checkbox"
                          checked={actionDesignDetailedPlan}
                          onChange={(e) => setActionDesignDetailedPlan(e.target.checked)}
                        /> Detailed Plan
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="checkbox"
                          checked={actionDesignPowBoq}
                          onChange={(e) => setActionDesignPowBoq(e.target.checked)}
                        /> Program of Works and Bill of Quantities
                      </label>
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Received by (Name & Signature)..."
                      value={actionDesignReceivedBy}
                      onChange={(e) => setActionDesignReceivedBy(e.target.value)}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                  </div>
                )}
              </div>

              {/* Action 2: GSM Head */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={actionGsm}
                    onChange={(e) => setActionGsm(e.target.checked)}
                  />
                  Endorsed to GSM Head for issuance of Work Order
                </label>
                {actionGsm && (
                  <div style={{ marginTop: '8px', marginLeft: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Received by (Name & Signature)..."
                      value={actionGsmReceivedBy}
                      onChange={(e) => setActionGsmReceivedBy(e.target.value)}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                    <input
                      type="date"
                      className="form-input"
                      value={actionGsmDate}
                      onChange={(e) => setActionGsmDate(e.target.value)}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                  </div>
                )}
              </div>

              {/* Action 3: Returned to Client */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                <label style={{ fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={actionReturn}
                    onChange={(e) => setActionReturn(e.target.checked)}
                  />
                  Returned to Client for PR / JR / Remarks
                </label>
                {actionReturn && (
                  <div style={{ marginTop: '8px', marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <select
                      className="form-select"
                      value={actionReturnReason}
                      onChange={(e) => setActionReturnReason(e.target.value)}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      <option value="cannot_be_done">Request cannot be done as per remarks</option>
                      <option value="prep_pr">Preparation of Purchase Request (PR) for materials needed</option>
                      <option value="prep_jr">Preparation of Job Request (JR) for procurement</option>
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Received by Name & Signature..."
                      value={actionReturnReceivedBy}
                      onChange={(e) => setActionReturnReceivedBy(e.target.value)}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Specific Remarks..."
                      value={actionReturnRemarks}
                      onChange={(e) => setActionReturnRemarks(e.target.value)}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  updateActionTaken(selectedReq.id, {
                    endorsedDesignTeam: { checked: actionDesignTeam, detailedPlan: actionDesignDetailedPlan, powBoq: actionDesignPowBoq, receivedBy: actionDesignReceivedBy },
                    endorsedGSMHead: { checked: actionGsm, workOrder: actionGsm, receivedBy: actionGsmReceivedBy, date: actionGsmDate },
                    returnedToClient: { checked: actionReturn, reason: actionReturnReason, receivedBy: actionReturnReceivedBy, remarks: actionReturnRemarks }
                  });
                }}
              >
                Save Action Taken Details
              </button>
            </div>

            {/* FINAL ACTION CONTROL PANEL (CAMPUS ADMINISTRATOR) */}
            <div style={{ background: '#f0f9ff', border: '1.5px solid #93c5fd', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
              <div style={{ fontWeight: '800', color: '#1e40af', marginBottom: '10px', fontSize: '14px' }}>
                🏛️ FINAL ACTION (Campus Administrator — Dr. Ramil G. Lumauag)
              </div>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
                <label style={{ fontWeight: '700', fontSize: '13.5px', color: '#15803d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="radio"
                    name="finalActionChoice"
                    value="Approved"
                    checked={finalStatusChoice === 'Approved'}
                    onChange={() => setFinalStatusChoice('Approved')}
                  />
                  [✓] Approved
                </label>
                <label style={{ fontWeight: '700', fontSize: '13.5px', color: '#b91c1c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="radio"
                    name="finalActionChoice"
                    value="Disapproved"
                    checked={finalStatusChoice === 'Disapproved'}
                    onChange={() => setFinalStatusChoice('Disapproved')}
                  />
                  [✕] Disapproved
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Campus Administrator Remarks *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Approved for immediate procurement & repair / Disapproved due to project scope..."
                  value={finalActionRemarks}
                  onChange={(e) => setFinalActionRemarks(e.target.value)}
                  style={{ fontSize: '12.5px' }}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  updateFinalAction(selectedReq.id, finalStatusChoice, finalActionRemarks);
                  setIsModalOpen(false);
                }}
              >
                Apply Campus Administrator Final Action Decision
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
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
      </Modal>

      {/* PRINT OFFICIAL QF-PDAS-DC-01 FORM MODAL — print-safe sheet */}
      <Modal
        isOpen={isPrintDocModalOpen}
        onClose={() => setIsPrintDocModalOpen(false)}
        title="Official PDAS Job Request Form (QF-PDAS-DC-01)"
        maxWidth="800px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {selectedReq?.controlNo || 'PENDING — issued on Final Approval'}
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
                onClick={() => window.print()}
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
      {selectedReq && isPrintDocModalOpen && (
        <div className="jr-print-only" aria-hidden="true">
          <JobRequestPrintSheet req={selectedReq} />
        </div>
      )}

      {/* Editable overlay for admin */}
      <JobRequestFormOverlay
        isOpen={isEditOverlayOpen}
        onClose={() => setIsEditOverlayOpen(false)}
        initialReq={selectedReq || {}}
        allowActionTaken
        allowFinalAction={false}
        title="Edit Job Request Fields (QF-PDAS-DC-01)"
        onSave={(edited) => { updateRequisitionForm(selectedReq.id, edited); setSelectedReq(prev => ({ ...prev, ...edited })); setIsEditOverlayOpen(false); }}
        onSaveAndPrint={(edited) => { updateRequisitionForm(selectedReq.id, edited); setSelectedReq(prev => ({ ...prev, ...edited })); setIsEditOverlayOpen(false); setIsPrintDocModalOpen(true); }}
      />

      {/* Archive confirmation */}
      <ConfirmDialog
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (archiveTarget) {
            archiveRequisition(archiveTarget.id);
            setDispatchMessage(`${archiveTarget.controlNo || archiveTarget.id} moved to archive.`);
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
