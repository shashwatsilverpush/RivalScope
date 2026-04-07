const jwt = require('jsonwebtoken');

function getUser(req) {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in required' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in required' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  req.user = getUser(req) || null;
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
