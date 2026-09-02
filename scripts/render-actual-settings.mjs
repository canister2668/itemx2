import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { TextEncoder, TextDecoder } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const built = await readFile(resolve(root, 'dist/itemx2.plugin.js'), 'utf8');
const bootstrap = '  try {\n    await loadBadgePosition();';
const instrumented = built.replace(bootstrap, `  globalThis.__itemxGuideUi = { rootInventoryHtml, codexInlineEventHtml, mainStyleText, runtime };\n${bootstrap}`);
if (instrumented === built) throw new Error('ITEMX guide UI export point not found');

const idle = async () => {};
const Risuai = {
  pluginStorage: { getItem: async () => null, setItem: idle },
  safeLocalStorage: { getItem: async () => null, setItem: idle },
  getCurrentCharacterIndex: async () => { throw new TypeError("Cannot read properties of undefined (reading 'chatPage')"); },
  getCurrentChatIndex: async () => { throw new TypeError("Cannot read properties of undefined (reading 'chatPage')"); },
  getCharacter: async () => null,
  registerSetting: async () => ({ id: 'guide-setting' }),
  addRisuScriptHandler: idle, removeRisuScriptHandler: idle,
  unregisterUIPart: idle, onUnload: idle, hideContainer: idle
};
const sandbox = vm.createContext({
  console, Buffer, TextEncoder, TextDecoder, structuredClone, Risuai,
  setTimeout, clearTimeout, setInterval: () => 1, clearInterval: idle,
  document: { head: {}, body: {} }
});
await vm.runInContext(instrumented, sandbox);
const guide = sandbox.__itemxGuideUi;
if (!guide) throw new Error('ITEMX guide UI export failed');
guide.runtime.permissions.replacer = true;
guide.runtime.permissions.mainDom = true;
guide.runtime.hooks.listener = true;
guide.runtime.status = '정상 · 아이템 4 · 스킬 3 · 도감 2';

const item = (id, name, emoji, rarity, location = 'inventory') => ({ id, name, emoji, rarity, displayRarity: rarity, possession: 'owned', location });
const items = [
  item('moon_blade', '월영의 음검', '🗡️', '에픽', 'equipped'),
  item('silk_robe', '청운 비단장포', '👘', '레어', 'equipped'),
  item('healing_pill', '하급 회복단', '🧪', '일반'),
  item('sealed_manual', '금제된 검보', '📜', '유니크')
];
const loaded = {
  character: { name: '토끼공주' }, enabled: true, key: 'guide:settings',
  snapshot: { fingerprint: 'guide-items', registry: { order: items.map((one) => one.id), items: Object.fromEntries(items.map((one) => [one.id, one])) } },
  codexSnapshot: {
    fingerprint: 'guide-codex',
    skills: { order: ['moon_cut', 'arcana_edge', 'wind_step'], entries: {} },
    monsters: { order: ['rabbit_princess', 'abyss_beast'], entries: {} }
  },
  itemsEnabled: true, skillsEnabled: true, encountersEnabled: true,
  mainOutput: true, auxOutput: 'missing', rarityMode: 'world', moduleAssetsEnabled: true,
  debugEnabled: false, effectsEnabled: true, fontScale: 'small'
};
const prefixMarkupClasses = (html) => html.replace(/class="([^"]*)"/g, (_raw, value) => `class="${value.split(/\s+/).filter(Boolean).map((name) => name.startsWith('x-risu-') ? name : `x-risu-${name}`).join(' ')}"`);
const body = prefixMarkupClasses(guide.rootInventoryHtml(loaded, true, 'settings'));
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ITEMX CODEX 실제 설정 화면</title><style>html,body{margin:0;min-height:100%;background:#080b11}.chattext{min-height:100vh}${guide.mainStyleText()}</style></head><body><main class="chattext"><div class="x-risu-itemx2-root-drawer x-risu-itemx2-pos-rm x-risu-itemx2-font-small x-risu-itemx2-is-open" x-itemx2-drawer="owner">${body}</div></main></body></html>`;
await writeFile(resolve(root, 'design/itemx-settings-actual.html'), html);
const inlineCards = [
  guide.codexInlineEventHtml({ event: { domain: 'skill', kind: 'exam' }, view: { id: 'arcana_edge', name: '아르카나 엣지', glyph: '⚡', rank: '고유(Unique)', school: '원소부여', type: 'active', status: 'learned', level: 9, mastery: 92, cost: '지속적인 기운 소모', cooldown: '형태 전환 시 찰나의 호흡 필요', target: '자신이 파지한 도검', affinity: 'lightning', effects: ['도검에 불안정한 전격을 부여', '연속 타격 시 방전 강화'] } }, 'off'),
  guide.codexInlineEventHtml({ event: { domain: 'monster', kind: 'exam' }, view: { id: 'abyss_beast', name: '심연의 괴수', glyph: '👾', kind: '심연', threat: '위협 재앙', relation: 'hostile', status: 'active', active: true, encounterCount: 1, outcome: '아직 교전이 끝나지 않았다.', moves: ['차원 참격', '심연 포효'] } }, 'off')
].map(prefixMarkupClasses).join('');
const inlineHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ITEMX CODEX 실제 본문 배너</title><style>html,body{margin:0;background:#1c1c1c}.chattext{display:grid;align-content:start;gap:10px;min-height:100vh;padding:18px}${guide.mainStyleText()}</style></head><body><main class="chattext">${inlineCards}</main></body></html>`;
await writeFile(resolve(root, 'design/itemx-inline-actual.html'), inlineHtml);
console.log('rendered actual settings and inline previews from plugin runtime');
