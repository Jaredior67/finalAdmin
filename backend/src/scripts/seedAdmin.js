// Creates (or updates) the default admin account using ADMIN_* values
// from .env. Run with: npm run seed:admin
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pool from '../config/db.js';

dotenv.config();

async function seedAdmin() {
  const firstName = process.env.ADMIN_FIRST_NAME || 'System';
  const lastName = process.env.ADMIN_LAST_NAME || 'Administrator';
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before running this script.');
    process.exit(1);
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    const passwordHash = await bcrypt.hash(password, 10);

    if (existing.length > 0) {
      await pool.query('UPDATE users SET password_hash = ?, status = ? WHERE email = ?', [
        passwordHash,
        'active',
        email,
      ]);
      console.log(`Admin account already existed - password reset for ${email}.`);
    } else {
      await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, status)
         VALUES (?, ?, ?, ?, 'admin', 'active')`,
        [firstName, lastName, email, passwordHash]
      );
      console.log(`Admin account created: ${email}`);
    }
  } catch (err) {
    console.error('Failed to seed admin account:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdmin();
