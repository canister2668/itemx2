import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost, Style, Presentation } from './helpers/modules.mjs';
import { scrollActive } from '../src/activity.js';
import { on } from '../src/events.js';
import { markUnloading } from '../src/connection.js';
import { workQueue } from '../src/kernel.js';

// One fake main document; the body carries the scroll class the governor toggles.
const fake = createFakeHost({ document: true });
setHost(fake.api);
await Style.installMainStyle();
await Presentation.installBodyEffectGovernor();
const body = fake.dom.body();
const scrolling = () => body.classes.includes('x-risu-itemx-body-scrolling');
let idle = 0;
on('scroll-idle', () => idle++);

async function reset(t) {
  await Presentation.resetScrollEffects();
  idle = 0;
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
}

for (const touch of [false, true])
  test(`${touch ? 'touch' : 'wheel'} scrolling activates FX pause and releases queued work once`, async (t) => {
    await reset(t);
    let wakes = 0;
    t.mock.method(workQueue, 'wake', () => wakes++);
    if (touch) Presentation.beginBodyScrollEffects();
    Presentation.continueBodyScrollEffects();
    t.mock.timers.tick(65);
    Presentation.continueBodyScrollEffects();
    t.mock.timers.tick(20);
    assert.equal(scrollActive(), true);
    assert.equal(scrolling(), true);
    t.mock.timers.tick(250);
    assert.equal(scrollActive(), false);
    assert.equal(scrolling(), false);
    assert.equal(wakes, 1);
    assert.equal(idle, 1);
  });

test('cleared timers cannot reactivate effects in an old context', async (t) => {
  await reset(t);
  Presentation.beginBodyScrollEffects();
  Presentation.clearScrollTimers();
  t.mock.timers.tick(1000);
  assert.equal(scrolling(), false);
  assert.equal(scrollActive(), false);
});

test('actual scroll pauses immediately even when the host sends scrollend for short increments', async (t) => {
  await reset(t);
  for (let i = 0; i < 5; i++) {
    Presentation.continueBodyScrollEffects();
    Presentation.endBodyScrollEffects(40);
    t.mock.timers.tick(16);
  }
  assert.equal(scrollActive(), true);
  t.mock.timers.tick(80);
  assert.equal(scrollActive(), false);
});

// Last: unloading cannot be undone within this module instance.
test('queued host events after unload begins cannot arm new scroll timers', async (t) => {
  await reset(t);
  markUnloading();
  Presentation.beginBodyScrollEffects();
  Presentation.continueBodyScrollEffects();
  Presentation.endBodyScrollEffects();
  t.mock.timers.tick(1000);
  assert.equal(scrollActive(), false);
  assert.equal(scrolling(), false);
});
