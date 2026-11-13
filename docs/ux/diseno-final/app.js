/* ES-148 · Prototipo interactivo «Cuaderno». Todo el texto sale de copy.js + copy-extra.js (t()).
   Las conversaciones de muestra son respuestas REALES del asistente capturadas en staging con una cuenta sintética (3-nov-2026); la versión EN de esas tres respuestas es una traducción del prototipo. */
const COPY = { es: {}, en: {} };
(window.COPY_ROWS || []).forEach(r => { if (r.length > 1) { COPY.es[r[0]] = r[1]; COPY.en[r[0]] = r[2] } });
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { lang: localStorage.getItem('elv_proto_lang') || 'es', dev: false, theme: 'light', scenario: 'new', route: 'land', sub: '', mood: null, more: false, menu: false,
  chat: [], typing: false, reply: 0, input: '', evid: [], levels: {}, sel: null, req: 'none', ob: 1, tog: {}, diary: [], toast: '', modal: '',
  reg: { name: '', email: '', pw: '', consent: false, show: false, tried: false, done: false },
  ED: { step: 1, title: '', situation: '', part: '', actions: '', delivered: '', effect: '', autonomy: '', fromChat: -1 },
  LV: { step: 1, ev: [], level: null, note: '' }, AI: { step: 1, picked: [], res: {} }, saved: {}, delText: '' };
const t = (k, v = {}) => { let s = COPY[S.lang][k]; if (s === undefined) return '⟦' + k + '⟧'; for (const x in v) s = s.replace('{' + x + '}', v[x]); return s };
const L = (es, en) => S.lang === 'es' ? es : en;

/* ---------- datos de muestra ---------- */
const CAPS = { es: ['Adaptabilidad', 'Análisis de información', 'Aprendizaje autónomo', 'Comunicación', 'Influencia y liderazgo', 'Planificación y organización', 'Resolución de problemas', 'Trabajo en equipo'],
  en: ['Adaptability', 'Information analysis', 'Self-directed learning', 'Communication', 'Influence and leadership', 'Planning and organisation', 'Problem solving', 'Teamwork'] };
const SHORT = { es: ['Adaptabilidad', 'Análisis', 'Aprendizaje', 'Comunicación', 'Influencia', 'Planificación', 'Problemas', 'Equipo'], en: ['Adaptability', 'Analysis', 'Learning', 'Communication', 'Influence', 'Planning', 'Problems', 'Teamwork'] };
const SAMPLE = {
  es: [
    ['me', 'Hola. Llevo unos meses pensando en cambiar de carrera, pero no sé por dónde empezar.'],
    ['ai', 'Gracias por contarlo. Entiendo que llevas unos meses con la idea de cambiar de carrera y que todavía no tienes claro el primer paso. Es un punto de partida común, y no hace falta tenerlo resuelto de entrada.\n\nHay varias formas de empezar, y tú eliges la que te resulte más útil:\n\n- Partir de experiencias concretas de tu trabajo actual o anterior, para identificar qué sabes hacer y qué te gustaría llevar contigo.\n- Explorar qué valoras o qué te mueve en el trabajo, sin hablar todavía de puestos.\n- Pasar directamente a un trabajo más práctico sobre competencias (por ejemplo, con SkillMap), sin conversaciones emocionales.\n\nPara empezar por algo concreto: ¿en qué trabajas o has trabajado, y qué parte de ese trabajo recuerdas haber hecho con más ganas o con más orgullo?'],
    ['me', 'Coordiné equipos de logística durante varios años. Me gustaba organizar, pero me cansé de la presión.'],
    ['ai', 'Gracias por compartirlo. Entiendo que coordinaste equipos de logística durante varios años, que organizar era la parte que más disfrutabas y que la presión terminó cansándote.\n\nPor ahora son hechos que tú has relatado. Una posible lectura, que te dejo como hipótesis para que la corrijas: organizar y coordinar equipos parecen ser actividades que te resultaban valiosas, y la presión pesó más que ese gusto. Aún no sé qué tipo de presión era (plazos, volumen, conflictos, falta de recursos), así que prefiero no suponerlo. Tampoco sé qué hacías en concreto al organizar, y ese detalle sería la base para reconocer competencias.\n\n¿Podrías contarme una situación concreta en la que sentiste que organizabas bien, qué hiciste tú y qué cambió gracias a ello?'],
    ['me', 'No sé.'],
    ['ai', 'Está bien, no hace falta responder esa pregunta. A veces pedir una situación concreta de golpe es mucho.\n\nSi te sirve, podemos ir por un camino más ligero. Por ejemplo, podrías contarme cómo era un día normal en tu trabajo de coordinación, sin elegir un momento destacado. O, si prefieres, dejamos la experiencia pasada y hablamos de qué te gustaría que fuera distinto en un trabajo futuro. También podemos pausar aquí.\n\n¿Cuál de esas opciones te resulta más cómoda?'],
  ],
  en: [
    ['me', 'Hi. I have been thinking about changing careers for a few months, but I don’t know where to start.'],
    ['ai', 'Thank you for telling me. I understand you have had the idea of changing careers for a few months and the first step is not clear yet. That is a common starting point, and it does not need to be settled right away.\n\nThere are several ways to begin, and you choose the one that feels most useful:\n\n- Start from concrete experiences in your current or previous work, to identify what you can do and what you would like to take with you.\n- Explore what you value or what moves you at work, without talking about job titles yet.\n- Go straight to more practical work on skills (for example, with SkillMap), without emotional conversations.\n\nTo start with something concrete: what do you do or have you done for work, and which part of it do you remember doing with the most enthusiasm or pride?'],
    ['me', 'I coordinated logistics teams for several years. I liked organising, but I got tired of the pressure.'],
    ['ai', 'Thank you for sharing that. I understand you coordinated logistics teams for several years, that organising was the part you enjoyed most, and that the pressure ended up wearing you out.\n\nFor now these are facts you have told me. One possible reading, which I offer as a hypothesis for you to correct: organising and coordinating teams seem to be activities you found valuable, and the pressure outweighed that enjoyment. I don’t yet know what kind of pressure it was (deadlines, volume, conflict, lack of resources), so I prefer not to assume. I also don’t know what you actually did when organising, and that detail would be the basis for recognising skills.\n\nCould you tell me about one concrete situation where you felt you organised well, what you did, and what changed as a result?'],
    ['me', 'I don’t know.'],
    ['ai', 'That’s fine, you don’t have to answer that question. Sometimes asking for a concrete situation all at once is a lot.\n\nIf it helps, we can take a lighter path. For example, you could tell me what a normal day looked like in your coordination job, without picking a standout moment. Or, if you prefer, we can leave past experience aside and talk about what you would like to be different in a future job. We can also pause here.\n\nWhich of those options feels more comfortable?'],
  ],
};
const REPLIES = () => SAMPLE[S.lang].filter(x => x[0] === 'ai').map(x => x[1]);
const RUBRIC = { 3: { es: ['Conoce cómo preparar un mensaje claro para su audiencia, pero aún no lo ha hecho en una situación real.', 'Comunica ideas con apoyo de una guía, una plantilla o la revisión de otra persona.', 'Adapta el mensaje a distintas audiencias y confirma que fue entendido, sin necesitar apoyo, de forma repetida.', 'Comunica en situaciones complejas o de tensión, alinea a varias partes y enseña a otras personas a hacerlo.'],
  en: ['Knows how to prepare a clear message for their audience, but hasn’t yet done so in a real situation.', 'Communicates ideas with support from a guide, a template or another person’s review.', 'Adapts the message to different audiences and confirms it was understood, without needing support, repeatedly.', 'Communicates in complex or tense situations, aligns several parties and teaches others to do so.'] } }
const rubric = (i, n) => RUBRIC[i] ? RUBRIC[i][S.lang][n - 1] : t('lv.rubric.ph', { n })
const AUTONOMY = ['conceptual', 'assisted', 'autonomous', 'leads'];

/* ---------- iconos y caras ---------- */
const IC = { home: 'M3 11l9-8 9 8M5 10v10h14V10', chat: 'M4 5h16v11H9l-5 4z', map: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0', ev: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7', more: 'M5 12h.01M12 12h.01M19 12h.01', plus: 'M12 5v14M5 12h14', ar: 'M5 12h14M13 6l6 6-6 6', lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3', check: 'M5 12l5 5 9-10', x: 'M6 6l12 12M18 6L6 18', send: 'M4 12l16-8-6 16-3-7z', pause: 'M8 5v14M16 5v14', book: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6', copy: 'M9 9h10v11H9zM5 15V4h10', spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z', card: 'M3 6h18v12H3zM3 10h18' };
const ico = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>`;
const MOUTH = ['M14 31 Q21 24 28 31', 'M14 29 Q21 26 28 29', 'M14 28 H28', 'M14 26 Q21 32 28 26', 'M13 25 Q21 35 29 25'];
const face = i => `<svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="17"/><circle cx="15" cy="17" r=".8" fill="currentColor"/><circle cx="27" cy="17" r=".8" fill="currentColor"/><path d="${MOUTH[i]}"/></svg>`;

/* ---------- texto del asistente: formato mínimo y seguro ---------- */
function fmt(text) {
  const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const blocks = text.trim().split(/\n{2,}/);
  let ask = '';
  if (blocks.length > 1 && /\?\s*$/.test(blocks[blocks.length - 1]) && !/^\s*-/.test(blocks[blocks.length - 1])) ask = blocks.pop();
  const html = blocks.map(b => /^\s*-\s/m.test(b) ? '<ul>' + b.split('\n').filter(l => /^\s*-\s/.test(l)).map(l => '<li>' + inl(l.replace(/^\s*-\s/, '')) + '</li>').join('') + '</ul>' : '<p>' + inl(b).replace(/\n/g, '<br>') + '</p>').join('');
  return html + (ask ? `<p class="ask">${inl(ask)}</p>` : '');
}

/* ---------- escenarios ---------- */
function scenario(name) {
  S.scenario = name; S.chat = []; S.evid = []; S.levels = {}; S.req = 'none'; S.saved = {}; S.reply = 0;
  if (name !== 'new') S.chat = SAMPLE[S.lang].map(x => ({ r: x[0], text: x[1] }));
  if (name === 'evidence' || name === 'leveled') S.evid = [{ id: 1, title: L('Coordinación de equipos de logística', 'Coordinating logistics teams'), status: 'confirmed', demo: false }, { id: 2, title: L('Evidencia de ejemplo', 'Example evidence'), status: 'confirmed', demo: true }];
  if (name === 'leveled') { S.levels = { 5: { level: 2, ev: [1], note: '' } }; S.req = 'pending' }
}
const confirmedEv = () => S.evid.filter(e => e.status === 'confirmed');

/* ---------- marcos ---------- */
const langSw = () => `<div class="lang" role="group" aria-label="${t('lang.label')}"><button type="button" data-act="lang" data-v="es" aria-pressed="${S.lang === 'es'}">ES</button><button type="button" data-act="lang" data-v="en" aria-pressed="${S.lang === 'en'}">EN</button></div>`;
const brand = h => `<a class="brand" href="#${h}">${t('brand')}<i></i></a>`;
function pub(inner) { return `<a class="sr" href="#main">${t('skip')}</a><header class="pubbar">${brand('land')}<div class="row">${langSw()}<a class="btn sm" href="#login">${t('land.nav.login')}</a></div></header><main id="main" tabindex="-1" style="flex:1">${inner}</main>` }
const NAV = [['home', 'nav.home'], ['chat', 'nav.chat'], ['map', 'nav.map'], ['evidence', 'nav.evidence']];
const MORE = [['diary', 'nav.diary', 'book'], ['next', 'nav.next', 'spark'], ['bridge', 'nav.bridge', 'lock'], ['pro', 'nav.pro', 'user'], ['plans', 'nav.plan', 'card'], ['data', 'nav.data', 'ev']];
const ROUTE_NAV = { home: 'home', chat: 'chat', map: 'map', evidence: 'evidence' };
function app(inner) {
  const cur = ROUTE_NAV[S.route] || '';
  const planName = L('Gratis', 'Free');
  return `<a class="sr" href="#main">${t('skip')}</a>
<header class="mast">${brand('home')}<nav class="idx" aria-label="${t('nav.main')}">${NAV.map((n, i) => `<a href="#${n[0]}" ${cur === n[0] ? 'aria-current="page"' : ''}><b>0${i + 1}</b>${t(n[1])}</a>`).join('')}</nav>
<div class="tools"><a class="planchip" href="#plans" title="${t('nav.plan')}">${planName}</a>${langSw()}
<div class="menu"><button type="button" data-act="menu" aria-label="${t('nav.account')}" aria-expanded="${S.menu}">${ico('user')}</button>${S.menu ? `<div class="pop" role="menu">${MORE.map(m => `<a role="menuitem" href="#${m[0]}">${ico(m[2])}${t(m[1])}</a>`).join('')}<a role="menuitem" href="#login">${ico('x')}${t('nav.logout')}</a></div>` : ''}</div></div></header>
<main class="body" id="main" tabindex="-1"><div class="page">${inner}</div></main>
<nav class="tabbar" aria-label="${t('nav.main')}">${NAV.map(n => `<a href="#${n[0]}" ${cur === n[0] ? 'aria-current="page"' : ''}>${ico(n[0] === 'evidence' ? 'ev' : n[0])}${t(n[1])}</a>`).join('')}<button type="button" data-act="more">${ico('more')}${t('nav.more')}</button></nav>`;
}
const head = (title, sub, extra = '') => `<div class="stack" style="padding-bottom:1.4rem"><h1 class="d2">${title}</h1>${sub ? `<p class="lead">${sub}</p>` : ''}${extra}</div>`;
const sec = (label, body) => `<section class="pg"><div class="mg mono">${label}</div><div class="stack">${body}</div></section>`;
const noticeNC = () => `<p class="note info" role="note">${t('notice.nonclinical')}</p>`;
const demo = (es, en) => `<span class="demo">${L(es, en)}</span>`;

/* ---------- pantallas ---------- */
const V = {};
V.land = () => pub(`<section class="hero"><span class="mono">${t('land.hero.label')}</span><h1 class="d1">${L('Lo que has vivido <span class="hl"><em>cuenta.</em></span>', 'What you have lived <span class="hl"><em>counts.</em></span>')}</h1><p class="lead">${t('land.hero.sub')}</p>
<div style="margin-top:2.2rem">${[1, 2].map(n => `<a class="rowline" href="#register"><span class="n">0${n}</span><span class="stack" style="gap:.2rem"><span class="mono">${t('land.door' + n + '.label')}</span><b>${t('land.door' + n + '.title')}</b><span class="sub">${t('land.door' + n + '.desc')}</span></span>${ico('ar')}</a>`).join('')}</div></section>
<section class="hero" style="padding-top:1rem"><div class="pg" style="grid-template-columns:11rem 1fr"><div class="mg mono">${t('land.how.title')}</div><div class="cols3">${[1, 2, 3].map(n => `<div class="stack" style="gap:.5rem"><span class="num">${n}</span><p>${t('land.how.' + n)}</p></div>`).join('')}</div></div>
<div class="pg"><div class="mg mono">${t('land.priv.title')}</div><div class="stack l"><p class="quote">${t('land.priv.body')}</p><p class="sub" style="max-width:56ch">${t('land.limits.body')}</p></div></div>
<div class="pg"><div class="mg mono">${t('land.pilot.label')}</div><div class="stack"><p class="sub">${t('land.pilot')}</p><div class="row"><a class="btn p" href="#register">${t('land.cta')}${ico('ar', 'ar')}</a><span class="sub">${t('land.cta.sub')}</span></div><a class="btn t" href="#pro" style="align-self:flex-start">${t('land.pros')}</a></div></div></section>`);

const pwRules = pw => [['len', pw.length >= 8], ['up', /\p{Lu}/u.test(pw)], ['low', /\p{Ll}/u.test(pw)], ['dig', /[0-9]/.test(pw)], ['spec', /[^\p{L}\p{N}\p{M}\s]/u.test(pw)]];
const authAside = () => `<div class="aside"><div class="stack l"><span class="mono">${t('land.hero.label')}</span><p class="quote">${L('Lo que has vivido cuenta.', 'What you have lived counts.')}</p></div><ul class="stack" style="list-style:none;padding:0;margin:0"><li class="row">${ico('lock')}${t('badge.private')}</li><li class="sub">${t('notice.nonclinical')}</li></ul></div>`;
V.login = () => pub(`<div class="auth">${authAside()}<form class="form" onsubmit="return false" novalidate><h1 class="d2">${t('login.title')}</h1><p class="sub">${t('login.sub')}</p>
${S.sub === 'error' ? `<div class="note err" role="alert">${t('login.err.credentials')}</div>` : ''}
<div class="fld"><label for="e">${t('login.email')}</label><input id="e" type="email" autocomplete="username"></div>
<div class="fld"><label for="p">${t('login.password')}</label><input id="p" type="password" autocomplete="current-password"></div>
<a class="btn t" href="#login" style="align-self:flex-start">${t('login.forgot')}</a>
<button class="btn p" type="submit" data-act="go" data-v="onboarding">${t('login.submit')}${ico('ar', 'ar')}</button>
<p class="sub">${t('login.new')} <a href="#register" style="text-decoration-color:var(--ocre)">${t('login.create')}</a></p></form></div>`);
V.register = () => { const r = S.reg, rules = pwRules(r.pw), ok = rules.every(x => x[1]);
  if (r.done) return pub(`<div class="auth">${authAside()}<div class="form"><span class="mono">${ico('check')}</span><h1 class="d2">${t('reg.done.title')}</h1><p class="lead">${t('reg.done.body')}</p><div><a class="btn p" href="#login">${t('reg.done.cta')}${ico('ar', 'ar')}</a></div></div></div>`);
  return pub(`<div class="auth">${authAside()}<form class="form" onsubmit="return false" novalidate><h1 class="d2">${t('login.create')}</h1><p class="sub">${t('login.sub')}</p>
${S.sub === 'plan' ? `<p class="note info" role="status">${t('reg.plan', { plan: L('el plan que elegiste', 'the plan you chose') })}</p>` : ''}
<div class="fld"><label for="rn">${t('reg.name')}</label><input id="rn" data-in="name" value="${esc(r.name)}" placeholder="${t('reg.name.ph')}" autocomplete="name"></div>
<div class="fld"><label for="re">${t('login.email')}</label><input id="re" type="email" data-in="email" value="${esc(r.email)}" autocomplete="email"></div>
<div class="fld"><label for="rp">${t('login.password')}</label><div class="row" style="flex-wrap:nowrap"><input id="rp" type="${r.show ? 'text' : 'password'}" data-in="pw" value="${esc(r.pw)}" autocomplete="new-password" aria-describedby="rules"><button type="button" class="btn t" data-act="showpw" aria-pressed="${r.show}">${r.show ? t('login.hide') : t('login.show')}</button></div>
<div id="rules" aria-live="polite"><small>${t('reg.pw.title')}</small><ul class="checks">${rules.map(x => `<li class="${x[1] ? 'ok' : ''}">${t('reg.pw.' + x[0])}${x[1] ? '<span class="sr"> ✓</span>' : ''}</li>`).join('')}</ul><small>${t('reg.pw.bytes')}</small></div></div>
<label class="cb"><input type="checkbox" data-in="consent" ${r.consent ? 'checked' : ''}><span>${t('reg.consent')} <a href="#register" style="text-decoration-color:var(--ocre)">${t('reg.policy')}</a><br>${demo('propuesta: hoy no existe', 'proposal: does not exist today')}</span></label>
${r.tried && !(ok && r.consent && r.name.trim() && /@/.test(r.email)) ? `<div class="note err" role="alert">${t('reg.err')}</div>` : ''}
<button class="btn p" type="submit" data-act="register">${t('login.create')}${ico('ar', 'ar')}</button>
<p class="sub">${t('reg.have')} <a href="#login">${t('login.title')}</a></p></form></div>`) };
V.onboarding = () => { const n = S.ob;
  const b = [() => `<h1 class="d2">${t('ob.s1.title')}</h1><p class="lead">${t('ob.s1.sub')}</p><div class="fld"><label for="l">${t('ob.s1.lang')}</label><select id="l"><option>${L('Español', 'Spanish')}</option><option>${L('Inglés', 'English')}</option></select></div><div class="fld"><label for="z">${t('ob.s1.tz')}</label><select id="z"><option>${L('Elige tu zona', 'Choose your zone')}</option></select></div><a class="btn t" href="#onboarding" style="align-self:flex-start">${t('ob.s1.tz.use')}</a>`,
    () => `<h1 class="d2">${t('ob.s2.title')}</h1><p class="lead">${t('ob.s2.sub')}</p>${[1, 2].map(i => `<label class="opt"><input type="radio" name="o"><span><b class="d3">${t('ob.s2.o' + i)}</b><br><span class="sub">${t('ob.s2.o' + i + 'd')}</span></span></label>`).join('')}`,
    () => `<h1 class="d2">${t('ob.s3.title')}</h1><p class="lead">${t('ob.s3.sub')}</p><div class="empty" style="border:1.5px dashed var(--control);padding:1.6rem;align-items:center;max-width:none"><b>${t('ob.s3.drop')}</b><button class="btn" type="button">${t('ob.s3.pick')}</button><small class="sub">${t('ob.s3.rules')}</small></div><p class="sub row">${ico('lock')}${t('ob.s3.note')}</p><a class="btn t" href="#home" style="align-self:flex-start">${t('ob.s3.manual')}</a>`];
  return pub(`<div class="page" style="max-width:640px"><div class="stack l"><span class="mono" role="status">0${n} / 03 · ${t('ob.progress', { n })}</span>${b[n - 1]()}<div class="row" style="justify-content:space-between"><button class="btn" type="button" data-act="ob" data-v="${Math.max(1, n - 1)}" ${n === 1 ? 'disabled' : ''}>${t('btn.back')}</button><span class="row"><a class="btn t" href="#home">${t('btn.skip')}</a>${n < 3 ? `<button class="btn p" type="button" data-act="ob" data-v="${n + 1}">${t('btn.next')}${ico('ar', 'ar')}</button>` : `<a class="btn p" href="#home">${t('ob.finish')}${ico('ar', 'ar')}</a>`}</span></div></div></div>`) };

V.home = () => app(`${head(`${L('Hola.', 'Hi.')} <em>${L('¿Cómo llegas hoy?', 'How are you arriving today?')}</em>`, t('home.sub'))}
<div class="faces" role="group" aria-label="${t('home.title')}">${[1, 2, 3, 4, 5].map((i, k) => `<button type="button" class="face" data-act="mood" data-v="${i}" aria-pressed="${S.mood === i}">${face(k)}<span>${t('emo.' + i)}</span></button>`).join('')}</div>
${S.mood ? `<p class="note" role="status">${t('home.after')}</p>` : ''}
<div style="margin-top:2.4rem">${[['chat', 'land.door1.label', 'land.door1.title'], ['map', 'land.door2.label', 'land.door2.title'], ['diary', 'nav.diary', 'home.diary.line']].map((d, i) => `<a class="rowline" href="#${d[0]}"><span class="n">0${i + 1}</span><span class="stack" style="gap:.15rem"><span class="mono">${t(d[1])}</span><b>${t(d[2])}</b></span>${ico('ar')}</a>`).join('')}</div>
${sec(t('home.ai.eyebrow'), `<div class="meter" role="img" aria-label="4 %"><i style="width:4%"></i></div><p class="sub">${t('chat.usage.val', { pct: 4, date: L('30 de noviembre', '30 November') })} ${demo('cifra de ejemplo', 'example figure')}</p><p class="sub">${t('chat.usage.note')}</p>`)}
${sec(t('nav.plan'), `<p><span class="d3">${L('Gratis', 'Free')}</span> · <a href="#plans">${t('home.plan.link')}</a></p>`)}
${noticeNC()}`);

function turns() {
  const last = S.chat.length - 1;
  return S.chat.map((m, i) => m.r === 'me'
    ? `<div class="turn me"><div class="who mono">${t('chat.you')}</div><div><div class="txt">${esc(m.text)}</div><div class="acts">${S.saved[i] ? `<span class="chip on">${ico('check')} ${t('chat.msg.saved')}</span>` : (m.text.length > 40 ? `<button class="btn t sm" data-act="evfromchat" data-v="${i}">${ico('ev')}${t('chat.msg.evidence')}</button>` : '')}</div></div></div>`
    : `<div class="turn ai"><div class="who mono">${t('brand')}</div><div><div class="txt">${fmt(m.text)}</div><div class="acts"><button class="btn t sm" data-act="copy">${ico('copy')}${t('chat.msg.copy')}</button></div>${i === last && !S.typing ? `<div class="quick" aria-label="${t('chat.q.label')}">${['skip', 'other', 'pause'].map(k => `<button type="button" data-act="quick" data-v="${k}">${t('chat.q.' + k)}</button>`).join('')}</div>` : ''}</div></div>`).join('')
    + (S.typing ? `<div class="turn ai" role="status"><div class="who mono">${t('brand')}</div><div><span class="typing" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr">${t('chat.thinking')}</span></div></div>` : '');
}
V.chat = () => app(`<div class="row" style="justify-content:space-between;align-items:flex-start"><div><h1 class="d2">${t('chat.title')}</h1><p class="sub row" style="margin-top:.3rem">${ico('lock')}${t('chat.private')}</p></div><button class="btn sm" type="button" data-act="pausechat">${ico('pause')}${t('chat.pause')}</button></div>
<div style="margin:1rem 0 .4rem"><div class="meter" role="img" aria-label="4 %"><i style="width:4%"></i></div><p class="mono" style="margin-top:.4rem">${t('chat.usage')} · ${t('chat.usage.val', { pct: 4, date: L('30 de noviembre', '30 November') })}</p></div>
${S.sub === 'error' ? `<div class="note err" role="alert"><b>${t('chat.pending.title')}</b>${t('chat.pending.body')}<div class="row" style="margin-top:.6rem"><button class="btn sm" type="button">${t('chat.pending.check')}</button><button class="btn sm p" type="button">${t('chat.pending.retry')}</button></div></div>` : ''}
${S.sub === 'limit' ? `<div class="note warn" role="status"><b>${t('chat.limit.title')}</b>${t('chat.limit.body', { date: L('30 de noviembre', '30 November') })}<div style="margin-top:.6rem"><a class="btn sm" href="#diary">${t('nav.diary')}</a></div></div>` : ''}
${S.sub === 'paused' ? `<div class="note" role="status">${t('chat.paused')} <button class="btn t sm" data-act="resumechat">${t('chat.resume')}</button></div>` : ''}
${S.chat.length ? `<div class="stack" style="margin:.5rem 0"><span class="demo" style="align-self:flex-start">${t('chat.sample')}</span></div>` : ''}
<div class="thread" role="log" aria-live="polite" aria-label="${t('chat.title')}">${S.chat.length ? turns() : `<div class="empty"><h2 class="d3">${t('chat.empty.title')}</h2><p class="sub">${t('chat.welcome')}</p></div>`}</div>
<form class="composer" onsubmit="return false"><div class="box"><div class="fld" style="flex:1"><label class="sr" for="m">${t('chat.label')}</label><textarea id="m" rows="1" data-in="input" placeholder="${t('chat.ph')}" ${S.sub === 'limit' || S.sub === 'paused' ? 'disabled' : ''}>${esc(S.input)}</textarea></div><button class="btn p" type="submit" data-act="send" ${S.sub === 'limit' || S.sub === 'paused' || S.typing ? 'disabled' : ''}>${t('chat.send')}${ico('send')}</button></div>
<div class="meta"><span>${ico('book')} ${t('chat.diary.none')}</span><span>${S.input.length} / 4.000</span></div></form>`);

V.diary = () => app(`${head(t('dia.title'), t('dia.sub'), `<div><a class="btn p" href="#diary-new">${ico('plus')}${t('dia.new')}</a></div>`)}
${S.diary.length ? S.diary.map(d => `<div class="rowline" style="grid-template-columns:7rem 1fr auto"><span class="mono">${L('Hoy', 'Today')}</span><span><b>${esc(d.title || L('Sin título', 'Untitled'))}</b><br><span class="sub">${esc(d.body.slice(0, 90))}</span></span><span class="chip">${t('dia.private')}</span></div>`).join('') : `<div class="empty"><h2 class="d3">${t('dia.empty.title')}</h2><p class="sub">${t('dia.empty.body')}</p></div>`}`);
V['diary-new'] = () => app(`${head(t('dia.new'), `${ico('lock')} ${t('dia.sub')}`)}<form class="stack l" onsubmit="return false"><div class="fld"><label for="dt">${t('dia.field.title')}</label><input id="dt" data-in="dtitle"></div><div class="fld"><label for="db">${t('dia.field.body')}</label><textarea id="db" data-in="dbody" style="min-height:12rem"></textarea></div><div class="row"><button class="btn p" type="submit" data-act="savediary">${t('dia.save')}</button><a class="btn t" href="#diary">${t('btn.cancel')}</a></div></form>`);

/* ---- mapa ---- */
function radar() {
  const cx = 200, cy = 170, R = 112, r0 = 20, n = 8, gap = .04; let g = '';
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + i * 2 * Math.PI / n - Math.PI / n + gap, a1 = a0 + 2 * Math.PI / n - 2 * gap, am = (a0 + a1) / 2;
    const P = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
    const wedge = r => `M${P(r0, a0)} L${P(r, a0)} A${r} ${r} 0 0 1 ${P(r, a1)} L${P(r0, a1)} A${r0} ${r0} 0 0 0 ${P(r0, a0)} Z`;
    const lv = S.levels[i]?.level, lx = cx + (R + 14) * Math.cos(am), ly = cy + (R + 14) * Math.sin(am), anc = Math.abs(Math.cos(am)) < .3 ? 'middle' : Math.cos(am) > 0 ? 'start' : 'end';
    g += `<g class="petal ${S.sel === i ? 'sel' : ''}" role="button" tabindex="0" data-act="sel" data-v="${i}" aria-pressed="${S.sel === i}" aria-label="${CAPS[S.lang][i]}: ${lv ? t('map.level', { n: lv }) : t('map.status.none')}"><path class="bg" d="${wedge(R)}"/>${lv ? `<path class="fg" d="${wedge(r0 + (R - r0) * lv / 4)}"/>` : ''}<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anc}">${SHORT[S.lang][i]}</text></g>`;
  }
  return `<svg viewBox="0 0 400 340" style="width:100%;max-width:440px;display:block;margin:0 auto" role="group" aria-label="${t('map.title')}">${g}</svg>`;
}
const stepsPath = () => { const hasE = S.evid.length > 0, hasC = confirmedEv().length > 0, hasL = Object.keys(S.levels).length > 0;
  const st = [hasE, hasC, hasL], cur = st.findIndex(x => !x);
  return `<div class="steps3">${[1, 2, 3].map((n, i) => `<div class="${st[i] ? 'done' : i === cur ? 'on' : ''}"><span class="mono">0${n}${st[i] ? ' · ✓' : ''}</span><p>${t('map.guide.' + n)}</p></div>`).join('')}</div>` };
function detail() {
  if (S.sel === null) return `<div class="empty"><p class="sub">${t('map.select')}</p></div>`;
  const i = S.sel, lv = S.levels[i];
  return `<div class="stack"><span class="mono">${t('map.detail')}</span><h2 class="d3" tabindex="-1" id="capname">${CAPS[S.lang][i]}</h2>
<p>${lv ? `<span class="chip on">${t('map.level', { n: lv.level })}</span> <span class="chip">${t('map.source.evid')}</span>` : `<span class="chip">${t('map.status.none')}</span>`}</p>
<ol class="ladder" aria-label="${t('map.rubric')}">${[1, 2, 3, 4].map(n => `<li class="${lv?.level === n ? 'cur' : ''}"><b>${n}</b><span class="sub">${rubric(i, n)}</span></li>`).join('')}</ol>
<div class="row"><button class="btn p" type="button" data-act="openlevel">${t(lv ? 'lv.change' : 'lv.open')}</button>${lv ? `<button class="btn d" type="button" data-act="retire">${t('lv.retire')}</button>` : ''}<button class="btn" type="button" data-act="openai">${ico('spark')}${t('ai.open_skill')}</button></div></div>`;
}
V.map = () => app(`${head(t('map.title'), t('map.sub'))}
${Object.keys(S.levels).length === 0 ? sec(t('map.guide.title'), stepsPath()) : ''}
<div class="mapgrid"><div>${radar()}<p class="mono" style="text-align:center;margin-top:.4rem">${t('map.radar.hint')}</p></div><div>${detail()}</div></div>
${sec(t('map.list'), `<ul class="ladder" style="grid-template-columns:1fr">${CAPS[S.lang].map((c, i) => `<li style="grid-template-columns:1fr auto"><button class="btn t" style="justify-content:flex-start;min-height:40px" data-act="sel" data-v="${i}">${c}</button><span><span class="pips" aria-hidden="true">${[1, 2, 3, 4].map(k => `<i class="${S.levels[i] && k <= S.levels[i].level ? 'f' : ''}"></i>`).join('')}</span> <span class="chip ${S.levels[i] ? 'on' : ''}">${S.levels[i] ? t('map.level', { n: S.levels[i].level }) : t('map.status.none')}</span></span></li>`).join('')}</ul><p class="sub">${t('map.footer')}</p><p class="sub">${t('map.share')}</p>`)}
${Object.keys(S.levels).length ? `<div class="row"><button class="btn sm d" type="button" data-act="revoke">${t('map.revoke')}</button></div>` : ''}`);

/* ---- evidencias ---- */
V.evidence = () => app(`${head(t('ev.title'), t('ev.sub'), `<div><button class="btn p" type="button" data-act="newev">${ico('plus')}${t('ev.new')}</button></div>`)}
${S.evid.length ? S.evid.map(e => `<div class="rowline" style="grid-template-columns:7rem 1fr auto"><span class="mono">${e.status === 'confirmed' ? t('ev.list.confirmed') : t('ev.list.draft')}</span><span><b>${esc(e.title)}</b>${e.demo ? ' ' + demo('ejemplo', 'example') : ''}</span>${e.status === 'confirmed' ? `<span class="chip on">${ico('check')}${t('ev.counts')}</span>` : `<button class="btn sm p" type="button" data-act="confirmdraft" data-v="${e.id}">${t('ev.review.confirm')}</button>`}</div>`).join('') : `<div class="empty"><h2 class="d3">${t('ev.empty.title')}</h2><p class="sub">${t('ev.empty.body')}</p><button class="btn p" type="button" data-act="newev">${t('ev.new')}</button></div>`}`);

/* ---- planes ---- */
const reqTimeline = () => { const st = S.req === 'none' ? -1 : S.req === 'pending' ? 1 : 2;
  return `<ol class="steps4">${['sent', 'review', 'decision'].map((k, i) => `<li class="${i < st ? 'done' : i === st ? 'on' : ''}">${t('pl.tl.' + k)}</li>`).join('')}</ol>` };
const planCard = (n) => `<div class="plan"><span class="mono">${n === 0 ? t('pl.highlight') : ''}&nbsp;</span><h3 class="d3">${t('pl.ex.name')} ${n === 0 ? 'A' : 'B'}</h3><p class="sub">${t('pl.ex.desc')}</p><p class="price">${t('pl.free')}</p><p class="mono">USD · ${t('pl.per')}</p><ul class="checks" style="margin:.4rem 0"><li class="ok">${t('pl.ex.f1')}</li><li class="ok">${t('pl.ex.f2')}</li></ul>${S.req === 'pending' ? `<button class="btn" disabled>${t('pl.existing')}</button>` : `<button class="btn p" type="button" data-act="planconfirm" data-v="${n}">${t('pl.cta')}${ico('ar', 'ar')}</button>`}${demo('datos de ejemplo', 'example data')}</div>`;
V.plans = () => app(`${head(t('nav.plan'), t('pl.sub'))}
${S.req === 'pending' ? `<p class="note ok" role="status"><b>${t('pl.req.pending')}</b>${t('pl.req.pending.body')}</p>` : ''}
${sec(t('pl.current'), `<div class="row" style="align-items:baseline;gap:1.4rem"><span class="price">${L('Gratis', 'Free')}</span><span class="chip">${L('Básico', 'Basic')}</span></div><div class="cols3" style="gap:1.4rem"><div><span class="mono">${t('pl.msgday')}</span><p class="d3">10</p></div><div><span class="mono">${t('pl.sessions')}</span><p class="d3">0</p></div><div><span class="mono">${t('chat.usage')}</span><p class="d3">4 %</p></div></div><p class="sub">${demo('valores de la cuenta de staging', 'staging account values')}</p>`)}
${sec(t('pl.req.title'), `${S.req === 'none' ? `<p class="sub">${t('pl.req.none')}</p>` : reqTimeline()}${S.req === 'pending' ? `<p class="sub">${t('pl.req.where')}</p>` : ''}`)}
${sec(t('pl.catalog.title'), `<p class="lead">${t('pl.catalog.sub')}</p><div class="plans">${planCard(0)}${planCard(1)}</div><p class="sub">${t('pl.paid.note')}</p><p class="sub">${t('pl.nopay')}</p>`)}`);

/* ---- el resto ---- */
V.bridge = () => app(`${head(t('br.title'), t('br.sub'))}${[['chat'], ['diary'], ['cv']].map(([k], i) => `<section class="pg"><div class="mg mono">0${i + 1}</div><div class="stack"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><b class="d3">${t('br.src.' + k)}</b><span class="row" style="flex-wrap:nowrap"><span class="chip ${S.tog[k] ? 'on' : ''}">${S.tog[k] ? t('br.on') : t('br.off')}</span><button class="tog" type="button" role="switch" aria-checked="${!!S.tog[k]}" aria-label="${t('br.src.' + k)}" data-act="tog" data-v="${k}"><i></i></button></span></div><p class="sub">${t('br.src.' + k + '.d')}</p><div><button class="btn sm" type="button" ${S.tog[k] ? '' : 'disabled'}>${t('br.analyze')}</button> ${S.tog[k] ? '' : `<small class="sub">${t('br.analyze.hint')}</small>`}</div></div></section>`).join('')}
${sec(t('br.shared'), `<p class="sub">${t('br.shared.empty')}</p><p class="note info" role="note">${t('br.crisis')}</p><p class="sub">${t('br.unsaved')}</p>`)}`);
V.pro = () => app(`${head(t('pro.title'), t('pro.none'), `<div><button class="btn p" type="button">${t('pro.find')}</button></div>`)}${sec(t('pro.next'), `<p class="sub">${t('pro.session.none')}</p>`)}${noticeNC()}`);
V.data = () => app(`${head(t('dat.title'), t('dat.sub'))}${sec(t('dat.exp.title'), `<p class="sub">${t('dat.exp.body')}</p><div><button class="btn p" type="button">${t('dat.exp.cta')}</button></div>`)}${sec(t('dat.del.title'), `<p class="sub">${t('dat.del.body')}</p><div><button class="btn d" type="button" data-act="delmodal">${t('dat.del.cta')}</button></div>`)}`);
V.next = () => app(`${head(t('nx.title'), '')}<div class="row" role="group" aria-label="${t('nx.title')}">${['routes', 'exp', 'plan'].map((k, i) => `<button class="btn sm ${i === 0 ? 'p' : ''}" type="button" aria-pressed="${i === 0}">${t('nx.tab.' + k)}</button>`).join('')}</div><div class="empty"><span class="chip">${t('state.coming')}</span><h2 class="d3">${t('nx.soon.title')}</h2><p class="sub">${t('nx.soon.body')}</p><a class="btn p" href="#evidence">${t('nx.soon.cta')}</a></div><p class="sub">${t('nx.routes.note')}</p>`);
const roleFrame = (items, cur, inner) => `<a class="sr" href="#main">${t('skip')}</a><header class="mast">${brand(cur)}<nav class="idx" aria-label="${t('nav.main')}">${items.map((n, i) => `<a href="#${n[0]}" ${cur === n[0] ? 'aria-current="page"' : ''}><b>0${i + 1}</b>${n[1]}</a>`).join('')}</nav><div class="tools"><span class="planchip">${cur === 'therapist' ? t('role.pro') : t('role.admin')}</span>${langSw()}<a class="btn sm t" href="#login">${t('nav.logout')}</a></div></header><main class="body" id="main" tabindex="-1"><div class="page">${inner}</div></main><nav class="tabbar" style="grid-template-columns:repeat(${items.length},1fr)">${items.map(n => `<a href="#${n[0]}" ${cur === n[0] ? 'aria-current="page"' : ''}>${ico('more')}${n[1]}</a>`).join('')}</nav>`;
V.therapist = () => roleFrame([['therapist', t('th.title')], ['therapist-guide', t('th.guide.title')]], 'therapist', `${head(t('th.title'), t('th.scope'))}<div class="rowline" style="grid-template-columns:3rem 1fr auto;cursor:default"><span class="n">01</span><span class="stack" style="gap:.2rem"><b>${L('Nombre de la persona', 'Person’s name')}</b><span class="note info" style="margin-top:.4rem">${t('th.card.noaccess.body')}</span></span><span class="chip">${ico('lock')}${t('th.card.noaccess')}</span></div>${sec(t('th.guide.title'), `<p class="sub">${t('th.guide.none')}</p><div><button class="btn" type="button">${t('th.guide.cta')}</button></div>`)}${sec(t('th.alerts'), `<p class="sub">${t('th.alerts.none')}</p>`)}`);
V.admin = () => roleFrame([['admin', t('ad.title')], ['admin-content', L('Contenido', 'Content')], ['admin-metrics', L('Métricas', 'Metrics')]], 'admin', `${head(t('ad.title'), t('ad.count', { n: '…' }), `<div><button class="btn p" type="button">${t('ad.create')}</button></div>`)}
<div class="row" style="align-items:flex-end"><div class="fld" style="flex:1 1 14rem"><label for="q">${t('ad.search')}</label><input id="q" type="search"></div><div class="fld"><label for="fr">${t('ad.f.role')}</label><select id="fr"><option>${L('Todos', 'All')}</option></select></div><div class="fld"><label for="fs">${t('ad.f.state')}</label><select id="fs"><option>${L('Todos', 'All')}</option></select></div></div>
<table class="t"><thead><tr><th>${t('ad.col.user')}</th><th>${t('ad.col.role')}</th><th>${t('ad.col.state')}</th><th>${t('ad.col.action')}</th></tr></thead><tbody>${[['user', 'active'], ['therapist', 'active'], ['user', 'inactive']].map(r => `<tr><td><b>${L('Nombre y apellido', 'First and last name')}</b><br><small class="sub">correo@ejemplo.test</small></td><td>${t('ad.role.' + r[0])}</td><td><span class="chip ${r[1] === 'active' ? 'on' : ''}">${t('ad.state.' + r[1])}</span></td><td><button class="btn sm" type="button">${t('ad.col.action')}</button></td></tr>`).join('')}</tbody></table>
<div class="ucards">${['user', 'therapist'].map(r => `<div><b>${L('Nombre y apellido', 'First and last name')}</b><small class="sub">correo@ejemplo.test</small><span><span class="chip">${t('ad.role.' + r)}</span> <span class="chip on">${t('ad.state.active')}</span></span><button class="btn sm" type="button" style="justify-self:start">${t('ad.col.action')}</button></div>`).join('')}</div>
<div class="row" style="justify-content:space-between"><span class="sub">${t('ad.page', { a: 1, b: '…' })}</span><span class="row"><button class="btn sm" type="button" disabled>${t('ad.prev')}</button><button class="btn sm" type="button">${t('ad.nextp')}</button></span></div>${demo('filas de ejemplo del diseño', 'design example rows')}`);
V.states = () => app(`${head(L('Estados de pantalla', 'Screen states'), L('Los cuatro estados que toda sección resuelve, y el aviso de seguridad.', 'The four states every section handles, plus the safety notice.'))}
${sec(L('Cargando', 'Loading'), `<div class="stack" style="max-width:30rem"><div class="skel" style="width:60%"></div><div class="skel"></div><div class="skel" style="width:80%"></div><small class="sub" role="status">${t('state.loading')}</small></div>`)}
${sec(L('Vacío', 'Empty'), `<div class="empty"><h2 class="d3">${t('dia.empty.title')}</h2><p class="sub">${t('dia.empty.body')}</p><a class="btn" href="#diary-new">${t('dia.new')}</a></div>`)}
${sec('Error', `<div class="note err" role="alert"><b>${t('map.err')}</b>${t('home.err.safe')}<div style="margin-top:.6rem"><button class="btn sm" type="button">${t('state.retry')}</button></div></div>`)}
${sec(L('Éxito', 'Success'), `<div class="note ok" role="status">${t('state.saved')}</div>`)}
${sec(L('Seguridad', 'Safety'), `<p class="note info" role="note">${t('notice.safety')}</p>`)}`);

/* ---------- paneles (drawers) ---------- */
function drawer(title, sub, body, foot) { return `<div class="scrim" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dt-title"><header><div><h2 class="d3" id="dt-title">${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div><button class="btn t" type="button" data-act="close" aria-label="${t('btn.close')}">${ico('x')}</button></header><div class="dbody">${body}</div><footer>${foot}</footer></aside>` }
function evDrawer() {
  const d = S.ED, n = d.step, from = d.fromChat >= 0;
  const steps = [() => `${from ? `<p class="note"><span class="mono">${t('chat.draft.from')}</span><br><em style="font-family:var(--voice)">${esc(S.chat[d.fromChat]?.text || '')}</em></p>` : ''}<div class="fld"><label for="e1">${t('ev.f.title')}</label><input id="e1" data-in="ED.title" value="${esc(d.title)}"></div><div class="fld"><label for="e2">${t('ev.f.situation')}</label><small>${t('ev.f.situation.h')}</small><textarea id="e2" data-in="ED.situation">${esc(d.situation)}</textarea></div>`,
    () => `<div class="fld"><label for="e3">${t('ev.f.part')}</label><small>${t('ev.f.part.h')}</small><textarea id="e3" data-in="ED.part">${esc(d.part)}</textarea></div><div class="fld"><label for="e4">${t('ev.f.actions')}</label><small>${t('ev.f.actions.h')}</small><textarea id="e4" data-in="ED.actions">${esc(d.actions)}</textarea></div>`,
    () => `<div class="fld"><label for="e5">${t('ev.f.result')}</label><small>${t('ev.f.result.h')}</small><textarea id="e5" data-in="ED.delivered">${esc(d.delivered)}</textarea></div><fieldset style="border:0;padding:0;margin:0"><legend class="mono" style="padding:0 0 .4rem">${t('ev.f.effect')}</legend>${['known', 'unknown'].map(v => `<label class="opt" style="padding:.5rem 0"><input type="radio" name="ef" data-in="ED.effect" value="${v}" ${d.effect === v ? 'checked' : ''}><span>${t('ev.effect.' + v)}</span></label>`).join('')}</fieldset><div class="fld"><label for="e6">${t('ev.f.autonomy')}</label><select id="e6" data-in="ED.autonomy"><option value="">${t('ev.autonomy.unset')}</option>${AUTONOMY.map(a => `<option value="${a}" ${d.autonomy === a ? 'selected' : ''}>${t('ev.autonomy.' + a)}</option>`).join('')}</select><small>${t('ev.autonomy.help')}</small></div>`];
  const ok = d.title.trim() && d.situation.trim() && d.part.trim() && d.actions.trim() && d.delivered.trim() && d.effect;
  return drawer(t('chat.draft.title'), t('chat.draft.sub'), `<span class="mono">0${n} / 03</span>${steps[n - 1]()}<p class="sub">${t('ev.privacy')}</p>`,
    `<button class="btn" type="button" data-act="edstep" data-v="${n - 1}" ${n === 1 ? 'disabled' : ''}>${t('btn.back')}</button><span class="row"><button class="btn" type="button" data-act="eddraft">${t('ev.draft')}</button>${n < 3 ? `<button class="btn p" type="button" data-act="edstep" data-v="${n + 1}">${t('btn.next')}${ico('ar', 'ar')}</button>` : `<button class="btn p" type="button" data-act="edconfirm" ${ok ? '' : 'disabled'}>${t('ev.confirm')}</button>`}</span>`);
}
function lvDrawer() {
  const d = S.LV, n = d.step, i = S.sel, ev = confirmedEv(), max = 8;
  let body;
  if (!ev.length) body = `<div class="empty"><h3 class="d3">${t('lv.none.title')}</h3><p class="sub">${t('lv.none.text')}</p><button class="btn p" type="button" data-act="newev">${t('lv.none.cta')}</button></div>`;
  else if (n === 1) body = `<span class="mono">01 / 03</span><h3 class="d3">${t('lv.s1', { max })}</h3>${ev.map(e => `<label class="opt"><input type="checkbox" data-in="LV.ev" value="${e.id}" ${d.ev.includes(e.id) ? 'checked' : ''}><span><b>${esc(e.title)}</b> ${e.demo ? demo('ejemplo', 'example') : ''}<br><small class="sub">${t('lv.ev.meta')}</small></span></label>`).join('')}<a class="btn t" href="#evidence" style="align-self:flex-start">${t('lv.see')}</a>`;
  else if (n === 2) body = `<span class="mono">02 / 03</span><h3 class="d3">${t('lv.s2')}</h3>${[1, 2, 3, 4].map(k => `<label class="opt"><input type="radio" name="lv" data-in="LV.level" value="${k}" ${d.level === k ? 'checked' : ''}><span><b class="d3">${t('map.level', { n: k })}</b><br><span class="sub">${rubric(i, k)}</span></span></label>`).join('')}<p class="sub">${t('lv.rubric.src', { v: 1 })}${RUBRIC[i] ? ' ' + demo('texto del catálogo de staging (EN: traducción del prototipo)', 'staging catalogue text (EN: prototype translation)') : ''}</p>`;
  else body = `<span class="mono">03 / 03</span><h3 class="d3">${t('lv.s3')}</h3><div class="fld"><label for="ln">${t('lv.note')}</label><textarea id="ln" data-in="LV.note" maxlength="500">${esc(d.note)}</textarea><small>${d.note.length} / 500</small></div><div class="note"><b>${t('lv.summary')}</b>${CAPS[S.lang][i]} · ${t('map.level', { n: d.level })} · ${d.ev.length} ${t('lv.ev.count')}</div><p class="note warn" role="note">${t('lv.warn')}</p>`;
  const canNext = n === 1 ? d.ev.length >= 1 : n === 2 ? d.level !== null : true;
  return drawer(`${t('lv.open')} · ${CAPS[S.lang][i]}`, t('lv.intro'), body, ev.length ? `<button class="btn" type="button" data-act="lvstep" data-v="${n - 1}" ${n === 1 ? 'disabled' : ''}>${t('btn.back')}</button>${n < 3 ? `<button class="btn p" type="button" data-act="lvstep" data-v="${n + 1}" ${canNext ? '' : 'disabled'}>${t('btn.next')}${ico('ar', 'ar')}</button>` : `<button class="btn p" type="button" data-act="lvsave">${t('lv.save')}</button>`}` : `<button class="btn" type="button" data-act="close">${t('btn.cancel')}</button>`);
}
function aiDrawer() {
  const d = S.AI, n = d.step, ev = confirmedEv(); let body, foot;
  if (!ev.length) { body = `<div class="empty"><h3 class="d3">${t('ai.noev.title')}</h3><p class="sub">${t('ai.noev.text')}</p><button class="btn p" type="button" data-act="newev">${t('lv.none.cta')}</button></div>`; foot = `<button class="btn" type="button" data-act="close">${t('ai.close')}</button>` }
  else if (n === 1) { body = `<p>${t('ai.pick.text')}</p><p class="note info" role="note">${t('ai.privacy')}</p><h3 class="d3">${t('ai.pick', { max: 3 })}</h3>${CAPS[S.lang].map((c, i) => `<label class="opt" style="padding:.5rem 0"><input type="checkbox" data-in="AI.picked" value="${i}" ${d.picked.includes(i) ? 'checked' : ''} ${!d.picked.includes(i) && d.picked.length >= 3 ? 'disabled' : ''}><span>${c}</span></label>`).join('')}`; foot = `<span class="sub">${d.picked.length === 1 ? t('ai.selected_one', { max: 3 }) : t('ai.selected', { n: d.picked.length, max: 3 })}</span><button class="btn p" type="button" data-act="aigo" ${d.picked.length ? '' : 'disabled'}>${t('ai.go')}</button>` }
  else if (n === 2) { body = `<div class="stack" role="status"><div class="typing" aria-hidden="true"><i></i><i></i><i></i></div><p>${t('ai.analyzing')}</p></div>`; foot = '' }
  else { body = `<h3 class="d3">${t('ai.rev.title')}</h3><p class="sub">${t('ai.rev.text')}</p>${d.picked.map(i => `<div class="stack" style="border-top:1px solid var(--ink);padding-top:1rem"><span class="chip hl2">${t('ai.tag')}</span> ${demo('propuesta de ejemplo', 'example proposal')}<h4 class="d3" style="margin:0">${CAPS[S.lang][i]}</h4><p><span class="mono">${t('ai.proposed')}</span> <b class="d3">${t('map.level', { n: 2 })}</b></p><p class="sub"><span class="mono">${t('ai.why')}</span><br>${t('ai.why.ex')}</p><p class="sub"><span class="mono">${t('ai.evid')}</span> · ${esc(ev[0].title)}</p><p class="sub">${t('ai.conf.rule')}</p>${[['accept', t('ai.accept', { n: 2 })], ['down', t('ai.down', { n: 1 })], ['unassessed', t('ai.unassessed')], ['skip', t('ai.skip')]].map(a => `<label class="opt" style="padding:.4rem 0"><input type="radio" name="ai${i}" data-in="AI.res.${i}" value="${a[0]}" ${(d.res[i] || 'skip') === a[0] ? 'checked' : ''}><span>${a[1]}</span></label>`).join('')}</div>`).join('')}<p class="sub">${t('ai.expires')}</p>`; foot = `<span class="sub">${t('ai.save.n', { n: d.picked.filter(i => ['accept', 'down'].includes(d.res[i])).length })}</span><button class="btn p" type="button" data-act="aisave">${t('ai.save')}</button>` }
  return drawer(t('ai.title'), '', body, foot);
}
function moreSheet() { return `<div class="scrim" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${t('nav.more')}" style="top:auto;border-top:1px solid var(--ink);max-height:75%"><header><h2 class="d3">${t('nav.more')}</h2><button class="btn t" type="button" data-act="close" aria-label="${t('btn.close')}">${ico('x')}</button></header><div class="dbody">${MORE.map(m => `<a class="rowline" style="grid-template-columns:2rem 1fr" href="#${m[0]}">${ico(m[2])}<b>${t(m[1])}</b></a>`).join('')}<div class="row" style="justify-content:space-between"><span>${t('lang.label')}</span>${langSw()}</div><a class="btn t" href="#login" style="align-self:flex-start">${t('nav.logout')}</a></div></aside>` }
function planSheet() { const n = Number(S.sub.split('-')[1] || 0); return drawer(t('pl.confirm.title'), t('pl.confirm.sub'), `<div class="plan" style="border:1px solid var(--ink)"><h3 class="d3">${t('pl.ex.name')} ${n === 0 ? 'A' : 'B'}</h3><p class="price">${t('pl.free')}</p><p class="mono">USD · ${t('pl.per')}</p>${demo('datos de ejemplo', 'example data')}</div><h3 class="d3">${t('pl.confirm.what')}</h3><ol class="ladder">${[1, 2, 3].map(i => `<li><b>${i}</b><span>${t('pl.confirm.' + i)}</span></li>`).join('')}</ol><p class="note info" role="note">${t('pl.nopay')}</p>`, `<button class="btn" type="button" data-act="close">${t('btn.cancel')}</button><button class="btn p" type="button" data-act="plansend">${t('pl.confirm.send')}</button>`) }
function modal() {
  if (S.modal === 'retire') return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><div class="box"><h2 class="d3" id="mt">${t('lv.retire.title')}</h2><p class="sub">${t('lv.retire.body')}</p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close">${t('btn.cancel')}</button><button class="btn d" type="button" data-act="retireyes">${t('lv.retire.yes')}</button></div></div></div>`;
  if (S.modal === 'revoke') return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><div class="box"><h2 class="d3" id="mt">${t('map.revoke.title')}</h2><p class="sub">${t('map.revoke.body')}</p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close">${t('btn.cancel')}</button><button class="btn d" type="button" data-act="close">${t('map.revoke.yes')}</button></div></div></div>`;
  if (S.modal === 'del') return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><div class="box"><h2 class="d3" id="mt">${t('dat.del.confirm.title')}</h2><p class="sub">${t('dat.del.confirm.body')}</p><div class="fld"><label for="ce">${t('login.email')}</label><input id="ce" type="email" data-in="delText" value="${esc(S.delText)}"></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="close">${t('btn.cancel')}</button><button class="btn d" type="button" ${/@/.test(S.delText) ? '' : 'disabled'}>${t('dat.del.confirm.cta')}</button></div></div></div>`;
  return '';
}

/* ---------- render ---------- */
const ROUTES = [['land', 'Landing', 'Landing'], ['register', 'Crear cuenta', 'Create account'], ['register/plan', 'Crear cuenta · desde un plan', 'Create account · from a plan'], ['login', 'Acceso', 'Log in'], ['login/error', 'Acceso · error', 'Log in · error'], ['onboarding', 'Primeros pasos', 'First steps'],
  ['home', 'Inicio', 'Home'], ['chat', 'Conversación', 'Conversation'], ['chat/evidence', 'Conversación → evidencia', 'Conversation → evidence'], ['chat/error', 'Conversación · sin confirmar', 'Conversation · unconfirmed'], ['chat/limit', 'Conversación · límite de IA', 'Conversation · AI limit'],
  ['diary', 'Diario', 'Journal'], ['diary-new', 'Diario · nueva entrada', 'Journal · new entry'], ['map', 'Mi mapa', 'My map'], ['map/level', 'Mi mapa · registrar nivel', 'My map · record level'], ['map/ai', 'Mi mapa · análisis con IA', 'My map · AI analysis'], ['evidence', 'Evidencias', 'Evidence'], ['evidence/new', 'Evidencias · nueva', 'Evidence · new'],
  ['plans', 'Mi plan', 'My plan'], ['plans/confirm-0', 'Mi plan · solicitar', 'My plan · request'], ['next', 'Mi siguiente paso', 'My next step'], ['bridge', 'El Puente', 'The Bridge'], ['pro', 'Mi profesional', 'My professional'], ['data', 'Mis datos', 'My data'], ['data/del', 'Mis datos · eliminar', 'My data · delete'],
  ['therapist', 'Profesional', 'Professional'], ['admin', 'Administración', 'Administration'], ['states', 'Estados', 'States']];
function render(keepFocus) {
  const root = $('#view'); root.dataset.l = S.lang; document.documentElement.lang = S.lang;
  const [route, sub = ''] = (location.hash || '#land').slice(1).split('/'); S.route = V[route] ? route : 'land'; S.sub = sub;
  let html = V[S.route]();
  if (S.route === 'chat' && S.sub === 'evidence' && !S.ovOpen) { /* abre el borrador desde el último mensaje con experiencia */ }
  const ov = S.overlay;
  if (S.more) html += moreSheet();
  else if (ov === 'ev') html += evDrawer(); else if (ov === 'lv') html += lvDrawer(); else if (ov === 'ai') html += aiDrawer(); else if (ov === 'plan') html += planSheet();
  html += modal() + (S.toast ? `<div class="toast" role="status">${S.toast}</div>` : '');
  const a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
  root.innerHTML = html;
  if (keepFocus && id) { const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(pos, pos) } catch (e) { /* sin selección */ } } }
  $('#scr').innerHTML = ROUTES.map(x => `<option value="${x[0]}" ${x[0] === (location.hash || '#land').slice(1) ? 'selected' : ''}>${S.lang === 'es' ? x[1] : x[2]}</option>`).join('');
  $('#ribbon').textContent = L('Prototipo de diseño con los textos propuestos. Sin datos reales ni inventados: lo marcado «ejemplo» solo muestra el diseño. Las conversaciones de muestra son respuestas reales del asistente capturadas en staging (cuenta sintética).', 'Design prototype with the proposed copy. No real or invented data: anything marked “example” only shows the layout. Sample conversations are real assistant replies captured in staging (synthetic account).');
  $('#bLang').textContent = S.lang === 'es' ? 'EN' : 'ES';
  $('#bDev').textContent = S.dev ? L('Escritorio', 'Desktop') : L('Móvil', 'Mobile');
}
function applyHash() {
  const [route, sub = ''] = (location.hash || '#land').slice(1).split('/');
  S.overlay = ''; S.more = false; S.menu = false; S.modal = '';
  if (route === 'chat' && sub === 'evidence') { if (!S.chat.length) scenario('active'); openEv(2) }
  if (route === 'evidence' && sub === 'new') openEv(-1);
  if (route === 'map' && sub === 'level') { if (!confirmedEv().length) scenario('evidence'); S.sel = S.sel ?? 3; openLv() }
  if (route === 'map' && sub === 'ai') { if (!confirmedEv().length) scenario('evidence'); S.AI = { step: 1, picked: [3], res: {} }; S.overlay = 'ai' }
  if (route === 'plans' && sub.startsWith('confirm')) S.overlay = 'plan';
  if (route === 'data' && sub === 'del') S.modal = 'del';
  if (route === 'chat' && ['error', 'limit', 'paused'].includes(sub) && !S.chat.length) scenario('active');
  render();
}
function openEv(from) { S.ED = { step: 1, title: '', situation: '', part: '', actions: '', delivered: '', effect: '', autonomy: '', fromChat: from };
  if (from >= 0) { S.ED.title = L('Coordinación de equipos de logística', 'Coordinating logistics teams'); S.ED.situation = S.chat[from]?.text || '' } S.overlay = 'ev' }
function openLv() { S.LV = { step: 1, ev: [], level: S.levels[S.sel]?.level ?? null, note: '' }; S.overlay = 'lv' }
const toast = m => { S.toast = m; render(); clearTimeout(toast.t); toast.t = setTimeout(() => { S.toast = ''; render() }, 3500) };
const go = h => { if (location.hash === '#' + h) applyHash(); else location.hash = h };

/* ---------- acciones ---------- */
const ACT = {
  lang: v => { S.lang = v; localStorage.setItem('elv_proto_lang', v); if (S.chat.length) { const sc = S.scenario; const lv = S.levels, ev = S.evid, rq = S.req; scenario(sc); S.levels = lv; S.req = rq; if (!ev.some(e => e.demo === false && e.id > 2)) { /* conserva escenario */ } } render() },
  menu: () => { S.menu = !S.menu; render() }, more: () => { S.more = true; render() },
  close: () => { S.overlay = ''; S.more = false; S.modal = ''; S.menu = false; if (/\/(evidence|level|ai|confirm|del)/.test(location.hash) || location.hash.includes('/new')) history.replaceState(null, '', '#' + S.route); render() },
  go: v => go(v), ob: v => { S.ob = Number(v); render() },
  mood: v => { S.mood = Number(v); render() },
  showpw: () => { S.reg.show = !S.reg.show; render(true) },
  register: () => { const r = S.reg, ok = pwRules(r.pw).every(x => x[1]) && r.consent && r.name.trim() && /@/.test(r.email); r.tried = true; if (ok) r.done = true; render() },
  send: () => { const txt = S.input.trim(); if (!txt || S.typing) return; S.chat.push({ r: 'me', text: txt }); S.input = ''; S.typing = true; render(); setTimeout(() => { const rs = REPLIES(); S.chat.push({ r: 'ai', text: rs[S.reply % rs.length] }); S.reply++; S.typing = false; render() }, 1500) },
  quick: v => { S.input = t('chat.q.' + v + '.send'); ACT.send() },
  copy: () => toast(t('chat.msg.copied')), pausechat: () => { history.replaceState(null, '', '#chat/paused'); applyHash() }, resumechat: () => { history.replaceState(null, '', '#chat'); applyHash() },
  evfromchat: v => { openEv(Number(v)); render() }, newev: () => { S.overlay = ''; openEv(-1); render() },
  edstep: v => { S.ED.step = Math.min(3, Math.max(1, Number(v))); render() },
  eddraft: () => { const d = S.ED; S.evid.push({ id: S.evid.length + 10, title: d.title || L('Borrador sin título', 'Untitled draft'), status: 'draft' }); S.overlay = ''; toast(t('ev.saved.draft')) },
  edconfirm: () => { const d = S.ED; S.evid.push({ id: S.evid.length + 10, title: d.title, status: 'confirmed' }); if (d.fromChat >= 0) S.saved[d.fromChat] = true; S.overlay = ''; toast(t('ev.saved')) },
  confirmdraft: v => { const e = S.evid.find(x => x.id === Number(v)); if (e) e.status = 'confirmed'; toast(t('ev.saved')) },
  sel: v => { S.sel = Number(v); render() },
  openlevel: () => { openLv(); render() }, lvstep: v => { S.LV.step = Math.min(3, Math.max(1, Number(v))); render() },
  lvsave: () => { S.levels[S.sel] = { level: S.LV.level, ev: S.LV.ev, note: S.LV.note }; S.overlay = ''; toast(t('lv.saved')) },
  retire: () => { S.modal = 'retire'; render() }, retireyes: () => { delete S.levels[S.sel]; S.modal = ''; toast(t('lv.retired')) }, revoke: () => { S.modal = 'revoke'; render() },
  openai: () => { S.AI = { step: 1, picked: [S.sel ?? 3], res: {} }; S.overlay = 'ai'; render() },
  aigo: () => { S.AI.step = 2; render(); setTimeout(() => { S.AI.step = 3; S.AI.picked.forEach(i => S.AI.res[i] = 'accept'); render() }, 1600) },
  aisave: () => { S.AI.picked.forEach(i => { const r = S.AI.res[i]; if (r === 'accept') S.levels[i] = { level: 2, ev: [1], note: '' }; if (r === 'down') S.levels[i] = { level: 1, ev: [1], note: '' }; if (r === 'unassessed') delete S.levels[i] }); S.overlay = ''; toast(t('ai.done')) },
  planconfirm: v => { history.replaceState(null, '', '#plans/confirm-' + v); applyHash() },
  plansend: () => { S.req = 'pending'; S.overlay = ''; history.replaceState(null, '', '#plans'); toast(t('pl.sent')) },
  tog: v => { S.tog[v] = !S.tog[v]; render() }, delmodal: () => { S.modal = 'del'; render() },
  savediary: () => { const el = $('#db'); if (!el || !el.value.trim()) return; S.diary.unshift({ title: $('#dt').value, body: el.value }); go('diary') },
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; if (b.tagName === 'A' && b.hasAttribute('href') && b.dataset.act === 'go') { return } ACT[b.dataset.act]?.(b.dataset.v, b) });
document.addEventListener('keydown', e => { const p = e.target.closest?.('.petal'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ACT.sel(p.dataset.v) }
  if (e.key === 'Escape' && (S.overlay || S.more || S.modal)) ACT.close();
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches?.('#m')) { e.preventDefault(); ACT.send() } });
function setPath(path, val) { const [a, b, c] = path.split('.'); if (c !== undefined) S[a][b][c] = val; else if (b !== undefined) S[a][b] = val; else S[a] = val }
document.addEventListener('input', e => {
  const el = e.target, k = el.dataset?.in; if (!k) return
  const rerender = () => render(true)
  if (k === 'consent') { S.reg.consent = el.checked; return }
  if (el.type === 'checkbox') { const arr = k === 'LV.ev' ? S.LV.ev : S.AI.picked, v = Number(el.value), i = arr.indexOf(v); if (el.checked && i < 0) arr.push(v); if (!el.checked && i >= 0) arr.splice(i, 1); return rerender() }
  if (el.type === 'radio') { setPath(k, k === 'LV.level' ? Number(el.value) : el.value); return rerender() }
  if (el.tagName === 'SELECT') { setPath(k, el.value); return rerender() }
  if (k === 'name' || k === 'email') { S.reg[k] = el.value; return }
  if (k === 'pw') { S.reg.pw = el.value; return rerender() }
  if (k === 'delText') { S.delText = el.value; return rerender() }
  if (k === 'input') { S.input = el.value; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; const c = document.querySelector('.composer .meta span:last-child'); if (c) c.textContent = S.input.length + ' / 4.000'; return }
  setPath(k, el.value)
  if (k.startsWith('ED.')) { const ok = document.querySelector('[data-act=edconfirm]'), d = S.ED; if (ok) ok.disabled = !(d.title.trim() && d.situation.trim() && d.part.trim() && d.actions.trim() && d.delivered.trim() && d.effect) }
})
/* ---------- barra del prototipo ---------- */
$('#scr').onchange = e => { location.hash = e.target.value };
$('#bLang').onclick = () => ACT.lang(S.lang === 'es' ? 'en' : 'es');
$('#bDev').onclick = () => { S.dev = !S.dev; $('#device').classList.toggle('m', S.dev); $('#bDev').setAttribute('aria-pressed', S.dev); render() };
$('#bTheme').onclick = () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = S.theme; $('#bTheme').setAttribute('aria-pressed', S.theme === 'dark') };
$('#sc').onchange = e => { scenario(e.target.value); render() };
addEventListener('hashchange', applyHash);
window.PROTO = { scenario: n => { scenario(n); $('#sc').value = n }, go, S, applyHash, setDev: v => { S.dev = v; $('#device').classList.toggle('m', v); render() } };
if (matchMedia('(max-width:700px)').matches) { S.dev = true; $('#device').classList.add('m') }
applyHash();
