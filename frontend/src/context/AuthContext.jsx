import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiLogin, apiLogout, getToken, setToken } from '../backend/api';

// Phase 2: idle timeout — 30 minutes without mouse/keyboard/touch activity
// ends the session automatically (limits unattended-session exposure).
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const AuthContext = createContext();

// NOTE: Role shortcuts fill in the email only — passwords are NEVER stored
// or displayed in the client. Real login always goes through the backend.
// Seeded demo accounts are created via Register + admin approval
// (or npm run seed:admin for the admin one).
export const TEST_PERSONAS = [
  {
    key: 'admin',
    roleName: 'System Administrator',
    title: 'PDAS Administrator',
    email: 'adminisatu.edu.ph@gmail.com',
    iconText: '🛡️',
  },
  {
    key: 'campus_admin',
    roleName: 'Approver',
    title: 'Campus Administrator (Approver)',
    email: 'campusadmin@isatu.edu.ph',
    iconText: '🏷️',
  },
  {
    key: 'faculty',
    roleName: 'Faculty Requester',
    title: 'Faculty / College Dean',
    email: 'faculty@isatu.edu.ph',
    iconText: '🎓',
  },
  {
    key: 'staff',
    roleName: 'Staff Requester',
    title: 'Laboratory Property Custodian',
    email: 'staff@isatu.edu.ph',
    iconText: '💼',
  },
  {
    key: 'maintenance',
    roleName: 'Maintenance Personnel',
    title: 'Lead Maintenance Specialist',
    email: 'maintenance@isatu.edu.ph',
    iconText: '🔧',
  },
];

const USER_STORAGE_KEY = 'fixit_pdas_active_user_v3';

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    // Only trust a saved user if we also still have a token; otherwise
    // the session is stale/invalid and we should treat them as logged out.
    const token = getToken();
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (token && saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [currentUser]);

  // Idle-timeout watcher — only active while signed in.
  const idleTimer = useRef(null);
  useEffect(() => {
    if (!currentUser) return undefined;
    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        apiLogout();
        setToken(null);
        setCurrentUser(null);
      }, IDLE_TIMEOUT_MS);
    };
    reset();
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [currentUser]);

  // Previously this bypassed login entirely and faked an admin session.
  // That's not safe against a real database of real accounts, so it now
  // just opens the login form instead.
  const loginAsAdmin = async () => {
    setIsLoginModalOpen(true);
    return false;
  };

  const loginWithCredentials = async (email, password, role) => {
    try {
      const { token, user } = await apiLogin(email, password, role);
      setToken(token);
      setCurrentUser(user);
      setIsLoginModalOpen(false);
      return { success: true, user };
    } catch (err) {
      return { success: false, error: err.message || 'Authentication failed. Please check your credentials.' };
    }
  };

  const logout = () => {
    // Server-side invalidation is best-effort (works offline by just clearing).
    apiLogout();
    setToken(null);
    setCurrentUser(null);
  };

  const switchUser = (userObj) => {
    setCurrentUser(userObj);
  };

  const updateCurrentUser = (updatedFields) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      return { ...prev, ...updatedFields };
    });
  };

  const resetPassword = async () => {
    // A proper token-based reset flow is a follow-up item (see DEPLOYMENT.md
    // known limitations). For now this is intentionally not implemented
    // against the real backend to avoid a fake success message.
    return { success: false, error: 'Password reset is not available. Contact the PDAS office.' };
  };

  const normalizedRole = String(currentUser?.role || currentUser?.userType || '').toLowerCase();
  const isCampusAdmin = Boolean(currentUser && (normalizedRole === 'campus_admin' || normalizedRole === 'campus_administrator'));
  // A user is a supervisor if their role is 'supervisor' OR they have the
  // is_supervisor designation flag set by an admin (faculty/staff users who
  // also serve as program heads / department heads).
  const isSupervisor = Boolean(currentUser && (
    normalizedRole === 'supervisor' ||
    currentUser.is_supervisor ||
    currentUser.isSupervisor
  ));
  const isAdmin = Boolean(currentUser && (normalizedRole === 'admin' || currentUser.isAdmin));
  const isFaculty = Boolean(currentUser && normalizedRole === 'faculty');
  const isStaff = Boolean(currentUser && normalizedRole === 'staff');
  const isMaintenance = Boolean(currentUser && (normalizedRole === 'technician' || normalizedRole === 'maintenance'));
  // Designated supervisors log in as faculty/staff and use the Faculty/Staff
  // dashboard (which shows a supervisor queue tab when is_supervisor=true).
  // isFacultyOrStaff is now true for supervisors as well.
  const isFacultyOrStaff = Boolean(isFaculty || isStaff);


  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        isCampusAdmin,
        isSupervisor,
        isFaculty,
        isStaff,
        isMaintenance,
        isFacultyOrStaff,
        loginAsAdmin,
        loginWithCredentials,
        switchUser,
        updateCurrentUser,
        resetPassword,
        logout,
        isLoginModalOpen,
        setIsLoginModalOpen,
        TEST_PERSONAS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
