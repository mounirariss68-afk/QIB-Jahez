# Jahiz — One Click readiness for Qatar Islamic Bank (demo prototype)

QIB pre-approves existing customers for finance and offers it in the app with one tap ("One Click Finance"). Only about 35% of customers qualify; the rest fall out for one of twenty reasons, from an expired Qatar ID to an employer the bank has not approved. Jahiz is the agentic layer that keeps that base ready: it checks every customer nightly against the bank's own eligibility rules, works out why each one fell out, asks the customer for exactly the one thing that is missing (through the QIB app first), reads what comes back, proposes the record change for a person to approve, re-qualifies the customer and hands the One Click offer back to the app. Everything it may do is a setting; everything it does is on an append-only trail.

**Agents check, prepare and recommend; people decide.** No record in the simulated core bank changes without a person's approval, and every write goes through one connector that logs what the real system would have been asked.

**Data:** every customer, document, employer, figure and name is fictional and generated for this demo; every identifier starts with `DEMO-`. The core bank, the channels (push, in-app, SMS, e-mail, letter) and One Click itself are simulated behind adapters.

## Run it on Replit (no terminal needed)

1. **Import.** Go to replit.com/import, choose **ZIP**, upload `qib-jahiz.zip` and press **Import**.
2. **Paste `REPLIT-PROMPT.md` into Replit's Agent.** The Agent creates the PostgreSQL database (Replit sets `DATABASE_URL`), confirms the Anthropic connection and starts the app. If Replit asks to use **Replit AI Integrations** for this app, choose **Approve**. The prompt tells the Agent not to change any code and not to add any API key.
3. **Wait for the first start** (two to three minutes: install, build, generate the synthetic world of 2,400 customers, replay sixty days of history through the engine). The web view shows a waiting message until the console prints `Jahiz is running on port 5000`. Later starts take seconds.
4. **Open the web view.** It opens as Khalid Al-Mannai, Head of Retail Credit. The persona menu (top right) switches to any of the eight people; **Scenarios** (left menu) runs the six scripted productions.

**Claude.** Five agents use Claude through Replit's built-in Anthropic connection (Replit AI Integrations), which Replit bills against the workspace's credits; the app stores no API key. The server reads `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` and `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (and would also honour the SDK's standard `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` if a platform exposed the connection that way). It uses the first model the connection accepts, in this order: `claude-sonnet-4-6`, `claude-sonnet-4-5`, `claude-opus-4-6`, `claude-haiku-4-5`. Settings shows which connection and model are in use. Only if no connection is present at all do the Claude steps run in *Offline* mode (fixed, deterministic answers from the same data, labelled "Offline" on screen).

**Reset the demo** is on Settings (Synthetic data → Reset). It rebuilds the world in about a minute. Each scenario also restores its own customers to the seeded state when it starts, so any scenario can be run again at any time.

## Running the demo

The **Director bar** docks at the bottom of the screen when a scenario starts. Every step names its trigger, runs a real engine action (nothing is pre-recorded), switches to the screen and the persona that step is about, opens the record and lists what changed, with the changed rows flashing on screen. Step, go back, auto-play (9 s per step) or stop. The **Activity console** (top bar) streams every trigger → agent → action → result on any screen, independent of the Director.

| Scenario | Shape | What it shows |
|---|---|---|
| S1 QID renewed in a day | happy path | Nightly scan opens the case → push and in-app request → the customer uploads the renewed QID in the app → Fahis reads it (Claude or Offline) and proposes the update → the checker approves in one click → Muhaddith writes the record → Muahil re-qualifies → the offer lands on the phone → the trail. |
| S2 New job, new employer | bank action with leverage | A salary gap explained with an HR letter and accepted by Credit Policy; then one employer approval re-qualifies fourteen customers at once. |
| S3 The RM's client | refusal | Hami blocks the queued SMS and push to a client who became Tamayuz (HNWI) after scheduling, and says which clause; the RM gets a brief instead. A Mass customer replies STOP: the offer push is blocked, the service e-mail still goes. |
| S4 Nobody answers / wrong document | escalation and exception | Thirty days pass on the virtual clock: notices, deadline, escalation, the T+90 restriction proposal and the Supervisor's decision with a reason; then a document that belongs to someone else is rejected and re-requested. |
| S5 The collections boundary | boundary | A missed instalment pauses the case and suppresses offers; a payment starts the cooling period; a customer past 30 DPD is handed to Collections, who acknowledge. |
| S6 Change the rule | governance | The Supervisor proposes a shorter reminder interval for Mass; the Head approves; policy v2 is active and every scheduled reminder is re-planned. |

Other things worth showing by hand: **Customer app** (any customer's phone, with the push, the secure message, upload and reply — what the customer does there enters the inbound pipeline as a real app event would); **Communications → Mailbox simulator** (the e-mail channel, with a reply composer); **Triggers** (fire the scan, the due messages or the clock yourself); **Policies** (every parameter per segment, the clauses the agents cite, the versions); **Dalil** (the rail on the left: ask why a customer is not eligible, what is waiting on you, what Hami blocked, what a policy says; it answers from the same data the screens use, cites the clause and prepares actions for you to confirm).

## What's real and what's simulated

- **Real:** the eligibility arithmetic (the twenty reasons, the capacity and cap calculation, the annuity factor, the tenor rules), the policy model (about a hundred parameters in ten domains with per-segment values, versioned, with an approver per domain), the guard (Hami: do-not-contact, consent, channel opt-outs, status, arrears, segment channel rules, RM approval, service windows, Friday and holidays, Ramadan, contact caps), the workflow engine with its human steps and approvals, the maker-checker on every record write, the calendar, the templates in English and Arabic, the audit trail and the integration log. With Replit AI Integrations connected: Dalil's conversation, Mustaqbil's classification of free-text replies, Fahis's reading of documents (text for the synthetic specimens, vision for a real image uploaded in the customer app), and the drafts Munadi and Muwathiq prepare for a person. Everything that *decides* is deterministic.
- **Simulated:** the core bank is a Postgres schema (`core`) reached only through `apps/server/src/core/connector.ts`, which logs the calls the real system would receive; the salary run on the 25th and the ageing of arrears move with the virtual clock. The channels write to the customer's phone and mailbox inside the prototype. A Microsoft Graph adapter for a shared mailbox is stubbed with the variables it would need (`GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_MAILBOX`) and is not wired live. Decisions a scenario takes on a person's behalf are stamped "(decided by the scenario)" on the trail.
- **Not in this version:** an Arabic UI for the bank's staff (customer-facing content is bilingual; the staff screens are English), real document capture with liveness, WhatsApp, a live One Click integration, and anything QIB has not yet confirmed (see `design/DESIGN.md` §17 and §19 — every open question ships as a setting with a defensible default).

## The twenty reasons and the four classes

Class A, ask the customer: missing or low salary credits, missing employer, standing orders, expired passport, expired QID, no current account, dormant or KYC-blocked status. Class B, the bank must act: unapproved employer, exposure above the limit, cautionary notes. Class C, not eligible by policy: age, tenor, restricted nationality, model cut-off, rating, segment exclusions, the Auto Ijara cut-off. Class D, the collections boundary: arrears at 1–30 days, over 30 days, returned cheques, card restrictions. The class decides whether the customer is contacted at all; the full table, the evidence per reason and the re-check rules are in `design/DESIGN.md` §3 and on the Policies screen.

## The ten agents

Raqib (scan and data health) · Munadi (outreach planning) · Mustaqbil (inbound triage) · Fahis (document examiner) · Muhaddith (record updater, maker-checker) · Muwathiq (employer verification pack) · Muahil (re-qualify and hand off to One Click) · Munabbih (early arrears) · Hami (the policy guard every message passes) · Dalil (the chat agent). Each has an autonomy rung per segment (A1 prepares, A2 recommends, A3 acts within policy); the Agents screen shows the rung, the functions, the clauses it cites and its trail.

## Project layout

```
apps/server            Express 5 API, workflow engine, agents, channels, customer-app API, Director, Dalil, seed (TypeScript, run with tsx)
  src/core/connector.ts   the only module that reads or writes the simulated core bank
  src/engine/             runs, steps, approvals, decide/resume, the trail
  src/agents/             one file per agent
  src/seed/               generator, edge cases, sixty-day replay, seeded-state snapshot
  src/tools/check-world.ts  `npm run check`: 21 arithmetic and policy checks over the live world
apps/web               React 19 / Vite 7 / Tailwind 4 on the Cognirise Atelier design system
packages/domain        reasons, eligibility, policy catalogue, calendar, guard, templates, agents, workflows, personas, scenarios
packages/design-system Atelier, rebranded for QIB
db/schema.sql          core (simulated bank) and layer (the agentic layer)
design/DESIGN.md       the design (v2); research/ the regulatory and practice notes it rests on
```

Environment: `DATABASE_URL` (set by Replit's Database tool), `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` and `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (set by Replit AI Integrations), `PORT` (5000 on Replit). Nothing else.
