// Check Supabase project status more thoroughly
const SUPABASE_URL = 'https://jkwsfjnlmcwusiycvglt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprd3Nmam5sbWN3dXNpeWN2Z2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2MzcyMjYsImV4cCI6MjA3MjIxMzIyNn0.OLAzr9q0z-tvHl1jgPo5MYC6UFaPg2CtNE1iiui8X0M';

console.log('Checking Supabase project REST endpoint...');

// Test REST API
fetch(`${SUPABASE_URL}/rest/v1/`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': `${SUPABASE_ANON_KEY}`
  }
})
  .then(res => {
    console.log('REST API Status:', res.status);
    console.log('REST API Headers:', {
      'content-type': res.headers.get('content-type'),
      'x-supabase-version': res.headers.get('x-supabase-version')
    });
    return res.text();
  })
  .then(text => {
    console.log('REST API Response (first 200 chars):', text.substring(0, 200));
  })
  .catch(err => {
    console.error('REST API Error:', err.message);
  });

// Try without Authorization header
setTimeout(() => {
  console.log('\nChecking without Authorization header...');
  fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_ANON_KEY
    }
  })
    .then(res => {
      console.log('Status (no auth):', res.status);
      return res.text();
    })
    .then(text => {
      console.log('Response (first 200 chars):', text.substring(0, 200));
    })
    .catch(err => {
      console.error('Error (no auth):', err.message);
    });
}, 1000);
