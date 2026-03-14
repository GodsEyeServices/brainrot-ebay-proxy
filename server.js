const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.text({ type: '*/*', limit: '10mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/', (req, res) => res.json({ status: 'online', service: 'brainrot-ebay-proxy' }));

// eBay Trading API proxy
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
      body: req.body
    });
    const text = await ebayRes.text();
    res.set('Content-Type', 'text/xml');
    res.send(text);
  } catch (e) {
    res.status(500).send(`<e>${e.message}</e>`);
  }
});

// Image proxy — fetches any image URL bypassing CORS (Discord CDN etc)
app.get('/img', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url param' });
  try {
    const imgRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const contentType = imgRes.headers.get('content-type') || 'image/png';
    const buffer = await imgRes.buffer();
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch image: ' + e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`brainrot-ebay-proxy online — port ${PORT}`));
