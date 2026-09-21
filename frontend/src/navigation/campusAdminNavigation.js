import {
  Landmark,
  Clock,
  Folder,
  BarChart3,
  MessageSquare,
  Settings,
  CheckCircle2
} from 'lucide-react';

export const campusAdminNavigation = {
  approvals: [
    { id: 'campus-admin-dashboard', label: 'Final Action Approvals', icon: Landmark, badgeKey: 'pendingCampusAdminApprovalsCount', badgeColor: '#b45309' },
    { id: 'approval-history', label: 'Approval History', icon: Clock },
    { id: 'official-documents', label: 'Official Documents', icon: Folder }
  ],
  management: [
    { id: 'analytics-reports', label: 'Analytics & Reports', icon: BarChart3 },
    { id: 'communication-box', label: 'Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', badgeColor: '#f59e0b' },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
