import React from 'react';
import { FacultyStaffDashboard } from '../views/faculty/FacultyStaffDashboard';
import { SubmitJobRequest } from '../views/faculty/SubmitJobRequest';
import { ActiveTickets } from '../views/faculty/ActiveTickets';
import { RequisitionHistory } from '../views/faculty/RequisitionHistory';
import { FacultyCommunication } from '../views/faculty/FacultyCommunication';
import { OfficialJobOrders } from '../views/faculty/OfficialJobOrders';
import { ReplacementRequests } from '../views/ReplacementRequests';
import { SettingsPage } from '../views/SettingsPage';

export const FacultyRoutes = ({ activeTab, onTabChange }) => {
  const props = { activeTab, onTabChange };

  switch (activeTab) {
    case 'faculty-dashboard':
      return <FacultyStaffDashboard onNavigate={onTabChange} />;
    case 'faculty-tickets':
      return <ActiveTickets {...props} />;
    case 'faculty-history':
      return <RequisitionHistory {...props} />;
    case 'faculty-messages':
      return <FacultyCommunication {...props} />;
    case 'faculty-documents':
      return <OfficialJobOrders {...props} />;
    case 'replacement-requests':
      return <ReplacementRequests />;
    case 'settings':
      return <SettingsPage onClose={() => onTabChange('faculty-dashboard')} />;
    case 'faculty-urgent':
      return <SubmitJobRequest {...props} initialRequestType="Urgent Request" />;
    case 'faculty-submit':
      return <SubmitJobRequest {...props} initialRequestType="Standard Request" />;
    default:
      return <FacultyStaffDashboard onNavigate={onTabChange} />;
  }
};
