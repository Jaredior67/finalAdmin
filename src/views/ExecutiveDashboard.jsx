import React, { useState } from 'react';
import { 
  ArrowRight, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Wrench, 
  FileText,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const ExecutiveDashboard = ({ onNavigate }) => {
  const { 
    requisitions, 
    totalRequisitions, 
    pendingApprovals, 
    ongoingWorkOrders, 
    completedRepairs,
    approveRequisition,
    rejectRequisition,
    assignTechnician,
    addRequisition,
    users
  } = useData();

  const [selectedReq, setSelectedReq] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isNewReqModalOpen, setIsNewReqModalOpen] = useState(false);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [selectedTech, setSelectedTech] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Form state for creating a new facility requisition
  const [newReqForm, setNewReqForm] = useState({
    title: '',
    location: 'CEA Building - Room ',
    category: 'Electrical',
    urgency: 'Medium',
    description: '',
    requestedBy: 'Dr. Elena Ramos (Faculty)',
    requestType: 'Standard Request',
    department: 'College of Engineering & Architecture',
    pdasFormName: ''
  });

  const technicians = users.filter(u => u.role === 'Technician');

  const filteredRequisitions = requisitions.filter(req => {
    const matchesSearch = 
      req.controlNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === 'all' || req.category.toLowerCase().includes(filterCategory.toLowerCase());
    return matchesSearch && matchesCat;
  });

  const handleOpenDetail = (req) => {
    setSelectedReq(req);
    setSelectedTech(req.assignedTo || '');
    setApprovalRemarks(req.notes || '');
    setIsDetailModalOpen(true);
  };

  const handleApprove = () => {
    if (selectedReq) {
      approveRequisition(selectedReq.id, approvalRemarks || 'Approved by PDAS Director');
      if (selectedTech) {
        assignTechnician(selectedReq.id, selectedTech);
      }
      setIsDetailModalOpen(false);
    }
  };

  const handleReject = () => {
    if (selectedReq) {
      rejectRequisition(selectedReq.id, approvalRemarks || 'Disapproved by PDAS Director');
      setIsDetailModalOpen(false);
    }
  };

  const handleCreateRequisition = (e) => {
    e.preventDefault();
    if (newReqForm.requestType === 'Standard Request' && !newReqForm.pdasFormName) return;
    addRequisition({ ...newReqForm });
    setIsNewReqModalOpen(false);
    setNewReqForm({
      title: '',
      location: 'CEA Building - Room ',
      category: 'Electrical',
      urgency: 'Medium',
      description: '',
      requestedBy: 'Dr. Elena Ramos (Faculty)',
      requestType: 'Standard Request',
      department: 'College of Engineering & Architecture',
      pdasFormName: ''
    });
  };

  return (
    <div>
      {/* Page Title & Controls */}
      <div className="page-header">
        <div>
          <h1 className="page-title">PDAS Executive Dashboard</h1>
          <p className="page-subtitle">ISAT U Dumangas Campus Facility Management Overview</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => setIsNewReqModalOpen(true)}
          >
            <Plus size={16} />
            New Requisition
          </button>
        </div>
      </div>

      {/* Top KPI Cards (Matching exact screenshot) */}
      <div className="kpi-grid">
        <StatCard 
          type="total" 
          value={totalRequisitions} 
          onClick={() => onNavigate && onNavigate('job-requests', 'all')}
        />
        <StatCard 
          type="pending" 
          value={pendingApprovals} 
          onClick={() => onNavigate && onNavigate('job-requests', 'pending')}
        />
        <StatCard 
          type="ongoing" 
          value={ongoingWorkOrders} 
          onClick={() => onNavigate && onNavigate('job-requests', 'in-progress')}
        />
        <StatCard 
          type="completed" 
          value={completedRepairs} 
          onClick={() => onNavigate && onNavigate('job-requests', 'completed')}
        />
      </div>

      {/* Main Table Card (Recent Facility Requisitions) */}
      <div className="content-card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 className="card-title">Recent Facility Requisitions</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="search-input-wrapper" style={{ minWidth: '220px' }}>
              <Search size={15} className="search-input-icon" />
              <input 
                type="text"
                placeholder="Search requisitions..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '6px 12px 6px 34px', fontSize: '12.5px' }}
              />
            </div>

            <button
              type="button"
              className="card-action-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => onNavigate && onNavigate('job-requests', 'all')}
            >
              View All Requisitions
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>CONTROL NO.</th>
                <th>LOCATION</th>
                <th>CATEGORY</th>
                <th>URGENCY</th>
                <th>STATUS</th>
                <th>DATE</th>
                <th style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequisitions.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-table-state">
                      <div className="empty-state-icon">
                        <FileText size={40} />
                      </div>
                      <div style={{ fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>
                        No requisitions found
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '16px' }}>
                        Create a new facility job order to begin tracking maintenance work.
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setIsNewReqModalOpen(true)}
                      >
                        <Plus size={14} />
                        File Requisition
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequisitions.slice(0, 6).map((req) => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: '700', color: '#001f9c' }}>
                      {req.controlNo}
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      <div>{req.location}</div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{req.title}</div>
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
                    <td style={{ color: '#64748b', fontSize: '12.5px' }}>
                      {req.date}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenDetail(req)}
                        title="Review & Manage"
                      >
                        <Eye size={14} />
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Requisition Details & Admin Decision Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Requisition Review: ${selectedReq?.controlNo || ''}`}
        maxWidth="720px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Logged as: <strong>PDAS Director (Authorized Approver)</strong>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Close
              </button>
              {selectedReq?.status === 'Pending' && (
                <>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={handleReject}
                  >
                    <XCircle size={15} />
                    Disapprove
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleApprove}
                  >
                    <CheckCircle size={15} />
                    Approve & Dispatch
                  </button>
                </>
              )}
            </div>
          </div>
        }
      >
        {selectedReq && (
          <div>
            {/* Header info */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '14px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Control No</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#001f9c' }}>{selectedReq.controlNo}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Current Status</div>
                <div style={{ marginTop: '4px' }}><StatusBadge status={selectedReq.status} /></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Urgency Level</div>
                <div style={{ marginTop: '4px' }}><UrgencyBadge urgency={selectedReq.urgency} /></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Location</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{selectedReq.location}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Category</div>
                <div style={{ marginTop: '4px' }}><CategoryPill category={selectedReq.category} /></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Date Filed</div>
                <div style={{ fontSize: '13px', color: '#475569' }}>{selectedReq.date}</div>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                Job Request Title: {selectedReq.title}
              </div>
              <div style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '13.5px',
                color: '#1e293b',
                lineHeight: 1.5
              }}>
                {selectedReq.description}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
              <div>
                <label className="form-label">Requisitioner / Department</label>
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  <strong>{selectedReq.requestedBy}</strong><br />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{selectedReq.department}</span>
                </div>
              </div>
              <div>
                <label className="form-label">Request Type</label>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>{selectedReq.requestType || 'Standard Request'}</div>
              </div>
            </div>

            {/* Technician Assignment */}
            <div className="form-group">
              <label className="form-label">Assign Responsible Technician</label>
              <select
                className="form-select"
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
              >
                <option value="">-- Select PDAS Technician --</option>
                {technicians.map(t => (
                  <option key={t.id} value={`${t.name} (${t.title})`}>
                    {t.name} - {t.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Director Notes */}
            <div className="form-group">
              <label className="form-label">PDAS Director Review Remarks / Action Notes</label>
              <textarea
                className="form-textarea"
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder="Enter instructions or safety notes..."
              />
            </div>
          </div>
        )}
      </Modal>

      {/* New Requisition Modal */}
      <Modal
        isOpen={isNewReqModalOpen}
        onClose={() => setIsNewReqModalOpen(false)}
        title="File New Facility Requisition"
        maxWidth="640px"
      >
        <form onSubmit={handleCreateRequisition}>
          <div className="form-group">
            <label className="form-label">Subject / Issue Summary *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Broken Water Pipe & Valve Replacement"
              value={newReqForm.title}
              onChange={(e) => setNewReqForm({ ...newReqForm, title: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Campus Location / Room *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Admin Hall 2nd Flr"
                value={newReqForm.location}
                onChange={(e) => setNewReqForm({ ...newReqForm, location: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category *</label>
              <select
                className="form-select"
                value={newReqForm.category}
                onChange={(e) => setNewReqForm({ ...newReqForm, category: e.target.value })}
              >
                <option value="Electrical">Electrical</option>
                <option value="HVAC / Aircon">HVAC / Aircon</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Carpentry">Carpentry</option>
                <option value="IT / Network">IT / Network</option>
                <option value="General Facility">General Facility</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Request Type *</label>
              <select
                className="form-select"
                  value={newReqForm.requestType}
                  onChange={(e) => setNewReqForm({ ...newReqForm, requestType: e.target.value, urgency: e.target.value === 'Emergency Request' ? 'Emergency' : 'Medium', pdasFormName: e.target.value === 'Emergency Request' ? '' : newReqForm.pdasFormName })}
              >
                <option value="Standard Request">Standard Request</option>
                <option value="Emergency Request">Emergency Request</option>
              </select>
            </div>

          {newReqForm.requestType === 'Standard Request' && (
            <div className="form-group">
              <label className="form-label">Attach PDAS Form *</label>
              <input type="file" className="form-input" accept=".pdf,.doc,.docx,image/*" onChange={(e) => setNewReqForm({ ...newReqForm, pdasFormName: e.target.files[0]?.name || '' })} required />
            </div>
          )}

          </div>

          <div className="form-group">
            <label className="form-label">Detailed Description / Problem Specification *</label>
            <textarea
              className="form-textarea"
              placeholder="Describe the exact fault, room number, equipment model, and observed hazard..."
              value={newReqForm.description}
              onChange={(e) => setNewReqForm({ ...newReqForm, description: e.target.value })}
              required
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsNewReqModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              <Plus size={16} />
              Submit Requisition
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
