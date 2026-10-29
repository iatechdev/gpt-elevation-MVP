# ES-113 — Diario con papel rayado: entrega a QA

[Dev-Codex]

Diseño/plan aprobado: Jira 10511 y aprobación explícita 10512. Nueva paleta de la landing presentada en 10574 y aprobada por Alejo en 10575; adjuntos 10020/10021. Alejo aceptó una entrada por registro y guardado manual, sin recuperación de texto no guardado tras cerrar la pestaña. Se conserva el aviso y la protección de salida; no se añade autoguardado ni texto privado al almacenamiento del navegador.

## Dependencia y revisión del cambio

La rama ES-113-diario-papel parte de main d5eb00f e integra ES-37 5c5da06 solo en la rama de trabajo, por la solicitud posterior de Alejo (Jira 10535 y 10575). No se fusiona ningún PR ni se modifica main. El PR apunta a main y **requiere fusionar ES-37 / PR 84 primero**. Los diez archivos heredados de esa dependencia no son cambios propios del diario. Para aislar ES-113: `git diff 5c5da06...HEAD`.

La UI usa los tokens compartidos y las clases daisyUI ya disponibles; no instala dependencias ni crea otro tema. SpaceShell recibe una clase opcional usada solo por el diario. Se mantienen navegación/rutas y funciones del chat, sin implementar ES-112, El Puente o el mapa. El botón Al Puente está deshabilitado con explicación: no hay ruta adivinada ni envío implícito.

## Qué entrega

- `/app/diary`: selección explícita y lista de hasta 100 entradas, con mensaje vacío y recuperación de errores de lectura.
- `/app/diary/new`: fecha local editable, editor rayado serif, contador, aviso de privacidad y límite de conservación, guardar/cancelar.
- `/app/diary/:id`: lectura, editar, borrar con diálogo, elección explícita para chat, estado de guardado/resultado incierto/conflicto y entrada inaccesible.
- Escritorio con lista secundaria a la izquierda y hoja a la derecha; móvil con hoja primero y lista debajo. ES/EN y fechas de calendario localizadas sin desplazamiento de día por zona horaria.
- Texto y controles mantienen 44 px de objetivo y foco de 3 px. Reduced-motion existente y adaptación de la hoja a forced-colors; no se añade modo oscuro global a una pantalla que no lo tenía.

## Resultados reales de Dev

Windows, Node v24.14.0. Comandos desde frontend/ salvo indicación.

| Prueba | Resultado |
| --- | --- |
| npm run lint | Exit 0; 0 errores y 0 advertencias |
| npm run build (tsc -b + vite build) | Exit 0; 171 módulos, build 3.66 s; CSS 117.76 kB (18.32 gzip), JS 822.98 kB (220.10 gzip) |
| npm test | Exit 0; 168 tests, 168 pasan, 0 fallan/omitidos; 32930.9791 ms. Incluye 3 nuevos de ES-113 y 9 heredados de ES-37 |
| npm audit --json | Exit 0; 0 vulnerabilidades frontend |
| backend/: npm test | Exit 0; 388 tests, 388 pasan, 0 fallan/omitidos; 66720.6855 ms. Persistencia/proveedores con dobles en las suites que así lo declaran |
| backend/: node --test test/integration/es-113-diary-postgres.cjs | Exit 0; 7 tests contando padre y 6 subcasos, 7 pasan, 0 fallan/omitidos; 71795.4096 ms. PostgreSQL/JWT/ORM/cifrado reales, conexión local inyectada |
| node --check backend/test/support/es113-preview.cjs | Exit 0 |

Vite mantiene aviso de chunk >500 kB y tiempos de callbacks de plugins. No se silencian reglas ni avisos. Backend npm ci reporta seis vulnerabilidades moderadas; no se declara auditoría backend verde ni se hacen cambios mayores de dependencias en esta HU. La salida de backend tests incluye fallos inyectados y NotFoundError del fallback SPA bajo .codex aunque el resultado es 388/388; la navegación real del diario se comprueba con el harness que permite esa carpeta oculta.

### Navegador con PostgreSQL real

Se usó la UI construida, router del diario, verificación JWT, revocación, Sequelize y cifrado reales en PostgreSQL desechable de loopback. No hay datos del piloto, .env ni proveedores externos. Los fallos de ACK/lectura y el cambio concurrente se provocan explícitamente en el harness; no son fallos de producción observados.

Comprobado:

- Editar y guardar persiste tras recargar. Cancelar abre el diálogo con foco en Permanecer/Stay; Escape conserva borrador y devuelve foco. Tab del textarea llega a Guardar con outline de 3 px.
- Fecha futura introducida con teclado en el control nativo: se rechaza antes de escribir, recibe foco y aria-invalid=true con descripción asociada al mensaje. El intento de cambiar fecha se descarta explícitamente desde el diálogo.
- ES/EN mantienen texto y fecha; no se traduce el contenido privado de las entradas.
- Sin desborde de documento a 320/375/768/1440 px (también texto largo a 375). Capturas antes/después con el mismo texto sintético y misma DB antes de editarla: escritorio 1440 y móvil 375.
- Medición final con estilos computados: texto de hoja/fondo 15.44:1; aviso discreto/fondo 4.74:1; texto/botón primario 17.43:1; borde de fecha/fondo 3.58:1. Navegación anidada usa tinta rgb(26,26,24), sin el tema olivo anterior.
- ACK de creación ilegible después de confirmar DB: conserva texto y estado incierto, bloquea otro envío; consultar lista permite encontrar una sola entrada del intento y abrirla sin otra creación.
- ACK de edición ilegible: Guardado sin confirmar hasta consultar y comprobar que la versión guardada coincide. La misma prueba se repite con el texto final ES.
- ACK de borrado ilegible: no anuncia eliminación confirmada hasta consultar y obtener 404; entonces quita contenido y refresca recientes.
- Cambio de versión mientras se edita: bloquea guardar, conserva borrador y permite revisar; no se promete atomicidad en la carrera posterior al GET.
- Fallos 503 de listado/lectura: aviso y Reintentar recuperan la información sin escrituras.
- Cambio A→B: lista de B, sin texto de A. ID de A abierto por B muestra entrada no disponible. B puede borrar su propia entrada y ver el vacío; tras revocar su JWT y recargar aparece sesión vencida sin texto privado.

No verificado por Dev: lector de pantalla externo, zoom real al 200%, emulación en vivo de prefers-reduced-motion, dispositivos físicos, staging/producción, recorrido completo del chat y El Puente. El CSS de reduced-motion se conserva; no se presenta como una comprobación de preferencia en vivo. QA debe ejecutar los casos restantes y comparar con la maqueta de Jira.

Evidencia adjunta a Jira ES-113: antes-escritorio.png (10015) y antes-movil.png (10017), frente a final-escritorio.png (10022), final-movil-es.png (10023) y final-movil-en.png (10024). La misma fixture de A se restauró usando la API/UI real tras las pruebas de fallo para comparar el contenido. Los adjuntos 10016/10018/10019 muestran la iteración olivo anterior y quedan como histórico, no como entrega final. Los 10020/10021 son la maqueta de la nueva paleta; los 10022–10024 son capturas de la aplicación implementada.

## Límite comprobado: creación sin idempotencia

El contrato actual de POST /api/diary no tiene requestId/idempotencia (ya señalado en el plan). En la primera inyección de fallo se cerró el socket tras guardar y el navegador repitió el POST: aparecieron dos entradas sintéticas. No hubo un bucle de reintentos en el frontend. Este cambio no garantiza unicidad frente a reintentos del transporte.

Para comprobar determinísticamente el estado incierto de la UI, los escenarios finales de ACK completan HTTP con JSON ilegible tras el commit real, evitando ese reintento de transporte: una escritura, respuesta no confirmable y consulta posterior. No se oculta la primera observación ni se presenta como idempotencia resuelta. El guardado manual evita el reenvío automático de la aplicación; la idempotencia del endpoint necesita un contrato/cambio de backend separado. No cambia el límite aprobado de conservación en memoria.

## Seguridad y privacidad

Sin endpoints, consultas personales nuevas en servidor, modelos o migraciones de producto. Reutiliza `/api/diary` y helpers de Mauricio; dueño verificado en servidor por JWT y UserId/id/deletedAt. Las pruebas PostgreSQL comprueban A/B y admin/superadmin/terapeuta/board: IDs ajenos devuelven 404 sin efectos, ausencia de sesión 403, token inválido/revocado 401. Contenido almacenado v2 cifrado; borrar vacía contenido e invalida sin texto en eventos. No se altera consentimiento, exportación, borrado global o núcleo de sesiones.

El harness tiene rutas `/__es113/*` de control, incluidas sesiones sintéticas y fallos. **Nunca las monta server.js ni api/index.js**. Solo es un proceso de prueba en loopback con su propia DB y claves aleatorias en memoria. No es un mecanismo de login del producto ni una vista pública desplegada.

## Cómo reproducir para QA

1. Usar una carpeta aislada en la rama ES-113-diario-papel; npm ci en frontend/ y backend/.
2. En frontend/: `npm run lint`, `npm test`, `npm run build`, `npm audit`.
3. En backend/: `npm test` y `node --test test/integration/es-113-diary-postgres.cjs`. La prueba crea/cierra su propia DB, no usa DATABASE_URL.
4. En backend/: `node test/support/es113-preview.cjs`. Necesita el frontend construido. Arranca PostgreSQL desechable con binario instalado por embedded-postgres; no requiere una DB del equipo ni .env. Puerto HTTP 43114 libre.
5. Abrir `http://127.0.0.1:43114/__es113/session/101?lang=es` (A) o `/__es113/session/202?lang=en` (B). Solo esos IDs sintéticos están disponibles. Cada cuenta empieza con una entrada de ejemplo, sin relación con las seis personas.
6. Para provocar un fallo una vez: navegar a `/__es113/scenario/list-error`, `read-error`, `create-error`, `create-ack`, `edit-ack` o `delete-ack`. Redirige al listado; realizar la acción correspondiente. `normal` desactiva fallos. La elección usa una cookie local de prueba.
7. Para conflicto: editar la entrada inicial de A y, en otra pestaña, abrir `/__es113/change-seed`; volver a guardar en la primera. Ese control modifica directamente la fixture en DB para simular otra sesión.
8. `/__es113/revoke/101` o `/202` revoca esa sesión sintética; recargar una entrada para verificar el rechazo. Reiniciar el harness restaura las fixtures/tokens.
9. Para detener y limpiar la DB: abrir `/__es113/stop` o terminar normalmente el proceso. Si se fuerza la terminación del terminal, verificar que PostgreSQL esté detenido antes de retirar su carpeta propia bajo backend/.pgdata. No reutilizar estos controles en producción.

Para comparación histórica opcional, ES113_BASELINE_DIST puede apuntar explícitamente al dist de una copia limpia de main d5eb00f; el harness lo sirve en 43115 sobre la misma DB sintética. Esa referencia ya debe estar construida. No se versionan dist, capturas, .pgdata ni node_modules.

## Pendientes de aceptación

- QA revisa el PR, las capturas y lo no verificado; sus hilos quedan abiertos para QA.
- Mauricio fusiona primero ES-37 tras QA y después ES-113 cuando corresponda. Dev no fusiona ni despliega.
- CI del commit entregado se consulta en el PR; su resultado se registra allí, sin asumirlo a partir de pruebas locales.
