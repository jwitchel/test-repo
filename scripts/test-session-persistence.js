// Test session persistence across "page refreshes" (simulated by new requests)
const baseURL = 'http://localhost:3002';

async function testSessionPersistence() {
  console.log('🧪 Testing Session Persistence\n');

  try {
    // Step 1: Sign In and get cookies
    console.log('1️⃣  Signing in...');
    const signInResponse = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3001',
      },
      body: JSON.stringify({
        email: 'test1@example.com',
        password: 'password123',
      }),
    });

    if (!signInResponse.ok) {
      throw new Error('Sign in failed');
    }

    const cookies = signInResponse.headers.get('set-cookie');
    console.log('✅ Signed in, cookies received');

    // Step 2: Wait a moment then check session (simulating page refresh)
    console.log('\n2️⃣  Simulating page refresh...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Check if session persists
    console.log('3️⃣  Checking session after "refresh"...');
    const sessionResponse = await fetch(`${baseURL}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3001',
        'Cookie': cookies || '',
      },
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to get session');
    }

    const sessionData = await sessionResponse.json();
    if (sessionData.user) {
      console.log('✅ Session persists! User:', sessionData.user.email);
      console.log('✅ Session persistence test PASSED');
    } else {
      console.log('❌ Session not found after refresh');
      console.log('❌ Session persistence test FAILED');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSessionPersistence();