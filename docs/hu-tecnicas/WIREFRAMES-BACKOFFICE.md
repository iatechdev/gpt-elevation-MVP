# Elevation — Wireframes Backoffice
> Documentado: 28 de marzo de 2026

---

## /admin/dashboard

```
┌────────────────────────────────────────────────────────────────┐
│ ELEVATION admin          Mauro Roldán (superadmin)    [Salir]  │
├──────────┬─────────────────────────────────────────────────────┤
│          │                                                      │
│Dashboard │  Buenos días, Mauro                                 │
│Prompts ⏳│  ─────────────────────────────────────────────────  │
│Contenido │                                                      │
│Usuarios  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│Métricas  │  │ Usuarios │ │ Sesiones │ │  Rating  │ │ Mood ↑ │ │
│          │  │    124   │ │    38    │ │   4.2★   │ │  +12%  │ │
│          │  │ activos  │ │   hoy    │ │ promedio │ │ mejora │ │
│          │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│          │                                                      │
│          │  Sesiones por día (últimos 7 días)                   │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │  ▁▂▃▅▄▆█  gráfico de barras                 │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  Versiones pendientes de aprobación          ⏳ 2   │
│          │  ┌─────────────────────────────────────────────┐    │
│          │  │ v5 — propuesta por Admin Juan — hace 2h     │    │
│          │  │ [Ver y aprobar]                    [Ver]    │    │
│          │  └─────────────────────────────────────────────┘    │
│          │                                                      │
└──────────┴─────────────────────────────────────────────────────┘
```

---

## /admin/prompts

```
┌────────────────────────────────────────────────────────────────┐
│ ELEVATION admin          Mauro Roldán (superadmin)    [Salir]  │
├──────────┬─────────────────────────────────────────────────────┤
│          │                                                      │
│Dashboard │  Gestión de Prompts                                  │
│Prompts ● │  ─────────────────────────────────────────────────  │
│Contenido │                                                      │
│Usuarios  │  Prompt activo                                       │
│Métricas  │  ┌─────────────────────────────────────────────┐    │
│          │  │ v4 · Aprobado por Mauro · 24 mar 2026       │    │
│          │  │                                             │    │
│          │  │ Eres Elevation, un acompañante empático...  │    │
│          │  │ [texto completo del prompt activo]          │    │
│          │  │                                             │    │
│          │  └─────────────────────────────────────────────┘    │
│          │  [Proponer nueva versión]                            │
│          │                                                      │
│          │  Pendientes de aprobación ⏳ 2                      │
│          │  ┌─────────────────────────────────────────────┐    │
│          │  │ v5 · por Juan Admin · hace 2h               │    │
│          │  │ "Eres Elevation, un terapeuta..."            │    │
│          │  │ [Ver completo] [✓ Aprobar] [✗ Rechazar]     │    │
│          │  └─────────────────────────────────────────────┘    │
│          │                                                      │
│          │  Historial                                           │
│          │  v3 · archivada · [Rollback]                         │
│          │  v2 · archivada · [Rollback]                         │
│          │                                                      │
└──────────┴─────────────────────────────────────────────────────┘
```

---

## /admin/usuarios

```
┌────────────────────────────────────────────────────────────────┐
│ ELEVATION admin          Mauro Roldán (superadmin)    [Salir]  │
├──────────┬─────────────────────────────────────────────────────┤
│          │                                                      │
│Dashboard │  Gestión de Usuarios                    [124 total] │
│Prompts   │  ─────────────────────────────────────────────────  │
│Contenido │                                                      │
│Usuarios ●│  [Todos ▼] [Rol: Todos ▼] [Estado: Activos ▼]       │
│Métricas  │                                                      │
│          │  ┌────┬──────────────┬───────────┬────────┬───────┐ │
│          │  │    │ Usuario      │ Rol       │Sesiones│Acción │ │
│          │  ├────┼──────────────┼───────────┼────────┼───────┤ │
│          │  │ 👤 │ Ana García   │ user      │  12    │ [···] │ │
│          │  │ 👤 │ Carlos M.    │ therapist │   -    │ [···] │ │
│          │  │ 👤 │ María L.     │ user      │   8    │ [···] │ │
│          │  │ 👤 │ Juan Admin   │ admin     │   -    │ [···] │ │
│          │  └────┴──────────────┴───────────┴────────┴───────┘ │
│          │                                                      │
│          │  [···] abre panel lateral con detalle del usuario    │
│          │  → Cambiar rol | Desactivar | Ver estadísticas        │
│          │                                                      │
└──────────┴─────────────────────────────────────────────────────┘
```

---

## /admin/metricas

```
┌────────────────────────────────────────────────────────────────┐
│ ELEVATION admin          Mauro Roldán (superadmin)    [Salir]  │
├──────────┬─────────────────────────────────────────────────────┤
│          │                                                      │
│Dashboard │  Métricas                    [Esta semana ▼]        │
│Prompts   │  ─────────────────────────────────────────────────  │
│Contenido │                                                      │
│Usuarios  │  ┌──────────────────┐  ┌──────────────────────────┐ │
│Métricas ●│  │ Mood Check-in    │  │ Mood Check-out           │ │
│          │  │ 😞 8%  😔 12%   │  │ 😞 3%  😔 8%            │ │
│          │  │ 😐 30% 🙂 35%   │  │ 😐 22% 🙂 40%           │ │
│          │  │ 😊 15%           │  │ 😊 27%                  │ │
│          │  └──────────────────┘  └──────────────────────────┘ │
│          │                                                      │
│          │  Tendencia emocional (usuarios mejoran tras chatear) │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │  Check-in promedio: 2.8  →  Checkout: 3.4   │   │
│          │  │  Mejora promedio: +0.6 puntos por sesión     │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  Rating de sesiones                                  │
│          │  ★★★★☆  Promedio: 4.2 / 5  (238 calificaciones)    │
│          │                                                      │
└──────────┴─────────────────────────────────────────────────────┘
```

---

## /therapist/dashboard

```
┌────────────────────────────────────────────────────────────────┐
│ ELEVATION                    Carlos M. (terapeuta)   [Salir]   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Mis pacientes                                    [8 activos]  │
│  ──────────────────────────────────────────────────────────── │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 👤 Ana García          Último mood: 🙂  Hace 2 días     │  │
│  │    12 sesiones · Rating prom: ★★★★☆ · Tendencia: ↑     │  │
│  │    [Ver historial emocional]                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 👤 María López         Último mood: 😐  Hace 1 día      │  │
│  │    8 sesiones · Rating prom: ★★★☆☆ · Tendencia: →      │  │
│  │    [Ver historial emocional]                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---
*Documentado: 28 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
