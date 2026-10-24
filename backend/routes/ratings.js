// backend/routes/ratings.js
// POST /api/rating
// GET  /api/rating/avg
// verificarToken / verificarAdmin aplicados en server.js

const express       = require('express');
const router        = express.Router();
const SessionRating = require('../SessionRating');

// POST /api/rating
router.post('/rating', async (req, res) => {
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

// GET /api/rating/avg — solo admin
router.get('/rating/avg', async (req, res) => {
  try {
    const ratings = await SessionRating.findAll({ attributes: ['rating'] });
    if (ratings.length === 0) return res.json({ avg: 0, total: 0 });
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const avg = Math.round((sum / ratings.length) * 10) / 10;
    res.json({ avg, total: ratings.length });
  } catch (error) {
    console.error('❌ Error obteniendo promedio:', error);
    res.status(500).json({ error: 'No se pudo obtener el promedio.' });
  }
});

module.exports = router;