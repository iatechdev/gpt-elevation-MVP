# Base común de las historias de la plataforma (diseño «Cartografía»)

Cada historia de Jira (proyecto ES, épica ES-6) cita este documento en lugar de repetirlo. Quien implementa y quien prueba lee **primero esto** y después la historia.

## 1. Fuentes

| Qué | Dónde |
|---|---|
| Prototipo navegable (todas las pantallas, ES/EN, claro/oscuro, errores simulados) | `docs/ux/plataforma/index.html` (abrir con un navegador; la barra de arriba elige pantalla y simula errores) |
| Qué cubre cada ruta real y las decisiones abiertas | `docs/ux/plataforma/README.md` (tabla de cobertura y decisiones 1 a 35) |
| Textos ES y EN de todas las pantallas, por clave y archivo de origen | `docs/ux/plataforma/textos.json` |
| Tokens y piezas base | `docs/ux/plataforma/estilos.css` y `pantallas.css` |
| Código real del que parte cada pantalla | se nombra en cada historia (`frontend/src/...`) |

El prototipo es **referencia de diseño, no código para copiar**: son scripts sueltos con variables globales. Se reimplementa en `frontend/` (React + TypeScript) con la base tecnológica establecida; no se cambia de stack.

## 2. Definición de listo (todas las historias)

1. **Diseño aprobado.** La historia HU-P00 (puerta de diseño) está aprobada por Mauricio o Alejo. Si el diseño cambia durante la implementación, se vuelve a presentar.
2. **Fiel al prototipo** en estructura, estados y textos. Cualquier desvío se justifica en el PR.
3. **Todos los estados de la pantalla** existen: cargando, vacío, error con reintento, éxito, guardando, conflicto o confirmación incierta cuando la historia los nombra. Un error no borra lo que la persona escribió.
4. **ES y EN completos** desde `textos.json` (nada de texto fijo en el componente). Los textos EN son borrador: la revisión humana queda anotada en el PR.
5. **Teclado y foco.** Todo se usa sin ratón. Al abrir un diálogo el foco entra y al cerrarlo vuelve al disparador; Escape cierra. Tras guardar o fallar, el foco va al mensaje de estado. Un solo `h1` por pantalla. Enlace «saltar al contenido».
6. **Responsive** sin desplazamiento horizontal de la página a 390 px y a 1360 px. Las tablas anchas se convierten en tarjetas en móvil o se desplazan dentro de su propio contenedor.
7. **Accesibilidad.** axe-core (WCAG 2 A y AA) sin hallazgos graves ni críticos en claro y oscuro, ES y EN. El estado nunca se comunica solo con color: lleva palabra o símbolo. Objetivos táctiles de 44 px. Respeta `prefers-reduced-motion`.
8. **Tema.** Claro y oscuro con los tokens del sistema; el rojo se usa solo para errores; el azul tinta es la única marca.
9. **Reglas no negociables** (CLAUDE.md): producto no clínico (sin diagnóstico, prescripción ni promesas de empleo); nivel `null` cuando falta evidencia; sin datos, fuentes, ofertas o métricas inventados (los ejemplos del prototipo se sustituyen por datos reales del servidor o por estados vacíos); privacidad verificada en el servidor en cada acceso; ningún secreto ni dato personal en Git, PR, registros o chat.
10. **Pruebas** del propio código: unitarias para la lógica, integración con base de datos real donde la historia lo pide, y un caso de abuso por criterio sensible (IDs ajenos, revocación, concurrencia, entrada maliciosa).
12. **Nada administrable va quemado en el código** (decisión del PO, 7-nov). Etiquetas de «ejemplo», «datos ficticios» o «contenido de prueba»: las pone el servidor según un indicador guardado en el dato (`esSintetico` o equivalente), no el componente. Líneas de emergencia y datos de contacto, planes y precios, ejercicios, textos públicos, guías de la IA: se editan desde administración. Si un valor inicial no está verificado se marca así en el PR.
11. **PR** con resumen, criterios cubiertos (casillas), pruebas con su salida real, riesgos y «no verificado». No se fusiona el propio PR.

## 3. Pruebas base de QA (cada historia las hereda)

| Tipo | Qué se comprueba | Cómo |
|---|---|---|
| Funcional | Cada criterio de la historia; flujo feliz, de error y de borde; ES y EN; teclado; 390 y 1360 px; claro y oscuro | Vista previa del PR con datos sintéticos; Playwright en `e2e/` |
| Funcional | Regresión de las pantallas vecinas | Suite de `e2e/` |
| Seguridad | Cambiar un ID en la ruta o en la API no muestra, edita ni exporta datos ajenos (usuarios A y B); rol sin permiso recibe 403 y una pantalla explicativa; sesión vencida lleva a una pantalla clara; entradas con HTML o inyección se tratan como texto; ningún secreto ni dato personal en el paquete del cliente ni en los registros | Pruebas de API y de interfaz |
| Seguridad | Diario y señales de crisis nunca llegan al motor profesional ni a terceros | Revisión del contrato de datos |
| Rendimiento | Tiempos de respuesta de los endpoints de la pantalla; peso del paquete de la ruta; sin saltos de diseño al cargar | Umbrales propuestos por QA en su plan y aprobados por Mauricio o Alejo |
| Accesibilidad | axe en las dos lenguas y los dos temas; recorrido solo con teclado | `e2e/` con `@axe-core/playwright` |

Un hallazgo de seguridad Crítico o Alto = no se aprueba.

## 4. Cómo leer el prototipo

- **Barra superior:** elige la pantalla, simula el chat «sin conexión» o «límite de uso» (sirve para provocar errores de servidor en cualquier pantalla), cambia tema y ES/EN.
- **Línea «Prototipo:»** al pie de cada pantalla: botones que fuerzan cada estado (cargando, error, vacío, rol distinto…). Es la lista de estados a implementar.
- Los datos marcados **«(ejemplo)»** o con dominio `.invalid` son ficticios.
- Los botones «Simular» no existen en la plataforma real.

## 5. Decisiones abiertas que afectan a varias historias

Ver `README.md`, decisiones 1 a 35. Las que bloquean o condicionan trabajo se repiten en la historia afectada con su número. Quien implementa una historia con una decisión abierta construye la variante recomendada y la deja detrás de una constante fácil de cambiar, salvo que Mauricio o Alejo indiquen otra.

## 6. Índice de historias en Jira (épica ES-6)

Orden recomendado: HU-P00 (aprobación) → P01 a P03 y P38 (base) → pantallas → P39 (calidad, se alimenta de cada una).

| HU | Jira | Qué cubre |
|---|---|---|
| P00 | ES-151 | Aprobación del diseño (puerta de diseño) |
| P01 | ES-152 | Sistema de diseño: tokens, tipografías, componentes |
| P02 | ES-153 | Estructura y navegación por rol |
| P03 | ES-154 | Textos ES/EN desde `textos.json` |
| P04 | ES-155 | Portada, registro, entrar, recuperar |
| P05 | ES-156 | Restablecer contraseña |
| P06 | ES-157 | Solicitud pública de profesionales |
| P07 | ES-158 | Precios públicos |
| P08 | ES-159 | Punto de partida y Hoy |
| P09 | ES-160 | Mapa de competencias |
| P10 | ES-161 | Análisis con IA y retiro del permiso |
| P11 | ES-162 | Conversación |
| P12 | ES-163 | Diario |
| P13 | ES-164 | Evidencias |
| P14 | ES-165 | Hojas de vida |
| P15 | ES-166 | Siguiente paso: rutas y experimentos |
| P16 | ES-167 | Experimento y plan de acción |
| P17 | ES-168 | El Puente |
| P18 | ES-169 | Mi profesional y sala de la persona |
| P19 | ES-170 | Herramientas y ejercicios |
| P20 | ES-171 | Brújula |
| P21 | ES-172 | Catálogo de rutas (persona) |
| P22 | ES-173 | Progreso y opinión |
| P23 | ES-174 | Mis datos y Mi plan |
| P24 | ES-175 | Revisiones profesionales recibidas |
| P25 | ES-176 | Facilitación |
| P26 | ES-177 | Panel profesional |
| P27 | ES-178 | Ficha de la persona |
| P28 | ES-179 | Sala de sesión del profesional |
| P29 | ES-180 | Administración: panel y métricas |
| P30 | ES-181 | Guías de la IA |
| P31 | ES-182 | Manifiesto ético |
| P32 | ES-183 | Métricas del piloto |
| P33 | ES-184 | Contenido: validaciones y solicitudes |
| P34 | ES-185 | Contenido: planes y textos públicos |
| P35 | ES-186 | Personas usuarias |
| P36 | ES-187 | Catálogo de rutas (administración) |
| P37 | ES-188 | Catálogo de habilidades |
| P38 | ES-189 | Privacidad y seguridad transversales |
| P39 | ES-190 | Calidad transversal y e2e |
| P40 | ES-191 | Validación en servidor de las guías de la IA (nueva, 7-nov) |
| P41 | ES-192 | Invitación por enlace y contraseña con las reglas del registro (nueva) |
| P42 | ES-193 | Datos de contacto y línea de emergencia editables desde Contenido (nueva) |
| P43 | ES-194 | Administración de ejercicios: crear, editar y publicar (nueva) |

Las historias no tienen responsable ni estimación: Dev estima las suyas tras la aprobación del diseño (HU-P00).

## 7. Reparto entre desarrolladores (decisión del PO, 7-nov)

Se reparte por **etiqueta de Jira** (`dev-claude`, `dev-claude-2`, `dev-codex`) para que cada quien trabaje bloques de pantallas distintos y no se pisen archivos. La asignación nominal en Jira la hace el PO (las cuentas de cada desarrollador no se pudieron verificar desde aquí).

| Etiqueta | Bloque | Historias |
|---|---|---|
| `dev-claude` | Base, públicas, mapa, Hoy, datos | ES-152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 174, 189 |
| `dev-codex` | Experiencia de la persona (conversación a catálogo y progreso), revisiones recibidas y calidad | ES-162 a 173, 175, 190 |
| `dev-claude-2` | Familia profesional y administración, y las historias nuevas | ES-176 a 188, 191 a 194 |

**Orden:** ES-151 (aprobación) primero. Después ES-152, 153 y 154 (`dev-claude`) desbloquean a todos; mientras tanto `dev-codex` y `dev-claude-2` pueden preparar contratos de API, modelos y pruebas sin tocar `frontend/src/styles` ni la navegación. ES-189 (privacidad) y ES-191 (validación de guías) se integran antes de liberar las pantallas que dependen de ellas.
