# ES-45 — Verificación del paquete preparatorio

[Dev-Codex] · 28-oct-2026.
Base origin/main6dc61e93542776147693e87b6e95c9c4c0b47d22; rama ES-45-aceptacion-e2e.

Plan publicado en Jira10288. Alejo aprobó explícitamente: «Aprobar paquete preparatorio y pruebas locales»; aprobación registrada también en Jira. La aprobación abarca solo A, no ejecución remota, invitaciones ni aceptación del piloto.

## Entrega

Carpeta acceptance/es45/: matriz28 familias/102 variantes, seis guiones ficticios ES/EN (cinco ES/uno EN), manifiesto de18 dependencias, resultados inicialmente vacíos, política y validadores, consolidado JSON/Markdown y24 tests offline.

Ningún endpoint, pantalla, modelo o migración nuevo. Sin modificaciones de frontend/, backend/, qa/, dependencias, lockfiles o CI. No se rediseñan los contratos de Mauricio ni se copian PR ajenos.
No hay diseño visual nuevo que aprobar: solo documentación y herramientas locales del plan técnico aprobado.

El paquete no trae runner E2E de la app ni llama a staging. Los guiones describen pasos y esperado; los selectores y ejecutores reales esperan contratos/pantallas integrados. No se inventan pruebas de rutas que no existen.

## Ejecución local real

| Verificación | Salida / resultado |
| --- | --- |
| node --test acceptance/es45/test/*.test.mjs, Node24.14.0 | tests24, pass24, fail0, skipped0 |
| Misma suite en Node22 | tests24, pass24, fail0, skipped0 |
| node --check sobre los7 archivos .mjs | exit0 |
| node acceptance/es45/scripts/check.mjs | exit0; preparationValid:true, families28, journeys6, productExecuted:false |
| node acceptance/es45/scripts/report.mjs | exit0; preparationReady:true, integratedAcceptance:blocked, invitationDecision:pending_human_decision, pilotReady:false, notVerified236, productExecuted:false |
| git diff --check | exit0 |

Hay236 requisitos integrales (variante×capa) no verificados y4 requisitos de seguimiento posteriores. Las18 dependencias siguen pendientes; target:null, pilotStartedAt:null, results.records:[].
Los reportes generados viven en acceptance/es45/.output/ y no se versionan.

Los24 tests son del **paquete de aceptación**, no24 recorridos del producto ni24 validaciones de seguridad en staging.
Node24 y Node22 no se suman como48 casos diferentes.

Primer intento en sandbox:21/23 tests pasaron y2 fallaron porque Windows negó crear junctions de prueba (EPERM). Se repitió fuera del sandbox autorizado:23/23. Tras ampliar validación de comando/capa y proteger escritura por enlace duro, la suite final24/24 pasó tanto en Node24 como en Node22. No se saltaron los tests ni se cambió la configuración para ocultar fallos.

Se añadieron controles de correspondencia commandId/capa: api_check no acredita staging_browser. La escritura del reporte reemplaza un archivo temporal propio para no modificar otro archivo unido por hardlink. Ambas conductas se ejercitaron realmente sobre archivos temporales.

## Cobertura de los tests

- Política completa, variantes actor/momento/viewport y bilingüismo; no se pueden quitar requisitos para obtener un verde.
- Recorridos ES/EN, dos entradas y acompañamiento opcional sin carrera forzada.
- Formas cerradas, duplicados, campos extra, comandos no permitidos y errores que no imprimen canarios secretos.
- Fechas imposibles/futuras, SHA corto/distinto, prueba no ejecutada o evidencia faltante.
- Rechazo de promoción desde unitarias/HTTP/dobles de navegador hacia DB/staging; no ocultar fronteras simuladas.
- Evidencia de otro origen, falta de hash verificado o self-tests no cuentan como integración.
- Incluso un manifiesto adversarial con todo passed solo obtiene awaiting_human_review; nunca pilotReady ni invitación aprobada. Los registros falsificados del test no salen de memoria.
- Dependencias pendientes, fallo real no resuelto o crítico histórico bloquean aunque existan pases posteriores.
- Ventanas7/30 posteriores al comienzo, seguimiento separado de la decisión previa de invitar.
- Hash real de archivo, detección de alteración, traversal/ruta remota/enlace rechazados, salida acotada y protección frente a hardlink.
- CLI local real mediante child_process en tests (solo Node y scripts propios), determinismo y errores saneados; el JSON de entrada nunca se interpreta como código/comando.

Los tests usan fechas/referencias/artefactos sintéticos y un reloj controlado de30-nov únicamente para verificar ventanas. No afirman que se haya realizado o transcurrido el piloto ni generan resultados reales.

## Capas y límites profesionales

Un200HTML no verifica una pantalla. Express/HTTP con modelos sustituidos no es DB real; DB local no es staging; navegador con API interceptada no es E2E integrado. El paquete las mantiene separadas.

Los hashes comprueban bytes, el esquema comprueba consistencia. No autentican personas, no verifican automáticamente que una referencia de Jira esté aprobada y no certifican que un recibo describa una ejecución veraz. QA/Mauricio deberán revisar las fuentes. El paquete no tiene lógica que invite o conceda permisos.

Privacidad: no hay datos de personas reales ni nuevos datos personales persistidos; solo metadatos de casos sintéticos. No se leyó .env, credenciales o perfiles del navegador. Los errores evitan imprimir el payload recibido, pero no se promete un filtro semántico de secretos en contenido arbitrario: revisar los artefactos antes de compartir.

Sin red, API, SQL, proveedor o navegador de producto en A. No se tocaron producción, despliegues, protección de main o correo.

## No verificado / pendiente

No se ejecutaron localmente lint/test/build de frontend o backend, auditorías npm, migraciones, Postgres o E2E de producto para este ticket: sus fuentes/dependencias no cambian. El CI existente se consultará en el PR y su estado se publicará allí; no ejecuta automáticamente estos24 tests nuevos porque no se modificó el workflow. La suite nueva se reproduce con el comando documentado.

Pendientes entorno aislado/protegido y SHA exacto de staging, build integrado de las HU, APIs/roles/propiedad reales, revocación concurrente y borrado remoto autorizados, cifrado y proveedores/retención, gasto/recuperación Claude reales, revisión especializada/QA, catálogo pertinente, dispositivos/navegadores/accesibilidad reales, seis recorridos guiados, soporte/incidentes e invitaciones autorizadas.
Resultados7/30 días se observarán después y se registrarán en soporte restringido con el contrato de ES-36.

La objeción y estimación de la Fase1 siguen registradas en10288; no se presenta la HU como cerrada por aprobar el paquete.
No se fusiona el PR ni se resuelven hilos de revisión.
