const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'ecocycle_secret_key_change_later';

function normalizeRole(role) {
  return String(role || '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Please log in to your EcoCycle account to continue.' });
  }

  try {
    req.user = jwt.verify(token, SECRET);
    req.user.role = normalizeRole(req.user.role);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Please log in to your EcoCycle account to continue.' });
  }
}

function requireRole(...roles) {
  const allowedRoles = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Please log in to your EcoCycle account to continue.' });
    }

    if (!allowedRoles.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: 'You are not authorized to view this page.' });
    }

    next();
  };
}

module.exports = { authRequired, requireRole };
