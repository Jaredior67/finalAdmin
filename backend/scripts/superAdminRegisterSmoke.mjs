import assert from 'node:assert/strict';

const BASE = 'http://localhost:5000/api';

async function post(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
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

console.log('=== Super Admin Direct User Registration Smoke Test ===\n');

// 1. Authenticate as Super Admin
const superLogin = await post(`${BASE}/auth/login`, {
  email: 'superadmin@gmail.com',
  password: 'superadmin123',
  role: 'superadmin'
});
assert.equal(superLogin.status, 200, 'Super admin login failed');
const superToken = superLogin.data.token;
console.log('  ok   Super Administrator authenticated');

// 2. Unauthenticated user creation should be rejected (401 or 403)
const unauthCreate = await post(`${BASE}/users`, {
  firstName: 'Hacker',
  lastName: 'User',
  email: 'hacker@gmail.com',
  password: 'Password123',
  role: 'faculty'
});
assert.ok([401, 403].includes(unauthCreate.status), 'Unauthenticated user creation must be forbidden');
console.log('  ok   Unauthenticated user registration rejected (401/403)');

// 3. Regular admin cannot create user
const adminLogin = await post(`${BASE}/auth/login`, {
  email: 'admin@gmail.com',
  password: 'admin123',
  role: 'admin'
});
assert.equal(adminLogin.status, 200, 'Admin login failed');
const adminToken = adminLogin.data.token;

const adminCreate = await post(`${BASE}/users`, {
  firstName: 'Unauthorized',
  lastName: 'User',
  email: 'unauth_user@gmail.com',
  password: 'Password123',
  role: 'faculty'
}, adminToken);
assert.equal(adminCreate.status, 403, 'Regular admin must be forbidden from registering users');
console.log('  ok   Regular PDAS admin forbidden (403) from registering users');

// 4. Super Admin registers a faculty user directly with ID Number and Profile Photo
const samplePhoto = 'data:image/jpeg;base64,' + Buffer.from('superadmin-provisioned-photo').toString('base64');
const testIdNumber = '2026-SUPER-9901';
const testEmail = `super_registered_${Date.now()}@dumangas.isatu.edu.ph`;
const testPassword = 'Password123!';

const createRes = await post(`${BASE}/users`, {
  firstName: 'Carlos',
  middleName: 'A.',
  lastName: 'Reyes',
  extName: 'Jr.',
  idNumber: testIdNumber,
  email: testEmail,
  password: testPassword,
  role: 'faculty',
  department: 'BSIT',
  contactNumber: '09171234567',
  gender: 'Male',
  idPhotoUrl: samplePhoto,
}, superToken);

assert.equal(createRes.status, 201, `Super Admin registration failed: ${JSON.stringify(createRes.data)}`);
const newUserId = createRes.data.id;
console.log(`  ok   Super Admin directly registered user (${testEmail}, ID: ${testIdNumber})`);

// 5. Verify the newly registered user can immediately log in
const userLogin = await post(`${BASE}/auth/login`, {
  email: testEmail,
  password: testPassword,
  role: 'faculty'
});
assert.equal(userLogin.status, 200, `Newly registered user failed to login: ${JSON.stringify(userLogin.data)}`);
assert.equal(userLogin.data.user.id_number, testIdNumber, 'User id_number mismatch on login');
assert.equal(userLogin.data.user.id_photo_url, samplePhoto, 'User profile photo mismatch on login');
console.log('  ok   Newly registered user successfully logged in with immediate active status');

// 6. Cleanup created test user
const cleanupRes = await del(`${BASE}/users/${newUserId}`, superToken);
assert.equal(cleanupRes.status, 200, 'Failed to cleanup test user');
console.log('  ok   Test user cleaned up');

console.log('\nALL SUPER ADMIN USER REGISTRATION TESTS PASSED!\n');
