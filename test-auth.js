// Test auth flow
const baseUrl = 'http://localhost:8888';

async function testAuth() {
  console.log('Testing authentication flow...');
  
  try {
    // Step 1: Sign up a test user
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
      
      // Step 2: Try signing in instead
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
    
    // Step 3: Test sync with the token
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
    
    if (syncResponse.ok) {
      console.log('\n✅ Authentication flow working correctly!');
    } else {
      console.log('\n❌ Sync failed with token');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAuth();
