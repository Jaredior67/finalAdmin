import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginModal } from './components/auth/LoginModal';
import { LoginPage } from './components/auth/LoginPage';
import { SystemFooter } from './components/layout/SystemFooter';
import { BackendStatus } from './components/common/BackendStatus';
import { OfflineBanner } from './components/common/OfflineBanner';
import { SkipLink } from './components/common/SkipLink';

// Role Workspaces
const AdminRoutes = lazy(() => import('./routes/AdminRoutes').then(m => ({ default: m.AdminRoutes })));
const FacultyRoutes = lazy(() => import('./routes/FacultyRoutes').then(m => ({ default: m.FacultyRoutes })));
const MaintenanceRoutes = lazy(() => import('./routes/MaintenanceRoutes').then(m => ({ default: m.MaintenanceRoutes })));
const CampusAdminRoutes = lazy(() => import('./routes/CampusAdminRoutes').then(m => ({ default: m.CampusAdminRoutes })));
const RouteFallback = () => (
  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
    Loading workspace…
  </div>
);

function AppContent() {
  const { currentUser, isAdmin, isCampusAdmin, isMaintenance, isFacultyOrStaff } = useAuth();
  const [activeTab, setActiveTab] = useState(() => (
    isMaintenance ? 'tech-tasks' : isFacultyOrStaff ? 'faculty-dashboard' : isCampusAdmin ? 'campus-admin-dashboard' : 'executive-dashboard'
  ));
  const [jobRequestStatus, setJobRequestStatus] = useState('all');
  // Sidebar collapse control — the toggle lives in the sidebar header
  // and is shared by every role layout.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Automatically reset to the proper role tab when logging in or switching accounts
  useEffect(() => {
    if (isMaintenance) {
      setActiveTab(prev => (prev && (prev.startsWith('tech-') || prev === 'replacement-requests' || prev === 'settings') ? prev : 'tech-tasks'));
    } else if (isFacultyOrStaff) {
      setActiveTab(prev => (prev && (prev.startsWith('faculty-') || prev === 'replacement-requests' || prev === 'settings') ? prev : 'faculty-dashboard'));
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
        <SkipLink />
        <BackendStatus />
        <OfflineBanner />
        <Navbar onNavigateTab={(tab) => setActiveTab(tab)} sidebarCollapsed={sidebarCollapsed} />
        <div className="main-layout">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} />
          <main className="content-area" id="main-content" style={{ maxWidth: '1240px', margin: '0 auto', width: '100%', padding: '24px 20px' }}>
            <Suspense fallback={<RouteFallback />}>
              <CampusAdminRoutes activeTab={activeTab} onTabChange={setActiveTab} />
            </Suspense>
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
        <SkipLink />
        <BackendStatus />
        <OfflineBanner />
        <Navbar onNavigateTab={(tab) => setActiveTab(tab)} sidebarCollapsed={sidebarCollapsed} />
        <div className="main-layout">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} />
          <main className="content-area" id="main-content" style={{ maxWidth: '1240px', margin: '0 auto', width: '100%', padding: '24px 20px' }}>
            <Suspense fallback={<RouteFallback />}>
              <FacultyRoutes activeTab={activeTab} onTabChange={setActiveTab} />
            </Suspense>
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
        <SkipLink />
        <BackendStatus />
        <OfflineBanner />
        <Navbar onNavigateTab={(tab) => setActiveTab(tab)} sidebarCollapsed={sidebarCollapsed} />
        <div className="main-layout">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} />
                    <main className="content-area" id="main-content" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '20px 16px' }}>
            <Suspense fallback={<RouteFallback />}>
              <MaintenanceRoutes activeTab={activeTab} onTabChange={setActiveTab} />
            </Suspense>
          </main>
        </div>
        <SystemFooter />
        <LoginModal />
      </div>
    );
  }

  return (
    <div className="app-container">
      <SkipLink />
      <BackendStatus />
      <OfflineBanner />
      <Navbar onNavigateTab={(tab) => setActiveTab(tab)} sidebarCollapsed={sidebarCollapsed} />
      
      <div className="main-layout">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} collapsed={sidebarCollapsed} onToggleCollapse={setSidebarCollapsed} />
        
                <main className="content-area" id="main-content" style={{ paddingTop: '24px' }}>
          <Suspense fallback={<RouteFallback />}>
            <AdminRoutes
              activeTab={activeTab}
              onTabChange={setActiveTab}
              jobRequestStatus={jobRequestStatus}
              setJobRequestStatus={setJobRequestStatus}
            />
          </Suspense>
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
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
