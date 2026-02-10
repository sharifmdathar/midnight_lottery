
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 8088,
    path: '/api/v3/graphql',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    const headers = JSON.stringify(res.headers);
    console.log(`HEADERS: ${headers}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(JSON.stringify({
    query: "{__schema{types{name}}}"
}));
req.end();

// Also try GET /health
const healthReq = http.request({
    hostname: 'localhost',
    port: 8088,
    path: '/health',
    method: 'GET'
}, (res) => {
    console.log(`HEALTH STATUS: ${res.statusCode}`);
});
healthReq.on('error', (e) => console.log('Health check failed: ' + e.message));
healthReq.end();

// Try GET /
const rootReq = http.request({
    hostname: 'localhost',
    port: 8088,
    path: '/',
    method: 'GET'
}, (res) => {
    console.log(`ROOT STATUS: ${res.statusCode}`);
});
rootReq.on('error', (e) => console.log('Root check failed: ' + e.message));
rootReq.end();
