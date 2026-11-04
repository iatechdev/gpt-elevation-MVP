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

## Navegación y global (añadidos)

| Clave | ES | EN | Origen |
|---|---|---|---|
| `nav.main` | Principal | Main | nuevo |
| `nav.account` | Mi cuenta | My account | nuevo |
| `nav.plan` | Mi plan | My plan | se conserva (ya existe) |
| `btn.close` | Cerrar | Close | se conserva (ya existe) |
| `role.pro` | Profesional | Professional | nuevo |
| `role.admin` | Administración | Administration | nuevo |
| `home.after` | Gracias por decírmelo. Puedes hablar con el asistente, escribir en tu diario o simplemente quedarte aquí. | Thank you for telling me. You can talk to the assistant, write in your journal or simply stay here. | nuevo |
| `home.diary.line` | Escribir solo para mí | Write just for me | nuevo |
| `home.plan.link` | Ver mi plan y mis solicitudes | See my plan and requests | nuevo |
| `home.err.safe` | Tus datos están a salvo. | Your data is safe. | nuevo |
| `pro.next` | Próxima sesión | Next session | se conserva (ya existe) |
| `land.pilot.label` | Piloto | Pilot | nuevo |
| `ob.finish` | Entrar a mi espacio | Enter my space | se conserva (ya existe) |

## Conversación (turnos, acciones y estados)

| Clave | ES | EN | Origen |
|---|---|---|---|
| `chat.you` | Tú | You | nuevo |
| `chat.sample` | Ejemplo real capturado en staging (cuenta sintética) | Real example captured in staging (synthetic account) | nuevo |
| `chat.empty.title` | Empieza cuando quieras | Start whenever you like | nuevo |
| `chat.q.label` | Responder más fácil | Easier ways to reply | nuevo |
| `chat.q.skip` | Prefiero no responder esa ahora | I’d rather not answer that now | nuevo |
| `chat.q.skip.send` | Prefiero no responder esa pregunta ahora. | I’d rather not answer that question right now. | nuevo |
| `chat.q.other` | Propón otro camino | Suggest another path | nuevo |
| `chat.q.other.send` | ¿Podemos probar otro camino? | Could we try another path? | nuevo |
| `chat.q.pause` | Hacer una pausa | Take a pause | nuevo |
| `chat.q.pause.send` | Quiero hacer una pausa por ahora. | I’d like to pause for now. | nuevo |
| `chat.msg.copy` | Copiar | Copy | nuevo |
| `chat.msg.copied` | Copiado. | Copied. | nuevo |
| `chat.msg.evidence` | Guardar como evidencia | Save as evidence | nuevo |
| `chat.msg.saved` | Guardado en tus evidencias | Saved to your evidence | nuevo |
| `chat.paused` | Conversación en pausa. No se envía nada hasta que la retomes. Tu historial sigue aquí. | Conversation paused. Nothing is sent until you resume. Your history stays here. | se conserva (ya existe) |
| `chat.resume` | Retomar | Resume | se conserva (ya existe) |
| `chat.usage.note` | Cada mensaje usa una parte de tu cupo. | Each message uses part of your allowance. | nuevo |
| `chat.draft.title` | Borrador de evidencia | Evidence draft | nuevo |
| `chat.draft.sub` | Tomamos tus palabras como punto de partida. Complétalo y confírmalo: no cuenta hasta que lo hagas. | We take your words as a starting point. Complete and confirm it: it doesn’t count until you do. | nuevo |
| `chat.draft.from` | Tus palabras | Your words | nuevo |
| `dia.private` | Privada | Private | nuevo |

## Evidencia (formulario guiado de 3 pasos; mismos campos y obligatoriedad que hoy)

| Clave | ES | EN | Origen |
|---|---|---|---|
| `ev.f.title` | Título | Title | se conserva (ya existe) |
| `ev.f.actions` | Qué hiciste, paso a paso | What you did, step by step | se ajusta (existe) |
| `ev.f.actions.h` | Al menos una acción. Escribe cada una en su propia línea. | At least one action. Write each on its own line. | nuevo |
| `ev.f.effect` | ¿Se notó algún efecto? | Was any effect noticed? | se ajusta (existe) |
| `ev.effect.known` | Sí, y lo puedo describir | Yes, and I can describe it | nuevo |
| `ev.effect.unknown` | No lo sé | I don’t know | se conserva (ya existe) |
| `ev.f.autonomy` | Autonomía con la que lo hiciste | How independently you did it | se ajusta (existe) |
| `ev.autonomy.unset` | Por confirmar | To be confirmed | se conserva (ya existe) |
| `ev.autonomy.conceptual` | Conceptual | Conceptual | se conserva (ya existe) |
| `ev.autonomy.assisted` | Con asistencia | With assistance | se conserva (ya existe) |
| `ev.autonomy.autonomous` | Autónoma y repetible | Autonomous and repeatable | se conserva (ya existe) |
| `ev.autonomy.leads` | Lidera o enseña | Leads or teaches | se conserva (ya existe) |
| `ev.autonomy.help` | Es autorreporte, no una certificación de capacidad. | This is self-report, not a skill certification. | se conserva (ya existe) |
| `ev.list.confirmed` | Confirmada | Confirmed | nuevo |
| `ev.list.draft` | Borrador | Draft | nuevo |
| `ev.counts` | Cuenta para tu mapa | Counts toward your map | nuevo |
| `ev.notcounts` | No cuenta todavía | Doesn’t count yet | nuevo |
| `ev.saved.draft` | Borrador guardado. No cuenta para tu mapa hasta que lo confirmes. | Draft saved. It doesn’t count toward your map until you confirm it. | nuevo |

## Mi mapa (camino, detalle y registro de nivel)

| Clave | ES | EN | Origen |
|---|---|---|---|
| `map.guide.title` | Cómo se llega a un nivel | How you get to a level | se ajusta (existe) |
| `map.guide.1` | Cuenta una experiencia real en «Evidencias» o desde la conversación. | Describe a real experience in “Evidence” or from the conversation. | se ajusta (existe) |
| `map.guide.2` | Confírmala: solo lo que tú confirmas cuenta. | Confirm it: only what you confirm counts. | se conserva (ya existe) |
| `map.guide.3` | Pulsa «Registrar mi nivel» en una capacidad y elige el nivel que tu evidencia respalda. | Press “Record my level” on a capability and choose the level your evidence supports. | se ajusta (existe) |
| `map.detail` | Detalle de la capacidad | Capability detail | se conserva (ya existe) |
| `map.list` | Todas tus capacidades | All your capabilities | se conserva (ya existe) |
| `map.select` | Elige una capacidad en el radar o en la lista para ver su detalle. | Choose a capability on the radar or in the list to see its detail. | se ajusta (existe) |
| `map.radar.hint` | Cada cuña es una capacidad. Lo que no evaluaste queda en hueco, no en cero. | Each wedge is a capability. What you haven’t assessed stays empty, not at zero. | se ajusta (existe) |
| `map.rubric` | Criterios del catálogo vigente | Current catalogue criteria | se conserva (ya existe) |
| `map.revoke` | Revocar todos los permisos | Revoke all permissions | se conserva (ya existe) |
| `map.revoke.title` | ¿Revocar todos los permisos? | Revoke all permissions? | se conserva (ya existe) |
| `map.revoke.body` | Se retirará tu permiso para el recorrido profesional: lo que habías autorizado dejará de cruzar. Puedes autorizar de nuevo más adelante. | Your permission for the career journey will be withdrawn: what you had authorised will stop crossing. You can authorise again later. | se conserva (ya existe) |
| `map.revoke.yes` | Sí, revocar | Yes, revoke | se conserva (ya existe) |
| `lv.open` | Registrar mi nivel | Record my level | se conserva (ya existe) |
| `lv.change` | Cambiar mi nivel | Change my level | se conserva (ya existe) |
| `lv.retire` | Retirar mi nivel | Remove my level | se conserva (ya existe) |
| `lv.intro` | Tu nivel es tu valoración, respaldada por tu evidencia: no certifica. Solo cuenta lo que tú confirmas. | Your level is your own assessment, backed by your evidence: it doesn’t certify. Only what you confirm counts. | se conserva (ya existe) |
| `lv.s1` | Elige la evidencia que respalda tu nivel (de 1 a {max}) | Choose the evidence that backs your level (1 to {max}) | se conserva (ya existe) |
| `lv.s2` | ¿Qué nivel describe mejor lo que hiciste? | Which level best describes what you did? | se conserva (ya existe) |
| `lv.s3` | Una nota y revisión final | A note and final check | se ajusta (existe) |
| `lv.note` | Nota (opcional, hasta 500 caracteres) | Note (optional, up to 500 characters) | se conserva (ya existe) |
| `lv.rubric.ph` | Criterio del nivel {n}: texto del catálogo vigente | Level {n} criterion: text from the current catalogue | nuevo |
| `lv.rubric.src` | Criterios del catálogo vigente (versión {v}). | Criteria from the current catalogue (version {v}). | se conserva (ya existe) |
| `lv.ev.meta` | Confirmada · versión 1 | Confirmed · version 1 | se conserva (ya existe) |
| `lv.ev.count` | evidencia(s) | evidence item(s) | nuevo |
| `lv.see` | Ver o añadir en «Evidencias» | View or add in “Evidence” | se conserva (ya existe) |
| `lv.summary` | Resumen | Summary | nuevo |
| `lv.warn` | Si más adelante editas o borras la evidencia que citas, tu nivel dejará de mostrarse hasta que lo registres de nuevo. | If you later edit or delete the evidence you cite, your level will stop showing until you record it again. | se conserva (ya existe) |
| `lv.save` | Guardar mi nivel | Save my level | se conserva (ya existe) |
| `lv.saved` | Nivel guardado. | Level saved. | se conserva (ya existe) |
| `lv.retired` | Nivel retirado. | Level removed. | se conserva (ya existe) |
| `lv.retire.title` | ¿Retirar tu nivel? | Remove your level? | se conserva (ya existe) |
| `lv.retire.body` | Tu nivel se retira y la capacidad vuelve a «Sin evaluar». Tu evidencia no se borra. | Your level is removed and the capability goes back to “Not assessed”. Your evidence is not deleted. | se conserva (ya existe) |
| `lv.retire.yes` | Sí, retirar | Yes, remove | se conserva (ya existe) |
| `lv.none.title` | Primero necesitas una evidencia confirmada | You first need a confirmed piece of evidence | se conserva (ya existe) |
| `lv.none.text` | Un nivel se apoya en algo que hiciste: su situación, tu parte y lo que entregaste. Cuéntalo y confírmalo. | A level rests on something you did: its situation, your part and what you delivered. Describe it and confirm it. | se ajusta (existe) |
| `lv.none.cta` | Añadir mi primera evidencia | Add my first evidence | se ajusta (existe) |

## Análisis de evidencia con IA (propuesta que tú decides)

| Clave | ES | EN | Origen |
|---|---|---|---|
| `ai.open_skill` | Pedir propuesta de la IA para esta capacidad | Ask the AI for a proposal for this capability | se conserva (ya existe) |
| `ai.title` | Analizar mi evidencia con IA | Analyse my evidence with AI | se conserva (ya existe) |
| `ai.pick.text` | La IA lee solo las evidencias que ya confirmaste y propone un nivel por capacidad, con su razón. Tú decides. Lo que no tenga evidencia no cambia. | The AI reads only the evidence you already confirmed and proposes a level per capability, with its reasoning. You decide. Anything without evidence stays as it is. | se conserva (ya existe) |
| `ai.pick` | Elige hasta {max} capacidades para analizar | Choose up to {max} capabilities to analyse | se conserva (ya existe) |
| `ai.selected` | {n} seleccionadas de {max} | {n} selected of {max} | se conserva (ya existe) |
| `ai.privacy` | La IA solo ve tus evidencias confirmadas y la rúbrica del catálogo. No ve tu diario, tu ánimo ni tus conversaciones. Cada análisis usa tu cupo de análisis. | The AI only sees your confirmed evidence and the catalogue rubric. It does not see your journal, your mood or your conversations. Each analysis uses your analysis allowance. | se ajusta (existe) |
| `ai.selected_one` | 1 seleccionada de {max} | 1 selected of {max} | se conserva (ya existe) |
| `ai.go` | Analizar | Analyse | se conserva (ya existe) |
| `ai.analyzing` | Analizando tu evidencia… puede tardar unos segundos. | Analysing your evidence… it may take a few seconds. | se conserva (ya existe) |
| `ai.rev.title` | Propuestas de la IA | AI proposals | se conserva (ya existe) |
| `ai.rev.text` | Revisa cada una. Puedes aceptarla, bajarla de nivel, dejarla sin evaluar o no guardarla. No puedes subirla. | Review each one. You can accept it, lower it, leave it unassessed or not save it. You can’t raise it. | se conserva (ya existe) |
| `ai.tag` | Propuesta de la IA · tú decides | AI proposal · you decide | se conserva (ya existe) |
| `ai.proposed` | Nivel propuesto | Proposed level | se conserva (ya existe) |
| `ai.why` | Razón de la IA | AI’s reasoning | se conserva (ya existe) |
| `ai.why.ex` | Texto de la razón que devuelve la IA, citando tu evidencia. | Reasoning text returned by the AI, citing your evidence. | nuevo |
| `ai.evid` | Evidencia citada | Evidence cited | se conserva (ya existe) |
| `ai.conf.rule` | La confianza del respaldo la calcula el sistema con reglas; no la decide la IA. | The system calculates the confidence of the support with rules; the AI doesn’t decide it. | se conserva (ya existe) |
| `ai.accept` | Aceptar nivel {n} | Accept level {n} | se conserva (ya existe) |
| `ai.down` | Bajar a nivel {n} | Lower to level {n} | se conserva (ya existe) |
| `ai.unassessed` | Dejar sin evaluar (retira mi nivel actual, si lo hay) | Leave unassessed (removes my current level, if any) | se conserva (ya existe) |
| `ai.skip` | No guardar | Don’t save | se conserva (ya existe) |
| `ai.expires` | Esta propuesta vence en 10 minutos. | This proposal expires in 10 minutes. | se conserva (ya existe) |
| `ai.save.n` | Se guardarán {n} y no se tocará el resto. | {n} will be saved and nothing else will change. | se conserva (ya existe) |
| `ai.save` | Guardar las aceptadas | Save accepted ones | se conserva (ya existe) |
| `ai.done` | Guardado como «propuesto por la IA y confirmado por ti». | Saved as “proposed by the AI and confirmed by you”. | se ajusta (existe) |
| `ai.noev.title` | Primero necesitas una evidencia confirmada | You first need a confirmed piece of evidence | se conserva (ya existe) |
| `ai.noev.text` | La IA solo propone a partir de evidencias que tú confirmaste. Cuenta una situación real y confírmala. | The AI only proposes from evidence you confirmed. Describe a real situation and confirm it. | se conserva (ya existe) |
| `ai.close` | Cerrar | Close | se conserva (ya existe) |

## Crear cuenta

| Clave | ES | EN | Origen |
|---|---|---|---|
| `reg.name` | Nombre | Name | se conserva (ya existe) |
| `reg.name.ph` | Tu nombre | Your name | se conserva (ya existe) |
| `reg.pw.title` | Tu contraseña debe tener: | Your password must have: | se conserva (ya existe) |
| `reg.pw.len` | Al menos 8 caracteres | At least 8 characters | se conserva (ya existe) |
| `reg.pw.up` | Una mayúscula (A-Z) | An uppercase letter (A-Z) | se conserva (ya existe) |
| `reg.pw.low` | Una minúscula (a-z) | A lowercase letter (a-z) | se conserva (ya existe) |
| `reg.pw.dig` | Un número (0-9) | A number (0-9) | se conserva (ya existe) |
| `reg.pw.spec` | Un carácter especial (! ? # $ % & * …); el espacio no cuenta | A special character (! ? # $ % & * …); a space doesn’t count | se conserva (ya existe) |
| `reg.pw.bytes` | Si usas acentos o emojis, la contraseña admite menos caracteres. | If you use accents or emojis, the password allows fewer characters. | se ajusta (existe) |
| `reg.consent` | Entiendo que Elevation no es terapia ni diagnóstico, que mi espacio es privado y que la IA es un asistente automático. | I understand that Elevation is not therapy or diagnosis, that my space is private and that the AI is an automated assistant. | nuevo |
| `reg.policy` | Leer la política de privacidad | Read the privacy policy | nuevo |
| `reg.err` | Revisa los datos: falta un nombre, un correo válido, una contraseña que cumpla las reglas o aceptar lo anterior. | Check your details: a name, a valid email, a password that meets the rules or accepting the above is missing. | nuevo |
| `reg.have` | ¿Ya tienes cuenta? | Already have an account? | se conserva (ya existe) |
| `reg.plan` | Elegiste {plan}. Después de crear tu cuenta podrás revisar y enviar tu solicitud. | You chose {plan}. After creating your account you can review and send your request. | nuevo |
| `reg.done.title` | Tu cuenta está lista | Your account is ready | se ajusta (existe) |
| `reg.done.body` | Entra con tu correo y tu contraseña. Después te guiamos en tres pasos. | Sign in with your email and password. Then we’ll guide you in three steps. | se ajusta (existe) |
| `reg.done.cta` | Ir a ingresar | Go to log in | nuevo |

## Mi plan y solicitud de plan (no hay pasarela de pago)

| Clave | ES | EN | Origen |
|---|---|---|---|
| `pl.sub` | Aquí ves tu plan actual, tu uso y el estado de tus solicitudes. | Here you see your current plan, your use and the status of your requests. | nuevo |
| `pl.current` | Plan actual | Current plan | nuevo |
| `pl.msgday` | Mensajes de IA por día | AI messages per day | se conserva (ya existe) |
| `pl.sessions` | Sesiones por mes | Sessions per month | se conserva (ya existe) |
| `pl.req.title` | Mi solicitud | My request | nuevo |
| `pl.req.none` | No tienes solicitudes de plan. | You have no plan requests. | nuevo |
| `pl.req.pending` | En revisión | Under review | nuevo |
| `pl.req.pending.body` | Tu solicitud quedó registrada y está en revisión. El plan aún no está activado. | Your request was recorded and is under review. The plan is not active yet. | se conserva (ya existe) |
| `pl.req.where` | Verás aquí el estado de tu solicitud. | You’ll see the status of your request here. | nuevo |
| `pl.tl.sent` | Enviada | Sent | nuevo |
| `pl.tl.review` | En revisión | Under review | nuevo |
| `pl.tl.decision` | Decisión | Decision | nuevo |
| `pl.catalog.title` | Elige cómo quieres acompañarte | Choose how you want to be supported | se conserva (ya existe) |
| `pl.catalog.sub` | Empieza sin costo y cambia de plan cuando lo necesites. | Start at no cost and change plans whenever you need. | se conserva (ya existe) |
| `pl.highlight` | Destacado | Featured | se conserva (ya existe) |
| `pl.free` | Gratis | Free | se conserva (ya existe) |
| `pl.per` | mes | month | se conserva (ya existe) |
| `pl.cta` | Solicitar este plan | Request this plan | se conserva (ya existe) |
| `pl.existing` | Ya tienes una solicitud en revisión. | You already have a request under review. | se conserva (ya existe) |
| `pl.paid.note` | Los planes de pago pasan por la aprobación de un administrador. | Paid plans go through administrator approval. | se conserva (ya existe) |
| `pl.nopay` | Aquí no se cobra ni se piden datos de pago. | Nothing is charged here and no payment details are requested. | nuevo |
| `pl.ex.name` | Nombre del plan | Plan name | nuevo |
| `pl.ex.desc` | Descripción del plan, tal como la define el catálogo. | Plan description, as defined in the catalogue. | nuevo |
| `pl.ex.f1` | Función incluida (según el catálogo) | Included feature (per the catalogue) | nuevo |
| `pl.ex.f2` | Otra función incluida (según el catálogo) | Another included feature (per the catalogue) | nuevo |
| `pl.confirm.title` | Revisa tu solicitud | Review your request | nuevo |
| `pl.confirm.sub` | Revisa el plan seleccionado antes de enviar tu solicitud. | Review the selected plan before submitting your request. | se conserva (ya existe) |
| `pl.confirm.what` | Qué pasa después | What happens next | nuevo |
| `pl.confirm.1` | Un administrador revisa tu solicitud. | An administrator reviews your request. | nuevo |
| `pl.confirm.2` | El plan no se activa hasta que haya una decisión. | The plan isn’t activated until there is a decision. | se ajusta (existe) |
| `pl.confirm.3` | Puedes ver el estado en «Mi plan». | You can see the status in “My plan”. | nuevo |
| `pl.confirm.send` | Enviar solicitud | Submit request | se ajusta (existe) |
| `pl.sent` | Solicitud enviada. Está en revisión. | Request submitted. It is under review. | se ajusta (existe) |

## Resumen
Total: 405 textos · se conservan 201 · se ajustan 69 · nuevos 135.

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
