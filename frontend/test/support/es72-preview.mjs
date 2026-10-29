// Local-only browser fixture server for the compiled landing. Never used by the application.
// Run from frontend: node test/support/es72-preview.mjs
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, sep, extname } from 'node:path'

const root = resolve(fileURLToPath(new URL('../../dist/', import.meta.url)))
const allowed = new Set(['offline', 'empty', 'partial', 'malformed', 'long', 'race'])
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  const requested = url.searchParams.get('fixture')
  if (allowed.has(requested)) res.setHeader('Set-Cookie', `es72fixture=${requested}; SameSite=Strict; Path=/`)
  const scenario = req.headers.cookie?.match(/(?:^|; )es72fixture=(\w+)/)?.[1] || 'offline'
  res.setHeader('Cache-Control', 'no-store')
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname !== '/api/landing-content') { res.writeHead(404).end('{}'); return }
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es'
    let body = {}
    if (scenario === 'partial' || scenario === 'race') body = {
      'landing.project.title': lang === 'es' ? 'Título editorial de prueba' : 'Synthetic editorial heading',
      'landing.project.state.body': lang === 'es' ? 'Conexión editorial de prueba' : 'Synthetic editorial connection',
      'landing.project.goals.1': lang === 'es' ? 'Objetivo de prueba' : 'Synthetic objective',
    }
    if (scenario === 'long') body = {
      'landing.project.title': 'SyntheticLongWord'.repeat(15),
      'landing.project.state.body': '<img src=x onerror="alert(1)"> ' + 'Synthetic text '.repeat(160),
    }
    const finish = () => {
      res.writeHead(scenario === 'offline' ? 503 : 200, { 'Content-Type': 'application/json' })
      res.end(scenario === 'malformed' ? '{invalid' : JSON.stringify(body))
    }
    if (scenario === 'race' && lang === 'es') setTimeout(finish, 2500)
    else finish()
    return
  }
  try {
    const path = resolve(root, '.' + decodeURIComponent(url.pathname))
    if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403).end(); return }
    const file = extname(path) ? path : resolve(root, 'index.html')
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream')
    let bytes = await readFile(file)
    // Test double for the OS color preference only. Actual LandingSurface/theme CSS still runs.
    // Does not change OS/browser settings and is never included in the production build.
    if (extname(file) === '.html' && url.searchParams.get('theme') === 'dark') {
      const script = `<script>const originalMatchMedia=window.matchMedia.bind(window);window.matchMedia=query=>query==='(prefers-color-scheme: dark)'?{matches:true,media:query,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return true}}:originalMatchMedia(query);</script>`
      bytes = bytes.toString().replace('</head>', script + '</head>')
    }
    res.end(bytes)
  } catch { res.writeHead(404).end('Not found') }
})
server.listen(0, '127.0.0.1', () => console.log(`ES-72 local fixtures: http://127.0.0.1:${server.address().port}/?fixture=offline`))
