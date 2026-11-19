import {
  Landmark,
  Clock,
  BarChart3,
  MessageSquare,
  Bell,
  Settings
} from 'lucide-react';

export const campusAdminNavigation = {
  approvals: [
    { id: 'campus-admin-dashboard', label: 'Final Approvals', icon: Landmark, badgeKey: 'pendingCampusAdminApprovalsCount', badgeColor: '#b45309' },
    { id: 'approval-history', label: 'Approval History', icon: Clock }
  ],
  management: [
    { id: 'analytics-reports', label: 'Analytics & Reports', icon: BarChart3 },
    { id: 'communication-box', label: 'Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', badgeColor: '#f59e0b' },
    { id: 'notifications', label: 'Notifications', icon: Bell, badgeKey: 'unreadNotificationsCount', badgeColor: '#ef4444' },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
