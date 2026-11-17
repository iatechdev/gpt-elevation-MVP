// ES-331 (M-T14-1): «El Puente» no se desplaza cuando llegan los permisos de las fuentes. Mientras cargan se reserva el alto de la lista; el CLS real lo mide scripts/es331-bridge-cls.cjs en navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-331: el estado de carga de las fuentes va dentro de un contenedor que reserva el alto de la lista, con el mismo texto y role=status', () => {
  const panel = read('../src/bridge/SourcesPanel.tsx')
  assert.match(panel, /<div className="br-src-ph"><p role="status" aria-busy="true" className="cg-hint">\{c\.src_loading\}<\/p><\/div>/)
  assert.ok(panel.indexOf('br-src-ph') < panel.indexOf('{perms && <ul className="br-src-list">'), 'el contenedor va antes de la lista')
})

test('ES-331: el alto reservado cubre móvil, tablet y escritorio con rem (sigue el tamaño de letra) y no se reserva cuando la carga falla', () => {
  const css = read('../src/bridge/bridge.css')
  assert.match(css, /\.br-src-ph \{ min-height: 39rem; \}/)
  assert.match(css, /@media \(min-width: 640px\) \{ \.br-src-ph \{ min-height: 27\.5rem; \} \}/)
  assert.match(css, /@media \(min-width: 768px\) \{ \.br-src-ph \{ min-height: 34\.5rem; \} \}/)
  assert.match(css, /@media \(min-width: 1100px\) \{ \.br-src-ph \{ min-height: 27\.25rem; \} \}/)
  assert.match(read('../src/bridge/SourcesPanel.tsx'), /\{!perms && !loadError && <div className="br-src-ph">/) // con error de carga no hay hueco: se muestra el aviso con «Reintentar»
})
