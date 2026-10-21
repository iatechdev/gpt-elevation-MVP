// backend/routes/progress.js
// GET /api/user/progress
// PUT /api/user/onboarding-complete
// verificarToken aplicado en server.js

const express               = require('express');
const router                = express.Router();
const User                  = require('../User');
const MoodLog               = require('../MoodLog');
const SessionRating         = require('../SessionRating');
const WellnessRecommendation = require('../WellnessRecommendation');
const { desencriptar }      = require('../utils/crypto');

// GET /api/user/progress
router.get('/progress', async (req, res) => {
  try {
    const userId = req.user.id;
    const moodLogs = await MoodLog.findAll({
      where: { UserId: userId },
      order: [['date', 'DESC']],
      limit: 30,
    });
    const ratings = await SessionRating.findAll({
      where: { UserId: userId },
      order: [['date', 'DESC']],
      limit: 30,
    });
    const recommendations = await WellnessRecommendation.findAll({
      where: { UserId: userId },
      order: [['generatedAt', 'DESC']],
      limit: 5,
    });

    const allMoods  = moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean);
    const avgMood   = allMoods.length > 0
      ? Math.round((allMoods.reduce((a, b) => a + b, 0) / allMoods.length) * 10) / 10 : null;
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 10) / 10 : null;

    let streak = 0;
    const logDates = [...new Set(moodLogs.map(m => m.date))].sort().reverse();
    for (let i = 0; i < logDates.length; i++) {
      const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      if (logDates[i] === expected) streak++;
      else break;
    }

    res.json({
      stats: { totalSessions: moodLogs.length, avgMood, avgRating, streak },
      moodLogs,
      ratings,
      recommendations: recommendations.map(r => ({
        id: r.id,
        category: r.category,
        content: desencriptar(r.content),
        generatedAt: r.generatedAt,
        seenByUser: r.seenByUser,
      })),
    });
  } catch (error) {
    console.error('❌ Error fetching user progress:', error);
    res.status(500).json({ error: 'Could not fetch progress.' });
  }
});

// PUT /api/user/onboarding-complete
router.put('/onboarding-complete', async (req, res) => {
  try {
    const { motivation } = req.body;
    const updates = { onboardingCompleted: true };
    if (motivation) updates.motivation = motivation;
    await User.update(updates, { where: { id: req.user.id } });
    res.json({ message: 'Onboarding completado.' });
  } catch (error) {
    console.error('❌ Error completando onboarding:', error);
    res.status(500).json({ error: 'No se pudo completar el onboarding.' });
  }
});

module.exports = router;