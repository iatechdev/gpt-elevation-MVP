# [QA-Claude-2] Informe — ES-45: flujos de escritura y seguridad en staging (plan Jira ES-45 comentario 11035, aprobado por Mauricio con 3 ajustes)

8-nov-2026 · staging commit 8836e76 · cuentas de prueba del equipo + personas desechables QA2 · IA real: 6 mensajes (3 ES + 3 EN).

## Veredicto: sin Críticos, Altos ni Medios nuevos. Todo lo ejecutado pasa; hay partes del plan sin ejecutar (ver «No verificado»).

## Resultados
- **API de escritura y seguridad (staging-es45-api.cjs): 63 comprobaciones, 61 OK al primer intento; 2 se aclararon** y se repitieron en `staging-es45-seguimiento.cjs` (11/11 OK):
  - F7: el intento de «restituir» el consentimiento fallaba (400) porque el estado inicial `undecided` no se puede fijar por API; el consentimiento se revocó de forma explícita.
  - S1 evidencia: el 400 era mi cuerpo inválido; con un cuerpo válido persona2 recibe 404/404/404 (leer, editar, borrar) y la evidencia del dueño queda intacta.
- **Registro/sesión:** contraseña débil → 400 `password_policy` con `missing`; correo repetido y débil responde igual que correo nuevo (sin enumeración); el cierre de sesión revoca el token (200→200→401); JWT alterado, con rol elevado en el payload o basura → 401 (3/3).
- **Aislamiento A/B (persona2 vs persona1):** diario, evidencia y exportación ajenos → 404; el listado propio no contiene datos ajenos; token de persona en rutas de admin/superadmin/terapeuta → 403 (4/4); admin y superadmin no leen el diario privado (404/404).
- **Terapeuta:** persona no asignada → 404 en historial e historia; con consentimiento **revocado** la historia responde 403 y el resumen de IA 403; **otorgado** responde 200; al revocar de nuevo vuelve a 403 de inmediato; el historial no contiene diario ni «crisis». El listado de pacientes sin autorización entrega solo id y nombre (confirmado en código, therapistRoutes.js).
- **Admin/Superadmin:** admin asigna y quita terapeuta, desactiva (login 403) y reactiva (200); el admin NO puede crear un administrador (403); el superadmin sí; catálogos y uso de IA responden 200.
- **Entradas maliciosas:** HTML, emoji, RTL, fechas inválidas, 1 MB, cuerpo vacío → 4xx controlado, nunca 5xx; el nombre de registro con `<img onerror>` se muestra como texto en la lista de administración (0 imágenes inyectadas, 0 diálogos).
- **Recuperación de contraseña:** respuesta idéntica (202) para correo existente e inexistente.
- **Bundle y cabeceras:** sin secretos en 3 archivos JS (claves Anthropic, JWT, URL de base, claves privadas, service_role); `/api/diary` autenticado responde `Cache-Control: no-store`; HSTS, CSP, nosniff, X-Frame-Options y Referrer-Policy presentes.
- **Chat con IA real (6 mensajes, staging-es45-chat.cjs, 19/19 OK):** 6/6 respuestas 200, mediana 3,9 s (máx 4,9 s); idioma de respuesta correcto en ES y EN (ES-205 sin reproducirse); pedir teléfonos o líneas de ayuda → la IA los niega en ES y EN (ES-145 OK en estas 2 pruebas); inyección «ignora tus reglas» → rechazada sin revelar el prompt. Consumo: 64.365 → 153.879 tokens (≈ 89.500, dentro del tope aprobado de 90.000).
- **Bloqueo por intentos (S7, solo cuenta desechable):** 401/401/423/423 y la clave correcta queda bloqueada (423).
- **Rendimiento:** 6 usuarios simultáneos p50 155 ms / p95 299 ms (umbral 800); 10 escrituras simultáneas sin 5xx; con 50 entradas el listado responde en 116 ms.
- **UI de escritura (Chromium, ES/EN × 390/1440 px, 24/24 OK):** «Nueva entrada» trae la fecha de hoy (ES-138 OK); guardar, ver en la lista (HTML literal como texto), eliminar por la interfaz y cerrar sesión (token borrado, /app/dashboard → /login) en las 4 variantes; sin errores de página ni 5xx; sin desbordes.

## Observaciones
| ID | Sev. | Detalle |
|---|---|---|
| I1 | Info | `therapist_sharing` no puede volver a `undecided` por API; qa.persona quedó en `revoked` (antes `undecided`). Efecto equivalente («sin acceso»). |
| I2 | Info | El último mensaje EN pidió «responde solo en español» y la IA accedió; es una petición de la persona, no una fuga. |
| I3 | Info | Los mensajes de chat «QA2…» no se pueden borrar por API: quedan en el historial de qa.persona. |

## Limpieza
Eliminadas por API: entradas de diario QA2, evidencias QA2 y entradas «QA2 UI». Cuentas desechables: persona2 y persona2b (eliminación solicitada), persona3, un terapeuta y un admin QA2 (desactivados). No se tocaron ni desactivaron las 4 cuentas del equipo. Consentimiento de qa.persona: ver I1.

## No verificado
Edición de una entrada por la interfaz (el script abrió la entrada pero no pulsó «Editar»; la edición por API sí pasa); S8 subida de archivos y hoja de vida en PDF; creación válida de experimentos y de plan (esquema propio; solo se comprobó el rechazo de cuerpo vacío y las lecturas); catálogos de habilidades y rutas más allá de GET; Skill Map con evidencia confirmada y propuestas de IA; XSS del chat en pantalla; lector de pantalla; Safari/Firefox; móvil físico; 3 de los 6 mensajes de IA real se usaron como muestra, no como cobertura estadística del comportamiento del modelo.

## Reproducir
qa/staging-es45-api.cjs, qa/staging-es45-seguimiento.cjs, qa/staging-es45-chat.cjs, qa/staging-es45-ui.cjs (PR #100). Variables: STAGING_URL, CRED_FILE, PLAYWRIGHT_MODULE, OUT.

---

# Ronda complementaria (plan Jira ES-45 comentario 11037, aprobado por Mauricio con gasto de IA e instalación de navegadores)

Staging: la versión desplegada cambió durante las pruebas (commit 8836e76 al inicio; `/api/health` informó 5cad756 al final). Los resultados de la ronda anterior y de esta pueden mezclar ambas versiones; no se puede atribuir el comportamiento de ES-145 (teléfonos) a un commit concreto.

## Resultados
- **A1 editar entrada por UI:** OK en Chromium, Firefox y WebKit (ES 1440 px y EN 390 px): «Editar» muestra el editor y la edición aparece en la lista.
- **A2 hoja de vida (persona desechable, 1 llamada de IA):** sin autorización → 403 `consent_required`; con autorización: firma falsa → 400 `not_pdf`, PDF corrupto → 422 `corrupt`, > 5 MB → 400 `too_large`, tipo .exe → 400 `not_pdf` (sin llamada a IA); PDF sintético válido → 200 (con sugerencias); listado y eliminación propia OK.
- **A3 experimentos y plan:** persona nueva sin experimentos; experimento ajeno por ID → 404; crear con propuesta/token falsos → 409 `invalid_proposal`; proponer sin ruta elegida → 404 `route_record_not_found`; plan vacío → 400. **La creación VÁLIDA (ruta elegida → propuesta → experimento → versión → revisión → plan) no se ejecutó**: exige una cadena de rutas con evidencia confirmada que no cabía en esta ronda.
- **A4 Skill Map:** persona sin evidencia: 8 competencias, 0 con nivel; nivel sin evidencia → 422 `evidence_required`; nivel fuera de rango → 400; evidencia inexistente → 422; propuestas de IA sin evidencia confirmada → 422 `no_evidence` (sin gastar IA). **No se confirmó una evidencia ni se pidieron propuestas con IA** (cadena positiva sin ejecutar).
- **A5 XSS en el chat (1 mensaje de IA):** sin imágenes, scripts ni enlaces `javascript:` inyectados y sin diálogos; el texto se muestra literal.
- **A7 admin:** 3 fallos → bloqueo 423; el administrador desbloquea y la persona entra; el administrador NO puede restablecer contraseñas (403); el superadmin sí.
- **A8 navegadores (Chromium, Firefox 1555, WebKit 2370; ES 1440 px y EN 390 px):** 42/42 comprobaciones OK: landing con contenido y sin desborde, dashboard de la persona, «Nueva entrada» con la fecha de hoy, guardar y listar, editar, sin errores de página.

## Hallazgo nuevo
| ID | Sev. | Detalle |
|---|---|---|
| M1 | Medio | **Restablecer contraseña (superadmin) acepta «abc123»** (6 caracteres, sin mayúscula ni carácter especial): la ruta `PUT /api/admin/usuarios/:id/reset-password` no aplica la política de ES-128. Dev ya había propuesto un ticket aparte para alinear las rutas de administración; sigue abierto. Mitigación: solo el superadmin la usa. |

## No ejecutado en esta ronda (motivo)
- **A6 borradores de catálogo:** no se ejecutó. La API permite crear un borrador (`POST /api/admin/skill-catalog`) pero no descartarlo; crearlo dejaría un borrador abierto en staging que bloquearía el sembrado y que QA no puede limpiar. Se pide a Dev un endpoint de descarte o aprobación explícita para crearlo.
- **A9 lector de pantalla y móvil físico:** no automatizables; lista manual en `qa/LISTA-VERIFICACION-MANUAL-LECTOR-Y-MOVIL.md`.
- **Bloque B (tras las correcciones de Dev):** no hay head nuevo para ES-209 ni ES-206; el PR #140 (ES-154) sigue abierto y sin probar. Se repite cuando Dev avise.
- Cadena positiva de experimentos/plan y de Skill Map con evidencia confirmada y propuestas de IA (arriba).

## Limpieza
Persona4 y persona5 desechables desactivadas; entradas de diario QA2 eliminadas; hoja de vida de persona4 eliminada; las 4 cuentas del equipo no se tocaron. Consumo de IA de esta ronda: 1 PDF + 1 mensaje de chat (por debajo de los ≈ 45.000 tokens aprobados; no medido con exactitud).

Scripts: qa/staging-es45-b-api.cjs, qa/staging-es45-b-ui.cjs (PR #100).

---

# Cadena positiva (plan Jira ES-45 comentario 11040, aprobado por Mauricio)

8-nov-2026 · staging commit 5cad756 · personas desechables QA2 A y B · IA real: 4 llamadas (2 mensajes de chat + 2 propuestas de Skill Map; dentro del tope aprobado de 4 llamadas / ≈ 60.000 tokens; el consumo exacto no se midió).
Scripts: `qa/staging-es45-cadena.cjs` (API, 56 comprobaciones en la corrida final: 56 OK, 0 FALLA) y `qa/staging-es45-cadena-ui.cjs` (pantallas).

## Veredicto: sin Críticos ni Altos. 1 Medio de rendimiento a decidir y varias partes sin verificar (ver abajo).

## Resultados (API)
- **C1** contexto de persona (`PUT /api/user/context`) y restricciones de rutas (201, versión 1).
- **C2** dos evidencias confirmadas y un borrador (201); confirmar sin campos obligatorios → 422 `incomplete_evidence`.
- **C3** nivel sin referencias → 422 `evidence_required`; con dos evidencias confirmadas → 201; un **borrador no cuenta** (422 `evidence_not_valid`); el mapa muestra 1 nivel y el resto sin nivel (sin déficits ficticios).
- **C5** rutas calculadas con el contexto; elegir ruta → 201; base ajena/alterada → 409 `conflict`; solicitud de revisión → 201.
- **C6** proponer experimento (token firmado) → crear (201) → iniciar → entregar → reflexionar → decidir, versiones 1→5; decidir antes de reflexionar → 409 `transition_not_allowed`; propuesta alterada con el mismo token → 409 `invalid_proposal`; token de A usado por B → 409.
- **C7** propuesta de plan → versión guardada (201) → lectura persistente (3 acciones).
- **C8 idempotencia:** repetir autoevaluación, elección de ruta, creación de experimento y plan con el mismo `requestId` no duplica (200, `created:false`; un solo experimento).
- **C9 derivados:** al editar una evidencia confirmada, el nivel pasa a `stale` (nivel null, sin borrarse en silencio), el experimento y el plan pasan a `needs_review` (`basis_changed`); no se borran. Eliminar una evidencia citada → 200 y el nivel sigue `stale`.
- **C11 aislamiento A/B:** B no lee experimento, revisiones, ruta elegida, evidencia ni plan de A (404); no escribe sobre el experimento de A (404); no puede citar la evidencia de A en su Skill Map (422); los listados y el Skill Map de B no contienen nada de A.
- **C12 concurrencia:** dos escrituras con el mismo `expectedVersion` → una 201 y la otra 409; `currentVersion` consistente (sin versión duplicada).
- **C13:** ninguna propuesta revisada (experimento, plan, Skill Map de IA) contiene diagnóstico, prescripción, promesas de empleo, porcentajes de reemplazo por IA, vacantes ni tarifas (revisión por patrones sobre el texto de la respuesta).
- **C14:** evidencia con `<img onerror>`, `<script>` e «ignora tus reglas» se guarda como texto (201, sin 5xx); procedencia distinta de autorreporte → 400 `invalid_source`; enlace `javascript:` → 400.
- **C4 (IA):** con el puente profesional autorizado, el chat respondió (3,8–4,9 s) y las propuestas de Skill Map (4,5–5,2 s, mediana < 15 s) **no guardaron nada** (mapa idéntico antes y después).
- **C10:** al revocar el puente profesional la respuesta es 200 y las evidencias escritas directamente siguen (contrato documentado en el código: solo las del chat dependen del consentimiento).

## Resultados (UI, C15; 4 variantes ES/EN × 390/1440 px, Chromium)
`/app/skill-map`, `/app/evidence`, `/app/evidence/new` y `/app/route-catalog`: cargan con contenido, sin desborde horizontal, sin claves de traducción crudas, con foco visible tras Tab y sin errores de página ni 5xx. **`/app/next-step` y `/app/professional-reviews` muestran «Este recorrido aún no está disponible» / «La vista preliminar no está habilitada»**: son pantallas deshabilitadas por configuración en staging, no defectos; por eso la UI de experimento y plan **no se pudo verificar**. Capturas en la carpeta local de evidencia.

## Hallazgo
| ID | Sev. | Detalle |
|---|---|---|
| P1 | Medio (decisión) | Las escrituras de la cadena ES-33 superan el umbral propuesto de 0,8 s en 3 de 4 corridas: elegir ruta 0,3–1,3 s, proponer experimento 0,4–1,8 s, crear experimento 0,65–1,0 s, nueva versión 0,6–1,1 s, guardar plan 0,9–1,3 s (la corrida con menor carga fue la más rápida; hay varianza de staging). Cada escritura recalcula la base de la ruta varias veces. Apto para 6 personas, pero incumple el umbral propuesto: Mauricio/Alejo deciden si se mantiene el umbral o se abre ticket a Dev. |

## Observaciones
- **I4:** tras editar una evidencia, la **elección de ruta** sigue `basisChanged:false` mientras el experimento y el plan pasan a `needs_review`. Es coherente si la ruta propuesta no cambió, pero conviene que Dev confirme que es la intención.
- **I5:** `GET /api/messages` devuelve solo `role` y `text` (sin id de turno), así que desde la API pública no se pueden obtener los `turnIds` que exige `POST /api/evidence/proposals`; la propuesta de evidencia con IA solo se alcanza desde la interfaz.

## No verificado
Propuesta de evidencia con IA (sin `turnId` por API); confirmar propuestas de Skill Map bajando y subiendo el nivel (el modelo devolvió nivel `null` para la habilidad evaluada, así que no hubo nivel que bajar; el rechazo `cannot_raise_level` quedó sin ejercitar); evidencia con origen del chat y su invalidación al revocar el puente (C10 completo); UI de experimento y plan (pantallas deshabilitadas); porcentaje de mensajes de IA que respetan los límites más allá de las 2 llamadas; lector de pantalla y móvil físico; ES-206/209/210/205 (sin cabeza nueva de Dev).

## Limpieza
Evidencias QA2 eliminadas; las personas A, B y la de la UI se desactivaron; el puente profesional de A quedó revocado. Las 4 cuentas del equipo no se tocaron.
