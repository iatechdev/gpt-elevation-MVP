// CLI de QA local: UI real, API simulada y datos sintéticos; nunca se importa en producto.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
const port = 43123
process.env.VITE_BACKEND_URL = `http://127.0.0.1:${port}`
const server = await createServer({ root, server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{
  name: 'es126-synthetic-preview',
  configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)) }
      if (url.pathname === '/__es126/start') {
        const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es'
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`<script>localStorage.clear();localStorage.setItem('elv_lang',${JSON.stringify(lang)});localStorage.setItem('elevation_token','synthetic-only');localStorage.setItem('elevation_role','user');location.replace('/app/progress')</script>`)
        return
      }
      if (!url.pathname.startsWith('/api/')) return next()
      if (url.pathname === '/api/session') return json(200, { role: 'user', onboardingCompleted: true })
      if (url.pathname === '/api/user/progress') return json(200, {
        stats: { totalSessions: 2, avgMood: 3, avgRating: 4, streak: 2 },
        moodLogs: [{ id: 1, date: '2026-10-31', checkin_mood: 3, checkout_mood: 4 }],
        ratings: [{ id: 1, date: '2026-10-31', rating: 4 }], recommendations: [],
      })
      return json(404, {})
    })
  },
}] })
await server.listen()
console.log(`ES-126 fixtures: http://127.0.0.1:${port}/__es126/start`)
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0) })
