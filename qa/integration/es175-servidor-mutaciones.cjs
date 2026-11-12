// [QA-Claude] Mutaciones ES-175 SERVIDOR — cabeza 78005853 (PR #262). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const F = 'C:/Users/Usuario/Documents/qa-pr-253/backend/utils/reviews.js'; const m = process.argv[2];
const read = () => fs.readFileSync(F, 'utf8'); const save = (s) => fs.writeFileSync(F, s);
const edit = (a, b) => { const s = read(); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 80)); save(s.replace(a, () => b)); };
const bypass = '((_p, _r, _c, fn) => fn(undefined))';
if (m === 'N1') edit("const row = await withReviewConsent(userId, review.reviewerId, 'consent_revoked',", `const row = await ${bypass}(userId, review.reviewerId, 'consent_revoked',`); // objetar sin permiso
if (m === 'N2') edit("const review = await ProfessionalReview.findOne({ where: { id: reviewId, UserId: userId } });", "const review = await ProfessionalReview.findOne({ where: { id: reviewId } });"); // objetar sin dueño
if (m === 'N3') edit("if (!row || row.hasChatOrigin || sourceRevoked(row)) throw", "if (!row || sourceRevoked(row)) throw"); // compartir sin filtrar el chat
if (m === 'N4') edit("ReviewShare.findAll({ where: { UserId: userId }, order: [['id', 'DESC']], limit: 200 })", "ReviewShare.findAll({ where: {}, order: [['id', 'DESC']], limit: 200 })"); // lista de shares sin dueño
if (m === 'N5') edit("await sequelize.query(\"SELECT pg_advisory_xact_lock(hashtext('review-share:' || :u || ':' || :r))\", { replacements: { u: String(userId), r: String(body.reviewerId) }, transaction });", ''); // autorizar sin bloqueo
if (m === 'N19') edit("materialChanged: !share || share.status !== 'granted' || refsChanged(review.evidenceRefs, live),", "materialChanged: !share || share.status !== 'granted',"); // la persona no ve el cambio al editar/borrar
if (m === 'N20') edit("if (!live.has(ref.evidenceId)) return [];", ''); // el revisor ve la evidencia borrada
if (m === 'N21') edit("if (ids.some((id) => !live.has(id))) throw new ReviewError(400, 'invalid_evidence'", "if (false) throw new ReviewError(400, 'invalid_evidence'"); // se puede citar una evidencia borrada
if (m === 'N22') edit("if (await ReviewShare.count({ where: { UserId: userId, createdAt: { [Op.gt]: new Date(Date.now() - 3600 * 1000) } } }) >= MAX_SHARES_PER_HOUR) throw", "if (false) throw"); // sin tope
if (m === 'N23') edit("await consent.grantIn(userId, PURPOSE, consent.reviewerScope(body.reviewerId), transaction);", "await consent.setConsent(userId, PURPOSE, 'granted', consent.reviewerScope(body.reviewerId));"); // permiso fuera de la transacción (no atómico)
if (m === 'N24') edit("return { items, changed: refsChanged(share.evidenceRefs, live) };", "return { items, changed: false };"); // el revisor no ve el aviso de cambio
if (m === 'N7') edit("User.findOne({ where: { id, role: 'therapist', active: true }, attributes: ['id', 'name'] })", "User.findOne({ where: { id, active: true }, attributes: ['id', 'name'] })"); // cualquier usuario puede ser revisor
if (m === 'N8') edit("if (!ids.every((id) => shared.includes(id))) throw", "if (false) throw"); // citar evidencias no autorizadas
if (m === 'N10') edit("const shares = await ReviewShare.findAll({ where: { reviewerId, status: 'granted' }", "const shares = await ReviewShare.findAll({ where: { reviewerId }"); // el revisor ve shares sustituidos o retirados
if (m === 'N11') edit("person: `Persona ${ordinals.get(Number(share.UserId))}`", "person: `Persona ${share.UserId}`"); // alias = id real
if (m === 'N12') edit("if ([...text].length > MAX_TEXT) throw", "if ([...text].length > 999999) throw"); // sin límite de texto
if (m === 'N13') edit("ProfessionalReview.findOne({ where: { id: body.supersedesId, reviewerId, UserId: share.UserId }, transaction })", "ProfessionalReview.findOne({ where: { id: body.supersedesId }, transaction })"); // supersedes de otra persona
if (m === 'N14') edit("  await consent.setConsent(userId, PURPOSE, 'revoked', consent.reviewerScope(share.reviewerId));\n", ''); // retirar sin retirar el permiso
if (m === 'N15') edit("try { rows = await withReviewConsent(personId, reviewerId, 'consent_required', async () =>", `try { rows = await ${bypass}(personId, reviewerId, 'consent_required', async () =>`); // el revisor ve objeciones sin permiso
if (m === 'N16') edit("material = await withReviewConsent(share.UserId, reviewerId, 'consent_required', async (transaction) => {", `material = await ${bypass}(share.UserId, reviewerId, 'consent_required', async (transaction) => {`); // el revisor ve material sin permiso
if (m === 'N17') edit("const row = await withReviewConsent(objection.UserId, reviewerId, 'consent_required', async (transaction) => {", `const row = await ${bypass}(objection.UserId, reviewerId, 'consent_required', async (transaction) => {`); // responder sin permiso
if (m === 'N18') edit("const row = await withReviewConsent(share.UserId, reviewerId, 'consent_required', async (transaction) => {\n      const fresh", `const row = await ${bypass}(share.UserId, reviewerId, 'consent_required', async (transaction) => {\n      const fresh`); // crear revisión sin permiso
const TAKE = "  takeAttempt(userId); // ANTES de validar evidencias o revisor: el tope es el mismo para cualquier reviewerId\n";
const REVIEWER = "  if (!await reviewerOf(body.reviewerId) || body.reviewerId === userId) throw new ReviewError(404, 'reviewer_not_found', 'No se encontró a esa persona revisora.', 'That reviewer was not found.');\n";
if (m === 'P1') { edit(TAKE, ''); edit(REVIEWER, REVIEWER + '  takeAttempt(userId);\n'); } // el tope se comprueba DESPUÉS de validar al revisor
if (m === 'P2') { edit(TAKE, ''); edit("      return shareView(share);\n    } catch (error) {\n      if (error instanceof consent.ConsentRequiredError)", "      takeAttempt(userId);\n      return shareView(share);\n    } catch (error) {\n      if (error instanceof consent.ConsentRequiredError)"); } // cuenta solo los éxitos
if (m === 'P3') edit("const cutoff = clock() - 3600 * 1000;", "const cutoff = 0;"); // la ventana nunca se libera
if (m === 'P4') edit("const MAX_ATTEMPTS_PER_HOUR = 30;", "const MAX_ATTEMPTS_PER_HOUR = 1000;"); // tope inútil
console.log('M apl ' + m);
