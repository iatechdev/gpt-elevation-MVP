# Pruebas de UX/UI con Playwright (ES-147)

Carpeta **aislada**: tiene su propio `package.json` y no forma parte de la instalación raíz, de `backend/` ni de `frontend/`. No entra en las imágenes de Docker ni en el despliegue de Railway.

## Qué cubre hoy
Pantallas **públicas** (landing y acceso), en **español e inglés**, en **escritorio y móvil**:

- La página carga con contenido y sin errores de consola.
- Sin desborde horizontal.
- El teclado llega a un control con foco visible.
- Accesibilidad automática (axe, WCAG 2 A/AA): sin violaciones graves ni críticas.

No inicia sesión ni escribe datos. Las pruebas con cuentas (por rol) se añaden después, leyendo las credenciales **solo** de variables de entorno.

## Cómo correrlas

```bash
cd e2e
npm ci
npx playwright install chromium     # descarga el navegador (una vez)
npm test                            # contra el staging por defecto
```

Variables de entorno:

| Variable | Para qué | Por defecto |
|---|---|---|
| `E2E_BASE_URL` | Destino de las pruebas | el staging |
| `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` | Cuenta de persona (futuras pruebas) | sin definir |
| `E2E_THERAPIST_*`, `E2E_ADMIN_*`, `E2E_SUPERADMIN_*` | Idem por rol | sin definir |

`E2E_BASE_URL` **solo acepta** `localhost` / `127.0.0.1` o un staging `https://backend-staging-*.up.railway.app`. Cualquier otro destino (incluida producción) hace fallar la configuración (`lib/target.ts`).

Para correr contra la app local: `E2E_BASE_URL=http://localhost:8080 npm test`.

## Reporte
`npm run report` abre el reporte HTML. Las capturas, trazas y videos se guardan **solo ante fallos** en `test-results/` y `playwright-report/` (ignorados por Git).

## Reglas
- Nunca poner credenciales, tokens ni datos personales en el repositorio, en los tests ni en capturas versionadas.
- Usar solo cuentas **sintéticas** de staging. Las claves se piden a Mauricio por un canal privado.
- No apuntar a producción. No hacer pruebas de carga desde aquí.
- Para ejecutar en CI se necesita descargar navegadores (pesan): hoy se corre a mano; evaluar después.
