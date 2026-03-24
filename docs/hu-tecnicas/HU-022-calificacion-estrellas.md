# HU-022 — Calificación con estrellas

> Sprint 3 | Should Have | 2 puntos  
> Pendiente desde Sprint 1

---

## Descripción

Como usuario, quiero poder calificar mi conversación con Elevation al finalizarla, para dar feedback sobre la calidad de la experiencia.

---

## Criterios de aceptación

- [ ] Al finalizar el chat, se muestra selector de 1 a 5 estrellas
- [ ] La calificación se guarda en base de datos asociada a la sesión
- [ ] Es opcional — el usuario puede saltar la calificación
- [ ] El superadmin puede ver el promedio de calificaciones en el panel
- [ ] Diseño Muji: estrellas sutiles, sin colores agresivos

---

## Base de datos

Agregar columna a tabla existente o crear tabla `session_ratings`:

```sql
CREATE TABLE session_ratings (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES Users(id),
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## API

```
POST /api/rating     → { rating: 4 }  guarda calificación
GET  /api/rating/avg → retorna promedio (solo admin/superadmin)
```

---

## UI

- Se muestra en el mismo modal de check-out (después de la emoción)
- 5 estrellas usando SVG mínimo, color olive al seleccionar
- Botón `"Enviar"` y link `"Saltar"`

---

## Archivos

```
backend/SessionRating.js         ← modelo Sequelize nuevo
backend/server.js                ← endpoints /api/rating
frontend/src/pages/ChatPage.tsx  ← modal checkout incluye estrellas
frontend/src/pages/AdminPage.tsx ← widget promedio de calificaciones
```

---

## Definición de hecho

- [ ] Usuario puede calificar de 1 a 5
- [ ] Calificación persiste en BD
- [ ] Admin ve el promedio actualizado
- [ ] Saltar la calificación no genera error

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
