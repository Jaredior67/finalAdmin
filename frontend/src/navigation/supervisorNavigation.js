import {
  UserCheck,
  MessageSquare,
  Bell,
  Settings
} from 'lucide-react';

export const supervisorNavigation = [
  {
    id: 'supervisor-dashboard',
    label: 'Immediate Supervisor Approvals',
    icon: UserCheck,
    badgeKey: 'pendingSupervisorApprovals'
  },
  {
    id: 'communication-box',
    label: 'Messages',
    icon: MessageSquare,
    badgeKey: 'unreadMessages'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    badgeKey: 'unreadNotifications'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings
  }
];
