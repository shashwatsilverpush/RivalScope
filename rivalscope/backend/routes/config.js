const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');

const MASKED_KEYS = ['CEREBRAS_API_KEY', 'SERPER_API_KEY', 'SMTP_PASS'];

router.get('/', (req, res) => {
  const db = getDb();
  const configs = db.prepare('SELECT key, value, updated_at FROM app_config').all();
  const result = {};
  for (const { key, value, updated_at } of configs) {
    result[key] = {
      value: MASKED_KEYS.includes(key) ? (value ? '••••••••' + value.slice(-4) : '') : value,
      updated_at,
      configured: !!value,
    };
  }
  res.json(result);
});

router.post('/', (req, res) => {
  const db = getDb();
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      db.prepare('INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?,?,?)')
        .run(key, String(value), new Date().toISOString());
    }
  }
  res.json({ success: true });
});

router.get('/stats', (req, res) => {
  const db = getDb();
  const productCount = db.prepare('SELECT COUNT(*) as count FROM product_contexts').get();
  const searchCacheCount = db.prepare('SELECT COUNT(*) as count FROM search_cache').get();
  const lastEnriched = db.prepare('SELECT MAX(last_enriched_at) as last FROM product_contexts').get();
  res.json({
    productsEnriched: productCount.count,
    searchResultsCached: searchCacheCount.count,
    lastEnrichedAt: lastEnriched.last,
  });
});

module.exports = router;
