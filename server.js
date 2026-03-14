const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Raw body — handle JSON and XML both as text, parse manually
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => data += chunk);
  req.on('end', () => { req.rawBody = data; next(); });
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-EBAY-API-COMPATIBILITY-LEVEL, X-EBAY-API-CALL-NAME, X-EBAY-API-SITEID, X-EBAY-API-APP-NAME, X-EBAY-API-DEV-NAME, X-EBAY-API-CERT-NAME, X-GEMINI-KEY, X-GEMINI-MODEL');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.post('/ebay', async (req, res) => {
  try {
    const ebayRes = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-COMPATIBILITY-LEVEL': req.headers['x-ebay-api-compatibility-level'] || '967',
        'X-EBAY-API-CALL-NAME':           req.headers['x-ebay-api-call-name'] || '',
        'X-EBAY-API-SITEID':              req.headers['x-ebay-api-siteid'] || '0',
        'X-EBAY-API-APP-NAME':            req.headers['x-ebay-api-app-name'] || '',
      },
      body: req.rawBody
    });
    const text = await ebayRes.text();
    res.set('Content-Type', 'text/xml');
    res.send(text);
  } catch (e) {
    res.status(500).send(`<e>${e.message}</e>`);
  }
});

app.post('/gemini', async (req, res) => {
  try {
    const apiKey = req.headers['x-gemini-key'];
    if (!apiKey) return res.status(400).json({ error: { message: 'Missing x-gemini-key header' } });
    const model = req.headers['x-gemini-model'] || 'gemini-1.5-flash';
    const gemRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: req.rawBody }
    );
    const data = await gemRes.text();
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
    const imgRes = await fetch(url);
    const buf = await imgRes.buffer();
    res.set('Content-Type', imgRes.headers.get('content-type') || 'image/png');
    res.send(buf);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/', (req, res) => res.send('brainrot-ebay-proxy online'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Proxy running on port ${PORT}`));
