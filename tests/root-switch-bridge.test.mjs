import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { createIframeDocument } from './helpers/fake-dom.mjs';
import { setHost, Style, Controls, uiState } from './helpers/modules.mjs';

const selector = '.x-risu-itemx2-setting-main';

// A stock host document whose settings row holds one switch with a knob.
async function hostDocument(onClass = 'x-risu-itemx2-setting-on') {
  const fake = createFakeHost({ document: true });
  await Style.removeMainStyle();
  setHost(fake.api);
  await Style.installMainStyle();
  fake.dom
    .body()
    .setHtml(
      `<div class="x-risu-itemx2-root-drawer"><button class="x-risu-itemx2-setting-main ${onClass}" role="switch" aria-checked="true" aria-label="Keep label"><i></i></button></div>`
    );
  uiState.panelOpen = false;
  uiState.rootOpen = false;
  const control = () => fake.dom.root.find('.x-risu-itemx2-setting-main')[0];
  return { fake, control };
}

for (const onClass of ['x-risu-itemx2-setting-on', 'x-risu-itemx2-power-on'])
  test(`the stock bridge updates ${onClass} and ARIA without forbidden attribute writes`, async () => {
    const { fake, control } = await hostDocument(onClass);
    fake.dom.doc.focused = control();
    for (const on of [false, true]) {
      assert.equal(await Controls.updateRootSwitch(selector, on, onClass), true);
      assert.equal(control().classes.includes(onClass), on);
      assert.equal(control().attrs['aria-checked'], String(on));
      assert.equal(control().attrs['aria-label'], 'Keep label');
      assert.equal(control().html(), '<i></i>', 'the knob markup is kept');
      assert.equal(fake.dom.doc.focused, control(), 'focus follows the replaced switch');
    }
  });

test('a host switch that was not focused does not steal focus', async () => {
  const { fake, control } = await hostDocument();
  fake.dom.doc.focused = null;
  await Controls.updateRootSwitch(selector, false);
  assert.equal(fake.dom.doc.focused, null);
  assert.equal(control().attrs['aria-checked'], 'false');
});

test('unexpected bridge write failures remain visible to the action error handler', async () => {
  const { fake } = await hostDocument();
  const element = await (await fake.api.getRootDocument()).querySelector(selector);
  element.setOuterHTML = async () => {
    throw new Error('bridge disconnected');
  };
  await assert.rejects(Controls.updateRootSwitch(selector, false), /bridge disconnected/);
});

test('the active iframe owns switch, domain and text-button patches despite a hidden host copy', async () => {
  const { fake } = await hostDocument();
  const hostCalls = () => fake.dom.doc.calls.length;
  const frame = createIframeDocument();
  frame
    .body()
    .setHtml(
      '<button class="itemx2-setting-main itemx2-setting-on" role="switch" aria-checked="true"><i></i></button>'
    );
  globalThis.document = frame.document;
  uiState.panelOpen = true;
  const before = hostCalls();
  const control = () => frame.root.find('.itemx2-setting-main')[0];
  await Controls.updateRootSwitch(selector, false);
  assert.equal(control().attrs['aria-checked'], 'false');
  assert.equal(control().classes.includes('itemx2-setting-on'), false);
  await Controls.updateRootDomainCard(selector, true, 'ON');
  assert.equal(control().find('i')[0].textOf(), 'ON');
  assert.equal(control().classes.includes('itemx2-setting-on'), true);
  await Controls.updateRootSettingButton(selector, 'Ready', false);
  assert.equal(control().textOf(), 'Ready');
  assert.equal(control().classes.includes('itemx2-setting-on'), false);
  assert.equal(hostCalls(), before, 'the hidden host copy is never searched');
  uiState.panelOpen = false;
  delete globalThis.document;
});
