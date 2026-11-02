# ES-113 — Diario: maqueta y plan para aprobación

[Dev-Codex]

29-oct-2026. Propuesta publicada antes de crear rama, PR o implementación del producto; aprobación posterior registrada al final de este documento. La maqueta es HTML independiente con estados simulados, sin APIs, almacenamiento, analítica ni datos personales. Abrir ES-113-MAQUETA.html, adjunto 10009 en [ES-113](https://iatech-team-xqxmjki1.atlassian.net/browse/ES-113); EN cambia el idioma y «Ver estado» permite revisar cada estado. El control de estados y la franja de revisión no forman parte del producto propuesto.

## Fuentes y alcance

- Jira ES-113: diario como papel rayado, conservación de CRUD/lista/privacidad, paso al puente solo al existir ES-111.
- Fuente visual inspeccionada: `prototipo-figma-elevation/figma/03-mi-espacio-diario.jpg` y sección 2.3 de GUIA-PROTOTIPO-FIGMA-ELEVATION.md. La imagen muestra una hoja con fecha y serif cursiva. No acredita escritorio, inglés, vacíos, errores ni guardado; esas variantes son propuestas nuevas de esta maqueta.
- Código leído desde origin/main d5eb00f: frontend/src/space/JournalPage.tsx, api.ts y hooks.ts; backend/routes/diary.js. No se toca la carpeta compartida de otra sesión.
- Sistema visual propuesto: tokens de ES-37, PR 84. Se usarán al integrarse en main; no se copia un sistema paralelo a la aplicación. ES-38 podrá unificar componentes compartidos; ES-113 concentra el diseño y comportamiento específico del diario.

## Pantallas y flujo

Se conservan las rutas `/app/diary`, `/app/diary/new`, `/app/diary/:id` y el acceso existente desde Mi espacio. No se implementan las pestañas ni «Pausar» de ES-112.

1. Lista: entradas recientes, aviso del límite actual de 100 y «Nueva entrada». No se crea automáticamente una entrada al visitar el diario. Si no se seleccionó una entrada, el panel principal invita a elegir o crear; nunca abre contenido nuevo de manera silenciosa.
2. Nueva entrada: fecha editable y textarea de papel rayado. Una entrada por registro; pueden existir varias el mismo día. Fecha y texto se validan según la API actual. No se impone una página continua por día.
3. Guardar: bloquear doble envío mientras está en curso; solo mostrar Guardado cuando la API y la lectura de confirmación lo acrediten. Conservar la comprobación de respuesta incierta y conflicto actual.
4. Lectura: conservar Editar, Eliminar, volver al listado y la selección explícita como contexto del chat. El enlace al chat no envía el diario al motor profesional.
5. Eliminar: confirmación con Conservar/Confirmar; la maqueta muestra una tarjeta para revisar el texto. En la aplicación se reutiliza ConfirmDialog con foco atrapado, Escape, retorno al control de origen y las advertencias existentes de invalidación/purga.
6. Al Puente: deshabilitado y con explicación mientras ES-111 no esté integrado. Al habilitarlo solo navegará a la ruta real registrada: no se adivina una URL ni se comparte el texto al pulsar. Se conserva el guard de cambios pendientes.

### Wireframe

Escritorio: cabecera existente → navegación existente → título y Al Puente → lista secundaria de entradas a la izquierda + hoja principal a la derecha (fecha, texto, contador, privacidad, estado y acciones). El orden de lectura prioriza el editor; la lista es navegación secundaria.

Móvil: cabecera → navegación ajustada en líneas → título/Al Puente → explicación → hoja a ancho completo → entradas recientes debajo. Sin columnas estrechas ni scroll horizontal. El campo admite scroll interno y redimensionado vertical; las líneas son decorativas y no limitan lo que se escribe.

## Diferencias justificadas frente a Figma y lo actual

- Se añade la lista lateral/en móvil inferior porque ES-113 exige conservar las entradas anteriores; el prototipo solo muestra una hoja.
- Se conservan fecha editable, guardado manual, cancelar, editar, eliminar, selección para chat y avisos de resultado incierto/conflicto. El prototipo no los describe; ocultarlos rompería lo ya construido.
- Se conserva la navegación existente; unificar pestañas y menú es ES-112. No se añaden destinos inexistentes.
- El botón Al Puente aparece deshabilitado con motivo; el prototipo lo muestra activo, pero ES-111 sigue siendo una propuesta pendiente.
- En las capturas se usa Inter local y Georgia como fallback serif. Títulos de la implementación usarán Playfair Display del sistema existente; el cuerpo del diario propone Georgia cursiva, diferenciándolo de la voz de IA. La geometría tipográfica exacta de Figma no está verificada.
- No hay autoguardado ni recuperación persistente prometidos. Véase la objeción al criterio 5.

## Componentes, tokens y accesibilidad

daisyUI 5: button (`btn`, una acción primaria Guardar), textarea y card para estados auxiliares; componentes existentes SpaceShell, ConfirmDialog y guard de navegación se reutilizan. Nuevos estilos estrictamente específicos: hoja rayada y distribución de editor/lista. Las líneas usan el borde decorativo y no sirven como único límite de un control.

Tokens ES-37: fondo #F9F9F7, hoja #FAF8F4, tinta #1C1917, secundario #57534E, discreto #6B6560, acción #4A6741 sobre blanco, selección #EAF0E6, borde de controles #7C8875 y foco #2F6B8F. Espaciado en múltiplos de 4 px, radios suaves, sin sombras intensas. No se cambia la landing ni se añade modo oscuro global; el diario actual no lo ofrece.

Teclado: enlace Saltar al diario, etiquetas asociadas a fecha/textarea, acciones nativas, objetivo táctil de 44 px, foco visible de 3 px, estados con aria-live polite; errores de campo asociados y foco al primero inválido. El disabled del puente tiene explicación visible. A 200% y con reduced-motion se conserva lectura y funcionamiento; deben comprobarse en la implementación. No usar solo color para indicar Guardado/Error.

## Estados a implementar y comprobar

| Estado | Comportamiento propuesto |
| --- | --- |
| Sin entradas | Mensaje neutral y Nueva entrada; sin contenido simulado en producción |
| Ninguna seleccionada | Elegir una entrada o crear una; no abrir/escribir automáticamente |
| Cargando | Mensaje sin contenido antiguo de otra cuenta; acciones bloqueadas según contexto |
| Sin guardar | Texto en memoria, estado visible, guard de salida |
| Guardando | Bloqueo del envío, indicador; no decir Guardado todavía |
| Guardado | Solo tras confirmación real; lectura y acciones existentes |
| Error | Conservar borrador en memoria y explicar el fallo; no repetir escrituras ambiguas automáticamente |
| Resultado incierto | Comprobar recientes/entrada antes de crear otra; no duplicar por reintento ciego |
| Conflicto | Revisar versión del servidor, sin sobrescritura silenciosa; conservar la protección actual y sus límites |
| Eliminación | Confirmación y resultado verificado; no afirmar borrados de respaldos inmediatos |
| Sesión vencida | Ocultar datos privados y pedir ingreso; no restaurar contenido de otra cuenta |

La maqueta permite visualizar 14 estados mediante selector, incluidos sin selección, salida con cambios, borrado e inaccesible. No acredita lógica de guardado, conflictos, eliminación ni aislamiento real. Las confirmaciones se dibujan como tarjetas para revisar su contenido; su foco/modalidad se comprobará al reutilizar ConfirmDialog en la implementación.

## OBJECIÓN — criterio 5: cierre de pestaña sin pérdida

El guard actual conserva texto en memoria y registra beforeunload; no persiste borradores. El cierre forzado, caída del navegador o apagado pierden el texto no guardado. La API actual tampoco tiene borrador, idempotencia de creación ni control atómico de versiones. Un aviso no garantiza recuperación. No se puede prometer ausencia total de pérdida en offline/cierre forzado con esos contratos.

Recomendación para este tramo: una entrada por registro y guardado manual explícito; conservar el texto tras fallo de red mientras la sesión/pestaña sigan activas, aviso antes de salir y advertencia honesta de guardar antes de cerrar. No usar localStorage, sessionStorage o IndexedDB para texto privado. **Requiere que Alejo acepte explícitamente este límite como ajuste del criterio 5; hasta entonces ese criterio sigue pendiente.**

Alternativa si se exige recuperación tras cierre: acordar con Mauricio un contrato de borrador privado cifrado en servidor (propietario, retención, exportación y borrado), recuperación del último borrador confirmado, política de sincronización/idempotencia y concurrencia. Tampoco puede recuperar cambios offline nunca enviados. Estimación adicional preliminar 16–24 h más QA, a precisar tras definir contrato; no se implementa ni se añade al núcleo de derechos por esta propuesta visual.

## Plan backend

Se reutilizan GET /api/diary?limit=100, GET /api/diary/:id, POST /api/diary, PUT /api/diary/:id, DELETE /api/diary/:id. Sin endpoints, modelos, migraciones ni dependencias nuevos para la opción manual. Modelo DiaryEntry existente: dueño, fecha, contenido cifrado y metadatos; invalidación existente en edición/borrado. Nunca registrar texto privado en pruebas, logs, telemetría o terceros.

Validaciones existentes: fecha real YYYY-MM-DD con margen de zona horaria vigente, texto no vacío, máximo 10 000 caracteres, ID válido. El cliente no aporta dueño: el servidor usa req.user.id y consultas por UserId + id + deletedAt. Se reutiliza verificarToken y los contratos de Mauricio; ningún control visual sustituye esa autorización.

No se rediseña consentimiento/revocación/exportación/borrado. Si aparecen errores en esos helpers se documentan y detiene solo la integración afectada. El defecto de carrera entre lectura y PUT no se declara resuelto por el cambio visual; sin contrato atómico no se garantiza edición simultánea.

## Pruebas previstas

- Frontend lint sin errores/advertencias, tsc -b, npm test, build y audit con salida real. Render ES/EN, fallback, estados, respuestas perdidas, guard de salida y regresión de CRUD/selección para chat. Ningún texto no confirmado aparece como persistido.
- HTTP con dueños A/B y roles ajenos: leer/editar/borrar IDs ajenos devuelve la respuesta uniforme vigente, sin cambios a B; no sesión denegada; flujo del dueño válido. Confirmar APIs con DB PostgreSQL de prueba desechable e identificar los mocks de proveedores. Ninguna llamada a Claude ni envío al motor profesional para guardar el diario.
- Comparación de capturas con la referencia y la maqueta aprobada: 320/375/768/1440, ES/EN, teclado/foco, zoom 200%, texto largo, reduced-motion, contraste y lector de pantalla cuando esté disponible. Cierre/red caídos se prueban hasta el límite aprobado; no se anuncia recuperación inexistente.
- Sin despliegue de producción desde Dev. Una rama ES-113-diario-papel y un PR contra main solo después de la aprobación del diseño/plan y de resolver el criterio 5. QA aprueba y Mauricio fusiona.

Estimación inicial del tramo manual completo: 16–24 horas más QA y dependencias. No incluye el sistema de recuperación persistente alternativo ni ES-111/112. La fecha de entrega se acuerda después de aprobar alcance y disponibilidad de ES-37.

## Verificación de esta maqueta

HTML independiente compilado con daisyUI instalado; sintaxis de preview.js verificada. Navegador: escritorio 1440 y móvil 375/320, ES/EN; a 375 y 320 no se observó desborde horizontal del documento. Capturas incluidas. Los estados son simulados; no se han ejecutado pruebas de producto, API/DB, un lector de pantalla externo ni aceptación E2E de esta HU. Esta maqueta no permite aprobar la seguridad del backend.

## Aprobación solicitada

Aprobar o corregir layout, textos ES/EN, una entrada por registro, guardado manual, controles y estados, y plan técnico. Resolver expresamente el límite del criterio 5 antes de implementar. La aprobación no equivale a publicar ni desplegar el producto.

## Aprobación recibida

Alejo respondió «Aprobar diseño y guardado manual con ese límite» el 29-oct-2026. Aprobación registrada en Jira ES-113, comentario 10512, sobre el diseño/plan del comentario 10511 y sus cuatro adjuntos. Se acepta expresamente el ajuste del criterio 5 indicado arriba. No se autoriza recuperación persistente, autoguardado ni despliegue. La rama aprobada es ES-113-diario-papel desde main; la aplicación de tokens conserva la dependencia de ES-37 integrado.

Actualización operativa autorizada por la solicitud posterior de Alejo de integrar y terminar: ES-37 se integra únicamente en ES-113-diario-papel para implementar y probar sin modificar main ni fusionar PR ajenos. Registrado en Jira 10535. El PR de entrega contra main depende de que Mauricio fusione primero ES-37 tras QA; el diseño aprobado se conserva.

Actualización visual aprobada por Alejo en Jira 10575 sobre 10574 y adjuntos 10020/10021: «Aprobar nueva paleta de la landing». Sustituye los colores olivo de la referencia inicial por los tokens de ES-37 5c5da06: papel #FAFAF9, hoja #F2F1EF, tinta #1A1A18, gris #6B6B67, borde de control #8A8780, botón tinta/blanco y enlaces #7D6218; ocre #B8963E solo decorativo. No cambia estructura, textos, flujo ni la decisión de guardado manual. La guía de entrega y las capturas finales reflejan esta aprobación posterior.
