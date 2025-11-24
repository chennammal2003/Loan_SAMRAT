// Test Supabase connectivity
const SUPABASE_URL = 'https://jkwsfjnlmcwusiycvglt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprd3Nmam5sbWN3dXNpeWN2Z2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2MzcyMjYsImV4cCI6MjA3MjIxMzIyNn0.OLAzr9q0z-tvHl1jgPo5MYC6UFaPg2CtNE1iiui8X0M';

console.log('Testing Supabase connectivity...');
console.log('URL:', SUPABASE_URL);

// Test 1: Basic fetch to auth endpoint
fetch(`${SUPABASE_URL}/auth/v1/health`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  }
})
  .then(res => {
    console.log('✓ Auth endpoint responded with status:', res.status);
    return res.json();
  })
  .then(data => {
    console.log('✓ Auth endpoint response:', data);
  })
  .catch(err => {
    console.error('✗ Auth endpoint error:', err.message);
  });

// Test 2: Verify sign up endpoint
setTimeout(() => {
  console.log('\nTesting sign up endpoint...');
  fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'TestPassword123'
    })
  })
    .then(res => {
      console.log('✓ Sign up endpoint responded with status:', res.status);
      return res.json();
    })
    .then(data => {
      console.log('✓ Sign up endpoint response:', data);
    })
    .catch(err => {
      console.error('✗ Sign up endpoint error:', err.message);
    });
}, 1000);
