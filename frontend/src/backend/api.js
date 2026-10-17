const resolveApiBase = () => {
  // 1. Explicit override via Vite env var (highest priority)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const { hostname, port, protocol } = window.location;
    // Served directly by the backend on port 5000 — use relative path
    if (port === '5000') {
      return '/api';
    }
    // Served through Apache (port 80/443) in production — the backend runs
    // on the same host on port 5000. Using hostname (not "localhost") means
    // a phone on the LAN hitting http://192.168.x.x/ will call
    // http://192.168.x.x:5000/api instead of the unreachable
    // http://localhost:5000/api.
    // For Vite dev server (port 5173) the same logic applies.
    return `${protocol}//${hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
};

const API_BASE = resolveApiBase();
const TOKEN_STORAGE_KEY = 'fixit_pdas_token_v1';

const normalizeRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  if (!role) return 'faculty';
  if (['admin', 'administrator'].includes(role)) return 'admin';
  if (['campus_admin', 'campus administrator', 'approver'].includes(role)) return 'campus_admin';
  if (['supervisor', 'immediate supervisor', 'dept head', 'department head'].includes(role)) return 'supervisor';
  if (['faculty', 'faculty member', 'teacher', 'instructor'].includes(role)) return 'faculty';
  if (['staff', 'staff member', 'employee'].includes(role)) return 'staff';
  if (['maintenance', 'technician', 'tech', 'maintenance personnel'].includes(role)) return 'maintenance';
  return role;
};

const normalizeRoleTitle = (role) => {
  switch (role) {
    case 'admin':
      return 'PDAS Director (Admin)';
    case 'campus_admin':
      return 'Approver (Campus Administrator)';
    case 'supervisor':
      return 'Immediate Supervisor';
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
    office: user.office || '',
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
    availabilityStatus: user.availability_status ?? user.availabilityStatus ?? 'available',
    specialization: user.specialization ?? user.trade ?? 'General Maintenance',
    // Supervisor designation — the DB column is is_supervisor (0/1).
    // Normalize to a boolean so every consumer (table badge, edit checkbox)
    // can just do Boolean(user.isSupervisor) without knowing the DB shape.
    isSupervisor: Boolean(user.is_supervisor ?? user.isSupervisor),
    is_supervisor: user.is_supervisor ?? (user.isSupervisor ? 1 : 0),
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
    office: row.office || '',
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
    const err = new Error(
      'Cannot reach the backend server. Make sure it is running via XAMPP and start-dev.bat.'
    );
    // No response at all — a network failure rather than a rejection, so the
    // status is 0 and callers can tell "retry later" from "this is wrong".
    err.status = 0;
    err.isNetworkError = true;
    throw err;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || 'Request failed.';
    const err = new Error(message);
    // Carrying the status lets callers react differently: a 4xx means the
    // request itself is wrong and retrying it will fail the same way, while a
    // 5xx or a 0 is worth another attempt later.
    err.status = response.status;
    err.payload = payload;
    throw err;
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
    department: regData.department || null,
    office: regData.office || null,
    contactNumber: regData.contactNumber ?? regData.contact_number ?? regData.phone ?? null,
    gender: regData.gender || null,
    address: regData.address || null,
    birthday: regData.birthday || null,
    age: regData.age || null,
    idPhotoUrl: regData.idPhotoUrl ?? regData.idPreviewUrl ?? null,
    // RA 10173 consent timestamp. The server rejects registration without it.
    consentAt: regData.consentAt ?? null,
  };

  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

/**
 * Public status lookup for an applicant who has no account yet.
 *
 * Resolves to `{ status: 'pending' | 'approved' | 'rejected' | 'not_found',
 * reason, submittedAt, reviewedAt }`. An applicant cannot sign in before the
 * administrator approves them, so this is the only handle they have on their
 * own application — in particular, the rejection reason that the administrator
 * typed would otherwise never reach them.
 */
export const apiGetRegistrationStatus = async (email) => {
  const query = encodeURIComponent(String(email || '').trim());
  if (!query) return { status: 'not_found' };
  const payload = await request(`/auth/registration-status?email=${query}`);
  return payload && typeof payload === 'object' ? payload : { status: 'not_found' };
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

/* ---------------------------------------------------------------------------
   Audit trail. The Approval History page used to read a localStorage array that
   nothing ever wrote to, so it rendered an empty table no matter how many
   approvals had been recorded. Every decision is written to `audit_log` on the
   server inside the same transaction as the change itself — this reads it back.
   --------------------------------------------------------------------------- */
export const apiGetAuditLog = async (limit = 200) => {
  const payload = await request(`/audit-log?limit=${Number(limit) || 200}`);
  return Array.isArray(payload) ? payload : [];
};

/* ---------------------------------------------------------------------------
   Campus location registry. These used to exist only in React state and
   localStorage: the backend table was never written, so `campus_locations` sat
   empty and every `job_requests.location_id` came back NULL.
   --------------------------------------------------------------------------- */
export const apiGetCampusLocations = async () => {
  const payload = await request('/lookups/campus-locations');
  return Array.isArray(payload) ? payload : [];
};

export const apiAddCampusLocation = ({ building, floor, room, description, qrCodeRef }) =>
  request('/lookups/campus-locations', {
    method: 'POST',
    body: JSON.stringify({ building, floor, room, description, qrCode: qrCodeRef }),
  });

export const apiUpdateCampusLocation = (id, { building, floor, room, description, qrCodeRef }) =>
  request(`/lookups/campus-locations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ building, floor, room, description, qrCode: qrCodeRef }),
  });

export const apiDeleteCampusLocation = (id) =>
  request(`/lookups/campus-locations/${id}`, { method: 'DELETE' });

export const apiCreateUser = async (userData = {}) => {
  const payload = {
    firstName: userData.firstName ?? userData.first_name ?? '',
    middleName: userData.middleName ?? userData.middle_name ?? '',
    lastName: userData.lastName ?? userData.last_name ?? '',
    email: userData.email ?? userData.gmail ?? '',
    password: userData.password ?? '',
    role: normalizeRole(userData.role ?? userData.userType ?? 'maintenance'),
    department: userData.department || null,
    office: userData.office || null,
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
    office: updatedFields.office ?? null,
    contactNumber: updatedFields.contactNumber ?? updatedFields.contact_number ?? updatedFields.phone ?? null,
    gender: updatedFields.gender ?? null,
    address: updatedFields.address ?? null,
    birthday: updatedFields.birthday ?? null,
    age: updatedFields.age ?? null,
    specialization: updatedFields.specialization ?? null,
    availabilityStatus: updatedFields.availabilityStatus ?? updatedFields.availability_status ?? null,
    role: normalizeRole(updatedFields.role ?? updatedFields.userType ?? updatedFields.user_type ?? 'faculty'),
  };

  // Supervisor designation ("Designate as Immediate Supervisor / Program Head"
  // checkbox). Sent only when the caller passed it — a plain profile edit must
  // not send null and rely on the server's COALESCE to keep the stored flag.
  const isSupervisor = updatedFields.isSupervisor ?? updatedFields.is_supervisor;
  if (isSupervisor !== undefined && isSupervisor !== null) {
    payload.isSupervisor = isSupervisor;
  }

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

/* Supervisor designation & assignment (paper: an admin designates the Supervisor
   function on a Faculty/Staff account, then assigns which Faculty/Staff accounts
   fall under each Supervisor — reassignable at any time). All three routes are
   admin-only on the server. */
export const apiGetSupervisors = async () => {
  const payload = await request('/users/supervisors');
  return Array.isArray(payload) ? payload.map(normalizeUser) : [];
};

// { supervisors, employees, unassigned } — employees carry supervisor_id, which
// GET /users does not return, so this is how the edit form shows the current
// assignment of the account being edited.
export const apiGetSupervisorAssignments = async () => request('/users/supervisor-assignments');

// supervisorId: an account id to assign, or null to clear it ("Unassigned").
export const apiAssignSupervisor = async (userId, supervisorId) =>
  request(`/users/${userId}/assign-supervisor`, {
    method: 'PUT',
    body: JSON.stringify({ supervisorId }),
  });

export const apiDesignateSupervisor = async (userId, isSupervisor) =>
  request(`/users/${userId}/supervisor-designation`, {
    method: 'PUT',
    body: JSON.stringify({ isSupervisor: Boolean(isSupervisor) }),
  });

export const apiBulkAssignSupervisor = async ({ supervisorId, department, office }) =>
  request('/users/bulk-assign-supervisor', {
    method: 'PUT',
    body: JSON.stringify({ supervisorId, department, office }),
  });

export const apiUpdateMyAvailability = async (availabilityStatus) =>
  request('/auth/availability', {
    method: 'PUT',
    body: JSON.stringify({ availabilityStatus }),
  });

export const apiUpdateUserAvailability = async (userId, availabilityStatus) =>
  request(`/users/${userId}/availability`, {
    method: 'PUT',
    body: JSON.stringify({ availabilityStatus }),
  });

// Preventive Maintenance Schedules API
export const apiGetPreventiveSchedules = async () => request('/preventive-schedules');
export const apiCreatePreventiveSchedule = async (scheduleData) =>
  request('/preventive-schedules', {
    method: 'POST',
    body: JSON.stringify(scheduleData),
  });
export const apiDeletePreventiveSchedule = async (id) =>
  request(`/preventive-schedules/${encodeURIComponent(id)}`, { method: 'DELETE' });

// Job Requests API (live MySQL data for Reports & Analytics)
export const apiGetJobRequests = async (params = {}) => {
  const qs = new URLSearchParams();
  if (params.limit) qs.set('limit', params.limit);
  if (params.offset) qs.set('offset', params.offset);
  if (params.archived) qs.set('archived', params.archived);
  const query = qs.toString() ? `?${qs}` : '';
  const data = await request(`/job-requests${query}`);
  // The endpoint answers { rows, total, limit, offset }. Older builds answered a
  // bare array; normalise so callers only ever have to handle one shape.
  if (Array.isArray(data)) {
    return { rows: data, total: data.length, limit: params.limit || 100, offset: params.offset || 0 };
  }
  return data;
};

export const apiGetJobRequestStats = async ({ archived = false } = {}) => {
  const qs = archived ? '?archived=true' : '';
  const data = await request(`/job-requests/stats${qs}`);
  if (Array.isArray(data)) return { byStatus: {}, total: data.length };
  return data;
};

/* Notifications API (live MySQL — replaces localStorage) */
export const apiGetNotifications = async ({ limit = 50, offset = 0, unread = false } = {}) => {
  const qs = new URLSearchParams({ limit, offset });
  if (unread) qs.set('unread', 'true');
  const data = await request(`/notifications?${qs}`);
  // Support both old array shape and new { notifications, unread_count } shape
  if (Array.isArray(data)) return { notifications: data, unread_count: 0 };
  return data;
};
export const apiMarkNotificationRead = (id) => request(`/notifications/${id}/read`, { method: 'PUT' });
export const apiMarkAllNotificationsRead = () => request('/notifications/read-all', { method: 'PUT' });
export const apiDeleteNotification = (id) => request(`/notifications/${id}`, { method: 'DELETE' });
export const apiClearAllNotifications = () => request('/notifications', { method: 'DELETE' });


// Evaluations API (live ISO/IEC 25010 results)
export const apiGetEvaluations = async () => request('/evaluations');
export const apiSubmitEvaluation = async (evalData) => request('/evaluations', { method: 'POST', body: JSON.stringify(evalData) });

// 4-Party Approval Workflow API calls
export const apiCreateJobRequest = async (requestData) => request('/job-requests', { method: 'POST', body: JSON.stringify(requestData) });
export const apiReviseJobRequest = async (id, revisionData) => request(`/job-requests/${id}/revise`, { method: 'PUT', body: JSON.stringify(revisionData) });
export const apiUpdateJobRequestStatus = async (id, statusData) => request(`/job-requests/${id}/status`, { method: 'PUT', body: JSON.stringify(statusData) });
export const apiSupervisorAction = async (id, actionData) => request(`/job-requests/${id}/supervisor-action`, { method: 'POST', body: JSON.stringify(actionData) });
export const apiAdminAction = async (id, actionData) => request(`/job-requests/${id}/admin-action`, { method: 'POST', body: JSON.stringify(actionData) });
export const apiApproverAction = async (id, actionData) => request(`/job-requests/${id}/approver-action`, { method: 'POST', body: JSON.stringify(actionData) });
export const apiAssignTechnician = async (id, assignData) => request(`/job-requests/${id}/assign-technician`, { method: 'POST', body: JSON.stringify(assignData) });
export const apiFlagReplacement = async (id, flagData) => request(`/job-requests/${id}/replacement-flag`, { method: 'POST', body: JSON.stringify(flagData) });
export const apiArchiveJobRequest = async (id) => request(`/job-requests/${id}/archive`, { method: 'PUT' });
export const apiUnarchiveJobRequest = async (id) => request(`/job-requests/${id}/unarchive`, { method: 'PUT' });
export const apiUpdateReplacementFlag = async (id, payload) => request(`/job-requests/${id}/replacement-flag`, { method: 'PUT', body: JSON.stringify(payload) });
export const apiGetJobRequestDocPdf = async (id) => request(`/job-requests-doc/${id}/pdf`);

// The audit-trail reader lives next to the other account-facing calls above.

export const checkBackendHealth = async () => {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    if (res.ok) return { online: true };
    return { online: false, error: `Server returned ${res.status}` };
  } catch {
    return { online: false, error: 'Backend server is not reachable.' };
  }
};
