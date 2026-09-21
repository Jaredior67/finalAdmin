import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiLogin, getToken, setToken } from '../backend/api';

const AuthContext = createContext();

// NOTE: TEST_PERSONAS is kept ONLY so LoginModal.jsx's quick-select buttons
// still render without crashing. It is no longer used for authentication —
// real login always goes through the backend. If you want those quick-select
// buttons to actually work, create matching accounts via Register + admin
// approval (or npm run seed:admin for the admin one), using these emails.
export const TEST_PERSONAS = [
  {
    key: 'admin',
    roleName: 'PDAS Director / Head',
    title: 'PDAS Director',
    email: 'adminisatu.edu.ph@gmail.com',
    password: 'admin123',
    iconText: '🛡️',
  },
  {
    key: 'campus_admin',
    roleName: 'Approver',
    title: 'Approver',
    email: 'campusadmin@isatu.edu.ph',
    password: 'admin123',
    iconText: '🏛️',
  },
  {
    key: 'faculty',
    roleName: 'Faculty Requester',
    title: 'Faculty / College Dean',
    email: 'faculty@isatu.edu.ph',
    password: 'faculty123',
    iconText: '🎓',
  },
  {
    key: 'staff',
    roleName: 'Staff Requester',
    title: 'Laboratory Property Custodian',
    email: 'staff@isatu.edu.ph',
    password: 'staff123',
    iconText: '💼',
  },
  {
    key: 'maintenance',
    roleName: 'Maintenance Personnel',
    title: 'Lead Maintenance Specialist',
    email: 'maintenance@isatu.edu.ph',
    password: 'tech123',
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
      } catch (e) {
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
    return { success: false, error: 'Password reset is not available yet — contact the PDAS office.' };
  };

  const normalizedRole = String(currentUser?.role || currentUser?.userType || '').toLowerCase();
  const isCampusAdmin = Boolean(currentUser && (normalizedRole === 'campus_admin' || normalizedRole === 'campus_administrator'));
  const isAdmin = Boolean(currentUser && (normalizedRole === 'admin' || currentUser.isAdmin));
  const isFaculty = Boolean(currentUser && normalizedRole === 'faculty');
  const isStaff = Boolean(currentUser && normalizedRole === 'staff');
  const isMaintenance = Boolean(currentUser && (normalizedRole === 'technician' || normalizedRole === 'maintenance'));
  const isFacultyOrStaff = Boolean(isFaculty || isStaff);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        isCampusAdmin,
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
