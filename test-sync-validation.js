// Functional tests for sync-data.js input validation
console.log('Testing sync-data.js input validation improvements...\n');

// Mock validator
const validator = {
  isHexColor: (color) => /^#[0-9A-F]{6}$/i.test(color),
  trim: (str) => str.trim(),
  escape: (str) => str.replace(/[&<>"'/]/g, (char) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    return map[char];
  })
};

// Validation functions from sync-data.js
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
  
  if (task.priority && !['low', 'medium', 'high'].includes(task.priority)) {
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

function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return validator.escape(validator.trim(input));
}

// Test framework
let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✓ ${description}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${description}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Task validation tests
console.log('Task Input Validation Tests:');
console.log('==============================');

test('Valid task create passes', () => {
  const task = {
    _action: 'create',
    id: 'task-123',
    title: 'Test task',
    description: 'Test description',
    completed: false,
    priority: 'medium',
    dueDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateTaskData(task);
  assert(error === null, `Expected no error, got: ${error}`);
});

test('Valid task update passes', () => {
  const task = {
    _action: 'update',
    id: 'task-123',
    title: 'Updated task',
    completed: true,
    priority: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateTaskData(task);
  assert(error === null, `Expected no error, got: ${error}`);
});

test('Valid task delete passes', () => {
  const task = {
    _action: 'delete',
    id: 'task-123'
  };
  const error = validateTaskData(task);
  assert(error === null, `Expected no error, got: ${error}`);
});

test('Task without id fails', () => {
  const task = {
    _action: 'create',
    title: 'Test task',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateTaskData(task);
  assert(error === 'Task must have a valid id', `Got: ${error}`);
});

test('Task without title fails', () => {
  const task = {
    _action: 'create',
    id: 'task-123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateTaskData(task);
  assert(error === 'Task must have a valid title', `Got: ${error}`);
});

test('Task with invalid action fails', () => {
  const task = {
    _action: 'invalid',
    id: 'task-123',
    title: 'Test task'
  };
  const error = validateTaskData(task);
  assert(error === 'Task must have a valid _action field', `Got: ${error}`);
});

test('Task with long title fails', () => {
  const task = {
    _action: 'create',
    id: 'task-123',
    title: 'a'.repeat(256),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateTaskData(task);
  assert(error === 'Task title must be less than 255 characters', `Got: ${error}`);
});

test('Task with invalid priority fails', () => {
  const task = {
    _action: 'create',
    id: 'task-123',
    title: 'Test task',
    priority: 'critical',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateTaskData(task);
  assert(error === 'Task priority must be low, medium, or high', `Got: ${error}`);
});

test('Task with invalid date fails', () => {
  const task = {
    _action: 'create',
    id: 'task-123',
    title: 'Test task',
    createdAt: 'invalid-date',
    updatedAt: new Date().toISOString()
  };
  const error = validateTaskData(task);
  assert(error === 'Task must have a valid createdAt date', `Got: ${error}`);
});

console.log('\nProject Input Validation Tests:');
console.log('=================================');

test('Valid project create passes', () => {
  const project = {
    _action: 'create',
    id: 'project-123',
    name: 'Test project',
    description: 'Test description',
    color: '#3B82F6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateProjectData(project);
  assert(error === null, `Expected no error, got: ${error}`);
});

test('Valid project update passes', () => {
  const project = {
    _action: 'update',
    id: 'project-123',
    name: 'Updated project',
    color: '#FF0000',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateProjectData(project);
  assert(error === null, `Expected no error, got: ${error}`);
});

test('Valid project delete passes', () => {
  const project = {
    _action: 'delete',
    id: 'project-123'
  };
  const error = validateProjectData(project);
  assert(error === null, `Expected no error, got: ${error}`);
});

test('Project without name fails', () => {
  const project = {
    _action: 'create',
    id: 'project-123',
    color: '#3B82F6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateProjectData(project);
  assert(error === 'Project must have a valid name', `Got: ${error}`);
});

test('Project with invalid color fails', () => {
  const project = {
    _action: 'create',
    id: 'project-123',
    name: 'Test project',
    color: 'invalid-color',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateProjectData(project);
  assert(error === 'Project color must be a valid hex color', `Got: ${error}`);
});

test('Project with long name fails', () => {
  const project = {
    _action: 'create',
    id: 'project-123',
    name: 'a'.repeat(256),
    color: '#3B82F6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const error = validateProjectData(project);
  assert(error === 'Project name must be less than 255 characters', `Got: ${error}`);
});

console.log('\nInput Sanitization Tests:');
console.log('==========================');

test('XSS attack in task title is sanitized', () => {
  const malicious = '<script>alert("xss")</script>';
  const sanitized = sanitizeString(malicious);
  assert(!sanitized.includes('<script>'), 'Script tags should be escaped');
  assert(sanitized.includes('&lt;script&gt;'), 'Tags should be HTML escaped');
});

test('XSS attack in project name is sanitized', () => {
  const malicious = '<img src=x onerror=alert(1)>';
  const sanitized = sanitizeString(malicious);
  assert(!sanitized.includes('<img'), 'HTML tags should be escaped');
});

test('String trimming works', () => {
  const input = '  Test Task  ';
  const sanitized = sanitizeString(input);
  assert(sanitized === 'Test Task', `Got: "${sanitized}"`);
});

console.log('\n================================');
console.log(`Tests passed: ${passed}/${passed + failed}`);
if (failed > 0) {
  console.log(`Tests failed: ${failed}`);
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
}
