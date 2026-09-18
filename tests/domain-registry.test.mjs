import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationRuntime } from './helpers/presentation-runtime.mjs';

test('every codex transport tag routes from one registry', async () => {
  const { codex } = await presentationRuntime();
  assert.equal([...codex.DOMAIN_NAMES].join(','), 'skill,monster');
  for (const name of codex.DOMAIN_NAMES) {
    const spec = codex.DOMAINS[name];
    assert.equal(codex.routeTag(spec.exam).domain, name);
    assert.equal(codex.routeTag(spec.exam).kind, 'exam');
    assert.equal(codex.routeTag(spec.patch).domain, name);
    assert.equal(codex.routeTag(spec.patch).kind, 'patch');
  }
});

test('tag routing is case-insensitive, as the parser regex is', async () => {
  const { codex } = await presentationRuntime();
  assert.equal(codex.routeTag('SKILLEXAM').domain, 'skill');
  assert.equal(codex.routeTag('monsterpatch').domain, 'monster');
});

test('an unregistered tag routes nowhere instead of defaulting to the bestiary', async () => {
  const { codex } = await presentationRuntime();
  // This is the regression that made any new domain silently corrupt encounters.
  for (const tag of ['walletPatch', 'questExam', 'itemPatch', 'skil', '', 'monste'])
    assert.equal(codex.routeTag(tag), null, `${tag} must not resolve to a domain`);
});

test('storeFor resolves each domain registry and rejects unknown ones', async () => {
  const { codex } = await presentationRuntime();
  const state = codex.snapshot();
  assert.equal(codex.storeFor(state, 'skill'), state.skills);
  assert.equal(codex.storeFor(state, 'monster'), state.monsters);
  assert.equal(codex.storeFor(state, 'wallet'), undefined);
});

test('an unknown transport tag is left alone in the narrative, not consumed', async () => {
  const { codex } = await presentationRuntime();
  const text = 'before <walletPatch><id>gold</id></walletPatch> after';
  const result = codex.extractResponse(text, codex.snapshot(), {});
  assert.equal(result.events.length, 0);
  assert.ok(result.content.includes('walletPatch'), 'foreign tags must pass through untouched');
  assert.equal(result.snapshot.monsters.order.length, 0, 'bestiary must stay empty');
});

test('a real encounter transport still registers through the registry', async () => {
  const { codex } = await presentationRuntime();
  const text =
    '<monsterExam><id>wolf</id><name>늑대</name><relation>hostile</relation><status>active</status></monsterExam>';
  const result = codex.extractResponse(text, codex.snapshot(), {});
  assert.equal(result.snapshot.monsters.order.length, 1);
  assert.equal(result.snapshot.monsters.entries.wolf.name, '늑대');
  assert.equal(result.snapshot.skills.order.length, 0);
});
