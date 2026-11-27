# ES-408 · Textos ES/EN (clave → texto)

[UX/UI-Claude] Generado desde `textos.js` con `node build.cjs` (misma fuente que el prototipo). Estado: **igual** (existe hoy y no cambia en su sentido), **cambia**, **nuevo**. Las claves nuevas son propuestas de nombre. Los textos EN y los «igual» deben cotejarse contra `shared/landing-content.json` y `evidence/copy.ts` al implementar: el EN de las claves existentes se escribió para el prototipo.

Total: 216 · igual 79 · cambia 11 · nuevo 126 · grupos a retirar 10

| Clave | Estado | ES | EN |
|---|---|---|---|
| `html.title` | cambia | Elevation — Reconoce tu camino | Elevation — Recognise your path |
| `landing.header.language` | igual | Idioma | Language |
| `landing.nav.what` | nuevo | Qué es | What it is |
| `landing.nav.journey` | nuevo | Recorrido | The journey |
| `landing.nav.privacy` | nuevo | Privacidad | Privacy |
| `landing.nav.today` | nuevo | Disponible hoy | Available today |
| `landing.nav.faq` | nuevo | Preguntas | FAQ |
| `landing.next.signin` | nuevo | Iniciar sesión | Sign in |
| `landing.portada.cta_create` | igual | Crear cuenta | Create account |
| `landing.portada.cta_try` | igual | Probar un ejemplo | Try an example |
| `landing.portada.eyebrow` | nuevo | Autoconocimiento y capacidades · acompañamiento no clínico | Self-knowledge and capabilities · non-clinical support |
| `landing.portada.promise.p1` | cambia | Reconoce tu camino | Recognise your path |
| `landing.portada.audience.a1` | nuevo | Para personas que quieren y necesitan buscar trabajo. | For people who want and need to look for work. |
| `landing.portada.adults` | nuevo | El piloto es solo para mayores de 18 años. | The pilot is only for people 18 or older. |
| `landing.portada.chip_nojob` | nuevo | No promete empleo | No job promises |
| `landing.portada.lead` | cambia | Cuenta una situación real. Elevation te ayuda a ver qué capacidades aparecen en ella y qué evidencia las respalda. Tú decides qué guardas y qué compartes. | Describe a real situation. Elevation helps you see which capabilities show up in it and what evidence supports them. You decide what you keep and what you share. |
| `landing.portada.here` | igual | Tú estás aquí | You are here |
| `landing.portada.chip_private` | nuevo | Tu diario y tu chat no los lee tu profesional | Your professional does not read your journal or chat |
| `landing.portada.chip_nonclinical` | nuevo | No es terapia ni diagnóstico | Not therapy or diagnosis |
| `landing.portada.relief_alt` | nuevo | Ilustración de un relieve con un punto marcado como «Tú estás aquí». | Illustration of a relief map with a point marked “You are here”. |
| `landing.v2.problem.title` | nuevo | Cuesta contar lo que sabes hacer | It is hard to put into words what you know how to do |
| `landing.v2.problem.b1` | nuevo | La experiencia está en situaciones concretas, no en una lista de cargos. | Experience lives in concrete situations, not in a list of job titles. |
| `landing.v2.problem.b2` | nuevo | Una hoja de vida declara habilidades; no muestra en qué te apoyas para decirlo. | A résumé states skills; it does not show what you are relying on when you say so. |
| `landing.v2.problem.b3` | nuevo | Elevation ordena esas situaciones y deja ver cuáles tienen respaldo y cuáles todavía no. | Elevation organises those situations and shows which have support and which do not yet. |
| `landing.v2.journey.title` | nuevo | El recorrido, paso a paso | The journey, step by step |
| `landing.v2.journey.note` | nuevo | No hace falta hacerlo todo ni en orden. Puedes parar cuando quieras. | You do not have to do all of it, or in order. You can stop whenever you like. |
| `landing.v2.journey.get` | nuevo | Obtienes | You get |
| `landing.v2.journey.s1.t` | nuevo | Conversa o escribe | Talk or write |
| `landing.v2.journey.s1.b` | nuevo | Un asistente de IA te acompaña en la conversación, y tienes un diario privado. Puedes subir tu hoja de vida en PDF (hasta 5 MB) para que la IA te proponga habilidades. | An AI assistant supports you in conversation, and you have a private journal. You can upload your résumé as a PDF (up to 5 MB) for the AI to suggest skills. |
| `landing.v2.journey.s1.g` | nuevo | Un lugar para pensar en tu experiencia, con la IA señalada como IA. | A place to think about your experience, with the AI clearly labelled as AI. |
| `landing.v2.journey.s2.t` | nuevo | Registra una evidencia | Record evidence |
| `landing.v2.journey.s2.b` | nuevo | Describe una situación real: qué pasaba, de qué respondías, qué hiciste y qué entregaste. Tú revisas y confirmas. | Describe a real situation: what was happening, what you were responsible for, what you did and what you delivered. You review and confirm. |
| `landing.v2.journey.s2.g` | nuevo | Un registro tuyo, con sus límites, que puedes editar o borrar. | A record of your own, with its limits, that you can edit or delete. |
| `landing.v2.journey.s3.t` | nuevo | Mira tu mapa | See your map |
| `landing.v2.journey.s3.b` | nuevo | Las capacidades se ven como un relieve. Solo las evidencias confirmadas cuentan para evaluarlas. | Capabilities appear as a relief map. Only confirmed evidence counts when assessing them. |
| `landing.v2.journey.s3.g` | nuevo | Una imagen de qué respalda cada nivel. Lo plano no es un déficit y el nivel no certifica. | A picture of what supports each level. Flat ground is not a deficit, and the level does not certify anything. |
| `landing.v2.journey.s4.t` | nuevo | Decide qué cruza a lo profesional | Decide what crosses to the professional side |
| `landing.v2.journey.s4.b` | nuevo | La Brújula profesional te deja elegir qué texto autorizas. Para una revisión profesional, autorizas qué evidencias ve la persona revisora, con un código. | The Career compass lets you choose which text you authorise. For a professional review, you authorise which evidence the reviewer sees, using a code. |
| `landing.v2.journey.s4.g` | nuevo | Control sobre lo que sale de tu espacio privado. | Control over what leaves your private space. |
| `landing.v2.journey.s5.t` | nuevo | Mira caminos posibles y prueba un paso | Look at possible paths and try one step |
| `landing.v2.journey.s5.b` | nuevo | Dices tus restricciones y ves rutas del catálogo, comparando lo que pide cada una con lo que ya respaldaste con evidencia. Eliges una y anotas un experimento corto. Los recordatorios todavía no existen. | You state your constraints and see catalogue routes, comparing what each one asks for with what you have already backed with evidence. You choose one and note a short experiment. Reminders do not exist yet. |
| `landing.v2.journey.s5.g` | nuevo | Opciones para comparar y ver qué te falta respaldar. Sin porcentajes ni promesas de empleo. | Options to compare, and a view of what you have not backed yet. No percentages and no job promises. |
| `landing.v2.routes.sample_tag` | nuevo | Ejemplo de la pantalla · no son rutas reales | Example of the screen · these are not real routes |
| `landing.v2.routes.sample_name` | nuevo | Ruta de ejemplo {n} | Example route {n} |
| `landing.v2.routes.sample_have` | nuevo | Capacidad de ejemplo: con evidencia tuya | Example capability: backed by your evidence |
| `landing.v2.routes.sample_missing` | nuevo | Capacidad de ejemplo: aún sin evidencia | Example capability: no evidence yet |
| `landing.v2.routes.sample_source` | nuevo | Fuente y fecha: aquí se mostrarán las del catálogo publicado. | Source and date: those of the published catalogue will appear here. |
| `landing.v2.routes.unavailable` | nuevo | El catálogo de rutas aún no está disponible. Mientras tanto puedes registrar evidencias: son la base para comparar rutas. | The route catalogue is not available yet. Meanwhile you can record evidence: it is the basis for comparing routes. |
| `landing.portada.try_title` | igual | Mira cómo funciona con un ejemplo | See how it works with an example |
| `landing.portada.try_example` | igual | Ejemplo fijo · no se guarda | Fixed example · not saved |
| `landing.portada.try_label` | igual | Escena de ejemplo | Example scene |
| `landing.portada.try_value` | igual | El pedido iba tarde. Avisé al equipo y reorganizamos la entrega. | The order was running late. I told the team and we rearranged the delivery. |
| `landing.portada.try_mark` | igual | Ver la sugerencia | See the suggestion |
| `landing.portada.try_note` | igual | Es un ejemplo fijo: la sugerencia ya está preparada. Nada de esto se envía ni se guarda. | This is a fixed example: the suggestion is already prepared. None of this is sent or saved. |
| `landing.portada.hint_title` | igual | Posible sugerencia | Possible suggestion |
| `landing.portada.hint_body` | igual | Se apoya en la frase «reorganizamos la entrega». Es algo para que revises, no una evaluación. | It rests on the phrase “we rearranged the delivery”. It is something for you to review, not an assessment. |
| `landing.portada.hint_yes` | igual | Sí, la respalda | Yes, it supports it |
| `landing.portada.hint_no` | igual | No estoy de acuerdo | I disagree |
| `landing.portada.hint_no_ok` | igual | Entendido: la sugerencia se descarta y no se anota nada. | Understood: the suggestion is discarded and nothing is noted. |
| `landing.portada.hint_ok` | cambia | En tu cuenta registrarías tu nivel con evidencia. Aquí no se guarda nada. | In your account you would record your level with evidence. Nothing is saved here. |
| `landing.not.title` | nuevo | Lo que Elevation no es | What Elevation is not |
| `landing.not.1` | nuevo | No es terapia, diagnóstico ni atención de urgencias. | It is not therapy, diagnosis or emergency care. |
| `landing.not.2` | nuevo | No certifica tus competencias. | It does not certify your skills. |
| `landing.not.3` | nuevo | No promete empleo ni resultados. | It does not promise a job or results. |
| `landing.not.4` | nuevo | La IA puede equivocarse. Tú revisas lo que propone. | The AI can be wrong. You review what it suggests. |
| `landing.trust.5.title` | igual | Si estás en una situación de riesgo | If you are in a risky situation |
| `landing.trust.5.body` | igual | Esto no es un servicio de urgencias. Contacta a los servicios de emergencia o de salud de tu país. | This is not an emergency service. Contact the emergency or health services in your country. |
| `landing.privacy.title` | nuevo | Privacidad, en palabras simples | Privacy, in plain words |
| `landing.privacy.1` | nuevo | Tu diario es privado: la aplicación no se lo muestra a profesionales ni a administración. | Your journal is private: the app does not show it to professionals or administrators. |
| `landing.privacy.2` | nuevo | Tu profesional no lee tu chat con la IA ni tu diario. | Your professional does not read your AI chat or your journal. |
| `landing.privacy.3` | nuevo | La IA solo analiza el chat, el diario o la hoja de vida que tú elijas y autorices. | The AI only analyses the chat, journal or résumé that you choose and authorise. |
| `landing.privacy.4` | nuevo | La aplicación muestra tus evidencias a tu cuenta. Una persona revisora ve únicamente las que autorices. | The app shows your evidence to your account. A reviewer sees only what you authorise. |
| `landing.privacy.5` | nuevo | En «Mis datos» puedes pedir una copia o la eliminación de tu cuenta, cuando esa opción esté habilitada. | In “My data” you can request a copy or deletion of your account, when that option is enabled. |
| `landing.privacy.pending` | cambia | El aviso de privacidad es un borrador: todavía no tiene revisión legal. | The privacy notice is a draft: it has not had legal review yet. |
| `landing.trust.policy` | igual | Política de privacidad | Privacy policy |
| `landing.today.title` | nuevo | Qué puedes usar hoy | What you can use today |
| `landing.status.available` | igual | Disponible | Available |
| `landing.status.soon` | igual | En preparación | In preparation |
| `landing.status.preview` | nuevo | Vista preliminar | Preview |
| `landing.today.chat` | nuevo | Conversación con un asistente de IA | Conversation with an AI assistant |
| `landing.today.journal` | nuevo | Diario privado | Private journal |
| `landing.today.evidence` | nuevo | Mis evidencias | My evidence |
| `landing.today.resume` | nuevo | Hoja de vida y habilidades que declara | Résumé and the skills it states |
| `landing.today.map` | nuevo | Mapa de capacidades | Capability map |
| `landing.today.compass` | nuevo | Brújula profesional | Career compass |
| `landing.today.data` | cambia | Mis datos (copia y eliminación) | My data (copy and deletion) |
| `landing.today.data_note` | nuevo | Depende de que esa opción esté habilitada en el servidor. | Depends on that option being enabled on the server. |
| `landing.today.routes` | cambia | Rutas, experimentos y plan | Routes, experiments and plan |
| `landing.today.exercises` | nuevo | Ejercicios opcionales | Optional exercises |
| `landing.today.exercises_note` | nuevo | La pantalla existe; todavía no hay ejercicios publicados. | The screen exists; no exercises have been published yet. |
| `landing.today.reminders` | nuevo | Recordatorios del plan | Plan reminders |
| `landing.next.pilot.title` | igual | Elevation está en piloto cerrado | Elevation is in a closed pilot |
| `landing.next.pilot.body` | igual | Por ahora el servicio es para las personas del piloto. Si ya tienes cuenta, inicia sesión. | For now the service is for the people in the pilot. If you already have an account, sign in. |
| `landing.faq.title` | igual | Preguntas frecuentes | Frequently asked questions |
| `landing.faq.q1` | igual | ¿Es terapia? | Is this therapy? |
| `landing.faq.a1` | cambia | No. El asistente de IA ofrece acompañamiento no clínico y orientación profesional. No diagnostica, no hace psicoterapia ni atiende urgencias. | No. The AI assistant offers non-clinical support and career guidance. It does not diagnose, provide psychotherapy or handle emergencies. |
| `landing.faq.q2` | igual | ¿Mis conversaciones son privadas? | Are my conversations private? |
| `landing.faq.a2` | cambia | Tu profesional no lee tu chat con la IA ni tu diario. La IA solo analiza las fuentes que tú elijas y autorices. | Your professional does not read your AI chat or your journal. The AI only analyses the sources you choose and authorise. |
| `landing.faq.q5` | igual | ¿El SkillMap certifica mis capacidades? | Does SkillMap certify my capabilities? |
| `landing.faq.a5` | igual | No. Muestra qué evidencia respalda cada capacidad. Aceptar una capacidad candidata no acredita un nivel. | No. It shows what evidence supports each capability. Accepting a candidate capability does not certify a level. |
| `landing.faq.q6` | igual | ¿Me garantizan un empleo? | Do you guarantee a job? |
| `landing.faq.a6` | igual | No. Conseguir empleo depende de condiciones externas y no forma parte de lo que ofrecemos. | No. Getting a job depends on external conditions and is not part of what we offer. |
| `landing.faq.q9` | igual | ¿Cuánto cuesta? | How much does it cost? |
| `landing.faq.a9` | igual | Por ahora no hay pago en línea: crear una cuenta no te cobra nada. | There is no online payment for now: creating an account does not charge you anything. |
| `landing.faq.q10` | igual | ¿En qué idiomas está? | Which languages are available? |
| `landing.faq.a10` | igual | Español e inglés. | Spanish and English. |
| `landing.faq.q_need` | nuevo | ¿Necesito tener mi hoja de vida? | Do I need to have my résumé? |
| `landing.faq.a_need` | nuevo | No. Puedes empezar contando una situación. La hoja de vida es opcional. | No. You can start by describing a situation. The résumé is optional. |
| `landing.entry.title` | nuevo | Empieza con una situación real | Start with one real situation |
| `landing.entry.body` | nuevo | No tiene que ser extraordinaria. Basta algo que recuerdes bien. | It does not need to be remarkable. Something you remember well is enough. |
| `landing.entry.pro` | nuevo | ¿Eres profesional que acompaña? Envía tu solicitud. | Are you a professional who supports people? Send your application. |
| `landing.footer.manifest` | nuevo | Manifiesto ético | Ethical manifesto |
| `landing.footer.terms` | nuevo | Términos de uso | Terms of use |
| `evidence.new` | igual | Nueva evidencia | New evidence |
| `evidence.intro` | igual | Solo las versiones confirmadas pueden usarse para evaluar capacidades. | Only confirmed versions can be used to assess skills. |
| `evidence.privacy` | igual | No necesitas compartir experiencias íntimas. | You do not need to share intimate experiences. |
| `evidence.lead_help` | nuevo | Cuenta una sola situación. No necesitas un texto perfecto: puedes guardar un borrador y volver. | Describe a single situation. It does not need to be perfect: you can save a draft and come back. |
| `evidence.no_secrets` | nuevo | No escribas contraseñas ni datos de otras personas. | Do not write passwords or other people’s personal data. |
| `evidence.examples.toggle` | nuevo | Ver dos ejemplos | See two examples |
| `evidence.examples.tag` | nuevo | Ejemplo ficticio · no es de nadie | Fictional example · not about anyone |
| `evidence.ex1.name` | nuevo | Ejemplo: un turno de soporte | Example: a support shift |
| `evidence.ex1.title` | nuevo | Reordenar la cola de incidencias un lunes | Reordering the incident queue on a Monday |
| `evidence.ex1.situation` | nuevo | Entraron muchas incidencias a la vez y dos eran de clientes que no podían trabajar. | Many incidents arrived at once and two came from customers who could not work. |
| `evidence.ex1.responsibility` | nuevo | Me tocaba decidir el orden de atención de mi turno. | It was my job to decide the order of attention for my shift. |
| `evidence.ex1.action` | nuevo | Separé las urgentes, avisé a las personas afectadas y repartí el resto con una compañera. | I separated the urgent ones, told the people affected and split the rest with a colleague. |
| `evidence.ex1.delivered` | nuevo | Una lista ordenada y un mensaje de estado para cada cliente urgente. | An ordered list and a status message for each urgent customer. |
| `evidence.ex1.effect` | nuevo | Las dos urgentes se atendieron primero. No sé qué pasó con las demás. | The two urgent ones were handled first. I do not know what happened with the rest. |
| `evidence.ex2.name` | nuevo | Ejemplo: coordinar a un grupo | Example: coordinating a group |
| `evidence.ex2.title` | nuevo | Preparar el cambio de un horario compartido | Preparing a change to a shared schedule |
| `evidence.ex2.situation` | nuevo | El grupo tenía que cambiar de horario y había opiniones distintas. | The group had to change its schedule and opinions differed. |
| `evidence.ex2.responsibility` | nuevo | Me pidieron reunir las necesidades y proponer una opción. | I was asked to gather the needs and propose an option. |
| `evidence.ex2.action` | nuevo | Pregunté a cada persona, anoté lo que no podían cambiar y presenté dos opciones. | I asked each person, noted what they could not change and presented two options. |
| `evidence.ex2.delivered` | nuevo | Un documento de una página con las dos opciones y sus límites. | A one-page document with both options and their limits. |
| `evidence.ex2.effect` | nuevo | El grupo eligió una opción. No medí si funcionó. | The group chose one option. I did not measure whether it worked. |
| `evidence.section.essential` | nuevo | Lo esencial | The essentials |
| `evidence.section.essential_help` | nuevo | Para confirmar necesitas estos seis. Para guardar un borrador bastan el título y otro campo. | To confirm you need these six. To save a draft, a title and one other field are enough. |
| `evidence.section.more` | nuevo | Añadir más contexto (opcional) | Add more context (optional) |
| `evidence.field_title` | igual | Título | Title |
| `evidence.help.title` | nuevo | Una frase corta para reconocerla después. | A short sentence so you can recognise it later. |
| `evidence.ph.title` | nuevo | Ej.: reordenar la cola un lunes | E.g. reordering the queue on a Monday |
| `evidence.situation` | igual | Situación | Situation |
| `evidence.help.situation` | nuevo | ¿Qué pasaba? ¿Quién estaba? ¿Qué estaba en juego? | What was happening? Who was there? What was at stake? |
| `evidence.responsibility` | igual | Mi responsabilidad | My responsibility |
| `evidence.help.responsibility` | nuevo | ¿De qué respondías tú, no el equipo? | What were you responsible for, as opposed to the team? |
| `evidence.actions` | igual | Acciones que realicé | Actions I took |
| `evidence.help.actions` | nuevo | Una acción por casilla, con un verbo: pregunté, ordené, expliqué… | One action per box, starting with a verb: I asked, I sorted, I explained… |
| `evidence.add_action` | igual | Añadir acción | Add action |
| `evidence.remove_action` | igual | Quitar acción | Remove action |
| `evidence.delivered` | igual | Lo que entregué realmente | What I actually delivered |
| `evidence.help.delivered` | nuevo | Lo que quedó hecho, aunque sea parcial. Una meta no es una entrega. | What actually got done, even partly. A goal is not a delivery. |
| `evidence.observedEffect` | igual | Efecto observado | Observed effect |
| `evidence.help.effect` | nuevo | Si no lo sabes, elige «No lo conozco»: es una respuesta válida. | If you do not know it, choose “I do not know it”: that is a valid answer. |
| `evidence.known` | igual | Lo conozco | I know it |
| `evidence.unknown` | igual | No lo conozco | I do not know it |
| `evidence.effect_text` | nuevo | ¿Qué observaste? | What did you observe? |
| `evidence.goal` | igual | Meta buscada | Intended goal |
| `evidence.help.goal` | nuevo | Lo que se quería lograr, aunque no se lograra. | What was meant to be achieved, even if it was not. |
| `evidence.alternatives` | igual | Alternativas que consideré | Alternatives I considered |
| `evidence.add_alternative` | igual | Añadir alternativa | Add alternative |
| `evidence.remove_alternative` | igual | Quitar alternativa | Remove alternative |
| `evidence.learning` | igual | Lo que aprendí | What I learned |
| `evidence.autonomy` | igual | Autonomía declarada | Self-reported autonomy |
| `evidence.autonomy_help` | igual | Es autorreporte, no una certificación de capacidad. | This is self-report, not a skill certification. |
| `evidence.unset` | igual | Por confirmar | To be confirmed |
| `evidence.conceptual` | igual | Conceptual | Conceptual |
| `evidence.assisted` | igual | Con asistencia | With assistance |
| `evidence.autonomous` | igual | Autónoma y repetible | Autonomous and repeatable |
| `evidence.leads` | igual | Lidera o enseña | Leads or teaches |
| `evidence.artifactRefs` | igual | Muestra opcional | Optional sample |
| `evidence.sample_help` | igual | Esta referencia se guarda como dato; no se abre ni se analiza. | This reference is stored as data; it is not opened or analyzed. |
| `evidence.url` | igual | Enlace HTTPS | HTTPS link |
| `evidence.add_sample` | igual | Añadir muestra | Add sample |
| `evidence.guide.use` | nuevo | Usar guía en este campo | Use a guide in this field |
| `evidence.guide.note` | nuevo | Solo se añade si el campo está vacío. Borra o completa las líneas antes de confirmar. | It is only added if the field is empty. Delete or complete the lines before confirming. |
| `evidence.guide.situation` | nuevo | Qué pasaba:  ⏎ Quién estaba:  ⏎ Qué estaba en juego:  | What was happening:  ⏎ Who was there:  ⏎ What was at stake:  |
| `evidence.guide.delivered` | nuevo | Lo que quedó hecho:  ⏎ Lo que quedó pendiente:  | What got done:  ⏎ What was left pending:  |
| `evidence.limit_count` | cambia | {n} de {max} caracteres | {n} of {max} characters |
| `evidence.required` | cambia | Necesario para confirmar | Required to confirm |
| `evidence.optional` | igual | Opcional | Optional |
| `evidence.pending_list` | nuevo | Para confirmar falta: {list}. | Still needed to confirm: {list}. |
| `evidence.pending_none` | nuevo | Ya tienes lo necesario para confirmar. | You have what you need to confirm. |
| `evidence.save` | igual | Guardar borrador | Save draft |
| `evidence.review` | igual | Revisar para confirmar | Review before confirming |
| `evidence.warning` | igual | Una meta no es un resultado logrado. Revisa cada campo antes de confirmar. | A goal is not an achieved result. Review each field before confirming. |
| `evidence.reviewed` | igual | He revisado esta evidencia. | I have reviewed this evidence. |
| `evidence.confirm` | igual | Confirmar evidencia | Confirm evidence |
| `evidence.edit` | igual | Seguir editando | Keep editing |
| `evidence.invalid` | igual | Revisa los campos indicados. | Check the highlighted fields. |
| `evidence.invalid_field` | igual | Introduce un valor válido dentro del límite indicado. | Enter a valid value within the displayed limit. |
| `evidence.err.required` | nuevo | Falta este campo para confirmar. | This field is needed to confirm. |
| `evidence.err.guide` | nuevo | Quedan líneas de la guía sin completar. | Some guide lines are still empty. |
| `evidence.draft_minimum` | igual | Un borrador necesita título y al menos otro campo significativo. | A draft needs a title and at least one other meaningful field. |
| `evidence.saving` | igual | Guardando… | Saving… |
| `evidence.draft_saved` | igual | Borrador guardado | Draft saved |
| `evidence.confirmed_saved` | igual | Evidencia confirmada | Evidence confirmed |
| `evidence.error` | igual | No pudimos guardar. Tus cambios siguen en esta pantalla. | We could not save. Your changes are still on this screen. |
| `evidence.uncertain_write` | igual | Tu texto sigue aquí. Reintenta y no se duplica. | Your text is still here. Retry and it will not be duplicated. |
| `evidence.retry` | igual | Reintentar | Retry |
| `evidence.list` | igual | Volver a mis evidencias | Back to my evidence |
| `cv.proposal.tag` | nuevo | Propuesta · función nueva, no construida | Proposal · new feature, not built |
| `cv.proposal.title` | nuevo | Prepara tu hoja de vida con lo que puedes respaldar | Prepare your résumé with what you can back up |
| `cv.proposal.lead` | nuevo | Compara lo que dice tu hoja de vida con tus evidencias. Tú decides qué cambias. | Compare what your résumé says with your evidence. You decide what to change. |
| `cv.proposal.stated` | nuevo | Tu hoja de vida declara | Your résumé states |
| `cv.proposal.sample` | nuevo | Habilidad de ejemplo {n} | Example skill {n} |
| `cv.proposal.has` | nuevo | Tienes una evidencia confirmada que la respalda | You have confirmed evidence that supports it |
| `cv.proposal.none` | nuevo | Todavía no tiene evidencia | It has no evidence yet |
| `cv.proposal.use` | nuevo | Ver la evidencia | See the evidence |
| `cv.proposal.add` | nuevo | Contar una situación | Describe a situation |
| `cv.proposal.limit` | nuevo | No puntúa tu hoja de vida ni garantiza que consigas trabajo. | It does not score your résumé or guarantee that you will get a job. |
| `access.adult_label` | nuevo | Declaro que tengo 18 años o más. | I declare that I am 18 or older. |
| `access.adult_help` | nuevo | El piloto es solo para mayores de 18 años. Es tu declaración: no verificamos tu identidad ni pedimos tu fecha de nacimiento. | The pilot is only for people 18 or older. This is your own declaration: we do not verify your identity or ask for your date of birth. |
| `access.err_adult` | nuevo | Para crear tu cuenta debes declarar que tienes 18 años o más. | To create your account you need to declare that you are 18 or older. |
| `access.err_adult_version` | nuevo | La declaración de edad cambió. Recarga la página y vuelve a marcarla. | The age declaration changed. Reload the page and tick it again. |
| `export.adult_version` | nuevo | Declaración de mayoría de edad (versión) | Age declaration (version) |
| `export.adult_date` | nuevo | Fecha de la declaración de edad | Age declaration date |
| `export.adult_none` | nuevo | Sin declaración registrada | No declaration recorded |

## Retirar (de la portada; confirmar antes de borrar claves del CMS)

| Clave(s) | Motivo |
|---|---|
| landing.portada.hero_pre / hero_em | Sustituidas por landing.portada.promise.p1 («Reconoce tu camino», decisión de Mauricio, ES-408). |
| landing.portada.legend / leg1…leg4 / hero_alt | La leyenda del héroe se reemplaza por el recorrido; el relieve queda como ilustración. |
| landing.portada.steps_title / steps_heading / st1…st3b / steps_note | Sustituidas por landing.v2.journey.*. |
| landing.portada.try_own / see_rise / rise_alt / hint_q | El ejemplo se acorta; la entrada queda en el bloque final. |
| landing.features.* y landing.soon.* | Sustituidas por landing.today.* (marcaban «Tus datos» en preparación). |
| landing.skillmap.* (intro, p1…p3, routes, experiment, ai) | Su contenido se reparte entre recorrido y «Disponible hoy». |
| landing.langs.* | Queda en preguntas frecuentes (q10). |
| landing.trust.1…4 | Sustituidas por landing.privacy.* y landing.not.*. |
| landing.faq.q3, q4, q7, q8 | q3 y q4 mencionan estados de funciones que hay que revisar; q7 y q8 se cubren en otras secciones. |
| «Tu santuario digital» (frontend/index.html:7) | Título de pestaña; reemplazado por html.title. |
