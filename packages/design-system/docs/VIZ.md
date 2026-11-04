# Decision pictures — `@cognirise/cognipulse/viz`

Small, exact charts for the decision a screen carries. They sit inside panels and cards, next to the figure they explain; they are not dashboards. They draw on the theme tokens, so a client rebrand recolours them, and they work in light, dark and right-to-left.

Lifted from the Δ Force prototype (October 2026) and made domain-neutral: every component takes plain values and a `format` function, never one prototype's records.

```tsx
import { TimeBar, CapBar, Bullet, Sankey, Waterfall } from "@cognirise/cognipulse/viz";
```

| Component | The question it answers | Takes |
|---|---|---|
| `TimeBar` | How much of the period has run? | start, end, today, held-until, state |
| `CapBar` | Is there room inside the limit for this request? | cap, used, pending, request, format |
| `Bullet` | Is the value past its target or threshold? | value, target, baseline, direction, alarm |
| `Segments` | How many of the steps are done? | items with on/off |
| `Dots` | How many of a few units count? | n, of |
| `Ring` | One ratio on a tile | value, max, label |
| `Sparkline` | Which way is the number going? | points |
| `Columns` | How did it change month by month? | label/value points, format |
| `CountUp` | A headline figure, counted up once | value, format |
| `FigureTile` | A figure with its picture under it | label, value, sub, children |
| `Swimlanes` | Which period runs out first? | rows with start/end, today |
| `StageRiver` | How has each item moved through the stages? | stages, items with dated paths, today |
| `DeadlineField` | What is due soonest, and how much rides on it? | lanes, items with days left and weight |
| `Treemap` | Where is the total held? | items with size and used (0–1) |
| `Slope` | Did the measure move from where it started? | before, now, target, state |
| `Journey` | How did one item get here? | dated steps, holds, today, end |
| `BeforeAfter` | Did the pilot move the daily number beyond the noise? | daily series, baseline and pilot windows, target |

Flows, rank, pattern, spread and connections (`flow.tsx`, `compare.tsx`):

| Component | The question it answers | Takes |
|---|---|---|
| `Waterfall` | How did we get from plan to actual? | start, signed steps, end label, which way is good |
| `Sankey` | Where does the total go? | nodes (tone marks the outcomes that matter), links with values |
| `Funnel` | Where do we lose people? | ordered steps with counts; the largest loss is marked |
| `CumulativeFlow` | Where is work piling up? | ordered states (waiting → done), daily counts per state; `flowBottleneck()` gives the state for a headline |
| `Dumbbell` | How far is each item from its target? | rows with from, to, target; one scale for all rows |
| `Bump` | Who moved up or down? | periods, items with a rank per period, focus |
| `Heatmap` | When or where does it peak? | row and column labels, values; the peak is outlined |
| `ControlChart` | Is this spike a signal or noise? | points, baseline length, floor; `controlLimits()` gives the signals for a headline |
| `DotStrip` | How is every item spread against a limit? | items with values, marks (the limit) |
| `SmallMultiples` | The same picture per item, on one scale | panels; pass `domain` from `sharedDomain()` to Sparkline or `max` to Columns |
| `Network` | Who is connected to whom? | nodes, links; hover keeps a node and its neighbours |

Ribbons, ranks and network positions are read only roughly, so these print their numbers beside the picture. Keep a Sankey under about twenty ribbons (group the small ones as "Other"), a Bump under ten lines, and a Network under about forty nodes; past that, a matrix or a table reads better.

Colour: one hue (`primary`) for quantity; `warn`, `danger` and `success` only where the state is the message. Every component has a `title` on hover with the exact numbers, so the picture can stay clean.

Motion: each chart draws once on mount (`.viz-*` classes in `index.css`, from `scripts/theme-template.css`) and is static under `prefers-reduced-motion`. A chart is complete at rest.

The preview page is **Charts → Decision pictures**, with sample data.

Which picture a screen uses follows the data's structure and the question the screen answers. The table that maps the two to a component is `VISUAL-VOCABULARY.md` in the Prototype Canon.
