const { getDb } = require('../db/database');
const crypto = require('crypto');

// Public SearXNG instances with JSON API enabled
const INSTANCES = [
  'https://priv.au',
  'https://etsi.me',
  'https://search.sapti.me',
  'https://searx.tiekoetter.com',
  'https://paulgo.io',
  'https://search.mdosch.de',
  'https://search.hbubli.cc',
  'https://searx.ox2.fr',
];

function getCacheKey(query) {
  const epochDay = Math.floor(Date.now() / (3 * 24 * 60 * 60 * 1000));
  return crypto.createHash('md5').update(`searxng:${query}:${epochDay}`).digest('hex');
}

async function searchSearxng(query) {
  const db = getDb();
  const cacheKey = getCacheKey(query);
  const cached = db.prepare('SELECT result_json FROM search_cache WHERE cache_key = ?').get(cacheKey);
  if (cached) return JSON.parse(cached.result_json);

  for (const instance of INSTANCES) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&language=en&categories=general`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; RivalScope/1.0)',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) continue;
      const data = await res.json();
      const results = (data.results || []).slice(0, 8).map(r => ({
        title: r.title,
        url: r.url,
        description: r.content || r.snippet || '',
      }));
      if (results.length > 0) {
        db.prepare('INSERT OR REPLACE INTO search_cache (cache_key, result_json) VALUES (?, ?)').run(cacheKey, JSON.stringify(results));
        return results;
      }
    } catch (e) {
      // try next instance
    }
  }

  console.warn('All SearXNG instances unavailable for:', query.slice(0, 60));
  return [];
}

module.exports = { searchSearxng };
