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

test('failed returns and thrown errors back off through 10, 20, 40, 80 and 120 seconds', async () => {
  let now=0,calls=0; const queue=create({Date:{now:()=>now}});
  for(const delay of [10000,20000,40000,80000,120000,120000]) {
    await assert.rejects(queue.attempt('aux','same',()=>{calls++;throw Error('offline')}),/offline/);
    now+=delay-1;
    assert.equal((await queue.attempt('aux','same',()=>assert.fail('retry storm'))).skipped,true);
    now++;
  }
  assert.equal(calls,6);
  assert.equal((await queue.attempt('aux','new-message',()=>[])).skipped,false);
});

test('automatic recovery stops after its attempt budget instead of retrying forever', async () => {
  let now=0,calls=0; const queue=create({Date:{now:()=>now}});
  for (let n=0;n<3;n++) {
    await assert.rejects(queue.attempt('catch-up','slow',()=>{calls++;throw Error('timed out')},Array.isArray,Infinity,3),/timed out/);
    now+=200000;
  }
  const exhausted=await queue.attempt('catch-up','slow',()=>assert.fail('fourth provider call'),Array.isArray,Infinity,3);
  assert.equal(exhausted.skipped,true); assert.equal(exhausted.exhausted,true); assert.equal(calls,3);
  assert.equal((await queue.attempt('catch-up','next-message',()=>[],Array.isArray,Infinity,3)).skipped,false);
});

test('scroll end runs while a model RPC is suspended, without admitting blocked heavy work', async () => {
  const queue=create(),hold=gate(),seen=[];
  const aux=queue.enqueue({kind:'aux',work:()=>queue.external(()=>hold.promise)});
  await tick();let scrolling=true;
  const render=queue.enqueue({kind:'render',ready:()=>!scrolling,work:()=>seen.push('render')});
  queue.schedule('bodyFxScrollTimer',()=>{scrolling=false;seen.push('scroll end')},0);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual(seen,['scroll end']);
  hold.resolve();await Promise.all([aux,render]);
  assert.deepEqual(seen,['scroll end','render']);
});

test('domain state keeps at most 60 fields without runtime coordination flags', async () => {
  const source = await readFile(new URL('../src/state.js', import.meta.url), 'utf8');
  const owners = vm.runInNewContext(source + '\nITEMXState.create();');
  const fields = Object.values(owners).flatMap(owner => Object.keys(owner)).filter(key => key !== 'view');
  assert.ok(fields.length <= 60, `${fields.length} runtime fields`);
  assert.ok(!fields.some(name => /Busy$|Promise$|Pending$|Fingerprint$/.test(name)), 'coordination belongs to the queue');
});
