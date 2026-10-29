# ES-38 · Diseño y plan de integración ES/EN

[Dev-Codex] · 29-oct-2026. Rama ES-38-integracion-es-en, base main d5eb00f9d0a035c6c98506038490f32087d4acc6. Solo revisión de fuentes y propuesta; sin implementación de frontend.

## Encargo y fuentes

El usuario asignó ES-38 a Dev-Codex en este chat después de informar que figuraba con Dev-Claude. Trazabilidad en ES-38/10494. No se usan ni alteran cambios de carpetas compartidas o de fix-ES-38.

ES-38 pide revisar el recorrido completo ES/EN, aplicar el sistema unificado y comprobar consistencia, responsive y teclado. ES-37/PR #84 continúa abierto en QA: tokens y referencia se leen en origin/ES-37-sistema-diseno, head d0d2c1c. Sus comentarios 10470–10485 acotan su entrega a Skill Map, Career y Compass y remiten el resto a esta HU. La landing conserva identidad propia como excepción aprobada.

Fuentes: docs/hu-tecnicas/DESIGN-SYSTEM.md y versión 2 propuesta en ES-37, frontend/src/App.tsx, CSS por dominio, frontend/src/styles/tokens.ts, layouts, componentes y diccionarios actuales. No se diseña un mapa visual nuevo (ES-30) ni la experiencia PDF de ES-109/110.

## Inventario medido y OBJECIÓN de alcance

Sobre main d5eb00f:
- App.tsx contiene 49 declaraciones Route con path: incluye rutas relativas, contenedores/redirecciones y comodín. No significa 49 pantallas diferentes.
- Hay 13 hojas CSS de dominio/índice y 24 archivos TSX con literales hexadecimales, incluidos comentarios. Es un indicador de dispersión, no 24 fallos visuales demostrados.
- tokens.ts aún contiene la paleta anterior; lo importan Login, AdminMetrics, AdminDashboard y TherapistPatient. Otros archivos tienen estilos locales.
- AdminLayout/TherapistLayout tienen cabecera fija, controles pequeños y colores locales; requieren revisión de tamaño táctil, responsive y etiquetas, no solo sustitución textual de colores.
- ES-37 no cubre estados completos de todos los módulos; hay vistas contra fixtures y banderas de publicación que no se deben activar para clientes desde ES-38.

**OBJECIÓN:** el presupuesto 8–14 h no es compatible con trasladar todos los dominios pendientes, revisar ES/EN y ejecutar estados/responsive/roles de todo el recorrido. Estimación inicial propuesta: **32–48 h de implementación y verificación**, más la ronda independiente de QA. La fecha original 27-oct ya pasó; no se promete una nueva entrega sin acordar alcance y dependencias.

Alternativas:
1. **Recomendada:** integración completa por grupos dentro de esta HU, con la matriz completa como criterio de cierre. Estimación 32–48 h; no marcarla Listo por terminar solo el primer grupo.
2. Mantener 8–14 h únicamente para inventario, plan y primer grupo personal. Eso sería entrega parcial y dejaría el resto sin cumplir; requiere decisión explícita del PO, no se adopta por defecto.

## Dependencias y convivencia

- **ES-37/PR #84:** fuente de tokens y tema. Implementación final sobre main una vez integrado por Mauricio tras QA. No fusionar su PR, copiar otra fuente de tokens ni construir un sistema alternativo.
- **ES-100/PR #78 y trabajo de privacidad del terapeuta:** revisar sus cambios para evitar sobrescribirlos; integrar desde main cuando se fusionen. ES-38 no rehace el permiso de compartir ni su contrato.
- **Landing ES-65/69/71/73:** revisión de no regresión de lo disponible en main; no importar sus ramas, publicar secciones ocultas o resolver contenido legal.
- **ES-30 y ES-109/110:** no sustituir mapa ni ampliar esquema de contexto. Revisar pantallas vigentes, mantener espacio para integración posterior sin inventar estados/datos.
- Sin rama apilada sobre PR ajeno por cuenta propia. Mientras falta integración, se puede completar inventario y pruebas de los recorridos actuales; el resultado integrado seguirá pendiente.

## Matriz del recorrido a revisar

Cada grupo se verificará en ES y EN; el informe final distinguirá real HTTP/DB, mocks, no disponible y no ejecutado. No se rellena una casilla como aprobada por inspeccionar solamente el código.

| Grupo | Rutas/patrones actuales | Cambios visuales y verificación |
| --- | --- | --- |
| Público | /, /login, /profesionales, /pricing; /privacy es archivo estático, no Route de App | Landing sin cambio de identidad; acceso con tokens interiores; formularios/error/idioma. Planes según implementación integrada, sin inventar importes. /privacy conserva URL y contenido pendiente de revisión, sin edición legal |
| Inicio/contexto | /app/dashboard, /app/onboarding | Cabecera, tarjetas y controles; no cambiar campos, validación, condición de onboarding o destinos |
| Conversación | /app/checkin, /app/chat; variante mode=compass si está habilitada | Ritmo y contenido intactos, foco, entrada, scroll interno, selección de diario; sin enviar mensajes al proveedor en pruebas locales |
| Mi espacio | /app/diary, /app/diary/new, /app/diary/:id, /app/space/tools, /app/progress | Formularios, selección, gráficos/listas y estados; no alterar privacidad ni persistencia |
| Brújula | /app/compass | Regresión del tema ES-37 con datos, edición, error, confirmación y retirada; sin rehacer puente |
| Evidencias/mapa | /app/evidence, /app/evidence/new, /app/evidence/:id, /app/skill-map | Unificar evidencia con tema; conservar niveles null, sin evidencia, contradicción y caducado; no mapa visual nuevo |
| Catálogo persona | /app/route-catalog, /app/route-catalog/roles/:roleKey | Filtros, fichas, foco, datos desconocidos; contenido del catálogo no se traduce ni inventa desde esta HU |
| Carrera | /app/next-step, /app/next-step/experiments, /app/next-step/experiments/:id, /app/next-step/plan | Regresión de ES-37 y estados contra el contrato existente; conservar banderas y marca de simulación |
| Ejercicios | /app/exercises | Propósito, omitir/volver, estados y teclado; no habilitar ejercicios pendientes de revisión humana |
| Profesional de la persona | /app/my-therapist, /app/session/:id | Tarjetas, estados y sala sin proveedor externo; no cambiar vínculo, consentimiento o matching |
| Facilitación | /facilitation, /facilitation/participants/:id, /facilitation/participants/:id/reviews/new, /app/professional-reviews | Aplicar tokens conservando claro/oscuro existente, formularios y advertencias de simulación; sin acceso real nuevo |
| Piloto | /app/feedback, /admin/pilot-metrics | Tema y estados contra fixtures existentes; bandera intacta, sin agregados ni datos reales |
| Admin catálogo | /admin/route-catalog, /admin/route-catalog/:id, /admin/route-catalog/:id/:kind/:itemKey | Formularios, tablas y diálogo; sin cambiar permisos o contratos PUT/publicación |
| Admin general | /admin y /admin/dashboard, /admin/prompts, /admin/content, /admin/users, /admin/metrics, /admin/manifest | Shell responsive, tablas con scroll local, formularios/diálogos; no introducir acciones ni cambiar qué permite cada rol |
| Terapeuta | /therapist/dashboard, /therapist/patient/:id, /therapist/session/:id | Aplicar tema tras integrar cambios de ES-100; no modificar funciones clínicas/IA ni controles de autorización |
| Junta | /board y /board/manifest | Cabecera, edición/revisión y estados; mantener separación de roles |
| Redirecciones | Índices de admin/board, rutas desconocidas * | Comportamiento existente y límites de sesión, sin diseñar rutas nuevas |

Las rutas ocultas se revisan con un build local explícito y datos sintéticos; no se presentan como funcionalidades publicadas. Una ruta requiere múltiples estados, no solo captura de su estado vacío.

## Diseño propuesto

Se conserva la estructura y el flujo de cada pantalla. Se comparten tokens, aspecto de controles y estados, sin reemplazar todos los shells por una navegación nueva.

```text
ACCESO / CONTEXTO
[Idioma ES EN]        [Acceso o encabezado actual]
[Título existente / ayuda]
[Campos y errores existentes, etiquetas asociadas]
[Acción secundaria] [Acción principal]

ESPACIO / CHAT / RECORRIDO PROFESIONAL
[Marca / navegación actual] [Idioma] [Acción de sesión existente]
[Salto al contenido]
[Título]
[Tarjeta o conversación] [Detalle o contexto, si ya existe]
[Acciones actuales; carga/error/resultado confirmado]

BACKOFFICE / TERAPEUTA / JUNTA · ESCRITORIO
[Marca y rol]                           [Idioma] [Sesión]
[Navegación existente] [Título / filtros]
                      [Tabla o tarjetas, ancho flexible]
                      [Acciones y diálogos actuales]

MÓVIL
[Marca] [Abrir menú] [Idioma]
[Navegación colapsable accesible, mismas rutas]
[Contenido apilado; sin scroll horizontal de página]
[Tabla con desplazamiento dentro de su región cuando sea necesario]
```

- No nuevos pasos de onboarding, CTAs de negocio, tabs de producto o rutas. Si un hallazgo requiere otro flujo, publicar objeción y pedir decisión antes de cambiarlo.
- Cabeceras que hoy se superponen al texto se adaptan al contenido; no usar alturas que oculten botones o foco.
- Sidebar: las mismas opciones, convertidas en menú responsive con botón real, aria-expanded/controls, cierre con Escape y devolución de foco. No menú oculto todavía enfocable.
- Formularios conservan orden, validaciones, valores y funciones. Etiqueta visible asociada; ayuda/error por aria-describedby. No convertir texto escrito en guardado.
- Diálogos conservan propósito y confirmaciones; foco inicial, contención de Tab, Escape donde corresponda y retorno al disparador. No cerrar por Escape una mutación cuyo estado es incierto.
- Tablas mantienen todas las columnas/datos. En móvil, scroll interno con región etiquetada si el contenido no admite apilarse; nunca truncar evidencias, texto privado o controles sin alternativa.
- Texto de usuario, notas, prompts, catálogos y contenido administrable no se traduce ni se altera como si fuese interfaz.

## Tokens y componentes

Reutilizar la fuente ES-37, sin crear otra paleta:
- Fondos --elv-bg/surface/card; texto --elv-text-1/2/3; estados --elv-error/warning/success/info y sus fondos.
- Acción #4A6741 con blanco; foco #2F6B8F; borde de control #7C8875. Oliva #6B7D5C solo decorativo cuando no cumpla contraste.
- Playfair Display en títulos, peso 300–400; Inter en cuerpo/controles; Noto Serif para voz IA ya existente. Sin fuentes remotas o nuevas dependencias.
- Radios --elv-r-* y espaciado --elv-s-*; controles mínimo 44 px. Contraste normal ≥4.5:1, controles/foco ≥3:1.
- tokens.ts se convierte en compatibilidad de variables CSS, manteniendo nombres públicos. No leer getComputedStyle una vez y congelar colores: el tema debe resolver en el scope correcto.
- Eliminar redefiniciones de tema por dominio conforme se migra cada uno, conservando layout. No eliminar colores que representen datos de un gráfico sin identificar su significado y accesibilidad.
- Reutilizar daisyUI prefijado elv- y los componentes ya presentes. Extraer solo lo necesario para aplicar coherentemente campo, botón, tarjeta, aviso y diálogo; no refactorizar lógica de negocio o reescribir pantallas enteras.
- Oscuro solo donde ya existe, conforme a la decisión ES-37. No añadir un selector global ni oscurecer Login/Admin/Terapeuta por cuenta propia.
- Landing mantiene sus temas editorial claro/oscuro y foco ocre, como excepción aprobada; comprobar que las nuevas reglas globales no la contaminen.

## Estados e i18n

Revisar por cada formulario/página aplicable: carga, vacío real, error de lectura con reintento, borrador, guardando, confirmado por servidor, fallo de escritura, resultado incierto tras pérdida de respuesta, sesión expirada/rol no permitido, contenido largo y datos parciales. No todos aplican a todas las pantallas: justificar N/A en la matriz.

Conservar claves y textos existentes. Correcciones de traducción faltante se registran y revisan en el diff; no crear diagnósticos, promesas de empleo, límites comerciales, plazos de borrado o contenido editorial nuevo.

Textos de interfaz compartidos propuestos, solo cuando no exista ya clave equivalente:

| ES | EN |
| --- | --- |
| Abrir menú | Open menu |
| Cerrar menú | Close menu |
| Navegación principal | Main navigation |
| Saltar al contenido | Skip to content |
| Cerrar sesión | Log out |
| Idioma | Language |
| Administrador | Administrator |
| Superadministrador | Super administrator |
| Profesional | Professional |
| Junta | Board |
| Cargando… | Loading… |
| Guardando… | Saving… |
| Reintentar | Try again |
| Cerrar | Close |
| Tabla con desplazamiento horizontal | Horizontally scrollable table |

No cambiar el mecanismo de sesión por una etiqueta accesible. Los handlers existentes de autorización y guardado siguen siendo sus contratos actuales.

## Backend y seguridad

No endpoints, consultas personales, modelos, migraciones ni dependencias nuevas. La HU consume las APIs actuales y no amplía DTOs. No rediseña identidad, permisos, consentimiento, revocación, exportación o borrado, reservados a Mauricio.

Si durante el recorrido un endpoint no cumple propiedad/rol o el flujo de sesión necesita cambiar, documentar evidencia y objeción, detener solo esa parte y pedir contrato a Mauricio. No «arreglar» autorización con un guard cliente ni presentar mocks de roles como prueba de seguridad del servidor. ES-38 conserva todos los guards; localStorage no se convierte en fuente de autorización nueva.

Pruebas locales con datos sintéticos; no copiar conversaciones, diarios, cuentas, credenciales, documentos o datos del piloto. No enviar mensajes a Claude, crear salas Daily ni publicar catálogos/ofertas reales para comprobar estilos. Acciones administrativas se verifican contra entorno de prueba declarado, nunca producción.

## Implementación y validación propuestas

1. Tras aprobación de este plan y ES-37 integrado: medir baseline de tests/build/audit y completar capturas de referencia con tema común.
2. Adaptador tokens.ts y controles/shells compartidos. Preservar la excepción landing; comprobar navegación/teclado.
3. Grupo personal: Login, contexto, dashboard, check-in/chat, diario, progreso y relación profesional. Revisar regresión en Skill Map/Career/Compass.
4. Grupo operativo: Admin/Junta/catálogos, vistas de piloto/facilitación y terapeuta/salas después de sus dependencias integradas.
5. Recorrido ES/EN completo con matriz por ruta/estado/viewport/rol y evidencia antes/después; corregir todos los hallazgos dentro de alcance.
6. PR contra main con criterios, pruebas reales, límites, riesgos y pendientes explícitos. No fusionar ni cerrar hilos QA.

Verificación: frontend lint 0 errores/advertencias, tsc -b, npm test, build y npm audit; backend tests de regresión apropiados y CI existente, sin migraciones nuevas. Pruebas de contraste y roles HTTP con entorno declarado. Navegador a 320/375/390/768/1024/1440, ampliación de texto 200%, claro y oscuro donde corresponda, teclado, foco y reduced-motion; capturas comparables, datos sintéticos idénticos.

Los mocks facilitan estados difíciles pero no acreditan integración. Resultado final por caso: HTTP real con modelos/DB identificados, fixture, N/A justificado o no verificado. Si una dependencia sigue sin integrarse, la historia no se declara completa.

## Aprobación solicitada

Aprobar la integración visual completa de los grupos anteriores, los patrones responsive/teclado, textos compartidos y estimación inicial 32–48 h, conservando flujos/contratos y la excepción de la landing. La implementación dependiente del tema espera ES-37 integrado; no se autoriza fusionarlo desde Dev. Este plan no da por aprobadas funcionalidades que sigan en QA ni amplía el alcance de sus contratos.
