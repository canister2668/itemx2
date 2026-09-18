import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/work-queue.js', import.meta.url), 'utf8');
const create = (overrides = {}) =>
  vm.runInNewContext(source + '\nITEMXWorkQueue.create;', { setTimeout, clearTimeout, setInterval, clearInterval, ...overrides })();
const tick = () => new Promise((resolve) => setImmediate(resolve));
const gate = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
test('queue serializes work, keeps FIFO position and coalesces pending kinds to latest intent', async () => {
  const queue = create(),
    hold = gate(),
    seen = [];
  const first = queue.enqueue({ kind: 'hold', work: () => hold.promise });
  const a = queue.enqueue({ kind: 'render', work: () => seen.push('stale') });
  const b = queue.enqueue({ kind: 'aux', work: () => seen.push('aux') });
  const c = queue.enqueue({ kind: 'render', work: () => seen.push('latest') });
  assert.equal(a, c);
  assert.deepEqual(seen, []);
  hold.resolve();
  await Promise.all([first, a, b, c]);
  assert.deepEqual(seen, ['latest', 'aux']);
});
test('active work gets one pending successor rather than dropping updates', async () => {
  const queue = create(),
    hold = gate(),
    seen = [];
  const a = queue.enqueue({ kind: 'rebuild', work: () => hold.promise });
  await tick();
  const b = queue.enqueue({ kind: 'rebuild', work: () => seen.push(1) });
  const c = queue.enqueue({ kind: 'rebuild', work: () => seen.push(2) });
  hold.resolve();
  await Promise.all([a, b, c]);
  assert.deepEqual(seen, [2]);
});
test('model RPC yields its slot to reentrant hooks and resumes exclusively', async () => {
  const queue = create(),
    seen = [];
  const aux = queue.enqueue({
    kind: 'aux',
    work: async () => {
      seen.push('prepare');
      const value = await queue.external(() =>
        queue.enqueue({
          kind: 'output',
          unique: true,
          reentrant: true,
          work: () => {
            seen.push('hook');
            return 42;
          }
        })
      );
      seen.push(`commit:${value}`);
    }
  });
  await aux;
  assert.deepEqual(seen, ['prepare', 'hook', 'commit:42']);
});
test('failures release ownership and cancellation prevents queued work', async () => {
  const queue = create(),
    hold = gate();
  const a = queue.enqueue({
    kind: 'fail',
    work: async () => {
      await hold.promise;
      throw Error('expected');
    }
  });
  const b = queue.enqueue({ kind: 'stale', work: () => assert.fail('cancelled task executed') });
  const rejected = assert.rejects(b, { name: 'AbortError' });
  queue.cancel((intent) => intent.kind === 'stale');
  hold.resolve();
  await assert.rejects(a, /expected/);
  await rejected;
  assert.equal(await queue.enqueue({ kind: 'next', work: () => 1 }), 1);
});
test('unload cancels suspended work and cannot rearm timers', async () => {
  const queue = create(),
    hold = gate();
  const a = queue.enqueue({
    kind: 'aux',
    work: async () => {
      await queue.external(() => hold.promise);
      assert.fail('post-unload commit');
    }
  });
  const rejected = assert.rejects(a, { name: 'AbortError' });
  await tick();
  queue.close();
  hold.resolve();
  await rejected;
  queue.schedule('watchdog', () => assert.fail('timer after unload'), 1);
  assert.equal(queue.hasTimer('watchdog'), false);
});

test('model wait admits reentrant hooks but holds unrelated mutations until commit', async () => {
  const queue = create(), hold = gate(), seen = [];
  const aux = queue.enqueue({ kind: 'aux', work: async () => {
    seen.push('prepare');
    await queue.external(() => hold.promise);
    seen.push('commit');
  } });
  await tick();
  const mutation = queue.enqueue({ kind: 'settings', work: () => seen.push('settings') });
  await queue.enqueue({ kind: 'display', reentrant: true, work: () => seen.push('display') });
  assert.deepEqual(seen, ['prepare', 'display']);
  hold.resolve(); await Promise.all([aux, mutation]);
  assert.deepEqual(seen, ['prepare', 'display', 'commit', 'settings']);
});

test('shutdown waits for active ownership before the caller tears down DOM', async () => {
  const queue = create(), hold = gate(), seen = [];
  const running = queue.enqueue({ kind: 'render', work: async () => { await hold.promise; seen.push('render finished'); } });
  await tick();
  const closed = queue.close().then(() => seen.push('teardown'));
  await tick(); assert.deepEqual(seen, []);
  hold.resolve(); await Promise.all([running, closed]);
  assert.deepEqual(seen, ['render finished', 'teardown']);
});

test('scroll-blocked work keeps the latest intent and resumes exactly once', async () => {
  const queue = create(), seen = [];
  let scrolling = true;
  const a = queue.enqueue({ kind: 'render', ready: () => !scrolling, work: () => seen.push('old') });
  const b = queue.enqueue({ kind: 'render', ready: () => !scrolling, work: () => seen.push('new') });
  assert.equal(a, b);
  await queue.enqueue({ kind: 'scroll-end', work: () => { scrolling = false; queue.wake(); } });
  await a;
  assert.deepEqual(seen, ['new']);
});

test('successful message identities deduplicate; failures retain bounded retry eligibility', async () => {
  let now = 0, calls = 0;
  const queue = create({ Date: { now: () => now } });
  const run = (result) => queue.attempt('aux', 'chat:1:msg-stable', () => { calls++; return result; }, Array.isArray);
  assert.equal((await run(null)).skipped, false);
  assert.equal((await run([])).skipped, true);
  now = 10001;
  assert.equal((await run([])).skipped, false);
  now = 999999;
  assert.equal((await run([])).skipped, true);
  assert.equal(calls, 2);
  queue.forget('aux');
  assert.equal((await run([])).skipped, false);
});

test('stabilization requires an unchanged candidate for the whole quiet period', () => {
  let now = 0;
  const queue = create({ Date: { now: () => now } });
  assert.equal(queue.settled('aux', 'a', 1500), false);
  now = 1499; assert.equal(queue.settled('aux', 'a', 1500), false);
  assert.equal(queue.settled('aux', 'b', 1500), false);
  now = 2999; assert.equal(queue.settled('aux', 'b', 1500), true);
});

test('runtime keeps at most 60 fields including dynamically added fields', async () => {
  const runtime = await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8');
  const declaration = runtime.slice(runtime.indexOf('  const runtime = {'), runtime.indexOf('\n  };', runtime.indexOf('  const runtime = {')));
  const fields = new Set([...declaration.matchAll(/^    (\w+):/gm)].map(match => match[1]));
  for (const match of runtime.matchAll(/\bruntime\.(\w+)/g)) fields.add(match[1]);
  assert.ok(fields.size <= 60, `${fields.size} runtime fields`);
  assert.ok(![...fields].some(name => /Busy$|Promise$|Pending$|Fingerprint$/.test(name)), 'coordination belongs to the queue');
});
