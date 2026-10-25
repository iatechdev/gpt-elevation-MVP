// backend/routes/adminMetrics.js
// GET /api/admin/metrics
// verificarAdmin aplicado en server.js

const express       = require('express');
const router        = express.Router();
const User          = require('../User');
const MoodLog       = require('../MoodLog');
const SessionRating = require('../SessionRating');
const { Op, fn, col } = require('sequelize');
const { sequelize } = require('../database');

router.get('/', async (req, res) => {
  try {
    const totalUsers      = await User.count({ where: { role: 'user' } });
    const activeUsers     = await User.count({ where: { role: 'user', active: true } });
    const totalTherapists = await User.count({ where: { role: 'therapist', active: true } });
    const totalSessions   = await MoodLog.count();

    const allMoods   = await MoodLog.findAll({ attributes: ['checkin_mood', 'checkout_mood'] });
    const moodValues = allMoods.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean);
    const avgMood    = moodValues.length > 0
      ? Math.round((moodValues.reduce((a, b) => a + b, 0) / moodValues.length) * 10) / 10 : null;

    const allRatings = await SessionRating.findAll({ attributes: ['rating'] });
    const avgRating  = allRatings.length > 0
      ? Math.round((allRatings.reduce((a, r) => a + r.rating, 0) / allRatings.length) * 10) / 10 : null;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeThisWeek = await MoodLog.count({
      where: { date: { [Op.gte]: weekAgo.toISOString().split('T')[0] } },
      distinct: true,
      col: 'UserId',
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessionsByDay = await MoodLog.findAll({
      where: { date: { [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0] } },
      attributes: ['date', [fn('COUNT', col('id')), 'count']],
      group: ['date'],
      order: [['date', 'ASC']],
    });

    const therapists = await User.findAll({
      where: { role: 'therapist', active: true },
      attributes: ['id', 'name', 'email'],
    });

    const topTherapists = await Promise.all(therapists.map(async (th) => {
      const patientCount = await User.count({ where: { therapistId: th.id, role: 'user' } });
      const patientIds   = await User.findAll({ where: { therapistId: th.id, role: 'user' }, attributes: ['id'] });
      const ids          = patientIds.map(p => p.id);
      const ratings      = ids.length > 0
        ? await SessionRating.findAll({ where: { UserId: ids }, attributes: ['rating'] }) : [];
      const avgThRating  = ratings.length > 0
        ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 10) / 10 : null;
      return { id: th.id, name: th.name, patientCount, avgRating: avgThRating };
    }));

    topTherapists.sort((a, b) => b.patientCount - a.patientCount);

    res.json({
      totalUsers, activeUsers, totalTherapists, totalSessions,
      avgMood, avgRating, activeThisWeek,
      sessionsByDay: sessionsByDay.map(s => ({
        date: s.date,
        count: parseInt(s.dataValues.count),
      })),
      topTherapists: topTherapists.slice(0, 5),
    });
  } catch (error) {
    console.error('❌ Error fetching metrics:', error);
    res.status(500).json({ error: 'Could not fetch metrics.' });
  }
});

module.exports = router;