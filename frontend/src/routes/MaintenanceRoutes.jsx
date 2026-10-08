import React from 'react';
import { WorkQueue } from '../views/maintenance/WorkQueue';
import { PreventiveCalendar } from '../views/PreventiveCalendar';
import { CommunicationBox } from '../views/CommunicationBox';
import { OfficialDocuments } from '../views/OfficialDocuments';
import { ReplacementRequests } from '../views/ReplacementRequests';
import { SettingsPage } from '../views/SettingsPage';

export const MaintenanceRoutes = ({ activeTab, onTabChange }) => {
  const props = { activeTab, onTabChange };

  switch (activeTab) {
    /* 'tech-emergency' and 'tech-history' were merged into the Work Queue.
       They still resolve here so old bookmarks land in the right saved view
       (see LEGACY_TAB_VIEW) instead of a dead page. */
    case 'tech-emergency':
    case 'tech-history':
    case 'tech-tasks':
    default:
      return <WorkQueue {...props} />;

    case 'tech-calendar':
      return <PreventiveCalendar />;

    case 'tech-messages':
      return <CommunicationBox />;

    case 'tech-documents':
      return <OfficialDocuments />;

    case 'replacement-requests':
      return <ReplacementRequests />;

    case 'settings':
      return <SettingsPage onClose={() => onTabChange('tech-tasks')} />;
  }
};
