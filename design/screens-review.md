# Screens review — QIB Jahiz, 29 October 2026

Every screenshot in `design/screens/after-3/` (light mode, 1600×1000, production build, built-in database, Offline, seeded state) opened and looked at, one by one, against `SCREEN-DISCIPLINE.md` and `VISUAL-VOCABULARY.md`. "Wrong" is what the first look found; "Fixed" is what changed before the last shots. The scenario steps (37, each opened as its persona) and the play (Present mode end to end, 41 presses) were shot too; those images are kept outside the repository, and the ones looked at are named below.

| Screenshot | Wrong on first look | Fixed |
|---|---|---|
| 01-overview | The trend title read "-39 more eligible"; the column dates ran into each other; the waterfall cut its labels ("Collections bou…") | "28 fewer eligible than on 30 Aug"; only the first and last scan named; step labels of sixteen characters at most |
| 02-health | "1 documents expire"; "0 QIDs and 1 passports" | Plurals and the empty case said in words |
| 03-inbox-supervisor | Nothing waits on the Supervisor in the seeded state (the scenarios bring the work); the empty reader says what arrives there | — |
| 04-inbox-credit | — (the rule strip red with its name under it; the decision pinned) | — |
| 05-inbox-ops | The agents' log ran under the decision bar; "How this was checked" cut by the bar | The log shows the last five with "Show all"; the body fades out above the bar and fits above it at this size |
| 05b, 05c, 05d (proof open, decline, tasks) | — | — |
| 06-cases | The sixty-day flow drawn across the full width, its labels at 18 px, taller than the lanes | The flow at its own size, and beside it each lane today against two weeks ago |
| 07-case-drawer | The decision scrolled with the drawer | Pinned to the foot, as in the Inbox; header pinned; body scrolls between |
| 08-customers | The search icon sat on its placeholder | Padding for the icon |
| 09-customer-360 | Table names on the surface ("SALARY_CREDITS", "STANDING_ORDERS") | The source line in words, the table names in the hover |
| 10-employers | — | — |
| 11-comms | Hami's blocks by rule named channels by code ("EMAIL", "INAPP"); the panel title cut off | Channels in words; the title says the total and the top rule's count |
| 12-policies | — (no change pending in the seeded state, so no slope; the slope shows after a proposal, see S6 below) | — |
| 13-documents | The only document waiting is not read yet, under the tab "waiting for a checker" | Left as it is: the headline says it has not been read; noted for the owner |
| 14-agents | The autonomy chip prints the rung code (CogniPulse's AgentCard) | Kept: How it works is where the rungs are explained; excepted from the lint, a harvest |
| 15-workflows | Reason codes ("R07", "R02") and "(A3)" on the cards | Reasons in words; rungs said |
| 16-audit | "a person overrode an agent 0 times" | "no person has overridden an agent yet" |
| 17-scenarios | — | — |
| 18-settings | Persona cards read "Approves: Answers for Raqib…" | The agents a persona answers for sit under the remit |
| 19-triggers | An empty clock bar when the next message is due now; an HTTP call in a schedule ("POST /api/customer/…") | The bar only when the next message is an hour or more away; the call left out |
| 20-customer-app | The panel title "An upload goes to Fahis, then to a checker, then back here as an…" cut off; "qid expired" | "What an upload sets off" with one sentence; "QID expired" |
| 21-present | — (unchanged; checked through the play) | — |
| Scenario S4 step 4 (the restriction) | The recommendation began a sentence "allows a temporary card restriction" where a clause was removed; the log said "T+261 after expiry" | "The policy allows…"; "261 days after expiry" |
| Scenario S6 step 3, second run | Run a second time, the story proposed 30 → 21 when 21 was already in force: "21 → 21, move by 0 days" | The Director returns the rule to its design default as a new, recorded version before the story runs again; the second run shows 30 → 21 and nine messages moved; "move 9 days earlier" in words |
| Play: cards 1–2, the Stage at S1 step 5 and S2 step 6, the closing card | — (three panes filled on every Stage step looked at; no page error in 41 presses) | — |
