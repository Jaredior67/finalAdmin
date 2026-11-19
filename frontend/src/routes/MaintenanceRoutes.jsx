import React from 'react';
import { MaintenanceDashboard } from '../views/maintenance/MaintenanceDashboard';
import { WorkQueue } from '../views/maintenance/WorkQueue';
import { PreventiveCalendar } from '../views/PreventiveCalendar';
import { CommunicationBox } from '../views/CommunicationBox';
import { NotificationsCenter } from '../views/NotificationsCenter';
import { ReplacementRequests } from '../views/ReplacementRequests';
import { SettingsPage } from '../views/SettingsPage';

export const MaintenanceRoutes = ({ activeTab, onTabChange }) => {
  const props = { activeTab, onTabChange };

  switch (activeTab) {
    case 'tech-dashboard':
      return <MaintenanceDashboard onTabChange={onTabChange} />;

    case 'tech-emergency':
      return <WorkQueue {...props} initialView="urgent" />;

    case 'tech-history':
      return <WorkQueue {...props} initialView="completed" />;

    case 'tech-tasks':
      return <WorkQueue {...props} initialView="all" />;

    case 'tech-calendar':
      return <PreventiveCalendar />;

    case 'tech-messages':
      return <CommunicationBox />;

    case 'notifications':
      return <NotificationsCenter onNavigateTab={onTabChange} />;

    case 'replacement-requests':
      return <ReplacementRequests />;

    case 'settings':
      return <SettingsPage onClose={() => onTabChange('tech-tasks')} />;

    default:
      return <WorkQueue {...props} />;
  }
};
