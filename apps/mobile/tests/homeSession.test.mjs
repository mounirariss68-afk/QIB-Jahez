import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Compile only this platform-independent module; no Expo runtime or network needed.
const source = readFileSync(new URL('../src/homeSession.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const payload = (id, revision = 0) => ({ customer: { id, lang: 'en' }, revision });

function setup() {
  const exports = {};
  const timers = new Map();
  let nextTimer = 0;
  runInNewContext(compiled, {
    exports, Promise, Error,
    setInterval: (fn, delay) => {
      assert.equal(delay, 6000);
      timers.set(++nextTimer, fn);
      return nextTimer;
    },
    clearInterval: (id) => timers.delete(id),
  });
  const requests = [];
  const session = exports.createHomeSession((id) => new Promise((resolve, reject) => {
    requests.push({ id, resolve, reject });
  }));
  const tick = async () => { timers.forEach((fn) => fn()); await flush(); };
  const signIn = async (id = 'A') => {
    const pending = session.signIn(id);
    await flush();
    requests.at(-1).resolve(payload(id));
    await pending;
  };
  return { session, requests, timers, tick, signIn };
}

test('several six-second polls update content silently without clearing it', async () => {
  const { session, requests, tick, signIn } = setup();
  const stop = session.startPolling();
  await signIn();
  for (let revision = 1; revision <= 4; revision++) {
    const previous = session.getSnapshot().home;
    await tick();
    assert.equal(session.getSnapshot().home, previous);
    assert.equal(session.getSnapshot().refreshing, false);
    requests.at(-1).resolve(payload('A', revision));
    await flush();
    assert.equal(session.getSnapshot().home.revision, revision);
    assert.equal(session.getSnapshot().refreshing, false);
  }
  stop();
});

test('manual refresh shows a spinner and stops on success and failure', async () => {
  const { session, requests, signIn } = setup();
  await signIn();
  let pending = session.refresh();
  assert.equal(session.getSnapshot().refreshing, true);
  assert.equal(session.refresh(), pending);
  await flush();
  requests.at(-1).resolve(payload('A', 1));
  await pending;
  assert.equal(session.getSnapshot().refreshing, false);
  const previous = session.getSnapshot().home;
  pending = session.refresh();
  await flush();
  requests.at(-1).reject(new Error('Offline'));
  await pending;
  assert.equal(session.getSnapshot().refreshing, false);
  assert.equal(session.getSnapshot().home, previous);
  assert.equal(session.getSnapshot().error, 'Offline');
});

test('slow polls never overlap, a pull joins them, and polling recovers after failure', async () => {
  const { session, requests, tick, signIn } = setup();
  const stop = session.startPolling();
  await signIn();
  await tick();
  const pending = session.refresh();
  assert.equal(session.getSnapshot().refreshing, true);
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(requests.length, 2);
  requests.at(-1).reject(new Error('Timeout'));
  await pending;
  assert.equal(session.getSnapshot().refreshing, false);
  assert.equal(session.getSnapshot().home.customer.id, 'A');
  await tick();
  assert.equal(requests.length, 3);
  requests.at(-1).resolve(payload('A', 2));
  await flush();
  assert.equal(session.getSnapshot().error, null);
  assert.equal(session.getSnapshot().home.revision, 2);
  stop();
});

test('an action waits for an older poll then fetches fresh content without a spinner', async () => {
  const { session, requests, tick, signIn } = setup();
  const stop = session.startPolling();
  await signIn();
  await tick();
  const pending = session.refreshAfterAction();
  await tick();
  assert.equal(requests.length, 2);
  requests[1].resolve(payload('A', 1));
  await flush();
  assert.equal(requests.length, 3);
  assert.equal(session.getSnapshot().refreshing, false);
  requests[2].resolve(payload('A', 2));
  await pending;
  assert.equal(session.getSnapshot().home.revision, 2);
  stop();
});

test('a failed background poll preserves the payload and stays silent', async () => {
  const { session, requests, tick, signIn } = setup();
  const stop = session.startPolling();
  await signIn();
  const previous = session.getSnapshot().home;
  await tick();
  requests.at(-1).reject(new Error('Offline'));
  await flush();
  assert.equal(session.getSnapshot().home, previous);
  assert.equal(session.getSnapshot().refreshing, false);
  assert.equal(session.getSnapshot().error, 'Offline');
  await tick();
  requests.at(-1).resolve(payload('A', 1));
  await flush();
  assert.equal(session.getSnapshot().error, null);
  stop();
});

test('a queued action refresh is discarded when the customer switches', async () => {
  const { session, requests, tick, signIn } = setup();
  const stop = session.startPolling();
  await signIn();
  await tick();
  const oldRequest = requests.at(-1);
  const queued = session.refreshAfterAction();
  await signIn('B');
  const count = requests.length;
  oldRequest.resolve(payload('A', 99));
  await queued;
  assert.equal(requests.length, count);
  assert.equal(session.getSnapshot().home.customer.id, 'B');
  stop();
});

test('consecutive actions each fetch after any earlier action response', async () => {
  const { session, requests, signIn } = setup();
  await signIn();
  const first = session.refreshAfterAction();
  await flush();
  const second = session.refreshAfterAction();
  await flush();
  assert.equal(requests.length, 2);
  requests[1].resolve(payload('A', 1));
  await first;
  await flush();
  assert.equal(requests.length, 3);
  requests[2].resolve(payload('A', 2));
  await second;
  assert.equal(session.getSnapshot().home.revision, 2);
  assert.equal(session.getSnapshot().refreshing, false);
});

for (const fail of [false, true]) {
  test(`old session ${fail ? 'failure' : 'success'} cannot change the new customer or spinner`, async () => {
    const { session, requests, signIn } = setup();
    await signIn('A');
    const old = session.refresh();
    await flush();
    const oldRequest = requests.at(-1);
    await signIn('B');
    const current = session.refresh();
    await flush();
    if (fail) oldRequest.reject(new Error('Old error'));
    else oldRequest.resolve(payload('A', 99));
    await old;
    assert.equal(session.getSnapshot().home.customer.id, 'B');
    assert.equal(session.getSnapshot().error, null);
    assert.equal(session.getSnapshot().refreshing, true);
    requests.at(-1).resolve(payload('B', 1));
    await current;
    assert.equal(session.getSnapshot().refreshing, false);
  });
}

test('sign-out invalidates requests even when the same customer signs in again', async () => {
  const { session, requests, signIn } = setup();
  await signIn();
  const old = session.refreshAfterAction();
  await flush();
  const oldRequest = requests.at(-1);
  session.signOut();
  assert.equal(session.getSnapshot().home, null);
  assert.equal(session.getSnapshot().customerId, null);
  await signIn();
  oldRequest.resolve(payload('A', 99));
  await old;
  assert.equal(session.getSnapshot().home.revision, 0);
});

test('out-of-order sign-ins cannot overwrite the latest customer', async () => {
  const { session, requests } = setup();
  const first = session.signIn('A');
  await flush();
  const second = session.signIn('B');
  await flush();
  requests[1].resolve(payload('B'));
  await second;
  requests[0].resolve(payload('A'));
  assert.equal(await first, null);
  assert.equal(session.getSnapshot().home.customer.id, 'B');
});

test('sign-in failure reaches login, while obsolete failures are ignored', async () => {
  const { session, requests, signIn } = setup();
  const failed = session.signIn('A');
  const rejected = assert.rejects(failed, /Unavailable/);
  await flush();
  requests[0].reject(new Error('Unavailable'));
  await rejected;
  assert.equal(session.getSnapshot().customerId, null);
  const old = session.signIn('A');
  await flush();
  const oldRequest = requests.at(-1);
  await signIn('B');
  oldRequest.reject(new Error('Old failure'));
  assert.equal(await old, null);
  assert.equal(session.getSnapshot().home.customer.id, 'B');
});

test('cleanup cancels polling and ignores pending results', async () => {
  const { session, requests, timers, tick, signIn } = setup();
  const stop = session.startPolling();
  await signIn();
  await tick();
  const previous = session.getSnapshot().home;
  stop();
  assert.equal(timers.size, 0);
  requests.at(-1).resolve(payload('A', 10));
  await flush();
  assert.equal(session.getSnapshot().home, previous);
});

test('all native pull controls use explicit refresh; actions use silent refresh', () => {
  for (const name of ['Home', 'Products', 'Documents', 'Inbox']) {
    const screen = readFileSync(new URL(`../src/screens/${name}.tsx`, import.meta.url), 'utf8');
    assert.match(screen, /refreshing=\{refreshing\} onRefresh=\{refresh\}/);
    assert.doesNotMatch(screen, /await refresh\(\)/);
  }
  for (const name of ['Documents', 'Inbox', 'Offer']) {
    const screen = readFileSync(new URL(`../src/screens/${name}.tsx`, import.meta.url), 'utf8');
    assert.match(screen, /await refreshAfterAction\(\)/);
  }
});
