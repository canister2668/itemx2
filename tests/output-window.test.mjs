import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost, Ledger, Panel, Pipeline, Presentation, Session, Style } from './helpers/modules.mjs';
import {
  OUTPUT_IDLE_MS,
  endOutputWindow,
  markOutputFlush,
  outputActive,
  setOutputWindowSink
} from '../src/activity.js';
import { on } from '../src/events.js';
import { workQueue } from '../src/kernel.js';

const fake = createFakeHost({ document: true, character: { chaId: 'ow', name: 'Test' } });
setHost(fake.api);
await Style.installMainStyle();
await Presentation.installBodyEffectGovernor();
Session.resetSession('ow:chat');
await Ledger.rebuildCurrent();
const body = fake.dom.body();
const streaming = () => body.classes.includes('x-risu-itemx-body-streaming');
let idle = 0;
// main.js wires the same subscription.
on('output-idle', () => {
  idle++;
  Panel.flushDeferredOutputSync();
});
const calls = (name) => fake.state.calls.filter((one) => one === name).length;

function reset(t) {
  endOutputWindow();
  setOutputWindowSink(Presentation.outputWindowChanged);
  idle = 0;
  fake.state.characterIndex = 0;
  fake.state.chatIndex = 0;
  workQueue.clearTimer('hostSyncTimer');
  workQueue.clearTimer('hostLightSyncTimer');
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
}

test('the main style pauses card motion under the streaming class exactly like scrolling', () => {
  const css = Style.mainStyleText();
  const scroll = css.match(/body\.x-risu-itemx-body-scrolling[^{]*\{animation-play-state:paused!important\}/)[0];
  assert.ok(css.includes(scroll.replaceAll('x-risu-itemx-body-scrolling', 'x-risu-itemx-body-streaming')));
});

test('flushes keep the window open; it closes once after the idle gap and drops the body class', async (t) => {
  reset(t);
  for (let i = 0; i < 20; i++) {
    markOutputFlush();
    t.mock.timers.tick(125);
  }
  await Promise.resolve();
  assert.equal(outputActive(), true);
  assert.equal(streaming(), true);
  assert.equal(idle, 0);
  t.mock.timers.tick(OUTPUT_IDLE_MS);
  await Promise.resolve();
  assert.equal(outputActive(), false);
  assert.equal(streaming(), false);
  assert.equal(idle, 1);
});

test('the output hook opens the window and the chat listener path closes it at once', async (t) => {
  reset(t);
  await Pipeline.outputFallback('평범한 문장.');
  assert.equal(outputActive(), true);
  endOutputWindow();
  assert.equal(outputActive(), false);
  assert.equal(idle, 1);
  endOutputWindow();
  assert.equal(idle, 1);
});

test('host sync during the window reads only indexes and runs once after it closes', async (t) => {
  reset(t);
  markOutputFlush();
  const before = { character: calls('getCharacter'), chat: calls('getChatFromIndex') };
  await Panel.ensureRootInventory();
  assert.equal(calls('getCharacter'), before.character);
  assert.equal(calls('getChatFromIndex'), before.chat);
  assert.equal(outputActive(), true);
  assert.equal(workQueue.hasTimer('hostSyncTimer'), false);
  endOutputWindow();
  assert.equal(workQueue.hasTimer('hostSyncTimer'), true);
});

test('a chat switch during the window is never deferred and closes the window', async (t) => {
  reset(t);
  markOutputFlush();
  fake.state.chatIndex = 3;
  const before = calls('getCharacter');
  await Panel.ensureRootInventory();
  assert.equal(outputActive(), false);
  assert.ok(calls('getCharacter') > before);
});

test('closing without deferred work schedules nothing', async (t) => {
  reset(t);
  markOutputFlush();
  endOutputWindow();
  assert.equal(workQueue.hasTimer('hostSyncTimer'), false);
});
