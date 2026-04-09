# HU-081 — Fix AdminMetrics.tsx + Auditoría i18n backoffice

> Sprint 10 | Bug fix crítico | 2 puntos
> Documentada: 9 de abril de 2026
> Causa: commit DT-002 de Alejo Roldán pisó 3 componentes funcionales con stubs
> Estado: EN PROGRESO

---

## Contexto

El commit `28c2088` de Alejo en el repo fork (`AlejoRoldan/gpt-elevation-MVP`) fue integrado
al repo principal mediante `push_files`. Ese commit tenía como objetivo agregar claves i18n
y aplicar `useLanguage()` en los componentes del backoffice. Sin embargo, Alejo trabajó sobre
versiones desactualizadas de los componentes, pisando implementaciones funcionales completas
con stubs de 10 líneas.

---

## Daño causado

| Archivo | Estado antes del commit | Estado después |
|---|---|---|
| `AdminPrompts.tsx` | Componente funcional completo (HU-029/033/030) | Stub 10 líneas |
| `AdminMetrics.tsx` | Componente funcional con gráficas y tablas | Stub 10 líneas |
| `AdminDashboard.tsx` | Completo con tokens | i18n parcial — funcional |
| `AdminUsers.tsx` | Completo | i18n parcial — funcional |

---

## Correcciones

### AdminPrompts.tsx — REPARADO ✅
- Reconstruido con funcionalidad completa
- Admin: ver prompts + proponer versiones
- Superadmin: todo + aprobar/rechazar/crear
- Sin i18n hardcodeado — textos en español directos (ver decisión abajo)

### AdminMetrics.tsx — PENDIENTE ❌
- Reconstruir con métricas completas
- Consumir GET /api/admin/metrics
- Cards de resumen + gráfico de actividad + tabla top terapeutas
- Design system tokens aplicados

---

## Decisión de arquitectura — i18n en backoffice

**El backoffice (admin, superadmin, board, therapist) opera en español.**

Razones:
- Los operadores de la plataforma son colombianos
- El backoffice no es accesible al usuario final
- El selector ES/EN del UserDashboard no aplica al backoffice
- Agregar i18n al backoffice añade complejidad sin beneficio real en MVP

**Decisión:** el backoffice usa textos en español hardcodeados directamente en JSX.
No usa `useLanguage()` ni `t()`. Las claves i18n de Admin/Therapist en `es.ts`/`en.ts`
pueden mantenerse para futuro pero no se usan activamente en MVP.

El `useLanguage()` y el selector de idioma aplican SOLO a:
- Landing page
- Login
- UserDashboard y todas las vistas del usuario final

---

## Criterios de aceptación

- [ ] AdminMetrics.tsx muestra métricas reales del backend
- [ ] Cards: total usuarios, activos, terapeutas, sesiones, ánimo prom., rating prom.
- [ ] Gráfico de barras — actividad últimos 30 días
- [ ] Tabla top terapeutas con pacientes y rating
- [ ] Design system tokens aplicados
- [ ] Sin spanglish — todo en español
- [ ] AdminPrompts.tsx funcional para ambos roles ✅

---

## Lección aprendida

Cuando Alejo entrega trabajo en su fork, el proceso correcto es:
1. Leer el diff completo del commit ANTES de integrarlo
2. Verificar que los archivos en el fork están basados en la versión más reciente del repo principal
3. Integrar solo las claves i18n nuevas en `es.ts`/`en.ts`
4. NO copiar los componentes del fork — solo las claves
5. Aplicar `t()` manualmente sobre los componentes actuales del repo principal

---
*Documentada: 9 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
