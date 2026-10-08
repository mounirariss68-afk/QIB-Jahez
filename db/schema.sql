-- Jahiz — two schemas, as in Tasama HR.
--   core  : the simulated QIB customer database (what the bank already has). Only
--           apps/server/src/core/connector.ts reads or writes it.
--   layer : Jahiz's own store — cases, messages, documents, proposals, policies, trail.
-- Everything is synthetic; every fabricated identifier carries the DEMO- prefix.

DROP SCHEMA IF EXISTS core CASCADE;
DROP SCHEMA IF EXISTS layer CASCADE;
CREATE SCHEMA core;
CREATE SCHEMA layer;

-- ======================================================================= core
CREATE TABLE core.employers (
  id TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_ar TEXT NOT NULL, sector TEXT NOT NULL, cr_number TEXT, cr_valid_to DATE,
  wps_active BOOLEAN NOT NULL DEFAULT TRUE, headcount_band TEXT NOT NULL, headcount INT NOT NULL, months_operating INT NOT NULL,
  approval_status TEXT NOT NULL, approved_on DATE, finance_history TEXT
);
CREATE TABLE core.rms (id TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_ar TEXT NOT NULL, tier TEXT NOT NULL, persona_key TEXT);
CREATE TABLE core.customers (
  id TEXT PRIMARY KEY, rim_no TEXT NOT NULL, name_en TEXT NOT NULL, name_ar TEXT NOT NULL, dob DATE NOT NULL, gender TEXT NOT NULL,
  nationality TEXT NOT NULL, is_qatari BOOLEAN NOT NULL, segment TEXT NOT NULL, segment_tag TEXT, private_banking BOOLEAN NOT NULL DEFAULT FALSE,
  rm_id TEXT REFERENCES core.rms(id), status TEXT NOT NULL, status_since DATE, language_pref TEXT NOT NULL, joined_on DATE NOT NULL,
  risk_rating TEXT NOT NULL, internal_rating TEXT NOT NULL, model_score NUMERIC(5,3) NOT NULL, auto_ijara_score NUMERIC(5,3) NOT NULL,
  deposits NUMERIC(14,2) NOT NULL DEFAULT 0, card_restricted BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE core.identity_documents (
  id SERIAL PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES core.customers(id), type TEXT NOT NULL, number TEXT NOT NULL,
  issued_on DATE, expires_on DATE NOT NULL, verified_on DATE, source TEXT NOT NULL, current BOOLEAN NOT NULL DEFAULT TRUE, image_ref TEXT
);
CREATE INDEX ON core.identity_documents (customer_id, type, current);
CREATE TABLE core.contacts (
  customer_id TEXT PRIMARY KEY REFERENCES core.customers(id), mobile TEXT NOT NULL, email TEXT NOT NULL, address_en TEXT, address_ar TEXT,
  app_registered BOOLEAN NOT NULL, push_enabled BOOLEAN NOT NULL, last_app_login DATE
);
CREATE TABLE core.consents (
  customer_id TEXT PRIMARY KEY REFERENCES core.customers(id), marketing_consent BOOLEAN NOT NULL, marketing_since DATE,
  channel_optouts TEXT[] NOT NULL DEFAULT '{}', dnc BOOLEAN NOT NULL DEFAULT FALSE, dnc_since DATE, dnc_reason TEXT, dnc_until DATE, bureau_consent_on DATE
);
CREATE TABLE core.employment (
  customer_id TEXT PRIMARY KEY REFERENCES core.customers(id), employer_id TEXT REFERENCES core.employers(id), employer_name_raw TEXT, job_title TEXT,
  since DATE, salary_basic NUMERIC(12,2) NOT NULL, salary_allowances NUMERIC(12,2) NOT NULL, social_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_total NUMERIC(12,2) NOT NULL, salary_certificate_on DATE, salary_bank TEXT NOT NULL DEFAULT 'QIB'
);
CREATE TABLE core.salary_credits (
  id SERIAL PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES core.customers(id), month TEXT NOT NULL, amount NUMERIC(12,2) NOT NULL,
  source_tag TEXT NOT NULL DEFAULT 'SALARY', credited_on DATE NOT NULL, employer_ref TEXT, explained_reason TEXT
);
CREATE INDEX ON core.salary_credits (customer_id, month);
CREATE TABLE core.accounts (
  id SERIAL PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES core.customers(id), type TEXT NOT NULL, iban TEXT NOT NULL, opened_on DATE NOT NULL,
  status TEXT NOT NULL, last_txn_on DATE, balance NUMERIC(14,2) NOT NULL
);
CREATE INDEX ON core.accounts (customer_id);
CREATE TABLE core.finance_facilities (
  id SERIAL PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES core.customers(id), product TEXT NOT NULL, principal NUMERIC(14,2) NOT NULL,
  outstanding NUMERIC(14,2) NOT NULL, repayable NUMERIC(14,2) NOT NULL, instalment NUMERIC(12,2) NOT NULL, start_on DATE NOT NULL, maturity DATE NOT NULL,
  dpd INT NOT NULL DEFAULT 0, dpd_since DATE, late_payments_6m INT NOT NULL DEFAULT 0, schedule_irregular BOOLEAN NOT NULL DEFAULT FALSE, restructured_on DATE, last_paid_on DATE
);
CREATE INDEX ON core.finance_facilities (customer_id);
CREATE TABLE core.cards (
  id SERIAL PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES core.customers(id), card_limit NUMERIC(12,2) NOT NULL, outstanding NUMERIC(12,2) NOT NULL,
  min_due NUMERIC(12,2) NOT NULL, dpd INT NOT NULL DEFAULT 0, dpd_since DATE, status TEXT NOT NULL
);
CREATE INDEX ON core.cards (customer_id);
CREATE TABLE core.standing_orders (
  id SERIAL PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES core.customers(id), beneficiary_type TEXT NOT NULL, beneficiary_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL, frequency TEXT NOT NULL DEFAULT 'MONTHLY', customer_classification TEXT, classified_on DATE
);
CREATE INDEX ON core.standing_orders (customer_id);
CREATE TABLE core.cheques_returned (
  id SERIAL PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES core.customers(id), returned_on DATE NOT NULL, amount NUMERIC(12,2) NOT NULL, settled_on DATE
);
CREATE TABLE core.cautionary_notes (
  id SERIAL PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES core.customers(id), type TEXT NOT NULL, set_on DATE NOT NULL, set_by TEXT NOT NULL,
  lifting_condition TEXT NOT NULL, lifted_on DATE, lifted_by TEXT
);
CREATE INDEX ON core.cautionary_notes (customer_id);
CREATE TABLE core.preapproval_runs (
  id SERIAL PRIMARY KEY, run_at TIMESTAMPTZ NOT NULL, as_of DATE NOT NULL, engine_version TEXT NOT NULL, policy_version INT NOT NULL,
  customers_checked INT NOT NULL, eligible_count INT NOT NULL, new_fallouts INT NOT NULL DEFAULT 0, cured INT NOT NULL DEFAULT 0, trigger TEXT NOT NULL
);
CREATE TABLE core.preapproval_results (
  id SERIAL PRIMARY KEY, run_id INT NOT NULL REFERENCES core.preapproval_runs(id) ON DELETE CASCADE, customer_id TEXT NOT NULL REFERENCES core.customers(id),
  eligible BOOLEAN NOT NULL, eligible_vehicle BOOLEAN NOT NULL, amount NUMERIC(14,2), reason_codes TEXT[] NOT NULL, cls TEXT, inputs JSONB NOT NULL, checks JSONB NOT NULL
);
CREATE INDEX ON core.preapproval_results (customer_id, run_id);
-- The customer's phone and mailbox, as the channel adapters deliver into them (simulated QIB Mobile and e-mail).
CREATE TABLE core.device_inbox (
  id SERIAL PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES core.customers(id), channel TEXT NOT NULL, kind TEXT NOT NULL, at TIMESTAMPTZ NOT NULL,
  subject TEXT, body TEXT NOT NULL, lang TEXT NOT NULL, ref TEXT, message_id INT, read_at TIMESTAMPTZ, meta JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX ON core.device_inbox (customer_id, at);

-- ====================================================================== layer
CREATE TABLE layer.meta (key TEXT PRIMARY KEY, value JSONB NOT NULL);
CREATE TABLE layer.policy_versions (
  id SERIAL PRIMARY KEY, version INT NOT NULL UNIQUE, status TEXT NOT NULL, proposed_by TEXT, approved_by TEXT, proposed_at TIMESTAMPTZ, approved_at TIMESTAMPTZ,
  effective_from TIMESTAMPTZ, params JSONB NOT NULL, diff JSONB NOT NULL DEFAULT '[]', rationale TEXT, preview JSONB
);
CREATE TABLE layer.policy_clauses (
  id TEXT PRIMARY KEY, domain TEXT NOT NULL, heading TEXT NOT NULL, heading_ar TEXT NOT NULL, text_en TEXT NOT NULL, text_ar TEXT NOT NULL, basis TEXT NOT NULL,
  tags TEXT[] NOT NULL, search TSVECTOR
);
CREATE INDEX ON layer.policy_clauses USING GIN (search);
CREATE SEQUENCE layer.case_seq START 1;
CREATE TABLE layer.cases (
  id SERIAL PRIMARY KEY, ref TEXT NOT NULL UNIQUE, customer_id TEXT NOT NULL REFERENCES core.customers(id), cls TEXT NOT NULL, state TEXT NOT NULL,
  reasons TEXT[] NOT NULL, primary_reason TEXT, workflow_id TEXT, opened_at TIMESTAMPTZ NOT NULL, closed_at TIMESTAMPTZ, close_code TEXT,
  owner_persona TEXT, rm_id TEXT, attempts INT NOT NULL DEFAULT 0, max_attempts INT NOT NULL DEFAULT 0, next_action_at TIMESTAMPTZ, recheck_on DATE, recheck_reason TEXT,
  paused BOOLEAN NOT NULL DEFAULT FALSE, pause_reason TEXT, edge_key TEXT, scenario_key TEXT, payload JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON layer.cases (customer_id, state);
CREATE TABLE layer.case_reasons (id SERIAL PRIMARY KEY, case_id INT NOT NULL REFERENCES layer.cases(id) ON DELETE CASCADE, reason_code TEXT NOT NULL, detected_on DATE NOT NULL, cleared_on DATE);
CREATE TABLE layer.case_events (id SERIAL PRIMARY KEY, case_id INT NOT NULL REFERENCES layer.cases(id) ON DELETE CASCADE, at TIMESTAMPTZ NOT NULL, from_state TEXT, to_state TEXT NOT NULL, actor TEXT NOT NULL, note TEXT);
CREATE TABLE layer.runs (
  id SERIAL PRIMARY KEY, case_id INT REFERENCES layer.cases(id) ON DELETE CASCADE, workflow_id TEXT NOT NULL, title TEXT NOT NULL, title_ar TEXT NOT NULL,
  status TEXT NOT NULL, current_step TEXT, waiting_on_persona TEXT, waiting_event TEXT, sla_due TIMESTAMPTZ, payload JSONB NOT NULL DEFAULT '{}', result JSONB NOT NULL DEFAULT '{}',
  channel TEXT NOT NULL, scenario_key TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, closed_at TIMESTAMPTZ
);
CREATE INDEX ON layer.runs (case_id, status);
CREATE INDEX ON layer.runs (status, waiting_on_persona);
CREATE TABLE layer.run_steps (
  id SERIAL PRIMARY KEY, run_id INT NOT NULL REFERENCES layer.runs(id) ON DELETE CASCADE, seq INT NOT NULL, step_key TEXT NOT NULL, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL,
  label TEXT NOT NULL, label_ar TEXT NOT NULL, status TEXT NOT NULL, started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, outputs JSONB NOT NULL DEFAULT '{}', decision TEXT
);
CREATE INDEX ON layer.run_steps (run_id, seq);
CREATE TABLE layer.approvals (
  id SERIAL PRIMARY KEY, run_id INT NOT NULL REFERENCES layer.runs(id) ON DELETE CASCADE, step_key TEXT NOT NULL, approver_persona TEXT NOT NULL, action_type TEXT NOT NULL,
  decision TEXT NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL, decided_at TIMESTAMPTZ, decided_by TEXT
);
CREATE INDEX ON layer.approvals (approver_persona, decision);
CREATE TABLE layer.outreach_messages (
  id SERIAL PRIMARY KEY, case_id INT REFERENCES layer.cases(id) ON DELETE SET NULL, run_id INT, customer_id TEXT NOT NULL REFERENCES core.customers(id), channel TEXT NOT NULL,
  template_key TEXT NOT NULL, message_type TEXT NOT NULL, marketing BOOLEAN NOT NULL DEFAULT FALSE, lang TEXT NOT NULL, attempt INT NOT NULL DEFAULT 1,
  scheduled_for TIMESTAMPTZ NOT NULL, window_used TEXT, sent_at TIMESTAMPTZ, status TEXT NOT NULL, block_reason TEXT, block_clause TEXT, policy_version INT NOT NULL,
  subject TEXT NOT NULL, body TEXT NOT NULL, approved_by TEXT, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, meta JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX ON layer.outreach_messages (status, scheduled_for);
CREATE INDEX ON layer.outreach_messages (customer_id, scheduled_for);
CREATE TABLE layer.inbound_messages (
  id SERIAL PRIMARY KEY, case_id INT REFERENCES layer.cases(id) ON DELETE SET NULL, customer_id TEXT REFERENCES core.customers(id), channel TEXT NOT NULL, received_at TIMESTAMPTZ NOT NULL,
  from_addr TEXT, subject TEXT, body TEXT NOT NULL, attachments JSONB NOT NULL DEFAULT '[]', classification TEXT, confidence NUMERIC(4,3), mode TEXT, routed_to TEXT,
  matched_by TEXT, state TEXT NOT NULL DEFAULT 'NEW'
);
CREATE INDEX ON layer.inbound_messages (customer_id, received_at);
CREATE TABLE layer.documents (
  id SERIAL PRIMARY KEY, inbound_id INT REFERENCES layer.inbound_messages(id) ON DELETE SET NULL, case_id INT REFERENCES layer.cases(id) ON DELETE SET NULL,
  customer_id TEXT NOT NULL REFERENCES core.customers(id), type TEXT NOT NULL, image_ref TEXT NOT NULL, specimen_key TEXT, received_at TIMESTAMPTZ NOT NULL,
  source JSONB NOT NULL DEFAULT '{}', extracted JSONB, confidence JSONB, verification JSONB, overall_confidence NUMERIC(4,3), assurance TEXT NOT NULL, mode TEXT, state TEXT NOT NULL, recommendation TEXT, examined_at TIMESTAMPTZ, flags TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX ON layer.documents (customer_id, state);
CREATE TABLE layer.proposed_updates (
  id SERIAL PRIMARY KEY, document_id INT REFERENCES layer.documents(id) ON DELETE SET NULL, case_id INT REFERENCES layer.cases(id) ON DELETE SET NULL, run_id INT,
  customer_id TEXT NOT NULL REFERENCES core.customers(id), target TEXT NOT NULL, field TEXT NOT NULL, old_value TEXT, new_value TEXT, confidence NUMERIC(4,3),
  proposed_by TEXT NOT NULL, proposed_at TIMESTAMPTZ NOT NULL, state TEXT NOT NULL, decided_by TEXT, decided_at TIMESTAMPTZ, reason TEXT, applied_at TIMESTAMPTZ, one_click BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX ON layer.proposed_updates (customer_id, state);
CREATE TABLE layer.employer_reviews (
  id SERIAL PRIMARY KEY, employer_id TEXT NOT NULL REFERENCES core.employers(id), run_id INT, pack JSONB NOT NULL, recommendation TEXT NOT NULL, narrative TEXT, mode TEXT,
  state TEXT NOT NULL, opened_at TIMESTAMPTZ NOT NULL, decided_by TEXT, decided_at TIMESTAMPTZ, reason TEXT, affected_customers INT NOT NULL
);
CREATE TABLE layer.tasks (
  id SERIAL PRIMARY KEY, kind TEXT NOT NULL, case_id INT REFERENCES layer.cases(id) ON DELETE CASCADE, run_id INT, customer_id TEXT REFERENCES core.customers(id),
  assignee_persona TEXT NOT NULL, title TEXT NOT NULL, title_ar TEXT NOT NULL, brief TEXT, brief_mode TEXT, due TIMESTAMPTZ, state TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, done_at TIMESTAMPTZ, outcome TEXT
);
CREATE INDEX ON layer.tasks (assignee_persona, state);
CREATE TABLE layer.trail (
  id SERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, autonomy TEXT, act TEXT NOT NULL,
  case_id INT, case_ref TEXT, customer_id TEXT, run_id INT, policy_version INT, clause TEXT, channel TEXT, before JSONB, after JSONB, override BOOLEAN NOT NULL DEFAULT FALSE, reason TEXT,
  evidence_ref TEXT, summary TEXT NOT NULL, summary_ar TEXT NOT NULL, scenario_key TEXT
);
CREATE INDEX ON layer.trail (at DESC);
CREATE INDEX ON layer.trail (customer_id);
CREATE INDEX ON layer.trail (case_id);
CREATE TABLE layer.activity (
  id SERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL, trigger TEXT NOT NULL, agent TEXT, action TEXT NOT NULL, result TEXT NOT NULL, autonomy TEXT, clause TEXT,
  case_ref TEXT, customer_id TEXT, scenario_key TEXT, step_id TEXT, changes JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX ON layer.activity (at DESC);
CREATE TABLE layer.triggers (
  key TEXT PRIMARY KEY, label TEXT NOT NULL, label_ar TEXT NOT NULL, kind TEXT NOT NULL, schedule TEXT NOT NULL, last_fired_at TIMESTAMPTZ, next_fire_at TIMESTAMPTZ, fired_count INT NOT NULL DEFAULT 0, last_result TEXT
);
CREATE TABLE layer.conversations (id SERIAL PRIMARY KEY, persona_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE layer.messages (
  id SERIAL PRIMARY KEY, conversation_id INT NOT NULL REFERENCES layer.conversations(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, mode TEXT,
  citations JSONB NOT NULL DEFAULT '[]', tool_calls JSONB NOT NULL DEFAULT '[]', pending JSONB, navigate TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE layer.integration_log (
  id SERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL, system TEXT NOT NULL, direction TEXT NOT NULL, verb TEXT NOT NULL, resource TEXT NOT NULL, status INT NOT NULL,
  note TEXT, ms INT, actor TEXT, run_id INT
);
CREATE INDEX ON layer.integration_log (at DESC);
-- Seeded-state snapshot of the named edge cases (and their employers), so a scenario can be run again from the state it was designed for.
CREATE TABLE layer.snapshot_rows (id SERIAL PRIMARY KEY, tbl TEXT NOT NULL, owner TEXT NOT NULL, row JSONB NOT NULL);
CREATE INDEX ON layer.snapshot_rows (owner, tbl);
CREATE TABLE layer.scenario_runs (
  id SERIAL PRIMARY KEY, key TEXT NOT NULL, status TEXT NOT NULL, step_index INT NOT NULL DEFAULT 0, started_at TIMESTAMPTZ NOT NULL, finished_at TIMESTAMPTZ, log JSONB NOT NULL DEFAULT '[]'
);
