/**
 * Present mode: the storylines a presenter edits in Settings → Demo, stored
 * in layer.meta, and the tally an interlude card shows after a scenario
 * (counted from the trail, so it is always true for what the room just saw).
 */
import { Router } from 'express';
import { pool, meta, setMeta } from '../db.js';

export const present = Router();

const KEY = 'storylines';

/** The stored storylines (the web app ships the default and merges). */
present.get('/storylines', async (_req, res) => {
  res.json((await meta<unknown[]>(pool, KEY)) ?? []);
});

/** Replace the stored storylines. The body is the whole list; the web app owns the shape. */
present.put('/storylines', async (req, res) => {
  const list = req.body;
  if (!Array.isArray(list) || list.length > 20) return res.status(400).json({ error: 'A list of up to twenty storylines' });
  for (const s of list) {
    if (!s || typeof s.id !== 'string' || typeof s.name !== 'string' || !Array.isArray(s.chapters) || s.chapters.length > 60) return res.status(400).json({ error: 'Each storyline needs an id, a name and up to sixty chapters' });
  }
  await setMeta(pool, KEY, list);
  res.json({ ok: true, count: list.length });
});

/** The trail's latest id, taken before a scenario starts so the tally counts only what the scenario did. */
present.get('/trail/floor', async (_req, res) => {
  const r = await pool.query(`SELECT (SELECT COALESCE(MAX(id), 0)::int FROM layer.trail) AS id, (SELECT COALESCE(MAX(id), 0)::int FROM layer.activity) AS activity`);
  res.json(r.rows[0]);
});

/** What happened on the trail since `after`: agent actions, human decisions, record writes, Hami blocks, offers. */
present.get('/trail/tally', async (req, res) => {
  const after = Number(req.query.after ?? 0) || 0;
  const r = await pool.query(
    `SELECT
       COUNT(*)::int AS entries,
       COUNT(*) FILTER (WHERE actor_type='AGENT')::int AS agent_actions,
       COUNT(*) FILTER (WHERE actor_type='HUMAN')::int AS human_decisions,
       COUNT(*) FILTER (WHERE actor_type='HUMAN' AND override)::int AS overrides,
       COUNT(*) FILTER (WHERE actor_type='SYSTEM' AND act='WRITE')::int AS record_writes,
       COUNT(*) FILTER (WHERE act='BLOCK')::int AS blocked,
       COUNT(*) FILTER (WHERE act IN ('OFFER','HANDOFF') OR (act='SEND' AND summary ILIKE 'Sent the offer%'))::int AS offers,
       COUNT(*) FILTER (WHERE act='EXAMINE')::int AS examined,
       COUNT(*) FILTER (WHERE act='REQUALIFY')::int AS requalified,
       COUNT(*) FILTER (WHERE act='SEND')::int AS sent,
       COUNT(DISTINCT actor_id) FILTER (WHERE actor_type='AGENT')::int AS agents,
       COUNT(DISTINCT customer_id)::int AS customers,
       COUNT(DISTINCT clause) FILTER (WHERE clause IS NOT NULL)::int AS clauses
     FROM layer.trail WHERE id > $1 AND act <> 'SCENARIO_RESET'`, [after]);
  res.json(r.rows[0]);
});
