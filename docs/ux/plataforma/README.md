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
| `/app/skill-map`, `/app/dashboard` | `inicio` (mapa, `p-mapa.js`) | Hecho: relieve y lista por territorios, autoevaluación y revisión humana por separado, confianza, criterios, registrar/cambiar/retirar nivel, análisis con IA en 3 pasos, revocar todos, actualizar, guía sin niveles. Pendiente de decisión: el radar |
| `/app/bridge` | `puente` (`p-puente.js`) | Hecho: fuentes con consentimiento por fuente, propuestas, cruce idea por idea con confirmación, revocar una o todas, estados de error |
| `/app/my-therapist` | `terapeuta` | Hecho: perfil, compartir datos, desvincular, sesiones, emparejamiento en 3 pasos |
| `/app/session/:id` | `sesion` | Hecho: conectando, en curso, aún no comienza, error |
| `/app/chat` | `chat` | Hecho (falta enlazar la elección de diario) |
| `/app/evidence` (lista, nueva, detalle, editar, hoja de vida) | `evidencias`, `evidencia_nueva`, `evidencia_detalle`, `evidencia_editar`, `resumen_habilidades` | Hecho con el modelo real |
| `/app/context/resumes` | `resumes` | Hecho |
| `/app/diary` (lista, nueva, detalle) | `diario` | Hecho |
| `/app/next-step` (rutas, experimentos, experimento, plan) | `siguiente`, `experimentos`, `experimento`, `plan_accion` | Hecho |
| `/app/data` | `datos` | Hecho |
| `/app/exercises`, `/app/space/tools`, `/app/compass`, `/app/route-catalog`, `/app/progress`, `/app/feedback` | | Pendiente |

## Decisiones que necesito de Alejo y Mauricio (de esta entrega)

1. **Radar.** El mapa real tiene vista de radar. En Cartografía el relieve ya cumple esa función, así que lo sustituí por el relieve y un resumen («puntos más fuertes» y «un punto donde mejorar»). Si se mantiene el radar, hay que diseñarlo aparte.
2. **«Terapeuta» o «profesional».** El código usa «terapeuta». El producto es no clínico: propongo «profesional de acompañamiento», pero no lo cambié sin tu decisión.
3. **Tema «Ansiedad» del emparejamiento.** Roza lo clínico; propuse «Estrés y carga» en el prototipo. Cambia la lista real de temas.
4. **Ánimo con emojis.** El código muestra emojis de 1 a 5 en las sesiones anteriores; el prototipo usa las mismas cinco palabras del check-in más el número.
5. **Enlace a la Brújula en El Puente.** Se omite hasta diseñar la Brújula (siguiente entrega).
| Profesional, administración, junta | | Pendiente |

## Qué se verificó

- Carga sin errores de consola ni desborde horizontal en 390 y 1360 px, ES y EN, para las 25 pantallas.
- Corrección de dos fallos de la primera fase: el botón «Crear cuenta» de la barra tenía el texto del color del fondo, y los botones secundarios desactivados salían como un bloque gris sin texto. Además, los enlaces de texto usaban el azul del navegador.
- axe-core (WCAG 2 A/AA), nivel grave y crítico, en claro y oscuro, ES y EN: 0 hallazgos.
- Flujos de punta a punta con Playwright: check-in, diario, mis datos, evidencias (validación, revisión, confirmación, guardado sin confirmar y reintento), habilidades de la hoja de vida, hojas de vida, punto de partida, siguiente paso hasta plan aceptado y guardia al salir con cambios.

## No verificado

- Navegadores distintos de Chromium; lectores de pantalla reales; trampa de foco en los diálogos (el prototipo la simplifica, el frontend ya tiene `trapTab`).
- Los textos EN son borrador y piden revisión humana.
- Muchos datos son de ejemplo (rutas, fuentes, secciones del archivo de datos, máximo de versiones, países y zonas): salen del servidor.
- Los estados de conflicto, sesión vencida y función apagada se describen en el código real, pero solo algunos tienen pantalla propia en el prototipo.
- Licencias de las tipografías; fotografía, ilustración y logotipo por encargar.
