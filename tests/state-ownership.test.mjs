import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/state.js', import.meta.url), 'utf8');
const create = vm.runInNewContext(source + '\nITEMXState.create;');
const schema = JSON.parse(await readFile(new URL('fixtures/state-owners.json', import.meta.url)));

test('every state field has exactly one domain owner and domains cannot grow hidden fields', () => {
  const owners = create();
  for (const [field, port] of Object.entries(schema)) {
    const expected = port.replace(/State$/, '');
    assert.deepEqual(Object.keys(owners).filter(name => Object.hasOwn(owners[name], field)), [expected]);
  }
  for (const owner of Object.values(owners)) {
    assert.equal(Object.isFrozen(owner), true);
    assert.throws(() => { owner.newBusyFlag = true; }, TypeError);
  }
});

test('state instances and their mutable collections are isolated', () => {
  const a = create(), b = create();
  a.pipeline.generation++;
  a.portraits.portraitCache.set('asset', 'image');
  a.ui.rootOpen = true;
  assert.equal(b.pipeline.generation, 0);
  assert.equal(b.portraits.portraitCache.size, 0);
  assert.equal(b.ui.rootOpen, false);
  assert.equal('rootOpen' in a.pipeline, false);
  assert.equal('generation' in a.ui, false);
});
