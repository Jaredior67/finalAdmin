import React from 'react';
import {
  Check,
  AlertTriangle,
  Eye,
  Printer,
  Phone,
  MapPin,
  User,
  Users
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { LimitedTextArea } from '../common/LimitedTextArea';
import { CategoryPill, UrgencyBadge } from '../common/StatusBadge';
import { PDASJobRequestFormDocument } from '../common/PDASJobRequestFormDocument';

/* ==========================================================================
   Every dialog the work queue can open, in one place:
     1. Status & labor log (update status, materials, hours, photo)
     2. Maintenance outcome flag (replacement / disposal / cannot complete)
     3. Full ticket detail + defect / completion photos
     4. Printable QF-PDAS-DC-01 request form
   ========================================================================== */

/* border = the solid --status-* token, bg and text = the badge rule for the
   same status, so choosing a target looks exactly like the badge it will wear.
   Ongoing and Completed had drifted onto the wrong blue and the wrong green. */
const STATUS_TARGETS = [
  { value: 'Ongoing', border: '#6366f1', bg: '#eef2ff', text: '#4f46e5' },
  { value: 'On Hold', border: '#ea580c', bg: '#fff7ed', text: '#c2410c' },
  { value: 'Completed', border: '#10b981', bg: '#ecfdf5', text: '#047857' }
];

export const WorkOrderDialogs = ({
  task,
  dialog, // null | 'status' | 'flag' | 'detail' | 'print'
  onClose,

  // status & labor log
  targetStatus,
  onTargetStatusChange,
  technicianNotes,
  onTechnicianNotesChange,
  completionPhoto,
  onCompletionPhotoChange,
  onSaveStatus,

  // maintenance outcome flag
  flagType,
  onFlagTypeChange,
  flagForm,
  onFlagFormChange,
  onSubmitFlag
}) => {
  if (!task) return null;
  const isCompleted = task.status === 'Completed';

  return (
    <>
      {/* ---------- 1. Status & labor log ---------- */}
      <Modal
        isOpen={dialog === 'status'}
        onClose={onClose}
        onBack={onClose}
        title={`Field Status & Labor Log: ${task.controlNo || ''}`}
        maxWidth="600px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {isCompleted ? 'Close' : 'Cancel'}
            </button>
            {!isCompleted && (
              <button type="button" className="btn btn-primary" onClick={onSaveStatus}>
                <Check size={16} /> Save &amp; Apply Status
              </button>
            )}
          </div>
        }
      >
        {isCompleted && (
          <div
            role="note"
            style={{
              background: 'var(--bg-sunken)',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '14px',
              fontSize: '12.5px',
              color: '#475569'
            }}
          >
            This work log is completed. It cannot be edited.
          </div>
        )}

        <div
          style={{
            background: 'var(--bg-sunken)',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '13px',
            border: '1px solid #e2e8f0'
          }}
        >
          <div style={{ fontWeight: '700', color: '#0f172a' }}>{task.title}</div>
          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>{task.location}</div>
        </div>

        <fieldset disabled={isCompleted} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-group">
            <label className="form-label">Set Maintenance Progress Status *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {STATUS_TARGETS.map((s) => {
                const isSelected = targetStatus === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => onTargetStatusChange(s.value)}
                    aria-pressed={isSelected}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: isSelected ? `2px solid ${s.border}` : '1px solid #cbd5e1',
                      background: isSelected ? s.bg : '#ffffff',
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? s.text : '#475569',
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                  >
                    {s.value}
                  </button>
                );
              })}
            </div>
          </div>


          <div className="form-group">
            <LimitedTextArea
              id="log-notes"
              label="Technician Work Log & Actions Taken"
              required
              rows={3}
              value={technicianNotes}
              onChange={onTechnicianNotesChange}
              placeholder="Log actions taken on-site (e.g. Replaced defective 20A breaker, cleared shorted wire at junction box, tested load at 220V)…"
              style={{ minHeight: '95px' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="log-photo">
              Completion Photo (optional)
            </label>
            {completionPhoto ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={completionPhoto}
                  alt="Completed work"
                  style={{
                    width: '72px',
                    height: '72px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onCompletionPhotoChange(null)}
                >
                  Remove
                </button>
              </div>
            ) : (
              <input
                id="log-photo"
                type="file"
                accept="image/*"
                className="form-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = () => onCompletionPhotoChange(reader.result);
                  reader.readAsDataURL(file);
                }}
                style={{ fontSize: '12.5px' }}
              />
            )}
          </div>
        </fieldset>
      </Modal>

      {/* ---------- 2. Maintenance outcome flag ---------- */}
      <Modal
        isOpen={dialog === 'flag'}
        onClose={onClose}
        onBack={onClose}
        title="Flag Maintenance Outcome"
        maxWidth="600px"
      >
        <form onSubmit={onSubmitFlag}>
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '16px',
              color: '#991b1b',
              fontSize: '13px'
            }}
          >
            <div style={{ fontWeight: '800', marginBottom: '2px' }}>Maintenance Outcome Assessment</div>
            <div>
              This status flag notifies the <strong>PDAS Director</strong> of the field outcome and
              starts the procurement process if replacement is needed.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="flag-type">
              Maintenance Outcome *
            </label>
            <select
              id="flag-type"
              className="form-select"
              value={flagType}
              onChange={(e) => onFlagTypeChange(e.target.value)}
            >
              <option value="Replacement">For Replacement (Burnt / Irreparable Equipment)</option>
              <option value="Disposal">For Disposal (Condemned Facility Asset)</option>
              <option value="Cannot Complete">Request Cannot Be Done (Requires External Contractor)</option>
            </select>
          </div>

          <div className="form-group">
            <LimitedTextArea
              id="flag-reason"
              label="Technical Rationale / Field Notes"
              required
              rows={3}
              value={flagForm.reason}
              onChange={(v) => onFlagFormChange({ ...flagForm, reason: v })}
              placeholder="e.g. Motor winding insulation burned, PCB control board burnt beyond repair, parts discontinued…"
            />
          </div>

          {flagType === 'Replacement' && (
            <div className="form-group">
              <label className="form-label" htmlFor="flag-specs">
                Recommended Replacement Unit / Specification *
              </label>
              <input
                id="flag-specs"
                type="text"
                className="form-input"
                value={flagForm.itemSpecs}
                onChange={(e) => onFlagFormChange({ ...flagForm, itemSpecs: e.target.value })}
                placeholder="e.g. 3.0 HP Inverter Precision Compressor Unit (R410A compliant)"
                required
              />
            </div>
          )}

          {flagType === 'Cannot Complete' && (
            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '12px'
              }}
            >
              <div style={{ fontSize: '12px', color: '#9a3412', marginBottom: '10px' }}>
                Provide the proposed work and schedule so PDAS can coordinate the next action.
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="flag-work">
                  What work should be scheduled? *
                </label>
                <input
                  id="flag-work"
                  type="text"
                  className="form-input"
                  value={flagForm.scheduledWork}
                  onChange={(e) => onFlagFormChange({ ...flagForm, scheduledWork: e.target.value })}
                  placeholder="e.g. External contractor inspection and compressor replacement"
                  required
                />
              </div>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="flag-date">
                    Proposed date *
                  </label>
                  <input
                    id="flag-date"
                    type="date"
                    className="form-input"
                    value={flagForm.scheduledDate}
                    onChange={(e) => onFlagFormChange({ ...flagForm, scheduledDate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="flag-time">
                    Proposed time *
                  </label>
                  <input
                    id="flag-time"
                    type="time"
                    className="form-input"
                    value={flagForm.scheduledTime}
                    onChange={(e) => onFlagFormChange({ ...flagForm, scheduledTime: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger">
              <AlertTriangle size={15} /> Submit Status Flag to Director
            </button>
          </div>
        </form>
      </Modal>

      {/* ---------- 3. Full ticket detail ---------- */}
      <Modal
        isOpen={dialog === 'detail'}
        onClose={onClose}
        onBack={onClose}
        title={`Request Details: ${task.controlNo || ''}`}
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onClose('print')}
            >
              <Printer size={14} /> Print Request Slip
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Subject:</span>
            <div style={{ fontWeight: '700', color: '#0f172a' }}>{task.title}</div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Facility Location:</span>
            <div style={{ fontWeight: '600', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <MapPin size={13} color="#001f9c" /> {task.location}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Category:</span>
            <div>
              <CategoryPill category={task.category} />
            </div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Urgency Level:</span>
            <div>
              <UrgencyBadge urgency={task.urgency} />
            </div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Requester:</span>
            <div style={{ fontWeight: '600', color: '#001f9c', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <User size={13} /> {task.requestedBy} ({task.department})
            </div>
          </div>
          {task.assignedTo && (
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Assigned To:</span>
              <div style={{ fontWeight: '600', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Users size={13} /> {task.assignedTo}
              </div>
            </div>
          )}
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Contact Number:</span>
            <div>
              <a href={`tel:${task.contactNumber}`} style={{ color: '#059669', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Phone size={12} /> {task.contactNumber || 'N/A'}
              </a>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-sunken)', padding: '14px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
            Problem Description from Requester:
          </div>
          <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.5 }}>{task.description}</div>
        </div>

        {task.photoUrl && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
              <Eye size={12} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
              Faculty Attached Defect Photo:
            </div>
            <img
              src={task.photoUrl}
              alt="Defect visual evidence"
              style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </div>
        )}

        {task.completionPhotoUrl && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
              Completion Photo (Technician):
            </div>
            <img
              src={task.completionPhotoUrl}
              alt="Completed work evidence"
              style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }}
            />
          </div>
        )}
      </Modal>

      {/* ---------- 4. Printable QF-PDAS-DC-01 form ---------- */}
      <Modal
        isOpen={dialog === 'print'}
        onClose={onClose}
        onBack={onClose}
        title="Official PDAS Job Request Form (QF-PDAS-DC-01)"
        maxWidth="760px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ISAT U Dumangas Quality Management System (ISO 9001:2015 Compliant)
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              <Printer size={15} /> Print / Save PDF
            </button>
          </div>
        }
      >
        <PDASJobRequestFormDocument req={task} />
      </Modal>
    </>
  );
};
