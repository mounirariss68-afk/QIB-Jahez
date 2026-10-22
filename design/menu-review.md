# Menu review — QIB Jahiz against MENU-DISCIPLINE.md (21 October 2026)

Method: `templates/menu-review.md` of the Cognirise Prototype Canon, step 1 read from the code (`packages/domain/src/personas.ts`, `apps/web/src/App.tsx` ITEMS/PARENT/`steward` filter, every `screens/*.tsx` hero, panel and tab). Nothing is changed until the prototype owner has read this and given the go.

## Step 1 — What the code says

Jahiz has no lenses. One flat menu of twelve items in three groups (Work · Governance · Demo) is shown to every persona; the only filter is `steward: true`, which leaves the Data Steward seven items. Four more screens are route tabs under a hero (Data health under Overview; Employers under Customers; Workflows and Triggers & clock under Agents). The title bar carries eight things: brand with "One Click readiness · QIB (demo)", the date chip with VIRTUAL, the POLICY Vn chip, the Synthetic data chip, the theme toggle, Activity, Present, the persona. The assistant rail is open by default for everyone.

## Step 2 — Today, persona by persona

| Persona | Lenses | Items visible | Lands on |
|---|---|---|---|
| Head of Retail Credit | none | 12 | Overview |
| Credit Policy Officer | none | 12 | Inbox |
| Remediation Operations Officer (maker) | none | 12 | Inbox |
| Operations Supervisor (checker) | none | 12 | Inbox |
| Compliance & Data Protection Officer | none | 12 | Inbox |
| Relationship Manager | none | 12 | Inbox |
| Collections Officer | none | 12 | Inbox |
| Data Steward | none | 7 (Overview, Customers, Policies, Agents, Audit trail, Scenarios, Settings) | Data health |

Twelve items is over the eight the canon allows, and a Collections Officer sees Policies, Agents, Audit trail, Customer app, Scenarios and Settings that are not his work.

## Step 3 — The seven defects, with evidence

| # | Defect | Found where | Evidence |
|---|---|---|---|
| 1 | The same inbox in two places | Overview › "Waiting on people" panel (counts per persona, links to Inbox); Documents (Fahis's queue) lists the same document approvals the Inbox carries as APPROVE_UPDATE items | `overview.tsx` panel "Waiting on people"; `documents.tsx` hero "n documents wait for a decision"; `inbox.tsx` Decisions tab |
| 2 | A board over cases other items show | Not found: Cases is the maker's workspace (nudges, pauses), the Inbox the checker's decisions; they do not index the same rows | — |
| 3 | Home repeats panels from other items | Overview repeats the eligible rate (hero and first tile), the twenty reasons (also on Data health), the employers blocking (also on Data health and Employers) and the agents one line each (the Agents screen) | `overview.tsx` panels; `health.tsx` panels "The twenty reasons", "Employers blocking customers" |
| 4 | A record contains its sibling items | Customer 360 already has tabs Record · The twenty rules · Cases · Messages · Documents · Trail while Communications, Documents and Audit trail are menu items | `customers.tsx` tabs with counts; `App.tsx` ITEMS comms, documents, audit |
| 5 | No overview for the persona who runs things | Not found: the Head lands on Overview, the Steward on Data health | — |
| 6 | Two items with one name | Not found | — |
| 7 | Rig items in the menu | Customer app · Scenarios · Settings as a Demo group; Activity and Present as title-bar buttons; the clock chip; the theme toggle | `App.tsx` ITEMS group Demo; `titleBar` utilities |

Two findings outside the seven: the title bar is at eight against a budget of five, and the assistant rail opens for everyone, including people who work in lists (Inbox, Cases).

## Step 4 — The menu after, lens by lens

| Lens | Items (landing in bold) | What moved, and why |
|---|---|---|
| **Readiness** (for those who run the base: Head, Data Steward) | **Overview** · Data health · Customers · Employers · Policies | Overview keeps the readiness picture, three figures and what changed; "Waiting on people" goes (1); the agents panel goes to How it works (3); the Steward lands on Data health |
| **Remediation** (Credit, Ops, Supervisor, Compliance, Collections, RM; items filtered by role) | **Inbox** · Cases · Customers · Employers (Credit) · Messages (Ops, Supervisor, Compliance) · Policies (Credit, Supervisor, Compliance) | Documents leaves the menu: its decisions are Inbox items and the queue is a tab on the customer and a link from the item (1, 4); Communications is renamed Messages and kept as an item because "what went out and what Hami stopped" across all customers is Compliance's and Operations' work surface, not a property of one record; the per-customer thread stays a tab on the customer (4) |
| **How it works** (Head, Credit, Compliance, Steward; the technical session) | Agents · Workflows · Audit trail (Integration log as a tab) | Agents & workflows splits into its two screens; Triggers & clock is rig and goes to the Demo control; three items, since Value does not exist in Jahiz and a fourth would be padding |
| **Demo control** (title bar, one control; `?client=1` hides it) | Present · Scenarios · Persona · Clock (the date, VIRTUAL, advance) · The customer's phone · Activity console · Demo data and Reset · Interface (theme, AI mode) · Settings | Everything of the Demo group and the title-bar rig (7). The Scenarios page stays as a route for the technical session |
| **Title bar** (four) | Jahiz · demo | lens picker | persona | Demo control | The date, VIRTUAL and POLICY chips, the Synthetic data chip, the theme toggle, Activity and Present leave the bar; the policy version moves to the Policies hero; the synthetic note to the Demo control and the closing card |

Rules applied: five to eight items per lens, or fewer when the next item would be padding; one inbox per lens; properties of a record are tabs; screen ids stay as routes, only labels and menu membership change, so no scenario step is re-pointed and the server is untouched; the lens follows the screen when a scenario or a link opens one outside the current lens, and the Director's screen choice wins while a scenario runs.

## Step 5 — What it does to each persona

| Persona | Items today | Items after | Landing after |
|---|---|---|---|
| Head of Retail Credit | 12 | Readiness 5 · Remediation 5 (Inbox for policy approvals) · How it works 3 | Overview |
| Credit Policy Officer | 12 | Remediation 5 (Inbox · Cases · Customers · Employers · Policies) · How it works 3 | Inbox |
| Remediation Operations Officer | 12 | Remediation 4 (Inbox · Cases · Customers · Messages) | Inbox |
| Operations Supervisor | 12 | Remediation 5 (Inbox · Cases · Customers · Messages · Policies) | Inbox |
| Compliance & Data Protection | 12 | Remediation 5 · How it works 3 | Inbox |
| Relationship Manager | 12 | Remediation 3 (Inbox · Cases · My clients) | Inbox |
| Collections Officer | 12 | Remediation 3 (Inbox · Cases · Customers) | Inbox |
| Data Steward | 7 | Readiness 5 · How it works 3 | Data health |

A persona with one lens sees no lens picker (Operations, Supervisor, RM, Collections).

## Step 6 — Change and verify (after the go)

Lens and item definitions in `App.tsx` on Atelier's `<LensPicker>`; the Demo control ported from Tasama HR (`demo-control.tsx`); the title bar cut to four; the landing rule per persona; Documents and the customer-app route reachable from the Inbox item, the customer tabs and the Demo control; the assistant rail collapsed for Operations, Supervisor, Collections and the RM, open for the Head, Credit, Compliance and the Steward. Then `npm run typecheck`, `npm run check`, every scenario twice through the Director, screenshots of every lens for every persona in light at the seeded date, and the before/after table for the prototype owner.
