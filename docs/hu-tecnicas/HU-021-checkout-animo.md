# HU-021 — Check-out de ánimo al finalizar conversación

> Sprint 3 | Should Have | 3 puntos  
> Pendiente desde Sprint 1 — retomada en Sprint 3

---

## Descripción

Como usuario, quiero registrar cómo me siento al finalizar mi conversación con Elevation, para poder ver mi evolución emocional a lo largo del tiempo.

---

## Contexto

El check-in ya existe y funciona (HU-020). El check-out existe en UI pero **no persiste en base de datos** — la tabla `mood_logs` no fue creada en Sprint 1.

---

## Criterios de aceptación

- [ ] Tabla `mood_logs` creada en PostgreSQL
- [ ] Al finalizar el chat, se muestra pantalla de check-out con selector de emoción
- [ ] El check-out se guarda en `mood_logs` con timestamp
- [ ] Se guarda tanto el check-in como el check-out del día
- [ ] Si el usuario cierra sin hacer check-out → se guarda como `null` (no obligatorio)
- [ ] El admin/superadmin puede ver los logs en el backoffice (tabla simple)

---

## Base de datos

```sql
CREATE TABLE mood_logs (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES Users(id),
  checkin_mood  VARCHAR(20),    -- 'muy_mal' | 'regular' | 'bien' | 'muy_bien' | 'excelente'
  checkout_mood VARCHAR(20),    -- igual, puede ser NULL
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)         -- un registro por día por usuario
);
```

---

## API

```
POST /api/mood/checkin    → guarda checkin_mood del día
POST /api/mood/checkout   → actualiza checkout_mood del día
GET  /api/mood/history    → retorna últimos 30 días del usuario
```

---

## Frontend

- `CheckinPage.tsx` → llama `POST /api/mood/checkin` al confirmar
- `ChatPage.tsx` → botón `"Finalizar"` abre modal de check-out → llama `POST /api/mood/checkout`
- Modal check-out: mismo selector de emociones del check-in, con texto `"¿Cómo te vas?"`

---

## Archivos

```
backend/MoodLog.js           ← modelo Sequelize nuevo
backend/server.js            ← endpoints /api/mood/*
frontend/src/pages/CheckinPage.tsx   ← integrar llamada API
frontend/src/pages/ChatPage.tsx      ← botón finalizar + modal checkout
```

---

## Definición de hecho

- [ ] La tabla existe en producción (migración ejecutada)
- [ ] Check-in guarda correctamente para el usuario logueado
- [ ] Check-out guarda en el mismo registro del día
- [ ] Sin duplicados por día (constraint UNIQUE)
- [ ] El flujo no rompe si el usuario no hace check-out

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
