// Keyword maps for fuzzy-matching result row fields to scope chips
const CHIP_KEYWORDS = {
  'Pricing & Commercial': ['pric', 'cost', 'commercial', 'spend', 'tier', 'plan', 'revenue', 'fee', 'monetiz'],
  'Technical Integration': ['api', 'sdk', 'technical', 'integration', 'onboard', 'implementation', 'latency', 'uptime'],
  'CTV/Video Capabilities': ['ctv', 'video', 'vast', 'vpaid', 'ssai', 'streaming', 'ott', 'linear', 'vod'],
  'Identity & Privacy': ['identity', 'uid', 'ramp', 'id5', 'cookie', 'privacy', 'gdpr', 'consent', 'cookieless'],
  'Brand Safety & Measurement': ['brand safety', 'viewab', 'fraud', 'moat', 'ias', 'measurement', 'verificat'],
  'Audience & Targeting': ['audience', 'targeting', 'lookalike', 'contextual', 'behavioral', 'segment', 'data partner'],
  'Reporting & Analytics': ['report', 'analytic', 'dashboard', 'attribution', 'insight', 'real-time'],
  'Support & Onboarding': ['support', 'onboard', 'sla', 'account manag', 'implementation', 'training'],
  'Full Analysis': [], // empty = matches everything
};

/**
 * Score a single cell value (0 = worst, higher = better)
 */
export function scoreCell(value) {
  if (!value || typeof value !== 'string') return 0;
  const v = value.trim();
  if (!v) return 0;

  let score = 1; // base for any non-empty value
  const lower = v.toLowerCase();

  if (v === 'Yes') {
    score += 2;
  } else if (['yes', 'supported', 'available', 'global', 'both'].some(kw => lower.includes(kw))) {
    score += 1;
  }

  // Feature richness: items separated by , / |, capped at 3 bonus
  const items = v.split(/[,/|]/).filter(s => s.trim().length > 0).length;
  score += Math.min(items - 1, 3) * 0.5;

  if (v === 'No') score -= 2;
  if (lower.includes('unconfirmed')) score -= 1;
  if (lower.includes('not publicly disclosed')) score -= 1;

  return Math.max(0, score);
}

/**
 * Given a row field name and user-defined scope weights,
 * return the weight multiplier for that row.
 */
export function getRowWeight(fieldName, scopeWeights) {
  if (!scopeWeights || scopeWeights.length === 0) return 1;
  // Ignore zero-weight scopes — fall back to unweighted if all are 0
  const active = scopeWeights.filter(w => w.weight > 0);
  if (active.length === 0) return 1;

  const lf = (fieldName || '').toLowerCase();

  for (const { field, weight } of active) {
    const keywords = CHIP_KEYWORDS[field];
    if (keywords === undefined) continue;
    if (keywords.length === 0) return weight; // Full Analysis catches all
    if (keywords.some(kw => lf.includes(kw))) return weight;
  }

  // Fallback: use Full Analysis weight if in list, else 1
  const fa = active.find(w => w.field === 'Full Analysis');
  return fa ? fa.weight : 1;
}

/**
 * Score and rank all products.
 * Returns array sorted by position: [{ name, score, position, pct }]
 */
export function scoreProducts(columns, rows, scopeWeights) {
  const products = columns.slice(1);
  const totals = Object.fromEntries(products.map(p => [p, 0]));
  const n = products.length;

  for (const row of rows) {
    const weight = getRowWeight(row.Field || '', scopeWeights);
    const cellScores = products.map(p => ({ p, s: scoreCell(row[p] || '') }));
    const sorted = [...cellScores].sort((a, b) => b.s - a.s);

    let rankIdx = 0;
    while (rankIdx < sorted.length) {
      const currentScore = sorted[rankIdx].s;
      let tieEnd = rankIdx;
      while (tieEnd < sorted.length && sorted[tieEnd].s === currentScore) tieEnd++;
      const rankPoints = n - rankIdx;
      for (let i = rankIdx; i < tieEnd; i++) {
        totals[sorted[i].p] += rankPoints * weight;
      }
      rankIdx = tieEnd;
    }
  }

  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const maxScore = ranked[0]?.[1] || 1;

  let pos = 1;
  return ranked.map(([name, score], i) => {
    if (i > 0 && ranked[i - 1][1] > score) pos = i + 1;
    return { name, score: Math.round(score * 10) / 10, position: pos, pct: Math.round((score / maxScore) * 100) };
  });
}

/**
 * Classify a cell value as supported / unsupported / unknown
 */
export function classifySupport(value) {
  if (!value || typeof value !== 'string') return 'unknown';
  const lower = value.toLowerCase().trim();
  if (!lower) return 'unknown';

  if (lower === 'no' || ['not supported', 'unavailable', 'n/a', 'not available', 'none'].some(kw => lower.includes(kw))) {
    return 'no';
  }

  const score = scoreCell(value);
  if (score >= 2 || ['yes', 'supported', 'available'].some(kw => lower.includes(kw))) {
    return 'yes';
  }

  return 'unknown';
}
