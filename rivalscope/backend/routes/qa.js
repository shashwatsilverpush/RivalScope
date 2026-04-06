const express = require('express');
const router = express.Router();
const { runQA } = require('../services/qaAgent');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/run', async (req, res) => {
  try {
    const report = await runQA();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
