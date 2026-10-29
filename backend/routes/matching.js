// backend/routes/matching.js
// POST /api/matching/request
// POST /api/matching/choose
// GET  /api/admin/matching/pending
// POST /api/admin/matching/:id/confirm
// verificarToken / verificarAdmin aplicados en server.js

const express          = require('express');
const router           = express.Router();
const { Op }           = require('sequelize');
const User             = require('../User');
const MoodLog          = require('../MoodLog');
const MatchingRequest  = require('../MatchingRequest');
const TherapistProfile = require('../TherapistProfile');
const anthropic        = require('../utils/anthropic');
const { callClaude, AiBudgetNotConfiguredError, AiBudgetExhaustedError } = require('../utils/aiClient');
const { textOf } = require('../utils/claudeText');
const { verificarAdmin } = require('../middlewares/auth');
const { validateBody, object, text, id } = require('../middlewares/validateBody');
const { validateIdParams } = require('../middlewares/params');

validateIdParams(router, 'id'); // ES-98 (ES93-B1)

// ES-98 (ES93-M1): se vincula solo con un terapeuta ACTIVO que acepta personas nuevas, y solo a un participante activo.
const isAvailableTherapist = (user) => Boolean(user) && user.role === 'therapist' && user.active === true
  && !(user.TherapistProfile && user.TherapistProfile.acceptingNew === false);
const unavailable = { code: 'therapist_unavailable', error: 'Ese terapeuta no está disponible. / That therapist is not available.' };

// POST /api/matching/request
router.post('/request', validateBody({ answers: value => object(value) && Object.values(value).every(text) }), async (req, res) => {
  try {
    const userId   = req.user.id;
    const { answers } = req.body;
    if (!answers) return res.status(400).json({ error: 'Answers are required.' });

    const therapists = await User.findAll({
      where: { role: 'therapist', active: true },
      attributes: ['id', 'name'],
      include: [{ model: TherapistProfile, required: false }],
    });

    const availableTherapists = therapists.filter(t =>
      !t.TherapistProfile || t.TherapistProfile.acceptingNew !== false
    );

    if (availableTherapists.length === 0) {
      return res.status(404).json({ error: 'No therapists available at this time.' });
    }

    const moodLogs = await MoodLog.findAll({
      where: { UserId: userId },
      order: [['date', 'DESC']],
      limit: 14,
    });

    // ES-98: promedio sobre todos los valores (antes se dividía entre el número de registros y casi duplicaba la cifra).
    const moodValues = moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean);
    const avgMood = moodValues.length > 0
      ? (moodValues.reduce((a, b) => a + b, 0) / moodValues.length).toFixed(1)
      : 'No data';

    const therapistList = availableTherapists.map(t => ({
      id:          t.id,
      name:        t.name,
      specialties: t.TherapistProfile?.specialties ?? [],
      approach:    t.TherapistProfile?.approach    ?? 'General wellness',
      languages:   t.TherapistProfile?.languages   ?? ['es'],
      bio:         t.TherapistProfile?.bio          ?? '',
    }));

    const prompt = `You are a matching assistant for Elevation, a mental health platform.
User questionnaire answers:
- Main area to work on: ${answers.area ?? 'Not specified'}
- Preferred style: ${answers.style ?? 'Not specified'}
- Preferred language: ${answers.language ?? 'Spanish'}
User emotional context:
- Average mood (1-5): ${avgMood}
- Recent sessions: ${moodLogs.length}
Available therapists:
${therapistList.map(t => `ID: ${t.id} | Name: ${t.name} | Specialties: ${t.specialties.join(', ')} | Approach: ${t.approach} | Languages: ${t.languages.join(', ')}`).join('\n')}
Return ONLY a valid JSON array with the top 3 matches (or fewer if less available). No markdown, no extra text:
[{ "therapistId": <id>, "score": <1-10>, "reason": "<one sentence why this therapist fits>" }]`;

    let msg;
    try {
      msg = await callClaude({
        userId, kind: 'matching',
        body: { model: anthropic.MODEL, max_tokens: 400, messages: [{ role: 'user', content: prompt }] },
      });
    } catch (error) {
      if (error instanceof AiBudgetExhaustedError) {
        return res.status(429).json({ error: 'Límite de uso de IA alcanzado. / AI usage limit reached.', code: 'ai_budget_exhausted', scope: error.scope, resetsAt: error.resetsAt });
      }
      if (error instanceof AiBudgetNotConfiguredError) {
        return res.status(503).json({ error: 'IA no disponible por ahora. / AI not available right now.', code: 'ai_budget_not_configured' });
      }
      console.error('❌ Error del proveedor de IA (matching):', error.errorCode || error.code);
      return res.status(502).json({ error: 'No se pudo procesar la solicitud ahora. / Could not process the request right now.', code: 'provider_unavailable', retryable: true });
    }

    let suggestions = [];
    try {
      const raw = textOf(msg).replace(/```json|```/g, '').trim();
      suggestions = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'Invalid model output.', code: 'invalid_model_output', retryable: true });
    }
    // Esquema de salida: solo terapeutas ofrecidos, puntuación entera 1–10 y razón corta; si no, se rechaza sin guardar.
    const offered = new Set(therapistList.map((t) => t.id));
    const validSuggestions = Array.isArray(suggestions) && suggestions.length <= 3 && suggestions.every((item) => item && typeof item === 'object'
      && offered.has(item.therapistId) && Number.isInteger(item.score) && item.score >= 1 && item.score <= 10
      && typeof item.reason === 'string' && item.reason.length <= 300);
    if (!validSuggestions) {
      return res.status(502).json({ error: 'Invalid model output.', code: 'invalid_model_output', retryable: true });
    }

    const request = await MatchingRequest.create({
      UserId: userId,
      answers,
      suggestions,
      status: 'pending',
    });

    res.json({
      requestId: request.id,
      suggestions: suggestions.map(s => ({
        ...s,
        therapistName: therapistList.find(t => t.id === s.therapistId)?.name ?? 'Unknown',
      })),
    });
  } catch (error) {
    console.error('❌ Error in matching:', error);
    res.status(500).json({ error: 'Could not process matching request.' });
  }
});

// POST /api/matching/choose
router.post('/choose', validateBody({ requestId: id, therapistId: id }), async (req, res) => {
  try {
    const { requestId, therapistId } = req.body;
    const request = await MatchingRequest.findOne({
      where: { id: requestId, UserId: req.user.id },
    });
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    if (request.status !== 'pending') {
      return res.status(409).json({ code: 'request_closed', error: 'Esta solicitud ya fue resuelta. / This request has already been resolved.' });
    }
    const therapist = await User.findOne({ where: { id: therapistId, role: 'therapist', active: true }, attributes: ['id', 'role', 'active'], include: [{ model: TherapistProfile, required: false }] });
    if (!isAvailableTherapist(therapist)) return res.status(409).json(unavailable);
    await request.update({ chosenTherapistId: therapistId, status: 'pending' });
    res.json({ message: 'Therapist chosen. Waiting for admin confirmation.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not save choice.' });
  }
});

// GET /api/admin/matching/pending
router.get('/pending', verificarAdmin, async (req, res) => {
  try {
    const requests = await MatchingRequest.findAll({
      where: { status: 'pending', chosenTherapistId: { [Op.ne]: null } },
      order: [['createdAt', 'DESC']],
    });
    const enriched = await Promise.all(requests.map(async r => {
      const user      = await User.findByPk(r.UserId,            { attributes: ['id', 'name', 'email'] });
      const therapist = await User.findByPk(r.chosenTherapistId, { attributes: ['id', 'name'] });
      return {
        id: r.id,
        user: user?.toJSON(),
        chosenTherapist: therapist?.toJSON(),
        answers: r.answers,
        createdAt: r.createdAt,
      };
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch pending requests.' });
  }
});

// POST /api/admin/matching/:id/confirm
router.post('/:id/confirm', verificarAdmin, async (req, res) => {
  try {
    const request = await MatchingRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    if (!request.chosenTherapistId)
      return res.status(400).json({ error: 'No therapist chosen yet.' });
    if (request.status !== 'pending') {
      return res.status(409).json({ code: 'request_closed', error: 'Esta solicitud ya fue resuelta. / This request has already been resolved.' });
    }
    // El terapeuta pudo desactivarse o cambiar de rol desde que se eligió; la persona debe ser un participante activo.
    const therapist = await User.findOne({ where: { id: request.chosenTherapistId, role: 'therapist', active: true }, attributes: ['id', 'role', 'active'], include: [{ model: TherapistProfile, required: false }] });
    if (!isAvailableTherapist(therapist)) return res.status(409).json(unavailable);
    const person = await User.findOne({ where: { id: request.UserId, role: 'user', active: true }, attributes: ['id'] });
    if (!person) return res.status(409).json({ code: 'person_unavailable', error: 'Esa persona no puede vincularse. / That person cannot be linked.' });
    await User.update({ therapistId: request.chosenTherapistId }, { where: { id: request.UserId } });
    await request.update({ status: 'confirmed' });
    res.json({ message: 'Therapist assigned successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not confirm assignment.' });
  }
});

module.exports = router;
