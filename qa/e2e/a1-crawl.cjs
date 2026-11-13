// [QA-Claude] ES-40 fase A1 (0 tokens de IA): recorrido de TODAS las rutas por rol, idioma y tamaño. Registra errores de página, consola, peticiones fallidas, desborde, texto mezclado, voseo y claves i18n visibles.
const L = require('./lib.cjs'); const { chromium, API, SHOTS, rec, savResults, VOSEO, ES_LEAK, injectSession, fs, path } = L;
const PUBLIC = ['/', '/login', '/login?mode=register', '/pricing', '/profesionales'];
const PERSONA = ['/app/dashboard', '/app/chat', '/app/checkin', '/app/progress', '/app/diary', '/app/diary/new', '/app/space/tools', '/app/exercises', '/app/compass', '/app/bridge', '/app/evidence', '/app/evidence/new', '/app/evidence/resume-skills', '/app/context/resumes', '/app/skill-map', '/app/route-catalog', '/app/next-step', '/app/next-step/experiments', '/app/next-step/plan', '/app/my-therapist', '/app/feedback', '/app/onboarding', '/app/professional-reviews', '/facilitation'];
const ADMIN = ['/admin/dashboard', '/admin/prompts', '/admin/content', '/admin/users', '/admin/metrics', '/admin/route-catalog', '/admin/skill-catalog', '/admin/pilot-metrics', '/admin/manifest'];
const THERAPIST = ['/therapist/dashboard'];
const VPS = [[1920, 1080], [1440, 900], [768, 1024], [390, 844], [320, 568]];
(async () => {
  const b = await chromium.launch(); const sess = {};
  const P = await L.newPersona('crawl'); sess.persona = await L.login(P); const A = L.cfg.cuentas.ADM, T = L.cfg.cuentas.T1; sess.admin = await L.login(A); sess.therapist = await L.login(T);
  rec('A1-0 sesiones sintéticas de persona, admin y terapeuta creadas por API', !!sess.persona && !!sess.admin && !!sess.therapist, `persona=${!!sess.persona} admin=${sess.admin?.role} terapeuta=${sess.therapist?.role}`);
  const groups = [['publico', null, PUBLIC], ['persona', sess.persona, PERSONA], ['admin', sess.admin, ADMIN], ['terapeuta', sess.therapist, THERAPIST]];
  const agg = { paginas: 0, conProblema: 0 };
  for (const [gname, s, routes] of groups) for (const lang of ['es', 'en']) for (const [w, h] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); await injectSession(ctx, s, lang);
    for (const route of routes) {
      const p = await ctx.newPage(); const errs = [], bad = [], cons = []; p.on('pageerror', e => errs.push(String(e).slice(0, 100))); p.on('console', m => { if (m.type() === 'error') cons.push(m.text().slice(0, 100)); }); p.on('response', r => { const u = r.url(); if (u.includes('/api/') && r.status() >= 400) bad.push(r.status() + ' ' + u.replace(API, '').split('?')[0]); });
      try { await p.goto(API + route, { waitUntil: 'networkidle', timeout: 30000 }); } catch (e) { errs.push('goto: ' + String(e).slice(0, 80)); }
      await p.waitForTimeout(700); const eb = p.getByRole('button', { name: lang.toUpperCase(), exact: true }).first(); if (await eb.count()) { await eb.click().catch(() => {}); await p.waitForTimeout(400); }
      const url = new URL(p.url()); const text = (await p.innerText('body').catch(() => '')) || ''; const sw = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1).catch(() => false);
      const issues = []; if (errs.length) issues.push('pageerror ' + errs[0]); if (sw) issues.push('desborde horizontal'); if (text.trim().length < 15) issues.push('página casi vacía'); const vm = lang === 'es' ? VOSEO.exec(text) : null; if (vm) issues.push('voseo «' + vm[0] + '»'); const em = lang === 'en' ? ES_LEAK.exec(text) : null; if (em) issues.push('texto en español en EN «' + em[0] + '»'); const km = /\b[a-z]{2,}_[a-z0-9_]{2,}\b/.exec(text.replace(/https?:\S+/g, '')); if (km && !/@/.test(km[0])) issues.push('posible clave i18n «' + km[0] + '»'); const unexpected = bad.filter(x => !/^40[13] /.test(x)); if (unexpected.length) issues.push('API ' + unexpected.slice(0, 3).join(', '));
      const redirected = url.pathname !== route.split('?')[0]; agg.paginas++; if (issues.length) agg.conProblema++;
      rec(`A1 ${gname} ${lang} ${w}x${h} ${route}${redirected ? ' → ' + url.pathname : ''}`, issues.length === 0, issues.join(' | ') || `ok${bad.length ? ' (API 401/403 esperadas: ' + bad.length + ')' : ''}`);
      if ((w === 1440 || w === 390) && gname !== 'publico' || (w === 1440 || w === 390) && gname === 'publico') { const f = path.join(SHOTS, 'a1-crawl', gname, lang); fs.mkdirSync(f, { recursive: true }); await p.screenshot({ path: path.join(f, `${route.replace(/[\/?=]/g, '_') || '_'}-${w}.png`), fullPage: true }).catch(() => {}); }
      await p.close();
    }
    await ctx.close();
  }
  console.log('RESUMEN-A1 ' + JSON.stringify(agg)); savResults('a1-crawl'); await b.close();
})().catch(e => { console.log('ERROR ' + String(e).slice(0, 300)); process.exit(1); });
