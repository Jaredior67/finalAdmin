import React from 'react';
import { Search, RotateCcw, Download, Users } from 'lucide-react';
import {
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_URGENCIES,
  QUEUE_STATUS_OPTIONS,
  QUEUE_SORT_OPTIONS
} from './queueConfig';

/* ==========================================================================
   One horizontal filter toolbar for the work queue.
   Every control (search, category, urgency, status, assigned staff, sort) sits
   on a single row and shares the same visual weight, so nothing stacks into
   an oversized column. It collapses to one control per line only on phones.
   ========================================================================== */
export const WorkQueueToolbar = ({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  urgency,
  onUrgencyChange,
  status,
  onStatusChange,
  assignee,
  onAssigneeChange,
  assignees,
  sort,
  onSortChange,
  onReset,
  visibleCount,
  totalCount,
  onExport,
  exportLabel = 'Export (CSV)'
}) => {
  const isFiltered =
    Boolean(search) ||
    category !== 'all' ||
    urgency !== 'all' ||
    status !== 'all' ||
    assignee !== 'all' ||
    sort !== 'priority';

  return (
    <div className="queue-toolbar" role="search" aria-label="Filter work queue">
      <div className="queue-toolbar__field queue-toolbar__field--search">
        <label className="queue-toolbar__label" htmlFor="queue-search">
          Search
        </label>
        <div className="queue-toolbar__search-wrap">
          <Search size={14} aria-hidden="true" />
          <input
            id="queue-search"
            type="search"
            className="queue-toolbar__control queue-toolbar__control--search"
            placeholder="Tracking no., location, requester…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="queue-toolbar__field">
        <label className="queue-toolbar__label" htmlFor="queue-category">
          Category
        </label>
        <select
          id="queue-category"
          className="queue-toolbar__control"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="all">All categories</option>
          {MAINTENANCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="queue-toolbar__field">
        <label className="queue-toolbar__label" htmlFor="queue-urgency">
          Urgency
        </label>
        <select
          id="queue-urgency"
          className="queue-toolbar__control"
          value={urgency}
          onChange={(e) => onUrgencyChange(e.target.value)}
        >
          <option value="all">All urgencies</option>
          {MAINTENANCE_URGENCIES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <div className="queue-toolbar__field">
        <label className="queue-toolbar__label" htmlFor="queue-status">
          Status
        </label>
        <select
          id="queue-status"
          className="queue-toolbar__control"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="all">All statuses</option>
          {QUEUE_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="queue-toolbar__field">
        <label className="queue-toolbar__label" htmlFor="queue-staff">
          <Users size={10} style={{ verticalAlign: '-1px', marginRight: '3px' }} aria-hidden="true" />
          Assigned Staff
        </label>
        <select
          id="queue-staff"
          className="queue-toolbar__control"
          value={assignee}
          onChange={(e) => onAssigneeChange(e.target.value)}
        >
          <option value="all">All staff</option>
          {assignees.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="queue-toolbar__field">
        <label className="queue-toolbar__label" htmlFor="queue-sort">
          Sort
        </label>
        <select
          id="queue-sort"
          className="queue-toolbar__control"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
        >
          {QUEUE_SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="queue-toolbar__actions">
        <span className="queue-toolbar__result" role="status">
          {visibleCount === totalCount
            ? `${totalCount} record${totalCount === 1 ? '' : 's'}`
            : `${visibleCount} of ${totalCount} records`}
        </span>
        {isFiltered && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>
            <RotateCcw size={13} /> Clear
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onExport}
          disabled={visibleCount === 0}
        >
          <Download size={13} /> {exportLabel}
        </button>
      </div>
    </div>
  );
};
