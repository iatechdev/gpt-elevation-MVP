# HU-063 — Admin Dashboard: Panel de Alertas

> Sprint 6 | Should Have | 2 puntos
> Documentada: 2 de abril de 2026
> Aprobada por Mauro Roldán
> **Completada: 3 de abril de 2026**
> Referencia visual: Manus design — /admin (columna derecha)

---

## Contexto

Agregar panel de alertas al AdminDashboard con prompts pendientes, terapeutas sin perfil y estado del Manifiesto Ético.

---

## Panel de Alertas implementado

**Alerta 1 — Prompts pendientes:**
- Color amarillo cuando hay prompts, gris cuando no hay
- Botón Review → /admin/prompts
- Lista de prompts pendientes debajo del panel (máx 5)

**Alerta 2 — Terapeutas sin perfil completo:**
- Color azul cuando hay terapeutas sin perfil
- Botón Review → /admin/usuarios?role=therapist

**Alerta 3 — Manifiesto Ético:**
- Siempre visible en verde
- Muestra versión y fecha de activación

---

## Archivos modificados

- `backend/routes/adminUsers.js` — endpoint `GET /api/admin/usuarios/alerts`
- `frontend/src/pages/admin/AdminDashboard.tsx` — layout dos columnas + panel alertas

## Decisiones técnicas

- Endpoint montado en `/api/admin/usuarios/alerts` para reutilizar el router existente
- Layout convertido de una columna a dos columnas (métricas + alertas)
- Panel alertas sticky en columna derecha (300px)
- Colores adaptativos — gris si no hay alertas, color si hay
- Lista de prompts pendientes se muestra solo cuando hay al menos uno

---

## Criterios de aceptación

- [x] Panel de alertas visible en AdminDashboard
- [x] Alerta de prompts pendientes con conteo correcto
- [x] Lista de prompts pendientes directamente en el dashboard
- [x] Alerta de terapeutas sin perfil completo
- [x] Estado del Manifiesto Ético visible

---
*Documentada: 2 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Completada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
