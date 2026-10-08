import React from 'react';
import { SupervisorDashboard } from '../views/supervisor/SupervisorDashboard';
import { OfficialDocuments } from '../views/OfficialDocuments';
import { CommunicationBox } from '../views/CommunicationBox';
import { SettingsPage } from '../views/SettingsPage';

export const SupervisorRoutes = ({ activeTab, onTabChange }) => {
  switch (activeTab) {
    case 'supervisor-dashboard':
    case 'supervisor-approvals':
      return <SupervisorDashboard />;
    case 'official-documents':
      return <OfficialDocuments />;
    case 'communication-box':
      return <CommunicationBox />;
    case 'settings':
      return <SettingsPage onClose={() => onTabChange('supervisor-dashboard')} />;
    default:
      return <SupervisorDashboard />;
  }
};
