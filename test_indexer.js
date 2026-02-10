
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 8088,
    path: '/graphql',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
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
healthReq.on('error', (e) => console.log('Health check failed'));
healthReq.end();
