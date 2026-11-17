// Emite lo que pida FAKE_OUT (nombre de caso) como si fuera `npm audit --json`.
const adv = (id, sev, name) => ({ source: 1, name, dependency: name, title: 'aviso ' + name, url: 'https://github.com/advisories/' + id, severity: sev, range: '<=1' })
const base = () => ({
  fdir: { name: 'fdir', severity: 'high', via: ['picomatch'] },
  picomatch: { name: 'picomatch', severity: 'high', via: [adv('GHSA-fc5q-39xc-vjpf', 'high', 'picomatch')] },
  tinyglobby: { name: 'tinyglobby', severity: 'high', via: ['fdir', 'picomatch'] },
  vite: { name: 'vite', severity: 'high', via: ['picomatch', 'tinyglobby'] },
})
const j = (v) => console.log(JSON.stringify({ auditReportVersion: 2, vulnerabilities: v }))
const c = process.env.FAKE_OUT
const cases = {
  ok: () => j(base()),
  otro_alto: () => j({ ...base(), lodash: { name: 'lodash', severity: 'high', via: [adv('GHSA-aaaa-bbbb-cccc', 'high', 'lodash')] } }),
  otro_critico: () => j({ ...base(), lodash: { name: 'lodash', severity: 'critical', via: [adv('GHSA-aaaa-bbbb-cccc', 'critical', 'lodash')] } }),
  mismo_paquete_otro_ghsa: () => j({ picomatch: { name: 'picomatch', severity: 'high', via: [adv('GHSA-nuev-oooo-avis', 'high', 'picomatch')] } }),
  por_cadena: () => j({ ...base(), vite: { name: 'vite', severity: 'critical', via: ['picomatch', 'otro'] }, otro: { name: 'otro', severity: 'critical', via: [adv('GHSA-zzzz-yyyy-xxxx', 'critical', 'otro')] } }),
  origen_desconocido: () => j({ a: { name: 'a', severity: 'high', via: ['no-existe'] } }),
  moderada: () => j({ x: { name: 'x', severity: 'moderate', via: [adv('GHSA-mmmm-nnnn-oooo', 'moderate', 'x')] } }),
  limpio: () => j({}),
  texto: () => console.log('npm ERR! code ENOTFOUND'),
  vacio: () => {},
  objeto_vacio: () => console.log('{}'),
  arreglo: () => console.log('[]'),
  error: () => console.log(JSON.stringify({ error: { code: 'ENOLOCK', summary: 'sin lockfile' } })),
  null: () => console.log('null'),
  vuln_null: () => console.log(JSON.stringify({ vulnerabilities: null })),
  alta_sin_via: () => j({ a: { name: 'a', severity: 'high', via: [] } }),
  mezcla_permitida_y_otra_misma_cadena: () => j({ ...base(), picomatch: { name: 'picomatch', severity: 'high', via: [adv('GHSA-fc5q-39xc-vjpf', 'high', 'picomatch'), adv('GHSA-nuev-oooo-avis', 'high', 'picomatch')] } }),
}
if (!cases[c]) { console.error('caso desconocido ' + c); process.exit(9) }
cases[c]()
