// backend/middlewares/auth.js
// Middlewares JWT — fuente única de verdad
// server.js los aplica al montar cada router

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_2026';
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET no está configurado — usando valor de desarrollo');
}

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Acceso denegado. No tienes llave.' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Llave inválida o expirada.' });
  }
};

const verificarAdmin = (req, res, next) => {
  verificarToken(req, res, () => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    next();
  });
};

const verificarSuperAdmin = (req, res, next) => {
  verificarToken(req, res, () => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Acceso exclusivo para superadmin.' });
    }
    next();
  });
};

module.exports = { verificarToken, verificarAdmin, verificarSuperAdmin };