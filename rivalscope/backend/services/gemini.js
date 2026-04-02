const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getDb } = require('../db/database');

function getApiKey() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM app_config WHERE key = 'GEMINI_API_KEY'").get();
  return row?.value || process.env.GEMINI_API_KEY;
}

function getGenAI() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Gemini API key not configured');
  return new GoogleGenerativeAI(apiKey);
}

async function classifyWithFlash(prompt) {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function analyzeWithPro(systemPrompt, userPrompt) {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
  return result.response.text().trim();
}

async function analyzeWithFlash(systemPrompt, userPrompt) {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
  return result.response.text().trim();
}

async function analyzeWithStream(systemPrompt, userPrompt, mode, onChunk) {
  const genAI = getGenAI();
  const modelName = mode === 'deep' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
  const model = genAI.getGenerativeModel({ model: modelName });
  const stream = await model.generateContentStream(`${systemPrompt}\n\n${userPrompt}`);
  let buffer = '';
  for await (const chunk of stream.stream) {
    const text = chunk.text();
    buffer += text;
    if (onChunk) onChunk(text);
  }
  return buffer;
}

function parseJsonResponse(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.trim();
  return JSON.parse(cleaned);
}

async function parseWithRetry(text) {
  try {
    return parseJsonResponse(text);
  } catch (e) {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const fix = await model.generateContent(
      `Fix this JSON to be valid. Return ONLY the fixed JSON, no markdown:\n\n${text}`
    );
    const fixed = fix.response.text().trim();
    return parseJsonResponse(fixed);
  }
}

module.exports = { classifyWithFlash, analyzeWithPro, analyzeWithFlash, analyzeWithStream, parseWithRetry };
