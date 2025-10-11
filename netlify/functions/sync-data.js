import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';
import validator from 'validator';

const sql = neon();

// Security: Ensure JWT_SECRET is set in production
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
if (process.env.CONTEXT === 'production' && JWT_SECRET === 'dev_secret_change_me') {
  throw new Error('JWT_SECRET must be set in production environment');
}

// Authentication helper
async function authenticate(headers) {
  try {
    const authHeader = headers.authorization || headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid authorization header found');
      return null;
    }

    const token = authHeader.substring(7);
    
    // Enhanced JWT verification with issuer and audience validation
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'xtodo-app',
      audience: 'xtodo-client'
    });
    
    // Log the decoded token structure for debugging
    console.log('Decoded JWT payload:', JSON.stringify(decoded, null, 2));
    
    // Ensure the decoded token has required fields
    // JWT standard uses 'sub' (subject) field for user identifier
    if (!decoded.sub && !decoded.id) {
      console.error('JWT token missing required sub or id field:', decoded);
      return null;
    }
    
    // Normalize the user object to always have an 'id' field
    // Use 'sub' if available (JWT standard), otherwise fall back to 'id'
    const normalizedUser = {
      ...decoded,
      id: decoded.sub || decoded.id
    };
    
    return normalizedUser;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { httpMethod: method } = event;
    const body = event.body ? JSON.parse(event.body) : {};

    switch (method) {
      case 'GET':
        // Require auth
        const user = await authenticate(event.headers);
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const [tasks, projects] = await Promise.all([
          sql`SELECT * FROM tasks WHERE user_id = ${user.id} ORDER BY created_at DESC`,
          sql`SELECT * FROM projects WHERE user_id = ${user.id} ORDER BY created_at DESC`
        ]);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            tasks: tasks.map(task => ({
              ...task,
              createdAt: task.created_at,
              updatedAt: task.updated_at,
              dueDate: task.due_date ? new Date(task.due_date) : null
            })),
            projects: projects.map(project => ({
              ...project,
              createdAt: project.created_at,
              updatedAt: project.updated_at
            }))
          })
        };

      case 'POST':
        const authUser = await authenticate(event.headers);
        if (!authUser) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
        
        // Validate that the user has a valid ID
        if (!authUser.id) {
          console.error('Authentication successful but user ID is missing:', authUser);
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid user data' }) };
        }
        
        const { tasks: clientTasks, projects: clientProjects, lastSync } = body;

        try {
          const serverData = await getServerDataSince(lastSync, authUser.id);
          const clientChanges = await processClientChanges(clientTasks, clientProjects, authUser.id);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              serverChanges: serverData,
              clientChangesConfirmed: clientChanges,
              newLastSync: new Date().toISOString()
            })
          };
        } catch (syncError) {
          console.error('Error during sync operation:', syncError);
          console.error('User ID:', authUser.id);
          console.error('Client data:', { 
            tasksCount: clientTasks?.length || 0, 
            projectsCount: clientProjects?.length || 0,
            lastSync 
          });
          
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'Sync operation failed',
              details: syncError.message 
            })
          };
        }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Error in sync-data function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function getServerDataSince(lastSync, userId) {
  // Validate userId is not null/undefined
  if (!userId) {
    console.error('getServerDataSince called with null/undefined userId');
    throw new Error('Invalid user ID provided');
  }
  
  if (!lastSync) {
    const [tasks, projects] = await Promise.all([
      sql`SELECT * FROM tasks WHERE user_id = ${userId} ORDER BY created_at DESC`,
      sql`SELECT * FROM projects WHERE user_id = ${userId} ORDER BY created_at DESC`
    ]);

    return {
      tasks: tasks.map(task => ({
        ...task,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        dueDate: task.due_date ? new Date(task.due_date) : null
      })),
      projects: projects.map(project => ({
        ...project,
        createdAt: project.created_at,
        updatedAt: project.updated_at
      }))
    };
  }

  const [tasks, projects] = await Promise.all([
    sql`SELECT * FROM tasks WHERE user_id = ${userId} AND updated_at > ${lastSync} ORDER BY created_at DESC`,
    sql`SELECT * FROM projects WHERE user_id = ${userId} AND updated_at > ${lastSync} ORDER BY created_at DESC`
  ]);

  return {
    tasks: tasks.map(task => ({
      ...task,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      dueDate: task.due_date ? new Date(task.due_date) : null
    })),
    projects: projects.map(project => ({
      ...project,
      createdAt: project.created_at,
      updatedAt: project.updated_at
    }))
  };
}

async function processClientChanges(clientTasks, clientProjects, userId) {
  const results = { tasks: [], projects: [] };
  
  // Validate userId is not null/undefined
  if (!userId) {
    console.error('processClientChanges called with null/undefined userId');
    throw new Error('Invalid user ID provided');
  }

  // Handle task changes (supports wrapped {type, action, data} or raw task objects)
  for (const item of (clientTasks || [])) {
    const wrapper = item && typeof item === 'object' && 'data' in item ? item : null;
    const action = wrapper ? (wrapper.action || wrapper.data?._action) : item?._action;
    const task = wrapper ? { ...wrapper.data, _action: action } : item;
    
    // Validate task data
    const taskValidationError = validateTaskData(task);
    if (taskValidationError) {
      console.error(`Invalid task data: ${taskValidationError}`, task);
      continue; // Skip invalid tasks
    }
    
    try {
      if (task._action === 'create') {
        const [newTask] = await sql`
          INSERT INTO tasks (id, user_id, title, description, completed, priority, due_date, project_id, created_at, updated_at)
          VALUES (
            ${task.id},
            ${userId},
            ${sanitizeString(task.title)},
            ${task.description ? sanitizeString(task.description) : null},
            ${Boolean(task.completed)},
            ${sanitizeString(task.priority)},
            ${task.dueDate ? new Date(task.dueDate).toISOString() : null},
            ${task.projectId || null},
            ${new Date(task.createdAt).toISOString()},
            ${new Date(task.updatedAt).toISOString()}
          )
          RETURNING *
        `;
        results.tasks.push({
          ...newTask,
          createdAt: newTask.created_at,
          updatedAt: newTask.updated_at,
          dueDate: newTask.due_date ? new Date(newTask.due_date) : null
        });
      } else if (task._action === 'update') {
        const [updatedTask] = await sql`
          UPDATE tasks 
          SET title = ${sanitizeString(task.title)},
              description = ${task.description ? sanitizeString(task.description) : null},
              completed = ${Boolean(task.completed)}, 
              priority = ${sanitizeString(task.priority)},
              due_date = ${task.dueDate ? new Date(task.dueDate).toISOString() : null}, 
              project_id = ${task.projectId || null},
              updated_at = ${new Date(task.updatedAt).toISOString()}
          WHERE id = ${task.id} AND user_id = ${userId}
          RETURNING *
        `;
        results.tasks.push({
          ...updatedTask,
          createdAt: updatedTask.created_at,
          updatedAt: updatedTask.updated_at,
          dueDate: updatedTask.due_date ? new Date(updatedTask.due_date) : null
        });
      } else if (task._action === 'delete') {
        await sql`DELETE FROM tasks WHERE id = ${task.id} AND user_id = ${userId}`;
        results.tasks.push({ id: task.id, _action: 'deleted' });
      }
    } catch (error) {
      console.error(`Error processing task ${task.id}:`, error);
    }
  }

  // Handle project changes (supports wrapped {type, action, data} or raw project objects)
  for (const item of (clientProjects || [])) {
    const wrapper = item && typeof item === 'object' && 'data' in item ? item : null;
    const action = wrapper ? (wrapper.action || wrapper.data?._action) : item?._action;
    const project = wrapper ? { ...wrapper.data, _action: action } : item;
    
    // Validate project data
    const projectValidationError = validateProjectData(project);
    if (projectValidationError) {
      console.error(`Invalid project data: ${projectValidationError}`, project);
      continue; // Skip invalid projects
    }
    
    try {
      if (project._action === 'create') {
        const [newProject] = await sql`
          INSERT INTO projects (id, user_id, name, description, color, created_at, updated_at)
          VALUES (
            ${project.id},
            ${userId},
            ${sanitizeString(project.name)},
            ${project.description ? sanitizeString(project.description) : null},
            ${sanitizeString(project.color)},
            ${new Date(project.createdAt).toISOString()},
            ${new Date(project.updatedAt).toISOString()}
          )
          RETURNING *
        `;
        results.projects.push({
          ...newProject,
          createdAt: newProject.created_at,
          updatedAt: newProject.updated_at
        });
      } else if (project._action === 'update') {
        const [updatedProject] = await sql`
          UPDATE projects 
          SET name = ${sanitizeString(project.name)},
              description = ${project.description ? sanitizeString(project.description) : null}, 
              color = ${sanitizeString(project.color)},
              updated_at = ${new Date(project.updatedAt).toISOString()}
          WHERE id = ${project.id} AND user_id = ${userId}
          RETURNING *
        `;
        results.projects.push({
          ...updatedProject,
          createdAt: updatedProject.created_at,
          updatedAt: updatedProject.updated_at
        });
      } else if (project._action === 'delete') {
        await sql`DELETE FROM projects WHERE id = ${project.id} AND user_id = ${userId}`;
        results.projects.push({ id: project.id, _action: 'deleted' });
      }
    } catch (error) {
      console.error(`Error processing project ${project.id}:`, error);
    }
  }

  return results;
}

// Input validation helpers
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return validator.escape(validator.trim(input));
}

function validateTaskData(task) {
  if (!task || typeof task !== 'object') {
    return 'Task must be an object';
  }
  
  if (!task._action || !['create', 'update', 'delete'].includes(task._action)) {
    return 'Task must have a valid _action field';
  }
  
  if (!task.id || typeof task.id !== 'string') {
    return 'Task must have a valid id';
  }
  
  if (task._action === 'delete') {
    return null; // Delete only needs id and action
  }
  
  if (!task.title || typeof task.title !== 'string') {
    return 'Task must have a valid title';
  }
  
  if (task.title.length > 255) {
    return 'Task title must be less than 255 characters';
  }
  
  if (task.description && typeof task.description !== 'string') {
    return 'Task description must be a string';
  }
  
  if (
    task.priority &&
    !['low', 'medium', 'high'].includes(
      typeof task.priority === 'string' ? task.priority.toLowerCase() : task.priority
    )
  ) {
    return 'Task priority must be low, medium, or high';
  }
  
  if (task.dueDate && !isValidDate(task.dueDate)) {
    return 'Task dueDate must be a valid date';
  }
  
  if (!task.createdAt || !isValidDate(task.createdAt)) {
    return 'Task must have a valid createdAt date';
  }
  
  if (!task.updatedAt || !isValidDate(task.updatedAt)) {
    return 'Task must have a valid updatedAt date';
  }
  
  return null;
}

function validateProjectData(project) {
  if (!project || typeof project !== 'object') {
    return 'Project must be an object';
  }
  
  if (!project._action || !['create', 'update', 'delete'].includes(project._action)) {
    return 'Project must have a valid _action field';
  }
  
  if (!project.id || typeof project.id !== 'string') {
    return 'Project must have a valid id';
  }
  
  if (project._action === 'delete') {
    return null; // Delete only needs id and action
  }
  
  if (!project.name || typeof project.name !== 'string') {
    return 'Project must have a valid name';
  }
  
  if (project.name.length > 255) {
    return 'Project name must be less than 255 characters';
  }
  
  if (project.description && typeof project.description !== 'string') {
    return 'Project description must be a string';
  }
  
  if (project.color && !validator.isHexColor(project.color)) {
    return 'Project color must be a valid hex color';
  }
  
  if (!project.createdAt || !isValidDate(project.createdAt)) {
    return 'Project must have a valid createdAt date';
  }
  
  if (!project.updatedAt || !isValidDate(project.updatedAt)) {
    return 'Project must have a valid updatedAt date';
  }
  
  return null;
}

function isValidDate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

