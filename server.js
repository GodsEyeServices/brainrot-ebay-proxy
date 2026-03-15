const express = require('express');
const https = require('https');
const http = require('http');
const app = express();

app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => data += chunk);
  req.on('end', () => { req.rawBody = data; next(); });
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-EBAY-API-COMPATIBILITY-LEVEL, X-EBAY-API-CALL-NAME, X-EBAY-API-SITEID, X-EBAY-API-APP-NAME, X-GEMINI-KEY, X-GEMINI-MODEL');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Use native https instead of node-fetch to avoid "user aborted" bug
function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers || {},
      timeout: 30000
    };
    const req = https.request(opts, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out after 30s')); });
    if (body) req.write(body);
    req.end();
  });
}

app.post('/ebay', async (req, res) => {
  try {
    const text = await httpsRequest('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-COMPATIBILITY-LEVEL': req.headers['x-ebay-api-compatibility-level'] || '967',
        'X-EBAY-API-CALL-NAME':           req.headers['x-ebay-api-call-name'] || '',
        'X-EBAY-API-SITEID':              req.headers['x-ebay-api-siteid'] || '0',
        'X-EBAY-API-APP-NAME':            req.headers['x-ebay-api-app-name'] || '',
        'Content-Length':                 Buffer.byteLength(req.rawBody || '')
      }
    }, req.rawBody);
    res.set('Content-Type', 'text/xml');
    res.send(text);
  } catch (e) {
    console.error('eBay proxy error:', e.message);
    res.status(200).set('Content-Type', 'text/xml').send(
      `<?xml version="1.0"?><Errors><Error><SeverityCode>Error</SeverityCode><ShortMessage>Proxy Error</ShortMessage><LongMessage>${e.message}</LongMessage></Error></Errors>`
    );
  }
});

app.post('/gemini', async (req, res) => {
  try {
    const apiKey = req.headers['x-gemini-key'];
    if (!apiKey) return res.status(400).json({ error: { message: 'Missing x-gemini-key' } });
    const model = req.headers['x-gemini-model'] || 'gemini-2.0-flash-lite';
    const data = await httpsRequest(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(req.rawBody || '') } },
      req.rawBody
    );
    res.set('Content-Type', 'application/json');
    res.send(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

app.get('/img', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send('missing url');
    const urlObj = new URL(url);
    const mod = url.startsWith('https') ? https : http;
    mod.get(urlObj, (response) => {
      res.set('Content-Type', response.headers['content-type'] || 'image/png');
      response.pipe(res);
    }).on('error', e => res.status(500).send(e.message));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/', (req, res) => res.send('brainrot-ebay-proxy online'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Proxy running on port ${PORT}`));
