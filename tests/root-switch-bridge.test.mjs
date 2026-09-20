import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/aux.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('  async function updateRootSwitch('), source.indexOf('  async function applyRootSetting('));
const selector = '.x-risu-itemx2-setting-main';

// Deliberately enforce the stock bridge boundary. The browser probe separately
// checks actual DOM replacement, computed styles, focus and stored settings.
function hostControl(onClass = 'x-risu-itemx2-setting-on') {
  const state = { classes: new Set(['x-risu-itemx2-setting-main', onClass]), checked: 'true',
    contents: '<i></i>', focused: true, replacements: 0, forbiddenWrites: 0 };
  const port = {
    async addClass(name) { state.classes.add(name); },
    async removeClass(name) { state.classes.delete(name); },
    async setAttribute(name) {
      state.forbiddenWrites++;
      throw new Error(`SafeElement rejects ${name}`);
    },
    async getOuterHTML() {
      return `<button class="${[...state.classes].join(' ')}" role="switch" aria-checked="${state.checked}" aria-label="Keep label">${state.contents}</button>`;
    },
    async setOuterHTML(html) {
      state.replacements++;
      state.focused = false;
      state.checked = html.match(/aria-checked="([^"]+)"/)[1];
      assert.ok(html.includes('aria-label="Keep label"'));
      assert.ok(html.endsWith(`${state.contents}</button>`), 'keep the knob markup');
    },
    async focus() { state.focused = true; }
  };
  return { state, port, doc: { async querySelector(query) {
    if (query === selector || (query === `${selector}:focus` && state.focused)) return port;
    return null;
  } } };
}

function runtime(doc, { panelOpen = false, hostDoc = doc } = {}) {
  const calls = { repaint: 0 };
  const sandbox = vm.createContext({
    panelDocument: () => doc,
    hostState: { mainDoc: hostDoc },
    uiState: { panelOpen, rootOpen: true, activeRootTab: 'settings' },
    openRootInventory: async () => { calls.repaint++; }
  });
  vm.runInContext(`${helpers}\nglobalThis.api = { updateRootSwitch, updateRootDomainCard, updateRootSettingButton };`, sandbox);
  return { ...sandbox.api, calls };
}

for (const onClass of ['x-risu-itemx2-setting-on', 'x-risu-itemx2-power-on']) {
  test(`stock bridge updates ${onClass} and ARIA without forbidden attribute writes`, async () => {
    const { state, doc } = hostControl(onClass);
    const rt = runtime(doc);
    for (const on of [false, true]) {
      assert.equal(await rt.updateRootSwitch(selector, on, onClass), true);
      assert.equal(state.classes.has(onClass), on);
      assert.equal(state.checked, String(on));
      assert.equal(state.focused, true);
    }
    assert.equal(state.forbiddenWrites, 0);
    assert.equal(state.replacements, 2);
    assert.equal(rt.calls.repaint, 0, 'no panel repaint after a successful patch');
  });
}

test('the active iframe owns switch, domain and text-button patches despite a hidden host copy', async () => {
  const { state, port, doc } = hostControl();
  port.setAttribute = async (name, value) => { assert.equal(name, 'aria-checked'); state.checked = value; };
  port.setOuterHTML = async () => assert.fail('native switches must keep their DOM node');
  let label = '';
  port.setTextContent = async value => { label = value; };
  port.querySelector = async query => { assert.equal(query, 'i'); return { setTextContent: async value => { label = value; } }; };
  const hostDoc = { querySelector: async () => assert.fail('must not search the hidden host document') };
  const rt = runtime(doc, { panelOpen: true, hostDoc });
  await rt.updateRootSwitch(selector, false);
  assert.equal(state.checked, 'false');
  assert.equal(state.classes.has('x-risu-itemx2-setting-on'), false);
  await rt.updateRootDomainCard(selector, true, 'ON');
  assert.equal(label, 'ON');
  assert.equal(state.classes.has('x-risu-itemx2-setting-on'), true);
  await rt.updateRootSettingButton(selector, 'Ready', false);
  assert.equal(label, 'Ready');
  assert.equal(state.classes.has('x-risu-itemx2-setting-on'), false);
  assert.equal(rt.calls.repaint, 0);
});

test('a missing active control repaints once instead of patching a hidden copy', async () => {
  const rt = runtime({ querySelector: async () => null }, { panelOpen: true,
    hostDoc: { querySelector: async () => assert.fail('hidden copy is not a fallback target') } });
  assert.equal(await rt.updateRootSwitch(selector, false), true);
  assert.equal(rt.calls.repaint, 1);
});

test('a host switch that was not focused does not steal focus', async () => {
  const { state, doc } = hostControl();
  state.focused = false;
  await runtime(doc).updateRootSwitch(selector, false);
  assert.equal(state.focused, false);
  assert.equal(state.checked, 'false');
});

test('unexpected bridge write failures remain visible to the action error handler', async () => {
  const { port, doc } = hostControl();
  port.setOuterHTML = async () => { throw new Error('bridge disconnected'); };
  await assert.rejects(runtime(doc).updateRootSwitch(selector, false), /bridge disconnected/);
});
