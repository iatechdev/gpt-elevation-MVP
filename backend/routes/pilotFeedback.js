// backend/routes/pilotFeedback.js
// ES-173 (HU-P22) — «Mi opinión» del piloto: la PERSONA lee, guarda y retira SU respuesta; la administración solo lee agregados con umbral.
//   GET    /api/me/pilot-feedback?window=day7|day30                       — mi respuesta vigente (o vacía), su versión y si el permiso está vigente
//   PUT    /api/me/pilot-feedback  { requestId, baseVersion, questionnaireVersion, window, answers } — crea o reemplaza (403 sin permiso, 409 por versión)
//   DELETE /api/me/pilot-feedback?window=…[&baseVersion=n]                — retira: BORRA lo respondido
//   GET    /api/admin/pilot-metrics                                       — agregados (≥ 5 personas); NUNCA respuestas individuales
// El titular siempre es req.user.id (nunca un id del cuerpo ni de la ruta). verificarToken / verificarAdmin se aplican en server.js.
const express = require('express');
const feedback = require('../utils/pilotFeedback');

const person = express.Router();
const admin = express.Router();
for (const router of [person, admin]) router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof feedback.FeedbackError) return res.status(error.status).json({ code: error.code, error: error.message, ...(error.purpose ? { purpose: error.purpose } : {}), ...(error.current ? { current: error.current } : {}) });
    console.error('Error en la opinión del piloto:', error && error.name); // nunca respuestas ni parámetros de base de datos
    res.status(500).json({ code: 'pilot_feedback_failed', error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
};

// Un parámetro repetido (?window=a&window=b) llega como lista: se rechaza como valor inválido, nunca como texto.
const single = (value) => (Array.isArray(value) ? null : value);
const versionOf = (raw) => { if (raw === undefined) return undefined; const text = single(raw); return typeof text === 'string' && /^[0-9]{1,10}$/.test(text) ? Number(text) : NaN; };

person.get('/pilot-feedback', handle(async (req, res) => res.json({ feedback: await feedback.read(req.user.id, single(req.query.window)) })));
person.put('/pilot-feedback', handle(async (req, res) => {
  const out = await feedback.save(req.user.id, req.body);
  res.status(out.replay ? 200 : 201).json({ feedback: out.feedback, replay: out.replay });
}));
person.delete('/pilot-feedback', handle(async (req, res) => res.json({ feedback: await feedback.withdraw(req.user.id, single(req.query.window), versionOf(req.query.baseVersion)) })));

admin.get('/', handle(async (req, res) => res.json(await feedback.aggregateMetrics())));

module.exports = { person, admin };
