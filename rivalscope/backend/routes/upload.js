const express = require('express');
const router = express.Router();
const multer = require('multer');
const { classifyWithFlash } = require('../services/llm');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function extractText(file) {
  const ext = file.originalname.split('.').pop().toLowerCase();

  if (ext === 'txt') return file.buffer.toString('utf8');

  if (ext === 'csv') {
    return file.buffer.toString('utf8').slice(0, 2000);
  }

  if (ext === 'pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(file.buffer);
    return data.text.slice(0, 3000);
  }

  if (ext === 'docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value.slice(0, 3000);
  }

  if (['xlsx', 'xls'].includes(ext)) {
    return file.buffer.toString('utf8').slice(0, 2000);
  }

  return file.buffer.toString('utf8').slice(0, 2000);
}

router.post('/reference', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const text = await extractText(req.file);
    const prompt = `You are analyzing a competitor analysis document. Extract only the structural template: what are the row labels (comparison fields) and column headers (product names)? Return a concise plain-text description like: "Rows: Pricing, Features, API Support... Columns: Product A, Product B..."

Document content:
${text}`;

    const formatDescription = await classifyWithFlash(prompt);
    res.json({ format: formatDescription });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
