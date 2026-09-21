import {
  LayoutGrid,
  PlusCircle,
  AlertTriangle,
  FileText,
  History,
  MessageSquare,
  Folder,
  Tags,
  Settings
} from 'lucide-react';

export const facultyNavigation = {
  requisition: [
    { id: 'faculty-dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'faculty-submit', label: 'Job Request Desk', icon: PlusCircle },
    { id: 'faculty-urgent', label: 'Report Urgent Issue', icon: AlertTriangle, badgeKey: 'facultyUrgentTicketsCount', badgeColor: '#dc2626' },
    { id: 'faculty-tickets', label: 'My Active Tickets', icon: FileText, badgeKey: 'facultyActiveTicketsCount', badgeColor: '#001f9c' },
    { id: 'faculty-history', label: 'Request History', icon: History }
  ],
  campus: [
    { id: 'faculty-messages', label: 'Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', badgeColor: '#f59e0b' },
    { id: 'faculty-documents', label: 'Official Job Orders', icon: Folder },
    { id: 'replacement-requests', label: 'Add Replacement', icon: Tags, badgeKey: 'replacementCount', badgeColor: '#dc2626' },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
