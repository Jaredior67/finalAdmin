import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginModal } from './components/auth/LoginModal';
import { LoginPage } from './components/auth/LoginPage';

// Role Workspaces
import { ExecutiveDashboard } from './views/ExecutiveDashboard';
import { JobRequests } from './views/JobRequests';
import { ApprovalHistory } from './views/ApprovalHistory';
import { OfficialDocuments } from './views/OfficialDocuments';
import { PreventiveCalendar } from './views/PreventiveCalendar';
import { ArchivedRequests } from './views/ArchivedRequests';
import { UserManagement } from './views/UserManagement';
import { CommunicationBox } from './views/CommunicationBox';
import { AnalyticsReports } from './views/AnalyticsReports';
import { FacultyStaffPortal } from './views/FacultyStaffPortal';
import { MaintenanceFieldPortal } from './views/MaintenanceFieldPortal';

function AppContent() {
  const { currentUser, isAdmin, isMaintenance, isFacultyOrStaff } = useAuth();
  const [activeTab, setActiveTab] = useState('executive-dashboard');
  const [jobRequestStatus, setJobRequestStatus] = useState('all');

  // If user is not logged in, show the dedicated FixIT Institutional Login Page
  if (!currentUser) {
    return <LoginPage />;
  }

  // 1. Role-based routing for Faculty and Staff
  if (isFacultyOrStaff) {
    return (
      <div className="app-container">
        <Navbar />
        <main className="content-area" style={{ maxWidth: '1240px', margin: '0 auto', width: '100%', padding: '24px 20px' }}>
          <FacultyStaffPortal />
        </main>
        <footer className="app-footer">
          ISAT U DUMANGAS CAMPUS 2026
        </footer>
        <LoginModal />
      </div>
    );
  }

  // 2. Role-based routing for Maintenance Personnel
  if (isMaintenance) {
    return (
      <div className="app-container">
        <Navbar />
        <main className="content-area" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '20px 16px' }}>
          <MaintenanceFieldPortal />
        </main>
        <footer className="app-footer">
          ISAT U DUMANGAS CAMPUS 2026
        </footer>
        <LoginModal />
      </div>
    );
  }

  // 3. Admin Executive Operations Console
  const renderAdminView = () => {
    switch (activeTab) {
      case 'executive-dashboard':
        return <ExecutiveDashboard onNavigate={(tab, status) => {
          if (status) setJobRequestStatus(status);
          setActiveTab(tab);
        }} />;
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
      default:
        return <ExecutiveDashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      <Navbar />
      
      <div className="main-layout">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <main className="content-area">
          {renderAdminView()}
          <footer className="app-footer">
            ISAT U DUMANGAS CAMPUS 2026
          </footer>
        </main>
      </div>

      <LoginModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}
