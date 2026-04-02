const cron = require('node-cron');
const { getDb } = require('../db/database');
const { run } = require('./analysisPipeline');
const { compare } = require('./diffHighlighter');
const { send } = require('./emailer');

const activeJobs = new Map();

function calculateNextRun(cronExpression) {
  try {
    const fields = cronExpression.trim().split(/\s+/);
    // Support both 5-field (standard) and 6-field (with leading seconds) cron
    const [minuteF, hourF, domF, monthF, dowF] = fields.length === 6 ? fields.slice(1) : fields;

    function matchField(val, expr, min) {
      if (expr === '*') return true;
      return expr.split(',').some(part => {
        if (part.includes('/')) {
          const [range, step] = part.split('/');
          const s = parseInt(step);
          const start = range === '*' ? min : parseInt(range);
          return val >= start && (val - start) % s === 0;
        }
        if (part.includes('-')) {
          const [lo, hi] = part.split('-').map(Number);
          return val >= lo && val <= hi;
        }
        return parseInt(part) === val;
      });
    }

    const next = new Date();
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);

    for (let i = 0; i < 525960; i++) { // up to 1 year of minutes
      if (
        matchField(next.getMonth() + 1, monthF, 1) &&
        matchField(next.getDate(), domF, 1) &&
        matchField(next.getDay(), dowF, 0) &&
        matchField(next.getHours(), hourF, 0) &&
        matchField(next.getMinutes(), minuteF, 0)
      ) {
        return next.toISOString();
      }
      next.setMinutes(next.getMinutes() + 1);
    }
    return null;
  } catch { return null; }
}

function scheduleJob(schedule) {
  if (activeJobs.has(schedule.id)) {
    activeJobs.get(schedule.id).stop();
    activeJobs.delete(schedule.id);
  }

  if (!schedule.enabled || !cron.validate(schedule.cron_expression)) return;

  const job = cron.schedule(schedule.cron_expression, async () => {
    const db = getDb();
    const currentSchedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule.id);
    if (!currentSchedule?.enabled) return;

    try {
      const template = db.prepare('SELECT * FROM analyses WHERE id = ?').get(schedule.analysis_template_id);
      if (!template) return;

      const products = JSON.parse(template.products_json);
      const newAnalysis = await run({
        title: `${currentSchedule.label} — Scheduled Run`,
        products,
        scope: template.scope,
        referenceFormat: template.reference_format,
      });

      let diff = null;
      if (currentSchedule.last_analysis_id) {
        const lastAnalysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(currentSchedule.last_analysis_id);
        if (lastAnalysis) diff = compare(lastAnalysis, newAnalysis);
      }

      await send(currentSchedule.email_to, newAnalysis, diff, currentSchedule.label);

      db.prepare('UPDATE schedules SET last_run_at=?, last_analysis_id=?, next_run_at=?, last_error=NULL WHERE id=?')
        .run(new Date().toISOString(), newAnalysis.id, calculateNextRun(schedule.cron_expression), schedule.id);
    } catch (err) {
      console.error(`Schedule ${schedule.id} failed:`, err.message);
      db.prepare('UPDATE schedules SET last_run_at=?, next_run_at=?, last_error=? WHERE id=?')
        .run(new Date().toISOString(), calculateNextRun(schedule.cron_expression), err.message, schedule.id);
    }
  });

  activeJobs.set(schedule.id, job);

  // Set next_run_at immediately when the job is registered
  const db = getDb();
  db.prepare('UPDATE schedules SET next_run_at=? WHERE id=?')
    .run(calculateNextRun(schedule.cron_expression), schedule.id);
}

function loadSchedules() {
  const db = getDb();
  const schedules = db.prepare('SELECT * FROM schedules WHERE enabled = 1').all();
  for (const schedule of schedules) {
    scheduleJob(schedule);
  }
  console.log(`Loaded ${schedules.length} active schedules`);
}

function reloadSchedules() {
  for (const job of activeJobs.values()) job.stop();
  activeJobs.clear();
  loadSchedules();
}

module.exports = { loadSchedules, reloadSchedules, scheduleJob, calculateNextRun };
