const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.text({ type: 'text/xml', limit: '10mb' }));

// Allow all origins (your dashboard)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Proxy endpoint
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
    res.status(500).send(`<error>${e.message}</error>`);
  }
});

app.get('/', (req, res) => res.send('brainrot-ebay-proxy online'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
