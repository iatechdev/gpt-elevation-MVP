// ES-148 · Genera docs/ux/TEXTOS-FINALES-ES-EN.md desde docs/ux/diseno-final/copy.js (fuente única del prototipo).
// Uso: node scripts/generar-textos.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'ux')
const ctx = { window: {} }
vm.runInNewContext(readFileSync(join(root, 'diseno-final', 'copy.js'), 'utf8'), ctx)
const rows = ctx.window.COPY_ROWS
const label = { repo: 'se conserva (ya existe)', landing: 'aprobado en landing', ajuste: 'se ajusta (existe)', nuevo: 'nuevo' }
const esc = (s) => s.replace(/\|/g, '\\|')
const count = { repo: 0, landing: 0, ajuste: 0, nuevo: 0 }
let md = `# Textos finales ES/EN · Elevation + Skill Map (ES-148)

> Generado desde \`docs/ux/diseno-final/copy.js\` (\`node e2e/scripts/generar-textos.mjs\`). No editar a mano: se cambia el .js y se regenera.
> **Estado: PROPUESTA** para la puerta de diseño. Nada se carga a \`frontend/src/i18n\` hasta que Mauricio o Alejo aprueben.

Reglas aplicadas: tuteo; frases cortas; producto **no clínico** (sin diagnóstico, sin prescripción, sin promesas de resultados ni de empleabilidad); privacidad visible; «Sin evaluar» como estado (nunca un déficit); sin cifras ni datos inventados (las cifras del prototipo están marcadas «de ejemplo» y no forman parte de los textos); ES y EN con el mismo sentido.

Columna **Origen**: *se conserva* = existe literal en \`frontend/\` o \`docs/landing\`; *aprobado en landing* = ya aprobado en ES-60/ES-66; *se ajusta* = existe y cambia; *nuevo* = no existía.
Los marcadores \`{n}\`, \`{date}\`, \`{pct}\`, \`{a}\`, \`{b}\` son variables que rellena la aplicación.

`
for (const r of rows) {
  if (r.length === 1) { md += `\n${r[0]}\n\n| Clave | ES | EN | Origen |\n|---|---|---|---|\n`; continue }
  count[r[3]]++
  md += `| \`${r[0]}\` | ${esc(r[1])} | ${esc(r[2])} | ${label[r[3]]} |\n`
}
md += `
## Resumen
Total: ${Object.values(count).reduce((a, b) => a + b, 0)} textos · se conservan ${count.repo + count.landing} · se ajustan ${count.ajuste} · nuevos ${count.nuevo}.

## Textos existentes que este diseño **retira o reemplaza** (hallazgos del informe)
| Hoy (frontend/src/i18n u otras pantallas) | Problema | Reemplazo |
|---|---|---|
| «Soporte emocional con IA», «Encuentra tu calma interior», «Tu compañero privado para la claridad mental y el bienestar emocional» (\`hero_*\`, legado) | Promesa de bienestar; contradice «no clínico» | Héroe aprobado: «Lo que has vivido cuenta.» |
| «Mis pacientes», «Historia del paciente», «Notas clínicas», «Resumen clínico IA», «Resumen de tu práctica clínica» (\`therapist_*\`) | Lenguaje clínico en un producto no clínico | «Personas que acompaño», «Contexto compartido»; las notas y el resumen requieren decisión del PO |
| «Mi prompt terapéutico» | «Terapéutico» | «Mi guía para la IA» |
| «Mejorando / Estable / Bajando» (tendencia de ánimo) | Interpreta el estado de la persona | A decidir con el PO: mostrar solo registros, sin etiquetar tendencia |
| «El Puente estará disponible cuando su flujo de autorización esté integrado» | Jerga de desarrollo | Se retira (el Puente ya abre) |
| «Consola de facilitación — La vista preliminar no está habilitada» | Pantalla interna visible a personas | No se muestra a personas |
| «Este recorrido aún no está disponible» / «Los ejercicios aún no están disponibles» | Callejón sin salida | «Estamos preparando esta parte» + una acción útil |
| «Credenciales incorrectas» | Seco y no orienta | «Correo o contraseña incorrectos. Revisa los datos…» |
| «Mood prom.», «Rating prom.», «Resetear contraseña», «Rollback», «Top terapeutas» | Anglicismos y jerga en administración | Pendiente de glosario de administración (fuera de este diseño) |

## Textos que requieren decisión o revisión antes de cargarlos
1. **\`notice.safety\`** (aviso de seguridad): es nuevo y delicado. Sin números de emergencia porque varían por país y no los verifiqué. Revisar con PO y con la guía Brújula (QA).
2. **\`land.cta.sub\`** («Sin tarjeta de crédito.»): ya existía; la oferta comercial de los planes **no está verificada** (ES-73 D-01), por eso la landing del piloto no publica planes ni «gratis».
3. **\`land.pilot\`** («Estamos en piloto con un grupo pequeño…»): afirmación pública sobre el estado del proyecto; confirmar con el PO.
4. **\`pro.*\` / \`th.*\`**: «profesional» en lugar de «terapeuta/paciente» es decisión de producto.
5. **\`nx.soon.body\`** menciona «plan a 7, 30 y 90 días»: figura en la landing aprobada; confirmar que sigue vigente.
6. **\`map.level\`** («Nivel N») y \`map.source.*\`: dependen de **ES-114** (A: solo estados y fuente; B: estados + nivel con evidencia). El prototipo muestra B; con A se retiran las casillas y «Nivel N».
7. Nombres de las 8 capacidades: salen del catálogo (staging) y se traducen allí, no aquí.
`
writeFileSync(join(root, 'TEXTOS-FINALES-ES-EN.md'), md)
console.log('TEXTOS-FINALES-ES-EN.md generado:', count)
