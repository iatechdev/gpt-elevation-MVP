// ES-100 (ES100-QA-02/03/04): auditoría en navegador real de «Mi terapeuta» con datos sintéticos: objetivos táctiles, contraste del texto y desborde con un nombre largo.
//   npm run build && npx vite preview --port 4100 --host 127.0.0.1   y luego   PLAYWRIGHT_MODULE=... node scripts/es100-audit.cjs
const assert = require('node:assert/strict');
(async () => {
  const source = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = source ? require(source) : await import('playwright');
  const base = process.env.ES100_URL ?? 'http://127.0.0.1:4100';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const browser = await chromium.launch({ headless: true });
  const longName = 'Nombre'.repeat(9); // 54 caracteres sin espacios
  const soon = new Date(Date.now() + 5 * 60000).toISOString(); const later = new Date(Date.now() + 3 * 86400000).toISOString();
  const errors = []; const checks = [];
  const check = (label) => { checks.push(label); console.log('PASS ' + label); };

  async function open(width, lang, path = '/app/my-therapist', role = 'user', waitText = longName.slice(0, 12)) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l, r]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l); }, [lang, role]);
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/api/sessions/user/my-therapist') return route.fulfill({ json: { therapist: { id: 5, name: longName, email: 'terapeuta@example.invalid', profile: null }, upcomingSessions: [{ id: 1, scheduledAt: soon, duration: 50, meetingUrl: 'https://example.invalid/room', status: 'scheduled' }, { id: 2, scheduledAt: later, duration: 50, meetingUrl: null, status: 'scheduled' }], pastSessions: [{ id: 3, scheduledAt: '2026-10-01T15:00:00.000Z', patientMoodAfter: 4, status: 'completed' }] } });
      if (p === '/api/therapist/pacientes') return route.fulfill({ json: [
        { id: 1, name: longName, email: 'a@example.invalid', active: true, createdAt: '2026-09-01T00:00:00.000Z', sharing: true, totalSessions: 5, sessionsThisWeek: 1, avgRating: 4.5, moodTrend: 'up', trend: 'improving', lastMood: { checkin_mood: 3, checkout_mood: 4, date: '2026-10-28' } },
        { id: 2, name: 'Persona sin acceso', email: '', active: true, createdAt: '2026-09-02T00:00:00.000Z', sharing: false, totalSessions: 0, sessionsThisWeek: 0, avgRating: null, moodTrend: 'neutral', trend: null, lastMood: null }] });
      if (p === '/api/sessions/therapist/upcoming') return route.fulfill({ json: [{ id: 9, patientId: 1, scheduledAt: later, duration: 50, status: 'scheduled', patientName: longName }] });
      if (p === '/api/therapist/prompt') return route.fulfill({ json: { hasPrompt: false, content: null, active: null, pending: null, rejected: null } });
      if (p === '/api/therapist/alerts') return route.fulfill({ json: { inactivePatients: [], notableProgress: [] } });
      if (p === '/api/consents') return route.fulfill({ json: { consents: [{ purpose: 'therapist_sharing', status: 'granted', required: false }] } });
      return route.fulfill({ json: [] });
    });
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.getByText(waitText).first().waitFor({ timeout: 8000 });
    return { context, page };
  }
  const audit = (page) => page.evaluate(() => {
    const lum = (rgb) => { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return c.rgb; } return [255, 255, 255]; };
    const small = []; const lowContrast = [];
    for (const el of document.querySelectorAll('button, a[href], select, [role="switch"], input:not([type="hidden"])')) {
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      if (r.width < 44 || r.height < 44) small.push(`${(el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (const el of document.querySelectorAll('body *')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue;
      const bg = bgOf(el); const ratio = (Math.max(lum(fg.rgb), lum(bg)) + 0.05) / (Math.min(lum(fg.rgb), lum(bg)) + 0.05);
      const size = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight, 10) >= 700; const large = size >= 24 || (size >= 18.66 && bold);
      if (ratio < (large ? 3 : 4.5) && !el.disabled) lowContrast.push(`${el.innerText.trim().slice(0, 30)} ${ratio.toFixed(2)}`);
    }
    return { small, lowContrast, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });

  for (const [width, lang] of [[1100, 'es'], [375, 'es'], [320, 'es'], [375, 'en']]) {
    const { context, page } = await open(width, lang); const r = await audit(page);
    assert.deepEqual(r.small, [], `objetivos < 44 px a ${width} ${lang}: ` + r.small.join(' | '));
    assert.deepEqual(r.lowContrast, [], `contraste < 4,5:1 a ${width} ${lang}: ` + r.lowContrast.join(' | '));
    assert.ok(r.overflow <= 0, `desborda ${r.overflow}px a ${width} ${lang} con un nombre de 54 caracteres`);
    check(`Mi terapeuta ${width}px ${lang}: sin objetivos < 44 px, sin contraste < 4,5:1 y sin desborde con un nombre largo`);
    await context.close();
  }
  for (const [width, lang] of [[1100, 'es'], [375, 'es'], [320, 'es'], [320, 'en']]) {
    const { context, page } = await open(width, lang, '/therapist/dashboard', 'therapist', longName.slice(0, 12)); const r = await audit(page);
    assert.deepEqual(r.small, [], `panel: objetivos < 44 px a ${width} ${lang}: ` + r.small.join(' | '));
    assert.deepEqual(r.lowContrast, [], `panel: contraste < 4,5:1 a ${width} ${lang}: ` + r.lowContrast.join(' | '));
    assert.ok(r.overflow <= 0, `panel: desborda ${r.overflow}px a ${width} ${lang}`);
    check(`Panel del terapeuta ${width}px ${lang}: sin objetivos < 44 px, sin contraste < 4,5:1 y sin desborde con un nombre largo`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'errores de consola: ' + errors.join(' | ')); check('sin errores de consola');
  await browser.close(); console.log(`\n${checks.length} comprobaciones OK`);
})().catch((e) => { console.error('FAIL', e.message || e); process.exit(1); });
