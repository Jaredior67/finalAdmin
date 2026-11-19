// backend/scripts/plantillaRegistrationSmoke.mjs
// Verifies user registration with academic rank, plantilla position, maintenance,
// login with academic rank, self-profile update, and privilege escalation guards.

const BASE_URL = process.env.API_BASE || 'http://localhost:5000/api';

async function req(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('🧪 Starting Plantilla & User Registration Smoke Test...');

  // 1. Super Admin login
  console.log('\n1. Logging in as Super Admin...');
  const saLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'superadmin@gmail.com',
      password: 'superadmin123',
      role: 'superadmin'
    })
  });

  if (!saLogin.ok || !saLogin.data?.token) {
    throw new Error(`Super Admin login failed: ${JSON.stringify(saLogin.data)}`);
  }
  const saToken = saLogin.data.token;
  console.log('   ✓ Super Admin logged in successfully.');

  const createdUserIds = [];

  try {
    // 2. Register Faculty Member with Academic Rank
    console.log('\n2. Registering Faculty Member with Academic Rank ("Instructor I")...');
    const facRes = await req('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'FacultyPlantilla',
        idNumber: 'ISATU-FAC-PLANTILLA-01',
        email: 'test.faculty.plantilla@isatu.edu.ph',
        password: 'Password123!',
        role: 'faculty',
        department: 'College of Arts and Sciences',
        academicRank: 'Instructor I',
        gender: 'Female',
        contactNumber: '+63 917 111 2222'
      })
    });

    if (!facRes.ok) {
      throw new Error(`Faculty registration failed: ${JSON.stringify(facRes.data)}`);
    }
    const facultyId = facRes.data.id;
    createdUserIds.push(facultyId);
    console.log(`   ✓ Faculty created with id ${facultyId}.`);

    // 3. Register Administrative Staff with Plantilla Position
    console.log('\n3. Registering Administrative Staff with Plantilla Position ("Administrative Officer II")...');
    const staffRes = await req('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'StaffPlantilla',
        idNumber: 'ISATU-STF-PLANTILLA-01',
        email: 'test.staff.plantilla@isatu.edu.ph',
        password: 'Password123!',
        role: 'staff',
        office: 'Office of the Registrar',
        academicRank: 'Administrative Officer II',
        gender: 'Male',
        contactNumber: '+63 917 333 4444'
      })
    });

    if (!staffRes.ok) {
      throw new Error(`Staff registration failed: ${JSON.stringify(staffRes.data)}`);
    }
    const staffId = staffRes.data.id;
    createdUserIds.push(staffId);
    console.log(`   ✓ Staff created with id ${staffId}.`);

    // 4. Register Maintenance Personnel
    console.log('\n4. Registering Maintenance Personnel with Specialization ("Electrical & HVAC")...');
    const maintRes = await req('/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'MaintPersonnel',
        idNumber: 'ISATU-MNT-PLANTILLA-01',
        email: 'test.maint.plantilla@isatu.edu.ph',
        password: 'Password123!',
        role: 'maintenance',
        specialization: 'Electrical & HVAC',
        gender: 'Male',
        contactNumber: '+63 917 555 6666'
      })
    });

    if (!maintRes.ok) {
      throw new Error(`Maintenance registration failed: ${JSON.stringify(maintRes.data)}`);
    }
    const maintId = maintRes.data.id;
    createdUserIds.push(maintId);
    console.log(`   ✓ Maintenance user created with id ${maintId}.`);

    // 5. Test Faculty Login and verify academicRank in returned profile
    console.log('\n5. Logging in as newly registered Faculty Member...');
    const facLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test.faculty.plantilla@isatu.edu.ph',
        password: 'Password123!'
      })
    });

    if (!facLogin.ok) {
      throw new Error(`Faculty login failed: ${JSON.stringify(facLogin.data)}`);
    }
    const facultyToken = facLogin.data.token;
    console.log('   ✓ Faculty logged in immediately (no pending wait!).');
    console.log(`   ✓ Returned academicRank: "${facLogin.data.user.academicRank}"`);
    if (facLogin.data.user.academicRank !== 'Instructor I') {
      throw new Error(`Expected academicRank "Instructor I", got "${facLogin.data.user.academicRank}"`);
    }

    // 6. Test Staff Login and verify academicRank
    console.log('\n6. Logging in as newly registered Staff Member...');
    const staffLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test.staff.plantilla@isatu.edu.ph',
        password: 'Password123!'
      })
    });

    if (!staffLogin.ok) {
      throw new Error(`Staff login failed: ${JSON.stringify(staffLogin.data)}`);
    }
    console.log('   ✓ Staff logged in immediately.');
    console.log(`   ✓ Returned academicRank: "${staffLogin.data.user.academicRank}"`);
    if (staffLogin.data.user.academicRank !== 'Administrative Officer II') {
      throw new Error(`Expected academicRank "Administrative Officer II", got "${staffLogin.data.user.academicRank}"`);
    }

    // 7. Self-update profile by Faculty member
    console.log('\n7. Faculty member updating own profile (Promotion to "Instructor II")...');
    const updateRes = await req(`/users/${facultyId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        academicRank: 'Instructor II',
        contactNumber: '+63 917 999 8888'
      })
    });

    if (!updateRes.ok) {
      throw new Error(`Self-update failed: ${JSON.stringify(updateRes.data)}`);
    }
    console.log('   ✓ Self-update succeeded.');

    // 8. Test Privilege Escalation Protection (Faculty tries to change role to superadmin)
    console.log('\n8. Testing Privilege Escalation Protection: Faculty trying to self-escalate role...');
    const escalateRes = await req(`/users/${facultyId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: JSON.stringify({
        role: 'superadmin'
      })
    });

    console.log(`   ✓ Request status: ${escalateRes.status} (update processed with role ignored).`);

    // Verify Faculty role was NOT changed
    const listRes = await req('/users', {
      headers: { Authorization: `Bearer ${saToken}` }
    });

    const updatedFaculty = listRes.data.find(u => u.id === facultyId);
    console.log(`   ✓ Verified faculty role in DB: "${updatedFaculty.role}" (must remain "faculty")`);
    if (updatedFaculty.role !== 'faculty') {
      throw new Error(`Security breach: Faculty successfully elevated role to ${updatedFaculty.role}!`);
    }
    console.log(`   ✓ Verified faculty academic_rank in DB: "${updatedFaculty.academic_rank}"`);
    if (updatedFaculty.academic_rank !== 'Instructor II') {
      throw new Error(`Expected updated academic_rank "Instructor II", got "${updatedFaculty.academic_rank}"`);
    }

    console.log('\n🎉 ALL 8 TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Clean up created accounts
    console.log('\n🧹 Cleaning up test accounts...');
    // Connect to DB directly or delete
    try {
      const mysql = await import('mysql2/promise');
      const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'fixit_pdas'
      });
      if (createdUserIds.length > 0) {
        await conn.query('DELETE FROM users WHERE id IN (?)', [createdUserIds]);
        console.log(`   ✓ Cleaned up ${createdUserIds.length} test users from database.`);
      }
      await conn.end();
    } catch (e) {
      console.warn('   Could not clean up test users:', e.message);
    }
  }
}

main().catch(err => {
  console.error('\n❌ Smoke Test Failed:', err);
  process.exit(1);
});
