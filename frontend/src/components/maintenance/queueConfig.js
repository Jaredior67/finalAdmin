/* ==========================================================================
   Maintenance Work Queue — shared configuration
   Single source of truth for the filter option lists, the queue "saved views"
   and the sort orders used by the unified field-technician work queue.
   ========================================================================== */

import { Wrench, AlertTriangle, PlayCircle, CheckCircle2 } from 'lucide-react';

export const MAINTENANCE_CATEGORIES = [
  'Electrical',
  'Air Conditioning',
  'Water/Sanitary',
  'Physical Structures',
  'Mechanical'
];

export const MAINTENANCE_URGENCIES = ['Urgent', 'High', 'Medium', 'Low'];

/* Statuses are stored as display labels ("On Hold") but filtered as slugs
   ("on-hold") so the option values stay URL/CSV friendly. */
export const QUEUE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' }
];

export const QUEUE_SORT_OPTIONS = [
  { value: 'priority', label: 'Priority first' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'location', label: 'Location A–Z' }
];

/* "Saved views" — the four queues that used to be three separate pages.
   `filter` narrows the shared ticket list; the accent colour is used by the
   queue cards and by the card border of urgent/high work orders. */
export const QUEUE_VIEWS = [
  {
    id: 'all',
    label: 'Assigned',
    icon: Wrench,
    title: 'All Assigned Work Orders',
    accent: '#0f172a',
    filter: () => true
  },
  {
    id: 'urgent',
    label: 'Urgent',
    icon: AlertTriangle,
    title: 'Urgent & High Priority Queue',
    accent: '#dc2626',
    filter: (t) => (t.urgency === 'Urgent' || t.urgency === 'High') && t.status !== 'Completed'
  },
  {
    id: 'in-progress',
    label: 'In Progress',
    icon: PlayCircle,
    title: 'Work Currently In Progress',
    accent: '#4f46e5',
    filter: (t) => t.status === 'Ongoing' || t.status === 'In Progress'
  },
  {
    id: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    title: 'Completed Work Logs',
    accent: '#059669',
    filter: (t) => t.status === 'Completed'
  }
];

/* Legacy tab id → queue view, so old bookmarks and deep links land in the
   right place instead of dead-ending after the pages were merged. */
export const LEGACY_TAB_VIEW = {
  'tech-emergency': 'urgent',
  'tech-history': 'completed'
};

/* --- shared helpers ------------------------------------------------------ */

export const toStatusSlug = (status) =>
  String(status || '').toLowerCase().replace(/\s+/g, '-');

export const URGENCY_RANK = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

export const compareBySort = (sort, a, b) => {
  switch (sort) {
    case 'newest':
      return String(b.date || '').localeCompare(String(a.date || ''));
    case 'oldest':
      return String(a.date || '').localeCompare(String(b.date || ''));
    case 'location':
      return String(a.location || '').localeCompare(String(b.location || ''));
    case 'priority':
    default: {
      const rank = URGENCY_RANK[a.urgency] ?? 9;
      const other = URGENCY_RANK[b.urgency] ?? 9;
      if (rank !== other) return rank - other;
      return String(a.date || '').localeCompare(String(b.date || ''));
    }
  }
};

/* Case/whitespace tolerant "is this ticket in my queue" check. The old code
   hard-coded "mark"/"villanueva", which is why other technicians saw an
   empty queue — now any ticket that matches the signed-in technician, or is
   still open (crew work), is included. */
export const buildMyQueue = (requisitions, currentUser) => {
  const name = String(currentUser?.name || '').trim().toLowerCase();
  const email = String(currentUser?.email || '').trim().toLowerCase();
  const isOpen = (t) => t.status !== 'Completed' && t.status !== 'Rejected';

  return (requisitions || []).filter((t) => {
    if (t.isArchived) return false;
    if (!name) return true;
    const assignee = String(t.assignedTo || '').toLowerCase();
    if (name && assignee.includes(name)) return true;
    if (email && String(t.requesterEmail || '').toLowerCase() === email) return true;
    return isOpen(t);
  });
};

/* Assigned-staff options are derived from the tickets themselves so the filter
   can never point at someone with nothing in the queue. */
export const buildAssigneeOptions = (tickets) =>
  Array.from(
    new Set(
      (tickets || [])
        .map((t) => String(t.assignedTo || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
