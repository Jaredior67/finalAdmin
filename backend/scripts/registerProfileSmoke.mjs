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

console.log('=== Registration Profile Photo & ID Number Verification ===\n');

// 1. Super Admin Login
const superLogin = await post(`${BASE}/auth/login`, {
  email: 'superadmin@gmail.com',
  password: 'superadmin123',
  role: 'superadmin'
});
assert.equal(superLogin.status, 200, 'Super admin login failed');
const superToken = superLogin.data.token;
console.log('  ok   Super Administrator authenticated');

// 2. Test registration rejection when ID Number is missing
const samplePhoto = 'data:image/jpeg;base64,' + Buffer.from('profile-photo-pixel').toString('base64');
const missingIdNum = await post(`${BASE}/auth/register`, {
  firstName: 'Test',
  lastName: 'Applicant',
  email: `testapplicant_${Date.now()}@gmail.com`,
  password: 'Password123',
  role: 'faculty',
  department: 'BSIT',
  idPhotoUrl: samplePhoto,
  consentAt: new Date().toISOString()
  // idNumber omitted intentionally
});
assert.equal(missingIdNum.status, 400, 'Registration should fail without ID number');
console.log('  ok   Registration correctly rejected when ID number is missing');

// 3. Register with ID Number and Profile Photo
const testEmail = `prof_applicant_${Date.now()}@gmail.com`;
const testIdNumber = '2026-TEST-7788';
const regSuccess = await post(`${BASE}/auth/register`, {
  firstName: 'Maria',
  middleName: 'D.',
  lastName: 'Santos',
  idNumber: testIdNumber,
  email: testEmail,
  password: 'Password123',
  role: 'faculty',
  department: 'BSIT',
  contactNumber: '09123456789',
  gender: 'Female',
  idPhotoUrl: samplePhoto,
  consentAt: new Date().toISOString()
});
assert.equal(regSuccess.status, 201, `Registration failed: ${JSON.stringify(regSuccess.data)}`);
const regId = regSuccess.data.id;
console.log(`  ok   Registration accepted with ID number (${testIdNumber}) and profile photo`);

// 4. Super Admin inspects pending registration queue
const pendingRes = await get(`${BASE}/users/registrations?status=pending`, superToken);
assert.equal(pendingRes.status, 200, 'Could not fetch registrations');
const targetReg = pendingRes.data.find(r => r.id === regId || r.email === testEmail);
assert.ok(targetReg, 'Registered applicant not found in pending list');
assert.equal(targetReg.id_number, testIdNumber, `Stored ID number mismatch: ${targetReg.id_number}`);
assert.equal(targetReg.id_photo_url, samplePhoto, 'Stored profile photo data mismatch');
console.log('  ok   Super Admin sees ID number and profile photo in pending queue');

// 5. Super Admin approves registration
const approveRes = await put(`${BASE}/users/registrations/${targetReg.id}/approve`, {}, superToken);
assert.equal(approveRes.status, 200, `Approval failed: ${JSON.stringify(approveRes.data)}`);
const approvedUserId = approveRes.data.userId;
console.log('  ok   Super Admin successfully approved applicant');

// 6. Newly approved user logs in
const userLogin = await post(`${BASE}/auth/login`, {
  email: testEmail,
  password: 'Password123',
  role: 'faculty_staff'
});
assert.equal(userLogin.status, 200, `New user login failed: ${JSON.stringify(userLogin.data)}`);
assert.equal(userLogin.data.user.idNumber, testIdNumber, `user.idNumber mismatch: ${userLogin.data.user.idNumber}`);
assert.equal(userLogin.data.user.avatarUrl, samplePhoto, 'user.avatarUrl does not match uploaded profile photo');
console.log('  ok   Approved user logged in with active idNumber and profile avatarUrl');

// 7. Clean up test user
if (approvedUserId) {
  await del(`${BASE}/users/${approvedUserId}`, superToken);
  console.log('  ok   Test account cleaned up');
}

console.log('\nALL PROFILE PHOTO & ID NUMBER TESTS PASSED!');
