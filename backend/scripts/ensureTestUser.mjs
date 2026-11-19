import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fixit_pdas'
};

async function main() {
  const pool = mysql.createPool(DB_CONFIG);
  try {
    const targetEmail = 'solimankarendeo12@gmail.com';
    const [existing] = await pool.query('SELECT id, first_name, last_name, email, role FROM users WHERE LOWER(email) = ?', [targetEmail]);
    
    if (existing.length > 0) {
      console.log(`✓ User ${targetEmail} already exists in database (ID: ${existing[0].id}, Role: ${existing[0].role})`);
    } else {
      console.log(`Creating user account for ${targetEmail}...`);
      const hash = await bcrypt.hash('InitialPassword123!', 10);
      const [res] = await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, department, office, status)
         VALUES (?, ?, ?, ?, 'faculty', 'College of Industrial Technology', 'CIT Faculty Room', 'active')`,
        ['Karen Deo', 'Soliman', targetEmail, hash]
      );
      console.log(`✓ Created user account for ${targetEmail} (ID: ${res.insertId})`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
