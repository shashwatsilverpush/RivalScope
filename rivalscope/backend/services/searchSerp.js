const { getDb } = require('../db/database');
const crypto = require('crypto');

function getApiKey() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM app_config WHERE key = 'SERPER_API_KEY'").get();
  return row?.value || process.env.SERPER_API_KEY;
}

function getCacheKey(query) {
  const epochDay = Math.floor(Date.now() / (3 * 24 * 60 * 60 * 1000));
  return crypto.createHash('md5').update(`serper:${query}:${epochDay}`).digest('hex');
}

async function searchSerper(query) {
  const db = getDb();
  const cacheKey = getCacheKey(query);
  const cached = db.prepare('SELECT result_json FROM search_cache WHERE cache_key = ?').get(cacheKey);
  if (cached) return JSON.parse(cached.result_json);

  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (!res.ok) throw new Error(`Serper API error: ${res.status}`);
    const data = await res.json();
    const results = (data.organic || []).slice(0, 5).map(r => ({
      title: r.title,
      url: r.link,
      description: r.snippet,
    }));
    db.prepare('INSERT OR REPLACE INTO search_cache (cache_key, result_json) VALUES (?, ?)').run(cacheKey, JSON.stringify(results));
    return results;
  } catch (e) {
    console.error('Serper search error:', e.message);
    return [];
  }
}

module.exports = { searchSerper };
