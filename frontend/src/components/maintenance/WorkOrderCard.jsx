import React from 'react';
import {
  MapPin,
  Phone,
  User,
  Users,
  Zap,
  Star,
  Eye,
  AlertTriangle,
  Wrench
} from 'lucide-react';
import { StatusBadge, UrgencyBadge, CategoryPill } from '../common/StatusBadge';

/* ==========================================================================
   A single work order row in the queue.
   The same card serves every queue view — only the surrounding data set and
   the enabled actions change — so the layout stays identical everywhere.
   ========================================================================== */
export const WorkOrderCard = ({
  task,
  evaluationScore,
  onStartWork,
  onUpdateStatus,
  onFlagOutcome,
  onViewTicket
}) => {
  const isCompleted = task.status === 'Completed';
  const isFlagged = Boolean(task.replacementFlag?.isFlagged || task.maintenanceFlag?.type);
  const canStart = !isCompleted && task.status !== 'Ongoing' && task.status !== 'In Progress';

  const cardClass = [
    'wo-card',
    task.urgency === 'Urgent' ? 'wo-card--urgent' : '',
    task.urgency === 'High' ? 'wo-card--high' : '',
    isCompleted ? 'wo-card--locked' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClass}>
      {/* Reference + badges */}
      <div className="wo-card__top">
        <div className="wo-card__ref">
          <span className="wo-card__control-no">{task.controlNo || task.id}</span>
          <CategoryPill category={task.category} />
          {task.urgency === 'Urgent' && (
            <span className="wo-card__sla">
              <Zap size={11} aria-hidden="true" /> 2h Response SLA
            </span>
          )}
        </div>
        <div className="wo-card__badges">
          <UrgencyBadge urgency={task.urgency} />
          <StatusBadge status={task.status} />
        </div>
      </div>

      {/* Issue */}
      <h3 className="wo-card__title">{task.title}</h3>
      <p className="wo-card__desc">{task.description}</p>

      {/* Location / requester / assignment meta */}
      <div className="wo-card__meta">
        <div className="wo-card__meta-item">
          <MapPin size={14} aria-hidden="true" />
          <span>
            <strong>Location:</strong> {task.location}
          </span>
        </div>

        <div className="wo-card__meta-item">
          <User size={14} aria-hidden="true" />
          <span>
            <strong>Requester:</strong> {task.requestedBy}
          </span>
        </div>

        {task.assignedTo && (
          <div className="wo-card__meta-item">
            <Users size={14} aria-hidden="true" />
            <span>
              <strong>Assigned:</strong> {task.assignedTo}
            </span>
          </div>
        )}

        {task.qrCodeRef && (
          <div className="wo-card__meta-item" style={{ color: 'var(--text-secondary)' }}>
            <span>
              <strong style={{ color: 'var(--text-light)', fontSize: '11px', textTransform: 'uppercase' }}>QR:</strong>{' '}
              <code
                style={{
                  background: '#e2e8f0',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  color: 'var(--text-primary)'
                }}
              >
                {task.qrCodeRef}
              </code>
            </span>
          </div>
        )}

        {task.contactNumber && (
          <div className="wo-card__meta-item">
            <Phone size={13} style={{ color: '#059669' }} aria-hidden="true" />
            <a
              href={`tel:${task.contactNumber}`}
              style={{ color: '#059669', fontWeight: '700', textDecoration: 'none' }}
            >
              {task.contactNumber}
            </a>
          </div>
        )}
      </div>

      {/* Irreparable / replacement outcome flag */}
      {isFlagged && (
        <div className="wo-card__flag">
          <div className="wo-card__flag-title">
            <AlertTriangle size={15} color="#dc2626" aria-hidden="true" />
            {task.maintenanceFlag?.type || 'Replacement'} Status Flagged
          </div>
          <div>
            <strong>Reason:</strong>{' '}
            {task.maintenanceFlag?.reason || task.replacementFlag?.reason}
          </div>
          {(task.maintenanceFlag?.type === 'Replacement' || task.replacementFlag?.isFlagged) &&
            task.replacementFlag?.itemSpecs && (
              <div>
                <strong>Recommended Unit:</strong> {task.replacementFlag.itemSpecs}
              </div>
            )}
          {task.maintenanceFlag?.type === 'Cannot Complete' && (
            <div style={{ marginTop: '6px' }}>
              <strong>Proposed follow-up:</strong> {task.maintenanceFlag.scheduledWork} on{' '}
              {task.maintenanceFlag.scheduledDate} at {task.maintenanceFlag.scheduledTime}
            </div>
          )}
          <div style={{ fontSize: '11.5px', marginTop: '4px', color: '#b91c1c' }}>
            Flagged by: {task.maintenanceFlag?.flaggedBy || task.replacementFlag?.flaggedBy}
          </div>
        </div>
      )}

      {/* Technician field log */}
      {task.notes && (
        <div className="wo-card__note">
          <strong>Field Work Log:</strong> {task.notes}
        </div>
      )}

      {/* Requester ISO/IEC 25010 evaluation */}
      {evaluationScore && (
        <div className="wo-card__rating">
          <Star size={13} fill="#047857" aria-hidden="true" /> Requester Evaluation:{' '}
          {evaluationScore} / 5.0 (ISO/IEC 25010)
        </div>
      )}

      {/* Actions */}
      <div className="wo-card__actions">
        <div className="wo-card__action-group">
          <button type="button" className="btn-flag" onClick={() => onFlagOutcome(task)}>
            <AlertTriangle size={14} aria-hidden="true" />
            {isFlagged ? 'Update Status Flag' : 'Flag Outcome'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onViewTicket(task)}>
            <Eye size={13} aria-hidden="true" /> View Ticket &amp; Photo
          </button>
        </div>

        <div className="wo-card__action-group">
          {canStart && (
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-start"
              onClick={() => onStartWork(task)}
            >
              <Zap size={13} aria-hidden="true" /> Start Work On-Site
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onUpdateStatus(task)}
          >
            <Wrench size={14} aria-hidden="true" />
            {isCompleted ? 'View Work Log' : 'Update Status & Log Parts'}
          </button>
        </div>
      </div>
    </article>
  );
};
