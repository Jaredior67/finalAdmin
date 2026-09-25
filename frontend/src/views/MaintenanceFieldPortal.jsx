import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  Phone, 
  User, 
  Check,
  AlertCircle,
  Zap,
  Eye,
  Printer,
  Download,
  Star,
  CheckSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { CommunicationBox } from './CommunicationBox';
import { PreventiveCalendar } from './PreventiveCalendar';
import { OfficialDocuments } from './OfficialDocuments';
import { PDASJobRequestFormDocument } from '../components/common/PDASJobRequestFormDocument';
import { PageHeader } from '../components/common/PageHeader';

export const MaintenanceFieldPortal = ({ activeTab = 'tech-tasks', onTabChange }) => {
  const { currentUser } = useAuth();
  const { requisitions, updateRequisitionStatus, updateRequisitionForm, raiseMaintenanceFlag, raiseReplacementFlag, evaluations, focusedTicketRef, setFocusedTicketRef, ticketSearch: searchTerm } = useData();

  // Deep link: a clicked notification stores its ticket ref here — open the
  // exact work order detail, then clear so it never reopens.
  useEffect(() => {
    if (!focusedTicketRef) return;
    const found = (requisitions || []).find(r =>
      r.controlNo === focusedTicketRef || r.id === focusedTicketRef || r.ticket_no === focusedTicketRef
    );
    if (found) setSelectedTaskDetail(found);
    setFocusedTicketRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTicketRef]);

  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  // Status & Work Log Form State
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [hoursSpent, setHoursSpent] = useState('');
  const [targetStatus, setTargetStatus] = useState('Ongoing');
  const [completionPhoto, setCompletionPhoto] = useState(null);
  const [maintenanceFlagType, setMaintenanceFlagType] = useState('Replacement');

  // Filter State (search text comes from the navbar global search box)
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Replacement Form State
  const [replaceForm, setReplaceForm] = useState({
    reason: 'Motor coil burnt out; internal components beyond economical repair.',
    itemSpecs: 'Heavy-Duty 3.0 HP Inverter Precision Cooling Compressor Unit',
    scheduledWork: '',
    scheduledDate: '',
    scheduledTime: ''
  });

  // Filter tasks assigned to technician or all active for crew
  const myAssignedTasks = requisitions.filter(r => 
    !r.isArchived && (
      !currentUser?.name || 
      r.assignedTo?.toLowerCase().includes(currentUser.name.toLowerCase()) || 
      r.assignedTo?.toLowerCase().includes('mark') ||
      r.assignedTo?.toLowerCase().includes('villanueva') ||
      r.status === 'Ongoing' ||
      r.status === 'In Progress' ||
      r.status === 'On Hold' ||
      r.status === 'Approved' ||
      r.status === 'Pending'
    )
  );

  const emergencyTasks = myAssignedTasks.filter(r => 
    (r.urgency === 'Urgent' || r.urgency === 'High') && r.status !== 'Completed'
  );

  const inProgressTasks = myAssignedTasks.filter(r => r.status === 'Ongoing' || r.status === 'In Progress');
  
  const completedTasks = requisitions.filter(r => 
    r.status === 'Completed' && (
      !currentUser?.name || 
      r.assignedTo?.toLowerCase().includes(currentUser.name.toLowerCase()) || 
      r.assignedTo?.toLowerCase().includes('mark') ||
      r.assignedTo?.toLowerCase().includes('villanueva')
    )
  );

  // Subview Delegation for Calendar, Docs, and Communication
  if (activeTab === 'tech-calendar') {
    return <PreventiveCalendar />;
  }

  if (activeTab === 'tech-documents') {
    return <OfficialDocuments />;
  }

  if (activeTab === 'tech-messages') {
    return <CommunicationBox />;
  }

  // Base list depending on tab
  const baseTasks = activeTab === 'tech-emergency' 
    ? emergencyTasks 
    : activeTab === 'tech-history' 
      ? completedTasks 
      : myAssignedTasks;

  // Filtered List
  const filteredTasks = baseTasks.filter(task => {
    const matchesSearch = 
      String(task.controlNo || task.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.requestedBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter;
    const matchesUrgency = urgencyFilter === 'all' || task.urgency === urgencyFilter;
    const matchesStatus = statusFilter === 'all' || task.status.toLowerCase().replace(/\s+/g, '-') === statusFilter || (statusFilter === 'ongoing' && (task.status === 'Ongoing' || task.status === 'In Progress'));
    return matchesSearch && matchesCategory && matchesUrgency && matchesStatus;
  });

  const handleOpenAction = (task) => {
    setSelectedTask(task);
    setTargetStatus(task.status === 'Pending' ? 'Ongoing' : task.status === 'In Progress' ? 'Ongoing' : task.status);
    setTechnicianNotes(task.notes || '');
    setMaterialsUsed(task.materialsUsed || '');
    setHoursSpent(task.hoursSpent || '');
    setCompletionPhoto(task.completionPhotoUrl || null);
    setIsActionModalOpen(true);
  };

  const handleQuickStartWork = (task) => {
    const techName = currentUser?.name || 'Mark Villanueva (Lead Specialist)';
    const logNote = `Technician ${techName} started on-site maintenance assessment at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    updateRequisitionStatus(task.id, 'Ongoing', techName, logNote);
    setActionMessage(`${task.controlNo || task.id} work started successfully.`);
  };

  const handleOpenReplacement = (task) => {
    setSelectedTask(task);
    setMaintenanceFlagType(task.maintenanceFlag?.type || 'Replacement');
    setReplaceForm({
      reason: task.replacementFlag?.reason || task.maintenanceFlag?.reason || 'Internal mechanical breakdown; repair costs exceed replacement threshold.',
      itemSpecs: task.replacementFlag?.itemSpecs || 'Standard ISAT U Specifications Unit',
      scheduledWork: task.maintenanceFlag?.scheduledWork || '',
      scheduledDate: task.maintenanceFlag?.scheduledDate || '',
      scheduledTime: task.maintenanceFlag?.scheduledTime || ''
    });
    setIsReplaceModalOpen(true);
  };

  const handleSaveTaskStatus = () => {
    if (selectedTask) {
      // Completed records are locked — the modal is read-only in that state.
      if (selectedTask.status === 'Completed') {
        setActionMessage(`${selectedTask.controlNo || selectedTask.id} is already Completed and locked.`);
        setIsActionModalOpen(false);
        return;
      }
      let finalNotes = technicianNotes || `Work performed on-site by ${currentUser?.name || 'Maintenance Specialist'}.`;
      if (materialsUsed) {
        finalNotes += ` [Materials: ${materialsUsed}]`;
      }
      if (hoursSpent) {
        finalNotes += ` [Time: ${hoursSpent}]`;
      }

      updateRequisitionStatus(
        selectedTask.id, 
        targetStatus, 
        currentUser?.name || 'Mark Villanueva (Lead Specialist)', 
        finalNotes
      );
      if (completionPhoto) {
        updateRequisitionForm(selectedTask.id, { completionPhotoUrl: completionPhoto });
      }
      setActionMessage(`${selectedTask.controlNo || selectedTask.id} work log saved successfully.`);
      setIsActionModalOpen(false);
    }
  };

  const handleConfirmReplacement = (e) => {
    e.preventDefault();
    if (selectedTask) {
      if (maintenanceFlagType === 'Cannot Complete' && (!replaceForm.scheduledWork.trim() || !replaceForm.scheduledDate || !replaceForm.scheduledTime)) return;
      const flaggedBy = `${currentUser?.name || 'Mark Villanueva'} (${currentUser?.roleTitle || 'Lead Specialist'})`;
      if (maintenanceFlagType === 'Replacement') {
        raiseReplacementFlag(selectedTask.id, {
          reason: replaceForm.reason,
          itemSpecs: replaceForm.itemSpecs,
          flaggedBy
        });
      } else {
        raiseMaintenanceFlag(selectedTask.id, {
          type: maintenanceFlagType,
          reason: replaceForm.reason,
          scheduledWork: replaceForm.scheduledWork,
          scheduledDate: replaceForm.scheduledDate,
          scheduledTime: replaceForm.scheduledTime,
          flaggedBy
        });
      }
      setActionMessage(`${selectedTask.controlNo || selectedTask.id} task update saved successfully.`);
      setIsReplaceModalOpen(false);
    }
  };

  // Export technician work logs to CSV
  const handleExportLogsCSV = () => {
    if (completedTasks.length === 0) return;
    const headers = ['Tracking No', 'Title', 'Location', 'Category', 'Urgency', 'Date Completed', 'Requester', 'Field Notes'];
    const rows = completedTasks.map(t => [
      `"${t.controlNo || t.id}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.location}"`,
      `"${t.category}"`,
      `"${t.urgency}"`,
      `"${t.date}"`,
      `"${t.requestedBy}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ISATU_Technician_WorkLogs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Page Header */}
      <PageHeader
        breadcrumbs={['Field Operations', activeTab === 'tech-history' ? 'Work Logs' : activeTab === 'tech-emergency' ? 'Urgent Queue' : 'Assigned Requests']}
        title={activeTab === 'tech-history' ? 'Completed Work Logs' : activeTab === 'tech-emergency' ? 'Urgent Priority Queue' : 'Assigned Field Requests'}
        description={`On-site dispatch, request updates, and technical logs. Logged as ${currentUser?.name || 'Mark Villanueva (Lead Specialist)'}`}
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', borderRadius: '8px', fontSize: '12.5px', fontWeight: '700' }}>
              ● On Duty
            </span>
          </div>
        }
      />

      {actionMessage && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage('')} style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontSize: '12px' }}>Dismiss</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #d97706', boxShadow: 'var(--shadow-subtle)', cursor: 'pointer' }} onClick={() => onTabChange && onTabChange('tech-tasks')}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Active Tasks</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#d97706', marginTop: '4px' }}>{myAssignedTasks.filter(r => r.status !== 'Completed').length}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #dc2626', boxShadow: 'var(--shadow-subtle)', cursor: 'pointer' }} onClick={() => onTabChange && onTabChange('tech-emergency')}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Urgent Queue</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#dc2626', marginTop: '4px' }}>{emergencyTasks.length}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #4f46e5', boxShadow: 'var(--shadow-subtle)' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Ongoing Repairs</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#4f46e5', marginTop: '4px' }}>{inProgressTasks.length}</div>
        </div>
        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #059669', boxShadow: 'var(--shadow-subtle)', cursor: 'pointer' }} onClick={() => onTabChange && onTabChange('tech-history')}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Resolved Logs</div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#059669', marginTop: '4px' }}>{completedTasks.length}</div>
        </div>
      </div>

      {/* 2. Urgent / High Risk Banner with Safety Protocol */}
      {emergencyTasks.length > 0 && (
        <div style={{
          background: '#fff1f2',
          border: '1.5px solid #fecdd3',
          borderRadius: '14px',
          padding: '18px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertCircle size={24} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#9f1239', marginBottom: '4px' }}>
                Critical Urgent Requests Requiring Immediate Action ({emergencyTasks.length})
              </div>
              <div style={{ fontSize: '13px', color: '#be123c', lineHeight: 1.5, marginBottom: '10px' }}>
                Priority tickets located at <strong>{emergencyTasks.map(t => t.location).join(' • ')}</strong> need immediate on-site safety mitigation.
              </div>

              {/* Safety Checklist Box */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #fecdd3',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#881337',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckSquare size={14} color="#e11d48" /> 1. Isolate breaker or valve
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckSquare size={14} color="#e11d48" /> 2. Cordon off work area
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckSquare size={14} color="#e11d48" /> 3. Notify Director on status
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Field Work Orders Container */}
      <div className="content-card" style={{ padding: '24px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '18px', fontWeight: '800' }}>
              {activeTab === 'tech-emergency' ? `Urgent & High-Risk Priority Queue (${filteredTasks.length})` :
               activeTab === 'tech-history' ? `Completed Maintenance Work Logs (${filteredTasks.length})` :
               `Assigned Field Maintenance Requests (${filteredTasks.length})`}
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Touch-friendly interface for on-site execution, parts logging, and status advance
            </span>
          </div>

          {activeTab === 'tech-history' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportLogsCSV}
            >
              <Download size={14} /> Export Logs (CSV)
            </button>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          paddingBottom: '16px',
          marginBottom: '16px',
          borderBottom: '1px solid #f1f5f9',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ height: '38px', fontSize: '12.5px', minWidth: '130px' }}
            >
              <option value="all">All Categories</option>
              <option value="Electrical">Electrical</option>
              <option value="Air Conditioning">Air Conditioning</option>
              <option value="Water/Sanitary">Water/Sanitary</option>
              <option value="Physical Structures">Physical Structures</option>
              <option value="Mechanical">Mechanical</option>
            </select>

            <select
              className="form-select"
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              style={{ height: '38px', fontSize: '12.5px', minWidth: '120px' }}
            >
              <option value="all">All Urgencies</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: '38px', fontSize: '12.5px', minWidth: '120px' }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="ongoing">Ongoing</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Work Order Cards Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
              <Wrench size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>No requests found in this queue</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                Adjust your search or filter parameters to view other tasks.
              </div>
            </div>
          ) : (
            filteredTasks.map(task => {
              const isCompleted = task.status === 'Completed';
              const isFlagged = task.replacementFlag?.isFlagged || task.maintenanceFlag?.type;

              return (
                <div
                  key={task.id}
                  style={{
                    border: task.urgency === 'Urgent' ? '2px solid #ef4444' : task.urgency === 'High' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '20px',
                    background: isCompleted ? '#f8fafc' : '#ffffff',
                    boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.06)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Top Row: Control No, Urgency, Category, Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#001f9c' }}>
                        {task.controlNo || task.id}
                      </span>
                      <CategoryPill category={task.category} />
                      {task.urgency === 'Urgent' && (
                        <span style={{
                          background: '#fee2e2',
                          color: '#dc2626',
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <Zap size={11} /> 1-2h SLA Target
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <UrgencyBadge urgency={task.urgency} />
                      <StatusBadge status={task.status} />
                    </div>
                  </div>

                  {/* Issue Title & Description */}
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                    {task.title}
                  </div>
                  <p style={{ fontSize: '13px', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
                    {task.description}
                  </p>

                  {/* Location & Requester Meta Box */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '14px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '10px',
                    fontSize: '12.5px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                      <MapPin size={15} color="#001f9c" style={{ flexShrink: 0 }} />
                      <span><strong>Location:</strong> {task.location}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                      <User size={15} color="#001f9c" style={{ flexShrink: 0 }} />
                      <span><strong>Requester:</strong> {task.requestedBy}</span>
                    </div>

                    {task.qrCodeRef && (
                      <div style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b' }}>QR:</span>
                        <code style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', fontSize: '11.5px', color: '#0f172a' }}>
                          {task.qrCodeRef}
                        </code>
                      </div>
                    )}

                    {task.contactNumber && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Phone size={13} color="#059669" />
                        <a href={`tel:${task.contactNumber}`} style={{ color: '#059669', fontWeight: '700', textDecoration: 'none' }}>
                          {task.contactNumber}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Irreparable / Replacement Flag Box */}
                  {isFlagged && (
                    <div style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      marginBottom: '14px',
                      fontSize: '12.5px',
                      color: '#991b1b'
                    }}>
                      <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <AlertTriangle size={15} color="#dc2626" />
                        {task.maintenanceFlag?.type || 'Replacement'} STATUS FLAGGED
                      </div>
                      <div><strong>Reason:</strong> {task.maintenanceFlag?.reason || task.replacementFlag?.reason}</div>
                      {(task.maintenanceFlag?.type === 'Replacement' || task.replacementFlag?.isFlagged) && (
                        <div><strong>Recommended Unit:</strong> {task.replacementFlag?.itemSpecs}</div>
                      )}
                      {task.maintenanceFlag?.type === 'Cannot Complete' && (
                        <div style={{ marginTop: '6px' }}>
                          <strong>Proposed follow-up:</strong> {task.maintenanceFlag.scheduledWork} on {task.maintenanceFlag.scheduledDate} at {task.maintenanceFlag.scheduledTime}
                        </div>
                      )}
                      <div style={{ fontSize: '11.5px', marginTop: '4px', color: '#b91c1c' }}>
                        Flagged by: {task.maintenanceFlag?.flaggedBy || task.replacementFlag?.flaggedBy}
                      </div>
                    </div>
                  )}

                  {/* Technician Notes & Materials if recorded */}
                  {task.notes && (
                    <div style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      fontSize: '12.5px',
                      color: '#1e40af'
                    }}>
                      <strong>Field Work Log:</strong> {task.notes}
                    </div>
                  )}

                  {/* Requester ISO 25010 Evaluation Score if available */}
                  {isCompleted && (() => {
                    const evalData = evaluations.find(e => e.reqId === task.id || e.controlNo === task.controlNo);
                    if (!evalData) return null;
                    const scores = [evalData.functionalSuitability, evalData.usability, evalData.reliability, evalData.performanceEfficiency].filter(Boolean);
                    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '5.0';
                    return (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#047857',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        marginBottom: '14px'
                      }}>
                        <Star size={13} fill="#047857" /> Requester Evaluation Score: {avg} / 5.0 (ISO/IEC 25010)
                      </div>
                    );
                  })()}

                  {/* Action Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenReplacement(task)}
                        style={{
                          background: 'none',
                          border: '1px solid #fca5a5',
                          color: '#b91c1c',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <AlertTriangle size={14} />
                        {isFlagged ? 'Update Status Flag' : 'Flag Maintenance Outcome'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedTaskDetail(task)}
                      >
                        <Eye size={13} /> View Ticket & Photo
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {/* One-click Start Work Button if not yet In Progress */}
                      {!isCompleted && task.status !== 'Ongoing' && task.status !== 'In Progress' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleQuickStartWork(task)}
                          style={{ borderColor: '#3b82f6', color: '#1d4ed8', fontWeight: '700' }}
                        >
                          <Zap size={13} /> Start Work On-Site
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenAction(task)}
                      >
                        <Wrench size={14} />
                        {isCompleted ? 'View Work Log' : 'Update Status & Log Parts'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Update Status & Parts Log Modal */}
      <Modal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        title={`Field Status & Labor Log: ${selectedTask?.controlNo || ''}`}
        maxWidth="600px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsActionModalOpen(false)}
            >
              {selectedTask?.status === 'Completed' ? 'Close' : 'Cancel'}
            </button>
            {selectedTask?.status !== 'Completed' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveTaskStatus}
            >
              <Check size={16} />
              Save & Apply Status
            </button>
            )}
          </div>
        }
      >
        {selectedTask && (
          <div>
            {selectedTask.status === 'Completed' && (
              <div role="note" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12.5px', color: '#475569' }}>
                🔒 This work log is <strong>Completed and locked</strong> — it can no longer be edited, preserving the service record.
              </div>
            )}
            <fieldset disabled={selectedTask.status === 'Completed'} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: '700', color: '#0f172a' }}>{selectedTask.title}</div>
              <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>{selectedTask.location}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Set Maintenance Progress Status *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTargetStatus('Ongoing')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: targetStatus === 'Ongoing' ? '2px solid #001f9c' : '1px solid #cbd5e1',
                    background: targetStatus === 'Ongoing' ? '#eff6ff' : '#ffffff',
                    fontWeight: targetStatus === 'Ongoing' ? '700' : '500',
                    color: targetStatus === 'Ongoing' ? '#001f9c' : '#475569',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Ongoing
                </button>
                <button
                  type="button"
                  onClick={() => setTargetStatus('On Hold')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: targetStatus === 'On Hold' ? '2px solid #ea580c' : '1px solid #cbd5e1',
                    background: targetStatus === 'On Hold' ? '#fff7ed' : '#ffffff',
                    fontWeight: targetStatus === 'On Hold' ? '700' : '500',
                    color: targetStatus === 'On Hold' ? '#c2410c' : '#475569',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  On Hold
                </button>
                <button
                  type="button"
                  onClick={() => setTargetStatus('Completed')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: targetStatus === 'Completed' ? '2px solid #059669' : '1px solid #cbd5e1',
                    background: targetStatus === 'Completed' ? '#ecfdf5' : '#ffffff',
                    fontWeight: targetStatus === 'Completed' ? '700' : '500',
                    color: targetStatus === 'Completed' ? '#047857' : '#475569',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Completed
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Materials & Parts Used</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 20A Breaker, Teflon Tape, R410A..."
                  value={materialsUsed}
                  onChange={(e) => setMaterialsUsed(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hours Spent On-Site</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 1.5 hrs"
                  value={hoursSpent}
                  onChange={(e) => setHoursSpent(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Technician Work Log & Actions Taken *</label>
              <textarea
                className="form-textarea"
                value={technicianNotes}
                onChange={(e) => setTechnicianNotes(e.target.value)}
                placeholder="Log actions taken on-site (e.g. Replaced defective 20A breaker, cleared shorted wire at junction box, tested load at 220V)..."
                style={{ minHeight: '95px' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Completion Photo (optional)</label>
              {completionPhoto ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={completionPhoto} alt="Completed work" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCompletionPhoto(null)}>Remove</button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  className="form-input"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setCompletionPhoto(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ fontSize: '12.5px' }}
                />
              )}
            </div>
            </fieldset>
          </div>
        )}
      </Modal>

      {/* Irreparable / Maintenance Outcome Flagger Modal */}
      <Modal
        isOpen={isReplaceModalOpen}
        onClose={() => setIsReplaceModalOpen(false)}
        title="Flag Maintenance Outcome"
        maxWidth="600px"
      >
        {selectedTask && (
          <form onSubmit={handleConfirmReplacement}>
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '16px',
              color: '#991b1b',
              fontSize: '13px'
            }}>
              <div style={{ fontWeight: '800', marginBottom: '2px' }}>
                Maintenance Outcome Assessment
              </div>
              <div>
                This status flag notifies the <strong>PDAS Director</strong> of the field outcome and triggers the official procurement pipeline if replacement is needed.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Maintenance Outcome *</label>
              <select
                className="form-select"
                value={maintenanceFlagType}
                onChange={(e) => setMaintenanceFlagType(e.target.value)}
              >
                <option value="Replacement">For Replacement (Burnt / Irreparable Equipment)</option>
                <option value="Disposal">For Disposal (Condemned Facility Asset)</option>
                <option value="Cannot Complete">Request Cannot Be Done (Requires External Contractor)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Technical Rationale / Field Notes *</label>
              <textarea
                className="form-textarea"
                value={replaceForm.reason}
                onChange={(e) => setReplaceForm({ ...replaceForm, reason: e.target.value })}
                placeholder="e.g. Motor winding insulation burned, PCB control board burnt beyond repair, parts discontinued..."
                required
              />
            </div>

            {maintenanceFlagType === 'Replacement' && (
              <div className="form-group">
                <label className="form-label">Recommended Replacement Unit / Specification *</label>
                <input
                  type="text"
                  className="form-input"
                  value={replaceForm.itemSpecs}
                  onChange={(e) => setReplaceForm({ ...replaceForm, itemSpecs: e.target.value })}
                  placeholder="e.g. 3.0 HP Inverter Precision Compressor Unit (R410A compliant)"
                  required
                />
              </div>
            )}

            {maintenanceFlagType === 'Cannot Complete' && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px', marginTop: '12px' }}>
                <div style={{ fontSize: '12px', color: '#9a3412', marginBottom: '10px' }}>
                  Provide the proposed work and schedule so PDAS can coordinate the next action.
                </div>
                <div className="form-group">
                  <label className="form-label">What work should be scheduled? *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={replaceForm.scheduledWork}
                    onChange={(e) => setReplaceForm({ ...replaceForm, scheduledWork: e.target.value })}
                    placeholder="e.g. External contractor inspection and compressor replacement"
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Proposed date *</label>
                    <input type="date" className="form-input" value={replaceForm.scheduledDate} onChange={(e) => setReplaceForm({ ...replaceForm, scheduledDate: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Proposed time *</label>
                    <input type="time" className="form-input" value={replaceForm.scheduledTime} onChange={(e) => setReplaceForm({ ...replaceForm, scheduledTime: e.target.value })} required />
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsReplaceModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
              >
                <AlertTriangle size={15} />
                Submit Status Flag to Director
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Full Task Details & Photo Preview Modal */}
      <Modal
        isOpen={Boolean(selectedTaskDetail)}
        onClose={() => setSelectedTaskDetail(null)}
        title={`Request Details: ${selectedTaskDetail?.controlNo || ''}`}
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedTaskDetail(null)}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setSelectedTask(selectedTaskDetail);
                setIsPrintModalOpen(true);
              }}
            >
              <Printer size={14} /> Print Request Slip
            </button>
          </div>
        }
      >
        {selectedTaskDetail && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Subject:</span>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>{selectedTaskDetail.title}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Facility Location:</span>
                <div style={{ fontWeight: '600', color: '#0f172a' }}>{selectedTaskDetail.location}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Category:</span>
                <div><CategoryPill category={selectedTaskDetail.category} /></div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Urgency Level:</span>
                <div><UrgencyBadge urgency={selectedTaskDetail.urgency} /></div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Requester:</span>
                <div style={{ fontWeight: '600', color: '#001f9c' }}>{selectedTaskDetail.requestedBy} ({selectedTaskDetail.department})</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Contact Number:</span>
                <div>
                  <a href={`tel:${selectedTaskDetail.contactNumber}`} style={{ color: '#059669', fontWeight: '700' }}>
                    {selectedTaskDetail.contactNumber || 'N/A'}
                  </a>
                </div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                Problem Description from Requester:
              </div>
              <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.5 }}>
                {selectedTaskDetail.description}
              </div>
            </div>

            {selectedTaskDetail.photoUrl && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Faculty Attached Defect Photo:
                </div>
                <img
                  src={selectedTaskDetail.photoUrl}
                  alt="Defect visual evidence"
                  style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>
            )}

            {selectedTaskDetail.completionPhotoUrl && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Completion Photo (Technician):
                </div>
                <img
                  src={selectedTaskDetail.completionPhotoUrl}
                  alt="Completed work evidence"
                  style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Official QF-PDAS-DC-01 Document Print Modal */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Official PDAS Job Request Form (QF-PDAS-DC-01)"
        maxWidth="760px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ISAT U Dumangas Quality Management System (ISO 9001:2015 Compliant)
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => window.print()}
            >
              <Printer size={15} /> Print / Save PDF
            </button>
          </div>
        }
      >
        {selectedTask && (
          <PDASJobRequestFormDocument req={selectedTask} />
        )}
      </Modal>
    </div>
  );
};
