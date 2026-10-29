// Servidor simulado con datos SINTÉTICOS para revisar Skill Map y Compass sin backend (ES-37).
// Uso:  node scripts/mock-es37.mjs            (puerto 8099)
//       VITE_BACKEND_URL=http://localhost:8099 VITE_ENABLE_CAREER_PREVIEW=true npx vite
//       (los territorios de las 4 capacidades de ejemplo vienen del propio simulador, como los enviaría el catálogo)
//       y en el navegador: localStorage.setItem('elevation_token','sintetico')
// No hay datos reales ni secretos; cualquier token es válido.
import http from 'node:http'

const rubric = {
  levels: { 1: { es: 'Inicia', en: 'Starting' }, 2: { es: 'Practica con apoyo', en: 'Practices with support' }, 3: { es: 'Autónoma', en: 'Independent' }, 4: { es: 'Guía a otras personas', en: 'Guides others' } },
  source: 'Rúbrica sintética de prueba', verifiedAt: '2026-10-01T00:00:00Z',
}
const track = (o) => ({ level: null, state: 'initial', stale: false, catalogOutdated: false, confidence: 'low', confidenceReason: { es: 'Poca evidencia', en: 'Little evidence' }, evidenceCount: 0, authoring: 'person', rationale: null, needsReview: false, ...o })
const skills = [
  { skillKey: 'comunicacion', type: 'transversal', territories: ['com', 'dir'], labels: { es: 'Comunicación', en: 'Communication' }, rubric, state: 'reviewed',
    self: track({ level: 3, state: 'reviewed', evidenceCount: 2, confidence: 'medium' }), review: track({ level: 3, state: 'reviewed', evidenceCount: 1, confidence: 'high', authoring: 'ai_proposed', rationale: 'Texto sintético de justificación.' }) },
  { skillKey: 'datos', type: 'domain', territories: ['con', 'ing'], labels: { es: 'Análisis de datos', en: 'Data analysis' }, rubric, state: 'contradictory',
    self: track({ level: 4, state: 'contradictory', evidenceCount: 1, needsReview: true }), review: track({ level: 2, state: 'contradictory', evidenceCount: 2, needsReview: true, authoring: 'ai_proposed' }) },
  { skillKey: 'liderazgo', type: 'transversal', territories: ['dir', 'con'], labels: { es: 'Liderazgo', en: 'Leadership' }, rubric, state: 'stale',
    self: track({ level: 2, state: 'stale', stale: true, evidenceCount: 1 }), review: null },
  { skillKey: 'diseno', type: 'domain', territories: ['ing', 'inn'], labels: { es: 'Diseño de servicios', en: 'Service design' }, rubric, state: 'no_evidence', self: null, review: null },
]
const fields = [{ key: 'motivations', text: 'Me motiva aprender algo nuevo cada semana.' }, { key: 'constraints', text: 'Solo puedo dedicar las tardes.' }]
const version = { version: 1, status: 'active', approvedAt: '2026-10-20T10:00:00Z', revokedAt: null, fields, needsReview: false }
const context = { active: version, versions: [version] }
let bridge = 'granted' // GET/PUT /api/consents (solo professional_bridge); se reinicia al reiniciar el simulador

http.createServer((req, res) => {
  const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' }
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end() }
  const path = req.url.split('?')[0]
  if (path === '/api/skill-map') { res.writeHead(200, h); return res.end(JSON.stringify({ catalogVersion: 1, skills })) }
  if (path === '/api/career-context') { res.writeHead(200, h); return res.end(JSON.stringify(context)) }
  if (path === '/api/consents' && req.method === 'GET') { res.writeHead(200, h); return res.end(JSON.stringify({ consents: [{ purpose: 'professional_bridge', status: bridge }] })) }
  if (path === '/api/consents/professional_bridge' && req.method === 'PUT') {
    let body = ''; req.on('data', c => { body += c }); req.on('end', () => { try { bridge = JSON.parse(body).status === 'revoked' ? 'revoked' : 'granted'; res.writeHead(200, h); res.end(JSON.stringify({ purpose: 'professional_bridge', status: bridge })) } catch { res.writeHead(400, h); res.end('{}') } }); return
  }
  res.writeHead(404, h); res.end('{}')
}).listen(8099, '127.0.0.1', () => console.log('mock ES-37 en :8099'))
