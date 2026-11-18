# Documentos legales — borrador para el abogado (ES-335)

> **BORRADOR SIN REVISIÓN LEGAL.** Redactado el 18-nov-2026 por Dev-Claude-3 a partir de lo que el sistema hace hoy, para que el abogado (en proceso de contratación) los revise. No es asesoría legal. No se publican a personas reales mientras queden marcadores sin completar. **No cambia nada del producto**: el texto vigente en `/privacidad` y `/terminos` (`frontend/src/legal/legalCopy.ts`) no se tocó.

## Qué hay

| N.º | Español (`es/`) | English (`en/`) |
| --- | --- | --- |
| 01 | `01-aviso-de-privacidad.md` — aviso de privacidad y política de tratamiento de datos | `01-privacy-notice.md` |
| 02 | `02-terminos-de-uso.md` — términos y condiciones de uso | `02-terms-of-use.md` |
| 03 | `03-aviso-de-producto-no-clinico.md` — límites del acompañamiento | `03-non-clinical-product-notice.md` |
| 04 | `04-cookies-y-almacenamiento.md` — cookies y almacenamiento del navegador | `04-cookies-and-browser-storage.md` |
| 05 | `05-consentimientos-de-compartir.md` — puente profesional y permisos afines | `05-sharing-consents.md` |
| 06 | `06-permiso-tu-opinion.md` — permiso de «Tu opinión» (texto aprobado en ES-173, reutilizado) | `06-feedback-permission.md` |
| 07 | `07-conservacion-y-supresion.md` — conservación y supresión (alineada con la purga) | `07-retention-and-deletion.md` |

Documentos de apoyo (en español; los marcadores y los ID son los mismos en ambos idiomas):
- `POR-COMPLETAR.md` — **lista completa de marcadores** (`PC` = dato por completar, `VF` = por verificar, `RL` = para el abogado), con quién decide cada uno.
- `PREGUNTAS-ABOGADO.md` — preguntas abiertas (incluye E301-2: la purga borra la aceptación de términos).
- `VERIFICACION-CONTRA-CODIGO.md` — cada afirmación factual → archivo del que sale; discrepancias; lo no verificado.

## Reglas que siguió la redacción
- No se inventaron datos de la empresa: razón social, NIT, domicilio, contacto, plazos, edad mínima, ley aplicable, línea de ayuda y proveedores van como `[POR COMPLETAR PC-nn]`.
- Producto **no clínico**; sin promesas de empleo ni resultados.
- Todo lo que dicen los documentos sobre el comportamiento del sistema está contrastado con el código (ver la verificación); lo que no, está marcado.
- Una prueba (`frontend/test/es-335-legal-docs.test.mjs`) comprueba que cada documento existe en ES y EN, que lleva la marca de borrador, que los marcadores coinciden entre idiomas y con `POR-COMPLETAR.md`, y que no hay datos de empresa inventados en forma de NIT, correo o teléfono.

## Cómo seguir
1. Mauricio y Alejo completan los `PC` y resuelven los `VF` (ver quién en `POR-COMPLETAR.md`).
2. El abogado revisa los documentos y responde `PREGUNTAS-ABOGADO.md`.
3. Un ticket aparte (no este) traslada el texto final a la aplicación (`legalCopy.ts`, `version.ts` y `backend/utils/terms.js` suben la versión juntas y piden aceptar de nuevo).
