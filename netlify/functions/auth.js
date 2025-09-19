import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action } = body;

    // Ensure users table exists (safety for local dev if init-db wasn't run)
    await ensureUsersTable();

    if (action === 'signup') {
      const { fullName, email, password } = body;
      if (!fullName || !email || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fields' }) };
      }
      const now = new Date().toISOString();
      const id = generateId();
      const passwordHash = await bcrypt.hash(password, 10);

      const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      if (existing.length > 0) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Email already registered' }) };
      }

      await sql`
        INSERT INTO users (id, full_name, email, password_hash, created_at, updated_at)
        VALUES (${id}, ${fullName}, ${email}, ${passwordHash}, ${now}, ${now})
      `;

      const token = signJwt({ sub: id, email, fullName });
      return { statusCode: 200, headers, body: JSON.stringify({ token, user: { id, email, fullName } }) };
    }

    if (action === 'signin') {
      const { email, password } = body;
      if (!email || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing credentials' }) };
      }
      const rows = await sql`SELECT id, full_name, email, password_hash FROM users WHERE email = ${email} LIMIT 1`;
      if (rows.length === 0) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
      }
      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
      }
      const token = signJwt({ sub: user.id, email: user.email, fullName: user.full_name });
      return { statusCode: 200, headers, body: JSON.stringify({ token, user: { id: user.id, email: user.email, fullName: user.full_name } }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    console.error('Auth error', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function ensureUsersTable() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL
    )`;
  } catch (e) {
    console.error('Failed ensuring users table:', e);
    throw e;
  }
}