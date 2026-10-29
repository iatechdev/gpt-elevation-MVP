# ES-31 — Diseño de interfaz y plan de integración

[Dev-Codex]

27-oct-2026 · **Propuesta para aprobación; sin implementación frontend.**

Base: `main` 4311d69. Rama propia `ES-31-interfaz-catalogo`. Backend de referencia: PR #33, head 783e934, aprobado por QA en Jira 10212; todavía sin fusionar al revisar. Contrato: `23-CONTRATO-CATALOGO-RUTAS.md`, especialmente §9, y código real del PR. Esta propuesta completa la interfaz pendiente; no duplica el backend ni fusiona el PR de otro desarrollador.

## 1. Pantallas y flujo

### Participante

- Enlace «Catálogo de rutas / Route catalog» en el cuerpo del dashboard existente.
- `/app/route-catalog`: catálogo publicado, versión y fecha, filtros locales por mercado, idioma del recurso y contexto editorial. Ningún filtro se deduce de residencia, idioma de pantalla, profesión o datos privados.
- `/app/route-catalog/roles/:roleKey`: ficha ocupacional con industria/mercado, idiomas/modalidad, tareas y exposición a IA por tarea, barreras, capacidades requeridas, habilitación si es regulada, fuentes fechadas, ofertas y recursos con ejercicio.
- Fichas informativas: sin recomendación personalizada, ranking, porcentajes, autoevaluación, elección de carrera, postulación ni plan 7/30/90. Esas acciones pertenecen a ES-32/33/34.
- «Volver al catálogo / Back to catalog» y «Volver al inicio / Back to dashboard». No se crean enlaces a rutas aún inexistentes del Skill Map o experimentos.

### Administración

- Entrada «Catálogo de rutas / Route catalog» en AdminSidebar para admin/superadmin.
- `/admin/route-catalog`: versiones, estado, fecha, número de elementos; abrir borrador o consultar versión publicada/archivada. «Crear borrador / Create draft» copia el vigente según servidor. Si ya existe, se abre el identificado por `draft_exists` tras consultar su estado.
- `/admin/route-catalog/:id`: cinco secciones con enlaces/botones, conteos y faltantes: Contextos, Fuentes, Roles/rutas, Ofertas, Recursos. Formularios estructurados; sin editor JSON ni importación automática.
- `/admin/route-catalog/:id/:kind/:key`: crear/editar un elemento, guardar borrador, quitar elemento con confirmación y consultar faltantes. La clave se elige al crear y queda fija al editar; cambiarla requiere un elemento nuevo y revisar referencias.
- Publicadas y archivadas son de solo lectura. Para modificar una publicada se crea un nuevo borrador.
- Revisión previa a publicar: versión, conteos, faltantes del servidor, advertencia de sustitución del catálogo vigente y confirmación explícita. Solo se ofrece publicar con formularios guardados y una lectura reciente; el servidor vuelve a validar.
- Para que el catálogo sea usable en móvil sin alterar todo el backoffice, estas rutas usarán una cabecera propia compacta con enlace de regreso al admin y selector ES/EN, dentro de AdminRoute. No se rediseñan AdminLayout ni sus otras pantallas; solo se añade el enlace de navegación.

## 2. Wireframes (sin datos del piloto)

```text
PARTICIPANTE · LISTADO
┌──────────────────────────────────────────────────────┐
│ Volver al inicio                              ES EN │
│ Catálogo de rutas                                    │
│ Versión [n] · publicado [fecha]                       │
│ Mercado [Todos v] Idioma [Todos v] Contexto [Todos v]  │
│ ┌ [Etiqueta de rol] ┐ ┌ [Etiqueta de rol] ┐           │
│ │ Mercado · idioma │ │ Mercado · idioma │           │
│ │ Estado de fuentes│ │ Estado de fuentes│           │
│ │ Ver ficha        │ │ Ver ficha        │           │
│ └──────────────────┘ └──────────────────┘           │
└──────────────────────────────────────────────────────┘

PARTICIPANTE · DETALLE
┌──────────────────────────────────────────────────────┐
│ Volver al catálogo                            ES EN │
│ [Rol] · [mercado] · versión [n]                       │
│ [Revisión de dominio: fecha / estado]                │
│ Industria · idiomas · modalidad                      │
│ Tareas → exposición IA: fuente / hipótesis / no consta│
│ Barreras · capacidades requeridas · habilitación     │
│ Fuentes [fecha de consulta] [desactualizada si aplica]│
│ Ofertas [verificada en fecha / vencida] [salario]     │
│ Recursos [propósito/idioma/nivel/duración/precio]      │
│          [capacidad vinculada] [ejercicio]            │
└──────────────────────────────────────────────────────┘

ADMIN · VERSIONES Y BORRADOR
┌──────────────────────────────────────────────────────┐
│ Volver a administración                       ES EN │
│ Catálogo de rutas             [Crear/abrir borrador]  │
│ Versión [n] · Borrador / Publicada / Archivada         │
│ [Contextos] [Fuentes] [Roles] [Ofertas] [Recursos]     │
│ Faltantes para publicar [lista con enlaces]           │
│ [Elementos de la sección]                  [Añadir]  │
│ [Revisar publicación]                                │
└──────────────────────────────────────────────────────┘

ADMIN · EDITOR (EJEMPLO: ROL)
┌──────────────────────────────────────────────────────┐
│ Volver al borrador · versión [n] · Aún no guardado    │
│ Clave [fija al editar] · Título ES [ ] · EN [ ]       │
│ Industria ES [ ] EN [ ] Mercado [ ]                  │
│ Idiomas [ ] Modalidad [ ] Contextos [selección]       │
│ Tareas [texto ES/EN + exposición + fuente + nota]     │
│ Barreras [ES/EN] · Capacidades [clave/importancia]     │
│ Fuentes [selección] · Revisión [por / fecha]          │
│ ¿Regulada? [sin declarar / sí / no]                   │
│ Habilitación [nota ES/EN y fuente si aplica]          │
│ [Guardar borrador] [Cancelar] [Quitar elemento]       │
└──────────────────────────────────────────────────────┘
```

Móvil: una columna, filtros apilados, listas de versiones como tarjetas y navegación de secciones que se envuelve; no tabla horizontal ni pestañas que oculten opciones.

## 3. Campos administrativos y presentación

| Tipo | Campos de formulario |
| --- | --- |
| Contexto | clave, etiqueta ES/EN, nota ES/EN; contexto editorial genérico, sin nombres, correos ni relatos de las seis personas |
| Fuente | clave, tipo, título original, URL HTTPS, país o no aplica, idioma original, publicación opcional, consulta, persona que consultó, accesibilidad declarada |
| Rol/ruta | clave, etiquetas e industria ES/EN, mercado, idiomas requeridos o desconocidos, modalidades, tareas ES/EN y exposición por tarea, barreras ES/EN, capacidades e importancia, contextos, fuentes, revisión por/fecha, estado regulado y nota/fuente |
| Oferta | clave, título original, organización, rol, URL oficial, mercado, idioma, modalidad, publicación opcional, fecha comprobada, salario publicado con texto o no publicado, persona y fecha de verificación, extracto opcional |
| Recurso | clave, lectura/curso, título original, URL, proveedor, propósito ES/EN, idioma, nivel, duración en minutos/texto, precio publicado con importe/divisa o por confirmar, clave de capacidad, ejercicio ES/EN, roles vinculados y fuente opcional |

Los controles condicionales solo aparecen cuando corresponde; los valores desconocidos no se convierten automáticamente en «no», cero, gratis o verificado. Sin nombre/fecha de revisión precargados, ni fecha de hoy como una verificación que nadie hizo. Selectores de referencias usan solo elementos de la misma versión. Las claves de capacidad se introducen explícitamente: no hay catálogo ES-29 en main ni se finge una validación de pertenencia, pendiente de ES-32 según contrato.

Se preserva `synthetic` al editar/copiar un elemento sintético y se muestra «Contenido de prueba / Test content»; no existe interruptor para quitar esa marca ni activar banderas del servidor. No se muestra la semilla como contenido real. Un título original de una fuente/oferta/recurso no se traduce automáticamente: se muestra su idioma y el texto de origen. Campos multilingües del contrato requieren ES y EN al publicar.

En fichas publicadas se consumen `stale`, `verificationTask`, `status`, `verifiedAt` y `domainReview` del servidor; no se recalculan plazos con constantes del frontend. «Comprobada el [fecha]» describe una revisión pasada, no garantiza que la oferta continúe abierta. Datos faltantes o idioma desconocido se indican sin inferir. Una capacidad del catálogo es un requisito de esa ruta, nunca un nivel atribuido al participante. Completar un curso no acredita competencia.

Las URLs muestran dominio y abren solo por decisión de la persona, sin previsualizar ni descargar automáticamente. Validación HTTPS, sin credenciales, sin habilitar enlaces locales/privados y con `noopener noreferrer`; nunca se inserta HTML del contenido.

## 4. Componentes, tokens y accesibilidad

Reutilizar React Router, LanguageProvider y guards de sesión/rol existentes. daisyUI 5 con prefijo `elv-`: botones, cards, badges, fieldsets, inputs, select, checkbox/radio, textarea; componentes de formulario repetible para tareas/barreras/capacidades. Tokens semánticos locales a las pantallas del catálogo; sin modificar el tema global o la landing.

Sistema de diseño interior: fondo #F9F9F7, superficie #FAF8F4 o blanca, texto #1C1917, bordes #D6D2C4; acento oliva #6B7D5C decorativo y #4A6741 para acción/foco/texto con AA, advertencia #92400E, error #B91C1C. Playfair Display 400 en títulos; Inter 16px cuerpo y 14px apoyo. Espaciado 4/8/12/16/24/32; radios .65/1rem. Estados siempre con texto, sin depender del color.

Anchos 320/375/768/1440 y zoom 200%. Objetivos 44px, labels explícitos, fieldset/legend, foco visible, enlace de salto, orden de tabulación natural, listas de errores enfocables con enlaces al campo, anuncios de carga/guardado vía aria-live. Diálogos semánticos con Escape, foco inicial en cancelar y restauración del foco. Sin animaciones necesarias; respetar prefers-reduced-motion. Confirmación de salida con cambios locales y protección de recarga/Atrás. No se lee ni escribe tras cambiar de sesión con respuestas anteriores.

## 5. Estados y textos ES/EN propuestos

Todas las etiquetas de interfaz salen del catálogo i18n, incluidos tipos de elemento, campos anteriores, opciones y errores. Textos de contenido se leen del catálogo guardado, sin traducciones inventadas.

| ES | EN |
| --- | --- |
| Catálogo de rutas | Route catalog |
| Explora fichas ocupacionales, fuentes y recursos. No son recomendaciones personalizadas. | Explore occupational profiles, sources and resources. These are not personalized recommendations. |
| Ver ficha / Volver al catálogo | View profile / Back to catalog |
| Mercado / Idioma / Contexto / Todos | Market / Language / Context / All |
| El catálogo aún no está disponible. | The catalog is not available yet. |
| No hay resultados con estos filtros. | No results match these filters. |
| Ficha no encontrada. | Profile not found. |
| Cargando catálogo… / Reintentar | Loading catalog… / Retry |
| Fuente desactualizada / Requiere verificación | Outdated source / Verification needed |
| Comprobada el [fecha] / Verificación vencida | Checked on [date] / Verification expired |
| Salario no publicado / Precio por confirmar | Salary not published / Price to be confirmed |
| Revisión de dominio registrada el [fecha] | Domain review recorded on [date] |
| Habilitación por confirmar; la residencia no acredita elegibilidad. | Licensing to be confirmed; residence does not establish eligibility. |
| Exposición a IA: con fuente / hipótesis / desconocida | AI exposure: sourced / hypothesis / unknown |
| Contenido de prueba; no describe ofertas ni precios reales. | Test content; it does not describe real vacancies or prices. |
| Crear borrador / Abrir borrador / Añadir elemento | Create draft / Open draft / Add item |
| Borrador / Publicada / Archivada | Draft / Published / Archived |
| Contextos / Fuentes / Roles y rutas / Ofertas / Recursos | Contexts / Sources / Roles and routes / Vacancies / Resources |
| Aún no guardado / Guardando… / Guardado en el borrador | Not saved yet / Saving… / Saved in draft |
| No pudimos guardar. Tus cambios siguen en esta pantalla. | We could not save. Your changes are still on this screen. |
| No pudimos verificar el resultado. Consulta la versión guardada antes de repetir. | We could not verify the result. Check the saved version before repeating. |
| Faltan datos para publicar. | Required data is missing for publication. |
| Revisar publicación / Publicar esta versión | Review publication / Publish this version |
| Esta publicación sustituye el catálogo vigente. Confirma solo después de revisar fuentes y fechas. | This publication replaces the current catalog. Confirm only after reviewing sources and dates. |
| Versión publicada y comprobada. | Version published and verified. |
| Esta versión ya no es editable. Recarga antes de continuar. | This version is no longer editable. Reload before continuing. |
| Quitar elemento / Cancelar | Remove item / Cancel |
| Se quitará del borrador. Las referencias relacionadas deberán revisarse antes de publicar. | This item will be removed from the draft. Related references must be reviewed before publishing. |
| Si sales, perderás los cambios sin guardar. | Leaving will discard unsaved changes. |
| Tu sesión venció. Inicia sesión para continuar. | Your session expired. Sign in to continue. |
| No tienes permiso para administrar el catálogo. | You do not have permission to manage the catalog. |

503 `catalog_unavailable` es estado de catálogo aún no publicado; una red fallida/500 no se convierte en vacío. Un borrador puede guardarse incompleto si el contrato lo admite, pero nunca se presenta como publicable por ello. Edición fallida conserva texto; éxito requiere ACK y lectura del estado. Si falla publicación/retirada de elemento con resultado desconocido, se consulta antes de repetir; sin repetición automática de mutaciones.

## 6. Plan técnico: integración con backend existente

No se crean endpoints, tablas ni migraciones en el tramo UI. Se reutilizan `RouteCatalogs` y `RouteCatalogItems` del PR #33 y sus transacciones/índices; su despliegue es dependencia de integración, no una operación sobre producción hecha por Codex.

| Acción | Contrato real |
| --- | --- |
| Leer catálogo publicado | `GET /api/route-catalog` → `{version,publishedAt,contexts,sources,roles,offers,resources}` |
| Ficha | El GET anterior y búsqueda por `roleKey`; permite resolver todas las referencias en una misma versión. Existe también `GET /api/route-catalog/roles/:roleKey`, sin suponer que trae fuentes fuera de `role.sourceKeys` |
| Versiones admin | `GET /api/admin/route-catalog` → `{catalogs:[...]}` |
| Crear borrador | `POST /api/admin/route-catalog` → descriptor; puede responder `409 draft_exists` con `draftId` |
| Abrir versión | `GET /api/admin/route-catalog/:id` → `{id,version,status,publishedAt,itemCount,items,missing}` |
| Crear/reemplazar elemento | `PUT /api/admin/route-catalog/:id/:kind/:key` → elemento normalizado y `missing`; se envía el objeto completo permitido, sin `itemKey/kind/missing` internos |
| Quitar de borrador | `DELETE /api/admin/route-catalog/:id/:kind/:key` → `{removed:true}` |
| Publicar | `POST /api/admin/route-catalog/:id/publish` → descriptor; después se consulta versión y catálogo publicado |

Cliente tipado con validación de respuestas, lista cerrada de kinds/estados, claves `^[a-z][a-z0-9_]{2,47}$`, longitudes y límites del contrato, fechas calendario válidas/no futuras, referencias explícitas, payloads permitidos y omisión de campos vacíos opcionales. Sin reglas ESLint silenciadas ni cambios de configuración para ocultar fallos.

Errores estables: 400 `invalid_input`, 404 `catalog_not_found/role_not_found`, 409 `draft_exists/catalog_not_editable/catalog_limit/conflict`, 422 `incomplete_catalog/forbidden_label/synthetic_content_not_allowed`, 503 `catalog_unavailable`; 401/403 de auth. `missing` se mapea a etiquetas/enlaces conocidos, sin imprimir HTML ni errores internos. Con 401 se limpia el contenido admin y se ofrece login.

Permisos reales: `verificarToken` para lectura publicada, `verificarAdmin` para escribir/leer borradores; admin/superadmin, no board/therapist/user. No se añaden propietarios ficticios a un catálogo editorial compartido ni endpoints hacia conversaciones/diario/ParticipantContext. Metadatos editoriales existentes (`consultedBy`, `review.by`, `verification.by`, `publishedBy`) se tratan como restringidos al backoffice, no como datos del piloto; no se duplican en logs y no aparecen en fichas de participante.

La API no tiene ETag/revisión de elemento ni requestId para estas mutaciones. La UI bloqueará duplicados en curso, recargará tras conflictos y reconciliará respuestas perdidas; eso **no garantiza** impedir que dos administradores sobrescriban cambios entre lecturas. No se inventa un campo `expectedVersion` ni un bloqueo de servidor. No se promete edición colaborativa; se registra como limitación de contrato para Mauricio, sin modificar el backend ya aprobado.

## 7. Pruebas previstas y condiciones de cierre

1. Unitarias del cliente/modelo/serialización e i18n: campos y referencias cerrados, vacíos frente a cero, preservación de `synthetic`, ES/EN, estados de frescura recibidos, URL segura, error 422 por campo, payload PUT completo y sin metadatos internos.
2. Navegador con fixtures sintéticos del contrato: vacío/no publicado, error/red, filtros, detalle y referencias; versiones, creación de borrador, formularios de los cinco tipos, guardado incompleto, edición/cancelación, publicación rechazada/completa, publicada inmutable, borrar referencia, sesión/rol cambiado, respuesta perdida y navegación con cambios. Accesibilidad/responsive/teclado y capturas.
3. Integración con Express/JWT/PostgreSQL desechables del PR #33, sin tocar backend ni producción: usuario sin rol intenta GET/PUT/DELETE/publish de ID admin y recibe 401/403; manipular localStorage no da acceso; participantes solo leen la publicada, no borrador/archivadas, ni nombres de revisión. Publicar copia/versiona y verifica lectura real; borrador con referencias rotas no publica; cabeceras no-store y JWT revocado. Pruebas de los cinco tipos y marcas de frescura/salario/precio.
4. Ejecutar `npm run lint` (0 errores/0 advertencias), `npm test`, `tsc -b`, build y audit del frontend; registrar salidas reales. Regresión del backend correspondiente en entorno aislado si se integra; no declarar un test con mocks como integración real.
5. No carga de catálogo real ni clic en páginas externas para fingir verificación: corresponde al cliente/especialista/editor aportar y revisar contenido. Ninguna fixture se publica en producción. Sin contenido real, el mecanismo puede ir a QA pero la HU no se declara completa en contenido ni piloto.

## 8. Cambios respecto a hoy y dependencias

Hoy main no tiene catálogo UI ni backend ES-31. Esta propuesta añade fichas y gestor, i18n y dos entradas de navegación; no altera chat, diario, Mi mapa, evidencias, terapeutas, board ni los permisos del backoffice.

Dependencias: Mauricio integra PR #33 tras QA; cliente aporta contextos editoriales y contenido verificable; ES-32 enlaza capacidades/rutas con el Skill Map y valida pertenencia de skill keys. Durante la espera se usan fixtures aprobados y un servidor local del PR; no se apila código backend dentro del PR de interfaz.

Estimación orientativa de interfaz + pruebas: 12–18 horas, sin curación real ni revisión editorial. Es una previsión, no un plazo comprometido, y no está incluida la implementación backend ya realizada por Dev-Claude.

**Solicitud:** aprobar pantallas, flujo, textos y plan descritos antes de escribir frontend. La publicación del diseño no autoriza desplegar, fusionar ni cargar contenido real.
