# ES-73 · D-01: textos y prestaciones para aprobar

**Propuesta de [Dev-Codex], 28-oct-2026. No aprobada para publicación.**
Base revisada: `main` `13a0f9f75e08f6d5cc8b5291d7f0637d34cd953f`.
Alejo confirmó que no existe una revisión previa de D-01 y solicitó ayuda para prepararla.

Este documento propone textos ES/EN, identifica qué falta verificar y deja preparado el procedimiento para corregir el catálogo desde el gestor existente. No cambia precios, slugs, límites, datos de producción ni prestaciones contratadas. Los valores públicos finales se leen de `GET /api/plans`; el seed del repositorio no demuestra qué contiene hoy producción.

## 1. Hallazgos que condicionan la publicación

| Evidencia del repositorio | Consecuencia |
| --- | --- |
| `backend/routes/pricing.js`, seed de Plus: «proceso terapéutico consistente» / «consistent therapeutic process» | Cambiar esa descripción: el asistente se presenta como acompañamiento no clínico |
| El seed contiene cuotas de mensajes y sesiones con terapeuta; Pro dice «ilimitado» | No anunciar estas prestaciones como verificadas únicamente por estar escritas en el seed |
| `backend/utils/planLimits.js` declara cuotas; la búsqueda de getLimits/withinLimit solo encuentra el lector de metadatos de `routes/plans.js` | No se ha verificado aplicación de esos límites por plan en chat, matching o sesiones; no se propone modificarla dentro de ES-73 |
| Chat usa `utils/aiClient.js` y el presupuesto de `utils/aiBudget.js` | Hay límites operativos de IA diferentes de las cuotas comerciales; no es correcto prometer uso sin límites |
| `routes/sessions.js` devuelve una URL mock cuando falta configuración de Daily | La integración en código no demuestra que videollamadas o sesiones ofrecidas estén operativas en producción |
| `frontend/src/pages/PricingPage.tsx` usa «MÁS POPULAR» y promete activación próxima después de solicitar | Cambiar por «Destacado» y una confirmación de solicitud en revisión, sin inventar popularidad ni activación |
| `frontend/src/pages/admin/AdminContent.tsx` ya edita nombres, descripciones y funciones vía `/api/admin/pricing` | No hace falta ampliar el backoffice; un operador autorizado podrá aplicar lo aprobado |

## 2. Descripciones conservadoras propuestas

Los nombres son referencias de los slugs existentes; la interfaz muestra los nombres que devuelva el backend, no estos nombres escritos en código.

| Slug | Referencia | Descripción ES | Description EN |
| --- | --- | --- | --- |
| basic | Básico / Basic | Una forma de comenzar con la conversación y la reflexión en Elevation. | A way to start with conversation and reflection in Elevation. |
| essential | Esencial / Essential | Un espacio de acompañamiento no clínico con las funciones indicadas en este plan. | A space for non-clinical support with the features listed in this plan. |
| plus | Plus | Para dar continuidad a tu espacio de conversación y reflexión. | To continue your space for conversation and reflection. |
| pro | Pro | Una opción de uso de Elevation con las condiciones indicadas en este plan. | An option for using Elevation under the conditions listed in this plan. |

Estos textos no prometen resultados emocionales, tratamiento, empleo, atención inmediata, sesiones disponibles ni capacidad adicional no demostrada. Tampoco sustituyen la definición comercial: por sí solos no justifican diferencias de precio.

## 3. Funciones: borrador y verificación necesaria

Propuesta de formulación común, **solo tras verificar habilitación real**:

| ES | EN | Fuente y condición |
| --- | --- | --- |
| Conversación con un asistente de IA no clínico, sujeta a los límites operativos vigentes. | Conversation with a non-clinical AI assistant, subject to current operational limits. | Chat y presupuesto IA; confirmar configuración y acceso en el entorno que se publica |
| Registro de ánimo de entrada y salida. | Mood check-in and check-out. | Rutas y pantallas existentes; verificar el recorrido real |

No se recomienda publicar cuatro planes de pago como si ofrecieran beneficios diferentes cuando esos beneficios todavía no estén verificados. Los textos anteriores son un borrador conservador para revisar la interfaz y el catálogo, no una oferta comercial aprobada.

| Prestación anterior | Recomendación para D-01 | Qué permite anunciarla |
| --- | --- | --- |
| 10/30/100 mensajes por día | Retirar temporalmente de la lista publicable | Contrato de cuota y evidencia de aplicación por plan en servidor |
| Mensajes ilimitados | No publicar «ilimitado» | Definición comercial coherente con presupuesto IA y condiciones operativas; sin una garantía de uso infinito |
| 1/4/sesiones ilimitadas con terapeuta por mes | No publicar como incluido todavía | Capacidad del servicio, condiciones profesionales y acceso/asignación/validación verificados; separar al profesional del asistente no clínico |
| Matching prioritario/VIP, soporte prioritario | No presentarlo como prestación confirmada | Proceso y criterio de prioridad realmente operativos |
| Progreso o recomendaciones «básicas/completas» | Especificar qué existe antes de diferenciarlo por precio | Contrato de acceso por plan y pruebas funcionales |
| Funciones del Skill Map dentro de un plan | Omitir por ahora | Definición explícita del PO; no se infiere por el nombre del plan |

## 4. Textos comunes de la interfaz

Son propuesta para aprobar junto con el flujo del plan técnico; los textos que ya existen en el diseño se conservan.

| Uso | ES | EN |
| --- | --- | --- |
| Título aprobado | Elige cómo quieres acompañarte | Choose how you want to be supported |
| Subtítulo aprobado, solo si hay precio 0 | Empieza sin costo y cambia de plan cuando lo necesites. | Start at no cost and change plans whenever you need. |
| Precio 0 | Gratis | Free |
| Destacado | Destacado | Featured |
| CTA anónimo aprobado | Crear cuenta y solicitar este plan | Create an account and request this plan |
| CTA autenticado aprobado | Solicitar este plan | Request this plan |
| Nota aprobada | Los planes de pago pasan por la aprobación de un administrador. | Paid plans go through administrator approval. |
| Carga | Cargando planes… | Loading plans… |
| Fallo de carga | No se pudieron cargar los planes. Inténtalo de nuevo. | Plans could not be loaded. Please try again. |
| Reintento | Reintentar | Try again |
| Vacío aprobado | Pronto publicaremos los planes. | We will publish the plans soon. |
| Selección tras registro | Revisa el plan seleccionado antes de enviar tu solicitud. | Review the selected plan before submitting your request. |
| Plan retirado | El plan seleccionado ya no está disponible. Revisa las opciones actuales. | The selected plan is no longer available. Review the current options. |
| Enviando | Enviando solicitud… | Submitting request… |
| Confirmación 201 verificada | Tu solicitud quedó registrada y está en revisión. El plan aún no está activado. | Your request was recorded and is under review. The plan is not active yet. |
| Solicitud existente | Ya tienes una solicitud en revisión. | You already have a request under review. |
| Resultado de envío desconocido | No pudimos confirmar el resultado. Comprueba el estado antes de volver a solicitarlo. | We could not confirm the result. Check its status before requesting again. |
| Comprobar estado | Comprobar estado | Check status |
| Volver al espacio | Continuar a mi espacio | Continue to my space |
| Periodos | / mes · / año · pago único | / month · / year · one-time |

«Pago único» solo se usaría si el contrato confirma que `period=forever` significa eso; no se presume. Hasta confirmarlo, la implementación debe tratar un periodo no reconocido como datos no disponibles, nunca inventar una duración o recurrencia. No habrá caja de tarjeta, cobro ni promesa de activación automática.

## 5. Decisiones concretas para tener D-01 listo

1. Alejo/Mauricio revisan las cuatro descripciones y los textos comunes. Aprobarlos permite implementar y probar la interfaz; no convierte las prestaciones pendientes en disponibles.
2. PO y Mauricio definen qué diferencia realmente los planes y qué prestaciones se pueden entregar, especialmente cuotas, sesiones profesionales y prioridad. Si requiere aplicar límites, se define el trabajo específico sin cambiar `planLimits.js` dentro de ES-73.
3. Un operador autorizado consulta los datos reales del entorno y aplica desde Admin → Contenido → Precios únicamente nombres/descripciones/funciones aprobados. No ejecutar seed ni editar importes, monedas, periodos, slugs o límites para resolver D-01.
4. QA comprueba ES/EN, datos reales, solicitud y aprobación administrativa, y la coherencia de lo anunciado. No basta una captura con fixtures.
5. Solo después se habilita la publicación del catálogo en la landing. Durante desarrollo permanece desactivada por defecto.

**Recomendación:** implementar y probar el tramo técnico con publicación desactivada mientras se resuelven las prestaciones. No activar cobros ni promocionar planes con beneficios no verificados.
