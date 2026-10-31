# ES-38 · Acceso y navegación administrativa

[Dev-Codex] · 30-oct-2026. **Entrega parcial del plan completo, para revisión de código; ES-38 sigue En DEV.**

## Revisión de acceso aplicada después del feedback visual

La versión inicial de acceso descrita en las mediciones históricas de abajo no es el diseño final. El usuario pidió revisarla; Jira 10682 registra padding de input en 0 y placeholder de poco contraste, además de una jerarquía visual insuficiente. La maqueta revisada (adjuntos 10032–10034) fue aprobada explícitamente y quedó registrada en 10685.

Se aplica únicamente a acceso/registro: tarjeta de máximo 448 px, título Inter de 30 px/28 móvil, campo de 52 px con padding 12/14 px, acción principal y opción de crear cuenta secundaria. Utiliza la fuente local ya declarada como Elevation Landing Inter, sin nueva dependencia ni descarga. Los mensajes de sesión, validación y resultado siguen en el componente real; el handler, endpoints y selección de plan no cambian. La navegación administrativa no cambia con esta revisión.

Textos aprobados ES/EN: Ingresar / Sign in, ¿Primera vez aquí? / First time here?, ¿Ya tienes cuenta? / Already have an account?; Crear cuenta y su traducción conservan la clave editable existente. Se conserva el formulario nativo, sus etiquetas/autocomplete y el bloqueo de acciones durante envío. El título y la acción secundaria ya no duplican el texto largo de ingreso.

Verificación nueva en navegador: login y registro × ES/EN × 320/375/768/1440, 16 lecturas sin desborde. Padding computado 12px 14px; fuente local declarada en estilos; tarjeta 288 px a 320, 343 a 375 y 448 en escritorio. Contraste del placeholder **5.35:1** y borde **3.58:1** sobre el fondo del campo. No se toma la prueba antigua de contraste como prueba del placeholder: era una omisión que motivó esta corrección.

API simulada: envío demorado 2.5 s dejó aria-busy=true y ambas acciones deshabilitadas; al fallar se conservaron correo/contraseña y se habilitaron acciones. Registro simulado 201 volvió a login, borró contraseña y mantuvo plan=7. No se crearon cuentas reales ni se llamó al proveedor. La primera apertura de la pestaña del harness agotó la espera; se verificó HTTP local 200 y una apertura nueva funcionó. No se atribuye ese intento como un resultado verde.

Pruebas locales de la revisión: lint exit 0; suite completa 274/274 (31546.6843 ms) y repetición del subconjunto tras ampliar aserciones de título/acción secundaria 4/4. Build con tipos exit 0, 224 módulos, 3.62 s, CSS 170.69 kB/27.24 gzip y JS 1052.72 kB/281.46 gzip; conserva aviso de chunk >500 kB y PLUGIN_TIMINGS. Audit frontend exit 0, 0 vulnerabilidades. La repetición final de suite/lint y CI del nuevo commit se informan en Jira/PR con su resultado observado.

Repetición final, con las aserciones ampliadas: lint sin errores/advertencias y 274/274, 19846.1438 ms, exit 0. El primer intento de esta repetición no pudo iniciar por un error del lanzador de Windows (CreateProcessSecurityEnvironment); se repitió fuera del sandbox. No fue un fallo de la aplicación ni se omitieron pruebas para obtener el resultado.

Las capturas nuevas de la aplicación (Jira 10035 escritorio/10036 móvil) se distinguen de las maquetas del visor. Sin cambios de backend, modelo de datos, producción o alcance integral de la HU. Los resultados previos siguientes se mantienen como historial y no como aceptación visual del diseño rechazado.

## Diseño aprobado y base

Plan completo aprobado: Jira 10499/10500. Maquetas actualizadas: 10593, adjuntos 10025–10028. Aprobación explícita de acceso y navegación administrativa: 10594. Reanudación: 10676. Se implementa exclusivamente ese tramo. Inicio sigue preliminar y requiere presentar su composición integrada antes de modificarlo.

ES-37/#84 ya está integrado. Rama propia ES-38-integracion-es-en actualizada por merge desde main a21f43f; merge c284f7d. No se fusionaron PR ni se modificó main. El diff propio no incluye cambios de producto de otras ramas.

## Cambios

- Login consume los tokens CSS de ES-37 mediante elv-theme; etiquetas visibles asociadas, controles de 44 px, campo de contraseña con Mostrar/Ocultar, estados anunciados y enlace de salto. Conserva el handler de autenticación, intención de plan ES-73, verificación de sesión y destinos existentes. No convierte registro en login automático ni crea recuperación de cuenta.
- AdminLayout/AdminSidebar: cabecera en flujo, etiquetas ES/EN, logout visible y menú móvil con aria-controls/expanded. Escape cierra y devuelve foco; seleccionar un destino cierra y enfoca main. Un cambio de location.key deja cerrado el menú. Los destinos por rol se conservan, incluido el catálogo de habilidades recién integrado.
- CSS limitado a .access-page y .admin-shell; tokens.ts y tokens.css no cambian. El contenido administrativo ancho se desplaza dentro de main, sin forzar ancho de página ni eliminar columnas. Los interiores no se rediseñan ni se traducen en este tramo.
- No cambios en inicio, chat, diario, puente, mapas, catálogo, terapeuta, endpoints, modelos, migraciones, dependencias o CI.

## Pruebas locales y resultados reales

| Comprobación | Resultado |
| --- | --- |
| npm ci frontend | exit 0; 192 paquetes |
| Baseline npm test, antes de editar | 270/270, 9024.8835 ms |
| npm run lint final | exit 0, 0 errores y advertencias |
| npx tsc -b | exit 0 |
| npm test final | 274/274, 0 fallos/omitidos, 14970.0734 ms |
| npm run build final (incluye tsc -b) | exit 0; 224 módulos, 3.25 s; CSS 168.52 kB / 26.83 gzip, JS 1052.38 kB / 281.35 gzip |
| npm audit frontend | exit 0, 0 vulnerabilidades |
| git diff --check | exit 0 |

Build mantiene aviso de chunk >500 kB y aviso informativo PLUGIN_TIMINGS; no se relajan límites ni reglas. No se presenta el tamaño como optimización de rendimiento. El primer audit falló por DNS del sandbox; se repitió con acceso de red y devolvió 0 vulnerabilidades. El primer test nuevo falló por comparar autoComplete de SSR con casing distinto; se corrigió la comparación de atributo sin cambiar producto ni suprimir la aserción.

Las cuatro pruebas nuevas renderizan componentes reales con React y MemoryRouter: etiquetas/autocomplete ES/EN; ocultar formulario durante verificación y distinguir invalid/unavailable; destinos admin/superadmin; controles, salto y labels del shell. Idioma, contenido, almacenamiento y lectura de sesión son dobles explícitos. **No prueban autorización del servidor.**

## Navegador con API simulada

Harness CLI: frontend/test/support/es38-preview.mjs. Desde frontend:

```sh
node test/support/es38-preview.mjs
```

Abre únicamente 127.0.0.1:43121, utiliza Vite y captura todas las rutas /api/ con respuestas sintéticas. No se importa desde main.tsx, no se monta en Express, no firma JWT ni usa DB, .env o proveedor. No sirve para comprobar seguridad. Detener con Ctrl+C. No ejecutar junto con otra instancia en ese puerto.

Entradas locales reproducibles:

- `/__es38/start?role=admin&lang=es`: shell de administrador con métricas vacías simuladas.
- `/__es38/start?role=superadmin&lang=en`: destinos de usuarios y manifiesto adicionales.
- `/__es38/start?lang=es`: acceso anónimo; login simula 401 y registro simula 201, no crea cuentas.
- `/__es38/start?mode=locked&lang=es`: envío de acceso simula 423.
- `/__es38/start?role=invalid&mode=invalid&lang=es`: sesión simula 401.
- `/__es38/start?role=invalid&mode=unavailable&lang=en`: sesión simula 503.
- `/__es38/start?role=invalid&mode=checking&lang=en`: lectura demorada 6 s; formulario oculto durante espera.

La entrada de prueba limpia localStorage **solo de este origen local dedicado** y crea marcadores sintéticos. No introducir datos reales. Los ceros, nombre QA y versión fixture no son métricas del producto ni contenido del piloto.

Resultados observados:

- Login ES y EN a 320/375/768/1440: 8 lecturas sin desborde de página. La primera pasada con dos pestañas no aplicó el viewport a login (quedó en 1280); se descartó como prueba responsive y se repitió sobre la pestaña activa.
- Administración a los cuatro anchos: sin desborde de página. A 375 px, su interior conserva scroll local (scrollWidth 474/clientWidth 360); su adaptación e i18n internas siguen pendientes.
- Menú móvil abre; Escape produce aria-expanded=false y foco en Abrir menú. Seleccionar Dashboard deja foco en admin-main. Superadmin ve Usuarios/Manifiesto; admin común no, únicamente comprobación visual de presentación.
- Logout vuelve a login. Mostrar/Ocultar modifica type del campo. Registro simulado conserva `plan=7` al alternar y tras confirmar 201; muestra confirmación en inglés y vuelve a login, sin sesión inventada.
- Bloqueo simulado deja botón deshabilitado y texto accesible; sesión inválida presenta aviso; indisponible ofrece reintento; carga mostró 0 formularios.
- Contraste medido desde estilos computados: texto/papel 16.69:1, botón 17.43:1 y borde del campo/fondo 3.58:1.
- Captura real de login antes/después y capturas posteriores del shell escritorio/móvil. No se capturó el shell anterior en navegador: la comparación administrativa anterior se basa en código, no se presenta como evidencia visual antes/después completa.

## Seguridad, límites y pendiente integral

No se modifica el núcleo de Mauricio: autenticación, autorización, consentimiento, exportación, revocación o borrado. Los guards cliente conservan su comportamiento y **no son prueba de permiso servidor**. Sin endpoints/consultas personales nuevos ni DTO ampliado; no corresponde inventar una prueba nueva de IDs ajenos para este cambio de presentación. La seguridad real del backend queda en sus suites/QA existentes.

No se ejecutó backend local, PostgreSQL, migraciones, Claude, staging ni producción en esta entrega. Sin lector externo, zoom real 200%, dispositivos físicos o preferencia reduced-motion activada en vivo. CSS incluye la preferencia, sin declarar que se probó. Fuentes usan los tokens existentes; no se añadió descarga de fuentes.

Para completar ES-38: composición integrada del inicio y aprobación; revisar los demás grupos de la matriz completa, incluidos contexto/evidencias, interiores administrativos y junta, terapeuta tras integración, dominios con tema oscuro y recorridos ES/EN completos; pruebas de teclado/estados y accesibilidad pendientes. El dashboard administrativo aún contiene textos en español al seleccionar EN; sus interiores están fuera del tramo aprobado aquí, no se afirma bilingüismo de toda la HU.

Mantener un único PR de ES-38 como borrador mientras falte el resto; no marcar historia En QA/Lista por este tramo, no fusionar y no resolver hilos de QA. CI se informa por separado al observar su resultado real sobre el commit publicado.
