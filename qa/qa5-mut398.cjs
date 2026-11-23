// Mutaciones de #398 sobre tools/qa5/pr398 (solo local; se revierten con git checkout). Uso: node qa5-mut398.cjs G1..G15
const fs = require('fs'); const D = (process.env.QA_TOOLS || '.') + '/qa5/pr398/frontend/src/context/resume/'; const P = D + 'ResumeUpdatePage.tsx'
const muts = {
  G1: [P, s => s.replace("setChoices(defaultChoices(diffSkills(snapshot?.context?.declaredSkills ?? [], suggested, result.resume.version)))", "setChoices({ add: diffSkills(snapshot?.context?.declaredSkills ?? [], suggested, result.resume.version).added.map(skill => skill.name), link: [], remove: [] })")],
  G2: [P, s => s.replace("expectedVersion: snapshot.version, action: 'save_draft'", "expectedVersion: 0, action: 'save_draft'")],
  G4: [P, s => s.replace("if (status === 409) { setConflict(true); setNotice('context_conflict') }", "if (status === 409) { setNotice('') }")],
  G5: [P, s => s.replace("const sameSkills = (a: DeclaredSkill[], b: DeclaredSkill[]) => a.length === b.length &&", "const sameSkills = (a: DeclaredSkill[], b: DeclaredSkill[]) => a.length < 0 &&")],
  G6: [P, s => s.replace("setSnapshot(fresh); setConflict(false); setNotice('') } catch", "setSnapshot(fresh); setConflict(false); setNotice(''); setChoices({ add: [], link: [], remove: [] }) } catch")],
  G7: [P, s => s.replace("setPhase(list.resumes.length >= list.maxVersions ? 'limit' : 'upload')", "setPhase(list.maxVersions < 0 ? 'limit' : 'upload')")],
  G9: [P, s => s.replace("diff.remain.filter(item => !item.linked && !item.handwritten)", "diff.remain")],
  G11: [P, s => s.replace("(n === 1 ? t('resume_overflow_one') : fill(t('resume_overflow'), { n }))", "fill(t('resume_overflow'), { n })")],
  G12: [P, s => s.replace("{skipped > 0 && <p className=\"cg-hint\" role=\"status\">{overflowText(skipped)}</p>}", "")],
  G13: [P, s => s.replace("<Button disabled={busy || conflict} aria-busy={busy} onClick={() => void save()}>", "<Button aria-busy={busy} onClick={() => void save()}>")],
  G14: [P, s => s.replace("useEffect(() => { if (phase !== 'loading') heading.current?.focus() }, [phase])", "")],
  G15: [P, s => s.replace("<div className=\"cv-seg\" role=\"radiogroup\" aria-label={skill.name}>", "<div className=\"cv-seg\" role=\"radiogroup\">")],
  G16: [P, s => s.replace("if (context.version === 0 || !context.context) { navigate('/app/onboarding', { replace: true }); return }", "if (context.version === 0 || !context.context) { setSnapshot(context); setVersions({ items: list.resumes, max: list.maxVersions }); setPhase('upload'); return }")],
}
const [f, fn] = muts[process.argv[2]]; const a = fs.readFileSync(f, 'utf8'); const b = fn(a); if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3) } fs.writeFileSync(f, b)
