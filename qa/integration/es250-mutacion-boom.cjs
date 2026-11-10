// [QA-Claude] ES-250 · MUTACIÓN temporal (solo en mi clon): hace que un componente lance un error de código cuando window.<flag> está activo.
const fs = require('fs');
const root = 'C:/Users/Usuario/Documents/qa-pr-test/frontend/src/';
const targets = [['bridge/SourcesPanel.tsx', 'SourcesPanel', '__qaBoomSources'], ['skill-map/SkillViews.tsx', 'SkillDetail', '__qaBoomDetail'], ['skill-map/AiAnalysisPanel.tsx', 'AiAnalysisPanel', '__qaBoomAi'], ['bridge/BridgePage.tsx', 'BridgePage', '__qaBoomRoute']];
for (const [file, fn, flag] of targets) {
  let s = fs.readFileSync(root + file, 'utf8'); const start = s.indexOf(`export function ${fn}(`); if (start < 0) throw new Error('no ' + fn);
  let i = s.indexOf('(', start), depth = 0; for (; i < s.length; i++) { if (s[i] === '(') depth++; else if (s[i] === ')') { depth--; if (!depth) break; } }
  const body = s.indexOf('{', i); s = s.slice(0, body + 1) + `\n  if ((window as unknown as Record<string, unknown>).${flag}) throw new Error('qa-boom persona@example.invalid token=abc123')` + s.slice(body + 1);
  fs.writeFileSync(root + file, s); console.log('patched', fn);
}
