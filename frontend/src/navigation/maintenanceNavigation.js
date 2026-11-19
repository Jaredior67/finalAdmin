import {
  LayoutDashboard,
  Wrench,
  History,
  Calendar,
  MessageSquare,
  Bell,
  Tags,
  Settings
} from 'lucide-react';

/* Maintenance workspace navigation. */
export const maintenanceNavigation = {
  overview: [
    { id: 'tech-dashboard', label: 'Dashboard', icon: LayoutDashboard }
  ],
  operations: [
    { id: 'tech-tasks', label: 'Work Queue', icon: Wrench, badgeKey: 'techActiveCount', badgeColor: '#d97706' },
    { id: 'tech-history', label: 'Request History', icon: History }
  ],
  facility: [
    { id: 'tech-calendar', label: 'Preventive Maintenance', icon: Calendar },
    { id: 'tech-messages', label: 'Team Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', badgeColor: '#f59e0b' },
    { id: 'notifications', label: 'Notifications', icon: Bell, badgeKey: 'unreadNotificationsCount', badgeColor: '#ef4444' },
    { id: 'replacement-requests', label: 'Asset Replacement', icon: Tags, badgeKey: 'replacementCount', badgeColor: '#dc2626' },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
