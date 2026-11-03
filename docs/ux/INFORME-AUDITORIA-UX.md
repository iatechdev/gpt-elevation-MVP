# Auditoría de UX/UI · Elevation + Skill Map (ES-148)

Autor: UX-Claude · 3-nov-2026 · Entorno: **staging** (`backend-staging-e3a6`), cuentas sintéticas · Sin producción, sin llamadas a la IA, sin escrituras.
Estado: **borrador para revisión de Mauricio y Alejo**. Propuesta de rediseño: [PROPUESTA-DISENO.md](PROPUESTA-DISENO.md) (pasa por la puerta de diseño).

## 1. Qué se ejecutó (y cómo repetirlo)

| Cobertura | Detalle |
|---|---|
| Perfiles | Público, persona, terapeuta, administrador, superadministrador (un solo acceso por rol, sesión reutilizada) |
| Idiomas × vistas | ES y EN × escritorio (1280×800) y móvil (393×851) |
| Pantallas | 6 públicas + 25 de persona + 1 de terapeuta (+ detalle si existe) + 7 de admin + 9 de superadmin; **225 filas de resultado** y **233 capturas** |
| Estados | Normal, **error** (la API devuelve 500, simulado en el navegador), **cargando** (API con 4 s de demora, simulado) y, en acceso, formulario vacío y credenciales incorrectas |
| Medidas automáticas | Redirecciones, errores de consola, peticiones fallidas, desborde horizontal, controles sin nombre y axe (WCAG 2 A/AA) |

Evidencia: `docs/ux/capturas/<perfil>/<idioma>-<vista>/<ruta>[__estado].jpg` y los datos crudos en `docs/ux/capturas/hallazgos-auto-*.json`. Los correos visibles se enmascararon como `persona@ejemplo.test` antes de capturar; ninguna credencial aparece en capturas, trazas ni reportes.

Reproducir (desde `e2e/`; el lanzador lee el archivo local de cuentas y las pasa solo como variables de entorno del proceso):

```bash
node scripts/con-credenciales.mjs "<ruta al archivo local de cuentas>" npx playwright test tests/auditoria.spec.ts --project=escritorio
```

Dato objetivo del barrido: **0 pantallas con desborde horizontal**, **0 errores de consola** salvo dos 403 de administrador (H-17) y **ninguna pantalla con título principal (`h1`) en el chat y el panel** (H-09). El resto de resultados son de diseño, no de rotura.

## 2. Lectura general (una página)

La plataforma **funciona** y respeta bien los límites del producto (no clínico, «Sin evaluar» en lugar de niveles inventados, privacidad explícita). El problema de UX no es de piezas sueltas sino de **sistema**: se ven al menos **cuatro «capas» visuales distintas** (landing negra/ocre con Inter en mayúsculas; espacio de persona verde salvia con serif Playfair; chat dorado con mono; panel de terapeuta/admin con otra cabecera), **cinco cabeceras** y **cinco versiones del selector ES/EN**. La persona nunca sabe «dónde está» y varias pantallas son callejones sin salida. Además, hay **mucho texto interno** (ej. «cuando su flujo de autorización esté integrado») que llega a la persona.

## 3. Hallazgos priorizados

Severidad: **Alta** = la persona se bloquea, se confunde en un momento delicado o se rompe una regla del producto · **Media** = fricción repetida · **Baja** = pulido. «P» = persona, «T» = terapeuta, «A» = admin. Rutas en staging; capturas relativas a `capturas/`.

### Alta

**H-01 · Cuatro identidades visuales y cinco cabeceras en un mismo recorrido** (P, T, A)
Evidencia: [landing](capturas/publico/es-escritorio/inicio.jpg) → [onboarding](capturas/user/es-escritorio/app-onboarding.jpg) → [panel](capturas/user/es-escritorio/app-dashboard.jpg) → [chat](capturas/user/es-escritorio/app-chat.jpg) → [mapa](capturas/user/es-escritorio/app-skill-map.jpg) → [terapeuta](capturas/therapist/es-escritorio/therapist-dashboard.jpg).
Cómo reproducir: iniciar sesión como persona y abrir esas rutas.
Qué pasa: botón principal negro en landing, **verde** en onboarding/ejercicios, **dorado** en «Mis datos»; titulares serif en unas pantallas y Inter en otras; la cabecera cambia (marca en mono espaciado, «ELEVATION» simple, «ELEVATION THERAPIST»); el selector ES/EN cambia de forma y color en cada pantalla.
Por qué importa: en un producto emocional, la incoherencia se lee como inestabilidad y baja la confianza. Dificulta aprender dónde está cada cosa.
Recomendación: un solo sistema (tokens, cabecera, selector, botones) — ver propuesta §3–4. Los tokens ya existen (`tokens.css`); falta **imponerlos**, no inventarlos.

**H-02 · El estado de error del panel es invisible** (P)
Evidencia: [dashboard con API en 500](capturas/user/es-escritorio/app-dashboard__error.jpg) se ve igual que el [normal](capturas/user/es-escritorio/app-dashboard.jpg) (incluso cambia «Tu terapeuta aún no ha agendado una sesión» por «Buscar mi terapeuta», un dato distinto sin avisar).
Cómo reproducir: con la sesión de persona, hacer fallar las llamadas GET de `/api/*` y abrir `/app/dashboard`.
Por qué importa: la persona ve «0 sesiones» y «sin recomendaciones» cuando en realidad **no se pudo cargar**; decide con datos falsos.
Recomendación: error por tarjeta (no pantalla entera) con «No pudimos cargar esto · Reintentar» y nunca mostrar vacío cuando es error.
Contraste: [mapa](capturas/user/es-escritorio/app-skill-map__error.jpg) sí lo hace bien («No pudimos cargar tu mapa. Reintentar»): es el patrón a replicar.

**H-03 · Error de «Diario» con texto suelto y sin jerarquía** (P)
Evidencia: [diario con error](capturas/user/es-escritorio/app-diary__error.jpg): «No pudimos cargar. Reintentar» sin estilo, pegado al botón, más un segundo «Reintentar». Mensaje duplicado y sin contenedor de alerta.
Recomendación: componente único de error (§4 de la propuesta).

**H-04 · Pantallas «callejón sin salida» presentadas como si existieran** (P)
Evidencia: [Mi siguiente paso](capturas/user/es-escritorio/app-next-step.jpg) «Este recorrido aún no está disponible.» (las tres rutas `/app/next-step*` muestran lo mismo bajo el mismo título), [Ejercicios](capturas/user/es-escritorio/app-exercises.jpg) «Los ejercicios aún no están disponibles.», [Al Puente](capturas/user/es-escritorio/app-diary.jpg) deshabilitado con «El Puente estará disponible cuando su flujo de autorización esté integrado» aunque `/app/bridge` [sí abre](capturas/user/es-escritorio/app-bridge.jpg).
Por qué importa: la persona llega, no puede hacer nada y no sabe qué hacer. La guía de QA dice que «En preparación» es esperado, pero la pantalla ni lo dice así ni ofrece alternativa.
Recomendación: si una función no está lista, **no se enlaza** o se muestra como «Próximamente» con un solo párrafo, una acción útil («Mientras tanto: Mis evidencias») y fecha solo si es real. Nunca vocabulario de desarrollo.

**H-05 · Rutas de personal abiertas para la persona con vocabulario interno** (P)
Evidencia: [/facilitation](capturas/user/es-escritorio/facilitation.jpg) y `/app/professional-reviews` muestran «Consola de facilitación — La vista preliminar no está habilitada.» a una persona. **Defecto de producto/seguridad leve (no se corrige aquí):** no hay filtración de datos observada, pero la ruta debería redirigir o responder 403 con mensaje humano y ni siquiera aparecer en la navegación.
Recomendación: Dev/QA decidir si se redirige a `/app/dashboard`. Ver también «No verificado».

**H-06 · Tras la entrada, la persona no sabe por dónde empezar** (P)
Evidencia: [onboarding](capturas/user/es-escritorio/app-onboarding.jpg): una tarjeta verde de subir PDF, tres opciones de intención, **cuatro selectores «Por confirmar»**, un desplegable «Contexto profesional», y **tres botones** al pie («Volver», «Guardar avance», «Guardar contexto»). Después aparece el [panel](capturas/user/es-escritorio/app-dashboard.jpg), que abre con «Zona profesional / Mapa de competencias» antes que con el estado emocional que es el corazón del producto.
Por qué importa: carga cognitiva alta justo al inicio; «Por confirmar» no dice qué hacer; la jerarquía contradice la promesa «espacio solo para ti».
Recomendación: un paso a la vez (3 pasos con progreso), el panel con **una** acción principal («¿Cómo llegas hoy?») y el mapa como segunda tarjeta.

**H-07 · Móvil: la cabecera se rompe y el panel es una columna interminable** (P, T)
Evidencia: [panel móvil](capturas/user/es-movil/app-dashboard.jpg): logotipo, selector, «Mi progreso», «Mi terapeuta», «Mis datos», «Cerrar sesión» apilados en dos filas, con el foco de «Cerrar sesión» recortado; el asistente de IA queda **al final** (≈2.000 px abajo). [Chat móvil](capturas/user/es-movil/app-chat.jpg): tres franjas de controles (cabecera, pestañas Conversación/Diario + botón menú, bloque «Pausar» + uso de IA) ocupan ~35 % de la pantalla antes del primer mensaje.
Recomendación: barra inferior de 4 destinos, cabecera de una línea y acciones secundarias a un menú «Más».

**H-08 · «Cerrar sesión» sin diferenciación y con foco recortado** (P, T, A)
Evidencia: el contorno de foco de [«Cerrar sesión»](capturas/user/es-escritorio/app-dashboard.jpg) queda cortado por el borde en todos los perfiles (se ve en la captura como un recuadro grueso apretado). En el chat es un icono sin texto (flecha de salida) junto a dos más (actividad, estrella) **sin etiqueta visible**.
Recomendación: botones con texto o tooltip + `aria-label`; dar espacio al anillo de foco.

### Media

**H-09 · Sin `h1` en el panel y el chat; mismo `h1` en pantallas distintas** (P, accesibilidad)
Datos: `/app/dashboard` y `/app/chat` sin `h1`; `/app/next-step`, `/experiments`, `/plan` comparten «Mi siguiente paso»; `/facilitation` y `/app/professional-reviews` comparten «Consola de facilitación»; admin «Dashboard» y «Prompts» en inglés bajo interfaz en español (ES y EN idénticos).
Recomendación: un `h1` único por pantalla, traducido.

**H-10 · Contraste insuficiente (axe: `color-contrast`, grave) en 284 nodos** (P, A)
Pantallas con más nodos: panel de persona (12), usuarios admin (9), métricas (6). En la captura: texto gris claro sobre fondo crema en «Tu progreso», «Mi plan» y etiquetas mono pequeñas.
Recomendación: subir `--elv-text-3`/etiquetas a ≥4,5:1 (ya medido en tokens: `#6B6B67` sobre papel pasa; los grises usados en tarjetas no son ese token) y mínimo 12 px real.

**H-11 · Selectores sin nombre accesible (crítico en axe) en «Usuarios» admin** (A) — 16 nodos `select-name`. Y [lista de usuarios móvil](capturas/admin/es-movil/admin-users.jpg) de **~32.000 px** de alto: sin paginación ni búsqueda visible en el barrido.

**H-12 · Lenguaje que suena clínico o de sistema** (P, T)
«Mis pacientes», «Historia del paciente», «Mi prompt terapéutico», «Ver historial (0)», «Zona de autorización explícita», «Insight», «Brújula profesional», «Nuevo contexto directo», «Rechazar este campo». Para un producto **no clínico** (reglas del producto), «paciente» y «terapéutico» chocan con el posicionamiento; el resto es jerga.
Recomendación: «Personas acompañadas» y «Mi guía para la IA»; usar el glosario de §5 de la propuesta. Es decisión de producto del PO.

**H-13 · Estados «Por confirmar», «Sin evaluar», «Sin evidencia vigente»: tres formas de decir «aún no»** (P)
En [mapa](capturas/user/es-escritorio/app-skill-map.jpg): «Sin evaluar» (etiqueta), «Sin evidencia vigente» (texto) y «No hay nada autorizado…», más dos tarjetas azules con el mismo mensaje y el mismo botón «Ir a Mis evidencias». Se respeta la regla (null, sin déficit) pero la persona lee la misma idea cuatro veces.
Recomendación: un solo estado vacío con un solo paso siguiente. **Relacionado con ES-114** (niveles vs estados): hoy conviven la leyenda «Nivel 1–4» y «Sin evaluar»; ver propuesta §6 para las dos variantes.

**H-14 · «Mapa de competencias» arranca con 6 líneas de texto + 2 avisos antes del gráfico** (P)
Evidencia: [mapa](capturas/user/es-escritorio/app-skill-map.jpg). El radar queda a ~850 px; «Revocar todos» está deshabilitado y hay una nota abajo («el permiso por capacidad aún no está disponible»), de nuevo jerga de desarrollo.

**H-15 · Landing de ~9.000 px con 15 secciones y etiquetas «(sintético)» visibles** (público)
Evidencia: [landing](capturas/publico/es-escritorio/inicio.jpg). Dos tarjetas «Plan de prueba A (sintético)» / «B» con «Gratis» y «USD —» visibles al público; secciones «En preparación»; textos largos en cuerpo pequeño. Para el piloto de 6 personas la landing tiene demasiado peso.
Recomendación: versión corta para el piloto (héroe, cómo funciona en 3 pasos, privacidad, entrar) y quitar etiquetas de prueba. Decide el PO.

**H-16 · Textos de error sin traducir y mensajes técnicos** (P) — Confirmado por el informe QA del 31-oct (BUG-002, error ES bajo interfaz EN); en esta pasada no pude provocar ese caso porque no se envía al chat (ver «No verificado»). Los errores simulados se capturaron solo en ES (los textos de error en EN quedan sin verificar).

**H-17 · 403 en consola del administrador** (A) — `GET /api/junta/pending` y `GET /api/board/manifest` devuelven 403 al abrir «Contenido» y «Manifiesto». Defecto funcional menor (el rol admin pide datos de junta); no se corrige aquí.

**H-18 · Tres botones de guardado distintos en el mismo formulario y casillas «Incluir en la autorización» sin explicación de consecuencia** (P) — [Brújula](capturas/user/es-escritorio/app-compass.jpg) y onboarding.

### Baja

- **H-19** «Mis datos»: [exportar](capturas/user/es-escritorio/app-data.jpg) usa botón dorado a ancho completo y «eliminar» un botón pálido idéntico en forma; la acción destructiva no pide más fricción visible (la confirmación se verá al pulsar: **no verificado**, no se pulsó).
- **H-20** Texto del botón «Enviar» en [chat](capturas/user/es-escritorio/app-chat.jpg): dorado desactivado con contraste muy bajo; no distingue «desactivado» de «principal».
- **H-21** Pestañas «Conversación / Diario» más un botón «≡ Menú» en todas las pantallas de persona: tres sistemas de navegación (pestañas, menú, enlaces de cabecera) a la vez.
- **H-22** Selector de idioma sin etiqueta accesible visible en pantallas simples; `lang` del documento sí cambia (bien).
- **H-23** [Chequeo emocional](capturas/user/es-escritorio/app-checkin.jpg): círculos decorativos de fondo y botón «Comenzar» deshabilitado gris sobre gris; emoji como único indicador (con etiquetas debajo: bien).

## 4. Lo que está bien (conservar)

- Aviso «No es terapia ni diagnóstico» y control «Pausar» en el chat; «Privada · Solo visible para ti».
- Mapa: «Lo que aún no evaluaste queda en hueco, no en cero» y «El nivel no certifica»; todo «Sin evaluar» sin inventar nada.
- Barra «Uso de IA este período… se renueva el 30 de noviembre»: transparente y en lenguaje claro.
- El Puente: toggles por fuente con «NO AUTORIZADO» visible y explicación de qué se lee.
- Mensaje de error del mapa («No pudimos cargar tu mapa · Reintentar») y estados vacíos con sugerencia («Aún no tienes evidencias guardadas»).
- 0 desbordes horizontales en 225 vistas; `lang` correcto; foco visible en el primer Tab.

## 5. Comparación con el informe QA del 31-oct

| Hallazgo QA (31-oct) | Hoy (3-nov) |
|---|---|
| BUG-003 sin recuperar contraseña | **Resuelto**: `/forgot-password` abre «Recuperar contraseña» y `/login` enlaza «¿Olvidaste tu contraseña?» |
| BUG-004 mensaje no confirmado se pierde | Cubierto por pruebas de ES-147 (sobrevive a recargar); no re-ejecutado aquí |
| BUG-002 error en español con UI en EN | **No verificado** (requiere provocar el 429 en EN; ver §7) |
| BUG-001 chat 429 | No re-ejecutado (no se llama a la IA) |
| Skill Map «Próximamente» en landing | Sigue en la landing; el mapa ya existe en la zona de persona (H-15) |

## 6. Accesibilidad (resumen medible)

| Regla axe | Impacto | Nodos | Pantallas |
|---|---|---|---|
| `color-contrast` | grave | 284 | landing no; `/forgot-password`, `/reset-password`, panel, progreso, todo admin |
| `select-name` | **crítico** | 16 | admin/usuarios (admin y superadmin) |
| `scrollable-region-focusable` | grave | 8 | admin/métricas, manifiesto |

La landing y el login pasan axe sin violaciones graves (coherente con ES-147). Todo lo demás de persona queda sin violaciones, **salvo** el contraste del panel y de «Tu progreso». No se probó lector de pantalla real.

## 7. No verificado

- **Chat con respuestas de la IA** (streaming, Markdown, límites, 429): no se llamó a la IA. Si se quiere, pido aprobación de gasto a Mauricio y limito a 3–5 llamadas.
- **Formularios con datos** (crear entrada de diario, evidencia, experimento, exportar/eliminar datos, crear usuario): solo se abrieron, no se enviaron (no se escriben datos).
- **Detalle por persona del terapeuta**: la única persona asignada aparece «sin acceso» (no autorizó compartir); no pude ver pantallas con datos compartidos ni las salas de videollamada (`/therapist/session`, `/app/session`).
- **Rutas con identificador** (evidencia/:id, experimento/:id, entrada/:id, catálogos /:id): no hay datos para abrirlas con las cuentas sintéticas.
- **Estados de «éxito»** de guardados y el diálogo de confirmación de eliminar cuenta.
- **Lector de pantalla, Safari/Firefox, dispositivo físico, zoom 200 %, modo de alto contraste, `prefers-reduced-motion`.** Chromium emulado únicamente (Pixel 7 ≈ 393 px).
- **Cálculo de contraste de colores concretos**: axe lo reporta por nodo, pero no medí uno a uno cada par visual.
- **Rendimiento**: no se midió (el tiempo de carga registrado es de Playwright y no es un benchmark).
- **Cuentas admin/superadmin**: solo vistas de lectura; no se probaron flujos de creación (cubiertos por `roles.spec.ts`).
- **Staging = main desplegado**: lo que no esté fusionado no aparece.

## 8. Defectos funcionales o de seguridad observados (reportados, no corregidos)

1. Rutas de facilitación accesibles para una persona (H-05). Sin filtración de datos vista.
2. 403 de junta/manifiesto para el rol admin (H-17).
3. Selectores sin nombre accesible en Usuarios (H-11).
4. Lista de Usuarios sin paginación visible: ~32.000 px en móvil (H-11).
