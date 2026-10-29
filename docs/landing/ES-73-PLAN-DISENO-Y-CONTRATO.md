# ES-73 — Diseño y plan técnico para aprobación

[Dev-Codex] · 28-oct-2026 · Base main `13a0f9f75e08f6d5cc8b5291d7f0637d34cd953f`.
Rama aislada `ES-73-planes-publicos`. No hay código de implementación escrito.

## Aprobación existente y ampliación necesaria

S12 de la landing tiene diseño aprobado en ES-60/10279 y ES-73/10285. Los 84 frames se revisaron en ES-68/10304; S12 y sus estados corresponden a 37–40 y 65–68. Fuente única de textos: `origin/docs/landing-diseno-fase2:docs/landing/TEXTOS-LANDING-FASE2-ES-EN.md`.

Se presenta para aprobación el detalle nuevo de continuación después de crear cuenta y la actualización de la página pública `/pricing`, además del plan técnico del backend. AGENTS.md exige aprobación del diseño al cambiar pantallas/flujos y del plan técnico antes de implementar. No se vuelve a pedir aprobación del diseño general de S12.

## Pantallas, flujo y wireframe

```text
LANDING: S12 #planes (antes de S13)
  12 · Planes
  Elige cómo quieres acompañarte
  [subtítulo solo si un plan real tiene precio 0]
  [plan API] [plan API destacado] [plan API] …
  nombre / descripción / importe+moneda+periodo / funciones
  [Crear cuenta y solicitar…] o [Solicitar este plan]
  nota de aprobación administrativa

SIN SESIÓN
  tarjeta → /login?mode=register&plan=ID
  registro 201 → confirmación + formulario de ingreso, conserva solo plan=ID
  ingreso y sesión verificados → /pricing?plan=ID
  relectura de planes → selección actual visible → [Solicitar este plan]
  NO se envía un POST al registrarse o ingresar

CON SESIÓN
  verificación existente → lectura de solicitud pendiente
  [Solicitar este plan] → POST propietario → [registrada, en revisión]
  [Continuar a mi espacio] → destino por rol/contexto existente

/pricing
  cabecera ES/EN / inicio / ingreso o espacio verificado
  mismo lector y tarjetas de S12; fila de revisión del plan seleccionado
  carga / error+reintento / vacío / plan retirado
  envío / confirmación / pendiente existente / resultado desconocido
```

La página `/pricing` conserva su función pública de elegir y solicitar planes; reutiliza S12 para eliminar diferencias entre los dos catálogos. No se modifican `/app/*`, `/therapist/*`, chat o backoffice. El enlace «Planes» se activa en la cabecera solo cuando S12 existe y está habilitada. Las anclas de secciones desde `/pricing` apuntarán al inicio real, no a IDs ausentes de esa página.

### Continuación del plan sin rediseñar identidad

`plan` admite solo un entero positivo seguro. Es un identificador de catálogo público, no una orden de compra ni un ID de persona. Se conserva únicamente en la URL durante el flujo; no se añade almacenamiento de la puerta ni una nueva clave de sesión. No se acepta `returnTo`, URL externa ni destino arbitrario.

Login mantiene la verificación de ES-74 y `ParticipantContext` de ES-14. Solo con sesión verificada y `plan` válido usa el destino fijo `/pricing?plan=ID`; sin intención de plan conserva sus destinos actuales. Crear cuenta sigue sin autenticar automáticamente. Una vez revisada/enviada la solicitud, «Continuar a mi espacio» usa el destino canónico existente, incluido onboarding si está pendiente: no se marca como completado ni se cambia su contenido.

Los helpers de Mauricio se usan, no se modifican. No se cambian emisión JWT, roles admitidos, revocación, consentimiento, exportación o borrado. Se conservan los permisos actuales del flujo de solicitudes; no se crean planes para profesionales ni prestaciones de Skill Map por inferencia.

## Componentes, tokens y accesibilidad

- daisyUI con prefijo elv-, tema claro/oscuro ES-61, tarjetas y etiquetas existentes; Inter para títulos/texto y mono para etiquetas.
- Papel/tinta y colores semánticos. Ocre decorativo; texto/foco #7D6218 claro y #D9B861 oscuro. Medir contraste real antes de entregar.
- Cuatro columnas en escritorio cuando quepan, dos en tableta, una en móvil; sin suponer que el backend devuelve exactamente cuatro planes. Texto largo debe envolver, no truncar condiciones o importes.
- Marca «Destacado / Featured», nunca «Más popular» sin métricas. `isHighlighted` proviene del backend.
- Objetivos >=44 px, foco visible, orden DOM lógico, estados anunciados con status/alert; sin movimiento nuevo y con prefers-reduced-motion.
- Si no hay moneda, precio o periodo válidos, no se muestra un importe inventado. Falta de traducción de un campo obligatorio es un error de datos, no una mezcla silenciosa de ES y EN.

## Datos y estados

Los nombres, descripciones, funciones, precio, moneda, periodo, orden y destacado vienen de `GET /api/plans`. El importe DECIMAL puede llegar como string: una conversión estricta distingue cero válido de vacío, negativo, NaN o un formato incorrecto. No se escriben precios reales en componentes ni fixtures de producción.

Todos los textos nuevos de interfaz, salvo los datos del plan, salen de `landing.pricing.*` con respaldo ES/EN. Propuesta completa en `ES-73-D01-TEXTOS-Y-PRESTACIONES-ES-EN.md`.

| Estado | Comportamiento |
| --- | --- |
| Publicación desactivada | S12 y ancla ocultas; `/pricing` informa que los planes aún no se publican, sin presentar oferta |
| Cargando | Esqueleto y estado accesible; no aparece «Gratis» por defecto |
| Error o datos inválidos | Mensaje ES/EN y reintento; nunca se convierte en lista vacía exitosa |
| Vacío confirmado | «Pronto publicaremos los planes»; no subtítulo gratuito |
| Catálogo válido | Texto real por idioma, monedas/periodos válidos, cero como Gratis/Free |
| Sesión verificándose/no disponible | No enviar solicitudes ni asumir autenticación por localStorage; reintentar |
| Plan seleccionado retirado/inactivo | Avisar; no sustituirlo automáticamente por otro plan |
| Enviando | Bloquear envíos duplicados locales, conservar contexto de solicitud |
| 201 válido | Solo entonces confirmar que está registrada/en revisión; nunca activada |
| 409 o pendiente recuperada | Mostrar solicitud en revisión; no crear otra |
| Timeout/red con resultado desconocido | Consultar GET propio de estado; no reintentar POST a ciegas |
| Sesión cambia durante una petición | Descartar resultado de la cuenta anterior; releer estado propio |

El catálogo se relee sin caché en carga/reintento y al volver a la página; cambios administrativos se reflejan sin desplegar código. No se implementa websocket ni se promete actualización instantánea de una pestaña abierta. Una selección después del ingreso se revisa con datos frescos antes del envío explícito.

## Backend: cambios acotados propuestos

No hay endpoints ni modelos nuevos, ni migraciones. Se conserva PricingPlan y PlanRequest, ya registrados en derechos de datos.

1. `GET /api/plans`: lector público actual, solo planes activos y DTO de atributos permitido; cabeceras para no reutilizar precios obsoletos. Errores genéricos, sin imprimir excepciones de base de datos.
2. `GET /api/user/plan/me`: plan del propietario ya autenticado. Proteger también el handler `/me` con `verificarToken`, porque el mismo router está montado públicamente en `/api/plans`. El alias público no debe ejecutar un lector de persona sin autenticación. No se cambia el helper.
3. `GET /api/plan-requests/me`: lectura propia existente. Solo req.user.id decide el propietario; ID ajeno en URL/query no selecciona otra cuenta.
4. `POST /api/plan-requests`: cuerpo solo `{planId}`; comprobar plan activo y propietario desde req.user. Serializar solicitudes de la misma persona con una transacción y bloqueo de su fila User, leyendo pendiente/creando PlanRequest dentro de esa transacción. Así dos pestañas simultáneas reciben una creación y un conflicto, no dos pendientes. No hay clave de idempotencia nueva ni cobro.
5. Endpoints administrativos de aprobación/rechazo y gestor de precios conservan sus contratos y permisos; no se rediseñan dentro de ES-73. No se cambia planLimits.js, sesiones profesionales ni presupuesto IA.

### Seguridad y privacidad

Reutilizar verificarToken/verificarAdmin y contratos de ES-18. Identidad exclusivamente en servidor. No aceptar userId/ownerId desde cliente; no registrar email, contraseña, tokens ni excepciones de proveedor/BD. El plan seleccionado es información pública; no viaja información de diario, chat, ánimo o competencias en la solicitud. Las respuestas tardías no se muestran en otra cuenta. Se prueba acceso con IDs ajenos, roles sin permiso de edición y sesiones revocadas.

## Pruebas y entrega

- Frontend: formato DECIMAL/cero/moneda/periodo, respuesta malformada frente a vacío, traducciones, render real, contenido editable/fallback, selección tras registro/ingreso, sin POST automático ni retorno arbitrario, estados de envío desconocido y cambio de cuenta.
- Backend HTTP: activo/inactivo, lectura pública sin datos personales, protección de /me por ambos montajes, propietario A/B, IDs ajenos, escritura de catálogo reservada a admin, 201/409/404 y fallos de transacción sin éxito falso.
- PostgreSQL real aislado: edición administrativa reflejada por GET público, orden/destacado, una sola solicitud pendiente bajo concurrencia, rollback, A/B y revocación. Datos sintéticos; sin producción.
- Navegador: ES/EN, móvil/tableta/escritorio, teclado, contraste claro/oscuro, errores/reintento/vacío, gratis condicional, registro → ingreso → revisión → solicitud → estado. No cobrar ni activar automáticamente.
- Checks: frontend lint, tipos, tests, build y audit; backend tests/audit e integración real. Salida real y límites en el PR, un ticket/una rama/un PR; sin merge propio ni cierre de hilos QA.

Estimación propuesta: **16–24 horas**, sin contar la definición comercial, revisión especializada ni despliegue. El desarrollo puede probarse con fixtures/DB sintética; eso no cierra la publicación integrada de la HU.

## OBJECIÓN D-01 — publicación

La descripción terapéutica, «ilimitado» y las sesiones incluidas no están verificadas como una oferta coherente con el sistema actual. Cambiar únicamente el adjetivo no prueba que la prestación se entregue. Se recomienda implementar con publicación desactivada por defecto y resolver D-01 con el documento de textos adjunto. No activar oferta ni modificar catálogo real hasta aprobación y verificación. Corregir el cumplimiento de cuotas por plan requeriría alcance técnico adicional, que no se incluye aquí por cuenta propia.

## Aprobación solicitada

Aprobar este flujo público de continuación por plan, la actualización de `/pricing`, los textos de interfaz propuestos y los cambios acotados de backend, con publicación desactivada y D-01 explícitamente pendiente. La aprobación del plan técnico no acredita prestaciones comerciales ni autoriza tocar producción.
