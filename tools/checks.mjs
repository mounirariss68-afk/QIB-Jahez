#!/usr/bin/env node
/**
 * The runs of the before-delivery list that need the app running, each
 * starting the server itself (the built-in database when DATABASE_URL is not
 * set) and stopping it when done, so every one ends on its own:
 *
 *   node tools/checks.mjs lint                 the screen lint (check-screens.mjs over tools/screens.json)
 *   node tools/checks.mjs scenarios [out dir]  every scenario, every step, twice through the Director API;
 *                                              the second pass opens each step's screen as its persona and
 *                                              screenshots it into <out dir> (default tmp/scenarios)
 *   node tools/checks.mjs play [out dir]       Present mode end to end with the arrow key, a screenshot per
 *                                              press into <out dir> (default tmp/play); fails on a page error
 *
 * Needs the web app built (`npm run build`). Uses playwright-core with the
 * installed Chrome, as tools/shots.mjs does. Exits 1 on any failure.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [mode, outArg] = process.argv.slice(2);
const PORT = Number(process.env.CHECKS_PORT || 5078);
const base = `http://localhost:${PORT}`;
if (!['lint', 'scenarios', 'play'].includes(mode)) { console.error('usage: node tools/checks.mjs lint | scenarios [out dir] | play [out dir]'); process.exit(2); }

const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (b) => { serverLog += b; if (/\[seed\]|running on port/.test(String(b))) process.stdout.write(`[server] ${b}`); });
server.stderr.on('data', (b) => { serverLog += b; process.stderr.write(`[server] ${b}`); });
const stop = () => { if (!server.killed) server.kill('SIGTERM'); };
process.on('exit', stop);

async function up() {
  for (let i = 0; i < 600; i++) {
    if (server.exitCode !== null) throw new Error('the server stopped');
    try { const r = await fetch(`${base}/api/me`, { headers: { 'x-persona': 'head' } }); if (r.ok) return; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('the server did not start in ten minutes');
}
async function launch() {
  const { chromium } = await import('playwright-core');
  if (process.env.COGNILAB_CHROME) return chromium.launch({ executablePath: process.env.COGNILAB_CHROME });
  try { return await chromium.launch({ channel: 'chrome' }); } catch { /* next */ }
  try { return await chromium.launch({ channel: 'msedge' }); } catch { /* next */ }
  return chromium.launch();
}
const api = async (method, p, body, persona = 'head') => {
  const r = await fetch(`${base}/api${p}`, { method, headers: { 'content-type': 'application/json', 'x-persona': persona }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p}: ${j.error ?? r.status}`);
  return j;
};
async function page(browser, persona) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'light' });
  await ctx.addInitScript(([p]) => { localStorage.setItem('cognipulse-theme', 'light'); localStorage.setItem('jahiz-persona', p); }, [persona]);
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(e.message));
  return { ctx, pg, errors };
}

async function lint() {
  const code = await new Promise((resolve) => {
    const p = spawn(process.execPath, ['packages/design-system/scripts/check-screens.mjs', 'tools/screens.json'], { cwd: root, env: { ...process.env, SCREENS_BASE: base }, stdio: 'inherit' });
    p.on('exit', resolve);
  });
  if (code) throw new Error('the screen lint found text that must not be on a work surface');
}

async function scenarios() {
  const out = path.resolve(outArg || 'tmp/scenarios'); fs.mkdirSync(out, { recursive: true });
  const { scenarios: list } = await api('GET', '/scenarios');
  const browser = await launch();
  let failed = 0;
  for (const pass of [1, 2]) {
    for (const s of list) {
      await api('POST', `/scenarios/${s.key}/start`);
      for (let i = 0; i < s.steps.length; i++) {
        const r = await api('POST', `/scenarios/${s.key}/step`, { index: i, mode: 'run' });
        const bad = r.error || /^Error/.test(r.result ?? '');
        if (bad) failed++;
        console.log(`pass ${pass} · ${s.key} ${i + 1}/${s.steps.length} ${bad ? 'FAILED' : 'ok'} · ${r.step.title}${bad ? ` · ${r.error ?? r.result}` : ''}`);
        if (pass === 2) {
          const { ctx, pg, errors } = await page(browser, r.persona ?? 'head');
          const hash = String(r.step.screenResolved ?? '').replace(/^#?\/?/, '#/');
          await pg.goto(`${base}/${hash}`, { waitUntil: 'networkidle' }).catch(() => {});
          await pg.waitForTimeout(1500);
          await pg.screenshot({ path: path.join(out, `${s.key}-${String(i + 1).padStart(2, '0')}.png`) });
          if (errors.length) { failed++; console.log(`  page error on ${hash}: ${errors.join(' | ')}`); }
          await ctx.close();
        }
      }
      await api('POST', '/scenarios/stop');
    }
  }
  await browser.close();
  if (failed) throw new Error(`${failed} step(s) failed`);
}

async function play() {
  const out = path.resolve(outArg || 'tmp/play'); fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  const { ctx, pg, errors } = await page(browser, 'head');
  await pg.goto(`${base}/#/present`, { waitUntil: 'networkidle' }).catch(() => {});
  await pg.waitForTimeout(2500);
  let last = ''; let same = 0;
  for (let i = 0; i < 160 && same < 4; i++) {
    await pg.screenshot({ path: path.join(out, `${String(i + 1).padStart(3, '0')}.png`) });
    const text = await pg.evaluate(() => document.body.innerText.slice(0, 4000));
    same = text === last ? same + 1 : 0; last = text;
    await pg.keyboard.press('ArrowRight');
    await pg.waitForTimeout(2600);
  }
  console.log(`play: ${fs.readdirSync(out).length} screenshots in ${path.relative(root, out)}; ${errors.length} page error(s)`);
  for (const e of errors) console.log(`  page error: ${e}`);
  await ctx.close(); await browser.close();
  if (errors.length) throw new Error('page errors during the play');
}

try {
  await up();
  await ({ lint, scenarios, play })[mode]();
  console.log(`${mode}: passed`);
} catch (e) {
  console.error(`${mode}: ${e.message}`);
  process.exitCode = 1;
} finally {
  stop();
  setTimeout(() => process.exit(process.exitCode ?? 0), 500);
}
