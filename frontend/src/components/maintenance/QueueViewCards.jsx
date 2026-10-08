import React from 'react';
import { QUEUE_VIEWS } from './queueConfig';

/* ==========================================================================
   Queue cards — horizontal KPI tiles consistent with Faculty & Admin dashboards.
   ========================================================================== */
export const QueueViewCards = ({ activeView, counts, onViewChange, panelId = 'work-queue-panel' }) => (
  <div className="queue-views" role="tablist" aria-label="Work queue views">
    {QUEUE_VIEWS.map((view) => {
      const Icon = view.icon;
      const isActive = activeView === view.id;
      return (
        <button
          key={view.id}
          type="button"
          role="tab"
          id={`queue-tab-${view.id}`}
          aria-selected={isActive}
          aria-controls={panelId}
          tabIndex={isActive ? 0 : -1}
          className={`queue-view${isActive ? ' is-active' : ''}`}
          style={{ '--queue-accent': view.accent }}
          onClick={() => onViewChange(view.id)}
        >
          <span className="queue-view__head">
            <span className="queue-view__icon">
              <Icon size={15} aria-hidden="true" />
            </span>
            <span className="queue-view__label">{view.label}</span>
          </span>
          <span className="queue-view__count">{counts[view.id] ?? 0}</span>
        </button>
      );
    })}
  </div>
);
