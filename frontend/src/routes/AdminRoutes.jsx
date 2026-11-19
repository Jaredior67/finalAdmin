import React from 'react';
import { ExecutiveDashboard } from '../views/admin/ExecutiveDashboard';
import { JobRequests } from '../views/admin/JobRequests';
import { OfficialDocuments } from '../views/OfficialDocuments';
import { PreventiveCalendar } from '../views/PreventiveCalendar';
import { ArchivedRequests } from '../views/admin/ArchivedRequests';
import { AuditTrail } from '../views/admin/AuditTrail';
import { CommunicationBox } from '../views/CommunicationBox';
import { NotificationsCenter } from '../views/NotificationsCenter';
import { AnalyticsReports } from '../views/admin/AnalyticsReports';
import { ReplacementRequests } from '../views/ReplacementRequests';
import { SettingsPage } from '../views/SettingsPage';

export const AdminRoutes = ({ activeTab, onTabChange, jobRequestStatus, setJobRequestStatus }) => {
  switch (activeTab) {
    case 'job-requests':
      return <JobRequests initialStatusTab={jobRequestStatus} />;
    case 'official-documents':
      return <OfficialDocuments />;
    case 'preventive-calendar':
      return <PreventiveCalendar />;
    case 'archived-requests':
      return <ArchivedRequests />;
    case 'audit-log':
    case 'audit-trail':
      return <AuditTrail />;
    case 'communication-box':
      return <CommunicationBox />;
    case 'notifications':
      return <NotificationsCenter onNavigateTab={onTabChange} />;
    case 'analytics-reports':
      return <AnalyticsReports />;
    case 'replacement-requests':
      return <ReplacementRequests />;
    case 'settings':
      return <SettingsPage onClose={() => onTabChange('executive-dashboard')} />;
    case 'executive-dashboard':
    default:
      return <ExecutiveDashboard onNavigate={(tab, status) => {
        if (status) setJobRequestStatus(status);
        onTabChange(tab);
      }} />;
  }
};
