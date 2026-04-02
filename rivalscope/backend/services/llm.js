const OpenAI = require('openai');
const { getDb } = require('../db/database');

async function withRetry(fn, maxAttempts = 4) {
  let delay = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 429 && attempt < maxAttempts) {
        console.warn(`Cerebras 429 rate limit — retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}

function getApiKey() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM app_config WHERE key = 'CEREBRAS_API_KEY'").get();
  return row?.value || process.env.CEREBRAS_API_KEY;
}

function getClient() {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.startsWith('your_')) throw new Error('Cerebras API key not configured. Get a free key at cerebras.ai');
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.cerebras.ai/v1',
  });
}

async function classifyWithFlash(prompt, maxTokens = 20) {
  const client = getClient();
  const res = await withRetry(() => client.chat.completions.create({
    model: 'llama3.1-8b',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
  }));
  return res.choices[0].message.content.trim();
}

async function analyzeWithPro(systemPrompt, userPrompt) {
  const client = getClient();
  const res = await client.chat.completions.create({
    model: 'qwen-3-235b-a22b-instruct-2507',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  return res.choices[0].message.content.trim();
}

async function analyzeWithFlash(systemPrompt, userPrompt) {
  const client = getClient();
  const res = await client.chat.completions.create({
    model: 'llama3.1-8b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  return res.choices[0].message.content.trim();
}

async function analyzeWithStream(systemPrompt, userPrompt, mode, onChunk) {
  const client = getClient();
  const modelName = mode === 'deep' ? 'qwen-3-235b-a22b-instruct-2507' : 'llama3.1-8b';
  const stream = await withRetry(() => client.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
  }));
  let buffer = '';
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    buffer += text;
    if (onChunk) onChunk(text);
  }
  return buffer;
}

function parseJsonResponse(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  return JSON.parse(cleaned.trim());
}

/**
 * Attempt to close a truncated JSON string by:
 * 1. Finding the last complete top-level child (rows entry at depth 2)
 * 2. Truncating there
 * 3. Appending the closing brackets/braces needed to form valid JSON
 */
function salvageTruncatedJson(text) {
  let s = text.trim();
  const stack = [];
  let inString = false;
  let escape = false;
  let lastCompleteChildPos = -1;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']');
    } else if (ch === '}' || ch === ']') {
      stack.pop();
      // Record position after each completed child of the rows array (depth 2 = inside rows)
      if (stack.length === 2) lastCompleteChildPos = i;
    }
  }

  if (stack.length === 0) return s; // Already valid

  // Truncate to the last complete child and close remaining structure
  const base = lastCompleteChildPos > 0 ? s.substring(0, lastCompleteChildPos + 1) : s;
  return base + stack.reverse().join('');
}

async function parseWithRetry(text) {
  // Step 1: direct parse
  try { return parseJsonResponse(text); } catch {}

  // Step 2: salvage truncated JSON (bracket-close without LLM)
  try {
    const salvaged = salvageTruncatedJson(text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, ''));
    const result = JSON.parse(salvaged);
    // Only accept salvage if it has meaningful rows with product data
    const hasData = result.rows?.some(r => Object.keys(r).length > 1);
    if (hasData) {
      console.warn('parseWithRetry: used salvaged truncated JSON');
      return result;
    }
  } catch {}

  // Step 3: LLM fix as last resort
  const client = getClient();
  const fix = await withRetry(() => client.chat.completions.create({
    model: 'llama3.1-8b',
    messages: [{
      role: 'user',
      content: `Fix this JSON to be valid. Return ONLY the fixed JSON, no markdown:\n\n${text.slice(0, 4000)}`,
    }],
    max_tokens: 2000,
  }));
  return parseJsonResponse(fix.choices[0].message.content.trim());
}

module.exports = { classifyWithFlash, analyzeWithPro, analyzeWithFlash, analyzeWithStream, parseWithRetry };
