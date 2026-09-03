import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const TEST_PERSONAS = [
  {
    id: 'usr_pdas_01',
    key: 'admin',
    roleName: 'PDAS Director (Admin)',
    name: 'Engr. Reynaldo Bautista',
    title: 'PDAS Director',
    role: 'admin',
    roleTitle: 'PDAS Director / Head Administrator',
    department: 'PDAS Administration',
    email: 'pdas.director@dumangas.isatu.edu.ph',
    password: 'admin123',
    initial: 'A',
    avatarColor: '#001f9c',
    isAdmin: true,
    badgeColor: '#001f9c',
    iconText: '🛡️',
    phone: '+63 917 123 4567',
    idNumber: 'ISATU-ADM-2018-001'
  },
  {
    id: 'usr_faculty_01',
    key: 'faculty',
    roleName: 'Faculty Requisitioner',
    name: 'Dr. Elena Ramos',
    title: 'Faculty / College Dean',
    role: 'faculty',
    roleTitle: 'Dean, College of Engineering & Architecture',
    department: 'College of Engineering & Architecture',
    email: 'elena.ramos.isatu@gmail.com',
    password: 'faculty123',
    initial: 'F',
    avatarColor: '#1d4ed8',
    isAdmin: false,
    badgeColor: '#1d4ed8',
    iconText: '🎓',
    phone: '+63 918 333 4455',
    idNumber: 'ISATU-FAC-2019-042'
  },
  {
    id: 'usr_staff_01',
    key: 'staff',
    roleName: 'Staff Requisitioner',
    name: 'Glenda Montenegro',
    title: 'Laboratory Property Custodian',
    role: 'staff',
    roleTitle: 'Lab Technician & Property Custodian',
    department: 'Industrial Technology & Workshops',
    email: 'glenda.montenegro.staff@gmail.com',
    password: 'staff123',
    initial: 'S',
    avatarColor: '#059669',
    isAdmin: false,
    badgeColor: '#059669',
    iconText: '💼',
    phone: '+63 927 888 9900',
    idNumber: 'ISATU-STF-2021-118'
  },
  {
    id: 'usr_tech_01',
    key: 'maintenance',
    roleName: 'Maintenance Personnel',
    name: 'Mark Villanueva',
    title: 'Lead Maintenance Specialist',
    role: 'maintenance',
    roleTitle: 'Senior Electrical & HVAC Technician',
    department: 'PDAS Technical Unit',
    specialization: 'Electrical & HVAC',
    email: 'mark.villanueva.isatu@gmail.com',
    password: 'tech123',
    initial: 'M',
    avatarColor: '#d97706',
    isAdmin: false,
    badgeColor: '#d97706',
    iconText: '🔧',
    phone: '+63 920 456 7890',
    idNumber: 'ISATU-TEC-2020-055'
  }
];

export const ADMIN_USER = TEST_PERSONAS[0]; // Admin is index 0

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('fixit_pdas_active_user_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          const overrides = JSON.parse(localStorage.getItem('fixit_pdas_profile_overrides_v3') || '{}');
          return { ...parsed, ...(overrides[parsed.id] || {}) };
        }
      } catch (e) {
        return ADMIN_USER;
      }
    }
    try {
      const overrides = JSON.parse(localStorage.getItem('fixit_pdas_profile_overrides_v3') || '{}');
      return { ...ADMIN_USER, ...(overrides[ADMIN_USER.id] || {}) };
    } catch (e) {
      return ADMIN_USER;
    }
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('fixit_pdas_active_user_v3', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('fixit_pdas_active_user_v3');
    }
  }, [currentUser]);

  const loginAsAdmin = () => {
    setCurrentUser(ADMIN_USER);
    setIsLoginModalOpen(false);
    return true;
  };

  const loginAsPersona = (personaKey) => {
    const persona = TEST_PERSONAS.find(p => p.key === personaKey) || ADMIN_USER;
    setCurrentUser(persona);
    setIsLoginModalOpen(false);
    return persona;
  };

  const loginWithCredentials = (emailOrUser, password) => {
    const cleanEmail = emailOrUser.trim().toLowerCase();
    let profileOverrides = {};
    try {
      profileOverrides = JSON.parse(localStorage.getItem('fixit_pdas_profile_overrides_v3') || '{}');
    } catch (e) {
      profileOverrides = {};
    }

    // Check against predefined personas first
    const matchedPersona = TEST_PERSONAS.find(p => 
      p.email.toLowerCase() === cleanEmail || 
      p.email.split('@')[0].toLowerCase() === cleanEmail ||
      (cleanEmail === 'faculty' && p.key === 'faculty') ||
      (cleanEmail === 'admin' && p.key === 'admin') ||
      (cleanEmail === 'staff' && p.key === 'staff') ||
      ((cleanEmail.includes('maintenance') || cleanEmail.includes('tech')) && p.key === 'maintenance')
    );

    if (matchedPersona) {
      const account = { ...matchedPersona, ...(profileOverrides[matchedPersona.id] || {}) };
      if (password === account.password) {
        setCurrentUser(account);
        setIsLoginModalOpen(false);
        return { success: true, user: account };
      }
    }

    // Check saved custom users in localStorage
    try {
      const savedUsers = JSON.parse(localStorage.getItem('fixit_pdas_users_v3') || '[]');
      const customMatched = savedUsers.find(u => 
        (u.email && u.email.toLowerCase() === cleanEmail) || 
        (u.gmail && u.gmail.toLowerCase() === cleanEmail)
      );
      if (customMatched) {
        if (customMatched.status === 'Inactive') {
          return { success: false, error: 'This account is inactive. Please contact the PDAS Administrator.' };
        }
        if (customMatched.password && customMatched.password === password) {
          const normalizedUser = {
            ...customMatched,
            role: String(customMatched.role || customMatched.userType || 'faculty').toLowerCase() === 'technician' ? 'maintenance' : String(customMatched.role || customMatched.userType || 'faculty').toLowerCase()
          };
          setCurrentUser(normalizedUser);
          setIsLoginModalOpen(false);
          return { success: true, user: normalizedUser };
        }
      }
    } catch (e) {
      // ignore
    }

    return { 
      success: false, 
      error: 'Invalid credentials. Please select an authorized account role or enter demo password.' 
    };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const switchUser = (userObj) => {
    setCurrentUser(userObj);
  };

  const updateCurrentUser = (updatedFields) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updatedFields };
      try {
        const overrides = JSON.parse(localStorage.getItem('fixit_pdas_profile_overrides_v3') || '{}');
        localStorage.setItem('fixit_pdas_profile_overrides_v3', JSON.stringify({
          ...overrides,
          [updated.id]: { ...(overrides[updated.id] || {}), ...updatedFields }
        }));
        const savedUsers = JSON.parse(localStorage.getItem('fixit_pdas_users_v3') || '[]');
        const updatedUsers = savedUsers.map(user => user.id === updated.id ? { ...user, ...updatedFields } : user);
        localStorage.setItem('fixit_pdas_users_v3', JSON.stringify(updatedUsers));
      } catch (e) {
        // Keep the active session usable if stored users cannot be read.
      }
      localStorage.setItem('fixit_pdas_active_user_v3', JSON.stringify(updated));
      return updated;
    });
  };

  const resetPassword = (email, newPassword) => {
    const cleanEmail = email.trim().toLowerCase();
    const persona = TEST_PERSONAS.find(user => user.email.toLowerCase() === cleanEmail);
    if (persona) {
      const overrides = JSON.parse(localStorage.getItem('fixit_pdas_profile_overrides_v3') || '{}');
      localStorage.setItem('fixit_pdas_profile_overrides_v3', JSON.stringify({
        ...overrides,
        [persona.id]: { ...(overrides[persona.id] || {}), password: newPassword }
      }));
      if (currentUser?.id === persona.id) setCurrentUser({ ...currentUser, password: newPassword });
      return { success: true };
    }

    try {
      const savedUsers = JSON.parse(localStorage.getItem('fixit_pdas_users_v3') || '[]');
      const match = savedUsers.find(user => (user.email || user.gmail || '').toLowerCase() === cleanEmail);
      if (!match) return { success: false, error: 'No account was found for that email address.' };
      const updatedUsers = savedUsers.map(user => user.id === match.id ? { ...user, password: newPassword } : user);
      localStorage.setItem('fixit_pdas_users_v3', JSON.stringify(updatedUsers));
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Account recovery is temporarily unavailable.' };
    }
  };

  const normalizedRole = String(currentUser?.role || currentUser?.userType || '').toLowerCase();
  const isAdmin = Boolean(currentUser && (
    currentUser.id === ADMIN_USER.id ||
    currentUser.email?.toLowerCase() === ADMIN_USER.email.toLowerCase() ||
    normalizedRole === 'admin' ||
    currentUser.isAdmin
  ));
  const isFaculty = Boolean(currentUser && normalizedRole === 'faculty');
  const isStaff = Boolean(currentUser && normalizedRole === 'staff');
  const isMaintenance = Boolean(currentUser && (normalizedRole === 'maintenance' || normalizedRole === 'technician'));
  const isFacultyOrStaff = Boolean(isFaculty || isStaff);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        isFaculty,
        isStaff,
        isMaintenance,
        isFacultyOrStaff,
        loginAsAdmin,
        loginAsPersona,
        loginWithCredentials,
        switchUser,
        updateCurrentUser,
        resetPassword,
        logout,
        isLoginModalOpen,
        setIsLoginModalOpen,
        TEST_PERSONAS
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

