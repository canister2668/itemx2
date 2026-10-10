import test from 'node:test';
import assert from 'node:assert/strict';
import { rt } from './helpers/modules.mjs';

const { core } = rt;
const run = (text, reg = core.newRegistry()) => core.extractResponse(text, reg);
const money = (id, name, count, extra = '') =>
  `[itemx: id=${id} | name=${name} | type=재화 | emoji=🪙 | rarity=normal | display=일반 | possession=owned | location=inventory | count=${count}${extra}]`;
const wallet = () => run(money('money_gold', '골드', '1,200')).registry;

test('currency is a stored flag; legacy items fall back to an exact type word only', () => {
  assert.equal(core.isCurrency({ itemType: '재화' }), true);
  assert.equal(core.isCurrency({ itemType: '화폐 / 금속' }), true);
  for (const type of ['통화 장치', '비화폐', 'money bag', 'currency voucher', '장검'])
    assert.equal(core.isCurrency({ itemType: type }), false, type);
  assert.equal(core.isCurrency({ itemType: '장검', currency: true }), true);
  assert.equal(core.isCurrency({ itemType: '재화', currency: false }), false);
  const created = run(money('money_gem', '보석', 3)).registry.items.money_gem;
  assert.equal(created.currency, true);
  const sword = run(
    '[itemx: id=sword | name=검 | type=장검 | emoji=🗡️ | rarity=normal | display=일반 | possession=owned | location=inventory]'
  ).registry.items.sword;
  assert.equal('currency' in sword, false);
});

test('a re-registered currency joins the held stack and keeps its balance', () => {
  const result = run(money('gold', 'Gold', 500), wallet());
  assert.deepEqual(Array.from(result.registry.order), ['money_gold']);
  assert.equal(result.events[0].item.id, 'money_gold');
  assert.equal(result.registry.items.money_gold.count, 1200);
  assert.equal(result.registry.items.money_gold.name, '골드');
});

test('an unknown money patch id resolves by whole stem onto the held stack', () => {
  const spent = run('[itemx: id=gold | action=consume | quantity=200]', wallet());
  assert.equal(spent.events[0].patch.id, 'money_gold');
  assert.equal(spent.registry.items.money_gold.count, 1000);
  const pouch = run('[itemx: id=gold_pouch | action=acquire | quantity=5]', wallet());
  assert.equal(pouch.registry.items.money_gold.count, 1205);
});

test('different currencies and look-alike ids never merge', () => {
  let reg = run(money('money_gold_coin', '금화', 3)).registry;
  reg = run(money('money_silver_coin', '은화', 9), reg).registry;
  assert.equal(reg.items.money_silver_coin.count, 9);
  assert.equal(reg.items.money_gold_coin.count, 3);
  const voucher = run('[itemx: id=guild_gold_voucher | action=consume | quantity=1]', wallet());
  assert.equal(voucher.registry.items.money_gold.count, 1200);
  assert.equal(voucher.errors.length, 1);
});

test('an ambiguous currency is rejected instead of guessed', () => {
  let reg = wallet();
  reg = run(money('legacy_purse', 'gold', 7), reg).registry;
  // A second stack whose name is also gold: a new `gold` exam matches both.
  assert.equal(Object.keys(reg.items).length, 1, 'name gold already joined money_gold');
  reg.items.old_gold = { ...core.clone(reg.items.money_gold), id: 'old_gold', name: 'Gold' };
  reg.order.push('old_gold');
  const result = run(money('gold', '골드', 1), reg);
  assert.deepEqual(result.errors, ['currency_ambiguous']);
});

test('money amounts are bounded and zero leaves equipped money in the inventory', () => {
  assert.equal(core.parseAmount('9007199254740993'), null);
  assert.equal(core.parseAmount('1,200 Gold'), 1200);
  const reg = wallet();
  assert.equal(
    core.applyEvent(core.clone(reg), {
      kind: 'patch',
      patch: { id: 'money_gold', action: 'set', fields: { count: -5 } }
    }),
    null
  );
  reg.items.money_gold.location = 'equipped';
  reg.items.money_gold.slot = 'hand';
  const spent = run('[itemx: id=money_gold | action=consume | quantity=all]', reg).registry.items.money_gold;
  assert.equal(spent.possession, 'owned');
  assert.equal(spent.location, 'inventory');
  assert.equal(spent.slot, null);
});

test('the request anchor leads with WALLET and an echoed table is still stripped', () => {
  const anchor = core.anchor({ registry: wallet() });
  const lines = anchor.split('\n');
  assert.equal(lines[1], '- WALLET (money; reuse these ids): money_gold=1200 골드');
  assert.equal(core.anchor({ registry: core.newRegistry() }).split('\n')[1].endsWith('none'), true);
  const echoed = `앞 문단.\n${anchor}\n뒤 문단.`;
  assert.equal(core.stripInventoryEcho(echoed), '앞 문단.\n뒤 문단.');
});

test('manual marking turns a lost pouch into an empty wallet entry', () => {
  let reg = run(
    '[itemx: id=pouch | name=골드 주머니 | type=기타 | emoji=👝 | rarity=normal | display=일반 | possession=owned | location=inventory | count=1]'
  ).registry;
  reg = run('[itemx: id=pouch | action=consume | quantity=1]', reg).registry;
  assert.equal(reg.items.pouch.possession, 'removed');
  const base = { action: null, op: null, quantity: null, destination: '', reason: 'manual_currency', slot: null };
  core.applyEvent(reg, { kind: 'patch', patch: { ...base, id: 'pouch', op: 'merge', fields: { currency: true } } });
  core.applyEvent(reg, { kind: 'patch', patch: { ...base, id: 'pouch', action: 'set', fields: { count: 0 } } });
  assert.equal(reg.items.pouch.possession, 'owned');
  assert.equal(core.isCurrency(reg.items.pouch), true);
});

test('held money is pinned to the first cells of every page and leaves the filters', () => {
  let reg = wallet();
  for (let i = 0; i < 20; i += 1)
    reg = run(
      `[itemx: id=ore_${i} | name=광석 ${i} | type=재료 | emoji=🪨 | rarity=normal | display=일반 | possession=owned | location=inventory]`,
      reg
    ).registry;
  const loaded = { snapshot: { registry: reg }, currencyDisplay: 'grid' };
  rt.uiState.rootItemPage = 1;
  const grid = rt.inventoryLayout(loaded);
  assert.equal(grid.items.length, 20);
  assert.equal(grid.page[0].id, 'money_gold');
  assert.equal(grid.page[1].id, 'ore_16');
  assert.equal(grid.wallet.length, 0);
  const walletOnly = rt.inventoryLayout({ ...loaded, currencyDisplay: 'wallet' });
  assert.equal(walletOnly.page[0].id, 'ore_16');
  assert.equal(walletOnly.wallet[0].id, 'money_gold');
  const both = rt.inventoryLayout({ ...loaded, currencyDisplay: 'both' });
  assert.equal(both.page[0].id, 'money_gold');
  assert.equal(both.wallet.length, 1);
  rt.uiState.rootItemPage = 0;
});

test('anchor loss is reported only while the response still proves its identity', () => {
  rt.session.addPending('aaaa1', { chatKey: 'chat' });
  rt.session.addPending('aaaa2', { chatKey: 'chat' });
  const latest = new Set(['aaaa1', 'aaaa2']);
  assert.deepEqual(rt.lostAnchors('chat', '본문 <!--ix:aaaa1--> 끝', latest), ['aaaa2']);
  assert.deepEqual(rt.lostAnchors('chat', '표식 없는 다른 응답', latest), []);
  assert.deepEqual(rt.lostAnchors('chat', '<!--ix:aaaa1--><!--ix:aaaa2-->', latest), []);
  rt.session.dropPending(['aaaa1', 'aaaa2']);
});
