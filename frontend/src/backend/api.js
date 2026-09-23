const resolveApiBase = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.port === '5000') {
        return '/api';
      }
      return 'http://localhost:5000/api';
    }
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:5000/api';
};

const API_BASE = resolveApiBase();
const TOKEN_STORAGE_KEY = 'fixit_pdas_token_v1';

const normalizeRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  if (!role) return 'faculty';
  if (['admin', 'administrator'].includes(role)) return 'admin';
  if (['faculty', 'faculty member', 'teacher', 'instructor'].includes(role)) return 'faculty';
  if (['staff', 'staff member', 'employee'].includes(role)) return 'staff';
  if (['maintenance', 'technician', 'tech', 'maintenance personnel'].includes(role)) return 'maintenance';
  return role;
};

const normalizeRoleTitle = (role) => {
  switch (role) {
    case 'admin':
      return 'PDAS Director (Admin)';
    case 'maintenance':
      return 'Maintenance Personnel';
    case 'staff':
      return 'Staff Requester';
    case 'faculty':
    default:
      return 'Faculty Requester';
  }
};

const normalizeUser = (user) => {
  if (!user) return null;

  const firstName = user.first_name ?? user.firstName ?? '';
  const middleName = user.middle_name ?? user.middleName ?? '';
  const lastName = user.last_name ?? user.lastName ?? '';
  const role = normalizeRole(user.role ?? user.userType ?? user.user_type);
  const displayName = user.name || `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim() || user.email || 'User';

  const rawStatus = String(user.status || 'Active').trim().toLowerCase();
  const normalizedStatus = rawStatus === 'inactive' || rawStatus === 'suspended' ? 'Inactive' : 'Active';

  return {
    ...user,
    id: user.id,
    firstName,
    middleName,
    lastName,
    name: displayName,
    email: user.email || user.gmail || '',
    department: user.department || '',
    contactNumber: user.contact_number ?? user.contactNumber ?? user.phone ?? '',
    gender: user.gender || '',
    address: user.address || '',
    birthday: user.birthday || '',
    age: user.age || null,
    idPhotoUrl: user.id_photo_url ?? user.idPhotoUrl ?? user.idPreviewUrl ?? '',
    role,
    userType: user.userType ?? user.user_type ?? role,
    roleTitle: user.roleTitle || normalizeRoleTitle(role),
    title: user.title || user.roleTitle || normalizeRoleTitle(role),
    status: normalizedStatus,
  };
};

const normalizeRegistration = (row) => {
  if (!row) return null;
  const firstName = row.first_name ?? row.firstName ?? '';
  const middleName = row.middle_name ?? row.middleName ?? '';
  const lastName = row.last_name ?? row.lastName ?? '';
  return {
    ...row,
    firstName,
    middleName,
    lastName,
    name: row.name || `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim(),
    gmail: row.email || row.gmail || '',
    email: row.email || row.gmail || '',
    contactNumber: row.contact_number ?? row.contactNumber ?? row.phone ?? '',
    department: row.department || '',
    gender: row.gender || '',
    address: row.address || '',
    birthday: row.birthday || '',
    age: row.age || null,
    idPhotoUrl: row.id_photo_url ?? row.idPhotoUrl ?? row.idPreviewUrl ?? '',
    reason: row.rejection_reason ?? row.reason ?? '',
  };
};

export const getToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);

export const setToken = (token) => {
  if (!token) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      'Cannot reach the backend server. Make sure it is running via XAMPP and start-dev.bat.'
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || 'Request failed.';
    throw new Error(message);
  }

  return payload;
}

export const apiLogin = async (email, password, role) => {
  const payload = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
  });

  return {
    token: payload.token,
    user: normalizeUser(payload.user),
  };
};

// Phase 2: best-effort server-side session invalidation. Never blocks local
// sign-out (e.g. when offline) — the token is always discarded client-side.
export const apiLogout = async () => {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch {
    // Offline or already invalid — local sign-out still proceeds.
  }
};

export const apiRegister = async (regData = {}) => {
  const payload = {
    firstName: regData.firstName ?? regData.first_name ?? '',
    middleName: regData.middleName ?? regData.middle_name ?? '',
    lastName: regData.lastName ?? regData.last_name ?? '',
    email: regData.email ?? regData.gmail ?? '',
    password: regData.password ?? '',
    role: normalizeRole(regData.role ?? regData.userType ?? regData.user_type),
    department: regData.department || regData.office || null,
    contactNumber: regData.contactNumber ?? regData.contact_number ?? regData.phone ?? null,
    gender: regData.gender || null,
    address: regData.address || null,
    birthday: regData.birthday || null,
    age: regData.age || null,
    idPhotoUrl: regData.idPhotoUrl ?? regData.idPreviewUrl ?? null,
  };

  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const apiGetUsers = async () => {
  const payload = await request('/users');
  return Array.isArray(payload) ? payload.map(normalizeUser) : [];
};

export const apiGetMessageParticipants = async () => {
  const payload = await request('/messages/participants');
  return Array.isArray(payload) ? payload.map(normalizeUser) : [];
};

export const apiGetPendingRegistrations = async () => {
  const payload = await request('/users/registrations?status=pending');
  return Array.isArray(payload) ? payload.map(normalizeRegistration) : [];
};

export const apiGetRejectedRegistrations = async () => {
  const payload = await request('/users/registrations?status=rejected');
  return Array.isArray(payload) ? payload.map(normalizeRegistration) : [];
};

export const apiApproveRegistration = async (regId) => request(`/users/registrations/${regId}/approve`, { method: 'PUT' });

export const apiRejectRegistration = async (regId, reason = 'Application details could not be verified by PDAS.') =>
  request(`/users/registrations/${regId}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });

export const apiCreateUser = async (userData = {}) => {
  const payload = {
    firstName: userData.firstName ?? userData.first_name ?? '',
    middleName: userData.middleName ?? userData.middle_name ?? '',
    lastName: userData.lastName ?? userData.last_name ?? '',
    email: userData.email ?? userData.gmail ?? '',
    password: userData.password ?? '',
    role: normalizeRole(userData.role ?? userData.userType ?? 'maintenance'),
    department: userData.department || userData.office || null,
    contactNumber: userData.contactNumber ?? userData.contact_number ?? userData.phone ?? null,
    gender: userData.gender || null,
    address: userData.address || null,
    birthday: userData.birthday || null,
    age: userData.age || null,
    idPhotoUrl: userData.idPhotoUrl || null,
  };

  return request('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const apiUpdateUser = async (userId, updatedFields = {}) => {
  const payload = {
    firstName: updatedFields.firstName ?? updatedFields.first_name ?? null,
    middleName: updatedFields.middleName ?? updatedFields.middle_name ?? null,
    lastName: updatedFields.lastName ?? updatedFields.last_name ?? null,
    department: updatedFields.department ?? null,
    contactNumber: updatedFields.contactNumber ?? updatedFields.contact_number ?? updatedFields.phone ?? null,
    gender: updatedFields.gender ?? null,
    address: updatedFields.address ?? null,
    birthday: updatedFields.birthday ?? null,
    age: updatedFields.age ?? null,
    role: normalizeRole(updatedFields.role ?? updatedFields.userType ?? updatedFields.user_type ?? 'faculty'),
  };

  return request(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const apiSetUserStatus = async (userId, status) => {
  const normalized = String(status || '').trim().toLowerCase();
  const value = normalized === 'inactive' ? 'inactive' : 'active';

  return request(`/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: value }),
  });
};

export const apiRemoveUser = async (userId) => request(`/users/${userId}`, { method: 'DELETE' });

// Preventive Maintenance Schedules API
export const apiGetPreventiveSchedules = async () => request('/preventive-schedules');
export const apiCreatePreventiveSchedule = async (scheduleData) =>
  request('/preventive-schedules', {
    method: 'POST',
    body: JSON.stringify(scheduleData),
  });

// Job Requests API (live MySQL data for Reports & Analytics)
export const apiGetJobRequests = async () => request('/job-requests');

// Evaluations API (live ISO/IEC 25010 results)
export const apiGetEvaluations = async () => request('/evaluations');

// Audit trail API (PDAS Admin, read-only accountability log)
export const apiGetAuditLog = async (limit = 200) => request(`/audit-log?limit=${limit}`);

export const checkBackendHealth = async () => {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    if (res.ok) return { online: true };
    return { online: false, error: `Server returned ${res.status}` };
  } catch {
    return { online: false, error: 'Backend server is not reachable.' };
  }
};
