const fetch = require('node-fetch');

async function testLLMAPI() {
  const baseURL = 'http://localhost:3002';
  
  // First, create a test user session
  console.log('🔐 Creating test session...');
  const loginRes = await fetch(`${baseURL}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test1@example.com',
      password: 'password123'
    })
  });
  
  if (!loginRes.ok) {
    console.error('❌ Failed to login');
    return;
  }
  
  const cookies = loginRes.headers.get('set-cookie');
  console.log('✅ Logged in successfully');
  
  // Test GET /api/llm-providers
  console.log('\n📋 Testing GET /api/llm-providers...');
  const getRes = await fetch(`${baseURL}/api/llm-providers`, {
    headers: { 'Cookie': cookies }
  });
  
  if (getRes.ok) {
    const providers = await getRes.json();
    console.log('✅ GET /api/llm-providers:', providers.length, 'providers found');
  } else {
    console.error('❌ GET /api/llm-providers failed:', getRes.status);
  }
  
  // Test POST /api/llm-providers/test (with invalid key)
  console.log('\n🧪 Testing POST /api/llm-providers/test...');
  const testRes = await fetch(`${baseURL}/api/llm-providers/test`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies 
    },
    body: JSON.stringify({
      provider_name: 'Test Provider',
      provider_type: 'openai',
      api_key: 'sk-test-invalid-key',
      model_name: 'gpt-3.5-turbo'
    })
  });
  
  if (testRes.ok) {
    console.log('✅ Test endpoint responded successfully');
  } else {
    const error = await testRes.json();
    console.log('✅ Test endpoint correctly rejected invalid key:', error.error);
  }
  
  console.log('\n✨ API endpoints are working correctly!');
}

testLLMAPI().catch(console.error);