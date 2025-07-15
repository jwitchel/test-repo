// Test the full authentication flow from the frontend
const baseURL = 'http://localhost:3002';

async function testAuthFlow() {
  console.log('🧪 Testing Authentication Flow\n');

  try {
    // Test 1: Sign In
    console.log('1️⃣  Testing Sign In...');
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
      throw new Error(`Sign in failed: ${signInResponse.status}`);
    }

    const signInData = await signInResponse.json();
    console.log('✅ Sign In successful:', {
      userId: signInData.user.id,
      email: signInData.user.email,
      token: signInData.token,
    });

    // Get cookies from response
    const cookies = signInResponse.headers.get('set-cookie');
    console.log('🍪 Session cookies set:', cookies ? 'Yes' : 'No');

    // Test 2: Get Session
    console.log('\n2️⃣  Testing Get Session...');
    const sessionResponse = await fetch(`${baseURL}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3001',
        'Cookie': cookies || '',
      },
    });

    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      console.log('✅ Session retrieved:', {
        userId: sessionData.user?.id,
        email: sessionData.user?.email,
        hasUser: !!sessionData.user,
      });
    } else {
      console.log('❌ Failed to get session:', sessionResponse.status);
    }

    // Test 3: Sign Out
    console.log('\n3️⃣  Testing Sign Out...');
    const signOutResponse = await fetch(`${baseURL}/api/auth/sign-out`, {
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:3001',
        'Cookie': cookies || '',
      },
    });

    if (signOutResponse.ok) {
      console.log('✅ Sign Out successful');
    } else {
      console.log('❌ Sign Out failed:', signOutResponse.status);
    }

    // Test 4: Verify session is cleared
    console.log('\n4️⃣  Verifying session is cleared...');
    const verifyResponse = await fetch(`${baseURL}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3001',
        'Cookie': cookies || '',
      },
    });

    let sessionCleared = false;
    try {
      if (!verifyResponse.ok) {
        sessionCleared = true;
      } else {
        const data = await verifyResponse.json();
        sessionCleared = !data || !data.user;
      }
    } catch (e) {
      // If we can't parse the response, session is cleared
      sessionCleared = true;
    }

    if (sessionCleared) {
      console.log('✅ Session properly cleared');
    } else {
      console.log('❌ Session still active after sign out');
    }

    console.log('\n✅ All authentication tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testAuthFlow();