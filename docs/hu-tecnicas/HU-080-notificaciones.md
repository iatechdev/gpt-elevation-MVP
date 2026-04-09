# HU-080 — Sistema de Notificaciones (In-app + Email)

> Sprint 10 | Should Have | 8 puntos
> Documentada: 9 de abril de 2026
> Aprobada por: Mauro Roldán
> Estado: PENDIENTE
> Depende de: HU-079 (mailer configurado), HU-067 (sesiones)

---

## Contexto

Los usuarios y terapeutas necesitan saber en tiempo real cuando ocurren eventos importantes en la plataforma. El sistema combina dos canales:
1. **In-app** — notificación del sistema operativo (Web Notifications API) con sonido suave
2. **Email** — mensajes transaccionales para eventos críticos

---

## Eventos y canales

| Evento | In-app | Email | Receptor |
|---|---|---|---|
| Sesión agendada por terapeuta | ✅ | ✅ | Usuario |
| Sesión cancelada | ✅ | ✅ | Usuario + Terapeuta |
| Sesión iniciada (terapeuta abre sala) | ✅ | ❌ | Usuario |
| Nuevo terapeuta asignado | ✅ | ✅ | Usuario |
| Matching confirmado por admin | ✅ | ✅ | Usuario |
| Prompt aprobado por superadmin | ✅ | ❌ | Terapeuta |
| Prompt rechazado por superadmin | ✅ | ✅ | Terapeuta |
| Documento de validación aprobado | ✅ | ✅ | Terapeuta |
| Documento de validación rechazado | ✅ | ✅ | Terapeuta |
| Reset de contraseña (HU-079) | ❌ | ✅ | Usuario |
| Recordatorio de sesión (1h antes) | ✅ | ✅ | Usuario + Terapeuta |

---

## Arquitectura

### Backend — `utils/mailer.js`
Singleton de nodemailer reutilizable. Templates HTML simples.

### Backend — `utils/notify.js`
Helper central que decide qué canales activar según el evento:
```js
await notify({
  type: 'session_scheduled',
  userId: 12,
  data: { therapistName: 'Ana García', scheduledAt: '2026-04-15T14:00:00Z', duration: 50 }
})
```

### Frontend — `hooks/useNotifications.ts`
Hook que:
1. Solicita permiso de notificaciones al browser al montar
2. Expone función `showNotification(title, body, options)`
3. Reproduce sonido suave (archivo .mp3 pequeño) si el usuario tiene permisos

### Frontend — Polling ligero
Cada 30 segundos, si el usuario tiene sesión activa, llama a `GET /api/notifications/unread` para verificar si hay notificaciones nuevas que mostrar in-app.

---

## Templates de email

### Sesión agendada
```
Asunto: "📅 Nueva sesión agendada en Elevation"
Cuerpo:
  Hola {nombre},
  Tu terapeuta {therapistName} ha agendado una sesión contigo.
  Fecha: {fecha y hora}
  Duración: {duration} minutos
  [Ver mi sesión →]
```

### Sesión cancelada
```
Asunto: "Tu sesión del {fecha} fue cancelada"
```

### Terapeuta asignado
```
Asunto: "🤝 Te han asignado un terapeuta en Elevation"
Cuerpo:
  Tu nuevo terapeuta es {therapistName}.
  Ya podés verlo desde tu dashboard.
  [Ir a Mi terapeuta →]
```

### Prompt rechazado (terapeuta)
```
Asunto: "Tu prompt terapéutico necesita ajustes"
Cuerpo:
  Tu versión v{N} fue revisada por el equipo de Elevation.
  Motivo: {rejection_note}
  [Proponer nueva versión →]
```

---

## Backend — Modelo `Notification.js`

```js
{
  userId:   INTEGER — receptor
  type:     STRING  — 'session_scheduled' | 'session_cancelled' | 'therapist_assigned' | etc.
  title:    STRING  — texto del título
  body:     TEXT    — texto del cuerpo
  data:     TEXT    — JSON con datos adicionales (sessionId, therapistId, etc.)
  readAt:   DATE    — null hasta que el usuario la lee
  emailSent: BOOLEAN — si el email ya fue enviado
}
```

### Endpoints nuevos:
```
GET  /api/notifications/unread    — notificaciones no leídas del usuario
PUT  /api/notifications/:id/read  — marcar como leída
PUT  /api/notifications/read-all  — marcar todas como leídas
```

---

## Frontend — Indicador visual

En el header del UserDashboard y TherapistLayout:
- Badge rojo con contador de no leídas
- Click abre panel lateral con lista de notificaciones
- Cada notificación tiene link de acción (ir a sesión, ir a dashboard, etc.)

---

## Variables de entorno

```
# Reutiliza las de HU-079
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=
```

---

## Plan de implementación

1. `utils/mailer.js` — singleton nodemailer con función `sendMail(to, subject, html)`
2. `backend/Notification.js` — modelo Sequelize
3. `utils/notify.js` — helper central con todos los templates
4. Integrar `notify()` en los puntos de trigger existentes:
   - `sessions.js` → POST therapist (nueva sesión) y POST /:id/end
   - `matching.js` → POST /:id/confirm
   - `adminPrompts.js` → aprobación/rechazo
   - `validation.js` → aprobación/rechazo documento
5. Endpoints GET/PUT notifications
6. `hooks/useNotifications.ts` + polling
7. Badge en headers

---

## Criterios de aceptación

- [ ] Notificación in-app aparece cuando el terapeuta agenda una sesión
- [ ] Email llega al usuario cuando se agenda una sesión
- [ ] Sonido suave al recibir notificación in-app
- [ ] Badge con contador en el header
- [ ] Notificaciones se marcan como leídas al verlas
- [ ] Email llega al terapeuta cuando su prompt es rechazado
- [ ] Recordatorio 1h antes de la sesión (cron job o trigger por tiempo)
- [ ] Degradación elegante si el usuario no da permisos de notificación

---
*Documentada: 9 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
