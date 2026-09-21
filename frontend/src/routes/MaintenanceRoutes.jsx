import React from 'react';
import { AssignedWorkOrders } from '../views/maintenance/AssignedWorkOrders';
import { EmergencyQueue } from '../views/maintenance/EmergencyQueue';
import { CompletedWorkLogs } from '../views/maintenance/CompletedWorkLogs';
import { PreventiveMaintenance } from '../views/maintenance/PreventiveMaintenance';
import { DispatchDesk } from '../views/maintenance/DispatchDesk';
import { EquipmentSafetyDocs } from '../views/maintenance/EquipmentSafetyDocs';
import { ReplacementRequests } from '../views/ReplacementRequests';
import { SettingsPage } from '../views/SettingsPage';

export const MaintenanceRoutes = ({ activeTab, onTabChange }) => {
  const props = { activeTab, onTabChange };

  switch (activeTab) {
    case 'tech-emergency':
      return <EmergencyQueue {...props} />;
    case 'tech-history':
      return <CompletedWorkLogs {...props} />;
    case 'tech-calendar':
      return <PreventiveMaintenance {...props} />;
    case 'tech-messages':
      return <DispatchDesk {...props} />;
    case 'tech-documents':
      return <EquipmentSafetyDocs {...props} />;
    case 'replacement-requests':
      return <ReplacementRequests />;
    case 'settings':
      return <SettingsPage onClose={() => onTabChange('tech-tasks')} />;
    case 'tech-tasks':
    default:
      return <AssignedWorkOrders {...props} />;
  }
};
