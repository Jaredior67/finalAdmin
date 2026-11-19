import assert from 'node:assert/strict';

const BASE = 'http://localhost:5000/api';

async function post(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function get(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function put(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function del(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

console.log('=== Super Admin Verification ===\n');

// 1. Super Admin Login
const superLogin = await post(`${BASE}/auth/login`, {
  email: 'superadmin@gmail.com',
  password: 'superadmin123',
  role: 'superadmin'
});
assert.equal(superLogin.status, 200, 'Super admin login failed');
assert.ok(superLogin.data.token, 'Super admin token missing');
assert.equal(superLogin.data.user.role, 'superadmin', 'Role is not superadmin');
console.log('  ok   Super Administrator can sign in with role: superadmin');
const superToken = superLogin.data.token;

// 2. Admin Login
const adminLogin = await post(`${BASE}/auth/login`, {
  email: 'admin@gmail.com',
  password: 'admin123',
  role: 'admin'
});
assert.equal(adminLogin.status, 200, 'Admin login failed');
const adminToken = adminLogin.data.token;
console.log('  ok   PDAS Administrator can sign in');

// 3. Super Admin access to protected endpoints
const superRegs = await get(`${BASE}/users/registrations`, superToken);
assert.equal(superRegs.status, 200, 'Super admin cannot access registrations');
console.log('  ok   Super Admin can read pending registrations');

// 4. Admin blocked from registrations
const adminRegs = await get(`${BASE}/users/registrations`, adminToken);
assert.equal(adminRegs.status, 403, `Admin was not blocked from registrations (status ${adminRegs.status})`);
console.log('  ok   PDAS Admin is forbidden (403) from accessing registrations');

// 5. Admin blocked from adding campus locations
const adminLocAdd = await post(`${BASE}/lookups/campus-locations`, { building: 'Test Bldg' }, adminToken);
assert.equal(adminLocAdd.status, 403, `Admin was not blocked from adding campus location (status ${adminLocAdd.status})`);
console.log('  ok   PDAS Admin is forbidden (403) from adding campus locations');

// 6. Admin CAN read users list (for technician assignment in job requests)
const adminUsers = await get(`${BASE}/users`, adminToken);
assert.equal(adminUsers.status, 200, `Admin cannot read users (status ${adminUsers.status})`);
assert.ok(Array.isArray(adminUsers.data), 'Users list is not an array');
console.log('  ok   PDAS Admin CAN read users list (required for technician assignment)');

// 7. Super Admin location lifecycle (Add, Edit, Delete)
const newLoc = await post(`${BASE}/lookups/campus-locations`, {
  building: 'SuperAdmin Test Building',
  floor: '1st Floor',
  room: 'Room 101-SA',
  qrCode: `SA-TEST-${Date.now()}`
}, superToken);
assert.equal(newLoc.status, 201, `Super Admin could not create location: ${JSON.stringify(newLoc.data)}`);
const locId = newLoc.data.id;
console.log('  ok   Super Admin can add campus location');

const updateLoc = await put(`${BASE}/lookups/campus-locations/${locId}`, {
  description: 'Updated by SuperAdmin'
}, superToken);
assert.equal(updateLoc.status, 200, 'Super Admin could not update location');
console.log('  ok   Super Admin can update campus location');

const deleteLoc = await del(`${BASE}/lookups/campus-locations/${locId}`, superToken);
assert.equal(deleteLoc.status, 200, 'Super Admin could not delete location');
console.log('  ok   Super Admin can delete campus location');

console.log('\nALL SUPERADMIN TESTS PASSED!');
