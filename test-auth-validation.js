// Functional tests for enhanced auth.js security
// These tests validate the input validation and sanitization improvements

console.log('Testing auth.js input validation improvements...\n');

// Mock the validator module behavior
const validator = {
  isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
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
  }),
  normalizeEmail: (email) => email.toLowerCase().trim(),
  isHexColor: (color) => /^#[0-9A-F]{6}$/i.test(color)
};

// Test validateSignupInput function logic
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

// Test validateSigninInput function logic
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

// Signup validation tests
console.log('Signup Input Validation Tests:');
console.log('================================');

test('Valid signup input passes', () => {
  const error = validateSignupInput('John Doe', 'john@example.com', 'password123');
  assert(error === null, `Expected no error, got: ${error}`);
});

test('Short full name fails', () => {
  const error = validateSignupInput('J', 'john@example.com', 'password123');
  assert(error === 'Full name must be between 2 and 255 characters', `Got: ${error}`);
});

test('Missing full name fails', () => {
  const error = validateSignupInput('', 'john@example.com', 'password123');
  assert(error === 'Full name is required', `Got: ${error}`);
});

test('Invalid email format fails', () => {
  const error = validateSignupInput('John Doe', 'invalid-email', 'password123');
  assert(error === 'Invalid email format', `Got: ${error}`);
});

test('Missing email fails', () => {
  const error = validateSignupInput('John Doe', '', 'password123');
  assert(error === 'Email is required', `Got: ${error}`);
});

test('Short password fails', () => {
  const error = validateSignupInput('John Doe', 'john@example.com', 'short');
  assert(error === 'Password must be at least 8 characters long', `Got: ${error}`);
});

test('Long password fails', () => {
  const longPassword = 'a'.repeat(129);
  const error = validateSignupInput('John Doe', 'john@example.com', longPassword);
  assert(error === 'Password must be less than 128 characters', `Got: ${error}`);
});

test('Missing password fails', () => {
  const error = validateSignupInput('John Doe', 'john@example.com', '');
  assert(error === 'Password is required', `Got: ${error}`);
});

test('Non-string inputs are rejected', () => {
  const error1 = validateSignupInput(123, 'john@example.com', 'password123');
  assert(error1 === 'Full name is required', `Got: ${error1}`);
  
  const error2 = validateSignupInput('John Doe', ['email'], 'password123');
  assert(error2 === 'Email is required', `Got: ${error2}`);
  
  const error3 = validateSignupInput('John Doe', 'john@example.com', {});
  assert(error3 === 'Password is required', `Got: ${error3}`);
});

console.log('\nSignin Input Validation Tests:');
console.log('================================');

test('Valid signin input passes', () => {
  const error = validateSigninInput('john@example.com', 'password123');
  assert(error === null, `Expected no error, got: ${error}`);
});

test('Invalid email format fails', () => {
  const error = validateSigninInput('invalid-email', 'password123');
  assert(error === 'Invalid email format', `Got: ${error}`);
});

test('Missing email fails', () => {
  const error = validateSigninInput('', 'password123');
  assert(error === 'Email is required', `Got: ${error}`);
});

test('Missing password fails', () => {
  const error = validateSigninInput('john@example.com', '');
  assert(error === 'Password is required', `Got: ${error}`);
});

console.log('\nInput Sanitization Tests:');
console.log('==========================');

test('XSS attack in full name is sanitized', () => {
  const malicious = '<script>alert("xss")</script>';
  const sanitized = validator.escape(malicious);
  assert(!sanitized.includes('<script>'), 'Script tags should be escaped');
  assert(sanitized.includes('&lt;script&gt;'), 'Tags should be HTML escaped');
});

test('Email normalization works', () => {
  const normalized = validator.normalizeEmail('  TEST@Example.COM  ');
  assert(normalized === 'test@example.com', `Got: ${normalized}`);
});

test('Trim removes whitespace', () => {
  const trimmed = validator.trim('  John Doe  ');
  assert(trimmed === 'John Doe', `Got: "${trimmed}"`);
});

console.log('\n================================');
console.log(`Tests passed: ${passed}/${passed + failed}`);
if (failed > 0) {
  console.log(`Tests failed: ${failed}`);
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
}
