#!/usr/bin/env node
/**
 * Bring a prototype's copy of CogniPulse (packages/design-system) up to this
 * CogniPulse, keeping the client's brand.
 *
 *   node scripts/update-prototype.mjs ~/Documents/GitHub/<Repo>
 *
 * Copies every file of this CogniPulse into <Repo>/packages/design-system except
 * the client's own: tokens.json, public/ (logos, backdrops, favicon) and the
 * files generated from tokens.json (src/index.css, src/generated/), then
 * regenerates those from the client's tokens. Nothing in the prototype is
 * deleted: files the prototype has and CogniPulse does not are listed, for Claude
 * to move to _to_delete/ or keep. Writes packages/design-system/COGNIPULSE.json
 * with the date, a fingerprint of this CogniPulse (CogniLab reads it to say
 * whether a prototype is behind) and the hash of every file it wrote.
 *
 * A file the prototype changed itself is never overwritten silently: when
 * the prototype's copy differs from CogniPulse and is not the copy this script
 * last wrote (or the prototype was never stamped), it is kept and listed.
 * Its improvement belongs in CogniPulse first (the harvest); once CogniPulse has
 * it, run again with --take-cognipulse.
 *
 * CogniLab runs this from the prototype's page ("Take the latest CogniPulse");
 * the owner never runs it by hand.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const COGNIPULSE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = process.argv.slice(2).find((a) => !a.startsWith('--'));
const TAKE = process.argv.includes('--take-cognipulse');
if (!repo) {
  console.error('usage: node scripts/update-prototype.mjs <prototype repo root>');
  process.exit(2);
}
const target = path.join(path.resolve(repo), 'packages', 'design-system');
if (!fs.existsSync(path.join(target, 'tokens.json'))) {
  console.error(`update-prototype: ${target} has no tokens.json; is this a Cognirise prototype?`);
  process.exit(2);
}

/** Paths (relative, with /) that belong to the client or are generated. */
const KEEP = [/^tokens\.json$/, /^public\//, /^src\/index\.css$/, /^src\/generated\//, /^COGNIPULSE\.json$/, /^COGNIUI\.json$/, /^ATELIER\.json$/];
const SKIP = [/^node_modules\//, /^dist\//, /^tmp\//, /^\.git\//, /^_to_delete\//, /\.DS_Store$/, /\.tsbuildinfo$/];

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(base, abs).split(path.sep).join('/');
    if (SKIP.some((r) => r.test(rel + (e.isDirectory() ? '/' : '')))) continue;
    if (e.isDirectory()) out.push(...walk(abs, base));
    else out.push(rel);
  }
  return out;
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
const stampPath = path.join(target, 'COGNIPULSE.json');
// A prototype set up under an earlier name of the design system (Atelier
// until 24 Oct 2026, CogniUI until 25 Oct) has ATELIER.json or COGNIUI.json
// and imports @cognirise/atelier or @cognirise/cogniui: the stamp is moved
// here, and every import in the repo is rewritten after the copy (below), so
// the copied package.json still resolves.
for (const old of ['COGNIUI.json', 'ATELIER.json']) {
  const legacy = path.join(target, old);
  if (!fs.existsSync(stampPath) && fs.existsSync(legacy)) fs.renameSync(legacy, stampPath);
}

const previous = fs.existsSync(stampPath) ? JSON.parse(fs.readFileSync(stampPath, 'utf8')) : null;
const wrote = previous?.files ?? {};

const source = walk(COGNIPULSE).filter((f) => !KEEP.some((r) => r.test(f)));
const hash = crypto.createHash('sha256');
const files = {};
const kept = [];
let changed = 0, added = 0;
for (const rel of source.sort()) {
  const from = path.join(COGNIPULSE, rel), to = path.join(target, rel);
  const buf = fs.readFileSync(from);
  hash.update(rel).update(buf);
  const exists = fs.existsSync(to);
  if (exists) {
    const mine = fs.readFileSync(to);
    if (Buffer.compare(mine, buf) === 0) { files[rel] = sha(buf); continue; }
    const untouched = wrote[rel] && wrote[rel] === sha(mine);
    if (!untouched && !TAKE) { kept.push(rel); files[rel] = 'local:' + sha(mine); continue; }
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, buf);
  files[rel] = sha(buf);
  if (exists) changed++; else added++;
}
const NAME = '@cognirise/cognipulse';
// The package name, and the browser-storage keys the theme and the shell use.
const LEGACY = ['atelier', 'cogniui'].flatMap((old) => [
  [`@cognirise/${old}`, NAME], [`"${old}-theme"`, '"cognipulse-theme"'], [`'${old}-theme'`, "'cognipulse-theme'"], [`${old}-nav-`, 'cognipulse-nav-'], [`${old}-chat-rail-width`, 'cognipulse-chat-rail-width'],
]);
// After the copy, so a file this script wrote is not mistaken for the prototype's own edit.
let rewritten = 0;
{
  const root = path.resolve(repo);
  const TEXT = /\.(ts|tsx|js|mjs|cjs|json|css|html|md)$/;
  const skipDir = new Set(['node_modules', 'dist', '.git', '_to_delete', 'tmp']);
  const visit = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (!skipDir.has(e.name)) visit(abs); continue; }
      if (!TEXT.test(e.name)) continue;
      // A file this script just wrote from CogniPulse is already right (this script itself names the old strings).
      const inCopy = path.relative(target, abs).split(path.sep).join('/');
      if (!inCopy.startsWith('..') && files[inCopy] && !String(files[inCopy]).startsWith('local:')) continue;
      const text = fs.readFileSync(abs, 'utf8');
      let next = text;
      for (const [from, to] of LEGACY) next = next.split(from).join(to);
      if (next === text) continue;
      fs.writeFileSync(abs, next);
      rewritten++;
    }
  };
  visit(root);
}
const sourceSet = new Set(source);
const extra = walk(target).filter((f) => !KEEP.some((r) => r.test(f)) && !sourceSet.has(f));

execFileSync(process.execPath, [path.join(target, 'scripts', 'build-tokens.mjs')], { cwd: target, stdio: 'inherit' });

const fingerprint = hash.digest('hex').slice(0, 16);
// A prototype that kept its own version of any file does not carry this CogniPulse yet.
const stamp = { updated: new Date().toISOString().slice(0, 10), fingerprint: kept.length ? `partial-${fingerprint}` : fingerprint, cognipulse: fingerprint, files };
fs.writeFileSync(stampPath, JSON.stringify(stamp, null, 2) + '\n');
console.log(`CogniPulse ${fingerprint}: ${changed} files updated, ${added} added in ${path.relative(process.cwd(), target) || target}`);
if (kept.length) {
  console.log(`Kept the prototype's own version of ${kept.length} file(s); harvest what they improve into CogniPulse, then run again with --take-cognipulse:`);
  for (const f of kept) console.log(`  ${f}`);
}
if (extra.length) {
  console.log(`In the prototype but not in CogniPulse (kept; move to _to_delete/ if no longer used):`);
  for (const f of extra) console.log(`  ${f}`);
}
if (rewritten) console.log(`Renamed the design system's earlier package name to ${NAME} (and its storage keys) in ${rewritten} file(s) of the prototype.`);
console.log('Next: npm install at the repo root (CogniPulse\'s dependencies may have changed), then typecheck.');
