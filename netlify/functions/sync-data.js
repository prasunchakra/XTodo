import { neon } from '@netlify/neon';
import jwt from 'jsonwebtoken';

const sql = neon();

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
        const { tasks: clientTasks, projects: clientProjects, lastSync } = body;

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

  // Handle task changes (supports wrapped {type, action, data} or raw task objects)
  for (const item of (clientTasks || [])) {
    const wrapper = item && typeof item === 'object' && 'data' in item ? item : null;
    const action = wrapper ? (wrapper.action || wrapper.data?._action) : item?._action;
    const task = wrapper ? { ...wrapper.data, _action: action } : item;
    try {
      if (task._action === 'create') {
        const [newTask] = await sql`
          INSERT INTO tasks (id, user_id, title, description, completed, priority, due_date, project_id, created_at, updated_at)
          VALUES (
            ${task.id},
            ${userId},
            ${task.title},
            ${task.description || null},
            ${Boolean(task.completed)},
            ${task.priority},
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
          SET title = ${task.title},
              description = ${task.description || null},
              completed = ${Boolean(task.completed)}, 
              priority = ${task.priority},
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
    try {
      if (project._action === 'create') {
        const [newProject] = await sql`
          INSERT INTO projects (id, user_id, name, description, color, created_at, updated_at)
          VALUES (
            ${project.id},
            ${userId},
            ${project.name},
            ${project.description || null},
            ${project.color},
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
          SET name = ${project.name},
              description = ${project.description || null}, 
              color = ${project.color},
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
