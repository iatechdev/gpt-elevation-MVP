# ES-148 · Plataforma Elevation: prototipo navegable (azul tinta)

*[UX-Claude] · 6-nov-2026 · Borrador para aprobación de Mauricio y Alejo. Ábrelo con doble clic en `index.html` (carga tipografías de Google Fonts; sin conexión usa una de respaldo).*

## Estructura

| Archivo | Qué contiene |
|---|---|
| `estilos.css` | Tokens y piezas base (color, tipografía, botones, campos, mapa). |
| `pantallas.css` | Piezas de las pantallas nuevas. |
| `nucleo.js` | Textos base, relieve, rutas, menú, pantallas públicas, mapa, conversación y planes. |
| `p-*.js` | Una pantalla o familia por archivo, con sus textos ES/EN. |
| `inicio.js` | Arranque. |

La barra de arriba del prototipo permite elegir pantalla, simular errores del servidor («Chat: sin conexión» sirve para todas), cambiar tema claro/oscuro y cambiar ES/EN.

## Cobertura frente a las rutas reales de `frontend/src/App.tsx`

| Ruta real | Pantalla del prototipo | Estado |
|---|---|---|
| `/`, `/login`, `/forgot-password` | portada, entrar, recuperar | Hecho |
| `/reset-password`, `/profesionales`, `/pricing` | (planes ya está) | Falta restablecer y profesionales |
| `/app/onboarding` | `punto` | Hecho |
| `/app/checkin` | `checkin` | Hecho |
| `/app/skill-map`, `/app/dashboard` | `inicio` (mapa) | Falta: vista de lista, análisis con IA, revocar accesos del puente, actualizar |
| `/app/chat` | `chat` | Hecho (falta enlazar la elección de diario) |
| `/app/evidence` (lista, nueva, detalle, editar, hoja de vida) | `evidencias`, `evidencia_nueva`, `evidencia_detalle`, `evidencia_editar`, `resumen_habilidades` | Hecho con el modelo real |
| `/app/context/resumes` | `resumes` | Hecho |
| `/app/diary` (lista, nueva, detalle) | `diario` | Hecho |
| `/app/next-step` (rutas, experimentos, experimento, plan) | `siguiente`, `experimentos`, `experimento`, `plan_accion` | Hecho |
| `/app/data` | `datos` | Hecho |
| `/app/exercises`, `/app/space/tools`, `/app/compass`, `/app/route-catalog`, `/app/progress`, `/app/feedback`, `/app/bridge`, `/app/my-therapist`, `/app/session/:id` | | Pendiente |
| Profesional, administración, junta | | Pendiente |

## Qué se verificó

- Carga sin errores de consola ni desborde horizontal en 390 y 1360 px, ES y EN, para las 22 pantallas.
- axe-core (WCAG 2 A/AA), nivel grave y crítico, en claro y oscuro, ES y EN: 0 hallazgos.
- Flujos de punta a punta con Playwright: check-in, diario, mis datos, evidencias (validación, revisión, confirmación, guardado sin confirmar y reintento), habilidades de la hoja de vida, hojas de vida, punto de partida, siguiente paso hasta plan aceptado y guardia al salir con cambios.

## No verificado

- Navegadores distintos de Chromium; lectores de pantalla reales; trampa de foco en los diálogos (el prototipo la simplifica, el frontend ya tiene `trapTab`).
- Los textos EN son borrador y piden revisión humana.
- Muchos datos son de ejemplo (rutas, fuentes, secciones del archivo de datos, máximo de versiones, países y zonas): salen del servidor.
- Los estados de conflicto, sesión vencida y función apagada se describen en el código real, pero solo algunos tienen pantalla propia en el prototipo.
- Licencias de las tipografías; fotografía, ilustración y logotipo por encargar.
