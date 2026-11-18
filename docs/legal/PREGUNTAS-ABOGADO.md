# Preguntas abiertas para el abogado / Open questions for the lawyer

> **BORRADOR SIN REVISIÓN LEGAL** · ES-335 · 18-nov-2026. Cada pregunta indica el hecho verificado en el código que la origina y el documento donde aparece. *Each question states the code-verified fact behind it. Summary line in English after each question.*

## A. Marco legal y alcance

**Q1 · Marco aplicable.** Se asume Colombia (Ley 1581 de 2012 y normas reglamentarias) como punto de partida, **sin verificar**: el piloto es de seis personas en reconversión profesional (cinco de habla hispana, una de habla inglesa) y no consta en el repo el país de cada una ni el domicilio de la empresa. ¿Qué marco aplica a cada persona según su país de residencia (el contexto guarda `residenceCountry`)? ¿Hay que inscribir bases de datos ante la autoridad? ¿Qué rige para quien resida en otro país? — *Which framework applies per resident country; registration duties?* (Docs 01, 02; PC-08)

**Q2 · Datos sensibles.** El producto pide no escribir datos de salud, pero el diario, el ánimo y las conversaciones pueden contenerlos aunque no se pidan. ¿Hay que tratar todo el contenido de diario y conversaciones como dato sensible, con autorización expresa y reforzada? ¿Basta con la casilla de aceptación del aviso al registrarse, o debe haber una autorización específica? — *Is diary/mood/chat content sensitive data needing explicit specific consent?* (Doc 01)

**Q3 · Forma de la aceptación.** Hoy el registro tiene **una** casilla obligatoria para el aviso de privacidad y los términos juntos, y el servidor guarda la versión (`2026-11-v1`) y la fecha. ¿Debe separarse la autorización de tratamiento de datos de la aceptación de los términos? ¿Qué debe poder probarse y por cuánto tiempo? — *One checkbox for both documents: separate them?* (Docs 01, 02)

**Q4 · Edad mínima y menores.** No hay verificación de edad. ¿Qué edad mínima fijar y qué hacer si se detecta una persona menor? — *Minimum age and handling of minors.* (PC-07)

## B. Eliminación y conservación

**Q5 · E301-2 — la purga borra la aceptación de términos.** Al purgar a una persona el sistema pone `termsVersion` y `acceptedAt` en NULL (`backend/utils/deletionProcessor.js`) y deja el usuario como lápida sin nombre ni correo. ¿Conviene **conservar la versión y la fecha de aceptación sin datos personales** (por ejemplo, por una lápida con identificador interno) como evidencia de que el tratamiento fue autorizado, o debe borrarse todo? ¿Por cuánto tiempo? — *Keep terms version/date without personal data after deletion, as proof of consent?* (Doc 07; RL-05)

**Q6 · Notas del profesional tras eliminar a la persona.** Por decisión de producto (ES-274, opción A), al eliminar a una persona se conservan las notas que un profesional escribió sobre ella, las notas en vivo y la fila de agenda; el texto libre puede identificarla y no se puede depurar. ¿Es lícito conservarlas, con qué base y por cuánto tiempo? ¿Cambia algo si esas notas constituyen un registro de salud? ¿La persona debe ser informada de esto **antes** de aceptar (ya está en el aviso)? — *May professional notes be kept after a person deletes their account; basis and period?* (Docs 01, 07; PC-14)

**Q7 · Plazos y copias de seguridad.** No hay plazos verificados de supresión en proveedores ni en copias de seguridad (`deadlinesVerified = false`), y el sistema no promete 7 o 30 días. ¿Qué plazos máximos se pueden prometer razonablemente y qué redacción es aceptable para «supresión en copias de seguridad»? — *What deadlines/wording for deletion in backups and providers?* (Doc 07; PC-12, PC-13)

**Q8 · Anonimización de agregados.** Los resultados agregados del piloto (grupos de 5 o más, en bandas de 5, sin categorías «sin respuesta») se muestran a la administración. ¿Se consideran anonimizados y fuera de la supresión? — *Are aggregated pilot results anonymised data?* (Docs 06, 07; RL-04, RL-06)

## C. Terceros, IA y transferencias

**Q9 · Proveedor de IA.** El servidor envía a Anthropic (modelo Claude) los últimos 20 mensajes, las entradas de diario que la persona elige y, con permiso por fuente, textos de chat (hasta 20 mensajes), diario (hasta 10 entradas) u hojas de vida sin datos de contacto. No se envían nombre ni correo. ¿Qué acuerdo de tratamiento (encargado) hace falta? ¿Cómo se informa y se autoriza la transferencia internacional? ¿Qué debe decir el contrato sobre no entrenamiento y retención? — *DPA, international transfer and no-training/retention terms with the AI provider.* (Doc 01; PC-11, VF-02, VF-03)

**Q10 · Texto publicado desactualizado respecto a la IA.** El aviso vigente en `/privacidad` dice que «la IA de análisis solo ve tus evidencias confirmadas, no tu diario, tu ánimo ni tus conversaciones». Verificado en el código: el **chat** sí envía al modelo los mensajes recientes y las entradas de diario elegidas, y los permisos `insights_*` dan lectura del chat, del diario y de la hoja de vida. El borrador (doc 01, §7) lo describe con exactitud. ¿Hay que corregir el texto vigente **antes** de abrir el piloto a personas reales? (Recomendación del autor: sí.) — *The currently published notice understates what the AI reads; correct before real users?* (Doc 01)

**Q11 · Página estática antigua `/privacy`.** `frontend/public/privacy/index.html` es una política del producto anterior («Integración con ChatGPT»), se sirve públicamente y carga tipografías de Google Fonts. Contradice el aviso nuevo. ¿Se retira? — *Legacy static policy page (ChatGPT era) still served; remove?* (Doc 04; VF-11)

**Q12 · Proveedores y país.** Alojamiento, base de datos, almacenamiento y correo transaccional aún no están confirmados para producción (el código menciona Railway y Supabase; está previsto Vercel + Supabase; el proveedor de correo no está definido). ¿Qué debe revelarse en el aviso y en qué momento? — *Which providers/countries must the notice disclose?* (PC-11, VF-01)

## D. Producto no clínico y profesionales

**Q13 · Coherencia «no clínico» vs. módulo de terapeutas.** El producto se declara no clínico, pero existe un módulo con rol de terapeuta, notas clínicas, sesiones y fichas (y un permiso `therapist_sharing`). ¿Qué obligaciones tiene la empresa por ese módulo (historia clínica, secreto profesional, habilitación)? ¿Cómo describirlo en los términos sin contradecir el carácter no clínico? — *Non-clinical positioning vs. therapist module with clinical notes.* (Docs 02, 03; VF-07)

**Q14 · Crisis y deber de cuidado.** El sistema interrumpe el acompañamiento ante indicios graves, responde con un mensaje de seguridad, **no guarda el nivel de riesgo, no avisa a nadie** y no publica líneas de ayuda hasta que existan recursos verificados por país y fecha (el registro sale vacío a propósito). El detector es un borrador sin validar por un especialista. ¿Es suficiente el aviso de producto no clínico? ¿Hay riesgo de responsabilidad por no avisar o por no mostrar una línea de ayuda? — *Is the non-clinical/crisis disclaimer enough; liability for not alerting or not listing a helpline?* (Docs 02, 03; PC-09, VF-08)

**Q15 · Datos de terceros que la persona escribe.** Se le pide no escribir datos de otras personas. ¿Qué responsabilidad hay si lo hace, y qué debe decir el aviso? — *Third-party data entered by users.* (Doc 01)

## E. Cookies, permisos y otros

**Q16 · Almacenamiento local sin banner.** No hay cookies propias; sí `localStorage`/`sessionStorage` para sesión y preferencias. ¿Se necesita aviso o consentimiento? — *Local storage without banner.* (Doc 04; RL-03)

**Q17 · Permiso de «Tu opinión».** Texto aprobado el 17-nov (ES-173). ¿Es suficiente como autorización, finalidad y descripción del tratamiento? ¿Debe mostrar el responsable y el contacto en la propia pantalla (hoy es un bloqueo de lanzamiento)? — *Is the approved feedback-permission text sufficient?* (Doc 06; RL-04)

**Q18 · Permisos con comportamiento por confirmar.** `facilitator_sharing` (¿hay función que lo use?), `research` (sin uso), `notifications` y el retiro de `resume_ai_reading` (el código dice que borra las hojas de vida; el texto de la interfaz dice que no). Se resolverán con Mauricio antes de que el abogado los revise. — *Consents whose behaviour is unconfirmed; to be settled with the CTO first.* (Doc 05; VF-06, VF-12, VF-14, VF-15)

**Q19 · Condiciones comerciales futuras.** Hoy no hay pago en línea. ¿Qué cláusulas serán necesarias cuando lo haya (precios, facturación, reembolsos, retracto)? — *Future commercial terms.* (Doc 02; PC-16)

**Q20 · Limitación de responsabilidad y propiedad intelectual.** Redacción de las cláusulas 11 y 12 de los términos según la ley aplicable. — *Liability limits and IP clauses.* (Doc 02; RL-01, RL-02)
