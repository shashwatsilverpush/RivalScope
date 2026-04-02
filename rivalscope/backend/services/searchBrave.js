const { getDb } = require('../db/database');
const crypto = require('crypto');

function getApiKey() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM app_config WHERE key = 'BRAVE_API_KEY'").get();
  return row?.value || process.env.BRAVE_API_KEY;
}

function getCacheKey(query) {
  const date = new Date().toISOString().split('T')[0];
  return crypto.createHash('md5').update(`brave:${query}:${date}`).digest('hex');
}

async function searchBrave(query) {
  const db = getDb();
  const cacheKey = getCacheKey(query);
  const cached = db.prepare('SELECT result_json FROM search_cache WHERE cache_key = ?').get(cacheKey);
  if (cached) return JSON.parse(cached.result_json);

  const apiKey = getApiKey();
  if (!apiKey) return [];

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });
    if (!res.ok) throw new Error(`Brave API error: ${res.status}`);
    const data = await res.json();
    const results = (data.web?.results || []).slice(0, 5).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }));
    db.prepare('INSERT OR REPLACE INTO search_cache (cache_key, result_json) VALUES (?, ?)').run(cacheKey, JSON.stringify(results));
    return results;
  } catch (e) {
    console.error('Brave search error:', e.message);
    return [];
  }
}

module.exports = { searchBrave };
