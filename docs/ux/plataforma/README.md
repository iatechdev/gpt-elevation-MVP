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
| `/app/space/tools` | `herramientas` (`p-brujula.js`) | Hecho: cuatro tarjetas reales, «en preparación», ninguna disponible, cargando y error |
| `/app/exercises` | `ejercicios` | Hecho: lista de 3, ejercicio con notas que no se guardan, copiar, cerrar con aviso, contenido en revisión y no disponible |
| `/app/compass` | `brujula` | Hecho: contexto vigente, historial, campos (12 / 3 por categoría / 500), vista previa exacta con vigencia, autorización, retirar, estados de error e incertidumbre |
| `/app/route-catalog`, `/app/route-catalog/roles/:roleKey` | `catalogo`, `catalogo_ficha` (`p-catalogo.js`) | Hecho: filtros, fichas, fuentes, ofertas, recursos, estados. Contenido de EJEMPLO |
| `/app/progress` | `progreso` (`p-progreso.js`) | Hecho: cifras, recomendaciones, historial emocional, calificaciones, vacío, error |
| `/app/feedback` | `opinion` | Hecho: vista de revisión con datos ficticios, omitir cada pregunta, guardado incierto, conflicto, retirar |
| `/app/dashboard` | `inicio` | Es el mapa (ver arriba): en el código real la ruta redirige al mapa |
| `/facilitation`, `/facilitation/participants/:id`, `/facilitation/participants/:id/reviews/new` | `facilitacion`, `facilitacion_persona`, `facilitacion_revision` (`p-profesional.js`) | Hecho: personas asignadas, progreso por pasos, materiales, registrar revisión (evidencias, observación, límites, vista previa exacta), guardia al salir, error de guardado, confirmación incierta sin duplicar, conflicto de versión, acceso retirado, solicitar invitación |
| `/app/professional-reviews` | `mis_revisiones` | Hecho: revisiones recibidas, objetar con vista previa, pendiente/respondida, vacío |
| `/therapist/dashboard` | `panel_pro` | Hecho: resumen, próximas sesiones, personas, avisos, validación académica (subir, estados, rechazo), guía para la IA (proponer, pendiente, rechazada); cada sección con su error |
| `/therapist/patient/:id` | `paciente_pro` | Hecho: resumen con IA, notas de seguimiento (filtrar, crear, editar), historial emocional, valoraciones, agendar sesión, sin autorización |
| `/therapist/session/:id` | `sala_pro` | Hecho: pantalla previa, conectando, error al iniciar, en sesión con notas en vivo (autoguardado y error), cierre con ánimo y nota |
| Administración, junta, `/reset-password`, `/profesionales`, `/pricing` real | | Pendiente |

## Decisiones que necesito de Alejo y Mauricio (de esta entrega)

1. **Radar.** El mapa real tiene vista de radar. En Cartografía el relieve ya cumple esa función, así que lo sustituí por el relieve y un resumen («puntos más fuertes» y «un punto donde mejorar»). Si se mantiene el radar, hay que diseñarlo aparte.
2. **«Terapeuta» o «profesional».** El código usa «terapeuta». El producto es no clínico: propongo «profesional de acompañamiento», pero no lo cambié sin tu decisión.
3. **Tema «Ansiedad» del emparejamiento.** Roza lo clínico; propuse «Estrés y carga» en el prototipo. Cambia la lista real de temas.
4. **Ánimo con emojis.** El código muestra emojis de 1 a 5 en las sesiones anteriores; el prototipo usa las mismas cinco palabras del check-in más el número.
5. **Enlace a la Brújula en El Puente.** Ya está: aparece en el estado vacío de El Puente («Añadir algo a mano»).

### Decisiones de la entrega 4 (ejercicios, herramientas, brújula, catálogo, progreso, opinión)

6. **Tarjetas de «Mis herramientas».** El código solo tiene título y botón. Propongo una línea descriptiva por tarjeta (son textos nuevos, revisar ES/EN).
7. **Ejercicios.** El contenido real está marcado `draft` y los ejercicios van detrás de una bandera. El diseño es el final; el aviso «Contenido en revisión» se ve solo mientras siga en borrador. Hace falta revisión humana del contenido antes de habilitarlo.
8. **Brújula.** La vigencia de la vista previa (aquí 10 min) y qué texto «no se puede compartir» los decide el servidor; el prototipo simula esa regla con las palabras «salud», «health» y «@». Mejora propuesta: la etiqueta «Categoría» sobre el selector (el código usa «Selecciona una categoría» como etiqueta).
9. **Progreso.** Se retiran los emojis (ánimo y categorías) y se sustituyen por palabras; las estrellas llevan texto «4 de 5»; la subida/bajada del ánimo lleva palabra, ya no depende de verde/rojo; se añade «no es una medición de salud». Las recomendaciones del ejemplo son inventadas.
10. **Opinión.** El permiso real depende del contrato de Mauricio. Hasta entonces se mantiene la franja «Vista de revisión · datos ficticios» y no se envía nada; el texto de retirada se reescribe sin la palabra «simulación» (propuesta).
11. **Catálogo.** Todo el contenido (fichas, fuentes, ofertas, recursos, mercados) es de ejemplo, con dominio `.invalid` y el aviso «Contenido de prueba» siempre visible. Sin porcentajes ni afirmaciones de reemplazo por IA. Los enlaces externos avisan «se abre en una pestaña nueva» (propuesta).

### Decisiones de la entrega 5 (familia profesional)

12. **Vocabulario.** «Personas» en lugar de «pacientes», «notas de seguimiento» en lugar de «notas clínicas» y «resumen con IA» en lugar de resumen clínico. Prolonga la decisión 2: el producto es no clínico. Cambia textos reales (`therapist_*`).
13. **Porcentajes.** El aviso de progreso del código dice «+N %» (`improvementPercent`). El diseño lo dice con palabras («su ánimo mejoró en los registros recientes») y no muestra porcentajes: no hay base para presentarlos como medición.
14. **Privacidad: hallazgo para Dev y QA.** Cuando una persona no autorizó compartir, el código del panel oculta sus datos con `display:none`, pero siguen en la página. El diseño no los dibuja y espera que el servidor tampoco los envíe. Hay que verificarlo (es una regla no negociable).
15. **Errores que hoy se tragan en silencio.** Sesiones próximas, avisos, validación académica y guía para la IA fallan sin avisar, y editar una nota que no se guardó tampoco dice nada. El diseño da a cada sección su propio error con reintento y conserva el texto.
16. **Sala con pantalla previa.** El código inicia la sesión (llamada `start`) al montar la sala: recargar o abrir dos veces puede iniciarla dos veces. El diseño pide un clic en «Iniciar sesión». Cambia el flujo y el servidor debe ser idempotente.
17. **Cierre de sesión.** «Finalizar» deja de ser rojo (el rojo queda para errores). El cierre sigue exigiendo ánimo y nota de 10 caracteres. La etiqueta «Cómo ves a la persona al terminar» es propuesta; el texto real no se verificó.
18. **Guía para la IA (el «prompt terapéutico» del código).** Una persona profesional propone instrucciones que orientan a la IA con las personas que acompaña y administración las aprueba. Es la pieza con más riesgo del paquete: el diseño añade el recordatorio de las reglas (sin diagnóstico, sin tratamiento, sin promesas de empleo), pero la validación real (inyección de instrucciones, límites no clínicos) debe vivir en el servidor. **Posible objeción para Mauricio y Alejo** antes de implementarla.
19. **Facilitación y «Revisiones profesionales».** Son una vista preliminar con datos sintéticos y el permiso real depende del contrato; se mantiene la franja y «Solicitar invitación» sigue siendo una simulación. En el código, «Mis revisiones» solo se llega desde la consola de facilitación; el prototipo la añade al menú de la persona (no verifiqué si existe otro acceso).
20. **Cifra «Total de sesiones».** En la ficha, el código la calcula contando registros de ánimo. El diseño la renombra «Registros de ánimo». Si se quiere contar sesiones, el servidor debe entregarlo.

## Qué se verificó

- Entrega 5: barrido de las 7 pantallas profesionales en ES/EN, claro y oscuro, 390 y 1360 px (sin desborde, un solo h1, axe sin hallazgos graves ni críticos) y flujos de punta a punta con Playwright (revisión con evidencia, vista previa, guardia al salir, error y reintento del mismo envío, confirmación incierta sin duplicar, conflicto, acceso retirado, invitación; objeción; panel con errores por sección, validación y guía; ficha con resumen IA, notas, filtro, edición con error, agendar; sala con autoguardado, error y cierre).
- Colisión de claves de texto entre archivos: se detectó y corrigió (`rv_t`, `sp_back`, `sp_save` ya existían en otros módulos).

- Carga sin errores de consola ni desborde horizontal en 390 y 1360 px, ES y EN, para las 39 pantallas (32 anteriores + 7 profesionales).
- Entrega 4: flujos de punta a punta con Playwright (ejercicio con notas y diálogo, error de copiado, brújula con campos, texto no compartible, vista previa, confirmación incierta, reintento, retirar, versión activa, vencida y pendiente de revisar; catálogo con filtros y fichas; progreso; opinión con guardado incierto, consulta de estado, retirar y conflicto) y axe-core sin hallazgos graves ni críticos en claro y oscuro, ES y EN.
- Corrección de dos fallos de la primera fase: el botón «Crear cuenta» de la barra tenía el texto del color del fondo, y los botones secundarios desactivados salían como un bloque gris sin texto. Además, los enlaces de texto usaban el azul del navegador.
- axe-core (WCAG 2 A/AA), nivel grave y crítico, en claro y oscuro, ES y EN: 0 hallazgos.
- Flujos de punta a punta con Playwright: check-in, diario, mis datos, evidencias (validación, revisión, confirmación, guardado sin confirmar y reintento), habilidades de la hoja de vida, hojas de vida, punto de partida, siguiente paso hasta plan aceptado y guardia al salir con cambios.

## No verificado

- Navegadores distintos de Chromium; lectores de pantalla reales; trampa de foco en los diálogos (el prototipo la simplifica, el frontend ya tiene `trapTab`).
- Los textos EN son borrador y piden revisión humana.
- Muchos datos son de ejemplo (rutas, fuentes, secciones del archivo de datos, máximo de versiones, países y zonas): salen del servidor.
- Los estados de conflicto, sesión vencida y función apagada se describen en el código real, pero solo algunos tienen pantalla propia en el prototipo.
- Licencias de las tipografías; fotografía, ilustración y logotipo por encargar.
