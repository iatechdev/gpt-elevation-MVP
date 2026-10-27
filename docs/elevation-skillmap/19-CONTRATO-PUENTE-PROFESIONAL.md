# ES-25 · Contrato del puente profesional (PROPUESTA para aprobación)

26-oct-2026 · Dev-Claude · Cubre SP2-HU07 (RF-03, RF-04). **Es una propuesta: no hay código hasta que Mauricio (técnico) y Alejo (alcance) la aprueben.** Backend y contrato de API; sin interfaz (los controles los construye Alejo con este contrato), por lo que no aplica la puerta de diseño de frontend.

## 1. Idea en una frase

La persona **escribe o aprueba, campo por campo, un texto profesional**; el sistema guarda una **copia versionada** de ese texto y es lo **único** que el motor profesional puede leer. Nada se deriva automáticamente de conversaciones o diario, y nada cruza si la persona no lo vio y lo confirmó.

## 2. Campos autorizables (lista cerrada)

`motivations` · `values` · `interests` · `energy_gives` · `energy_drains` · `desired_conditions` · `constraints` (restricciones declaradas por la persona). Cada campo: texto de hasta 500 caracteres, máximo 3 por clave, 12 en total. Una clave fuera de la lista se rechaza. Nunca viajan: transcripciones, entradas del diario, etiquetas o textos de crisis, correo, nombre ni IDs de origen.

## 3. Dos caminos, un solo modelo

| Camino | Origen del texto | ¿Requiere consentimiento `professional_bridge`? |
| --- | --- | --- |
| **A. Desde el espacio privado** | La persona redacta un texto a partir de una entrada (puede indicar `origin: {type: "diary_entry" \| "chat_turn", id}`; el servidor comprueba que es suyo, **no copia su contenido**) | **Sí**, vigente al confirmar y en cada lectura del motor |
| **B. Ingresado directamente** | La persona escribe el texto en el flujo profesional (`origin: {type: "direct"}`) | No: no sale nada del espacio privado |

Una versión que mezcla ambos requiere el consentimiento (basta un campo del camino A). La IA no propone ni reescribe campos en esta HU.

## 4. Flujo (vista previa → confirmación)

1. `POST /api/career-context/preview` `{ fields: [{key, text, origin?}], locale }` → `200 { token, expiresAt, representation }`. La `representation` es **exactamente** lo que verá el motor (clave + texto). No guarda nada. El `token` está firmado, ligado a la persona y a esos campos, y vence en 10 minutos.
2. `POST /api/career-context/confirm` `{ fields, token, requestId }` → `201 { version, status: "active", approvedAt }`. El servidor **vuelve a validar todo** (dueño, consentimiento, filtros, que los campos coincidan con el token). Idempotente por `requestId`: repetirlo devuelve la misma versión.
3. Confirmar crea la versión *n+1* y marca la anterior como `superseded`, en una transacción con bloqueo de fila (dos confirmaciones simultáneas no dejan dos activas).

## 5. Qué se guarda (tablas nuevas, sin tocar las existentes)

- `CareerContextVersions`: `UserId`, `version` (consecutiva por persona), `status` (`active` \| `superseded` \| `revoked`), `payload` (los campos aprobados, **cifrados v2**), `origins` (referencias privadas: tipo, ID y marca de tiempo del origen; **nunca viajan al motor**), `consentVersion` (si hubo camino A), `approvedAt`, `revokedAt`, `requestId` (único por persona).
- `BridgeTransfers` (auditoría): una fila por lectura del motor con `UserId`, `version`, **solo las claves** y un hash de lo entregado, `consumer`, fecha. **Sin texto.** Permite verificar qué cruzó la frontera.

## 6. Lo que ve el motor profesional (la frontera)

Una sola función, `getApprovedContext(userId, consumer)`, dentro de la transacción de `withConsent` cuando la versión incluye el camino A:
`{ version, approvedAt, fields: [{ key, text }] }`.
Nada más: sin IDs de origen, sin correo, sin nombre, sin otras versiones. Si no hay versión activa o el consentimiento no está vigente: no hay contexto (404/`consent_required`), nunca un contexto parcial. Quien consuma el texto lo debe tratar como no confiable (`fenceUntrusted`, ES-21).

## 7. Filtros de entrada (antes de la vista previa y de nuevo al confirmar)

- Saneado de texto y topes (ES-21), enmascarado de secretos (ES-22).
- Un campo que el detector de riesgo (ES-21) marca **no puede cruzar**: se rechaza con un mensaje genérico (`field_not_shareable`: "este texto no se puede compartir; reescríbelo o déjalo fuera") **sin revelar ni guardar el motivo**. El nivel de riesgo sigue siendo efímero.
- Aviso al usuario en el contrato de UI: no incluyas información de salud ni datos de terceros en `constraints`. **Esto reduce el riesgo, no lo elimina**: la persona decide qué texto autoriza al ver la vista previa.

## 8. Cambios posteriores y revocación

- **Cambiar un origen privado** (editar o borrar la entrada del diario) **no actualiza** el contexto. La versión se marca `needsReview` en la consulta de la persona ("el origen cambió desde que lo compartiste"); sigue vigente hasta que ella actúe. *(Decisión abierta 1.)*
- **Revocar** (`POST /api/career-context/revoke`, o revocar el propósito `professional_bridge` en `/api/consents`):
  - la versión activa pasa a `revoked` y el motor deja de leerla de inmediato (la lectura exige consentimiento vigente);
  - se registra un evento en `DerivedInvalidations` (`sourceType: career_context_version`) que las siguientes historias (ES-27, ES-29, ES-32) consumen para **recalcular solo con fuentes aún permitidas**; un evento registrado no es una invalidación procesada;
  - no se crea ninguna versión nueva sola: la persona confirma de nuevo (la interfaz puede precargar los campos del camino B).
- **Quitar un campo** = confirmar una versión nueva sin él (la anterior queda `superseded` y sus derivados se invalidan).
- Revocar el consentimiento mientras alguien confirma: el bloqueo compartido de `withConsent` espera la revocación; no se crea una versión con consentimiento revocado.

## 9. Consulta de la persona

`GET /api/career-context` → versión activa (campos, `needsReview`, fechas) e historial de versiones propias. Solo el dueño; ID ajeno = 404.

## 10. Relación con otras historias

- **ES-23:** la exportación personal incluirá estas versiones y la eliminación las purgará (se añade al registro de datos personales cuando #25 esté en `main`); la exportación *profesional* usará exactamente los campos aprobados.
- **ES-20/ES-21:** el diario y el nivel de riesgo no se tocan. **ES-22:** sin llamadas a IA en esta HU.
- **HU04 (dependencia declarada):** no verificado qué exige; el diseño funciona sin la brújula (texto de la persona, origen opcional).

## 11. Pruebas previstas

Dueño y roles (IDs ajenos, administrador, terapeuta, facilitador sin acceso) · vista previa = lo entregado, byte a byte (observador de la frontera con un «motor» simulado que captura sus entradas) · **canarios**: textos del chat, del diario y de crisis nunca aparecen en lo que recibe el motor ni en `BridgeTransfers` · consentimiento revocado entre vista previa y confirmación, y entre confirmación y lectura · confirmaciones/revocaciones concurrentes y reintentos con el mismo `requestId` en **Postgres real** (arnés de ES-81) · cambio del origen no altera la versión · ambos caminos · entrada maliciosa (inyección, tamaño, claves extra) · textos ES/EN en los errores · sin 500 por entrada inválida · mutaciones para los controles críticos.

## 12. Lo que no cubre

Interfaz; propuestas de la IA para los campos; el motor de rutas y el Skill Map (ES-27/29/32); invalidar derivados que aún no existen; exportación profesional (ES-23, depende de esto); validación del especialista de los textos.

## 13. Decisiones abiertas para aprobar

1. Origen cambiado o borrado: ¿solo `needsReview` (propuesto) o se bloquea la lectura hasta confirmar de nuevo?
2. ¿Aceptas que el camino B (directo) **no** requiera `professional_bridge`?
3. ¿La lista cerrada de campos de §2 es la correcta, o Alejo añade/quita claves?
4. ¿Apruebas tocar el núcleo de consentimiento (`utils/consent.js`) para que revocar `professional_bridge` revoque la versión y emita el evento en la misma transacción?
5. ¿Auditoría `BridgeTransfers` (claves + hash, sin texto) sí o no?

**Estimación:** dentro de las 10 h del ticket (rango 8–12) si se aprueba tal cual; la prueba en Postgres real y el núcleo de consentimiento son lo que más puede moverla.

## 14. Estado de la implementación (ES-25, aprobado el 27-oct-2026 con las 5 propuestas)

- **Decisiones aprobadas:** (1) origen cambiado o borrado = solo `needsReview`; (2) el camino directo no requiere `professional_bridge`; (3) lista de campos tal cual; (4) se tocó `utils/consent.js` (gancho en `setConsent`); (5) auditoría `BridgeTransfers` sí.
- **Código:** `backend/CareerContextVersion.js`, `backend/BridgeTransfer.js`, `backend/utils/careerContext.js`, `backend/routes/careerContext.js` (montada en `/api/career-context`), gancho en `backend/utils/consent.js`.
- **Fuera de las rutas HTTP:** `getApprovedContext(userId, consumer)` es solo una función de servidor para el motor; ninguna ruta la expone. La exportación profesional (ES-23) y el Skill Map (ES-27/29/32) deben usar esa función.
- **Errores estables:** 400 `invalid_input` · 403 `consent_required` · 404 `origin_not_found` / `no_context` · 409 `preview_mismatch` · 410 `preview_expired` · 422 `field_not_shareable` (con `fieldIndex`, sin motivo).
- **Reintentos:** hasta 6 intentos acotados ante colisión de versión; garantizan lo que exige la restricción única parcial de una versión activa por persona.
- **Apertura:** a diferencia de ES-23, esta ruta no está detrás de un interruptor: sin versiones confirmadas no hay nada que leer y el motor aún no existe. Si Mauricio prefiere un interruptor, es un cambio pequeño.
