#!/usr/bin/env node
/**
 * The screen lint (canon: SCREEN-DISCIPLINE.md rules 3 and 5; before-delivery
 * check 4a). Opens every screen of a running prototype in Chrome, reads the
 * text a person sees, and fails on what must not be on a work surface:
 * internal ids, type codes, snake_case field names, rung codes, HTTP verbs,
 * raw JSON, and governance copy.
 *
 *   node packages/design-system/scripts/check-screens.mjs tools/screens.json
 *
 * tools/screens.json (in the prototype):
 *   {
 *     "base": "http://localhost:5000",          // or set SCREENS_BASE
 *     "routes": ["/#overview", "/#inbox", ...], // every work screen
 *     "allow": ["RSN-"],                         // patterns this prototype may show (rare; say why in the README)
 *     "skip": ["/#agents", "/#trail"]            // How it works screens, where ids are the point
 *   }
 *
 * Uses playwright-core with the installed Chrome (or COGNILAB_CHROME / Edge),
 * so nothing is downloaded. Exits 1 and lists every hit by screen.
 */
import fs from 'node:fs';
import path from 'node:path';

const RULES = [
  { name: 'workflow id', re: /\bWF-\d+\b/g },
  { name: 'case or record id', re: /\b[A-Z]{2,5}-(?:CASE-)?\d{2}-\d{3,}\b/g },
  { name: 'type code', re: /\b[a-z]+_code\b|\btype_code\b/g },
  { name: 'snake_case name', re: /\b[a-z]+(?:_[a-z0-9]+){1,}\b/g },
  { name: 'rung code', re: /\bA[0-4]\b(?![-\d])/g },
  { name: 'HTTP call', re: /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[\w/{}:-]+/g },
  { name: 'raw JSON', re: /\{\s*"[\w]+"\s*:/g },
  { name: 'governance copy', re: /the decision is yours|nothing is (?:submitted|sent|written) until|the agent (?:only )?recommends|no action is taken without/gi },
];

const file = process.argv[2] || 'tools/screens.json';
if (!fs.existsSync(file)) {
  console.error(`check-screens: ${file} not found. List the prototype's screens there (see the header of this script).`);
  process.exit(2);
}
const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
const base = (process.env.SCREENS_BASE || cfg.base || 'http://localhost:5000').replace(/\/$/, '');
const allow = (cfg.allow || []).map((a) => new RegExp(a));
const skip = new Set(cfg.skip || []);
const routes = (cfg.routes || []).filter((r) => !skip.has(r));

async function launch() {
  const { chromium } = await import('playwright-core');
  if (process.env.COGNILAB_CHROME) return chromium.launch({ executablePath: process.env.COGNILAB_CHROME });
  try { return await chromium.launch({ channel: 'chrome' }); } catch {}
  try { return await chromium.launch({ channel: 'msedge' }); } catch {}
  return chromium.launch();
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
let hits = 0;
for (const r of routes) {
  await page.goto(base + r, { waitUntil: 'networkidle' }).catch(() => page.goto(base + r));
  await page.waitForTimeout(800);
  // Text a person sees: closed <details> and the Demo control are excluded.
  const text = await page.evaluate(`(() => {
    document.querySelectorAll('details:not([open])').forEach((d) => { for (const c of Array.from(d.children)) if (c.tagName !== 'SUMMARY') c.setAttribute('data-hidden-proof', '1'); });
    const walk = (n) => n.nodeType === 3 ? n.textContent : (n.nodeType === 1 && (n.getAttribute('data-hidden-proof') || n.closest('[data-screens-ignore]') || getComputedStyle(n).display === 'none')) ? '' : Array.from(n.childNodes).map(walk).join(' ');
    return walk(document.body);
  })()`);
  const found = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      const s = m[0];
      if (allow.some((a) => a.test(s))) continue;
      found.push(`${rule.name}: "${s}"`);
    }
  }
  const unique = [...new Set(found)];
  if (unique.length) {
    hits += unique.length;
    console.log(`\n${r}`);
    for (const f of unique.slice(0, 40)) console.log(`  ${f}`);
  }
}
await browser.close();
console.log(hits ? `\ncheck-screens: ${hits} findings on ${routes.length} screens` : `check-screens: ${routes.length} screens clean`);
process.exit(hits ? 1 : 0);
