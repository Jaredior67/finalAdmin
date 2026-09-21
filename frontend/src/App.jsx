import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './components/ui/Toast';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginModal } from './components/auth/LoginModal';
import { LoginPage } from './components/auth/LoginPage';
import { SystemFooter } from './components/layout/SystemFooter';
import { BackendStatus } from './components/common/BackendStatus';
import { OfflineBanner } from './components/common/OfflineBanner';

// Role Workspaces
import { AdminRoutes } from './routes/AdminRoutes';
import { FacultyRoutes } from './routes/FacultyRoutes';
import { MaintenanceRoutes } from './routes/MaintenanceRoutes';
import { CampusAdminRoutes } from './routes/CampusAdminRoutes';

function AppContent() {
  const { currentUser, isAdmin, isCampusAdmin, isMaintenance, isFacultyOrStaff } = useAuth();
  const [activeTab, setActiveTab] = useState(() => (
    isMaintenance ? 'tech-tasks' : isFacultyOrStaff ? 'faculty-submit' : isCampusAdmin ? 'campus-admin-dashboard' : 'executive-dashboard'
  ));
  const [jobRequestStatus, setJobRequestStatus] = useState('all');
  // Sidebar collapse control — the toggle lives in the navbar, aligned with
  // the brand, and is shared by every role layout.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setSidebarCollapsed((v) => !v);

  // Automatically reset to the proper role tab when logging in or switching accounts
  useEffect(() => {
    if (isMaintenance) {
      setActiveTab(prev => (prev && (prev.startsWith('tech-') || prev === 'replacement-requests' || prev === 'settings') ? prev : 'tech-tasks'));
    } else if (isFacultyOrStaff) {
      setActiveTab(prev => (prev && (prev.startsWith('faculty-') || prev === 'replacement-requests' || prev === 'settings') ? prev : 'faculty-submit'));
    } else if (isCampusAdmin) {
      setActiveTab(prev => (prev && ['campus-admin-dashboard', 'approval-history', 'official-documents', 'analytics-reports', 'communication-box', 'settings'].includes(prev) ? prev : 'campus-admin-dashboard'));
    } else if (isAdmin) {
      setActiveTab(prev => (prev && !prev.startsWith('tech-') && !prev.startsWith('faculty-') ? prev : 'executive-dashboard'));
    }
  }, [currentUser?.id, currentUser?.role, isAdmin, isCampusAdmin, isMaintenance, isFacultyOrStaff]);

  // If user is not logged in, show the dedicated FixIT Institutional Login Page
  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 10% 20%, #061352 0%, #030a2a 40%, #020617 100%)', display: 'flex', flexDirection: 'column' }}>
        <BackendStatus />
        <OfflineBanner />
        <LoginPage />
        <SystemFooter />
      </div>
    );
  }

  // 1. Role-based routing for Campus Administrator
  if (isCampusAdmin) {
    return (
      <div className="app-container">
        <BackendStatus />
        <OfflineBanner />
        <Navbar onToggleSidebar={toggleSidebar} />
        <div className="main-layout">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} />
          <main className="content-area" style={{ maxWidth: '1240px', margin: '0 auto', width: '100%', padding: '24px 20px' }}>
            <CampusAdminRoutes activeTab={activeTab} onTabChange={setActiveTab} />
          </main>
        </div>
        <SystemFooter />
        <LoginModal />
      </div>
    );
  }

  // 2. Role-based routing for Faculty and Staff
  if (isFacultyOrStaff) {
    return (
      <div className="app-container">
        <BackendStatus />
        <OfflineBanner />
        <Navbar onToggleSidebar={toggleSidebar} />
        <div className="main-layout">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} />
          <main className="content-area" style={{ maxWidth: '1240px', margin: '0 auto', width: '100%', padding: '24px 20px' }}>
            <FacultyRoutes activeTab={activeTab} onTabChange={setActiveTab} />
          </main>
        </div>
        <SystemFooter />
        <LoginModal />
      </div>
    );
  }

  // 3. Role-based routing for Maintenance Personnel
  if (isMaintenance) {
    return (
      <div className="app-container">
        <BackendStatus />
        <OfflineBanner />
        <Navbar onToggleSidebar={toggleSidebar} />
        <div className="main-layout">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} />
          <main className="content-area" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '20px 16px' }}>
            <MaintenanceRoutes activeTab={activeTab} onTabChange={setActiveTab} />
          </main>
        </div>
        <SystemFooter />
        <LoginModal />
      </div>
    );
  }

  return (
    <div className="app-container">
      <BackendStatus />
      <OfflineBanner />
      <Navbar onToggleSidebar={toggleSidebar} />
      
      <div className="main-layout">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} />
        
        <main className="content-area" style={{ paddingTop: '24px' }}>
          <AdminRoutes
            activeTab={activeTab}
            onTabChange={setActiveTab}
            jobRequestStatus={jobRequestStatus}
            setJobRequestStatus={setJobRequestStatus}
          />
        </main>
      </div>

      <SystemFooter />

      <LoginModal />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
