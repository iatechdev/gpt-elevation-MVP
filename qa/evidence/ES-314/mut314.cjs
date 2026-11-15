// [QA-Claude] Mutaciones ES-314 (PR #281 cabeza f60765df). Árbol: C:/Users/Usuario/Documents/qa-pr-test
const fs = require('fs'); const R = 'C:/Users/Usuario/Documents/qa-pr-test/frontend/src/'; const m = process.argv[2];
const edit = (file, a, b) => { const p = R + file; const s = fs.readFileSync(p, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 70)); fs.writeFileSync(p, s.replace(a, () => b)); };
const AL = 'progress/answerLabels.ts'; const Q = 'pages/admin/AdminUsersQueues.tsx'; const C = 'pages/progressCopy.ts';
const M = {
  M1: () => edit(AL, "anxiety: 'pr_a_anxiety', depression: 'pr_a_depression',", "depression: 'pr_a_depression',"), // quitar la entrada «anxiety» del mapa
  M2: () => edit(AL, "anxiety: 'pr_a_anxiety',", "anxiety: 'pr_a_anxietyX',"), // clave de texto inexistente
  M3: () => edit(C, ", pr_a_selfknowledge: 'Self-knowledge'", ''), // falta el texto EN de un valor nuevo
  M4: () => edit(AL, 'const text = t(key)', 'const text = key'), // devuelve la clave
  M5: () => edit(Q, "import '../progressCopy.ts'\n", ''), // la cola no registra el catálogo (carga en frío)
  M6: () => edit(Q, "{answerLabel('area', item.answers?.area, t)}", "{item.answers?.area ?? '—'}"), // vuelve la clave cruda del área
  M7: () => edit(AL, 'if (!key) return String(value)', "if (!key) return '—'"), // desconocido → raya
  M8: () => edit(AL, "structured: 'pr_s_structured'", "structured: 'pr_s_reflective'"), // etiqueta equivocada
  M9: () => edit(AL, "both: 'pr_l_both', ", ''), // falta «both»
  M10: () => edit(AL, "export const AREA_OPTIONS: [string, string][] = [['anxiety', 'pr_a_anxiety']", "export const AREA_OPTIONS: [string, string][] = [['Estrés y carga', 'pr_a_anxiety']"), // el cuestionario enviaría la etiqueta
};
if (!M[m]) throw new Error('mutación desconocida ' + m); M[m](); console.log('M apl ' + m);
