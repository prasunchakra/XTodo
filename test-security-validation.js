// Unit tests for security validation functions
import validator from 'validator';

console.log('Running security validation tests...\n');

// Test email validation
console.log('Testing email validation:');
const validEmails = ['test@example.com', 'user@domain.co.uk', 'name+tag@test.org'];
const invalidEmails = ['invalid', 'test@', '@example.com', 'test@@example.com'];

validEmails.forEach(email => {
  const isValid = validator.isEmail(email);
  console.log(`  ✓ ${email}: ${isValid ? 'PASS' : 'FAIL'}`);
  if (!isValid) process.exit(1);
});

invalidEmails.forEach(email => {
  const isValid = validator.isEmail(email);
  console.log(`  ✗ ${email}: ${!isValid ? 'PASS' : 'FAIL'}`);
  if (isValid) process.exit(1);
});

// Test hex color validation
console.log('\nTesting hex color validation:');
const validColors = ['#FFFFFF', '#000000', '#3B82F6', '#ff0000'];
const invalidColors = ['#GGG', 'red', '#12345'];

validColors.forEach(color => {
  const isValid = validator.isHexColor(color);
  console.log(`  ✓ ${color}: ${isValid ? 'PASS' : 'FAIL'}`);
  if (!isValid) process.exit(1);
});

invalidColors.forEach(color => {
  const isValid = validator.isHexColor(color);
  console.log(`  ✗ ${color}: ${!isValid ? 'PASS' : 'FAIL'}`);
  if (isValid) process.exit(1);
});

// Test sanitization
console.log('\nTesting input sanitization:');
const testInputs = [
  { input: '<script>alert("xss")</script>', expected: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;' },
  { input: '  trimmed  ', shouldBeTrimmed: true }
];

testInputs.forEach(test => {
  if (test.expected) {
    const sanitized = validator.escape(test.input);
    const match = sanitized === test.expected;
    console.log(`  Sanitize "${test.input}": ${match ? 'PASS' : 'FAIL'}`);
    if (!match) {
      console.log(`    Expected: ${test.expected}`);
      console.log(`    Got: ${sanitized}`);
      process.exit(1);
    }
  }
  if (test.shouldBeTrimmed) {
    const trimmed = validator.trim(test.input);
    const match = trimmed === 'trimmed';
    console.log(`  Trim "${test.input}": ${match ? 'PASS' : 'FAIL'}`);
    if (!match) process.exit(1);
  }
});

console.log('\n✅ All security validation tests passed!');
