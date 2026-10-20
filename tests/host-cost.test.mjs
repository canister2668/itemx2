import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost, Style, Panel } from './helpers/modules.mjs';
import { context } from '../src/chat-io.js';

// Stock RisuAI getCharacter() snapshots the whole database to return one
// character; it must not run on every context read.
test('the character is read once per chat and again only when the chat changes', async () => {
  const fake = createFakeHost({ chat: { id: 'chat-a', message: [], scriptstate: {} } });
  setHost(fake.api);
  const characterReads = () => fake.state.calls.filter((one) => one === 'getCharacter').length;
  for (let i = 0; i < 3; i++) assert.equal((await context()).character.chaId, 'bot');
  assert.equal(characterReads(), 1);
  fake.state.chat = { ...fake.state.chat, id: 'chat-b' };
  assert.equal((await context()).key, 'bot:chat-b');
  assert.equal(characterReads(), 2);
});

test('with no host settings screen open the badge check makes one query and reads no button', async () => {
  const fake = createFakeHost({ document: true });
  setHost(fake.api);
  await Style.removeMainStyle();
  await Style.installMainStyle();
  fake.dom.body().setHtml('<button>ITEMX · 권한 및 설정</button><button>a</button><button>b</button>');
  Panel.invalidateHostSettingsVisibility();
  const before = fake.dom.doc.calls.length;
  assert.equal(await Panel.hostPluginSettingsVisible(), false);
  assert.deepEqual(fake.dom.doc.calls.slice(before), ['querySelector']);
});

test('an open host settings screen showing the ITEMX entry still hides the badge', async () => {
  const fake = createFakeHost({ document: true });
  setHost(fake.api);
  await Style.removeMainStyle();
  await Style.installMainStyle();
  fake.dom.doc.layout = () => ({ left: 0, top: 0, right: 120, bottom: 30, width: 120, height: 30 });
  fake.dom
    .body()
    .setHtml('<div class="rs-setting-cont"><button>모델</button><button>ITEMX · 권한 및 설정</button></div>');
  Panel.invalidateHostSettingsVisibility();
  assert.equal(await Panel.hostPluginSettingsVisible(), true);
});
