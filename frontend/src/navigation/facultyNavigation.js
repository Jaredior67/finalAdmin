import {
  LayoutGrid,
  PlusCircle,
  FileText,
  History,
  MessageSquare,
  Tags,
  Settings
} from 'lucide-react';

export const facultyNavigation = {
  requisition: [
    { id: 'faculty-dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'faculty-submit', label: 'Job Request', icon: PlusCircle },
    { id: 'faculty-tickets', label: 'My Active Tickets', icon: FileText, badgeKey: 'facultyActiveTicketsCount', badgeColor: '#001f9c' },
    { id: 'faculty-history', label: 'Request History', icon: History }
  ],
  campus: [
    { id: 'faculty-messages', label: 'Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', badgeColor: '#f59e0b' },
    { id: 'replacement-requests', label: 'Add Replacement', icon: Tags, badgeKey: 'replacementCount', badgeColor: '#dc2626' },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
