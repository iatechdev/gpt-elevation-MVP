# ES-34 · Vista preliminar y verificación

28-oct-2026 · [Dev-Codex]. Rama ES-34-rutas-experimento-plan desde main `6dc61e9`. Diseño 41 publicado en Jira 10264, aprobado explícitamente en el chat; registro 10265. Ante la delegación de la decisión sobre costos se aplicó la recomendación: **Costo por confirmar**, sin asumir gratuidad ni cerrar ese criterio integral.

**Entrega únicamente del tramo preliminar aprobado, no ES-34 integrada ni piloto.** Sin backend, endpoints, modelos, migraciones o dependencias nuevas. ES-14/ES-32/ES-33 reales, lector canónico de contexto, permisos de revisión humana, costo inicial conocido y E2E con datos curados siguen pendientes. No se fusionan PR ajenos.

## Qué incluye

- Rutas `/app/next-step`, `/experiments`, `/experiments/:id` y `/plan`, bajo el prefijo anterior y ProtectedRoute existente. Tarjeta Mi siguiente paso al principio del cuerpo del dashboard, una fila; sin cambiar sus widgets, chat, ánimo, terapeuta o backoffice.
- Restricciones, comparación de una/dos/tres opciones sustentadas dentro de los fixtures, preferencias/transferencia/viabilidad separadas, detalle de fuente sintética/fechas, idioma/modalidad, habilitación pendiente y oferta vencida. Sin datos de las seis personas, porcentajes o resultados reales inventados.
- Elección/rechazo e historial; prueba neutral con costo desconocido, inicio/entrega/ayuda declarada/reflexión/decisión. Historia de versiones y rebase que conserva entregas anteriores como historia. Sin acreditar competencias por checkbox.
- Solicitud humana explícita/retirada, siempre pendiente de autorización y sin material compartido; ninguna autoría/retroalimentación profesional fingida.
- Propuesta de acciones 7/30/90 sin preaceptarlas ni poner fechas ficticias; revisión exacta, aceptación, presupuesto/costo declarado y recurso con precio por confirmar. Al aceptar se retira el editor de propuesta y se muestra el plan confirmado. Versiones anteriores recuperables, pausa y finalización declarada con evidencia.
- Recordatorios solo dentro de app; permiso simulado y aceptación de acción separados, zona sintética America/Bogota visible, acuse explícito/cancelación. Revocar/reotorgar no resucita una aceptación antigua.
- ES/EN, dark/light según sistema, estilos daisyUI solo en career-scope, controles nativos etiquetados, contraste, salto al contenido/foco, salida/Atrás/Escape y reduced-motion.

## Activación y almacenamiento

Solo el valor de build **VITE_ENABLE_CAREER_PREVIEW=true** activa esta simulación. Sin bandera: tarjeta ausente, sin hueco, y visita directa muestra estado no disponible, sin formularios/datos. No hay selector de runtime para pasar datos de la simulación a API real; no hay fallback desde una respuesta real 503 a datos de ejemplo.

Para revisar localmente desde frontend, PowerShell:

```powershell
npm ci --ignore-scripts
$env:VITE_ENABLE_CAREER_PREVIEW='true'
npm run dev
```

Abrir /app/next-step con una sesión de desarrollo. Esto no despliega ni activa producción. Quitar la variable para volver al defecto apagado. No guardar variables o tokens en Git.

Los DTOs del módulo fixture son **modelos de vista sintéticos**, con un controlador asíncrono en memoria inspirado en los contratos publicados; no son un adaptador JSON wire probado contra Express. El motor profesional real no se traslada a frontend. No se habilita transporte real ni se afirma fidelidad completa de esquemas/errores de backend. Al integrar deberán mapearse/validarse esos DTOs y probarse propiedad y autorización en servidor.

No hay fetch, escritura API, cookies ni persistencia de muestras, planes, restricciones o decisiones. Solo se reutilizan token/idioma ya existentes. Recarga o cambio de sesión crea otra simulación vacía. No se envían datos a LLM, fuentes, revisores o empleadores. Abrir un enlace example.org es explícito, otra pestaña y noopener/noreferrer; no hay scraping o previsualización automática.

El proveedor separa estado visible de estado simulado confirmado: un ACK perdido no publica el cambio como guardado hasta recuperar. Repetición exacta de intención recupera sin duplicar; cuerpo distinto da conflicto. Borradores por instancia de formulario, sin que guardar otra sección los borre silenciosamente; cancelación explícita resuelve borradores simultáneos. Durante error/red incierta se conserva el texto y se exige recuperar antes de volver a mutar.

ProtectedRoute actual solo verifica existencia de token. La prueba del navegador usa una cadena sintética para abrir ese guard del cliente: **no prueba JWT, roles ni aislamiento real de cuentas**. Retirar/sustituir el token limpia los fixtures; no sustituye la verificación de dueño del servidor pendiente de integración.

## Resultados locales reales

| Comando / comprobación | Resultado |
| --- | --- |
| npm run lint | exit 0, cero errores/cero advertencias; sin desactivar reglas |
| npm test | exit 0, 32/32, incluidas diez nuevas ES-34 |
| Nuevas pruebas con Node 22 (CI) | exit 0, 10/10 |
| npx tsc -b | exit 0 |
| npm run build | exit 0; JS 574,84 kB gzip 149,43; CSS 60,85 kB gzip 10,18 |
| npm audit --audit-level=high | exit 0, 0 vulnerabilidades |
| Chromium aislado, app compilada | siete builds, once grupos PASS, cero escrituras API/cero excepciones JavaScript |
| git diff --check / sintaxis del arnés | exit 0 |

Se conserva la advertencia >500 kB. Frente a main, JS pasa de 522,56 a 574,84 kB y CSS de 30,93 a 60,85 kB por componentes/estados de la nueva vista y módulos daisyUI de formularios. No se relaja el umbral ni se presenta como optimización. Dependencias/lockfile intactos. Backend y migraciones sin cambios: no se declaran pruebas backend locales nuevas ni integración real por este trabajo.

Diez unitarias cubren ES/EN completo, apagado estricto, módulo sin red/almacenamiento, vacíos/restricciones/una o dos opciones, idempotencia, entrega/reflexión/ayuda/historia, dependencias/fechas/esfuerzo/costo, rebase, recordatorios y revocación/reotorgamiento, ACK perdido/recuperación y error, separación de simulaciones y contrastes de tokens claros/oscuros (texto ≥4,5:1, controles/foco ≥3:1). No equivalen a una auditoría universal de accesibilidad ni a pruebas del motor profesional.

## Navegador reproducible

Se usa Playwright del runtime de herramientas, sin añadirlo como dependencia del producto. Desde frontend:

```powershell
$env:PLAYWRIGHT_MODULE='<ruta al módulo Playwright instalado>'
# Opcional: build limpio de main para comparación antes/después del dashboard.
$env:ES34_BASELINE_DIST='<ruta al dist de main 6dc61e9>'
node scripts/es34-browser.cjs
```

El script crea builds propios en node_modules/.es34-build-*, verifica el destino antes de vaciarlo, sirve solo archivos de esos builds en loopback y usa contextos Chromium nuevos. No abre perfiles humanos. Tokens/casos y respuestas GET del dashboard son sintéticos. Toda escritura /api/* se intercepta, registra y hace fallar la comprobación final; se observaron cero. Se cierran contextos, navegador y servidores al terminar. Artefactos/capturas quedan ignorados en node_modules/.es34-artifacts, sin datos reales ni versionar el build.

Once grupos PASS:

1. Defecto apagado: entrada ausente, URL no disponible y sin datos/controles.
2. Dashboard: una tarjeta nueva; texto y anchos de columnas/widgets anteriores idénticos al build main, salvo la fila añadida y desplazamiento vertical aprobado. Comparación realizada con build de main `6dc61e9`, no inferida solo de un diff.
3. ES de punta a punta: restricciones → tres casillas → elección → aceptar prueba → ayuda/entrega → solicitar/retirar revisión → reflexión → decisión → plan aceptado → recordatorio y acuse → finalización → recarga vacía. El reloj de la **página de prueba** se fija después del vencimiento para comprobar acuse, sin fingir scheduler ni días de espera reales.
4. 320/375/768/1440, oscuro y reduced-motion; zoom CSS 200 % sobre viewport 768 (384 px efectivos), primer Tab/salto y foco de 3 px; labels ≥16 px/44 px de alto, checkbox ≥20 px, botones ≥44 px. Cambio ES→EN conserva campos; diálogo/Escape, salida aceptada y Atrás cancelado conservan el borrador; token distinto retira el estado.
5. EN completo hasta plan aceptado, sin controles/mensajes residuales ES (idioma real del recurso y autónimo Español son excepciones intencionadas).
6. Build save-error: sin falso guardado ni pérdida del borrador.
7. Build lost-ack: sin nuevo estado visible antes de recuperación; recuperar lo muestra sin doble mutación.
8. Build conflict: conserva borrador y pide recuperación/revisión.
9. Build pending: contrato pendiente, sin resultados inventados.
10. Build load-error: sin afirmar que una lista está vacía por fallo de lectura.
11. Cero escrituras API y cero excepciones JavaScript durante todos los escenarios.

Capturas inspeccionadas: comparación de rutas de escritorio, móvil oscuro, experimento, plan confirmado ES/EN y zoom; antes/después del dashboard capturado y comparado por estructura/texto/anchos. No se hizo comparación pixel-perfect ni prueba con lector de pantalla, navegador físico, Firefox o Safari.

## Incidencias encontradas y corregidas

- Selector envuelto por label incluía opciones en su nombre consultado: etiquetas accesibles explícitas que conservan el texto visible. El primer recorrido de navegador falló antes de esta corrección.
- El listener de Atrás registrado después del router permitía una salida sin confirmación. Registro temprano con manejador activo solo en CareerShell; fuera de él no modifica navegación. La corrida posterior comprobó restauración/cancelación.
- El enlace de salto oculto por transform aparecía en una captura de página completa al desplazarse; ocultación accesible mediante clip-path, visible al foco.
- Los errores y botón de reintento compartían un nodo textual: mensajes en párrafos independientes dentro del estado accesible.
- La comprobación del arnés pretendía que el checkbox de consentimiento estuviera confirmado antes del ACK asíncrono: se cambió a clic + espera del estado confirmado, sin introducir guardado optimista.
- La primera prueba de zoom pedía 187,5 px efectivos (375/2), por debajo del alcance 320; se verificó correctamente 200 % con 384 px efectivos y se conservan pruebas separadas a 320.
- Lint detectó un import sin usar y mutación del argumento de un hook al crear su clave. Se corrigió código con variable local; reglas/configuración intactas.

Corridas finales de lint/tipos/pruebas/build y navegador verdes; los fallos iniciales no se cuentan como aprobados.

## Pendientes de aceptación integrada

ES-14/ES-32/ES-33 reales, parsers/adaptadores de sus respuestas, fuente canónica de disponibilidad/zona, API/consentimiento real de notificaciones, catálogo curado, costo inicial conocido, revisión humana autorizada/retención y consola ES-35. Repetir con backend real dueño A/B y roles; no tomar aislamiento de fixtures como seguridad de cuentas. Staging, migraciones, despliegue, piloto y entrevistas con personas reales no verificados. Nunca se fusiona desde Dev ni se cierran hilos de QA.
