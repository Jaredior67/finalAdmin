import React, { useState } from 'react';
import { 
  Wrench, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  MapPin, 
  Phone, 
  User, 
  Send, 
  Check, 
  RotateCcw, 
  FileText, 
  AlertCircle,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
  Folder,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { CommunicationBox } from './CommunicationBox';
import { PreventiveCalendar } from './PreventiveCalendar';
import { OfficialDocuments } from './OfficialDocuments';

export const MaintenanceFieldPortal = ({ activeTab = 'tech-tasks', onTabChange }) => {
  const { currentUser } = useAuth();
  const { requisitions, updateRequisitionStatus, raiseReplacementFlag } = useData();

  const [selectedTask, setSelectedTask] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);

  const [technicianNotes, setTechnicianNotes] = useState('');
  const [targetStatus, setTargetStatus] = useState('In Progress');

  // Replacement Form State
  const [replaceForm, setReplaceForm] = useState({
    reason: 'Motor coil burnt out; internal components beyond economical repair.',
    itemSpecs: 'Heavy-Duty 3.0 HP Inverter Precision Cooling Compressor Unit',
  });

  // Filter tasks assigned to technician or all active for crew
  const myAssignedTasks = requisitions.filter(r => 
    !currentUser?.name || 
    r.assignedTo?.toLowerCase().includes(currentUser.name.toLowerCase()) || 
    r.assignedTo?.toLowerCase().includes('mark') ||
    r.assignedTo?.toLowerCase().includes('villanueva') ||
    r.status === 'In Progress' ||
    r.status === 'Pending'
  );

  const emergencyTasks = myAssignedTasks.filter(r => r.urgency === 'Emergency' || r.urgency === 'High');
  
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

  const tasksToDisplay = activeTab === 'tech-emergency' 
    ? emergencyTasks 
    : activeTab === 'tech-history' 
      ? completedTasks 
      : myAssignedTasks;

  const handleOpenAction = (task) => {
    setSelectedTask(task);
    setTargetStatus(task.status === 'Pending' ? 'In Progress' : task.status);
    setTechnicianNotes(task.notes || '');
    setIsActionModalOpen(true);
  };

  const handleOpenReplacement = (task) => {
    setSelectedTask(task);
    setIsReplaceModalOpen(true);
  };

  const handleSaveTaskStatus = () => {
    if (selectedTask) {
      updateRequisitionStatus(
        selectedTask.id, 
        targetStatus, 
        currentUser?.name || 'Mark Villanueva (Lead Technician)', 
        technicianNotes || `Work performed on-site by ${currentUser?.name || 'Maintenance Specialist'}.`
      );
      setIsActionModalOpen(false);
    }
  };

  const handleConfirmReplacement = (e) => {
    e.preventDefault();
    if (selectedTask) {
      raiseReplacementFlag(selectedTask.id, {
        reason: replaceForm.reason,
        itemSpecs: replaceForm.itemSpecs,
        flaggedBy: `${currentUser?.name || 'Mark Villanueva'} (${currentUser?.roleTitle || 'Lead Specialist'})`
      });
      setIsReplaceModalOpen(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Mobile-First Technician Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '22px 24px',
        marginBottom: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: '#d97706',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px'
          }}>
            🔧
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '17px', fontWeight: '800' }}>
                {currentUser?.name || 'Mark Villanueva'}
              </span>
              <span style={{
                background: '#d97706',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                Field Technician
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#cbd5e1', marginTop: '2px' }}>
              Specialization: <strong>{currentUser?.specialization || 'Senior Electrical & HVAC Specialist'}</strong>
            </div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
              ISAT U Dumangas PDAS Field Operations Unit
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '8px 14px',
            borderRadius: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#f59e0b' }}>
              {myAssignedTasks.filter(r => r.status !== 'Completed').length}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Active Tasks</div>
          </div>
        </div>
      </div>

      {/* Emergency / High Risk Alert Banner */}
      {emergencyTasks.length > 0 && (
        <div style={{
          background: '#fff1f2',
          border: '1.5px solid #fecdd3',
          borderRadius: '14px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <AlertCircle size={22} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#9f1239', marginBottom: '2px' }}>
              High Risk / Emergency Work Orders Requiring Field Attention ({emergencyTasks.length})
            </div>
            <div style={{ fontSize: '12.5px', color: '#be123c', lineHeight: 1.4 }}>
              Priority tickets at <strong>{emergencyTasks.map(t => t.location).join(' • ')}</strong> need immediate on-site assessment.
            </div>
          </div>
        </div>
      )}

      {/* Field Work Orders Queue */}
      <div className="content-card" style={{ padding: '24px' }}>
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h2 className="card-title">
            {activeTab === 'tech-emergency' ? `Emergency & High-Risk Priority Queue (${emergencyTasks.length})` :
             activeTab === 'tech-history' ? `Completed Maintenance Work Logs (${completedTasks.length})` :
             `Assigned Field Maintenance Work Orders (${myAssignedTasks.length})`}
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Touch-friendly interface for on-site execution, logging, and status updates
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tasksToDisplay.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              No work orders found for this queue.
            </div>
          ) : (
            tasksToDisplay.map(task => {
            const isCompleted = task.status === 'Completed';
            const isFlagged = task.replacementFlag?.isFlagged;

            return (
              <div
                key={task.id}
                style={{
                  border: task.urgency === 'Emergency' ? '2px solid #ef4444' : task.urgency === 'High' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '20px',
                  background: isCompleted ? '#f8fafc' : '#ffffff',
                  boxShadow: 'var(--shadow-subtle)',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Top Row: Control No & Urgency */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#001f9c' }}>
                      {task.controlNo}
                    </span>
                    <CategoryPill category={task.category} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UrgencyBadge urgency={task.urgency} />
                    <StatusBadge status={task.status} />
                  </div>
                </div>

                {/* Issue Title & Description */}
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                  {task.title}
                </div>
                <p style={{ fontSize: '13px', color: '#475569', marginBottom: '12px', lineHeight: 1.5 }}>
                  {task.description}
                </p>

                {/* Location & Requester Meta */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                    <MapPin size={14} color="#001f9c" />
                    <strong>Location:</strong> {task.location}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                    <User size={14} color="#001f9c" />
                    <strong>Requisitioner:</strong> {task.requestedBy}
                  </div>
                  {task.qrCodeRef && (
                    <div style={{ color: '#64748b' }}>
                      QR Tag: <code>{task.qrCodeRef}</code>
                    </div>
                  )}
                  {task.contactNumber && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: '600' }}>
                      <Phone size={12} /> {task.contactNumber}
                    </div>
                  )}
                </div>

                {/* Irreparable Replacement Flag Box */}
                {isFlagged && (
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '12px',
                    marginBottom: '14px',
                    fontSize: '12.5px',
                    color: '#991b1b'
                  }}>
                    <div style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <AlertTriangle size={15} color="#dc2626" />
                      IRREPARABLE ITEM FLAGGED FOR REPLACEMENT
                    </div>
                    <div><strong>Reason:</strong> {task.replacementFlag.reason}</div>
                    <div><strong>Recommended Replacement:</strong> {task.replacementFlag.itemSpecs}</div>
                    <div style={{ fontSize: '11px', marginTop: '4px', color: '#b91c1c' }}>
                      Status: <strong>{task.replacementFlag.procurementStatus}</strong> • Flagged by {task.replacementFlag.flaggedBy}
                    </div>
                  </div>
                )}

                {/* Technician Actions Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
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
                    {isFlagged ? 'Update Replacement Flag' : 'Flag as Irreparable (Replace Item)'}
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleOpenAction(task)}
                    >
                      <Wrench size={14} />
                      Update Status & Field Notes
                    </button>
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* Update Status & Notes Modal */}
      <Modal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        title={`Field Status Update: ${selectedTask?.controlNo || ''}`}
        maxWidth="580px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsActionModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveTaskStatus}
            >
              <Check size={16} />
              Save & Apply Status
            </button>
          </div>
        }
      >
        {selectedTask && (
          <div>
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ fontWeight: '700', color: '#0f172a' }}>{selectedTask.title}</div>
              <div style={{ color: '#64748b', fontSize: '12px' }}>{selectedTask.location}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Set Maintenance Progress Status</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setTargetStatus('Approved')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: targetStatus === 'Approved' ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                    background: targetStatus === 'Approved' ? '#eff6ff' : '#ffffff',
                    fontWeight: targetStatus === 'Approved' ? '700' : '500',
                    color: targetStatus === 'Approved' ? '#1d4ed8' : '#475569',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Acknowledge Job
                </button>
                <button
                  type="button"
                  onClick={() => setTargetStatus('In Progress')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: targetStatus === 'In Progress' ? '2px solid #001f9c' : '1px solid #cbd5e1',
                    background: targetStatus === 'In Progress' ? '#eff6ff' : '#ffffff',
                    fontWeight: targetStatus === 'In Progress' ? '700' : '500',
                    color: targetStatus === 'In Progress' ? '#001f9c' : '#475569',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Ongoing On-Site
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
                  Mark Resolved
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Technician Work Log & Materials Used</label>
              <textarea
                className="form-textarea"
                value={technicianNotes}
                onChange={(e) => setTechnicianNotes(e.target.value)}
                placeholder="Log actions taken on-site (e.g. Replaced 20A circuit breaker, recharged refrigerant to 65 PSI, tested load at 22°C)..."
                style={{ minHeight: '90px' }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Irreparable Replacement Flagger Modal */}
      <Modal
        isOpen={isReplaceModalOpen}
        onClose={() => setIsReplaceModalOpen(false)}
        title="Raise Replacement / Irreparable Item Flag"
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
                Procurement & Replacement Assessment
              </div>
              <div>
                Flagging this item informs the <strong>PDAS Director</strong> that repairing the existing unit is not feasible and initiates an official replacement request.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Why is this item irreparable? (Technical Rationale) *</label>
              <textarea
                className="form-textarea"
                value={replaceForm.reason}
                onChange={(e) => setReplaceForm({ ...replaceForm, reason: e.target.value })}
                placeholder="e.g. Motor winding insulation burned, PCB control board burnt beyond repair, parts discontinued..."
                required
              />
            </div>

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
                Submit Replacement Flag to PDAS
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
