// backend/routes/adminMetrics.js
// GET /api/admin/metrics
// verificarAdmin aplicado en server.js
//
// ES-180 (HU-P29): todo con agregados en SQL (antes cargaba todos los registros en memoria y hacía 2–3 consultas por profesional).
// Mismo contrato de campos que antes (+ `range`, `days30`, `total30`, `max30` y `dailyAverage30`). `sessionsByDay` se conserva (solo los días con
// registros) para la pantalla actual; `days30` trae SIEMPRE los 30 días, con 0 en los días sin registros. Los 30 días se cuentan en America/Bogotá.
// Nota de datos: «sesiones» (`totalSessions`) cuenta REGISTROS DE ÁNIMO (MoodLog), no sesiones con profesional.

const express = require('express');
const router  = express.Router();
const { sequelize } = require('../database');

const TZ = 'America/Bogota';
const num = (value) => (value === null || value === undefined ? null : Number(value));
const query = (sql, replacements) => sequelize.query(sql, { type: 'SELECT', replacements });

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const today = `(now() AT TIME ZONE :tz)::date`;
    const [users, mood, rating, week, days, therapists] = await Promise.all([
      query(`SELECT count(*) FILTER (WHERE role = 'user')::int AS "totalUsers",
                    count(*) FILTER (WHERE role = 'user' AND active)::int AS "activeUsers",
                    count(*) FILTER (WHERE role = 'therapist' AND active)::int AS "totalTherapists"
             FROM "Users"`),
      query(`SELECT count(*)::int AS "total",
                    ROUND(SUM(COALESCE("checkin_mood", 0) + COALESCE("checkout_mood", 0))::numeric
                          / NULLIF(count("checkin_mood") + count("checkout_mood"), 0), 1) AS "avgMood"
             FROM "MoodLogs"`),
      query(`SELECT ROUND(AVG("rating")::numeric, 1) AS "avgRating" FROM "SessionRatings"`),
      query(`SELECT count(DISTINCT "UserId")::int AS "activeThisWeek" FROM "MoodLogs" WHERE "date" >= ${today} - 7`, { tz: TZ }),
      query(`SELECT to_char(d, 'YYYY-MM-DD') AS "date", COALESCE(c.n, 0)::int AS "count"
             FROM generate_series(${today} - 29, ${today}, interval '1 day') AS d
             LEFT JOIN (SELECT "date", count(*) AS n FROM "MoodLogs" WHERE "date" >= ${today} - 29 GROUP BY "date") c ON c."date" = d::date
             ORDER BY d`, { tz: TZ }),
      query(`SELECT t."id", t."name", count(DISTINCT p."id")::int AS "patientCount", ROUND(AVG(r."rating")::numeric, 1) AS "avgRating"
             FROM "Users" t
             LEFT JOIN "Users" p ON p."therapistId" = t."id" AND p."role" = 'user'
             LEFT JOIN "SessionRatings" r ON r."UserId" = p."id"
             WHERE t."role" = 'therapist' AND t."active" = true
             GROUP BY t."id", t."name" ORDER BY "patientCount" DESC, t."name" ASC, t."id" ASC LIMIT 5`),
    ]);
    const days30 = days.map((d) => ({ date: d.date, count: d.count }));
    const total30 = days30.reduce((n, d) => n + d.count, 0);
    const peak = days30.reduce((best, d) => (d.count > (best ? best.count : 0) ? d : best), null);
    res.json({
      totalUsers: users[0].totalUsers, activeUsers: users[0].activeUsers, totalTherapists: users[0].totalTherapists,
      totalSessions: mood[0].total,
      avgMood: num(mood[0].avgMood), avgRating: num(rating[0].avgRating),
      activeThisWeek: week[0].activeThisWeek,
      sessionsByDay: days30.filter((d) => d.count > 0),
      range: { start: days30[0].date, end: days30[days30.length - 1].date, timeZone: TZ },
      days30, total30, max30: peak, dailyAverage30: Math.round((total30 / days30.length) * 10) / 10,
      topTherapists: therapists.map((t) => ({ id: t.id, name: t.name, patientCount: t.patientCount, avgRating: num(t.avgRating) })),
    });
  } catch (error) {
    console.error('Error fetching metrics.');
    res.status(500).json({ error: 'Could not fetch metrics.' });
  }
});

module.exports = router;
