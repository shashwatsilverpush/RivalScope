const express = require('express');
const router = express.Router();
const { suggestCompetitors, validateProduct } = require('../services/competitors');
const { getCompanyData } = require('../services/crunchbase');

router.post('/suggest', async (req, res) => {
  const { product, count = 3 } = req.body;
  if (!product) return res.status(400).json({ error: 'product is required' });
  const safeCount = Math.min(Math.max(parseInt(count) || 3, 1), 10);
  try {
    const competitors = await suggestCompetitors(product, safeCount);
    res.json({ competitors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/validate', async (req, res) => {
  const { names } = req.body;
  if (!Array.isArray(names) || names.length === 0) return res.status(400).json({ error: 'names array required' });
  try {
    const results = await Promise.all(names.map(n => validateProduct(n)));
    res.json({ results: names.map((n, i) => ({ name: n, ...results[i] })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/competitors/bulk-enrich
// Accepts { companies: ["The Trade Desk", "PubMatic", ...] }
// Returns streamed NDJSON — one JSON line per company as results arrive
router.post('/bulk-enrich', async (req, res) => {
  const { companies } = req.body;
  if (!Array.isArray(companies) || companies.length === 0) {
    return res.status(400).json({ error: 'companies array required' });
  }

  // Cap at 200 to avoid runaway requests
  const names = companies.slice(0, 200);

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders?.();

  let completed = 0;
  const total = names.length;

  // Process in batches of 5 with a small delay to avoid rate limits
  for (let i = 0; i < names.length; i += 5) {
    const batch = names.slice(i, i + 5);
    const results = await Promise.all(batch.map(async name => {
      const data = await getCompanyData(name);
      return { name, ...( data || { headcount: null, founded: null, total_funding: null, last_round: null, hq: null }) };
    }));
    for (const r of results) {
      completed++;
      res.write(JSON.stringify({ ...r, _progress: { completed, total } }) + '\n');
    }
    // Brief pause between batches
    if (i + 5 < names.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  res.end();
});

module.exports = router;
