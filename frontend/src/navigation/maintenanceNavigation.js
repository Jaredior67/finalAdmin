import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Folder,
  Tags,
  Settings
} from 'lucide-react';

export const maintenanceNavigation = {
  operations: [
    { id: 'tech-tasks', label: 'Assigned Requests', icon: Wrench, badgeKey: 'techActiveCount', badgeColor: '#d97706' },
    { id: 'tech-emergency', label: 'Urgent Queue', icon: AlertTriangle, badgeKey: 'techEmergencyCount', badgeColor: '#dc2626' },
    { id: 'tech-history', label: 'Completed Work Logs', icon: CheckCircle2 }
  ],
  facility: [
    { id: 'tech-calendar', label: 'Preventive Calendar', icon: Calendar },
    { id: 'tech-messages', label: 'Team Messages', icon: MessageSquare, badgeKey: 'unreadMessagesCount', badgeColor: '#f59e0b' },
    { id: 'tech-documents', label: 'Equipment & Safety Docs', icon: Folder },
    { id: 'replacement-requests', label: 'Add Replacement', icon: Tags, badgeKey: 'replacementCount', badgeColor: '#dc2626' },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]
};
