# Mockups Sprint 5 y 6 — Generados por Manus
> Generado: 1 de abril de 2026

## Pantallas Sprint 5 — Plataforma Clínica

| Archivo | Pantalla | Rol | Dispositivo |
|---|---|---|---|
| `MyProgress.tsx` | Mi Progreso — historial emocional y recomendaciones | user | Mobile |
| `ClinicalFile.tsx` | Ficha Clínica del paciente | therapist | Desktop |
| `TherapistPrompt.tsx` | Prompt terapéutico — proponer y gestionar | therapist | Desktop |
| `EthicsReview.tsx` | Panel de la Junta Ética | junta | Desktop |
| `TherapistApplication.tsx` | Solicitud de ingreso de terapeuta | público | Mobile+Desktop |

## Pantallas Sprint 6 — Integración y Calendario

| Archivo | Pantalla | Rol | Dispositivo |
|---|---|---|---|
| `TherapistCalendar.tsx` | Calendario de sesiones | therapist | Desktop |
| `VideoSession.tsx` | Videollamada en sesión con Daily.co | therapist+user | Desktop+Mobile |

## Notas importantes para el desarrollo

- Manus usó React + Shadcn/ui + Tailwind — nuestro proyecto usa estilos inline con el Design System propio
- Los componentes son referencia visual, NO se copian directamente al proyecto
- Adaptar al stack: React + TypeScript + Vite + estilos inline con variables CSS del Design System
- El `App.tsx` de Manus usa `wouter` — nuestro proyecto usa `react-router-dom`

## Stack de Manus vs Stack de Elevation

| Manus | Elevation |
|---|---|
| wouter | react-router-dom |
| Shadcn/ui | Estilos inline + Design System propio |
| Tailwind | CSS variables propias |
| pnpm | npm |
| server/index.ts | backend/server.js (Express) |

---
*Validado: 1 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
