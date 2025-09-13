// Simple test script to verify Netlify Functions setup
const { neon } = require('@neondatabase/serverless');

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

// Test Netlify Functions locally
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

runTests();
