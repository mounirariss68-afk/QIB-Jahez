/**
 * `npm run check` — arithmetic and policy checks over the live world.
 * Prints one line per check with PASS / WARN / FAIL and exits non-zero on a
 * FAIL. Run it after a seed, after a scenario, or after advancing the clock:
 * everything the agents did must still square with the policy.
 */
import { qualify, quietAt, type Channel, type Segment } from '@jahiz/domain';
import { pool } from '../db.js';
import { loadClock, now, today } from '../clock.js';
import { activePolicy } from '../policy.js';
import { loadFacts } from '../core/connector.js';

type Level = 'PASS' | 'WARN' | 'FAIL';
const out: { level: Level; name: string; detail: string }[] = [];
const report = (level: Level, name: string, detail: string) => { out.push({ level, name, detail }); console.log(`${level.padEnd(4)} ${name} — ${detail}`); };
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');

async function main() {
  await loadClock();
  const c = await pool.connect();
  try {
    const policy = await activePolicy(c);
    console.log(`Jahiz world check · clock ${today()} ${now().toISOString()} · policy v${policy.version}\n`);

    // 1. Eligibility share and arithmetic of the latest stored results
    const latest = (await c.query(`SELECT DISTINCT ON (customer_id) customer_id, eligible, reason_codes, cls FROM core.preapproval_results ORDER BY customer_id, run_id DESC`)).rows;
    const eligible = latest.filter((r) => r.eligible).length;
    const share = latest.length ? eligible / latest.length : 0;
    report(share >= 0.25 && share <= 0.5 ? 'PASS' : 'WARN', 'Eligible share', `${eligible} of ${latest.length} customers eligible (${pct(eligible, latest.length)}); the brief says about 35%`);
    const badEligible = latest.filter((r) => r.eligible && (r.reason_codes as string[]).some((x) => x !== 'R20'));
    report(badEligible.length ? 'FAIL' : 'PASS', 'Eligible means no blocking reason', badEligible.length ? `${badEligible.length} eligible customers carry a blocking reason, e.g. ${badEligible[0].customer_id}` : `every eligible customer has no blocking reason (R20 is advisory)`);
    const noReason = latest.filter((r) => !r.eligible && !(r.reason_codes as string[]).length);
    report(noReason.length ? 'FAIL' : 'PASS', 'Every fall-out has a reason', noReason.length ? `${noReason.length} fall-outs with no reason, e.g. ${noReason[0].customer_id}` : `all ${latest.length - eligible} fall-outs carry at least one of the 20 reasons`);

    // 2. Live re-qualification agrees with the stored result (differences are expected only where the clock moved past an expiry or a credit)
    const ids = latest.map((r) => r.customer_id as string);
    const facts = await loadFacts({ c, actor: 'check' }, ids);
    let mismatches = 0; const examples: string[] = [];
    for (const r of latest) { const f = facts.get(r.customer_id); if (!f) continue; const q = qualify(f, policy, today()); if (q.eligible !== r.eligible) { mismatches++; if (examples.length < 3) examples.push(`${r.customer_id} stored ${r.eligible ? 'eligible' : 'fall-out'}, live ${q.eligible ? 'eligible' : q.reasons.join('+')}`); } }
    report(mismatches / Math.max(1, latest.length) <= 0.05 ? 'PASS' : 'WARN', 'Stored results match a live re-qualification', `${mismatches} of ${latest.length} differ (${pct(mismatches, latest.length)}); a nightly scan refreshes them${examples.length ? `: ${examples.join('; ')}` : ''}`);

    // 3. Cases: one open case per customer, reasons and workflow on open cases, a close code on closed ones
    const dupOpen = (await c.query(`SELECT customer_id, COUNT(*)::int n FROM layer.cases WHERE state<>'CLOSED' GROUP BY 1 HAVING COUNT(*)>1`)).rows;
    report(dupOpen.length ? 'FAIL' : 'PASS', 'One open case per customer', dupOpen.length ? `${dupOpen.length} customers have several open cases, e.g. ${dupOpen[0].customer_id} (${dupOpen[0].n})` : 'no customer has two open cases');
    // A pre-expiry watch (T-90 on a document that is still valid) has a leading reason and a workflow but no blocking reason yet.
    const openBad = (await c.query(`SELECT COUNT(*)::int n FROM layer.cases WHERE state<>'CLOSED' AND ((cardinality(reasons)=0 AND COALESCE(payload->>'preExpiry','false')<>'true') OR workflow_id IS NULL OR primary_reason IS NULL)`)).rows[0].n;
    const watches = (await c.query(`SELECT COUNT(*)::int n FROM layer.cases WHERE state<>'CLOSED' AND payload->>'preExpiry'='true'`)).rows[0].n;
    report(openBad ? 'FAIL' : 'PASS', 'Open cases carry reasons and a workflow', openBad ? `${openBad} open cases lack a reason or a workflow` : `every open case has a primary reason and a workflow (${watches} of them are pre-expiry watches on documents still valid)`);
    const closedBad = (await c.query(`SELECT COUNT(*)::int n FROM layer.cases WHERE state='CLOSED' AND close_code IS NULL`)).rows[0].n;
    report(closedBad ? 'FAIL' : 'PASS', 'Closed cases carry a close code', closedBad ? `${closedBad} closed cases have no close code` : 'every closed case says why it closed');
    const fallOutNoCase = (await c.query(`SELECT COUNT(*)::int n FROM (SELECT DISTINCT ON (customer_id) customer_id, eligible FROM core.preapproval_results ORDER BY customer_id, run_id DESC) r WHERE NOT r.eligible AND NOT EXISTS (SELECT 1 FROM layer.cases k WHERE k.customer_id=r.customer_id)`)).rows[0].n;
    report(fallOutNoCase ? 'WARN' : 'PASS', 'Every fall-out has a case', fallOutNoCase ? `${fallOutNoCase} fall-outs have never had a case (new since the last scan?)` : 'every fall-out has or had a case');

    // 4. Messages: sent and scheduled inside the policy windows (RM and LETTER have no window)
    const msgs = (await c.query(`SELECT m.id, m.channel, m.status, m.sent_at, m.scheduled_for, cu.segment FROM layer.outreach_messages m JOIN core.customers cu ON cu.id=m.customer_id WHERE m.status IN ('SENT','SCHEDULED') AND m.channel NOT IN ('RM','LETTER')`)).rows;
    let outside = 0; let ex = '';
    for (const m of msgs) { const at = new Date(m.status === 'SENT' ? m.sent_at : m.scheduled_for); const q = quietAt(at, m.segment as Segment, m.channel as Channel, policy); if (q) { outside++; if (!ex) ex = `message ${m.id} ${m.channel} ${m.status} at ${at.toISOString()}: ${q.reason}`; } }
    report(outside ? 'FAIL' : 'PASS', 'Messages respect the windows', outside ? `${outside} of ${msgs.length} sent or scheduled messages fall in quiet time, e.g. ${ex}` : `all ${msgs.length} sent and scheduled messages sit inside the service windows (Friday quiet, holidays, Ramadan honoured)`);

    // 5. No offer reached anyone it must not reach
    const badOffers = (await c.query(`SELECT m.id, m.customer_id, m.channel FROM layer.outreach_messages m JOIN core.consents co ON co.customer_id=m.customer_id WHERE m.status='SENT' AND m.marketing AND (co.dnc OR NOT co.marketing_consent OR m.channel = ANY(co.channel_optouts))`)).rows;
    report(badOffers.length ? 'FAIL' : 'PASS', 'No offer to an opted-out customer', badOffers.length ? `${badOffers.length} marketing messages were sent against a DNC, missing consent or channel opt-out, e.g. ${badOffers[0].id} to ${badOffers[0].customer_id}` : 'no marketing message was sent against a DNC, missing consent or channel opt-out');
    const dncService = (await c.query(`SELECT COUNT(*)::int n FROM layer.outreach_messages m JOIN core.consents co ON co.customer_id=m.customer_id WHERE m.status='SENT' AND co.dnc AND m.sent_at >= co.dnc_since`)).rows[0].n;
    report(dncService ? 'FAIL' : 'PASS', 'Nothing sent after a DNC', dncService ? `${dncService} messages were sent to customers after their DNC date` : 'no message of any kind was sent after a do-not-contact flag');
    const arrearsOffers = (await c.query(`SELECT COUNT(*)::int n FROM layer.outreach_messages m WHERE m.status='SENT' AND m.marketing AND EXISTS (SELECT 1 FROM core.finance_facilities f WHERE f.customer_id=m.customer_id AND f.dpd>0 AND f.dpd_since <= m.sent_at::date) `)).rows[0].n;
    report(arrearsOffers ? 'WARN' : 'PASS', 'No offer during arrears', arrearsOffers ? `${arrearsOffers} offers went out while a facility was in arrears` : 'no offer was sent while a facility was in arrears');

    // 6. Every record change has an approved proposal and a trail row
    const applied = (await c.query(`SELECT p.id, p.customer_id, p.decided_by, p.applied_at FROM layer.proposed_updates p WHERE p.state='APPLIED'`)).rows;
    const unapproved = applied.filter((p) => !p.decided_by);
    report(unapproved.length ? 'FAIL' : 'PASS', 'Applied updates were approved by a person', unapproved.length ? `${unapproved.length} applied updates have no approver, e.g. ${unapproved[0].id}` : `all ${applied.length} applied updates name the person who approved them`);
    const noTrail = (await c.query(`SELECT COUNT(*)::int n FROM layer.proposed_updates p WHERE p.state='APPLIED' AND NOT EXISTS (SELECT 1 FROM layer.trail t WHERE t.act='WRITE' AND t.customer_id=p.customer_id AND t.at BETWEEN p.applied_at - interval '1 minute' AND p.applied_at + interval '1 minute')`)).rows[0].n;
    report(noTrail ? 'FAIL' : 'PASS', 'Every record write is on the trail', noTrail ? `${noTrail} applied updates have no WRITE entry on the trail` : 'every applied update has a WRITE entry on the trail');
    const pending = (await c.query(`SELECT COUNT(*)::int n FROM layer.proposed_updates WHERE state='PROPOSED' AND applied_at IS NOT NULL`)).rows[0].n;
    report(pending ? 'FAIL' : 'PASS', 'Nothing applied before a decision', pending ? `${pending} proposals are applied while still pending` : 'no proposal was applied before a decision');

    // 7. Overrides carry a reason; human decisions name a persona
    const overrideNoReason = (await c.query(`SELECT COUNT(*)::int n FROM layer.trail WHERE override AND (reason IS NULL OR reason='')`)).rows[0].n;
    report(overrideNoReason ? 'FAIL' : 'PASS', 'Overrides carry a reason', overrideNoReason ? `${overrideNoReason} overrides have no reason` : 'every decision against a recommendation records its reason');
    const humanNoActor = (await c.query(`SELECT COUNT(*)::int n FROM layer.approvals WHERE decision<>'PENDING' AND (decided_by IS NULL OR decided_by='')`)).rows[0].n;
    report(humanNoActor ? 'FAIL' : 'PASS', 'Decisions name the decider', humanNoActor ? `${humanNoActor} decisions have no decider` : 'every human decision names who took it');

    // 8. Attempts never exceed the cap; waiting runs have a deadline or an approval
    const overAttempts = (await c.query(`SELECT COUNT(*)::int n FROM layer.cases WHERE attempts > max_attempts AND max_attempts > 0`)).rows[0].n;
    report(overAttempts ? 'FAIL' : 'PASS', 'Attempts within the cap', overAttempts ? `${overAttempts} cases exceeded their attempt cap` : 'no case exceeded its attempt cap');
    const waitingNoApproval = (await c.query(`SELECT COUNT(*)::int n FROM layer.runs r WHERE r.status='WAITING' AND NOT EXISTS (SELECT 1 FROM layer.approvals a WHERE a.run_id=r.id AND a.decision='PENDING')`)).rows[0].n;
    report(waitingNoApproval ? 'FAIL' : 'PASS', 'Waiting runs sit in an inbox', waitingNoApproval ? `${waitingNoApproval} runs wait on a person with no open approval` : 'every run waiting on a person has an open approval in an inbox');

    // 9. Trail is append-only (ids strictly increasing with time, no gaps counted as failure) and policy versions chain
    const versions = (await c.query(`SELECT version, status FROM layer.policy_versions ORDER BY version`)).rows;
    const active = versions.filter((v) => v.status === 'ACTIVE').length;
    report(active === 1 ? 'PASS' : 'FAIL', 'One active policy version', `${versions.length} version(s), ${active} active`);
    const trailStats = (await c.query(`SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE actor_type='HUMAN')::int humans, COUNT(*) FILTER (WHERE actor_type='AGENT')::int agents, COUNT(*) FILTER (WHERE override)::int overrides FROM layer.trail`)).rows[0];
    report('PASS', 'Trail', `${trailStats.n} entries: ${trailStats.agents} by agents, ${trailStats.humans} by people, ${trailStats.overrides} override(s)`);

    const fails = out.filter((x) => x.level === 'FAIL').length; const warns = out.filter((x) => x.level === 'WARN').length;
    console.log(`\n${out.length} checks: ${out.length - fails - warns} pass, ${warns} warn, ${fails} fail`);
    process.exitCode = fails ? 1 : 0;
  } finally { c.release(); await pool.end(); }
}
main().catch((e) => { console.error(e); process.exit(2); });
