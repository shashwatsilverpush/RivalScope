const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { getDb } = require('../db/database');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function issueToken(res, user) {
  const role = user.role || 'user';
  const token = jwt.sign({ id: user.id, email: user.email, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, COOKIE_OPTS);
  return { id: user.id, email: user.email, role };
}

router.post('/signup', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email.toLowerCase().trim(), hash);
  const user = { id: result.lastInsertRowid, email: email.toLowerCase().trim() };
  res.json({ user: issueToken(res, user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ user: issueToken(res, row) });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ ok: true });
});

router.get('/me', optionalAuth, (req, res) => {
  res.json({ user: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role || 'user' } : null });
});

function getSmtpConfig() {
  const db = getDb();
  const get = (key) => db.prepare("SELECT value FROM app_config WHERE key = ?").get(key)?.value || process.env[key];
  return {
    host: get('SMTP_HOST') || 'smtp.gmail.com',
    port: parseInt(get('SMTP_PORT') || '587', 10),
    user: get('SMTP_USER'),
    pass: (get('SMTP_PASS') || '').replace(/\s/g, ''),
    from: get('SMTP_FROM'),
  };
}

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  // Always respond OK to prevent email enumeration
  if (!user) return res.json({ ok: true });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(token, expires, user.id);

  const { host, port, user: smtpUser, pass, from } = getSmtpConfig();
  if (!smtpUser || !pass || !from) {
    console.error('SMTP not configured — cannot send reset email');
    return res.json({ ok: true });
  }

  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const resetLink = `${appUrl}/reset-password?token=${token}`;
  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: smtpUser, pass } });

  try {
    await transporter.sendMail({
      from,
      to: email.toLowerCase().trim(),
      subject: 'RivalScope — Reset your password',
      html: `<p>You requested a password reset for your RivalScope account.</p>
<p><a href="${resetLink}" style="background:#0ea5e9;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
<p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`,
    });
  } catch (e) {
    console.error('Failed to send reset email:', e.message);
  }

  res.json({ ok: true });
});

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Token and new password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });
  if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
    return res.status(400).json({ error: 'Reset link has expired' });
  }

  const hash = bcrypt.hashSync(password, 12);
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

module.exports = router;
