import fs from 'node:fs';
const { parseDeclared } = await import('file:///' + process.env.QA_TOOLS + '/qa5/pr390/frontend/src/evidence/resumeSkills.ts');
const after = JSON.parse(fs.readFileSync('resume-skills-after.json','utf8')), before = JSON.parse(fs.readFileSync('resume-skills-before.json','utf8'));
const t = (n, v) => { try { const r = parseDeclared(v); console.log('OK   ', n, '→', r.length, 'habilidades'); } catch (e) { console.log('RECHAZA', n, e.message); } };
t('antes (con orphaned: [])', before); t('después (con orphaned lleno)', after);
const { orphaned, ...sin } = after; t('sin campo orphaned (respuesta antigua)', sin);
t('orphaned mal formado (string)', { ...after, orphaned: 'x' }); t('orphaned mal formado (objetos raros)', { ...after, orphaned: [null, 1, { name: 5 }] });
t('orphaned DENTRO de skills (lo que se evitó)', { skills: [...after.skills, ...orphaned] });
