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
