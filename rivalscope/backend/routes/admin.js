const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

// One-time admin setup — only works if zero admin accounts exist
router.post('/setup', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (existing) return res.status(403).json({ error: 'Admin already configured' });
  const hash = bcrypt.hashSync(password, 12);
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (user) {
    db.prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?").run(hash, user.id);
  } else {
    db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')").run(email.toLowerCase().trim(), hash);
  }
  res.json({ ok: true, message: `Admin account created for ${email}` });
});

// All routes below require admin
router.use(requireAdmin);

// GET /api/admin/users — list all non-admin users
router.get('/users', (req, res) => {
  const db = getDb();
  const users = db.prepare(
    "SELECT id, email, role, created_at FROM users WHERE role != 'admin' ORDER BY created_at DESC"
  ).all();
  // Attach counts
  const withCounts = users.map(u => {
    const analysisCount = db.prepare('SELECT COUNT(*) as c FROM analyses WHERE user_id = ?').get(u.id)?.c || 0;
    const scheduleCount = db.prepare('SELECT COUNT(*) as c FROM schedules WHERE user_id = ?').get(u.id)?.c || 0;
    return { ...u, analysisCount, scheduleCount };
  });
  res.json(withCounts);
});

// GET /api/admin/users/:userId/history — view a user's analyses
router.get('/users/:userId/history', (req, res) => {
  const db = getDb();
  // Ensure the target user is not an admin
  const target = db.prepare("SELECT id, role FROM users WHERE id = ?").get(req.params.userId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin') return res.status(403).json({ error: 'Cannot view admin data' });

  const analyses = db.prepare(
    'SELECT id, title, scope, detected_category, status, created_at FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.userId);
  res.json(analyses);
});

// GET /api/admin/users/:userId/schedules — view a user's schedules
router.get('/users/:userId/schedules', (req, res) => {
  const db = getDb();
  const target = db.prepare("SELECT id, role FROM users WHERE id = ?").get(req.params.userId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin') return res.status(403).json({ error: 'Cannot view admin data' });

  const schedules = db.prepare(
    'SELECT * FROM schedules WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.params.userId);
  res.json(schedules);
});

// PUT /api/admin/users/:userId/role — promote/demote a user
router.put('/users/:userId/role', (req, res) => {
  const { role } = req.body || {};
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'role must be user or admin' });
  const db = getDb();
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.userId);
  res.json({ ok: true });
});

module.exports = router;
