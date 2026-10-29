# ES-38 — Preparación y referencia anterior a la integración

Fecha: 29-oct-2026. Base de producto: main `d5eb00f9d0a035c6c98506038490f32087d4acc6`. Rama de trabajo: `ES-38-integracion-es-en`. Node v24.14.0, npm 11.9.0, Windows. Esto registra preparación independiente, no una entrega completa de ES-38.

## Dependencias y alcance

Plan completo aprobado por Alejo; referencia en Jira ES-38, comentarios 10499 y 10500. ES-37 permanece sin integrar en la comprobación de esta preparación: [PR 84](https://github.com/iatechdev/gpt-elevation-MVP/pull/84), head `d0d2c1ca940ee032274075f5fb8ffa159324b26a`. Aplicar el tema espera su integración. Dev no fusiona este PR.

No cambios en pantallas, estilos del producto, rutas, contratos, modelos, migraciones o dependencias durante esta preparación. La matriz generada desde el AST de App.tsx permite localizar cada ruta y sus guards cliente, resolver paths relativos e identificar contenedores y redirecciones. No es una auditoría de permisos del servidor ni una revisión visual.

## Resultados medidos

| Comando | Resultado real |
| --- | --- |
| frontend: `npm test` | Exit 0; 156 pruebas, 156 pasan, 0 fallan, 0 omitidas; 68773.5136 ms |
| frontend: `npm run lint` | Exit 0; sin errores ni advertencias |
| frontend: `npm run build` | Exit 0; tsc -b y Vite correctos; 168 módulos, 47.62 s de build |
| backend: `npm test` | Exit 0; 388 pruebas, 388 pasan, 0 fallan, 0 omitidas; 140110.0503 ms |
| frontend: `npm audit --json` | Exit 0; 0 vulnerabilidades |
| backend: `npm audit --json` | Exit 1; 6 moderadas, 0 altas, 0 críticas |
| frontend: inventario de rutas | Exit 0; 53 declaraciones con path/index: 46 entradas de pantalla, 4 contenedores, 3 redirecciones |

Las pruebas de backend existentes incluyen HTTP local con dobles de modelos/proveedores. Este comando no equivale a ejecutar las suites separadas de integración con PostgreSQL real. En su salida aparecen mensajes de sincronización y un NotFoundError del fallback SPA bajo la ruta oculta `.codex`; el proceso finaliza con 388/388 y exit 0. No afirmar que esos mensajes acreditan una base PostgreSQL real ni una visita válida de la SPA.

Build: CSS 111.79 kB (16.48 kB gzip), JavaScript 818.54 kB (218.61 kB gzip). Vite avisa de chunks superiores a 500 kB y del tiempo de callbacks de plugins; no hay fallo de compilación. No se silenciaron advertencias ni se cambió el límite del bundler.

La auditoría del backend identifica @google-cloud/storage, gaxios, retry-request, sequelize, teeny-request y uuid, con el aviso transitivo GHSA-w5hq-g745-h8pq. No se ejecutó audit fix; las sugerencias incluyen cambios mayores o regresivos de dependencias. Este resultado no se presenta como verde ni como vulnerabilidad corregida por ES-38. La HU visual no autoriza una migración de Sequelize o del proveedor de almacenamiento.

## Pendiente de medir

- Capturas antes/después, contraste, responsive, teclado, zoom y estados ES/EN. Todas las filas visuales siguen como «No ejecutada».
- Integración del tema tras ES-37 y revisión de las dependencias de las pantallas de profesionales.
- Pruebas de aceptación integradas, roles con servidor/DB reales y CI del futuro PR de ES-38.

Después de integrar ES-37 se debe actualizar la base, regenerar el inventario y medir otra referencia antes de aplicar los cambios propios. Los números anteriores son de esta revisión concreta de main y no certifican otro commit.
