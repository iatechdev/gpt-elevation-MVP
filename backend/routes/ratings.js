// backend/routes/ratings.js
// POST /api/rating
// GET  /api/rating/avg
// verificarToken / verificarAdmin aplicados en server.js

const express       = require('express');
const router        = express.Router();
const SessionRating = require('../SessionRating');
const { sequelize } = require('../database');
const { MIN_AVERAGE_SAMPLE } = require('../utils/minAverageSample');
const { validateBody, score } = require('../middlewares/validateBody');
const { verificarAdmin } = require('../middlewares/auth');

// POST /api/rating
router.post('/rating', validateBody({ rating: score }), async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'Rating debe ser entre 1 y 5.' });
    const today = new Date().toISOString().split('T')[0];
    await SessionRating.create({ UserId: req.user.id, rating, date: today });
    res.json({ message: 'Calificación guardada.' });
  } catch (error) {
    console.error('❌ Error guardando rating:', error);
    res.status(500).json({ error: 'No se pudo guardar la calificación.' });
  }
});

// GET /api/rating/avg — solo admin (ES-98, ES93-B3: antes lo decía el comentario pero lo podía llamar cualquier participante)
// ES-273: el promedio se calcula en SQL solo con valoraciones VÁLIDAS (1-5, no nulas); `total` es el número de valoraciones válidas. Con menos de
// MIN_AVERAGE_SAMPLE válidas (QA-18-02, igual que /api/admin/metrics) o sin ninguna, `avg` es null: nunca 0 ni el valor de una sola persona.
router.get('/rating/avg', verificarAdmin, async (req, res) => {
  try {
    const [row] = await sequelize.query(
      `SELECT count("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5)::int AS "total",
              ROUND((AVG("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5))::numeric, 1) AS "avg"
       FROM "SessionRatings"`, { type: 'SELECT' });
    res.json({ avg: row.total >= MIN_AVERAGE_SAMPLE && row.avg !== null ? Number(row.avg) : null, total: row.total });
  } catch (error) {
    console.error('❌ Error obteniendo promedio:', error);
    res.status(500).json({ error: 'No se pudo obtener el promedio.' });
  }
});

module.exports = router;
