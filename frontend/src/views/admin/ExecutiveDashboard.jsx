import React, { useState } from 'react';
import { 
  ArrowRight, 
  Plus, 
  Search, 
  CheckCircle, 
  XCircle, 
  Eye, 
  FileText,
  AlertTriangle,
  Clock,
  Calendar,
  Activity,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { PageHeader } from '../../components/common/PageHeader';
import { getTimeGreeting, formatTicketDate } from '../../components/common/TimeGreeting';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { JobRequestFormOverlay } from '../../components/common/JobRequestFormOverlay';
import { JobRequestPrintSheet } from '../../components/common/JobRequestPrintSheet';

export const ExecutiveDashboard = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { 
    requisitions = [], 
    totalRequisitions = 0, 
    pendingApprovals = 0, 
    ongoingWorkOrders = 0, 
    completedRepairs = 0,
    approveRequisition,
    rejectRequisition,
    addRequisition,
    users = [],
    preventiveEvents = []
  } = useData();

  const [selectedReq, setSelectedReq] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isNewReqModalOpen, setIsNewReqModalOpen] = useState(false);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [selectedTech, setSelectedTech] = useState('');
  const [assignWarn, setAssignWarn] = useState('');
  const [dispatchMessage, setDispatchMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Form state for creating a new facility requisition (same Standard/Urgent flow as faculty)
  const [newReqForm, setNewReqForm] = useState({
    title: '',
    location: 'CEA Building - Room 101',
    category: 'Electrical',
    urgency: 'Medium Risk',
    description: '',
    requestedBy: '',
    requestType: 'Standard Request',
    department: 'Planning Development and Auxiliary Services Office',
    immediateSupervisor: '',
  });
  const [isStandardOverlayOpen, setIsStandardOverlayOpen] = useState(false);
  const [createdForPrint, setCreatedForPrint] = useState(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const technicians = users.filter(u => u.role === 'Technician' || u.role === 'Maintenance');

  // Filtered recent requests (most recent first)
  const filteredRequisitions = requisitions.filter(req => {
    const matchesSearch = 
      String(req.controlNo || req.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.location && req.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (req.title && req.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = filterCategory === 'all' || (req.category && req.category.toLowerCase().includes(filterCategory.toLowerCase()));
    return matchesSearch && matchesCat;
  }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const pendingList = requisitions.filter(r => r.status === 'Pending').slice(0, 3);
  const flaggedReplacements = requisitions.filter(r => r.replacementFlag?.isFlagged);

  // Time greeting
  const now = new Date();
  const timeGreeting = getTimeGreeting(now);

  const handleOpenDetail = (req) => {
    setSelectedReq(req);
    setSelectedTech(req.assignedTo || '');
    setApprovalRemarks(req.notes || '');
    setAssignWarn('');
    setIsDetailModalOpen(true);
  };

  const handleApprove = () => {
    if (selectedReq) {
      // Standard tickets: confirm the signed hardcopy first — assignment only after receipt.
      if (selectedTech && selectedReq.requestType !== 'Urgent Request' && !selectedReq.signedFormScanUrl) {
        setAssignWarn('Confirm receipt of the fully-signed physical form first (Review & Assign → Awaiting Signatures gate) before assigning.');
        return;
      }
      const approvalSucceeded = approveRequisition(
        selectedReq.id,
        approvalRemarks || 'Approved by PDAS Director',
        selectedTech
      );
      if (approvalSucceeded && selectedTech) {
        setDispatchMessage(`${selectedReq.controlNo || selectedReq.id} approved and dispatched to ${selectedTech}.`);
      } else {
        setDispatchMessage(`${selectedReq.controlNo || selectedReq.id} approved.`);
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

  const buildScopeOfWorks = (targetCat, desc) => ({
    drawingDesign: { checked: targetCat === 'Drawing/Design', options: [], description: targetCat === 'Drawing/Design' ? desc : '', dateComplied: '' },
    physicalStructures: { checked: targetCat === 'Physical Structures', options: [], description: targetCat === 'Physical Structures' ? desc : '', dateComplied: '' },
    electrical: { checked: targetCat === 'Electrical', options: [], description: targetCat === 'Electrical' ? desc : '', dateComplied: '' },
    mechanical: { checked: targetCat === 'Mechanical', options: [], description: targetCat === 'Mechanical' ? desc : '', dateComplied: '' },
    waterSanitary: { checked: targetCat === 'Water/Sanitary', options: [], description: targetCat === 'Water/Sanitary' ? desc : '', dateComplied: '' },
    airConditioning: { checked: targetCat === 'Air Conditioning', options: [], description: targetCat === 'Air Conditioning' ? desc : '', dateComplied: '' },
  });

  const overlayDraft = () => ({
    date: new Date().toISOString().split('T')[0],
    requestedBy: newReqForm.requestedBy || currentUser?.name || '',
    department: newReqForm.department || currentUser?.department || '',
    location: newReqForm.location,
    immediateSupervisor: newReqForm.immediateSupervisor,
    contactNumber: currentUser?.phone || '',
    title: newReqForm.title,
    category: newReqForm.category,
    description: newReqForm.description,
    scopeOfWorks: buildScopeOfWorks(newReqForm.category, newReqForm.description),
    controlNo: null,
  });

  const createFromOverlay = (edited, printAfter = false) => {
    const isUrgent = newReqForm.requestType === 'Urgent Request';
    const createdRequest = addRequisition({
      title: edited.title,
      description: edited.description,
      location: edited.location,
      category: edited.category,
      urgency: newReqForm.urgency,
      requestType: newReqForm.requestType,
      isStandardFormFilled: !isUrgent,
      urgentPendingStandardForm: false,
      immediateSupervisor: edited.immediateSupervisor,
      scopeOfWorks: edited.scopeOfWorks,
      actionTaken: edited.actionTaken,
      finalAction: edited.finalAction,
      requestedBy: edited.requestedBy || currentUser?.name || 'PDAS Admin',
      requesterEmail: currentUser?.email || 'admin@isatu.edu.ph',
      requesterRole: 'Admin',
      department: edited.department,
      contactNumber: edited.contactNumber || currentUser?.phone || '',
    });
    setDispatchMessage(`${newReqForm.requestType} ${createdRequest.id} filed. Tracking PENDING — issued on Final Approval. Requester must pass the signed QF-PDAS-DC-01 hardcopy to the PDAS Office within 24 hours.`);
    setIsStandardOverlayOpen(false);
    setIsNewReqModalOpen(false);
    setNewReqForm({
      title: '',
      location: 'CEA Building - Room 101',
      category: 'Electrical',
      urgency: 'Medium Risk',
      description: '',
      requestedBy: '',
      requestType: 'Standard Request',
      department: 'Planning Development and Auxiliary Services Office',
      immediateSupervisor: '',
    });
    if (printAfter) { setCreatedForPrint(createdRequest); setIsPrintOpen(true); }
  };

  const handleCreateRequisition = (e) => {
    e.preventDefault();
    if (!newReqForm.title.trim() || !newReqForm.description.trim()) return;
    if (newReqForm.requestType === 'Urgent Request') {
      // Urgent: file straight for approval/dispatch — no full standard form up front.
      // The signed hardcopy must still reach PDAS within 24 hours.
      createFromOverlay({
        title: newReqForm.title.trim(),
        description: newReqForm.description.trim(),
        location: newReqForm.location,
        category: newReqForm.category,
        requestedBy: newReqForm.requestedBy || currentUser?.name || '',
        department: newReqForm.department || currentUser?.department || '',
        immediateSupervisor: '',
        contactNumber: currentUser?.phone || '',
        scopeOfWorks: buildScopeOfWorks(newReqForm.category, newReqForm.description.trim()),
        actionTaken: {
          endorsedDesignTeam: { checked: false },
          endorsedGSMHead: { checked: false },
          returnedToClient: { checked: false },
        },
        finalAction: { status: 'Pending', remarks: '' },
      }, false);
      return;
    }
    // Standard: review/edit every field in the Standard overlay before submit/print.
    setIsStandardOverlayOpen(true);
  };

  return (
    <div className="admin-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px', fontFamily: "'Inter', Verdana, Geneva, Tahoma, sans-serif" }}>
      
      {/* Page Header */}
      <PageHeader
        breadcrumbs={['Dashboard', 'Overview']}
        title={`${timeGreeting}, Admin`}
        action={
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => setIsNewReqModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', fontSize: '14.5px', fontWeight: '600', background: '#001f9c', color: '#ffffff', border: 'none', cursor: 'pointer' }}
          >
            <Plus size={16} />
            New Request
          </button>
        }
      />

      {/* Success Notification Banner */}
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
            fontSize: '15px',
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

      {/* 5 Stat Cards in One Horizontal Row */}
      <div className="admin-stats-grid" style={{ display: 'grid', gap: '12px' }}>
        {/* Total Requests */}
        <div 
          onClick={() => onNavigate && onNavigate('job-requests', 'all')}
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '14px 12px',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #001f9c',
            boxShadow: 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
            <span title="Total requests" style={{ flex: '1 1 auto', minWidth: 0, fontSize: '12.5px', fontWeight: '500', color: '#64748b', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>Total requests</span>
            <div style={{ width: '40px', height: '40px', flex: '0 0 40px', borderRadius: '8px', background: '#eff4ff', color: '#001f9c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={20} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', lineHeight: 1 }}>{totalRequisitions}</div>
        </div>

        {/* Pending Approval */}
        <div 
          onClick={() => onNavigate && onNavigate('job-requests', 'pending')}
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '14px 12px',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #d97706',
            boxShadow: 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
            <span title="Pending approval" style={{ flex: '1 1 auto', minWidth: 0, fontSize: '12.5px', fontWeight: '500', color: '#64748b', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>Pending approval</span>
            <div style={{ width: '40px', height: '40px', flex: '0 0 40px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', lineHeight: 1 }}>{pendingApprovals}</div>
        </div>

        {/* Ongoing Work Orders */}
        <div 
          onClick={() => onNavigate && onNavigate('job-requests', 'in-progress')}
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '14px 12px',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #4f46e5',
            boxShadow: 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
            <span title="Ongoing work orders" style={{ flex: '1 1 auto', minWidth: 0, fontSize: '12.5px', fontWeight: '500', color: '#64748b', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>Ongoing work orders</span>
            <div style={{ width: '40px', height: '40px', flex: '0 0 40px', borderRadius: '8px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', lineHeight: 1 }}>{ongoingWorkOrders}</div>
        </div>

        {/* Completed Repairs */}
        <div 
          onClick={() => onNavigate && onNavigate('job-requests', 'completed')}
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '14px 12px',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #059669',
            boxShadow: 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
            <span title="Completed repairs" style={{ flex: '1 1 auto', minWidth: 0, fontSize: '12.5px', fontWeight: '500', color: '#64748b', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>Completed repairs</span>
            <div style={{ width: '40px', height: '40px', flex: '0 0 40px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', lineHeight: 1 }}>{completedRepairs}</div>
        </div>

        {/* Replacement & Disposal */}
        <div 
          onClick={() => onNavigate && onNavigate('replacement-requests')}
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '14px 12px',
            border: '1px solid #e2e8f0',
            borderTop: '4px solid #dc2626',
            boxShadow: 'var(--shadow-subtle)',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-subtle)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
            <span title="Replacement &amp; disposal" style={{ flex: '1 1 auto', minWidth: 0, fontSize: '12.5px', fontWeight: '500', color: '#64748b', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>Replacement &amp; disposal</span>
            <div style={{ width: '40px', height: '40px', flex: '0 0 40px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', lineHeight: 1 }}>{flaggedReplacements.length}</div>
        </div>
      </div>

      {/* "Needs Your Attention" Strip (Shortcut strip when pending exists) */}
      {pendingList.length > 0 && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '14px',
          padding: '16px 20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#d97706" />
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#92400e' }}>Needs Your Attention ({pendingApprovals} Pending Approval)</span>
            </div>
            <button 
              onClick={() => onNavigate && onNavigate('job-requests', 'pending')}
              style={{ background: 'none', border: 'none', color: '#b45309', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View all pending <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingList.map(req => (
              <div 
                key={req.id} 
                style={{
                  background: '#ffffff',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  border: '1px solid #fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: '400', color: '#001f9c', fontSize: '14px' }}>{req.controlNo}</span>
                  <div style={{ fontSize: '14px', fontWeight: '400', color: '#0f172a' }}>{req.location} — {req.title}</div>
                  <UrgencyBadge urgency={req.urgency} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '400', color: '#64748b' }}>{formatTicketDate(req.date)}</span>
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(req)}
                    style={{ padding: '6px 14px', borderRadius: '6px', background: '#001f9c', color: '#ffffff', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Card: Recent Facility Requests Table */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: 'var(--shadow-subtle)' }}>
        {/* Single Toolbar Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Recent Facility Requests</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text"
                placeholder="Search tracking no, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', height: '38px', paddingLeft: '32px', paddingRight: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', background: '#f8fafc' }}
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#f8fafc', color: '#334155' }}
            >
              <option value="all">All Categories</option>
              <option value="Electrical">Electrical</option>
              <option value="Air Conditioning">Air Conditioning</option>
              <option value="Water/Sanitary">Water/Sanitary</option>
              <option value="Physical Structures">Physical Structures</option>
              <option value="Mechanical">Mechanical</option>
            </select>

            <button
              type="button"
              style={{ background: 'none', border: 'none', color: '#001f9c', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => onNavigate && onNavigate('job-requests', 'all')}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table className="table-nowrap" style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>TRACKING NO.</th>
                <th style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>LOCATION &amp; ISSUE</th>
                <th className="col-category" style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>CATEGORY</th>
                <th style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>URGENCY</th>
                <th style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>STATUS</th>
                <th style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase' }}>DATE</th>
                <th style={{ padding: '12px 14px', fontWeight: '600', color: '#475569', fontSize: '12px', textTransform: 'uppercase', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontWeight: '400' }}>
                      <ClipboardList size={32} style={{ margin: '0 auto 8px auto', color: '#94a3b8' }} />
                      <div style={{ fontWeight: '600', color: '#334155' }}>No requests yet</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Create a new request to track facility maintenance.</div>
                    </td>
                  </tr>
              ) : (
                filteredRequisitions.slice(0, 5).map(req => (
                  <tr 
                    key={req.id} 
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                    onClick={() => handleOpenDetail(req)}
                  >
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '600', color: '#001f9c', fontSize: '13px' }}>{req.controlNo}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: '500', color: '#0f172a', fontSize: '13px' }}>{req.location}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '400' }}>{req.title}</div>
                    </td>
                    <td className="col-category" style={{ padding: '12px 14px' }}><CategoryPill category={req.category} /></td>
                    <td style={{ padding: '12px 14px' }}><UrgencyBadge urgency={req.urgency} /></td>
                    <td style={{ padding: '12px 14px' }}><StatusBadge status={req.status} /></td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontWeight: '400', whiteSpace: 'nowrap' }}>{formatTicketDate(req.date)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleOpenDetail(req); }}
                        style={{ padding: '5px 10px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                      >
                        <Eye size={13} /> Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Lower Cards (NO charts): Preventive Maintenance & Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Upcoming Preventive Maintenance Card */}
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: 'var(--shadow-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#001f9c" />
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Upcoming Preventive Maintenance</h3>
            </div>
            <button 
              onClick={() => onNavigate && onNavigate('preventive-calendar')}
              style={{ background: 'none', border: 'none', color: '#001f9c', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}
            >
              View calendar →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(preventiveEvents || []).slice(0, 4).map((evt, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#0f172a' }}>{evt.assetName || evt.title || 'AC Quarterly Servicing'}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>{evt.location || 'CEA Main Bldg'}</div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: '#eff4ff', color: '#001f9c', border: '1px solid #bfdbfe' }}>
                  {formatTicketDate(evt.scheduledDate || evt.date || 'Sep 24, 2026')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Feed Card */}
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: 'var(--shadow-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Activity size={18} color="#059669" />
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Recent Activity</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', marginTop: '6px' }} />
              <div>
                <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '400' }}>Request REQ-2026-004 completed</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '400' }}>By Mark Villanueva — 25 mins ago</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#001f9c', marginTop: '6px' }} />
              <div>
                <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '400' }}>REQ-2026-003 assigned to Technician</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '400' }}>By PDAS Director — 2 hours ago</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706', marginTop: '6px' }} />
              <div>
                <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '400' }}>New request filed from CEA Bldg</div>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '400' }}>By Dr. Elena Ramos — 4 hours ago</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Request Details & Admin Decision Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Request Review: ${selectedReq?.controlNo || ''}`}
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
                    style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <XCircle size={15} /> Disapprove
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleApprove}
                    style={{ background: '#001f9c', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <CheckCircle size={15} /> Approve &amp; Dispatch
                  </button>
                </>
              )}
            </div>
          </div>
        }
      >
        {selectedReq && (
          <div>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '14px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase' }}>Tracking Number</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#001f9c' }}>{selectedReq.controlNo}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase' }}>Current Status</div>
                <div style={{ marginTop: '4px' }}><StatusBadge status={selectedReq.status} /></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase' }}>Urgency Level</div>
                <div style={{ marginTop: '4px' }}><UrgencyBadge urgency={selectedReq.urgency} /></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase' }}>Location</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{selectedReq.location}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase' }}>Category</div>
                <div style={{ marginTop: '4px' }}><CategoryPill category={selectedReq.category} /></div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Filed</div>
                <div style={{ fontSize: '13px', color: '#475569', fontWeight: '400' }}>{formatTicketDate(selectedReq.date)}</div>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: '500', color: '#334155', marginBottom: '4px' }}>
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

            {/* Technician Assignment */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '500', color: '#334155', marginBottom: '4px', display: 'block' }}>Assign Responsible Technician</label>
              <select
                className="form-select"
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
              >
                <option value="">-- Select PDAS Technician --</option>
                {technicians.map(t => (
                  <option key={t.id} value={`${t.name} (${t.title || t.role})`}>
                    {t.name} - {t.title || t.role}
                  </option>
                ))}
              </select>
              {assignWarn && (
                <div style={{ marginTop: '6px', fontSize: '12.5px', color: '#b91c1c', fontWeight: '600' }}>{assignWarn}</div>
              )}
            </div>

            {/* Director Notes */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '500', color: '#334155', marginBottom: '4px', display: 'block' }}>PDAS Director Review Remarks / Action Notes</label>
              <textarea
                className="form-textarea"
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder="Enter instructions or safety notes..."
                style={{ width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px', fontSize: '13px', minHeight: '70px' }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* New Request Modal — same Standard / Urgent flow as faculty */}
      <Modal
        isOpen={isNewReqModalOpen}
        onClose={() => setIsNewReqModalOpen(false)}
        title="File New Facility Request"
        maxWidth="640px"
      >
        <form onSubmit={handleCreateRequisition}>
          {/* Request type selector (consistent Standard / Urgent) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            {['Standard Request', 'Urgent Request'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setNewReqForm({ ...newReqForm, requestType: t, urgency: t === 'Urgent Request' ? 'High Risk' : newReqForm.urgency })}
                style={{
                  padding: '9px', borderRadius: '8px',
                  border: newReqForm.requestType === t ? '2px solid #001f9c' : '1px solid #cbd5e1',
                  background: newReqForm.requestType === t ? '#eff6ff' : '#fff',
                  fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                  color: newReqForm.requestType === t ? '#001f9c' : '#475569',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                {t === 'Urgent Request' ? <><AlertTriangle size={14} /> Urgent Request</> : <><FileText size={14} /> Standard Request</>}
              </button>
            ))}
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '500', color: '#334155', marginBottom: '4px', display: 'block' }}>Subject / Issue Summary *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Broken Water Pipe & Valve Replacement"
              value={newReqForm.title}
              onChange={(e) => setNewReqForm({ ...newReqForm, title: e.target.value })}
              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '500', color: '#334155', marginBottom: '4px', display: 'block' }}>Campus Location / Room *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Admin Hall 2nd Flr"
                value={newReqForm.location}
                onChange={(e) => setNewReqForm({ ...newReqForm, location: e.target.value })}
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '500', color: '#334155', marginBottom: '4px', display: 'block' }}>Category *</label>
              <select
                className="form-select"
                value={newReqForm.category}
                onChange={(e) => setNewReqForm({ ...newReqForm, category: e.target.value })}
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
              >
                <option value="Drawing/Design">Drawing/Design</option>
                <option value="Electrical">Electrical</option>
                <option value="Physical Structures">Physical Structures</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Water/Sanitary">Water/Sanitary</option>
                <option value="Air Conditioning">Air Conditioning</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '500', color: '#334155', marginBottom: '4px', display: 'block' }}>Urgency *</label>
              <select
                className="form-select"
                value={newReqForm.urgency}
                onChange={(e) => setNewReqForm({ ...newReqForm, urgency: e.target.value })}
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' }}
              >
                <option value="Low Risk">Low Risk</option>
                <option value="Medium Risk">Medium Risk</option>
                <option value="High Risk">High Risk</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '500', color: '#334155', marginBottom: '4px', display: 'block' }}>Requester Name</label>
              <input
                type="text"
                className="form-input"
                placeholder={currentUser?.name || 'e.g. PDAS Admin'}
                value={newReqForm.requestedBy}
                onChange={(e) => setNewReqForm({ ...newReqForm, requestedBy: e.target.value })}
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '500', color: '#334155', marginBottom: '4px', display: 'block' }}>Detailed Description *</label>
            <textarea
              className="form-textarea"
              placeholder="Describe the fault, room number, and observed hazard..."
              value={newReqForm.description}
              onChange={(e) => setNewReqForm({ ...newReqForm, description: e.target.value })}
              style={{ width: '100%', minHeight: '80px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px', fontSize: '13px' }}
              required
            />
          </div>

          {newReqForm.requestType === 'Urgent Request' && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', marginBottom: '4px', fontSize: '12.5px', color: '#92400e', lineHeight: 1.5 }}>
              <strong>Same-day requirement:</strong> the requester must pass the signed QF-PDAS-DC-01 hardcopy (wet-ink supervisor signature) to the PDAS Office <strong>within 24 hours</strong> — the request cannot advance until it is verified.
            </div>
          )}

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsNewReqModalOpen(false)}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#001f9c', color: '#ffffff', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {newReqForm.requestType === 'Urgent Request' ? <><AlertTriangle size={16} /> Submit for Approval</> : <><Plus size={16} /> Review Standard Form</>}
            </button>
          </div>
        </form>
      </Modal>

      {/* Editable Standard overlay (same as faculty — all fields editable before submit/print) */}
      <JobRequestFormOverlay
        isOpen={isStandardOverlayOpen}
        onClose={() => setIsStandardOverlayOpen(false)}
        initialReq={overlayDraft()}
        allowActionTaken
        allowFinalAction={false}
        title={`${newReqForm.requestType} (QF-PDAS-DC-01) — Review & Edit Before Submit`}
        onSave={(edited) => createFromOverlay(edited, false)}
        onSaveAndPrint={(edited) => createFromOverlay(edited, true)}
      />

      <Modal isOpen={isPrintOpen} onClose={() => setIsPrintOpen(false)} title="Print Preview — QF-PDAS-DC-01" maxWidth="800px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPrintOpen(false)}>Close</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>Print / Save PDF</button>
          </div>
        }>
        {createdForPrint && <JobRequestPrintSheet req={createdForPrint} />}
      </Modal>
      {createdForPrint && isPrintOpen && (
        <div className="jr-print-only" aria-hidden="true"><JobRequestPrintSheet req={createdForPrint} /></div>
      )}

    </div>
  );
};
