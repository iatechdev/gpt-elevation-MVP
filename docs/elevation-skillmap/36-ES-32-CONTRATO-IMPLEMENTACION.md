# ES-32 · Implementación del contrato de rutas

28-oct-2026 · [Dev-Codex]. Complementa `24-CONTRATO-RUTAS.md`, sin cambiar sus ocho decisiones aprobadas por Mauricio (Jira 10178). Alejo autorizó continuar ES-32 en esta sesión. Dependencias #27/#28/#30/#31/#33 integradas en main `6dc61e9`; rama existente `ES-32-rutas` actualizada con esa base. Sin cambios frontend: la pantalla corresponde a ES-34; no hay diseño visual nuevo que aprobar en ES-32.

La integración declarativa de tres modelos en el núcleo de derechos se propuso en Jira 10250. Respuesta explícita en el chat: **«Autorizar la extensión declarativa propuesta»**; registrada en 10257. No se modifican el procesador de borrado, los propósitos del consentimiento ni los permisos de terceros.

## API para ES-34

Todas las rutas se montan bajo `/api/routes` con `verificarToken`. El router comprueba además la cuenta **actual** en servidor: activa, rol `user`, sin eliminación pendiente. El dueño siempre es `req.user.id`. Cuerpos cerrados: rechazan `UserId`, `ownerId` y cualquier clave adicional. Consultas cerradas salvo el cursor explícito de elecciones. Respuestas del router `Cache-Control: no-store`; errores previos del middleware JWT conservan su contrato compartido.

| Método / ruta | Entrada | Salida |
| --- | --- | --- |
| GET `/` | Ninguna | `ruleVersion, status, catalogVersion, constraintsVersion, basisHash, routes, discarded, clarifications, humanReview` |
| GET `/constraints` | Ninguna | `{constraints: null}` o versión actual con payload descifrado propio |
| PUT `/constraints` | `{baseVersion, requestId, payload}` | 201 nueva / 200 mismo intento; `{constraints, created}` |
| POST `/choices` | `{requestId, roleKey, slot, decision, basisHash}` | 201 nueva / 200 mismo intento; `{choice, created}` |
| GET `/choices?after=0` | Cursor entero >=0, opcional | `{choices, nextAfter}`; hasta 100, historial incluido, orden por id ascendente |
| GET `/choices/:id` | ID entero | Elección propia; ajena/inexistente 404 |
| POST `/review-requests` | `{requestId, note?}` | 201 nueva / 200 mismo intento; `{reviewRequest, created}` |
| GET `/review-requests` | Ninguna | Solicitud propia abierta o null |

`requestId`: 8–64 caracteres ASCII, letras/números/guion/guion bajo (UUID válido). Repetir el identificador con un cuerpo distinto devuelve 409. `baseVersion=0` para la primera versión; posteriormente la versión recuperada por GET. Una repetición puede devolver una versión histórica ya reemplazada: **200 no significa que vuelva a ser la versión vigente**. El consumidor consulta el recurso actual para reconciliar el estado.

Payload completo de restricciones:

```json
{
  "targetMarkets": ["CO"],
  "languages": ["es"],
  "modalities": ["remote", "hybrid"],
  "acceptRegulated": "unknown",
  "originContextKey": null,
  "interestContextKeys": [],
  "preferredModalities": []
}
```

Mercados: 1–3 códigos con formato de dos letras mayúsculas (igual al catálogo); no se infiere elegibilidad. Idiomas: hasta 12 códigos de dos letras minúsculas; vacío significa por confirmar. Modalidades: `onsite|hybrid|remote`, máximo tres; vacío por confirmar. Profesiones reguladas: `yes|no|unknown`. Contexto de origen nullable y hasta seis contextos de interés, claves presentes en el catálogo publicado. Preferencias de modalidad deben estar entre las aceptadas si se declararon restricciones. Listas sin duplicados y orden normalizado. No hay profesión, residencia ni texto íntimo en este almacén.

`slot`: `continuity|adjacency|exploration`; `decision`: `accepted|rejected`. Se exige la huella de la propuesta **propia** vigente y que el rol/casilla realmente esté propuesto; nunca basta enviar una clave de catálogo. Cada decisión nueva reemplaza la vigente del mismo rol. Elecciones de otros roles cuyo fundamento cambió permanecen históricas con `basisChanged: true`.

Errores: 400 `invalid_input`; 403 `owner_required|deletion_pending`; 404 `route_record_not_found|not_found`; 409 `conflict|review_already_open`; 422 `route_not_proposed`; 503 `catalog_unavailable|routes_unavailable`. JWT inválido/revocado o eliminado: contrato existente (401); ausencia de sesión: 403. Mensajes nuevos ES/EN; códigos estables para i18n de ES-34. No se devuelven SQL, notas ajenas ni información de error del proveedor.

## Cálculo y estados

El motor es **determinista, sin IA ni acceso a red**. Sus entradas son el catálogo publicado con frescura calculada, el DTO vigente de `skillMap.getMap` y las restricciones directas. No consulta el contexto libre del puente: en esta versión solo sería informativo, sin efecto sobre filtros ni puntuación. El mapa ya usa `getConfirmedEvidence` como puerta de evidencia profesional; no se accede al chat ni al diario para completar datos faltantes.

1. Sin catálogo → 503; sin restricciones/mercado → `needs_constraints`, sin leer el mapa para inferirlos.
2. Filtros secuenciales: mercado, idiomas conocidos incompatibles, modalidades conocidas incompatibles, regulación expresamente rechazada. Los descartes se cuentan una sola vez, en el primer filtro que falla. `unknown` no se convierte en coincidencia confirmada. Un idioma conocido requerido sigue exigiéndose aunque la ficha contenga además `unknown`.
3. Casillas en orden continuidad, adyacencia, exploración. Rol único en la respuesta, máximo tres. Continuidad por contexto de origen; adyacencia fuera de él con capacidad esencial sustentada; exploración por contexto de interés o modalidad preferida explícita. Sin fundamento queda vacía. Desempate por número de capacidades esenciales sustentadas, fecha de fuente más reciente y finalmente clave estable. No depende del orden de filas SQL.
4. Capacidades del catálogo vigente: pistas self/review **separadas**, nivel 1–4 con citas vigentes; sin evidencia, stale, contradicción pendiente o rúbrica antigua no se presentan como transferencia demostrada. Clave ausente → `skillMissing`, sin nivel inventado. Duplicados del catálogo no multiplican el fundamento. Se preservan nivel y número de evidencias por pista, sin promediarlos.
5. Dimensiones: preferencias `matches|partial|outside_interests|unknown`; transferencia `strong|partial|none_yet|unknown`; viabilidad `clear|conditional|unclear`. Sin porcentajes globales, rankings entre personas o promesas de empleo. Brechas «Aún sin evidencia / No evidence yet». Exploración sin transferencia lleva advertencia explícita ES/EN.
6. Profesión regulada siempre `pending`, sin afirmar habilitación, permiso de trabajo o elegibilidad. Fuentes stale y ofertas expired conservan esos estados; no acreditan oportunidad actual. Sin fuentes referenciadas no se propone el rol. Recursos solo para sus capacidades aún sin evidencia. Nombres de revisores y justificaciones del mapa fuera del DTO.

`ok`: tres rutas; `partial`: una/dos; `no_pertinent_catalog`: ninguna y `humanReview.offered=true`. La solicitud de revisión también puede iniciarse por decisión de la persona. No existe todavía consola de revisión: ES-35 define acceso y atención; crear una solicitud **no promete que alguien ya fue notificado ni una fecha de respuesta**.

`clarifications` también señala idiomas/modalidades directos pendientes aunque no haya rutas. `opportunityType=occupational` cuando no hay ofertas current; `has_current_listings` indica únicamente que el catálogo aporta alguna verificada según su política, sin inferir demanda ni elegibilidad.

## Persistencia, migración y seguridad

- `RouteConstraintsVersions`: dueño, versión, estado current/superseded, payload cifrado v2, requestId e inputHash técnicos. Únicos dueño+versión, dueño+requestId y una versión current por dueño.
- `RouteChoices`: dueño, rol, casilla, decisión, versiones de catálogo/restricciones, estado current/superseded, huella y requestId/inputHash. Únicos dueño+requestId y una elección current por dueño+rol. **No guarda las propuestas ni textos de evidencia.**
- `RouteReviewRequests`: dueño, estado, nota opcional ≤300 cifrada v2, requestId/inputHash. Únicos dueño+requestId y una abierta por dueño. Sin acceso nuevo del facilitador/terapeuta/admin.

Las tres tablas tienen FK a Users. Siete índices únicos con nombres explícitos. Migración aditiva e idempotente `20261028-es32-routes.cjs`, comprobada dos veces contra PostgreSQL vacío de pruebas antes de sincronizar los nuevos modelos. Infraestructura puede ejecutar `npm run migrate:routes` en el entorno elegido, antes de habilitar la aplicación. **No se ejecutó en staging ni producción**. El código anterior ignora las tablas; rollback no las borra ni retira sus registros del núcleo de derechos mientras existan datos.

Las escrituras bloquean la fila User dentro de la transacción, vuelven a comprobar rol/actividad/eliminación pendiente y serializan versiones por dueño. La huella HMAC está ligada al dueño, versión de reglas, restricciones, catálogo, evaluaciones/referencias y resultado con frescura; no se aceptan huellas de otra cuenta. Cambiar evidencia, mapa, restricciones, catálogo o vigencia provoca revisión. Se revalida antes de confirmar una decisión y se vuelve a calcular al leer; nunca se reescribe la decisión de la persona automáticamente.

**Límite de concurrencia:** los helpers publicados abren transacciones propias. No se afirma un snapshot atómico global entre catálogo, mapa, consentimiento y decisión; la segunda comprobación reduce la ventana y `basisChanged` detecta cambios posteriores. ES-33 debe volver a validar al generar/publicar un experimento. `utils/routes.getAcceptedChoice(userId,id)` comprueba dueño actual, decisión accepted, estado current y fundamento vigente; rechazada/reemplazada/cambiada da 409, ajena 404. Un consumidor no debe aceptar el objeto histórico por su cuenta.

Integración CORE autorizada: exportación descifra payload como JSON y nota propia; exporta historial de elecciones sin huellas ni requestIds. Purga de los tres modelos mediante el procesador existente, con rollback, reintento y replay. Sin nuevos propósitos/consentimientos para entrada directa. No se guardan transcripciones, diario, ánimo, riesgo/crisis, resultados clínicos, datos de otras personas ni conversaciones en las nuevas tablas o logs.

## Aceptación pendiente

Pruebas y límites reales en `37-ES-32-VERIFICACION.md`. Motor/API no equivalen a pertinencia validada: catálogo real curado del cliente y revisión humana de las seis personas siguen pendientes. Fixtures sintéticos no se publican en producción. ES-33 experimentos/plan, ES-34 pantalla y ES-35 facilitación conservan su alcance separado. Revisión de Mauricio del apartado de seguridad y después QA; Dev-Codex no fusiona ni resuelve hilos de QA.
