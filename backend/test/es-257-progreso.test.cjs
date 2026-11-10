// ES-257 (E254-2): GET /api/user/progress promediaba las calificaciones NULAS como 0 (y las contaba en el divisor): con 4 y NULL devolvía avgRating 2 mientras la lista mostraba «4 de 5».
// Ahora los promedios salen de los valores VÁLIDOS (1-5) y son null si no hay ninguno. Aquí: lógica pura y la ruta real con los modelos simulados; el comportamiento con PostgreSQL real
// está en test/integration/es-257-postgres.cjs (se ejecuta con scripts/testEs257Local.cjs).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, record, startApp } = require('./support.cjs');
const { averageRating, averageMood, round1 } = require('../utils/moodStats');

const rating = (value) => ({ rating: value });
const mood = (checkin_mood, checkout_mood) => ({ checkin_mood, checkout_mood });

test('ES-257 averageRating: las nulas y las fuera de escala no cuentan como 0 ni entran en el divisor; sin válidas -> null', () => {
  assert.equal(averageRating([rating(4), rating(null)]), 4); // antes: (4+0)/2 = 2
  assert.equal(averageRating([rating(null), rating(undefined)]), null);
  assert.equal(averageRating([]), null);
  for (const nothing of [undefined, null, 'texto', {}, [null], [{}]]) assert.equal(averageRating(nothing), null, String(nothing));
  assert.equal(averageRating([rating(1), rating(5)]), 3); // bordes
  assert.equal(averageRating([rating(1)]), 1); assert.equal(averageRating([rating(5)]), 5);
  assert.equal(averageRating([rating(0), rating(6), rating(-1), rating(NaN), rating('4'), rating(Infinity), rating(3)]), 3); // fuera de 1-5 o no numérico: se ignora
  for (let i = 0; i < 200; i++) { // propiedad: nunca sale de la escala
    const rows = Array.from({ length: 1 + (i % 9) }, (_, j) => rating((i + j) % 4 ? 1 + ((i * 3 + j) % 5) : null));
    const average = averageRating(rows); assert.ok(average === null || (average >= 1 && average <= 5), String(average));
  }
});

test('ES-257 round1: un decimal; null se queda null (el ánimo y la calificación llegan a la pantalla igual que se muestran)', () => {
  assert.equal(round1(null), null); assert.equal(round1(4), 4); assert.equal(round1(13 / 3), 4.3); assert.equal(round1(3.75), 3.8);
  assert.equal(round1(averageMood([mood(null, 4), mood(2, null)])), 3); // ánimo: solo los valores registrados
  assert.equal(round1(averageMood([mood(null, null)])), null);
});

test('ES-257 GET /api/user/progress: la ruta devuelve avgRating/avgMood sobre los valores válidos y null sin evidencia', async (t) => {
  const request = await startApp(t);
  const setup = ({ moods, ratings }) => {
    models.MoodLog.findAll = async () => moods.map((m, index) => record({ id: index + 1, date: `2026-11-0${index + 1}`, ...m }));
    models.SessionRating.findAll = async () => ratings.map((r, index) => record({ id: index + 1, date: `2026-11-0${index + 1}`, rating: r }));
    models.WellnessRecommendation.findAll = async () => [];
  };
  setup({ moods: [mood(2, null), mood(null, 4), mood(3, 3)], ratings: [4, null] });
  const mixed = await request('GET', '/api/user/progress', { role: 'user', id: 7 });
  assert.equal(mixed.status, 200);
  assert.equal(mixed.body.stats.avgRating, 4); // no 2
  assert.equal(mixed.body.stats.avgMood, 3); // (2+4+3+3)/4 = 3
  assert.equal(mixed.body.stats.totalSessions, 3);
  setup({ moods: [mood(null, null)], ratings: [null, null] });
  const none = await request('GET', '/api/user/progress', { role: 'user', id: 7 });
  assert.equal(none.body.stats.avgRating, null); assert.equal(none.body.stats.avgMood, null);
  setup({ moods: [], ratings: [] });
  const empty = await request('GET', '/api/user/progress', { role: 'user', id: 7 });
  assert.equal(empty.status, 200); assert.equal(empty.body.stats.avgRating, null); assert.equal(empty.body.stats.avgMood, null); assert.equal(empty.body.stats.streak, 0);
});
