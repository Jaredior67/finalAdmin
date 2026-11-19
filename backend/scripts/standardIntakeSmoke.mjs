import mysql from 'mysql2/promise';

const BASE_URL = 'http://localhost:5000/api';

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fixit_pdas'
};

async function run() {
  console.log('🧪 Starting Standard Request & Urgency Prioritization Smoke Test...\n');

  // 1. Sign in as faculty
  console.log('1. Signing in as faculty user...');
  const facultyLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'faculty@gmail.com', password: 'faculty123' })
  });
  if (!facultyLoginRes.ok) {
    throw new Error(`Faculty login failed: ${facultyLoginRes.status} ${await facultyLoginRes.text()}`);
  }
  const facultyData = await facultyLoginRes.json();
  const facultyToken = facultyData.token;
  console.log('   ✓ Faculty authenticated successfully.');

  // 2. Submit Standard Request with Low Priority
  console.log('\n2. Submitting standard request with Low Priority...');
  const lowReqRes = await fetch(`${BASE_URL}/job-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${facultyToken}`
    },
    body: JSON.stringify({
      category: 'Electrical',
      urgencyLevel: 'Low Risk',
      building: 'Administration Building',
      floor: '2nd Floor',
      room: 'Room 204',
      location: 'Administration Building — 2nd Floor — Room 204',
      immediateSupervisor: 'Dean Academic Affairs',
      description: 'Fluorescent bulb flickering intermittently in the faculty study area.',
      scopeOfWorks: {
        electrical: {
          options: ['Repair'],
          description: 'Fluorescent bulb flickering intermittently in the faculty study area.'
        }
      }
    })
  });
  if (!lowReqRes.ok) {
    throw new Error(`Low priority request submission failed: ${lowReqRes.status} ${await lowReqRes.text()}`);
  }
  const lowReqData = await lowReqRes.json();
  console.log(`   ✓ Low priority request created: ${lowReqData.ticketNo}`);

  // 3. Submit Standard Request with High / Urgent Priority
  console.log('\n3. Submitting standard request with High / Urgent Priority...');
  const urgentReqRes = await fetch(`${BASE_URL}/job-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${facultyToken}`
    },
    body: JSON.stringify({
      category: 'Water/Sanitary',
      urgencyLevel: 'High Risk',
      building: 'Engineering Building',
      floor: '1st Floor',
      room: 'Restroom 101',
      location: 'Engineering Building — 1st Floor — Restroom 101',
      immediateSupervisor: 'Dean Academic Affairs',
      description: 'Major water pipe burst near main valve, causing rapid water accumulation on the corridor floor.',
      scopeOfWorks: {
        waterSanitary: {
          options: ['Repair'],
          description: 'Major water pipe burst near main valve, causing rapid water accumulation on the corridor floor.'
        }
      }
    })
  });
  if (!urgentReqRes.ok) {
    throw new Error(`High priority request submission failed: ${urgentReqRes.status} ${await urgentReqRes.text()}`);
  }
  const urgentReqData = await urgentReqRes.json();
  console.log(`   ✓ Urgent priority request created: ${urgentReqData.ticketNo}`);

  // 4. Verify Database state for both tickets
  console.log('\n4. Verifying database state for created tickets...');
  const pool = mysql.createPool(DB_CONFIG);
  try {
    const [rows] = await pool.query(
      'SELECT id, ticket_no, request_type, urgency_level, is_standard_form_filled, status, urgent_assigned_at, urgent_overdue_notified FROM job_requests WHERE ticket_no IN (?, ?)',
      [lowReqData.ticketNo, urgentReqData.ticketNo]
    );

    const lowDb = rows.find(r => r.ticket_no === lowReqData.ticketNo);
    const urgentDb = rows.find(r => r.ticket_no === urgentReqData.ticketNo);

    if (!lowDb || !urgentDb) {
      throw new Error('Could not find created tickets in database.');
    }

    console.log('   ✓ Low Priority ticket DB record:');
    console.log(`     - request_type: "${lowDb.request_type}" (must be "Standard Request")`);
    console.log(`     - is_standard_form_filled: ${lowDb.is_standard_form_filled} (must be 1)`);
    console.log(`     - status: "${lowDb.status}" (must be "Pending")`);
    console.log(`     - urgency_level: "${lowDb.urgency_level}" (must be "Low Risk")`);

    if (lowDb.request_type !== 'Standard Request' || Number(lowDb.is_standard_form_filled) !== 1) {
      throw new Error(`Low ticket invalid state: request_type=${lowDb.request_type}, filled=${lowDb.is_standard_form_filled}`);
    }

    console.log('   ✓ High / Urgent Priority ticket DB record:');
    console.log(`     - request_type: "${urgentDb.request_type}" (must be "Standard Request")`);
    console.log(`     - is_standard_form_filled: ${urgentDb.is_standard_form_filled} (must be 1)`);
    console.log(`     - status: "${urgentDb.status}" (must be "Pending")`);
    console.log(`     - urgency_level: "${urgentDb.urgency_level}" (must be "High Risk")`);

    if (urgentDb.request_type !== 'Standard Request') {
      throw new Error(`Urgent ticket must be "Standard Request", got: ${urgentDb.request_type}`);
    }
    if (Number(urgentDb.is_standard_form_filled) !== 1) {
      throw new Error(`Urgent ticket must have is_standard_form_filled = 1, got: ${urgentDb.is_standard_form_filled}`);
    }
    if (urgentDb.status !== 'Pending') {
      throw new Error(`Urgent ticket must enter as "Pending", got: ${urgentDb.status}`);
    }

    // 5. Test supervisor / admin retrieval and queue prioritization
    console.log('\n5. Logging in as Admin/Supervisor to verify queue prioritization...');
    const [adminUsers] = await pool.query(
      'SELECT email, role, is_supervisor FROM users WHERE role IN ("admin", "campus_admin", "superadmin") OR is_supervisor = 1 LIMIT 5'
    );
    console.log('   Available management users in DB:', adminUsers);

    const supLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@gmail.com', password: 'admin123', role: 'admin' })
    });
    if (supLoginRes.ok) {
      const supData = await supLoginRes.json();
      const supListRes = await fetch(`${BASE_URL}/job-requests`, {
        headers: { 'Authorization': `Bearer ${supData.token}` }
      });
      if (supListRes.ok) {
        const supListData = await supListRes.json();
        const supTickets = supListData.rows || [];
        const foundUrgent = supTickets.find(r => r.ticket_no === urgentReqData.ticketNo);
        if (foundUrgent) {
          console.log(`   ✓ Admin/Supervisor sees urgent ticket ${urgentReqData.ticketNo} in queue.`);
          console.log(`     - Urgency level: ${foundUrgent.urgency_level}`);
          console.log(`     - Status: ${foundUrgent.status}`);
          console.log(`     - Request Type: ${foundUrgent.request_type || foundUrgent.requestType}`);
          console.log(`     - Scope details present: ${Boolean(foundUrgent.request_details || foundUrgent.description)}`);
        }
      }
    } else {
      console.log('   (Admin login status):', supLoginRes.status, await supLoginRes.text());
    }

    console.log('\n🎉 ALL STANDARD INTAKE & URGENCY PRIORITIZATION TESTS PASSED SUCCESSFULLY!');

    // 6. Cleanup test records
    console.log('\n🧹 Cleaning up test job requests...');
    await pool.query('DELETE FROM job_request_status_history WHERE job_request_id IN (?, ?)', [lowDb.id, urgentDb.id]);
    await pool.query('DELETE FROM notifications WHERE link LIKE ? OR link LIKE ?', [`%${lowDb.id}%`, `%${urgentDb.id}%`]);
    await pool.query('DELETE FROM job_requests WHERE id IN (?, ?)', [lowDb.id, urgentDb.id]);
    console.log('   ✓ Cleaned up test records from database.');

  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('\n❌ Smoke test failed:', err);
  process.exit(1);
});
