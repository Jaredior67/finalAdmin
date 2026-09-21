import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fixit_pdas',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

// Fail loudly and clearly if XAMPP's MySQL isn't reachable, instead of
// letting every request hang or throw a cryptic ECONNREFUSED later.
export async function verifyDbConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`Connected to MySQL database "${process.env.DB_NAME || 'fixit_pdas'}"`);
  } catch (err) {
    console.error('----------------------------------------------------------');
    console.error('Could not connect to MySQL.');
    console.error('Checklist:');
    console.error('  1. Is XAMPP running, and is MySQL started (not just Apache)?');
    console.error('  2. Does the database in .env (DB_NAME) exist in phpMyAdmin?');
    console.error('     -> Import database/schema.sql via phpMyAdmin if not.');
    console.error('  3. Do DB_USER / DB_PASSWORD in .env match your MySQL root account?');
    console.error(`Underlying error: ${err.message}`);
    console.error('----------------------------------------------------------');
    throw err;
  }
}

export default pool;
