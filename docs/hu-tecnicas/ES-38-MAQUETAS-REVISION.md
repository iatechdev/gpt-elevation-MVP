# ES-38 · Maquetas de acceso, inicio y navegación administrativa

[Dev-Codex] · 29-oct-2026 · Propuesta visual para aprobación; no implementación del producto.

## Fuentes y cambio respecto al plan aprobado

Continúa el plan aprobado en Jira 10499/10500 y la preparación 10505. Rama propia `ES-38-integracion-es-en`, HEAD previo `27cf70b`; código de referencia main `eb371a6` y rama ES-37 `5c5da06`. PR #84 sigue abierto, no fusionado, en la comprobación de esta entrega. No se fusionan ramas ajenas.

El plan anterior usaba oliva. Estas maquetas proponen trasladar **ES-38** a los tokens actuales de ES-37: papel #FAFAF9, tinta #1A1A18, secundario #6B6B67, ocre #B8963E solo decorativo, vínculo #7D6218 y foco #2F6B8F. La aprobación de esta paleta en ES-113 no se presenta como aprobación de ES-38: se pide revisión explícita de estas maquetas antes de aplicar el cambio.

Maqueta: [HTML interactivo](./ES-38-MAQUETAS-ACCESO-INICIO-ADMIN.html). Incluye CSS ya construido de daisyUI, prefijo elv-, y copia de los tokens de ES-37 para mostrar la propuesta; **no son una segunda fuente de tokens del producto**. Sin instalación ni dependencias nuevas. No incrusta archivos de fuentes: usa Inter/Playfair si están disponibles y system-ui/Georgia como alternativa; verificar las fuentes empaquetadas al integrar. No contiene credenciales, datos de personas, cifras de negocio ni conexiones API.

## Pantallas y flujo

1. **Acceso /login**: columna centrada, campos con etiqueta visible y borde suficiente, mostrar/ocultar contraseña, ingreso y alternancia de registro (nombre solo en registro). Conserva endpoints, verificación de sesión, bloqueo, destinos por rol/onboarding y confirmación de registro existentes. El HTML solo demuestra aspecto; no autentica, valida contratos ni guarda. Se muestra el título de ingreso/registro y no se altera el texto comercial. El contenedor exterior se adapta a móvil sin alturas que corten el formulario.
2. **Inicio /app/dashboard, marco exterior**: cabecera, accesos ya existentes y jerarquía de tarjetas. La zona de conversación se representa mediante un bloque reservado a ES-112; no es un nuevo estado del producto. El resto de módulos conserva su orden, contenido, handlers y condiciones de visibilidad reales. Esta maqueta esquemática no aprueba eliminar módulos, mover el chat, cambiar recomendaciones, ni rediseñar las tarjetas que están en PR de otros agentes. Antes de tocar el dashboard se mostrará la composición integrada de esas entregas.
3. **Administración /admin/**: cabecera flexible, navegación lateral en escritorio y desplegable en flujo en móvil. Abrir/cerrar menú con aria-expanded/controls, Escape y retorno de foco. Se conserva el conjunto de destinos por rol; la maqueta representa admin común. Usuarios/Manifiesto se conservan solo para el rol autorizado. Los interiores son esquemáticos; no se reemplaza la distribución de métricas ni se modifica catálogo, formularios o decisiones de permisos. El logout visible reemplaza el icono sin etiqueta; su lógica no cambia.

La barra negra superior es exclusivamente el visor de maquetas (pantalla, estado y ES/EN), **no se añadirá al producto**. Sus enlaces se interceptan para no abandonar el visor; los destinos indicados corresponden a rutas existentes. El botón Cerrar sesión simula el mensaje de sesión vencida y no cierra ninguna sesión real.

## Delimitación contra trabajo paralelo

| Área | Trabajo existente | Límite de ES-38 en esta preparación |
| --- | --- | --- |
| Tokens y tema | ES-37 / #84 | Solo referencia; aplicación espera integración por Mauricio |
| Conversación | ES-112 / #94 | No cambiar ChatPage, ChatControls, presupuesto ni Pausar |
| Puente | ES-111 / #95 | No tocar pantalla, consentimiento o APIs |
| Diario | ES-113 / #98 | No tocar editor, guardado o recientes |
| Mapa | ES-30 / #86, #90, #96, #97; ES-119 / #93 | No modificar mapa, radar, autoevaluación ni tarjeta de acceso pendiente |
| Catálogo | ES-116 / #88; ES-118 / #92 | Solo navegación existente; sin interiores ni contenido |
| Hoja de vida | ES-109 / #89, ES-110 / #91 | Sin formularios de contexto ni propuestas de evidencia |
| Terapeuta | ES-100 / #78 y ES-97 / #69 | Sin cambios durante esta preparación |

No se han reservado archivos mediante bloqueo técnico: las ramas pueden cambiar. Antes de implementar se volverán a revisar PR, comentarios y diff. Esta entrega solo añade documentos y maquetas propios; no toca archivos compartidos del producto. El alcance completo aprobado de ES-38 sigue pendiente: estos tres esquemas no lo cierran.

## Componentes, estados y textos ES/EN

Reutilizar daisyUI input, button, card y menu con el tema semántico de ES-37; conservar sus radios, espaciado de 4 px, acciones de 44 px y foco visible. No componentes de negocio nuevos ni selector global de tema. Claro para acceso/admin; oscuro solo en dominios que ya lo admiten, a revisar en maquetas posteriores. No oscurecer estas pantallas por cuenta propia.

| ES | EN |
| --- | --- |
| Ingresar / Crear cuenta | Sign in / Create account |
| Nombre / Correo electrónico / Contraseña | Name / Email address / Password |
| Mostrar / Ocultar | Show / Hide |
| Mi espacio / Mi contexto / Mis evidencias / Mi mapa | My space / My context / My evidence / My map |
| Mi siguiente paso | My next step |
| Administración / Administrador | Administration / Administrator |
| Abrir menú / Cerrar menú | Open menu / Close menu |
| Saltar al contenido / Cerrar sesión | Skip to content / Log out |
| Cargando… / Guardando… / Reintentar | Loading… / Saving… / Try again |
| No se pudo completar la operación. Inténtalo de nuevo. | The operation could not be completed. Please try again. |
| Operación confirmada por el servidor. | Operation confirmed by the server. |
| Tu sesión venció. Inicia sesión de nuevo. | Your session has expired. Please sign in again. |

Los mensajes de estado del visor son ilustrativos. En producto se mantienen las claves/semántica específicas de cada operación y su contrato: carga no es vacío, falta de conexión no equivale a cero, formulario no guardado no es éxito. En acceso, comprobar sesión debe ocultar el formulario hasta resolverse según el comportamiento existente; el visor muestra la apariencia del formulario junto al mensaje, no redefine ese flujo. Guardando/éxito son N/A para navegación pura y lecturas: la maqueta los expone para comparar componentes, no propone escrituras nuevas.

Errores anunciados con role=alert; carga/guardado/confirmación con role=status; acciones no se distinguen solo por color. Los textos explicativos de reserva pertenecen al visor y no se publican como copia de producto.

## Responsive, teclado y pruebas de la maqueta

La columna de acceso usa ancho flexible; inicio apila tarjetas; administración colapsa navegación bajo 760 px y muestra el menú dentro del flujo, sin superponer contenido. Tab nativo, etiquetas de campo visibles, enlace de salto, foco de 3 px, Escape cierra menú y devuelve foco. Respeta prefers-reduced-motion. En implementación se revisarán error asociado a campo, 200% y lectores; no se declaran verificados por el HTML.

Comprobaciones reales realizadas en navegador local sobre **la maqueta**:

- Tres vistas × ES/EN × 320/375/768/1440: 24 lecturas de geometría, ninguna con scrollWidth mayor que innerWidth. No son 24 pruebas de la aplicación.
- Seis estados en ambos idiomas, observados en la vista administrativa: vacío, carga, guardado, error, éxito y sesión vencida. Mensajes simulados, sin persistencia.
- Menú a 375 px: abrir/cerrar; Escape deja aria-expanded=false y foco en el botón menu.
- Capturas de acceso, inicio y administración en escritorio; administración móvil ES, error móvil EN e inicio móvil EN. No son capturas de staging ni resultados del producto.
- Limitación de la primera apertura: servidor en sandbox no respondía; se reinició el mismo servidor estático en loopback fuera del sandbox y se verificó el documento en navegador. Python no disponible, se usó Node instalado.

No ejecutados en este tramo documental: lint/types/build/tests/audit de la aplicación, proveedores IA, PostgreSQL, APIs reales, validación de permisos, lectores externos, zoom real 200%, dispositivos físicos y staging/producción. No se han cambiado frontend/, backend/, package.json, migraciones ni configuración de CI.

## Plan técnico y siguiente paso

Sin endpoints, datos, modelos ni migraciones nuevos. Se conserva el núcleo de identidad y derechos de Mauricio. Una maqueta de menú no acredita autorización: el servidor mantiene la decisión por rol/propietario.

Solicitar aprobación de la paleta y de los patrones mostrados de acceso y shell administrativo. Inicio es preliminar hasta poder mostrar la composición integrada sin reservas. Después: esperar ES-37 integrado, actualizar únicamente la rama propia desde main, revisar archivos concurrentes y presentar cualquier composición que cambie antes de implementarla. No abrir PR de entrega ni declarar En QA la historia por preparar estas maquetas. No desplegar ni fusionar.
