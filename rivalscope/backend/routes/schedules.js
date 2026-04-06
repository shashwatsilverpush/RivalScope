const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { reloadSchedules, scheduleJob } = require('../services/scheduler');
const { run } = require('../services/analysisPipeline');
const { compare } = require('../services/diffHighlighter');
const { send } = require('../services/emailer');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  const db = getDb();
  const schedules = db.prepare('SELECT * FROM schedules ORDER BY created_at DESC').all();
  res.json(schedules);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { label, analysis_template_id, cron_expression, email_to } = req.body;
  if (!label || !analysis_template_id || !cron_expression || !email_to) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const result = db.prepare(
    'INSERT INTO schedules (label, analysis_template_id, cron_expression, email_to) VALUES (?,?,?,?)'
  ).run(label, analysis_template_id, cron_expression, email_to);
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(result.lastInsertRowid);
  scheduleJob(schedule);

  // Fire-and-forget: run analysis immediately and email the first report
  runImmediateReport(schedule).catch(err =>
    console.error(`Immediate report failed for schedule ${schedule.id}:`, err.message)
  );

  res.json({ ...schedule, immediate_send: true });
});

async function runImmediateReport(schedule) {
  const db = getDb();
  const template = db.prepare('SELECT * FROM analyses WHERE id = ?').get(schedule.analysis_template_id);
  if (!template) throw new Error('Template analysis not found');

  const products = JSON.parse(template.products_json);
  const newAnalysis = await run({
    title: `${schedule.label} — Initial Report`,
    products,
    scope: template.scope,
  });

  await send(schedule.email_to, newAnalysis, null, `${schedule.label} (First Report)`);
  db.prepare('UPDATE schedules SET last_run_at=?, last_analysis_id=? WHERE id=?')
    .run(new Date().toISOString(), newAnalysis.id, schedule.id);
  console.log(`Immediate report sent to ${schedule.email_to} for schedule "${schedule.label}"`);
}

router.put('/:id', (req, res) => {
  const db = getDb();
  const { label, cron_expression, email_to, enabled } = req.body;
  db.prepare(
    'UPDATE schedules SET label=COALESCE(?,label), cron_expression=COALESCE(?,cron_expression), email_to=COALESCE(?,email_to), enabled=COALESCE(?,enabled) WHERE id=?'
  ).run(label, cron_expression, email_to, enabled !== undefined ? (enabled ? 1 : 0) : undefined, req.params.id);
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  scheduleJob(schedule);
  res.json(schedule);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  reloadSchedules();
  res.json({ success: true });
});

router.post('/:id/run', async (req, res) => {
  const db = getDb();
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Not found' });

  const template = db.prepare('SELECT * FROM analyses WHERE id = ?').get(schedule.analysis_template_id);
  if (!template) return res.status(404).json({ error: 'Template analysis not found' });

  try {
    const products = JSON.parse(template.products_json);
    const newAnalysis = await run({
      title: `${schedule.label} — Manual Run`,
      products,
      scope: template.scope,
    });

    let diff = null;
    if (schedule.last_analysis_id) {
      const lastAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(schedule.last_analysis_id);
      if (lastAnalysis) diff = compare(lastAnalysis, newAnalysis);
    }

    await send(schedule.email_to, newAnalysis, diff, schedule.label);
    db.prepare('UPDATE schedules SET last_run_at=?, last_analysis_id=? WHERE id=?')
      .run(new Date().toISOString(), newAnalysis.id, schedule.id);

    res.json({ success: true, analysisId: newAnalysis.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
