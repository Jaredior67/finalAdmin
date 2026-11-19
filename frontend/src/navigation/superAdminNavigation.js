import { LayoutGrid, Users, QrCode, ShieldCheck, MessageSquare, Bell, Settings, Archive } from 'lucide-react';

export const superAdminNavigation = {
  overview: [
    { id: 'superadmin-dashboard', label: 'Dashboard', icon: LayoutGrid }
  ],
  administration: [
    { id: 'user-management', label: 'Personnel Directory', icon: Users },
    { id: 'print-labels', label: 'Buildings & QR Registry', icon: QrCode }
  ],
  system: [
    { id: 'archived-requests', label: 'Archives', icon: Archive },
    { id: 'audit-log', label: 'Audit Log', icon: ShieldCheck },
    { id: 'communication-box', label: 'Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', fallbackBadge: 1, badgeColor: '#f59e0b' },
    { id: 'notifications', label: 'Notifications', icon: Bell, badgeKey: 'unreadNotificationsCount', badgeColor: '#ef4444' },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
