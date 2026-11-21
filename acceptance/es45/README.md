# ES-45 — Paquete preparatorio offline

[Dev-Codex]

Este paquete prepara la aceptación; **no ejecuta la aplicación ni aprueba el piloto**.
Plan aprobado: Jira ES-45, comentario10288 y aprobación explícita de Alejo en el chat.
No cambia frontend, backend, API, identidad, permisos, modelos, migraciones ni CI.
No duplica el corpus de evaluación IA de ES-44 ni sustituye los planes/evidencias del rol QA.

## Ejecutar

Desde la raíz del repo con Node22 o superior; no necesita npm install:

```powershell
node --test acceptance/es45/test/*.test.mjs
node acceptance/es45/scripts/check.mjs
node acceptance/es45/scripts/report.mjs
```

Los tests crean carpetas temporales propias y enlaces sintéticos para comprobar confinamiento; las limpian tras validar sus rutas. Windows necesita permitir junctions; un sandbox que los prohíba puede fallar en esas dos pruebas. No desactivar esos tests para publicar un resultado verde: ejecutar en entorno de pruebas adecuado y documentar cualquier restricción.

El reporte se guarda en .output/report.json y .output/report.md, ignorados por Git.
**Exit0 significa que se validó/generó el paquete, no que la aceptación esté aprobada.**
Exit2 señala input, estructura, evidencia o salida inválidos. Leer siempre integratedAcceptance, invitationDecision y pilotReady.

Salida inicial real:
```json
{"package":"ES-45","preparationReady":true,"integratedAcceptance":"blocked","invitationDecision":"pending_human_decision","pilotReady":false,"notVerified":236,"productExecuted":false}
```

Las102 variantes no son102 pruebas ejecutadas del producto. Exigen236 combinaciones de variante/capa para aceptación integral y4 observaciones de seguimiento posteriores; los24 tests ejecutados verifican el propio paquete.

## Archivos y política

- cases.json: 28 familias,102 variantes ES/EN; pasos/esperado bilingües, HU, capas, marcador de borrado y ventanas.
- journeys.json: seis guiones hipotéticos (cinco ES, uno EN), ambas entradas y una opción de solo acompañamiento. No son perfiles ni resultados de las seis personas reales.
- readiness.json:18 dependencias pendientes, target y comienzo del piloto null. No rellenar con suposiciones.
- results.json: inicialmente vacío; no se generan registros passed a partir de self-tests.
- lib/policy.mjs: cobertura requerida cerrada; quitar familias, variantes o debilitar capas falla.
- lib/validate.mjs: formas cerradas, bilingüismo, referencias, fechas y clasificación.
- lib/consolidate.mjs: cobertura separada por capa, dependencias, fallos y seguimiento.
- lib/files.mjs: lectura JSON local limitada, hashes de evidencia y escritura confinada.
- scripts/: CLI de comprobación y reporte. Nunca ejecutan comandos recibidos en JSON, fetch, SQL o llamadas al proveedor.

Capas: unit_doubles, http_doubles, db_real, browser_fixtures, staging_api, staging_browser, human_review, followup.
Estados: not_run, blocked, passed, failed. No existe skipped=>passed.

Una prueba API no se reclasifica como browser_journey; commandId y capa deben ser compatibles. Los dobles no pueden esconderse bajo staging. Una capa DB puede declarar proveedor/reloj simulados, pero no DB/cifrado/identidad/permisos/storage simulados; tampoco acredita la capa de navegador. browser_fixtures nunca cuenta como staging_browser.

El paquete usa fuentes canónicas de otros tickets como dependencias, no los implementa. Los scripts no convierten revisión pendiente de ES-33 en permiso de facilitación.

## Inputs y evidencia local

check.mjs acepta --cases, --journeys, --readiness y --results para JSON explícitos dentro de esta carpeta. No lee .env ni credenciales.
report.mjs acepta además --evidence-dir y --out-dir.
El CLI común reconoce los mismos nombres de flags; los dos flags de salida/evidencia solo tienen efecto en report.mjs.

Ejemplo para un registro de resultados **revisado y saneado** bajo esta carpeta:
```powershell
node acceptance/es45/scripts/report.mjs --results acceptance/es45/.evidence/results.json --evidence-dir acceptance/es45/.evidence --out-dir acceptance/es45/.output/revision
```

Este comando lee registros existentes y calcula hashes; **no corre las pruebas descritas**.
Los resultados deben ser recogidos por el ejecutor real y revisados por QA. Cada registro exige:
caseId/variantId/runId, layer, environmentKind, origin, SHA completo, status, simulation, simulatedBoundaries, instantes UTC, reasonCode, commandId, evidencia(path/sha256/mediaType) y, cuando aplica, reviewerRole/reviewRef. Los campos no aplicables se indican null.

- Un resultado de self-test lleva simulation:true. Los tests adversariales que falsean ese valor para atacar la política viven solo en memoria y nunca se exportan como resultados.
- Una entrada con status:passed necesita evidencia; sin --evidence-dir y hash coincidente no cuenta para revisión.
- El origen de staging debe coincidir exactamente con target; sin credenciales, path, query o fragmento. Un host con nombre staging no prueba aislamiento. La referencia de despliegue/aislamiento/acceso debe comprobarla Infra.
- SHA completo distinto, fecha futura, ventana7/30 prematura o variante desconocida no acreditan ejecución.
- Un fallo real del commit actual bloquea; un fallo crítico de aislamiento/revocación/frontera/borrado también permanece bloqueante desde commits anteriores. No se oculta con promedios o un pass posterior. La resolución la debe revisar QA; este paquete no resuelve hallazgos.
- No usar la presencia de un archivo/hash para afirmar que lo que dice sea verdad. Son controles de integridad, no firmas de ejecución.

La salida nunca devuelve approved: con cobertura completa solo puede alcanzar awaiting_human_review.
invitationDecision permanece pending_human_decision y pilotReady:false. **Estos campos no cambian automáticamente, ni siquiera con todos los registros passed.**
La invitación real requiere una decisión humana fuera de este paquete.

## Privacidad y límites

Los reportes incluyen IDs de casos y conteos de cobertura de pruebas, no métricas de participantes.
No poner credenciales, tokens, nombres reales, correos, CV, chats, diario, ánimo o crisis en estos inputs, capturas o artefactos. No conservar cookies, storageState, Authorization, HAR o trazas crudas.
No existe redacción semántica infalible: el schema no garantiza ausencia de datos privados dentro de texto/artefactos. Revisar antes de compartir o publicar; .evidence y .output permanecen locales e ignorados.

Los inputs JSON deben estar dentro de este paquete, <=2MiB; se rechazan enlaces y rutas remotas. Las evidencias requieren rutas relativas sin traversal/enlaces, ficheros<=10MiB y SHA256 coincidente. --evidence-dir es una ruta local explícita; no autoriza publicar su contenido. La salida solo se escribe dentro de .output, por reemplazo de archivos propios; no sigue enlaces simbólicos ni sobrescribe contenido por un enlace duro.

No son un sandbox frente a cambios concurrentes maliciosos del sistema de archivos ni una garantía de autenticidad del operador. No dar acceso a estas carpetas a terceros no autorizados.

## Para avanzar a staging y piloto

Deben integrarse las HU, aprobarse las puertas y verificarse entorno/commit/cuentas/DB/contratos por Mauricio/Infra/QA.
Borrados remotos, cambios de configuración/despliegue/restauración, invitaciones y uso de Claude pagado necesitan autorización concreta. Ninguno se ejecuta aquí.

E45-28 no se exige antes de invitar: sus observaciones7/30 días se registran después del comienzo real, nunca como resultados logrados al desplegar. El seguimiento mantiene estado propio.
No se inventan métricas de utilidad ni se compara el caso EN como subgrupo.

Ver [plan](../../docs/elevation-skillmap/45-ES-45-PLAN-ACEPTACION.md) y [verificación](../../docs/elevation-skillmap/46-ES-45-VERIFICACION.md).
