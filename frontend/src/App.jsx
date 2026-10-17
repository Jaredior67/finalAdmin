import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
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
import { Spinner } from './components/ui/Spinner';

const RouteFallback = () => (
  <div style={{ padding: '60px 40px', textAlign: 'center', color: '#64748b', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
    <Spinner size={22} color="#001f9c" />
    <span>Loading workspace…</span>
  </div>
);

const ALLOWED_TABS_BY_ROLE = {
  admin: [
    'executive-dashboard', 'job-requests', 'official-documents',
    'preventive-calendar', 'archived-requests', 'audit-trail', 'user-management',
    'communication-box', 'analytics-reports', 'replacement-requests', 'print-labels', 'settings'
  ],
  campusAdmin: [
    'campus-admin-dashboard', 'campus-approvals', 'executive-dashboard',
    'official-documents', 'approval-history', 'communication-box', 'analytics-reports', 'settings'
  ],
  maintenance: [
    'tech-tasks', 'tech-emergency', 'tech-history', 'tech-calendar',
    'tech-messages', 'tech-documents', 'replacement-requests', 'settings'
  ],
  faculty: [
    'faculty-dashboard', 'faculty-tickets', 'faculty-history', 'faculty-messages',
    'replacement-requests', 'settings', 'faculty-urgent', 'faculty-submit',
    'supervisor-queue', 'supervisor-approvals', 'supervisor-dashboard'
  ]
};

function getRoleDefaultTab(auth) {
  if (auth.isMaintenance) return 'tech-tasks';
  if (auth.isFacultyOrStaff) return auth.isSupervisor ? 'supervisor-queue' : 'faculty-dashboard';
  if (auth.isCampusAdmin) return 'campus-admin-dashboard';
  if (auth.isAdmin) return 'executive-dashboard';
  return 'executive-dashboard';
}

function validateTabForAuth(tab, auth) {
  if (!tab || typeof tab !== 'string') return null;
  const cleanTab = tab.replace(/^#\/?/, '').trim();
  if (!cleanTab) return null;

  if (auth.isMaintenance) {
    return ALLOWED_TABS_BY_ROLE.maintenance.includes(cleanTab) ? cleanTab : null;
  }
  if (auth.isFacultyOrStaff) {
    const supervisorTabs = ['supervisor-queue', 'supervisor-approvals', 'supervisor-dashboard'];
    if (supervisorTabs.includes(cleanTab) && !auth.isSupervisor) return null;
    return ALLOWED_TABS_BY_ROLE.faculty.includes(cleanTab) ? cleanTab : null;
  }
  if (auth.isCampusAdmin) {
    return ALLOWED_TABS_BY_ROLE.campusAdmin.includes(cleanTab) ? cleanTab : null;
  }
  if (auth.isAdmin) {
    return ALLOWED_TABS_BY_ROLE.admin.includes(cleanTab) ? cleanTab : null;
  }
  return null;
}

function AppContent() {
  const auth = useAuth();
  const { currentUser, isAdmin, isCampusAdmin, isSupervisor, isMaintenance, isFacultyOrStaff } = auth;

  // Persist activeTab across refreshes & deep links while strictly validating role access
  const [activeTab, setActiveTabState] = useState(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const fromSession = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('fixit_active_tab') : null;
    const fromLocal = (currentUser?.id && typeof localStorage !== 'undefined') ? localStorage.getItem(`fixit_active_tab_${currentUser.id}`) : null;

    const validatedHash = validateTabForAuth(hash, auth);
    if (validatedHash) return validatedHash;

    const validatedSession = validateTabForAuth(fromSession, auth);
    if (validatedSession) return validatedSession;

    const validatedLocal = validateTabForAuth(fromLocal, auth);
    if (validatedLocal) return validatedLocal;

    return getRoleDefaultTab(auth);
  });

  const [jobRequestStatus, setJobRequestStatusState] = useState(() => {
    return (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('fixit_job_request_status')) || 'all';
  });

  const setJobRequestStatus = (status) => {
    setJobRequestStatusState(status);
    try {
      sessionStorage.setItem('fixit_job_request_status', status);
    } catch {}
  };

  const setActiveTab = (tabOrFn) => {
    setActiveTabState(prev => {
      const nextTab = typeof tabOrFn === 'function' ? tabOrFn(prev) : tabOrFn;
      const valid = validateTabForAuth(nextTab, auth) || getRoleDefaultTab(auth);
      try {
        sessionStorage.setItem('fixit_active_tab', valid);
        if (currentUser?.id) {
          localStorage.setItem(`fixit_active_tab_${currentUser.id}`, valid);
        }
        if (window.location.hash !== `#${valid}`) {
          window.history.replaceState(null, '', `#${valid}`);
        }
      } catch {}
      return valid;
    });
  };

  // Sidebar collapse control
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Track previous user ID to detect new login / account switch
  const prevUserIdRef = useRef(currentUser?.id || null);

  // Sync activeTab with role authorization on account switch or session refresh
  useEffect(() => {
    if (!currentUser) {
      prevUserIdRef.current = null;
      return;
    }

    const currentUserId = currentUser.id;
    const isNewLogin = prevUserIdRef.current !== currentUserId;
    prevUserIdRef.current = currentUserId;

    if (isNewLogin) {
      // On fresh login or switching accounts, ALWAYS land on the role's default dashboard
      const defaultTab = getRoleDefaultTab(auth);
      setActiveTabState(defaultTab);
      try {
        sessionStorage.setItem('fixit_active_tab', defaultTab);
        if (currentUserId) {
          localStorage.setItem(`fixit_active_tab_${currentUserId}`, defaultTab);
        }
        if (window.location.hash !== `#${defaultTab}`) {
          window.history.replaceState(null, '', `#${defaultTab}`);
        }
      } catch {}
      return;
    }

    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const validatedFromHash = validateTabForAuth(hash, auth);
    const validatedCurrent = validateTabForAuth(activeTab, auth);

    const targetTab = validatedFromHash || validatedCurrent || getRoleDefaultTab(auth);
    if (targetTab !== activeTab) {
      setActiveTabState(targetTab);
    }

    try {
      sessionStorage.setItem('fixit_active_tab', targetTab);
      if (currentUser.id) {
        localStorage.setItem(`fixit_active_tab_${currentUser.id}`, targetTab);
      }
      if (window.location.hash !== `#${targetTab}`) {
        window.history.replaceState(null, '', `#${targetTab}`);
      }
    } catch {}
  }, [currentUser?.id, currentUser?.role, auth.isAdmin, auth.isCampusAdmin, auth.isMaintenance, auth.isFacultyOrStaff, auth.isSupervisor]);

  // Handle browser Back / Forward navigation buttons and URL hash edits
  useEffect(() => {
    const handleHashChange = () => {
      const valid = validateTabForAuth(window.location.hash, auth);
      if (valid && valid !== activeTab) {
        setActiveTabState(valid);
        try {
          sessionStorage.setItem('fixit_active_tab', valid);
        } catch {}
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab, auth]);

  // If user is not logged in, show the dedicated FixIT Institutional Login Page
  if (!currentUser) {
    return (
      <div style={{ minHeight: '100dvh', background: '#EEF2F8', display: 'flex', flexDirection: 'column' }}>
        <BackendStatus />
        <OfflineBanner />
        <LoginPage />
        <SystemFooter />
      </div>
    );
  }

  // 1. Role-based routing for Faculty/Staff (includes designated supervisors)
  if (isFacultyOrStaff) {
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
              <FacultyRoutes activeTab={activeTab} onTabChange={setActiveTab} />
            </Suspense>
          </main>
        </div>
        <SystemFooter />
        <LoginModal />
      </div>
    );
  }

  // 2. Role-based routing for Campus Administrator
  if (isCampusAdmin) {
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
              <CampusAdminRoutes activeTab={activeTab} onTabChange={setActiveTab} />
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
          <main className="content-area" id="main-content" style={{ paddingTop: '24px' }}>
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
