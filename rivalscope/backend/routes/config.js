const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { getCompanyData } = require('../services/crunchbase');

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

// GET /api/config/test-crunchbase — diagnostic: check key presence + raw API call
router.get('/test-crunchbase', async (req, res) => {
  const db = getDb();
  const dbRow = db.prepare("SELECT value FROM app_config WHERE key = 'CRUNCHBASE_API_KEY'").get();
  const apiKey = dbRow?.value || process.env.CRUNCHBASE_API_KEY || null;

  if (!apiKey) {
    return res.json({ error: 'CRUNCHBASE_API_KEY not found in app_config or environment', keySource: null });
  }

  const keySource = dbRow?.value ? 'app_config' : 'environment';
  const maskedKey = '••••' + apiKey.slice(-6);

  // Step 1: test autocomplete
  let autoStatus = null, autoBody = null, permalink = null;
  try {
    const autoUrl = `https://api.crunchbase.com/api/v4/autocompletes?query=The+Trade+Desk&collection_ids=organizations&user_key=${apiKey}`;
    const autoRes = await fetch(autoUrl);
    autoStatus = autoRes.status;
    autoBody = await autoRes.json();
    permalink = autoBody?.entities?.[0]?.identifier?.permalink || null;
  } catch (e) {
    autoBody = { fetchError: e.message };
  }

  // Step 2: if we got a permalink, test entity fetch
  let entityStatus = null, entityBody = null;
  if (permalink) {
    try {
      const entityUrl = `https://api.crunchbase.com/api/v4/entities/organizations/${permalink}?field_ids=num_employees_enum,founded_on,total_funding_usd&user_key=${apiKey}`;
      const entityRes = await fetch(entityUrl);
      entityStatus = entityRes.status;
      entityBody = await entityRes.json();
    } catch (e) {
      entityBody = { fetchError: e.message };
    }
  }

  // Step 3: full getCompanyData call
  const fullResult = await getCompanyData('The Trade Desk');

  res.json({
    keySource,
    maskedKey,
    autocomplete: { status: autoStatus, permalink, response: autoBody },
    entityFetch: permalink ? { status: entityStatus, response: entityBody } : 'skipped (no permalink)',
    getCompanyDataResult: fullResult,
  });
});

module.exports = router;
