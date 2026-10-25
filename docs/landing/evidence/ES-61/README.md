# ES-61 · Evidencia de validación

Base comparada: 8af7f98 (el código de 573669b es idéntico; solo agrega la maqueta y documento aprobados). Implementación: 9c3b5f1. Windows, Node 24.14; tipos, lint del alcance y tests también comprobados con Node 22.23.4 antes del ajuste final de tokens CSS.

- `npm test` en frontend: 2 pruebas, 2 pasan; contraste WCAG AA de texto/estados en ambos temas y aislamiento de configuración. Ocre de texto 5.54:1 sobre papel; decorativo 2.69:1, no usar para texto.
- `node node_modules/eslint/bin/eslint.js src/pages/LandingPage.tsx src/components/landing`: exit 0.
- `npx tsc -b`: exit 0.
- `npm run build`: exit 0; salida real en build-output.txt. Advertencia del chunk de JS mayor de 500 kB.
- `npm run lint`: exit 1, 4 errores y 9 advertencias, iguales a main, en zonas expresamente excluidas. Salida real en lint-output.txt. No se cambiaron reglas ni el carácter no bloqueante existente del paso de lint en CI.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades.

| Artefacto principal | Antes | Después |
|---|---|---|
| Landing escritorio claro | [Antes](landing-before-1440-light.png) | [Después](landing-1440-light.png) |
| Landing móvil oscuro | [Antes](landing-before-320-dark.png) | [Después](landing-320-dark.png) |
| Login | [Antes](-login-before.png) | [Después](-login-after.png) |
| Usuario | [Antes](-app-dashboard-before.png) | [Después](-app-dashboard-after.png) |
| Admin | [Antes](-admin-dashboard-before.png) | [Después](-admin-dashboard-after.png) |
| Terapeuta | [Antes](-therapist-dashboard-before.png) | [Después](-therapist-dashboard-after.png) |
| Board | [Antes](-board-manifest-before.png) | [Después](-board-manifest-after.png) |

Comparación visual automatizada con Chromium headless aislado, builds locales servidos por Vite preview (4194 antes, 4193 después). Se compararon estilos computados de todos los elementos de cinco rutas: login, usuario, terapeuta, admin y board; iguales antes/después. Las API devuelven **503 simulado** para comparar estados de error renderizados, con rol y sesión sintéticos locales, sin autenticación real. Cada página se comprobó no vacía. Esto no acredita los estados con datos ni los flujos de esas zonas.

Landing en 320, 768 y 1440 px, claro/oscuro: sin desbordamiento horizontal, Inter propio, peso 800, tema sin variables filtradas al body, foco visible con Tab y transiciones desactivadas en reduced-motion. API de contenido responde 503 simulado; el contenido legado de respaldo continúa apareciendo. [Salida real](browser-output.txt).

Las conexiones HTTPS externas se bloquearon en la prueba aislada: la imagen remota y fuentes globales de Google pueden verse ausentes. La nueva fuente de landing es local y sí carga. Las capturas muestran solo ES-61 con el contenido legado; no son la landing final ES-62/63/64. El héroe definitivo aprobado aún no se implementa aquí.

No verificado: Postgres, contenido editable integrado, staging, producción, lector de pantalla manual, API autenticada real. No hay cambios de backend, esquema o permisos en este ticket. QA y CI remotos pendientes al abrir el PR.
