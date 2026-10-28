# ES-34 · Comparar rutas, experimentar y consultar el plan — diseño para aprobación

28-oct-2026 · [Dev-Codex]. **Fase 1, sin código frontend de implementación.** Alejo autorizó tomar la siguiente HU. Jira ES-34 (SP2-HU15, RF-07/09/10), sin comentarios ni diseño aprobado al revisar. Rama aislada ES-34-rutas-experimento-plan desde main `6dc61e9`. AGENTS.md exige publicar y aprobar este diseño antes de escribir pantallas, flujos, textos o estilos.

Fuentes leídas: ticket, PRD RF-07/09/10/11/16/17, DESIGN-SYSTEM.md, App.tsx, UserDashboard.tsx, ProtectedRoute/LanguageProvider actuales, contratos implementados de ES-32 (PR #43) y ES-33 (PR #44), y skill daisyUI (uso, colores y componentes). No se usa el chat inicial de una rama histórica ni se copia frontend de PR sin fusionar.

## 1. Resultado y límites

Un recorrido ES/EN para expresar restricciones → comparar opciones defendibles → elegir/rechazar → preparar una prueba pequeña → entregar/reflexionar → decidir → aceptar y revisar acciones 7/30/90. Historial y motivos de cambio visibles. Sin radar nuevo, porcentaje de empleabilidad, diagnóstico, promesa de empleo ni botones que acrediten capacidad por completar un curso.

La comparación consume ES-32; experimento/plan/recordatorios consumen ES-33. **No hay endpoints, modelos o migraciones nuevos propuestos en ES-34**: el backend técnico es integrar y verificar esos contratos. Sin acceso nuevo del revisor ni cambios a identidad, consentimiento o preferencias. La plantilla de reflexión de ES-33 está aprobada como neutral/not_domain_validated; no se convierte en rúbrica profesional mediante un cambio de texto.

Las dependencias están abiertas, fuera de main: ES-14 #32 (contexto canónico), ES-32 #43 (rutas), ES-33 #44 (backend preparatorio con lector de contexto/revisión humana pendientes). Por ello propongo aprobar primero una **vista preliminar contra fixtures del contrato**, y no dar por terminada la HU integrada hasta probar el recorrido con API real, permisos y datos curados. No se fusionan PR ajenos ni se apilan sus ramas aquí.

## 2. Pantallas, rutas y navegación

Nuevas rutas propias bajo ProtectedRoute y un contenedor acotado a este recorrido:

| Ruta propuesta | Pantalla |
| --- | --- |
| `/app/next-step` | Inicio profesional: restricciones y comparación, elecciones previas y acceso a experimento/plan |
| `/app/next-step/experiments` | Lista recuperable de pruebas propias, estados y fecha |
| `/app/next-step/experiments/:id` | Prueba, entrega, reflexión, decisión e historial |
| `/app/next-step/plan` | Planes propios y detalle del seleccionado, acciones y versiones |

Una tarjeta/enlace **Mi siguiente paso / My next step** al principio del cuerpo del dashboard, ocupando una fila del ancho disponible antes de sus columnas actuales. No se añaden botones al header fijo que ya está cargado; no se rediseñan chat, check-in, videollamada, pricing, landing, admin, board o terapeuta. La tarjeta solo aparece cuando el recorrido esté habilitado para ese build; sin bandera no deja un hueco ni enlaces muertos.

Cabecera del recorrido: enlace Volver al inicio (ruta existente `/app/dashboard`), marca, selector ES/EN. Navegación por enlaces «Rutas · Experimentos · Plan» con aria-current; indicador de pasos **descriptivo**, sin fingir avance completado. No se exige check-in, ánimo o relato privado para entrar. Enlaces a Mi contexto/Mi mapa/Mis evidencias solo si sus rutas están registradas en la base integrada; mientras falten se explica el estado, sin enlazar a URLs inexistentes ni inventar pantallas sustitutas.

ProtectedRoute actual solo comprueba existencia de token; la UI no lo presenta como autorización de datos. El adaptador real obtiene siempre la autorización del servidor; 401/403 retira datos y controles, y nunca usa un rol o UserId del cliente para autorizar otra cuenta.

## 3. Wireframes de layout (diagrama, no implementación)

### A. Rutas — escritorio

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Saltar al contenido (visible al foco)                                │
│ ← Volver al inicio          ELEVATION                        ES | EN │
│ Mi siguiente paso                                                   │
│ Rutas [actual]     Experimentos     Plan                             │
├─────────────────────────────────────────────────────────────────────┤
│ [Aviso de vista preliminar con datos sintéticos, si corresponde]      │
│ 1. Tus restricciones                                                │
│ Mercado(s) · Idiomas de trabajo · Modalidades · Profesión regulada    │
│ Contexto de origen (opcional) · Intereses · Preferencia de modalidad │
│ [Guardar restricciones]     Estado confirmado / borrador             │
├─────────────────────────────────────────────────────────────────────┤
│ 2. Opciones que puedes explorar       [Actualizar desde servidor]    │
│ ┌ Continuidad ─────────┐ ┌ Adyacencia ───────┐ ┌ Exploración ───────┐│
│ │ Rol · mercado       │ │ Rol · mercado     │ │ Rol · mercado      ││
│ │ Preferencias        │ │ Preferencias      │ │ Preferencias       ││
│ │ Transferencia       │ │ Transferencia     │ │ Transferencia      ││
│ │ Viabilidad          │ │ Viabilidad        │ │ Viabilidad         ││
│ │ Aún sin evidencia   │ │ Límites           │ │ Límite explícito   ││
│ │ [Fuentes y detalles]│ │ [Fuentes...]       │ │ [Fuentes...]       ││
│ │ [Elegir] [Rechazar] │ │ [Elegir][Rechazar] │ │ [Elegir][Rechazar] ││
│ └─────────────────────┘ └───────────────────┘ └────────────────────┘│
│ Una o dos fichas si falta fundamento. No rellenar casillas.           │
│ [Solicitar revisión de opciones]   Historial de decisiones           │
└─────────────────────────────────────────────────────────────────────┘
```

Las dimensiones se alinean en el mismo orden, sin barras/porcentajes ni clasificación entre personas. Detalles desplegables con tareas, exposición IA marcada fuente/hipótesis/desconocida, requisitos, barreras, habilitación pendiente, fuentes/fechas, ofertas current/expired y recursos pertinentes. Oferta vencida no aparece como oportunidad actual; sin oferta vigente se rotula «Ficha ocupacional».

### B. Experimento y plan — escritorio

```text
┌ ← Rutas / Lista de experimentos ────────────────────────────────────┐
│ Experimento · versión N        Fundamento actual / Necesita revisión│
│ Ruta elegida · Pregunta · Tarea del catálogo                         │
│ 20 / 30 / 45 minutos · Costo por confirmar · Criterios y límites      │
│ Propuesta: [Revisar y aceptar]        Guardado: [Iniciar]             │
├────────────────────────────────────────────────────────────────────┤
│ Entrega: muestra escrita o referencias profesionales autorizadas     │
│ Ayuda utilizada: sin preselección        [Guardar entrega]           │
│ Observación [texto]              Interpretación [texto]              │
│ [Guardar mi reflexión]                                              │
│ Revisión humana: pendiente de autorización, sin material compartido │
│ [Solicitar] / [Retirar solicitud]                                    │
│ Decisión [Continuar/Ajustar/Pausar/Descartar] · Razón [texto]          │
│ [Guardar decisión]    [Proponer plan]    [Ver versiones]              │
└────────────────────────────────────────────────────────────────────┘

┌ Plan · propuesta / aceptado / necesita revisión ───────────────────┐
│ Disponibilidad y zona horaria: snapshot canónico confirmado          │
│ 7 días: propósito, esfuerzo, dependencia, evidencia esperada          │
│ 30 días: ...       Recursos: idioma/tiempo/precio/fuente/ejercicio    │
│ 90 días: ...                                                        │
│ [ ] Aceptar acción · Fecha elegida · Tiempo · Costo declarado         │
│ [ ] Recordatorio dentro de app (consentimiento separado)             │
│ [Revisar selección] → resumen exacto → [Confirmar plan]               │
│ Plan guardado: [Registrar finalización] con evidencia, [Pausar]      │
│ Recordatorios pendientes: [Acusar recibo] [Cancelar]                 │
│ Historial: versión/motivo/fecha; ninguna anterior se reactiva sola    │
└────────────────────────────────────────────────────────────────────┘
```

El presupuesto opcional no es un precio sugerido: moneda/cantidad declaradas, sin conversión automática. Si se exige presupuesto, costo desconocido/moneda incompatible bloquean la aceptación según el servidor. Una acción no queda completada por marcar selección: registrar finalización exige texto de evidencia y dependencias; sigue siendo autorreporte y no modifica niveles del mapa.

### C. Móvil

```text
← Inicio              ES EN
Mi siguiente paso
Rutas / Experimentos / Plan (envuelven a otra línea)
Aviso de datos sintéticos, si aplica
[Restricciones desplegables]
[Guardar restricciones]
[Ficha continuidad, ancho completo]
[Ficha adyacencia, si existe]
[Ficha exploración, si existe]
[Historial / solicitud]
```

Formulario, muestra, reflexión y acciones en una columna, sin panel lateral fijo. Botones envuelven y conservan etiquetas completas. Nada sticky tapa campos o foco. No hay tabla comparativa que obligue a scroll horizontal para elegir. El orden de lectura conserva restricciones → razones/límites → decisión.

## 4. Componentes y tokens

Reutilizar LanguageProvider/useLanguage, ProtectedRoute y BrowserRouter; mismo token de sesión existente, sin otro login/perfil. Catálogos ES/EN bajo claves `career.*` para UI; contenido profesional desde DTOs bilingües del backend, datos originales del usuario sin traducción inventada.

daisyUI 5 ya instalado: cards para fichas/acciones, fieldset+legend para grupos, select/checkbox/radio nativos con label, input/textarea, button, badge textual, alert y loading. Detalles con summary/details accesibles. Antes de usar clases nuevas se leen sus guías; solo ampliar include de los módulos requeridos, con prefijo elv- existente. Variables/estilos bajo `.career-scope`, sin cambiar temas por defecto de landing ni reglas globales del dashboard. Ningún modal depende de una librería nueva.

Tokens internos del DS: fondo cálido #F9F9F7, superficie #FAF8F4, tinta #1C1917, bordes #E7E5E4/#D6D2C4, fondo suave verde #EAF0E6; espaciado 4/8/12/16/24/32 px; radios 12/16 px. Inter 16 px para cuerpo/etiquetas; Playfair Display 400 para títulos, sin bold. Botones y controles ≥44 px. Para texto/foco y CTA sólido propongo verde oscuro #4A6741 (variante accesible del oliva), secundario #57534E; no usar texto pequeño gris tenue del dashboard como referencia accesible. Error #7A3030 y advertencia #92400E, con mensaje/icono además del color.

Semántica local daisyUI base-*/primary/error/warning. Una acción primaria por bloque, controles secundarios outline/ghost. Tema oscuro local equivalente, con superficies oscuras y texto claro; respetar preferencia del sistema. Sin nueva preferencia persistida de tema. Contraste medido antes de entregar (≥4,5:1 en texto normal y ≥3:1 en controles/foco); los valores oscuros definitivos se verifican en implementación, sin afirmar contraste ya comprobado.

Piezas nuevas propuestas: CareerShell, ConstraintsForm, RouteCard, RouteDetails, DecisionHistory, ExperimentEditor, ReflectionForm, ReviewRequestState, PlanPreview, PlanActionCard, VersionNotice y ReminderList. Son componentes del recorrido, no otro design system ni una capa nueva de autorización.

## 5. Flujo y confirmaciones

1. Cargar restricciones, catálogo, rutas, elecciones e índices de experimentos/planes propios. No consultar chat/diario/ánimo; no exigir historia personal.
2. Declarar restricciones estructuradas: mercados obligatorios (1–3), idiomas/modalidades (vacío explícito = por confirmar), regulación yes/no/unknown, origen nullable e intereses opcionales desde el catálogo. Sin preseleccionar profesión o elegibilidad por residencia. Guardar con baseVersion/requestId y recuperar el estado confirmado.
3. Elegir o rechazar en una ficha envía roleKey/slot/basisHash de su propuesta actual. No se presenta la elección como empleo obtenido. Botón «Preparar experimento» solo tras comprobar elección accepted/current/sin basisChanged; una respuesta perdida exige recuperación antes de avanzar.
4. Proponer prueba: tarea existente y 20/30/45 minutos, revisar pregunta/costo/criterios/límites y aceptar contenido exacto. No crear experimento al abrir una ficha ni aceptar una propuesta vencida. Horas/fechas de coordinación externa no se inventan.
5. Iniciar/entregar: muestra directa y/o referencias profesionales propias vigentes; selección explícita desde API de evidencia solo si el contrato está disponible. Sin carga de archivos, pegar turnos privados automáticamente o fichas ajenas. Ayuda declarada obligatoria sin opción preseleccionada. Estado «entrega guardada» solo tras confirmar versión del servidor.
6. Reflexión: observación e interpretación separadas, ambas de autorreporte. Solicitud humana con versión/materiales exactos, aviso «sin compartir todavía», retirada accesible. Ningún nombre de revisor o feedback supuesto; la falta de permiso humano no se disfraza de revisión realizada.
7. Decidir con razón escrita; continue/adjust propone plan, pause/discard no lo fuerza. Cargar propuestas y planes persistidos desde API, nunca generarlos en frontend.
8. Seleccionar acciones y fechas sin marcar todo por defecto; revisar disponibilidad/dependencias/duración/precio y confirmar resumen exacto. Mostrar los minutos del recurso incluidos en la acción, no duplicados. Dependencias omitidas, fechas anteriores o costo no confirmado llevan al campo correspondiente; no corregir silenciosamente la propuesta del servidor.
9. Registrar evidencia de finalización por acción; mostrar self_report. Recordatorios opt-in y notifications por contrato existente, sin activar permiso por marcar una acción. GET no consume, acuse explícito/cancelación/historial. Informar que solo se presentan dentro de la app, sin email/push ni garantía en segundo plano.
10. Reanudar desde IDs propios recuperados; historial con versión/base/motivo. Needs_review bloquea nuevas aceptaciones y permite lectura, pausa/retirada y rebase explícito del servidor. Rebase no copia una entrega vieja como logro nuevo.

## 6. Estados de interfaz y recuperación

| Estado | Presentación y acción |
| --- | --- |
| Inicial/cargando | Título y estado aria-live; esqueletos discretos, sin datos o decisiones inventados |
| Sin restricciones | Explicación y formulario, no «sin habilidades» ni rutas por defecto |
| Sin catálogo / API ausente / contrato pendiente | Aviso específico y reintento de lectura; no reemplazar por ejemplos como si fueran resultados reales |
| Sin rutas pertinentes | Explicar límites, cambiar restricciones o solicitar revisión; no fabricar una tercera opción |
| Una/dos rutas | Comparación con esas fichas; faltantes sin tarjetas vacías de «déficit» |
| Sin experimentos/planes | Explicar siguiente paso disponible, nunca asumir vacío si falló GET |
| Editando sin guardar | Borrador local identificado; guardia de salida/cancelación; datos solo en memoria |
| Guardando | Botón deshabilitado y estado con nombre; no marcar completado o persistido |
| Guardado confirmado | Versión/fecha devueltas y mensaje de éxito correspondiente |
| Respuesta perdida | «No pudimos comprobar si se guardó» + recuperar estado; no reintentar POST automáticamente |
| 409/base cambiada/token vencido | Aviso y recuperar/revisar propuesta; no sustituir el borrador ni reactivar una versión antigua |
| 400/422 | Errores por campo/concepto, resumen con foco y texto original preservado |
| 401/403/cambio de sesión | Retirar resultados/controles y borradores; volver a acceso, sin mostrar datos a otra cuenta |
| Revisión humana pendiente | Estado de solicitud/versión/materiales; no compartida, sin feedback ni revisor ficticio |
| Horario ambiguo/no existente | Pedir otra hora, sin convertirla por su cuenta |
| Éxito en vista fixture | «Guardado solo en esta simulación», nunca «Guardado en tu cuenta» |

Repetir requestId después de un resultado incierto conserva su cuerpo exacto; si cambia el borrador es una intención nueva, tras reconciliar el intento previo. Lecturas atrasadas se ignoran con AbortController/generación asociada a sesión/recurso. Cambiar idioma no altera el contenido del borrador ni lo guarda. Sin persistir muestras, razones, decisiones, restricciones o planes en localStorage/sessionStorage/URL/logs. Se conserva únicamente el almacenamiento de idioma/token ya existente.

## 7. Textos ES/EN propuestos

Las siguientes etiquetas/mensajes se publican para aprobación de diseño. Estados adicionales de contrato se mapean a claves ES/EN, con fallback bilingüe completo para código desconocido, nunca la clave cruda. No traducir de forma inventada texto original del participante ni idioma de ofertas/cursos.

| ES | EN |
| --- | --- |
| Mi siguiente paso | My next step |
| Saltar al contenido | Skip to content |
| Volver al inicio | Back to dashboard |
| Rutas · Experimentos · Plan | Routes · Experiments · Plan |
| Tus restricciones | Your constraints |
| Mercado objetivo · Idiomas de trabajo · Modalidades | Target market · Working languages · Work arrangements |
| Presencial · Híbrida · Remota | On-site · Hybrid · Remote |
| ¿Consideras profesiones reguladas? Sí / No / Por confirmar | Would you consider regulated professions? Yes / No / To confirm |
| Contexto de origen (opcional) · Contextos de interés · Modalidades preferidas | Starting context (optional) · Contexts of interest · Preferred arrangements |
| Sin especificar · Por confirmar | Not specified · To confirm |
| Guardar restricciones · Restricciones guardadas | Save constraints · Constraints saved |
| Continuidad · Adyacencia · Exploración | Continuity · Adjacency · Exploration |
| Preferencias · Transferencia sustentada · Viabilidad | Preferences · Evidence-supported transfer · Feasibility |
| Coincide · Coincide en parte · Fuera de los intereses declarados · Sin confirmar | Matches · Partially matches · Outside stated interests · Unconfirmed |
| Evidencia suficiente según estas reglas · Transferencia parcial · Aún sin evidencia | Supported under these rules · Partial transfer · No evidence yet |
| Factores claros · Condicionada · Incierta | Clear factors · Conditional · Unclear |
| Autorreporte · Revisión · Ayuda declarada | Self-report · Review · Reported assistance |
| Habilitación pendiente de verificar | Professional authorization pending verification |
| Ficha ocupacional · Oferta verificada según el catálogo · Oferta vencida | Occupational profile · Listing verified under catalog policy · Expired listing |
| Fuentes y fechas · Ver detalles · Ocultar detalles | Sources and dates · Show details · Hide details |
| Fuente desactualizada · Hipótesis · Dato desconocido | Outdated source · Hypothesis · Unknown |
| Salario no publicado · Precio por confirmar · Costo por confirmar | Salary not published · Price to confirm · Cost to confirm |
| Elegir esta ruta · Rechazar esta ruta · Preparar experimento | Choose this route · Reject this route · Prepare experiment |
| Esta elección no garantiza contratación ni habilitación | This choice does not guarantee employment or professional authorization |
| No hay opciones pertinentes con el catálogo actual | The current catalog does not support relevant options |
| Solicitar revisión · Retirar solicitud · Material aún no compartido | Request review · Withdraw request · Material not shared yet |
| Experimento · Pregunta · Tarea · Criterios y límites | Experiment · Question · Task · Criteria and limits |
| Revisar y aceptar · Iniciar · Guardar entrega | Review and accept · Start · Save submission |
| Muestra escrita · Evidencias profesionales seleccionadas | Written sample · Selected professional evidence |
| Ayuda utilizada: ninguna / planificación / redacción / sustancial / no lo sé | Assistance used: none / planning / drafting / substantial / unknown |
| Observación · Interpretación · Guardar mi reflexión | Observation · Interpretation · Save my reflection |
| Tu reflexión es un autorreporte, no una revisión profesional | Your reflection is self-reported, not a professional review |
| Revisión humana pendiente de autorización | Human review awaiting authorization |
| Continuar · Ajustar · Pausar · Descartar | Continue · Adjust · Pause · Discard |
| Razón de tu decisión · Guardar decisión · Proponer plan | Reason for your decision · Save decision · Propose plan |
| Propuesta sin aceptar · Plan aceptado · Historial de versiones | Unaccepted proposal · Accepted plan · Version history |
| Disponibilidad confirmada · Zona horaria · Necesita revisión | Confirmed availability · Time zone · Needs review |
| Propósito · Esfuerzo · Dependencias · Evidencia de finalización | Purpose · Effort · Dependencies · Completion evidence |
| Fecha elegida · Recursos · Duración · Idioma · Precio · Ejercicio | Chosen date · Resources · Duration · Language · Price · Exercise |
| Presupuesto opcional · Moneda · Costo total declarado | Optional budget · Currency · Reported total cost |
| Revisar selección · Confirmar plan · Registrar finalización | Review selection · Confirm plan · Record completion |
| Completar una acción no acredita capacidad por sí solo | Completing an action does not establish capability by itself |
| Recordatorio dentro de la app · Hora elegida · Acusar recibo · Cancelar | In-app reminder · Chosen time · Acknowledge · Cancel |
| No enviamos email ni push; se muestra al abrir esta sección | No email or push is sent; it appears when you open this section |
| Ver versión anterior · Revisar fundamento y empezar otra versión | View previous version · Review the basis and start a new version |
| Guardando… · Guardado confirmado · Cambios sin guardar | Saving… · Save confirmed · Unsaved changes |
| No pudimos comprobar si se guardó. Recupera el estado antes de repetir. | We could not verify whether it was saved. Retrieve the state before retrying. |
| Salir sin guardar · Seguir editando · Reintentar lectura | Leave without saving · Keep editing · Retry loading |
| El servicio aún no está disponible; no hay un resultado confirmado | The service is not available yet; there is no confirmed result |
| Vista preliminar con datos sintéticos. Los cambios no se guardan en tu cuenta. | Preview with synthetic data. Changes are not saved to your account. |
| Guardado solo en esta simulación | Saved only in this simulation |

Texto de la plantilla de experimento y rúbrica neutral: usar exactamente el ES/EN aprobado en ES-33 10260/10261, conservando not_domain_validated y el límite de que no acredita competencia/autonomía/habilitación. No redactar un nuevo feedback profesional en frontend.

## 8. Responsive, teclado y accesibilidad

320/375 px: una columna, formularios agrupados y controles que envuelven; 768 px: una/dos fichas según espacio; ≥1100 px: hasta tres fichas comparables dentro de 1100 px de ancho máximo. Texto 16 px, zoom 200 %, sin scroll horizontal a 320. Etiquetas largas EN visibles, recursos/URLs con salto de línea y dominio legible. Inputs date/datetime-local con descripción del formato y zona; no prometer traducción del selector nativo ajena al navegador.

Primer Tab al enlace de salto; encabezados semánticos y main con foco programático. Fieldset/legend/label, radios de grupo con flechas nativas, checkbox sin preselección indebida, detalles por Enter/Espacio y aria-expanded cuando aplique. aria-live para carga/confirmación y resumen de errores sin repetir todos los campos. El foco regresa al control que abrió la confirmación; Escape cancela sin mutar. Diálogo de salida por cambios sin guardar con dos decisiones explícitas. Guardar no mueve el foco de forma sorpresiva; al navegar se anuncia el título/estado.

prefers-reduced-motion: sin desplazamientos ni animaciones de progreso; loading textual estático si hace falta. Estados reconocibles sin depender del color. Tema claro/oscuro local, contraste medido antes de QA. No aumentar el nivel por confianza/satisfacción declarada ni animar una puntuación inexistente.

## 9. Integración técnica y pruebas

Adaptadores tipados por dominio (routes, experiments, plans, reminders) con parsers de respuestas/estados cerrados, fuente idioma ES/EN y fechas del servidor. Se reutilizan los contratos publicados en PR #43 y #44; no se generan rutas/planes en el cliente ni se duplican validaciones de permisos como autorización efectiva.

ES-32: GET/PUT /api/routes/constraints, GET /api/routes y /choices, POST /choices y /review-requests; catálogo público autenticado para contextos. ES-33: propuestas/confirmación/versiones/listados propios de experiments/career-plan/reminders. Evidencia: solo API propia existente, sin IDs inventados ni referencias privadas. Consentimiento notifications: lectura/decisión canónicas de ES-19, aceptación explícita aparte; no ampliar propósitos o scopes. No cambiar helper de contexto ni inventar disponibilidad para evitar 503.

**Vista fixture propuesta:** bandera de build `VITE_ENABLE_CAREER_PREVIEW=true`, desactivada por defecto. Modo de datos fijado en el build, sin selector de runtime para pasar una simulación a API real. Fixture aislado en memoria, rotulado en cada pantalla, cero escrituras a API/almacenamiento/cuenta; recarga/cambio de sesión descarta la simulación. Sin bandera no se muestra entrada ni controles de preview. La implementación del transporte real puede prepararse, pero no habilitarse hasta integrar/probar los contratos reales en un paso posterior registrado. Una respuesta real 503/404 nunca activa fixtures como fallback silencioso.

Verificación posterior a aprobación:

- Parsers, i18n completa, validaciones y estados 401/403/409/422/503 con fixtures del contrato. Cancelación/red/respuesta perdida, idempotencia y reconexión sin anunciar guardado no confirmado.
- Navegador de la app compilada: ES/EN completo, 320/375/768/1440, 200 %, claro/oscuro, foco/Tab/flechas/Escape, salto al contenido, salida/Atrás, reduced-motion, todo el circuito desde restricciones hasta plan/acuse con datos sintéticos rotulados. Confirmar cero escrituras reales en preview y defecto apagado.
- Desconocidos, una/dos rutas, costo/salario no publicado, regulación pendiente, fuentes/ofertas vencidas, no catálogo; muestra/reflexión/ayuda obligatoria; plan sin acciones preaceptadas, presupuesto/DST/dependencias, cambios de versión y retirada.
- Permisos de frontend: no mostrar datos ante cambio de sesión/401/403; jamás tratar la prueba del navegador con mocks como aislamiento del backend. Integración real posterior con Express/JWT/PG y dueños A/B de ES-32/33, solicitud con IDs ajenos/huella ajena 404/409 y roles no autorizados 403. Estos endpoints ya tienen pruebas propias; falta demostrar este consumidor integrado.
- Frontend lint exit 0 sin advertencias, npm test, tsc -b, build y audit con salida real. No relajar ESLint ni inventar checks/verificación de producción. Comparación antes/después del dashboard: solo tarjeta nueva; chat/ánimo/terapeuta/backoffice sin cambios.
- PR con resumen, casillas de criterios del tramo, pruebas reales y mocks/pendientes explícitos; Jira En QA solo del tramo entregado. No fusionar ni cerrar hilos QA.

## 10. OBJECIONES, estimación y decisiones

**OBJECIÓN — dependencias y aceptación integrada.** ES-32/33 siguen en QA y ES-33 tiene contratos aún ausentes. La UI no puede cerrarlos simulando resultados. Recomendación: aprobar diseño y vista preliminar, desactivada por defecto, contra fixtures explícitos; integrar cuando Mauricio fusione/autorice los contratos. No cerrar ES-34 integral ni habilitar piloto con esa vista. El recorrido real termina con un estado honesto si falta contrato, no con un resultado ficticio.

**OBJECIÓN — “costo conocido” del ticket.** El contrato actual de experimento ES-33 devuelve cost:unknown; la UI no puede convertirlo en gratuito/conocido ni editarlo sin endpoint. Propongo mostrar «Costo por confirmar» y conservar ese criterio pendiente en el tramo preparatorio. Si el PO exige costo conocido para iniciar la prueba, se necesita definir/ampliar primero el contrato backend de costos y volver a evaluar ese flujo. Presupuesto/recursos del plan ya distinguen datos declarados y precio publicado; no resuelven por sí solos el costo inicial del experimento.

**OBJECIÓN — revisión humana.** ES-33 solo acepta solicitudes propias pending_authorization/shared:false. El diseño muestra ese estado y permite retirar; no inventa feedback/revisor ni habilita terceros. Revisión real/retención depende del contrato de Mauricio y consola ES-35; una reflexión self_report no cubre ese criterio integrado.

Estimación revisada: **20–30 h** para formularios/comparación/ciclo de experimento/plan/versiones/recordatorios, ES/EN, accesibilidad y navegador; depende de estabilidad de contratos. Las 10 h (8–12) del ticket no cubren de forma defendible el circuito completo y estas pruebas; no es una promesa de fecha ni horas ya ejecutadas. Integración real y revisión humana pueden cambiar esfuerzo/plazo; no se promete el corte vencido del 27-oct.

**Aprobar antes de implementar:** pantallas/flujo/wireframes/tokens/componentes y textos de este documento; tarjeta de entrada al dashboard; preview fixture opt-in y cero escrituras reales; desconocidos y revisión humana pendientes; estimación revisada. Resolver expresamente el criterio de costo desconocido. Si cambia el diseño durante implementación, se vuelve a presentar; sin aprobación no se escribe frontend.

## 11. Aprobación y entrega preliminar

Respuesta explícita en el chat: «Aprobar diseño y vista preliminar propuesta». Para costos, el usuario delegó «La que me recomiendes»; se aplicó mostrar «Costo por confirmar» dejando ese criterio integral pendiente. Registro en Jira 10265. No se presume aprobación especializada, costo conocido, revisión humana autorizada ni integración real. Implementación/verificación del tramo preliminar: documento 42. ES-34 integrada continúa pendiente.
