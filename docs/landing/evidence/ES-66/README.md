# ES-66 · Validación

- Backend: `npm test`, **76/76 pasan**, HTTP Express y JWT reales; modelos y proveedores simulados. Salida completa en backend-tests.txt. La línea «Tablas sincronizadas» procede del arranque con sequelize.sync simulado: **no se conectó ninguna base real**.
- Node 22.23.4: `node --test test/es-66-content.test.cjs`, **3/3 pasan**. Verifica rutas/roles, semilla idempotente con DB simulada y resolver frontend ES/EN con fetch simulado.
- Frontend: `npm run build` (incluye tsc -b), exit 0. JS 520.32 kB (gzip 132.56), CSS 9.88 kB (gzip 2.61). Advertencia JS >500 kB permanece.
- ESLint `src/content src/pages/admin/AdminContent.tsx`: exit 0, cero errores y dos advertencias existentes en las otras pestañas del archivo. No se tocan sus hooks por la excepción limitada a campos.
- Lint global: exit 1, mismos 4 errores y 9 advertencias de main.
- Auditoría backend `npm audit --omit=dev --audit-level=high`: exit 0; 6 moderadas, 0 altas/críticas. Sin cambios de dependencias. Frontend instalado con audit 0 vulnerabilidades.
- Sintaxis Node de los JS nuevos/modificados: correcta. Sin cambios en rutas o esquemas ajenos al contenido.

Chromium aislado contra Vite preview local: **23 campos muestran valores ES y EN**, se envían dos PUT correctos para landing.hero.title y cada uno muestra confirmación. API, sesión y persistencia simuladas; el control de permisos se verificó aparte por HTTP real. Captura: [campos del editor](editor-fields.png). Los cinco campos antiguos se ven vacíos únicamente porque el fixture visual solo contiene el catálogo nuevo; el backend real sigue ofreciendo sus defaults anteriores.

No verificado: persistencia o transacciones en Postgres real, carga de semilla en staging, contenido nuevo visible en la landing (depende de ES-62/63/64), producción. El selector de idioma, layout y estados del editor existente no se modificaron. El texto ficticio de docencia mantiene pendiente revisión D-07 antes de publicar.

El primer intento de tests en sandbox falló con EACCES al conectar a localhost; la repetición con acceso local permitido pasó 76/76. La primera prueba visual tuvo un selector ambiguo ES (cabecera/editor), corregido en el script de prueba sin cambios de producto.
