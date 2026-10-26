// backend/middlewares/auth.js
// Middlewares JWT — fuente única de verdad
// server.js los aplica al montar cada router

const jwt = require('jsonwebtoken');

const JWT_SECRET = require('../config/jwt');
const { sessionProblem } = require('../utils/sessions');

const verificarToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Acceso denegado. No tienes llave.' });
  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Llave inválida o expirada.' });
  }
  // ES-18: la sesión debe seguir vigente en servidor (logout, corte por administrador, tokens anteriores sin jti).
  try {
    if (await sessionProblem(payload)) {
      return res.status(401).json({ error: 'Sesión cerrada o inválida. Inicia sesión de nuevo.' });
    }
  } catch (error) {
    console.error('⚠️ No se pudo verificar la sesión:', error.message);
    return res.status(503).json({ error: 'No se pudo verificar la sesión. Intenta de nuevo.' });
  }
  req.user = payload;
  next();
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

// Board members can access ethical review features
// superadmin also has access as platform owner
const verificarBoard = (req, res, next) => {
  verificarToken(req, res, () => {
    if (!['board', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado. Solo miembros de la junta ética.' });
    }
    next();
  });
};

module.exports = { verificarToken, verificarAdmin, verificarSuperAdmin, verificarBoard };
