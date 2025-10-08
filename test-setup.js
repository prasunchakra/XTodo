/**
 * Setup and Smoke Tests for XTodo Netlify Functions
 * 
 * This script performs smoke testing to verify that the development
 * environment is properly configured and all critical infrastructure
 * components are working. Smoke tests are high-level tests that check
 * basic functionality without going into detailed scenarios.
 * 
 * Tests performed:
 * 1. Database Connection Test
 *    - Validates DATABASE_URL environment variable is set
 *    - Tests connection to Neon PostgreSQL database
 *    - Verifies ability to create and drop tables
 * 
 * 2. Netlify Functions Test
 *    - Validates that Netlify Dev server is running
 *    - Tests that serverless functions are accessible
 *    - Verifies the init-db function responds correctly
 * 
 * This is different from unit tests (which test individual components)
 * and integration tests (which test component interactions). Smoke tests
 * validate that the basic infrastructure is operational before running
 * more detailed tests.
 * 
 * To run this test:
 * 1. Set DATABASE_URL in your .env file
 * 2. Start Netlify Dev: npm run dev
 * 3. In another terminal: npm run test-setup
 */

const { neon } = require('@neondatabase/serverless');

/**
 * Test 1: Database Connection
 * 
 * Validates that the application can connect to the PostgreSQL database.
 * This is a critical prerequisite for all database operations in the app.
 * 
 * Tests:
 * - Environment variable configuration
 * - Network connectivity to database
 * - SQL query execution
 * - Table creation/deletion (DDL operations)
 */
async function testDatabaseConnection() {
  try {
    // This will only work if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.log('❌ DATABASE_URL environment variable not set');
      console.log('Please set DATABASE_URL in your .env file or environment');
      return;
    }

    const sql = neon(process.env.DATABASE_URL);
    
    // Test basic connection
    const result = await sql`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    console.log('Test query result:', result);
    
    // Test table creation
    await sql`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Table creation successful');
    
    // Clean up test table
    await sql`DROP TABLE IF EXISTS test_table`;
    console.log('✅ Test cleanup successful');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

/**
 * Test 2: Netlify Functions
 * 
 * Validates that the Netlify Dev server is running and serverless
 * functions are accessible. This ensures the backend API is operational.
 * 
 * Tests:
 * - Netlify Dev server is running on port 8888
 * - Functions endpoint is accessible
 * - init-db function responds to requests
 */
async function testNetlifyFunctions() {
  try {
    const response = await fetch('http://localhost:8888/.netlify/functions/init-db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Netlify Functions working');
      console.log('Init DB response:', result);
    } else {
      console.log('❌ Netlify Functions not responding');
      console.log('Make sure to run: npm run dev');
    }
  } catch (error) {
    console.log('❌ Netlify Functions test failed:', error.message);
    console.log('Make sure to run: npm run dev');
  }
}

/**
 * Main test runner
 * 
 * Executes all smoke tests in sequence and provides setup instructions
 * if tests fail. This gives developers immediate feedback on what needs
 * to be configured.
 */
async function runTests() {
  console.log('🧪 Testing XTodo Netlify Functions Setup\n');
  
  console.log('1. Testing Database Connection...');
  await testDatabaseConnection();
  
  console.log('\n2. Testing Netlify Functions...');
  await testNetlifyFunctions();
  
  console.log('\n✨ Setup test complete!');
  console.log('\nNext steps:');
  console.log('1. Set DATABASE_URL in your .env file');
  console.log('2. Run: npm run dev');
  console.log('3. Open: http://localhost:8888');
  console.log('4. Click "Initialize DB" button');
  console.log('5. Start using the app!');
}

// Execute smoke tests
runTests();
