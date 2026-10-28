# ES-30 — Mi mapa, alcance frontend de solo lectura

Diseño publicado en Jira ES-30, comentario 10197; aprobación explícita de Alejo
registrada en 10199. Rama ES-30-mi-mapa desde main 7c63e68. Solo cambia frontend/.

## Contrato y límites

- Página protegida /app/skill-map y acceso desde el cuerpo del dashboard.
- Solo GET /api/skill-map con el token existente y cache: no-store. No recibe IDs
  de personas, no llama endpoints de administración/evidencias ni emite mutaciones.
- Contrato verificado leyendo ES-29, PR #30, head 0fe809d. El endpoint aún no está
  integrado en la base main de esta rama. La ausencia/HTML del SPA se muestra
  como “mapa no disponible”; no se convierte en una lectura vacía válida.
- Pistas self y review separadas; sin promedio, radar, déficit, porcentajes ni
  puntuación global. null nunca es cero. stale oculta nivel/confianza anteriores.
- Rúbrica cambiada: el nivel se identifica como registrado con una rúbrica
  anterior; los criterios desplegados son los del catálogo vigente, no los históricos.
- El GET solo entrega evidenceCount, no las evidencias/citas ni la versión exacta
  de la rúbrica histórica. No existe acción de objeción (ES-35). La pantalla explica
  estas limitaciones; no presenta botones que simulen esas funciones. Esos criterios
  de la HU original permanecen pendientes según la objeción del diseño aprobado.
- Contenido libre y fuentes se muestran como texto, sin HTML/Markdown ejecutable.
  Solo se traducen textos propios y los campos ES/EN recibidos del servidor.
- Sin contexto privado, datos de ánimo/chat/diario, caché persistente del mapa,
  exportaciones, cambios de identidad ni cambios al backend.

## Pruebas reproducibles

En frontend/:

```text
npm ci
npm run lint
npm test
npx tsc -b
npm run build
npm audit
```

`npm test` ejecuta el modelo/cliente TypeScript real, transpilado con la dependencia
existente typescript. Incluye DTO válido/malformado, null/stale, pistas separadas,
errores HTTP, contrato de GET, paridad ES/EN y contraste. No agrega dependencias.

Navegador (instalación de Playwright del entorno de QA, no perfil de una persona):

```text
npm run preview -- --host 127.0.0.1 --port 4230 --strictPort
node scripts/es30-browser.cjs
```

Variables opcionales: PLAYWRIGHT_MODULE para una instalación existente,
ES30_PREVIEW_URL para la preview loopback, ES30_SCREENSHOT_DIR para capturas fuera
del repo. Este script prueba React construido con HTTP simulado y fixtures
íntegramente sintéticos, incluyendo errores que no se fuerzan en un sistema real.

Integración adicional con GET real:

```text
node scripts/es30-api-integration.cjs
```

Requiere ES30_BACKEND_DIR apuntando al backend de un checkout aislado del contrato
ES-29, con sus dependencias instaladas. Si se usó npm ci --ignore-scripts, preparar
el binario embedded-postgres mediante su instalación normal/rebuild. Usa también
PLAYWRIGHT_MODULE y ES30_PREVIEW_URL. No modifica código de ese checkout.

El runner crea un clúster PostgreSQL 17 desechable en loopback con credenciales
aleatorias en memoria; sustituye únicamente la conexión del proceso de prueba.
No carga .env ni usa DATABASE_URL. Catálogo, verificador, evidencias y cuentas son
fixtures marcados sintéticos; su publicación existe solo en esa base desechable.
Emplea los modelos, cifrado, helpers, JWT, middleware y router reales de ES-29.
Un proxy loopback transparente sirve el GET real a la pantalla construida;
no sustituye el cuerpo de respuesta. No llama proveedores ni usa producción.
El navegador/servidor/conexión/clúster se cierran al finalizar.

## Resultado local, 27-oct-2026

Node 24.14.0, Windows; CI usa Node 22.

| Prueba | Resultado | Alcance real |
| --- | --- | --- |
| Lint | exit 0, 0 errores y advertencias | Sin silencios ni cambios de configuración |
| npm test | 24 pass, 0 fail | 17 anteriores + 7 de ES-30; fetch simulado en pruebas del cliente |
| tsc -b / build | exit 0 | 73 módulos; chunk 535,66 kB >500 kB, sin silenciar; base 522,24 kB |
| npm audit | exit 0, found 0 vulnerabilities | Frontend; dependencias sin cambiar |
| es30-browser.cjs | 13 comprobaciones, 0 excepciones de consola | Chromium aislado, HTTP mock |
| es30-api-integration.cjs | 6 comprobaciones, 0 excepciones de consola | GET, JWT, ORM, cifrado y Postgres reales; proxy local transparente |

Navegador: 320/375/768/1440 px, zoom 200%, teclado/salto/foco y movimiento reducido;
null/stale, contradicción y cambio de rúbrica; ES/EN sin alterar niveles; texto
hostil escapado; vacíos, 401/403/404/503, red, HTML y DTO inválido; actualización
fallida sin resultados antiguos, cancelación al salir, cambio de sesión y ausencia
de persistencia privada. Las capturas locales contienen solo fixtures sintéticos.

GET real: catálogo ausente; aislamiento A/B; pantalla con mapa A; cambio a B sin
texto de A; edición de evidencia A provoca stale/null; revocación JWT provoca
401 y limpieza de resultados. Checkout backend de prueba limpio al finalizar.

No verificado: staging/despliegue, cuentas reales, catálogo real, proveedor de IA,
detalle de evidencia/contexto y acción de objeción. La aceptación integrada del
piloto requiere que ES-29 esté fusionada/desplegada y tenga catálogo real publicado.
