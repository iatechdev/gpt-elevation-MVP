# ES-28 — Primer tramo manual, no HU integrada completa

Diseño: Jira ES-28 comentario 10207. Alejo aprobó explícitamente creación manual,
listado, detalle/historial y revisión/confirmación; la aprobación se registró antes
de escribir producto. Base main e66fa5d (ES-27 ya fusionada). Solo cambia frontend/.

## Alcance y límites aceptados

- /app/evidence, /app/evidence/new y /app/evidence/:id, con sesión existente y
  acceso desde el cuerpo del dashboard. ES/EN sin traducir el relato de la persona.
- GET listado/detalle y POST de creación directa. Ningún PUT/DELETE ni proposalToken,
  origins, UserId o authoring enviados por el cliente. Las afirmaciones nuevas son
  self_report; una referencia no se presenta como artefacto examinado.
- Título + otro campo significativo para guardar borrador. Campos vacíos opcionales
  omitidos. Confirmación requiere situación/responsabilidad/acciones/entrega/efecto,
  vista previa y reconocimiento explícito. Efecto desconocido es una elección válida.
- Meta, entrega y efecto permanecen separados; no se convierten cifras de meta en
  resultados. Autonomía es autorreporte opcional, sin certificación ni evaluación.
- Referencias opcionales HTTPS sin credenciales o extractos. Sin subida de archivos,
  descarga, enlaces automáticos ni ejecución de texto/HTML recibido.
- Una solicitud incierta queda congelada y se reintenta con el mismo requestId y
  cuerpo. Tras ACK, se lee la versión persistida; si falla esa lectura no se muestra
  “guardado/confirmado”. El reintento de verificación es solo GET, sin otro POST.
- Historial solo lectura y diferenciado de versión vigente. Cambios en memoria,
  sin caché privada/localStorage/logs. Guardias de salida, cambio de idioma/sesión,
  errores de campo y mensajes seguros sin exponer errores crudos del servidor.

**Edición de registros guardados detenida por contrato de origen:** GET no expone
hasChatOrigin/referencia de preservación; update() puede resolver origins omitido
como [] y perder ese vínculo. No se infiere “directa” de authoring:person ni se usa
una caché local para decidir permisos. Se explica que el detalle es solo lectura.
Un borrador guardado tampoco tiene edición habilitada en este primer tramo.

**Propuestas desde chat detenidas:** la API requiere turnIds numéricos y el historial
visible no los expone. No se solicitan IDs técnicos ni se adivinan por posición.
La propuesta/evaluación por habilidad del backend ES-28 no está conectada por esta
entrega. No se duplica ni rediseña consentimiento/identidad de Mauricio. Las dos
objeciones y las alternativas están en el comentario de diseño 10207.

Estos pendientes impiden cerrar ES-28 como completa. Sin cambios de proveedor,
backend, migraciones, producción ni pantallas de chat/diario/admin/board/therapist.

## Comandos y datos de prueba

En frontend/:

```text
npm ci
npm run lint
npm test
npx tsc -b
npm run build
npm audit
```

`npm test` ejecuta los módulos TS reales mediante la dependencia typescript ya
existente. No se añaden paquetes. Incluye serialización, límites, procedencia,
meta/resultado, desconocidos, DTO/historial, GET/POST, errores, ES/EN y contraste.

Navegador con Playwright del entorno de QA (sin perfil personal):

```text
npm run preview -- --host 127.0.0.1 --port 4228 --strictPort
node scripts/es28-browser.cjs
```

PLAYWRIGHT_MODULE opcional indica su instalación existente; ES28_PREVIEW_URL
puede indicar otra preview loopback y ES28_SCREENSHOT_DIR una carpeta de capturas
fuera del repo. Este script usa HTTP simulado y todos sus datos son sintéticos.

Integración con backend real, sin modificar su fuente:

```text
node scripts/es28-api-integration.cjs
```

ES28_BACKEND_DIR debe apuntar a backend/ de un checkout aislado del contrato actual
(se probó e66fa5d), con dependencias instaladas y binario embedded-postgres preparado.
Requiere Playwright y preview local como arriba. Crea un Postgres 17 desechable en
loopback con credenciales aleatorias en memoria, sin cargar .env ni DATABASE_URL
existente. Conecta los modelos/JWT/routers/helpers/cifrado reales a esa base. El
navegador usa un proxy local transparente de GET/POST, sin sustituir los cuerpos
de respuesta. Datos, actores y contenidos son fixtures sintéticos; sin proveedor.
Finalmente cierra navegador, servidor, conexión y clúster generado.

## Resultado local del 27-oct-2026

Node 24.14.0, Windows; CI usa Node 22.

| Verificación | Resultado real | Límite |
| --- | --- | --- |
| Lint | exit 0, sin errores ni advertencias | Sin silencios ni relajación de reglas |
| npm test | 24 pass, 0 fail | 17 anteriores + 7 ES-28, fetch simulado |
| tsc -b / build | exit 0 | Chunk 552,24 kB >500 kB; base 522,24 kB; no se silencia |
| npm audit | exit 0, found 0 vulnerabilities | Solo frontend, dependencias sin cambiar |
| es28-browser.cjs | 11 comprobaciones, 0 excepciones de consola | Chromium, HTTP mock |
| es28-api-integration.cjs | 6 comprobaciones, 0 excepciones de consola | HTTP/JWT/ORM/cifrado/Postgres 17 reales |

Navegador: sesión, formulario mínimo, límites/referencias, ES/EN sin pérdida,
cancelar Atrás, 320/375/768/1440, zoom 200%, foco/salto y movimiento reducido,
vista previa, efecto desconocido y texto hostil escapado, respuesta POST perdida
sin duplicados, lectura posterior fallida sin falso éxito, detalle/historial solo
lectura, fallos/404 sin exposición y limpieza de borrador al cambiar sesión.

Integración real: reintento POST idempotente; borrador recuperable y fuera del motor;
ID de A rechazado a B; creación/confirmación desde React con readback; únicamente
versión confirmada en getConfirmedEvidence, cifrado v2 y listas aisladas; JWT
revocado produce 401 y no hay registros privados en pantalla.

Primeras corridas encontraron un heading de éxito con role=status (corregido para
mantener semántica de encabezado) y un fixture incompleto sin DeletionRequest, que
el middleware actual consulta (se agregó al esquema sintético, sin mockearlo).
Se corrigió también el runner: el hook beforeExit de embedded-postgres podía ocultar
un fallo natural con exit 0; ahora un fallo final devuelve explícitamente exit 1
después de limpiar los recursos. Las cifras de éxito son de ejecuciones posteriores.

No verificado: edición/origen y selección de turnos pendientes de Mauricio,
propuestas IA/proveedor real, staging, personas reales, aceptación editorial/QA ni
recorrido completo evidencia → propuesta de habilidad → mapa. No se cierra la HU.
