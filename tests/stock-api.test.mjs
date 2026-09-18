import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { parsers } from 'prettier/plugins/babel';

const fixture = await readFile(new URL('fixtures/risuai.d.ts', import.meta.url), 'utf8');
const provenance = JSON.parse(await readFile(new URL('fixtures/risuai-source.json', import.meta.url)));
// Upstream contains a malformed return type in createMutationObserver. Keep the
// exact fixture; extract declarations instead of silently repairing upstream.
function members(name) {
  const body = fixture.split(`interface ${name} {`)[1]?.split('\n}')[0];
  assert.ok(body, `missing upstream interface ${name}`);
  return new Set([...body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/^    (\w+)\??\s*[:(<]/gm)].map(m => m[1]));
}
const api = members('RisuaiPluginAPI');
const storage = members('PluginStorage');
function walk(node, visit, parents = []) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node, parents);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(x => walk(x, visit, [...parents, node]));
    else if (value && typeof value === 'object') walk(value, visit, [...parents, node]);
  }
}
async function audit(source) {
  const ast = await parsers.babel.parse(source);
  const used = new Set();
  walk(ast, (node, parents) => {
    if (node.type === 'CallExpression' && node.callee.name === 'callOptionalRisuApi') {
      assert.equal(node.arguments[0]?.type, 'StringLiteral', 'optional APIs must have a static name');
      assert.ok(api.has(node.arguments[0].value), `undocumented optional API: ${node.arguments[0].value}`);
    }
    if (!['MemberExpression', 'OptionalMemberExpression'].includes(node.type)) return;
    if (node.object?.name === 'Risuai') {
      if (node.computed && node.property.type !== 'StringLiteral') {
        assert.ok(node.property.name === 'name' && parents.some(p => p.type === 'FunctionDeclaration' && p.id.name === 'callOptionalRisuApi'), 'unverifiable dynamic Risuai API');
        return;
      }
      const name = node.computed ? node.property.value : node.property.name;
      used.add(name);
      if (name === 'resizeContainer') {
        // The only fork extension: rejection must be handled by the actual try.
        assert.ok(parents.some(p => p.type === 'TryStatement' && p.handler && node.start >= p.block.start && node.end <= p.block.end), 'resizeContainer must have a fallback');
      } else assert.ok(api.has(name), `undocumented Risuai.${name}`);
    }
    if (node.object?.object?.name === 'Risuai' && node.object.property?.name === 'pluginStorage') {
      assert.ok(storage.has(node.computed ? node.property.value : node.property.name), 'undocumented pluginStorage method');
    }
  });
  return used;
}
test('the stock API fixture is pinned and unchanged', () => {
  assert.match(provenance.commit, /^[0-9a-f]{40}$/);
  assert.equal(createHash('sha256').update(fixture).digest('hex'), provenance.sha256);
});
test('every source and shipped Risuai API exists in the stock contract', async () => {
  const dir = new URL('../src/', import.meta.url);
  for (const name of await readdir(dir)) if (name.endsWith('.js')) await audit(await readFile(new URL(name, dir), 'utf8'));
  const used = await audit(await readFile(new URL('../dist/itemx2.plugin.js', import.meta.url), 'utf8'));
  assert.ok(used.size >= 25, 'API scanner missed the runtime');
});
test('API audit rejects fork APIs including computed and optional calls', async () => {
  for (const source of ['Risuai.forkOnly()', 'Risuai["forkOnly"]()', 'Risuai[name]()', 'callOptionalRisuApi("alertConfirm")', 'Risuai.pluginStorage.forkOnly()', 'Risuai.resizeContainer(1, 2)'])
    await assert.rejects(audit(source));
});
test('resizeContainer rejection executes the bounded fullscreen fallback', async () => {
  const source = await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8');
  const start = source.indexOf('      try {\n        await Risuai.resizeContainer');
  const end = source.indexOf('      document.head.innerHTML', start);
  const runtime = { compactContainer: true };
  await vm.runInNewContext(`(async () => {${source.slice(start, end)}})()`, {
    runtime, panelHeight: 600, panelWidth: 400, log() {},
    Risuai: { resizeContainer: async () => { throw new Error('API method resizeContainer not found'); } }
  });
  assert.equal(runtime.compactContainer, false);
});
