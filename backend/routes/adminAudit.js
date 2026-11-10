// backend/routes/adminAudit.js
// ES-186 (parte B) · GET /api/superadmin/audit — lectura de la auditoría de administración. SOLO superadmin (verificarSuperAdmin en server.js).
// Solo ids y claves de acción (sin contraseñas, tokens, enlaces ni correos). Paginado por cursor (`before` = id) y con filtros acotados: entrada inválida → 400, nunca 500.
const express = require('express');
const { Op } = require('sequelize');
const AdminAuditEntry = require('../AdminAuditEntry');
const { ACTIONS } = require('../utils/adminAudit');

const router = express.Router();
const INT = /^[1-9][0-9]{0,9}$/;
const MAX_INT32 = 2147483647;
const bad = (res, field) => res.status(400).json({ code: 'invalid_filter', field, error: 'Filtro inválido. / Invalid filter.' });
const one = (value) => (Array.isArray(value) ? undefined : value);

router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const where = {};
    const q = req.query;
    for (const [key, column] of [['actorId', 'actorId'], ['targetId', 'targetId'], ['before', 'id']]) {
      if (q[key] === undefined) continue;
      const value = one(q[key]);
      if (typeof value !== 'string' || !INT.test(value) || Number(value) > MAX_INT32) return bad(res, key);
      where[column] = key === 'before' ? { [Op.lt]: Number(value) } : Number(value);
    }
    if (q.action !== undefined) { const v = one(q.action); if (typeof v !== 'string' || !ACTIONS.has(v)) return bad(res, 'action'); where.action = v; }
    if (q.result !== undefined) { const v = one(q.result); if (!['ok', 'denied', 'failed'].includes(v)) return bad(res, 'result'); where.result = v; }
    let limit = 50;
    if (q.limit !== undefined) { const v = one(q.limit); if (typeof v !== 'string' || !INT.test(v) || Number(v) > 100) return bad(res, 'limit'); limit = Number(v); }
    const rows = await AdminAuditEntry.findAll({
      where, order: [['id', 'DESC']], limit: limit + 1,
      attributes: ['id', 'actorId', 'actorRole', 'action', 'targetType', 'targetId', 'result', 'createdAt'],
    });
    const page = rows.slice(0, limit);
    res.json({ entries: page, nextBefore: rows.length > limit ? page[page.length - 1].id : null });
  } catch {
    console.error('Error leyendo la auditoría de administración.');
    res.status(500).json({ error: 'No se pudo leer la auditoría. / The audit could not be loaded.' });
  }
});

module.exports = router;
