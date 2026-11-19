import {
  LayoutGrid,
  Mail,
  Folder,
  Calendar,
  Archive,
  Users,
  MessageSquare,
  Bell,
  BarChart3,
  Tags,
  QrCode,
  ShieldCheck,
  Settings
} from 'lucide-react';

export const adminNavigation = {
  operations: [
    { id: 'executive-dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'job-requests', label: 'Job Requests', icon: Mail, badgeKey: 'pendingApprovals', badgeColor: '#f59e0b' },
    { id: 'preventive-calendar', label: 'Preventive Maintenance', icon: Calendar }
  ],
  management: [
    { id: 'official-documents', label: 'Official Documents', icon: Folder },
    { id: 'communication-box', label: 'Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', fallbackBadge: 1, badgeColor: '#f59e0b' },
    { id: 'notifications', label: 'Notifications', icon: Bell, badgeKey: 'unreadNotificationsCount', badgeColor: '#ef4444' },
    { id: 'analytics-reports', label: 'Analytics & Reports', icon: BarChart3 },
    { id: 'archived-requests', label: 'Archives', icon: Archive },
    { id: 'audit-log', label: 'Audit Log', icon: ShieldCheck },
    { id: 'replacement-requests', label: 'Asset Replacement', icon: Tags, badgeKey: 'replacementCount', badgeColor: '#dc2626' },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
