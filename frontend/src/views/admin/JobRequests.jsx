import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Eye,
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
import { Pagination } from '../../components/ui/Pagination';

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
    ticketSearch: searchTerm
  } = useData();

  // Deep link: a clicked notification stores its ticket ref here — open the
  // exact record, then clear so it never reopens.
  useEffect(() => {
    if (!focusedTicketRef) return;
    const found = (requisitions || []).find(r =>
      r.controlNo === focusedTicketRef || r.id === focusedTicketRef || r.ticket_no === focusedTicketRef
    );
    if (found) handleOpenDetail(found);
    setFocusedTicketRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTicketRef]);

  // Signature gate state
  const [signaturesConfirmed, setSignaturesConfirmed] = useState(false);
  const [scanUrl, setScanUrl] = useState('');

  const [activeStatusTab, setActiveStatusTab] = useState(initialStatusTab);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(1);
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

  // Reset to first page whenever the result set changes
  useEffect(() => { setPage(1); }, [searchTerm, categoryFilter, urgencyFilter, activeStatusTab, pageSize]);

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

  const sortedList = sortKey
    ? [...filteredList].sort((a, b) => {
        const vA = sortValue(a, sortKey);
        const vB = sortValue(b, sortKey);
        if (typeof vA === 'number') return (vA - vB) * sortDir;
        return String(vA).localeCompare(String(vB)) * sortDir;
      })
    : filteredList;

  const totalPages = Math.max(1, Math.ceil(sortedList.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedList = sortedList.slice((safePage - 1) * pageSize, safePage * pageSize);

  const sortArrow = (key) => (sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : '');
  const sortThStyle = { cursor: 'pointer', userSelect: 'none' };

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
          const statusUpdated = updateRequisitionStatus(selectedReq.id, statusChoice, assignee, adminNotes);
          if (!statusUpdated) {
            setAssignWarn(`Cannot move a ticket from "${selectedReq.status}" to "${statusChoice}". Completed records are locked and tickets never return to Pending.`);
            return;
          }
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

      {/* Filters Bar (search lives in the top navbar) */}
      <div className="filter-bar">
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
                <th scope="col" onClick={() => toggleSort('tracking')} style={sortThStyle} title="Sort by tracking number">TRACKING NUMBER{sortArrow('tracking')}</th>
                <th scope="col">ISSUE & LOCATION</th>
                <th scope="col">REQUESTER</th>
                <th scope="col">CATEGORY</th>
                <th scope="col" onClick={() => toggleSort('urgency')} style={sortThStyle} title="Sort by urgency">URGENCY{sortArrow('urgency')}</th>
                <th scope="col" onClick={() => toggleSort('status')} style={sortThStyle} title="Sort by status">STATUS{sortArrow('status')}</th>
                <th scope="col">ASSIGNED TECHNICIAN</th>
                <th scope="col" style={{ textAlign: 'right' }}>ACTIONS</th>
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
                pagedList.map(req => {
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
        <div style={{ padding: '0 20px 16px 20px' }}>
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

      {/* Manage Request Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Request Review & Dispatch: ${selectedReq?.controlNo || ''}`}
        maxWidth="1240px"
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
          <div className="decision-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: '20px', alignItems: 'start' }}>
            {/* Left column: review + assign controls (functions unchanged) */}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
                <span><strong>Requester:</strong> {selectedReq.requestedBy} ({selectedReq.department})</span>
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
                    <strong>🚨 Urgent Request Dispatch Authorized:</strong> Urgent requests dispatch immediately; the signed QF-PDAS-DC-01 hardcopy must reach the PDAS Office within 24 hours, and the request cannot advance until it is verified.
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
                  The printed <strong>QF-PDAS-DC-01</strong> form must be signed physically in wet ink by the <strong>Requester</strong> and <strong>Immediate Supervisor</strong>, then submitted to the PDAS Office before this ticket can advance to <strong>Approved</strong> and dispatched to maintenance.
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
                placeholder="Add specific instructions for technician, safety protocols, or requester feedback..."
                style={{ minHeight: '80px' }}
              />
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
            {/* Right column: live QF-PDAS-DC-01 preview (read-only, updates as you review) */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live QF-PDAS-DC-01 Preview
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#001f9c', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '9999px', padding: '3px 10px' }}>
                  {selectedReq.controlNo || selectedReq.id} • {statusChoice || selectedReq.status}
                </span>
              </div>
              <div style={{ maxHeight: '640px', overflow: 'auto', padding: '20px', background: '#ffffff' }}>
                <JobRequestPrintSheet req={{ ...selectedReq, status: statusChoice || selectedReq.status, assignedTo: assignee || selectedReq.assignedTo, notes: adminNotes }} />
              </div>
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
