# Textos finales ES/EN · Elevation + Skill Map (ES-148)

> Generado desde `docs/ux/diseno-final/copy.js` (`node e2e/scripts/generar-textos.mjs`). No editar a mano: se cambia el .js y se regenera.
> **Estado: PROPUESTA** para la puerta de diseño. Nada se carga a `frontend/src/i18n` hasta que Mauricio o Alejo aprueben.

Reglas aplicadas: tuteo; frases cortas; producto **no clínico** (sin diagnóstico, sin prescripción, sin promesas de resultados ni de empleabilidad); privacidad visible; «Sin evaluar» como estado (nunca un déficit); sin cifras ni datos inventados (las cifras del prototipo están marcadas «de ejemplo» y no forman parte de los textos); ES y EN con el mismo sentido.

Columna **Origen**: *se conserva* = existe literal en `frontend/` o `docs/landing`; *aprobado en landing* = ya aprobado en ES-60/ES-66; *se ajusta* = existe y cambia; *nuevo* = no existía.
Los marcadores `{n}`, `{date}`, `{pct}`, `{a}`, `{b}` son variables que rellena la aplicación.


## Global

| Clave | ES | EN | Origen |
|---|---|---|---|
| `skip` | Saltar al contenido | Skip to content | se conserva (ya existe) |
| `brand` | elevation | elevation | se conserva (ya existe) |
| `lang.label` | Idioma | Language | se conserva (ya existe) |
| `nav.home` | Inicio | Home | nuevo |
| `nav.chat` | Conversación | Conversation | se conserva (ya existe) |
| `nav.map` | Mi mapa | My map | se ajusta (existe) |
| `nav.evidence` | Evidencias | Evidence | se ajusta (existe) |
| `nav.more` | Más | More | nuevo |
| `nav.diary` | Diario | Journal | se conserva (ya existe) |
| `nav.next` | Mi siguiente paso | My next step | se conserva (ya existe) |
| `nav.bridge` | El Puente | The Bridge | se conserva (ya existe) |
| `nav.compass` | Brújula | Compass | se ajusta (existe) |
| `nav.pro` | Mi profesional | My professional | se ajusta (existe) |
| `nav.data` | Mis datos | My data | se conserva (ya existe) |
| `nav.logout` | Cerrar sesión | Sign out | se conserva (ya existe) |
| `badge.private` | Privado · solo para ti | Private · only for you | se ajusta (existe) |
| `notice.nonclinical` | Elevation no es terapia, no da diagnósticos y no sustituye a un profesional de salud mental. | Elevation is not therapy, does not diagnose and does not replace a mental health professional. | se ajusta (existe) |
| `notice.safety` | Si sientes que estás en peligro o que puedes hacerte daño, contacta ahora con los servicios de emergencia de tu país o con alguien de confianza. | If you feel you are in danger or might harm yourself, contact your country’s emergency services or someone you trust right now. | nuevo |
| `state.loading` | Cargando… | Loading… | se ajusta (existe) |
| `state.retry` | Reintentar | Try again | se ajusta (existe) |
| `state.saved` | Guardado. | Saved. | nuevo |
| `state.coming` | Próximamente | Coming soon | se conserva (ya existe) |
| `btn.save` | Guardar | Save | se conserva (ya existe) |
| `btn.cancel` | Cancelar | Cancel | se conserva (ya existe) |
| `btn.back` | Volver | Back | se conserva (ya existe) |
| `btn.next` | Continuar | Continue | nuevo |
| `btn.skip` | Saltar por ahora | Skip for now | nuevo |

## Landing pública (versión piloto)

| Clave | ES | EN | Origen |
|---|---|---|---|
| `land.nav.how` | Cómo funciona | How it works | se conserva (ya existe) |
| `land.nav.login` | Ingresar | Log in | se conserva (ya existe) |
| `land.hero.label` | Acompañamiento + exploración profesional | Support + career exploration | aprobado en landing |
| `land.hero.title` | Lo que has vivido cuenta. | What you have lived counts. | aprobado en landing |
| `land.hero.sub` | Hay cosas que necesitas poner en palabras. Y otras que todavía no has reconocido en ti. Podemos empezar por cualquiera. | Some things you need to put into words. Others you have not yet recognised in yourself. We can start with either. | aprobado en landing |
| `land.door1.label` | Hacer espacio | Make space | aprobado en landing |
| `land.door1.title` | Ordenar lo que estoy viviendo | Sort out what I am going through | aprobado en landing |
| `land.door1.desc` | Una conversación con ritmo propio, sin diagnóstico y sin prisa. | A conversation at its own pace, without diagnosis and without hurry. | aprobado en landing |
| `land.door2.label` | Mirar otra vez | Look again | aprobado en landing |
| `land.door2.title` | Reconocer lo que puedo aportar | Recognise what I can contribute | aprobado en landing |
| `land.door2.desc` | Convierte tu experiencia en capacidades con evidencia que tú revisas. | Turn your experience into capabilities with evidence that you review. | aprobado en landing |
| `land.door.go` | Empezar | Start | aprobado en landing |
| `land.how.title` | Un recorrido que tú diriges | A path you steer | se ajusta (existe) |
| `land.how.1` | Empieza por donde quieras: conversar, escribir en tu diario o mirar tu experiencia. | Start wherever you like: talk, write in your journal or look at your experience. | nuevo |
| `land.how.2` | Cuenta lo que has hecho. Tú confirmas qué cuenta como evidencia. | Tell us what you have done. You confirm what counts as evidence. | nuevo |
| `land.how.3` | Ve tu mapa de capacidades y decide qué compartes y con quién. | See your capability map and decide what you share and with whom. | nuevo |
| `land.priv.title` | Tu espacio es privado | Your space is private | nuevo |
| `land.priv.body` | Tus conversaciones y tu diario son solo tuyos. Un profesional solo ve lo que tú decidas compartir, y puedes retirarlo cuando quieras. | Your conversations and journal are only yours. A professional only sees what you choose to share, and you can withdraw it at any time. | nuevo |
| `land.limits.title` | Lo que Elevation no es | What Elevation is not | nuevo |
| `land.limits.body` | No es terapia, no da diagnósticos ni promete resultados o empleo. El asistente es una inteligencia artificial. | It is not therapy, it does not diagnose or promise results or jobs. The assistant is an artificial intelligence. | nuevo |
| `land.pilot` | Estamos en piloto con un grupo pequeño de personas. Algunas funciones aún están en preparación. | We are piloting with a small group of people. Some features are still being prepared. | nuevo |
| `land.cta` | Crear mi cuenta | Create my account | se ajusta (existe) |
| `land.cta.sub` | Sin tarjeta de crédito. | No credit card needed. | se conserva (ya existe) |
| `land.pros` | ¿Eres profesional? Solicita acceso | Are you a professional? Request access | se ajusta (existe) |

## Acceso

| Clave | ES | EN | Origen |
|---|---|---|---|
| `login.title` | Ingresar | Log in | se conserva (ya existe) |
| `login.sub` | Un espacio solo para ti | A space just for you | se conserva (ya existe) |
| `login.email` | Correo electrónico | Email | se conserva (ya existe) |
| `login.password` | Contraseña | Password | se conserva (ya existe) |
| `login.show` | Mostrar | Show | se conserva (ya existe) |
| `login.hide` | Ocultar | Hide | nuevo |
| `login.submit` | Entrar a mi espacio | Enter my space | se conserva (ya existe) |
| `login.forgot` | ¿Olvidaste tu contraseña? | Forgot your password? | se conserva (ya existe) |
| `login.new` | ¿Primera vez aquí? | First time here? | se conserva (ya existe) |
| `login.create` | Crear cuenta | Create account | se conserva (ya existe) |
| `login.err.credentials` | Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo. | Incorrect email or password. Check your details and try again. | se ajusta (existe) |
| `login.err.required` | Escribe tu correo y tu contraseña. | Enter your email and password. | nuevo |
| `login.err.locked` | Por seguridad, bloqueamos el acceso unos minutos. Inténtalo más tarde. | For your security, we paused access for a few minutes. Please try again later. | se ajusta (existe) |

## Primeros pasos (onboarding de 3 pasos)

| Clave | ES | EN | Origen |
|---|---|---|---|
| `ob.progress` | Paso {n} de 3 | Step {n} of 3 | nuevo |
| `ob.s1.title` | Tu idioma y tu zona horaria | Your language and time zone | nuevo |
| `ob.s1.sub` | Las usamos para mostrarte todo en tu idioma y a tu hora. Puedes cambiarlas después. | We use them to show everything in your language and your time. You can change them later. | nuevo |
| `ob.s1.lang` | Idioma | Language | se conserva (ya existe) |
| `ob.s1.tz` | Zona horaria | Time zone | se conserva (ya existe) |
| `ob.s1.tz.use` | Usar la zona sugerida | Use the suggested zone | se conserva (ya existe) |
| `ob.s2.title` | ¿Por dónde quieres empezar? | Where would you like to start? | se conserva (ya existe) |
| `ob.s2.sub` | No es una decisión definitiva. Puedes pasar de una a otra cuando quieras. | This is not a final decision. You can move between them whenever you like. | nuevo |
| `ob.s2.o1` | Mi espacio | My space | se conserva (ya existe) |
| `ob.s2.o1d` | Conversar y escribir con calma. | Talk and write at your own pace. | nuevo |
| `ob.s2.o2` | Mi siguiente paso | My next step | se conserva (ya existe) |
| `ob.s2.o2d` | Mirar mi experiencia y dar un paso profesional. | Look at my experience and take a professional step. | se ajusta (existe) |
| `ob.s3.title` | Tu hoja de vida (opcional) | Your résumé (optional) | se ajusta (existe) |
| `ob.s3.sub` | Si la adjuntas, te proponemos lo que tu documento respalda. Tú lo revisas todo y no se guarda nada hasta que lo confirmes. | If you attach it, we suggest what your document supports. You review everything and nothing is saved until you confirm. | se conserva (ya existe) |
| `ob.s3.rules` | Solo PDF, hasta 5 MB. | PDF only, up to 5 MB. | se conserva (ya existe) |
| `ob.s3.drop` | Arrastra tu PDF aquí | Drag your PDF here | se conserva (ya existe) |
| `ob.s3.pick` | Elegir archivo PDF | Choose PDF file | se conserva (ya existe) |
| `ob.s3.note` | Todavía no enviamos nada: primero eliges el archivo y decides si nos autorizas a leerlo. | We send nothing yet: first you choose the file and decide whether to authorise us to read it. | se conserva (ya existe) |
| `ob.s3.manual` | Prefiero hacerlo a mano | I’d rather do it by hand | se ajusta (existe) |
| `ob.done` | Listo. Tu espacio está preparado. | All set. Your space is ready. | nuevo |

## Inicio

| Clave | ES | EN | Origen |
|---|---|---|---|
| `home.title` | Hola. ¿Cómo llegas hoy? | Hi. How are you arriving today? | se ajusta (existe) |
| `home.sub` | Este momento es solo tuyo. Puedes saltarlo. | This moment is just yours. You can skip it. | se ajusta (existe) |
| `emo.1` | Muy mal | Very low | se conserva (ya existe) |
| `emo.2` | No tan bien | Not so good | se conserva (ya existe) |
| `emo.3` | Neutral | Neutral | se conserva (ya existe) |
| `emo.4` | Bien | Good | se conserva (ya existe) |
| `emo.5` | Muy bien | Very good | se conserva (ya existe) |
| `home.talk` | Hablar con el asistente | Talk to the assistant | nuevo |
| `home.map.eyebrow` | Tu mapa | Your map | nuevo |
| `home.map.title` | Tus capacidades, a tu ritmo | Your capabilities, at your pace | nuevo |
| `home.map.body` | Un nivel necesita evidencia que tú confirmes. Empieza con una experiencia real. | A level needs evidence that you confirm. Start with one real experience. | se ajusta (existe) |
| `home.map.cta` | Abrir mi mapa | Open my map | se conserva (ya existe) |
| `home.ai.eyebrow` | Tu uso de IA | Your AI use | nuevo |
| `home.ai.renews` | Se renueva el {date} | Renews on {date} | se conserva (ya existe) |
| `home.diary.eyebrow` | Tu diario | Your journal | nuevo |
| `home.diary.empty` | Aún no has escrito nada. Cuando quieras, empieza con una línea. | You haven’t written anything yet. Whenever you like, start with one line. | nuevo |
| `home.diary.cta` | Nueva entrada | New entry | se conserva (ya existe) |
| `home.err` | No pudimos cargar esta tarjeta. Tus datos están a salvo. | We couldn’t load this card. Your data is safe. | nuevo |

## Conversación

| Clave | ES | EN | Origen |
|---|---|---|---|
| `chat.title` | Conversación | Conversation | se conserva (ya existe) |
| `chat.private` | Privada · solo visible para ti | Private · only visible to you | se conserva (ya existe) |
| `chat.pause` | Pausar | Pause | se conserva (ya existe) |
| `chat.ai` | Elevation · asistente de IA | Elevation · AI assistant | se ajusta (existe) |
| `chat.welcome` | Soy Elevation, un asistente de IA para explorar lo que quieras compartir. Puedes omitir cualquier tema o hacer una pausa. ¿Qué te gustaría explorar hoy? | I’m Elevation, an AI assistant for exploring whatever you’d like to share. You can skip any topic or take a pause. What would you like to explore today? | se conserva (ya existe) |
| `chat.label` | Mensaje | Message | se conserva (ya existe) |
| `chat.ph` | Escribe lo que quieras. Enter para enviar, Shift+Enter para una línea nueva. | Write whatever you like. Enter to send, Shift+Enter for a new line. | se ajusta (existe) |
| `chat.send` | Enviar | Send | se conserva (ya existe) |
| `chat.thinking` | Preparando respuesta… | Preparing a reply… | se conserva (ya existe) |
| `chat.usage` | Uso de IA este período | AI use this period | se conserva (ya existe) |
| `chat.usage.val` | {pct} % usado · se renueva el {date} | {pct}% used · renews on {date} | se conserva (ya existe) |
| `chat.pending.title` | No pudimos confirmar tu mensaje. | We couldn’t confirm your message. | se ajusta (existe) |
| `chat.pending.body` | Tu texto sigue aquí; no se perdió. Puedes consultar el estado o reintentar el mismo envío. | Your text is still here; nothing was lost. You can check the status or retry the same message. | se ajusta (existe) |
| `chat.pending.check` | Consultar estado | Check status | se conserva (ya existe) |
| `chat.pending.retry` | Reintentar el mismo envío | Retry the same message | se conserva (ya existe) |
| `chat.limit.title` | Llegaste al límite de IA de este período. | You’ve reached your AI limit for this period. | nuevo |
| `chat.limit.body` | Se renueva el {date}. Mientras tanto puedes escribir en tu diario o revisar tu mapa. | It renews on {date}. In the meantime you can write in your journal or review your map. | nuevo |
| `chat.diary.src` | Usar mi diario como contexto | Use my journal as context | nuevo |
| `chat.diary.none` | Diario: sin seleccionar | Journal: none selected | se conserva (ya existe) |

## Diario

| Clave | ES | EN | Origen |
|---|---|---|---|
| `dia.title` | Mi diario | My journal | se conserva (ya existe) |
| `dia.sub` | Privado · solo para ti | Private · only for you | se conserva (ya existe) |
| `dia.recent` | Entradas recientes | Recent entries | se conserva (ya existe) |
| `dia.new` | Nueva entrada | New entry | se conserva (ya existe) |
| `dia.empty.title` | Aún no tienes entradas | You have no entries yet | se ajusta (existe) |
| `dia.empty.body` | Escribe solo lo que quieras conservar. Guardar no comparte nada con nadie. | Write only what you want to keep. Saving shares nothing with anyone. | se ajusta (existe) |
| `dia.field.title` | Título (opcional) | Title (optional) | nuevo |
| `dia.field.body` | Lo que quieras escribir | Whatever you want to write | nuevo |
| `dia.save` | Guardar entrada | Save entry | nuevo |
| `dia.bridge` | Llevar al Puente | Take to the Bridge | se ajusta (existe) |
| `dia.err` | No pudimos cargar tu diario. Tus entradas están a salvo. | We couldn’t load your journal. Your entries are safe. | nuevo |

## Mi mapa

| Clave | ES | EN | Origen |
|---|---|---|---|
| `map.title` | Mi mapa de capacidades | My capability map | se ajusta (existe) |
| `map.sub` | Lo que aún no evaluaste queda en hueco, no en cero. Un nivel no certifica: muestra qué evidencia hay hoy. | What you haven’t assessed yet stays empty, not at zero. A level does not certify: it shows what evidence exists today. | se conserva (ya existe) |
| `map.empty.title` | Todavía no hay evidencia en ninguna capacidad | There is no evidence yet in any capability | se ajusta (existe) |
| `map.empty.body` | Un nivel necesita algo que hiciste: la situación, tu parte y lo que entregaste. Mientras no la haya, el mapa muestra «Sin evaluar»; no es un déficit. | A level needs something you did: the situation, your part and what you delivered. Until then the map shows “Not assessed”; it is not a shortfall. | se ajusta (existe) |
| `map.empty.cta` | Añadir mi primera evidencia | Add my first evidence | se ajusta (existe) |
| `map.view.radar` | Radar | Radar | se conserva (ya existe) |
| `map.view.terr` | Territorios | Territories | se conserva (ya existe) |
| `map.view.list` | Lista | List | nuevo |
| `map.status.none` | Sin evaluar | Not assessed | se conserva (ya existe) |
| `map.status.evid` | Con evidencia | With evidence | se conserva (ya existe) |
| `map.level` | Nivel {n} | Level {n} | se conserva (ya existe) |
| `map.source.conv` | Identificado en conversación | Identified in conversation | se conserva (ya existe) |
| `map.source.evid` | Evidencia aportada | Evidence provided | se conserva (ya existe) |
| `map.record` | Registrar mi nivel | Record my level | se conserva (ya existe) |
| `map.refresh` | Actualizar mapa | Refresh map | se conserva (ya existe) |
| `map.footer` | El nivel no certifica: muestra qué evidencia hay hoy. No se compara con otras personas. | The level does not certify: it shows what evidence exists today. It is not compared with other people. | se conserva (ya existe) |
| `map.share` | Lo que decidas compartir con tu profesional se elige en El Puente. | What you decide to share with your professional is chosen in The Bridge. | nuevo |
| `map.err` | No pudimos cargar tu mapa. | We couldn’t load your map. | se conserva (ya existe) |

## Evidencias

| Clave | ES | EN | Origen |
|---|---|---|---|
| `ev.title` | Mis evidencias | My evidence | se conserva (ya existe) |
| `ev.sub` | Solo lo que tú confirmas cuenta para tu mapa. | Only what you confirm counts toward your map. | se ajusta (existe) |
| `ev.new` | Nueva evidencia | New evidence | se conserva (ya existe) |
| `ev.empty.title` | Aún no tienes evidencias | You have no evidence yet | se ajusta (existe) |
| `ev.empty.body` | Una evidencia es algo que hiciste. Cuéntala en tres partes; tarda unos minutos y puedes dejarla en borrador. | Evidence is something you did. Describe it in three parts; it takes a few minutes and you can leave it as a draft. | se ajusta (existe) |
| `ev.f.situation` | La situación | The situation | nuevo |
| `ev.f.situation.h` | ¿Qué estaba pasando? ¿Qué se necesitaba? | What was going on? What was needed? | nuevo |
| `ev.f.part` | Tu parte | Your part | nuevo |
| `ev.f.part.h` | ¿Qué hiciste tú, concretamente? | What did you do, specifically? | nuevo |
| `ev.f.result` | Lo que entregaste | What you delivered | nuevo |
| `ev.f.result.h` | ¿Qué resultó de lo que hiciste? | What came out of what you did? | nuevo |
| `ev.draft` | Guardar como borrador | Save as draft | nuevo |
| `ev.confirm` | Confirmar evidencia | Confirm evidence | nuevo |
| `ev.saved` | Evidencia guardada. No cuenta para tu mapa hasta que la confirmes. | Evidence saved. It doesn’t count toward your map until you confirm it. | nuevo |
| `ev.privacy` | Evita datos de salud o de otras personas. Nadie más ve esto salvo que tú lo compartas. | Avoid health information or other people’s details. No one else sees this unless you share it. | se ajusta (existe) |

## Mi siguiente paso

| Clave | ES | EN | Origen |
|---|---|---|---|
| `nx.title` | Mi siguiente paso | My next step | se conserva (ya existe) |
| `nx.tab.routes` | Rutas | Routes | nuevo |
| `nx.tab.exp` | Experimentos | Experiments | nuevo |
| `nx.tab.plan` | Plan | Plan | nuevo |
| `nx.soon.title` | Estamos preparando esta parte | We’re preparing this part | nuevo |
| `nx.soon.body` | Aquí podrás explorar rutas posibles, probar un experimento pequeño y armar un plan a 7, 30 y 90 días. Todavía no está disponible. | Here you’ll be able to explore possible routes, try a small experiment and build a 7-, 30- and 90-day plan. It isn’t available yet. | nuevo |
| `nx.soon.cta` | Mientras tanto: añadir una evidencia | Meanwhile: add evidence | nuevo |
| `nx.routes.note` | Las rutas son ideas para explorar, no recomendaciones ni promesas de empleo. | Routes are ideas to explore, not recommendations or promises of a job. | nuevo |

## El Puente

| Clave | ES | EN | Origen |
|---|---|---|---|
| `br.title` | El Puente | The Bridge | se conserva (ya existe) |
| `br.sub` | Tú decides qué se comparte con tu profesional. Nada cruza sin tu autorización. | You decide what is shared with your professional. Nothing crosses without your authorisation. | se ajusta (existe) |
| `br.private` | Lo tuyo, privado | Yours, private | se ajusta (existe) |
| `br.shared` | Lo que compartes | What you share | se ajusta (existe) |
| `br.shared.empty` | Aún no compartes nada. | You aren’t sharing anything yet. | se ajusta (existe) |
| `br.src.chat` | Conversación con el asistente | Conversation with the assistant | se ajusta (existe) |
| `br.src.chat.d` | Lee tus últimos mensajes (hasta 20). No incluye tus estados de ánimo. | Reads your latest messages (up to 20). It does not include your mood check-ins. | se conserva (ya existe) |
| `br.src.diary` | Diario | Journal | se conserva (ya existe) |
| `br.src.diary.d` | Lee tus últimas entradas (hasta 10). Tu diario sigue siendo solo tuyo. | Reads your latest entries (up to 10). Your journal stays only yours. | se conserva (ya existe) |
| `br.src.cv` | Hoja de vida | Résumé | se conserva (ya existe) |
| `br.src.cv.d` | Lee el texto de tu hoja de vida, sin tus datos de contacto. | Reads the text of your résumé, without your contact details. | se conserva (ya existe) |
| `br.off` | No autorizado | Not authorised | se conserva (ya existe) |
| `br.on` | Autorizado | Authorised | nuevo |
| `br.analyze` | Analizar esta fuente | Analyse this source | nuevo |
| `br.analyze.hint` | Autoriza esta fuente para poder analizarla. | Authorise this source to analyse it. | se conserva (ya existe) |
| `br.unsaved` | Estas propuestas no se guardan: si sales sin autorizarlas, tendrás que analizar de nuevo. | These suggestions aren’t saved: if you leave without authorising them, you’ll need to analyse again. | se conserva (ya existe) |
| `br.crisis` | Las señales de crisis nunca se comparten con un profesional ni con terceros. | Crisis signals are never shared with a professional or anyone else. | nuevo |

## Mi profesional

| Clave | ES | EN | Origen |
|---|---|---|---|
| `pro.title` | Mi profesional | My professional | se ajusta (existe) |
| `pro.none` | Todavía no tienes un profesional asignado. | You don’t have a professional assigned yet. | nuevo |
| `pro.find` | Buscar un profesional | Find a professional | nuevo |
| `pro.session.none` | Aún no hay una sesión agendada. | There’s no session scheduled yet. | se ajusta (existe) |

## Mis datos

| Clave | ES | EN | Origen |
|---|---|---|---|
| `dat.title` | Mis datos | My data | se conserva (ya existe) |
| `dat.sub` | Aquí puedes llevarte una copia de tus datos o pedir que eliminemos tu cuenta. Solo tú los ves. | Here you can take a copy of your data or ask us to delete your account. Only you can see them. | se conserva (ya existe) |
| `dat.exp.title` | Exportar mis datos | Export my data | se conserva (ya existe) |
| `dat.exp.body` | Un archivo JSON con tus datos personales. Prepara una vista previa y luego descárgalo. | A JSON file with your personal data. Prepare a preview, then download it. | se conserva (ya existe) |
| `dat.exp.cta` | Preparar vista previa | Prepare preview | se conserva (ya existe) |
| `dat.del.title` | Eliminar mi cuenta | Delete my account | se conserva (ya existe) |
| `dat.del.body` | Se desactiva tu cuenta y se cierran tus sesiones de inmediato. No podrás deshacerlo desde esta pantalla. | Your account is deactivated and your sessions end immediately. You won’t be able to undo this from this screen. | se conserva (ya existe) |
| `dat.del.cta` | Quiero eliminar mi cuenta | I want to delete my account | se conserva (ya existe) |
| `dat.del.confirm.title` | ¿Eliminar tu cuenta? | Delete your account? | nuevo |
| `dat.del.confirm.body` | Para confirmar, escribe tu correo. Esta acción no se puede deshacer desde aquí. | To confirm, type your email. This can’t be undone from here. | nuevo |
| `dat.del.confirm.cta` | Eliminar mi cuenta | Delete my account | nuevo |

## Profesional · Personas que acompaño

| Clave | ES | EN | Origen |
|---|---|---|---|
| `th.title` | Personas que acompaño | People I support | se ajusta (existe) |
| `th.count` | {n} asignada | {n} assigned | se ajusta (existe) |
| `th.card.noaccess` | Sin acceso | No access | se conserva (ya existe) |
| `th.card.noaccess.body` | Esta persona no ha autorizado compartir sus datos contigo. Puedes seguir agendando sesiones. | This person hasn’t authorised sharing their data with you. You can still schedule sessions. | se conserva (ya existe) |
| `th.card.view` | Ver perfil | View profile | se conserva (ya existe) |
| `th.guide.title` | Mi guía para la IA | My guidance for the AI | se ajusta (existe) |
| `th.guide.none` | Aún no tienes una guía activa. | You don’t have an active guidance yet. | se ajusta (existe) |
| `th.guide.cta` | Crear guía | Create guidance | se ajusta (existe) |
| `th.alerts` | Alertas | Alerts | se conserva (ya existe) |
| `th.alerts.none` | Sin alertas activas. | No active alerts. | se conserva (ya existe) |
| `th.scope` | Solo ves lo que cada persona decide compartir contigo. | You only see what each person chooses to share with you. | nuevo |

## Administración · Usuarios

| Clave | ES | EN | Origen |
|---|---|---|---|
| `ad.title` | Usuarios | Users | se conserva (ya existe) |
| `ad.count` | {n} usuarios registrados | {n} registered users | se ajusta (existe) |
| `ad.search` | Buscar por nombre o correo | Search by name or email | nuevo |
| `ad.f.role` | Rol | Role | se conserva (ya existe) |
| `ad.f.state` | Estado | Status | se conserva (ya existe) |
| `ad.create` | Crear usuario | Create user | se ajusta (existe) |
| `ad.col.user` | Usuario | User | se conserva (ya existe) |
| `ad.col.role` | Rol | Role | se conserva (ya existe) |
| `ad.col.state` | Estado | Status | se conserva (ya existe) |
| `ad.col.action` | Acciones | Actions | se ajusta (existe) |
| `ad.page` | Página {a} de {b} | Page {a} of {b} | nuevo |
| `ad.prev` | Anterior | Previous | nuevo |
| `ad.nextp` | Siguiente | Next | nuevo |
| `ad.empty` | No hay usuarios con esos filtros. | No users match these filters. | se ajusta (existe) |
| `ad.err` | No pudimos cargar los usuarios. | We couldn’t load the users. | nuevo |
| `ad.role.user` | Persona | Person | nuevo |
| `ad.role.therapist` | Profesional | Professional | nuevo |
| `ad.role.admin` | Administración | Administrator | nuevo |
| `ad.role.superadmin` | Superadministración | Super administrator | nuevo |
| `ad.role.board` | Junta ética | Ethics board | nuevo |
| `ad.state.active` | Activo | Active | se conserva (ya existe) |
| `ad.state.inactive` | Inactivo | Inactive | se conserva (ya existe) |

## Resumen
Total: 238 textos · se conservan 115 · se ajustan 50 · nuevos 73.

## Textos existentes que este diseño **retira o reemplaza** (hallazgos del informe)
| Hoy (frontend/src/i18n u otras pantallas) | Problema | Reemplazo |
|---|---|---|
| «Soporte emocional con IA», «Encuentra tu calma interior», «Tu compañero privado para la claridad mental y el bienestar emocional» (`hero_*`, legado) | Promesa de bienestar; contradice «no clínico» | Héroe aprobado: «Lo que has vivido cuenta.» |
| «Mis pacientes», «Historia del paciente», «Notas clínicas», «Resumen clínico IA», «Resumen de tu práctica clínica» (`therapist_*`) | Lenguaje clínico en un producto no clínico | «Personas que acompaño», «Contexto compartido»; las notas y el resumen requieren decisión del PO |
| «Mi prompt terapéutico» | «Terapéutico» | «Mi guía para la IA» |
| «Mejorando / Estable / Bajando» (tendencia de ánimo) | Interpreta el estado de la persona | A decidir con el PO: mostrar solo registros, sin etiquetar tendencia |
| «El Puente estará disponible cuando su flujo de autorización esté integrado» | Jerga de desarrollo | Se retira (el Puente ya abre) |
| «Consola de facilitación — La vista preliminar no está habilitada» | Pantalla interna visible a personas | No se muestra a personas |
| «Este recorrido aún no está disponible» / «Los ejercicios aún no están disponibles» | Callejón sin salida | «Estamos preparando esta parte» + una acción útil |
| «Credenciales incorrectas» | Seco y no orienta | «Correo o contraseña incorrectos. Revisa los datos…» |
| «Mood prom.», «Rating prom.», «Resetear contraseña», «Rollback», «Top terapeutas» | Anglicismos y jerga en administración | Pendiente de glosario de administración (fuera de este diseño) |

## Textos que requieren decisión o revisión antes de cargarlos
1. **`notice.safety`** (aviso de seguridad): es nuevo y delicado. Sin números de emergencia porque varían por país y no los verifiqué. Revisar con PO y con la guía Brújula (QA).
2. **`land.cta.sub`** («Sin tarjeta de crédito.»): ya existía; la oferta comercial de los planes **no está verificada** (ES-73 D-01), por eso la landing del piloto no publica planes ni «gratis».
3. **`land.pilot`** («Estamos en piloto con un grupo pequeño…»): afirmación pública sobre el estado del proyecto; confirmar con el PO.
4. **`pro.*` / `th.*`**: «profesional» en lugar de «terapeuta/paciente» es decisión de producto.
5. **`nx.soon.body`** menciona «plan a 7, 30 y 90 días»: figura en la landing aprobada; confirmar que sigue vigente.
6. **`map.level`** («Nivel N») y `map.source.*`: dependen de **ES-114** (A: solo estados y fuente; B: estados + nivel con evidencia). El prototipo muestra B; con A se retiran las casillas y «Nivel N».
7. Nombres de las 8 capacidades: salen del catálogo (staging) y se traducen allí, no aquí.
