# HU-066 — TherapySession: Modelo Base + CRUD Básico

> Sprint 6A | Must Have | 5 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> **Prerequisito de todas las HUs de calendario, videollamada y dashboard**

---

## Contexto

Antes de construir cualquier funcionalidad de sesiones, calendario o videollamada, necesitamos el modelo `TherapySession` en la BD con sus endpoints básicos. Esta HU no tiene UI visible para el usuario — es la base técnica del Sprint 6.

---

## Backend

### Archivos nuevos:
- `backend/TherapySession.js` — modelo Sequelize
- `backend/SessionNote.js` — modelo Sequelize

### Cambios en `server.js`:
1. Import de los dos modelos nuevos
2. Asociaciones:
```js
User.hasMany(TherapySession, { foreignKey: 'therapistId', as: 'therapistSessions' })
User.hasMany(TherapySession, { foreignKey: 'patientId', as: 'patientSessions' })
TherapySession.belongsTo(User, { foreignKey: 'therapistId', as: 'therapist' })
TherapySession.belongsTo(User, { foreignKey: 'patientId', as: 'patient' })
TherapySession.hasMany(SessionNote, { foreignKey: 'sessionId' })
SessionNote.belongsTo(TherapySession, { foreignKey: 'sessionId' })
```
3. Endpoints nuevos (ver abajo)

### Endpoints a crear:

```
POST /api/therapist/sessions
  Body: { patientId, scheduledAt, duration? }
  Auth: verificarToken (role=therapist)
  Valida: patientId debe ser paciente asignado al terapeuta

GET /api/therapist/sessions
  Query: ?status=scheduled|completed|all
  Auth: verificarToken (role=therapist)
  Retorna: lista de sesiones con nombre del paciente

GET /api/therapist/sessions/upcoming
  Auth: verificarToken (role=therapist)
  Retorna: próximas 5 sesiones con status='scheduled'

PUT /api/therapist/sessions/:id
  Body: { scheduledAt?, duration?, status?, cancelReason? }
  Auth: verificarToken (role=therapist)

GET /api/user/sessions/upcoming
  Auth: verificarToken (role=user)
  Retorna: { session: { scheduledAt, therapistName, meetingUrl } } o null

GET /api/user/sessions
  Auth: verificarToken (role=user)
  Retorna: historial de sesiones completadas
```

---

## Criterios de aceptación

- [ ] Modelo TherapySession creado y sincronizado en BD
- [ ] Modelo SessionNote creado y sincronizado en BD
- [ ] Terapeuta puede crear una sesión asignando fecha y paciente
- [ ] Terapeuta puede ver sus sesiones próximas
- [ ] Terapeuta puede cancelar una sesión con razón
- [ ] Usuario puede ver su próxima sesión agendada
- [ ] Todos los endpoints retornan 401 si no hay token
- [ ] Terapeuta solo puede ver/editar sus propias sesiones

---

## Prueba manual

1. Loguearse como terapeuta
2. POST /api/therapist/sessions con patientId de Karen y scheduledAt = mañana
3. GET /api/therapist/sessions/upcoming → debe retornar la sesión creada
4. Loguearse como Karen
5. GET /api/user/sessions/upcoming → debe retornar la misma sesión con el nombre del terapeuta

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
