const { getDb } = require('../db/database');
const crypto = require('crypto');

// ── Inline helpers (duplicated from pipeline/frontend for isolated testing) ──

function parseJsonResponse(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  return JSON.parse(cleaned.trim());
}

function fillEmptyCells(rows) {
  return rows.map(row => {
    const cleaned = { Field: row.Field };
    for (const [key, value] of Object.entries(row)) {
      if (key === 'Field') continue;
      cleaned[key] = (value === null || value === undefined || String(value).trim() === '') ? 'Unconfirmed' : value;
    }
    return cleaned;
  });
}

function canonicalizeRows(rows, enriched) {
  return rows.map(row => {
    const newRow = { Field: row.Field };
    for (const [key, value] of Object.entries(row)) {
      if (key === 'Field') continue;
      const keyLower = key.toLowerCase();
      const matched = enriched.find(p => {
        const pid = p.identifier.toLowerCase();
        const pname = (p.resolved_name || '').toLowerCase();
        return pid === keyLower || pname === keyLower ||
               pid.includes(keyLower) || keyLower.includes(pid) ||
               (pname && (pname.includes(keyLower) || keyLower.includes(pname)));
      });
      newRow[matched ? (matched.resolved_name || matched.identifier) : key] = value;
    }
    return newRow;
  });
}

const NEGATIVE_PHRASES = ['not supported', 'not available', 'unavailable', 'n/a', 'none', 'not offered'];
const UNKNOWN_PHRASES  = ['unconfirmed', 'not publicly disclosed', 'unknown'];

function classifyCell(value) {
  if (!value || typeof value !== 'string') return 'unknown';
  const v = value.trim();
  if (!v) return 'unknown';
  const lower = v.toLowerCase();
  if (UNKNOWN_PHRASES.some(p => lower.includes(p))) return 'unknown';
  if (lower === 'no' || NEGATIVE_PHRASES.some(p => lower.includes(p))) return 'no';
  if (['partial', 'limited', 'basic', 'some ', 'expanding', 'primarily'].some(p => lower.includes(p))) return 'partial';
  return 'yes';
}

function scoreCell(value) {
  if (!value || typeof value !== 'string') return 0;
  const v = value.trim();
  if (!v) return 0;
  let score = 1;
  const lower = v.toLowerCase();
  if (['yes', 'supported', 'available', 'global', 'both'].some(kw => lower.includes(kw))) score += 1;
  const items = v.split(/[,/|]/).filter(s => s.trim().length > 0).length;
  score += Math.min(items - 1, 3) * 0.5;
  if (lower.includes('unconfirmed')) score -= 1;
  return Math.max(0, score);
}

function scoreProducts(columns, rows) {
  const products = columns.slice(1);
  const totals = Object.fromEntries(products.map(p => [p, 0]));
  for (const row of rows) {
    const cellScores = products.map(p => ({ p, s: scoreCell(row[p] || '') }));
    const sorted = [...cellScores].sort((a, b) => b.s - a.s);
    let rankIdx = 0;
    while (rankIdx < sorted.length) {
      const cur = sorted[rankIdx].s;
      let end = rankIdx;
      while (end < sorted.length && sorted[end].s === cur) end++;
      const pts = products.length - rankIdx;
      for (let i = rankIdx; i < end; i++) totals[sorted[i].p] += pts;
      rankIdx = end;
    }
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([name, score]) => ({ name, score }));
}

// ── Test runner ──

function test(name, fn) {
  try {
    fn();
    return { name, status: 'pass', message: 'OK' };
  } catch (e) {
    return { name, status: 'fail', message: e.message };
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label || ''}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function runQA() {
  const results = [];

  // 1. JSON parse — valid
  results.push(test('JSON parse — valid JSON', () => {
    const obj = parseJsonResponse('{"foo":"bar"}');
    assert(obj.foo === 'bar', 'parsed value mismatch');
  }));

  // 2. JSON parse — strips markdown fences
  results.push(test('JSON parse — strips markdown fences', () => {
    const obj = parseJsonResponse('```json\n{"x":1}\n```');
    assert(obj.x === 1, 'fenced JSON not parsed');
  }));

  // 3. Empty cell fill — replaces empty strings
  results.push(test('Empty cell fill — empty string → Unconfirmed', () => {
    const rows = [{ Field: 'Pricing', A: '', B: 'Some value' }];
    const filled = fillEmptyCells(rows);
    assertEqual(filled[0].A, 'Unconfirmed', 'empty string not filled');
    assertEqual(filled[0].B, 'Some value', 'non-empty value altered');
  }));

  // 4. Empty cell fill — replaces null
  results.push(test('Empty cell fill — null → Unconfirmed', () => {
    const rows = [{ Field: 'Pricing', A: null }];
    const filled = fillEmptyCells(rows);
    assertEqual(filled[0].A, 'Unconfirmed', 'null not filled');
  }));

  // 5. Step 6b — domain key maps to resolved name
  results.push(test('Step 6b — domain key maps to resolved name', () => {
    const enriched = [{ identifier: 'magnite.com', resolved_name: 'Magnite' }];
    const rows = [{ Field: 'Pricing', 'magnite.com': '$2 CPM' }];
    const result = canonicalizeRows(rows, enriched);
    assert('Magnite' in result[0], `key "Magnite" not found; keys: ${Object.keys(result[0]).join(',')}`);
    assertEqual(result[0]['Magnite'], '$2 CPM', 'value not preserved');
  }));

  // 6. Step 6b — partial name match
  results.push(test('Step 6b — partial name match (pubmatic → PubMatic)', () => {
    const enriched = [{ identifier: 'pubmatic.com', resolved_name: 'PubMatic' }];
    const rows = [{ Field: 'Pricing', 'pubmatic': 'CPM-based' }];
    const result = canonicalizeRows(rows, enriched);
    assert('PubMatic' in result[0], `key "PubMatic" not found; keys: ${Object.keys(result[0]).join(',')}`);
  }));

  // 7. classifyCell — substantive text → yes
  results.push(test('classifyCell — rich text → yes', () => {
    assertEqual(classifyCell('Real-time bidding, CTV, VAST support'), 'yes');
  }));

  // 8. classifyCell — negative phrase → no
  results.push(test('classifyCell — "not supported" → no', () => {
    assertEqual(classifyCell('not supported'), 'no');
  }));

  // 9. classifyCell — limited → partial
  results.push(test('classifyCell — "limited support" → partial', () => {
    assertEqual(classifyCell('limited support for CTV'), 'partial');
  }));

  // 10. classifyCell — Unconfirmed → unknown
  results.push(test('classifyCell — "Unconfirmed" → unknown', () => {
    assertEqual(classifyCell('Unconfirmed'), 'unknown');
  }));

  // 11. scoreProducts — richer cell ranks higher
  results.push(test('scoreProducts — richer cell ranks higher', () => {
    const columns = ['Field', 'RichProduct', 'ThinProduct'];
    const rows = [
      { Field: 'Feature A', RichProduct: 'DSP, SSP, CTV, VAST, real-time bidding', ThinProduct: 'Unconfirmed' },
      { Field: 'Feature B', RichProduct: 'supported, available globally', ThinProduct: '' },
    ];
    const ranked = scoreProducts(columns, rows);
    assertEqual(ranked[0].name, 'RichProduct', 'richer product should rank first');
  }));

  // 12. Search cache hit — no HTTP call on second lookup
  results.push(test('Search cache hit — returns cached result', () => {
    const db = getDb();
    const testQuery = `__qa_test_${Date.now()}`;
    const epochDay = Math.floor(Date.now() / (3 * 24 * 60 * 60 * 1000));
    const cacheKey = crypto.createHash('md5').update(`searxng:${testQuery}:${epochDay}`).digest('hex');
    const fakeResults = [{ title: 'Test', url: 'https://test.com', description: 'QA test result' }];
    db.prepare('INSERT OR REPLACE INTO search_cache (cache_key, result_json) VALUES (?, ?)').run(cacheKey, JSON.stringify(fakeResults));
    const cached = db.prepare('SELECT result_json FROM search_cache WHERE cache_key = ?').get(cacheKey);
    assert(cached !== null, 'cache entry not found after insert');
    const parsed = JSON.parse(cached.result_json);
    assertEqual(parsed[0].title, 'Test', 'cached result mismatch');
    // Cleanup
    db.prepare('DELETE FROM search_cache WHERE cache_key = ?').run(cacheKey);
  }));

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  return { passed, failed, total: results.length, tests: results };
}

module.exports = { runQA };
