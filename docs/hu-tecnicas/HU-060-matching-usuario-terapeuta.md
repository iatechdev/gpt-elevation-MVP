# HU-060 — Matching Usuario-Terapeuta

> Sprint 7 | Must Have | 5 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> **Completada: 4 de abril de 2026**
> Depende de: HU-061 (User Dashboard), HU-071 (Vista Mi terapeuta)

---

## Contexto

El flujo de matching inteligente permite al usuario elegir su terapeuta según preferencias. El botón "Buscar mi terapeuta" ya existía en el dashboard y Mi terapeuta — esta HU le dio funcionalidad real.

---

## Flujo implementado

```
1. Usuario hace clic en "Buscar mi terapeuta"
2. Se abre MatchingModal
3. Usuario responde 3 preguntas de preferencias
4. POST /api/matching/request → retorna hasta 3 terapeutas
5. Usuario ve cards con nombre, compatibilidad y razón
6. Usuario elige uno → POST /api/matching/choose
7. Confirmación visible → modal cierra
```

---

## Archivos creados/modificados

- `frontend/src/components/MatchingModal.tsx` — componente nuevo reutilizable (3 steps: form → results → success)
- `frontend/src/pages/UserDashboard.tsx` — import + handler + render del modal
- `frontend/src/pages/MyTherapist.tsx` — import + estado + render del modal en botón "Cambiar terapeuta"

## Decisiones técnicas

- Componente `MatchingModal` independiente y reutilizable desde 3 puntos de entrada
- Reutiliza endpoints existentes: `POST /api/matching/request` y `POST /api/matching/choose`
- 3 estados internos del modal: `form` → `results` → `success`
- Tras éxito: `loadUpcomingSession()` en dashboard refresca el widget automáticamente
- En MyTherapist: `window.location.reload()` para refrescar la vista completa

---

## Criterios de aceptación

- [x] Modal de matching abre desde dashboard y desde /app/my-therapist
- [x] Usuario puede seleccionar sus preferencias (topic, approach, language)
- [x] Sistema muestra máx 3 terapeutas compatibles con su perfil
- [x] Usuario puede elegir un terapeuta y queda en estado pendiente
- [x] Confirmación visible tras la elección
- [x] Si no hay terapeutas disponibles: mensaje apropiado

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
*Completada: 4 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
