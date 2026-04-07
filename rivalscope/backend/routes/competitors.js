const express = require('express');
const router = express.Router();
const { suggestCompetitors, validateProduct } = require('../services/competitors');

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

module.exports = router;
