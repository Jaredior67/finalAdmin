import React from 'react';
import { CampusAdminDashboard } from '../views/campusAdmin/CampusAdminDashboard';
import { OfficialDocuments } from '../views/OfficialDocuments';
import { ApprovalHistory } from '../views/admin/ApprovalHistory';
import { CommunicationBox } from '../views/CommunicationBox';
import { NotificationsCenter } from '../views/NotificationsCenter';
import { CampusAdminAnalytics } from '../views/campusAdmin/CampusAdminAnalytics';
import { SettingsPage } from '../views/SettingsPage';

export const CampusAdminRoutes = ({ activeTab, onTabChange }) => {
  switch (activeTab) {
    case 'campus-admin-dashboard':
    case 'campus-approvals':
    case 'executive-dashboard':
      return <CampusAdminDashboard />;
    case 'official-documents':
      return <OfficialDocuments />;
    case 'approval-history':
      return <ApprovalHistory />;
    case 'communication-box':
      return <CommunicationBox />;
    case 'notifications':
      return <NotificationsCenter onNavigateTab={onTabChange} />;
    case 'analytics-reports':
      return <CampusAdminAnalytics />;
    case 'settings':
      return <SettingsPage onClose={() => onTabChange('campus-admin-dashboard')} />;
    default:
      return <CampusAdminDashboard />;
  }
};
