// CLI-only fixture UI. Never imported by the product or deployed server.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const port = 43124
process.env.VITE_BACKEND_URL = `http://127.0.0.1:${port}`
let mode = 'normal'
let syntheticRole = 'admin'
const server = await createServer({ root, server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{
  name: 'es127-local-fixtures',
  configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
      if (url.pathname === '/__es127/start') {
        const role = url.searchParams.get('role')
        syntheticRole = role === 'user' ? 'user' : role === 'superadmin' ? 'superadmin' : 'admin'
        mode = url.searchParams.get('mode') ?? 'normal'
        const hasSession = role === 'admin' || role === 'superadmin' || role === 'user' || role === 'invalid'
        const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es'
        const destination = role === 'user' ? '/app/my-therapist' : role === 'admin' || role === 'superadmin' ? '/admin/dashboard' : '/login'
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(`<script>localStorage.clear();localStorage.setItem('elv_lang',${JSON.stringify(lang)});${hasSession ? `localStorage.setItem('elevation_token','synthetic-fixture');localStorage.setItem('elevation_role',${JSON.stringify(syntheticRole)});localStorage.setItem('elevation_name','QA synthetic');` : ''}location.replace(${JSON.stringify(destination)})</script>`)
        return
      }
      if (!url.pathname.startsWith('/api/')) return next()
      if (url.pathname === '/api/login' || url.pathname === '/api/register') {
        // Deliberately no real credentials, database, providers or token signing.
        for await (const chunk of req) void chunk
        if (mode === 'saving') await new Promise(resolve => setTimeout(resolve, 2500))
        if (mode === 'error') return json(503, {})
        if (mode === 'locked') return json(423, { locked: true })
        if (url.pathname.endsWith('/register')) return json(201, {})
        return json(401, {})
      }
      if (url.pathname === '/api/session') {
        if (mode === 'checking') await new Promise(resolve => setTimeout(resolve, 6000))
        if (mode === 'unavailable') return json(503, {})
        if (mode === 'invalid') return json(401, {})
        return json(200, { role: syntheticRole, onboardingCompleted: true })
      }
      if (mode === 'error') return json(503, {})
      if (url.pathname === '/api/sessions/user/my-therapist') return json(200, {therapist:null,upcomingSessions:[],pastSessions:[]})
      if (url.pathname === '/api/admin/usuarios' || url.pathname.includes('/matching/pending') || url.pathname.includes('/plan-requests/admin') || url.pathname === '/api/junta/pending' || url.pathname === '/api/admin/pricing/all') return json(200, [])
      if (url.pathname === '/api/admin/metrics') return json(200, { totalUsers: 0, activeUsers: 0, totalTherapists: 0, totalSessions: 0, avgMood: null, avgRating: null, activeThisWeek: 0, sessionsByDay: [], topTherapists: [] })
      if (url.pathname.endsWith('/alerts')) return json(200, { pendingPrompts: 0, pendingPromptsList: [], therapistsWithoutProfile: 0, manifestoVersion: 'fixture', manifestoDate: null })
      if (url.pathname.includes('/content')) return json(200, {})
      return json(404, {})
    })
  },
}] })
await server.listen()
console.log(`ES-38 UI fixtures only: http://127.0.0.1:${port}/__es127/start`)
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0) })
