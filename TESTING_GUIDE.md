# Testing Security Improvements

This guide explains how to test the security improvements made to the backend functions.

## Prerequisites

- Node.js installed
- Netlify CLI installed (`npm install -g netlify-cli`)
- Database connection configured in `.env` or Netlify environment variables

## Running Automated Tests

### Run All Security Tests
```bash
npm run test-security
```

This will run:
1. `test-security-validation.js` - Validator library tests
2. `test-auth-validation.js` - Auth endpoint validation tests (16 tests)
3. `test-sync-validation.js` - Sync endpoint validation tests (18 tests)

### Run Individual Test Suites
```bash
node test-security-validation.js
node test-auth-validation.js
node test-sync-validation.js
```

## Manual Testing

### Testing Input Validation

#### 1. Test Email Validation
Try signing up with invalid emails:

```bash
# Invalid email format (should fail)
curl -X POST http://localhost:8888/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "signup",
    "fullName": "Test User",
    "email": "invalid-email",
    "password": "testpass123"
  }'

# Expected: {"error": "Invalid email format"}
```

#### 2. Test Password Requirements
Try signing up with a short password:

```bash
# Password too short (should fail)
curl -X POST http://localhost:8888/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "signup",
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "short"
  }'

# Expected: {"error": "Password must be at least 8 characters long"}
```

#### 3. Test Full Name Validation
Try signing up with an invalid name:

```bash
# Name too short (should fail)
curl -X POST http://localhost:8888/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "signup",
    "fullName": "A",
    "email": "test@example.com",
    "password": "testpass123"
  }'

# Expected: {"error": "Full name must be between 2 and 255 characters"}
```

#### 4. Test XSS Prevention
Try creating a task with XSS payload:

```bash
# First, sign up and get a token
TOKEN=$(curl -X POST http://localhost:8888/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "signup",
    "fullName": "Test User",
    "email": "test-xss@example.com",
    "password": "testpass123"
  }' | jq -r '.token')

# Try to create a task with XSS in title
curl -X POST http://localhost:8888/api/sync-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tasks": [{
      "_action": "create",
      "id": "task-xss-test",
      "title": "<script>alert(\"xss\")</script>",
      "completed": false,
      "priority": "medium",
      "createdAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "updatedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }],
    "projects": [],
    "lastSync": null
  }'

# The response should show the title sanitized with HTML entities
# The actual database should store: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;
```

### Testing JWT Security

#### 1. Test JWT Claims Validation
The JWT now includes issuer (`iss`) and audience (`aud`) claims. Try to verify this:

```bash
# Sign up to get a token
TOKEN=$(curl -X POST http://localhost:8888/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "signup",
    "fullName": "Test User",
    "email": "test-jwt@example.com",
    "password": "testpass123"
  }' | jq -r '.token')

# Decode the JWT to see the claims (requires jwt-cli or online decoder)
echo $TOKEN | jwt decode -
# Should show: "iss": "xtodo-app", "aud": "xtodo-client"
```

#### 2. Test Production Secret Validation
Set the environment to production with default secret (should fail):

```bash
# This should cause the function to throw an error on startup
CONTEXT=production JWT_SECRET=dev_secret_change_me node -e "require('./netlify/functions/auth.js')"

# Expected: Error: JWT_SECRET must be set in production environment
```

### Testing Sync-Data Validation

#### 1. Test Invalid Task Data
Try to create a task with invalid priority:

```bash
TOKEN=<your-token-here>

curl -X POST http://localhost:8888/api/sync-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tasks": [{
      "_action": "create",
      "id": "task-invalid",
      "title": "Test Task",
      "priority": "critical",
      "completed": false,
      "createdAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "updatedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }],
    "projects": [],
    "lastSync": null
  }'

# The task will be skipped and logged as invalid
# Check server logs for: "Invalid task data: Task priority must be low, medium, or high"
```

#### 2. Test Invalid Project Color
Try to create a project with invalid color:

```bash
TOKEN=<your-token-here>

curl -X POST http://localhost:8888/api/sync-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tasks": [],
    "projects": [{
      "_action": "create",
      "id": "project-invalid",
      "name": "Test Project",
      "color": "red",
      "createdAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "updatedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }],
    "lastSync": null
  }'

# The project will be skipped and logged as invalid
# Check server logs for: "Invalid project data: Project color must be a valid hex color"
```

## Verifying SQL Injection Protection

The code uses parameterized queries via Neon's tagged template literals. To verify:

1. Check the code - all queries use the format:
   ```javascript
   sql`SELECT * FROM tasks WHERE user_id = ${userId}`
   ```

2. Never concatenated strings:
   ```javascript
   // ❌ NEVER DONE - This would be vulnerable
   sql("SELECT * FROM tasks WHERE user_id = " + userId)
   ```

3. The database driver automatically escapes and parameterizes all values

## Integration Testing

To test the full authentication flow:

```bash
# 1. Sign up
curl -X POST http://localhost:8888/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "action": "signup",
    "fullName": "Integration Test User",
    "email": "integration@test.com",
    "password": "testpass123"
  }' > signup.json

# 2. Extract token
TOKEN=$(cat signup.json | jq -r '.token')
echo "Token: $TOKEN"

# 3. Test sync endpoint
curl -X POST http://localhost:8888/api/sync-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tasks": [],
    "projects": [],
    "lastSync": null
  }'

# Should return successfully with empty tasks and projects arrays
```

## Expected Results

### All Tests Should Pass
- ✅ 34+ automated tests passing
- ✅ Build succeeds without errors
- ✅ No console errors or warnings related to security

### Security Validations Should Work
- ✅ Invalid emails rejected
- ✅ Short passwords rejected
- ✅ XSS payloads sanitized
- ✅ Invalid task/project data skipped with logging
- ✅ JWT claims validated (iss, aud)
- ✅ Production secret check works

### Backward Compatibility
- ✅ Existing valid data still works
- ✅ Properly formatted requests succeed
- ✅ Authentication flow unchanged for valid inputs

## Troubleshooting

### JWT Verification Fails
If existing tokens fail after the update:
- Old tokens don't have `iss` and `aud` claims
- Solution: Users need to sign in again to get new tokens
- Or: Temporarily make claims optional during migration period

### Sanitization Issues
If legitimate content gets over-sanitized:
- Review the `validator.escape()` calls
- Consider using `validator.unescape()` when displaying content
- Or adjust sanitization strategy for specific fields

### Performance Concerns
If validation adds too much overhead:
- Consider caching validation results
- Use schema validation libraries (e.g., zod, joi) for better performance
- Profile and optimize hot paths

## Monitoring in Production

After deploying, monitor:
1. Failed authentication attempts (may indicate attacks)
2. Validation errors in logs (may indicate client issues or attacks)
3. Token verification errors (may indicate token tampering)
4. Performance metrics (ensure validation doesn't slow down requests)

Use Netlify Functions logs and monitoring tools to track these metrics.
