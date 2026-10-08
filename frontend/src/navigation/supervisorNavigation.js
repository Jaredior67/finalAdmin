import {
  UserCheck,
  FileText,
  MessageSquare,
  Settings
} from 'lucide-react';

export const supervisorNavigation = [
  {
    id: 'supervisor-dashboard',
    label: 'Supervisor Approvals',
    icon: UserCheck,
    badgeKey: 'pendingSupervisorApprovals'
  },
  {
    id: 'official-documents',
    label: 'Official Documents',
    icon: FileText
  },
  {
    id: 'communication-box',
    label: 'Messages',
    icon: MessageSquare,
    badgeKey: 'unreadMessages'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings
  }
];
