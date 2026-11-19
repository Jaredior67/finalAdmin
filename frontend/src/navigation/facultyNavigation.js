import {
  LayoutGrid,
  PlusCircle,
  History,
  MessageSquare,
  Bell,
  Tags,
  Settings
} from 'lucide-react';

export const facultyNavigation = {
  requisition: [
    { id: 'faculty-dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'faculty-history', label: 'Request History', icon: History }
  ],
  campus: [
    { id: 'faculty-messages', label: 'Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', badgeColor: '#f59e0b' },
    { id: 'notifications', label: 'Notifications', icon: Bell, badgeKey: 'unreadNotificationsCount', badgeColor: '#ef4444' },
    { id: 'replacement-requests', label: 'Asset Replacement', icon: Tags, badgeKey: 'replacementCount', badgeColor: '#dc2626' },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
