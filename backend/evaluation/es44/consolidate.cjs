const { hash, only, text, validateCorpus, validateRubric } = require('./validate.cjs');
function reviewTemplate(corpus, rubric, report) {
  return { schemaVersion: 1, corpusHash: hash(corpus), rubricHash: hash(rubric), runHash: hash(report), reviews: [], resolutions: [], qa: null };
}
function consolidate({ corpus, rubric, report, review }) {
  const blockers = [];
  const blocked = code => ({ status: 'blocked', blockers: [code], denominator: 30, pertinentAndJustified: 0, pending: 30, releaseStatus: 'not_approved' });
  if (!validateCorpus(corpus).valid || !validateRubric(rubric)) return blocked('invalid_inputs');
  if (!report || report.schemaVersion !== 1 || !Array.isArray(report.cases) || report.cases.some(r => !r || typeof r.caseId !== 'string')) return blocked('invalid_run');
  if (!only(review, ['schemaVersion', 'corpusHash', 'rubricHash', 'runHash', 'reviews', 'resolutions', 'qa']) || review.schemaVersion !== 1 || !Array.isArray(review.reviews) || !Array.isArray(review.resolutions)) return { status: 'blocked', blockers: ['invalid_review_file'], denominator: 30, pertinentAndJustified: 0, pending: 30, releaseStatus: 'not_approved' };
  if (review.corpusHash !== hash(corpus) || review.rubricHash !== hash(rubric) || review.runHash !== hash(report) || report.corpusHash !== hash(corpus) || report.rubricHash !== hash(rubric)) blockers.push('binding_mismatch');
  if (rubric.status !== 'approved') blockers.push('rubric_pending');
  if (report.mode !== 'provider' || report.metadata?.provider !== 'anthropic' || !text(report.metadata?.model) || !Number.isInteger(report.providerCalls) || report.providerCalls < 1 || report.simulatedProviderCalls !== 0) blockers.push('real_provider_pending');
  if (!Array.isArray(report.cases) || report.cases.length !== 30 || new Set(report.cases.map(c => c.caseId)).size !== 30) blockers.push('incomplete_run');
  let pertinentAndJustified = 0; let pending = 0; const critical = []; const decisions = [];
  for (const c of corpus.cases) {
    const row = report.cases?.find(r => r.caseId === c.caseId);
    if (!row || c.expected.pendingStages.length || row.inputHash !== hash(c) || !Array.isArray(row.pendingStages) || row.pendingStages.length || row.status !== 'passed' || !Array.isArray(row.controls) || row.controls.length !== c.expected.controls.length || new Set(row.controls.map(x => x?.id)).size !== c.expected.controls.length || row.controls.some(x => !x || !c.expected.controls.includes(x.id) || x.status !== 'passed')) { pending++; decisions.push({ caseId: c.caseId, status: 'execution_pending' }); continue; }
    const reviews = review.reviews.filter(r => r?.caseId === c.caseId);
    const valid = reviews.length === 2 && new Set(reviews.map(r => String(r.reviewerId).trim().toLowerCase())).size === 2 && reviews.every(r => only(r, ['caseId', 'reviewerId', 'kind', 'reviewedAt', 'reference', 'outputHash', 'pertinent', 'justified', 'criticalCodes', 'reason']) && r.kind === 'human' && text(r.reviewerId) && r.reviewerId === r.reviewerId.trim() && r.reviewerId.toLowerCase() !== c.author.toLowerCase() && text(r.reference) && text(r.reason) && Number.isFinite(Date.parse(r.reviewedAt)) && r.outputHash === hash(row) && typeof r.pertinent === 'boolean' && typeof r.justified === 'boolean' && Array.isArray(r.criticalCodes) && r.criticalCodes.every(code => rubric.criticalCodes.includes(code)));
    if (!valid) { pending++; decisions.push({ caseId: c.caseId, status: 'human_review_pending' }); continue; }
    for (const r of reviews) for (const code of r.criticalCodes) critical.push({ caseId: c.caseId, code });
    let decision;
    if (reviews[0].pertinent === reviews[1].pertinent && reviews[0].justified === reviews[1].justified) decision = reviews[0];
    else {
      const resolutions = review.resolutions.filter(r => r?.caseId === c.caseId);
      const r = resolutions[0];
      if (resolutions.length === 1 && only(r, ['caseId', 'resolverId', 'role', 'reference', 'reason', 'outputHash', 'pertinent', 'justified']) && r.role === 'tech_lead' && text(r.resolverId) && !reviews.some(v => v.reviewerId === r.resolverId) && r.resolverId !== c.author && text(r.reference) && text(r.reason) && r.outputHash === hash(row) && typeof r.pertinent === 'boolean' && typeof r.justified === 'boolean') decision = r;
    }
    if (!decision) { pending++; decisions.push({ caseId: c.caseId, status: 'disagreement' }); continue; }
    if (decision.pertinent && decision.justified) pertinentAndJustified++;
    decisions.push({ caseId: c.caseId, status: decision.pertinent && decision.justified ? 'pertinent_and_justified' : 'not_pertinent_or_justified' });
  }
  if (review.reviews.some(r => !r || !corpus.cases.some(c => c.caseId === r.caseId))) blockers.push('unknown_review_case');
  if (review.resolutions.some(r => !r || !corpus.cases.some(c => c.caseId === r.caseId))) blockers.push('unknown_resolution_case');
  if (!only(review.qa, ['role', 'reference', 'schema', 'provenance', 'injection', 'englishReviewed']) || review.qa.role !== 'qa' || !text(review.qa.reference) || ['schema', 'provenance', 'injection', 'englishReviewed'].some(k => review.qa[k] !== true)) blockers.push('qa_pending');
  if (critical.length) blockers.push('critical_violation');
  if (pending) blockers.push('cases_pending');
  if (pertinentAndJustified < 24) blockers.push('below_24_of_30');
  return { status: blockers.length ? 'blocked' : 'eligible_for_human_release_decision', blockers, denominator: 30, pertinentAndJustified, pending, critical, decisions, identityVerification: 'attestations_require_human_verification', releaseStatus: 'not_approved' };
}
module.exports = { reviewTemplate, consolidate };
