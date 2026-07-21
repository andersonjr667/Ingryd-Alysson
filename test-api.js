// Test presents data loading
const http = require('http');

const testFetch = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/presentes',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            status: res.statusCode,
            count: Array.isArray(json) ? json.length : 0,
            firstItem: Array.isArray(json) ? json[0] : null,
            error: null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            count: 0,
            firstItem: null,
            error: `JSON parse error: ${e.message}`
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
};

testFetch()
  .then(result => {
    console.log('✅ API Test Result:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(err => {
    console.error('❌ API Test Failed:', err.message);
  });
