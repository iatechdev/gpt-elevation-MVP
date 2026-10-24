// backend/routes/recommendations.js
// POST /api/recommendations/generate
// GET  /api/recommendations
// PUT  /api/recommendations/:id/seen
// verificarToken aplicado en server.js

const express                = require('express');
const router                 = express.Router();
const MoodLog                = require('../MoodLog');
const WellnessRecommendation = require('../WellnessRecommendation');
const anthropic              = require('../utils/anthropic');
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

    const avgMood = moodLogs.length > 0
      ? (moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean)
          .reduce((a, b) => a + b, 0) / moodLogs.length).toFixed(1)
      : null;

    const trend = moodLogs.length >= 2
      ? (moodLogs[0].checkin_mood ?? 3) >= (moodLogs[moodLogs.length - 1].checkin_mood ?? 3)
        ? 'improving' : 'declining'
      : 'stable';

    const prompt = `You are a wellness coach for Elevation, a mental health platform.
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
Never mention diagnoses or medical advice.`;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    let recommendations = [];
    try {
      const raw = msg.content[0].text.replace(/```json|```/g, '').trim();
      recommendations = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Could not parse recommendations.' });
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