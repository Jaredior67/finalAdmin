import React from 'react';
import { FacultyStaffDashboard } from '../views/faculty/FacultyStaffDashboard';
import { SubmitJobRequest } from '../views/faculty/SubmitJobRequest';
import { ActiveTickets } from '../views/faculty/ActiveTickets';
import { RequisitionHistory } from '../views/faculty/RequisitionHistory';
import { FacultyCommunication } from '../views/faculty/FacultyCommunication';
import { ReplacementRequests } from '../views/ReplacementRequests';
import { SettingsPage } from '../views/SettingsPage';
// SupervisorDashboard is embedded within the Faculty workspace for users with
// the Supervisor designation (is_supervisor=1). Supervisors log in through the
// Faculty/Staff tab and see a "Supervisor Queue" section in the sidebar.
import { SupervisorDashboard } from '../views/supervisor/SupervisorDashboard';

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
    case 'replacement-requests':
      return <ReplacementRequests />;
    case 'settings':
      return <SettingsPage onClose={() => onTabChange('faculty-dashboard')} />;
    case 'faculty-urgent':
      return <SubmitJobRequest {...props} initialRequestType="Urgent Request" />;
    case 'faculty-submit':
      return <SubmitJobRequest {...props} initialRequestType="Standard Request" />;
    // Supervisor queue — visible only when the user has the Supervisor designation.
    // Routing is gated in the Sidebar (supervisor nav items are only rendered
    // when isSupervisor=true), but we accept the tab here defensively.
    case 'supervisor-queue':
    case 'supervisor-approvals':
    case 'supervisor-dashboard':
      return <SupervisorDashboard />;
    default:
      return <FacultyStaffDashboard onNavigate={onTabChange} />;
  }
};
