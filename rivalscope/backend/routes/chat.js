const express = require('express');
const router = express.Router();
const { parseIntent } = require('../services/chat');

router.post('/parse', async (req, res) => {
  const { message, context = {} } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });
  try {
    const intent = await parseIntent(message, context);
    res.json(intent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
