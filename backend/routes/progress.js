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
const { averageMood, averageRating, round1 } = require('../utils/moodStats');
const { validateBody, text, optional } = require('../middlewares/validateBody');
const { timeZoneFor, dayInZone, dayBack, clock } = require('../utils/personTimeZone'); // E393-3: el día de la persona (su zona)

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

    // ES-257: los promedios salen de los valores VÁLIDOS (1-5); una calificación o un ánimo nulos no cuentan como 0. Sin ninguno válido -> null.
    const avgMood   = round1(averageMood(moodLogs));
    const avgRating = round1(averageRating(ratings));

    // E393-3: la racha cuenta días de calendario en la zona de la persona (antes: 24 h hacia atrás sobre el día UTC).
    const timeZone = await timeZoneFor(userId);
    const today = dayInZone(clock.now(), timeZone);
    let streak = 0;
    const logDates = [...new Set(moodLogs.map(m => m.date))].sort().reverse();
    for (let i = 0; i < logDates.length; i++) {
      const expected = dayBack(today, i);
      if (logDates[i] === expected) streak++;
      else break;
    }

    res.json({
      stats: { totalSessions: moodLogs.length, avgMood, avgRating, streak },
      moodLogs,
      ratings,
      timeZone, // E393-3: la pantalla cuenta «esta semana» y pinta la tendencia con esta misma zona
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
router.put('/onboarding-complete', validateBody({ motivation: optional(text) }), async (req, res) => {
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
