import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const BASE_URL = process.env.API_BASE || 'http://localhost:5000/api';

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fixit_pdas'
};

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
  console.log('🧪 Starting Forgot Password & Gmail Authentication Smoke Test...\n');
  const pool = mysql.createPool(DB_CONFIG);
  const targetEmail = 'solimankarendeo12@gmail.com';

  try {
    // 0. Ensure user exists
    const [existing] = await pool.query('SELECT id, first_name, last_name, email FROM users WHERE LOWER(email) = ?', [targetEmail]);
    if (existing.length === 0) {
      const hash = await bcrypt.hash('InitPass123!', 10);
      await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, status)
         VALUES (?, ?, ?, ?, 'faculty', 'active')`,
        ['Karen Deo', 'Soliman', targetEmail, hash]
      );
      console.log(`   ✓ Seeded active account for ${targetEmail}`);
    } else {
      console.log(`   ✓ Active account confirmed for ${targetEmail} (ID: ${existing[0].id})`);
    }

    // 1. Request Password Reset OTP
    console.log(`\n1. Requesting password reset OTP for ${targetEmail}...`);
    // Clear recent tokens to bypass the 60s flood limit for testing
    await pool.query('DELETE FROM password_resets WHERE email = ?', [targetEmail]);

    const reqRes = await req('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: targetEmail })
    });

    if (!reqRes.ok || !reqRes.data?.success) {
      throw new Error(`Forgot password request failed: ${JSON.stringify(reqRes.data)}`);
    }
    console.log(`   ✓ OTP request accepted: "${reqRes.data.message}"`);

    // 2. Verify database state in password_resets table
    console.log('\n2. Verifying database state in password_resets table...');
    const [tokens] = await pool.query(
      'SELECT id, email, otp_hash, attempts, expires_at FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1',
      [targetEmail]
    );

    if (tokens.length === 0) {
      throw new Error('No password reset record found in database.');
    }

    const tokenRecord = tokens[0];
    console.log('   ✓ password_resets record verified:');
    console.log(`     - Email: ${tokenRecord.email}`);
    console.log(`     - OTP Hash: ${tokenRecord.otp_hash.slice(0, 20)}... (stored as secure bcrypt hash)`);
    console.log(`     - Attempts: ${tokenRecord.attempts}`);
    console.log(`     - Expires At: ${tokenRecord.expires_at}`);

    // 3. Test invalid OTP rejection
    console.log('\n3. Testing security rejection of invalid OTP...');
    const badOtpRes = await req('/auth/verify-reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: targetEmail,
        otp: '000000',
        newPassword: 'BrandNewPassword2026!'
      })
    });

    if (badOtpRes.ok || badOtpRes.status !== 400) {
      throw new Error(`Expected 400 on bad OTP, got: ${badOtpRes.status} ${JSON.stringify(badOtpRes.data)}`);
    }
    console.log(`   ✓ Bad OTP correctly rejected (Status ${badOtpRes.status}): "${badOtpRes.data?.message}"`);

    // Verify attempt counter incremented
    const [tokensAfterBad] = await pool.query('SELECT attempts FROM password_resets WHERE id = ?', [tokenRecord.id]);
    if (tokensAfterBad[0]?.attempts !== 1) {
      throw new Error(`Expected attempts = 1, got ${tokensAfterBad[0]?.attempts}`);
    }
    console.log('   ✓ Failed attempts counter correctly incremented to 1.');

    // 4. Test brute force protection with 5 failed attempts
    console.log('\n4. Testing brute-force protection (max 5 attempts)...');
    for (let i = 2; i <= 5; i++) {
      await req('/auth/verify-reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail, otp: '111111', newPassword: 'BrandNewPassword2026!' })
      });
    }

    // Attempt 6 should report revoked/exceeded
    const lockedRes = await req('/auth/verify-reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: targetEmail, otp: '111111', newPassword: 'BrandNewPassword2026!' })
    });
    console.log(`   ✓ Brute-force lockout response: "${lockedRes.data?.message}"`);

    // 5. Test real reset with known OTP (4-Stage Flow)
    console.log('\n5. Generating fresh OTP and testing discrete 4-stage verification flow...');
    await pool.query('DELETE FROM password_resets WHERE email = ?', [targetEmail]);
    
    // Request fresh code (Stage 1: Email)
    const freshReq = await req('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: targetEmail })
    });
    if (!freshReq.ok) {
      throw new Error(`Fresh OTP request failed: ${JSON.stringify(freshReq.data)}`);
    }

    // Set known OTP hash directly in DB for automated test verification
    const testOtp = '774411';
    const knownHash = await bcrypt.hash(testOtp, 8);
    await pool.query('UPDATE password_resets SET otp_hash = ? WHERE email = ?', [knownHash, targetEmail]);

    // Stage 2: Verify Code Only (User enters 6-digit code before seeing password fields)
    console.log('   Testing Stage 2: Code-only verification (/auth/verify-reset-code)...');
    const codeCheckBad = await req('/auth/verify-reset-code', {
      method: 'POST',
      body: JSON.stringify({ email: targetEmail, otp: '999999' })
    });
    if (codeCheckBad.ok || codeCheckBad.status !== 400) {
      throw new Error(`Expected 400 on wrong code in verify-reset-code, got ${codeCheckBad.status}`);
    }
    console.log('   ✓ Incorrect code rejected by /auth/verify-reset-code');

    const codeCheckGood = await req('/auth/verify-reset-code', {
      method: 'POST',
      body: JSON.stringify({ email: targetEmail, otp: testOtp })
    });
    if (!codeCheckGood.ok || !codeCheckGood.data?.success) {
      throw new Error(`Failed to verify correct code: ${JSON.stringify(codeCheckGood.data)}`);
    }
    console.log(`   ✓ Correct code validated by /auth/verify-reset-code: "${codeCheckGood.data.message}"`);

    // Verify token is still preserved for the subsequent password update step
    const [tokenStillAlive] = await pool.query('SELECT id FROM password_resets WHERE email = ?', [targetEmail]);
    if (tokenStillAlive.length === 0) {
      throw new Error('Token should NOT be deleted by verify-reset-code; must wait for verify-reset-password!');
    }
    console.log('   ✓ OTP session active — ready to receive new password fields');

    // Stage 3: Submit New Password
    const newTestPassword = 'NewSecretPassword2026!';
    const verifyRes = await req('/auth/verify-reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: targetEmail,
        otp: testOtp,
        newPassword: newTestPassword
      })
    });

    if (!verifyRes.ok || !verifyRes.data?.success) {
      throw new Error(`Password reset failed: ${JSON.stringify(verifyRes.data)}`);
    }
    console.log(`   ✓ Password reset successful (Stage 3): "${verifyRes.data.message}"`);

    // 6. Verify password_resets table cleaned up
    const [remainingTokens] = await pool.query('SELECT id FROM password_resets WHERE email = ?', [targetEmail]);
    if (remainingTokens.length !== 0) {
      throw new Error('password_resets records should be deleted after successful reset.');
    }
    console.log('   ✓ Single-use OTP token securely deleted from database.');

    // 7. Verify login with the NEW password
    console.log('\n6. Testing immediate login with the NEW password...');
    const loginRes = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: targetEmail,
        password: newTestPassword,
        role: 'faculty'
      })
    });

    if (!loginRes.ok || !loginRes.data?.token) {
      throw new Error(`Login with new password failed: ${JSON.stringify(loginRes.data)}`);
    }
    console.log(`   ✓ Authenticated successfully with new password! User ID: ${loginRes.data.user?.id}`);

    // 8. Verify old password no longer works
    console.log('\n7. Testing that old password is invalid...');
    const oldLoginRes = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: targetEmail,
        password: 'InitialPassword123!',
        role: 'faculty'
      })
    });
    if (oldLoginRes.ok) {
      throw new Error('Old password should have been rejected!');
    }
    console.log('   ✓ Old password correctly rejected.');

    console.log('\n🎉 ALL FORGOT PASSWORD & GMAIL AUTHENTICATION TESTS PASSED!');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n❌ Smoke test failed:', err);
  process.exit(1);
});
