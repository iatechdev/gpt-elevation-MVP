# Permiso «Tu opinión» (piloto)

> **BORRADOR SIN REVISIÓN LEGAL** · ES-335 · 18-nov-2026.
> **Texto vigente aprobado por Mauricio el 17-nov-2026 (ES-173; borrador 12288 de UX/UI-Claude, «sin revisión legal»). Se reutiliza tal cual** de `frontend/src/pilot/copy.ts` (claves `grant*`); no se reescribió. Solo se añade a continuación lo que el abogado necesita para revisarlo.
> Marcadores: `[POR COMPLETAR PC-nn]` y `[VERIFICAR VF-nn]`; lista en `../POR-COMPLETAR.md`.

## Texto que ve la persona

### Permiso para guardar tu opinión
Para guardar tu opinión necesitamos tu permiso. Es independiente del permiso de investigación: puedes dar uno y no el otro.

**Qué pasa si lo das**
- Puedes guardar y cambiar tus respuestas a las cinco preguntas. Cada una tiene «No responder».
- Nadie ve tus respuestas individuales.
- Solo la administración ve resultados agregados (conteos del grupo), y solo cuando hay 5 o más personas. Con menos, no se muestran.
- Usamos esos resultados para mejorar el piloto.
- Responder o no responder no cambia tu acceso ni tus opciones.

**Qué puedes hacer después**
- Retirar el permiso cuando quieras. Desde ese momento no se guardan más respuestas.
- Retirar el permiso no borra lo que ya respondiste.
- Para borrar lo respondido, usa «Retirar mi respuesta» o elimina tu cuenta.

Esto no es una evaluación de tu salud ni de tu persona, y no te promete ningún resultado.

*Texto sin revisión legal.*

## Datos técnicos para la revisión legal (verificados contra el código)
- Propósito del permiso: `pilot_feedback`, separado de `research`. Se registra con versión y fecha como cualquier otro permiso.
- Las respuestas son de **catálogo cerrado** (cinco preguntas, sin texto libre).
- Los agregados se muestran **solo a partir de 5 personas**, en bandas de 5, sin categorías «sin respuesta» y se suprimen si todas las respuestas son iguales (ES-325); nunca se muestra una respuesta individual.
- «Retirar mi respuesta» **borra** la respuesta; retirar el permiso no la borra. Eliminar la cuenta la borra (purga).
- [REVISAR LEGAL RL-04: el texto dice «solo la administración ve resultados agregados» y «nadie ve tus respuestas individuales»; confirmar con el abogado si ese texto es suficiente para tratar datos de opinión como no sensibles, y si «mejorar el piloto» basta como finalidad.]
- [POR COMPLETAR PC-01: el responsable del tratamiento de estos datos se publica con el aviso de privacidad (documento 01); en la pantalla del permiso no se muestra todavía y es un bloqueo de lanzamiento anotado en ES-173.]
