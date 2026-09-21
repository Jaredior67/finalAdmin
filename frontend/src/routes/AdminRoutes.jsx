import React from 'react';
import { ExecutiveDashboard } from '../views/admin/ExecutiveDashboard';
import { JobRequests } from '../views/admin/JobRequests';
import { ApprovalHistory } from '../views/admin/ApprovalHistory';
import { OfficialDocuments } from '../views/OfficialDocuments';
import { PreventiveCalendar } from '../views/PreventiveCalendar';
import { ArchivedRequests } from '../views/admin/ArchivedRequests';
import { UserManagement } from '../views/admin/UserManagement';
import { CommunicationBox } from '../views/CommunicationBox';
import { AnalyticsReports } from '../views/admin/AnalyticsReports';
import { ReplacementRequests } from '../views/ReplacementRequests';
import { PrintLabels } from '../views/PrintLabels';
import { SettingsPage } from '../views/SettingsPage';

export const AdminRoutes = ({ activeTab, onTabChange, jobRequestStatus, setJobRequestStatus }) => {
  switch (activeTab) {
    case 'job-requests':
      return <JobRequests initialStatusTab={jobRequestStatus} />;
    case 'approval-history':
      return <ApprovalHistory />;
    case 'official-documents':
      return <OfficialDocuments />;
    case 'preventive-calendar':
      return <PreventiveCalendar />;
    case 'archived-requests':
      return <ArchivedRequests />;
    case 'user-management':
      return <UserManagement />;
    case 'communication-box':
      return <CommunicationBox />;
    case 'analytics-reports':
      return <AnalyticsReports />;
    case 'replacement-requests':
      return <ReplacementRequests />;
    case 'print-labels':
      return <PrintLabels />;
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
