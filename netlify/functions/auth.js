import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import validator from 'validator';

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Security: Ensure JWT_SECRET is set in production
if (process.env.CONTEXT === 'production' && JWT_SECRET === 'dev_secret_change_me') {
  throw new Error('JWT_SECRET must be set in production environment');
}

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

    // Validate action parameter
    if (!action || typeof action !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action parameter' }) };
    }

    // Ensure users table exists (safety for local dev if init-db wasn't run)
    await ensureUsersTable();

    if (action === 'signup') {
      const { fullName, email, password } = body;
      
      // Input validation
      const validationError = validateSignupInput(fullName, email, password);
      if (validationError) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: validationError }) };
      }
      
      // Sanitize inputs
      const sanitizedFullName = validator.escape(validator.trim(fullName));
      const sanitizedEmail = validator.normalizeEmail(email);
      
      const now = new Date().toISOString();
      const id = generateId();
      const passwordHash = await bcrypt.hash(password, 10);

      const existing = await sql`SELECT id FROM users WHERE email = ${sanitizedEmail} LIMIT 1`;
      if (existing.length > 0) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'Email already registered' }) };
      }

      await sql`
        INSERT INTO users (id, full_name, email, password_hash, created_at, updated_at)
        VALUES (${id}, ${sanitizedFullName}, ${sanitizedEmail}, ${passwordHash}, ${now}, ${now})
      `;

      const token = signJwt({ sub: id, email: sanitizedEmail, fullName: sanitizedFullName });
      return { statusCode: 200, headers, body: JSON.stringify({ token, user: { id, email: sanitizedEmail, fullName: sanitizedFullName } }) };
    }

    if (action === 'signin') {
      const { email, password } = body;
      
      // Input validation
      const validationError = validateSigninInput(email, password);
      if (validationError) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: validationError }) };
      }
      
      // Sanitize email
      const sanitizedEmail = validator.normalizeEmail(email);
      
      const rows = await sql`SELECT id, full_name, email, password_hash FROM users WHERE email = ${sanitizedEmail} LIMIT 1`;
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

// Input validation functions
function validateSignupInput(fullName, email, password) {
  // Validate fullName
  if (!fullName || typeof fullName !== 'string') {
    return 'Full name is required';
  }
  const trimmedName = validator.trim(fullName);
  if (trimmedName.length < 2 || trimmedName.length > 255) {
    return 'Full name must be between 2 and 255 characters';
  }
  
  // Validate email
  if (!email || typeof email !== 'string') {
    return 'Email is required';
  }
  if (!validator.isEmail(email)) {
    return 'Invalid email format';
  }
  
  // Validate password
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (password.length > 128) {
    return 'Password must be less than 128 characters';
  }
  
  return null;
}

function validateSigninInput(email, password) {
  // Validate email
  if (!email || typeof email !== 'string') {
    return 'Email is required';
  }
  if (!validator.isEmail(email)) {
    return 'Invalid email format';
  }
  
  // Validate password
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  
  return null;
}

function signJwt(payload) {
  // Add additional JWT claims for security
  const jwtPayload = {
    ...payload,
    iss: 'xtodo-app', // Issuer
    aud: 'xtodo-client', // Audience
    iat: Math.floor(Date.now() / 1000) // Issued at
  };
  
  return jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '7d' });
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