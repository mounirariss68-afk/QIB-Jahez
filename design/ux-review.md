# UX review — QIB Jahiz against the canon of 21 October 2026

Read against `SCREEN-DISCIPLINE.md` (the eight rules, with rules 6 and 9 as rewritten on 21 Oct), `drafts/SCREEN-COMPOSITION.md` (the ten composition rules, built and verified on Tasama HR, approved on Δ Force's second pass), the visual vocabulary of both prototypes, `MENU-DISCIPLINE.md` (see `design/menu-review.md`) and the 21 Oct additions to `stages/05-demo.md`. Evidence: the screen code and light-mode screenshots at 1600×1000 of the production build (`scratchpad/shots-review`). Nothing here is changed until the prototype owner gives the go.

## What the canon changed since Jahiz was built, in one table

| Change (21 Oct) | What it asks of a screen | Where Jahiz stands |
|---|---|---|
| Screen discipline, eight rules | One job per view, each fact once, the person's words, proof behind one disclosure, governance explained once, a budget per view (decision card: headline · three facts · recommendation line · one to three actions · one disclosure), the log and the phone as a colleague | The Stage passes (built to it on 19 Oct). The app screens fail on ids, repeated facts, proof on the surface and governance copy |
| Composition (under test, applied with discipline) | A picture before the fold for the quantity the decision turns on; masthead on work screens, island hero only on landing pages (140 px, with the signature visual); master–detail work screens; Atelier anatomy; computed claims as panel titles; the degenerate state still a design; light mode | Jahiz has island heroes (270–350 px, 56 px headlines) on every screen including lists; one real chart (the reasons bars, labelled with codes); numbers as text where a bar belongs; no pictures on the inbox, the cases, the decision cards |
| Visual vocabulary | Form by the question (FT families), position on a common scale first, bullet for a measure against a target, one hue for quantity and status colour for state, a gauge only for one ratio alone, waterfall for signed parts, a calendar strip for who is away, motion on entry only | Nothing contradicts it; most of it is missing |
| Menu discipline | Lenses as hats, five to eight items, one inbox per lens, record properties as tabs, How it works last, the rig in a Demo control, a five-element title bar | Flat twelve-item menu, the rig in the menu, an eight-element title bar (`design/menu-review.md`) |
| Demo stage | The phone as an app with a tab bar; the opening card carries the signature visual; scenarios start from the Demo control; reset before the demo; light mode | The phone already has a tab bar and turns with the step; the opening card is a sentence of numbers; scenarios start from a menu item |

## Screen by screen: the job, what leaves, what is composed

| Screen | Its job, in a sentence | What leaves (discipline) | What is composed (composition) |
|---|---|---|---|
| Overview (Head) | "How ready is the base tonight, and what will move it?" | The "Waiting on people" panel (the inbox); "The agents, in one line each" (How it works; its title breaks the headline rule); the governance sentence under the panel; the eligible-rate tile (repeats the hero); the second copy of the reasons and the employers (Data health) | Island hero at 140 px carrying the **readiness bar** (2,400 customers as eligible · curable by asking · curable by the bank · out by policy · collections) with a computed claim; three tiles (open cases, outreach today, offers handed off); the twenty reasons as horizontal bars with their labels, the code in the hover; eligible count by scan as columns |
| Data health (Steward, Head) | "Which fields are dragging the eligible rate, and how fast are documents expiring?" | `WF-02`, `WF-03` in tiles; the duplicate reasons panel | Field-level health as **heat cells** (field × segment); expiries ahead as columns by month with the 90-day watch marked; classes as a segment bar |
| Inbox (every worker) | "Decide the item in front of you" | The island hero and its governance lede; case ids, class and segment chips and `DECIDE RESTRICTION` tags on rows; `WF-02`, reason-code chips, `LEADS: R07` and the empty facts in the reader; "A decision that differs… is recorded as an override on the trail" | Masthead ("93 decisions wait on you; 12 are due today"); list rows: the person, what is asked in words, a **clock bar** (silence since the first notice against the T+90 mark) and a status word; a sticky **decision card** on the right: headline, three facts each with its picture, the recommendation with its exception in one line, the buttons, "How this was checked ▸" collapsed |
| Cases (Operations) | "Which cases need a nudge today?" | Class as a code (`A`); ids as the first thing on a row | Rows with the notice cadence as **segments** (attempts n of m) and the next action as a clock bar; the drawer is the same decision card and disclosure as the Inbox |
| Case reader (drawer) | The decision card for one case | Workflow runs, steps, trail, inbound and tasks as sections on the surface | Decision card + one disclosure holding runs, steps, trail, clauses and system calls; actions (remind, pause, escalate) as panel actions |
| Customer 360 | "Why is this customer not pre-approved, and what would change it?" | Tab counts; reason codes on chips (the label is the person's word; the code goes in the hover) | The island hero stays (a record is a landing page) with the amount as the feature; the stat row becomes **cap bars** (obligations against the DBR capacity; exposure headroom under the cap) and a **clock bar** (months to the age limit); the twenty rules as **20 dots**; salary credits as **columns with the gap hollow** (the S2 story in one picture) |
| Documents | Fahis's queue; leaves the menu (its decisions are Inbox items; the queue is a tab on the customer and a link from the item) | Confidence decimals; verification keys in code | The document card: the image, what Fahis read as three facts, confidence against the one-click threshold as a **bullet**, the decision |
| Employers | "Which approval frees the most customers?" | The register table's codes | Rows with the leverage as **dots** (customers waiting only on this approval) and criteria met as **segments**; the record: the five POL-03 criteria as a met/not list, the fourteen dots, the decision card |
| Messages (was Communications) | "What went out, what was stopped, and why?" | Template keys, policy clauses as chips on rows (the clause goes in the hover) | Blocked first for Compliance; "what Hami stopped today, by rule" as bars; rows: customer · message · channel · status word |
| Policies | "Set the rule; see what it changes" | The version chip leaves the title bar and lives here | A proposal is a decision card; the effect preview as a **before → after slope** (13 reminders move from day 30 to day 21) |
| Agents, Workflows, Audit trail (How it works) | The governance exhibit | Nothing: this is where rungs, clauses, runs and calls belong, explained once | Integration log as a tab of the Audit trail |
| Customer app, Scenarios, Settings | The rig | Leave the menu for the Demo control; the routes stay | — |

Headlines that break the rule today and their computed replacements: "The agents, in one line each" → the panel goes; "Everything said to and by customers" → "412 messages went out this week; Hami stopped 9"; "Ten agents, each with a remit…" → "Ten agents prepare; eight people decide"; "The customer's phone, inside the platform" → the phone needs no headline (Demo control). Every panel title is checked with `cognirise-titles` before delivery.

## The pictures Jahiz needs

| Quantity | The question | Family | Picture | Where |
|---|---|---|---|---|
| 2,400 customers by what stands between them and the offer | How ready is the base, and what would move it? | Part-to-whole | **Readiness bar** (signature visual): eligible · curable by asking · curable by the bank · out by policy · collections, one hue with state muted | Overview hero, Present opening card, the dashboard step on the Stage |
| Eligible rate against the 35% target | Are we above the target? | Measure vs target | Bullet in the Overview tile | Overview |
| A case's silence (first notice → today, T+90) | How long has the customer been silent, and when does the restriction fall due? | Change over time (span) | **Clock bar** with today and the T+90 mark | Inbox rows, Cases rows, decision card, Stage case focus |
| Notices sent (n of max) | How many chances has the customer had? | Progress (discrete) | **Segments** | Decision card, Cases rows |
| The twenty rules for one customer | Which rules fail? | Part-to-whole with few units | **20 dots**, failing ones in the status colour | Customer 360, Stage eligibility focus |
| Obligations against the DBR capacity; exposure against the cap | Is there room for the finance? | Part-to-whole against a limit | **Cap bar** | Customer 360, Stage record, the offer amount card |
| Salary credits, twelve months, with a gap or a drop | Where did the salary stop? | Change over time | **Columns** with the missing month hollow | Customer 360, the HR-letter decision card, Stage document focus |
| Document confidence against the one-click threshold | Can the checker approve in one click? | Measure vs target | **Bullet** | Documents, decision card, Stage document focus |
| Employer leverage (customers waiting only on this approval) | How many does one decision free? | Few units | **Dots** | Employers rows, employer record, Stage employer focus |
| Employer criteria (CR, WPS, sector, headcount, months) | Does the employer qualify? | Progress (discrete) | **Segments**, met/not | Employer record, Stage |
| Field-level health by segment | Which field, for whom, is the problem? | Distribution | **Heat cells** | Data health |
| Documents expiring in the next 90 days | How much renewal work is coming? | Change over time | Columns by month, the watch window marked | Data health |
| Days past due against the hand-off boundary; the cooling period | How close to Collections; how long until the offer can resume? | Measure vs limit; span | Bullet; clock bar | Collections cases, Stage S5 |
| A policy change's effect | What moves if we change the rule? | Before → after | **Slope** | Policies, Stage S6 |
| Hami's blocks today by rule | What did the guard stop, and why? | Ranking | Horizontal bars | Messages (Blocked), the Agents screen for Hami |

Forms not used: pies, donuts, gauges in rows, dual axes, bubbles, a number on every mark. One hue (QIB blue) for quantity; green, amber and red for state only; marks enter once, under a second, off under reduced motion. The pictures are one library, `app/viz.tsx`, ported from Tasama HR's (ClockBar, Segments, CapBar, Bullet, Slope, Columns, Dots, Ring, Progress, HeatCells) with three Jahiz additions (ReadinessBar, RuleDots, SalaryColumns); the same component draws the picture on the list row, the card, the record and the Stage.

## The Stage and Present mode

| Item | Today | After |
|---|---|---|
| The bank pane's decision card | Four facts as text; "read-only · writes go through Muhaddith after approval" under the record title | Three facts, each with its picture (clock bar, segments, dots, the salary columns); the governance line leaves; "representative screen" stays |
| The record | Fields flash when an agent wrote them | Unchanged; the pre-approval field gets the cap bar |
| The opening card | "Tonight, 37.3% of your 2,400 customers can be pre-approved" as a sentence of numbers | The readiness bar drawn live from the base, with the claim as its title |
| The phone | A tab bar, cards, turns with the step | Unchanged; the offer card gets the amount against the cap |
| Starting a scenario | From the Scenarios menu item | From the Demo control; Scenarios stays as a page for the technical session |
| Theme | Toggle in the title bar | In the Demo control; demos in light |

## Checks to add to the repo

`tools/check-screens.mjs` (the screen lint, from Tasama HR: internal ids, repeated facts, governance copy, hero height, blank space below the fold at 1440 and 1600); a screenshot script that restores the seed, runs in light and names the date in the file; README rows 4, 4a, 4b, 4d, 4e and 13a of `checks/before-delivery.md` with the picture per screen listed.

## Order of work and effort (hours of Claude's work, and the owner's review looks)

| Block | What | Hours | Looks |
|---|---|---|---|
| A | Lenses, landing rule, Demo control, four-element title bar, Documents and the rig out of the menu, the rail collapsed for list workers (`design/menu-review.md` step 6) | 3 | 1 (before/after per persona) |
| B | The picture library; Overview (readiness bar, three tiles, labelled reasons); Inbox and Cases as masthead + rows with clock bars + sticky decision card; the case reader as card + disclosure | 6 | 1 |
| C | Customer 360 (cap bars, dots, salary columns, tabs without counts); Employers; Messages; Documents card; Data health heat cells; Policies slope; headline pass with `cognirise-titles` | 5 | 1 |
| D | Stage decision cards with pictures; the opening card; the governance line out; scenarios from the Demo control | 2 | 1 |
| E | Screen lint, screenshot script, README verification rows | 1.5 | — |

About eighteen hours of Claude's work and four looks. A and B first (the title bar and the Inbox are what every persona sees and what the room sees behind the Stage), then D, then C, then E.

## Where it stands

| Date | Block | Built as | Differs from the plan |
|---|---|---|---|
| 22 Oct 2026 | A | Three lenses with the Director's screen choice winning; the Demo control beside the person; `?client=1` hides it; the rail opens for the Head, Credit, Compliance and the Steward only | None |
| 22 Oct 2026 | B | `packages/design-system/src/viz` (sixteen pictures) with `apps/web/src/app/viz.tsx` as Jahiz's wrappers; Overview on the readiness bar; Inbox and Cases as masthead + rows with clock bars; `app/case.tsx` as the decision card (headline, three facts by decision type, the recommendation line, the decision, "Other actions on the case", one disclosure) used by the Inbox reader and the drawer alike | The employer decision carries two employer facts (the five criteria, the leverage) and the twenty rules; a case with a decision pending shows its other actions behind one menu, so the card keeps to the budget. Atelier's Panel title now runs to two lines (a claim with a number in it does not fit one) |
| — | D, C, E | Not yet | — |
