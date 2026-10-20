import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeHost } from './helpers/fake-host.mjs';
import { setHost } from '../src/host.js';
import * as Settings from '../src/settings.js';
import { on } from '../src/events.js';

test('settings use one document, preserve other characters and centralize every default', async () => {
  const fake = createFakeHost();
  setHost(fake.api);
  await Settings.changeSettings({ chaId: 'one' }, { enabled: false, skin: 'hanji' });
  await Settings.changeSettings({ chaId: 'two' }, { auxOutput: 'always' });
  assert.deepEqual([...fake.state.storage.keys()], ['itemx:settings']);
  const document = JSON.parse(fake.state.storage.get('itemx:settings'));
  assert.equal(document.characters.one.enabled, false);
  assert.equal(document.characters.one.skin, 'hanji');
  assert.equal(document.characters.two.auxOutput, 'always');
  assert.equal(document.characters.two.skillsEnabled, true);
});

test('invalid values fall back to the schema default instead of being stored', async () => {
  setHost(createFakeHost().api);
  const settings = await Settings.changeSettings(
    { chaId: 'bad' },
    { effectsLevel: 'loud', skin: 'neon', enabled: 'yes' }
  );
  assert.equal(settings.effectsLevel, 'full');
  assert.equal(settings.skin, 'dark');
  assert.equal(settings.enabled, true);
});

test('reads are served from memory after the first, and every change is announced', async () => {
  const fake = createFakeHost();
  setHost(fake.api);
  const seen = [];
  const off = on('settings', ({ patch }) => seen.push(patch));
  const character = { chaId: 'cached' };
  await Settings.settingsFor(character);
  await Settings.settingsFor(character);
  assert.equal(fake.state.calls.filter((call) => call === 'pluginStorage.getItem').length, 1);
  await Settings.changeSettings(character, { fontScale: 'large' });
  assert.equal((await Settings.settingsFor(character)).fontScale, 'large');
  assert.deepEqual(seen, [null, { fontScale: 'large' }]);
  off();
});

test('the badge position is a global preference with a closed set of values', async () => {
  const fake = createFakeHost();
  setHost(fake.api);
  await Settings.setBadgePosition('lt');
  await assert.rejects(Settings.setBadgePosition('middle'));
  assert.equal(JSON.parse(fake.state.storage.get('itemx:settings')).global.badgePosition, 'lt');
  assert.equal(await Settings.loadBadgePosition(), 'lt');
});

test('the update check reads the published version once per page load', async () => {
  const { checkForUpdate } = await import('../src/update-check.js');
  const { updateState } = await import('../src/connection.js');
  const { resetSession } = await import('../src/session.js');
  let fetches = 0;
  setHost({
    nativeFetch: async () => {
      fetches += 1;
      return { ok: true, text: async () => '//@name itemx2\n//@version 99.0.0\n' };
    }
  });
  resetSession('update-once');
  await checkForUpdate();
  await checkForUpdate();
  assert.equal(fetches, 1);
  assert.equal(updateState().latest, '99.0.0');
  assert.equal(updateState().available, true);
});
