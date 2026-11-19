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

/* Tab id → queue view mapping */
export const LEGACY_TAB_VIEW = {
  'tech-dashboard': 'all',
  'tech-tasks': 'all',
  'tech-emergency': 'urgent',
  'tech-history': 'completed'
};

/* --- shared helpers ------------------------------------------------------ */

export const toStatusSlug = (status) =>
  String(status || '').toLowerCase().replace(/\s+/g, '-');

export const URGENCY_RANK = { 'High Risk': 0, Urgent: 0, High: 0, 'Medium Risk': 1, Medium: 1, 'Low Risk': 2, Low: 2 };

export const compareBySort = (sort, a, b) => {
  const isUrgentA = /high|urgent|emergency/i.test(String(a.urgency || '')) || a.requestType === 'Urgent Request' || a.category === 'Urgent Hazard';
  const isUrgentB = /high|urgent|emergency/i.test(String(b.urgency || '')) || b.requestType === 'Urgent Request' || b.category === 'Urgent Hazard';

  switch (sort) {
    case 'newest':
      return String(b.date || '').localeCompare(String(a.date || ''));
    case 'oldest':
      return String(a.date || '').localeCompare(String(b.date || ''));
    case 'location':
      if (isUrgentA && !isUrgentB) return -1;
      if (!isUrgentA && isUrgentB) return 1;
      return String(a.location || '').localeCompare(String(b.location || ''));
    case 'priority':
    default: {
      const rank = isUrgentA ? 0 : (URGENCY_RANK[a.urgency] ?? 9);
      const other = isUrgentB ? 0 : (URGENCY_RANK[b.urgency] ?? 9);
      if (rank !== other) return rank - other;
      // First-come, first-served (FCFS): earliest submitted first
      const dateCmp = String(a.date || '').localeCompare(String(b.date || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(a.controlNo || a.id || '').localeCompare(String(b.controlNo || b.id || ''));
    }
  }
};

/**
 * Match a ticket to the signed-in user.
 * Technicians see strictly what is assigned to them by account ID or staff name.
 * Admin and campus administrators see the whole campus facility queue.
 */
export const isTicketAssignedToUser = (ticket, user) => {
  if (!ticket || !user) return false;
  if (ticket.isArchived) return false;

  // Privileged administrative accounts see the whole facility queue
  if (user.role === 'admin' || user.role === 'campus_admin') {
    return true;
  }

  const userId = user.id != null ? String(user.id) : null;
  const userName = String(user.name || `${user.firstName || user.first_name || ''} ${user.lastName || user.last_name || ''}`).trim().toLowerCase();
  const userUsername = String(user.username || '').trim().toLowerCase();

  // 1. Foreign key ID match (assignedToId or assigned_to)
  const assigneeId = ticket.assignedToId != null
    ? String(ticket.assignedToId)
    : (ticket.assigned_to != null ? String(ticket.assigned_to) : null);

  if (userId && assigneeId && (userId === assigneeId || Number(userId) === Number(assigneeId))) {
    return true;
  }

  // 2. Name / username match on assignedTo text
  const assigneeText = String(ticket.assignedTo || ticket.assignee_name || '').trim().toLowerCase();
  if (assigneeText) {
    const assignedTokens = assigneeText.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
    for (const token of assignedTokens) {
      if (userId && token === userId) return true;
      if (userName && (token === userName || token.includes(userName) || userName.includes(token))) return true;
      if (userUsername && (token === userUsername || token.includes(userUsername))) return true;
    }
  }

  return false;
};

/**
 * Build the individual technician's relevant work queue.
 * Returns only work orders specifically assigned to the signed-in technician,
 * guaranteeing brand new accounts start with an empty, clean queue.
 */
export const buildMyQueue = (requisitions, currentUser) => {
  if (!currentUser) return [];
  return (requisitions || []).filter((t) => isTicketAssignedToUser(t, currentUser));
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
