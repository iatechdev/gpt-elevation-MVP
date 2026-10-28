# ES-16 — implementación y evidencia

27-oct-2026 · Dev-Codex. Diseño/textos/plan: Jira 10223 y `27-ES-16-DISENO-Y-PLAN.md`. Aprobación explícita: «Aprobar implementación con publicación desactivada». Base `main` 4311d69.

## Entregado

- Tres ejercicios editoriales ES/EN (reflexión, valores y contribución), una pregunta activa, propósito y tiempo orientativo; versión 1 y `reviewStatus: draft`, sin revisor/fecha inventados.
- `/app/exercises`, notas opcionales solo en RAM, copia manual al portapapeles, confirmación de salida y eliminación al cambiar sesión. Idioma cambia la interfaz conservando las notas originales. Omitir/cerrar no envía datos ni crea tareas, eventos o puntuaciones.
- `VITE_ENABLE_COMPANION_EXERCISES` exige literalmente `true`; por defecto no hay enlaces y la URL directa no muestra el catálogo. Compilación local de revisión usa la bandera y muestra «Contenido en revisión. No habilitado para el piloto». No se habilitó producción.
- Identificación de IA, bienvenida y estado de preparación ES/EN en los dos chats, con enlace condicional a ejercicios; sin rehacer envío, checkout, backoffice o diario.
- Límites fijos del prompt: permitir cierre sin pregunta, omitir/pausar sin presión y no simular lectura humana en vivo. Se mantienen fortalezas sustentadas y límites no clínicos.
- Frases completas de pausa ES/EN acotadas: respuesta breve fija, sin pregunta ni llamada al modelo. La seguridad high/medium conserva prioridad. Se reutiliza confirmTurn y requestId, sin nuevas APIs/tablas/migraciones.
- Fallbacks 502/500 bilingües y logs de error del chat limitados al nombre del error para evitar volcar parámetros o texto privado.

## Seguridad y privacidad

Propietario resuelto por `verificarToken` y `req.user.id`; diario seleccionado usa el filtro existente UserId/deletedAt y los turnos se recuperan por UserId/requestId. No se introducen identidades, permisos ni consentimientos alternativos. La pausa conserva el cifrado/transacción existente de mensaje y respuesta; no se guarda una etiqueta de riesgo ni un estado clínico de pausa. Las notas del ejercicio no llegan a API, modelo, almacenamiento web, URL, logs, carrera, facilitador o analítica. El portapapeles es una excepción local **solo por clic explícito**, con destino avisado, nunca una copia automática.

## Resultados locales finales

Node 24.14.0; CI del proyecto usa Node 22.

| Comprobación | Resultado real |
| --- | --- |
| frontend `npm run lint` | exit 0, 0 errores y 0 advertencias; sin nuevas reglas silenciadas |
| frontend `npm test` | exit 0, 26/26 (4 nuevas ES-16) |
| frontend `npx tsc -b` | exit 0 |
| frontend `npm run build` sin bandera | exit 0; JS 532,28 kB / gzip 136,85; CSS 39,16 kB / gzip 7,59 |
| frontend build de revisión con bandera `true` | exit 0; salida separada en node_modules/.es16-preview, no versionada |
| frontend `npm audit` | exit 0, 0 vulnerabilidades |
| backend `npm test` | exit 0, 212/212 (7 nuevas ES-16), modelos/crypto/proveedor simulados del arnés existente |
| backend `node --check` de ruta y helper | exit 0 |
| backend `npm audit --omit=dev --audit-level=high` | exit 0, 6 moderadas conocidas; sin altas/críticas; dependencias sin modificar |
| `node test/integration/es-16-postgres.cjs` | exit 0, 5 grupos HTTP/JWT/Sequelize/cifrado/PostgreSQL reales |
| `node scripts/es16-browser.cjs` | exit 0, 7 grupos con React compilado y Chromium; GET de chat y Clipboard API simulados |

Build conserva aviso >500 kB (base: JS 522,56 kB / gzip 133,49; CSS 30,93 kB). No se relaja el umbral ni se oculta. Aumento aproximado: 9,72 kB JS. Revisión del aviso queda para Mauricio/QA.

### Backend automatizado

Reconocimiento acotado de peticiones completas, con citas/negaciones/preguntas que no activan pausa; idioma explícito sobre idioma de frase; replay sin mensajes duplicados; ES-21 high conserva interrupción y medium su camino previo; prompt ordinario termina con límites fijos; A/B/admin no recuperan turnos ajenos ni usan diario ajeno; proveedor fallido conserva conversación válida y responde EN; un error con texto/parámetros privados sintéticos no los registra y devuelve fallback EN. La suite incluye regresión de ES-20/21/22.

Esto verifica el contrato y las instrucciones enviadas al proveedor simulado, **no** la calidad semántica de respuestas de Claude real ni una validación especializada.

### PostgreSQL real (cinco grupos)

1. Una pausa crea un par de mensajes y un ChatTurn cifrado v2; replay devuelve la misma respuesta sin duplicar filas ni llamar al proveedor.
2. Usuario B y administrador con otro ID reciben 404 al consultar requestId de A; diario de B usado por A: 404; sin token: 403; historial de B no contiene mensajes de A.
3. Pausa EN localizada y un escenario grave conserva la respuesta prioritaria de ES-21, con cero llamadas al proveedor.
4. Fallo deliberado en la segunda escritura de Message hace rollback real de la transacción; el turno queda failed y el mismo requestId puede confirmar después solo un par.
5. JWT revocado: 401; ninguna pausa genera un AiUsage.

Se usa PostgreSQL 17.10 desechable y puertos loopback aleatorios; credenciales generadas en memoria, conexión inyectada antes de cargar módulos reales, actores sintéticos y .env/DATABASE_URL existentes sin usar. El proveedor se reemplaza por un centinela de cero llamadas. No hay HTTP a Anthropic ni producción. Un fallo de escritura se inyecta explícitamente; el ORM/DB/cifrado/transacción son reales. Se detienen conexión, HTTP y PostgreSQL incluso al fallar; el proceso devuelve 1 tras limpiar recursos.

El primer montaje del arnés falló por no cargar PricingPlan y después por no crear los User sintéticos que exige la FK de Message. Se corrigió el arnés, sin quitar índices/constraints del modelo. Ese fallo también evidenció el volcado de errores SQL en el catch del chat; se corrigió el log y se añadió regresión de privacidad.

### Navegador (siete grupos)

1. Compilación por defecto oculta enlace/catálogo incluso con URL directa, y el chat se identifica como IA.
2. Compilación de revisión muestra tres tarjetas con aviso editorial; entrar/omitir vuelve al chat sin POST.
3. Una pregunta activa; notas originales conservadas al cambiar ES/EN, sin notas en solicitudes, localStorage, sessionStorage o URL; copiar solo al clic; éxito/fallo de Clipboard API mantienen el texto.
4. Salir pide confirmación; Escape/cancelar conserva notas; cerrar sin guardar las borra sin penalización.
5. Los tres ejercicios funcionan de forma individual; tarjetas/notas a 320/375/768/1440, zoom CSS 200%, reduced motion y sin desbordamiento. Capturas sintéticas fuera de Git inspeccionadas.
6. Cancelar Atrás conserva notas; cambiar token elimina notas y no produce seguimiento ni escrituras.
7. Primer Tab llega al salto de contenido y Enter enfoca main.

Clipboard API está simulada: **no se sobrescribió el portapapeles real del sistema** ni se declara su interoperabilidad comprobada. Los GET del chat también usan respuestas simuladas; los ejercicios no requieren backend. Se corrigieron selectores de estado que encontraban texto en el diálogo cerrado y la espera del arnés a una navegación cancelada, sin cambiar el flujo de la aplicación para acomodarlos.

## Reproducir

Desde backend, con sus dependencias fijadas y embedded-postgres instalado:

```powershell
node test/integration/es-16-postgres.cjs
```

Desde frontend:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4216 --strictPort
# En otra terminal: build de revisión; no altera dist por defecto
$env:VITE_ENABLE_COMPANION_EXERCISES='true'
npm run build -- --outDir node_modules/.es16-preview
npm run preview -- --outDir node_modules/.es16-preview --host 127.0.0.1 --port 4217 --strictPort
# En otra terminal, con Chromium de Playwright instalado
$env:PLAYWRIGHT_MODULE='<ruta a playwright instalado>'
$env:ES16_SCREENSHOT_DIR='<directorio de capturas fuera del repo>' # opcional
node scripts/es16-browser.cjs
```

Los puertos se pueden cambiar con ES16_RELEASE_URL/ES16_PREVIEW_URL, limitados a localhost/127.0.0.1. Estos arneses son pruebas locales opcionales; no se agregaron pasos CI. Las unitarias sí entran en npm test.

## Pendientes de aceptación

- ES-17/ES-24: revisión editorial ES/EN y escenarios sensibles por especialista identificado. El catálogo permanece draft y los ejercicios desactivados por defecto.
- Mauricio: validar integración de la pausa y límites del prompt; QA del PR pendiente. No se fusiona ni se cierran hilos desde Dev-Codex.
- No verificados: Claude real/calidad semántica generativa, staging/Railway/Supabase/producción, portapapeles real, Safari/Firefox y lector de pantalla real. No se declaran resultados clínicos ni revisión humana por pasar tests.
- Persistencia de diario, analítica de ejercicios y planes profesionales corresponden a ES-15/ES-36 y sus contratos, sin nuevas escrituras aquí.
