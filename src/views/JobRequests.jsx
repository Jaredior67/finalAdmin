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
  Printer
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const JobRequests = ({ initialStatusTab = 'all' }) => {
  const { 
    requisitions, 
    approveRequisition, 
    rejectRequisition, 
    assignTechnician, 
    updateRequisitionStatus,
    updateProcurementStatus,
    users 
  } = useData();

  const [activeStatusTab, setActiveStatusTab] = useState(initialStatusTab);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReq, setSelectedReq] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [statusChoice, setStatusChoice] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [procurementChoice, setProcurementChoice] = useState('');

  // Maintenance personnel list
  const technicians = users.filter(u => 
    u.role === 'Technician' || 
    u.role === 'Maintenance' || 
    u.userType === 'Maintenance'
  );

  // Priority sorting: Emergency -> High -> Medium -> Low
  const priorityOrder = { 'Emergency': 1, 'High': 2, 'Medium': 3, 'Low': 4 };

  const filteredList = requisitions
    .filter(req => {
      const matchesTab = 
        activeStatusTab === 'all' || 
        (activeStatusTab === 'pending' && req.status === 'Pending') ||
        (activeStatusTab === 'approved' && req.status === 'Approved') ||
        (activeStatusTab === 'in-progress' && req.status === 'In Progress') ||
        (activeStatusTab === 'completed' && req.status === 'Completed') ||
        (activeStatusTab === 'flagged' && req.replacementFlag?.isFlagged);

      const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
      const matchesUrgency = urgencyFilter === 'all' || req.urgency === urgencyFilter;
      const matchesSearch = 
        req.controlNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.requestedBy.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesTab && matchesCategory && matchesUrgency && matchesSearch;
    })
    .sort((a, b) => {
      // High urgency / Emergency on top
      const pA = priorityOrder[a.urgency] || 5;
      const pB = priorityOrder[b.urgency] || 5;
      return pA - pB;
    });

  const handleOpenDetail = (req) => {
    setSelectedReq(req);
    setAssignee(req.assignedTo || '');
    setStatusChoice(req.status);
    setAdminNotes(req.notes || '');
    setProcurementChoice(req.replacementFlag?.procurementStatus || 'Pending Purchase Request (PR)');
    setIsModalOpen(true);
  };

  const handleSaveChanges = () => {
    if (selectedReq) {
      if (statusChoice !== selectedReq.status) {
        if (statusChoice === 'Approved' && selectedReq.status === 'Pending') {
          approveRequisition(selectedReq.id, adminNotes);
        } else if (statusChoice === 'Rejected' && selectedReq.status === 'Pending') {
          rejectRequisition(selectedReq.id, adminNotes);
        } else {
          updateRequisitionStatus(selectedReq.id, statusChoice, assignee, adminNotes);
        }
      }
      if (assignee !== selectedReq.assignedTo && assignee) {
        assignTechnician(selectedReq.id, assignee);
      }
      if (selectedReq.replacementFlag?.isFlagged && procurementChoice !== selectedReq.replacementFlag.procurementStatus) {
        updateProcurementStatus(selectedReq.id, procurementChoice);
      }
      setIsModalOpen(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title">Job Requests & Work Orders</h1>
            <span style={{
              background: '#eff6ff',
              color: '#001f9c',
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              Priority Dispatched Queue
            </span>
          </div>
          <p className="page-subtitle">Track, review, authorize, assign, and manage replacement procurement for facility repairs</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px', paddingBottom: '2px', overflowX: 'auto' }}>
        {[
          { id: 'all', label: 'All Requests', count: requisitions.length },
          { id: 'pending', label: 'Pending Approval', count: requisitions.filter(r => r.status === 'Pending').length },
          { id: 'approved', label: 'Approved / Queued', count: requisitions.filter(r => r.status === 'Approved').length },
          { id: 'in-progress', label: 'In Progress (On-Site)', count: requisitions.filter(r => r.status === 'In Progress').length },
          { id: 'flagged', label: '⚠️ Replacement Flagged', count: requisitions.filter(r => r.replacementFlag?.isFlagged).length },
          { id: 'completed', label: 'Completed', count: requisitions.filter(r => r.status === 'Completed').length },
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
            placeholder="Search by control no, title, location, QR tag, or requestor..."
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
          <option value="Electrical">Electrical</option>
          <option value="HVAC / Aircon">HVAC / Aircon</option>
          <option value="Plumbing">Plumbing</option>
          <option value="Carpentry">Carpentry</option>
          <option value="IT / Network">IT / Network</option>
        </select>

        <select
          className="select-filter"
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
        >
          <option value="all">All Urgency Levels</option>
          <option value="Emergency">🚨 Emergency (Immediate Hazard)</option>
          <option value="High">⚠️ High Risk</option>
          <option value="Medium">⚡ Medium</option>
          <option value="Low">🟢 Low</option>
        </select>
      </div>

      {/* Requests Table */}
      <div className="content-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>CONTROL NO.</th>
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
                  const isEmergency = req.urgency === 'Emergency';
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
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenDetail(req)}
                        >
                          <Eye size={13} />
                          Review & Assign
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
            </div>

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
                  <option value="Pending">Pending Director Review</option>
                  <option value="Approved">Approved (Queued for Work)</option>
                  <option value="In Progress">In Progress (Technician Dispatched On-Site)</option>
                  <option value="Completed">Completed / Quality Inspected</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assign Maintenance Specialist *</label>
                <select
                  className="form-select"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
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
          </div>
        )}
      </Modal>
    </div>
  );
};
