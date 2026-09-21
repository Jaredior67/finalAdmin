import {
  LayoutGrid,
  Mail,
  Clock,
  Folder,
  Calendar,
  Archive,
  Users,
  MessageSquare,
  BarChart3,
  Tags,
  QrCode,
  Settings
} from 'lucide-react';

export const adminNavigation = {
  operations: [
    { id: 'executive-dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'job-requests', label: 'Job Requests', icon: Mail, badgeKey: 'pendingApprovals', badgeColor: '#f59e0b' },
    { id: 'approval-history', label: 'Approval History', icon: Clock },
    { id: 'preventive-calendar', label: 'Preventive Calendar', icon: Calendar }
  ],
  management: [
    { id: 'official-documents', label: 'Official Documents', icon: Folder },
    { id: 'user-management', label: 'User Management', icon: Users, badgeKey: 'pendingRegistrationsCount', badgeColor: '#3b82f6' },
    { id: 'communication-box', label: 'Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', fallbackBadge: 1, badgeColor: '#f59e0b' },
    { id: 'analytics-reports', label: 'Analytics & Reports', icon: BarChart3 },
    { id: 'archived-requests', label: 'Archived Requests', icon: Archive },
    { id: 'replacement-requests', label: 'Add Replacement', icon: Tags, badgeKey: 'replacementCount', badgeColor: '#dc2626' },
    { id: 'print-labels', label: 'Print / Labels', icon: QrCode },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
