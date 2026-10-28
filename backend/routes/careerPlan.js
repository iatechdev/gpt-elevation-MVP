const express = require('express');
const service = require('../utils/careerPlan');
const { invalid } = require('../utils/careerPlanRules');
function respond(res, error) {
  if (error.status && error.code) return res.status(error.status).json({ code: error.code, error: error.message });
  return res.status(503).json({ code: 'career_plan_unavailable', error: 'No se pudo completar la operación. / The operation could not be completed.' });
}
const handle = fn => async (req, res) => { try { await fn(req, res); } catch (error) { respond(res, error); } };
function router() {
  const r = express.Router();
  r.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      await service.authorize(req.user.id);
      const allowedAfter = req.method === 'GET' && (['/', '/reminders'].includes(req.path) || /^\/[1-9]\d*(\/review-requests)?$/.test(req.path));
      if (Object.keys(req.query).some(key => !(key === 'after' && allowedAfter) && !(key === 'history' && req.path === '/reminders' && req.method === 'GET'))) throw invalid();
      if (req.query.after !== undefined && (!/^(0|[1-9]\d*)$/.test(req.query.after) || !Number.isSafeInteger(Number(req.query.after)))) throw invalid();
      if (req.query.history !== undefined && req.query.history !== 'true') throw invalid();
      next();
    } catch (error) { respond(res, error); }
  });
  return r;
}
const after = req => req.query.after === undefined ? 0 : Number(req.query.after);
const paramsId = req => { const value = Number(req.params.id); if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(value)) throw invalid(); return value; };
const send = async (res, result) => res.status(result.created ? 201 : 200).json(result);
const experiments = router();
experiments.post('/proposals', handle(async (req, res) => res.json(await service.proposeExperiment(req.user.id, req.body))));
experiments.post('/', handle(async (req, res) => send(res, await service.createExperiment(req.user.id, req.body))));
experiments.get('/', handle(async (req, res) => res.json(await service.listExperiments(req.user.id, after(req)))));
experiments.get('/:id', handle(async (req, res) => res.json(await service.getExperiment(req.user.id, paramsId(req), after(req)))));
experiments.get('/:id/review-requests', handle(async (req, res) => res.json(await service.listReviews(req.user.id, paramsId(req), after(req)))));
experiments.post('/:id/versions', handle(async (req, res) => send(res, await service.change(req.user.id, paramsId(req), req.body))));
experiments.post('/:id/review-requests', handle(async (req, res) => send(res, await service.requestReview(req.user.id, paramsId(req), req.body))));
const plans = router();
plans.post('/proposals', handle(async (req, res) => res.json(await service.proposePlan(req.user.id, req.body))));
plans.post('/versions', handle(async (req, res) => send(res, await service.savePlan(req.user.id, req.body))));
plans.get('/', handle(async (req, res) => res.json(await service.listPlans(req.user.id, after(req)))));
plans.get('/versions/:id', handle(async (req, res) => res.json(await service.getPlan(req.user.id, paramsId(req)))));
plans.get('/reminders', handle(async (req, res) => res.json(await service.listReminders(req.user.id, { history: req.query.history === 'true', after: after(req) }))));
plans.post('/reminders', handle(async (req, res) => send(res, await service.saveReminder(req.user.id, req.body))));
for (const r of [experiments, plans]) r.use((req, res) => res.status(404).json({ code: 'resource_not_found', error: 'Recurso no encontrado. / Resource not found.' }));
module.exports = { experiments, plans };
