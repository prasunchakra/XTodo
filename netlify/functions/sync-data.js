import { neon } from '@netlify/neon';

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
    const { method } = event;
    const body = event.body ? JSON.parse(event.body) : {};

    switch (method) {
      case 'GET':
        const [tasks, projects] = await Promise.all([
          sql`SELECT * FROM tasks ORDER BY created_at DESC`,
          sql`SELECT * FROM projects ORDER BY created_at DESC`
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
        const { tasks: clientTasks, projects: clientProjects, lastSync } = body;

        const serverData = await getServerDataSince(lastSync);

        const clientChanges = await processClientChanges(clientTasks, clientProjects);

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

async function getServerDataSince(lastSync) {
  if (!lastSync) {
    const [tasks, projects] = await Promise.all([
      sql`SELECT * FROM tasks ORDER BY created_at DESC`,
      sql`SELECT * FROM projects ORDER BY created_at DESC`
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
    sql`SELECT * FROM tasks WHERE updated_at > ${lastSync} ORDER BY created_at DESC`,
    sql`SELECT * FROM projects WHERE updated_at > ${lastSync} ORDER BY created_at DESC`
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

async function processClientChanges(clientTasks, clientProjects) {
  const results = { tasks: [], projects: [] };

  const task = change.data; 
  for (const task of clientTasks) {
    try {
      if (task._action === 'create') {
        const [newTask] = await sql`
          INSERT INTO tasks (id, title, description, completed, priority, due_date, project_id, created_at, updated_at)
          VALUES (${task.id}, ${task.title}, ${task.description || null}, ${task.completed}, ${task.priority}, ${task.dueDate ? task.dueDate.toISOString() : null}, ${task.projectId || null}, ${task.createdAt.toISOString()}, ${task.updatedAt.toISOString()})
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
          SET title = ${task.title}, description = ${task.description || null}, completed = ${task.completed}, 
              priority = ${task.priority}, due_date = ${task.dueDate ? task.dueDate.toISOString() : null}, 
              project_id = ${task.projectId || null}, updated_at = ${task.updatedAt.toISOString()}
          WHERE id = ${task.id}
          RETURNING *
        `;
        results.tasks.push({
          ...updatedTask,
          createdAt: updatedTask.created_at,
          updatedAt: updatedTask.updated_at,
          dueDate: updatedTask.due_date ? new Date(updatedTask.due_date) : null
        });
      } else if (task._action === 'delete') {
        await sql`DELETE FROM tasks WHERE id = ${task.id}`;
        results.tasks.push({ id: task.id, _action: 'deleted' });
      }
    } catch (error) {
      console.error(`Error processing task ${task.id}:`, error);
    }
  }

  for (const project of clientProjects) {
    try {
      if (project._action === 'create') {
        const [newProject] = await sql`
          INSERT INTO projects (id, name, description, color, created_at, updated_at)
          VALUES (${project.id}, ${project.name}, ${project.description || null}, ${project.color}, ${project.createdAt.toISOString()}, ${project.updatedAt.toISOString()})
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
          SET name = ${project.name}, description = ${project.description || null}, 
              color = ${project.color}, updated_at = ${project.updatedAt.toISOString()}
          WHERE id = ${project.id}
          RETURNING *
        `;
        results.projects.push({
          ...updatedProject,
          createdAt: updatedProject.created_at,
          updatedAt: updatedProject.updated_at
        });
      } else if (project._action === 'delete') {
        await sql`DELETE FROM projects WHERE id = ${project.id}`;
        results.projects.push({ id: project.id, _action: 'deleted' });
      }
    } catch (error) {
      console.error(`Error processing project ${project.id}:`, error);
    }
  }

  return results;
}
