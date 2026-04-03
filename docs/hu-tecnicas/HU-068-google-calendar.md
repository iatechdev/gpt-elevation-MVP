# HU-068 — Google Calendar Sync

> Sprint 6B | Should Have | 5 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> **Depende de: HU-066 (TherapySession base)**

---

## Contexto

El terapeuta puede sincronizar sus sesiones de Elevation con su Google Calendar personal. La sincronización es bidireccional: sesiones creadas en Elevation aparecen en Google Calendar, y cambios en Google Calendar se reflejan en Elevation.

---

## Flujo OAuth

```
1. Terapeuta hace click en "Sincronizar Google Calendar"
2. Frontend redirige a GET /api/therapist/google-calendar/auth
3. Backend genera URL de OAuth de Google y redirige al terapeuta
4. Terapeuta autoriza en Google
5. Google redirige a /api/therapist/google-calendar/callback?code=...
6. Backend intercambia code por accessToken + refreshToken
7. Tokens se encriptan con AES-256 y se guardan en CalendarSync
8. Se hace la primera sincronización completa
9. Frontend muestra ✓ Sincronizado
```

---

## Backend

### Archivo nuevo:
- `backend/CalendarSync.js` — modelo Sequelize

### Endpoints nuevos:
```
GET  /api/therapist/google-calendar/auth
  Genera URL de OAuth y redirige al terapeuta a Google

GET  /api/therapist/google-calendar/callback?code=...
  Recibe el code de Google, intercambia por tokens,
  encripta y guarda en CalendarSync
  Redirige al frontend con ?synced=true

GET  /api/therapist/google-calendar/sync-status
  Retorna: { isSynced, lastSyncAt, error? }

POST /api/therapist/google-calendar/sync
  Fuerza sincronización manual
  Retorna: { synced: N, errors: [] }
```

### Configuración Google Cloud:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8080/api/therapist/google-calendar/callback
```

### Scopes requeridos:
```
https://www.googleapis.com/auth/calendar
```

---

## Frontend

### En TherapistDashboard.tsx — sección nueva:
```
📅 Google Calendar
[✓ Sincronizado — última sync: hace 2h]  [Sincronizar ahora]
         o
[Conectar Google Calendar]
```

### Indicador de estado:
- ✓ Verde: sincronizado
- ⏳ Amarillo: sincronizando
- ✗ Rojo: error de sincronización

---

## Qué se sincroniza

Cada TherapySession con status='scheduled' o 'completed' se convierte en un evento de Google Calendar:
```
Título: "Sesión Elevation — [Nombre paciente]"
Fecha/hora: scheduledAt
Duración: duration minutos
Descripción: "Sesión de bienestar en Elevation"
Link: meetingUrl (si existe)
```

Cuando el terapeuta cancela en Elevation → el evento se elimina de Google Calendar.
Cuando el evento se elimina en Google Calendar → la sesión se cancela en Elevation.

---

## Criterios de aceptación

- [ ] Terapeuta puede conectar su Google Calendar via OAuth
- [ ] Sesiones existentes se sincronizan al conectar
- [ ] Nuevas sesiones aparecen en Google Calendar automáticamente
- [ ] Sesiones canceladas se eliminan de Google Calendar
- [ ] Indicador de estado de sincronización visible
- [ ] Si Google Calendar falla, Elevation sigue funcionando (degradación elegante)
- [ ] Tokens de Google encriptados en BD

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
