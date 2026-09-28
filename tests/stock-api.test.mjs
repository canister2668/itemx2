import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parsers } from 'prettier/plugins/babel';

const fixture = await readFile(new URL('fixtures/risuai.d.ts', import.meta.url), 'utf8');
const provenance = JSON.parse(await readFile(new URL('fixtures/risuai-source.json', import.meta.url)));
// An upstream JSDoc regex example contains a comment terminator. Keep the exact
// fixture; extract declarations instead of silently repairing upstream comments.
function members(name) {
  const body = fixture.split(`interface ${name} {`)[1]?.split('\n}')[0];
  assert.ok(body, `missing upstream interface ${name}`);
  return new Set([...body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/^ {4}(\w+)\??\s*[:(<]/gm)].map((m) => m[1]));
}
const api = members('RisuaiPluginAPI');
const storage = members('PluginStorage');
function walk(node, visit, parents = []) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node, parents);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((x) => walk(x, visit, [...parents, node]));
    else if (value && typeof value === 'object') walk(value, visit, [...parents, node]);
  }
}
// Every host call goes through host() (src/host.js). Members read off host(),
// off host().pluginStorage, and names given to callOptionalRisuApi must all be
// declared by the pinned upstream contract.
const isHostCall = (node) =>
  node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'host';
async function audit(source) {
  const ast = await parsers.babel.parse(source);
  const used = new Set();
  walk(ast, (node, parents) => {
    if (node.type === 'CallExpression' && node.callee.name === 'callOptionalRisuApi') {
      assert.equal(node.arguments[0]?.type, 'StringLiteral', 'optional APIs must have a static name');
      assert.ok(api.has(node.arguments[0].value), `undocumented optional API: ${node.arguments[0].value}`);
    }
    if (!['MemberExpression', 'OptionalMemberExpression'].includes(node.type)) return;
    const host = isHostCall(node.object) || node.object?.name === 'Risuai';
    if (host) {
      if (node.computed && node.property.type !== 'StringLiteral') {
        assert.ok(
          node.property.name === 'name' &&
            parents.some((p) => p.type === 'FunctionDeclaration' && p.id.name === 'callOptionalRisuApi'),
          'unverifiable dynamic RisuAI API'
        );
        return;
      }
      const name = node.computed ? node.property.value : node.property.name;
      used.add(name);
      assert.ok(api.has(name), `undocumented RisuAI API: ${name}`);
    }
    const inner = node.object;
    if (
      ['MemberExpression', 'OptionalMemberExpression'].includes(inner?.type) &&
      (isHostCall(inner.object) || inner.object?.name === 'Risuai') &&
      inner.property?.name === 'pluginStorage'
    )
      assert.ok(
        storage.has(node.computed ? node.property.value : node.property.name),
        'undocumented pluginStorage method'
      );
  });
  return used;
}
test('the stock API fixture is pinned and unchanged', () => {
  assert.match(provenance.commit, /^[0-9a-f]{40}$/);
  assert.equal(createHash('sha256').update(fixture).digest('hex'), provenance.sha256);
});
test('every source and shipped Risuai API exists in the stock contract', async () => {
  const dir = new URL('../src/', import.meta.url);
  const used = new Set();
  for (const name of await readdir(dir, { recursive: true }))
    if (name.endsWith('.js')) for (const one of await audit(await readFile(new URL(name, dir), 'utf8'))) used.add(one);
  assert.ok(used.size >= 25, 'API scanner missed the runtime');
  // The bundle names the global exactly once: the host adapter's lookup.
  const bundle = await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8');
  assert.equal((bundle.match(/\bRisuai\b/g) || []).length, 1, 'only src/host.js may read the Risuai global');
});
test('API audit rejects fork APIs including computed and optional calls', async () => {
  for (const source of [
    'Risuai.forkOnly()',
    'Risuai["forkOnly"]()',
    'Risuai[name]()',
    'callOptionalRisuApi("alertConfirm")',
    'Risuai.pluginStorage.forkOnly()',
    'Risuai.resizeContainer(1, 2)',
    'host().forkOnly()',
    'host().pluginStorage.forkOnly()',
    'host().resizeContainer(1, 2)'
  ])
    await assert.rejects(audit(source));
});
