import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { rt } from './helpers/modules.mjs';
import { renderEncounterCard, renderSkillCard, codexInlineEventHtml } from '../src/render/codex-cards.js';
import { catalog } from '../src/i18n.js';

const { renderer } = rt;
const css = (name) => readFile(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8');
const bare = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const item = (extra = {}) => ({
  id: 'blade',
  name: '검',
  itemType: '검',
  rarity: 'legendary',
  affinity: 'fire',
  possession: 'owned',
  location: 'inventory',
  count: 1,
  ...extra
});
const exam = (view) => ({ event: { kind: 'exam', item: view }, view });
const patch = (previous, view, action = '') => ({
  event: { kind: 'patch', patch: { id: view.id, action } },
  previous,
  view
});
const chipOf = (html) => (html.match(/<span class="ixp-ev ixp-ev-in[^"]*">([^<]*)<\/span>/) || [])[1];

// ── effects off ────────────────────────────────────────────────────────
test('effects-off stops pseudo-element animations too', async () => {
  const prism = bare(await css('prism'));
  const rule = prism.match(/([^{}]*\.ixp\.motion-off[^{}]*)\{([^}]*)\}/);
  assert.ok(rule, 'the motion-off rule is gone');
  for (const selector of ['.ixp.motion-off *::before', '.ixp.motion-off *::after', '.ixp.motion-off *'])
    assert.ok(rule[1].includes(selector), selector);
  assert.match(rule[2], /animation:\s*none\s*!important/);
});

test('a folded card reserves its own small height, not the open card height', async () => {
  const prism = bare(await css('prism'));
  const folded = [...prism.matchAll(/\.ixp:not\(\[open\]\)\s*\{([^}]*)\}/g)].map((one) => one[1]).join(';');
  const size = folded.match(/contain-intrinsic-size:\s*auto\s+(\d+)px/);
  assert.ok(size, 'the folded card has no intrinsic size of its own');
  assert.ok(Number(size[1]) <= 80, `folded cards reserve ${size[1]}px`);
});

// ── hard rules ─────────────────────────────────────────────────────────
test('the prism set uses no filter, blend mode, backdrop or generated label text', async () => {
  const prism = bare(await css('prism'));
  assert.equal(/(^|[\s;{])(?:-webkit-)?(?:backdrop-)?filter\s*:/.test(prism), false, 'filter in prism.css');
  assert.equal(/mix-blend-mode/.test(prism), false, 'mix-blend-mode in prism.css');
  assert.equal(/content:\s*'[^']*[가-힣]/.test(prism), false, 'label text belongs to the catalog, not to CSS');
  const tile = bare(await css('cards')).match(/\.itemx-tile-aff\s*\{[^}]*\}/)[0];
  assert.equal(/filter/.test(tile), false, 'the tile affinity icon uses text-shadow');
});

test('one element never runs two animations on the same declaration', async () => {
  for (const name of ['prism', 'cards', 'presentation']) {
    const text = bare(await css(name));
    for (const [, selector, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const value = (body.match(/(?:^|;)\s*animation:\s*([^;]+)/) || [])[1] || '';
      // The classic aura+jolt pair is neutralised by `.ixp-cfx{animation:none!important}`.
      if (name === 'cards' && selector.includes('.itemx2-strong:has(')) continue;
      assert.equal(value.split(/,(?![^(]*\))/).length <= 1, true, `${name}: ${selector.trim()}`);
    }
  }
});

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('the mythical rank badge keeps white text readable on every gradient stop', async () => {
  const prism = bare(await css('prism'));
  const rule = prism.match(/\.ixp-r-mythical \.ixp-rank\s*\{([^}]*)\}/)[1];
  assert.match(rule, /color:\s*#fff\b/);
  const stops = rule.match(/linear-gradient\(([^)]*)\)/)[1].match(/#[0-9a-f]{6}/gi);
  assert.ok(stops.length >= 2);
  for (const stop of stops)
    assert.ok(contrast('#ffffff', stop) >= 4.5, `${stop}: ${contrast('#ffffff', stop).toFixed(2)}:1`);
});

test('the rim follows the card radius instead of a fixed one', async () => {
  const prism = bare(await css('prism'));
  assert.match(prism.match(/\.ixp-rim::after\s*\{([^}]*)\}/)[1], /border-radius:\s*calc\(var\(--ixr\) - 1\.5px\)/);
  assert.match(prism.match(/@media \(max-width: 520px\)\s*\{\s*\.ixp\[open\]\s*\{([^}]*)\}/)[1], /--ixr:\s*18px/);
});

// ── celebration scope ──────────────────────────────────────────────────
test('the celebration layers belong to a first registration only', async () => {
  const fresh = renderer.renderMarkerPayload(exam(item()), { inline: true });
  assert.match(fresh, /class="ixp [^"]*ixp-fresh/);
  assert.match(fresh, /ixp-flash/);
  assert.match(fresh, /ixp-burst/);
  const damaged = renderer.renderMarkerPayload(patch(item({ durability: '90/100' }), item({ durability: '40/100' })), {
    inline: true
  });
  assert.equal(renderer.eventKind(patch(item({ durability: '90/100' }), item({ durability: '40/100' }))), 'damage');
  assert.doesNotMatch(damaged, /ixp-fresh|ixp-flash|ixp-shock|ixp-burst"/);
  // The ambient intensity of the tier is untouched.
  for (const layer of ['ixp-rim', 'ixp-sheen', 'ixp-edge', 'ixp-swarm', 'ixp-sig-fire', 'ixp-spark'])
    assert.ok(damaged.includes(layer), layer);
  assert.doesNotMatch(renderer.renderCard(item()), /ixp-fresh|ixp-flash/, 'the drawer card has nothing to celebrate');

  const prism = bare(await css('prism'));
  const armed = [...prism.matchAll(/([^{}]*\.itemx2-burst-active[^{}]*)\{/g)].map((one) => one[1]);
  for (const selector of armed.filter((one) => /ixp-(flash|shock|burst|title|icon)/.test(one)))
    for (const part of selector.split(',')) assert.match(part, /\.ixp-fresh\.itemx2-burst-active/, part.trim());
});

test('only a just-learned skill carries the celebration layers', () => {
  const skill = { id: 's', name: '홍련참', rank: '전설', affinity: 'fire', status: 'learned', level: 3 };
  const learned = codexInlineEventHtml({ event: { kind: 'exam', domain: 'skill', entity: skill }, view: skill });
  assert.match(learned, /ixp-fresh/);
  assert.match(learned, /ixp-flash/);
  const grown = codexInlineEventHtml({
    event: { kind: 'patch', domain: 'skill', patch: { id: 's', action: 'mastery', fields: { mastery: 40 } } },
    previous: { ...skill, mastery: 10 },
    view: { ...skill, mastery: 40 }
  });
  assert.match(grown, /ixp-skill/);
  assert.doesNotMatch(grown, /ixp-fresh|ixp-flash|ixp-shock/);
  assert.match(grown, /ixp-rim/, 'the tier layers stay');
});

// ── folded item cards ──────────────────────────────────────────────────
test('an item card says what the record did, so folded cards differ', () => {
  const owned = item();
  assert.equal(chipOf(renderer.renderMarkerPayload(exam(owned), { fold: true })), '획득');
  assert.equal(chipOf(renderer.renderMarkerPayload(exam(item({ possession: 'observed' })), { fold: true })), '관찰');
  assert.equal(chipOf(renderer.renderMarkerPayload(patch(owned, item({ power: '99' })), { fold: true })), '변경');
  assert.equal(
    chipOf(renderer.renderMarkerPayload(patch(item({ possession: 'observed' }), owned), { fold: true })),
    '획득',
    'an observed item that is now owned was acquired'
  );
  for (const [action, label] of [
    ['transfer', '양도'],
    ['consume', '사용'],
    ['destroy', '파괴'],
    ['constructor', '소실'],
    ['', '소실']
  ])
    assert.equal(
      chipOf(renderer.renderMarkerPayload(patch(owned, item({ possession: 'removed' }), action), { fold: true })),
      label,
      action
    );
  assert.equal(chipOf(renderer.renderCard(owned)), undefined, 'the drawer card has no event');
  // The chip sits in the summary, beside the grade.
  const html = renderer.renderMarkerPayload(exam(owned), { fold: true });
  assert.match(
    html,
    /<summary class="ixp-hero">[\s\S]*<span class="ixp-rank">[^<]*<\/span><span class="ixp-ev ixp-ev-in/
  );
});

test('a folded currency card shows its balance', async () => {
  const gold = item({ id: 'gold', name: '금화', itemType: '화폐', currency: true, rarity: 'normal', count: 1520 });
  const html = renderer.renderMarkerPayload(exam(gold), { fold: true });
  assert.match(html, /<summary[\s\S]*<span class="ixp-bal">1,520<\/span>[\s\S]*<\/summary>/);
  const prism = bare(await css('prism'));
  assert.match(prism, /\.ixp:not\(\[open\]\) \.ixp-bal\s*\{\s*display:\s*inline-block/);
  assert.doesNotMatch(renderer.renderMarkerPayload(exam(item({ count: 3 })), { fold: true }), /ixp-bal/);
});

test('every text key the render layer uses exists in the catalog', async () => {
  const dir = new URL('../src/render/', import.meta.url);
  for (const name of await readdir(dir)) {
    const source = await readFile(new URL(name, dir), 'utf8');
    for (const [, key] of source.matchAll(/\bt\('([^']+)'/g)) assert.ok(key in catalog, `${name}: ${key}`);
  }
});

// ── encounters ─────────────────────────────────────────────────────────
test('an ended encounter keeps the reader motion class so its resolved sweep can play', () => {
  const dead = { id: 'm', name: '고블린', relation: 'hostile', status: 'dead', threat: '위험' };
  const html = renderEncounterCard(dead, { motion: 'full', inline: true });
  assert.match(html, /ixp-ended/);
  assert.doesNotMatch(html, /motion-off/, 'motion-off hides the one-shot sweep');
  assert.doesNotMatch(
    html,
    /ixp-spark|ixp-swarm|ixp-rim|ixp-sig|ixp-flash|ixp-ev-live|ixp-step live/,
    'still no layers'
  );
  assert.match(renderEncounterCard(dead, { motion: 'off' }), /motion-off/, 'the reader setting still wins');
  assert.equal(
    renderer.eventKind({ previous: { ...dead, status: 'active' }, view: dead, event: { kind: 'patch' } }, 'monster'),
    'resolved'
  );
});

test('the meeting card of a one-response fight is a static past step', () => {
  const dead = { id: 'm', name: '고블린', relation: 'hostile', status: 'dead', threat: '위험', outcome: '일격' };
  const html = codexInlineEventHtml({ event: { kind: 'exam', domain: 'monster', entity: dead }, view: dead });
  const cards = html.split('<details').slice(1);
  assert.equal(cards.length, 2);
  assert.match(cards[0], /ixp-past/);
  assert.doesNotMatch(cards[0], /ixp-ev-live|ixp-step live|ixp-spark|ixp-swarm|ixp-rim|ixp-sig/);
  assert.match(cards[0], /<span class="ixp-step on"><i><\/i><b>교전 개시<\/b>/);
  // A fight still going on keeps its live pulse.
  const live = renderEncounterCard({ ...dead, status: 'active', active: true }, { state: '교전 중' });
  assert.match(live, /ixp-ev ixp-ev-live/);
  assert.match(live, /ixp-step live/);
  assert.doesNotMatch(live, /ixp-past/);
});

// ── robustness ─────────────────────────────────────────────────────────
test('junk effect entries are dropped or normalised, never rendered empty', () => {
  const html = renderer.renderCard(
    item({
      effects: [null, '날카로움', { name: '화상', desc: '불태운다' }, 7, {}, { desc: '이름 없는 효과' }, '  '],
      augments: [undefined, { name: '불꽃 룬', desc: '위력 증가' }, 'x']
    })
  );
  const rows = html.match(/<li[^>]*>[\s\S]*?<\/li>/g);
  assert.deepEqual(rows, [
    '<li><b>날카로움</b></li>',
    '<li><b>화상</b>불태운다</li>',
    '<li>이름 없는 효과</li>',
    '<li class="aug"><b>불꽃 룬<small>증강</small></b>위력 증가</li>',
    '<li class="aug"><b>x<small>증강</small></b></li>'
  ]);
  assert.doesNotMatch(html, /undefined|null|\[object/);
});

test('the augment label is the element, not generated content', async () => {
  const prism = bare(await css('prism'));
  assert.doesNotMatch(prism, /li\.aug b::after/);
  assert.match(prism, /\.ixp \.ixp-list li\.aug b small\s*\{[^}]*line-height/);
});

test('model-supplied class fragments never leave their tables', () => {
  for (const key of ['constructor', '__proto__', 'toString', 'x" onmouseover="1', 'fire ixp-fresh']) {
    const odd = item({ affinity: key, affinity2: key, rarity: key, condition: key, theme: key, location: key });
    for (const fx of ['prism', 'classic']) {
      const html = renderer.renderCard(odd, { fx });
      const classes = html.match(/class="([^"]*)"/g).join(' ');
      assert.doesNotMatch(classes, /constructor|__proto__|toString|onmouseover|ixp-fresh/, `${fx}/${key}`);
      assert.doesNotMatch(html, /undefined|native code|\[object/, `${fx}/${key}`);
      assert.match(html, /^<details class="ixp ixp-(?:prism|classic) ixp-r-normal ixp-t-arcane"/);
    }
    const tile = renderer.renderTile(odd);
    assert.match(tile, /^<button class="itemx-tile rarity-normal"/);
    assert.doesNotMatch(tile, /undefined|native code|onmouseover="1"/);
    assert.doesNotMatch(renderer.itemVars(odd), /undefined|function/);
    const skill = renderSkillCard({ id: 's', name: '기술', affinity: key, type: key, status: key });
    assert.doesNotMatch(skill, /undefined|native code|\[object/, `skill/${key}`);
    const monster = renderEncounterCard({ id: 'm', name: '적', relation: key, status: key });
    assert.doesNotMatch(monster, /undefined|native code|\[object|onmouseover="1"/, `monster/${key}`);
  }
});

test('huge and non-finite counts stay readable', async () => {
  for (const count of [1e21, Infinity, -Infinity, NaN, '9'.repeat(30), 'abc', null, 1234567890123]) {
    for (const currency of [true, false]) {
      const html = renderer.renderCard(item({ count, currency }));
      const tile = renderer.renderTile(item({ count, currency }));
      for (const out of [html, tile]) assert.doesNotMatch(out, /NaN|Infinity|e\+\d|undefined/, `${count}/${currency}`);
      const badge = (html.match(/<b class="ixp-x"[^>]*>([^<]*)<\/b>/) || [])[1] || '';
      assert.ok(badge.length <= 9, `badge "${badge}" for ${count}`);
    }
  }
  // A 13-digit balance: short on the badge, exact in the tooltip and the body.
  const rich = renderer.renderCard(item({ count: 1234567890123, currency: true }));
  assert.match(rich, /<b class="ixp-x" title="1,234,567,890,123">1\.2조<\/b>/);
  assert.match(rich, /<small>수량<\/small><b>1,234,567,890,123<\/b>/);
  assert.match(renderer.renderCard(item({ count: 1520, currency: true })), /ixp-x">1,520</);
  assert.match(renderer.renderCard(item({ count: 12 })), /ixp-x">×12</);
  assert.equal(renderer.countShort(19999999), '1,999.9만', 'a balance is cut, never rounded up');
  const badge = bare(await css('prism')).match(/\.ixp-x\s*\{([^}]*)\}/)[1];
  for (const rule of [/white-space:\s*nowrap/, /max-width:/, /text-overflow:\s*ellipsis/, /line-height:/])
    assert.match(badge, rule);
});

// ── inventory tile ─────────────────────────────────────────────────────
test('the tile keeps the outer button pair the drawer rewrites', () => {
  const tile = renderer.renderTile(item({ location: 'equipped', count: 12, affinity2: 'ice' }));
  assert.match(tile, /^<button class="itemx-tile rarity-legendary itemx-tile-on itemx-tile-aff-2" /);
  assert.match(tile, /<\/button>$/);
  assert.equal((tile.match(/<button\b/g) || []).length, 1);
  assert.equal((tile.match(/<\/button>/g) || []).length, 1);
  const span = tile.replace(/^<button\b/, '<span').replace(/<\/button>$/, '</span>');
  assert.match(span, /^<span class="itemx-tile /);
  assert.match(span, /<\/span>$/);
});

test('the tile marks quantity, equipment and affinity without colliding', async () => {
  const equipped = renderer.renderTile(item({ location: 'equipped', count: 12 }));
  assert.doesNotMatch(equipped, /itemx-tile-eq"/, 'the corner triangle is gone');
  assert.match(
    equipped,
    /<span class="itemx-tile-em">[^<]+<span class="itemx-tile-eqp" title="장착" aria-label="장착">E<\/span><span class="itemx-tile-qty">×12<\/span><\/span>/
  );
  assert.match(equipped, /itemx-tile-aff-1/);
  const plain = renderer.renderTile(item({ affinity: '', count: 1 }));
  assert.doesNotMatch(plain, /itemx-tile-qty|itemx-tile-eqp|itemx-tile-on|itemx-tile-aff/);
  assert.match(renderer.renderTile(item({ count: 123456 })), /itemx-tile-qty">×12\.3만</);
  const gold = renderer.renderTile(item({ currency: true, count: 5000000 }));
  assert.doesNotMatch(gold, /itemx-tile-qty/, 'currency keeps its balance in the meta row');
  assert.match(gold, /<span class="itemx-tile-lc">5,000,000<\/span>/);

  const cards = bare(await css('cards'));
  const rule = (selector) =>
    cards.match(new RegExp(`(?:^|})\\s*${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`))[1];
  assert.match(rule('.itemx-tile'), /height:\s*82px/);
  assert.match(rule('.itemx-grid'), /repeat\(2,/);
  assert.match(rule('.itemx-tile-bar'), /width:\s*3px/);
  assert.match(rule('.itemx-tile-em'), /position:\s*relative/);
  const name = rule('.itemx-tile-nm');
  for (const one of [/display:\s*-webkit-box/, /-webkit-line-clamp:\s*2/, /overflow-wrap:\s*anywhere/, /line-height:/])
    assert.match(name, one);
  for (const selector of ['.itemx-tile-rk', '.itemx-tile-lc']) {
    assert.match(rule(selector), /white-space:\s*nowrap/, selector);
    assert.match(rule(selector), /line-height:/, selector);
  }
  assert.match(rule('.itemx-tile-lc'), /text-overflow:\s*ellipsis/);
  assert.match(rule('.itemx-tile-qty'), /tabular-nums/);
  assert.match(rule('.itemx-tile-aff-1 .itemx-tile-nm'), /padding-right/);
  assert.match(rule('.itemx-tile-aff'), /text-shadow/);
  assert.equal(/\.itemx-tile-eq\s*\{/.test(cards), false);
});

// ── dead code ──────────────────────────────────────────────────────────
test('removed card structures do not come back', async () => {
  const all = `${await css('prism')}\n${await css('cards')}\n${await css('presentation')}`;
  for (const dead of [
    'itemx-card',
    'itemx-medallion',
    'itemx-oriental',
    'itemx-content',
    'itemx-flavor',
    'affinity-chip',
    'lab-grid',
    'demo-note',
    'risu-topbar',
    'ixp-delta',
    'ixp-still',
    'itemx2-technique-material'
  ])
    assert.equal(all.includes(`.${dead}`), false, dead);
  assert.equal(/\.stage\b/.test(all), false, '.stage');
  assert.equal(renderer.renderSkillFx, undefined);
  // The classic set is a reader setting and stays.
  const classic = renderer.renderCard(item({ condition: 'cursed', affinity2: 'ice' }), { fx: 'classic' });
  for (const layer of [
    'ixp-cfx',
    'craft-arcane',
    'rarity-legendary',
    'itemx2-strong',
    'condition-cursed',
    'itemx-edge'
  ])
    assert.ok(classic.includes(layer), layer);
  assert.match(classic, /itemx2-blend-fire-ice/);
  for (const selector of ['.ixp-cfx', '.itemx-fx', '.itemx-cond', '.itemx-edge', '.condition-cursed .itemx-cond'])
    assert.ok(all.includes(`${selector} {`), selector);
});
