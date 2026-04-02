const { classifyWithFlash } = require('./llm');

const INTENT_PROMPT = `You are an intent parser for RivalScope, an AdTech competitor analysis tool.

Given a user message and current context, extract the user's intent as JSON.

Intents:
- "analyze": user wants to compare specific products (extract product names)
- "add_product": user wants to add more products to existing list
- "remove_product": user wants to remove a product from the list
- "change_scope": user wants to change what is being compared
- "change_mode": user wants to switch between fast/deep analysis
- "find_competitors": user wants to auto-discover competitors of a product
- "unknown": cannot parse intent

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "intent": "analyze|add_product|remove_product|change_scope|change_mode|find_competitors|unknown",
  "products": ["name1", "name2"],
  "scope": "pricing|technical|full|brand safety|company structure|<custom text>",
  "mode": "fast|deep",
  "count": 3,
  "target": "product name to find competitors for"
}

Omit fields that are not applicable. "products" for analyze/add/remove, "scope" for change_scope, "mode" for change_mode, "count"+"target" for find_competitors.`;

async function parseIntent(message, context = {}) {
  const contextStr = [
    context.products?.length ? `Current products: ${context.products.map(p => p.identifier).join(', ')}` : '',
    context.scope ? `Current scope: ${context.scope}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `${INTENT_PROMPT}

${contextStr ? `CURRENT CONTEXT:\n${contextStr}\n` : ''}
USER MESSAGE: "${message}"

JSON:`;

  try {
    const raw = await classifyWithFlash(prompt, 120);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { intent: 'unknown' };
    const parsed = JSON.parse(match[0]);
    if (!parsed.intent) return { intent: 'unknown' };
    return parsed;
  } catch {
    return { intent: 'unknown' };
  }
}

module.exports = { parseIntent };
