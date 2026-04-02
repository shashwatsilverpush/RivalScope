const express = require('express');
const router = express.Router();
const { run } = require('../services/analysisPipeline');
const { compare } = require('../services/diffHighlighter');
const { getDb } = require('../db/database');

// POST /api/analysis/run — SSE streaming
router.post('/run', async (req, res) => {
  const { title, products, scope, scopeWeights, referenceFormat, mode } = req.body;

  if (!products || products.length < 1) {
    return res.status(400).json({ error: 'At least one product required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    await run({
      title, products, scope, scopeWeights, referenceFormat, mode,
      onProgress: send,
    });
  } catch (err) {
    send({ step: 'error', error: err.message });
  }

  res.end();
});

// GET /api/analysis/history
router.get('/history', (req, res) => {
  const db = getDb();
  const analyses = db.prepare(
    `SELECT id, title, products_json, scope, detected_category, status, created_at, completed_at FROM analyses ORDER BY created_at DESC LIMIT 100`
  ).all();
  res.json(analyses.map(a => ({ ...a, products: JSON.parse(a.products_json || '[]') })));
});

// GET /api/analysis/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Not found' });
  const productsRaw = JSON.parse(analysis.products_json || '[]');
  const products = productsRaw.map(p => {
    const ctx = db.prepare('SELECT resolved_name, known_roles FROM product_contexts WHERE identifier = ?').get(p.identifier);
    return {
      ...p,
      resolved_name: ctx?.resolved_name || null,
      known_roles: ctx?.known_roles ? JSON.parse(ctx.known_roles) : [],
    };
  });
  res.json({
    ...analysis,
    products,
    result: analysis.result_json ? JSON.parse(analysis.result_json) : null,
  });
});

// GET /api/analysis/:id/compare/:compareId — diff current vs a baseline analysis
router.get('/:id/compare/:compareId', (req, res) => {
  const db = getDb();
  const current = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
  const baseline = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.compareId);
  if (!current || !baseline) return res.status(404).json({ error: 'Not found' });
  res.json(compare(baseline, current));
});

// DELETE /api/analysis/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM analyses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
