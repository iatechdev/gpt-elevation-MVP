# INFORME E2E COMPLETA — ES-45 (QA-Claude-2)

Plan: ES-45 comentario 12302, aprobado por Infra-Claude en 12303 (con la condición de Mauricio: las pruebas se hacen con la NUEVA VISUAL, Cartografía).
Cabeza de `main` probada: `60d3876886ab512b683a80dabd36c3cb3751c35b` (#304). No cambió durante las cuatro tandas (comprobado con `git ls-remote` al cierre de cada una).
Entorno: build de `main` + backend REAL de `main` (:8090) + PostgreSQL con TODAS las migraciones, datos SINTÉTICOS, 0 IA, costo 0. Chromium (Playwright), ES/EN, 1 360/390/320 px (el desborde se mide sin emulación móvil), claro/oscuro, axe 2.2 AA (wcag2a/2aa/21a/21aa/22aa). Staging: solo lecturas pasivas; no se creó ninguna cuenta ni se escribió nada.
Guiones (PR #100, carpeta `qa/`): `e2e-t1.cjs` (ONLY=T0|T1|T2|T3), `e2e-t2.cjs` (T4..T8), `e2e-t3.cjs` (T9, T9b, T10, T11), `e2e-t4.cjs` (T12..T15). Ayudantes locales (fuera del repo): build `VITE_BACKEND_URL=http://localhost:8090 npx vite build`, base nueva con migraciones y backend con `REGISTER_RATE_LIMIT_MAX=5000`.

## Cómo leer las columnas

- **Visual:** NUEVA = la ruta está en `MIGRATED_PERSON_PATHS`/`MIGRATED_PROFESSIONAL_PATHS` o usa Cartografía por completo y no queda ninguna clase heredada `elv-` en el DOM. HEREDADA = el contenido sigue con estilos heredados (la mayoría ya llevan el marco nuevo de persona, pero el contenido no).
- **Semáforo funcional (a):** verde = sin Crítico/Alto y sin ruptura; amarillo = hallazgos que se deben conocer; rojo = no mostrar; «no verificado» = no se pudo ejecutar.
- **Semáforo visual nueva (b):** solo verde/amarillo para pantallas NUEVAS; una pantalla HEREDADA es «no lista» en visual aunque funcione.
- **Tipo de prueba:** E2E = Chromium con sesión real; API = integración con PostgreSQL real; HTTP = lectura pasiva de staging.

## Veredicto global

**Ningún hallazgo Crítico ni Alto.** Los de mayor peso son Medios: M-T1-1 (500 al registrarse con un nombre de 5 000 caracteres), M-T14-1 (CLS 0,115 en `/app/bridge`, por encima del umbral aprobado de 0,1) y M-T13-1 (4 avisos «alta» de `npm audit` en la herramienta de compilación del frontend, no en el código que corre en el navegador).

## Tabla por pantalla

| Pantalla | Visual | (a) Funcional | (b) Visual nueva | Evidencia y hallazgos |
|---|---|---|---|---|
| `/` portada | NUEVA | verde | verde | T0: ES/EN × 3 anchos × claro/oscuro; 1 `h1`; axe 0 (E2E) |
| `/login` (entrar, crear cuenta, recuperar) | NUEVA | verde | verde | T1: casilla de términos sin marcar, con enlaces, foco al rechazar, cuenta no creada sin marcar; creada con versión de términos; no inicia sesión sola (diseño) (E2E+API) |
| `/forgot-password`, `/reset-password` | NUEVA (no medidas) | amarillo | no verificado | recuperación probada por API (un solo uso, revoca sesiones, sin enumeración); la PANTALLA no se recorrió |
| `/manifiesto`, `/privacidad`, `/terminos`, `/design-system` | NUEVA | verde | verde (`/manifiesto` conserva 1 clase `elv-`: I-T11-2) | `noindex` y marcador de borrador en legales; manifiesto con `<img onerror>` y `<script>` no ejecuta nada (E2E) |
| `/profesionales` | **HEREDADA** | amarillo | **no lista** | carga, `h1`, axe 0; validación y archivos hostiles NO ejecutados |
| `/pricing` | **HEREDADA** | amarillo | **no lista** | **B-HER-1** (axe) |
| `/app/onboarding` | NUEVA | verde | verde | CLS 0,001 |
| `/app/data` Mis datos | NUEVA | verde | verde | exportar (solo lo propio), eliminar en dos pasos con Esc, solicitud 202, idempotente, sesión y login cortados, purga real verificada en la base (E2E+API) |
| `/app/skill-map` (Relieve/Lista/Radar) | NUEVA | verde | verde | N = 5/8/12/13/24; sin ceros ni déficits; CLS ≤ 0,043 |
| `/app/context/resumes` | NUEVA | verde | verde | B no ve ni descarga ni borra la hoja de A; no PDF 400, > 5 MB 400, sin permiso 403 (E2E+API) |
| `/app/evidence/resume-skills` | NUEVA | verde | verde | idem |
| `/app/bridge` El Puente | NUEVA | verde | **amarillo** | frontera diario→profesional verificada; **M-T14-1** CLS 0,115 |
| `/app/diary`, `/diary/new`, `/diary/:id` | NUEVA | verde | verde | B no ve/edita/borra; borrado lógico por diseño; `/diary/new` CLS 0,091 (cerca del umbral) |
| `/app/checkin`, `/app/exercises`, `/app/space/tools`, `/app/plan` | NUEVA | verde | verde | axe 0, 0 `elv-`, sin desborde, CLS ≤ 0,001 |
| `/app/evidence`, `/evidence/new`, `/evidence/:id`, `/evidence/:id/edit` | **HEREDADA** | verde | **no lista** | CRUD y versionado (409 con versión vieja), aislamiento A/B; 11–32 clases `elv-` |
| `/app/chat` | **HEREDADA** | verde (IA no ejecutada) | **no lista** | 5 `elv-`, estilos en línea con color |
| `/app/compass` (brújula) | **HEREDADA** | verde | **no lista** | 17 `elv-` |
| `/app/route-catalog` | **HEREDADA** | verde | **no lista** | 1 `elv-`; sin catálogo de rutas local |
| `/app/next-step`, `/next-step/experiments`, `/next-step/plan` | **HEREDADA** | amarillo | **no lista** | **B-HER-1** |
| `/app/progress` | **HEREDADA** | verde | **no lista** | 1 `elv-` |
| `/app/dashboard` | **HEREDADA** | amarillo | **no lista** | 5 `elv-`, estilos en línea; **B-T15-1** |
| `/app/professional-reviews`, `/app/my-therapist` | **HEREDADA** | verde | **no lista** | `elv-`, estilos en línea en mi profesional |
| `/app/feedback` («Tu opinión») | **HEREDADA** | no verificable a fondo | **no lista** | bandera APAGADA como producción; **B-T8-1** (sin `h1`); lo cubre #308 |
| `/app/session/:id` (sala de la persona) | HEREDADA (no medida) | no verificado | no lista | videollamada real no ejecutable |
| `/therapist/dashboard`, `/therapist/patient/:id` | NUEVA | verde | verde | aislamiento P1/P2 (404), notas, consentimiento retirado → 403, axe 0 (E2E+API) |
| `/therapist/session/:id` (sala del profesional) | **HEREDADA** | no verificado | no lista | Daily real |
| `/facilitation`, `/facilitation/participants/:id`, `/…/reviews/new` | **HEREDADA** (marco propio) | verde en lo medido | **no lista** | muestra «Con ola de facilitación» (puerta); axe 0 |
| `/admin/dashboard`, `/admin/metrics` | **HEREDADA** | amarillo | **no lista** | **B-T10-1** (320 px) |
| `/admin/users`, `/admin/prompts`, `/admin/content`, `/admin/manifest` | **HEREDADA** | verde | **no lista** | estilos en línea con color |
| `/admin/skill-catalog`, `/admin/route-catalog`, `/admin/pilot-metrics` | **HEREDADA** (marco propio o nuevo) | verde | **no lista** | 6–16 `elv-` |
| Junta ética (rol) | n/a | verde | n/a | sin pantalla propia; `/board/*` va a `/manifiesto`; 403 en todo lo de personas |

## Lista aparte de pantallas HEREDADAS (visual no lista)

`/profesionales`, `/pricing`, evidencias (lista, nueva, detalle, edición), chat, brújula (`/app/compass`), catálogo de rutas, siguiente paso (+ experimentos y plan), progreso, dashboard, revisiones, mi profesional, opinión, sala de la persona, sala del profesional, facilitación (3 rutas), administración completa (dashboard, usuarios, métricas, prompts, contenido, manifiesto, catálogo de habilidades, catálogo de rutas, métricas del piloto).

## Resultados por tanda y tramo (aserciones ejecutadas)

T0 7/8 · T1 59/61 · T2 25/25 · T3 19/19 · T4+T5 28/28 · T6+T8 16/16 · T7 10/10 · T9 17/18 · T10 20/21 · T11 (en T9) · T12 16/16 · T13 17/17 · T14 1/2 · T15 6/7. Las «fallas» son hallazgos o aserciones mías corregidas y repetidas (se dice en cada tanda). Detalle de cada tanda en los comentarios de ES-45 (12320, 12321, 12325 y el de cierre).

## Hallazgos nuevos (ninguno Crítico ni Alto)

| ID | Sev. | Dónde | Qué | Sugerencia |
|---|---|---|---|---|
| M-T1-1 | Medio | `POST /api/register` | `name` de 5 000 caracteres → **500** («Error en register.»); no se crea nada, pero es un 5xx por entrada | validar longitud del nombre (como el correo) |
| M-T14-1 | Medio | `/app/bridge` | CLS **0,115** a 390 px con CPU ×4, persona con 3 hojas y permisos; 3 corridas iguales; umbral aprobado 0,1 | reservar el espacio del bloque que carga; medir con el catálogo y datos del piloto |
| M-T13-1 | Medio | `npm audit` frontend | 4 «alta» (`vite`, `picomatch` ReDoS, `tinyglobby`, `fdir`); es la herramienta de compilación (ReDoS sobre patrones de glob que controla el desarrollador, sin entrada de usuarios, y no va en el bundle del navegador); `vite` está declarada en `dependencies`. Backend: 7 «moderadas» (`sequelize`→`uuid`, `sequelize-cli`→`js-beautify`/`minimatch`). 0 críticas | actualizar `vite` (cambio mayor) y mover a `devDependencies`; Infra decide la severidad final |
| B-HER-1 | Bajo | `/pricing`, `/app/next-step*` | axe `label-content-name-mismatch` (WCAG 2.5.3): el selector de idioma propio lleva `aria-label="Español"` y texto visible «ES» | alinear nombre accesible y texto visible |
| B-T1-2 | Bajo | API | sin token → **403**; token inválido o revocado → **401** | unificar en 401 |
| B-T8-1 | Bajo | `/app/feedback` | con la bandera apagada no hay `h1` | añadir encabezado al estado «no habilitada» |
| B-T10-1 | Bajo | `/admin/dashboard`, `/admin/metrics` | a 320 px una región con scroll no recibe foco (axe `scrollable-region-focusable`, WCAG 2.1.1) | `tabindex="0"` y nombre accesible en el contenedor |
| B-T15-1 | Bajo | `/app/dashboard` | con la API caída muestra «0 sesiones» y «Buscar mi terapeuta» sin ningún aviso de error (presenta el vacío como verdad) | estado de error con «Reintentar» |
| I-T0-4 | Info | rutas | no hay pantalla 404 propia: redirige a `/` | — |
| I-T0-5 | Info | staging | `noindex` de legales solo en el cliente; sin `X-Robots-Tag` ni `robots.txt` (el SPA lo sirve) | cabecera o archivo estático |
| I-T1-3 | Info | registro | no inicia sesión solo; vuelve a `/login` con aviso | diseño |
| I-T2-1 | Info | purga | `processDeletion` es un job de mantenimiento manual; recibo `awaiting_verification`, `deadlinesVerified: false` | coherente con la pantalla (sin fecha) |
| I-T6-1 | Info | diario | borrado lógico (contenido vaciado + `deletedAt`); copias y respaldos son ES-23 | — |
| I-T11-1 | Info | `/api/skill-map` | responde 200 a cualquier rol con sesión (su mapa propio, vacío) | — |
| I-T12-1 | Info | operación | bajar el rol directo en la base no revoca el token; por la API de administración sí | solo mantenimiento |
| I-T12-2 | Info | sesión vencida | el aviso «Tu sesión venció» es claro, pero el token viejo queda en `localStorage` hasta iniciar sesión de nuevo | limpiar al detectar 401 |

Ya registrados (no se duplican): E291-1 («Saltar» duplicado en pantallas heredadas), ES-317, ES-321, ES-323, E299-1/2, E304-1 (borrado con respuesta perdida), E304-2/3.

## Qué se verificó de verdad (resumen)

- **Acceso:** términos, versión, duplicado, contraseña débil, correo inválido, entradas hostiles; login/logout/«cerrar en todos los lados» (revoca otra sesión); bloqueo por intentos; recuperación de un solo uso; token manipulado, `alg=none`, firmado con otra clave y vencido.
- **Aislamiento (T12):** 9 accesos de B a recursos de A (evidencia, diario, hoja, experimento, plan, ruta) → solo 403/404; `elevation_role` manipulado en el navegador no abre nada; doble envío con el mismo `requestId` (5 simultáneos) crea una sola evidencia y una sola entrada; sesión revocada a mitad de una acción muestra «Tu sesión venció»; desactivar o bajar el rol por la API de administración corta el token al instante.
- **Privacidad:** el diario privado de A (marca única) no aparece en ninguna respuesta del profesional vinculado con el permiso concedido; retirar el permiso → 403 `consent_required`; B no lee exportaciones ni hojas de A; la junta no entra a nada de personas.
- **Roles (matriz 16 × 6):** cada rol solo entra donde corresponde.
- **Seguridad (T13):** cabeceras (CSP, HSTS, nosniff, DENY, no-referrer, sin `X-Powered-By`), CORS (un origen ajeno no recibe su propio origen), JSON malformado 400, cuerpo de 12 MB 413, consultas hostiles sin 5xx, límite de tasa en recuperación (429), bundle del cliente sin secretos, repositorio sin claves ni llaves privadas (fuera de datos de prueba), 0 críticas en `npm audit`.
- **Rendimiento (T14):** 6 personas × 25 rondas × 6 endpoints = 900 peticiones: 0 errores, p50 86 ms, p95 167 ms, máximo 231 ms (umbral propuesto: p95 ≤ 1 500 ms), 6 conexiones a la base; CLS a 390 px CPU ×4 en 25 pantallas: 24 en ≤ 0,091 y una (`/app/bridge`) en 0,115. Contenido útil 2,2–3,4 s por pantalla (máquina compartida, ruidoso); `/app/feedback` marca 30 s solo porque no tiene `h1` (artefacto de B-T8-1).
- **Fallos (T15):** 10 pantallas × ES/EN × API 500, cortada y lenta (60 casos): ninguna queda en blanco, el marco sigue, sin errores de JS ni trazas; 401 → `/login`; almacenamiento bloqueado no rompe `/login`; ruta inexistente redirige.
- **Staging (solo lectura):** salud 200, rutas SPA 200, cabeceras de seguridad, CORS sin reflejar, 0 secretos en 3 bundles, `/.env`, `/.git/config` y traversal sin contenido sensible.

## No verificado (declarado, no cerrado)

IA real (chat, análisis de hoja de vida, propuestas), prompt injection sobre el historial, subida de un PDF válido con análisis, el límite de versiones de hojas; la cadena positiva ruta → experimento → plan en el `main` actual (no hay catálogo de rutas local; se ejecutó en staging el 11-nov y no cuenta aquí); el puente con una transferencia real; agendar sesiones con conflicto y la agenda; sala de sesión y videollamada (Daily); validación académica y guía para la IA del profesional (solo la matriz de roles); `skill_in_use`; rol de junta con pantalla propia (no existe); consentimiento retirado con vistas derivadas «para revisión»; las pantallas `/forgot-password` y `/reset-password` (solo la API); `/profesionales` con validación y archivos hostiles; invitaciones recibidas; los seis participantes reales y resultados a 7/30 días; límite de tasa del registro (lo subí en local); lector de pantalla, Firefox/Safari, dispositivo físico, correo real; escritura en staging (sin confirmación directa de Mauricio); arranque en frío de funciones de Vercel y límites de Railway.

## Cómo reproducir

```
# base nueva + backend real (REGISTER_RATE_LIMIT_MAX=5000) y build de main con VITE_BACKEND_URL=http://localhost:8090
PLAYWRIGHT_MODULE=<ruta a playwright> BACKEND=<clon>/backend DATABASE_URL=<postgres local> DB_SSL=false DIST=<build> AXE=<axe.min.js> LABEL=main ONLY=T0 node qa/e2e-t1.cjs
# ONLY admite: e2e-t1 T0 T1 T2 T3 · e2e-t2 T4 T5 T6 T7 T8 · e2e-t3 T9 T9b T10 T11 · e2e-t4 T12 T13 T14 T15
```
