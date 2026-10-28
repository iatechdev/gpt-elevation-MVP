// Local-only browser fixture server for the compiled landing. Never used by the application.
// Run from frontend: node test/support/es68-preview.mjs
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
  if (allowed.has(requested)) res.setHeader('Set-Cookie', `es68fixture=${requested}; SameSite=Strict; Path=/`)
  const scenario = req.headers.cookie?.match(/(?:^|; )es68fixture=(\w+)/)?.[1] || 'offline'
  res.setHeader('Cache-Control', 'no-store')
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname !== '/api/landing-content') { res.writeHead(404).end('{}'); return }
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es'
    let body = {}
    if (scenario === 'partial' || scenario === 'race') body = {
      'landing.problem.title': lang === 'es' ? 'Título editorial de prueba' : 'Synthetic editorial heading',
      'landing.modules.connection': lang === 'es' ? 'Conexión editorial de prueba' : 'Synthetic editorial connection',
      'landing.journey.6.body': lang === 'es' ? 'Último paso de prueba' : 'Synthetic last step',
    }
    if (scenario === 'long') body = {
      'landing.problem.title': 'SyntheticLongWord'.repeat(15),
      'landing.modules.elevation.body': '<img src=x onerror="alert(1)"> ' + 'Synthetic text '.repeat(160),
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
    res.end(await readFile(file))
  } catch { res.writeHead(404).end('Not found') }
})
server.listen(0, '127.0.0.1', () => console.log(`ES-68 local fixtures: http://127.0.0.1:${server.address().port}/?fixture=offline`))
