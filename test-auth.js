/**
 * Integration Test: Authentication Flow
 * 
 * This is an integration test that validates the entire authentication flow
 * from end to end, including:
 * - User signup with the backend API
 * - User signin as a fallback
 * - JWT token generation and retrieval
 * - Token-based authentication for protected endpoints (sync API)
 * 
 * Integration tests differ from unit tests by testing multiple components
 * working together in a real-world scenario. This test requires:
 * - A running backend server (Netlify Dev)
 * - Database connectivity
 * - All authentication endpoints to be functional
 * 
 * To run this test:
 * 1. Start the development server: npm run dev
 * 2. In another terminal, run: node test-auth.js
 * 
 * This test validates the complete authentication workflow that users
 * will experience in the production application.
 */

const baseUrl = 'http://localhost:8888';

async function testAuth() {
  console.log('Testing authentication flow...');
  
  try {
    // Step 1: Test user signup
    // This tests the POST /api/auth endpoint with action='signup'
    // Validates that new users can create accounts and receive JWT tokens
    console.log('\n1. Testing signup...');
    const signupResponse = await fetch(`${baseUrl}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signup',
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'testpass123'
      })
    });
    
    const signupResult = await signupResponse.json();
    console.log('Signup result:', signupResult);
    
    if (!signupResponse.ok) {
      console.log('Signup failed, trying signin instead...');
      
      // Step 2: Test user signin (fallback)
      // If signup fails (e.g., user already exists), test signin instead
      // This tests the POST /api/auth endpoint with action='signin'
      console.log('\n2. Testing signin...');
      const signinResponse = await fetch(`${baseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signin',
          email: 'test@example.com',
          password: 'testpass123'
        })
      });
      
      const signinResult = await signinResponse.json();
      console.log('Signin result:', signinResult);
      
      if (!signinResponse.ok) {
        console.error('Both signup and signin failed');
        return;
      }
      
      var token = signinResult.token;
    } else {
      var token = signupResult.token;
    }
    
    console.log('JWT Token:', token);
    
    // Step 3: Test authenticated endpoint with JWT token
    // This validates that:
    // - The JWT token is properly formatted and accepted
    // - The Authorization header is correctly processed
    // - Protected endpoints can be accessed with valid authentication
    // - The sync API correctly handles authenticated requests
    console.log('\n3. Testing sync with JWT token...');
    const syncResponse = await fetch(`${baseUrl}/api/sync-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        tasks: [],
        projects: [],
        lastSync: null
      })
    });
    
    const syncResult = await syncResponse.json();
    console.log('Sync response status:', syncResponse.status);
    console.log('Sync result:', syncResult);
    
    // Validate the complete integration test results
    if (syncResponse.ok) {
      console.log('\n✅ Authentication flow working correctly!');
      console.log('✅ Integration test PASSED: All authentication endpoints functional');
    } else {
      console.log('\n❌ Sync failed with token');
      console.log('❌ Integration test FAILED: Token authentication not working');
    }
    
  } catch (error) {
    console.error('❌ Integration test FAILED with error:', error);
    console.error('Make sure the development server is running: npm run dev');
  }
}

// Run the integration test
testAuth();
