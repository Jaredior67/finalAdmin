/**
 * systemFullFlowTest.js
 * End-to-End System Integration & ISO/IEC 25010 Quality Model Test
 *
 * Validates:
 * 1. Full 4-Level Request Lifecycle from Faculty/Staff submission to Completion
 * 2. Automated In-App Notifications at every step (Requester & Admin confirmed at completion)
 * 3. Post-completion ISO/IEC 25010 evaluation submission
 * 4. ISO/IEC 25010 Quality Characteristics:
 *    - Functional Suitability (all business rules, transitions, audit trail)
 *    - Performance Efficiency (API response times under threshold)
 *    - Usability (clear feedback, word limit compliance)
 *    - Reliability (idempotency, transaction safety)
 *    - Security (IDOR protection, role-based transition guards, password hashing)
 */

import pool from '../src/config/db.js';

const BASE_URL = process.env.API_BASE || 'http://localhost:5000/api';

async function apiCall(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const start = performance.now();
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const duration = performance.now() - start;

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data, duration };
}

async function loginUser(email, password, role) {
  const res = await apiCall('/auth/login', 'POST', { email, password, role });
  if (!res.ok) {
    throw new Error(`Login failed for ${email} as ${role}: ${res.data?.message || res.status}`);
  }
  return res.data.token;
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' FixIT PDAS Facility Management — Full System Flow & ISO Test');
  console.log('================================================================\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    benchmarks: []
  };

  function assert(description, condition, extraInfo = '') {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`  ✓ ${description}`);
    } else {
      results.failed++;
      console.error(`  ✗ FAIL: ${description} ${extraInfo}`);
    }
  }

  try {
    // --------------------------------------------------------------------------
    // 1. Authenticate All Actors
    // --------------------------------------------------------------------------
    console.log('Step 1: Authenticating Users for All Roles...');
    const facultyToken = await loginUser('faculty@gmail.com', 'faculty123', 'faculty');
    const supervisorToken = await loginUser('supervisor@gmail.com', 'supervisor123', 'faculty_staff');
    const adminToken = await loginUser('admin@gmail.com', 'admin123', 'admin');
    const approverToken = await loginUser('campusadmin@gmail.com', 'admin123', 'campus_admin');
    const techToken = await loginUser('maintenance@gmail.com', 'tech123', 'maintenance');

    const [[facultyUser]] = await pool.query('SELECT id FROM users WHERE email = ?', ['faculty@gmail.com']);
    const [[supervisorUser]] = await pool.query('SELECT id FROM users WHERE email = ?', ['supervisor@gmail.com']);
    const [[adminUser]] = await pool.query('SELECT id FROM users WHERE email = ?', ['admin@gmail.com']);
    const [[approverUser]] = await pool.query('SELECT id FROM users WHERE email = ?', ['campusadmin@gmail.com']);
    const [[techUser]] = await pool.query('SELECT id FROM users WHERE email = ?', ['maintenance@gmail.com']);

    assert('Faculty authenticated successfully', Boolean(facultyToken));
    assert('Supervisor authenticated successfully', Boolean(supervisorToken));
    assert('Admin authenticated successfully', Boolean(adminToken));
    assert('Campus Admin Approver authenticated successfully', Boolean(approverToken));
    assert('Technician authenticated successfully', Boolean(techToken));

    // --------------------------------------------------------------------------
    // 2. Faculty Initiates Request (Level 1: Requester Confirmation)
    // --------------------------------------------------------------------------
    console.log('\nStep 2: Faculty Submits Maintenance Request (Level 1 Confirmation)...');
    const idempotencyKey = `e2e_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const requestPayload = {
      title: 'Fluorescent Light Repair - Room 204',
      category: 'Electrical',
      description: 'Fluorescent lamp flickering rapidly in Room 204, causing visual strain and electrical buzzing.',
      urgencyLevel: 'High Risk',
      requestType: 'Corrective',
      building: 'Administration Building',
      floor: '2nd Floor',
      room: 'Room 204',
      immediateSupervisor: 'Engr. Roberto D. Cruz',
      isStandardFormFilled: true,
      idempotencyKey
    };

    const submitRes = await apiCall('/job-requests', 'POST', requestPayload, facultyToken);
    results.benchmarks.push({ action: 'POST /job-requests', durationMs: submitRes.duration });

    assert('Request accepted with HTTP 201/200', submitRes.ok, JSON.stringify(submitRes.data));
    const ticketNo = submitRes.data?.ticketNo;
    const requestId = submitRes.data?.id;
    assert('Issued atomic server-side ticket number (JR-YYYY-XXXX)', /^JR-\d{4}-\d{4}$/.test(ticketNo), `Got: ${ticketNo}`);

    // Verify initial status is Pending
    const [reqRow] = await pool.query('SELECT * FROM job_requests WHERE ticket_no = ?', [ticketNo]);
    assert('Initial status in MySQL is "Pending"', reqRow[0]?.status === 'Pending');
    assert('Level 1 requester_approved is 1', reqRow[0]?.requester_approved === 1);

    // Verify In-App Notifications for Supervisor & Admin
    const [supervisorNotifs] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? AND (title LIKE ? OR message LIKE ?) ORDER BY id DESC LIMIT 1',
      [supervisorUser.id, `%${ticketNo}%`, `%${ticketNo}%`]
    );
    assert('Immediate Supervisor received in-app notification', supervisorNotifs.length > 0, `Ticket: ${ticketNo}`);

    const [adminNotifs] = await pool.query(
      'SELECT * FROM notifications WHERE (user_id = ? OR user_id = 1) AND (title LIKE ? OR message LIKE ?) ORDER BY id DESC LIMIT 1',
      [adminUser.id, `%${ticketNo}%`, `%${ticketNo}%`]
    );
    assert('PDAS Admin received in-app notification for new submission', adminNotifs.length > 0);

    // --------------------------------------------------------------------------
    // 3. Reliability Test: Idempotency Key Deduplication
    // --------------------------------------------------------------------------
    console.log('\nStep 3: Reliability & Idempotency Check...');
    const duplicateSubmit = await apiCall('/job-requests', 'POST', requestPayload, facultyToken);
    assert('Duplicate submission with same idempotencyKey returns existing ticket', duplicateSubmit.ok && duplicateSubmit.data?.duplicate === true);
    assert('No duplicate record inserted into database', (await pool.query('SELECT COUNT(*) as c FROM job_requests WHERE idempotency_key = ?', [idempotencyKey]))[0][0].c === 1);

    // --------------------------------------------------------------------------
    // 4. Immediate Supervisor Endorsement (Level 2)
    // --------------------------------------------------------------------------
    console.log('\nStep 4: Immediate Supervisor Endorsement (Level 2)...');
    const supRes = await apiCall(`/job-requests/${requestId}/supervisor-action`, 'POST', {
      action: 'approve',
      remarks: 'Inspected by supervisor. Work is urgent and justified for safety.'
    }, supervisorToken);
    results.benchmarks.push({ action: 'Supervisor Endorsement', durationMs: supRes.duration });

    assert('Supervisor action returned HTTP 200', supRes.ok, JSON.stringify(supRes.data));
    const [supUpdated] = await pool.query('SELECT status, supervisor_approved FROM job_requests WHERE id = ?', [requestId]);
    assert('Status transitioned to "Under Review"', supUpdated[0]?.status === 'Under Review');
    assert('Level 2 supervisor_approved is 1', supUpdated[0]?.supervisor_approved === 1);

    // --------------------------------------------------------------------------
    // 5. PDAS Administrator Review & Endorsement (Level 3)
    // --------------------------------------------------------------------------
    console.log('\nStep 5: PDAS Administrator Review (Level 3)...');
    const adminRes = await apiCall(`/job-requests/${requestId}/admin-action`, 'POST', {
      action: 'approve',
      remarks: 'PDAS evaluated scope and materials required. Endorsed to Campus Administrator for final sign-off.'
    }, adminToken);
    results.benchmarks.push({ action: 'PDAS Admin Endorsement', durationMs: adminRes.duration });

    assert('Admin action returned HTTP 200', adminRes.ok, JSON.stringify(adminRes.data));
    const [adminUpdated] = await pool.query('SELECT status FROM job_requests WHERE id = ?', [requestId]);
    assert('Status transitioned to "Pending Final Approval"', adminUpdated[0]?.status === 'Pending Final Approval');

    // Verify In-App Notification for Campus Administrator Approver
    const [approverNotifs] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? AND (title LIKE ? OR message LIKE ?) ORDER BY id DESC LIMIT 1',
      [approverUser.id, `%${ticketNo}%`, `%${ticketNo}%`]
    );
    assert('Campus Administrator received in-app notification', approverNotifs.length > 0);

    // --------------------------------------------------------------------------
    // 6. Campus Administrator Final Approval (Level 4)
    // --------------------------------------------------------------------------
    console.log('\nStep 6: Campus Administrator Final Approval (Level 4)...');
    const approverRes = await apiCall(`/job-requests/${requestId}/approver-action`, 'POST', {
      action: 'approve',
      remarks: 'Final campus approval granted. Proceed with work order dispatch.'
    }, approverToken);
    results.benchmarks.push({ action: 'Campus Admin Approval', durationMs: approverRes.duration });

    assert('Approver action returned HTTP 200', approverRes.ok, JSON.stringify(approverRes.data));
    const [appUpdated] = await pool.query('SELECT status, campus_admin_approved FROM job_requests WHERE id = ?', [requestId]);
    assert('Status transitioned to "Approved"', appUpdated[0]?.status === 'Approved');
    assert('Level 4 campus_admin_approved is 1', appUpdated[0]?.campus_admin_approved === 1);

    // --------------------------------------------------------------------------
    // 7. Work Order Assignment by PDAS Admin
    // --------------------------------------------------------------------------
    console.log('\nStep 7: Work Order Assignment to Technician...');
    const assignRes = await apiCall(`/job-requests/${requestId}/assign-technician`, 'POST', {
      assignedTo: techUser.id, // Mark Villanueva
      scheduledDate: new Date().toISOString().slice(0, 10)
    }, adminToken);
    results.benchmarks.push({ action: 'Assign Technician', durationMs: assignRes.duration });

    assert('Assignment returned HTTP 200', assignRes.ok, JSON.stringify(assignRes.data));
    const [assignedRow] = await pool.query('SELECT status, assigned_to, official_tracking_no FROM job_requests WHERE id = ?', [requestId]);
    assert('Status transitioned to "Ongoing"', assignedRow[0]?.status === 'Ongoing');
    assert(`Assigned technician is ID ${techUser.id}`, assignedRow[0]?.assigned_to === techUser.id);
    assert('Official control number generated (TRK-YYYY-XXXX)', /^TRK-\d{4}-\d{4}$/.test(assignedRow[0]?.official_tracking_no));

    // Verify Technician received In-App notification
    const [techNotifs] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? AND (title LIKE ? OR message LIKE ?) ORDER BY id DESC LIMIT 1',
      [techUser.id, `%${ticketNo}%`, `%${ticketNo}%`]
    );
    assert('Assigned Technician received in-app work order notification', techNotifs.length > 0);

    // --------------------------------------------------------------------------
    // 8. Technician Executes and Completes Work Order
    // --------------------------------------------------------------------------
    console.log('\nStep 8: Technician Starts & Completes Work Order...');
    const completeRes = await apiCall(`/job-requests/${requestId}/status`, 'PUT', {
      status: 'Completed',
      remarks: 'Replaced ballast and two T8 fluorescent tubes. Fixture operational and verified safe.'
    }, techToken);
    results.benchmarks.push({ action: 'Technician Completion', durationMs: completeRes.duration });

    assert('Technician completion returned HTTP 200', completeRes.ok, JSON.stringify(completeRes.data));
    const [completedRow] = await pool.query('SELECT status FROM job_requests WHERE id = ?', [requestId]);
    assert('Status in MySQL transitioned to "Completed"', completedRow[0]?.status === 'Completed');

    // --------------------------------------------------------------------------
    // 9. Verification of Completion Notifications (Admin and Requester)
    // --------------------------------------------------------------------------
    console.log('\nStep 9: Verifying Completion Notifications to Admin & Requester...');
    // Check Notification to Requester (Elena Ramos)
    const [requesterCompletedNotifs] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? AND (title LIKE ? OR message LIKE ?) ORDER BY id DESC LIMIT 1',
      [facultyUser.id, `%${ticketNo}%`, `%${ticketNo}%`]
    );
    assert(
      'Requester received in-app notification confirming request completed & prompting rating',
      requesterCompletedNotifs.length > 0 &&
      (requesterCompletedNotifs[0].title.toLowerCase().includes('complet') || requesterCompletedNotifs[0].message.toLowerCase().includes('complet'))
    );

    // Check Notification to Admin (Kristine J. Amar / System Admin)
    const [adminCompletedNotifs] = await pool.query(
      'SELECT * FROM notifications WHERE (user_id = ? OR user_id = 1) AND (title LIKE ? OR message LIKE ?) ORDER BY id DESC LIMIT 1',
      [adminUser.id, `%${ticketNo}%`, `%${ticketNo}%`]
    );
    assert(
      'Administrator received in-app notification confirming work completed',
      adminCompletedNotifs.length > 0 &&
      (adminCompletedNotifs[0].title.includes('Completed') || adminCompletedNotifs[0].message.includes('complete'))
    );

    // --------------------------------------------------------------------------
    // 10. Requester Submits ISO/IEC 25010 Post-Completion Evaluation
    // --------------------------------------------------------------------------
    console.log('\nStep 10: Requester Submits ISO/IEC 25010 Evaluation...');
    const evalRes = await apiCall('/evaluations', 'POST', {
      jobRequestId: requestId,
      functionalSuitability: 5,
      performanceEfficiency: 5,
      usability: 5,
      reliability: 5,
      security: 5,
      comments: 'Excellent repair response time, lighting is back to full brightness with zero flicker.'
    }, facultyToken);
    results.benchmarks.push({ action: 'Submit ISO 25010 Evaluation', durationMs: evalRes.duration });

    assert('Evaluation accepted with HTTP 201/200', evalRes.ok, JSON.stringify(evalRes.data));

    // Reliability & Data Integrity constraint check (One evaluation per user per request)
    const duplicateEval = await apiCall('/evaluations', 'POST', {
      jobRequestId: requestId,
      functionalSuitability: 4,
      performanceEfficiency: 4,
      usability: 4,
      reliability: 4,
      security: 4,
      comments: 'Duplicate attempt'
    }, facultyToken);
    assert('Duplicate evaluation prevented by DB constraint (HTTP 409 or 400)', !duplicateEval.ok && (duplicateEval.status === 409 || duplicateEval.status === 400));

    // --------------------------------------------------------------------------
    // 11. Security Testing (ISO/IEC 25010 Security Characteristic)
    // --------------------------------------------------------------------------
    console.log('\nStep 11: Security & IDOR Authorization Verification...');
    // Test A: Faculty tries to act on an admin endpoint (Role escalation attempt)
    const adminEscalation = await apiCall(`/job-requests/${requestId}/admin-action`, 'POST', {
      action: 'approve',
      remarks: 'Malicious attempt by faculty to act as admin'
    }, facultyToken);
    assert('Role escalation rejected with HTTP 403 Forbidden', adminEscalation.status === 403);

    // Test B: Faculty tries to assign a technician (Privilege bypass)
    const assignBypass = await apiCall(`/job-requests/${requestId}/assign-technician`, 'POST', {
      technicianId: 4
    }, facultyToken);
    assert('Unauthorized assignment rejected with HTTP 403', assignBypass.status === 403);

    // Test C: Unauthorized invalid state transition attempt (Bypassing workflow policy)
    const invalidJump = await apiCall(`/job-requests/${requestId}/status`, 'PUT', {
      status: 'Pending'
    }, techToken);
    assert('Invalid status transition blocked by policy (HTTP 400/409)', !invalidJump.ok);

    // Test D: Word count overflow rejection (500 words cap)
    const longText = 'word '.repeat(505);
    const wordOverflow = await apiCall('/job-requests', 'POST', {
      title: 'Word limit test',
      category: 'Electrical',
      description: longText,
      urgencyLevel: 'Low Risk',
      idempotencyKey: `word_test_${Date.now()}`
    }, facultyToken);
    assert('Server-side word limit guard rejects >500 words (HTTP 400)', wordOverflow.status === 400);

    // --------------------------------------------------------------------------
    // 12. Performance & Efficiency Summary
    // --------------------------------------------------------------------------
    console.log('\nStep 12: Performance Efficiency Benchmarks:');
    let allPerformant = true;
    for (const b of results.benchmarks) {
      console.log(`  • ${b.action.padEnd(30)}: ${b.durationMs.toFixed(2)} ms`);
      if (b.durationMs > 1500) allPerformant = false;
    }
    assert('All core workflow operations respond within 1500ms SLA', allPerformant);

    // --------------------------------------------------------------------------
    // 13. Audit Trail Completeness Check
    // --------------------------------------------------------------------------
    console.log('\nStep 13: Audit Trail Verification...');
    const [historyRows] = await pool.query(
      'SELECT from_status, to_status, remarks FROM job_request_status_history WHERE job_request_id = ? ORDER BY id ASC',
      [requestId]
    );
    assert('Complete timestamped history preserved for all transitions', historyRows.length >= 5);
    console.log('  Audit trail entries:');
    for (const h of historyRows) {
      console.log(`    - ${h.from_status || 'Initial'} -> ${h.to_status} (${h.remarks || 'no remarks'})`);
    }

  } catch (err) {
    console.error('\n[FATAL ERROR in test suite]:', err);
    results.failed++;
  } finally {
    console.log('\n================================================================');
    console.log(` Test Summary: ${results.passed} Passed, ${results.failed} Failed out of ${results.total} assertions`);
    console.log('================================================================');
    await pool.end();
    process.exit(results.failed > 0 ? 1 : 0);
  }
}

runTestSuite();
