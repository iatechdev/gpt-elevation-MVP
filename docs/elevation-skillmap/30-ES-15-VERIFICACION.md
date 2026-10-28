# ES-15 — Verificación para revisión técnica y QA

[Dev-Codex]

28-oct-2026. Rama `ES-15-mi-espacio-diario`. Base actualizada con `main` 6dc61e9 mediante merge 6741964; ningún cambio enviado directamente a main. Diseño publicado en Jira 10228, límites/objeción en 10229 y aprobación explícita recibida en el chat antes de implementar.

## Entrega

- Diario privado ES/EN: listado de hasta 100 entradas, creación con fecha explícita, detalle confirmado, edición, revisión de cambios detectados en otro dispositivo y borrado con confirmación.
- Borrador en RAM separado de lo confirmado. Sin autosave, contenido privado en web storage, URL o logs nuevos. Un resultado desconocido conserva el borrador y ofrece consulta, sin repetir la mutación automáticamente ni identificar entradas por igualdad de texto.
- Si POST respondió con un ID pero falla su lectura posterior, se conserva ese ID para recuperar la entrada conocida. Si no hubo respuesta de POST, se consulta la lista sin fingir idempotencia.
- Navegación Mi espacio/Mi siguiente paso en ambos chats y pantallas nuevas. La puerta profesional muestra enlaces solo para rutas realmente registradas; en esta base las cuatro pantallas frontend aún no están integradas y sus tarjetas dicen En preparación. La disponibilidad del backend no se confunde con la de una pantalla.
- Adaptador común para ambos chats: selección explícita de hasta tres entradas propias por envío, relectura antes de usar, cuerpo/requestId congelados, confirmación mediante historial real, consulta manual del estado y reintento explícito sin duplicar el turno confirmado.
- El error de proveedor/presupuesto se presenta como estado, nunca como respuesta guardada. Seleccionar diario no otorga autorización profesional; deseleccionar no borra contenido ya incorporado a la conversación.
- Componentes daisyUI con prefijo existente `elv-`, textos bilingües, tokens interiores, títulos Playfair 400, foco, salto al contenido como primer enlace y reducción de movimiento. En móvil el dashboard apila sus columnas y permite que los controles existentes de cabecera se distribuyan sin recortarse. Check-in, checkout y widgets conservan sus funciones.
- Sin nuevos endpoints, modelos, migraciones, dependencias ni cambios del proveedor. Backoffice y pantallas de terapeuta/board no se modifican. El plugin daisyUI existente incorpora módulos de input/textarea/checkbox; no se cambia el diseño de landing.

## Resultados ejecutados

| Comprobación | Salida real final |
| --- | --- |
| `frontend: npm run lint` | exit 0; 0 errores y 0 advertencias; sin desactivar reglas |
| `frontend: npx tsc -b` | exit 0 |
| `frontend: npm test` | 27 pruebas, 27 pass, 0 fail; cinco nuevas de ES-15 |
| Compatibilidad Node 22: `node --test test/es15.test.mjs` | 5 pruebas, 5 pass, 0 fail |
| `frontend: npm run build` | exit 0; 85 módulos; JS 545,67 kB (gzip 141,23), CSS 48,70 kB |
| `frontend: npm audit --json` | 0 vulnerabilidades |
| `backend: npm test` tras integrar main | 248 pruebas, 248 pass, 0 fail |
| `backend: npm audit --audit-level=high --json` | exit 0; 6 moderadas, 0 altas/críticas |
| `backend: node test/integration/es-15-postgres.cjs` | exit 0; ocho grupos PASS; 0 errores de ejecución del navegador |

El build conserva el aviso de chunk mayor de 500 kB. No se oculta ni se sube el umbral. Las seis moderadas del backend pertenecen a `@google-cloud/storage`, `gaxios`, `retry-request`, `sequelize`, `teeny-request` y `uuid`; no se modificaron dependencias para esta HU. No se presenta ese audit como cero vulnerabilidades.

## Integración real y alcance de las simulaciones

El script arranca un PostgreSQL desechable en loopback, genera claves solo en memoria, carga los routers, middlewares JWT, sesiones, ORM y cifrado reales de esta rama y sirve el frontend compilado. Cierra navegador/servidor/conexión/PG al terminar. No lee `.env` ni DATABASE_URL y no usa datos del piloto o producción.

El proveedor Anthropic se sustituye por una respuesta sintética capturada; se inyectan fallos de proveedor y pérdida de respuestas HTTP de forma explícita. Los servicios ajenos de widgets del dashboard reciben fixtures. Las comprobaciones del diario, mensajes, turnos, propiedad, cifrado y revocación usan sus implementaciones y PostgreSQL reales. No es una certificación de calidad semántica de Claude.

Ocho grupos comprobados:

1. JWT real: A crea/lee Unicode cifrado v2; B, admin, terapeuta y board reciben 404 al leer/editar/borrar el ID de A y al intentar usarlo como contexto. Sin token: 403. Ninguno de esos accesos llama al proveedor.
2. Chat sin selección no incorpora diario; con selección solo incorpora la entrada elegida y hasta el límite existente de 2.000 caracteres. Replay y consulta recuperan el turno propio; otro dueño no puede consultarlo.
3. Un proveedor fallido deja cero mensajes huérfanos. Borrar vacía contenido cifrado, genera invalidación real y devuelve 404 en accesos/borrados posteriores.
4. UI compilada con API/DB reales: crear, leer, editar, cancelar borrado, foco inicial en permanecer/cancelar y Escape. Cambio desde otro dispositivo conserva el borrador y exige revisión. PUT sin respuesta se reconcilia por GET sin repetirlo. POST con ID conocido y lectura interrumpida recupera ese ID. El primer Tab alcanza el salto y Enter mueve el foco al contenido.
5. POST guardado pero con respuesta perdida: el diario conserva el borrador, consulta la lista y no repite POST. El chat recupera una sola pareja confirmada mediante requestId, limpia selección y borrador. Cuarta selección bloqueada. Fallo real del proveedor simulado seguido de reintento explícito conserva el mismo cuerpo ES aunque la UI pase a EN.
6. ES/EN, puerta profesional sin enlaces inexistentes, reflow a 320/375/768/1440 en puerta y dashboard; zoom CSS 200% en la puerta. Ambos chats confirman mensajes contra la misma API real. No aparece texto privado en localStorage/sessionStorage. Capturas revisadas de diario móvil, chat móvil, puerta profesional escritorio y dashboard móvil.
7. Cambio de sesión en la UI elimina entradas de A; B ve su diario vacío. Cancelar Atrás mantiene la ruta y el borrador local.
8. Borrado confirmado desde UI y lectura posterior 404; JWT revocado real recibe 401 y la UI ofrece login. Cero errores de ejecución del navegador.

Contraste calculado con luminancia sRGB sobre #F9F9F7: texto #1C1917 **16,59:1**, acción/foco #4A6741 **6,02:1**, advertencia #92400E **6,73:1**, error #B91C1C **6,14:1**. Las capturas son sintéticas y quedan en `frontend/node_modules/.es15-artifacts/`, fuera de Git.

Para repetir integración: instalar los lockfiles, ejecutar `npm rebuild embedded-postgres` en backend, compilar frontend y ejecutar desde backend `node test/integration/es-15-postgres.cjs` con `PLAYWRIGHT_MODULE` apuntando al paquete Playwright disponible en el entorno (o instalado localmente). No se añadió Playwright como dependencia productiva. La prueba HTTP necesita permiso para abrir/conectar puertos loopback; el primer intento de regresión dentro del sandbox falló con EACCES y se repitió con permiso, obteniendo 248/248 tras integrar main. La integración es una comprobación local explícita; no se añadió un job nuevo de CI.

## Seguridad y privacidad

El cliente no acepta UserId de formularios. Reutiliza Authorization y el propietario `req.user.id` del servidor; DiaryEntry usa UserId y deletedAt, y los turnos están limitados al dueño. No se añaden lecturas de diario en facilitadores, terapeutas o vistas profesionales. El cambio de token limpia los componentes privados e impide aceptar respuestas antiguas de otra sesión.

La selección es para acompañamiento personal y se reinicia después de confirmar cada envío. Sin ella no se envían referencias. El contenido queda escapado como texto; no se inserta HTML. Se mantienen los límites, delimitación de contexto, seguridad y presupuesto del servidor. No se habilitan ejercicios de ES-16 ni se copian PR pendientes de otras HUs.

## Límites aceptados y no verificado

- POST de diario no tiene idempotencia: no se garantiza creación exactamente una vez si no llegó la respuesta. Lista limitada a 100, sin cursor. PUT no tiene control atómico de versión: releer detecta cambios previos, no elimina una carrera posterior. Son los límites aprobados de 10229.
- La entrada seleccionada se lee al procesar el mensaje en servidor, sin bloqueo de versión; máximo 2.000 caracteres por entrada. No es una vista previa exacta del prompt completo.
- Borrar diario no borra retroactivamente mensajes ya confirmados ni retira autorizaciones profesionales anteriores. Se explica en UI y se conservan los flujos existentes de esos derechos.
- No se ejecutaron llamadas reales a Claude, pruebas con personas del piloto, staging/producción, lectores de pantalla o dispositivos móviles físicos. Se verificó Chromium headless con viewport y zoom CSS; no se equipara a todos los navegadores o al zoom nativo de cada plataforma.
- Las cuatro pantallas profesionales y ejercicios siguen pendientes de su integración/publicación aprobada. Se verificaron las tarjetas inactivas de esta base; no se da por realizada la convivencia con los PR frontend todavía abiertos.
- Falta revisión técnica de Mauricio y veredicto de QA. Este informe no aprueba el PR ni autoriza el merge.
