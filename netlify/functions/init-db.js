import { neon } from '@netlify/neon';

const sql = neon();

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `;

    // Projects table scoped to user
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `;

    // Tasks table scoped to user
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        priority VARCHAR(10) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
        due_date TIMESTAMP WITH TIME ZONE,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `;

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at)`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: 'Database initialized successfully',
        tables: ['users', 'projects', 'tasks']
      })
    };
  } catch (error) {
    console.error('Error initializing database:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to initialize database' })
    };
  }
};
