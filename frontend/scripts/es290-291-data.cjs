// Datos SINTÉTICOS para es290-291-audit.cjs con DATA=1: diario, evidencias, progreso, personas del profesional, usuarios y métricas de administración.
const days = Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, count: i % 5 }))
const LONGTXT = 'Texto sintético largo con una dirección https://ejemplo.org/ruta/muy/larga/sin/espacios/para/cortar?parametro=valorinterminable1234567890 y más palabras.'
const person = i => ({ id: i, name: `Persona Sintética ${i}`, email: `persona${i}@ejemplo.invalid`, role: i % 3 ? 'user' : 'therapist', active: true, therapistId: null, createdAt: '2026-10-01T10:00:00Z', plan: { id: 1, slug: 'piloto', name_es: 'Piloto', name_en: 'Pilot' }, isLocked: i === 2, lockedUntil: null, deletionRequested: i === 3, sharing: true, avgRating: 4.2, trend: 'stable', sessionsThisWeek: 1, totalSessions: 5, lastMood: { checkin_mood: 3, checkout_mood: 4, date: '2026-11-10' } })
const evidence = i => ({ id: i, version: 1, status: i % 2 ? 'confirmed' : 'draft', authoring: 'person', createdAt: '2026-10-20T10:00:00Z', payload: { title: `Evidencia sintética ${i}`, situation: LONGTXT, responsibility: { text: LONGTXT, source: 'self_report' }, actions: [{ text: 'Acción sintética', source: 'self_report' }] } })
const table = {
  '/api/diary': [1, 2, 3].map(i => ({ id: i, date: `2026-11-0${i}`, content: LONGTXT, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z' })),
  '/api/diary/1': { id: 1, date: '2026-11-01', content: LONGTXT, createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z' },
  '/api/evidence': { evidence: [1, 2, 3].map(evidence) },
  '/api/user/progress': { stats: { totalSessions: 5, avgMood: 3.6, avgRating: 4.2, streak: 3 }, moodLogs: [1, 2, 3, 4, 5].map(i => ({ id: i, date: `2026-11-0${i}`, checkin_mood: 2 + (i % 3), checkout_mood: 3 + (i % 2) })), ratings: [1, 2, 3].map(i => ({ id: i, date: `2026-11-0${i}`, rating: 3 + (i % 3) })), recommendations: [{ id: 1, category: 'mindfulness', content: LONGTXT, generatedAt: '2026-11-01T10:00:00Z', seenByUser: false }] },
  '/api/admin/usuarios': [1, 2, 3, 4, 5, 6].map(person),
  '/api/therapist/pacientes': [1, 2, 3, 4].map(person),
  '/api/admin/metrics': { totalUsers: 6, activeUsers: 5, totalTherapists: 2, totalSessions: 10, avgMood: 3.5, avgRating: 4.1, activeThisWeek: 4, days30: days, total30: 60, max30: { date: '2026-10-05', count: 4 }, dailyAverage30: 2, range: { start: '2026-10-01', end: '2026-10-30', timeZone: 'America/Bogota' }, topTherapists: [{ id: 1, name: 'Profesional Sintético Con Nombre Largo', patientCount: 3, avgRating: 4.2 }] },
  '/api/admin/usuarios/alerts': { sections: { guides: { status: 'ok', count: 0, items: [] }, professionalsIncomplete: { status: 'ok', count: 0 }, manifest: { status: 'ok', version: '1', date: '2026-10-01' } } },
}
module.exports = path => table[path]
