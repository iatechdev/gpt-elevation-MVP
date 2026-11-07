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
