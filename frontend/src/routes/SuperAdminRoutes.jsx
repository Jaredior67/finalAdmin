import React from 'react';
import { SuperAdminDashboard } from '../views/superadmin/SuperAdminDashboard';
import { UserManagement } from '../views/admin/UserManagement';
import { PrintLabels } from '../views/PrintLabels';
import { AuditTrail } from '../views/admin/AuditTrail';
import { ArchivedRequests } from '../views/admin/ArchivedRequests';
import { CommunicationBox } from '../views/CommunicationBox';
import { NotificationsCenter } from '../views/NotificationsCenter';
import { SettingsPage } from '../views/SettingsPage';

export const SuperAdminRoutes = ({ activeTab, onTabChange }) => {
  switch (activeTab) {
    case 'register-user':
      return <UserManagement onNavigate={onTabChange} initialRegisterOpen />;
    case 'user-management':
      return <UserManagement onNavigate={onTabChange} />;
    case 'print-labels':
      return <PrintLabels />;
    case 'archived-requests':
      return <ArchivedRequests />;
    case 'audit-log':
    case 'audit-trail':
      return <AuditTrail />;
    case 'communication-box':
      return <CommunicationBox />;
    case 'notifications':
      return <NotificationsCenter onNavigateTab={onTabChange} />;
    case 'settings':
      return <SettingsPage onClose={() => onTabChange('superadmin-dashboard')} />;
    case 'superadmin-dashboard':
    default:
      return <SuperAdminDashboard onNavigate={onTabChange} />;
  }
};
