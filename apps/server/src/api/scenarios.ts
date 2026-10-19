/** The Demo Director's routes. */
import { Router } from 'express';
import { SCENARIOS } from '@jahiz/domain';
import { pool } from '../db.js';
import { startScenario, runStep, resolveScreen } from '../director.js';

export const scenarios = Router();
scenarios.post('/scenarios/:key/start', async (req, res) => {
  try { res.json(await startScenario(req.params.key)); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
scenarios.post('/scenarios/:key/step', async (req, res) => {
  const mode = req.body.mode === 'wait' || req.body.mode === 'done' ? req.body.mode : 'run';
  try { res.json(await runStep(req.params.key, Number(req.body.index ?? 0), mode)); } catch (e: any) { res.status(400).json({ error: e.message }); }
});
scenarios.post('/scenarios/stop', async (_req, res) => { await pool.query(`UPDATE layer.scenario_runs SET status='ABANDONED', finished_at=now() WHERE status='RUNNING'`); res.json({ ok: true }); });
scenarios.get('/scenarios/:key', async (req, res) => {
  const s = SCENARIOS.find((x) => x.key === req.params.key); if (!s) return res.status(404).json({ error: 'Not found' });
  const edge = (await pool.query(`SELECT value FROM layer.meta WHERE key='edge_cases'`)).rows[0]?.value ?? {};
  const steps = await Promise.all(s.steps.map(async (st) => ({ ...st, screenResolved: await resolveScreen(st.screen, edge) })));
  res.json({ ...s, steps, edge });
});
