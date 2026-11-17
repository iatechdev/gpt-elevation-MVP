const band = n => Math.floor(n / 5) * 5
const pr = (e, r, p) => (e >= 5 && r >= 5 && p > 0 && p < r) ? `R|${band(e)}|${band(r)}|${band(p)}` : 'S'
const mn = (e, r, p) => (e >= 5 && r >= 5) ? `R|${e}|${r}|${r - 0}|${p}` : 'S'
const acts = {
  'primera respuesta (pos)': (e, r, p) => r < e ? [e, r + 1, p + 1] : null,
  'primera respuesta (neg)': (e, r, p) => r < e ? [e, r + 1, p] : null,
  'cambiar de positiva a negativa': (e, r, p) => p >= 1 ? [e, r, p - 1] : null,
  'cambiar de negativa a positiva': (e, r, p) => r - p >= 1 ? [e, r, p + 1] : null,
  'retirar respuesta (pos)': (e, r, p) => p >= 1 ? [e, r - 1, p - 1] : null,
  'retirar respuesta (neg)': (e, r, p) => r - p >= 1 ? [e, r - 1, p] : null,
  'revocar permiso con respuesta (pos)': (e, r, p) => p >= 1 ? [e - 1, r - 1, p - 1] : null,
  'revocar permiso con respuesta (neg)': (e, r, p) => r - p >= 1 ? [e - 1, r - 1, p] : null,
  'revocar permiso sin respuesta': (e, r, p) => r < e ? [e - 1, r, p] : null,
}
const run = (Es) => { const out = {}; for (const [name, f] of Object.entries(acts)) { let tot = 0, vp = 0, vm = 0; for (const e of Es) for (let r = 0; r <= e; r++) for (let p = 0; p <= r; p++) { if (!(r >= 5 && e >= 5)) continue /* solo estados publicables/umbral */; const nx = f(e, r, p); if (!nx) continue; tot++; if (pr(e, r, p) !== pr(...nx)) vp++; if (mn(e, r, p) !== mn(...nx)) vm++ } out[name] = `${vp}/${tot} (${(100 * vp / tot).toFixed(0)} %) PR · ${vm}/${tot} (${(100 * vm / tot).toFixed(0)} %) main` } return out }
const show = (t, Es) => { console.log('== ' + t); for (const [k, v] of Object.entries(run(Es))) console.log('  ' + k + ': ' + v) }
show('piloto (6 elegibles)', [6]); show('E = 5..6', [5, 6]); show('E = 9, 10 (mi rejilla)', [9, 10]); show('E = 5..40', Array.from({ length: 36 }, (_, i) => i + 5)); show('E = 30..60 (cohorte grande)', Array.from({ length: 31 }, (_, i) => i + 30))
