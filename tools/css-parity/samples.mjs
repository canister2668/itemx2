// Writes the main-document CSS and a sample page body (cards in .chattext,
// drawers in every tab and skin) to <out>/css.txt and <out>/body.html.
import { writeFileSync } from 'node:fs';
const out = process.argv[2];
const Core = await import('../../src/engine/core.js');
const Codex = await import('../../src/engine/codex.js');
const Renderer = await import('../../src/render/renderer.js');
const Cards = await import('../../src/render/codex-cards.js');
const Style = await import('../../src/ui/style.js');
const Panel = await import('../../src/ui/panel.js');
const { uiState } = await import('../../src/ui/view-state.js');
const Presentation = await import('../../src/ui/presentation.js');
const prefix = (html) =>
  html.replace(/class="([^"]*)"/g, (_, v) => `class="${v.split(/\s+/).filter(Boolean).map((c) => (c.startsWith('x-risu-') ? c : `x-risu-${c}`)).join(' ')}"`);
const items = Object.keys(Renderer.affinities).flatMap((affinity, i) =>
  ['normal', 'rare', 'legendary', 'empyrean'].map((rarity, j) =>
    Core.normalizeItem({ id: `a${i}_${j}`, name: `${affinity} ${rarity}`, rarity, affinity, count: 1, itemType: '검', possession: 'owned', power: '10-20', durability: '5/10', effects: [{ name: '효과', desc: '설명' }] }).item
  )
);
const codex = Codex.extractResponse(
  '<skillExam><id>skill</id><name>화염 참격</name><cost>내력 소모</cost><affinity>fire</affinity><level>3</level><mastery>40</mastery></skillExam><skillExam><id>ward</id><name>빙결 방벽</name><type>passive</type></skillExam><monsterExam><id>guide</id><name>안내자</name><status>active</status><relation>hostile</relation></monsterExam><monsterExam><id>foe</id><name>적</name><status>defeated</status></monsterExam>'
).snapshot;
let cards = '';
for (const motion of ['lite', 'off'])
  for (const item of items.slice(0, 40))
    cards += Renderer.renderMarkerPayload({ event: { kind: 'exam', item }, view: item, previous: { ...item, power: '1-2' } }, { inline: true, motion });
for (const motion of ['lite', 'off'])
  for (const id of codex.skills.order.concat(codex.monsters.order)) {
    const entity = codex.skills.entries[id] || codex.monsters.entries[id];
    const domain = codex.skills.entries[id] ? 'skill' : 'monster';
    cards += Cards.codexInlineEventHtml({ event: { kind: 'exam', domain, entity }, view: entity }, motion, '');
    cards += Cards.codexInlineEventHtml({ event: { kind: 'patch', domain, patch: { id, fields: { status: true } } }, view: { ...entity, status: 'sealed' }, previous: entity }, motion, '');
  }
cards += '<span class="itemx-event-chip">📦 chip</span>';
const loaded = {
  key: 'c:chat', enabled: true, mainOutput: true, auxOutput: 'off', rarityMode: 'itemx', itemsEnabled: true, skillsEnabled: true, encountersEnabled: true,
  lorebookEncounterEnabled: false, moduleAssetsEnabled: false, effectsLevel: 'full', debugEnabled: true, fontScale: 'small', skin: 'dark',
  character: { name: 'T' }, chat: { message: [{ data: 'x <!--ITEMX2@a-->' }], scriptstate: {} },
  snapshot: { registry: { order: items.map((i) => i.id), items: Object.fromEntries(items.map((i) => [i.id, i])), diagnostics: [] }, history: {} },
  codexSnapshot: codex, prefs: {}
};
uiState.oldMarkersArmed = false;
let drawers = '';
for (const skin of ['dark', 'frost', 'hanji'])
  for (const tab of ['inventory', 'skills', 'bestiary', 'settings']) {
    uiState.activeRootTab = tab;
    let html = Panel.rootInventoryHtml({ ...loaded, skin }, true, tab);
    // Open one detail per tab so detail pages are measured too.
    if (tab === 'inventory') html = html.replace('id="itemx2-detail-0" name="itemx2-detail" type="radio"', 'id="itemx2-detail-0" name="itemx2-detail" type="radio" checked').replace(/(itemx2-root-detail-body-0">)<span class="itemx2-detail-loading">[^<]*<\/span>/, `$1${Panel.itemDetailBodyHtml(items[5])}`);
    if (tab === 'skills') html = html.replace('id="itemx2-skill-0" name="itemx2-skill-detail" type="radio"', 'id="itemx2-skill-0" name="itemx2-skill-detail" type="radio" checked').replace(/(itemx2-root-skill-detail-body-0">)<span class="itemx2-codex-detail-index">0<\/span><span class="itemx2-detail-loading">[^<]*<\/span>/, `$1${Panel.rootCodexDetailHtml('skill', codex.skills.entries.skill, '', 'itemx')}`);
    if (tab === 'bestiary') html = html.replace('id="itemx2-monster-0" name="itemx2-monster-detail" type="radio"', 'id="itemx2-monster-0" name="itemx2-monster-detail" type="radio" checked').replace(/(itemx2-root-monster-detail-body-0">)<span class="itemx2-codex-detail-index">0<\/span><span class="itemx2-detail-loading">[^<]*<\/span>/, `$1${Panel.rootCodexDetailHtml('monster', codex.monsters.entries.guide, '', 'itemx')}`);
    drawers += `<div class="x-risu-itemx2-root-drawer x-risu-itemx2-pos-rm x-risu-itemx2-font-small x-risu-itemx2-is-open x-risu-itemx2-skin-${skin}" x-itemx2-drawer="owner" data-sample="${skin}-${tab}" style="position:relative">${prefix(html)}</div>`;
  }
const body = `<div class="chattext" data-sample="chat">${prefix(cards)}</div>${drawers}`;
writeFileSync(`${out}/body.html`, body);
writeFileSync(`${out}/css.txt`, Style.mainStyleText());
void Presentation;
console.log('css', Style.mainStyleText().length, 'body', body.length);
