/** Layer seed: policy version 1, the clauses, the triggers, meta. */
import type { PoolClient } from 'pg';
import { CLAUSES, defaultParams } from '@jahiz/domain';
import { insertMany, setMeta } from '../db.js';
import { now } from '../clock.js';

export async function seedLayer(c: PoolClient, edge: Record<string, string>, seed: number) {
  await c.query(`INSERT INTO layer.policy_versions (version, status, proposed_by, approved_by, proposed_at, approved_at, effective_from, params, diff, rationale) VALUES (1,'ACTIVE','head','head',$1,$1,$1,$2,'[]','Design defaults (v1). Every value is a setting; QIB’s answers replace them on screen.')`, [now(), JSON.stringify(defaultParams())]);
  await insertMany(c, 'layer.policy_clauses', CLAUSES.map((k) => ({ id: k.id, domain: k.domain, heading: k.heading, heading_ar: k.heading_ar, text_en: k.text, text_ar: k.text_ar, basis: k.basis, tags: k.tags })));
  await c.query(`UPDATE layer.policy_clauses SET search = to_tsvector('english', heading || ' ' || text_en || ' ' || array_to_string(tags, ' '))`);
  await insertMany(c, 'layer.triggers', [
    { key: 'scan', label: 'Nightly data-health scan', label_ar: 'الفحص الليلي', kind: 'SCHEDULE', schedule: '02:00 Doha daily; on demand', last_fired_at: null, next_fire_at: null, fired_count: 0, last_result: null },
    { key: 'due', label: 'Due messages (through Hami)', label_ar: 'الرسائل المستحقة', kind: 'SCHEDULE', schedule: 'Every 15 minutes inside the service windows', last_fired_at: null, next_fire_at: null, fired_count: 0, last_result: null },
    { key: 'timeout', label: 'Reply deadlines and T+N waits', label_ar: 'مواعيد الرد', kind: 'SCHEDULE', schedule: 'Hourly', last_fired_at: null, next_fire_at: null, fired_count: 0, last_result: null },
    { key: 'recheck', label: 'Scheduled re-checks', label_ar: 'إعادة الفحص المجدولة', kind: 'SCHEDULE', schedule: '02:30 Doha daily', last_fired_at: null, next_fire_at: null, fired_count: 0, last_result: null },
    { key: 'inbound_app', label: 'Customer app events', label_ar: 'أحداث تطبيق العميل', kind: 'EVENT', schedule: 'On upload, reply, acceptance (POST /api/customer/…)', last_fired_at: null, next_fire_at: null, fired_count: 0, last_result: null },
    { key: 'inbound_mail', label: 'Inbound mail poll', label_ar: 'استطلاع البريد الوارد', kind: 'EVENT', schedule: 'Mailbox simulator now; Microsoft Graph poll every 5 minutes in production (stubbed)', last_fired_at: null, next_fire_at: null, fired_count: 0, last_result: null },
    { key: 'record_change', label: 'Approved record change', label_ar: 'تغيير معتمد في السجل', kind: 'EVENT', schedule: 'On every approved update → re-qualification', last_fired_at: null, next_fire_at: null, fired_count: 0, last_result: null },
    { key: 'policy_change', label: 'Policy version activated', label_ar: 'تفعيل إصدار سياسة', kind: 'EVENT', schedule: 'On approval → re-plan', last_fired_at: null, next_fire_at: null, fired_count: 0, last_result: null },
    { key: 'clock', label: 'Virtual clock', label_ar: 'الساعة الافتراضية', kind: 'DEMO', schedule: 'Advance by a day, a week or thirty days', last_fired_at: null, next_fire_at: null, fired_count: 0, last_result: null },
  ]);
  await setMeta(c, 'edge_cases', edge);
  await setMeta(c, 'seed', { seed, at: new Date().toISOString(), engine: 'jahiz-1.0' });
}
