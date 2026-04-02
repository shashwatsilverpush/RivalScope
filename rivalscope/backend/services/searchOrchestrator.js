const { searchSearxng } = require('./searchSearxng');
const { searchSerper } = require('./searchSerp');

async function search(query) {
  // Run all sources in parallel; each returns [] gracefully if unconfigured or failed
  const [searxng, serper] = await Promise.allSettled([
    searchSearxng(query),
    searchSerper(query),
  ]);

  const all = [
    ...(searxng.status === 'fulfilled' ? searxng.value : []),
    ...(serper.status === 'fulfilled' ? serper.value : []),
  ];

  // Deduplicate by domain
  const seen = new Set();
  const merged = [];
  for (const r of all) {
    try {
      const domain = new URL(r.url).hostname;
      if (!seen.has(domain)) {
        seen.add(domain);
        merged.push(r);
      }
    } catch {
      merged.push(r);
    }
    if (merged.length >= 8) break;
  }

  return merged;
}

module.exports = { search };
