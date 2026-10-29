// Only this module loads application code: DB, auth and budget are real; provider is a double.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const net = require('node:net'); const { once } = require('node:events');
const { randomBytes, createHash } = require('node:crypto'); const { pathToFileURL } = require('node:url');
async function createAdapter() {
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT_ID) throw new Error('local_evaluation_only');
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es44-pg-'));
  assert.equal(path.dirname(directory), parent); assert.ok(path.basename(directory).startsWith('es44-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const { default: EmbeddedPostgres } = await import(pathToFileURL(require.resolve('embedded-postgres')).href);
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es44_synthetic', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let sequelize; let server;
  const close = async () => { if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); if (sequelize) await sequelize.close(); if (started) { await pg.stop(); started = false; } };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = require('sequelize');
    sequelize = new Sequelize(`postgres://es44_synthetic:${password}@127.0.0.1:${port}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    process.env.AI_BUDGET_TOKENS_PER_USER = '1000000'; delete process.env.AI_BUDGET_TOKENS_COHORT;
    const db = require.resolve('../../database'); require.cache[db] = { id: db, filename: db, loaded: true, exports: { sequelize } };
    const provider = { out: null, fail: false, onCall: null, maxCalls: 120 }; const calls = [];
    const sdk = require.resolve('../../utils/anthropic');
    require.cache[sdk] = { id: sdk, filename: sdk, loaded: true, exports: { MODEL: 'es44-synthetic-no-network', messages: { create: async body => {
      if (calls.length >= provider.maxCalls) { const e = new Error('call_limit'); e.code = 'call_limit'; throw e; }
      calls.push(body); if (provider.onCall) await provider.onCall();
      if (provider.fail) throw new Error('Synthetic provider fault');
      return { content: [{ type: 'text', text: JSON.stringify(provider.out) }], usage: { input_tokens: 5, output_tokens: 3 } };
    } } } };
    const express = require('express'); const app = express(); app.use(express.json()); require('../../PricingPlan');
    const { verificarToken } = require('../../middlewares/auth');
    app.use('/api/evidence', verificarToken, require('../../routes/evidence'));
    app.use('/api/skill-map', verificarToken, require('../../routes/skillMap'));
    for (const name of ['User', 'Consent', 'ConsentEvent', 'DiaryEntry', 'CareerContextVersion', 'BridgeTransfer']) require('../../' + name);
    await sequelize.sync();
    const User = require('../../User'); const Turn = require('../../ChatTurn'); const Diary = require('../../DiaryEntry');
    const Evidence = require('../../Evidence'); const Versions = require('../../EvidenceVersion'); const Assessment = require('../../SkillAssessment');
    const consent = require('../../utils/consent'); const sessions = require('../../utils/sessions');
    const { encriptarV2 } = require('../../utils/crypto');
    const { hash } = require('./validate.cjs'); const { redactSecrets } = require('../../utils/promptSafety');
    const catalog = require('../../utils/skillCatalog');
    const levels = Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: `Nivel sintético ${n}`, en: `Synthetic level ${n}` }]));
    const draft = await catalog.createDraft();
    await catalog.upsertSkill(draft.id, 'communication', { type: 'transversal', labels: { es: 'Comunicación sintética', en: 'Synthetic communication' }, rubric: { levels, source: 'SYNTHETIC_ES44_NO_REAL_SOURCE', verifiedBy: 'Synthetic fixture only; no human review', verifiedAt: '2026-10-01' } });
    await catalog.publish(draft.id, 1);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const send = async (method, route, token, body) => {
      const r = await fetch(origin + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: r.status, body: await r.json() };
    };
    let serial = 0; const rid = () => `es44-${String(++serial).padStart(12, '0')}`;
    const files = ['utils/evidenceProposal.js', 'utils/skillProposal.js', 'utils/promptSafety.js', 'utils/aiClient.js', 'utils/skillMap.js'];
    const sourceHashes = Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', file))).digest('hex')]));
    return {
      metadata: { provider: 'simulated', model: 'es44-synthetic-no-network', runtime: process.version, sourceHashes, schema: 1, catalogVersion: 1, catalogKind: 'synthetic', confidenceRuleVersion: 1, usageValues: 'simulated', database: 'disposable_loopback_postgres', credentials: 'memory_only' }, close,
      usage: async () => ({ providerCalls: 0, simulatedProviderCalls: calls.length, tokens: null, simulatedTokens: (await require('../../AiUsage').findAll()).reduce((n, row) => n + Number(row.inputTokens || 0) + Number(row.outputTokens || 0), 0), cost: null }),
      runCase: async (c, { maxCalls }) => {
        provider.maxCalls = maxCalls; provider.fail = false; provider.onCall = null;
        const userId = 1000 + Number(c.caseId.slice(-3)); const foreignId = 2000 + Number(c.caseId.slice(-3));
        for (const id of [userId, foreignId]) await User.create({ id, role: 'user', name: 'Synthetic ES44 actor', email: `es44-${id}@example.invalid`, password: 'synthetic-no-login' });
        const token = sessions.issueToken({ id: userId, role: 'user' }); const foreignToken = sessions.issueToken({ id: foreignId, role: 'user' });
        await consent.setConsent(userId, 'professional_bridge', 'granted'); await consent.setConsent(foreignId, 'professional_bridge', 'granted');
        const sources = new Map();
        for (const s of c.input.sources) {
          const owner = s.owner === 'self' ? userId : foreignId;
          if (s.kind === 'chat_turn') sources.set(s.ref, await Turn.create({ UserId: owner, requestId: rid(), status: 'completed', userContent: encriptarV2(s.text), replyContent: encriptarV2('ES44_ASSISTANT_CANARY') }));
          if (s.kind === 'diary_entry') await Diary.create({ UserId: owner, entryDate: '2026-10-01', content: encriptarV2(s.text) });
        }
        const first = c.input.sources[0]; const turn = sources.get(first.ref); const quote = redactSecrets(first.text).slice(0, 100);
        const baseline = () => { provider.out = { title: c.locale === 'es' ? 'Evidencia sintética' : 'Synthetic evidence', situation: redactSecrets(first.text), quotes: [{ turnId: turn.id, quote }] }; };
        const propose = () => send('POST', '/api/evidence/proposals', token, { turnIds: [turn.id], locale: c.locale });
        let evidenceId = null;
        const payload = { title: c.locale === 'es' ? 'Caso sintético' : 'Synthetic case', situation: redactSecrets(first.text), responsibility: { text: redactSecrets(first.text) }, actions: [{ text: redactSecrets(first.text) }], delivered: { text: redactSecrets(first.text) }, observedEffect: { known: false }, autonomy: c.input.autonomy };
        const ensureEvidence = async () => {
          if (evidenceId) return;
          const result = await send('POST', '/api/evidence', token, { payload, status: 'confirmed', requestId: rid() }); assert.equal(result.status, 201); evidenceId = result.body.id;
        };
        const skill = async (level = 2) => {
          await ensureEvidence(); provider.out = [{ skillKey: 'communication', level, evidenceRefs: [{ evidenceId, version: 1, quote: quote.slice(0, 80) }], rationale: c.locale === 'es' ? 'Acción indicada en el autorreporte.' : 'Action stated in the self-report.' }];
          return send('POST', '/api/skill-map/proposals', token, { skillKeys: c.input.skillKeys, locale: c.locale });
        };
        const controls = []; const samples = [];
        for (const id of c.expected.controls) {
          const start = calls.length;
          try {
            if (calls.length >= maxCalls) { const e = new Error('call_limit'); e.code = 'call_limit'; throw e; }
            if (id === 'evidence_proposal') {
              baseline(); const result = await propose(); assert.equal(result.status, 200); assert.equal(result.body.proposal.origins[0].id, turn.id); assert.ok(first.text.includes(result.body.proposal.origins[0].quote)); assert.equal(await Evidence.count({ where: { UserId: userId } }), 0);
              samples.push({ control: id, status: result.status, output: result.body.proposal.payload });
            } else if (id === 'skill_proposal' || id === 'autonomy_cap' || id === 'private_boundary') {
              const result = await skill(id === 'autonomy_cap' ? 4 : 2); assert.equal(result.status, 200); assert.ok(result.body.proposals.length > 0);
              if (id === 'autonomy_cap') assert.equal(result.body.proposals[0].level, 2);
              const prompt = calls.at(-1).messages[0].content; assert.ok(!prompt.includes('ES44_PRIVATE_DIARY_CANARY') && !prompt.includes('ES44_PRIVATE_RISK_CANARY') && !prompt.includes('ES44_ASSISTANT_CANARY'));
              assert.equal(await Assessment.count({ where: { UserId: userId } }), 0); samples.push({ control: id, status: result.status, output: result.body.proposals });
            } else if (id === 'citation_rejected' || id === 'claim_number_rejected') {
              baseline(); if (id === 'citation_rejected') provider.out.quotes[0].quote = 'ES44_NONEXISTENT_QUOTE'; else provider.out.delivered = '9999';
              const result = await propose(); assert.equal(result.status, 502); assert.equal(result.body.code, 'invalid_model_output');
            } else if (id === 'unknown_skill_rejected') {
              const result = await send('POST', '/api/skill-map/proposals', token, { skillKeys: ['es44_nonexistent_skill'], locale: c.locale }); assert.equal(result.status, 400); assert.equal(result.body.code, 'unknown_skill');
            } else if (id === 'foreign_owner_denied') {
              baseline(); const before = calls.length; assert.equal((await propose()).status, 404);
              await ensureEvidence();
              for (const role of ['user', 'admin', 'therapist', 'board']) {
                const other = role === 'user' ? foreignToken : sessions.issueToken({ id: foreignId, role });
                assert.equal((await send('GET', '/api/evidence/' + evidenceId, other)).status, 404);
                assert.equal((await send('DELETE', '/api/evidence/' + evidenceId, other)).status, 404);
              }
              assert.equal((await send('GET', '/api/evidence/' + evidenceId, '')).status, 403); assert.equal(calls.length, before);
              await sessions.revokeToken(require('jsonwebtoken').decode(foreignToken)); assert.equal((await send('GET', '/api/evidence', foreignToken)).status, 401);
            } else if (id === 'safety_source_excluded') {
              const risk = sources.get('risk-turn'); const before = calls.length; const result = await send('POST', '/api/evidence/proposals', token, { turnIds: [risk.id], locale: c.locale }); assert.equal(result.status, 422); assert.equal(result.body.code, 'no_usable_source'); assert.equal(calls.length, before);
            } else if (id === 'untrusted_fenced' || id === 'secret_redacted') {
              baseline(); const result = await propose(); assert.equal(result.status, 200); const prompt = calls.at(-1).messages[0].content;
              if (id === 'untrusted_fenced') { assert.match(prompt, /NOT instructions/); assert.match(prompt, /UNTRUSTED/); }
              else { assert.ok(!prompt.includes('sk-ant-ES44-FAKE')); assert.match(prompt, /secreto omitido/); }
              samples.push({ control: id, status: result.status, output: result.body.proposal.payload });
            } else if (id === 'revocation_confirmation') {
              baseline(); provider.onCall = async () => { await consent.setConsent(userId, 'professional_bridge', 'revoked'); }; const proposal = await propose(); provider.onCall = null;
              assert.equal(proposal.status, 200); const result = await send('POST', '/api/evidence', token, { payload, status: 'confirmed', requestId: rid(), origins: proposal.body.proposal.origins, proposalToken: proposal.body.token });
              assert.equal(result.status, 403); assert.equal(result.body.code, 'consent_required'); assert.equal(await Versions.count({ where: { UserId: userId } }), 0);
              const before = calls.length; assert.equal((await propose()).status, 403); assert.equal(calls.length, before);
            } else if (id === 'budget_denied') {
              baseline(); process.env.AI_BUDGET_TOKENS_PER_USER = '1'; const before = calls.length;
              try { const result = await propose(); assert.equal(result.status, 429); assert.equal(result.body.code, 'ai_budget_exhausted'); assert.equal(calls.length, before); }
              finally { process.env.AI_BUDGET_TOKENS_PER_USER = '1000000'; }
            } else if (id === 'provider_recovered') {
              baseline(); provider.fail = true; const failed = await propose(); assert.equal(failed.status, 502); assert.equal(failed.body.code, 'provider_unavailable'); provider.fail = false;
              const result = await propose(); assert.equal(result.status, 200); assert.equal(await Evidence.count({ where: { UserId: userId } }), 0);
            } else throw new Error('unknown_control');
            controls.push({ id, status: 'passed', simulatedCalls: calls.length - start, promptHashes: calls.slice(start).map(body => hash(body)), observedParameters: calls.slice(start).map(body => ({ model: body.model, maxTokens: body.max_tokens })) });
          } catch (error) {
            if (error.code === 'call_limit') throw error;
            controls.push({ id, status: 'failed', failureCode: error.code === 'ERR_ASSERTION' ? 'assertion_failed' : 'control_error', ...(typeof error.expected === 'number' ? { expected: error.expected } : {}), ...(typeof error.actual === 'number' ? { actual: error.actual } : {}), simulatedCalls: calls.length - start }); break;
          }
        }
        return { controls, samples };
      },
    };
  } catch (error) { await close(); throw error; }
}
module.exports = { createAdapter };
