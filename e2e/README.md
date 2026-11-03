# Pruebas de UX/UI con Playwright (ES-147)

Carpeta **aislada**: tiene su propio `package.json` y no forma parte de la instalación raíz, de `backend/` ni de `frontend/`. No entra en las imágenes de Docker ni en el despliegue de Railway.

## Qué cubre hoy
Pantallas **públicas** (landing y acceso), en **español e inglés**, en **escritorio y móvil**:

- La página carga con contenido y sin errores de consola.
- Sin desborde horizontal.
- El teclado llega a un control con foco visible.
- Accesibilidad automática (axe, WCAG 2 A/AA): sin violaciones graves ni críticas.

Estas pruebas (`tests/publico.spec.ts`) no inician sesión ni escriben datos.

## Pruebas por perfil (`tests/roles.spec.ts`)
Con las 4 cuentas sintéticas de staging (persona, terapeuta, administrador, superadministrador). Corren **en serie y solo en escritorio** (el acceso está limitado a 10 por minuto por dirección). Necesitan las variables `E2E_<ROL>_EMAIL` y `E2E_<ROL>_PASSWORD` (ROL = USER, THERAPIST, ADMIN, SUPERADMIN), siempre por entorno y nunca en el repositorio; sin ellas se omiten.

- **Persona:** inicia sesión; un envío al chat que falla con 429 (simulado, no llega al servidor) queda como «sin confirmar», **sobrevive a recargar** y se recupera con «Consultar estado» → «Reintentar el mismo envío». El reintento hace **1 llamada real a la IA** (unos pocos miles de tokens de salida y ~15 mil de entrada; no medido).
- **Terapeuta:** ve a su persona asignada; por API **no recibe** los mensajes de la persona y no accede a la API de administración; no se queda en `/admin`.
- **Administrador:** en «Crear usuario» no puede elegir superadmin ni junta.
- **Superadministrador:** accede a los catálogos de habilidades y de rutas y puede elegir todos los roles.

Notas de diseño: la ruta `/app/chat` es una pantalla de la aplicación de una sola página (siempre responde 200), así que el aislamiento del terapeuta se comprueba por **datos en el servidor**, no por el código HTTP de la ruta. Las pruebas no crean cuentas ni escriben datos de otras personas.

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

## Auditoría de UX/UI (ES-148)
- `tests/auditoria.spec.ts`: recorre cada pantalla por perfil (público, persona, terapeuta, admin, superadmin), ES/EN, escritorio y móvil, con estados de error y cargando simulados. Solo lectura. Un acceso por rol; la sesión se guarda en `e2e/.auth/` (ignorada por Git). Enmascara correos antes de capturar. Salida: `docs/ux/capturas/`.
- `tests/maquetas.spec.ts`: verifica (sin red) las maquetas de `docs/ux/maquetas/` con axe y teclado y genera sus imágenes.
- `scripts/con-credenciales.mjs`: lanzador que lee el archivo local de cuentas sintéticas y las pasa solo como variables de entorno del proceso hijo (no imprime ni guarda valores):

```bash
node scripts/con-credenciales.mjs "<ruta al archivo local>" npx playwright test tests/auditoria.spec.ts --project=escritorio
```
Variables útiles: `E2E_ONLY=PUBLICO|USER|THERAPIST|ADMIN|SUPERADMIN`, `E2E_LANGS=es,en`, `E2E_TAG`, `E2E_CAPTURE_DIR`. Las capturas del repo se recomprimieron a JPEG (calidad 70).
