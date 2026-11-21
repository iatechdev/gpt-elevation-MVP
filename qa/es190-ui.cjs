// QA-Claude-2 — ES-236 seguimiento (PR #190): los diálogos del Puente («Retirar todo» y el de autorizar el Diario/Chat) pasan al helper común. Casos que el refactor puede cambiar y que es184-ui.cjs no cubre:
// Esc y Tab MIENTRAS se guarda (botones deshabilitados), Esc que no cierra a medias, Esc con el foco fuera del botón, y que ninguna Esc llegue a la página. Backend REAL local (:8090) + `vite preview` (:5173). Datos sintéticos. 0 IA. Solo local.
// Env: PLAYWRIGHT_MODULE, BACKEND, DATABASE_URL, LABEL (main|pr).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const crypto = require('crypto'), { createRequire } = require('module'); const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = 'http://localhost:8090', UI = 'http://localhost:5173', LABEL = process.env.LABEL || 'pr'; let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + `[${LABEL}] ` + n, x) }; const info = (...a) => console.log('INFO', `[${LABEL}]`, ...a); const sleep = ms => new Promise(r => setTimeout(r, ms))
const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!', tag = Date.now().toString(36); let n = 0
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j } }
let DB = null; const dbq = async (q, a) => { if (!DB) { DB = new Client({ connectionString: process.env.DATABASE_URL }); await DB.connect() } return (await DB.query(q, a)).rows }
const mk = async () => { const email = `qa2-e190-${tag}-${++n}@example.test`; await call('POST', '/api/register', null, { name: 'QA2 e190 ' + n, email, password: PASS }); const id = (await dbq('SELECT id FROM "Users" WHERE email=$1', [email]))[0].id; await dbq('UPDATE "Users" SET "onboardingCompleted"=true WHERE id=$1', [id]); const tk = (await call('POST', '/api/login', null, { email, password: PASS })).j?.token; return { id, token: tk } }
const perm = (u, p, s) => call('PUT', '/api/consents/' + p, u.token, { status: s })
const granted = async (u, purpose) => (await dbq(`SELECT status FROM "Consents" WHERE "UserId"=$1 AND purpose=$2 ORDER BY id DESC LIMIT 1`, [u.id, purpose]))[0]?.status === 'granted'
const T = { es: { all: 'Retirar todo', cancel: 'Cancelar', yes: 'Sí, autorizar', done: 'Retiraste todo' }, en: { all: 'Withdraw everything', cancel: 'Cancel', yes: null, done: 'You withdrew everything' } }
const inside = p => p.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))
;(async () => {
  const b = await chromium.launch()
  for (const lang of ['es', 'en']) for (const w of [1360, 390]) { const t = T[lang], tg = `${lang}/${w}`
    const u = await mk(); await perm(u, 'professional_bridge', 'granted'); await perm(u, 'insights_diary', 'granted'); await perm(u, 'insights_chat', 'granted')
    const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, reducedMotion: 'reduce' }); await c.addInitScript(([tk, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [u.token, lang]); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message.slice(0, 120)))
    let urlChanges = 0; p.on('framenavigated', () => urlChanges++); await p.goto(UI + '/app/bridge', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.locator('.bridge-src').first().waitFor({ timeout: 20000 }); await sleep(700)
    // ===== «Retirar todo» con la petición en curso: Esc y Tab no rompen nada
    await p.route('**/api/consents/**', async r => { if (r.request().method() === 'GET') return r.continue(); await sleep(2500); return r.continue() })
    const btn = p.getByRole('button', { name: t.all, exact: true }); await btn.click(); const dlg = p.getByRole('dialog'); await dlg.waitFor(); await dlg.locator('button.bridge-ok').click(); await sleep(400)
    const busyBtns = await dlg.getByRole('button').evaluateAll(els => els.map(e => e.disabled)); info(`${tg}: durante «${t.all}» los botones del diálogo deshabilitados =`, JSON.stringify(busyBtns))
    const nav0 = urlChanges; await p.keyboard.press('Escape'); await sleep(300); const stillOpen = (await dlg.count()) > 0
    const tabs = []; for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); tabs.push(await inside(p)) }
    ck(`${tg}: con la retirada en curso Esc NO cierra el diálogo a medias`, stillOpen, stillOpen ? '' : 'SE CERRÓ'); ck(`${tg}: con la retirada en curso Tab no saca el foco del diálogo`, tabs.every(Boolean) || !stillOpen, tabs.join(','))
    await dlg.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {}); await sleep(800); const stat = await Promise.all(['insights_chat', 'insights_diary'].map(x => granted(u, x))); ck(`${tg}: la retirada termina una sola vez: sin permisos concedidos y con el aviso «${t.done}»`, stat.every(s => !s) && (await p.locator('.bridge').innerText()).includes(t.done), JSON.stringify(stat))
    ck(`${tg}: el foco queda en un elemento de la página (no se pierde en <body>) y Esc no navega`, (await p.evaluate(() => document.activeElement?.tagName)) !== 'BODY' && urlChanges === nav0, `foco=${await p.evaluate(() => document.activeElement?.tagName)}`)
    await p.unroute('**/api/consents/**')
    // ===== diálogo del Diario: foco fuera del diálogo, Esc desde cualquier control, y que el cierre no autorice
    const sw = p.locator('[data-source="diary"]').first(); await sw.click(); const d2 = p.getByRole('dialog'); await d2.waitFor(); await p.evaluate(() => document.activeElement?.blur()); await p.keyboard.press('Tab'); ck(`${tg}: con el foco fuera, Tab vuelve DENTRO del diálogo del Diario`, await inside(p))
    await p.keyboard.press('Shift+Tab'); ck(`${tg}: Shift+Tab desde el primer control pasa al último y sigue dentro`, await inside(p)); await p.keyboard.press('Escape'); await sleep(300)
    ck(`${tg}: Esc en el diálogo del Diario cierra, NO autoriza y devuelve el foco al interruptor`, (await d2.count()) === 0 && !(await granted(u, 'insights_diary')) && (await p.evaluate(() => document.activeElement?.getAttribute('data-source'))) === 'diary')
    ck(`${tg}: sin errores de página`, p.errs.length === 0, p.errs.join('|')); await c.close() }
  await b.close(); console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 800)); process.exit(3) })
