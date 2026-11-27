/* ES-408 · Prototipo de DISEÑO. No es código de producto. Textos: textos.js (fuente única). Nada se envía ni se guarda. */
(function () {
  'use strict'
  var DICT = {}; window.ES408.T.forEach(function (r) { DICT[r[0]] = { es: r[2], en: r[3] } })
  var S = { lang: 'es', view: 'registro', routes: 'in', promise: 'p1', audience: 'a1', theme: 'auto', hint: '', state: 'vacio', open: {}, draft: blank(), errors: [], reviewed: false, saveMode: 'ok', reg: window.ES408Access.blank(), regState: 'vacio', regErrors: {} }
  try { S.lang = localStorage.getItem('es408_lang') || (/^en/i.test(navigator.language) ? 'en' : 'es') } catch (e) {}
  function blank() { return { title: '', situation: '', responsibility: '', actions: [''], delivered: '', effect: '', effectText: '', goal: '', alternatives: [], learning: '', autonomy: '', sample: '' } }
  function t(k, vars) { var v = DICT[k]; if (!v) return '⚠' + k; var s = v[S.lang]; if (vars) Object.keys(vars).forEach(function (n) { s = s.replace('{' + n + '}', vars[n]) }); return s }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  var $ = function (q) { return document.querySelector(q) }
  var LIMIT = { title: 120, situation: 1000, responsibility: 1000, actions: 1000, delivered: 1000, effectText: 1000, goal: 500, alternatives: 500, learning: 1000, sample: 500 }
  /* mismas reglas que backend/utils/evidence.js:94-130 */
  var REQUIRED = ['situation', 'responsibility', 'actions', 'delivered', 'observedEffect']

  function ring(cx, cy, rx, ry, seed) {
    var n = 18, p = [], i, a, k
    for (i = 0; i < n; i++) { a = i / n * Math.PI * 2; k = 1 + .13 * Math.sin(a * 3 + seed) + .08 * Math.sin(a * 5 + seed * 2.1) + .05 * Math.cos(a * 2 + seed * .7); p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]) }
    var f = function (v) { return v.toFixed(1) }, d = 'M' + f(p[0][0]) + ' ' + f(p[0][1])
    for (i = 0; i < n; i++) { var a0 = p[(i - 1 + n) % n], a1 = p[i], a2 = p[(i + 1) % n], a3 = p[(i + 2) % n]; d += 'C' + f(a1[0] + (a2[0] - a0[0]) / 6) + ' ' + f(a1[1] + (a2[1] - a0[1]) / 6) + ' ' + f(a2[0] - (a3[0] - a1[0]) / 6) + ' ' + f(a2[1] - (a3[1] - a1[1]) / 6) + ' ' + f(a2[0]) + ' ' + f(a2[1]) }
    return d + 'Z'
  }
  function relief() {
    var out = ''
    ;[[130, 118, 105, 78, 13], [312, 96, 74, 58, 8], [252, 262, 112, 62, 10]].forEach(function (p, pi) { for (var r = 1; r <= p[4]; r++) out += '<path class="' + (r % 4 ? '' : 'idx') + '" d="' + ring(p[0], p[1], p[2] * r / p[4], p[3] * r / p[4], pi * 2.3 + r * .21) + '"/>' })
    return '<svg viewBox="0 0 400 340" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g class="relief">' + out + '</g><circle class="halo" cx="252" cy="268" r="16"/><circle class="dot" cx="252" cy="268" r="7"/><text class="pin" x="236" y="300" text-anchor="end">' + t('landing.portada.here') + '</text></svg>'
  }

  function section(id, title, body, cls) { return '<section id="' + id + '" class="sec ' + (cls || '') + '" aria-labelledby="h-' + id + '"><h2 id="h-' + id + '">' + title + '</h2>' + body + '</section>' }
  function list(keys) { return '<ul class="bul">' + keys.map(function (k) { return '<li>' + t(k) + '</li>' }).join('') + '</ul>' }

  function portada() {
    var withRoutes = S.routes === 'in', steps = ['s1', 's2', 's3', 's4'].concat(withRoutes ? ['s5'] : [])
    var hero = '<section class="hero" aria-labelledby="h-hero"><div class="hero__txt"><p class="tag">' + t('landing.portada.eyebrow') + '</p><h1 id="h-hero">' + t('landing.portada.promise.' + S.promise) + '</h1><p class="aud">' + t('landing.portada.audience.' + S.audience) + '</p><p>' + t('landing.portada.lead') + '</p><div class="row"><a class="btn btn--mark" href="#ejemplo" data-go="ejemplo">' + t('landing.portada.cta_try') + '</a><button type="button" class="btn btn--ghost" data-noop>' + t('landing.portada.cta_create') + '</button></div><ul class="chips"><li>' + t('landing.portada.chip_private') + '</li><li>' + t('landing.portada.chip_nonclinical') + '</li></ul></div><div class="hero__map" role="img" aria-label="' + esc(t('landing.portada.relief_alt')) + '">' + relief() + '</div></section>'
    var problem = section('que', t('landing.v2.problem.title'), '<div class="three">' + ['b1', 'b2', 'b3'].map(function (k) { return '<p class="card">' + t('landing.v2.problem.' + k) + '</p>' }).join('') + '</div>')
    var journey = section('recorrido', t('landing.v2.journey.title'), '<p class="lead">' + t('landing.v2.journey.note') + '</p><ol class="journey">' + steps.map(function (s, i) { var pre = s === 's5'; return '<li class="jstep"><span class="num" aria-hidden="true">' + (i + 1) + '</span><div><h3>' + t('landing.v2.journey.' + s + '.t') + (pre ? ' <span class="badge badge--pre">' + t('landing.status.preview') + '</span>' : '') + '</h3><p>' + t('landing.v2.journey.' + s + '.b') + '</p>' + (pre ? '<p class="muted small">' + t('landing.v2.journey.s5.synthetic') + '</p>' : '') + '</div><p class="get"><span>' + t('landing.v2.journey.get') + '</span> ' + t('landing.v2.journey.' + s + '.g') + '</p></li>' }).join('') + '</ol>')
    var hint = S.hint ? '<div class="card hint"><p class="tag">' + t('landing.portada.hint_title') + '</p><p>' + t('landing.portada.hint_body') + '</p>' + (S.hint === 'show' ? '<div class="row"><button class="btn" data-hint="yes">' + t('landing.portada.hint_yes') + '</button><button class="btn btn--ghost" data-hint="no">' + t('landing.portada.hint_no') + '</button></div>' : '<p><b>' + t(S.hint === 'yes' ? 'landing.portada.hint_ok' : 'landing.portada.hint_no_ok') + '</b></p>') + '</div>' : ''
    var example = section('ejemplo', t('landing.portada.try_title'), '<div class="stackex"><div class="card"><p class="tag">' + t('landing.portada.try_label') + ' · <b>' + t('landing.portada.try_example') + '</b></p><blockquote>' + t('landing.portada.try_value') + '</blockquote><p class="muted small">' + t('landing.portada.try_note') + '</p><button class="btn" data-hint="show">' + t('landing.portada.try_mark') + '</button></div><div aria-live="polite">' + hint + '</div></div>')
    var not = section('no-es', t('landing.not.title'), '<div class="two"><div>' + list(['landing.not.1', 'landing.not.2', 'landing.not.3', 'landing.not.4']) + '</div><div class="card risk"><h3>' + t('landing.trust.5.title') + '</h3><p>' + t('landing.trust.5.body') + '</p></div></div>')
    var privacy = section('privacidad', t('landing.privacy.title'), list(['landing.privacy.1', 'landing.privacy.2', 'landing.privacy.3', 'landing.privacy.4', 'landing.privacy.5']) + '<p class="notice">' + t('landing.privacy.pending') + ' <a href="#privacidad" data-noop>' + t('landing.trust.policy') + '</a></p>', 'band')
    var rows = [['chat', 'ok'], ['journal', 'ok'], ['evidence', 'ok'], ['resume', 'ok'], ['map', 'ok'], ['compass', 'ok'], ['data', 'ok', 'landing.today.data_note'], ['routes', withRoutes ? 'pre' : 'soon'], ['exercises', 'soon', 'landing.today.exercises_note'], ['reminders', 'soon']]
    var lab = { ok: 'landing.status.available', soon: 'landing.status.soon', pre: 'landing.status.preview' }
    var today = section('hoy', t('landing.today.title'), '<ul class="today">' + rows.map(function (r) { return '<li><span>' + t('landing.today.' + r[0]) + (r[2] ? '<small>' + t(r[2]) + '</small>' : '') + '</span><span class="badge badge--' + r[1] + '">' + t(lab[r[1]]) + '</span></li>' }).join('') + '</ul><div class="card pilot"><h3>' + t('landing.next.pilot.title') + '</h3><p>' + t('landing.next.pilot.body') + '</p></div>')
    var faqs = ['q1', '_need', 'q2', 'q5', 'q6', 'q9', 'q10']
    var faq = section('preguntas', t('landing.faq.title'), '<div class="faq">' + faqs.map(function (q) { var qk = q === '_need' ? 'landing.faq.q_need' : 'landing.faq.' + q, ak = q === '_need' ? 'landing.faq.a_need' : 'landing.faq.' + q.replace('q', 'a'); return '<details data-faq="' + q + '"' + (S.open[q] ? ' open' : '') + '><summary>' + t(qk) + '</summary><p>' + t(ak) + '</p></details>' }).join('') + '</div>')
    var entry = '<section id="entrar" class="sec entry" aria-labelledby="h-entry"><h2 id="h-entry">' + t('landing.entry.title') + '</h2><p class="lead">' + t('landing.entry.body') + '</p><div class="row"><button class="btn btn--mark" data-noop>' + t('landing.portada.cta_create') + '</button><button class="btn btn--ghost" data-noop>' + t('landing.next.signin') + '</button></div><p><a href="#entrar" data-noop>' + t('landing.entry.pro') + '</a></p></section>'
    var nav = [['que', 'what'], ['recorrido', 'journey'], ['privacidad', 'privacy'], ['hoy', 'today'], ['preguntas', 'faq']]
    return frame('<nav class="nav" aria-label="' + (S.lang === 'es' ? 'Portada' : 'Home') + '">' + nav.map(function (n) { return '<a href="#' + n[0] + '" data-go="' + n[0] + '">' + t('landing.nav.' + n[1]) + '</a>' }).join('') + '</nav>', '<button class="btn btn--ghost signin" data-noop>' + t('landing.next.signin') + '</button>', hero + problem + journey + example + not + privacy + today + faq + entry, '<span>' + t('landing.not.1') + '</span><span><a href="#" data-noop>' + t('landing.footer.manifest') + '</a> · <a href="#" data-noop>' + t('landing.trust.policy') + '</a> · <a href="#" data-noop>' + t('landing.footer.terms') + '</a></span>')
  }

  /* ---------------- Nueva evidencia ---------------- */
  function guideLeft(v, key) { return t(key).split('\n').some(function (line) { return v.split('\n').indexOf(line) >= 0 }) }
  function missing() {
    var d = S.draft, m = []
    if (!d.title.trim()) m.push('title')
    if (!d.situation.trim()) m.push('situation')
    if (!d.responsibility.trim()) m.push('responsibility')
    if (!d.actions.some(function (a) { return a.trim() })) m.push('actions')
    if (!d.delivered.trim()) m.push('delivered')
    if (!d.effect || (d.effect === 'known' && !d.effectText.trim())) m.push('observedEffect')
    return m
  }
  var NAME = { title: 'evidence.field_title', situation: 'evidence.situation', responsibility: 'evidence.responsibility', actions: 'evidence.actions', delivered: 'evidence.delivered', observedEffect: 'evidence.observedEffect' }
  function errorOf(k) { var e = S.errors.filter(function (x) { return x.k === k })[0]; return e ? t(e.msg) : '' }
  function field(k, o) {
    o = o || {}
    var d = S.draft, v = o.i != null ? d.actions[o.i] : d[k], id = o.i != null ? k + '-' + o.i : k, err = errorOf(k), max = LIMIT[k]
    var help = o.help ? '<p class="help" id="' + id + '-help">' + t(o.help) + '</p>' : ''
    var described = [o.help ? id + '-help' : '', err ? id + '-err' : '', id + '-count'].filter(Boolean).join(' ')
    var input = o.line ? '<input id="' + id + '" data-f="' + k + '"' + (o.i != null ? ' data-i="' + o.i + '"' : '') + ' maxlength="' + max + '" value="' + esc(v) + '" placeholder="' + esc(o.ph ? t(o.ph) : '') + '" aria-describedby="' + described + '"' + (err ? ' aria-invalid="true"' : '') + '>' : '<textarea id="' + id + '" data-f="' + k + '"' + (o.i != null ? ' data-i="' + o.i + '"' : '') + ' rows="' + (o.rows || 3) + '" maxlength="' + max + '" aria-describedby="' + described + '"' + (err ? ' aria-invalid="true"' : '') + '>' + esc(v) + '</textarea>'
    return '<div class="field"><div class="lab' + (o.sr ? ' sr' : '') + '"><label for="' + id + '">' + o.label + '</label>' + (o.tag ? '<span class="req req--' + o.tag + '">' + t('evidence.' + o.tag) + '</span>' : '') + '</div>' + help + input + '<div class="under">' + (err ? '<p class="err" id="' + id + '-err">⚠ ' + err + '</p>' : '<span></span>') + '<span class="count" id="' + id + '-count">' + t('evidence.limit_count', { n: v.length, max: max }) + '</span></div>' + (o.guide ? '<button type="button" class="link" data-guide="' + k + '"' + (v ? ' disabled' : '') + '>' + t('evidence.guide.use') + '</button><span class="muted small"> ' + t('evidence.guide.note') + '</span>' : '') + '</div>'
  }
  function examples() {
    return '<details class="examples" data-faq="examples"' + (S.open.examples ? ' open' : '') + '><summary>' + t('evidence.examples.toggle') + '</summary><div class="two">' + ['ex1', 'ex2'].map(function (x) {
      return '<article class="card ex"><p class="badge badge--soon">' + t('evidence.examples.tag') + '</p><h3>' + t('evidence.' + x + '.name') + '</h3><dl>' + [['evidence.field_title', 'title'], ['evidence.situation', 'situation'], ['evidence.responsibility', 'responsibility'], ['evidence.actions', 'action'], ['evidence.delivered', 'delivered'], ['evidence.observedEffect', 'effect']].map(function (p) { return '<dt>' + t(p[0]) + '</dt><dd>' + t('evidence.' + x + '.' + p[1]) + '</dd>' }).join('') + '</dl></article>'
    }).join('') + '</div></details>'
  }
  function formView() {
    var d = S.draft, m = missing()
    var summary = S.errors.length ? '<div class="alert" role="alert" tabindex="-1" id="summary"><h2>' + t('evidence.invalid') + '</h2><ul>' + S.errors.map(function (e) { return '<li><a href="#' + (e.k === 'actions' ? 'actions-0' : e.k === 'observedEffect' ? 'eff-known' : e.k) + '" data-focus="' + (e.k === 'actions' ? 'actions-0' : e.k === 'observedEffect' ? 'eff-known' : e.k) + '">' + (e.k === 'draft' ? t(e.msg) : t(NAME[e.k]) + ': ' + t(e.msg)) + '</a></li>' }).join('') + '</ul></div>' : ''
    var banner = S.state === 'error' ? '<div class="alert" role="alert"><p><b>' + t('evidence.error') + '</b> ' + t('evidence.uncertain_write') + '</p><button class="btn" data-act="retry">' + t('evidence.retry') + '</button></div>' : S.state === 'borrador' ? '<div class="ok" role="status"><b>✓ ' + t('evidence.draft_saved') + '</b></div>' : ''
    var actions = d.actions.map(function (a, i) { return field('actions', { i: i, label: t('evidence.actions') + ' ' + (i + 1), help: i === 0 ? 'evidence.help.actions' : null, rows: 2, sr: true }) + (d.actions.length > 1 ? '<button type="button" class="link" data-rm="' + i + '">' + t('evidence.remove_action') + ' ' + (i + 1) + '</button>' : '') }).join('')
    var eff = errorOf('observedEffect')
    var effect = '<fieldset class="field" aria-describedby="eff-help"><legend>' + t('evidence.observedEffect') + ' <span class="req req--required">' + t('evidence.required') + '</span></legend><p class="help" id="eff-help">' + t('evidence.help.effect') + '</p><div class="choice">' + ['known', 'unknown'].map(function (v) { return '<label><input type="radio" name="eff" id="eff-' + v + '" data-eff="' + v + '"' + (d.effect === v ? ' checked' : '') + '> ' + t('evidence.' + v) + '</label>' }).join('') + '</div>' + (d.effect === 'known' ? field('effectText', { label: t('evidence.effect_text'), rows: 2 }) : '') + (eff ? '<p class="err">⚠ ' + eff + '</p>' : '') + '</fieldset>'
    var more = '<details class="more" data-faq="more"' + (S.open.more ? ' open' : '') + '><summary>' + t('evidence.section.more') + '</summary>' + field('goal', { label: t('evidence.goal'), tag: 'optional', help: 'evidence.help.goal', rows: 2 }) + field('learning', { label: t('evidence.learning'), tag: 'optional', rows: 2 }) +
      '<div class="field"><div class="lab"><span class="lbl">' + t('evidence.alternatives') + '</span><span class="req req--optional">' + t('evidence.optional') + '</span></div>' + d.alternatives.map(function (a, i) { return '<textarea aria-label="' + esc(t('evidence.alternatives') + ' ' + (i + 1)) + '" rows="2" maxlength="500" data-alt="' + i + '">' + esc(a) + '</textarea><button type="button" class="link" data-rmalt="' + i + '">' + t('evidence.remove_alternative') + ' ' + (i + 1) + '</button>' }).join('') + '<button type="button" class="link" data-act="addalt"' + (d.alternatives.length >= 5 ? ' disabled' : '') + '>+ ' + t('evidence.add_alternative') + '</button></div>' +
      '<div class="field"><label for="autonomy">' + t('evidence.autonomy') + '</label><p class="help">' + t('evidence.autonomy_help') + '</p><select id="autonomy" data-f="autonomy">' + ['', 'conceptual', 'assisted', 'autonomous', 'leads'].map(function (v) { return '<option value="' + v + '"' + (d.autonomy === v ? ' selected' : '') + '>' + t('evidence.' + (v || 'unset')) + '</option>' }).join('') + '</select></div>' +
      '<div class="field"><label for="sample">' + t('evidence.artifactRefs') + ' · ' + t('evidence.url') + '</label><p class="help">' + t('evidence.sample_help') + '</p><input id="sample" type="url" maxlength="500" data-f="sample" value="' + esc(d.sample) + '" placeholder="https://"></div></details>'
    var pend = m.length ? t('evidence.pending_list', { list: m.map(function (k) { return t(NAME[k]) }).join(', ') }) : t('evidence.pending_none')
    var saving = S.state === 'guardando'
    return banner + summary + examples() + '<form novalidate><section aria-labelledby="h-ess"><h2 id="h-ess">' + t('evidence.section.essential') + '</h2><p class="muted">' + t('evidence.section.essential_help') + '</p>' +
      field('title', { label: t('evidence.field_title'), tag: 'required', help: 'evidence.help.title', ph: 'evidence.ph.title', line: true }) + field('situation', { label: t('evidence.situation'), tag: 'required', help: 'evidence.help.situation', guide: true }) + field('responsibility', { label: t('evidence.responsibility'), tag: 'required', help: 'evidence.help.responsibility', rows: 2 }) +
      '<fieldset class="field plain"><legend>' + t('evidence.actions') + ' <span class="req req--required">' + t('evidence.required') + '</span></legend>' + actions + '<button type="button" class="link" data-act="addaction"' + (d.actions.length >= 8 ? ' disabled' : '') + '>+ ' + t('evidence.add_action') + '</button></fieldset>' +
      field('delivered', { label: t('evidence.delivered'), tag: 'required', help: 'evidence.help.delivered', guide: true }) + effect + '</section>' + more +
      '<div class="actionbar"><p class="pending" id="pending" aria-live="polite">' + pend + '</p><div class="row"><button type="button" class="btn btn--ghost" data-act="draft"' + (saving ? ' disabled' : '') + '>' + t('evidence.save') + '</button><button type="button" class="btn btn--mark" data-act="review"' + (saving ? ' disabled' : '') + '>' + t('evidence.review') + '</button></div>' + (saving ? '<p role="status" class="spin">' + t('evidence.saving') + '</p>' : '') + '</div></form>'
  }
  function reviewView() {
    var d = S.draft, rows = [['evidence.field_title', d.title], ['evidence.situation', d.situation], ['evidence.responsibility', d.responsibility], ['evidence.actions', d.actions.filter(Boolean).join('\n')], ['evidence.delivered', d.delivered], ['evidence.observedEffect', d.effect === 'known' ? d.effectText : t('evidence.unknown')]].concat(d.goal ? [['evidence.goal', d.goal]] : []).concat(d.learning ? [['evidence.learning', d.learning]] : [])
    return '<div class="alert alert--info"><p>' + t('evidence.warning') + '</p></div><div class="card"><dl class="review">' + rows.map(function (r) { return '<dt>' + t(r[0]) + '</dt><dd>' + esc(r[1]).replace(/\n/g, '<br>') + '</dd>' }).join('') + '</dl></div><label class="check"><input type="checkbox" data-reviewed' + (S.reviewed ? ' checked' : '') + '> ' + t('evidence.reviewed') + '</label><div class="row"><button class="btn btn--ghost" data-act="back">' + t('evidence.edit') + '</button><button class="btn btn--mark" data-act="confirm"' + (S.reviewed ? '' : ' disabled') + '>' + t('evidence.confirm') + '</button></div>'
  }
  function evidencia() {
    var body = S.state === 'revisar' ? reviewView() : S.state === 'exito' ? '<div class="done" role="status"><h2 tabindex="-1" id="done">✓ ' + t('evidence.confirmed_saved') + '</h2><p>' + t('evidence.intro') + '</p><div class="row"><button class="btn" data-act="reset">' + t('evidence.list') + '</button></div></div>' : formView()
    var side = '<aside class="side" aria-label="nav"><p class="small muted">' + (S.lang === 'es' ? 'Navegación actual (sin cambios en ES-408)' : 'Current navigation (unchanged in ES-408)') + '</p>' + ['Mi panel', 'Conversación', 'Diario', 'Mapa', 'Evidencias', 'Siguiente paso'].map(function (x, i) { var en = ['Dashboard', 'Conversation', 'Journal', 'Map', 'Evidence', 'Next step'][i]; return '<span class="sitem' + (i === 4 ? ' on' : '') + '">' + (S.lang === 'es' ? x : en) + '</span>' }).join('') + '</aside>'
    var head = '<header class="pagehead"><h1>' + t('evidence.new') + '</h1><p class="lead">' + t('evidence.lead_help') + '</p><p class="muted">' + t('evidence.privacy') + ' ' + t('evidence.no_secrets') + '</p></header>'
    return frame('', '', '<div class="appgrid">' + side + '<div class="formcol">' + head + body + '</div></div>', '<span>' + t('landing.not.1') + '</span>')
  }

  function frame(nav, end, main, foot) {
    return '<header class="hd"><div class="wrap"><a class="brand" href="#" data-noop aria-label="Elevation">Elevation<i>.</i></a>' + nav + '<div class="end"><div class="seg" role="group" aria-label="' + t('landing.header.language') + '"><button data-lang="es" aria-pressed="' + (S.lang === 'es') + '">ES</button><button data-lang="en" aria-pressed="' + (S.lang === 'en') + '">EN</button></div>' + end + '</div></div></header><main id="main" tabindex="-1" class="wrap">' + main + '</main><footer class="ft"><div class="wrap">' + foot + '</div></footer>'
  }
  function bar() {
    var es = S.lang === 'es'
    function seg(label, key, opts) { return '<span class="ctl"><span>' + label + '</span><span class="seg" role="group" aria-label="' + label + '">' + opts.map(function (o) { return '<button data-set="' + key + ':' + o[0] + '" aria-pressed="' + (S[key] === o[0]) + '">' + o[1] + '</button>' }).join('') + '</span></span>' }
    var common = seg(es ? 'Pantalla' : 'Screen', 'view', [['registro', es ? 'Registro (18+)' : 'Sign-up (18+)'], ['invitacion', es ? 'Invitación' : 'Invitation'], ['portada', es ? 'Portada' : 'Home'], ['evidencia', es ? 'Nueva evidencia' : 'New evidence']]) + seg(es ? 'Tema' : 'Theme', 'theme', [['auto', 'Auto'], ['light', es ? 'Claro' : 'Light'], ['dark', es ? 'Oscuro' : 'Dark']])
    var isReg = S.view === 'registro' || S.view === 'invitacion'
    var extra = isReg ? seg(es ? 'Estado' : 'State', 'regState', [['vacio', es ? 'Vacío' : 'Empty'], ['sinedad', es ? 'Sin la casilla 18+' : '18+ unticked'], ['errores', es ? 'Todo vacío' : 'All empty'], ['rechazo', es ? 'Rechazo servidor' : 'Server rejects'], ['enviando', es ? 'Enviando' : 'Sending'], ['exito', es ? 'Éxito' : 'Success'], ['existente', es ? 'Cuentas existentes' : 'Existing accounts']]) : S.view === 'portada' ? seg(es ? 'Rutas en el piloto' : 'Routes in pilot', 'routes', [['in', es ? 'Sí' : 'Yes'], ['out', 'No']]) + seg(es ? 'Promesa (pendiente)' : 'Promise (pending)', 'promise', [['p1', 'P1'], ['p2', 'P2'], ['p3', 'P3']]) + seg(es ? 'Público (pendiente)' : 'Audience (pending)', 'audience', [['a1', 'A1'], ['a2', 'A2'], ['a3', 'A3']])
      : seg(es ? 'Estado' : 'State', 'state', [['vacio', es ? 'Vacío' : 'Empty'], ['errores', es ? 'Errores' : 'Errors'], ['guardando', es ? 'Guardando' : 'Saving'], ['error', es ? 'Falla' : 'Save fail'], ['borrador', es ? 'Borrador' : 'Draft'], ['revisar', es ? 'Revisar' : 'Review'], ['exito', es ? 'Éxito' : 'Success']])
    return '<div class="wrap"><b>ES-408 · ' + (es ? 'diseño, no es producto' : 'design, not product') + '</b>' + common + extra + '</div>'
  }
  var SAMPLE = function () { return { title: t('evidence.ex1.title'), situation: t('evidence.ex1.situation'), responsibility: t('evidence.ex1.responsibility'), actions: [t('evidence.ex1.action')], delivered: t('evidence.ex1.delivered'), effect: 'unknown', effectText: '', goal: '', alternatives: [], learning: '', autonomy: '', sample: '' } }
  function applyState(s) {
    S.errors = []; S.reviewed = false
    if (s === 'vacio') S.draft = blank()
    if (s === 'errores') { S.draft = blank(); S.draft.title = t('evidence.ex1.title'); S.errors = REQUIRED.map(function (k) { return { k: k, msg: 'evidence.err.required' } }) }
    if (s === 'guardando' || s === 'error' || s === 'borrador' || s === 'revisar' || s === 'exito') S.draft = SAMPLE()
  }
  function applyReg(s) {
    var A = window.ES408Access; S.regState = s; S.regErrors = {}
    S.reg = s === 'vacio' || s === 'errores' ? A.blank() : A.filled()
    if (s === 'sinedad') { S.reg.adult = false; A.validate(S) }
    if (s === 'errores') A.validate(S)
    if (s === 'rechazo') S.regErrors = { adult: 'version' }
  }
  function render(focus) {
    var y = window.scrollY, act = document.activeElement && document.activeElement.id
    if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', S.theme)
    document.documentElement.lang = S.lang
    document.title = t('html.title') + ' · ES-408'
    $('#bar').innerHTML = bar(); $('#app').innerHTML = S.view === 'portada' ? portada() : S.view === 'evidencia' ? evidencia() : frame('', '', window.ES408Access(S, t, esc), '<span>' + t('landing.not.1') + '</span>')
    window.scrollTo(0, y)
    var el = focus ? $(focus) : (act ? document.getElementById(act) : null)
    if (el) el.focus({ preventScroll: !focus })
  }
  function check(status) {
    var d = S.draft, errs = []
    if (status === 'draft') {
      var other = ['situation', 'responsibility', 'delivered', 'goal', 'learning'].some(function (k) { return d[k].trim() }) || d.actions.some(function (a) { return a.trim() }) || d.effect
      if (!d.title.trim() || !other) errs.push({ k: d.title.trim() ? 'situation' : 'title', msg: 'evidence.draft_minimum' })
    } else {
      missing().forEach(function (k) { errs.push({ k: k, msg: 'evidence.err.required' }) })
      if (d.situation && guideLeft(d.situation, 'evidence.guide.situation')) errs.push({ k: 'situation', msg: 'evidence.err.guide' })
      if (d.delivered && guideLeft(d.delivered, 'evidence.guide.delivered')) errs.push({ k: 'delivered', msg: 'evidence.err.guide' })
    }
    S.errors = errs; return !errs.length
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-set],[data-lang],[data-go],[data-hint],[data-act],[data-guide],[data-rm],[data-rmalt],[data-focus],[data-noop]'); if (!el) return
    var ds = el.dataset
    if (ds.set) { var p = ds.set.split(':'); S[p[0]] = p[1]; if (p[0] === 'state') applyState(p[1]); if (p[0] === 'view') { window.scrollTo(0, 0); S.state = 'vacio'; applyState('vacio'); applyReg('vacio') } if (p[0] === 'regState') applyReg(p[1]); render(); return }
    if (ds.lang) { S.lang = ds.lang; try { localStorage.setItem('es408_lang', S.lang) } catch (x) {} if (S.view === 'evidencia' && S.state !== 'vacio') applyState(S.state); render(); return }
    if (ds.go) { e.preventDefault(); var s = document.getElementById(ds.go); if (s) { s.setAttribute('tabindex', '-1'); s.scrollIntoView({ block: 'start' }); s.focus({ preventScroll: true }) } return }
    if (ds.focus) { e.preventDefault(); var f = document.getElementById(ds.focus); f && f.focus(); return }
    if (el.hasAttribute('data-noop')) { e.preventDefault(); return }
    if (ds.hint) { S.hint = ds.hint === 'show' ? 'show' : ds.hint; render(); return }
    if (ds.guide) { if (!S.draft[ds.guide]) S.draft[ds.guide] = t('evidence.guide.' + ds.guide); render('#' + ds.guide); return }
    if (ds.rm != null) { S.draft.actions.splice(+ds.rm, 1); render('#actions-0'); return }
    if (ds.rmalt != null) { S.draft.alternatives.splice(+ds.rmalt, 1); render(); return }
    var a = ds.act
    if (a === 'addaction') { S.draft.actions.push(''); render('#actions-' + (S.draft.actions.length - 1)) }
    else if (a === 'addalt') { S.draft.alternatives.push(''); render() }
    else if (a === 'draft' || a === 'retry') { if (a === 'retry' || check('draft')) { S.state = 'guardando'; render(); setTimeout(function () { if (S.state === 'guardando') { S.state = 'borrador'; render() } }, 1200) } else { S.state = 'errores'; render('#summary') } }
    else if (a === 'review') { if (check('confirmed')) { S.state = 'revisar'; window.scrollTo(0, 0); render() } else { S.state = 'errores'; if (S.errors.some(function (x) { return x.k === 'goal' })) S.open.more = true; render('#summary') } }
    else if (a === 'back') { S.state = 'vacio'; render('#title') }
    else if (a === 'confirm') { S.state = 'exito'; window.scrollTo(0, 0); render('#done') }
    else if (a === 'reset') { S.state = 'vacio'; applyState('vacio'); render('#title') }
  })
  document.addEventListener('input', function (e) {
    var el = e.target, d = S.draft
    if (el.dataset.f) { if (el.dataset.i != null) d.actions[+el.dataset.i] = el.value; else d[el.dataset.f] = el.value; var c = document.getElementById(el.id + '-count'); c && (c.textContent = t('evidence.limit_count', { n: el.value.length, max: el.maxLength })); var g = document.querySelector('[data-guide="' + el.dataset.f + '"]'); if (g) g.disabled = !!el.value }
    if (el.dataset.alt != null) d.alternatives[+el.dataset.alt] = el.value
    var p = $('#pending'); if (p) { var m = missing(); p.textContent = m.length ? t('evidence.pending_list', { list: m.map(function (k) { return t(NAME[k]) }).join(', ') }) : t('evidence.pending_none') }
  })
  document.addEventListener('change', function (e) {
    if (e.target.dataset.eff) { S.draft.effect = e.target.dataset.eff; render('#eff-' + S.draft.effect) }
    if (e.target.hasAttribute('data-reviewed')) { S.reviewed = e.target.checked; render(); var b = document.querySelector('[data-reviewed]'); b && b.focus() }
  })
  document.addEventListener('toggle', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-faq'); if (k) S.open[k] = e.target.open }, true)
  document.addEventListener('submit', function (e) {
    e.preventDefault()
    if (!e.target.hasAttribute('data-regform')) return
    var first = window.ES408Access.validate(S)
    if (first) { S.regState = 'errores'; render(first); return }
    S.regState = 'enviando'; render(); setTimeout(function () { if (S.regState === 'enviando') { S.regState = 'exito'; render('#done') } }, 1200)
  })
  document.addEventListener('input', function (e) { var k = e.target.getAttribute('data-rf'); if (k) S.reg[k] = e.target.value })
  document.addEventListener('change', function (e) { var k = e.target.getAttribute('data-rc'); if (k) { S.reg[k] = e.target.checked; if (e.target.checked && S.regErrors[k]) { delete S.regErrors[k]; render('#access-' + k) } } })
  document.addEventListener('click', function (e) { var el = e.target.closest('[data-reg]'); if (el) { applyReg(el.getAttribute('data-reg')); render() } })
  render()
})()
