const { search } = require('./searchOrchestrator');
const { classifyWithFlash } = require('./llm');

async function suggestCompetitors(product, count = 3) {
  const results = await search(`${product} top competitors alternatives adtech`);
  if (results.length === 0) return [];

  const context = results.slice(0, 6).map(r => `${r.title}: ${r.description}`).join('\n');
  const prompt = `Based on these search results about "${product}", list exactly ${count} competitor company or product names in the AdTech space.

${context}

Return ONLY a JSON array of ${count} strings, e.g. ["The Trade Desk", "Amazon DSP", "Xandr"].
Do not include "${product}" itself. No explanation, no markdown.`;

  try {
    const raw = await classifyWithFlash(prompt, 80);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(c => typeof c === 'string' && c.trim().length > 0)
      .slice(0, count)
      .map(c => c.trim());
  } catch {
    return [];
  }
}

// Returns { valid: bool, resolvedName: string|null }
async function validateProduct(name) {
  const results = await search(`${name} company product adtech`);
  if (results.length === 0) return { valid: false, resolvedName: null };

  const context = results.slice(0, 4).map(r => `${r.title}: ${r.description}`).join('\n');
  const prompt = `Based on these search results, is "${name}" a real company, software product, or technology platform?

${context}

Reply with JSON only: {"valid": true|false, "resolvedName": "Official Name or null"}
If it is real, provide the official canonical name. If it looks like random text or gibberish, set valid to false.`;

  try {
    const raw = await classifyWithFlash(prompt, 60);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { valid: results.length >= 2, resolvedName: name };
    const parsed = JSON.parse(match[0]);
    return { valid: !!parsed.valid, resolvedName: parsed.resolvedName || name };
  } catch {
    return { valid: results.length >= 2, resolvedName: name };
  }
}

module.exports = { suggestCompetitors, validateProduct };
