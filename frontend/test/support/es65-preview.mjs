// Local-only browser fixture server for the compiled landing. Never used by the application.
// Run from frontend: node test/support/es65-preview.mjs
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
  if (allowed.has(requested)) res.setHeader('Set-Cookie', `es65fixture=${requested}; SameSite=Strict; Path=/`)
  const scenario = req.headers.cookie?.match(/(?:^|; )es65fixture=(\w+)/)?.[1] || 'offline'
  res.setHeader('Cache-Control', 'no-store')
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname !== '/api/landing-content') { res.writeHead(404).end('{}'); return }
    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es'
    let body = {}
    if (scenario === 'partial' || scenario === 'race') body = {
      'landing.closing.title': lang === 'es' ? 'Cierre de prueba' : 'Synthetic closing',
      'landing.footer.notice': lang === 'es' ? 'Aviso de prueba' : 'Synthetic notice',
    }
    if (scenario === 'long') body = {
      'landing.closing.title': 'SyntheticLongWord'.repeat(15),
      'landing.footer.notice': '<img src=x onerror="alert(1)"> ' + 'Synthetic text '.repeat(160),
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
    const file = url.pathname === '/privacy' ? resolve(root, 'privacy/index.html') : extname(path) ? path : resolve(root, 'index.html')
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream')
    let content = await readFile(file)
    if (url.searchParams.get('dark') === 'true' && file.endsWith('index.html') && url.pathname !== '/privacy') content = Buffer.from(content.toString().replace('</head>', '<script>const mm=window.matchMedia.bind(window);window.matchMedia=q=>q==="(prefers-color-scheme: dark)"?{matches:true,addEventListener(){},removeEventListener(){}}:mm(q)</script></head>'))
    res.end(content)
  } catch { res.writeHead(404).end('Not found') }
})
server.listen(0, '127.0.0.1', () => console.log(`ES-65 local fixtures: http://127.0.0.1:${server.address().port}/?fixture=offline`))
