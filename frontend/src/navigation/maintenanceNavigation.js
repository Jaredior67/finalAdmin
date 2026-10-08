import {
  Wrench,
  Calendar,
  MessageSquare,
  Folder,
  Tags,
  Settings
} from 'lucide-react';

/* Maintenance workspace navigation.
   The former "Assigned Requests / Urgent Queue / Completed Work Logs" trio is
   now a single "Work Queue" entry — those three screens were the same list
   with a different filter, and the queue cards inside the page switch views
   instead. `tech-emergency` and `tech-history` remain valid tab ids so older
   deep links still resolve (see LEGACY_TAB_VIEW in components/maintenance). */
export const maintenanceNavigation = {
  operations: [
    { id: 'tech-tasks', label: 'Work Queue', icon: Wrench, badgeKey: 'techActiveCount', badgeColor: '#d97706' }
  ],
  facility: [
    { id: 'tech-calendar', label: 'Preventive Calendar', icon: Calendar },
    { id: 'tech-messages', label: 'Team Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', badgeColor: '#f59e0b' },
    { id: 'tech-documents', label: 'Equipment & Safety Docs', icon: Folder },
    { id: 'replacement-requests', label: 'Add Replacement', icon: Tags, badgeKey: 'replacementCount', badgeColor: '#dc2626' },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
