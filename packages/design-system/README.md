# CogniPulse Design System

The shared visual language, default app layout and component library behind
Cognirise-built applications. Every app starts as a copy of this directory,
then gets rebranded for its client.

## Included

- `tokens.json` — DTCG source-of-truth tokens: light and dark color sets, the
  brand layer (gradient, status, backdrops, hero island), typography, radius,
  spacing
- `src/index.css` — GENERATED theme variables, base styles and brand layer
- `src/generated/tokens.tsx` — GENERATED portable token object (mobile, other platforms)
- `src/components/layout/` — the default app layout: shell, backdrop, title
  bar, lens picker, theme selector, page hero, container, chat rail, composer
- `src/components/ui/` — themed shadcn component library
- `src/components/viz/` — decision pictures: small exact charts on the tokens (`@cognirise/cognipulse/viz`, see `docs/VIZ.md`)
- `src/preview/` — living style guide
- `public/brand/` — the client-swappable brand assets
- `docs/` — the layout contract, the rebranding procedure, platform guides
- `scripts/build-tokens.mjs` — the token build

## The two contracts

**`docs/LAYOUT.md` — the default page layout.** Backdrop, chat rail, 56px
title bar, optional context nav, page hero, content container. Every app is
built on `<AppShell>`; apps extend it through its slots rather than inventing
a frame.

**`docs/REBRANDING.md` — what a client rebrand may change.** Logos, the color
tokens, the brand block and the two backdrops. Nothing else. Layout, spacing,
radii, type scale, glass treatment and component behaviour are identical in
every app, which is what makes them recognisably one system.

## Visual language

A deep brand foundation with a four-stop accent gradient, glass surfaces for
cards, panels and shell chrome, a rounded display face for headings and the
wordmark over a neutral sans for body and interface text, and a fixed branded
backdrop behind everything. Light and dark themes carry the same brand roles.

Signature patterns: glass cards, panels and popovers; the page-hero dark
island; eyebrow, section label, divider and lede primitives; pill buttons and
mono/status chips; accent-underline tab navigation.

Defaults ship in Cognirise's own colors — magenta primary on deep navy,
Comfortaa over Inter.

## Using it in a web app

```tsx
import "@cognirise/cognipulse/styles.css";
import { AppShell, ThemeProvider } from "@cognirise/cognipulse/layout";
import { Button } from "@cognirise/cognipulse/components/ui/button";
```

See `docs/consuming-web.md` for the full setup and `docs/LAYOUT.md` for the
frame every page sits in.

## Using it in Expo

The portable token object is safe to import anywhere. There is **no native
component layer yet** — see `docs/consuming-expo.md` for what exists and what
an Expo app still has to build itself.

## Working with tokens

Edit `tokens.json`, then:

```bash
npm run tokens
```

Never hand-edit `src/index.css` or `src/generated/tokens.tsx`; both are
generated, and the dev server regenerates them on change.

## Keeping a prototype on the latest CogniPulse

Each prototype carries its own copy of CogniPulse in `packages/design-system`,
rebranded. To bring that copy up to this CogniPulse without touching the client's
brand:

```bash
node scripts/update-prototype.mjs ~/Documents/GitHub/<Repo>
```

It copies everything except `tokens.json`, `public/` and the generated files,
regenerates those from the client's tokens, deletes nothing, lists what the
prototype has that CogniPulse does not, and stamps `packages/design-system/COGNIPULSE.json`
with the date, a fingerprint and the hash of every file it wrote. A file the
prototype changed itself is kept and listed, never overwritten: what it
improves goes into CogniPulse first, then `--take-cognipulse` takes CogniPulse's. CogniLab
runs it from the prototype's page ("Take the latest CogniPulse"); after it,
`npm install` and the typecheck.

## Scope

Reusable foundations, layout and components. No product pages, API clients,
business workflows or data-model-specific compositions.
