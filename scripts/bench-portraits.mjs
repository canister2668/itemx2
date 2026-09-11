import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const raw = execFileSync('python3', ['-c', `
import sqlite3, json
con=sqlite3.connect('/volume2/risu/save/risu.db')
m=json.loads(con.execute('SELECT data FROM modules WHERE id=547741').fetchone()[0])
print(json.dumps({'id': m['id'], 'namespace': m.get('namespace'), 'assets': m['assets']}))
`], { maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' });
const thgy = JSON.parse(raw);
const context = vm.createContext({ console, Buffer, TextEncoder, TextDecoder });
vm.runInContext(await readFile(new URL('../src/core.js', import.meta.url), 'utf8'), context);
vm.runInContext(await readFile(new URL('../src/codex.js', import.meta.url), 'utf8'), context);
const codex = context.ITEMXCodex;
const database = { enabledModules: [thgy.id], modules: [thgy] };
const character = { modules: [thgy.id] };
const narrative = '<img="hakurei_reimu_annoyed">\n<img="kirisame_marisa_smile">\n<img="hong_meiling_defeated">\n하쿠레이 레이무와 키리사메 마리사가 홍 메이링을 제압했다.';
const entities = [
  { id: 'reimu', name: '하쿠레이 레이무', aliases: ['레이무'], portrait: 'NONE' },
  { id: 'marisa', name: '키리사메 마리사', aliases: ['마리사'], portrait: 'NONE' },
  { id: 'meiling', name: '홍 메이링', aliases: ['메이링'], portrait: 'NONE' }
];

function bench(label, fn, n = 20) {
  fn();
  const t0 = process.hrtime.bigint();
  let last;
  for (let i = 0; i < n; i += 1) last = fn();
  return { label, ms: Number(process.hrtime.bigint() - t0) / 1e6 / n, last };
}

const catalog = bench('activeModuleAssetCatalog', () => codex.activeModuleAssetCatalog(database, character, {}), 8);
const rows = catalog.last;
const empty = bench('portraitProtocolNames empty', () => codex.portraitProtocolNames(rows, { narrative: '', entities: [], max: 180 }));
const scene = bench('portraitProtocolNames scene+3', () => codex.portraitProtocolNames(rows, { narrative, entities, max: 180 }));
const one = bench('assetForEntity reimu', () => codex.assetForEntity(rows, entities[0], narrative));
const twenty = bench('assetForEntity x20', () => {
  const out = [];
  for (let i = 0; i < 20; i += 1) out.push(codex.assetForEntity(rows, entities[i % 3], narrative));
  return out;
}, 8);
const lookup = bench('assetLookup exact', () => codex.assetLookup(rows, 'hakurei_reimu_annoyed'));
const proto = bench('protocol()', () => codex.protocol(scene.last, { enabledDomains: ['monster'] }), 5);
const mem = process.memoryUsage();

console.log(JSON.stringify({
  assets: thgy.assets.length,
  catalogMs: +catalog.ms.toFixed(3),
  catalogRows: rows.length,
  protocolEmptyMs: +empty.ms.toFixed(3),
  protocolEmptyCount: empty.last.length,
  protocolSceneMs: +scene.ms.toFixed(3),
  protocolSceneCount: scene.last.length,
  protocolSceneFirst: scene.last.slice(0, 6),
  protocolChars: scene.last.join(' ;; ').length,
  entityMs: +one.ms.toFixed(3),
  entityName: one.last?.name,
  twentyMs: +twenty.ms.toFixed(3),
  lookupMs: +lookup.ms.toFixed(3),
  protocolBuildMs: +proto.ms.toFixed(3),
  protocolTextChars: proto.last.length,
  heapMB: Math.round(mem.heapUsed / 1024 / 1024),
  rowJsonKB: Math.round(JSON.stringify(rows).length / 1024)
}, null, 2));
