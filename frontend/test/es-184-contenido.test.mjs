// ES-184: Contenido · Validaciones y Solicitudes en Cartografía. Comprobaciones de fuente y de catálogo; el recorrido en navegador está en scripts/es184-browser.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { adminText } from '../src/i18n/adminCopy.ts'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const content = read('../src/pages/admin/AdminContent.tsx')
const panel = read('../src/pages/admin/ProfessionalApplicationsPanel.tsx')
// Solo la parte de Validaciones y el marco: «Planes» y «Textos públicos» conservan su aspecto hasta tener ticket propio.
const own = content.slice(content.indexOf('// ── Componente principal'), content.indexOf('// ── Tab Precios'))

test('ES-184: el marco, las pestañas, Validaciones y Solicitudes usan Cartografía, sin estilos en línea, window.confirm ni emojis en botones', () => {
  for (const [name, source] of [['marco y Validaciones', own], ['Solicitudes', panel]]) {
    assert.doesNotMatch(source, /style=\{\{/, `${name}: sin estilos en línea`)
    assert.doesNotMatch(source, /window\.confirm|confirm\(/, `${name}: sin window.confirm`)
    assert.doesNotMatch(source, /[👁↻📄🎓📨✅]/u, `${name}: sin emojis`); assert.doesNotMatch(source, /<Button[^>]*>[^<]*[✓✗]/u, `${name}: sin símbolos en botones`)
    assert.doesNotMatch(source, /terapeuta/i, `${name}: «profesional», no «terapeuta»`)
  }
  assert.match(own, /<Tabs label=\{tr\('Secciones'\)\} tabs=\{\[/); assert.match(own, /id: 'validations'[\s\S]*id: 'applications'[\s\S]*id: 'pricing'[\s\S]*id: 'landing'/)
  assert.match(own, /<PricingTab \/>/); assert.match(own, /<LandingTab \/>/) // se montan tal cual
  assert.match(panel, /<Dialog/); assert.match(panel, /Crear cuenta de profesional/)
})

test('ES-184: el documento y la hoja de vida solo se abren con sesión y sin datos en la URL', () => {
  assert.match(own, /Authorization: `Bearer \$\{token\}`/); assert.match(own, /window\.open\(data\.url, '_blank', 'noopener,noreferrer'\)/)
  assert.doesNotMatch(panel, /window\.open|href=\{`\$\{API\}/); assert.match(panel, /createObjectURL/)
  assert.match(panel, /state=\{\{ newTherapist: \{ name: item\.name, email: item\.email \} \}\}/); assert.doesNotMatch(panel, /\?newTherapist|[?&]name=|[?&]email=/)
})

test('ES-184: rechazar exige el motivo y lo conserva; el diálogo sigue abierto si el servidor falla', () => {
  assert.match(own, /actionType === 'reject' && !note\.trim\(\)\) \{ setNoteError\('Escribe el motivo del rechazo\.'\)/)
  assert.match(own, /if \(!r\.ok\) \{ setDialogMsg\(data\.error \?\? 'Error\.'\); return \}/)
  assert.match(panel, /if \(action === 'reject' && !note\.trim\(\)\) \{ setNoteError\('Escribe el motivo del rechazo\.'\); return \}/)
  assert.match(panel, /r\.status === 409\) \{ closeReview\(\); setMsg\('Otra persona ya revisó esta solicitud\.'\)/)
})

test('ES-184: una solicitud depurada (ES-293) solo muestra estado y fecha, sin contacto, hoja de vida ni acciones', () => {
  const minimized = panel.slice(panel.indexOf('if (item.minimized)'), panel.indexOf('return {\n          id: String(item.id),\n          top: <div className="ac-row"><strong>{item.name}'))
  assert.match(minimized, /Datos depurados/); assert.match(minimized, /Recibida/)
  assert.doesNotMatch(minimized, /email|name|cv|Button|Link|country|profession/)
})

test('ES-184: el contador de pestañas sale del servidor y no se inventa; los textos nuevos existen en ES y EN', () => {
  assert.match(own, /return Array\.isArray\(data\) \? data\.length : null/); assert.match(own, /count === null \? tr\(label\)/)
  for (const key of ['Validaciones', 'Solicitudes', 'Planes', 'Textos públicos', 'Secciones', 'Datos depurados', 'Eliminar solicitud', 'Crear cuenta de profesional', 'Profesional aprobado y activado.', 'Queda activa en la plataforma y puede recibir personas.',
    'El motivo lo verá la persona.', 'Se eliminan la solicitud y su hoja de vida; no se puede deshacer. Libera cupo.', 'Solo superadministración puede revisar los documentos de validación.', 'No se pudieron cargar los documentos.', 'Tipo de documento', 'Archivo', 'Ver documento']) {
    const en = adminText(key, 'en'); assert.notEqual(en, key, `falta el inglés de «${key}»`); assert.doesNotMatch(en, /[áíóúñ¿¡«»]/i, key)
  }
  assert.equal(adminText('Datos depurados', 'en'), 'Data removed')
  assert.doesNotMatch(adminText('Llegan desde el formulario público. Aprobar no crea la cuenta: después usa «Crear cuenta de profesional». Abre las hojas de vida solo en un visor aislado; no se analizan contra virus.', 'en'), /therapist/i)
})
