// backend/routes/aiUsage.js
// GET /api/ai/usage                 — presupuesto de IA de la propia persona (verificarToken en server.js)
// GET /api/superadmin/ai-usage      — resumen agregado del periodo (verificarSuperAdmin en server.js)
// Nunca devuelve mensajes, prompts ni respuestas; el resumen de superadmin no lista identificadores de personas.

const express = require('express');
const AiUsage = require('../AiUsage');
const AiBudgetCounter = require('../AiBudgetCounter');
const { readConfig, periodKey, periodEnd, personUsage, COHORT_ID } = require('../utils/aiBudget');

const owner = express.Router();
const admin = express.Router();

owner.get('/', async (req, res) => {
  try {
    res.json(await personUsage(req.user.id));
  } catch (error) {
    console.error('❌ Error obteniendo el uso de IA:', error.message);
    res.status(500).json({ error: 'No se pudo obtener el uso.' });
  }
});

const MAX_ROWS = 20000;
const count = (items, key) => items.reduce((acc, item) => {
  const value = item[key] ?? 'none';
  acc[value] = (acc[value] || 0) + 1;
  return acc;
}, {});

admin.get('/', async (req, res) => {
  try {
    const config = readConfig();
    if (!config) return res.json({ configured: false });
    const now = new Date();
    const key = periodKey(now, config.period);
    const rows = await AiUsage.findAll({
      where: { periodKey: key },
      attributes: ['UserId', 'kind', 'model', 'status', 'inputTokens', 'outputTokens', 'costMicros', 'currency', 'latencyMs', 'errorCode', 'appVersion'],
      limit: MAX_ROWS,
    });
    const cohort = await AiBudgetCounter.findOne({ where: { UserId: COHORT_ID, periodKey: key } });
    const completed = rows.filter((row) => row.status === 'completed');
    const latencies = completed.map((row) => row.latencyMs).filter(Number.isFinite);
    const costs = {};
    for (const row of completed) {
      if (Number.isFinite(row.costMicros) && row.currency) costs[row.currency] = (costs[row.currency] || 0) + row.costMicros;
    }
    res.json({
      configured: true,
      period: config.period,
      periodKey: key,
      resetsAt: periodEnd(now, config.period),
      limits: { perUser: config.perUser, cohort: config.cohort },
      cohortUsed: cohort ? cohort.used : 0,
      calls: rows.length,
      persons: new Set(rows.map((row) => row.UserId)).size,
      truncated: rows.length >= MAX_ROWS,
      byKind: count(rows, 'kind'),
      byStatus: count(rows, 'status'),
      byModel: count(rows, 'model'),
      byAppVersion: count(rows, 'appVersion'),
      errors: count(rows.filter((row) => row.status === 'failed'), 'errorCode'),
      tokens: {
        input: completed.reduce((sum, row) => sum + (row.inputTokens || 0), 0),
        output: completed.reduce((sum, row) => sum + (row.outputTokens || 0), 0),
      },
      averageLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
      costMicrosByCurrency: costs, // vacío mientras no haya precios verificados
    });
  } catch (error) {
    console.error('❌ Error obteniendo el resumen de uso de IA:', error.message);
    res.status(500).json({ error: 'No se pudo obtener el resumen.' });
  }
});

module.exports = { owner, admin };
