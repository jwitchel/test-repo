// Test sign up flow
const baseURL = 'http://localhost:3002';

async function testSignUp() {
  console.log('🧪 Testing Sign Up Flow\n');

  const testEmail = `testuser${Date.now()}@example.com`;

  try {
    // Test Sign Up
    console.log('1️⃣  Testing Sign Up...');
    const signUpResponse = await fetch(`${baseURL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3001',
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'password123',
        name: 'New Test User',
      }),
    });

    if (!signUpResponse.ok) {
      const error = await signUpResponse.text();
      throw new Error(`Sign up failed: ${signUpResponse.status} - ${error}`);
    }

    const signUpData = await signUpResponse.json();
    console.log('✅ Sign Up successful:', {
      userId: signUpData.user.id,
      email: signUpData.user.email,
      name: signUpData.user.name,
    });

    // Test signing in with new account
    console.log('\n2️⃣  Testing Sign In with new account...');
    const signInResponse = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3001',
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'password123',
      }),
    });

    if (!signInResponse.ok) {
      throw new Error(`Sign in failed: ${signInResponse.status}`);
    }

    const signInData = await signInResponse.json();
    console.log('✅ Sign In successful with new account:', {
      userId: signInData.user.id,
      email: signInData.user.email,
    });

    console.log('\n✅ Sign up flow test passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testSignUp();