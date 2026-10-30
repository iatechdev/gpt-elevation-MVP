import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const content = JSON.parse(readFileSync(new URL('../../shared/landing-content.json', import.meta.url)))
let lang = 'es'
let role = 'admin'
let status = 'anonymous'
const dictionary = {
  es: { logo: 'ELEVATION', btn_login: 'Entrar a mi espacio', login_subtitle: 'Un espacio solo para ti', link_login: 'Ya tengo cuenta', admin_nav_dashboard: 'Dashboard' },
  en: { logo: 'ELEVATION', btn_login: 'Enter my space', login_subtitle: 'A space just for you', link_login: 'I have an account', admin_nav_dashboard: 'Dashboard' },
}
// Real React/router rendering; only storage, language/content loading and session reads are doubles.
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const source = readFileSync(file, 'utf8').replaceAll('import.meta.env', '({ DEV: true })')
  const code = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText
  const localRequire = id => {
    if (id.endsWith('.css')) return {}
    if (id.includes('i18n/useLanguage')) return { useLanguage: () => ({ lang, setLang() {}, t: key => dictionary[lang][key] ?? key }) }
    if (id.endsWith('useSessionEntry')) return { useSessionEntry: () => ({ result: { status }, retry() {} }) }
    if (id.endsWith('useLandingContent')) return { useLandingContent: () => ({ text: key => content.find(row => row.key === key)?.[lang] ?? key }) }
    if (!id.startsWith('.')) return require(id)
    let target = resolve(dirname(file), id)
    if (!/\.tsx?$/.test(target)) target += '.ts'
    return load(target)
  }
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}
const { LoginPage } = load(resolve(root, 'pages/LoginPage.tsx'))
const { AdminSidebar } = load(resolve(root, 'components/AdminSidebar.tsx'))
const { AdminLayout } = load(resolve(root, 'layouts/AdminLayout.tsx'))
const render = (component, entry, props) => {
  const saved = globalThis.localStorage
  globalThis.localStorage = { getItem: key => key === 'elevation_role' ? role : 'Synthetic QA' }
  try { return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [entry] }, createElement(component, props))) }
  finally { if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved }
}

test('ES-38: login/register have visible associated labels and password autocomplete in ES and EN', () => {
  status = 'anonymous'
  for (lang of ['es', 'en']) {
    const signIn = render(LoginPage, '/login?plan=basic')
    assert.match(signIn, /for="access-email"/)
    assert.match(signIn, /for="access-password"/)
    assert.doesNotMatch(signIn, /id="access-name"/)
    assert.match(signIn, /autocomplete="current-password"/i)
    const register = render(LoginPage, '/login?mode=register&plan=basic')
    assert.match(register, /for="access-name"/)
    assert.match(register, /autocomplete="new-password"/i)
    assert.match(register, /aria-controls="access-password"/)
    assert.match(register, new RegExp(lang === 'es' ? 'Correo electrónico' : 'Email'))
  }
})

test('ES-38: pending session hides form; expired and unavailable sessions have distinct accessible states', () => {
  lang = 'es'
  status = 'checking'
  assert.doesNotMatch(render(LoginPage, '/login'), /<form/)
  status = 'invalid'
  const expired = render(LoginPage, '/login')
  assert.match(expired, /role="status"/)
  assert.match(expired, /<form/)
  status = 'unavailable'
  assert.match(render(LoginPage, '/login'), /role="alert"/)
  status = 'anonymous'
})

test('ES-38: admin and superadmin keep their distinct destinations; skill catalog is retained', () => {
  lang = 'es'
  for (role of ['admin', 'superadmin']) {
    const markup = render(AdminSidebar, '/admin/dashboard')
    for (const path of ['route-catalog', 'skill-catalog', 'dashboard', 'prompts', 'content', 'metrics']) assert.ok(markup.includes(`href="/admin/${path}"`))
    assert.equal(markup.includes('href="/admin/users"'), role === 'superadmin')
    assert.equal(markup.includes('href="/admin/manifest"'), role === 'superadmin')
    assert.match(markup, /aria-current="page"/)
  }
})

test('ES-38: shell provides skip target, named navigation, collapsed disclosure and bilingual logout', () => {
  role = 'admin'
  for (lang of ['es', 'en']) {
    const markup = render(AdminLayout, '/admin/dashboard')
    assert.match(markup, /href="#admin-main"/)
    assert.match(markup, /id="admin-main"[^>]*tabindex="-1"/)
    assert.match(markup, /aria-expanded="false" aria-controls="admin-navigation"/)
    assert.match(markup, new RegExp(lang === 'es' ? 'Cerrar sesión' : 'Log out'))
    assert.match(markup, /aria-pressed="true"/)
  }
})
