// ES-301: aviso de privacidad y términos de uso. Texto del borrador de UX/UI-Claude (comentario 12200 de ES-301), aprobado por Mauricio para STAGING, SIN REVISIÓN LEGAL.
// NO se rellenan los marcadores: `[[…]]` se pinta visible como «[…]» (razón social, NIT, retención, proveedores y países, edad mínima, ley aplicable, línea de emergencia).
// Mientras queden marcadores esto no se publica a usuarios reales (bloqueo de lanzamiento anotado en ES-301). `**x**` es negrita.
import { TERMS_VERSION } from './version.ts'

export type Lang = 'es' | 'en'
export type LegalDoc = 'privacy' | 'terms'
export type LegalSection = { heading?: string; paragraphs?: string[]; bullets?: string[]; numbered?: string[] }
export type LegalContent = { title: string; draft: string; updated?: string; sections: LegalSection[]; also: string; alsoLink: string; backToRegister: string; newTab: string }

const privacyEs: LegalContent = {
  title: 'Aviso de privacidad',
  draft: `Borrador sin revisión legal · versión ${TERMS_VERSION}`,
  updated: 'Última actualización: [[POR COMPLETAR: fecha]]',
  also: 'Ver también', alsoLink: 'Términos de uso', backToRegister: 'Volver a crear cuenta', newTab: 'se abre en una pestaña nueva',
  sections: [
    { heading: 'Quién es responsable', paragraphs: ['[[POR COMPLETAR: razón social]] ([[POR COMPLETAR: NIT]]) es responsable del tratamiento de tus datos. Domicilio: [[POR COMPLETAR]]. Contacto para tus datos: [[POR COMPLETAR: correo]].'] },
    { heading: 'Qué es Elevation', paragraphs: ['Elevation te acompaña a conocerte, ordenar tus habilidades y probar pequeños pasos de avance. **No es terapia, no hace diagnósticos, no receta nada y no promete resultados ni empleo.**'] },
    { heading: 'Qué datos tratamos', bullets: [
      'De tu cuenta: nombre, correo y contraseña (la contraseña se guarda como un resumen irreversible —hash—, nunca en texto legible).',
      'De lo que haces en la plataforma: tus conversaciones, tu diario, tu ánimo, tus evidencias y tu mapa de habilidades.',
      'De tu aceptación de este aviso: la versión que aceptaste y la fecha.',
      'Te pedimos no escribir datos de salud ni de otras personas.'] },
    { heading: 'Para qué los usamos', bullets: ['Darte el acompañamiento, el mapa de habilidades y los experimentos.', 'Mantener tu cuenta segura.', 'Atender tus solicitudes sobre tus datos.'], paragraphs: ['No los usamos para vender publicidad ni los vendemos. [[VERIFICAR: confirmar con Alejo]]'] },
    { heading: 'Qué es privado', bullets: [
      '**Tus conversaciones y tu diario son solo tuyos.** Nadie del equipo profesional los ve.',
      '**Lo que podría indicar una crisis no se comparte con nadie** y no pasa al motor profesional.',
      'Un profesional solo ve lo que **tú autorizas** compartir, campo por campo. Puedes quitar ese permiso cuando quieras.',
      'Lo que la IA recibe se explica abajo, en «Con quién se procesan y qué ve la IA». Nada de lo que la IA lee llega a un profesional sin tu permiso.'] },
    { heading: 'Con quién se procesan y qué ve la IA', paragraphs: ['Las respuestas del asistente las genera un modelo de lenguaje de un proveedor externo (Anthropic, modelo Claude). Para responderte, nuestro servidor le envía solo lo necesario:'] },
    { bullets: [
      '**Chat:** hasta tus últimos 20 mensajes de la conversación y las entradas de diario que tú elijas para esa conversación. No enviamos tu nombre ni tu correo.',
      '**Si un mensaje tuyo muestra un indicio grave de crisis,** ese turno no se envía al modelo: te respondemos con un mensaje de seguridad fijo.',
      '**Recomendaciones de bienestar:** un resumen de tu ánimo de los últimos 7 días (cuántos registros, promedio y tendencia), sin texto tuyo.',
      '**Análisis de habilidades:** el texto de las evidencias que confirmaste, cuando pides el análisis.',
      '**Lectura de tus fuentes (solo si lo autorizas, fuente por fuente):** hasta 20 mensajes de tu chat, hasta 10 entradas de tu diario o el texto de tu hoja de vida sin datos de contacto, para proponerte ideas.',
      '**Emparejamiento con un profesional:** las respuestas cortas que elegiste, sin tu ánimo.',
      '**Si compartes con tu profesional:** al cerrar una sesión, una etiqueta de tu ánimo; y, cuando tu profesional pide un resumen, solo cifras agregadas (cuántos registros, promedio de ánimo y promedio de valoraciones), sin tu nombre ni tus textos.'] },
    { heading: 'Proveedores', paragraphs: ['Antes de enviar, enmascaramos claves y tokens que hayas pegado. El proveedor procesa ese texto para generar la respuesta. Además usamos proveedores de alojamiento, base de datos y almacenamiento de archivos. [[VERIFICAR con Infra: nombres, país de cada uno, si hay transferencia internacional y, por contrato, que no usan tus datos para entrenar modelos.]]'] },
    { heading: 'Cuánto tiempo los guardamos', paragraphs: ['[[POR COMPLETAR: plazos de conservación]]. Si borras tu cuenta, [[POR COMPLETAR: qué se borra y en cuánto tiempo]].'] },
    { heading: 'Tus derechos', paragraphs: ['Puedes pedir ver, corregir, descargar o borrar tus datos, y retirar permisos de compartir. Escribe a [[POR COMPLETAR: correo]]. [[POR REVISAR LEGAL: marco aplicable (p. ej. Ley 1581 de 2012 de Colombia) y plazos de respuesta.]]'] },
    { heading: 'Cambios', paragraphs: ['Si cambiamos este aviso de fondo, te lo diremos y te pediremos aceptar la nueva versión.'] },
  ],
}

const privacyEn: LegalContent = {
  title: 'Privacy notice',
  draft: `Draft without legal review · version ${TERMS_VERSION}`,
  updated: 'Last updated: [[TO BE COMPLETED: date]]',
  also: 'See also', alsoLink: 'Terms of use', backToRegister: 'Back to create account', newTab: 'opens in a new tab',
  sections: [
    { heading: 'Who is responsible', paragraphs: ['[[TO BE COMPLETED: legal name]] ([[TO BE COMPLETED: tax ID]]) is responsible for processing your data. Address: [[TO BE COMPLETED]]. Contact for your data: [[TO BE COMPLETED: email]].'] },
    { heading: 'What Elevation is', paragraphs: ['Elevation helps you get to know yourself, organise your skills and try small steps forward. **It is not therapy, it does not diagnose, it prescribes nothing, and it does not promise results or a job.**'] },
    { heading: 'What data we process', bullets: [
      'From your account: name, email and password (the password is stored as an irreversible digest —a hash—, never in readable text).',
      'From what you do on the platform: your conversations, your journal, your mood, your evidence and your skills map.',
      'From your acceptance of this notice: the version you accepted and the date.',
      'Please do not write health information or other people’s details.'] },
    { heading: 'What we use it for', bullets: ['To give you the support, the skills map and the experiments.', 'To keep your account secure.', 'To answer your requests about your data.'], paragraphs: ['We do not use it for advertising and we do not sell it. [[VERIFY: confirm with Alejo]]'] },
    { heading: 'What is private', bullets: [
      '**Your conversations and your journal are yours alone.** No one on the professional team sees them.',
      '**Anything that could point to a crisis is not shared with anyone** and does not reach the professional engine.',
      'A professional only sees what **you authorise** you share, field by field. You can withdraw that permission at any time.',
      'What the AI receives is explained below, in “Who processes it and what the AI sees”. Nothing the AI reads reaches a professional without your permission.'] },
    { heading: 'Who processes it and what the AI sees', paragraphs: ['The assistant’s replies are generated by a language model from an external provider (Anthropic, Claude model). To answer you, our server sends it only what is necessary:'] },
    { bullets: [
      '**Chat:** up to your last 20 messages of the conversation and the journal entries you choose for that conversation. We do not send your name or email.',
      '**If a message of yours shows a serious sign of crisis,** that turn is not sent to the model: we reply with a fixed safety message.',
      '**Wellbeing suggestions:** a summary of your mood over the last 7 days (how many entries, average and trend), with no text of yours.',
      '**Skills analysis:** the text of the evidence you confirmed, when you ask for the analysis.',
      '**Reading your sources (only if you allow it, source by source):** up to 20 messages from your chat, up to 10 entries from your journal or the text of your résumé without contact details, to suggest ideas to you.',
      '**Matching with a professional:** the short answers you chose, without your mood.',
      '**If you share with your professional:** at the end of a session, a label of your mood; and, when your professional asks for a summary, only aggregate figures (how many entries, average mood and average rating), without your name or your texts.'] },
    { heading: 'Providers', paragraphs: ['Before sending, we mask keys and tokens you may have pasted. The provider processes that text to generate the reply. We also use providers for hosting, the database and file storage. [[VERIFY with Infra: names, country of each, any international transfer and, by contract, that they do not use your data to train models.]]'] },
    { heading: 'How long we keep it', paragraphs: ['[[TO BE COMPLETED: retention periods]]. If you delete your account, [[TO BE COMPLETED: what is deleted and how fast]].'] },
    { heading: 'Your rights', paragraphs: ['You can ask to see, correct, download or delete your data, and withdraw sharing permissions. Write to [[TO BE COMPLETED: email]]. [[FOR LEGAL REVIEW: applicable framework (e.g. Colombia’s Law 1581 of 2012) and response times.]]'] },
    { heading: 'Changes', paragraphs: ['If we make a substantive change to this notice, we will tell you and ask you to accept the new version.'] },
  ],
}

const termsEs: LegalContent = {
  title: 'Términos de uso',
  draft: `Borrador sin revisión legal · versión ${TERMS_VERSION}`,
  also: 'Ver también', alsoLink: 'Aviso de privacidad', backToRegister: 'Volver a crear cuenta', newTab: 'se abre en una pestaña nueva',
  sections: [{ numbered: [
    '**Qué es el servicio.** Elevation es una herramienta de autoconocimiento y orientación de carrera. No es un servicio clínico ni de salud mental: no diagnostica, no receta y no sustituye a un profesional de la salud.',
    '**Si estás mal.** Si sientes que estás en riesgo o en crisis, busca ayuda de una persona o servicio de emergencia de tu zona. [[POR COMPLETAR: línea local — decisión de producto pendiente, no inventar.]]',
    '**Sin promesas.** No garantizamos resultados, entrevistas, ofertas ni empleo. Los niveles y sugerencias dependen de la evidencia que tú aportas y son orientativos.',
    '**Tu cuenta.** Eres responsable de tu contraseña y de la información que escribes. Debes tener [[POR COMPLETAR: edad mínima, revisión legal]].',
    '**Uso adecuado.** No uses la plataforma para dañar a otras personas, suplantar, ni intentar acceder a datos ajenos.',
    '**La IA.** Las respuestas las genera un modelo de lenguaje y pueden tener errores. Revísalas antes de usarlas para decidir algo importante.',
    '**Contenido tuyo.** Lo que escribes sigue siendo tuyo. Nos autorizas a tratarlo solo para prestarte el servicio, como explica el aviso de privacidad.',
    '**Cambios y cierre.** Podemos cambiar estos términos o el servicio avisándote. Puedes cerrar tu cuenta cuando quieras.',
    '**Ley y contacto.** [[POR COMPLETAR: ley aplicable, jurisdicción, contacto — revisión legal.]]'] }],
}

const termsEn: LegalContent = {
  title: 'Terms of use',
  draft: `Draft without legal review · version ${TERMS_VERSION}`,
  also: 'See also', alsoLink: 'Privacy notice', backToRegister: 'Back to create account', newTab: 'opens in a new tab',
  sections: [{ numbered: [
    '**What the service is.** Elevation is a self-knowledge and career-orientation tool. It is not a clinical or mental-health service: it does not diagnose, prescribe or replace a health professional.',
    '**If you are not okay.** If you feel at risk or in crisis, reach out to a person or emergency service where you live. [[TO BE COMPLETED: local line — product decision pending, do not invent.]]',
    '**No promises.** We do not guarantee results, interviews, offers or a job. Levels and suggestions depend on the evidence you provide and are indicative.',
    '**Your account.** You are responsible for your password and for what you write. You must be at least [[TO BE COMPLETED: minimum age, legal review]].',
    '**Proper use.** Do not use the platform to harm others, impersonate anyone, or try to access other people’s data.',
    '**The AI.** Answers are generated by a language model and may contain mistakes. Check them before relying on them for something important.',
    '**Your content.** What you write stays yours. You allow us to process it only to provide the service, as the privacy notice explains.',
    '**Changes and closing.** We may change these terms or the service by telling you. You can close your account at any time.',
    '**Law and contact.** [[TO BE COMPLETED: governing law, jurisdiction, contact — legal review.]]'] }],
}

export const LEGAL: Record<Lang, Record<LegalDoc, LegalContent>> = { es: { privacy: privacyEs, terms: termsEs }, en: { privacy: privacyEn, terms: termsEn } }
