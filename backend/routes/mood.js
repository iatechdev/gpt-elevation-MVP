// backend/routes/mood.js
// POST /api/mood/checkin
// POST /api/mood/checkout
// GET  /api/mood/history
// verificarToken aplicado en server.js

const express = require('express');
const router  = express.Router();
const MoodLog = require('../MoodLog');

// POST /api/mood/checkin
router.post('/checkin', async (req, res) => {
  try {
    const { mood } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const [log] = await MoodLog.upsert({ UserId: req.user.id, date: today, checkin_mood: mood });
    res.json({ message: 'Check-in registrado.', log });
  } catch (error) {
    console.error('❌ Error en mood checkin:', error);
    res.status(500).json({ error: 'No se pudo registrar el check-in.' });
  }
});

// POST /api/mood/checkout
router.post('/checkout', async (req, res) => {
  try {
    const { mood } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const [log] = await MoodLog.upsert({ UserId: req.user.id, date: today, checkout_mood: mood });
    res.json({ message: 'Check-out registrado.', log });
  } catch (error) {
    console.error('❌ Error en mood checkout:', error);
    res.status(500).json({ error: 'No se pudo registrar el check-out.' });
  }
});

// GET /api/mood/history
router.get('/history', async (req, res) => {
  try {
    const logs = await MoodLog.findAll({
      where: { UserId: req.user.id },
      order: [['date', 'DESC']],
      limit: 30,
    });
    res.json(logs);
  } catch (error) {
    console.error('❌ Error obteniendo historial mood:', error);
    res.status(500).json({ error: 'No se pudo obtener el historial.' });
  }
});

module.exports = router;