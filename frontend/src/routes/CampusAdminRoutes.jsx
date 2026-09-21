import React from 'react';
import { CampusAdminDashboard } from '../views/campusAdmin/CampusAdminDashboard';
import { OfficialDocuments } from '../views/OfficialDocuments';
import { ApprovalHistory } from '../views/admin/ApprovalHistory';
import { CommunicationBox } from '../views/CommunicationBox';
import { AnalyticsReports } from '../views/admin/AnalyticsReports';
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
    case 'analytics-reports':
      return <AnalyticsReports />;
    case 'settings':
      return <SettingsPage onClose={() => onTabChange('campus-admin-dashboard')} />;
    default:
      return <CampusAdminDashboard />;
  }
};
