import test from 'node:test';
import assert from 'node:assert/strict';
import { Panel } from './helpers/modules.mjs';
import { workQueue } from '../src/kernel.js';

// Scroll completion schedules a light pass that may skip a closed drawer. It
// must never coalesce away a full refresh a host mutation scheduled meanwhile.
test('a light scroll pass cannot replace a pending full host refresh', () => {
  Panel.scheduleHostDomSync(50);
  Panel.scheduleHostDomSync(50, { light: true });
  assert.equal(workQueue.hasTimer('hostSyncTimer'), true);
  assert.equal(workQueue.hasTimer('hostLightSyncTimer'), true);
  workQueue.clearTimer('hostSyncTimer');
  workQueue.clearTimer('hostLightSyncTimer');
});
