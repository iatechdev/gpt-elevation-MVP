# QA-61-01 · Lint global sin errores ni advertencias

Corrección autorizada por Alejo para el PR ES-61 #9. Base comparada: 1f6b1b6.

**Exento de puerta de diseño:** solo tipos, eliminación de parámetro no usado y limpieza de dependencias de efectos. No cambian JSX, layout, rutas, textos o flujo. Comparación por AST TypeScript de los nodos JSX de los ocho archivos: idénticos antes/después (normalizando CRLF/LF). Sin eslint-disable, sin silenciar reglas, sin relajar configuración, sin cambios de dependencias ni CI.

## Cambios

- UserDashboard: elimina argumento sin usar, estabiliza cargador de historial y declara dependencias. El texto de bienvenida inicial conserva la instantánea de montaje; el check-in sigue usando el idioma actual. El cambio de idioma no vuelve a cargar el historial ni borra el borrador.
- BoardManifest: tres catch con unknown y comprobación de Error; cargador estable con el mismo token y fallback recibido por argumento. Una traducción no desencadena recargas; publicación y activación conservan sus llamadas y estados.
- AdminContent y AdminUsers: cargadores estables con sus dependencias reales (token o filtros); no cambian pestañas, layout, filtros ni textos.
- MyTherapist, UserProgress y TherapistDashboard: el fallback de error inicial se captura al montar, igual que el cierre del efecto original. La carga no vuelve a ejecutarse al cambiar el idioma.
- TherapistPatient: cargador estable por ID; el texto de error se mantiene actualizado en una referencia separada, sin convertir el idioma en una dependencia de la consulta. No cambian las acciones de notas o sesiones.

## Resultados reales

| Comando / comprobación | Antes | Después |
|---|---|---|
| npm run lint (frontend) | exit 1; 4 errores, 9 advertencias | **exit 0; 0 errores, 0 advertencias** |
| npm test (frontend) | 2/2 | 2/2 pasan |
| tsc -b + vite build (npm run build) | exit 0 | exit 0 |
| npm test (backend) | sin cambios de backend | **73/73 pasan**, HTTP/JWT reales y DB/proveedores simulados |
| npm audit (frontend, completo) | sin cambios de dependencias | **exit 0; 0 vulnerabilidades** |
| npm audit backend --omit=dev --audit-level=high | 6 moderadas conocidas | exit 0; mismas 6 moderadas, 0 altas/críticas |
| Geometría, estilos y textos de las dos pantallas | revisión 1f6b1b6 | idénticos en 390 y 1280 px |
| Peticiones y borradores | revisión 1f6b1b6 | misma secuencia; sin recargas por editar o cambiar idioma en usuario |

JS 518.78 → 519.30 kB (gzip 131.81 → 132.02). CSS 24.09 kB (gzip 5.16), fuente 48.25 kB: sin cambios. La advertencia de chunk JS >500 kB permanece; no se ajusta su umbral.

Salidas: [lint](lint-output.txt), [build](build-output.txt), [backend](backend-tests.txt), [navegador](browser-output.txt).

## Capturas antes/después

| Pantalla | Antes | Después |
|---|---|---|
| Usuario, escritorio | [Antes](user-1280-before.png) | [Después](user-1280-after.png) |
| Usuario, móvil | [Antes](user-390-before.png) | [Después](user-390-after.png) |
| Manifiesto, escritorio | [Antes](board-1280-before.png) | [Después](board-1280-after.png) |
| Manifiesto, móvil | [Antes](board-390-before.png) | [Después](board-390-after.png) |

Chromium aislado contra builds locales de la revisión anterior y posterior. Fixtures sintéticos con historial de chat, plan vacío y manifiesto activo. Se comparó texto renderizado y estilos/geometría de todos los elementos, además de la secuencia HTTP. En usuario se escribió y cambió ES → EN sin perder el borrador o historial ni realizar nuevas consultas. En board se abrió el formulario, escribió y provocó un error HTTP 503 al publicar: mensaje y borrador conservados, sin petición de recarga. Board no tiene selector de idioma; no se inventó uno para la prueba.

Prueba reproducible: frontend/scripts/qa61-01-browser.cjs. Requiere Playwright/Chromium instalado como herramienta de pruebas, no como dependencia de producción. BEFORE_URL y AFTER_URL apuntan a previews locales (por defecto 4201/4202). PLAYWRIGHT_MODULE permite indicar la instalación de herramientas; EVIDENCE_DIR permite otra salida. No cambiar estos parámetros hacia servicios con datos reales.

Limitaciones: API/sesión simuladas en navegador; DB/proveedores simulados en suite backend. Fuentes remotas bloqueadas por igual en ambos builds. No se verificó Postgres, staging ni producción. El primer intento backend carecía de dependencias; tras npm ci pasó 73/73. Se corrigieron selectores del script visual (nota repetida y ausencia de selector EN en board), sin cambios de producto.

QA pendiente; no se resuelven hilos ni se fusiona el PR desde Dev.
