// backend/routes/recommendations.js
// POST /api/recommendations/generate
// GET  /api/recommendations
// PUT  /api/recommendations/:id/seen
// verificarToken aplicado en server.js

const express                = require('express');
const RECOMMENDATION_CATEGORIES = ['mindfulness', 'habit', 'reflection', 'resource'];
const validRecommendations = (value) => Array.isArray(value) && value.length >= 1 && value.length <= 3
  && value.every((item) => item && typeof item === 'object' && RECOMMENDATION_CATEGORIES.includes(item.category)
    && typeof item.content === 'string' && item.content.trim().length > 0 && item.content.length <= 500);

// ES-125: las recomendaciones se generan en el idioma activo de la interfaz (opcional en el cuerpo; sin dato o inválido, español).
const LANGUAGE_NAME = { es: 'Spanish', en: 'English' };
const normalizeLang = (value) => {
  const base = typeof value === 'string' ? value.trim().toLowerCase().split(/[-_]/)[0] : '';
  return base === 'en' ? 'en' : 'es';
};
// 3 recomendaciones de hasta 500 caracteres caben en unos 600 tokens de texto; con esfuerzo bajo el razonamiento no se come el tope
// (mismo ajuste que el chat, ES43-QA-01). El presupuesto reserva max_tokens por llamada.
const RECOMMENDATIONS_MAX_TOKENS = 1200;
const RECOMMENDATIONS_OUTPUT_CONFIG = { effort: 'low' };

const router                 = express.Router();
const MoodLog                = require('../MoodLog');
const WellnessRecommendation = require('../WellnessRecommendation');
const anthropic              = require('../utils/anthropic');
const { callClaude, AiBudgetNotConfiguredError, AiBudgetExhaustedError } = require('../utils/aiClient');
const { textOf } = require('../utils/claudeText');
const { averageMood, formatAverage } = require('../utils/moodStats'); // ES-105
const { encriptar, desencriptar } = require('../utils/crypto');

// POST /api/recommendations/generate
router.post('/generate', async (req, res) => {
  try {
    const userId = req.user.id;
    const moodLogs = await MoodLog.findAll({
      where: { UserId: userId },
      order: [['date', 'DESC']],
      limit: 7,
    });

    const avgMood = formatAverage(averageMood(moodLogs), null); // ES-105: sobre los valores registrados, no sobre los registros

    const trend = moodLogs.length >= 2
      ? (moodLogs[0].checkin_mood ?? 3) >= (moodLogs[moodLogs.length - 1].checkin_mood ?? 3)
        ? 'improving' : 'declining'
      : 'stable';

    const lang = normalizeLang(req.body?.lang);
    const prompt = `You are a supportive companion for Elevation, a non-clinical emotional-support and self-knowledge platform. It is not a clinical, health or emergency service.
Write every "content" value in ${LANGUAGE_NAME[lang]}, addressing the person informally (${lang === 'es' ? 'informal "tú" form (tuteo)' : 'second person'}).
Based on this user's recent emotional data:
- Sessions in last 7 days: ${moodLogs.length}
- Average mood (1-5 scale): ${avgMood ?? 'No data yet'}
- Recent trend: ${trend}
Generate exactly 3 personalized wellness recommendations. Respond ONLY with a valid JSON array, no markdown, no extra text:
[
  { "category": "mindfulness", "content": "..." },
  { "category": "habit", "content": "..." },
  { "category": "reflection", "content": "..." }
]
Categories must be one of: mindfulness, habit, reflection, resource.
Each content must be 1-2 sentences, warm, actionable and specific to the user's emotional state.
Keep the "category" values exactly as listed (they are identifiers, do not translate them).
Never diagnose, prescribe, give medical advice or promise therapeutic or job results. Do not flatter and do not invent facts about the person.`;

    let msg;
    try {
      msg = await callClaude({
        userId, kind: 'recommendations',
        body: { model: anthropic.MODEL, max_tokens: RECOMMENDATIONS_MAX_TOKENS, output_config: RECOMMENDATIONS_OUTPUT_CONFIG, messages: [{ role: 'user', content: prompt }] },
      });
    } catch (error) {
      if (error instanceof AiBudgetExhaustedError) {
        return res.status(429).json({ error: 'Límite de uso de IA alcanzado. / AI usage limit reached.', code: 'ai_budget_exhausted', scope: error.scope, resetsAt: error.resetsAt });
      }
      if (error instanceof AiBudgetNotConfiguredError) {
        return res.status(503).json({ error: 'IA no disponible por ahora. / AI not available right now.', code: 'ai_budget_not_configured' });
      }
      console.error('❌ Error del proveedor de IA (recomendaciones):', error.errorCode || error.code);
      return res.status(502).json({ error: 'No se pudieron generar recomendaciones ahora. / Could not generate recommendations right now.', code: 'provider_unavailable', retryable: true });
    }

    // Una salida cortada por el tope de tokens es un JSON incompleto: se rechaza sin guardar nada (el reintento es seguro).
    if (msg?.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: 'Invalid model output.', code: 'invalid_model_output', retryable: true });
    }

    let recommendations = [];
    try {
      const raw = textOf(msg).replace(/```json|```/g, '').trim();
      recommendations = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'Invalid model output.', code: 'invalid_model_output', retryable: true });
    }
    // Esquema de salida: forma, categorías permitidas y longitudes. Una salida inválida se rechaza sin guardar nada.
    if (!validRecommendations(recommendations)) {
      return res.status(502).json({ error: 'Invalid model output.', code: 'invalid_model_output', retryable: true });
    }

    const saved = await Promise.all(
      recommendations.map(r =>
        WellnessRecommendation.create({
          UserId:      userId,
          content:     encriptar(r.content),
          category:    r.category,
          generatedAt: new Date(),
        })
      )
    );

    res.json(saved.map((r, i) => ({
      id:          r.id,
      category:    r.category,
      content:     recommendations[i].content,
      generatedAt: r.generatedAt,
      seenByUser:  r.seenByUser,
    })));
  } catch (error) {
    console.error('❌ Error generating recommendations:', error);
    res.status(500).json({ error: 'Could not generate recommendations.' });
  }
});

// GET /api/recommendations
router.get('/', async (req, res) => {
  try {
    const recs = await WellnessRecommendation.findAll({
      where: { UserId: req.user.id },
      order: [['generatedAt', 'DESC']],
      limit: 9,
    });
    res.json(recs.map(r => ({
      id:          r.id,
      category:    r.category,
      content:     desencriptar(r.content),
      generatedAt: r.generatedAt,
      seenByUser:  r.seenByUser,
    })));
  } catch (error) {
    console.error('❌ Error fetching recommendations:', error);
    res.status(500).json({ error: 'Could not fetch recommendations.' });
  }
});

// PUT /api/recommendations/:id/seen
router.put('/:id/seen', async (req, res) => {
  try {
    const rec = await WellnessRecommendation.findOne({
      where: { id: req.params.id, UserId: req.user.id },
    });
    if (!rec) return res.status(404).json({ error: 'Recommendation not found.' });
    await rec.update({ seenByUser: true });
    res.json({ message: 'Marked as seen.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not update recommendation.' });
  }
});

module.exports = router;