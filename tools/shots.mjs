#!/usr/bin/env node
/**
 * Screenshots of every screen, in light mode, from the built app.
 *
 *   node tools/shots.mjs <out dir> [only names, comma-separated]
 *
 * Starts the server on its own port (the built-in database when DATABASE_URL
 * is not set), waits for it, opens each screen of tools/shots.json as its
 * persona at 1600×1000, writes <out dir>/<name>.png, and stops the server.
 * Needs the web app built (`npm run build`). Uses playwright-core with the
 * installed Chrome, so nothing is downloaded. Ends on its own.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || 'tmp/shots');
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const PORT = Number(process.env.SHOTS_PORT || 5077);
const base = `http://localhost:${PORT}`;
const spec = JSON.parse(fs.readFileSync(path.join(root, 'tools/shots.json'), 'utf8'));
fs.mkdirSync(out, { recursive: true });

const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', (b) => process.stdout.write(`[server] ${b}`));
server.stderr.on('data', (b) => process.stderr.write(`[server] ${b}`));
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

try {
  await up();
  const browser = await launch();
  for (const s of spec.screens) {
    if (only && !only.has(s.name)) continue;
    const ctx = await browser.newContext({ viewport: { width: s.width ?? 1600, height: s.height ?? 1000 }, colorScheme: 'light' });
    await ctx.addInitScript(([p]) => { for (const k of ['cognipulse-theme', 'cognipulse-theme']) localStorage.setItem(k, 'light'); localStorage.setItem('jahiz-persona', p); }, [s.persona ?? 'head']);
    const page = await ctx.newPage();
    await page.goto(`${base}/${s.hash}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(s.wait ?? 1500);
    for (const c of s.click ?? []) {
      try { await page.locator(c).first().click({ timeout: 4000 }); await page.waitForTimeout(1200); } catch { console.log(`  ${s.name}: could not click ${c}`); }
    }
    await page.screenshot({ path: path.join(out, `${s.name}.png`), fullPage: !!s.full });
    console.log(`shot ${s.name}`);
    await ctx.close();
  }
  await browser.close();
} catch (e) {
  console.error(`shots: ${e.message}`);
  process.exitCode = 1;
} finally {
  stop();
  setTimeout(() => process.exit(process.exitCode ?? 0), 500);
}
