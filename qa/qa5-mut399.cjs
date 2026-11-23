// Mutaciones de #399 sobre tools/qa5/pr399 (solo local). Uso: node qa5-mut399.cjs G2|G4|G5|...|H4
const fs = require('fs'); const R = (process.env.QA_TOOLS || '.') + '/qa5/pr399/frontend/src/'; const D = R + 'context/resume/'; const P = D + 'ResumeUpdatePage.tsx'; const L = D + 'resumeUpdateLogic.ts'
const muts = {
  G2: [P, s => s.replace("expectedVersion: snapshot.version, action: 'save_draft'", "expectedVersion: 0, action: 'save_draft'")],
  G4: [P, s => s.replace("if (outcome === 'conflict') { setConflict(true); setNotice('context_conflict') }", "if (outcome === 'conflict') { setNotice('') }")],
  G5: [L, s => s.replace("export const sameSkills = (a: DeclaredSkill[], b: DeclaredSkill[]) => a.length === b.length &&", "export const sameSkills = (a: DeclaredSkill[], b: DeclaredSkill[]) => a.length < 0 &&")],
  G6: [P, s => s.replace("setSnapshot(fresh); setConflict(false); setNotice('') } catch", "setSnapshot(fresh); setConflict(false); setNotice(''); setChoices({ add: [], link: [], remove: [] }) } catch")],
  G7: [L, s => s.replace("versions.count >= versions.max ? 'limit' : 'upload'", "versions.max < 0 ? 'limit' : 'upload'")],
  G9: [L, s => s.replace("diff.remain.filter(item => !item.linked && !item.handwritten)", "diff.remain")],
  G11: [P, s => s.replace("(n === 1 ? t('resume_overflow_one') : fill(t('resume_overflow'), { n }))", "fill(t('resume_overflow'), { n })")],
  G13: [P, s => s.replace("<Button disabled={busy || conflict} aria-busy={busy} onClick={() => void save()}>", "<Button aria-busy={busy} onClick={() => void save()}>")],
  G14: [P, s => s.replace("useEffect(() => { if (phase !== 'loading') heading.current?.focus() }, [phase])", "")],
  G15: [P, s => s.replace("<div className=\"cv-seg\" role=\"radiogroup\" aria-label={skill.name}>", "<div className=\"cv-seg\" role=\"radiogroup\">")],
  G16: [L, s => s.replace("context.version === 0 || !context.context ? 'onboarding' : versions.count", "versions.count")],
  H1: [R + 'evidence/resumeSkills.ts', s => s.replace("if (!object(value) || !Array.isArray(value.orphaned)) return []", "return []")],
  H3: [R + 'evidence/ResumeSkillsPage.tsx', s => s.replace("!skills.length && !orphaned.length ?", "!skills.length ?")],
  H4: [R + 'evidence/ResumeOrigin.tsx', s => s.replace("{origin.needsReview && declared && <Banner", "{origin.needsReview && <Banner")],
  H5: [R + 'evidence/ResumeSkillsPage.tsx', s => s.replace("{orphaned.length > 0 && <OrphanedList items={orphaned} />}", "")],
}
const [f, fn] = muts[process.argv[2]]; const a = fs.readFileSync(f, 'utf8').split('\r\n').join('\n'); const b = fn(a); if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3) } fs.writeFileSync(f, b)
