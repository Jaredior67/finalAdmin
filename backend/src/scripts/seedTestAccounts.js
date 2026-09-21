/**
 * seedTestAccounts.js
 * Creates default test/demo accounts for all roles if they don't already exist.
 * Safe to re-run — uses INSERT IGNORE / checks before inserting.
 *
 * Accounts created:
 *   maintenance@isatu.edu.ph  / tech123      (Maintenance)
 *   faculty@isatu.edu.ph      / faculty123   (Faculty)
 *   staff@isatu.edu.ph        / staff123     (Staff)
 *
 * Run with:
 *   cd backend
 *   node src/scripts/seedTestAccounts.js
 */

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pool from '../config/db.js';

dotenv.config();

const TEST_ACCOUNTS = [
  {
    firstName: 'Mark',
    lastName: 'Villanueva',
    email: 'maintenance@isatu.edu.ph',
    password: 'tech123',
    role: 'maintenance',
  },
  {
    firstName: 'Elena',
    lastName: 'Ramos',
    email: 'faculty@isatu.edu.ph',
    password: 'faculty123',
    role: 'faculty',
  },
  {
    firstName: 'Juan',
    lastName: 'Santos',
    email: 'staff@isatu.edu.ph',
    password: 'staff123',
    role: 'staff',
  },
];

async function seedTestAccounts() {
  console.log('[seed] Seeding test accounts...');
  for (const account of TEST_ACCOUNTS) {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [account.email]);
    if (existing.length > 0) {
      console.log(`[seed] Already exists — skipping: ${account.email}`);
      continue;
    }
    const hash = await bcrypt.hash(account.password, 10);
    await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [account.firstName, account.lastName, account.email, hash, account.role]
    );
    console.log(`[seed] Created ${account.role}: ${account.email} / ${account.password}`);
  }
  console.log('[seed] Done.');
  await pool.end();
}

seedTestAccounts().catch(err => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
