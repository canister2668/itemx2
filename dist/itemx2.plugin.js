//@name itemx2
//@api 3.0
//@version 1.9.0-beta.21
//@update-url https://raw.githubusercontent.com/canister2668/itemx2/main/dist/itemx2.plugin.js
//@display-name ITEMX CODEX · v1.9.0-beta.21
//@description World Inventory & Encounter Archive

/* ITEMX 2 core: deterministic transport parsing and per-chat state replay. */
const ITEMXCore = (() => {
  'use strict';

  const VERSION = 2;
  const STATE_KEY = '$__itemx2_state';
  const CHAT_KEY = '$__itemx2_chat_id';
  const MARKER_RE = /<!--ITEMX2:([A-Za-z0-9_-]+)-->/g;
  const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
  const RARITIES = new Set(['normal', 'magic', 'rare', 'unique', 'epic', 'legendary', 'mythical', 'empyrean']);
  const THEMES = new Set(['arcane', 'forged', 'oriental', 'clockwork', 'synthetic', 'celestial', 'organic']);
  const AFFINITIES = new Set(['fire', 'ice', 'lightning', 'wind', 'earth', 'light', 'dark', 'poison', 'blood', 'void']);
  const CONDITIONS = new Set(['blessed', 'cursed', 'corrupted', 'glitched', 'sealed']);
  const POSSESSIONS = new Set(['observed', 'owned', 'removed']);
  const LOCATIONS = new Set(['inventory', 'equipped', 'storage', 'unknown']);
  const ACTIONS = new Set(['acquire', 'transfer', 'consume', 'equip', 'unequip', 'move', 'transform', 'destroy', 'restore', 'swap']);
  const OPS = new Set(['merge', 'remove', 'restore']);
  const RARITY_LABELS = { normal: '일반', magic: '매직', rare: '레어', unique: '유니크', epic: '에픽', legendary: '전설', mythical: '신화', empyrean: '창천' };
  const FIELD_ALIASES = {
    id: 'id', name: 'name', '이름': 'name', type: 'type', '분류': 'type', '종류': 'type', emoji: 'emoji',
    rarity: 'internalrarity', internalrarity: 'internalrarity', grade: 'internalrarity', '등급': 'internalrarity',
    display: 'displayrarity', displayrarity: 'displayrarity', '표기': 'displayrarity',
    power: 'power', '위력': 'power', required: 'required', '요구': 'required',
    durability: 'durability', '내구': 'durability', '내구도': 'durability',
    cost: 'cost', price: 'cost', value: 'cost', '가치': 'cost',
    possession: 'possession', location: 'location', count: 'count', slot: 'slot', pin: 'pin',
    theme: 'theme', craft: 'theme', affinity: 'affinity', affinity2: 'affinity2', condition: 'condition',
    effects: 'effects', effect: 'effects', augments: 'augments', augment: 'augments', trivia: 'trivia', desc: 'trivia', description: 'trivia',
    action: 'action', op: 'op', quantity: 'quantity', destination: 'destination', reason: 'reason', '사유': 'reason',
    inputs: 'inputs', outputs: 'outputs', equip: 'equip', unequip: 'unequip'
  };

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value, max = 800) => {
    if (value == null) return '';
    return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  };
  const decodeEntities = (value) => clean(String(value ?? '')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, '&'));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fnv1a = (value) => {
    let h = 0x811c9dc5;
    const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(String(value)) : Array.from(Buffer.from(String(value)));
    for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  };
  const randomId = () => globalThis.crypto?.randomUUID?.() || `itemx2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const bytesToB64 = (bytes) => {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  };
  const b64ToBytes = (value) => {
    if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(value, 'base64'));
    const bin = atob(value); return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  };
  const encodePayload = (value) => bytesToB64(new TextEncoder().encode(JSON.stringify(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const decodePayload = (value) => {
    try {
      const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
      return JSON.parse(new TextDecoder().decode(b64ToBytes(padded)));
    } catch { return null; }
  };
  const marker = (payload) => `<!--ITEMX2:${encodePayload(payload)}-->`;

  function isUsableGlyph(value) {
    const glyph = clean(value, 24);
    if (!glyph || glyph === '❔' || /[\s<>\u0000-\u001f]/u.test(glyph) || /[\p{L}\p{N}]/u.test(glyph)) return false;
    try {
      const pictographs = glyph.match(/\p{Extended_Pictographic}/gu) || [];
      const regions = glyph.match(/\p{Regional_Indicator}/gu) || [];
      return (pictographs.length === 1 || (glyph.includes('\u200d') && pictographs.length > 1) || regions.length === 2) && pictographs.length + regions.length > 0;
    } catch { return /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/u.test(glyph); }
  }

  function itemEmojiFallback(item = {}) {
    const text = `${item.itemType || item.type || ''} ${item.name || ''}`.toLowerCase();
    const choices = [
      [/(?:검|도|blade|sword|katana)/, '🗡️'], [/(?:방패|갑옷|방어구|shield|armor)/, '🛡️'],
      [/(?:활|석궁|bow|crossbow)/, '🏹'], [/(?:지팡이|완드|staff|wand)/, '🪄'], [/(?:총|포|gun|rifle|cannon)/, '🔫'],
      [/(?:반지|ring)/, '💍'], [/(?:목걸이|부적|necklace|amulet|talisman)/, '📿'], [/(?:장화|신발|boots?|shoes?)/, '👢'],
      [/(?:물약|포션|약품|potion|elixir)/, '🧪'], [/(?:책|서|두루마리|book|tome|scroll)/, '📖'],
      [/(?:광석|금속|재료|원석|ore|ingot|material|stone)/, '🧱']
    ];
    return choices.find(([pattern]) => pattern.test(text))?.[1] || '📦';
  }

  const resolveItemEmoji = (item) => isUsableGlyph(item?.emoji) ? clean(item.emoji, 24) : itemEmojiFallback(item);
  const resolveSkillGlyph = (skill = {}) => {
    if (isUsableGlyph(skill.glyph || skill.emoji)) return clean(skill.glyph || skill.emoji, 24);
    const text = `${skill.affinity || ''} ${skill.type || skill.kind || ''} ${skill.name || ''}`.toLowerCase();
    return [[/(?:fire|화염|불꽃)/, '🔥'], [/(?:ice|빙결|서리)/, '❄️'], [/(?:lightning|번개|뇌전)/, '⚡'], [/(?:heal|회복|치유)/, '💚'], [/(?:shield|방어|보호)/, '🛡️'], [/(?:stealth|은신|암영)/, '🌫️'], [/(?:slash|검|도법)/, '🗡️']].find(([p]) => p.test(text))?.[1] || '✨';
  };
  const resolveMonsterGlyph = (monster = {}) => {
    if (isUsableGlyph(monster.glyph || monster.emoji)) return clean(monster.glyph || monster.emoji, 24);
    const text = `${monster.kind || monster.type || ''} ${monster.name || ''}`.toLowerCase();
    return [[/(?:dragon|용|룡)/, '🐉'], [/(?:wolf|늑대)/, '🐺'], [/(?:rabbit|토끼)/, '🐇'], [/(?:undead|망자|해골|좀비)/, '💀'], [/(?:slime|슬라임)/, '🫧'], [/(?:golem|골렘)/, '🗿'], [/(?:insect|벌레|곤충)/, '🐛']].find(([p]) => p.test(text))?.[1] || '🐾';
  };

  function field(xml, name) {
    const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, 'i');
    const m = String(xml).match(re);
    return m ? decodeEntities(m[1].replace(/<[^>]*>/g, ' ')) : '';
  }

  function attrs(text) {
    const out = {};
    String(text || '').replace(/([A-Za-z_\u3131-\uD79D][\w\-\u3131-\uD79D]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, key, a, b, c) => {
      out[key.toLowerCase()] = decodeEntities(a ?? b ?? c ?? ''); return '';
    });
    return out;
  }

  function listPairs(value, max = 12) {
    if (!value) return [];
    return String(value).split(';;').slice(0, max).map((part) => {
      const [name, ...rest] = part.split('::');
      return { name: clean(name, 160), desc: clean(rest.join('::'), 800) };
    }).filter((one) => one.name);
  }

  function nestedPairs(xml, singular, max = 12) {
    const out = [];
    const re = new RegExp(`<${singular}\\b[^>]*>([\\s\\S]*?)<\\/${singular}\\s*>`, 'gi');
    let m;
    while ((m = re.exec(String(xml))) && out.length < max) {
      const name = field(m[1], `${singular}name`) || field(m[1], 'name');
      const desc = field(m[1], `${singular}desc`) || field(m[1], 'desc') || field(m[1], 'description');
      if (name) out.push({ name: clean(name, 160), desc: clean(desc, 800) });
    }
    return out;
  }

  function canonicalFields(raw) {
    const out = {};
    for (const [key, value] of Object.entries(raw || {})) {
      const canonical = FIELD_ALIASES[String(key).toLowerCase()] || FIELD_ALIASES[key];
      if (canonical && value != null && clean(value) !== '') out[canonical] = clean(value, canonical === 'trivia' ? 1200 : 800);
    }
    return out;
  }

  function providedFields(raw) {
    const out = [];
    for (const [key, value] of Object.entries(raw || {})) {
      const canonical = FIELD_ALIASES[String(key).toLowerCase()] || FIELD_ALIASES[key];
      if (!canonical || value == null) continue;
      if (Array.isArray(value) ? value.length > 0 : clean(value) !== '') out.push(canonical);
    }
    return [...new Set(out)];
  }

  function normalizeItem(raw, seed = '') {
    const f = canonicalFields(raw);
    const _provided = providedFields(raw);
    const name = clean(f.name, 160);
    if (!name) return { error: 'exam_no_name' };
    const id = ID_RE.test(f.id || '') ? f.id : `itmx_${fnv1a(seed || JSON.stringify(f))}`;
    const rarity = RARITIES.has((f.internalrarity || '').toLowerCase()) ? f.internalrarity.toLowerCase() : 'normal';
    const theme = THEMES.has((f.theme || '').toLowerCase()) ? f.theme.toLowerCase() : 'arcane';
    const affinity = AFFINITIES.has((f.affinity || '').toLowerCase()) ? f.affinity.toLowerCase() : null;
    let affinity2 = AFFINITIES.has((f.affinity2 || '').toLowerCase()) ? f.affinity2.toLowerCase() : null;
    if (affinity2 === affinity) affinity2 = null;
    const condition = CONDITIONS.has((f.condition || '').toLowerCase()) ? f.condition.toLowerCase() : null;
    let location = LOCATIONS.has((f.location || '').toLowerCase()) ? f.location.toLowerCase() : 'unknown';
    let possession = POSSESSIONS.has((f.possession || '').toLowerCase()) ? f.possession.toLowerCase() : (location === 'unknown' ? 'observed' : 'owned');
    if (possession === 'removed') location = 'unknown';
    const count = /^\d+$/.test(f.count || '') ? Math.max(0, Number(f.count)) : 1;
    const item = {
      id, name, itemType: clean(f.type, 160) || '기타', emoji: clean(f.emoji, 24), rarity,
      displayRarity: clean(f.displayrarity, 80) || RARITY_LABELS[rarity], power: clean(f.power, 160),
      required: clean(f.required, 160), durability: clean(f.durability, 160), cost: clean(f.cost, 160),
      possession, location, count, slot: clean(f.slot, 80) || null, pin: /^(1|true)$/i.test(f.pin || ''),
      trivia: clean(f.trivia, 1200), theme, affinity, affinity2, condition,
      effects: Array.isArray(raw.effects) ? raw.effects.slice(0, 12).map((x) => ({ name: clean(x.name, 160), desc: clean(x.desc, 800) })).filter((x) => x.name) : listPairs(f.effects),
      augments: Array.isArray(raw.augments) ? raw.augments.slice(0, 12).map((x) => ({ name: clean(x.name, 160), desc: clean(x.desc, 800) })).filter((x) => x.name) : listPairs(f.augments),
      _provided
    };
    item.emoji = resolveItemEmoji(item);
    return { item };
  }

  function parseXml(tag, attrText, body, seed) {
    const a = attrs(attrText);
    const raw = { ...a };
    for (const key of Object.keys(FIELD_ALIASES)) {
      if (/^[A-Za-z]/.test(key)) {
        const value = field(body, key);
        if (value) raw[key] = value;
      }
    }
    const effects = nestedPairs(body, 'effect');
    const augments = nestedPairs(body, 'augment');
    if (effects.length || /<effects?\b/i.test(body)) raw.effects = effects;
    if (augments.length || /<augments?\b/i.test(body)) raw.augments = augments;
    const visual = field(body, 'visual') ? (body.match(/<visual\b[^>]*>([\s\S]*?)<\/visual\s*>/i)?.[1] || '') : body;
    for (const key of ['theme', 'craft', 'affinity', 'affinity2', 'condition']) {
      const value = field(visual, key); if (value) raw[key] = value;
    }
    const lower = String(tag).toLowerCase();
    const isPatch = lower === 'itempatch' || (lower === 'itemx' && (raw.action || raw.op || !raw.name));
    return isPatch ? normalizePatch(raw) : normalizeItem(raw, seed);
  }

  function parseBracket(body, seed) {
    const raw = {};
    for (const part of String(body).split('|')) {
      const at = part.indexOf('=');
      if (at < 1) continue;
      const key = clean(part.slice(0, at), 80);
      const canonical = FIELD_ALIASES[key.toLowerCase()] || FIELD_ALIASES[key];
      if (canonical) raw[canonical] = clean(part.slice(at + 1), canonical === 'trivia' ? 1200 : 800);
    }
    if (raw.effects) raw.effects = listPairs(raw.effects);
    if (raw.augments) raw.augments = listPairs(raw.augments);
    return raw.action || raw.op || !raw.name ? normalizePatch(raw) : normalizeItem(raw, seed);
  }

  function parseQuantity(value) {
    if (value === 'all') return 'all';
    return /^\d+$/.test(String(value || '')) && Number(value) > 0 ? Number(value) : null;
  }

  function parseItemList(value) {
    if (!value) return null;
    const out = [];
    for (const part of String(value).split(',')) {
      const [id, amount] = part.trim().split(':');
      if (!ID_RE.test(id || '') || !/^\d+$/.test(amount || '') || Number(amount) < 1) return null;
      out.push({ id, quantity: Number(amount) });
    }
    return out.length ? out : null;
  }

  function normalizePatch(raw) {
    const f = canonicalFields(raw);
    const id = ID_RE.test(f.id || '') ? f.id : null;
    const action = ACTIONS.has((f.action || '').toLowerCase()) ? f.action.toLowerCase() : null;
    const op = OPS.has((f.op || '').toLowerCase()) ? f.op.toLowerCase() : null;
    if (f.action && !action) return { error: `patch_bad_action:${clean(f.action, 80)}` };
    if (f.op && !op) return { error: `patch_bad_op:${clean(f.op, 80)}` };
    if (!action && !op) return { error: 'patch_missing_operation' };
    if (!id && action !== 'transform' && action !== 'swap') return { error: 'patch_no_id' };
    const fields = {};
    const map = { name: 'name', type: 'itemType', emoji: 'emoji', internalrarity: 'rarity', displayrarity: 'displayRarity', power: 'power', required: 'required', durability: 'durability', cost: 'cost', trivia: 'trivia', theme: 'theme', affinity: 'affinity', affinity2: 'affinity2', condition: 'condition', location: 'location', possession: 'possession', count: 'count', slot: 'slot' };
    for (const [from, to] of Object.entries(map)) if (f[from] != null) fields[to] = f[from] === '-' ? null : f[from];
    if (Array.isArray(raw.effects)) fields.effects = raw.effects;
    if (Array.isArray(raw.augments)) fields.augments = raw.augments;
    if (op === 'merge' && ['location', 'possession', 'count', 'slot'].some((key) => key in fields)) return { error: 'patch_merge_state_field' };
    if (op === 'merge' && Object.keys(fields).length === 0) return { error: 'patch_empty_merge' };
    const quantity = f.quantity ? parseQuantity(f.quantity) : null;
    if (f.quantity && quantity == null) return { error: 'patch_bad_quantity' };
    const inputs = parseItemList(f.inputs), outputs = parseItemList(f.outputs);
    if (action === 'transform' && (!inputs || !outputs)) return { error: 'patch_transform_shape' };
    if (action === 'swap' && (!ID_RE.test(f.equip || '') || !ID_RE.test(f.unequip || '') || !f.slot)) return { error: 'patch_swap_shape' };
    return { patch: { id, action, op, fields, quantity, destination: clean(f.destination, 160), reason: clean(f.reason, 160), slot: clean(f.slot, 80) || null, inputs, outputs, equip: f.equip || null, unequip: f.unequip || null } };
  }

  function newRegistry() { return { order: [], items: {}, diagnostics: [] }; }
  function insert(reg, item) { if (!reg.items[item.id]) reg.order.push(item.id); reg.items[item.id] = item; }
  function diagnostic(reg, code, detail = '') { reg.diagnostics.push({ code, detail }); if (reg.diagnostics.length > 50) reg.diagnostics.shift(); }
  function available(item) { return !item || item.possession === 'removed' ? 0 : Math.max(0, Number(item.count) || 1); }
  function removeQuantity(item, quantity) {
    const have = available(item), take = quantity === 'all' ? have : (quantity || 1);
    if (take < 1 || take > have) return false;
    item.count = have - take;
    if (item.count === 0) { item.possession = 'removed'; item.location = 'unknown'; item.slot = null; }
    return true;
  }
  function slotConflict(reg, id, slot) {
    return reg.order.map((key) => reg.items[key]).find((other) => other && other.id !== id && other.possession !== 'removed' && other.location === 'equipped' && (other.slot === slot || (other.slot === 'two_hands' && ['main_hand', 'off_hand'].includes(slot)) || (slot === 'two_hands' && ['main_hand', 'off_hand'].includes(other.slot))));
  }

  function applyExam(reg, source) {
    const item = clone(source), prev = reg.items[item.id];
    delete item._provided;
    item.emoji = resolveItemEmoji(item);
    if (prev) {
      // An exam describes/appraises an identity. Ownership transitions belong
      // to explicit patches so a reappraisal can never unequip, resurrect or
      // collapse an existing stack merely because optional fields defaulted.
      item.possession = prev.possession;
      item.location = prev.location;
      item.slot = prev.slot || null;
      item.count = Math.max(0, Number(prev.count) || 0);
      item.pin = prev.pin === true;
      if (prev.removedReason) item.removedReason = prev.removedReason;
    }
    if (item.location === 'equipped' && (item.possession !== 'owned' || (item.slot && slotConflict(reg, item.id, item.slot)))) {
      diagnostic(reg, 'exam_invalid_equipped', item.id); item.possession = 'owned'; item.location = 'inventory'; item.slot = null;
    }
    insert(reg, item); return item;
  }

  function applyFields(item, fields) {
    for (const [key, value] of Object.entries(fields || {})) item[key] = clone(value);
    if (!RARITIES.has(item.rarity)) item.rarity = 'normal';
    if (!THEMES.has(item.theme)) item.theme = 'arcane';
    if (!AFFINITIES.has(item.affinity)) item.affinity = null;
    if (!AFFINITIES.has(item.affinity2) || item.affinity2 === item.affinity) item.affinity2 = null;
    if (!CONDITIONS.has(item.condition)) item.condition = null;
    item.emoji = resolveItemEmoji(item);
  }

  function applyPatch(reg, patch) {
    if (patch.action === 'transform') {
      if (patch.inputs.some((one) => available(reg.items[one.id]) < one.quantity) || patch.outputs.some((one) => !reg.items[one.id])) { diagnostic(reg, 'action_invalid_transform'); return null; }
      patch.inputs.forEach((one) => removeQuantity(reg.items[one.id], one.quantity));
      patch.outputs.forEach((one) => { const item = reg.items[one.id]; const have = item.possession === 'owned' ? available(item) : 0; item.count = have + one.quantity; item.possession = 'owned'; item.location = 'inventory'; });
      return reg.items[patch.outputs[0]?.id] || null;
    }
    if (patch.action === 'swap') {
      const oldItem = reg.items[patch.unequip], newItem = reg.items[patch.equip];
      if (!oldItem || !newItem || oldItem.location !== 'equipped' || (oldItem.slot && oldItem.slot !== patch.slot)) { diagnostic(reg, 'action_invalid_swap'); return null; }
      const conflict = slotConflict(reg, newItem.id, patch.slot);
      if (conflict && conflict.id !== oldItem.id) { diagnostic(reg, 'action_slot_occupied', conflict.id); return null; }
      oldItem.location = 'inventory'; oldItem.slot = null; newItem.possession = 'owned'; newItem.location = 'equipped'; newItem.slot = patch.slot; return newItem;
    }
    const item = patch.id && reg.items[patch.id];
    if (!item) { diagnostic(reg, 'patch_unknown_id', patch.id || patch.action); return null; }
    if (patch.action) {
      if (['transfer', 'consume', 'destroy'].includes(patch.action)) {
        if (patch.quantity == null && available(item) > 1) { diagnostic(reg, 'action_quantity_required', item.id); return null; }
        if (!removeQuantity(item, patch.quantity)) { diagnostic(reg, 'action_insufficient_quantity', item.id); return null; }
        if (item.possession === 'removed') item.removedReason = patch.reason || patch.action;
      } else if (patch.action === 'acquire') {
        if (patch.quantity === 'all') { diagnostic(reg, 'action_bad_quantity', item.id); return null; }
        const have = item.possession === 'owned' ? available(item) : 0;
        item.count = have + (patch.quantity || 1); item.possession = 'owned'; item.location = 'inventory'; item.removedReason = null;
      } else if (patch.action === 'restore') {
        item.count = patch.quantity === 'all' ? 1 : (patch.quantity || Math.max(available(item), 1)); item.possession = 'owned'; item.location = 'inventory'; item.removedReason = null;
      } else if (patch.action === 'equip') {
        if (!patch.slot || item.possession === 'removed' || slotConflict(reg, item.id, patch.slot)) { diagnostic(reg, 'action_invalid_equip', item.id); return null; }
        item.possession = 'owned'; item.location = 'equipped'; item.slot = patch.slot;
      } else if (patch.action === 'unequip') {
        if (item.location !== 'equipped') { diagnostic(reg, 'action_not_equipped', item.id); return null; }
        item.location = 'inventory'; item.slot = null;
      } else if (patch.action === 'move') {
        const destination = patch.fields.location || patch.destination;
        if (!LOCATIONS.has(destination) || destination === 'equipped' || item.possession === 'removed') { diagnostic(reg, 'action_invalid_move', item.id); return null; }
        item.location = destination; item.slot = null;
      }
      return item;
    }
    if (patch.op === 'merge') applyFields(item, patch.fields);
    else if (patch.op === 'remove') { item.possession = 'removed'; item.location = 'unknown'; item.slot = null; item.count = 0; item.removedReason = patch.reason; }
    else if (patch.op === 'restore') { applyFields(item, patch.fields); item.possession ||= 'owned'; if (item.possession === 'removed') item.possession = 'owned'; item.location = item.location === 'unknown' ? 'inventory' : item.location; item.count = Math.max(1, Number(item.count) || 1); item.removedReason = null; }
    return item;
  }

  function applyEvent(reg, event) {
    if (!event || !event.kind) return null;
    return event.kind === 'exam' ? applyExam(reg, event.item) : applyPatch(reg, event.patch);
  }

  function collectTransports(text) {
    const matches = [];
    const xml = /<(itemExam|itemPatch|itemx)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
    const bracket = /\[(?:itemx|아이템)\s*:\s*([^\]\r\n]*)\]/gi;
    let m;
    while ((m = xml.exec(text))) matches.push({ start: m.index, end: xml.lastIndex, raw: m[0], kind: 'xml', tag: m[1], attrs: m[2], body: m[3] });
    while ((m = bracket.exec(text))) matches.push({ start: m.index, end: bracket.lastIndex, raw: m[0], kind: 'bracket', body: m[1] });
    return matches.sort((a, b) => a.start - b.start || b.end - a.end).filter((one, index, all) => !all.slice(0, index).some((prev) => one.start < prev.end));
  }

  function stripResidualTransport(text) {
    let out = String(text);
    const opener = /<(?:itemExam|itemPatch|itemx)\b/i.exec(out);
    if (opener) {
      let boundary = out.indexOf('\n\n', opener.index);
      while (boundary >= 0) {
        const suffix = out.slice(boundary + 2).trimStart();
        if (!/^<\/?(?:id|name|type|emoji|internalrarity|displayrarity|power|required|durability|cost|possession|location|count|slot|pin|theme|craft|affinity2?|condition|trivia|effects?|effectname|effectdesc|augments?|augmentname|augmentdesc|action|op|quantity|destination|reason|inputs|outputs|equip|unequip)\b/i.test(suffix)) break;
        boundary = out.indexOf('\n\n', boundary + 2);
      }
      out = boundary < 0 ? out.slice(0, opener.index) : out.slice(0, opener.index) + out.slice(boundary + 2);
    }
    const bracket = /\[(?:itemx|아이템)\s*:/i.exec(out);
    if (bracket) out = out.slice(0, bracket.index) + out.slice(bracket.index).replace(/^[^\r\n]*/, '');
    out = out.replace(/<\/?(?:itemExam|itemPatch|itemx)\b[^>]*>?/gi, '');
    return out.replace(/^\s*```(?:xml)?\s*$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function extractResponse(content, baseRegistry = newRegistry()) {
    const text = String(content || '');
    const reg = clone(baseRegistry || newRegistry());
    const transports = collectTransports(text);
    if (!transports.length && !/(?:<\/?(?:itemExam|itemPatch|itemx)\b|\[(?:itemx|아이템)\s*:)/i.test(text)) return { content: text, registry: reg, events: [], errors: [] };
    const out = []; const events = []; const errors = []; let cursor = 0;
    transports.forEach((part, index) => {
      out.push(text.slice(cursor, part.start));
      const parsed = part.kind === 'xml' ? parseXml(part.tag, part.attrs, part.body, `${part.raw}:${index}`) : parseBracket(part.body, `${part.raw}:${index}`);
      if (parsed.item) {
        const event = { kind: 'exam', item: parsed.item }; const view = clone(applyEvent(reg, event)); events.push(event); out.push(marker({ v: VERSION, event, view }));
      } else if (parsed.patch) {
        const event = { kind: 'patch', patch: parsed.patch }; const view = clone(applyEvent(reg, event)); events.push(event); out.push(marker({ v: VERSION, event, view }));
      } else {
        const error = parsed.error || 'invalid_transport'; errors.push(error); out.push(marker({ v: VERSION, error }));
      }
      cursor = part.end;
    });
    out.push(text.slice(cursor));
    return { content: stripResidualTransport(out.join('')), registry: reg, events, errors };
  }

  function messageText(message) { return typeof message?.data === 'string' ? message.data : (typeof message?.content === 'string' ? message.content : ''); }
  function eventsFromText(text) {
    const events = []; String(text || '').replace(MARKER_RE, (_, encoded) => { const payload = decodePayload(encoded); if (payload?.v === VERSION && payload.event) events.push(payload.event); return ''; }); return events;
  }
  function rebuild(messages) {
    const reg = newRegistry(); let transport = '';
    for (const msg of messages || []) {
      const text = messageText(msg);
      for (const event of eventsFromText(text)) { applyEvent(reg, event); transport += marker({ v: VERSION, event }); }
    }
    return { schema: VERSION, rev: 1, fingerprint: fnv1a(transport), updatedAt: Date.now(), registry: reg };
  }
  function readSnapshot(chat) {
    try {
      const raw = chat?.scriptstate?.[STATE_KEY]; const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed?.schema === VERSION && parsed.registry ? parsed : null;
    } catch { return null; }
  }
  function writeSnapshot(chat, snapshot) {
    const next = clone(chat || {}); next.scriptstate = { ...(next.scriptstate || {}) };
    next.scriptstate[CHAT_KEY] ||= randomId();
    const encoded = JSON.stringify(snapshot);
    next.scriptstate[STATE_KEY] = encoded.length <= 524288 ? encoded : JSON.stringify({
      schema: snapshot?.schema || VERSION,
      rev: snapshot?.rev || 1,
      fingerprint: snapshot?.fingerprint || '',
      updatedAt: snapshot?.updatedAt || Date.now(),
      compacted: true,
      registry: { order: [], items: {}, diagnostics: [{ code: 'snapshot_compacted' }] }
    });
    return next;
  }
  function requestView(text) {
    return String(text || '').replace(MARKER_RE, (_, encoded) => {
      const payload = decodePayload(encoded); const item = payload?.event?.kind === 'exam' ? payload.event.item : null;
      return item ? `[${resolveItemEmoji(item)} ${item.name} | id=${item.id}]` : '';
    });
  }
  function anchor(snapshot, max = 12000) {
    const reg = snapshot?.registry || newRegistry();
    const items = reg.order.map((id) => reg.items[id]).filter(Boolean).sort((a, b) => Number(b.location === 'equipped') - Number(a.location === 'equipped'));
    const lines = ['[ITEMX 2 · CURRENT INVENTORY · authoritative]'];
    for (const item of items) {
      const bits = [`id=${item.id}`, `name=${item.name}`, `type=${item.itemType}`, `rarity=${item.rarity}`, `possession=${item.possession}`, `location=${item.location}`, `count=${item.count || 0}`];
      for (const key of ['slot', 'power', 'durability', 'theme', 'affinity', 'affinity2', 'condition']) if (item[key]) bits.push(`${key}=${item[key]}`);
      if (item.effects?.length) bits.push(`effects=${item.effects.slice(0, 3).map((one) => `${one.name}::${one.desc}`).join(' ;; ')}`);
      const line = `- ${bits.join(' | ')}`;
      if ((lines.join('\n').length + line.length) > max) break;
      lines.push(line);
    }
    lines.push('Use existing ids. Emit events only for settled item creation or change.');
    return lines.join('\n');
  }

  return { VERSION, STATE_KEY, CHAT_KEY, MARKER_RE, RARITY_LABELS, esc, fnv1a, marker, decodePayload, parseXml, parseBracket, normalizeItem, normalizePatch, newRegistry, applyEvent, extractResponse, eventsFromText, rebuild, readSnapshot, writeSnapshot, requestView, anchor, messageText, clone, isUsableGlyph, itemEmojiFallback, resolveItemEmoji, resolveSkillGlyph, resolveMonsterGlyph };
})();

if (typeof globalThis !== 'undefined') globalThis.ITEMXCore = ITEMXCore;
/* ITEMX 2 recovery quality: conservative narrative evidence and safe partials. */
const ITEMXQuality = (() => {
  'use strict';
  const REVISION = 1;
  const DETAIL_FIELDS = ['power', 'effects', 'augments', 'required', 'durability', 'cost'];
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const digits = (value) => String(value ?? '').match(/\d[\d,]*/g)?.map((one) => one.replace(/,/g, '')) || [];

  function narrativeText(value) {
    return String(value || '')
      .replace(/<(thoughts|analysis)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(ITEMXCore.MARKER_RE, '').replace(/<!--CODEX2:[A-Za-z0-9_-]+-->/g, '')
      .replace(/<\/?[A-Za-z][^>]*>/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function relevantItemNarrative(text, item, siblings = []) {
    const source = narrativeText(text), name = clean(item?.name);
    if (!source || name.length < 2) return '';
    const at = source.toLowerCase().indexOf(name.toLowerCase());
    if (at < 0) return '';
    let start = Math.max(0, source.lastIndexOf('\n\n', at) + 2);
    let end = source.indexOf('\n\n', at + name.length);
    if (end < 0) end = source.length;
    end = Math.min(source.length, end + 900);
    for (const other of siblings) {
      const otherName = clean(other?.name);
      if (!otherName || otherName === name) continue;
      const otherAt = source.toLowerCase().indexOf(otherName.toLowerCase(), at + name.length);
      if (otherAt >= 0 && otherAt < end) end = otherAt;
    }
    return source.slice(start, end).slice(0, 2400);
  }

  function detectItemEvidence(text, item, siblings = []) {
    const segment = relevantItemNarrative(text, item, siblings);
    const labeled = (pattern) => pattern.test(segment);
    const powerHit = segment.match(/(?:공격력|위력|damage|attack|atk)\s*[:：]?\s*([^\n]{0,90})/i);
    const effectAt = segment.search(/(?:고유\s*효과|특수\s*효과|unique\s*effects?|special\s*effects?)/i);
    const effectTail = effectAt >= 0 ? segment.slice(effectAt, effectAt + 1400) : '';
    const effectNames = [
      ...[...effectTail.matchAll(/[\[【「](.{2,80}?)[\]】」]/g)].map((m) => clean(m[1])),
      ...[...effectTail.matchAll(/\*\*([^*\n]{2,80})\*\*/g)].map((m) => clean(m[1])),
      ...[...effectTail.matchAll(/(?:^|\n)\s*(?:[-•]|\d+[.)])\s*([^:\n：—]{2,60})\s*[:：—]/g)].map((m) => clean(m[1]))
    ].filter((name, index, all) => !/^(?:특수\s*효과|고유\s*효과|effects?)$/i.test(name) && all.indexOf(name) === index).slice(0, 12);
    const augmentHit = segment.match(/(?:강화|제련|인챈트|enhancement|upgrade)[^\n]{0,45}?(\+\s*\d{1,3}|\d{1,3}\s*강)/i)
      || segment.match(/(\+\s*\d{1,3})[^\n]{0,24}(?:강화|제련|인챈트)/i);
    return {
      segment,
      power: Boolean(powerHit && digits(powerHit[1]).length), powerValues: powerHit ? digits(powerHit[1]).slice(0, 2) : [],
      effects: effectAt >= 0 && effectNames.length > 0, effectNames,
      augments: Boolean(augmentHit), augmentLevel: augmentHit ? clean(augmentHit[1]).replace(/\s+/g, '') : '',
      required: labeled(/(?:요구|필요)\s*(?:레벨|조건)|required\s*(?:level|condition)/i),
      durability: labeled(/(?:내구도?|durability)\s*[:：]?\s*\d/i),
      cost: labeled(/(?:가격|가치|정가|price|cost|value)\s*[:：]?\s*[\d₩$€¥]/i)
    };
  }

  function validateRecoveredItem(event, evidence) {
    if (event?.kind !== 'exam' || !event.item?.id || !event.item?.name) return { status: 'rejected', event, missing: [], evidence };
    if (!evidence?.segment) return { status: 'complete', event, missing: [], evidence };
    const item = event.item, provided = new Set(item._provided || []), missing = [];
    if (evidence.power) {
      const actual = digits(item.power);
      if (!provided.has('power') || evidence.powerValues.some((value) => !actual.includes(value))) missing.push('power');
    }
    if (evidence.effects) {
      const actual = (item.effects || []).map((one) => `${one.name} ${one.desc}`).join(' ').toLowerCase();
      if (!provided.has('effects') || evidence.effectNames.some((name) => !actual.includes(name.toLowerCase()))) missing.push('effects');
    }
    if (evidence.augments) {
      const actual = (item.augments || []).map((one) => `${one.name} ${one.desc}`).join(' ').replace(/\s+/g, '');
      if (!provided.has('augments') || !actual.includes(evidence.augmentLevel)) missing.push('augments');
    }
    for (const key of ['required', 'durability', 'cost']) if (evidence[key] && (!provided.has(key) || !clean(item[key]))) missing.push(key);
    return { status: missing.length ? 'partial' : 'complete', event, missing: [...new Set(missing)], evidence };
  }

  function projectSafePartial(event, result, registry) {
    const prior = registry?.items?.[event.item.id], source = ITEMXCore.clone(event.item), evidence = result.evidence || {};
    const item = prior ? { ...ITEMXCore.clone(prior), id: source.id, name: source.name } : source;
    for (const key of ['required', 'durability', 'cost']) if (!evidence[key] && !prior) item[key] = '';
    for (const key of result.missing || []) {
      if (key === 'effects' || key === 'augments') item[key] = prior?.[key] ? ITEMXCore.clone(prior[key]) : [];
      else item[key] = prior?.[key] || '';
    }
    item.emoji = ITEMXCore.resolveItemEmoji(item);
    item._provided = (source._provided || []).filter((key) => !result.missing.includes(key) && (!DETAIL_FIELDS.includes(key) || evidence[key]));
    return { kind: 'exam', item };
  }

  function repairPrompt(partials, narrative) {
    const rows = partials.map((one) => `- id=${one.event.item.id} | name=${one.event.item.name} | missing=${one.missing.join(', ')} | evidence=${one.evidence.segment.slice(0, 1800)}`).join('\n');
    return `Repair ONLY the incomplete ITEMX items listed below. Do not create items. Preserve id and identity. Emit exactly one <itemPatch><id>...</id><op>merge</op> per item that can be repaired, filling only its listed missing fields from explicit narrative evidence. Never emit actions or possession, location, count, slot, required, durability or cost unless that exact field is listed missing. Use <effects><effect><effectname>...</effectname><effectdesc>...</effectdesc></effect></effects> and the equivalent augments structure. Output no prose or code fence; output NONE if nothing is supported.\n\nINCOMPLETE ITEMS:\n${rows}\n\nCOMMITTED NARRATIVE:\n${String(narrative || '').slice(0, 14000)}`;
  }

  function acceptRepair(event, partialMap, registry) {
    if (event?.kind !== 'patch' || event.patch?.op !== 'merge' || event.patch.action) return null;
    const partial = partialMap.get(event.patch.id), keys = Object.keys(event.patch.fields || {});
    if (!partial || !keys.length || keys.some((key) => !partial.missing.includes(key))) return null;
    const scratch = ITEMXCore.clone(registry);
    return ITEMXCore.applyEvent(scratch, event) ? event : null;
  }

  return { REVISION, narrativeText, relevantItemNarrative, detectItemEvidence, validateRecoveredItem, projectSafePartial, repairPrompt, acceptRepair };
})();

if (typeof globalThis !== 'undefined') globalThis.ITEMXQuality = ITEMXQuality;
/* ITEMX CODEX core: deterministic skill and encounter-bestiary replay. */
const ITEMXCodex = (() => {
  'use strict';
  const VERSION = 1;
  const STATE_KEY = '$__itemx2_codex_state';
  const MARKER_RE = /<!--CODEX2:([A-Za-z0-9_-]+)-->/g;
  const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
  const SKILL_TYPES = new Set(['active', 'passive', 'sealed']);
  const SKILL_STATUS = new Set(['learned', 'equipped', 'sealed', 'lost']);
  const RELATIONS = new Set(['hostile', 'sparring', 'neutral', 'allied', 'unknown']);
  const ENCOUNTER_STATUS = new Set(['active', 'ended', 'escaped', 'defeated', 'dead', 'unknown']);
  const SKILL_ACTIONS = new Set(['learn', 'equip', 'unequip', 'mastery', 'seal', 'unseal', 'forget']);
  const ITEMX_SKILL_RANKS = new Set(['normal', 'magic', 'rare', 'unique', 'epic', 'legendary', 'mythical', 'empyrean']);
  const MONSTER_ACTIONS = new Set(['encounter', 'end', 'escape', 'defeat', 'kill', 'ally']);
  const OPS = new Set(['merge', 'remove', 'restore']);
  const clean = (value, max = 800) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const emptySkillValue = (value) => /^(?:|none|null|unknown|n\/a|없음|해당\s*없음|미상)$/i.test(clean(value, 120));
  const costValue = (value, type = 'active', status = '') => {
    const result = clean(value, 120);
    if (!emptySkillValue(result)) return result;
    if (type === 'passive') return '상시 효과 · 별도 소모 없음';
    if (type === 'sealed' || status === 'sealed') return '봉인 상태 · 발동 불가';
    return result ? '별도 소모 없음' : '발동 자원 · 서사 기준';
  };
  const cooldownValue = (value, type = 'active', status = '') => {
    const result = clean(value, 120);
    if (emptySkillValue(result)) {
      if (type === 'passive') return '상시 적용';
      if (type === 'sealed' || status === 'sealed') return '봉인 해제 후 사용 가능';
      return result ? '재사용 제한 없음' : '사용 후 회복 필요';
    }
    return /(?:\d+\s*)?(?:턴|라운드|turns?|rounds?|actions?|initiative)/i.test(result) ? '상황 조건 충족 후' : result;
  };
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fnv = (value) => ITEMXCore.fnv1a(String(value));
  const marker = (payload) => ITEMXCore.marker(payload).replace('<!--ITEMX2:', '<!--CODEX2:');
  const decodePayload = ITEMXCore.decodePayload;

  function field(body, name) {
    const hit = String(body).match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, 'i'));
    return hit ? clean(hit[1].replace(/<[^>]*>/g, ' '), name === 'description' ? 1200 : 800) : '';
  }
  function attrs(text) {
    const out = {};
    String(text || '').replace(/([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, key, a, b, c) => { out[key.toLowerCase()] = clean(a ?? b ?? c); return ''; });
    return out;
  }
  function list(value, max = 12) {
    if (!value) return [];
    const parts = String(value).includes(';;') ? String(value).split(';;') : String(value).split(',');
    return [...new Set(parts.map((one) => clean(one, 180)).filter(Boolean))].slice(0, max);
  }
  function scalar(body, a, key) { return clean(a[key] || field(body, key)); }
  function normalizeId(value, prefix, seed) { return ID_RE.test(value || '') ? value : `${prefix}_${fnv(seed)}`; }
  function boundedNumber(value, min, max) {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : null;
  }
  const mastery = (value) => boundedNumber(value, 0, 100);
  const skillLevel = (value) => boundedNumber(value, 1, 999);

  function normalizeSkillExam(raw, seed) {
    const name = clean(raw.name, 160); if (!name) return { error: 'skill_no_name' };
    const type = SKILL_TYPES.has(raw.type) ? raw.type : 'active';
    const status = SKILL_STATUS.has(raw.status) ? raw.status : (type === 'sealed' ? 'sealed' : 'learned');
    return { event: { domain: 'skill', kind: 'exam', entity: {
      id: normalizeId(raw.id, 'skill', seed), name, glyph: ITEMXCore.resolveSkillGlyph({ ...raw, name, type }), rank: clean(raw.rank, 80) || '미분류', school: clean(raw.school, 120), type, status,
      level: skillLevel(raw.level), mastery: mastery(raw.mastery), cost: costValue(raw.cost, type, status), cooldown: cooldownValue(raw.cooldown, type, status), target: clean(raw.target, 120), affinity: clean(raw.affinity, 80),
      description: clean(raw.description, 1200), effects: list(raw.effects), growth: clean(raw.growth, 800),
      _provided: Object.keys(raw).filter((key) => raw[key] !== '')
    } } };
  }
  function normalizeMonsterExam(raw, seed) {
    const name = clean(raw.name, 160); if (!name) return { error: 'monster_no_name' };
    const relation = RELATIONS.has(raw.relation) ? raw.relation : 'unknown';
    const status = ENCOUNTER_STATUS.has(raw.status) ? raw.status : 'unknown';
    return { event: { domain: 'monster', kind: 'exam', entity: {
      id: normalizeId(raw.id, 'encounter', seed), name, glyph: ITEMXCore.resolveMonsterGlyph({ ...raw, name, kind: raw.type }), aliases: list(raw.aliases, 8), kind: clean(raw.type, 100) || '미분류', threat: clean(raw.threat, 80) || '미상', relation, status,
      active: status === 'active' && ['hostile', 'sparring'].includes(relation), portrait: clean(raw.portrait, 160), weaknesses: list(raw.weaknesses), resistances: list(raw.resistances), moves: list(raw.moves), description: clean(raw.description, 1200), encounterCount: 1,
      outcome: clean(raw.outcome, 600), outcomeStatus: raw.outcome ? status : '', outcomeEncounter: raw.outcome ? 1 : 0,
      _provided: Object.keys(raw).filter((key) => raw[key] !== '')
    } } };
  }
  function normalizePatch(domain, raw) {
    const id = ID_RE.test(raw.id || '') ? raw.id : null; if (!id) return { error: `${domain}_patch_no_id` };
    const allowedActions = domain === 'skill' ? SKILL_ACTIONS : MONSTER_ACTIONS;
    const action = allowedActions.has(raw.action) ? raw.action : null, op = OPS.has(raw.op) ? raw.op : null;
    if (!action && !op) return { error: `${domain}_patch_missing_operation` };
    const allowed = domain === 'skill'
      ? ['name','glyph','rank','school','type','status','level','mastery','cost','cooldown','target','affinity','description','effects','growth']
      : ['name','glyph','aliases','type','threat','relation','status','portrait','weaknesses','resistances','moves','description','outcome'];
    const fields = {};
    for (const key of allowed) if (raw[key] !== '') fields[key === 'type' && domain === 'monster' ? 'kind' : key] = ['effects','aliases','weaknesses','resistances','moves'].includes(key) ? list(raw[key]) : clean(raw[key], key === 'description' ? 1200 : key === 'outcome' ? 600 : 800);
    if ('mastery' in fields) { fields.mastery = mastery(fields.mastery); if (fields.mastery == null) delete fields.mastery; }
    if ('level' in fields) { fields.level = skillLevel(fields.level); if (fields.level == null) delete fields.level; }
    if ('cost' in fields) fields.cost = costValue(fields.cost, fields.type, fields.status);
    if ('cooldown' in fields) fields.cooldown = cooldownValue(fields.cooldown, fields.type, fields.status);
    return { event: { domain, kind: 'patch', patch: { id, action, op, fields } } };
  }
  function parseTransport(tag, attrText, body, seed) {
    const a = attrs(attrText), raw = {};
    for (const key of ['id','name','glyph','rank','school','type','status','level','mastery','cost','cooldown','target','affinity','description','effects','growth','aliases','threat','relation','portrait','weaknesses','resistances','moves','outcome','action','op']) raw[key] = scalar(body, a, key).toLowerCase && ['type','status','relation','action','op'].includes(key) ? scalar(body, a, key).toLowerCase() : scalar(body, a, key);
    const lower = tag.toLowerCase();
    if (lower === 'skillexam') return normalizeSkillExam(raw, seed);
    if (lower === 'monsterexam') return normalizeMonsterExam(raw, seed);
    return normalizePatch(lower.startsWith('skill') ? 'skill' : 'monster', raw);
  }
  function registry() { return { order: [], entries: {}, diagnostics: [] }; }
  function snapshot() { return { schema: VERSION, skills: registry(), monsters: registry(), fingerprint: '', updatedAt: Date.now() }; }
  function put(reg, entity) { if (!reg.entries[entity.id]) reg.order.push(entity.id); reg.entries[entity.id] = entity; return entity; }
  function applyEvent(state, event) {
    if (!event || !['skill','monster'].includes(event.domain)) return null;
    const reg = event.domain === 'skill' ? state.skills : state.monsters;
    if (event.kind === 'exam') {
      if (!event.entity?.id || !ID_RE.test(event.entity.id)) { reg.diagnostics.push({ code: 'exam_invalid' }); return null; }
      const prior = reg.entries[event.entity.id], next = clone(event.entity), provided = new Set(next._provided || []);
      delete next._provided;
      if (prior && event.domain === 'skill') {
        for (const key of ['status', 'mastery', 'level', 'cost', 'cooldown']) if (!provided.has(key)) next[key] = prior[key];
      }
      if (event.domain === 'skill') { next.cost = costValue(next.cost, next.type, next.status); next.cooldown = cooldownValue(next.cooldown, next.type, next.status); next.glyph = ITEMXCore.resolveSkillGlyph(next); }
      if (prior && event.domain === 'monster') {
        for (const key of ['status', 'active', 'relation', 'encounterCount']) if (!provided.has(key)) next[key] = prior[key];
        next.encounterCount = Number(prior.encounterCount) || 1;
        if (!provided.has('outcome')) {
          next.outcome = prior.outcome || '';
          next.outcomeStatus = prior.outcomeStatus || '';
          next.outcomeEncounter = Number(prior.outcomeEncounter) || 0;
        } else {
          next.outcomeStatus = next.status;
          next.outcomeEncounter = next.encounterCount;
        }
      }
      if (event.domain === 'monster') { next.active = next.status === 'active' && ['hostile', 'sparring'].includes(next.relation); next.glyph = ITEMXCore.resolveMonsterGlyph(next); }
      return put(reg, next);
    }
    const entity = reg.entries[event.patch?.id]; if (!entity) { reg.diagnostics.push({ code: 'patch_missing', id: event.patch?.id }); return null; }
    const { action, op, fields } = event.patch;
    if (op === 'remove') { entity.status = 'lost'; entity.active = false; }
    else if (op === 'restore') Object.assign(entity, clone(fields), { status: event.domain === 'skill' ? 'learned' : 'active', active: event.domain === 'monster' });
    else if (op === 'merge') Object.assign(entity, clone(fields));
    if (event.domain === 'skill') {
      entity.cost = costValue(entity.cost, entity.type, entity.status);
      entity.cooldown = cooldownValue(entity.cooldown, entity.type, entity.status);
      entity.glyph = ITEMXCore.resolveSkillGlyph(entity);
      if (entity._inferred && fields && ('level' in fields || 'mastery' in fields)) {
        const explicitProgress = new Set(Object.keys(fields).filter((key) => key === 'level' || key === 'mastery'));
        entity._inferred = entity._inferred.filter((key) => !explicitProgress.has(key));
      }
      if (action === 'equip') entity.status = 'equipped'; if (action === 'unequip' || action === 'learn' || action === 'unseal') entity.status = 'learned';
      if (action === 'seal') entity.status = 'sealed'; if (action === 'forget') entity.status = 'lost'; if (action === 'mastery' && 'mastery' in fields) entity.mastery = mastery(fields.mastery);
    } else {
      entity.glyph = ITEMXCore.resolveMonsterGlyph(entity);
      if (action === 'encounter') { entity.status = 'active'; entity.active = true; entity.encounterCount = (Number(entity.encounterCount) || 1) + 1; }
      const endStatus = { end: 'ended', escape: 'escaped', defeat: 'defeated', kill: 'dead', ally: 'ended' }[action];
      if (endStatus) {
        entity.status = endStatus; entity.active = false; if (action === 'ally') entity.relation = 'allied';
        if (fields.outcome) { entity.outcome = fields.outcome; entity.outcomeStatus = endStatus; entity.outcomeEncounter = Number(entity.encounterCount) || 1; }
      } else if (fields.outcome) {
        entity.outcomeStatus = ENCOUNTER_STATUS.has(entity.status) ? entity.status : 'unknown';
        entity.outcomeEncounter = Number(entity.encounterCount) || 1;
      }
      if (ENCOUNTER_STATUS.has(entity.status)) entity.active = entity.status === 'active';
    }
    return entity;
  }
  function collect(text) {
    const out = [], re = /<(skillExam|skillPatch|monsterExam|monsterPatch)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi; let m;
    while ((m = re.exec(String(text)))) out.push({ start: m.index, end: re.lastIndex, raw: m[0], tag: m[1], attrs: m[2], body: m[3] });
    return out;
  }
  function stripResidual(text) {
    let out = String(text), hit = /<(?:skillExam|skillPatch|monsterExam|monsterPatch)\b/i.exec(out);
    if (hit) {
      let boundary = out.indexOf('\n\n', hit.index);
      while (boundary >= 0) {
        const suffix = out.slice(boundary + 2).trimStart();
        if (!/^<\/?(?:id|name|glyph|rank|school|type|status|level|mastery|cost|cooldown|target|affinity|description|effects|growth|aliases|threat|relation|portrait|weaknesses|resistances|moves|outcome|action|op)\b/i.test(suffix)) break;
        boundary = out.indexOf('\n\n', boundary + 2);
      }
      out = boundary < 0 ? out.slice(0, hit.index) : out.slice(0, hit.index) + out.slice(boundary + 2);
    }
    return out.replace(/<\/?(?:skillExam|skillPatch|monsterExam|monsterPatch)\b[^>]*>?/gi, '').replace(/^\s*```(?:xml)?\s*$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  function skillEvidenceSegments(text, entity) {
    const name = clean(entity?.name, 160).toLowerCase();
    const school = clean(entity?.school, 120).toLowerCase();
    const schoolTokens = school.split(/[\s·/|:_-]+/).filter((one) => one.length >= 2);
    const lines = String(text || '').split(/\r?\n|(?<=[.!?。！？])\s+/);
    const matches = lines.map((line, index) => {
      const lower = line.toLowerCase();
      let score = name && lower.includes(name) ? 4 : 0;
      if (school && lower.includes(school)) score = Math.max(score, 3);
      else if (schoolTokens.some((token) => lower.includes(token)) && /숙련|기술|스킬|skill|proficiency|grade|\blv\b|level/i.test(line)) score = Math.max(score, 2);
      return { line, index, score };
    }).filter((one) => one.score > 0);
    const near = new Set();
    for (const match of matches) for (let index = Math.max(0, match.index - 2); index <= Math.min(lines.length - 1, match.index + 2); index += 1) near.add(index);
    return { matches, context: [...near].sort((a, b) => a - b).map((index) => lines[index]).join('\n') };
  }
  function explicitSkillNumber(segments, pattern, min, max) {
    let best = null;
    for (const segment of segments) {
      pattern.lastIndex = 0; let hit;
      while ((hit = pattern.exec(segment.line))) {
        const value = boundedNumber(hit[1], min, max);
        if (value == null) continue;
        const candidate = { value, score: segment.score, index: segment.index, offset: hit.index };
        if (!best || candidate.score > best.score || (candidate.score === best.score && (candidate.index > best.index || (candidate.index === best.index && candidate.offset > best.offset)))) best = candidate;
      }
    }
    return best?.value ?? null;
  }
  function inferredSkillProgress(source, entity, hasPrior = false) {
    const text = clean(source, 2400);
    const newlyLearned = /새로|처음|초보|입문|방금[\s\S]{0,30}(?:배우|습득|익히)|배웠|습득했|newly\s+learned|just\s+learned|just\s+acquired|novice|beginner/i.test(text);
    if (newlyLearned) return { level: 1, mastery: 0, tier: 'novice' };
    const tiers = [
      { re: /초월|신화적|절대자|대종사|극의|극성|화경|transcenden|grandmaster|apotheosis/i, level: 10, mastery: 97, tier: 'transcendent' },
      { re: /달인|대가|완성(?:했|된|한)|마스터(?:했|급|리)|mastered|\bmaster\b/i, level: 9, mastery: 90, tier: 'master' },
      { re: /고인물|베테랑|노련|고수|수백\s*번|수천\s*번|수년|평생|오랫동안|주력기|비전|veteran|expert/i, level: 7, mastery: 75, tier: 'veteran' },
      { re: /능숙|익숙|숙련|반복|실전|자주|여러\s*번|trained|practiced|proficient|experienced/i, level: 5, mastery: 55, tier: 'practiced' },
      { re: /사용해\s*온|보유|장착|구사|사용한다|이미\s*(?:알|익|배)|already|owns|uses|equipped/i, level: 4, mastery: 40, tier: 'established' }
    ];
    for (const tier of tiers) if (tier.re.test(text)) return { level: tier.level, mastery: tier.mastery, tier: tier.tier };
    if (hasPrior) return null;
    return { level: entity?.type === 'passive' ? 4 : 3, mastery: entity?.type === 'passive' ? 35 : 25, tier: 'baseline' };
  }
  function reconcileSkillEvent(event, evidenceText = '', options = {}) {
    const next = clone(event);
    if (next?.domain !== 'skill') return next;
    const entity = next.kind === 'exam' ? next.entity : null;
    if (entity) {
      const evidence = skillEvidenceSegments(evidenceText, entity);
      const level = explicitSkillNumber(evidence.matches, /(?:\bLv\.?|레벨|level)\s*[:：.]?\s*(\d{1,3})/ig, 1, 999);
      const masteryValue = explicitSkillNumber(evidence.matches, /(?:숙련도|mastery)\s*[:：]?\s*(\d{1,3})\s*%/ig, 0, 100);
      const source = evidence.context;
      const provided = new Set(entity._provided || []);
      const inferred = new Set(entity._inferred || []);
      const estimate = inferredSkillProgress(source, entity, Boolean(options.priorSkill));
      if (level != null) { entity.level = level; provided.add('level'); inferred.delete('level'); }
      else if (estimate && (entity.level == null || (estimate.tier !== 'novice' && entity.level <= 1))) {
        entity.level = estimate.level; provided.add('level'); inferred.add('level');
      } else if (entity.level != null) inferred.add('level');
      if (masteryValue != null) { entity.mastery = masteryValue; provided.add('mastery'); inferred.delete('mastery'); }
      else if (estimate && (entity.mastery == null || (estimate.tier !== 'novice' && entity.mastery <= 0))) {
        entity.mastery = estimate.mastery; provided.add('mastery'); inferred.add('mastery');
      } else if (entity.mastery != null) inferred.add('mastery');
      if (options.rarityMode === 'itemx' && !ITEMX_SKILL_RANKS.has(String(entity.rank || '').toLowerCase())) {
        entity.rank = 'normal'; provided.delete('rank');
      }
      entity._provided = [...provided];
      entity._inferred = [...inferred];
    }
    return next;
  }
  function extractResponse(content, base = snapshot(), options = {}) {
    const text = String(content || ''), state = clone(base), parts = collect(text), output = [], events = [], errors = [], enabled = new Set(options.enabledDomains || ['skill', 'monster']); let cursor = 0;
    if (!parts.length && !/<\/?(?:skillExam|skillPatch|monsterExam|monsterPatch)\b/i.test(text)) return { content: text, snapshot: state, events, errors };
    parts.forEach((part, index) => {
      output.push(text.slice(cursor, part.start));
      const domain = part.tag.toLowerCase().startsWith('skill') ? 'skill' : 'monster';
      if (!enabled.has(domain)) { cursor = part.end; return; }
      const parsed = parseTransport(part.tag, part.attrs, part.body, `${part.raw}:${index}`);
      if (parsed.event?.domain === 'skill') parsed.event = reconcileSkillEvent(parsed.event, options.skillEvidenceText ?? text, { ...options, priorSkill: state.skills.entries[parsed.event.entity?.id] });
      if (parsed.event) { const view = clone(applyEvent(state, parsed.event)); events.push(parsed.event); output.push(marker({ v: VERSION, event: parsed.event, view })); }
      else { errors.push(parsed.error || 'codex_invalid_transport'); output.push(marker({ v: VERSION, error: parsed.error || 'codex_invalid_transport' })); }
      cursor = part.end;
    });
    output.push(text.slice(cursor)); return { content: stripResidual(output.join('')), snapshot: state, events, errors };
  }
  function eventsFromText(text) { const out = []; String(text || '').replace(MARKER_RE, (_, code) => { const payload = decodePayload(code); if (payload?.v === VERSION && payload.event) out.push(payload.event); return ''; }); return out; }
  function rebuild(messages) { const state = snapshot(); let transport = ''; for (const msg of messages || []) for (const event of eventsFromText(ITEMXCore.messageText(msg))) { applyEvent(state, event); transport += marker({ v: VERSION, event }); } state.fingerprint = fnv(transport); state.updatedAt = Date.now(); return state; }
  function requestView(text) { return String(text || '').replace(MARKER_RE, (_, code) => { const p = decodePayload(code), e = p?.view || p?.event?.entity; return e ? `[${p.event?.domain === 'skill' ? 'SKILL' : 'ENCOUNTER'} ${e.name} | id=${e.id}]` : ''; }); }
  function normalizeAssetName(value, stem = false) {
    let result = clean(value, 240);
    try { result = result.normalize('NFKC'); } catch {}
    result = result.replace(/\\/g, '/').replace(/\s+/g, ' ').trim().toLowerCase();
    return stem ? result.replace(/\.(?:png|jpe?g|webp|gif|avif)$/i, '') : result;
  }
  function assetLookup(rows, requestedName) {
    const requested = clean(requestedName, 240); if (!requested) return null;
    const exact = (rows || []).find((row) => row.name === requested); if (exact) return exact;
    const normalized = normalizeAssetName(requested);
    const normalizedMatches = (rows || []).filter((row) => normalizeAssetName(row.name) === normalized);
    if (normalizedMatches.length === 1) return normalizedMatches[0];
    const stem = normalizeAssetName(requested, true);
    const stemMatches = (rows || []).filter((row) => normalizeAssetName(row.name, true) === stem);
    return stemMatches.length === 1 ? stemMatches[0] : null;
  }
  function assetForEntity(rows, entity, narrative = '') {
    const explicit = clean(entity?.portrait, 240);
    if (explicit && explicit.toUpperCase() !== 'NONE') {
      const matched = assetLookup(rows, explicit);
      if (matched) return matched;
    }
    const identities = [entity?.id, entity?.name, ...(entity?.aliases || [])]
      .map((value) => normalizeAssetName(value, true))
      .filter((value) => value.length >= 2);
    if (!identities.length) return null;
    const candidates = (rows || []).filter((row) => {
      const stem = normalizeAssetName(row?.name, true);
      return identities.some((identity) => stem === identity || stem.startsWith(`${identity}_`) || stem.startsWith(`${identity}-`) || stem.startsWith(`${identity} `));
    });
    if (!candidates.length) return null;
    const representativeKinds = ['standing', 'default', 'neutral', 'normal', 'idle', 'indifferent', 'serious'];
    for (const kind of representativeKinds) {
      const direct = candidates.find((row) => identities.some((identity) => normalizeAssetName(row.name, true) === `${identity}_${kind}`));
      if (direct) return direct;
      const variant = candidates.find((row) => new RegExp(`(?:^|[_ -])${kind}$`, 'i').test(normalizeAssetName(row.name, true)));
      if (variant) return variant;
    }
    const context = String(narrative || '').toLowerCase();
    let recent = null, recentAt = -1;
    for (const row of candidates) {
      const at = context.lastIndexOf(String(row.name || '').toLowerCase());
      if (at > recentAt) { recent = row; recentAt = at; }
    }
    return recentAt >= 0 ? recent : candidates[0];
  }
  function assetCatalog(character, max = 100, includeEmotion = false) {
    const limit = Math.max(0, Math.min(1000, Number(max) || 0)), seen = new Set();
    const collectAssets = (source, emotion = false) => {
      const rows = [];
      for (const tuple of source || []) {
        if (!Array.isArray(tuple)) continue;
        const [name, id, ext] = tuple, n = clean(name, 160);
        if (!n || !id || seen.has(n)) continue;
        seen.add(n); rows.push({ name: n, id: clean(id, 240), ext: emotion ? '' : clean(ext, 20) });
      }
      return rows;
    };
    const additional = collectAssets(character?.additionalAssets), emotions = includeEmotion ? collectAssets(character?.emotionImages, true) : [];
    if (!includeEmotion || additional.length + emotions.length <= limit) return additional.concat(emotions).slice(0, limit);
    const emotionSlots = Math.min(emotions.length, Math.max(1, Math.floor(limit / 4)));
    return additional.slice(0, Math.max(0, limit - emotionSlots)).concat(emotions.slice(0, emotionSlots));
  }
  function activeModuleAssetCatalog(database, character, chat, max = 400) {
    const activeIds = new Set();
    const addIds = (values) => { for (const value of values || []) { const id = clean(value, 160); if (id) activeIds.add(id); } };
    addIds(database?.enabledModules); addIds(character?.modules); addIds(chat?.modules);
    addIds(String(database?.moduleIntergration || '').split(',').map((value) => value.trim()).filter(Boolean));
    const tuples = [], seenModules = new Set();
    for (const module of database?.modules || []) {
      if (!module || (!activeIds.has(module.id) && !activeIds.has(module.namespace))) continue;
      const moduleKey = clean(module.id || module.namespace, 160); if (moduleKey && seenModules.has(moduleKey)) continue;
      if (moduleKey) seenModules.add(moduleKey);
      tuples.push(...(module.assets || []));
    }
    const personaId = clean(chat?.bindedPersona || database?.selectedPersona, 160);
    const persona = (database?.personas || []).find((one) => [one?.id, one?.chaId].some((value) => clean(value, 160) === personaId));
    if (persona?.embeddedModule?.assets) tuples.push(...persona.embeddedModule.assets);
    return assetCatalog({ additionalAssets: tuples }, max, false);
  }
  function anchor(state, narrative = '', max = 9000, options = {}) {
    const lines = ['[ITEMX CODEX · ACTIVE CONTEXT · authoritative]'];
    const skills = state?.skills || registry(), monsters = state?.monsters || registry(), text = String(narrative).toLowerCase(), enabled = new Set(options.enabledDomains || ['skill', 'monster']);
    if (enabled.has('skill')) for (const one of skills.order.map((id) => skills.entries[id]).filter(Boolean).filter((x) => ['equipped','sealed'].includes(x.status) || text.includes(x.name.toLowerCase())).slice(0, 8)) lines.push(`- SKILL id=${one.id} | name=${one.name} | type=${one.type} | status=${one.status} | level=${one.level ?? 'unknown'} | mastery=${one.mastery ?? 'unknown'} | effect=${one.effects.slice(0, 3).join(' ;; ')}`);
    if (enabled.has('monster')) for (const one of monsters.order.map((id) => monsters.entries[id]).filter(Boolean).filter((x) => x.active || [x.name, ...(x.aliases || [])].some((n) => n && text.includes(n.toLowerCase()))).slice(0, 4)) lines.push(`- ENCOUNTER id=${one.id} | name=${one.name} | relation=${one.relation} | status=${one.status} | threat=${one.threat} | weakness=${one.weaknesses.slice(0, 3).join(',')}${one.outcome ? ` | latest_outcome=${clean(one.outcome, 220)}` : ''}`);
    return lines.join('\n').slice(0, max);
  }
  function protocol(assetNames = [], options = {}) {
    const assets = assetNames.slice(0, 180).map((x) => clean(x, 160)).filter(Boolean).join(' ;; ').slice(0, 12000) || 'NONE';
    const enabled = new Set(options.enabledDomains || ['skill', 'monster']), sections = ['## ITEMX CODEX TRANSPORT', 'Emit these hidden transports only when the narrative settles a change. Never expose the tags as prose.'];
    const skillRankRule = options.rarityMode === 'itemx'
      ? 'Use only ITEMX rank values normal|magic|rare|unique|epic|legendary|mythical|empyrean, based on explicit narrative power and prestige; do not inflate an unsupported rank.'
      : "Preserve the setting's own native rank, realm, discipline grade or proficiency wording exactly; do not replace it with ITEMX rarity names.";
    if (enabled.has('skill')) sections.push(`Skills: <skillExam><id>snake_case</id><name>...</name><glyph>choose one fitting emoji that reflects the skill identity, form or use; do not mechanically repeat a default and never use ❔</glyph><rank>...</rank><school>...</school><type>active|passive|sealed</type><status>learned|equipped|sealed|lost</status><level>...</level><mastery>...</mastery><cost>...</cost><cooldown>...</cooldown><target>...</target><affinity>...</affinity><description>...</description><effects>one ;; two</effects><growth>...</growth></skillExam>. Update with <skillPatch><id>...</id><action>learn|equip|unequip|mastery|seal|unseal|forget</action> or <op>merge|remove|restore</op> plus changed fields only.</skillPatch> ${skillRankRule}`, "The player skill registry records persistent named capabilities, techniques, proficiencies and masteries. First explicit confirmation that the player already owns, uses, has mastered, has equipped, or is concretely known to possess one is a settled discovery event even when it was learned before this turn; emit skillExam if it is absent from ACTIVE CONTEXT. Registry discovery is not the moment of learning: never default a veteran or previously owned skill to level 1 or mastery 0 merely because it is first recorded. Preserve an explicit numeric skill or directly associated proficiency level/mastery from the narrative. If the setting has no explicit numeric scale, infer a conservative normalized level from 1 to 10 and mastery from 0 to 100 using the character's demonstrated experience with that skill: novice 1/0, established 4/40, practiced 5/55, veteran 7/75, master 9/90, transcendent 10/97. Treat these as estimates and never exaggerate beyond the narrative. Level 1 or mastery 0 is valid only when the narrative supports a newly learned or untrained skill. A bracketed word or generic action alone is not proof. Do not register an NPC or opponent's technique as a player skill; keep it in that encounter's moves unless the player actually acquires it. Track later learning, mastery, equipment, sealing and loss. Transient buffs and flavor descriptions are not skills. Always write informative cost and cooldown fields instead of bare NONE. Preserve explicit world-native resources, quantities and timing first. When exact numbers are absent, infer a conservative qualitative description from the demonstrated mechanism and intensity, such as slight mana drain, stamina exertion, sustained concentration, one ammunition, continuous use, brief recovery, magical stabilization, or a named narrative condition. Passive skills should say they are continuously applied and whether they require upkeep; sealed skills should state their unlock condition when known. Use '별도 소모 없음' or '재사용 제한 없음' only when the narrative actually supports cost-free or continuous use. Never invent precise numbers, a daily limit or a resource foreign to the setting. Cooldowns must never use turns, rounds, actions or initiative.");
    if (enabled.has('monster')) sections.push('Encounter bestiary: register only actual hostility/combat or an accepted duel/spar. Mentions, rumors, passive NPCs and unaccepted challenges do not register. Group unnamed mobs. Use <monsterExam><id>snake_case</id><name>...</name><glyph>choose one fitting emoji that reflects the creature identity or form; do not mechanically repeat a default and never use ❔</glyph><aliases>a ;; b</aliases><type>...</type><threat>...</threat><relation>hostile|sparring|neutral|allied|unknown</relation><status>active|ended|escaped|defeated|dead|unknown</status><portrait>exact asset name or NONE</portrait><weaknesses>...</weaknesses><resistances>...</resistances><moves>...</moves><description>...</description><outcome>latest completed combat result only; one or two concise sentences grounded in the narrative, including who or what delivered the decisive resolution and how; omit while unresolved or unsupported</outcome></monsterExam>. Update with <monsterPatch><id>...</id><action>encounter|end|escape|defeat|kill|ally</action><outcome>latest completed combat result when the narrative establishes it</outcome> or <op>merge|remove|restore</op> plus changed fields only.</monsterPatch> Preserve the previous outcome when a new encounter begins. Replace it only when a later combat is conclusively resolved. Never invent a victor, finishing move, wound, capture or death.', `AVAILABLE PORTRAIT ASSET NAMES (exact match only): ${assets}`);
    sections.push('Use existing ids. Close every tag. Multiple events are separate blocks in narrative order.');
    return sections.join('\n');
  }
  return { VERSION, STATE_KEY, MARKER_RE, esc, clone, marker, decodePayload, registry, snapshot, applyEvent, reconcileSkillEvent, extractResponse, eventsFromText, rebuild, requestView, normalizeAssetName, assetLookup, assetForEntity, assetCatalog, activeModuleAssetCatalog, anchor, protocol };
})();
if (typeof globalThis !== 'undefined') globalThis.ITEMXCodex = ITEMXCodex;
/* ITEMX 2 shared renderer. The chat body and plugin inventory call this file. */
const ITEMXRenderer = (() => {
  'use strict';
  const esc = (value) => globalThis.ITEMXCore ? ITEMXCore.esc(value) : String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const affinities = {
    fire: { name: '화염', icon: '🔥', c: '#ff7a3d', g: 'rgba(255,122,61,.42)' }, ice: { name: '냉기', icon: '❄️', c: '#58cbf5', g: 'rgba(88,203,245,.40)' },
    lightning: { name: '번개', icon: '⚡', c: '#f5d13c', g: 'rgba(245,209,60,.38)' }, wind: { name: '바람', icon: '🌪️', c: '#86e5c4', g: 'rgba(134,229,196,.34)' },
    earth: { name: '대지', icon: '🪨', c: '#c69a5c', g: 'rgba(198,154,92,.34)' }, light: { name: '광휘', icon: '☀️', c: '#ffe6a8', g: 'rgba(255,230,168,.40)' },
    dark: { name: '암흑', icon: '🌑', c: '#9a6bff', g: 'rgba(154,107,255,.42)' }, arcane: { name: '비전', icon: '✦', c: '#7f9cff', g: 'rgba(127,156,255,.40)' }, poison: { name: '맹독', icon: '☠️', c: '#a6e34a', g: 'rgba(166,227,74,.36)' },
    blood: { name: '혈기', icon: '🩸', c: '#d1354f', g: 'rgba(209,53,79,.42)' }, void: { name: '공허', icon: '🕳️', c: '#ff5ec2', g: 'rgba(255,94,194,.42)' }
  };
  const crafts = {
    arcane: { name: '마도', eyebrow: 'CODEX · APPRAISAL', shapes: ['shard', 'shard', 'shard', 'diamond'], paths: ['rise', 'drift', 'pulse'], colors: [['#d8b25c', '#f6e6bd'], ['#b8873a', '#ffe9b5']], accent: '#d8b25c', glow: 'rgba(216,178,92,.30)', ambient: { rays: 4, veil: 5 } },
    forged: { name: '대장간', eyebrow: 'FORGE · ASSAY', shapes: ['ash', 'ash', 'ash', 'shard'], paths: ['rise', 'drift'], colors: [['#e07a3a', '#ffd0a0'], ['#8a6440', '#e8b184']], accent: '#e07a3a', glow: 'rgba(224,122,58,.30)', ambient: { fog: 3, rays: 4, veil: 5 } },
    oriental: { name: '무림', eyebrow: '兵器鑑定', shapes: ['ash', 'ash', 'ash', 'petal'], paths: ['sway', 'sway', 'drift'], colors: [['#b9aa91', '#756957'], ['#d0b67f', '#8b7045'], ['#a33a40', '#e08a83']], accent: '#b82f36', glow: 'rgba(184,47,54,.22)', ambient: { fog: 3, rays: 4, veil: 5 } },
    clockwork: { name: '시계공학', eyebrow: 'ATELIER · No.', shapes: ['gear', 'gear', 'gear', 'block'], paths: ['turn', 'rise'], colors: [['#c98a2e', '#f3dfae'], ['#a9803c', '#ffe4b0']], accent: '#c98a2e', glow: 'rgba(201,138,46,.32)', ambient: { scan: 4, veil: 5 } },
    synthetic: { name: '합성체', eyebrow: 'GEAR SCAN', shapes: ['block', 'block', 'block', 'streak'], paths: ['jitter', 'rise'], colors: [['#4ef2ff', '#0a3a44'], ['#ff3d6e', '#3a0d1c']], accent: '#4ef2ff', glow: 'rgba(78,242,255,.35)', ambient: { scan: 1, veil: 3 } },
    celestial: { name: '천체', eyebrow: 'ASTRA · AUGURY', shapes: ['cross', 'cross', 'cross', 'diamond'], paths: ['pulse', 'rise', 'drift'], colors: [['#ffd98a', '#fff6e0'], ['#9fb4ff', '#e6ecff']], accent: '#ffd98a', glow: 'rgba(255,217,138,.30)', ambient: { rays: 2, veil: 3 } },
    organic: { name: '유기체', eyebrow: 'SYLVAN · READING', shapes: ['petal', 'petal', 'petal', 'ash'], paths: ['sway', 'drift'], colors: [['#7fe0a1', '#eafbe6'], ['#4a9c62', '#bff0cd']], accent: '#7fe0a1', glow: 'rgba(127,224,161,.28)', ambient: { fog: 2, rays: 4, veil: 5 } }
  };
  const reactions = {
    'fire+wind': ['화염폭풍', '불티가 바람의 궤도를 타고 휘몰아친다.'], 'fire+ice': ['열충격', '상반된 온도가 충돌하여 방어를 파쇄한다.'],
    'ice+lightning': ['극뢰', '빙결된 대상 사이로 번개가 연쇄 전도된다.'], 'fire+light': ['성화', '정화의 불꽃이 타락한 존재에게 추가 피해를 준다.'],
    'dark+void': ['심연붕괴', '공간을 잠식해 대상의 저항을 안쪽으로 붕괴시킨다.'], 'blood+poison': ['혈독', '상처에 스며든 독성이 맥박마다 증폭된다.'],
    'earth+wind': ['사암폭풍', '연마된 모래가 넓은 범위를 지속 절삭한다.']
  };
  const rarityLabels = { normal: '일반', magic: '매직', rare: '레어', unique: '유니크', epic: '에픽', legendary: '전설', mythical: '신화', empyrean: '창천' };
  const particleBudget = { normal: 4, magic: 6, rare: 8, unique: 16, epic: 16, legendary: 16, mythical: 16, empyrean: 16 };
  const ambientLevel = { normal: 1, magic: 2, rare: 3, unique: 3, epic: 4, legendary: 4, mythical: 5, empyrean: 5 };
  const locationLabels = { inventory: '소지품', equipped: '장착', storage: '보관', unknown: '위치 불명' };
  const possessionLabels = { observed: '관찰', owned: '보유', removed: '소실' };
  const rarityColors = { normal: '#5c6577', magic: '#6fa8e8', rare: '#45c8c0', unique: '#a888f0', epic: '#dd7be0', legendary: '#f0a640', mythical: '#ff7a7a', empyrean: '#ffe9a8' };

  const keyFor = (a, b) => [a, b].sort().join('+');
  const reactionFor = (a, b) => reactions[keyFor(a, b)] || ['이중 공명', `${affinities[a]?.name || a}과 ${affinities[b]?.name || b}의 성질이 번갈아 발현된다.`];
  const itemVars = (item) => {
    const craft = crafts[item.theme] || crafts.arcane, primary = affinities[item.affinity] || { c: craft.accent, g: craft.glow }, secondary = affinities[item.affinity2] || primary;
    return `--p:${primary.c};--pg:${primary.g};--s:${secondary.c};--sg:${secondary.g};--rk:${rarityColors[item.rarity] || rarityColors.normal}`;
  };

  function currentEffects(item, motion = 'full') {
    if (motion === 'off') return '';
    const craft = crafts[item.theme] || crafts.arcane, rarity = item.rarity || 'normal';
    const level = ambientLevel[rarity] || 1, count = motion === 'lite' ? Math.min(10, particleBudget[rarity] || 4) : (particleBudget[rarity] || 4);
    let rays = '';
    if (craft.ambient.rays && level >= craft.ambient.rays) [4, 44, 77, 119, 158, 196, 233, 271, 306, 339].forEach((r, i) => { rays += `<i style="--r:${r}deg;--w:${[5.1, 2.8, 7.4, 3.3, 6, 4.2, 8.1, 3, 5.6, 2.5][i]}%"></i>`; });
    let motes = '';
    const seed = parseInt(ITEMXCore.fnv1a(item.id || item.name || '?'), 16) || 1;
    for (let i = 0; i < count; i++) {
      const n = seed + i * 43, z = 2 + (n % 5) * .75, shape = craft.shapes[n % craft.shapes.length], path = craft.paths[(n * 3 + 1) % craft.paths.length], pair = craft.colors[n % craft.colors.length];
      motes += `<i class="craft-mote shape-${shape} path-${path} ${shape === 'diamond' ? 'diamond' : ''}" style="--x:${n % 101}%;--z:${z}px;--mh:${z * 2.8}px;--ca:${pair[0]};--cb:${pair[1]};--o:${.22 + (n % 4) * .1};--d:${7 + (n % 8)}s;--delay:-${(n % 9) * .75}s;--drift:${-34 + (n % 69)}px;--drift2:${(34 - (n % 69)) * .7}px"></i>`;
    }
    const fog = craft.ambient.fog && level >= craft.ambient.fog ? '<div class="current-fog"><span class="current-fog-visual"></span></div>' : '';
    const scan = craft.ambient.scan && level >= craft.ambient.scan ? '<div class="current-scan"></div>' : '';
    const veil = craft.ambient.veil && level >= craft.ambient.veil ? '<div class="current-veil"><span class="current-veil-visual"></span></div>' : '';
    return `<div class="current-fx">${rays ? `<div class="current-rays">${rays}</div>` : ''}${fog}${scan}${veil}${motes}</div>`;
  }

  function affinityEffects(kind, role, rarity, motion = 'full') {
    if (!kind || !affinities[kind] || motion === 'off') return '';
    const a = affinities[kind], tag = kind === 'lightning' ? 'b' : 'i', budgetScale = Math.max(.28, (particleBudget[rarity] || 4) / 16);
    let count = kind === 'lightning' ? 14 : (kind === 'ice' ? 18 : (kind === 'wind' ? 11 : 16));
    count = Math.max(3, Math.ceil(count * budgetScale * (role === 'secondary' ? .68 : 1) * (motion === 'lite' ? .72 : 1)));
    let bits = '';
    for (let i = 0; i < count; i++) {
      const style = `--x:${(i * 37 + 11) % 98}%;--y:${(i * 29 + 7) % 91}%;--z:${4 + (i % 5) * 2.3}px;--h:${24 + (i % 6) * 9}px;--iw:${2.5 + (i % 5) * 1.4}px;--ih:${10 + (i % 5) * 3.5}px;--ph:${7 + (i % 5) * 2.4}px;--d:${2.5 + (i % 7) * .76}s;--delay:-${(i % 8) * .63}s;--drift:${-42 + (i * 23) % 85}px;--sk:${-18 + (i * 11) % 37}deg;--r:${-38 + (i * 31) % 77}deg;--ac:${a.c}`;
      bits += `<${tag} style="${style}"></${tag}>`;
    }
    const secondary = role === 'secondary' ? ' secondary' : '';
    const extra = kind === 'lightning' ? `<div class="lightning-field${secondary}" style="--ac:${a.c}"></div>` : (kind === 'ice' ? `<div class="ice-cracks${secondary}" style="--ac:${a.c}"></div>` : '');
    const movingSignature = ['fire', 'wind', 'earth', 'light', 'dark', 'poison', 'blood', 'void'].includes(kind);
    const signature = kind === 'ice' ? '' : `<div class="affinity-signature sig-${kind}${secondary}" style="--ac:${a.c}">${movingSignature ? '<span class="affinity-signature-visual"></span>' : ''}</div>`;
    return `${signature}${extra}<div class="afx afx-${kind}${role === 'secondary' ? ' afx-secondary' : ''}" style="--ac:${a.c}">${bits}</div>`;
  }

  function affinityUi(item) {
    if (!item.affinity) return '';
    const primary = affinities[item.affinity];
    let out = `<span class="affinity-chip" style="--chip:${primary.c}">${primary.icon} ${primary.name}<small>${item.affinity2 ? '주속성' : '단일 속성'}</small></span>`;
    if (item.affinity2) {
      const secondary = affinities[item.affinity2], reaction = reactionFor(item.affinity, item.affinity2);
      out += `<span class="affinity-chip" style="--chip:${secondary.c}">${secondary.icon} ${secondary.name}<small>부속성</small></span><span class="affinity-chip reaction-chip">✦ ${esc(reaction[0])}</span>`;
    }
    return `<div class="affinity-row">${out}</div>`;
  }

  function renderSkillFx(skill, rarity = 'normal', motion = 'full') {
    const affinity = affinities[skill?.affinity] ? skill.affinity : 'arcane';
    const item = { id: skill?.id || skill?.name || 'skill', name: skill?.name || '스킬', theme: 'arcane', rarity: rarityLabels[rarity] ? rarity : 'normal', affinity };
    return `<div class="itemx-fx itemx2-skill-weapon-fx">${currentEffects(item, motion)}<div class="affinity-fx">${affinityEffects(affinity, 'primary', item.rarity, motion)}</div></div>`;
  }

  function stats(item) {
    const values = [['위력', item.power], ['요구', item.required], ['내구', item.durability], ['가치', item.cost]].filter(([, value]) => value);
    if (!values.length) return '';
    return `<div class="itemx-stats">${values.map(([key, value]) => `<div class="itemx-stat"><span class="itemx-statk">${key}</span><span class="itemx-statv">${esc(value)}</span></div>`).join('')}</div>`;
  }

  function effectSection(item) {
    const effects = Array.isArray(item.effects) ? item.effects : [], augments = Array.isArray(item.augments) ? item.augments : [];
    let out = '';
    if (effects.length) out += `<div class="itemx-gap"></div><div class="itemx-section-label">특수 효과</div><div class="itemx-effects">${effects.map((one) => `<div class="itemx-effect"><span class="itemx-efname">${esc(one.name)}</span> <span>${esc(one.desc)}</span></div>`).join('')}</div>`;
    if (augments.length) out += `<div class="itemx-gap"></div><div class="itemx-section-label">증강</div><div class="itemx-effects">${augments.map((one) => `<div class="itemx-effect"><span class="itemx-efname">${esc(one.name)}</span> <span>${esc(one.desc)}</span></div>`).join('')}</div>`;
    return out;
  }

  function themeDecor(theme) {
    if (theme !== 'oriental') return '';
    return '<div class="itemx-oriental-paper"></div><i class="itemx-oriental-ink itemx-oriental-ink-a"></i><i class="itemx-oriental-ink itemx-oriental-ink-b"></i><div class="itemx-oriental-frame"></div><span class="itemx-oriental-seal" aria-hidden="true">鑑<br>定</span>';
  }

  function renderCard(item, options = {}) {
    if (!item) return '';
    const theme = crafts[item.theme] ? item.theme : 'arcane', rarity = rarityLabels[item.rarity] ? item.rarity : 'normal', motion = options.motion || 'full';
    const classes = ['itemx-card', `craft-${theme}`, `rarity-${rarity}`, item.condition ? `condition-${item.condition}` : '', motion === 'off' ? 'motion-off' : '', options.inline ? 'itemx-inline-card' : ''].filter(Boolean).join(' ');
    const possession = possessionLabels[item.possession] || item.possession || '관찰', location = locationLabels[item.location] || item.location || '위치 불명';
    return `<article class="${classes}" style="${itemVars(item)}" data-itemx-id="${esc(item.id)}">${themeDecor(theme)}<div class="itemx-fx">${currentEffects(item, motion)}<div class="affinity-fx">${affinityEffects(item.affinity, 'primary', rarity, motion)}${affinityEffects(item.affinity2, 'secondary', rarity, motion)}</div></div><div class="itemx-cond"></div><div class="itemx-content"><div class="itemx-head"><div class="itemx-medallion"><span class="itemx-emoji">${esc(ITEMXCore.resolveItemEmoji(item))}</span></div><div class="itemx-titles"><div class="itemx-eyebrow">${esc(crafts[theme].eyebrow)}</div><span class="itemx-name">${esc(item.name || '???')}</span><span class="itemx-tier">${esc(item.displayRarity || rarityLabels[rarity])}</span><span class="itemx-subline"><span>${esc(possession)} · ${esc(location)}</span><span>${esc(item.itemType || '기타')}</span>${Number(item.count) > 1 ? `<span>×${Number(item.count)}</span>` : ''}</span></div></div>${affinityUi(item)}<div class="itemx-rule"></div>${stats(item)}${effectSection(item)}${item.trivia ? `<div class="itemx-flavor">${esc(item.trivia)}</div>` : ''}</div></article>`;
  }

  function renderTile(item) {
    const icons = [item.affinity && affinities[item.affinity]?.icon, item.affinity2 && affinities[item.affinity2]?.icon].filter(Boolean).join('');
    return `<button class="itemx-tile rarity-${esc(item.rarity || 'normal')}" style="${itemVars(item)}" data-item-id="${esc(item.id)}"><span class="itemx-tile-bar"></span>${item.location === 'equipped' ? '<span class="itemx-tile-eq"></span>' : ''}${icons ? `<span class="itemx-tile-aff">${icons}</span>` : ''}<span class="itemx-tile-em">${esc(ITEMXCore.resolveItemEmoji(item))}</span><span class="itemx-tile-nm">${esc(item.name || '???')}</span><span class="itemx-tile-meta"><span class="itemx-tile-rk">${esc(item.displayRarity || rarityLabels[item.rarity] || '일반')}</span><span class="itemx-tile-lc">${esc(item.itemType || '기타')}</span></span></button>`;
  }

  function renderMarkerPayload(payload, options = {}) {
    if (!payload || payload.error) return '';
    if (payload.view) return renderCard(payload.view, options);
    const id = payload.event?.patch?.id;
    return id ? `<span class="itemx-event-chip">ITEMX CODEX · ${esc(id)} 변경</span>` : '';
  }

  return { affinities, crafts, rarityLabels, reactions, particleBudget, renderCard, renderTile, renderMarkerPayload, renderSkillFx, itemVars };
})();

if (typeof globalThis !== 'undefined') globalThis.ITEMXRenderer = ITEMXRenderer;
/* Build placeholders are replaced by scripts/build.mjs. */
const ITEMX_STYLE = ":root { color-scheme: dark; font-family: Inter, Pretendard, \"Noto Sans KR\", sans-serif; }\n    * { box-sizing: border-box; }\n    body { margin: 0; min-height: 100vh; background: #080a10; color: #e6ebf4; }\n    button, select { font: inherit; }\n    button { color: inherit; }\n\n    .risu-shell { min-height: 100vh; background: radial-gradient(900px 560px at 50% 20%, #171b27 0, #0b0e15 55%, #07090e 100%); }\n    .risu-topbar { height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; border-bottom: 1px solid #202532; background: rgba(12,15,23,.94); color: #aeb7c9; font-size: 13px; }\n    .risu-topbar strong { color: #f2f4f8; font-size: 14px; }\n    .stage { width: min(920px, 100%); margin: 0 auto; padding: 22px 18px 64px; }\n    .demo-note { display: flex; align-items: center; gap: 9px; margin: 0 auto 14px; width: min(760px,100%); padding: 9px 12px; border: 1px solid #30394a; border-radius: 10px; background: #111622; color: #919db2; font-size: 12px; line-height: 1.45; }\n    .demo-note b { color: #d8b25c; white-space: nowrap; }\n\n    .lab { width: min(760px, 100%); margin: 0 auto 14px; padding: 12px; border: 1px solid #252c3a; border-radius: 13px; background: rgba(13,17,26,.96); }\n    .lab-title { margin-bottom: 9px; color: #8e9ab0; font-size: 10px; font-weight: 800; letter-spacing: .22em; }\n    .lab-grid { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 8px; }\n    .lab label { display: grid; gap: 5px; color: #79869d; font-size: 11px; }\n    .lab select, .lab button { min-height: 34px; border: 1px solid #31394a; border-radius: 8px; background: #171c28; color: #d9dfeb; padding: 0 9px; }\n    .lab button { cursor: pointer; }\n    .lab button[aria-pressed=\"true\"] { border-color: #806a3d; background: #2a2418; color: #f0d79d; }\n\n    /* Current ITEMX inventory shell, reproduced from the module's rendered screen. */\n    .itemx-panel { display: flex; flex-direction: column; width: min(560px,100%); margin: 0 auto; overflow: hidden; border: 1px solid #232c3d; border-radius: 14px; background: #0a0d14; color: #e6ebf4; font-size: .9rem; box-shadow: 0 24px 70px rgba(0,0,0,.48); }\n    .itemx-ph { display: flex; align-items: center; gap: .45em; padding: 1em 1.05em .85em; border-bottom: 1px solid rgba(212,175,110,.14); background: radial-gradient(120% 150% at 18% -40%,rgba(212,175,110,.10),transparent 55%),linear-gradient(180deg,#131a28,#0c1019); }\n    .itemx-ph-text { display: flex; flex: 1; flex-direction: column; gap: .15em; min-width: 0; }\n    .itemx-ph-eyebrow { color: #b39355; font-size: .6rem; font-weight: 700; letter-spacing: .3em; }\n    .itemx-ph-title { color: #f4f0e6; font-size: 1.12rem; font-weight: 800; }\n    .itemx-ph-sub { color: #77839c; font-size: .72rem; }\n    .itemx-ph-btn { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.06); border-radius: 10px; background: rgba(255,255,255,.03); color: #8b99b2; }\n    .itemx-seg { display: flex; gap: .15em; margin: .35em 1.05em 0; overflow-x: auto; border-bottom: 1px solid #171d2b; scrollbar-width: none; }\n    .itemx-seg-i { flex: 0 0 auto; min-height: 38px; display: inline-flex; align-items: center; gap: .32em; padding: 0 .6em; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #6e7b93; font-size: .78rem; cursor: pointer; }\n    .itemx-seg-on { border-bottom-color: #d4af6e; color: #f2ead9; font-weight: 700; }\n    .itemx-seg-n { opacity: .65; font-size: .92em; }\n    .itemx-tools { display: flex; gap: .4em; margin: .6em 1.05em 0; }\n    .itemx-tool,.itemx-search { min-height: 34px; display: inline-flex; align-items: center; padding: 0 .7em; border: 1px solid rgba(255,255,255,.06); border-radius: 9px; background: rgba(255,255,255,.025); color: #93a2ba; font-size: .76rem; }\n    .itemx-search { flex: 1; color: #64718c; }\n    .itemx-body { padding: .75em 1.05em .95em; }\n    .itemx-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .55em; }\n    .itemx-tile { --rk:#8b94a6; --rks:rgba(139,148,166,.38); position: relative; display: grid; grid-template-columns: 2.4em minmax(0,1fr); grid-template-rows: 1fr auto; gap: .15em .6em; height: 82px; padding: .6em .7em .55em .85em; overflow: hidden; border: 1px solid #1c2331; border-radius: 13px; background: linear-gradient(160deg,#121826,#0d111b 78%); text-align: left; cursor: pointer; }\n    .itemx-tile:hover,.itemx-tile:focus-visible { border-color: var(--p,#d4af6e); outline: none; background: #141d2c; }\n    .itemx-tile-bar { position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--rk); }\n    .itemx-tile-eq { position: absolute; top: 0; right: 0; border-top: 16px solid #ffd479; border-left: 16px solid transparent; opacity: .85; }\n    .itemx-tile-em { grid-row: 1/span 2; align-self: center; width: 2.55em; height: 2.55em; display: grid; place-items: center; border: 1px solid var(--rks); border-radius: 11px; background: radial-gradient(85% 85% at 50% 28%,var(--rks),transparent 80%); font-size: 1.1em; }\n    .itemx-tile-nm { align-self: center; overflow: hidden; color: #edf2fb; font-size: .85rem; font-weight: 700; line-height: 1.32; }\n    .itemx-tile-meta { display: flex; justify-content: space-between; gap: .5em; align-self: end; }\n    .itemx-tile-rk { color: var(--rk); font-size: .7rem; font-weight: 700; }\n    .itemx-tile-lc { color: #67748c; font-size: .7rem; }\n    .itemx-tile-aff { position:absolute; right:8px; top:7px; display:flex; gap:2px; font-size:9px; filter:drop-shadow(0 0 4px rgba(0,0,0,.8)); }\n    .itemx-pf { padding: .68em 1.1em; border-top: 1px solid #171d2b; color: #59657a; font-size: .7rem; text-align: right; }\n\n    /* Off-screen cards keep their effects and DOM, while the browser may skip\n       their layout and paint work until they approach the viewport. */\n    .itemx-card { content-visibility:auto; contain:layout paint style; contain-intrinsic-size:auto 520px; }\n\n    /* Detail card keeps ITEMX's real visual contract. Current theme effects and\n       the proposed affinity effects are deliberately separate layers. */\n    .itemx-back { display: inline-block; margin-bottom: .7em; border: 0; background: transparent; color: #9eabbf; font-size: .78rem; cursor: pointer; }\n    .itemx-detail { display: flex; justify-content: center; }\n    .itemx-card { --bg:#1c1610; --surf:rgba(92,74,46,.18); --fg:#e8dcc2; --dim:#a89372; --line:#5c4a2e; --p:#ff7a3d; --pg:rgba(255,122,61,.42); --s:#86e5c4; --sg:rgba(134,229,196,.34); --rk:#f0a640; --rks:rgba(240,166,64,.5); --int:.72; --spd:1.25; position: relative; width: min(360px,100%); overflow: hidden; isolation: isolate; border: 1px solid var(--line); border-radius: 3px; background: repeating-linear-gradient(102deg,rgba(255,235,190,.028) 0 2px,transparent 2px 7px),repeating-linear-gradient(11deg,rgba(0,0,0,.14) 0 3px,transparent 3px 9px),radial-gradient(120% 80% at 50% -10%,#2b2117,#17120c 70%); color: var(--fg); font-family: \"Nanum Myeongjo\",\"Noto Serif KR\",Georgia,serif; font-size: .92rem; line-height: 1.62; box-shadow: inset 0 0 60px rgba(0,0,0,.55),0 0 calc(30px*var(--int)) var(--pg); }\n    .craft-forged { --surf:rgba(74,60,45,.26);--fg:#f0e7dc;--dim:#b3a08c;--line:#4a3c2d;border-width:2px;border-radius:2px;background:repeating-linear-gradient(-14deg,rgba(255,255,255,.022) 0 2px,transparent 2px 11px),linear-gradient(168deg,#221d19,#0d0c0b 74%);font-family:Inter,Pretendard,sans-serif; }\n    .craft-oriental { --surf:rgba(215,192,146,.075);--fg:#eee8dd;--dim:#aaa194;--line:#59482e;border-radius:2px;background:radial-gradient(100% 62% at 88% 0,rgba(135,89,35,.15),transparent 62%),repeating-linear-gradient(93deg,rgba(235,214,173,.018) 0 1px,transparent 1px 5px),repeating-linear-gradient(4deg,rgba(235,214,173,.014) 0 1px,transparent 1px 7px),linear-gradient(150deg,#191815,#0d1011 52%,#17130f);color:var(--fg);box-shadow:inset 0 0 0 1px #151717,inset 0 0 52px rgba(0,0,0,.48),0 0 calc(24px*var(--int)) var(--pg); }\n    .craft-clockwork { --surf:rgba(107,81,44,.2);--fg:#e3d5b8;--dim:#9d8a68;--line:#6b512c;border-width:2px;border-radius:4px;background:repeating-linear-gradient(88deg,rgba(255,220,160,.035) 0 1px,transparent 1px 3px),linear-gradient(160deg,#241d15,#14100b 72%);font-family:ui-monospace,monospace; }\n    .craft-synthetic { --surf:rgba(31,53,70,.35);--fg:#d6e6ef;--dim:#6d8496;--line:#1f3546;border-radius:0;background:repeating-linear-gradient(0deg,rgba(120,220,255,.045) 0 1px,transparent 1px 4px),linear-gradient(150deg,#0d1420,#070a11 70%);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% calc(100% - 24px),calc(100% - 24px) 100%,12px 100%,0 calc(100% - 12px));font-family:ui-monospace,monospace; }\n    .craft-celestial { --surf:rgba(45,61,117,.28);--fg:#dfe7ff;--dim:#8e9ccb;--line:#2d3d75;border-radius:3px 3px 22px 22px;background:radial-gradient(90% 60% at 50% -8%,rgba(255,217,138,.16),transparent 62%),radial-gradient(120% 100% at 50% 110%,#14204a,transparent 60%),linear-gradient(180deg,#070b1c,#050813); }\n    .craft-organic { --surf:rgba(44,74,51,.3);--fg:#dcecd8;--dim:#86a78d;--line:#2c4a33;border-radius:22px 4px 22px 4px;background:radial-gradient(100% 70% at 22% -6%,rgba(127,224,161,.1),transparent 60%),radial-gradient(120% 90% at 80% 110%,rgba(30,90,60,.5),transparent 62%),linear-gradient(170deg,#0d1b12,#071008);font-family:Inter,Pretendard,sans-serif; }\n    .craft-forged .itemx-medallion,.craft-oriental .itemx-medallion{border-radius:3px}.craft-synthetic .itemx-medallion{border-radius:0;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))}.craft-organic .itemx-medallion{border-radius:60% 12% 60% 12%}.craft-celestial .itemx-medallion{border-radius:50%}.craft-oriental .itemx-name{color:#f2eadb;text-shadow:0 1px 2px #000,0 0 7px rgba(232,210,170,.16)}.craft-oriental .itemx-badge,.craft-oriental .itemx-subline{color:#aaa194}.craft-oriental .itemx-eyebrow{color:#bb9659;letter-spacing:.2em}.craft-oriental .itemx-head{padding-right:2.55em}.craft-oriental .itemx-effect,.craft-oriental .itemx-stat{background:rgba(7,9,9,.38)}\n    .itemx-oriental-paper,.itemx-oriental-ink,.itemx-oriental-frame,.itemx-oriental-seal{display:none;position:absolute;pointer-events:none}\n    .craft-oriental .itemx-oriental-paper{display:block;inset:0;z-index:0;opacity:.32;background:repeating-linear-gradient(92deg,transparent 0 8px,rgba(224,200,154,.025) 9px,transparent 10px 17px),repeating-linear-gradient(4deg,transparent 0 10px,rgba(224,200,154,.018) 11px,transparent 12px 20px)}\n    .craft-oriental .itemx-oriental-ink{display:block;z-index:1;border:1px solid rgba(216,193,148,.08);border-radius:50%;filter:blur(1px);opacity:.7}\n    .craft-oriental .itemx-oriental-ink-a{width:78%;height:44%;right:-35%;top:7%;transform:rotate(-12deg);box-shadow:0 0 22px rgba(178,126,60,.05)}\n    .craft-oriental .itemx-oriental-ink-b{width:64%;height:36%;left:-34%;bottom:4%;transform:rotate(16deg);border-color:rgba(146,42,47,.09)}\n    .craft-oriental .itemx-oriental-frame{display:block;inset:10px;z-index:5;border:1px solid rgba(210,178,111,.18);box-shadow:inset 0 0 18px rgba(0,0,0,.18)}\n    .craft-oriental .itemx-oriental-frame::before,.craft-oriental .itemx-oriental-frame::after{content:\"\";position:absolute;width:18px;height:18px;border-color:rgba(229,195,125,.55);border-style:solid}\n    .craft-oriental .itemx-oriental-frame::before{left:-4px;top:-4px;border-width:2px 0 0 2px}\n    .craft-oriental .itemx-oriental-frame::after{right:-4px;bottom:-4px;border-width:0 2px 2px 0}\n    .craft-oriental .itemx-oriental-seal{display:grid;place-items:center;right:16px;top:18px;z-index:6;width:31px;height:38px;border:1px solid rgba(214,82,73,.66);background:rgba(116,20,25,.38);color:#e09186;font-size:.62em;font-weight:800;line-height:1.05;text-align:center;box-shadow:inset 0 0 0 2px rgba(18,8,8,.36),0 0 9px rgba(175,34,40,.16);transform:rotate(2deg)}\n    .itemx-card::before { content:\"\"; position:absolute; inset:0 0 auto; z-index:6; height:2px; background:linear-gradient(90deg,transparent,var(--rk) 18%,var(--rk) 82%,transparent); opacity:.85; }\n    .itemx-fx,.itemx-cond { position:absolute; inset:0; pointer-events:none; overflow:hidden; }\n    .itemx-fx { z-index:1; }\n    .itemx-cond { z-index:2; }\n    .craft-oriental .itemx-fx{z-index:2}.craft-oriental .current-fx{opacity:.42}.craft-oriental .current-fog{opacity:.28}.craft-oriental .current-veil,.craft-oriental .current-rays{opacity:.44}.craft-oriental .affinity-fx{z-index:3;filter:saturate(1.2) brightness(1.16)}\n    /* Existing ITEMX effects: arcane gold rays and deterministic gold shards. */\n    .current-fx,.affinity-fx { position:absolute; inset:0; overflow:hidden; }\n    .current-rays { position:absolute; inset:-75%; opacity:calc(.12 * var(--int)); filter:blur(9px); animation:existing-spin calc(96s/var(--spd)) linear infinite; }\n    .current-rays i { position:absolute; top:50%; left:50%; width:var(--w); height:100%; transform:translateX(-50%) translateY(-100%) rotate(var(--r)); transform-origin:center bottom; border-radius:80% 80% 0 0; background:linear-gradient(to top,var(--p),transparent 49%); }\n    .current-veil { position:absolute; top:-55%; right:0; left:0; height:85%; animation:existing-veil calc(8.5s/var(--spd)) ease-in-out infinite; }\n    .current-veil-visual { position:absolute;inset:0;display:block;background:linear-gradient(to bottom,transparent,var(--pg),transparent);filter:blur(15px); }\n    .craft-mote { position:absolute; left:var(--x); top:108%; width:var(--z); height:var(--mh); border-radius:42% 42% 56% 56%/62% 62% 38% 38%; background:linear-gradient(to top,var(--ca),transparent); box-shadow:0 0 6px var(--ca); opacity:var(--o); animation:existing-rise var(--d) linear infinite; animation-delay:var(--delay); }\n    .craft-mote.diamond { height:var(--z); border-radius:0; background:linear-gradient(135deg,var(--ca),var(--cb)); transform:rotate(45deg); }\n    .craft-mote.shape-ash { height:var(--z);border-radius:62% 38% 55% 45%;background:radial-gradient(circle at 38% 34%,var(--ca),var(--cb) 72%,transparent); }\n    .craft-mote.shape-petal { height:var(--mh);border-radius:100% 6% 100% 6%;background:linear-gradient(140deg,var(--ca),var(--cb)); }\n    .craft-mote.shape-block { height:var(--z);border-radius:0;background:var(--ca);box-shadow:1px 0 0 var(--cb); }\n    .craft-mote.shape-streak { width:2px;height:var(--mh);border-radius:2px;background:linear-gradient(to top,transparent,var(--ca) 45%,transparent); }\n    .craft-mote.shape-cross { height:var(--z);border-radius:0;background:linear-gradient(90deg,transparent,var(--ca),transparent); }\n    .craft-mote.shape-cross::after { content:\"\";position:absolute;inset:-70% 42%;background:linear-gradient(to bottom,transparent,var(--cb),transparent); }\n    .craft-mote.shape-gear { height:var(--z);border-radius:0;background:none;box-shadow:none;color:var(--ca);font-size:var(--mh);line-height:1; }\n    .craft-mote.shape-gear::before { content:\"⚙\";position:absolute;inset:0; }\n    .path-drift{animation-name:existing-drift}.path-pulse{animation-name:existing-pulse}.path-sway{animation-name:existing-sway}.path-turn{animation-name:existing-turn}.path-jitter{animation-name:existing-jitter}\n    .current-fog { position:absolute;right:-20%;bottom:-35%;left:-20%;height:85%;animation:existing-fog 17s ease-in-out infinite alternate; }\n    .current-fog-visual { position:absolute;inset:0;display:block;background:radial-gradient(60% 60% at 30% 70%,var(--pg),transparent 70%),radial-gradient(55% 55% at 75% 60%,var(--pg),transparent 72%);filter:blur(22px); }\n    .current-scan { position:absolute;top:-30%;right:0;left:0;height:42%;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.13),transparent);animation:existing-scan 5.5s linear infinite; }\n\n    /* Proposed affinity layer. No circular pulse or generic coloured wash. */\n    .affinity-fx { z-index:2; }\n    .afx { position:absolute; inset:0; opacity:1; filter:saturate(1.22) brightness(1.12); }\n    .afx-secondary { opacity:.68; clip-path:inset(0 0 0 46%); }\n    .afx i { position:absolute; display:block; color:var(--ac); }\n    .afx-fire i { left:var(--x); bottom:-12px; width:3px; height:var(--h); border-radius:60% 60% 30% 30%; background:linear-gradient(to top,transparent,var(--ac) 50%,#ffe2a6); box-shadow:0 0 7px var(--ac); transform:skewX(var(--sk)); animation:aff-fire var(--d) ease-out infinite; animation-delay:var(--delay); }\n    .afx-ice i { left:var(--x); top:var(--y); width:var(--iw); height:var(--ih); background:linear-gradient(160deg,#fff 0 12%,#dff8ff 24%,var(--ac) 62%,transparent); clip-path:polygon(50% 0,82% 38%,66% 100%,29% 82%,12% 35%); filter:drop-shadow(0 0 3px #dff8ff) drop-shadow(0 0 6px var(--ac)); animation:aff-ice var(--d) linear infinite; animation-delay:var(--delay); }\n    .afx-lightning b { position:absolute; width:94px; height:7px; background:linear-gradient(90deg,transparent,var(--ac),#fff 48%,var(--ac),transparent); clip-path:polygon(0 38%,35% 18%,40% 60%,66% 5%,62% 48%,100% 28%,100% 65%,61% 78%,56% 45%,42% 100%,34% 58%,0 76%); filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 10px var(--ac)); opacity:0; animation:aff-lightning var(--d) step-end infinite; animation-delay:var(--delay); transform:rotate(var(--r)); }\n    .afx-wind i { left:-24%; top:var(--y); width:52%; height:1px; background:linear-gradient(90deg,transparent,var(--ac) 36%,transparent); box-shadow:0 0 5px var(--ac); transform:skewX(-24deg); animation:aff-wind var(--d) ease-in-out infinite; animation-delay:var(--delay); }\n    .afx-earth i { left:var(--x); bottom:-6px; width:var(--z); height:var(--z); background:linear-gradient(145deg,#f2cf8a,var(--ac) 52%,#4b3219); clip-path:polygon(16% 4%,92% 18%,75% 92%,8% 70%); filter:drop-shadow(0 0 3px var(--ac)); animation:aff-earth var(--d) ease-out infinite; animation-delay:var(--delay); }\n    .afx-light i { left:var(--x); top:-20%; width:var(--z); height:135%; transform:skewX(-18deg); background:linear-gradient(to bottom,transparent,var(--ac) 38%,transparent 72%); filter:blur(2px); animation:aff-light var(--d) ease-in-out infinite alternate; animation-delay:var(--delay); }\n    .afx-dark i { left:var(--x); top:var(--y); width:var(--z); height:var(--h); background:linear-gradient(to bottom,transparent,var(--ac),transparent); transform:skewX(var(--sk)); filter:blur(4px); animation:aff-dark var(--d) ease-in-out infinite alternate; animation-delay:var(--delay); }\n    .afx-poison i { left:var(--x); top:var(--y); width:var(--z); height:var(--ph); border-radius:65% 35% 60% 40%; background:linear-gradient(145deg,#eaff9a,var(--ac) 58%,transparent); box-shadow:0 0 6px var(--ac); animation:aff-poison var(--d) ease-in-out infinite; animation-delay:var(--delay); }\n    .afx-blood i { left:var(--x); top:-15%; width:var(--z); height:var(--h); border-radius:0 0 70% 30%; background:linear-gradient(to bottom,var(--ac),transparent); box-shadow:0 4px 7px var(--ac); animation:aff-blood var(--d) ease-in infinite; animation-delay:var(--delay); }\n    .afx-void i { left:var(--x); top:var(--y); width:var(--z); height:2px; transform:rotate(var(--r)) skewX(-34deg); background:linear-gradient(90deg,transparent,#fff 16%,var(--ac) 48%,transparent); box-shadow:0 0 5px var(--ac),0 0 12px var(--ac); animation:aff-void var(--d) step-end infinite; animation-delay:var(--delay); }\n    /* A second, broad signature per affinity. Particles provide detail; these\n       edge traces make the affinity readable before the viewer studies them. */\n    .affinity-signature { position:absolute; inset:0; color:var(--ac); pointer-events:none; mix-blend-mode:screen; opacity:.76; }\n    .affinity-signature-visual { position:absolute;inset:0;display:block; }\n    .affinity-signature.secondary { opacity:.48; clip-path:inset(0 0 0 48%); }\n    .sig-fire { animation:sig-fire 5.2s linear infinite; }\n    .sig-fire>.affinity-signature-visual { background:repeating-linear-gradient(0deg,transparent 0 36px,color-mix(in srgb,var(--ac) 12%,transparent) 38px,color-mix(in srgb,var(--ac) 38%,transparent) 39px,transparent 42px 76px);filter:blur(2px) drop-shadow(0 0 7px var(--ac)); }\n    .ice-cracks { position:absolute; inset:0; background:linear-gradient(32deg,transparent 0 31%,color-mix(in srgb,var(--ac) 62%,#fff) 31.4%,transparent 32% 100%),linear-gradient(147deg,transparent 0 67%,color-mix(in srgb,var(--ac) 45%,#fff) 67.4%,transparent 68% 100%),linear-gradient(81deg,transparent 0 78%,var(--ac) 78.3%,transparent 78.8% 100%); clip-path:polygon(0 0,17% 0,32% 38%,51% 21%,66% 54%,100% 39%,100% 52%,69% 65%,53% 34%,34% 53%,12% 18%,0 22%); filter:drop-shadow(0 0 4px var(--ac)); opacity:0; animation:ice-cracks 5.6s step-end infinite; }\n    .sig-lightning { background:linear-gradient(112deg,transparent 0 42%,color-mix(in srgb,var(--ac) 68%,transparent) 43%,#fff 44%,var(--ac) 45%,transparent 47% 100%); clip-path:polygon(0 9%,44% 9%,36% 37%,70% 31%,58% 61%,100% 56%,100% 68%,48% 75%,57% 46%,24% 51%,35% 22%,0 26%); filter:drop-shadow(0 0 7px #fff) drop-shadow(0 0 14px var(--ac)); opacity:0; animation:sig-lightning 3.2s step-end infinite; }\n    .lightning-field { position:absolute; inset:0; opacity:0; background:linear-gradient(28deg,transparent 0 22%,var(--ac) 22.5%,transparent 23.2% 100%),linear-gradient(151deg,transparent 0 58%,#fff 58.4%,var(--ac) 59%,transparent 59.8% 100%),linear-gradient(74deg,transparent 0 71%,var(--ac) 71.5%,transparent 72.3% 100%); clip-path:polygon(0 4%,100% 0,100% 17%,0 28%,0 42%,100% 31%,100% 51%,0 64%,0 79%,100% 69%,100% 88%,0 100%); box-shadow:inset 8px 0 16px color-mix(in srgb,var(--ac) 55%,transparent),inset -8px 0 16px color-mix(in srgb,var(--ac) 55%,transparent); filter:drop-shadow(0 0 8px var(--ac)); animation:lightning-field 2.35s step-end infinite; }\n    .sig-wind { transform:translateX(-26%);animation:sig-wind 6.4s linear infinite; }\n    .sig-wind>.affinity-signature-visual { background:repeating-linear-gradient(164deg,transparent 0 34px,color-mix(in srgb,var(--ac) 45%,transparent) 35px,color-mix(in srgb,var(--ac) 15%,transparent) 37px,transparent 40px 69px);filter:drop-shadow(5px 0 7px var(--ac)); }\n    .sig-earth { animation:sig-earth 6s ease-in-out infinite alternate; }\n    .sig-earth>.affinity-signature-visual { background:linear-gradient(32deg,transparent 0 18%,color-mix(in srgb,var(--ac) 42%,transparent) 18.5%,transparent 19.4% 47%,color-mix(in srgb,var(--ac) 30%,transparent) 47.5%,transparent 48.4% 100%),linear-gradient(146deg,transparent 0 67%,color-mix(in srgb,var(--ac) 46%,transparent) 67.5%,transparent 68.4%);filter:drop-shadow(0 0 5px var(--ac)); }\n    .sig-light { animation:sig-light 7s ease-in-out infinite alternate; }\n    .sig-light>.affinity-signature-visual { background:repeating-linear-gradient(112deg,transparent 0 54px,color-mix(in srgb,var(--ac) 32%,transparent) 55px,color-mix(in srgb,var(--ac) 8%,transparent) 68px,transparent 80px 122px);filter:blur(3px) drop-shadow(0 0 9px var(--ac)); }\n    .sig-dark { animation:sig-dark 7.5s ease-in-out infinite alternate; }\n    .sig-dark>.affinity-signature-visual { background:repeating-linear-gradient(106deg,transparent 0 47px,color-mix(in srgb,var(--ac) 11%,transparent) 49px,color-mix(in srgb,var(--ac) 34%,transparent) 52px,transparent 58px 104px);filter:blur(9px) drop-shadow(0 0 10px var(--ac)); }\n    .sig-poison { animation:sig-poison 8s ease-in-out infinite alternate; }\n    .sig-poison>.affinity-signature-visual { background:repeating-linear-gradient(96deg,transparent 0 42px,color-mix(in srgb,var(--ac) 18%,transparent) 43px,var(--ac) 45px,transparent 49px 88px);clip-path:polygon(0 12%,100% 0,100% 21%,0 36%,0 55%,100% 38%,100% 58%,0 79%,0 100%,100% 72%,100% 100%,0 100%);filter:blur(2px) drop-shadow(0 0 7px var(--ac)); }\n    .sig-blood { animation:sig-blood 5.8s ease-in-out infinite alternate; }\n    .sig-blood>.affinity-signature-visual { background:repeating-linear-gradient(90deg,transparent 0 38px,color-mix(in srgb,var(--ac) 70%,transparent) 40px,color-mix(in srgb,var(--ac) 18%,transparent) 44px,transparent 49px 77px);clip-path:polygon(0 0,100% 0,100% 20%,92% 20%,90% 76%,86% 24%,75% 18%,72% 55%,67% 22%,58% 16%,55% 69%,51% 21%,37% 16%,35% 48%,29% 23%,17% 17%,13% 62%,9% 20%,0 18%);filter:drop-shadow(0 5px 8px var(--ac)); }\n    .sig-void { animation:sig-void 4.9s step-end infinite; }\n    .sig-void>.affinity-signature-visual { background:repeating-linear-gradient(176deg,transparent 0 47px,color-mix(in srgb,var(--ac) 22%,transparent) 48px,#fff 49px,var(--ac) 50px,transparent 52px 91px);clip-path:polygon(0 7%,100% 0,100% 18%,0 25%,0 45%,100% 35%,100% 52%,0 65%,0 82%,100% 70%,100% 90%,0 100%);filter:drop-shadow(0 0 11px var(--ac)); }\n    .itemx-content { position:relative; z-index:4; padding:1.35em; }\n    .itemx-head { display:flex; align-items:flex-start; gap:.85em; }\n    .itemx-medallion { flex:0 0 auto; width:3.3em; height:3.3em; display:grid; place-items:center; border:1px solid color-mix(in srgb,var(--rk) 38%,transparent); border-radius:50%; background:radial-gradient(circle at 32% 28%,#4a3a20,#201810); box-shadow:0 0 7px color-mix(in srgb,var(--rk) 22%,transparent),inset 0 0 10px color-mix(in srgb,var(--rk) 16%,transparent); }\n    .itemx-emoji { font-size:1.6em; }\n    .itemx-titles { flex:1; min-width:0; }\n    .itemx-eyebrow { color:var(--dim); font-size:.74em; letter-spacing:.2em; }\n    .itemx-name { display:block; margin:.2em 0 .3em; color:#f5efe4; font-size:1.42em; font-weight:800; line-height:1.22; text-shadow:0 1px 2px rgba(0,0,0,.92); }\n    .itemx-tier { display:inline-block; padding:.05em .45em; border:1px solid var(--rk); border-radius:3px; background:var(--rks); color:var(--rk); font-size:.74em; font-weight:700; letter-spacing:.08em; }\n    .itemx-subline { display:flex; margin-top:.18em; color:var(--dim); font-size:.76em; }\n    .itemx-subline span+span::before { content:\"·\"; margin:0 .55em; color:var(--line); }\n    .affinity-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:.75em; }\n    .affinity-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 7px; border:1px solid color-mix(in srgb,var(--chip) 55%,transparent); border-radius:999px; background:color-mix(in srgb,var(--chip) 13%,transparent); color:color-mix(in srgb,var(--chip) 85%,white); font-family:Inter,Pretendard,sans-serif; font-size:10px; font-weight:800; }\n    .affinity-chip small { opacity:.62; font-size:9px; }\n    .reaction-chip { border-color:color-mix(in srgb,var(--p) 48%,var(--s)); background:linear-gradient(100deg,color-mix(in srgb,var(--p) 16%,transparent),color-mix(in srgb,var(--s) 16%,transparent)); color:#f6ebd5; }\n    .itemx-rule { height:1px; margin:1.05em 0; background:linear-gradient(90deg,transparent,var(--p) 18%,var(--s) 82%,transparent); opacity:.8; }\n    .itemx-stats { display:flex; gap:.45em; }\n    .itemx-stat { flex:1; padding:.5em .65em; border-top:1px solid var(--line); background:var(--surf); }\n    .itemx-statk { display:block; color:var(--dim); font-size:.74em; letter-spacing:.1em; }\n    .itemx-statv { display:block; margin-top:.1em; font-weight:700; }\n    .itemx-gap { height:1.1em; }\n    .itemx-section-label { margin-bottom:.5em; color:var(--p); font-size:.74em; font-weight:700; letter-spacing:.14em; }\n    .itemx-effects { display:grid; gap:.7em; }\n    .itemx-effect { position:relative; padding-left:1.1em; }\n    .itemx-effect::before { content:\"❧\"; position:absolute; left:0; color:var(--s); }\n    .itemx-efname { color:var(--p); font-weight:700; }\n    .itemx-flavor { margin:1.1em 0 0; padding-left:.8em; border-left:1px solid var(--s); color:var(--dim); font-size:.93em; font-style:italic; }\n    .motion-off * { animation:none!important; }\n\n    .rarity-normal{--rk:#788396;--rks:rgba(120,131,150,.28);--int:0}.rarity-magic{--rk:#6fa8e8;--rks:rgba(111,168,232,.32);--int:.14}.rarity-rare{--rk:#45c8c0;--rks:rgba(69,200,192,.36);--int:.28}.rarity-unique{--rk:#a888f0;--rks:rgba(168,136,240,.45);--int:.42}.rarity-epic{--rk:#dd7be0;--rks:rgba(221,123,224,.45);--int:.56}.rarity-legendary{--rk:#f0a640;--rks:rgba(240,166,64,.5);--int:.72}.rarity-mythical{--rk:#ff7a7a;--rks:rgba(255,122,122,.5);--int:.86}.rarity-empyrean{--rk:#ffe9a8;--rks:rgba(255,233,168,.55);--int:1}\n    .rarity-epic .itemx-medallion,.rarity-legendary .itemx-medallion,.rarity-mythical .itemx-medallion,.rarity-empyrean .itemx-medallion { border-width:2px; border-color:color-mix(in srgb,var(--rk) 78%,transparent); box-shadow:0 0 14px color-mix(in srgb,var(--rk) 42%,transparent),inset 0 0 12px color-mix(in srgb,var(--rk) 24%,transparent); }\n    .rarity-epic .itemx-name,.rarity-legendary .itemx-name,.rarity-mythical .itemx-name,.rarity-empyrean .itemx-name { color:color-mix(in srgb,var(--rk) 72%,white); text-shadow:0 1px 2px rgba(0,0,0,.92),0 0 7px var(--rks),0 0 15px color-mix(in srgb,var(--rk) 24%,transparent); }\n    .rarity-legendary .itemx-name,.rarity-mythical .itemx-name,.rarity-empyrean .itemx-name { font-weight:900; letter-spacing:.012em; }\n    .rarity-empyrean .itemx-name { text-shadow:0 1px 2px rgba(0,0,0,.92),0 0 8px var(--rks),0 0 18px color-mix(in srgb,var(--rk) 38%,transparent); }\n    .craft-oriental.rarity-epic .itemx-name,.craft-oriental.rarity-legendary .itemx-name,.craft-oriental.rarity-mythical .itemx-name,.craft-oriental.rarity-empyrean .itemx-name{color:color-mix(in srgb,var(--rk) 58%,#f7ecd7);text-shadow:0 1px 2px #000,0 0 8px var(--rks),0 0 15px color-mix(in srgb,var(--rk) 22%,transparent)}\n    .condition-cursed .itemx-cond { background:radial-gradient(85% 50% at 50% 112%,rgba(90,8,30,.55),transparent 68%); mix-blend-mode:multiply; }\n    .condition-blessed .itemx-cond { background:radial-gradient(90% 55% at 50% -12%,rgba(255,240,200,.22),transparent 64%); }\n    .condition-corrupted .itemx-cond { background:radial-gradient(60% 45% at 24% 88%,rgba(140,47,74,.42),transparent 70%),radial-gradient(55% 40% at 78% 20%,rgba(74,30,96,.40),transparent 72%); filter:blur(14px); }\n\n    @keyframes existing-spin { to { transform:rotate(360deg); } }\n    @keyframes existing-veil { 0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(34%);opacity:1} }\n    @keyframes existing-rise { 0%{transform:translate3d(0,0,0) rotate(0);opacity:0}8%{opacity:var(--o)}92%{opacity:var(--o)}100%{transform:translate3d(var(--drift),-520px,0) rotate(220deg);opacity:0} }\n    @keyframes existing-drift { 0%{transform:translate(0,0);opacity:0}12%{opacity:var(--o)}55%{transform:translate(var(--drift),-230px) rotate(90deg)}100%{transform:translate(0,-520px) rotate(180deg);opacity:0} }\n    @keyframes existing-pulse { 0%,100%{transform:translateY(-160px) scale(.2);opacity:0}40%{transform:translate(var(--drift),-180px) scale(1);opacity:var(--o)}70%{transform:translateY(-200px) scale(.5);opacity:.2} }\n    @keyframes existing-sway { 0%{transform:translate(0,0);opacity:0}15%{opacity:var(--o)}35%{transform:translate(var(--drift),-160px) rotate(40deg)}65%{transform:translate(var(--drift2),-310px) rotate(-25deg)}100%{transform:translate(0,-520px) rotate(80deg);opacity:0} }\n    @keyframes existing-turn { 0%{transform:translateY(0) rotate(0);opacity:0}12%{opacity:var(--o)}100%{transform:translate(var(--drift),-520px) rotate(1080deg);opacity:0} }\n    @keyframes existing-jitter { 0%,100%{transform:translate(0,0);opacity:0}10%,25%,48%,73%{opacity:var(--o)}18%{transform:translate(18px,-100px)}39%{transform:translate(-24px,-210px)}62%{transform:translate(28px,-330px)}90%{transform:translate(-8px,-490px);opacity:0} }\n    @keyframes existing-fog { from{transform:translate(-4%,4%) scale(1);opacity:.45}to{transform:translate(6%,-3%) scale(1.18);opacity:.85} }\n    @keyframes existing-scan { from{transform:translateY(0);opacity:0}12%,88%{opacity:.9}to{transform:translateY(330%);opacity:0} }\n    @keyframes aff-fire { 0%{transform:translate3d(0,0,0) skewX(var(--sk)) scaleY(.5);opacity:0}15%{opacity:.9}100%{transform:translate3d(var(--drift),-300px,0) skewX(var(--sk)) scaleY(1.5);opacity:0} }\n    @keyframes aff-ice { 0%{transform:translate3d(0,-34px,0) rotate(-18deg);opacity:0}12%{opacity:.88}72%{opacity:.72}100%{transform:translate3d(var(--drift),130px,0) rotate(48deg);opacity:0} }\n    @keyframes aff-lightning { 0%,84%,89%,100%{opacity:0}85%,87%{opacity:1}86%,88%{opacity:.28} }\n    @keyframes aff-wind { 0%{transform:translateX(0) skewX(-24deg);opacity:0}25%{opacity:.75}100%{transform:translateX(620px) skewX(-24deg);opacity:0} }\n    @keyframes aff-earth { 0%{transform:translateY(0) rotate(0);opacity:0}18%{opacity:.75}100%{transform:translateY(-190px) rotate(150deg);opacity:0} }\n    @keyframes aff-light { from{transform:translateX(-12px) skewX(-18deg);opacity:.12}to{transform:translateX(16px) skewX(-18deg);opacity:.52} }\n    @keyframes aff-dark { from{transform:translateY(12%) skewX(-5deg);opacity:.18}to{transform:translateY(-7%) skewX(7deg);opacity:.58} }\n    @keyframes aff-poison { 0%,100%{transform:translate(0,4px) rotate(-8deg);opacity:.2}50%{transform:translate(8px,-10px) rotate(12deg);opacity:.8} }\n    @keyframes aff-blood { 0%{transform:translateY(-28%);opacity:0}18%{opacity:.72}100%{transform:translateY(135%);opacity:0} }\n    @keyframes aff-void { 0%,72%,80%,100%{opacity:0;transform:translateX(-8px) rotate(var(--r)) skewX(-34deg)}73%,76%{opacity:.9;transform:translateX(6px) rotate(var(--r)) skewX(-34deg)}77%{opacity:.2} }\n    @keyframes sig-fire { from{transform:translateY(0);opacity:.38}to{transform:translateY(-38px);opacity:.78} }\n    @keyframes ice-cracks { 0%,69%,78%,100%{opacity:0}70%,75%{opacity:.75}72%{opacity:.25} }\n    @keyframes sig-lightning { 0%,78%,85%,100%{opacity:0}79%,81%,84%{opacity:.9}80%,82%{opacity:.24} }\n    @keyframes lightning-field { 0%,68%,76%,100%{opacity:0}69%,71%,74%{opacity:.86}70%,72%,75%{opacity:.18} }\n    @keyframes sig-wind { to{transform:translateX(28%)} }\n    @keyframes sig-earth { from{transform:translate(-2%,2%);opacity:.3}to{transform:translate(2%,-2%);opacity:.72} }\n    @keyframes sig-light { from{transform:translateX(-5%);opacity:.36}to{transform:translateX(6%);opacity:.82} }\n    @keyframes sig-dark { from{transform:translateX(-4%) skewX(-3deg);opacity:.32}to{transform:translateX(5%) skewX(3deg);opacity:.7} }\n    @keyframes sig-poison { from{transform:translateX(-4%);opacity:.34}to{transform:translateX(5%);opacity:.72} }\n    @keyframes sig-blood { from{transform:translateY(-6%);opacity:.42}to{transform:translateY(7%);opacity:.82} }\n    @keyframes sig-void { 0%,66%,75%,100%{opacity:.16;transform:translateX(-2%)}67%,70%,74%{opacity:.88;transform:translateX(2%)}71%{opacity:.3;transform:translateX(-1%)} }\n    @media (prefers-reduced-motion:reduce) { .itemx-card:not(.force-motion) * { animation:none!important; } }\n    @media (max-width:620px) { .stage{padding:12px 8px 40px}.risu-topbar{padding:0 12px}.lab-grid{grid-template-columns:1fr 1fr}.itemx-grid{grid-template-columns:1fr}.itemx-panel{border-radius:12px}.demo-note{align-items:flex-start}.itemx-card{font-size:.86rem}.itemx-content{padding:1.05em} }";
const ITEMX_CHAT_STYLE = "    .itemx-panel { display: flex; flex-direction: column; width: min(560px,100%); margin: 0 auto; overflow: hidden; border: 1px solid #232c3d; border-radius: 14px; background: #0a0d14; color: #e6ebf4; font-size: .9rem; box-shadow: 0 24px 70px rgba(0,0,0,.48); }\n    .itemx-ph { display: flex; align-items: center; gap: .45em; padding: 1em 1.05em .85em; border-bottom: 1px solid rgba(212,175,110,.14); background: radial-gradient(120% 150% at 18% -40%,rgba(212,175,110,.10),transparent 55%),linear-gradient(180deg,#131a28,#0c1019); }\n    .itemx-ph-text { display: flex; flex: 1; flex-direction: column; gap: .15em; min-width: 0; }\n    .itemx-ph-eyebrow { color: #b39355; font-size: .6rem; font-weight: 700; letter-spacing: .3em; }\n    .itemx-ph-title { color: #f4f0e6; font-size: 1.12rem; font-weight: 800; }\n    .itemx-ph-sub { color: #77839c; font-size: .72rem; }\n    .itemx-ph-btn { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.06); border-radius: 10px; background: rgba(255,255,255,.03); color: #8b99b2; }\n    .itemx-seg { display: flex; gap: .15em; margin: .35em 1.05em 0; overflow-x: auto; border-bottom: 1px solid #171d2b; scrollbar-width: none; }\n    .itemx-seg-i { flex: 0 0 auto; min-height: 38px; display: inline-flex; align-items: center; gap: .32em; padding: 0 .6em; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #6e7b93; font-size: .78rem; cursor: pointer; }\n    .itemx-seg-on { border-bottom-color: #d4af6e; color: #f2ead9; font-weight: 700; }\n    .itemx-seg-n { opacity: .65; font-size: .92em; }\n    .itemx-tools { display: flex; gap: .4em; margin: .6em 1.05em 0; }\n    .itemx-tool,.itemx-search { min-height: 34px; display: inline-flex; align-items: center; padding: 0 .7em; border: 1px solid rgba(255,255,255,.06); border-radius: 9px; background: rgba(255,255,255,.025); color: #93a2ba; font-size: .76rem; }\n    .itemx-search { flex: 1; color: #64718c; }\n    .itemx-body { padding: .75em 1.05em .95em; }\n    .itemx-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .55em; }\n    .itemx-tile { --rk:#8b94a6; --rks:rgba(139,148,166,.38); position: relative; display: grid; grid-template-columns: 2.4em minmax(0,1fr); grid-template-rows: 1fr auto; gap: .15em .6em; height: 82px; padding: .6em .7em .55em .85em; overflow: hidden; border: 1px solid #1c2331; border-radius: 13px; background: linear-gradient(160deg,#121826,#0d111b 78%); text-align: left; cursor: pointer; }\n    .itemx-tile:hover,.itemx-tile:focus-visible { border-color: var(--p,#d4af6e); outline: none; background: #141d2c; }\n    .itemx-tile-bar { position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--rk); }\n    .itemx-tile-eq { position: absolute; top: 0; right: 0; border-top: 16px solid #ffd479; border-left: 16px solid transparent; opacity: .85; }\n    .itemx-tile-em { grid-row: 1/span 2; align-self: center; width: 2.55em; height: 2.55em; display: grid; place-items: center; border: 1px solid var(--rks); border-radius: 11px; background: radial-gradient(85% 85% at 50% 28%,var(--rks),transparent 80%); font-size: 1.1em; }\n    .itemx-tile-nm { align-self: center; overflow: hidden; color: #edf2fb; font-size: .85rem; font-weight: 700; line-height: 1.32; }\n    .itemx-tile-meta { display: flex; justify-content: space-between; gap: .5em; align-self: end; }\n    .itemx-tile-rk { color: var(--rk); font-size: .7rem; font-weight: 700; }\n    .itemx-tile-lc { color: #67748c; font-size: .7rem; }\n    .itemx-tile-aff { position:absolute; right:8px; top:7px; display:flex; gap:2px; font-size:9px; filter:drop-shadow(0 0 4px rgba(0,0,0,.8)); }\n    .itemx-pf { padding: .68em 1.1em; border-top: 1px solid #171d2b; color: #59657a; font-size: .7rem; text-align: right; }\n\n    /* Off-screen cards keep their effects and DOM, while the browser may skip\n       their layout and paint work until they approach the viewport. */\n    .itemx-card { content-visibility:auto; contain:layout paint style; contain-intrinsic-size:auto 520px; }\n\n    /* Detail card keeps ITEMX's real visual contract. Current theme effects and\n       the proposed affinity effects are deliberately separate layers. */\n    .itemx-back { display: inline-block; margin-bottom: .7em; border: 0; background: transparent; color: #9eabbf; font-size: .78rem; cursor: pointer; }\n    .itemx-detail { display: flex; justify-content: center; }\n    .itemx-card { --bg:#1c1610; --surf:rgba(92,74,46,.18); --fg:#e8dcc2; --dim:#a89372; --line:#5c4a2e; --p:#ff7a3d; --pg:rgba(255,122,61,.42); --s:#86e5c4; --sg:rgba(134,229,196,.34); --rk:#f0a640; --rks:rgba(240,166,64,.5); --int:.72; --spd:1.25; position: relative; width: min(360px,100%); overflow: hidden; isolation: isolate; border: 1px solid var(--line); border-radius: 3px; background: repeating-linear-gradient(102deg,rgba(255,235,190,.028) 0 2px,transparent 2px 7px),repeating-linear-gradient(11deg,rgba(0,0,0,.14) 0 3px,transparent 3px 9px),radial-gradient(120% 80% at 50% -10%,#2b2117,#17120c 70%); color: var(--fg); font-family: \"Nanum Myeongjo\",\"Noto Serif KR\",Georgia,serif; font-size: .92rem; line-height: 1.62; box-shadow: inset 0 0 60px rgba(0,0,0,.55),0 0 calc(30px*var(--int)) var(--pg); }\n    .craft-forged { --surf:rgba(74,60,45,.26);--fg:#f0e7dc;--dim:#b3a08c;--line:#4a3c2d;border-width:2px;border-radius:2px;background:repeating-linear-gradient(-14deg,rgba(255,255,255,.022) 0 2px,transparent 2px 11px),linear-gradient(168deg,#221d19,#0d0c0b 74%);font-family:Inter,Pretendard,sans-serif; }\n    .craft-oriental { --surf:rgba(215,192,146,.075);--fg:#eee8dd;--dim:#aaa194;--line:#59482e;border-radius:2px;background:radial-gradient(100% 62% at 88% 0,rgba(135,89,35,.15),transparent 62%),repeating-linear-gradient(93deg,rgba(235,214,173,.018) 0 1px,transparent 1px 5px),repeating-linear-gradient(4deg,rgba(235,214,173,.014) 0 1px,transparent 1px 7px),linear-gradient(150deg,#191815,#0d1011 52%,#17130f);color:var(--fg);box-shadow:inset 0 0 0 1px #151717,inset 0 0 52px rgba(0,0,0,.48),0 0 calc(24px*var(--int)) var(--pg); }\n    .craft-clockwork { --surf:rgba(107,81,44,.2);--fg:#e3d5b8;--dim:#9d8a68;--line:#6b512c;border-width:2px;border-radius:4px;background:repeating-linear-gradient(88deg,rgba(255,220,160,.035) 0 1px,transparent 1px 3px),linear-gradient(160deg,#241d15,#14100b 72%);font-family:ui-monospace,monospace; }\n    .craft-synthetic { --surf:rgba(31,53,70,.35);--fg:#d6e6ef;--dim:#6d8496;--line:#1f3546;border-radius:0;background:repeating-linear-gradient(0deg,rgba(120,220,255,.045) 0 1px,transparent 1px 4px),linear-gradient(150deg,#0d1420,#070a11 70%);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% calc(100% - 24px),calc(100% - 24px) 100%,12px 100%,0 calc(100% - 12px));font-family:ui-monospace,monospace; }\n    .craft-celestial { --surf:rgba(45,61,117,.28);--fg:#dfe7ff;--dim:#8e9ccb;--line:#2d3d75;border-radius:3px 3px 22px 22px;background:radial-gradient(90% 60% at 50% -8%,rgba(255,217,138,.16),transparent 62%),radial-gradient(120% 100% at 50% 110%,#14204a,transparent 60%),linear-gradient(180deg,#070b1c,#050813); }\n    .craft-organic { --surf:rgba(44,74,51,.3);--fg:#dcecd8;--dim:#86a78d;--line:#2c4a33;border-radius:22px 4px 22px 4px;background:radial-gradient(100% 70% at 22% -6%,rgba(127,224,161,.1),transparent 60%),radial-gradient(120% 90% at 80% 110%,rgba(30,90,60,.5),transparent 62%),linear-gradient(170deg,#0d1b12,#071008);font-family:Inter,Pretendard,sans-serif; }\n    .craft-forged .itemx-medallion,.craft-oriental .itemx-medallion{border-radius:3px}.craft-synthetic .itemx-medallion{border-radius:0;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))}.craft-organic .itemx-medallion{border-radius:60% 12% 60% 12%}.craft-celestial .itemx-medallion{border-radius:50%}.craft-oriental .itemx-name{color:#f2eadb;text-shadow:0 1px 2px #000,0 0 7px rgba(232,210,170,.16)}.craft-oriental .itemx-badge,.craft-oriental .itemx-subline{color:#aaa194}.craft-oriental .itemx-eyebrow{color:#bb9659;letter-spacing:.2em}.craft-oriental .itemx-head{padding-right:2.55em}.craft-oriental .itemx-effect,.craft-oriental .itemx-stat{background:rgba(7,9,9,.38)}\n    .itemx-oriental-paper,.itemx-oriental-ink,.itemx-oriental-frame,.itemx-oriental-seal{display:none;position:absolute;pointer-events:none}\n    .craft-oriental .itemx-oriental-paper{display:block;inset:0;z-index:0;opacity:.32;background:repeating-linear-gradient(92deg,transparent 0 8px,rgba(224,200,154,.025) 9px,transparent 10px 17px),repeating-linear-gradient(4deg,transparent 0 10px,rgba(224,200,154,.018) 11px,transparent 12px 20px)}\n    .craft-oriental .itemx-oriental-ink{display:block;z-index:1;border:1px solid rgba(216,193,148,.08);border-radius:50%;filter:blur(1px);opacity:.7}\n    .craft-oriental .itemx-oriental-ink-a{width:78%;height:44%;right:-35%;top:7%;transform:rotate(-12deg);box-shadow:0 0 22px rgba(178,126,60,.05)}\n    .craft-oriental .itemx-oriental-ink-b{width:64%;height:36%;left:-34%;bottom:4%;transform:rotate(16deg);border-color:rgba(146,42,47,.09)}\n    .craft-oriental .itemx-oriental-frame{display:block;inset:10px;z-index:5;border:1px solid rgba(210,178,111,.18);box-shadow:inset 0 0 18px rgba(0,0,0,.18)}\n    .craft-oriental .itemx-oriental-frame::before,.craft-oriental .itemx-oriental-frame::after{content:\"\";position:absolute;width:18px;height:18px;border-color:rgba(229,195,125,.55);border-style:solid}\n    .craft-oriental .itemx-oriental-frame::before{left:-4px;top:-4px;border-width:2px 0 0 2px}\n    .craft-oriental .itemx-oriental-frame::after{right:-4px;bottom:-4px;border-width:0 2px 2px 0}\n    .craft-oriental .itemx-oriental-seal{display:grid;place-items:center;right:16px;top:18px;z-index:6;width:31px;height:38px;border:1px solid rgba(214,82,73,.66);background:rgba(116,20,25,.38);color:#e09186;font-size:.62em;font-weight:800;line-height:1.05;text-align:center;box-shadow:inset 0 0 0 2px rgba(18,8,8,.36),0 0 9px rgba(175,34,40,.16);transform:rotate(2deg)}\n    .itemx-card::before { content:\"\"; position:absolute; inset:0 0 auto; z-index:6; height:2px; background:linear-gradient(90deg,transparent,var(--rk) 18%,var(--rk) 82%,transparent); opacity:.85; }\n    .itemx-fx,.itemx-cond { position:absolute; inset:0; pointer-events:none; overflow:hidden; }\n    .itemx-fx { z-index:1; }\n    .itemx-cond { z-index:2; }\n    .craft-oriental .itemx-fx{z-index:2}.craft-oriental .current-fx{opacity:.42}.craft-oriental .current-fog{opacity:.28}.craft-oriental .current-veil,.craft-oriental .current-rays{opacity:.44}.craft-oriental .affinity-fx{z-index:3;filter:saturate(1.2) brightness(1.16)}\n    /* Existing ITEMX effects: arcane gold rays and deterministic gold shards. */\n    .current-fx,.affinity-fx { position:absolute; inset:0; overflow:hidden; }\n    .current-rays { position:absolute; inset:-75%; opacity:calc(.12 * var(--int)); filter:blur(9px); animation:existing-spin calc(96s/var(--spd)) linear infinite; }\n    .current-rays i { position:absolute; top:50%; left:50%; width:var(--w); height:100%; transform:translateX(-50%) translateY(-100%) rotate(var(--r)); transform-origin:center bottom; border-radius:80% 80% 0 0; background:linear-gradient(to top,var(--p),transparent 49%); }\n    .current-veil { position:absolute; top:-55%; right:0; left:0; height:85%; animation:existing-veil calc(8.5s/var(--spd)) ease-in-out infinite; }\n    .current-veil-visual { position:absolute;inset:0;display:block;background:linear-gradient(to bottom,transparent,var(--pg),transparent);filter:blur(15px); }\n    .craft-mote { position:absolute; left:var(--x); top:108%; width:var(--z); height:var(--mh); border-radius:42% 42% 56% 56%/62% 62% 38% 38%; background:linear-gradient(to top,var(--ca),transparent); box-shadow:0 0 6px var(--ca); opacity:var(--o); animation:existing-rise var(--d) linear infinite; animation-delay:var(--delay); }\n    .craft-mote.diamond { height:var(--z); border-radius:0; background:linear-gradient(135deg,var(--ca),var(--cb)); transform:rotate(45deg); }\n    .craft-mote.shape-ash { height:var(--z);border-radius:62% 38% 55% 45%;background:radial-gradient(circle at 38% 34%,var(--ca),var(--cb) 72%,transparent); }\n    .craft-mote.shape-petal { height:var(--mh);border-radius:100% 6% 100% 6%;background:linear-gradient(140deg,var(--ca),var(--cb)); }\n    .craft-mote.shape-block { height:var(--z);border-radius:0;background:var(--ca);box-shadow:1px 0 0 var(--cb); }\n    .craft-mote.shape-streak { width:2px;height:var(--mh);border-radius:2px;background:linear-gradient(to top,transparent,var(--ca) 45%,transparent); }\n    .craft-mote.shape-cross { height:var(--z);border-radius:0;background:linear-gradient(90deg,transparent,var(--ca),transparent); }\n    .craft-mote.shape-cross::after { content:\"\";position:absolute;inset:-70% 42%;background:linear-gradient(to bottom,transparent,var(--cb),transparent); }\n    .craft-mote.shape-gear { height:var(--z);border-radius:0;background:none;box-shadow:none;color:var(--ca);font-size:var(--mh);line-height:1; }\n    .craft-mote.shape-gear::before { content:\"⚙\";position:absolute;inset:0; }\n    .path-drift{animation-name:existing-drift}.path-pulse{animation-name:existing-pulse}.path-sway{animation-name:existing-sway}.path-turn{animation-name:existing-turn}.path-jitter{animation-name:existing-jitter}\n    .current-fog { position:absolute;right:-20%;bottom:-35%;left:-20%;height:85%;animation:existing-fog 17s ease-in-out infinite alternate; }\n    .current-fog-visual { position:absolute;inset:0;display:block;background:radial-gradient(60% 60% at 30% 70%,var(--pg),transparent 70%),radial-gradient(55% 55% at 75% 60%,var(--pg),transparent 72%);filter:blur(22px); }\n    .current-scan { position:absolute;top:-30%;right:0;left:0;height:42%;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.13),transparent);animation:existing-scan 5.5s linear infinite; }\n\n    /* Proposed affinity layer. No circular pulse or generic coloured wash. */\n    .affinity-fx { z-index:2; }\n    .afx { position:absolute; inset:0; opacity:1; filter:saturate(1.22) brightness(1.12); }\n    .afx-secondary { opacity:.68; clip-path:inset(0 0 0 46%); }\n    .afx i { position:absolute; display:block; color:var(--ac); }\n    .afx-fire i { left:var(--x); bottom:-12px; width:3px; height:var(--h); border-radius:60% 60% 30% 30%; background:linear-gradient(to top,transparent,var(--ac) 50%,#ffe2a6); box-shadow:0 0 7px var(--ac); transform:skewX(var(--sk)); animation:aff-fire var(--d) ease-out infinite; animation-delay:var(--delay); }\n    .afx-ice i { left:var(--x); top:var(--y); width:var(--iw); height:var(--ih); background:linear-gradient(160deg,#fff 0 12%,#dff8ff 24%,var(--ac) 62%,transparent); clip-path:polygon(50% 0,82% 38%,66% 100%,29% 82%,12% 35%); filter:drop-shadow(0 0 3px #dff8ff) drop-shadow(0 0 6px var(--ac)); animation:aff-ice var(--d) linear infinite; animation-delay:var(--delay); }\n    .afx-lightning b { position:absolute; width:94px; height:7px; background:linear-gradient(90deg,transparent,var(--ac),#fff 48%,var(--ac),transparent); clip-path:polygon(0 38%,35% 18%,40% 60%,66% 5%,62% 48%,100% 28%,100% 65%,61% 78%,56% 45%,42% 100%,34% 58%,0 76%); filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 10px var(--ac)); opacity:0; animation:aff-lightning var(--d) step-end infinite; animation-delay:var(--delay); transform:rotate(var(--r)); }\n    .afx-wind i { left:-24%; top:var(--y); width:52%; height:1px; background:linear-gradient(90deg,transparent,var(--ac) 36%,transparent); box-shadow:0 0 5px var(--ac); transform:skewX(-24deg); animation:aff-wind var(--d) ease-in-out infinite; animation-delay:var(--delay); }\n    .afx-earth i { left:var(--x); bottom:-6px; width:var(--z); height:var(--z); background:linear-gradient(145deg,#f2cf8a,var(--ac) 52%,#4b3219); clip-path:polygon(16% 4%,92% 18%,75% 92%,8% 70%); filter:drop-shadow(0 0 3px var(--ac)); animation:aff-earth var(--d) ease-out infinite; animation-delay:var(--delay); }\n    .afx-light i { left:var(--x); top:-20%; width:var(--z); height:135%; transform:skewX(-18deg); background:linear-gradient(to bottom,transparent,var(--ac) 38%,transparent 72%); filter:blur(2px); animation:aff-light var(--d) ease-in-out infinite alternate; animation-delay:var(--delay); }\n    .afx-dark i { left:var(--x); top:var(--y); width:var(--z); height:var(--h); background:linear-gradient(to bottom,transparent,var(--ac),transparent); transform:skewX(var(--sk)); filter:blur(4px); animation:aff-dark var(--d) ease-in-out infinite alternate; animation-delay:var(--delay); }\n    .afx-poison i { left:var(--x); top:var(--y); width:var(--z); height:var(--ph); border-radius:65% 35% 60% 40%; background:linear-gradient(145deg,#eaff9a,var(--ac) 58%,transparent); box-shadow:0 0 6px var(--ac); animation:aff-poison var(--d) ease-in-out infinite; animation-delay:var(--delay); }\n    .afx-blood i { left:var(--x); top:-15%; width:var(--z); height:var(--h); border-radius:0 0 70% 30%; background:linear-gradient(to bottom,var(--ac),transparent); box-shadow:0 4px 7px var(--ac); animation:aff-blood var(--d) ease-in infinite; animation-delay:var(--delay); }\n    .afx-void i { left:var(--x); top:var(--y); width:var(--z); height:2px; transform:rotate(var(--r)) skewX(-34deg); background:linear-gradient(90deg,transparent,#fff 16%,var(--ac) 48%,transparent); box-shadow:0 0 5px var(--ac),0 0 12px var(--ac); animation:aff-void var(--d) step-end infinite; animation-delay:var(--delay); }\n    /* A second, broad signature per affinity. Particles provide detail; these\n       edge traces make the affinity readable before the viewer studies them. */\n    .affinity-signature { position:absolute; inset:0; color:var(--ac); pointer-events:none; mix-blend-mode:screen; opacity:.76; }\n    .affinity-signature-visual { position:absolute;inset:0;display:block; }\n    .affinity-signature.secondary { opacity:.48; clip-path:inset(0 0 0 48%); }\n    .sig-fire { animation:sig-fire 5.2s linear infinite; }\n    .sig-fire>.affinity-signature-visual { background:repeating-linear-gradient(0deg,transparent 0 36px,color-mix(in srgb,var(--ac) 12%,transparent) 38px,color-mix(in srgb,var(--ac) 38%,transparent) 39px,transparent 42px 76px);filter:blur(2px) drop-shadow(0 0 7px var(--ac)); }\n    .ice-cracks { position:absolute; inset:0; background:linear-gradient(32deg,transparent 0 31%,color-mix(in srgb,var(--ac) 62%,#fff) 31.4%,transparent 32% 100%),linear-gradient(147deg,transparent 0 67%,color-mix(in srgb,var(--ac) 45%,#fff) 67.4%,transparent 68% 100%),linear-gradient(81deg,transparent 0 78%,var(--ac) 78.3%,transparent 78.8% 100%); clip-path:polygon(0 0,17% 0,32% 38%,51% 21%,66% 54%,100% 39%,100% 52%,69% 65%,53% 34%,34% 53%,12% 18%,0 22%); filter:drop-shadow(0 0 4px var(--ac)); opacity:0; animation:ice-cracks 5.6s step-end infinite; }\n    .sig-lightning { background:linear-gradient(112deg,transparent 0 42%,color-mix(in srgb,var(--ac) 68%,transparent) 43%,#fff 44%,var(--ac) 45%,transparent 47% 100%); clip-path:polygon(0 9%,44% 9%,36% 37%,70% 31%,58% 61%,100% 56%,100% 68%,48% 75%,57% 46%,24% 51%,35% 22%,0 26%); filter:drop-shadow(0 0 7px #fff) drop-shadow(0 0 14px var(--ac)); opacity:0; animation:sig-lightning 3.2s step-end infinite; }\n    .lightning-field { position:absolute; inset:0; opacity:0; background:linear-gradient(28deg,transparent 0 22%,var(--ac) 22.5%,transparent 23.2% 100%),linear-gradient(151deg,transparent 0 58%,#fff 58.4%,var(--ac) 59%,transparent 59.8% 100%),linear-gradient(74deg,transparent 0 71%,var(--ac) 71.5%,transparent 72.3% 100%); clip-path:polygon(0 4%,100% 0,100% 17%,0 28%,0 42%,100% 31%,100% 51%,0 64%,0 79%,100% 69%,100% 88%,0 100%); box-shadow:inset 8px 0 16px color-mix(in srgb,var(--ac) 55%,transparent),inset -8px 0 16px color-mix(in srgb,var(--ac) 55%,transparent); filter:drop-shadow(0 0 8px var(--ac)); animation:lightning-field 2.35s step-end infinite; }\n    .sig-wind { transform:translateX(-26%);animation:sig-wind 6.4s linear infinite; }\n    .sig-wind>.affinity-signature-visual { background:repeating-linear-gradient(164deg,transparent 0 34px,color-mix(in srgb,var(--ac) 45%,transparent) 35px,color-mix(in srgb,var(--ac) 15%,transparent) 37px,transparent 40px 69px);filter:drop-shadow(5px 0 7px var(--ac)); }\n    .sig-earth { animation:sig-earth 6s ease-in-out infinite alternate; }\n    .sig-earth>.affinity-signature-visual { background:linear-gradient(32deg,transparent 0 18%,color-mix(in srgb,var(--ac) 42%,transparent) 18.5%,transparent 19.4% 47%,color-mix(in srgb,var(--ac) 30%,transparent) 47.5%,transparent 48.4% 100%),linear-gradient(146deg,transparent 0 67%,color-mix(in srgb,var(--ac) 46%,transparent) 67.5%,transparent 68.4%);filter:drop-shadow(0 0 5px var(--ac)); }\n    .sig-light { animation:sig-light 7s ease-in-out infinite alternate; }\n    .sig-light>.affinity-signature-visual { background:repeating-linear-gradient(112deg,transparent 0 54px,color-mix(in srgb,var(--ac) 32%,transparent) 55px,color-mix(in srgb,var(--ac) 8%,transparent) 68px,transparent 80px 122px);filter:blur(3px) drop-shadow(0 0 9px var(--ac)); }\n    .sig-dark { animation:sig-dark 7.5s ease-in-out infinite alternate; }\n    .sig-dark>.affinity-signature-visual { background:repeating-linear-gradient(106deg,transparent 0 47px,color-mix(in srgb,var(--ac) 11%,transparent) 49px,color-mix(in srgb,var(--ac) 34%,transparent) 52px,transparent 58px 104px);filter:blur(9px) drop-shadow(0 0 10px var(--ac)); }\n    .sig-poison { animation:sig-poison 8s ease-in-out infinite alternate; }\n    .sig-poison>.affinity-signature-visual { background:repeating-linear-gradient(96deg,transparent 0 42px,color-mix(in srgb,var(--ac) 18%,transparent) 43px,var(--ac) 45px,transparent 49px 88px);clip-path:polygon(0 12%,100% 0,100% 21%,0 36%,0 55%,100% 38%,100% 58%,0 79%,0 100%,100% 72%,100% 100%,0 100%);filter:blur(2px) drop-shadow(0 0 7px var(--ac)); }\n    .sig-blood { animation:sig-blood 5.8s ease-in-out infinite alternate; }\n    .sig-blood>.affinity-signature-visual { background:repeating-linear-gradient(90deg,transparent 0 38px,color-mix(in srgb,var(--ac) 70%,transparent) 40px,color-mix(in srgb,var(--ac) 18%,transparent) 44px,transparent 49px 77px);clip-path:polygon(0 0,100% 0,100% 20%,92% 20%,90% 76%,86% 24%,75% 18%,72% 55%,67% 22%,58% 16%,55% 69%,51% 21%,37% 16%,35% 48%,29% 23%,17% 17%,13% 62%,9% 20%,0 18%);filter:drop-shadow(0 5px 8px var(--ac)); }\n    .sig-void { animation:sig-void 4.9s step-end infinite; }\n    .sig-void>.affinity-signature-visual { background:repeating-linear-gradient(176deg,transparent 0 47px,color-mix(in srgb,var(--ac) 22%,transparent) 48px,#fff 49px,var(--ac) 50px,transparent 52px 91px);clip-path:polygon(0 7%,100% 0,100% 18%,0 25%,0 45%,100% 35%,100% 52%,0 65%,0 82%,100% 70%,100% 90%,0 100%);filter:drop-shadow(0 0 11px var(--ac)); }\n    .itemx-content { position:relative; z-index:4; padding:1.35em; }\n    .itemx-head { display:flex; align-items:flex-start; gap:.85em; }\n    .itemx-medallion { flex:0 0 auto; width:3.3em; height:3.3em; display:grid; place-items:center; border:1px solid color-mix(in srgb,var(--rk) 38%,transparent); border-radius:50%; background:radial-gradient(circle at 32% 28%,#4a3a20,#201810); box-shadow:0 0 7px color-mix(in srgb,var(--rk) 22%,transparent),inset 0 0 10px color-mix(in srgb,var(--rk) 16%,transparent); }\n    .itemx-emoji { font-size:1.6em; }\n    .itemx-titles { flex:1; min-width:0; }\n    .itemx-eyebrow { color:var(--dim); font-size:.74em; letter-spacing:.2em; }\n    .itemx-name { display:block; margin:.2em 0 .3em; color:#f5efe4; font-size:1.42em; font-weight:800; line-height:1.22; text-shadow:0 1px 2px rgba(0,0,0,.92); }\n    .itemx-tier { display:inline-block; padding:.05em .45em; border:1px solid var(--rk); border-radius:3px; background:var(--rks); color:var(--rk); font-size:.74em; font-weight:700; letter-spacing:.08em; }\n    .itemx-subline { display:flex; margin-top:.18em; color:var(--dim); font-size:.76em; }\n    .itemx-subline span+span::before { content:\"·\"; margin:0 .55em; color:var(--line); }\n    .affinity-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:.75em; }\n    .affinity-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 7px; border:1px solid color-mix(in srgb,var(--chip) 55%,transparent); border-radius:999px; background:color-mix(in srgb,var(--chip) 13%,transparent); color:color-mix(in srgb,var(--chip) 85%,white); font-family:Inter,Pretendard,sans-serif; font-size:10px; font-weight:800; }\n    .affinity-chip small { opacity:.62; font-size:9px; }\n    .reaction-chip { border-color:color-mix(in srgb,var(--p) 48%,var(--s)); background:linear-gradient(100deg,color-mix(in srgb,var(--p) 16%,transparent),color-mix(in srgb,var(--s) 16%,transparent)); color:#f6ebd5; }\n    .itemx-rule { height:1px; margin:1.05em 0; background:linear-gradient(90deg,transparent,var(--p) 18%,var(--s) 82%,transparent); opacity:.8; }\n    .itemx-stats { display:flex; gap:.45em; }\n    .itemx-stat { flex:1; padding:.5em .65em; border-top:1px solid var(--line); background:var(--surf); }\n    .itemx-statk { display:block; color:var(--dim); font-size:.74em; letter-spacing:.1em; }\n    .itemx-statv { display:block; margin-top:.1em; font-weight:700; }\n    .itemx-gap { height:1.1em; }\n    .itemx-section-label { margin-bottom:.5em; color:var(--p); font-size:.74em; font-weight:700; letter-spacing:.14em; }\n    .itemx-effects { display:grid; gap:.7em; }\n    .itemx-effect { position:relative; padding-left:1.1em; }\n    .itemx-effect::before { content:\"❧\"; position:absolute; left:0; color:var(--s); }\n    .itemx-efname { color:var(--p); font-weight:700; }\n    .itemx-flavor { margin:1.1em 0 0; padding-left:.8em; border-left:1px solid var(--s); color:var(--dim); font-size:.93em; font-style:italic; }\n    .motion-off * { animation:none!important; }\n\n    .rarity-normal{--rk:#788396;--rks:rgba(120,131,150,.28);--int:0}.rarity-magic{--rk:#6fa8e8;--rks:rgba(111,168,232,.32);--int:.14}.rarity-rare{--rk:#45c8c0;--rks:rgba(69,200,192,.36);--int:.28}.rarity-unique{--rk:#a888f0;--rks:rgba(168,136,240,.45);--int:.42}.rarity-epic{--rk:#dd7be0;--rks:rgba(221,123,224,.45);--int:.56}.rarity-legendary{--rk:#f0a640;--rks:rgba(240,166,64,.5);--int:.72}.rarity-mythical{--rk:#ff7a7a;--rks:rgba(255,122,122,.5);--int:.86}.rarity-empyrean{--rk:#ffe9a8;--rks:rgba(255,233,168,.55);--int:1}\n    .rarity-epic .itemx-medallion,.rarity-legendary .itemx-medallion,.rarity-mythical .itemx-medallion,.rarity-empyrean .itemx-medallion { border-width:2px; border-color:color-mix(in srgb,var(--rk) 78%,transparent); box-shadow:0 0 14px color-mix(in srgb,var(--rk) 42%,transparent),inset 0 0 12px color-mix(in srgb,var(--rk) 24%,transparent); }\n    .rarity-epic .itemx-name,.rarity-legendary .itemx-name,.rarity-mythical .itemx-name,.rarity-empyrean .itemx-name { color:color-mix(in srgb,var(--rk) 72%,white); text-shadow:0 1px 2px rgba(0,0,0,.92),0 0 7px var(--rks),0 0 15px color-mix(in srgb,var(--rk) 24%,transparent); }\n    .rarity-legendary .itemx-name,.rarity-mythical .itemx-name,.rarity-empyrean .itemx-name { font-weight:900; letter-spacing:.012em; }\n    .rarity-empyrean .itemx-name { text-shadow:0 1px 2px rgba(0,0,0,.92),0 0 8px var(--rks),0 0 18px color-mix(in srgb,var(--rk) 38%,transparent); }\n    .craft-oriental.rarity-epic .itemx-name,.craft-oriental.rarity-legendary .itemx-name,.craft-oriental.rarity-mythical .itemx-name,.craft-oriental.rarity-empyrean .itemx-name{color:color-mix(in srgb,var(--rk) 58%,#f7ecd7);text-shadow:0 1px 2px #000,0 0 8px var(--rks),0 0 15px color-mix(in srgb,var(--rk) 22%,transparent)}\n    .condition-cursed .itemx-cond { background:radial-gradient(85% 50% at 50% 112%,rgba(90,8,30,.55),transparent 68%); mix-blend-mode:multiply; }\n    .condition-blessed .itemx-cond { background:radial-gradient(90% 55% at 50% -12%,rgba(255,240,200,.22),transparent 64%); }\n    .condition-corrupted .itemx-cond { background:radial-gradient(60% 45% at 24% 88%,rgba(140,47,74,.42),transparent 70%),radial-gradient(55% 40% at 78% 20%,rgba(74,30,96,.40),transparent 72%); filter:blur(14px); }\n\n    @keyframes existing-spin { to { transform:rotate(360deg); } }\n    @keyframes existing-veil { 0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(34%);opacity:1} }\n    @keyframes existing-rise { 0%{transform:translate3d(0,0,0) rotate(0);opacity:0}8%{opacity:var(--o)}92%{opacity:var(--o)}100%{transform:translate3d(var(--drift),-520px,0) rotate(220deg);opacity:0} }\n    @keyframes existing-drift { 0%{transform:translate(0,0);opacity:0}12%{opacity:var(--o)}55%{transform:translate(var(--drift),-230px) rotate(90deg)}100%{transform:translate(0,-520px) rotate(180deg);opacity:0} }\n    @keyframes existing-pulse { 0%,100%{transform:translateY(-160px) scale(.2);opacity:0}40%{transform:translate(var(--drift),-180px) scale(1);opacity:var(--o)}70%{transform:translateY(-200px) scale(.5);opacity:.2} }\n    @keyframes existing-sway { 0%{transform:translate(0,0);opacity:0}15%{opacity:var(--o)}35%{transform:translate(var(--drift),-160px) rotate(40deg)}65%{transform:translate(var(--drift2),-310px) rotate(-25deg)}100%{transform:translate(0,-520px) rotate(80deg);opacity:0} }\n    @keyframes existing-turn { 0%{transform:translateY(0) rotate(0);opacity:0}12%{opacity:var(--o)}100%{transform:translate(var(--drift),-520px) rotate(1080deg);opacity:0} }\n    @keyframes existing-jitter { 0%,100%{transform:translate(0,0);opacity:0}10%,25%,48%,73%{opacity:var(--o)}18%{transform:translate(18px,-100px)}39%{transform:translate(-24px,-210px)}62%{transform:translate(28px,-330px)}90%{transform:translate(-8px,-490px);opacity:0} }\n    @keyframes existing-fog { from{transform:translate(-4%,4%) scale(1);opacity:.45}to{transform:translate(6%,-3%) scale(1.18);opacity:.85} }\n    @keyframes existing-scan { from{transform:translateY(0);opacity:0}12%,88%{opacity:.9}to{transform:translateY(330%);opacity:0} }\n    @keyframes aff-fire { 0%{transform:translate3d(0,0,0) skewX(var(--sk)) scaleY(.5);opacity:0}15%{opacity:.9}100%{transform:translate3d(var(--drift),-300px,0) skewX(var(--sk)) scaleY(1.5);opacity:0} }\n    @keyframes aff-ice { 0%{transform:translate3d(0,-34px,0) rotate(-18deg);opacity:0}12%{opacity:.88}72%{opacity:.72}100%{transform:translate3d(var(--drift),130px,0) rotate(48deg);opacity:0} }\n    @keyframes aff-lightning { 0%,84%,89%,100%{opacity:0}85%,87%{opacity:1}86%,88%{opacity:.28} }\n    @keyframes aff-wind { 0%{transform:translateX(0) skewX(-24deg);opacity:0}25%{opacity:.75}100%{transform:translateX(620px) skewX(-24deg);opacity:0} }\n    @keyframes aff-earth { 0%{transform:translateY(0) rotate(0);opacity:0}18%{opacity:.75}100%{transform:translateY(-190px) rotate(150deg);opacity:0} }\n    @keyframes aff-light { from{transform:translateX(-12px) skewX(-18deg);opacity:.12}to{transform:translateX(16px) skewX(-18deg);opacity:.52} }\n    @keyframes aff-dark { from{transform:translateY(12%) skewX(-5deg);opacity:.18}to{transform:translateY(-7%) skewX(7deg);opacity:.58} }\n    @keyframes aff-poison { 0%,100%{transform:translate(0,4px) rotate(-8deg);opacity:.2}50%{transform:translate(8px,-10px) rotate(12deg);opacity:.8} }\n    @keyframes aff-blood { 0%{transform:translateY(-28%);opacity:0}18%{opacity:.72}100%{transform:translateY(135%);opacity:0} }\n    @keyframes aff-void { 0%,72%,80%,100%{opacity:0;transform:translateX(-8px) rotate(var(--r)) skewX(-34deg)}73%,76%{opacity:.9;transform:translateX(6px) rotate(var(--r)) skewX(-34deg)}77%{opacity:.2} }\n    @keyframes sig-fire { from{transform:translateY(0);opacity:.38}to{transform:translateY(-38px);opacity:.78} }\n    @keyframes ice-cracks { 0%,69%,78%,100%{opacity:0}70%,75%{opacity:.75}72%{opacity:.25} }\n    @keyframes sig-lightning { 0%,78%,85%,100%{opacity:0}79%,81%,84%{opacity:.9}80%,82%{opacity:.24} }\n    @keyframes lightning-field { 0%,68%,76%,100%{opacity:0}69%,71%,74%{opacity:.86}70%,72%,75%{opacity:.18} }\n    @keyframes sig-wind { to{transform:translateX(28%)} }\n    @keyframes sig-earth { from{transform:translate(-2%,2%);opacity:.3}to{transform:translate(2%,-2%);opacity:.72} }\n    @keyframes sig-light { from{transform:translateX(-5%);opacity:.36}to{transform:translateX(6%);opacity:.82} }\n    @keyframes sig-dark { from{transform:translateX(-4%) skewX(-3deg);opacity:.32}to{transform:translateX(5%) skewX(3deg);opacity:.7} }\n    @keyframes sig-poison { from{transform:translateX(-4%);opacity:.34}to{transform:translateX(5%);opacity:.72} }\n    @keyframes sig-blood { from{transform:translateY(-6%);opacity:.42}to{transform:translateY(7%);opacity:.82} }\n    @keyframes sig-void { 0%,66%,75%,100%{opacity:.16;transform:translateX(-2%)}67%,70%,74%{opacity:.88;transform:translateX(2%)}71%{opacity:.3;transform:translateX(-1%)} }\n    @media (prefers-reduced-motion:reduce) { .itemx-card:not(.force-motion) * { animation:none!important; } }\n    @media (max-width:620px) { .itemx2-never-stage{padding:12px 8px 40px}.itemx2-never-topbar{padding:0 12px}.itemx2-never-lab-grid{grid-template-columns:1fr 1fr}.itemx-grid{grid-template-columns:1fr}.itemx-panel{border-radius:12px}.itemx2-never-note{align-items:flex-start}.itemx-card{font-size:.86rem}.itemx-content{padding:1.05em} }";
const ITEMX_MAIN_STYLE = ".chattext .x-risu-itemx-panel{ display: flex; flex-direction: column; width: min(560px,100%); margin: 0 auto; overflow: hidden; border: 1px solid #232c3d; border-radius: 14px; background: #0a0d14; color: #e6ebf4; font-size: .9rem; box-shadow: 0 24px 70px rgba(0,0,0,.48); }.chattext .x-risu-itemx-ph{ display: flex; align-items: center; gap: .45em; padding: 1em 1.05em .85em; border-bottom: 1px solid rgba(212,175,110,.14); background: radial-gradient(120% 150% at 18% -40%,rgba(212,175,110,.10),transparent 55%),linear-gradient(180deg,#131a28,#0c1019); }.chattext .x-risu-itemx-ph-text{ display: flex; flex: 1; flex-direction: column; gap: .15em; min-width: 0; }.chattext .x-risu-itemx-ph-eyebrow{ color: #b39355; font-size: .6rem; font-weight: 700; letter-spacing: .3em; }.chattext .x-risu-itemx-ph-title{ color: #f4f0e6; font-size: 1.12rem; font-weight: 800; }.chattext .x-risu-itemx-ph-sub{ color: #77839c; font-size: .72rem; }.chattext .x-risu-itemx-ph-btn{ width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.06); border-radius: 10px; background: rgba(255,255,255,.03); color: #8b99b2; }.chattext .x-risu-itemx-seg{ display: flex; gap: .15em; margin: .35em 1.05em 0; overflow-x: auto; border-bottom: 1px solid #171d2b; scrollbar-width: none; }.chattext .x-risu-itemx-seg-i{ flex: 0 0 auto; min-height: 38px; display: inline-flex; align-items: center; gap: .32em; padding: 0 .6em; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #6e7b93; font-size: .78rem; cursor: pointer; }.chattext .x-risu-itemx-seg-on{ border-bottom-color: #d4af6e; color: #f2ead9; font-weight: 700; }.chattext .x-risu-itemx-seg-n{ opacity: .65; font-size: .92em; }.chattext .x-risu-itemx-tools{ display: flex; gap: .4em; margin: .6em 1.05em 0; }.chattext .x-risu-itemx-tool, .chattext .x-risu-itemx-search{ min-height: 34px; display: inline-flex; align-items: center; padding: 0 .7em; border: 1px solid rgba(255,255,255,.06); border-radius: 9px; background: rgba(255,255,255,.025); color: #93a2ba; font-size: .76rem; }.chattext .x-risu-itemx-search{ flex: 1; color: #64718c; }.chattext .x-risu-itemx-body{ padding: .75em 1.05em .95em; }.chattext .x-risu-itemx-grid{ display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .55em; }.chattext .x-risu-itemx-tile{ --rk:#8b94a6; --rks:rgba(139,148,166,.38); position: relative; display: grid; grid-template-columns: 2.4em minmax(0,1fr); grid-template-rows: 1fr auto; gap: .15em .6em; height: 82px; padding: .6em .7em .55em .85em; overflow: hidden; border: 1px solid #1c2331; border-radius: 13px; background: linear-gradient(160deg,#121826,#0d111b 78%); text-align: left; cursor: pointer; }.chattext .x-risu-itemx-tile:hover, .chattext .x-risu-itemx-tile:focus-visible{ border-color: var(--p,#d4af6e); outline: none; background: #141d2c; }.chattext .x-risu-itemx-tile-bar{ position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--rk); }.chattext .x-risu-itemx-tile-eq{ position: absolute; top: 0; right: 0; border-top: 16px solid #ffd479; border-left: 16px solid transparent; opacity: .85; }.chattext .x-risu-itemx-tile-em{ grid-row: 1/span 2; align-self: center; width: 2.55em; height: 2.55em; display: grid; place-items: center; border: 1px solid var(--rks); border-radius: 11px; background: radial-gradient(85% 85% at 50% 28%,var(--rks),transparent 80%); font-size: 1.1em; }.chattext .x-risu-itemx-tile-nm{ align-self: center; overflow: hidden; color: #edf2fb; font-size: .85rem; font-weight: 700; line-height: 1.32; }.chattext .x-risu-itemx-tile-meta{ display: flex; justify-content: space-between; gap: .5em; align-self: end; }.chattext .x-risu-itemx-tile-rk{ color: var(--rk); font-size: .7rem; font-weight: 700; }.chattext .x-risu-itemx-tile-lc{ color: #67748c; font-size: .7rem; }.chattext .x-risu-itemx-tile-aff{ position:absolute; right:8px; top:7px; display:flex; gap:2px; font-size:9px; filter:drop-shadow(0 0 4px rgba(0,0,0,.8)); }.chattext .x-risu-itemx-pf{ padding: .68em 1.1em; border-top: 1px solid #171d2b; color: #59657a; font-size: .7rem; text-align: right; }.chattext .x-risu-itemx-card{ content-visibility:auto; contain:layout paint style; contain-intrinsic-size:auto 520px; }.chattext .x-risu-itemx-back{ display: inline-block; margin-bottom: .7em; border: 0; background: transparent; color: #9eabbf; font-size: .78rem; cursor: pointer; }.chattext .x-risu-itemx-detail{ display: flex; justify-content: center; }.chattext .x-risu-itemx-card{ --bg:#1c1610; --surf:rgba(92,74,46,.18); --fg:#e8dcc2; --dim:#a89372; --line:#5c4a2e; --p:#ff7a3d; --pg:rgba(255,122,61,.42); --s:#86e5c4; --sg:rgba(134,229,196,.34); --rk:#f0a640; --rks:rgba(240,166,64,.5); --int:.72; --spd:1.25; position: relative; width: min(360px,100%); overflow: hidden; isolation: isolate; border: 1px solid var(--line); border-radius: 3px; background: repeating-linear-gradient(102deg,rgba(255,235,190,.028) 0 2px,transparent 2px 7px),repeating-linear-gradient(11deg,rgba(0,0,0,.14) 0 3px,transparent 3px 9px),radial-gradient(120% 80% at 50% -10%,#2b2117,#17120c 70%); color: var(--fg); font-family: \"Nanum Myeongjo\",\"Noto Serif KR\",Georgia,serif; font-size: .92rem; line-height: 1.62; box-shadow: inset 0 0 60px rgba(0,0,0,.55),0 0 calc(30px*var(--int)) var(--pg); }.chattext .x-risu-craft-forged{ --surf:rgba(74,60,45,.26);--fg:#f0e7dc;--dim:#b3a08c;--line:#4a3c2d;border-width:2px;border-radius:2px;background:repeating-linear-gradient(-14deg,rgba(255,255,255,.022) 0 2px,transparent 2px 11px),linear-gradient(168deg,#221d19,#0d0c0b 74%);font-family:Inter,Pretendard,sans-serif; }.chattext .x-risu-craft-oriental{ --surf:rgba(215,192,146,.075);--fg:#eee8dd;--dim:#aaa194;--line:#59482e;border-radius:2px;background:radial-gradient(100% 62% at 88% 0,rgba(135,89,35,.15),transparent 62%),repeating-linear-gradient(93deg,rgba(235,214,173,.018) 0 1px,transparent 1px 5px),repeating-linear-gradient(4deg,rgba(235,214,173,.014) 0 1px,transparent 1px 7px),linear-gradient(150deg,#191815,#0d1011 52%,#17130f);color:var(--fg);box-shadow:inset 0 0 0 1px #151717,inset 0 0 52px rgba(0,0,0,.48),0 0 calc(24px*var(--int)) var(--pg); }.chattext .x-risu-craft-clockwork{ --surf:rgba(107,81,44,.2);--fg:#e3d5b8;--dim:#9d8a68;--line:#6b512c;border-width:2px;border-radius:4px;background:repeating-linear-gradient(88deg,rgba(255,220,160,.035) 0 1px,transparent 1px 3px),linear-gradient(160deg,#241d15,#14100b 72%);font-family:ui-monospace,monospace; }.chattext .x-risu-craft-synthetic{ --surf:rgba(31,53,70,.35);--fg:#d6e6ef;--dim:#6d8496;--line:#1f3546;border-radius:0;background:repeating-linear-gradient(0deg,rgba(120,220,255,.045) 0 1px,transparent 1px 4px),linear-gradient(150deg,#0d1420,#070a11 70%);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% calc(100% - 24px),calc(100% - 24px) 100%,12px 100%,0 calc(100% - 12px));font-family:ui-monospace,monospace; }.chattext .x-risu-craft-celestial{ --surf:rgba(45,61,117,.28);--fg:#dfe7ff;--dim:#8e9ccb;--line:#2d3d75;border-radius:3px 3px 22px 22px;background:radial-gradient(90% 60% at 50% -8%,rgba(255,217,138,.16),transparent 62%),radial-gradient(120% 100% at 50% 110%,#14204a,transparent 60%),linear-gradient(180deg,#070b1c,#050813); }.chattext .x-risu-craft-organic{ --surf:rgba(44,74,51,.3);--fg:#dcecd8;--dim:#86a78d;--line:#2c4a33;border-radius:22px 4px 22px 4px;background:radial-gradient(100% 70% at 22% -6%,rgba(127,224,161,.1),transparent 60%),radial-gradient(120% 90% at 80% 110%,rgba(30,90,60,.5),transparent 62%),linear-gradient(170deg,#0d1b12,#071008);font-family:Inter,Pretendard,sans-serif; }.chattext .x-risu-craft-forged .x-risu-itemx-medallion, .chattext .x-risu-craft-oriental .x-risu-itemx-medallion{border-radius:3px}.chattext .x-risu-craft-synthetic .x-risu-itemx-medallion{border-radius:0;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))}.chattext .x-risu-craft-organic .x-risu-itemx-medallion{border-radius:60% 12% 60% 12%}.chattext .x-risu-craft-celestial .x-risu-itemx-medallion{border-radius:50%}.chattext .x-risu-craft-oriental .x-risu-itemx-name{color:#f2eadb;text-shadow:0 1px 2px #000,0 0 7px rgba(232,210,170,.16)}.chattext .x-risu-craft-oriental .x-risu-itemx-badge, .chattext .x-risu-craft-oriental .x-risu-itemx-subline{color:#aaa194}.chattext .x-risu-craft-oriental .x-risu-itemx-eyebrow{color:#bb9659;letter-spacing:.2em}.chattext .x-risu-craft-oriental .x-risu-itemx-head{padding-right:2.55em}.chattext .x-risu-craft-oriental .x-risu-itemx-effect, .chattext .x-risu-craft-oriental .x-risu-itemx-stat{background:rgba(7,9,9,.38)}.chattext .x-risu-itemx-oriental-paper, .chattext .x-risu-itemx-oriental-ink, .chattext .x-risu-itemx-oriental-frame, .chattext .x-risu-itemx-oriental-seal{display:none;position:absolute;pointer-events:none}.chattext .x-risu-craft-oriental .x-risu-itemx-oriental-paper{display:block;inset:0;z-index:0;opacity:.32;background:repeating-linear-gradient(92deg,transparent 0 8px,rgba(224,200,154,.025) 9px,transparent 10px 17px),repeating-linear-gradient(4deg,transparent 0 10px,rgba(224,200,154,.018) 11px,transparent 12px 20px)}.chattext .x-risu-craft-oriental .x-risu-itemx-oriental-ink{display:block;z-index:1;border:1px solid rgba(216,193,148,.08);border-radius:50%;filter:blur(1px);opacity:.7}.chattext .x-risu-craft-oriental .x-risu-itemx-oriental-ink-a{width:78%;height:44%;right:-35%;top:7%;transform:rotate(-12deg);box-shadow:0 0 22px rgba(178,126,60,.05)}.chattext .x-risu-craft-oriental .x-risu-itemx-oriental-ink-b{width:64%;height:36%;left:-34%;bottom:4%;transform:rotate(16deg);border-color:rgba(146,42,47,.09)}.chattext .x-risu-craft-oriental .x-risu-itemx-oriental-frame{display:block;inset:10px;z-index:5;border:1px solid rgba(210,178,111,.18);box-shadow:inset 0 0 18px rgba(0,0,0,.18)}.chattext .x-risu-craft-oriental .x-risu-itemx-oriental-frame::before, .chattext .x-risu-craft-oriental .x-risu-itemx-oriental-frame::after{content:\"\";position:absolute;width:18px;height:18px;border-color:rgba(229,195,125,.55);border-style:solid}.chattext .x-risu-craft-oriental .x-risu-itemx-oriental-frame::before{left:-4px;top:-4px;border-width:2px 0 0 2px}.chattext .x-risu-craft-oriental .x-risu-itemx-oriental-frame::after{right:-4px;bottom:-4px;border-width:0 2px 2px 0}.chattext .x-risu-craft-oriental .x-risu-itemx-oriental-seal{display:grid;place-items:center;right:16px;top:18px;z-index:6;width:31px;height:38px;border:1px solid rgba(214,82,73,.66);background:rgba(116,20,25,.38);color:#e09186;font-size:.62em;font-weight:800;line-height:1.05;text-align:center;box-shadow:inset 0 0 0 2px rgba(18,8,8,.36),0 0 9px rgba(175,34,40,.16);transform:rotate(2deg)}.chattext .x-risu-itemx-card::before{ content:\"\"; position:absolute; inset:0 0 auto; z-index:6; height:2px; background:linear-gradient(90deg,transparent,var(--rk) 18%,var(--rk) 82%,transparent); opacity:.85; }.chattext .x-risu-itemx-fx, .chattext .x-risu-itemx-cond{ position:absolute; inset:0; pointer-events:none; overflow:hidden; }.chattext .x-risu-itemx-fx{ z-index:1; }.chattext .x-risu-itemx-cond{ z-index:2; }.chattext .x-risu-craft-oriental .x-risu-itemx-fx{z-index:2}.chattext .x-risu-craft-oriental .x-risu-current-fx{opacity:.42}.chattext .x-risu-craft-oriental .x-risu-current-fog{opacity:.28}.chattext .x-risu-craft-oriental .x-risu-current-veil, .chattext .x-risu-craft-oriental .x-risu-current-rays{opacity:.44}.chattext .x-risu-craft-oriental .x-risu-affinity-fx{z-index:3;filter:saturate(1.2) brightness(1.16)}.chattext .x-risu-current-fx, .chattext .x-risu-affinity-fx{ position:absolute; inset:0; overflow:hidden; }.chattext .x-risu-current-rays{ position:absolute; inset:-75%; opacity:calc(.12 * var(--int)); filter:blur(9px); animation:existing-spin calc(96s/var(--spd)) linear infinite; }.chattext .x-risu-current-rays i{ position:absolute; top:50%; left:50%; width:var(--w); height:100%; transform:translateX(-50%) translateY(-100%) rotate(var(--r)); transform-origin:center bottom; border-radius:80% 80% 0 0; background:linear-gradient(to top,var(--p),transparent 49%); }.chattext .x-risu-current-veil{ position:absolute; top:-55%; right:0; left:0; height:85%; animation:existing-veil calc(8.5s/var(--spd)) ease-in-out infinite; }.chattext .x-risu-current-veil-visual{ position:absolute;inset:0;display:block;background:linear-gradient(to bottom,transparent,var(--pg),transparent);filter:blur(15px); }.chattext .x-risu-craft-mote{ position:absolute; left:var(--x); top:108%; width:var(--z); height:var(--mh); border-radius:42% 42% 56% 56%/62% 62% 38% 38%; background:linear-gradient(to top,var(--ca),transparent); box-shadow:0 0 6px var(--ca); opacity:var(--o); animation:existing-rise var(--d) linear infinite; animation-delay:var(--delay); }.chattext .x-risu-craft-mote.x-risu-diamond{ height:var(--z); border-radius:0; background:linear-gradient(135deg,var(--ca),var(--cb)); transform:rotate(45deg); }.chattext .x-risu-craft-mote.x-risu-shape-ash{ height:var(--z);border-radius:62% 38% 55% 45%;background:radial-gradient(circle at 38% 34%,var(--ca),var(--cb) 72%,transparent); }.chattext .x-risu-craft-mote.x-risu-shape-petal{ height:var(--mh);border-radius:100% 6% 100% 6%;background:linear-gradient(140deg,var(--ca),var(--cb)); }.chattext .x-risu-craft-mote.x-risu-shape-block{ height:var(--z);border-radius:0;background:var(--ca);box-shadow:1px 0 0 var(--cb); }.chattext .x-risu-craft-mote.x-risu-shape-streak{ width:2px;height:var(--mh);border-radius:2px;background:linear-gradient(to top,transparent,var(--ca) 45%,transparent); }.chattext .x-risu-craft-mote.x-risu-shape-cross{ height:var(--z);border-radius:0;background:linear-gradient(90deg,transparent,var(--ca),transparent); }.chattext .x-risu-craft-mote.x-risu-shape-cross::after{ content:\"\";position:absolute;inset:-70% 42%;background:linear-gradient(to bottom,transparent,var(--cb),transparent); }.chattext .x-risu-craft-mote.x-risu-shape-gear{ height:var(--z);border-radius:0;background:none;box-shadow:none;color:var(--ca);font-size:var(--mh);line-height:1; }.chattext .x-risu-craft-mote.x-risu-shape-gear::before{ content:\"⚙\";position:absolute;inset:0; }.chattext .x-risu-path-drift{animation-name:existing-drift}.chattext .x-risu-path-pulse{animation-name:existing-pulse}.chattext .x-risu-path-sway{animation-name:existing-sway}.chattext .x-risu-path-turn{animation-name:existing-turn}.chattext .x-risu-path-jitter{animation-name:existing-jitter}.chattext .x-risu-current-fog{ position:absolute;right:-20%;bottom:-35%;left:-20%;height:85%;animation:existing-fog 17s ease-in-out infinite alternate; }.chattext .x-risu-current-fog-visual{ position:absolute;inset:0;display:block;background:radial-gradient(60% 60% at 30% 70%,var(--pg),transparent 70%),radial-gradient(55% 55% at 75% 60%,var(--pg),transparent 72%);filter:blur(22px); }.chattext .x-risu-current-scan{ position:absolute;top:-30%;right:0;left:0;height:42%;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.13),transparent);animation:existing-scan 5.5s linear infinite; }.chattext .x-risu-affinity-fx{ z-index:2; }.chattext .x-risu-afx{ position:absolute; inset:0; opacity:1; filter:saturate(1.22) brightness(1.12); }.chattext .x-risu-afx-secondary{ opacity:.68; clip-path:inset(0 0 0 46%); }.chattext .x-risu-afx i{ position:absolute; display:block; color:var(--ac); }.chattext .x-risu-afx-fire i{ left:var(--x); bottom:-12px; width:3px; height:var(--h); border-radius:60% 60% 30% 30%; background:linear-gradient(to top,transparent,var(--ac) 50%,#ffe2a6); box-shadow:0 0 7px var(--ac); transform:skewX(var(--sk)); animation:aff-fire var(--d) ease-out infinite; animation-delay:var(--delay); }.chattext .x-risu-afx-ice i{ left:var(--x); top:var(--y); width:var(--iw); height:var(--ih); background:linear-gradient(160deg,#fff 0 12%,#dff8ff 24%,var(--ac) 62%,transparent); clip-path:polygon(50% 0,82% 38%,66% 100%,29% 82%,12% 35%); filter:drop-shadow(0 0 3px #dff8ff) drop-shadow(0 0 6px var(--ac)); animation:aff-ice var(--d) linear infinite; animation-delay:var(--delay); }.chattext .x-risu-afx-lightning b{ position:absolute; width:94px; height:7px; background:linear-gradient(90deg,transparent,var(--ac),#fff 48%,var(--ac),transparent); clip-path:polygon(0 38%,35% 18%,40% 60%,66% 5%,62% 48%,100% 28%,100% 65%,61% 78%,56% 45%,42% 100%,34% 58%,0 76%); filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 10px var(--ac)); opacity:0; animation:aff-lightning var(--d) step-end infinite; animation-delay:var(--delay); transform:rotate(var(--r)); }.chattext .x-risu-afx-wind i{ left:-24%; top:var(--y); width:52%; height:1px; background:linear-gradient(90deg,transparent,var(--ac) 36%,transparent); box-shadow:0 0 5px var(--ac); transform:skewX(-24deg); animation:aff-wind var(--d) ease-in-out infinite; animation-delay:var(--delay); }.chattext .x-risu-afx-earth i{ left:var(--x); bottom:-6px; width:var(--z); height:var(--z); background:linear-gradient(145deg,#f2cf8a,var(--ac) 52%,#4b3219); clip-path:polygon(16% 4%,92% 18%,75% 92%,8% 70%); filter:drop-shadow(0 0 3px var(--ac)); animation:aff-earth var(--d) ease-out infinite; animation-delay:var(--delay); }.chattext .x-risu-afx-light i{ left:var(--x); top:-20%; width:var(--z); height:135%; transform:skewX(-18deg); background:linear-gradient(to bottom,transparent,var(--ac) 38%,transparent 72%); filter:blur(2px); animation:aff-light var(--d) ease-in-out infinite alternate; animation-delay:var(--delay); }.chattext .x-risu-afx-dark i{ left:var(--x); top:var(--y); width:var(--z); height:var(--h); background:linear-gradient(to bottom,transparent,var(--ac),transparent); transform:skewX(var(--sk)); filter:blur(4px); animation:aff-dark var(--d) ease-in-out infinite alternate; animation-delay:var(--delay); }.chattext .x-risu-afx-poison i{ left:var(--x); top:var(--y); width:var(--z); height:var(--ph); border-radius:65% 35% 60% 40%; background:linear-gradient(145deg,#eaff9a,var(--ac) 58%,transparent); box-shadow:0 0 6px var(--ac); animation:aff-poison var(--d) ease-in-out infinite; animation-delay:var(--delay); }.chattext .x-risu-afx-blood i{ left:var(--x); top:-15%; width:var(--z); height:var(--h); border-radius:0 0 70% 30%; background:linear-gradient(to bottom,var(--ac),transparent); box-shadow:0 4px 7px var(--ac); animation:aff-blood var(--d) ease-in infinite; animation-delay:var(--delay); }.chattext .x-risu-afx-void i{ left:var(--x); top:var(--y); width:var(--z); height:2px; transform:rotate(var(--r)) skewX(-34deg); background:linear-gradient(90deg,transparent,#fff 16%,var(--ac) 48%,transparent); box-shadow:0 0 5px var(--ac),0 0 12px var(--ac); animation:aff-void var(--d) step-end infinite; animation-delay:var(--delay); }.chattext .x-risu-affinity-signature{ position:absolute; inset:0; color:var(--ac); pointer-events:none; mix-blend-mode:screen; opacity:.76; }.chattext .x-risu-affinity-signature-visual{ position:absolute;inset:0;display:block; }.chattext .x-risu-affinity-signature.x-risu-secondary{ opacity:.48; clip-path:inset(0 0 0 48%); }.chattext .x-risu-sig-fire{ animation:sig-fire 5.2s linear infinite; }.chattext .x-risu-sig-fire>.x-risu-affinity-signature-visual{ background:repeating-linear-gradient(0deg,transparent 0 36px,color-mix(in srgb,var(--ac) 12%,transparent) 38px,color-mix(in srgb,var(--ac) 38%,transparent) 39px,transparent 42px 76px);filter:blur(2px) drop-shadow(0 0 7px var(--ac)); }.chattext .x-risu-ice-cracks{ position:absolute; inset:0; background:linear-gradient(32deg,transparent 0 31%,color-mix(in srgb,var(--ac) 62%,#fff) 31.4%,transparent 32% 100%),linear-gradient(147deg,transparent 0 67%,color-mix(in srgb,var(--ac) 45%,#fff) 67.4%,transparent 68% 100%),linear-gradient(81deg,transparent 0 78%,var(--ac) 78.3%,transparent 78.8% 100%); clip-path:polygon(0 0,17% 0,32% 38%,51% 21%,66% 54%,100% 39%,100% 52%,69% 65%,53% 34%,34% 53%,12% 18%,0 22%); filter:drop-shadow(0 0 4px var(--ac)); opacity:0; animation:ice-cracks 5.6s step-end infinite; }.chattext .x-risu-sig-lightning{ background:linear-gradient(112deg,transparent 0 42%,color-mix(in srgb,var(--ac) 68%,transparent) 43%,#fff 44%,var(--ac) 45%,transparent 47% 100%); clip-path:polygon(0 9%,44% 9%,36% 37%,70% 31%,58% 61%,100% 56%,100% 68%,48% 75%,57% 46%,24% 51%,35% 22%,0 26%); filter:drop-shadow(0 0 7px #fff) drop-shadow(0 0 14px var(--ac)); opacity:0; animation:sig-lightning 3.2s step-end infinite; }.chattext .x-risu-lightning-field{ position:absolute; inset:0; opacity:0; background:linear-gradient(28deg,transparent 0 22%,var(--ac) 22.5%,transparent 23.2% 100%),linear-gradient(151deg,transparent 0 58%,#fff 58.4%,var(--ac) 59%,transparent 59.8% 100%),linear-gradient(74deg,transparent 0 71%,var(--ac) 71.5%,transparent 72.3% 100%); clip-path:polygon(0 4%,100% 0,100% 17%,0 28%,0 42%,100% 31%,100% 51%,0 64%,0 79%,100% 69%,100% 88%,0 100%); box-shadow:inset 8px 0 16px color-mix(in srgb,var(--ac) 55%,transparent),inset -8px 0 16px color-mix(in srgb,var(--ac) 55%,transparent); filter:drop-shadow(0 0 8px var(--ac)); animation:lightning-field 2.35s step-end infinite; }.chattext .x-risu-sig-wind{ transform:translateX(-26%);animation:sig-wind 6.4s linear infinite; }.chattext .x-risu-sig-wind>.x-risu-affinity-signature-visual{ background:repeating-linear-gradient(164deg,transparent 0 34px,color-mix(in srgb,var(--ac) 45%,transparent) 35px,color-mix(in srgb,var(--ac) 15%,transparent) 37px,transparent 40px 69px);filter:drop-shadow(5px 0 7px var(--ac)); }.chattext .x-risu-sig-earth{ animation:sig-earth 6s ease-in-out infinite alternate; }.chattext .x-risu-sig-earth>.x-risu-affinity-signature-visual{ background:linear-gradient(32deg,transparent 0 18%,color-mix(in srgb,var(--ac) 42%,transparent) 18.5%,transparent 19.4% 47%,color-mix(in srgb,var(--ac) 30%,transparent) 47.5%,transparent 48.4% 100%),linear-gradient(146deg,transparent 0 67%,color-mix(in srgb,var(--ac) 46%,transparent) 67.5%,transparent 68.4%);filter:drop-shadow(0 0 5px var(--ac)); }.chattext .x-risu-sig-light{ animation:sig-light 7s ease-in-out infinite alternate; }.chattext .x-risu-sig-light>.x-risu-affinity-signature-visual{ background:repeating-linear-gradient(112deg,transparent 0 54px,color-mix(in srgb,var(--ac) 32%,transparent) 55px,color-mix(in srgb,var(--ac) 8%,transparent) 68px,transparent 80px 122px);filter:blur(3px) drop-shadow(0 0 9px var(--ac)); }.chattext .x-risu-sig-dark{ animation:sig-dark 7.5s ease-in-out infinite alternate; }.chattext .x-risu-sig-dark>.x-risu-affinity-signature-visual{ background:repeating-linear-gradient(106deg,transparent 0 47px,color-mix(in srgb,var(--ac) 11%,transparent) 49px,color-mix(in srgb,var(--ac) 34%,transparent) 52px,transparent 58px 104px);filter:blur(9px) drop-shadow(0 0 10px var(--ac)); }.chattext .x-risu-sig-poison{ animation:sig-poison 8s ease-in-out infinite alternate; }.chattext .x-risu-sig-poison>.x-risu-affinity-signature-visual{ background:repeating-linear-gradient(96deg,transparent 0 42px,color-mix(in srgb,var(--ac) 18%,transparent) 43px,var(--ac) 45px,transparent 49px 88px);clip-path:polygon(0 12%,100% 0,100% 21%,0 36%,0 55%,100% 38%,100% 58%,0 79%,0 100%,100% 72%,100% 100%,0 100%);filter:blur(2px) drop-shadow(0 0 7px var(--ac)); }.chattext .x-risu-sig-blood{ animation:sig-blood 5.8s ease-in-out infinite alternate; }.chattext .x-risu-sig-blood>.x-risu-affinity-signature-visual{ background:repeating-linear-gradient(90deg,transparent 0 38px,color-mix(in srgb,var(--ac) 70%,transparent) 40px,color-mix(in srgb,var(--ac) 18%,transparent) 44px,transparent 49px 77px);clip-path:polygon(0 0,100% 0,100% 20%,92% 20%,90% 76%,86% 24%,75% 18%,72% 55%,67% 22%,58% 16%,55% 69%,51% 21%,37% 16%,35% 48%,29% 23%,17% 17%,13% 62%,9% 20%,0 18%);filter:drop-shadow(0 5px 8px var(--ac)); }.chattext .x-risu-sig-void{ animation:sig-void 4.9s step-end infinite; }.chattext .x-risu-sig-void>.x-risu-affinity-signature-visual{ background:repeating-linear-gradient(176deg,transparent 0 47px,color-mix(in srgb,var(--ac) 22%,transparent) 48px,#fff 49px,var(--ac) 50px,transparent 52px 91px);clip-path:polygon(0 7%,100% 0,100% 18%,0 25%,0 45%,100% 35%,100% 52%,0 65%,0 82%,100% 70%,100% 90%,0 100%);filter:drop-shadow(0 0 11px var(--ac)); }.chattext .x-risu-itemx-content{ position:relative; z-index:4; padding:1.35em; }.chattext .x-risu-itemx-head{ display:flex; align-items:flex-start; gap:.85em; }.chattext .x-risu-itemx-medallion{ flex:0 0 auto; width:3.3em; height:3.3em; display:grid; place-items:center; border:1px solid color-mix(in srgb,var(--rk) 38%,transparent); border-radius:50%; background:radial-gradient(circle at 32% 28%,#4a3a20,#201810); box-shadow:0 0 7px color-mix(in srgb,var(--rk) 22%,transparent),inset 0 0 10px color-mix(in srgb,var(--rk) 16%,transparent); }.chattext .x-risu-itemx-emoji{ font-size:1.6em; }.chattext .x-risu-itemx-titles{ flex:1; min-width:0; }.chattext .x-risu-itemx-eyebrow{ color:var(--dim); font-size:.74em; letter-spacing:.2em; }.chattext .x-risu-itemx-name{ display:block; margin:.2em 0 .3em; color:#f5efe4; font-size:1.42em; font-weight:800; line-height:1.22; text-shadow:0 1px 2px rgba(0,0,0,.92); }.chattext .x-risu-itemx-tier{ display:inline-block; padding:.05em .45em; border:1px solid var(--rk); border-radius:3px; background:var(--rks); color:var(--rk); font-size:.74em; font-weight:700; letter-spacing:.08em; }.chattext .x-risu-itemx-subline{ display:flex; margin-top:.18em; color:var(--dim); font-size:.76em; }.chattext .x-risu-itemx-subline span+span::before{ content:\"·\"; margin:0 .55em; color:var(--line); }.chattext .x-risu-affinity-row{ display:flex; flex-wrap:wrap; gap:6px; margin-top:.75em; }.chattext .x-risu-affinity-chip{ display:inline-flex; align-items:center; gap:5px; padding:3px 7px; border:1px solid color-mix(in srgb,var(--chip) 55%,transparent); border-radius:999px; background:color-mix(in srgb,var(--chip) 13%,transparent); color:color-mix(in srgb,var(--chip) 85%,white); font-family:Inter,Pretendard,sans-serif; font-size:10px; font-weight:800; }.chattext .x-risu-affinity-chip small{ opacity:.62; font-size:9px; }.chattext .x-risu-reaction-chip{ border-color:color-mix(in srgb,var(--p) 48%,var(--s)); background:linear-gradient(100deg,color-mix(in srgb,var(--p) 16%,transparent),color-mix(in srgb,var(--s) 16%,transparent)); color:#f6ebd5; }.chattext .x-risu-itemx-rule{ height:1px; margin:1.05em 0; background:linear-gradient(90deg,transparent,var(--p) 18%,var(--s) 82%,transparent); opacity:.8; }.chattext .x-risu-itemx-stats{ display:flex; gap:.45em; }.chattext .x-risu-itemx-stat{ flex:1; padding:.5em .65em; border-top:1px solid var(--line); background:var(--surf); }.chattext .x-risu-itemx-statk{ display:block; color:var(--dim); font-size:.74em; letter-spacing:.1em; }.chattext .x-risu-itemx-statv{ display:block; margin-top:.1em; font-weight:700; }.chattext .x-risu-itemx-gap{ height:1.1em; }.chattext .x-risu-itemx-section-label{ margin-bottom:.5em; color:var(--p); font-size:.74em; font-weight:700; letter-spacing:.14em; }.chattext .x-risu-itemx-effects{ display:grid; gap:.7em; }.chattext .x-risu-itemx-effect{ position:relative; padding-left:1.1em; }.chattext .x-risu-itemx-effect::before{ content:\"❧\"; position:absolute; left:0; color:var(--s); }.chattext .x-risu-itemx-efname{ color:var(--p); font-weight:700; }.chattext .x-risu-itemx-flavor{ margin:1.1em 0 0; padding-left:.8em; border-left:1px solid var(--s); color:var(--dim); font-size:.93em; font-style:italic; }.chattext .x-risu-motion-off *{ animation:none!important; }.chattext .x-risu-rarity-normal{--rk:#788396;--rks:rgba(120,131,150,.28);--int:0}.chattext .x-risu-rarity-magic{--rk:#6fa8e8;--rks:rgba(111,168,232,.32);--int:.14}.chattext .x-risu-rarity-rare{--rk:#45c8c0;--rks:rgba(69,200,192,.36);--int:.28}.chattext .x-risu-rarity-unique{--rk:#a888f0;--rks:rgba(168,136,240,.45);--int:.42}.chattext .x-risu-rarity-epic{--rk:#dd7be0;--rks:rgba(221,123,224,.45);--int:.56}.chattext .x-risu-rarity-legendary{--rk:#f0a640;--rks:rgba(240,166,64,.5);--int:.72}.chattext .x-risu-rarity-mythical{--rk:#ff7a7a;--rks:rgba(255,122,122,.5);--int:.86}.chattext .x-risu-rarity-empyrean{--rk:#ffe9a8;--rks:rgba(255,233,168,.55);--int:1}.chattext .x-risu-rarity-epic .x-risu-itemx-medallion, .chattext .x-risu-rarity-legendary .x-risu-itemx-medallion, .chattext .x-risu-rarity-mythical .x-risu-itemx-medallion, .chattext .x-risu-rarity-empyrean .x-risu-itemx-medallion{ border-width:2px; border-color:color-mix(in srgb,var(--rk) 78%,transparent); box-shadow:0 0 14px color-mix(in srgb,var(--rk) 42%,transparent),inset 0 0 12px color-mix(in srgb,var(--rk) 24%,transparent); }.chattext .x-risu-rarity-epic .x-risu-itemx-name, .chattext .x-risu-rarity-legendary .x-risu-itemx-name, .chattext .x-risu-rarity-mythical .x-risu-itemx-name, .chattext .x-risu-rarity-empyrean .x-risu-itemx-name{ color:color-mix(in srgb,var(--rk) 72%,white); text-shadow:0 1px 2px rgba(0,0,0,.92),0 0 7px var(--rks),0 0 15px color-mix(in srgb,var(--rk) 24%,transparent); }.chattext .x-risu-rarity-legendary .x-risu-itemx-name, .chattext .x-risu-rarity-mythical .x-risu-itemx-name, .chattext .x-risu-rarity-empyrean .x-risu-itemx-name{ font-weight:900; letter-spacing:.012em; }.chattext .x-risu-rarity-empyrean .x-risu-itemx-name{ text-shadow:0 1px 2px rgba(0,0,0,.92),0 0 8px var(--rks),0 0 18px color-mix(in srgb,var(--rk) 38%,transparent); }.chattext .x-risu-craft-oriental.x-risu-rarity-epic .x-risu-itemx-name, .chattext .x-risu-craft-oriental.x-risu-rarity-legendary .x-risu-itemx-name, .chattext .x-risu-craft-oriental.x-risu-rarity-mythical .x-risu-itemx-name, .chattext .x-risu-craft-oriental.x-risu-rarity-empyrean .x-risu-itemx-name{color:color-mix(in srgb,var(--rk) 58%,#f7ecd7);text-shadow:0 1px 2px #000,0 0 8px var(--rks),0 0 15px color-mix(in srgb,var(--rk) 22%,transparent)}.chattext .x-risu-condition-cursed .x-risu-itemx-cond{ background:radial-gradient(85% 50% at 50% 112%,rgba(90,8,30,.55),transparent 68%); mix-blend-mode:multiply; }.chattext .x-risu-condition-blessed .x-risu-itemx-cond{ background:radial-gradient(90% 55% at 50% -12%,rgba(255,240,200,.22),transparent 64%); }.chattext .x-risu-condition-corrupted .x-risu-itemx-cond{ background:radial-gradient(60% 45% at 24% 88%,rgba(140,47,74,.42),transparent 70%),radial-gradient(55% 40% at 78% 20%,rgba(74,30,96,.40),transparent 72%); filter:blur(14px); }@keyframes existing-spin{ to { transform:rotate(360deg); } }@keyframes existing-veil{ 0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(34%);opacity:1} }@keyframes existing-rise{ 0%{transform:translate3d(0,0,0) rotate(0);opacity:0}8%{opacity:var(--o)}92%{opacity:var(--o)}100%{transform:translate3d(var(--drift),-520px,0) rotate(220deg);opacity:0} }@keyframes existing-drift{ 0%{transform:translate(0,0);opacity:0}12%{opacity:var(--o)}55%{transform:translate(var(--drift),-230px) rotate(90deg)}100%{transform:translate(0,-520px) rotate(180deg);opacity:0} }@keyframes existing-pulse{ 0%,100%{transform:translateY(-160px) scale(.2);opacity:0}40%{transform:translate(var(--drift),-180px) scale(1);opacity:var(--o)}70%{transform:translateY(-200px) scale(.5);opacity:.2} }@keyframes existing-sway{ 0%{transform:translate(0,0);opacity:0}15%{opacity:var(--o)}35%{transform:translate(var(--drift),-160px) rotate(40deg)}65%{transform:translate(var(--drift2),-310px) rotate(-25deg)}100%{transform:translate(0,-520px) rotate(80deg);opacity:0} }@keyframes existing-turn{ 0%{transform:translateY(0) rotate(0);opacity:0}12%{opacity:var(--o)}100%{transform:translate(var(--drift),-520px) rotate(1080deg);opacity:0} }@keyframes existing-jitter{ 0%,100%{transform:translate(0,0);opacity:0}10%,25%,48%,73%{opacity:var(--o)}18%{transform:translate(18px,-100px)}39%{transform:translate(-24px,-210px)}62%{transform:translate(28px,-330px)}90%{transform:translate(-8px,-490px);opacity:0} }@keyframes existing-fog{ from{transform:translate(-4%,4%) scale(1);opacity:.45}to{transform:translate(6%,-3%) scale(1.18);opacity:.85} }@keyframes existing-scan{ from{transform:translateY(0);opacity:0}12%,88%{opacity:.9}to{transform:translateY(330%);opacity:0} }@keyframes aff-fire{ 0%{transform:translate3d(0,0,0) skewX(var(--sk)) scaleY(.5);opacity:0}15%{opacity:.9}100%{transform:translate3d(var(--drift),-300px,0) skewX(var(--sk)) scaleY(1.5);opacity:0} }@keyframes aff-ice{ 0%{transform:translate3d(0,-34px,0) rotate(-18deg);opacity:0}12%{opacity:.88}72%{opacity:.72}100%{transform:translate3d(var(--drift),130px,0) rotate(48deg);opacity:0} }@keyframes aff-lightning{ 0%,84%,89%,100%{opacity:0}85%,87%{opacity:1}86%,88%{opacity:.28} }@keyframes aff-wind{ 0%{transform:translateX(0) skewX(-24deg);opacity:0}25%{opacity:.75}100%{transform:translateX(620px) skewX(-24deg);opacity:0} }@keyframes aff-earth{ 0%{transform:translateY(0) rotate(0);opacity:0}18%{opacity:.75}100%{transform:translateY(-190px) rotate(150deg);opacity:0} }@keyframes aff-light{ from{transform:translateX(-12px) skewX(-18deg);opacity:.12}to{transform:translateX(16px) skewX(-18deg);opacity:.52} }@keyframes aff-dark{ from{transform:translateY(12%) skewX(-5deg);opacity:.18}to{transform:translateY(-7%) skewX(7deg);opacity:.58} }@keyframes aff-poison{ 0%,100%{transform:translate(0,4px) rotate(-8deg);opacity:.2}50%{transform:translate(8px,-10px) rotate(12deg);opacity:.8} }@keyframes aff-blood{ 0%{transform:translateY(-28%);opacity:0}18%{opacity:.72}100%{transform:translateY(135%);opacity:0} }@keyframes aff-void{ 0%,72%,80%,100%{opacity:0;transform:translateX(-8px) rotate(var(--r)) skewX(-34deg)}73%,76%{opacity:.9;transform:translateX(6px) rotate(var(--r)) skewX(-34deg)}77%{opacity:.2} }@keyframes sig-fire{ from{transform:translateY(0);opacity:.38}to{transform:translateY(-38px);opacity:.78} }@keyframes ice-cracks{ 0%,69%,78%,100%{opacity:0}70%,75%{opacity:.75}72%{opacity:.25} }@keyframes sig-lightning{ 0%,78%,85%,100%{opacity:0}79%,81%,84%{opacity:.9}80%,82%{opacity:.24} }@keyframes lightning-field{ 0%,68%,76%,100%{opacity:0}69%,71%,74%{opacity:.86}70%,72%,75%{opacity:.18} }@keyframes sig-wind{ to{transform:translateX(28%)} }@keyframes sig-earth{ from{transform:translate(-2%,2%);opacity:.3}to{transform:translate(2%,-2%);opacity:.72} }@keyframes sig-light{ from{transform:translateX(-5%);opacity:.36}to{transform:translateX(6%);opacity:.82} }@keyframes sig-dark{ from{transform:translateX(-4%) skewX(-3deg);opacity:.32}to{transform:translateX(5%) skewX(3deg);opacity:.7} }@keyframes sig-poison{ from{transform:translateX(-4%);opacity:.34}to{transform:translateX(5%);opacity:.72} }@keyframes sig-blood{ from{transform:translateY(-6%);opacity:.42}to{transform:translateY(7%);opacity:.82} }@keyframes sig-void{ 0%,66%,75%,100%{opacity:.16;transform:translateX(-2%)}67%,70%,74%{opacity:.88;transform:translateX(2%)}71%{opacity:.3;transform:translateX(-1%)} }@media (prefers-reduced-motion:reduce){.chattext .x-risu-itemx-card:not(.x-risu-force-motion) *{ animation:none!important; } }@media (max-width:620px){.chattext .x-risu-itemx2-never-stage{padding:12px 8px 40px}.chattext .x-risu-itemx2-never-topbar{padding:0 12px}.chattext .x-risu-itemx2-never-lab-grid{grid-template-columns:1fr 1fr}.chattext .x-risu-itemx-grid{grid-template-columns:1fr}.chattext .x-risu-itemx-panel{border-radius:12px}.chattext .x-risu-itemx2-never-note{align-items:flex-start}.chattext .x-risu-itemx-card{font-size:.86rem}.chattext .x-risu-itemx-content{padding:1.05em} }";
const ITEMX_CHIP_STYLE = '.itemx-event-chip{display:inline-flex;align-items:center;max-width:100%;margin:.28em .2em;padding:.28em .58em;border:1px solid rgba(126,145,174,.26);border-radius:999px;background:rgba(18,25,38,.72);color:#dce6f4;font-size:.76rem;font-weight:700;line-height:1.35;vertical-align:middle}';
const ITEMX_PROTOCOL_TEXT = "## ITEMX Compact Item Event Protocol\n\nITEMX is one output protocol among all system protocols already present. Follow every other protocol too. In particular, preserve every required status/state/route trailer and its exact ordering. If another protocol says its trailer must be the final text, put ITEMX events earlier beside the relevant narrative and leave that trailer absolutely last.\n\nEmit an ITEMX event only for a concrete item event settled in this response. Do not emit one for mere mentions, plans, guesses, scenery, or unchanged items. Multiple items are allowed; place each event immediately after the paragraph where that item is discovered, obtained, changed, used, equipped, transferred, destroyed, or appraised. Never batch events at the response end.\n\nUse the one-line form by default:\n[itemx: id=stable_id | name=아이템 이름 | type=분류 | emoji=🗡️ | rarity=rare | display=레어 | theme=forged | affinity=fire | possession=owned | location=inventory | count=1 | power=300-699 | required=레벨 10 | durability=80/100 | cost=1200 Gold | effects=효과명::설명 ;; 효과명::설명 | trivia=짧은 배경]\n\nFor a new full appraisal, include id, name, type, emoji, rarity, display, possession, location, count and every appraisal field actually supported by the narrative. Choose one fitting emoji that reflects the item's identity, form or use; do not mechanically repeat a default and never use `❔`. Equipment also needs every real gameplay effect stated by the narrative. Never invent required level, durability, price, affinity or effects merely to fill a field. Use stable ids containing only letters, digits, `_` or `-`. A newly seen item is `observed` unless the narrative establishes ownership.\n\nExisting ids in the `[ITEMX v2]` state are authoritative. Never appraise them again. Emit only the settled change:\n[itemx: id=healing_potion | action=consume | quantity=1 | reason=물약 사용]\n[itemx: id=quest_ore | action=transfer | quantity=all | destination=guild | reason=납품]\n[itemx: id=sword | action=equip | slot=main_hand]\n[itemx: action=swap | unequip=old_sword | equip=new_sword | slot=main_hand]\n[itemx: action=transform | inputs=ore:3,coal:1 | outputs=ingot:1 | reason=제련]\n[itemx: id=sword | op=merge | durability=61/100]\n\nActions: acquire, transfer, consume, equip, unequip, move, transform, destroy, restore, swap. For transfer, consume, and destroy, quantity is mandatory and is a positive integer or `all`. `reason` never changes state by itself. `op=merge` changes only supplied descriptive/stat fields; it cannot change possession, location, count, or slot. Use an action for those. Use `op=remove` only for legacy complete loss and `op=restore` only for legacy restoration.\n\nEnums:\n- rarity: normal, magic, rare, unique, epic, legendary, mythical, empyrean\n- possession: observed, owned, removed\n- location: inventory, equipped, storage, unknown\n- theme: arcane, forged, oriental, clockwork, synthetic, celestial, organic\n- affinity/affinity2: fire, ice, lightning, wind, earth, light, dark, poison, blood, void\n- condition: blessed, cursed, corrupted, glitched, sealed\n\nExplicit narrative numbers and named effects are authoritative and must be copied without replacing them with rarity defaults. Only when a full appraisal clearly establishes power but gives no literal number may power use a numeric `minimum-maximum` fantasy-appraisal range: normal 10-99, magic 100-299, rare 300-699, unique 700-1499, epic 1500-3999, legendary 4000-9999, mythical 10000-29999, empyrean 30000-99999. Effect budget is a maximum, never a requirement to invent effects: normal 0-1, magic/rare 1-2, unique/epic 2-3, legendary+ 3. `theme` is visual culture, not material: East Asian wuxia/xianxia items are oriental even when forged from metal. Emit affinity only when the narrative or established item identity supports it; never invent an element as decoration.\n\nDo not output HTML, CSS, SVG, Markdown fences, generic `<itemx>` wrappers, or `[emoji 이름]` markers. Values must not contain `|` or `]`; use `;;` between effects and `::` between an effect name and description. Before finishing, verify that every event is complete, settled, uses an existing id where applicable, and does not displace another protocol's required final trailer.\n";
const ITEMX_PLUGIN_VERSION = '1.9.0-beta.21';
const ITEMX_VERSION_LABEL = '1.9 · BETA 21';
const ITEMX_UPDATE_URL = 'https://raw.githubusercontent.com/canister2668/itemx2/main/dist/itemx2.plugin.js';
const ITEMX_UPDATE_CACHE_KEY = 'itemx2:update-check';
const ITEMX_UPDATE_CHECK_MS = 30 * 60 * 1000;
const ITEMX_MANUAL_KEY = '$__itemx2_manual_events';
const ITEMX_MESSAGE_EVENT_KEY = '$__itemx2_message_events';
const ITEMX_AUX_KEY = '$__itemx2_aux_processed';
const ITEMX_REF_RE = /<!--ITEMX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->/g;
const ITEMX_CODEX_REF_RE = /<!--CODEX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->/g;
const ITEMX_AUX_SETTLE_MS = 1500;
const ITEMX_ROOT_PAGE_SIZE = 16;
const ITEMX_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="176" viewBox="0 0 48 176" role="img" aria-label="ITEMX CODEX"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#1b2940"/><stop offset="1" stop-color="#090d17"/></linearGradient><filter id="s" x="-40%" y="-20%" width="180%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-opacity=".52"/></filter></defs><g filter="url(#s)"><rect x="1" y="1" width="46" height="174" rx="10" fill="url(#g)" stroke="#536684" stroke-width="1.2"/><path d="M2 35h44M2 141h44" stroke="#263650" stroke-width="1"/></g><text x="24" y="26" text-anchor="middle" font-size="17">📦</text><text x="24" y="88" text-anchor="middle" dominant-baseline="middle" transform="rotate(90 24 88)" fill="#f1f5fc" font-family="Arial,sans-serif" font-size="10.5" font-weight="900" letter-spacing="2">CODEX</text><path d="M17 154h14M24 147v14" fill="none" stroke="#9abcf4" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const ITEMX_BADGE_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ITEMX_BADGE_SVG)}`;

(async () => {
  'use strict';
  const queues = new Map();
  const ui = { tab: 'inventory', filter: 'all', query: '', selected: null, selectedSkill: null, selectedMonster: null, manageId: null, motion: true };
  const runtime = {
    latestMarkers: new Set(), latestOutput: '', pendingMarkers: new Set(), pendingMarkersAt: 0, eventPayloads: new Map(), markerHtmlCache: new Map(), detailHtmlCache: new Map(), settingsCache: new Map(), settingsLoadPromises: new Map(), cachedLoaded: null, cachedGeneration: -1, portraitCache: new Map(), portraitCacheBytes: 0, mainStyle: null, mainStylePosition: '', mainDoc: null, rootDrawer: null, rootFingerprint: '', rootContentReady: false, activeRootTab: 'inventory', rootItemPage: 0, rootTabBusy: false, rootClickBusy: false, rootClickOwner: null, rootClickBindings: [], bodyFxEventOwner: null, bodyFxEventIds: [], bodyFxClassOwner: null, bodyFxStartTimer: null, bodyFxScrollTimer: null, bodyFxScrollActive: false, uiParts: [], generation: 0, remountTimer: null, remountFallbackAt: 0, catchUpTimer: null, updateTimer: null, hostObserver: null, hostSyncTimer: null, hostSyncBusy: false, feedbackTimer: null, catchUpFingerprint: '', catchUpFailedFingerprint: '', catchUpFailures: 0, catchUpRetryAt: 0, auxCandidateFingerprint: '', auxCandidateSince: 0, auxCandidateChecks: 0, legacyCommitTimer: null, remounting: false, hookInstallPromise: null, connectionBusy: false, settingChangeBusy: false, auxRecoveryPromise: null,
    status: 'UI 준비', lastDomError: '', lastHookError: '', hooks: { process: false, output: false, display: false, before: false, after: false, listener: false },
    permissions: { replacer: null, mainDom: null, db: null }, badgePosition: 'lb', compactContainer: true, moduleAssetCache: { key: '', at: 0, rows: [] },
    panelOpen: false, panelTransition: 0, auxActive: 0, auxLabel: '보조 모델 처리 중', auxToastTimer: null, uiRemountAfter: 0, hostSettingsVisible: false, allowDrawerOverSettings: false, activeContextKey: '',
    auxLast: { state: 'idle', label: '아직 실행 기록 없음', at: 0, events: null }, update: { checking: false, checkedAt: 0, latest: '', available: false }, debugEnabled: false, visualEffectsEnabled: true, debugEntries: [], cleanupArmedUntil: 0
  };

  const log = (...args) => console.log('[ITEMX 2]', ...args);
  const debugRecord = (where, detail = '') => {
    if (!runtime.debugEnabled) return;
    const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
    runtime.debugEntries.push({ at: Date.now(), where: String(where), detail: String(text || '').slice(0, 500) });
    if (runtime.debugEntries.length > 30) runtime.debugEntries.splice(0, runtime.debugEntries.length - 30);
    console.log(`[ITEMX 2 · DEBUG] ${where}`, detail);
  };
  const fail = (where, error) => { debugRecord(`ERROR · ${where}`, error?.message || String(error)); console.error(`[ITEMX 2] ${where}`, error); };
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function withTimeout(promise, timeoutMs, message) {
    let timer = null;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => { timer = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs); })
      ]);
    } finally {
      if (timer) globalThis.clearTimeout(timer);
    }
  }
  function compareVersions(left, right) {
    const parse = (value) => {
      const [main, prerelease = ''] = String(value || '').trim().replace(/^v/i, '').split('-', 2);
      return { main: main.split('.').map((part) => Number.parseInt(part, 10) || 0), pre: prerelease ? prerelease.split('.') : [] };
    };
    const a = parse(left), b = parse(right);
    for (let index = 0; index < Math.max(a.main.length, b.main.length); index += 1) {
      const difference = (a.main[index] || 0) - (b.main[index] || 0);
      if (difference) return difference > 0 ? 1 : -1;
    }
    if (!a.pre.length || !b.pre.length) return a.pre.length === b.pre.length ? 0 : a.pre.length ? -1 : 1;
    for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index += 1) {
      if (a.pre[index] == null || b.pre[index] == null) return a.pre[index] == null ? -1 : 1;
      if (a.pre[index] === b.pre[index]) continue;
      const aNumber = /^\d+$/.test(a.pre[index]) ? Number(a.pre[index]) : null;
      const bNumber = /^\d+$/.test(b.pre[index]) ? Number(b.pre[index]) : null;
      if (aNumber != null && bNumber != null) return aNumber > bNumber ? 1 : -1;
      if (aNumber != null || bNumber != null) return aNumber != null ? -1 : 1;
      return a.pre[index] > b.pre[index] ? 1 : -1;
    }
    return 0;
  }
  async function syncUpdateIndicator() {
    if (!runtime.mainDoc || !runtime.rootDrawer) return;
    try {
      const current = await runtime.mainDoc.querySelector('.x-risu-itemx2-update-indicator');
      const currentLabel = await runtime.mainDoc.querySelector('.x-risu-itemx2-update-label');
      if (!runtime.update.available) {
        if (current) await current.remove();
        if (currentLabel) await currentLabel.remove();
        return;
      }
      if (current) {
        await current.setAttribute('x-itemx2-update', runtime.update.latest);
      } else {
        const badge = await runtime.mainDoc.querySelector('.x-risu-itemx2-native-badge');
        if (badge) {
          const indicator = await runtime.mainDoc.createElement('span');
          await indicator.setClassName('x-risu-itemx2-update-indicator');
          await indicator.setAttribute('x-itemx2-update', runtime.update.latest);
          await indicator.setTextContent('↑');
          await badge.appendChild(indicator);
        }
      }
      if (!currentLabel) {
        const eyebrow = await runtime.mainDoc.querySelector('.x-risu-itemx-ph-eyebrow');
        if (eyebrow) {
          const label = await runtime.mainDoc.createElement('span');
          await label.setClassName('x-risu-itemx2-update-label');
          await label.setAttribute('x-itemx2-update', runtime.update.latest);
          await label.setTextContent('UPDATE');
          await eyebrow.appendChild(label);
        }
      }
    } catch (error) { fail('update indicator', error); }
  }
  async function checkForUpdate() {
    if (runtime.update.checking || !runtime.activeContextKey || typeof Risuai.nativeFetch !== 'function') return;
    runtime.update.checking = true;
    try {
      let cached = null;
      try { cached = JSON.parse(await Risuai.safeLocalStorage.getItem(ITEMX_UPDATE_CACHE_KEY) || 'null'); } catch {}
      if (cached?.latest) {
        runtime.update.checkedAt = Number(cached.checkedAt) || 0;
        runtime.update.latest = String(cached.latest);
        runtime.update.available = compareVersions(runtime.update.latest, ITEMX_PLUGIN_VERSION) > 0;
        await syncUpdateIndicator();
      }
      if (Date.now() - runtime.update.checkedAt < ITEMX_UPDATE_CHECK_MS) return;
      const response = await withTimeout(Risuai.nativeFetch(ITEMX_UPDATE_URL, {
        method: 'GET', headers: { Range: 'bytes=0-2047' }, cache: 'no-store'
      }), 6000, '업데이트 확인 시간이 초과되었습니다');
      if (!response?.ok) throw new Error(`업데이트 서버 응답 ${response?.status || '없음'}`);
      const header = String(await response.text() || '');
      const latest = header.match(/^\/\/@version\s+([^\s]+)\s*$/m)?.[1] || '';
      if (!latest) throw new Error('업데이트 버전 헤더를 찾지 못했습니다');
      runtime.update.checkedAt = Date.now();
      runtime.update.latest = latest;
      runtime.update.available = compareVersions(latest, ITEMX_PLUGIN_VERSION) > 0;
      try {
        await Risuai.safeLocalStorage.setItem(ITEMX_UPDATE_CACHE_KEY, JSON.stringify({ checkedAt: runtime.update.checkedAt, latest }));
      } catch {}
      await syncUpdateIndicator();
    } catch (error) {
      debugRecord('update check', error?.message || String(error));
    } finally {
      runtime.update.checking = false;
    }
  }
  const messageData = (message) => ITEMXCore.messageText(message);
  const markerCodes = (text) => {
    const out = new Set();
    String(text || '').replace(ITEMXCore.MARKER_RE, (_, code) => { out.add(`ITEMX2:${code}`); return ''; });
    String(text || '').replace(ITEMXCodex.MARKER_RE, (_, code) => { out.add(`CODEX2:${code}`); return ''; });
    String(text || '').replace(ITEMX_REF_RE, (_, ref) => { out.add(`ITEMX2@${ref}`); return ''; });
    String(text || '').replace(ITEMX_CODEX_REF_RE, (_, ref) => { out.add(`CODEX2@${ref}`); return ''; });
    return out;
  };

  async function context() {
    try {
      const [characterIndex, chatIndex, character] = await Promise.all([
        Risuai.getCurrentCharacterIndex(), Risuai.getCurrentChatIndex(), Risuai.getCharacter()
      ]);
      if (characterIndex == null || chatIndex == null || !character) return null;
      const chat = await Risuai.getChatFromIndex(characterIndex, chatIndex);
      if (!chat) return null;
      return { characterIndex, chatIndex, character, chat, key: `${character.chaId || characterIndex}:${chat.id || chatIndex}` };
    } catch (error) {
      // PocketRisu has no current chatPage on Home. A globally loaded plugin
      // must treat that route as an idle state, not as an initialization error.
      if (!/chatPage|current chat|undefined/i.test(String(error?.message || error))) fail('active chat context', error);
      return null;
    }
  }

  const settingsId = (character) => character?.chaId || 'unknown';
  const cachedSettings = (character) => runtime.settingsCache.get(settingsId(character));
  function updateCachedSettings(character, patch) {
    const id = settingsId(character), current = runtime.settingsCache.get(id);
    if (current) runtime.settingsCache.set(id, { ...current, ...patch });
    if ('effectsEnabled' in patch) runtime.visualEffectsEnabled = Boolean(patch.effectsEnabled);
  }

  async function outputSettings(character, { refresh = false } = {}) {
    const id = character?.chaId || 'unknown';
    if (!refresh && runtime.settingsCache.has(id)) return { ...runtime.settingsCache.get(id) };
    if (!refresh && runtime.settingsLoadPromises.has(id)) return { ...(await runtime.settingsLoadPromises.get(id)) };
    const loading = Promise.all([
      Risuai.pluginStorage.getItem(`enabled:${id}`),
      Risuai.pluginStorage.getItem(`mainOutput:${id}`),
      Risuai.pluginStorage.getItem(`auxOutput:${id}`),
      Risuai.pluginStorage.getItem(`rarityMode:${id}`),
      Risuai.pluginStorage.getItem(`itemsEnabled:${id}`),
      Risuai.pluginStorage.getItem(`skillsEnabled:${id}`),
      Risuai.pluginStorage.getItem(`encountersEnabled:${id}`),
      Risuai.pluginStorage.getItem(`debugEnabled:${id}`),
      Risuai.pluginStorage.getItem(`effectsEnabled:${id}`),
      Risuai.pluginStorage.getItem(`fontScale:${id}`),
      Risuai.pluginStorage.getItem(`moduleAssetsEnabled:${id}`)
    ]).then(([enabled, main, aux, rarity, items, skills, encounters, debug, effects, fontScale, moduleAssets]) => {
      const settings = {
        enabled: enabled !== '0', mainOutput: main !== '0',
        auxOutput: ['off', 'missing', 'always'].includes(aux) ? aux : 'missing',
        rarityMode: ['world', 'itemx'].includes(rarity) ? rarity : 'world',
        itemsEnabled: items !== '0', skillsEnabled: skills !== '0', encountersEnabled: encounters !== '0', debugEnabled: debug === '1',
        effectsEnabled: effects !== '0',
        fontScale: ['small', 'medium', 'large'].includes(fontScale) ? fontScale : 'small',
        moduleAssetsEnabled: moduleAssets === '1'
      };
      runtime.settingsCache.set(id, settings);
      runtime.visualEffectsEnabled = settings.effectsEnabled;
      return settings;
    }).finally(() => runtime.settingsLoadPromises.delete(id));
    runtime.settingsLoadPromises.set(id, loading);
    return { ...(await loading) };
  }

  async function isEnabled(character) {
    return (cachedSettings(character) || await outputSettings(character)).enabled;
  }

  async function setEnabled(character, value) {
    await Risuai.pluginStorage.setItem(`enabled:${settingsId(character)}`, value ? '1' : '0');
    updateCachedSettings(character, { enabled: Boolean(value) });
  }

  async function setDomainEnabled(character, domain, value) {
    const keys = { items: 'itemsEnabled', skills: 'skillsEnabled', encounters: 'encountersEnabled' };
    if (!keys[domain]) throw new Error('Invalid ITEMX domain');
    await Risuai.pluginStorage.setItem(`${keys[domain]}:${character?.chaId || 'unknown'}`, value ? '1' : '0');
    updateCachedSettings(character, { [keys[domain]]: Boolean(value) });
    runtime.catchUpFingerprint = ''; runtime.catchUpFailedFingerprint = ''; runtime.auxCandidateFingerprint = '';
  }

  async function setDebugEnabled(character, value) {
    runtime.debugEnabled = Boolean(value);
    await Risuai.pluginStorage.setItem(`debugEnabled:${character?.chaId || 'unknown'}`, value ? '1' : '0');
    updateCachedSettings(character, { debugEnabled: Boolean(value) });
    debugRecord('debug', value ? 'enabled' : 'disabled');
  }

  async function setMainOutput(character, value) {
    await Risuai.pluginStorage.setItem(`mainOutput:${character?.chaId || 'unknown'}`, value ? '1' : '0');
    updateCachedSettings(character, { mainOutput: Boolean(value) });
  }

  async function setAuxOutput(character, value) {
    if (!['off', 'missing', 'always'].includes(value)) throw new Error('Invalid auxiliary output mode');
    await Risuai.pluginStorage.setItem(`auxOutput:${character?.chaId || 'unknown'}`, value);
    updateCachedSettings(character, { auxOutput: value });
    runtime.catchUpFingerprint = ''; runtime.catchUpFailedFingerprint = ''; runtime.auxCandidateFingerprint = '';
  }

  async function setRarityMode(character, value) {
    if (!['world', 'itemx'].includes(value)) throw new Error('Invalid rarity mode');
    await Risuai.pluginStorage.setItem(`rarityMode:${character?.chaId || 'unknown'}`, value);
    updateCachedSettings(character, { rarityMode: value });
  }

  async function setEffectsEnabled(character, value) {
    await Risuai.pluginStorage.setItem(`effectsEnabled:${settingsId(character)}`, value ? '1' : '0');
    updateCachedSettings(character, { effectsEnabled: Boolean(value) });
    runtime.markerHtmlCache.clear();
    runtime.detailHtmlCache.clear();
    await syncMainEffectsState();
  }

  async function setFontScale(character, value) {
    if (!['small', 'medium', 'large'].includes(value)) throw new Error('Invalid font scale');
    await Risuai.pluginStorage.setItem(`fontScale:${settingsId(character)}`, value);
    updateCachedSettings(character, { fontScale: value });
    await syncRootFontScale(value);
  }

  async function setModuleAssetsEnabled(character, value) {
    await Risuai.pluginStorage.setItem(`moduleAssetsEnabled:${settingsId(character)}`, value ? '1' : '0');
    updateCachedSettings(character, { moduleAssetsEnabled: Boolean(value) });
    runtime.moduleAssetCache = { key: '', at: 0, rows: [] };
  }

  const AUX_LABELS = { off: '끔', missing: '누락 시', always: '항상 검토' };
  const RARITY_MODE_LABELS = { world: '세계관 우선', itemx: 'ITEMX 강제' };

  function itemxProtocolText(rarityMode = 'world') {
    const policy = rarityMode === 'itemx'
      ? `## ITEMX Rarity Policy: FORCED\nITEMX rarity is an internal relative power and visual tier, not necessarily the world's printed grade name. Preserve the setting's local grade wording in display. An explicit user-requested ITEMX tier always wins. When the narrative conclusively establishes a newly appraised item as the setting's absolute highest grade, ultimate pinnacle, server/world-unique apex, or beyond the existing grade system, emit rarity=empyrean even if the setting calls that grade Epic; keep the local wording and distinction in display. Use mythical or legendary for clearly lower relative standings. Do not promote from ornate prose alone: the apex standing must be settled by the narrative.`
      : `## ITEMX Rarity Policy: WORLD FIRST\nTreat the setting's literal item grade as authoritative. Map its stated grade to the nearest literal ITEMX rarity and do not promote it merely because it is described as the setting's best. Preserve the local grade wording in display.`;
    return `${ITEMX_PROTOCOL_TEXT}\n\n${policy}`;
  }

  const enabledCodexDomains = (settings) => [settings.skillsEnabled && 'skill', settings.encountersEnabled && 'monster'].filter(Boolean);
  const stripItemTransport = (content) => ITEMXCore.extractResponse(String(content || ''), ITEMXCore.newRegistry()).content.replace(ITEMXCore.MARKER_RE, '');
  const stripAllTransport = (content) => ITEMXCodex.extractResponse(stripItemTransport(content), ITEMXCodex.snapshot(), { enabledDomains: [] }).content.replace(ITEMXCodex.MARKER_RE, '');
  const OWNED_TRANSPORT_HINT_RE = /<!--(?:ITEMX2|CODEX2)(?::|@)|<\/?(?:itemExam|itemPatch|itemx|skillExam|skillPatch|monsterExam|monsterPatch)\b|\[(?:itemx|아이템)\s*:/i;
  function processTransportStripper(content) {
    const source = String(content || '');
    if (!OWNED_TRANSPORT_HINT_RE.test(source)) return source;
    return stripAllTransport(source)
      .replace(ITEMX_REF_RE, '')
      .replace(ITEMX_CODEX_REF_RE, '')
      .replace(/\[(?:itemx|아이템)\s*:[^\]\r\n]{0,2048}\]/gi, '');
  }
  function combinedPortraitAssets(character, moduleAssets = [], max = 400) {
    const rows = ITEMXCodex.assetCatalog(character, max, true), seen = new Set(rows.map((row) => row.name));
    for (const row of moduleAssets || []) {
      if (rows.length >= max || !row?.name || !row?.id || seen.has(row.name)) continue;
      seen.add(row.name); rows.push(row);
    }
    return rows;
  }

  async function modulePortraitAssets(settings, character, chat) {
    if (!settings?.moduleAssetsEnabled || typeof Risuai.getDatabase !== 'function') return [];
    const key = `${character?.chaId || character?.id || 'character'}:${chat?.id || 'chat'}`;
    if (runtime.moduleAssetCache.key === key && Date.now() - runtime.moduleAssetCache.at < 30000) return runtime.moduleAssetCache.rows;
    try {
      const database = await Risuai.getDatabase(['modules', 'enabledModules', 'moduleIntergration', 'personas', 'selectedPersona']);
      if (!database) { runtime.permissions.db = false; runtime.moduleAssetCache = { key, at: Date.now(), rows: [] }; return []; }
      runtime.permissions.db = true;
      const rows = ITEMXCodex.activeModuleAssetCatalog(database, character, chat, 400);
      runtime.moduleAssetCache = { key, at: Date.now(), rows };
      return rows;
    } catch (error) {
      runtime.permissions.db = false;
      runtime.moduleAssetCache = { key, at: Date.now(), rows: [] };
      debugRecord('module portrait assets', error?.message || String(error));
      return [];
    }
  }

  async function enableModuleAssets(character, chat) {
    if (typeof Risuai.getDatabase !== 'function') return false;
    try {
      if (typeof Risuai.requestPluginPermission === 'function' && await Risuai.requestPluginPermission('db') !== true) {
        runtime.permissions.db = false; return false;
      }
      const probe = await Risuai.getDatabase(['modules', 'enabledModules', 'moduleIntergration', 'personas', 'selectedPersona']);
      if (!probe) { runtime.permissions.db = false; return false; }
      runtime.permissions.db = true;
      await setModuleAssetsEnabled(character, true);
      runtime.moduleAssetCache = { key: `${character?.chaId || character?.id || 'character'}:${chat?.id || 'chat'}`, at: Date.now(), rows: ITEMXCodex.activeModuleAssetCatalog(probe, character, chat, 400) };
      return true;
    } catch (error) {
      runtime.permissions.db = false;
      debugRecord('module portrait permission', error?.message || String(error));
      return false;
    }
  }

  function protocolForSettings(settings, character, moduleAssets = []) {
    const parts = [];
    if (settings.itemsEnabled) parts.push(itemxProtocolText(settings.rarityMode));
    const domains = enabledCodexDomains(settings);
    if (domains.length) {
      const characterLimit = moduleAssets.length ? 120 : 240;
      const portraitRows = ITEMXCodex.assetCatalog(character, characterLimit, true), seen = new Set(portraitRows.map((row) => row.name));
      for (const row of moduleAssets) { if (!seen.has(row.name)) { seen.add(row.name); portraitRows.push(row); } }
      parts.push(ITEMXCodex.protocol(portraitRows.map((row) => row.name), { enabledDomains: domains, rarityMode: settings.rarityMode }));
    }
    return parts.join('\n\n');
  }

  const BADGE_POSITIONS = [
    ['lb', '좌하'], ['lm', '좌중'], ['lt', '좌상'],
    ['rb', '우하'], ['rm', '우중'], ['rt', '우상']
  ];

  async function loadBadgePosition() {
    const saved = await Risuai.pluginStorage.getItem('badgePosition');
    if (BADGE_POSITIONS.some(([value]) => value === saved)) runtime.badgePosition = saved;
  }

  function badgeStyle() {
    const positions = {
      lb: 'left:4px!important;right:auto!important;top:auto!important;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px))!important;transform:none!important;border-radius:0 8px 8px 0!important',
      lm: 'left:4px!important;right:auto!important;top:50%!important;bottom:auto!important;transform:translateY(-50%)!important;border-radius:0 8px 8px 0!important',
      lt: 'left:4px!important;right:auto!important;top:calc(4.5rem + env(safe-area-inset-top,0px))!important;bottom:auto!important;transform:none!important;border-radius:0 8px 8px 0!important',
      rb: 'right:4px!important;left:auto!important;top:auto!important;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px))!important;transform:none!important;border-radius:8px 0 0 8px!important',
      rm: 'right:4px!important;left:auto!important;top:50%!important;bottom:auto!important;transform:translateY(-50%)!important;border-radius:8px 0 0 8px!important',
      rt: 'right:4px!important;left:auto!important;top:calc(4.5rem + env(safe-area-inset-top,0px))!important;bottom:auto!important;transform:none!important;border-radius:8px 0 0 8px!important'
    };
    const button = 'button[aria-label="ITEMX CODEX"],button[aria-label="ITEMX"],button:has(img[src*="ITEMX%20CODEX"]),button:has(img[src*="ITEMX%20inventory"])';
    const states = 'button[aria-label="ITEMX CODEX"]:hover,button[aria-label="ITEMX CODEX"]:active,button[aria-label="ITEMX CODEX"]:focus,button[aria-label="ITEMX"]:hover,button[aria-label="ITEMX"]:active,button[aria-label="ITEMX"]:focus,button:has(img[src*="ITEMX%20CODEX"]):hover,button:has(img[src*="ITEMX%20CODEX"]):active,button:has(img[src*="ITEMX%20CODEX"]):focus,button:has(img[src*="ITEMX%20inventory"]):hover,button:has(img[src*="ITEMX%20inventory"]):active,button:has(img[src*="ITEMX%20inventory"]):focus';
    const wrappers = 'button[aria-label="ITEMX CODEX"]>div,button[aria-label="ITEMX"]>div,button:has(img[src*="ITEMX%20CODEX"])>div,button:has(img[src*="ITEMX%20inventory"])>div';
    const images = 'button[aria-label="ITEMX CODEX"] img,button[aria-label="ITEMX"] img,button:has(img[src*="ITEMX%20CODEX"]) img[src*="ITEMX%20CODEX"],button:has(img[src*="ITEMX%20inventory"]) img[src*="ITEMX%20inventory"]';
    return `${button}{${positions[runtime.badgePosition] || positions.lb};display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;padding:0!important;overflow:visible!important;border:0!important;outline:0!important;background:none!important;background-color:transparent!important;box-shadow:none!important;cursor:pointer!important;touch-action:manipulation!important;z-index:50!important}${states}{background:none!important;background-color:transparent!important;box-shadow:none!important}${wrappers}{display:block!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;padding:0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important}${images}{display:block!important;box-sizing:border-box!important;width:48px!important;height:176px!important;min-width:48px!important;min-height:176px!important;max-width:48px!important;max-height:176px!important;border-radius:0!important;object-fit:contain!important}`;
  }

  const codexPageStyle = () => `
.itemx-codex-page-active{display:grid!important}
.itemx2-codex-card{position:relative;display:block;min-height:70px;border:1px solid #263247;border-radius:12px;background:linear-gradient(145deg,#121a28,#0b111b);overflow:hidden}.itemx2-codex-summary{position:relative;z-index:1;display:grid;grid-template-columns:48px minmax(0,1fr) minmax(72px,auto);gap:10px;align-items:center;min-height:70px;padding:10px;cursor:pointer}.itemx2-codex-glyph{display:grid;place-items:center;width:48px;height:48px;border:1px solid #40506b;border-radius:11px;background:#0b111c;color:#dbe8ff;font-size:1.2rem}.itemx2-codex-copy{display:grid;gap:3px;min-width:0}.itemx2-codex-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#edf2fb;font-size:.82rem}.itemx2-codex-copy small{color:#8494ad;font-size:.66rem}.itemx2-codex-tags{display:flex;flex-wrap:wrap;gap:4px}.itemx2-codex-tags i{padding:2px 5px;border:1px solid #344259;border-radius:999px;color:#aebbd0;font-size:.58rem;font-style:normal}.itemx2-skill-meta{display:grid;grid-template-columns:auto auto;gap:2px 5px;align-items:center;padding:6px 7px;border:1px solid #2e3a50;border-radius:9px;background:rgba(9,14,23,.82);font-size:.58rem}.itemx2-skill-meta small{color:#6f809a}.itemx2-skill-meta b{color:#dce6f5;font-size:.62rem;text-align:right}.itemx2-mastery{grid-column:2/-1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.itemx2-mastery i{height:5px;border-radius:6px;background:#202a3a}.itemx2-mastery i.on{background:linear-gradient(90deg,#66b8ff,#a985ff);box-shadow:0 0 8px rgba(102,184,255,.35)}.itemx2-bestiary-card.active{border-color:#70404a;box-shadow:inset 3px 0 #b55b68}.itemx2-bestiary-card img{width:48px;height:48px;border-radius:11px;object-fit:cover}
.itemx-codex-list{display:grid;gap:9px}.itemx-codex-list-button{width:100%;padding:0;border:0;color:inherit;text-align:left;font:inherit}.itemx2-codex-summary::after{content:'›';position:absolute;right:9px;bottom:5px;color:#71839f;font-size:.85rem;font-weight:900}.itemx-codex-page{position:relative;display:grid;gap:11px;min-height:100%;padding:2px 0 14px;animation:itemx-codex-page-in .22s cubic-bezier(.2,.78,.2,1) both}.itemx2-codex-page{display:none}.itemx2-codex-entry-choice:checked~.itemx2-codex-summary{display:none}.itemx2-codex-entry-choice:checked~.itemx2-codex-page{display:grid}.itemx2-root-skills:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-note,.itemx2-root-bestiary:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-note{display:none}.itemx2-root-skills:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-entry:not(:has(.itemx2-codex-entry-choice:checked)),.itemx2-root-bestiary:has(.itemx2-codex-entry-choice:checked)>.itemx2-codex-entry:not(:has(.itemx2-codex-entry-choice:checked)){display:none}.itemx-codex-back{justify-self:start;display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border:1px solid #2d3a50;border-radius:9px;background:#101824;color:#c8d4e7;cursor:pointer;font:inherit;font-size:.7rem;font-weight:800}.itemx-codex-hero{position:relative;isolation:isolate;display:grid;place-items:center;min-height:218px;padding:24px 18px 20px;overflow:hidden;border:1px solid #33435d;border-radius:17px;background:radial-gradient(circle at 50% 45%,rgba(91,150,255,.19),transparent 31%),linear-gradient(145deg,#121b2b,#080d16 70%);box-shadow:inset 0 0 45px rgba(63,116,205,.1),0 12px 34px rgba(0,0,0,.32)}.itemx-codex-hero::before,.itemx-codex-hero::after{content:'';position:absolute;left:50%;top:44%;z-index:-1;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}.itemx-codex-hero::before{width:158px;height:158px;border:1px solid rgba(113,181,255,.34);background:repeating-conic-gradient(from 0deg,rgba(128,195,255,.28) 0 2deg,transparent 2deg 28deg);mask:radial-gradient(circle,transparent 53%,#000 54% 58%,transparent 59%);animation:itemx-codex-orbit 8s linear infinite}.itemx-codex-hero::after{width:112px;height:112px;border:1px solid rgba(173,139,255,.32);box-shadow:0 0 42px rgba(76,142,255,.2),inset 0 0 26px rgba(151,105,255,.12);animation:itemx-codex-orbit-reverse 5.5s linear infinite}.itemx-codex-hero-glyph{position:relative;z-index:2;display:grid;place-items:center;width:82px;height:82px;border:1px solid rgba(177,210,255,.55);border-radius:24px;background:radial-gradient(circle at 45% 38%,#263e62,#101827 68%);box-shadow:0 0 25px rgba(94,164,255,.28),inset 0 0 22px rgba(132,184,255,.16);color:#eff7ff;font-size:2.6rem;text-shadow:0 0 14px rgba(142,202,255,.8)}.itemx-codex-hero-copy{position:relative;z-index:2;display:grid;gap:5px;margin-top:18px;text-align:center}.itemx-codex-hero-copy small{color:#8fa4c4;font-size:.65rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.itemx-codex-hero-copy strong{color:#f3f7ff;font-size:1.08rem}.itemx-codex-hero-copy span{color:#9eb0ca;font-size:.68rem}.itemx-codex-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.itemx-codex-stat{display:grid;gap:4px;min-height:60px;padding:10px;border:1px solid #26344a;border-radius:11px;background:linear-gradient(145deg,#111a28,#0b111b)}.itemx-codex-stat small{color:#70819b;font-size:.59rem;font-weight:800}.itemx-codex-stat strong{color:#e8effa;font-size:.72rem;overflow-wrap:anywhere}.itemx-codex-section{display:grid;gap:7px;padding:12px;border:1px solid #243147;border-radius:12px;background:#0c131e;color:#becadd;font-size:.7rem;line-height:1.58}.itemx-codex-section h4{margin:0;color:#d9e6f8;font-size:.67rem;letter-spacing:.08em}.itemx-codex-section p{margin:0;white-space:pre-wrap}.itemx-codex-chip-row{display:flex;flex-wrap:wrap;gap:5px}.itemx-codex-chip-row i{padding:4px 7px;border:1px solid #34445e;border-radius:999px;background:#111a28;color:#b8c7dd;font-size:.61rem;font-style:normal}.itemx-codex-mastery{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}.itemx-codex-mastery i{height:7px;border-radius:999px;background:#202b3c}.itemx-codex-mastery i.on{background:linear-gradient(90deg,#5cbcff,#a978ff);box-shadow:0 0 9px rgba(92,188,255,.42)}.itemx-monster-hero{border-color:#623743;background:radial-gradient(circle at 50% 40%,rgba(222,62,88,.2),transparent 34%),repeating-linear-gradient(0deg,transparent 0 22px,rgba(179,63,79,.035) 23px),linear-gradient(145deg,#211018,#090d14 72%);box-shadow:inset 0 0 54px rgba(190,39,64,.12),0 12px 34px rgba(0,0,0,.38)}.itemx-monster-hero::before{width:174px;height:174px;border-color:rgba(255,99,123,.36);background:repeating-conic-gradient(from 0deg,rgba(255,86,112,.32) 0 1.5deg,transparent 1.5deg 22deg);animation-duration:11s}.itemx-monster-hero::after{left:50%;top:18%;width:100%;height:2px;border:0;border-radius:0;background:linear-gradient(90deg,transparent,#ff667e,transparent);box-shadow:0 0 18px rgba(255,62,92,.7);transform:translate3d(-50%,0,0);will-change:transform,opacity;animation:itemx-codex-scan 3.2s ease-in-out infinite}.itemx-monster-portrait{position:relative;z-index:2;width:112px;height:112px;border:1px solid rgba(255,124,143,.58);border-radius:18px;object-fit:cover;box-shadow:0 0 0 5px rgba(93,24,35,.35),0 0 32px rgba(255,65,94,.3);filter:saturate(.86) contrast(1.06)}.itemx-monster-hero .itemx-codex-hero-glyph{border-color:rgba(255,124,143,.54);background:radial-gradient(circle at 45% 38%,#5a2632,#1b1018 70%);box-shadow:0 0 28px rgba(255,60,91,.3),inset 0 0 22px rgba(255,111,131,.12)}.itemx-threat-banner{position:absolute;left:10px;top:10px;z-index:3;padding:5px 8px;border:1px solid rgba(255,109,130,.48);border-radius:999px;background:rgba(41,10,17,.82);color:#ff9aab;font-size:.58rem;font-weight:900;letter-spacing:.12em}@keyframes itemx-codex-page-in{from{opacity:0;transform:translate3d(12px,0,0)}to{opacity:1;transform:none}}@keyframes itemx-codex-orbit{to{transform:translate(-50%,-50%) rotate(360deg)}}@keyframes itemx-codex-orbit-reverse{to{transform:translate(-50%,-50%) rotate(-360deg)}}@keyframes itemx-codex-scan{0%,100%{opacity:.2;transform:translate3d(-50%,0,0)}50%{opacity:1;transform:translate3d(-50%,132px,0)}}.itemx2-effects-off .itemx-fx,.itemx2-effects-off .itemx-cond,.itemx2-effects-off .itemx-codex-hero::before,.itemx2-effects-off .itemx-codex-hero::after,.itemx2-effects-off .itemx2-skill-card::after{display:none!important;animation:none!important}@media(prefers-reduced-motion:reduce){.itemx-codex-page,.itemx-codex-hero::before,.itemx-codex-hero::after{animation:none!important}}
.itemx2-font-small{--itemx-ui-scale:1}.itemx2-font-medium{--itemx-ui-scale:1.12}.itemx2-font-large{--itemx-ui-scale:1.25}.itemx2-font-small,.itemx2-font-medium,.itemx2-font-large{--itemx-text-xs:calc(.62rem * var(--itemx-ui-scale));--itemx-text-sm:calc(.70rem * var(--itemx-ui-scale));--itemx-text-md:calc(.82rem * var(--itemx-ui-scale));--itemx-text-lg:calc(1.08rem * var(--itemx-ui-scale))}.itemx2-codex-copy strong{font-size:var(--itemx-text-md,.82rem)}.itemx-codex-hero-copy strong{font-size:var(--itemx-text-lg,1.08rem)}.itemx-codex-section{font-size:var(--itemx-text-sm,.7rem)}
.itemx2-codex-fx{position:absolute;pointer-events:none;contain:paint;--fx:#78b9ff;--fx2:#a77fff;--fx3:#eef7ff;--fx-speed:8s}.itemx2-codex-list-fx{z-index:0;inset:0;overflow:hidden;opacity:.82;animation:none}.itemx2-codex-hero-fx{z-index:0;inset:0;overflow:hidden}.itemx2-codex-hero-fx i,.itemx2-codex-hero-fx b,.itemx2-codex-hero-fx em{position:absolute;display:block;font-style:normal;pointer-events:none}.itemx-skill-hero::before,.itemx-skill-hero::after{display:none!important}
.itemx2-skill-theme-fire{--fx:#ff7a3d;--fx2:#ffd067}.itemx2-skill-theme-ice{--fx:#72d8f4;--fx2:#a7b9ff}.itemx2-skill-theme-lightning{--fx:#9fc6ff;--fx2:#f2e773}.itemx2-skill-theme-dark{--fx:#9169df;--fx2:#d166df}.itemx2-skill-theme-light{--fx:#f7e6b2;--fx2:#fff}.itemx2-skill-theme-arcane{--fx:#789cff;--fx2:#b07be9}
.itemx2-skill-list-fx{opacity:.44;background:radial-gradient(ellipse at 91% 52%,color-mix(in srgb,var(--fx) 24%,transparent),transparent 39%)}.itemx2-skill-theme-fire.itemx2-skill-list-fx{background:radial-gradient(ellipse at 92% 78%,rgba(255,84,31,.3),transparent 39%),linear-gradient(158deg,transparent 68%,rgba(255,192,75,.16))}.itemx2-skill-theme-ice.itemx2-skill-list-fx{background:linear-gradient(128deg,transparent 69%,rgba(188,242,255,.2) 70% 78%,transparent 79%),radial-gradient(ellipse at 92% 45%,rgba(74,175,223,.17),transparent 38%)}.itemx2-skill-theme-lightning.itemx2-skill-list-fx{background:linear-gradient(117deg,transparent 70%,rgba(242,235,99,.42) 71% 72%,transparent 73% 77%,rgba(125,183,255,.3) 78% 79%,transparent 80%)}.itemx2-skill-theme-dark.itemx2-skill-list-fx{background:radial-gradient(ellipse at 90% 52%,rgba(6,3,14,.8),transparent 42%),radial-gradient(ellipse at 96% 46%,rgba(134,65,180,.24),transparent 33%)}.itemx2-skill-theme-light.itemx2-skill-list-fx{background:radial-gradient(ellipse at 91% 49%,rgba(255,246,214,.28),transparent 40%),linear-gradient(112deg,transparent 73%,rgba(245,216,143,.15))}.itemx2-skill-theme-arcane.itemx2-skill-list-fx{background:radial-gradient(ellipse at 91% 51%,rgba(78,117,211,.22),transparent 39%),radial-gradient(circle at 84% 34%,rgba(189,145,239,.55) 0 1px,transparent 2px),radial-gradient(circle at 95% 70%,rgba(117,189,242,.48) 0 1px,transparent 2px)}
.itemx2-skill-rank-normal.itemx2-skill-list-fx{opacity:.2}.itemx2-skill-rank-magic.itemx2-skill-list-fx{opacity:.34}.itemx2-skill-rank-rare.itemx2-skill-list-fx{opacity:.48}.itemx2-skill-rank-unique.itemx2-skill-list-fx{opacity:.62}.itemx2-skill-rank-epic.itemx2-skill-list-fx{opacity:.72}.itemx2-skill-rank-legendary.itemx2-skill-list-fx,.itemx2-skill-rank-mythical.itemx2-skill-list-fx,.itemx2-skill-rank-empyrean.itemx2-skill-list-fx{opacity:.86}
.itemx-skill-hero{border-color:color-mix(in srgb,var(--rk) 45%,#33435d);background:radial-gradient(ellipse at 50% 46%,color-mix(in srgb,var(--p) 15%,transparent),transparent 38%),linear-gradient(145deg,#141a28,#080c14 74%);box-shadow:inset 0 0 48px color-mix(in srgb,var(--pg) 26%,transparent),0 12px 34px rgba(0,0,0,.38)}.itemx-skill-hero .itemx2-skill-weapon-fx{z-index:0}.itemx-skill-hero .itemx-codex-hero-glyph{width:92px;height:92px;border-color:color-mix(in srgb,var(--rk) 62%,#58667d);border-radius:26px;background:radial-gradient(circle at 43% 36%,color-mix(in srgb,var(--p) 32%,#26364e),#0b111c 70%);box-shadow:0 0 0 4px color-mix(in srgb,var(--rk) 10%,transparent),0 0 34px color-mix(in srgb,var(--pg) 62%,transparent),inset 0 0 24px color-mix(in srgb,var(--p) 18%,transparent);text-shadow:0 0 17px color-mix(in srgb,var(--p) 80%,transparent)}.itemx-skill-hero.itemx2-skill-rank-normal .itemx-fx{opacity:.3}.itemx-skill-hero.itemx2-skill-rank-magic .itemx-fx{opacity:.48}.itemx-skill-hero.itemx2-skill-rank-rare .itemx-fx{opacity:.66}.itemx-skill-hero.itemx2-skill-rank-unique .itemx-fx{opacity:.82}.itemx-skill-hero.itemx2-skill-rank-epic .itemx-fx,.itemx-skill-hero.itemx2-skill-rank-legendary .itemx-fx,.itemx-skill-hero.itemx2-skill-rank-mythical .itemx-fx,.itemx-skill-hero.itemx2-skill-rank-empyrean .itemx-fx{opacity:1}.itemx-skill-hero.itemx2-skill-rank-legendary,.itemx-skill-hero.itemx2-skill-rank-mythical,.itemx-skill-hero.itemx2-skill-rank-empyrean{box-shadow:inset 0 0 58px color-mix(in srgb,var(--pg) 40%,transparent),0 15px 40px rgba(0,0,0,.42),0 0 22px color-mix(in srgb,var(--rk) 18%,transparent)}.itemx2-skill-type-passive .itemx-fx{opacity:.72}.itemx2-skill-type-sealed .itemx-fx,.itemx2-skill-status-sealed .itemx-fx{opacity:.3;filter:saturate(.42) brightness(.68)}.itemx2-skill-status-equipped .itemx-codex-hero-glyph{box-shadow:0 0 0 4px color-mix(in srgb,var(--rk) 16%,transparent),0 0 42px color-mix(in srgb,var(--pg) 78%,transparent),inset 0 0 24px color-mix(in srgb,var(--p) 22%,transparent)}.itemx2-skill-status-lost .itemx-fx{opacity:.12;filter:grayscale(.86) brightness(.5)}.itemx2-skill-status-lost .itemx-fx *{animation:none!important}
.itemx-monster-hero{border-color:#623743;background:radial-gradient(circle at 50% 40%,rgba(222,62,88,.2),transparent 34%),repeating-linear-gradient(0deg,transparent 0 22px,rgba(179,63,79,.035) 23px),linear-gradient(145deg,#211018,#090d14 72%);box-shadow:inset 0 0 54px rgba(190,39,64,.12),0 12px 34px rgba(0,0,0,.38)}.itemx-monster-hero::before{width:174px;height:174px;border-color:rgba(255,99,123,.36);background:repeating-conic-gradient(from 0deg,rgba(255,86,112,.32) 0 1.5deg,transparent 1.5deg 22deg);animation-duration:11s}.itemx-monster-hero::after{left:50%;top:18%;width:100%;height:2px;border:0;border-radius:0;background:linear-gradient(90deg,transparent,#ff667e,transparent);box-shadow:0 0 18px rgba(255,62,92,.7);transform:translate3d(-50%,0,0);animation:itemx-codex-scan 3.2s ease-in-out infinite}.itemx-monster-portrait{filter:saturate(.86) contrast(1.06)}.itemx-monster-hero .itemx-codex-hero-glyph{border-color:rgba(255,124,143,.54);background:radial-gradient(circle at 45% 38%,#5a2632,#1b1018 70%);box-shadow:0 0 28px rgba(255,60,91,.3),inset 0 0 22px rgba(255,111,131,.12)}
.itemx2-encounter-hero-fx{--fx:#bf687a;--fx2:#73849f;--fx-duration:6s}.itemx2-encounter-hero-fx i{inset:12% 18%;border:1px solid color-mix(in srgb,var(--fx) 48%,transparent);border-radius:50%;box-shadow:0 0 30px color-mix(in srgb,var(--fx) 25%,transparent);animation:itemx2-codex-spin var(--fx-duration) linear infinite}.itemx2-encounter-hero-fx b{inset:27% 8%;background:repeating-conic-gradient(from 20deg,color-mix(in srgb,var(--fx2) 32%,transparent) 0 2deg,transparent 2deg 31deg);mask:radial-gradient(circle,transparent 54%,#000 56% 58%,transparent 60%);animation:itemx2-codex-spin calc(var(--fx-duration) * 1.45) linear infinite reverse}.itemx2-encounter-hero-fx em{left:8%;right:8%;bottom:5%;height:34%;background:radial-gradient(ellipse at 50% 100%,color-mix(in srgb,var(--fx) 28%,transparent),transparent 68%);filter:blur(8px);animation:itemx2-codex-breathe calc(var(--fx-duration) * .75) ease-in-out infinite}
.itemx2-encounter-theme-beast{--fx:#e7aa61;--fx2:#d85d4d}.itemx2-encounter-theme-undead{--fx:#8ed9c2;--fx2:#7c62a8}.itemx2-encounter-theme-construct{--fx:#75b9d6;--fx2:#b3ccd4}.itemx2-encounter-theme-dragon{--fx:#ff674b;--fx2:#efb74e}.itemx2-encounter-theme-aquatic{--fx:#49c9dc;--fx2:#557fe9}.itemx2-encounter-theme-insect{--fx:#9bc15e;--fx2:#d8b85a}.itemx2-encounter-theme-humanoid,.itemx2-encounter-theme-unknown{--fx:#bf687a;--fx2:#73849f}.itemx2-encounter-list-fx{opacity:.82;animation:itemx2-codex-breathe 6s ease-in-out infinite}.itemx2-encounter-theme-beast.itemx2-encounter-list-fx{background:linear-gradient(115deg,transparent 68%,color-mix(in srgb,var(--fx) 20%,transparent)),repeating-linear-gradient(70deg,transparent 0 13px,color-mix(in srgb,var(--fx2) 14%,transparent) 14px 15px)}.itemx2-encounter-theme-undead.itemx2-encounter-list-fx,.itemx2-encounter-theme-aquatic.itemx2-encounter-list-fx{background:radial-gradient(ellipse at 85% 80%,color-mix(in srgb,var(--fx) 30%,transparent),transparent 48%)}.itemx2-encounter-theme-construct.itemx2-encounter-list-fx{background:repeating-linear-gradient(90deg,transparent 0 20px,color-mix(in srgb,var(--fx) 11%,transparent) 21px),repeating-linear-gradient(0deg,transparent 0 15px,color-mix(in srgb,var(--fx2) 8%,transparent) 16px)}.itemx2-encounter-theme-dragon.itemx2-encounter-list-fx{background:radial-gradient(circle at 90% 50%,color-mix(in srgb,var(--fx) 32%,transparent),transparent 38%)}.itemx2-encounter-theme-insect.itemx2-encounter-list-fx{background:radial-gradient(circle at 82% 32%,color-mix(in srgb,var(--fx) 30%,transparent) 0 2px,transparent 3px),radial-gradient(circle at 94% 61%,color-mix(in srgb,var(--fx2) 26%,transparent) 0 2px,transparent 3px)}.itemx2-threat-1{opacity:.88}.itemx2-threat-2{filter:brightness(1.12)}.itemx2-threat-3{filter:brightness(1.28) saturate(1.18)}.itemx2-encounter-warning .itemx2-encounter-hero-fx::after{content:'';position:absolute;left:0;right:0;top:12%;height:2px;background:linear-gradient(90deg,transparent,#ff637c,transparent);box-shadow:0 0 16px #ff3d60;animation:itemx2-codex-warning 3s ease-in-out infinite}.itemx2-encounter-sparring{--fx:#6eb8ee;--fx2:#d4b96a}.itemx2-encounter-ended{opacity:.34;filter:grayscale(.65)}.itemx2-encounter-ended,.itemx2-encounter-ended *{animation-play-state:paused!important}@keyframes itemx2-codex-spin{to{transform:rotate(360deg)}}@keyframes itemx2-codex-breathe{0%,100%{opacity:.42}50%{opacity:1}}@keyframes itemx2-codex-warning{0%,100%{opacity:.15;transform:translateY(0)}50%{opacity:.9;transform:translateY(130px)}}
.itemx2-encounter-outcome{position:relative;overflow:hidden;border-color:#453b31;background:radial-gradient(ellipse at 92% 14%,rgba(205,157,76,.11),transparent 42%),linear-gradient(145deg,#151711,#0d1118 72%)}.itemx2-encounter-outcome::after{content:'';position:absolute;right:-18px;bottom:-24px;width:98px;height:72px;border-radius:55% 45% 48% 52%;background:radial-gradient(ellipse,rgba(180,119,57,.13),transparent 68%);pointer-events:none}.itemx2-encounter-outcome-head{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px}.itemx2-encounter-outcome-head h4{color:#e8c98d}.itemx2-encounter-outcome-head i{padding:3px 7px;border:1px solid rgba(205,166,98,.28);border-radius:999px;background:rgba(55,43,23,.45);color:#d9bb82;font-size:.58rem;font-style:normal}.itemx2-encounter-outcome p{position:relative;z-index:1;color:#d3d8df}
@keyframes itemx2-fire-breathe{from{opacity:.52;transform:translate3d(-2px,5px,0) scale(.96,1)}to{opacity:.88;transform:translate3d(3px,-4px,0) scale(1.04,1.06)}}@keyframes itemx2-fire-embers{from{opacity:.2;transform:translate3d(0,12px,0)}45%{opacity:.8}to{opacity:.08;transform:translate3d(5px,-20px,0)}}@keyframes itemx2-ice-float{from{opacity:.42;transform:translate3d(-3px,3px,0) rotate(-1.2deg)}to{opacity:.68;transform:translate3d(3px,-3px,0) rotate(1.4deg)}}@keyframes itemx2-lightning-quiet{0%,15%,19%,71%,75%,100%{opacity:.45}16%,18%,72%,74%{opacity:.9}}@keyframes itemx2-lightning-strike{0%,12%,17%,63%,68%,100%{opacity:.08}13%,16%,64%,67%{opacity:.84}}@keyframes itemx2-dark-draw{from{opacity:.35;transform:translate3d(-3px,1px,0) scale(1.04)}to{opacity:.66;transform:translate3d(4px,-2px,0) scale(.94)}}@keyframes itemx2-light-drift{from{opacity:.3;transform:translate3d(-2px,2px,0) scale(.98)}to{opacity:.64;transform:translate3d(3px,-2px,0) scale(1.03)}}@keyframes itemx2-arcane-parallax{from{opacity:.38;transform:translate3d(-3px,2px,0)}to{opacity:.68;transform:translate3d(4px,-3px,0)}}@keyframes itemx2-undead-haze{from{opacity:.32;transform:translate3d(-5px,2px,0)}to{opacity:.58;transform:translate3d(6px,-2px,0)}}@keyframes itemx2-construct-scan{0%,100%{opacity:.18;transform:translateY(-20px)}50%{opacity:.78;transform:translateY(116px)}}@keyframes itemx2-aquatic-caustic{from{opacity:.34;transform:translate3d(-3px,2px,0)}to{opacity:.6;transform:translate3d(4px,-3px,0)}}@keyframes itemx2-insect-drift{from{opacity:.35;transform:translate3d(-3px,2px,0)}to{opacity:.57;transform:translate3d(4px,-2px,0)}}@keyframes itemx2-combat-warning{0%,100%{opacity:.12;transform:translateY(0)}50%{opacity:.78;transform:translateY(132px)}}
.itemx2-effects-off .itemx2-codex-fx{display:none!important;animation:none!important}.itemx2-effects-off .itemx2-codex-fx *{animation:none!important}@media(prefers-reduced-motion:reduce){.itemx2-codex-fx,.itemx2-codex-fx *,.itemx2-skill-weapon-fx,.itemx2-skill-weapon-fx *{animation:none!important}}
`;

  const rootDrawerStyle = () => `
.itemx2-root-drawer,.itemx2-root-drawer *{box-sizing:border-box}
.itemx2-root-drawer{--itemx-ui-scale:1;--itemx-text-xs:calc(.62rem * var(--itemx-ui-scale));--itemx-text-sm:calc(.70rem * var(--itemx-ui-scale));--itemx-text-md:calc(.82rem * var(--itemx-ui-scale));--itemx-text-lg:calc(1.08rem * var(--itemx-ui-scale));position:fixed;inset:0;z-index:49;pointer-events:none;font-family:Inter,Pretendard,"Noto Sans KR",sans-serif;color:#e6ebf4}.itemx2-root-drawer.itemx2-font-medium{--itemx-ui-scale:1.12}.itemx2-root-drawer.itemx2-font-large{--itemx-ui-scale:1.25}
.itemx2-root-control{position:fixed!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
.itemx2-native-badge{position:fixed;z-index:50;display:block;width:48px;height:176px;padding:0;overflow:visible;pointer-events:auto;cursor:pointer;touch-action:manipulation;background:transparent;border:0;box-shadow:none}
.itemx2-native-badge img{display:block;width:48px;height:176px;max-width:none;border:0;border-radius:0;pointer-events:none}
.itemx2-update-indicator{position:absolute;right:-2px;top:5px;z-index:2;display:grid;place-items:center;width:17px;height:17px;border:1px solid rgba(174,255,204,.8);border-radius:999px;background:#16834b;box-shadow:0 0 0 2px rgba(7,12,19,.88),0 3px 10px rgba(25,196,105,.38);color:#effff5;font-size:11px;font-weight:950;line-height:1;pointer-events:none}
.itemx2-update-label{display:inline-flex;margin-left:6px;padding:2px 5px;border:1px solid rgba(112,225,155,.46);border-radius:999px;background:rgba(20,107,61,.34);color:#94e9b3;font-size:8px;font-weight:950;letter-spacing:.08em;vertical-align:1px}
.itemx2-aux-status{position:fixed;z-index:52;display:none;align-items:center;gap:7px;min-height:34px;padding:0 11px;border:1px solid rgba(212,175,110,.48);border-radius:999px;background:rgba(9,13,23,.94);box-shadow:0 8px 24px rgba(0,0,0,.48),0 0 14px rgba(212,175,110,.14);color:#f0dfb9;font-size:11px;font-weight:800;white-space:nowrap;pointer-events:none}.itemx2-aux-status-on{display:flex}.itemx2-aux-status i{width:12px;height:12px;border:2px solid rgba(240,223,185,.24);border-top-color:#f0c979;border-radius:50%;animation:itemx2-aux-spin .8s linear infinite}
.itemx2-root-drawer.itemx2-pos-lb .itemx2-aux-status{left:58px;right:auto;top:auto;bottom:calc(5.2rem + 70px + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-lm .itemx2-aux-status{left:58px;right:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-lt .itemx2-aux-status{left:58px;right:auto;top:calc(4.5rem + 70px + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-rb .itemx2-aux-status{right:58px;left:auto;top:auto;bottom:calc(5.2rem + 70px + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-rm .itemx2-aux-status{right:58px;left:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-rt .itemx2-aux-status{right:58px;left:auto;top:calc(4.5rem + 70px + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-lb .itemx2-native-badge{left:4px;right:auto;top:auto;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-lm .itemx2-native-badge{left:4px;right:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-lt .itemx2-native-badge{left:4px;right:auto;top:calc(4.5rem + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-rb .itemx2-native-badge{right:4px;left:auto;top:auto;bottom:calc(5.2rem + env(safe-area-inset-bottom,0px));transform:none}.itemx2-root-drawer.itemx2-pos-rm .itemx2-native-badge{right:4px;left:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-rt .itemx2-native-badge{right:4px;left:auto;top:calc(4.5rem + env(safe-area-inset-top,0px));bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-lb .itemx2-root-panel{left:60px;right:auto;top:auto;bottom:12px;transform:none}.itemx2-root-drawer.itemx2-pos-lm .itemx2-root-panel{left:60px;right:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-lt .itemx2-root-panel{left:60px;right:auto;top:12px;bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-pos-rb .itemx2-root-panel{right:60px;left:auto;top:auto;bottom:12px;transform:none}.itemx2-root-drawer.itemx2-pos-rm .itemx2-root-panel{right:60px;left:auto;top:50%;bottom:auto;transform:translateY(-50%)}.itemx2-root-drawer.itemx2-pos-rt .itemx2-root-panel{right:60px;left:auto;top:12px;bottom:auto;transform:none}
.itemx2-root-drawer.itemx2-is-open .itemx2-native-badge{display:none}
.itemx2-root-drawer.itemx2-host-settings .itemx2-native-badge,.itemx2-root-drawer.itemx2-host-settings .itemx2-aux-status,.itemx2-root-drawer.itemx2-host-settings .itemx2-root-layer,.itemx2-root-drawer.itemx2-host-settings .itemx2-boot-card{display:none!important}
.itemx2-boot-card{position:fixed;left:50%;top:50%;z-index:53;display:flex;align-items:center;gap:11px;min-width:220px;max-width:calc(100vw - 32px);padding:14px 16px;border:1px solid rgba(212,175,110,.52);border-radius:14px;background:rgba(9,13,23,.96);box-shadow:0 18px 50px rgba(0,0,0,.58),0 0 22px rgba(212,175,110,.12);color:#f0dfb9;transform:translate(-50%,-50%);font-size:12px;font-weight:800}.itemx2-boot-card i{width:18px;height:18px;flex:0 0 auto;border:2px solid rgba(240,223,185,.22);border-top-color:#f0c979;border-radius:50%;animation:itemx2-aux-spin .8s linear infinite}.itemx2-boot-card span{display:grid;gap:2px}.itemx2-boot-card small{color:#8190a7;font-size:10px;font-weight:600}
.itemx2-feedback{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top,0px));z-index:54;max-width:calc(100vw - 32px);padding:9px 13px;border:1px solid #354157;border-radius:999px;background:rgba(9,13,23,.96);box-shadow:0 10px 30px rgba(0,0,0,.5);color:#dbe4f2;font-size:11px;font-weight:800;line-height:1.35;text-align:center;opacity:0;visibility:hidden;transform:translate(-50%,-7px);transition:opacity .14s ease,transform .14s ease,visibility 0s .14s;pointer-events:none}.itemx2-feedback-on{opacity:1;visibility:visible;transform:translate(-50%,0);transition:opacity .14s ease,transform .14s ease}.itemx2-feedback-success{border-color:#37634d;color:#a9e6c2}.itemx2-feedback-error{border-color:#61343a;color:#ffadb5}.itemx2-feedback-working{border-color:#6a5530;color:#e8c987}
.itemx2-root-layer{position:fixed;inset:0;pointer-events:none;visibility:visible;opacity:1;transition:opacity .16s ease,visibility 0s}
.itemx2-root-panel{position:fixed;display:flex;flex-direction:column;width:min(420px,calc(100vw - 66px));height:min(700px,72dvh);max-height:calc(100dvh - 24px);margin:0;overflow:hidden;pointer-events:auto;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.58)}
.itemx2-root-pos-lb{left:60px;bottom:12px}.itemx2-root-pos-lm{left:60px;top:50%;transform:translateY(-50%)}.itemx2-root-pos-lt{left:60px;top:12px}
.itemx2-root-pos-rb{right:60px;bottom:12px}.itemx2-root-pos-rm{right:60px;top:50%;transform:translateY(-50%)}.itemx2-root-pos-rt{right:60px;top:12px}
.itemx2-root-drawer.itemx2-is-open .itemx2-root-panel{animation:itemx2-root-in .19s cubic-bezier(.2,.78,.2,1) both}.itemx2-root-drawer:not(.itemx2-is-open) .itemx2-root-layer{opacity:0;visibility:hidden;transition:opacity .14s ease,visibility 0s .14s}
.itemx2-root-drawer:not(.itemx2-is-open) .itemx2-root-panel{pointer-events:none;animation:itemx2-root-out .14s ease both}
.itemx2-root-drawer:not(.itemx2-is-open) .itemx-card *{animation-play-state:paused!important}
.itemx2-root-close,.itemx2-root-back{cursor:pointer}.itemx2-root-empty{padding:2rem;text-align:center;color:#77839c}
.itemx-main-tabs{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #171d2b}.itemx-main-tab{min-height:44px;display:grid;place-items:center;border-bottom:2px solid transparent;background:#0d121c;color:#77839c;cursor:pointer;font-size:.72rem;font-weight:800}
.itemx2-root-skills,.itemx2-root-bestiary{display:none;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:12px;background:#090e16}.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-settings,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-settings{display:none}.itemx2-tab-skills:checked~.itemx2-root-layer .itemx2-root-skills,.itemx2-tab-bestiary:checked~.itemx2-root-layer .itemx2-root-bestiary{display:grid;align-content:start;gap:9px}.itemx2-tab-inventory:checked~.itemx2-root-layer label[for="itemx2-tab-inventory"],.itemx2-tab-skills:checked~.itemx2-root-layer label[for="itemx2-tab-skills"],.itemx2-tab-bestiary:checked~.itemx2-root-layer label[for="itemx2-tab-bestiary"],.itemx2-tab-settings:checked~.itemx2-root-layer label[for="itemx2-tab-settings"]{border-bottom-color:#d4af6e;color:#f3dcaa;background:#121925}
.itemx2-codex-card{position:relative;display:block;min-height:70px;border:1px solid #263247;border-radius:12px;background:linear-gradient(145deg,#121a28,#0b111b);overflow:hidden}.itemx2-codex-summary{position:relative;z-index:1;display:grid;grid-template-columns:48px minmax(0,1fr) minmax(72px,auto);gap:10px;align-items:center;min-height:70px;padding:10px;cursor:pointer;list-style:none}.itemx2-codex-summary::-webkit-details-marker{display:none}.itemx2-codex-summary::after{content:'＋';position:absolute;right:8px;bottom:5px;color:#66758d;font-size:var(--itemx-text-sm,.7rem)}.itemx2-codex-card[open]>.itemx2-codex-summary::after{content:'－';color:#d4af6e}.itemx2-codex-glyph{display:grid;place-items:center;width:48px;height:48px;border:1px solid #40506b;border-radius:11px;background:#0b111c;color:#dbe8ff;font-size:1.45rem}.itemx2-codex-copy{display:grid;gap:3px;min-width:0}.itemx2-codex-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#edf2fb;font-size:var(--itemx-text-md,.82rem)}.itemx2-codex-copy small{color:#8494ad;font-size:var(--itemx-text-xs,.66rem)}.itemx2-codex-tags{display:flex;flex-wrap:wrap;gap:4px}.itemx2-codex-tags i{padding:2px 5px;border:1px solid #344259;border-radius:999px;color:#aebbd0;font-size:calc(var(--itemx-text-xs,.62rem) * .94);font-style:normal}.itemx2-codex-detail{position:relative;z-index:1;display:grid;gap:8px;padding:10px 12px 12px;border-top:1px solid #202b3c;background:rgba(7,11,18,.72);color:#b8c4d7;font-size:var(--itemx-text-sm,.68rem);line-height:1.55}.itemx2-codex-detail p{margin:0;color:#c8d2e1;white-space:pre-wrap}.itemx2-codex-detail-row{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px}.itemx2-codex-detail-row b{color:#74849d;font-size:var(--itemx-text-xs,.62rem)}.itemx2-codex-detail-row span{overflow-wrap:anywhere}.itemx2-skill-meta{position:relative;z-index:1;display:grid;grid-template-columns:auto auto;gap:2px 5px;align-items:center;padding:6px 7px;border:1px solid #2e3a50;border-radius:9px;background:rgba(9,14,23,.82);font-size:var(--itemx-text-xs,.58rem)}.itemx2-skill-meta small{color:#6f809a}.itemx2-skill-meta b{color:#dce6f5;font-size:var(--itemx-text-xs,.62rem);text-align:right}.itemx2-mastery{grid-column:2/-1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.itemx2-mastery i{height:5px;border-radius:6px;background:#202a3a;overflow:hidden}.itemx2-mastery i.on{background:linear-gradient(90deg,#66b8ff,#a985ff);box-shadow:0 0 8px rgba(102,184,255,.35)}.itemx2-bestiary-card.active{border-color:#70404a;box-shadow:inset 3px 0 #b55b68}.itemx2-bestiary-card img{width:48px;height:48px;border-radius:11px;object-fit:cover}.itemx2-codex-empty{padding:34px 16px;text-align:center;color:#6f7e96;font-size:var(--itemx-text-sm,.75rem)}.itemx2-codex-note{padding:9px 10px;border:1px solid #1c2635;border-radius:9px;background:#0c121c;color:#8594aa;font-size:var(--itemx-text-xs,.66rem);line-height:1.45}.itemx2-root-drawer.itemx2-font-large .itemx2-codex-card,.itemx2-root-drawer.itemx2-font-large .itemx2-codex-summary{min-height:76px}
.itemx-tile,.itemx2-codex-card{content-visibility:auto;contain:layout paint style}.itemx-tile{contain-intrinsic-size:92px}.itemx2-codex-card{contain-intrinsic-size:78px}
.itemx2-root-inventory{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}.itemx2-root-inventory>.itemx-body{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding-bottom:calc(.95em + env(safe-area-inset-bottom,0px))}
.itemx2-root-inventory>.itemx-pf{display:flex;align-items:center;justify-content:space-between;gap:8px}.itemx2-root-pager{display:inline-flex;align-items:center;gap:7px}.itemx2-root-pager button{width:30px;height:28px;border:1px solid #2d394c;border-radius:7px;background:#151d2a;color:#d9e4f3;font:inherit;font-weight:900}.itemx2-root-pager button:disabled{opacity:.3}.itemx2-root-pager b{min-width:42px;color:#9eabc0;font-size:.65rem;text-align:center}
.itemx2-root-item{display:block}.itemx2-root-tile-label{display:block;cursor:pointer}.itemx2-root-tile-label .itemx-tile{width:100%;pointer-events:none}
.itemx2-root-detail{display:none}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-filters,.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-tools,.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-pf{display:none}
.itemx2-root-settings{display:none;flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-inventory,.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-skills,.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-bestiary{display:none}.itemx2-tab-settings:checked~.itemx2-root-layer .itemx2-root-settings{display:grid;gap:10px}
.itemx2-root-tab-body{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}.itemx2-root-tab-body>.itemx2-root-skills,.itemx2-root-tab-body>.itemx2-root-bestiary{display:grid;align-content:start;gap:9px}.itemx2-root-tab-body>.itemx2-root-settings{display:grid;gap:10px}.itemx-main-tab-on{border-bottom-color:#d4af6e!important;color:#f3dcaa!important;background:#121925!important}.itemx2-tab-loading{display:grid;flex:1;min-height:0;place-content:center;justify-items:center;gap:10px;padding:24px;color:#b7c3d6;text-align:center}.itemx2-tab-loading i{width:28px;height:28px;border:2px solid rgba(212,175,110,.2);border-top-color:#d4af6e;border-radius:50%;animation:itemx2-tab-spin .7s linear infinite}.itemx2-tab-loading strong{color:#f0dfb8;font-size:.78rem}.itemx2-tab-loading small{color:#718097;font-size:.66rem}@keyframes itemx2-tab-spin{to{transform:rotate(360deg)}}
.itemx2-position-grid,.itemx2-font-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.itemx2-position-choice,.itemx2-font-choice{display:grid;place-items:center;min-height:38px;border:1px solid #2b3547;border-radius:9px;background:#151d2a;color:#9aabc4;cursor:pointer}.itemx2-pos-lb:checked~.itemx2-root-layer label[for="itemx2-pos-lb"],.itemx2-pos-lm:checked~.itemx2-root-layer label[for="itemx2-pos-lm"],.itemx2-pos-lt:checked~.itemx2-root-layer label[for="itemx2-pos-lt"],.itemx2-pos-rb:checked~.itemx2-root-layer label[for="itemx2-pos-rb"],.itemx2-pos-rm:checked~.itemx2-root-layer label[for="itemx2-pos-rm"],.itemx2-pos-rt:checked~.itemx2-root-layer label[for="itemx2-pos-rt"]{border-color:#d4af6e;background:#292316;color:#f3dcaa}
.itemx2-font-choice.itemx2-font-on{border-color:#d4af6e;background:#292316;color:#f3dcaa}
.itemx2-position-on{border-color:#d4af6e;background:#292316;color:#f3dcaa}
.itemx2-root-setting-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid #1c2331;border-radius:12px;background:#0d121c}.itemx2-root-setting-card span{display:grid;gap:3px}.itemx2-root-setting-card small{color:#77839c;line-height:1.4}.itemx2-root-setting-button{min-height:36px;padding:0 11px;border:1px solid #2b3547;border-radius:9px;background:#151d2a;color:#cbd7e9;cursor:pointer}
.itemx2-status-row{display:flex!important;flex-direction:row!important;flex-wrap:wrap;gap:5px!important;margin-top:3px}.itemx2-status-chip{display:inline-flex!important;padding:3px 7px;border:1px solid #354157;border-radius:999px;background:#131a26;color:#93a2ba;font-size:.66rem;font-weight:800;font-style:normal}.itemx2-status-chip-on{border-color:#37634d;color:#9cddb7;background:#102019}.itemx2-status-chip-warn{border-color:#6a5530;color:#e8c987;background:#241d10}.itemx2-status-chip-off{border-color:#61343a;color:#efa8af;background:#251216}.itemx2-root-setting-button-primary{border-color:#6e5a32;background:#2a2316;color:#f0d79d}.itemx2-setting-on{border-color:#4e8968!important;background:#12241a!important;color:#a9e6c2!important}.itemx2-setting-cleanup{border-color:#65333a!important;background:#241216!important;color:#ffadb5!important}.itemx2-setting-cleanup-armed{box-shadow:0 0 0 1px #b85b67 inset!important}.itemx2-root-setting-button:disabled,.itemx2-root-setting-button-busy{opacity:.58;cursor:default;pointer-events:none}.itemx2-aux-status-done i,.itemx2-aux-status-failed i{border:0!important;animation:none!important}.itemx2-aux-status-done i::before{content:'✓';color:#9cddb7;font-style:normal;font-weight:900}.itemx2-aux-status-failed i::before{content:'!';color:#ffadb5;font-style:normal;font-weight:900}
.itemx2-manager-fold{border:1px solid #283247;border-radius:12px;background:#0b1019;overflow:hidden}.itemx2-manager-fold summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px;cursor:pointer;color:#f0d79d;font-weight:800;list-style:none}.itemx2-manager-fold summary::-webkit-details-marker{display:none}.itemx2-manager-fold summary::after{content:'＋';color:#8291aa}.itemx2-manager-fold[open] summary::after{content:'－'}.itemx2-manager-body{display:grid;gap:10px;padding:0 12px 12px}.itemx2-manager-label{display:grid;gap:5px;color:#8592a8;font-size:.72rem}.itemx2-manager-editor{min-height:58px;padding:9px;border:1px solid #293448;border-radius:9px;background:#121925;color:#e3e9f3;white-space:pre-wrap;overflow-wrap:anywhere;outline:none}.itemx2-manager-editor:focus{border-color:#637ba3}.itemx2-manager-list{display:grid;gap:7px}.itemx2-manager-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px;border:1px solid #1d2737;border-radius:9px;background:#101722}.itemx2-manager-name{display:grid;gap:2px;min-width:0}.itemx2-manager-name strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e9eef7;font-size:.78rem}.itemx2-manager-name small{color:#6f7e96;font-size:.67rem}.itemx2-manager-actions{display:flex;gap:5px}.itemx2-manager-actions button{min-height:31px;padding:0 8px;border:1px solid #344159;border-radius:7px;background:#172131;color:#cbd7e9;cursor:pointer}.itemx2-manager-actions .itemx2-manager-remove{border-color:#65333a;color:#ffadb5}.itemx2-manager-create{display:grid;gap:7px;padding-top:3px;border-top:1px solid #1d2737}
.itemx2-domain-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.itemx2-domain-card{display:grid;gap:5px;padding:10px;border:1px solid #273247;border-radius:10px;background:#101722;color:#dce5f2;text-align:left}.itemx2-domain-card small{color:#718199;font-size:.62rem}.itemx2-debug-fold{border-color:#334056}.itemx2-debug-body{display:grid;gap:8px;padding:0 12px 12px}.itemx2-debug-grid{display:grid;grid-template-columns:72px minmax(0,1fr);gap:5px 8px;font-size:.64rem}.itemx2-debug-grid b{color:#718199}.itemx2-debug-grid span{color:#c4cfdf;overflow-wrap:anywhere}.itemx2-debug-log{display:grid;gap:4px;max-height:180px;overflow:auto;padding:8px;border:1px solid #202b3d;border-radius:8px;background:#080d15;color:#91a2ba;font:10px/1.45 monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-item{display:none}.itemx2-root-panel .itemx2-root-item:has(.itemx2-root-detail-choice:checked){display:block}.itemx2-root-detail-choice:checked~.itemx2-root-tile-label{display:none}.itemx2-root-detail-choice:checked~.itemx2-root-detail{display:block}
.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-grid{grid-template-columns:minmax(0,1fr)}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx2-root-item:has(.itemx2-root-detail-choice:checked){grid-column:1/-1;width:100%;min-width:0}.itemx2-root-panel:has(.itemx2-root-detail-choice:checked) .itemx-detail{width:100%}
.itemx2-root-filter-owned:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-owned),.itemx2-root-filter-equipped:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-equipped),.itemx2-root-filter-observed:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-observed),.itemx2-root-filter-removed:checked~.itemx2-root-layer .itemx2-root-item:not(.itemx2-match-removed){display:none}
.itemx2-root-filter-all:checked~.itemx2-root-layer label[for="itemx2-filter-all"],.itemx2-root-filter-owned:checked~.itemx2-root-layer label[for="itemx2-filter-owned"],.itemx2-root-filter-equipped:checked~.itemx2-root-layer label[for="itemx2-filter-equipped"],.itemx2-root-filter-observed:checked~.itemx2-root-layer label[for="itemx2-filter-observed"],.itemx2-root-filter-removed:checked~.itemx2-root-layer label[for="itemx2-filter-removed"]{border-bottom-color:#d4af6e;color:#f2ead9;font-weight:700}
@keyframes itemx2-root-in{from{opacity:0;translate:0 7px;scale:.982}to{opacity:1;translate:0;scale:1}}@keyframes itemx2-root-out{from{opacity:1}to{opacity:0;translate:0 5px;scale:.988}}@keyframes itemx2-aux-spin{to{transform:rotate(360deg)}}
@media(max-width:520px){.itemx2-root-panel{width:calc(100vw - 68px);height:min(660px,72dvh)}.itemx2-root-pos-lb,.itemx2-root-pos-lm,.itemx2-root-pos-lt{left:56px;right:auto;top:auto;bottom:8px;transform:none}.itemx2-root-pos-rb,.itemx2-root-pos-rm,.itemx2-root-pos-rt{right:56px;left:auto;top:auto;bottom:8px;transform:none}}
@media(prefers-reduced-motion:reduce){.itemx2-root-layer,.itemx2-root-panel,.itemx2-aux-status i{animation:none!important;transition:none!important}}
${codexPageStyle()}
`;
  function prefixRisuClasses(css) {
    return String(css || '').replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => name.startsWith('x-risu-') ? `.${name}` : `.x-risu-${name}`);
  }
  const bodyScrollStyle = `.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-fx,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-cond{visibility:hidden!important}.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-fx *,.chattext.x-risu-itemx-body-scrolling .x-risu-itemx-inline-card .x-risu-itemx-cond *{animation-play-state:paused!important}`;
  const bodyEffectsStyle = `body.x-risu-itemx2-effects-off .x-risu-itemx-fx,body.x-risu-itemx2-effects-off .x-risu-itemx-cond,body.x-risu-itemx2-effects-off .x-risu-itemx-codex-hero::before,body.x-risu-itemx2-effects-off .x-risu-itemx-codex-hero::after,body.x-risu-itemx2-effects-off .x-risu-itemx2-codex-fx{display:none!important;animation:none!important}`;
  const mainStyleText = () => `${ITEMX_MAIN_STYLE}\n${prefixRisuClasses(`${ITEMX_CHAT_STYLE}\n${rootDrawerStyle()}`)}\n${bodyScrollStyle}\n${bodyEffectsStyle}\n${badgeStyle()}`;

  function enqueue(key, work) {
    const prev = queues.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(work).finally(() => { if (queues.get(key) === next) queues.delete(key); });
    queues.set(key, next); return next;
  }

  function refreshLatest(chat, lookup = buildMessageEventLookup(chat)) {
    loadMessageEventLedger(chat, lookup);
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    let latest = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      const text = messageData(messages[i]);
      if (messageEvents(text, 'item', lookup).length || messageEvents(text, 'codex', lookup).length) { latest = text; break; }
    }
    runtime.latestOutput = latest;
    const persisted = markerCodes(latest);
    if (runtime.pendingMarkersAt && Date.now() - runtime.pendingMarkersAt < 12000) {
      for (const marker of runtime.pendingMarkers) persisted.add(marker);
    } else {
      runtime.pendingMarkers.clear();
      runtime.pendingMarkersAt = 0;
    }
    runtime.latestMarkers = persisted;
  }

  function manualLedger(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_MANUAL_KEY];
      const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(rows) ? rows.filter((row) => row && Number.isInteger(row.afterIndex) && row.event?.kind).slice(-256) : [];
    } catch { return []; }
  }

  function messageEventLedger(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_MESSAGE_EVENT_KEY];
      const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(rows) ? rows.filter((row) => row && /^[A-Za-z0-9_-]{1,80}$/.test(row.ref || '') && ['item', 'codex'].includes(row.domain) && row.payload?.event).slice(-512) : [];
    } catch { return []; }
  }

  function buildMessageEventLookup(chat) {
    const rows = messageEventLedger(chat), itemByRef = new Map(), codexByRef = new Map(), payloads = new Map();
    for (const row of rows) {
      if (row.domain === 'item') itemByRef.set(row.ref, row.payload);
      else if (row.domain === 'codex') codexByRef.set(row.ref, row.payload);
      payloads.set(`${row.domain}:${row.ref}`, row.payload);
    }
    return { rows, itemByRef, codexByRef, payloads };
  }

  function loadMessageEventLedger(chat, lookup = buildMessageEventLookup(chat)) {
    runtime.eventPayloads = new Map(lookup.payloads);
  }

  function embeddedViewCode(payload, domain) {
    const view = payload?.view;
    if (!view) return '';
    const envelope = domain === 'codex'
      ? { v: ITEMXCodex.VERSION, d: payload.event?.domain || '', e: { i: view.id, n: view.name, g: view.glyph } }
      : { v: ITEMXCore.VERSION, i: {
        i: view.id, n: view.name, t: view.itemType, e: view.emoji, r: view.rarity, d: view.displayRarity,
        p: view.power, q: view.required, u: view.durability, c: view.cost, o: view.possession, l: view.location,
        k: view.count, s: view.slot, h: view.theme, a: view.affinity, b: view.affinity2, x: view.condition,
        f: (view.effects || []).map((row) => [row.name, row.desc]), g: (view.augments || []).map((row) => [row.name, row.desc]), z: view.trivia
      } };
    const marker = ITEMXCore.marker(envelope);
    return marker.startsWith('<!--ITEMX2:') && marker.endsWith('-->') ? marker.slice('<!--ITEMX2:'.length, -3) : '';
  }

  function compactRefMarker(prefix, ref, payload, domain) {
    const code = embeddedViewCode(payload, domain);
    return `<!--${prefix}@${ref}${code ? `:${code}` : ''}-->`;
  }

  function inlineViewPayload(code, domain) {
    if (!code) return null;
    const payload = ITEMXCore.decodePayload(code);
    if (payload?.view) return domain === 'codex' ? { v: payload.v, event: { domain: payload.domain || '' }, view: payload.view } : { v: payload.v, view: payload.view };
    if (domain === 'codex' && payload?.e) return { v: payload.v, event: { domain: payload.d || '' }, view: { id: payload.e.i, name: payload.e.n, glyph: payload.e.g } };
    if (domain !== 'item' || !payload?.i) return null;
    const item = payload.i;
    return { v: payload.v, view: {
      id: item.i, name: item.n, itemType: item.t, emoji: item.e, rarity: item.r, displayRarity: item.d,
      power: item.p, required: item.q, durability: item.u, cost: item.c, possession: item.o, location: item.l,
      count: item.k, slot: item.s, theme: item.h, affinity: item.a, affinity2: item.b, condition: item.x,
      effects: (item.f || []).map((row) => ({ name: row[0], desc: row[1] })), augments: (item.g || []).map((row) => ({ name: row[0], desc: row[1] })), trivia: item.z
    } };
  }

  function itemMarkerPayload(marker) {
    const full = String(marker || '').match(/^<!--ITEMX2:([A-Za-z0-9_-]+)-->$/);
    if (full) return ITEMXCore.decodePayload(full[1]);
    const ref = String(marker || '').match(/^<!--ITEMX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->$/);
    if (!ref) return null;
    return inlineViewPayload(ref[2], 'item') || runtime.eventPayloads.get(`item:${ref[1]}`) || null;
  }

  function itemPayloadId(payload) {
    return payload?.view?.id || payload?.event?.item?.id || payload?.event?.patch?.id || '';
  }

  function coalesceAdjacentItemMarkers(content) {
    const source = String(content || '');
    const re = /<!--ITEMX2:[A-Za-z0-9_-]+-->|<!--ITEMX2@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?-->/g;
    const rows = []; let match;
    while ((match = re.exec(source))) rows.push({ start: match.index, end: re.lastIndex, raw: match[0], payload: itemMarkerPayload(match[0]) });
    if (rows.length < 2) return source;
    const hidden = new Set();
    for (let index = 0; index < rows.length - 1; index += 1) {
      const current = rows[index], next = rows[index + 1];
      const id = itemPayloadId(current.payload), nextId = itemPayloadId(next.payload);
      if (id && id === nextId && next.payload?.view && !source.slice(current.end, next.start).trim()) hidden.add(index);
    }
    if (!hidden.size) return source;
    let output = '', cursor = 0;
    rows.forEach((row, index) => {
      output += source.slice(cursor, row.start);
      if (!hidden.has(index)) output += row.raw;
      cursor = row.end;
    });
    return output + source.slice(cursor);
  }

  function bareRefMarker(prefix, ref) {
    return `<!--${prefix}@${ref}-->`;
  }

  function reconcileStoredRefViews(chat, preferredLatestIndex = null) {
    const rows = messageEventLedger(chat);
    if (!rows.length) return { chat, changed: false };
    const byKey = new Map(rows.map((row) => [`${row.domain}:${row.ref}`, row.payload]));
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    let latestIndex = Number.isInteger(preferredLatestIndex) ? preferredLatestIndex : -1;
    if (latestIndex < 0 || latestIndex >= messages.length) {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const source = messageData(messages[index]);
        if (source.match(ITEMX_REF_RE) || source.match(ITEMX_CODEX_REF_RE)) { latestIndex = index; break; }
      }
    }
    let next = null, changed = false;
    for (let index = 0; index < messages.length; index += 1) {
      const original = messageData(messages[index]);
      const keepInline = index === latestIndex;
      let source = original.replace(ITEMX_REF_RE, (raw, ref, inline) => keepInline
        ? (inline ? raw : compactRefMarker('ITEMX2', ref, byKey.get(`item:${ref}`), 'item'))
        : bareRefMarker('ITEMX2', ref));
      source = source.replace(ITEMX_CODEX_REF_RE, (raw, ref, inline) => keepInline
        ? (inline ? raw : compactRefMarker('CODEX2', ref, byKey.get(`codex:${ref}`), 'codex'))
        : bareRefMarker('CODEX2', ref));
      if (source === original) continue;
      if (!next) next = ITEMXCore.clone(chat);
      const message = next.message[index];
      if (typeof message.data === 'string') message.data = source;
      else if (typeof message.content === 'string') message.content = source;
      changed = true;
    }
    return { chat: next || chat, changed };
  }

  function messageEvents(text, domain, lookup) {
    const byRef = domain === 'item' ? lookup.itemByRef : lookup.codexByRef;
    const found = [];
    const fullRe = domain === 'item' ? ITEMXCore.MARKER_RE : ITEMXCodex.MARKER_RE;
    const refRe = domain === 'item' ? ITEMX_REF_RE : ITEMX_CODEX_REF_RE;
    String(text || '').replace(fullRe, (raw, code, index) => {
      const payload = domain === 'item' ? ITEMXCore.decodePayload(code) : ITEMXCodex.decodePayload(code);
      if (payload?.event) found.push({ index, event: payload.event });
      return raw;
    });
    String(text || '').replace(refRe, (raw, ref, inline, index) => {
      const payload = byRef.get(ref);
      if (payload?.event) found.push({ index, event: payload.event });
      return raw;
    });
    return found.sort((a, b) => a.index - b.index).map((row) => row.event);
  }

  function rebuildCodexWithLedger(chat, lookup = buildMessageEventLookup(chat), options = {}) {
    const state = ITEMXCodex.snapshot(); let transport = '';
    for (const message of chat?.message || []) {
      const narrative = messageData(message);
      for (const event of messageEvents(narrative, 'codex', lookup)) {
        const reconciled = ITEMXCodex.reconcileSkillEvent(event, narrative, options);
        ITEMXCodex.applyEvent(state, reconciled); transport += JSON.stringify(reconciled);
      }
    }
    state.fingerprint = ITEMXCore.fnv1a(transport); state.updatedAt = Date.now();
    return state;
  }

  function compactMessageTransports(chat, index) {
    const next = ITEMXCore.clone(chat), message = next.message?.[index];
    if (!message) return { chat: next, changed: false };
    let source = messageData(message), ordinal = 0, changed = false;
    const rows = messageEventLedger(next), byKey = new Map(rows.map((row) => [`${row.domain}:${row.ref}`, row]));
    const replace = (domain, regex, decode, prefix) => {
      source = source.replace(regex, (raw, code) => {
        const payload = decode(code);
        if (!payload?.event) return '';
        const ref = `${domain[0]}${index.toString(36)}_${(ordinal++).toString(36)}_${ITEMXCore.fnv1a(code)}`;
        byKey.set(`${domain}:${ref}`, { ref, domain, payload: ITEMXCore.clone(payload) });
        changed = true;
        return compactRefMarker(prefix, ref, payload, domain);
      });
    };
    replace('item', ITEMXCore.MARKER_RE, ITEMXCore.decodePayload, 'ITEMX2');
    replace('codex', ITEMXCodex.MARKER_RE, ITEMXCodex.decodePayload, 'CODEX2');
    if (!changed) return { chat: next, changed: false };
    if (typeof message.data === 'string') message.data = source;
    else if (typeof message.content === 'string') message.content = source;
    const used = new Set();
    for (const one of next.message || []) {
      const text = messageData(one);
      text.replace(ITEMX_REF_RE, (_, ref) => { used.add(`item:${ref}`); return ''; });
      text.replace(ITEMX_CODEX_REF_RE, (_, ref) => { used.add(`codex:${ref}`); return ''; });
    }
    const kept = [...byKey.entries()].filter(([key]) => used.has(key)).map(([, row]) => row).slice(-512);
    next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_MESSAGE_EVENT_KEY]: JSON.stringify(kept) };
    return { chat: reconcileStoredRefViews(next, index).chat, changed: true };
  }

  function rebuildWithManual(chat, lookup = buildMessageEventLookup(chat)) {
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    const ledger = manualLedger(chat), manualByIndex = new Map(), manualTail = [], reg = ITEMXCore.newRegistry();
    for (const row of ledger) {
      if (row.afterIndex < 0 || row.afterIndex >= messages.length) manualTail.push(row);
      else {
        const rows = manualByIndex.get(row.afterIndex) || [];
        rows.push(row); manualByIndex.set(row.afterIndex, rows);
      }
    }
    let transport = '';
    const apply = (event) => { ITEMXCore.applyEvent(reg, event); transport += ITEMXCore.marker({ v: ITEMXCore.VERSION, event }); };
    for (let index = 0; index < messages.length; index += 1) {
      for (const event of messageEvents(messageData(messages[index]), 'item', lookup)) apply(event);
      for (const row of manualByIndex.get(index) || []) apply(row.event);
    }
    for (const row of manualTail) apply(row.event);
    return { schema: ITEMXCore.VERSION, rev: 2, fingerprint: ITEMXCore.fnv1a(transport), updatedAt: Date.now(), registry: reg };
  }

  async function rebuildCurrent({ upgradeDisplayRefs = false } = {}) {
    const ctx = await context();
    if (!ctx) return null;
    return enqueue(ctx.key, async () => {
      let latestChat = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
      if (!latestChat) return null;
      if (upgradeDisplayRefs && !latestChat.isStreaming && !(latestChat.message || []).some((message) => message?.isStreaming)) {
        const reconciled = reconcileStoredRefViews(latestChat);
        if (reconciled.changed && runtime.activeContextKey === ctx.key) {
          await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, reconciled.chat);
          latestChat = reconciled.chat;
          debugRecord('display refs', 'kept one self-contained view and compacted older refs');
        }
      }
      const lookup = buildMessageEventLookup(latestChat);
      const snapshot = rebuildWithManual(latestChat, lookup);
      const codexSnapshot = rebuildCodexWithLedger(latestChat, lookup);
      const settings = await outputSettings(ctx.character);
      refreshLatest(latestChat, lookup);
      // Normal rebuilds are deliberately read-only. Writing an entire chat
      // snapshot here can race another module's output hook and restore an
      // older assistant message over its freshly appended display markers.
      runtime.status = `정상 · 아이템 ${snapshot.registry.order.length} · 스킬 ${codexSnapshot.skills.order.length} · 도감 ${codexSnapshot.monsters.order.length}`;
      const loaded = { ...ctx, chat: latestChat, snapshot, codexSnapshot, ...settings };
      runtime.cachedLoaded = loaded;
      runtime.cachedGeneration = runtime.generation;
      return loaded;
    });
  }

  const CHAT_DATA_KEYS = [
    ITEMXCore.STATE_KEY, ITEMXCore.CHAT_KEY, ITEMXCodex.STATE_KEY,
    ITEMX_MANUAL_KEY, ITEMX_MESSAGE_EVENT_KEY, ITEMX_AUX_KEY
  ];

  function cleanChatPluginData(chat) {
    const next = ITEMXCore.clone(chat), messages = Array.isArray(next?.message) ? next.message : [];
    let cleanedMessages = 0, removedMarkers = 0, removedStateKeys = 0;
    for (const message of messages) {
      const original = messageData(message);
      const markers = original.match(/<!--(?:ITEMX2|CODEX2)(?::[A-Za-z0-9_-]+|@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?)-->/g) || [];
      let source = stripAllTransport(original)
        .replace(ITEMX_REF_RE, '')
        .replace(ITEMX_CODEX_REF_RE, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n');
      removedMarkers += markers.length;
      if (source === original) continue;
      if (typeof message.data === 'string') message.data = source;
      else if (typeof message.content === 'string') message.content = source;
      cleanedMessages += 1;
    }
    next.scriptstate = { ...(next.scriptstate || {}) };
    for (const key of CHAT_DATA_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(next.scriptstate, key)) continue;
      delete next.scriptstate[key]; removedStateKeys += 1;
    }
    return { chat: next, cleanedMessages, removedMarkers, removedStateKeys };
  }

  async function cleanCurrentChatItemx() {
    const ctx = await context();
    if (!ctx) throw new Error('현재 채팅을 찾을 수 없습니다.');
    const result = await enqueue(ctx.key, async () => {
      const active = await context();
      if (!active || active.key !== ctx.key) throw new Error('정리 중 채팅이 바뀌었습니다. 다시 시도하세요.');
      const latest = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
      if (!latest) throw new Error('현재 채팅을 불러오지 못했습니다.');
      if (latest.isStreaming || (latest.message || []).some((message) => message?.isStreaming || message?.bgContinue)) {
        throw new Error('출력 스트리밍이 끝난 뒤 정리할 수 있습니다.');
      }
      const cleaned = cleanChatPluginData(latest);
      await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, cleaned.chat);
      // Cleanup is intended for leaving ITEMX behind. Disable this bot only
      // after the chat write succeeds so catch-up cannot immediately recreate
      // the markers that were just removed.
      await setEnabled(ctx.character, false);
      return cleaned;
    });
    runtime.cleanupArmedUntil = 0;
    runtime.latestMarkers.clear(); runtime.latestOutput = ''; runtime.pendingMarkers.clear(); runtime.pendingMarkersAt = 0;
    runtime.eventPayloads = new Map(); runtime.markerHtmlCache.clear(); runtime.detailHtmlCache.clear();
    runtime.catchUpFingerprint = ''; runtime.catchUpFailedFingerprint = ''; runtime.catchUpFailures = 0; runtime.catchUpRetryAt = 0;
    runtime.auxCandidateFingerprint = ''; runtime.auxCandidateSince = 0; runtime.auxCandidateChecks = 0;
    runtime.cachedLoaded = null; runtime.cachedGeneration = -1; runtime.generation += 1;
    runtime.status = `현재 채팅 정리 완료 · 마커 ${result.removedMarkers}개`;
    const loaded = await rebuildCurrent();
    if (loaded) loaded.enabled = false;
    return { ...result, loaded };
  }

  async function cachedOrRebuildCurrent() {
    const [characterIndex, chatIndex] = await Promise.all([Risuai.getCurrentCharacterIndex(), Risuai.getCurrentChatIndex()]);
    const cached = runtime.cachedLoaded;
    if (cached && cached.characterIndex === characterIndex && cached.chatIndex === chatIndex && runtime.cachedGeneration === runtime.generation) return cached;
    return rebuildCurrent();
  }

  async function commitManualEvents(loaded, events, label) {
    if (!loaded || !Array.isArray(events) || !events.length) throw new Error('No manual events to commit');
    const latest = await Risuai.getChatFromIndex(loaded.characterIndex, loaded.chatIndex);
    if (!latest) throw new Error('Chat disappeared during manual operation');
    const ledger = manualLedger(latest);
    const afterIndex = Math.max(-1, (latest.message || []).length - 1);
    for (const event of events) ledger.push({ at: Date.now(), afterIndex, label, event: ITEMXCore.clone(event) });
    const next = ITEMXCore.clone(latest);
    next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_MANUAL_KEY]: JSON.stringify(ledger.slice(-256)) };
    const snapshot = rebuildWithManual(next);
    await Risuai.setChatToIndex(loaded.characterIndex, loaded.chatIndex, ITEMXCore.writeSnapshot(next, snapshot));
    runtime.status = `${label} · ${events.length}건`;
    return rebuildCurrent();
  }

  function modelText(result) {
    if (typeof result === 'string') return result;
    if (typeof result?.result === 'string') return result.result;
    if (typeof result?.content === 'string') return result.content;
    if (typeof result?.text === 'string') return result.text;
    return '';
  }

  function auxStatusText() {
    if (runtime.auxActive > 0) return runtime.auxLabel || '보조 모델 처리 중';
    const last = runtime.auxLast;
    if (!last?.at) return '아직 실행 기록 없음';
    const time = new Date(last.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${last.label} · ${time}`;
  }

  function connectionSummary() {
    const hook = runtime.permissions.replacer === true ? ['모델 훅 연결', 'on'] : runtime.permissions.replacer === false ? ['모델 훅 오류', 'off'] : ['모델 훅 확인 전', 'warn'];
    const dom = runtime.permissions.mainDom === true ? ['화면 연결', 'on'] : runtime.permissions.mainDom === false ? ['화면 권한 필요', 'off'] : ['화면 확인 전', 'warn'];
    const listener = runtime.hooks.listener === 'unsupported' ? ['Pocket 호환', 'warn'] : runtime.hooks.listener ? ['커밋 감지', 'on'] : ['커밋 감지 전', 'warn'];
    return { hook, dom, listener, ready: runtime.permissions.replacer === true && runtime.permissions.mainDom === true };
  }

  async function updateConnectionUi() {
    if (!runtime.mainDoc) return;
    const connection = connectionSummary();
    const chips = [['hook', connection.hook], ['dom', connection.dom], ['listener', connection.listener]];
    for (const [key, [label, tone]] of chips) {
      const chip = await runtime.mainDoc.querySelector(`.x-risu-itemx2-connection-${key}`);
      if (!chip) continue;
      await chip.setTextContent(label);
      await chip.removeClass('x-risu-itemx2-status-chip-on');
      await chip.removeClass('x-risu-itemx2-status-chip-warn');
      await chip.removeClass('x-risu-itemx2-status-chip-off');
      await chip.addClass(`x-risu-itemx2-status-chip-${tone}`);
    }
    const button = await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-connect');
    if (!button) return;
    await button.setTextContent(runtime.connectionBusy ? '확인 중…' : connection.ready ? '다시 확인' : '연결하기');
    if (runtime.connectionBusy) await button.addClass('x-risu-itemx2-root-setting-button-busy');
    else await button.removeClass('x-risu-itemx2-root-setting-button-busy');
  }

  async function updateRootSettingButton(selector, label, enabled = null) {
    if (!runtime.mainDoc) return;
    const button = await runtime.mainDoc.querySelector(selector);
    if (!button) return;
    await button.setTextContent(label);
    if (enabled === true) await button.addClass('x-risu-itemx2-setting-on');
    else if (enabled === false) await button.removeClass('x-risu-itemx2-setting-on');
  }

  async function applyRootSetting(change) {
    if (runtime.settingChangeBusy) return;
    runtime.settingChangeBusy = true;
    try { await change(); }
    finally { runtime.settingChangeBusy = false; }
  }

  async function setAuxOutcome(state, label, events = null) {
    runtime.auxLast = { state, label, events, at: Date.now() };
    runtime.auxLabel = label;
    await syncAuxIndicator();
    if (runtime.auxToastTimer) globalThis.clearTimeout(runtime.auxToastTimer);
    runtime.auxToastTimer = globalThis.setTimeout(() => {
      runtime.auxToastTimer = null;
      void syncAuxIndicator();
    }, 2600);
  }

  async function syncAuxIndicator() {
    try {
      if (!runtime.mainDoc) return;
      const indicator = await runtime.mainDoc.querySelector('.x-risu-itemx2-aux-status');
      if (!indicator) return;
      const label = await indicator.querySelector('.x-risu-itemx2-aux-status-label');
      if (label) await label.setTextContent(runtime.auxActive > 0 ? runtime.auxLabel : runtime.auxLast.label);
      const settingLabel = await runtime.mainDoc.querySelector('.x-risu-itemx2-aux-setting-status');
      if (settingLabel) await settingLabel.setTextContent(auxStatusText());
      const runButton = await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-aux-run');
      if (runButton) {
        await runButton.setTextContent(runtime.auxActive > 0 ? '처리 중…' : '지금 검사');
        if (runtime.auxActive > 0) await runButton.addClass('x-risu-itemx2-root-setting-button-busy');
        else await runButton.removeClass('x-risu-itemx2-root-setting-button-busy');
      }
      const recent = runtime.auxLast.at && Date.now() - runtime.auxLast.at < 2600;
      if (runtime.auxActive > 0 || recent) await indicator.addClass('x-risu-itemx2-aux-status-on');
      else await indicator.removeClass('x-risu-itemx2-aux-status-on');
      if (runtime.auxLast.state === 'done' && runtime.auxActive === 0) await indicator.addClass('x-risu-itemx2-aux-status-done');
      else await indicator.removeClass('x-risu-itemx2-aux-status-done');
      if (runtime.auxLast.state === 'failed' && runtime.auxActive === 0) await indicator.addClass('x-risu-itemx2-aux-status-failed');
      else await indicator.removeClass('x-risu-itemx2-aux-status-failed');
    } catch (error) { fail('aux indicator', error); }
  }

  async function runAuxModel(prompt, label = '보조 모델 처리 중') {
    if (typeof Risuai.runLLMModel !== 'function') throw new Error('이 PocketRisu에는 runLLMModel API가 없습니다.');
    runtime.auxActive += 1;
    runtime.auxLabel = label;
    runtime.auxLast = { state: 'running', label, at: Date.now(), events: null };
    runtime.status = label;
    await syncAuxIndicator();
    try {
      const result = await withTimeout(
        Risuai.runLLMModel({ messages: [{ role: 'user', content: prompt }], mode: 'otherAx', allowPlugins: false }),
        90000,
        '보조 모델이 90초 안에 응답하지 않았습니다.'
      );
      runtime.auxLast = { state: 'done', label: '보조 모델 응답 수신', at: Date.now(), events: null };
      return result;
    } catch (error) {
      runtime.auxLast = { state: 'failed', label: '보조 모델 호출 실패', at: Date.now(), events: null };
      throw error;
    } finally {
      runtime.auxActive = Math.max(0, runtime.auxActive - 1);
      await syncAuxIndicator();
      if (runtime.auxActive === 0) await setAuxOutcome(runtime.auxLast.state, runtime.auxLast.label, runtime.auxLast.events);
    }
  }

  function auxiliaryHistory(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_AUX_KEY];
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  async function auxiliaryZeroHistory(ctx) {
    try {
      const raw = await Risuai.pluginStorage.getItem(`auxZero:${ctx.key}`);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  async function rememberAuxiliaryZero(ctx, guardKey) {
    const history = await auxiliaryZeroHistory(ctx);
    history[guardKey] = Date.now();
    await Risuai.pluginStorage.setItem(`auxZero:${ctx.key}`, JSON.stringify(Object.fromEntries(Object.entries(history).slice(-24))));
  }

  function messageMetadata(message) {
    if (message?.metadata && typeof message.metadata === 'object') return message.metadata;
    try { return typeof message?.metadata === 'string' ? JSON.parse(message.metadata) : {}; }
    catch { return {}; }
  }

  function incompleteCommittedOutput(source) {
    const text = String(source || '').trim();
    if (!text) return true;
    if ((text.match(/```/g) || []).length % 2 === 1) return true;
    for (const tag of ['thoughts', 'analysis']) {
      const opens = (text.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
      const closes = (text.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
      if (opens > closes) return true;
    }
    return /<[^>]*$/.test(text);
  }

  function automaticAuxReady(chat, index, source) {
    const message = chat?.message?.[index];
    const metadata = messageMetadata(message);
    return !chat?.isStreaming && !message?.isStreaming && metadata.bgContinue !== true && !incompleteCommittedOutput(source);
  }

  function automaticAuxSettled(ctx, index, source) {
    const fingerprint = `${ctx.key}:${index}:${ITEMXCore.fnv1a(source)}`;
    if (runtime.auxCandidateFingerprint !== fingerprint) {
      runtime.auxCandidateFingerprint = fingerprint;
      runtime.auxCandidateSince = Date.now();
      runtime.auxCandidateChecks = 1;
      return false;
    }
    runtime.auxCandidateChecks += 1;
    return runtime.auxCandidateChecks >= 2 && Date.now() - runtime.auxCandidateSince >= ITEMX_AUX_SETTLE_MS;
  }

  function stateItemEvidence(chat) {
    const rows = [];
    const keyPattern = /(weapon|armor|item|inventory|equipment|outfit|accessor|gear|belonging|무기|방어구|아이템|장비|의상|소지품)/i;
    for (const [key, raw] of Object.entries(chat?.scriptstate || {})) {
      // ITEMX must not feed either its own derived state or stale
      // legacy ITEMX module state back to the model as world evidence.
      if (/itemx/i.test(key) || !keyPattern.test(key)) continue;
      const value = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);
      if (!value || /^(?:none|null|undefined|없음|무|0|\[\]|\{\})$/i.test(value)) continue;
      rows.push(`${key} = ${value.slice(0, 500)}`);
      if (rows.length >= 24 || rows.join('\n').length >= 4000) break;
    }
    return rows.length ? rows.join('\n').slice(0, 4000) : '(no item-like state variables)';
  }

  const LIGHTBOARD_DATA_RE = /(?:^|\n)[ \t]*---[ \t]*\r?\n[ \t]*\[LBDATA START\][\s\S]*?\[LBDATA END\][ \t]*\r?\n[ \t]*---[ \t]*(?=\r?\n|$)/gi;
  function stripAuxiliaryDataBlocks(value) {
    return String(value || '').replace(LIGHTBOARD_DATA_RE, '\n');
  }

  function auxiliaryVisibleText(value, { itemRefs = true } = {}) {
    let text = stripAuxiliaryDataBlocks(value);
    text = text.replace(/<(thoughts|analysis)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    text = itemRefs ? ITEMXCodex.requestView(ITEMXCore.requestView(text)) : text.replace(ITEMXCore.MARKER_RE, '').replace(ITEMXCodex.MARKER_RE, '');
    text = text.replace(ITEMX_REF_RE, '').replace(ITEMX_CODEX_REF_RE, '');
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }

  function auxiliarySemanticHash(value) {
    return ITEMXCore.fnv1a(auxiliaryVisibleText(value, { itemRefs: false }).replace(/\s+/g, ' ').trim());
  }

  function clipAuxiliaryText(value, max) {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    const head = Math.floor(max * 0.42), tail = max - head;
    return `${text.slice(0, head)}\n…[middle omitted for bounded auxiliary context]…\n${text.slice(-tail)}`;
  }

  function auxiliaryConversationContext(chat, targetIndex) {
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    let userIndex = -1;
    for (let index = targetIndex - 1; index >= 0; index -= 1) {
      if (/^(?:user|human)$/i.test(String(messages[index]?.role || messages[index]?.type || ''))) {
        userIndex = index;
        break;
      }
    }
    const triggeringUser = userIndex >= 0
      ? clipAuxiliaryText(auxiliaryVisibleText(messageData(messages[userIndex])), 3000)
      : '(triggering user turn unavailable)';
    const rows = [];
    let consumed = 0;
    const historyEnd = userIndex >= 0 ? userIndex : targetIndex;
    for (let index = historyEnd - 1; index >= 0 && rows.length < 6 && consumed < 9000; index -= 1) {
      const message = messages[index];
      const visible = clipAuxiliaryText(auxiliaryVisibleText(messageData(message)), 3600);
      if (!visible) continue;
      const role = /^(?:user|human)$/i.test(String(message?.role || message?.type || '')) ? 'USER' : 'ASSISTANT';
      const row = `[message ${index} · ${role}]\n${visible}`;
      if (consumed + row.length > 9000) {
        const remaining = 9000 - consumed;
        if (remaining >= 500) rows.unshift(clipAuxiliaryText(row, remaining));
        break;
      }
      rows.unshift(row);
      consumed += row.length;
    }
    return { triggeringUser, recent: rows.join('\n\n') || '(no earlier narrative context)' };
  }

  function assistantMessageIndex(chat, preferred = null) {
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    if (Number.isInteger(preferred) && preferred >= 0 && preferred < messages.length) return preferred;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!messageData(message).trim()) continue;
      if (/^(?:user|human)$/i.test(String(message?.role || message?.type || ''))) continue;
      return index;
    }
    return -1;
  }

  async function recoverAuxiliaryOutput(options = {}) {
    if (runtime.auxRecoveryPromise) return runtime.auxRecoveryPromise;
    const pending = recoverAuxiliaryOutputNow(options).finally(() => {
      if (runtime.auxRecoveryPromise === pending) runtime.auxRecoveryPromise = null;
    });
    runtime.auxRecoveryPromise = pending;
    return pending;
  }

  async function recoverAuxiliaryOutputNow({ messageIndex = null, force = false } = {}) {
    const ctx = await context();
    if (!ctx || !(await isEnabled(ctx.character))) return null;
    const settings = await outputSettings(ctx.character);
    runtime.debugEnabled = settings.debugEnabled;
    if (!settings.itemsEnabled && !settings.skillsEnabled && !settings.encountersEnabled) return [];
    if (settings.auxOutput === 'off' && !force) return [];
    const index = assistantMessageIndex(ctx.chat, messageIndex);
    if (index < 0) return null;
    const source = messageData(ctx.chat.message[index]);
    if (!force && !automaticAuxReady(ctx.chat, index, source)) return null;
    const sourceHash = ITEMXCore.fnv1a(source);
    const guardKey = `${index}:visible-${auxiliarySemanticHash(source)}:${settings.auxOutput}:${Number(settings.itemsEnabled)}${Number(settings.skillsEnabled)}${Number(settings.encountersEnabled)}:q${ITEMXQuality.REVISION}`;
    if (auxiliaryHistory(ctx.chat)[guardKey] && !force) return [];
    if ((await auxiliaryZeroHistory(ctx))[guardKey] && !force) return [];
    if (typeof Risuai.runLLMModel !== 'function') return null;

    return enqueue(`aux:${ctx.key}`, async () => {
      if (!force) await delay(350);
      const current = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
      if (!current || ITEMXCore.fnv1a(messageData(current.message?.[index])) !== sourceHash) return null;
      if (!force && !automaticAuxReady(current, index, messageData(current.message[index]))) return null;
      if (auxiliaryHistory(current)[guardKey] && !force) return null;
      const lookup = buildMessageEventLookup(current);
      const snapshot = rebuildWithManual(current, lookup);
      const codexSnapshot = rebuildCodexWithLedger(current, lookup, { rarityMode: settings.rarityMode });
      const committedNarrative = clipAuxiliaryText(auxiliaryVisibleText(messageData(current.message[index]), { itemRefs: false }), 14000);
      if (!committedNarrative && !force) return null;
      const conversation = auxiliaryConversationContext(current, index);
      const domains = enabledCodexDomains(settings);
      const requested = [settings.itemsEnabled && 'items', settings.skillsEnabled && 'skills', settings.encountersEnabled && 'encounters'].filter(Boolean).join(', ');
      const moduleAssets = await modulePortraitAssets(settings, ctx.character, current);
      const itemRecoveryRules = settings.itemsEnabled ? `Recover every settled item acquisition, creation, equipment, damage, loss, destruction or material appraisal omitted by the main output, even when the main output already emitted some other ITEMX events. Reuse existing ids from CURRENT INVENTORY. For a genuinely new item, emit a complete itemExam with coherent identity, rarity, visual theme, affinity only when established, and concrete effects supported by context. If the triggering turn and committed output conclusively correct an existing item's name or descriptive identity, including an earlier misspelling, emit itemPatch op=merge for that existing id with only the corrected descriptive fields; never re-emit a complete itemExam merely to correct an existing item. CURRENT INVENTORY is authoritative for continuity, not for a contradicted typo.` : '';
      const codexRecoveryRules = domains.length ? `Recover settled changes only for enabled CODEX domains, plus first discovery of an already-owned persistent player skill that is absent from CURRENT ACTIVE SKILLS. For skills, the first explicit confirmation that the player character owns, uses, has mastered, has equipped, or is concretely known to possess a persistent named capability, technique or proficiency is a settled discovery event even when it was learned before this turn; emit one skillExam and reuse an existing id when present. A bracketed word or generic action alone is not proof. Do not put an NPC or opponent's technique into the player skill registry; keep it only in that encounter's moves unless the player actually acquires it. Continue to track later learning, mastery, equipment, sealing or loss, and exclude transient buffs and flavor text. For encounters, track actual hostility, combat or accepted sparring; never register mere mentions, rumors, passive NPCs or unaccepted challenges.` : '';
      const prompt = `${protocolForSettings(settings, ctx.character, moduleAssets)}\n\nYou are the ITEMX context-aware auxiliary regeneration pass. Enabled domains: ${requested}. Read the triggering user turn, recent narrative continuity, committed assistant output, authoritative registries, and non-ITEMX state evidence together. Output transport for enabled domains only, with no prose or code fence. Recover every settled change omitted by the main output. ${itemRecoveryRules} ${codexRecoveryRules} Multiple events must be emitted as separate blocks in narrative order. The committed assistant output decides what actually happened; earlier context resolves identity, continuity, ownership, prior damage and user intent. Do not merely catch or copy nouns, do not invent plausible events, do not repeat events already represented in the authoritative registries, and output exactly NONE when nothing is missing.\n\n${settings.itemsEnabled ? `CURRENT INVENTORY:\n${ITEMXCore.anchor(snapshot)}` : 'ITEM DOMAIN DISABLED'}\n\n${domains.length ? `CURRENT ACTIVE SKILLS AND ENCOUNTERS:\n${ITEMXCodex.anchor(codexSnapshot, committedNarrative, 9000, { enabledDomains: domains })}` : 'CODEX DOMAINS DISABLED'}\n\nTRIGGERING USER TURN:\n${conversation.triggeringUser}\n\nRECENT NARRATIVE CONTEXT (oldest to newest):\n${conversation.recent}\n\nCOMMITTED ASSISTANT OUTPUT (visible narrative only):\n${committedNarrative}\n\nNON-ITEMX STATE EVIDENCE:\n${stateItemEvidence(current)}`;
      runtime.status = '보조 출력 검토 중';
      const response = await runAuxModel(prompt, '보조 누락 복구 중');
      const raw = modelText(response);
      if (!raw) throw new Error('보조 출력이 비어 있습니다.');
      const parsed = settings.itemsEnabled ? ITEMXCore.extractResponse(raw, snapshot.registry) : { content: stripItemTransport(raw), events: [], errors: [] };
      const validationRegistry = ITEMXCore.clone(snapshot.registry);
      const validItems = [], partials = [];
      const itemSiblings = parsed.events.filter((event) => event.kind === 'exam').map((event) => event.item);
      for (const event of parsed.events) {
        if (event.kind !== 'exam') {
          if (ITEMXCore.applyEvent(validationRegistry, event) != null) validItems.push(event);
          continue;
        }
        const evidence = ITEMXQuality.detectItemEvidence(committedNarrative, event.item, itemSiblings);
        const quality = ITEMXQuality.validateRecoveredItem(event, evidence);
        if (quality.status === 'rejected') continue;
        const accepted = quality.status === 'partial' ? ITEMXQuality.projectSafePartial(event, quality, validationRegistry) : event;
        if (ITEMXCore.applyEvent(validationRegistry, accepted) == null) continue;
        validItems.push(accepted);
        if (quality.status === 'partial') partials.push({ ...quality, event: accepted, sourceEvent: event });
      }
      let unresolvedPartials = partials;
      if (partials.length) {
        const partialMap = new Map(partials.map((one) => [one.event.item.id, one]));
        const repaired = new Map();
        try {
          const repairResponse = await runAuxModel(ITEMXQuality.repairPrompt(partials, committedNarrative), '아이템 상세정보 보완 중');
          const repairRaw = modelText(repairResponse);
          const repairParsed = repairRaw ? ITEMXCore.extractResponse(repairRaw, validationRegistry) : { events: [] };
          for (const event of repairParsed.events) {
            const accepted = ITEMXQuality.acceptRepair(event, partialMap, validationRegistry);
            if (!accepted || ITEMXCore.applyEvent(validationRegistry, accepted) == null) continue;
            validItems.push(accepted);
            const fields = repaired.get(accepted.patch.id) || new Set();
            Object.keys(accepted.patch.fields || {}).forEach((key) => fields.add(key));
            repaired.set(accepted.patch.id, fields);
          }
        } catch (error) { fail('auxiliary partial repair', error); }
        unresolvedPartials = partials.filter((one) => one.missing.some((key) => !repaired.get(one.event.item.id)?.has(key)));
      }
      const skillEvidenceText = [conversation.triggeringUser, conversation.recent, committedNarrative].filter(Boolean).join('\n\n');
      const codexParsed = ITEMXCodex.extractResponse(parsed.content, codexSnapshot, { enabledDomains: domains, rarityMode: settings.rarityMode, skillEvidenceText });
      const validationCodex = ITEMXCodex.clone(codexSnapshot);
      const validCodex = codexParsed.events.filter((event) => ITEMXCodex.applyEvent(validationCodex, event) != null);
      const valid = [...validItems, ...validCodex];
      debugRecord('auxiliary', { requested, events: valid.length, itemEvents: validItems.length, codexEvents: validCodex.length, partials: partials.length, partialFinal: unresolvedPartials.length });
      const allErrors = [...parsed.errors, ...codexParsed.errors];
      if (!valid.length && allErrors.length) throw new Error(`보조 출력 검증 실패 (${allErrors[0]})`);

      const latest = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
      if (!latest || ITEMXCore.fnv1a(messageData(latest.message?.[index])) !== sourceHash) return null;
      if (!valid.length) {
        await rememberAuxiliaryZero(ctx, guardKey);
        if (runtime.activeContextKey === ctx.key) {
          runtime.status = '보조 출력 · 누락 없음';
          await setAuxOutcome('done', '보조 검사 완료 · 누락 없음', 0);
        }
        return valid;
      }
      const next = ITEMXCore.clone(latest);
      const history = auxiliaryHistory(next);
      const reg = ITEMXCore.clone(snapshot.registry);
      const markers = validItems.map((event) => {
        const view = ITEMXCore.clone(ITEMXCore.applyEvent(reg, event));
        return ITEMXCore.marker({ v: ITEMXCore.VERSION, event, view });
      });
      const codexReg = ITEMXCodex.clone(codexSnapshot);
      for (const event of validCodex) {
        const view = ITEMXCodex.clone(ITEMXCodex.applyEvent(codexReg, event));
        markers.push(ITEMXCodex.marker({ v: ITEMXCodex.VERSION, event, view }));
      }
      const markerText = markers.join('\n');
      const message = next.message[index];
      if (typeof message?.data === 'string') message.data = positionMarkersByNarrative(`${message.data.trimEnd()}\n\n${markerText}`);
      else if (typeof message?.content === 'string') message.content = positionMarkersByNarrative(`${message.content.trimEnd()}\n\n${markerText}`);
      else return null;
      const record = { at: Date.now(), qualityRevision: ITEMXQuality.REVISION, state: unresolvedPartials.length ? 'partial_final' : 'complete', events: valid.length, partialIds: unresolvedPartials.map((one) => one.event.item.id) };
      history[guardKey] = record;
      next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_AUX_KEY]: JSON.stringify(Object.fromEntries(Object.entries(history).slice(-64))) };
      const compacted = compactMessageTransports(next, index).chat;
      const compactedLookup = buildMessageEventLookup(compacted);
      const rebuilt = rebuildWithManual(compacted, compactedLookup);
      const stillActive = runtime.activeContextKey === ctx.key;
      if (stillActive) {
        refreshLatest(compacted, compactedLookup);
        runtime.uiRemountAfter = Date.now() + 1200;
      }
      await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, ITEMXCore.writeSnapshot(compacted, rebuilt));
      if (stillActive) {
        runtime.cachedLoaded = null;
        runtime.generation += 1;
        runtime.uiRemountAfter = Date.now() + 1200;
        runtime.status = `보조 출력 · ${valid.length}건 복구`;
      }
      if (stillActive) await setAuxOutcome('done', `보조 복구 완료 · ${valid.length}건`, valid.length);
      return valid;
    }).catch(async (error) => {
      fail('auxiliary recovery', error);
      if (runtime.activeContextKey === ctx.key) {
        runtime.status = '보조 출력 실패';
        await setAuxOutcome('failed', `보조 검사 실패 · ${String(error?.message || error).slice(0, 80)}`);
      }
      return null;
    });
  }

  async function runItemModel(task, loaded, target = null, instruction = '') {
    if (typeof Risuai.runLLMModel !== 'function') throw new Error('이 PocketRisu에는 runLLMModel API가 없습니다.');
    const settings = await outputSettings(loaded.character);
    if (!settings.itemsEnabled) throw new Error('무기·아이템 기능이 OFF입니다. 설정에서 먼저 켜세요.');
    const targetJson = target ? JSON.stringify(target) : 'null';
    const prompt = `${itemxProtocolText(settings.rarityMode)}\n\nYou are running a manual ITEMX management transaction. Output ITEMX transport only; no prose and no code fence.\n${task === 'create' ? 'Create exactly one genuinely new item from the user description. Emit exactly one complete itemExam with a new snake_case id.' : 'Reappraise exactly the supplied existing item. Emit exactly one complete itemExam, keep its id, possession, location, slot and count, and update descriptive/appraisal fields according to the instruction. Never remove it and never create another id.'}\n\nCURRENT INVENTORY:\n${ITEMXCore.anchor(loaded.snapshot)}\n\nTARGET ITEM JSON:\n${targetJson}\n\nUSER INSTRUCTION:\n${instruction || (task === 'create' ? 'Create a fitting new item.' : 'Roll a fresh appraisal while preserving established facts not contradicted by context.')}`;
    const response = await runAuxModel(prompt, task === 'create' ? '신규 아이템 생성 중' : '아이템 재감정 중');
    const raw = modelText(response);
    if (!raw) throw new Error('보조 모델이 빈 응답을 반환했습니다.');
    const parsed = ITEMXCore.extractResponse(raw, loaded.snapshot.registry);
    if (parsed.errors.length || parsed.events.length !== 1 || parsed.events[0].kind !== 'exam') throw new Error(`감정 결과 검증 실패 (${parsed.errors[0] || `events=${parsed.events.length}`})`);
    const event = parsed.events[0];
    if (task === 'create') {
      if (loaded.snapshot.registry.items[event.item.id]) throw new Error('신규 생성이 기존 아이템 id를 덮으려 했습니다.');
      event.item.possession = 'owned'; event.item.location = 'inventory'; event.item.slot = null; event.item.count = Math.max(1, Number(event.item.count) || 1);
    } else {
      if (!target || event.item.id !== target.id) throw new Error('재감정 결과가 대상 id를 보존하지 않았습니다.');
      event.item.possession = target.possession; event.item.location = target.location; event.item.slot = target.slot || null; event.item.count = target.count;
    }
    return event;
  }

  function mainRequestType(type) {
    return !/(translate|emotion|memory|otherax|aux|submodel|image|tts)/i.test(String(type || ''));
  }

  function anchorText(value) {
    return String(value || '').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
  }

  function positionMarkersByNarrative(content) {
    const source = String(content || '');
    const markers = [];
    source.replace(ITEMXCore.MARKER_RE, (_, code, index) => {
      const payload = ITEMXCore.decodePayload(code);
      markers.push({ code, payload, prefix: 'ITEMX2', index });
      return '';
    });
    source.replace(ITEMXCodex.MARKER_RE, (_, code, index) => {
      const payload = ITEMXCodex.decodePayload(code);
      markers.push({ code, payload, prefix: 'CODEX2', index });
      return '';
    });
    markers.sort((a, b) => a.index - b.index);
    if (!markers.length) return source;

    const narrative = source.replace(ITEMXCore.MARKER_RE, '').replace(ITEMXCodex.MARKER_RE, '').trimEnd();
    const pieces = narrative.split(/(\n{2,})/);
    const placements = new Map();
    const trailerIndex = pieces.findIndex((piece, index) => index % 2 === 0 && /^\s*(?:\[(?:status|state|route)\b|<(?:state|status|route|risu[-_]))/i.test(piece));
    for (const marker of markers) {
      const item = marker.prefix === 'ITEMX2'
        ? (marker.payload?.event?.kind === 'exam' ? marker.payload.event.item : marker.payload?.view)
        : (marker.payload?.view || marker.payload?.event?.entity);
      const name = String(item?.name || '').trim();
      const exact = anchorText(name);
      const terms = name.split(/[\s·:()\[\]{}〈〉《》「」『』/\\,_-]+/u)
        .map(anchorText).filter((term) => term.length >= 2);
      let bestIndex = -1, bestScore = 0;
      for (let index = 0; index < pieces.length; index += 2) {
        const paragraph = anchorText(pieces[index]);
        if (!paragraph) continue;
        const exactHit = exact.length >= 2 && paragraph.includes(exact);
        const hits = terms.filter((term) => paragraph.includes(term)).length;
        const enoughTerms = terms.length > 1 ? hits >= Math.min(2, terms.length) : hits === 1;
        if (!exactHit && !enoughTerms) continue;
        const score = (exactHit ? 10000 : 0) + hits * 100;
        if (score > bestScore) { bestScore = score; bestIndex = index; }
      }
      if (bestIndex < 0) {
        const prefixText = source.slice(0, marker.index).replace(ITEMXCore.MARKER_RE, '').replace(ITEMXCodex.MARKER_RE, '');
        bestIndex = Math.min(Math.max(0, (prefixText.split(/\n{2,}/).length - 1) * 2), Math.max(0, pieces.length - 1));
        if (bestIndex % 2) bestIndex -= 1;
        if (trailerIndex >= 0 && bestIndex >= trailerIndex) bestIndex = Math.max(0, trailerIndex - 2);
      }
      if (trailerIndex >= 0 && bestIndex >= trailerIndex) bestIndex = Math.max(0, trailerIndex - 2);
      const list = placements.get(bestIndex) || [];
      list.push(marker);
      placements.set(bestIndex, list);
    }
    for (const [index, rows] of placements) {
      pieces[index] = `${pieces[index].trimEnd()}\n\n${rows.map((row) => `<!--${row.prefix}:${row.code}-->`).join('\n')}`;
    }
    let positioned = pieces.join('').trimEnd();
    return positioned;
  }

  function scheduleLegacyCommitRecovery(confirm = false) {
    if (runtime.auxActive > 0 || runtime.auxRecoveryPromise) return;
    if (runtime.legacyCommitTimer) globalThis.clearTimeout(runtime.legacyCommitTimer);
    runtime.legacyCommitTimer = globalThis.setTimeout(async () => {
      runtime.legacyCommitTimer = null;
      try {
        await rebuildCurrent();
        await catchUpLatestOutput();
        await ensureRootInventory();
        if (!confirm && runtime.auxActive === 0 && !runtime.auxRecoveryPromise) scheduleLegacyCommitRecovery(true);
      } catch (error) { fail('legacy commit recovery', error); }
    }, 1800);
  }

  async function repairCommittedTransport(ctx, index, source) {
    const settings = await outputSettings(ctx.character);
    const lookup = buildMessageEventLookup(ctx.chat);
    const base = rebuildWithManual(ctx.chat, lookup).registry;
    const parsed = settings.itemsEnabled ? ITEMXCore.extractResponse(source, base) : { content: stripItemTransport(source), events: [], errors: [] };
    const codexBase = rebuildCodexWithLedger(ctx.chat, lookup, { rarityMode: settings.rarityMode });
    const codexParsed = ITEMXCodex.extractResponse(parsed.content, codexBase, { enabledDomains: enabledCodexDomains(settings), rarityMode: settings.rarityMode, skillEvidenceText: source });
    const positioned = positionMarkersByNarrative(codexParsed.content);
    const needsCompaction = ITEMXCore.MARKER_RE.test(positioned) || ITEMXCodex.MARKER_RE.test(positioned);
    ITEMXCore.MARKER_RE.lastIndex = 0; ITEMXCodex.MARKER_RE.lastIndex = 0;
    if (positioned === source && !needsCompaction) return { ctx, source };
    const latest = await Risuai.getChatFromIndex(ctx.characterIndex, ctx.chatIndex);
    if (!latest || ITEMXCore.fnv1a(messageData(latest.message?.[index])) !== ITEMXCore.fnv1a(source)) return null;
    const next = ITEMXCore.clone(latest);
    const message = next.message?.[index];
    if (typeof message?.data === 'string') message.data = positioned;
    else if (typeof message?.content === 'string') message.content = positioned;
    else return null;
    const compacted = compactMessageTransports(next, index).chat;
    const compactedSource = messageData(compacted.message?.[index]);
    const compactedLookup = buildMessageEventLookup(compacted);
    const snapshot = rebuildWithManual(compacted, compactedLookup);
    const stillActive = runtime.activeContextKey === ctx.key;
    if (stillActive) {
      refreshLatest(compacted, compactedLookup);
      runtime.rootFingerprint = '';
      runtime.cachedLoaded = null;
      runtime.generation += 1;
      runtime.uiRemountAfter = Date.now() + 1200;
    }
    await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, ITEMXCore.writeSnapshot(compacted, snapshot));
    const errors = parsed.errors.length + codexParsed.errors.length, events = parsed.events.length + codexParsed.events.length;
    if (stillActive) runtime.status = errors ? `깨진 전송 격리 · ${errors}건` : `누락 훅 복구 · ${events}건`;
    return { ctx: { ...ctx, chat: compacted }, source: compactedSource };
  }

  async function catchUpLatestOutput() {
    if (!runtime.activeContextKey || runtime.auxActive > 0 || runtime.auxRecoveryPromise || runtime.bodyFxScrollActive) return;
    let ctx = await context();
    if (!ctx || !(await isEnabled(ctx.character))) return;
    const index = assistantMessageIndex(ctx.chat);
    if (index < 0) return;
    let source = messageData(ctx.chat.message[index]);
    if (!automaticAuxReady(ctx.chat, index, source)) return;
    if (!automaticAuxSettled(ctx, index, source)) return;
    const repaired = await repairCommittedTransport(ctx, index, source);
    if (!repaired) return;
    source = repaired.source;
    ctx = repaired.ctx;
    if (runtime.activeContextKey !== ctx.key) return;
    const fingerprint = `${ctx.key}:${index}:visible-${auxiliarySemanticHash(source)}`;
    if (fingerprint === runtime.catchUpFingerprint) return;
    if (fingerprint === runtime.catchUpFailedFingerprint && Date.now() < runtime.catchUpRetryAt) return;
    const result = await recoverAuxiliaryOutput({ messageIndex: index });
    if (Array.isArray(result)) {
      runtime.catchUpFingerprint = fingerprint;
      runtime.catchUpFailedFingerprint = '';
      runtime.catchUpFailures = 0;
      runtime.catchUpRetryAt = 0;
    } else {
      runtime.catchUpFailedFingerprint = fingerprint;
      runtime.catchUpFailures = Math.min(runtime.catchUpFailures + 1, 6);
      runtime.catchUpRetryAt = Date.now() + Math.min(120000, 5000 * (2 ** runtime.catchUpFailures));
    }
    await ensureRootInventory();
  }

  const beforeRequest = async (messages, type) => {
    const safeMessages = (messages || []).map((message) => ({ ...message, content: processTransportStripper(message.content) }));
    if (!mainRequestType(type)) return safeMessages;
    try {
      const loaded = await rebuildCurrent();
      if (!loaded || !(await isEnabled(loaded.character))) return safeMessages;
      const settings = await outputSettings(loaded.character);
      runtime.debugEnabled = settings.debugEnabled;
      if (!settings.mainOutput) return safeMessages;
      if (!settings.itemsEnabled && !settings.skillsEnabled && !settings.encountersEnabled) return safeMessages;
      const recent = safeMessages.slice(-4).map((message) => message.content || '').join('\n');
      const domains = enabledCodexDomains(settings);
      const moduleAssets = await modulePortraitAssets(settings, loaded.character, loaded.chat);
      const instruction = `${protocolForSettings(settings, loaded.character, moduleAssets)}${settings.itemsEnabled ? `\n\n${ITEMXCore.anchor(loaded.snapshot)}` : ''}${domains.length ? `\n\n${ITEMXCodex.anchor(loaded.codexSnapshot, recent, 9000, { enabledDomains: domains })}` : ''}`;
      debugRecord('beforeRequest', { items: settings.itemsEnabled, skills: settings.skillsEnabled, encounters: settings.encountersEnabled, messages: safeMessages.length });
      return [{ role: 'system', content: instruction, name: 'ITEMX_2_PROTOCOL' }, ...safeMessages];
    } catch (error) { fail('beforeRequest', error); return safeMessages; }
  };

  const processHandler = async (content) => processTransportStripper(content);

  async function processOutput(content, type) {
    if (!mainRequestType(type)) return content;
    try {
      const ctx = await context();
      if (!ctx) return content;
      const enabled = await isEnabled(ctx.character);
      const settings = await outputSettings(ctx.character);
      runtime.debugEnabled = settings.debugEnabled;
      if (!enabled || !settings.mainOutput) return stripAllTransport(content);
      const lookup = buildMessageEventLookup(ctx.chat);
      const base = rebuildWithManual(ctx.chat, lookup).registry;
      const result = settings.itemsEnabled ? ITEMXCore.extractResponse(content, base) : { content: stripItemTransport(content), events: [], errors: [] };
      const codexResult = ITEMXCodex.extractResponse(result.content, rebuildCodexWithLedger(ctx.chat, lookup, { rarityMode: settings.rarityMode }), { enabledDomains: enabledCodexDomains(settings), rarityMode: settings.rarityMode, skillEvidenceText: content });
      const positioned = positionMarkersByNarrative(codexResult.content);
      if (result.events.length || result.errors.length || codexResult.events.length || codexResult.errors.length || codexResult.content !== content) {
        runtime.latestOutput = positioned;
        runtime.latestMarkers = markerCodes(positioned);
        runtime.pendingMarkers = new Set(runtime.latestMarkers);
        runtime.pendingMarkersAt = Date.now();
        const errors = result.errors.length + codexResult.errors.length, events = result.events.length + codexResult.events.length;
        runtime.status = errors ? `격리 ${errors}건` : `메인 출력 ${events}건 처리`;
        runtime.generation += 1;
        debugRecord('processOutput', { itemEvents: result.events.length, codexEvents: codexResult.events.length, errors });
      }
      return positioned;
    } catch (error) {
      fail('processOutput', error);
      return stripAllTransport(content);
    }
  }

  const afterRequest = async (content, type) => processOutput(content, type);
  const outputFallback = async (content) => {
    const processed = await processOutput(content, 'main');
    if (runtime.hooks.listener === 'unsupported' && runtime.auxActive === 0 && !runtime.auxRecoveryPromise) scheduleLegacyCommitRecovery();
    return processed;
  };

  const displayHandler = (content) => {
    const raw = String(content || '');
    if (!raw.includes('<!--ITEMX2') && !raw.includes('<!--CODEX2')) return content;
    const positioned = raw.includes('<!--ITEMX2:') || raw.includes('<!--CODEX2:') ? positionMarkersByNarrative(raw) : raw;
    const source = coalesceAdjacentItemMarkers(positioned);
    let found = false, hasFullCard = false;
    const renderPayload = (cacheKey, payload, motion) => {
      const key = `${cacheKey}:${motion}`;
      if (runtime.markerHtmlCache.has(key)) return runtime.markerHtmlCache.get(key);
      const html = ITEMXRenderer.renderMarkerPayload(payload, { inline: true, motion });
      runtime.markerHtmlCache.set(key, html);
      while (runtime.markerHtmlCache.size > 64) runtime.markerHtmlCache.delete(runtime.markerHtmlCache.keys().next().value);
      return html;
    };
    const itemMotion = runtime.visualEffectsEnabled ? 'full' : 'off';
    const rendered = source.replace(ITEMXCore.MARKER_RE, (_, code) => {
      found = true;
      const payload = ITEMXCore.decodePayload(code);
      if (!payload || payload.error) return '';
      const html = renderPayload(`item:${code}`, payload, itemMotion);
      if (html) { hasFullCard = true; return html; }
      const item = payload.event?.kind === 'exam' ? payload.event.item : payload.view;
      return item ? `<span class="itemx-event-chip">${ITEMXCore.esc(ITEMXCore.resolveItemEmoji(item))} ${ITEMXCore.esc(item.name || item.id)}</span>` : '';
    }).replace(ITEMXCodex.MARKER_RE, (_, code) => {
      found = true;
      const payload = ITEMXCodex.decodePayload(code), entity = payload?.view || payload?.event?.entity;
      if (!entity || payload.error) return '';
      const skill = payload.event?.domain === 'skill', kind = skill ? '스킬' : '조우 도감';
      return `<span class="itemx-event-chip">${ITEMXCore.esc(skill ? skillEmoji(entity) : encounterEmoji(entity))} ${ITEMXCore.esc(kind)} · ${ITEMXCore.esc(entity.name || entity.id)}</span>`;
    }).replace(ITEMX_REF_RE, (_, ref, inline) => {
      found = true;
      const payload = inlineViewPayload(inline, 'item') || runtime.eventPayloads.get(`item:${ref}`);
      if (!payload || payload.error) return `<span class="itemx-event-chip">📦 ITEMX CODEX · 기록 복원 중</span>`;
      const html = renderPayload(`item-ref:${ref}`, payload, itemMotion);
      if (html) { hasFullCard = true; return html; }
      const item = payload.view || payload.event?.item;
      return item ? `<span class="itemx-event-chip">${ITEMXCore.esc(ITEMXCore.resolveItemEmoji(item))} ${ITEMXCore.esc(item.name || item.id)}</span>` : `<span class="itemx-event-chip">📦 ITEMX CODEX · ${ITEMXCore.esc(ref)}</span>`;
    }).replace(ITEMX_CODEX_REF_RE, (_, ref, inline) => {
      found = true;
      const payload = inlineViewPayload(inline, 'codex') || runtime.eventPayloads.get(`codex:${ref}`), entity = payload?.view || payload?.event?.entity;
      if (!entity || payload.error) return `<span class="itemx-event-chip">✦ 도감 기록 복원 중</span>`;
      const skill = payload.event?.domain === 'skill', kind = skill ? '스킬' : '조우 도감';
      return `<span class="itemx-event-chip">${ITEMXCore.esc(skill ? skillEmoji(entity) : encounterEmoji(entity))} ${ITEMXCore.esc(kind)} · ${ITEMXCore.esc(entity.name || entity.id)}</span>`;
    });
    if (!found) return content;
    if (runtime.mainStyle) return rendered;
    return `<style>${hasFullCard ? ITEMX_CHAT_STYLE : ITEMX_CHIP_STYLE}</style>${rendered}`;
  };

  function beginBodyScrollEffects() {
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = globalThis.setTimeout(() => {
      runtime.bodyFxStartTimer = null;
      if (runtime.bodyFxScrollActive || !runtime.bodyFxClassOwner) return;
      runtime.bodyFxScrollActive = true;
      void runtime.bodyFxClassOwner.addClass('x-risu-itemx-body-scrolling').catch(() => {});
    }, 70);
  }

  function endBodyScrollEffects(delayMs = 0) {
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = null;
    if (runtime.bodyFxScrollTimer) globalThis.clearTimeout(runtime.bodyFxScrollTimer);
    runtime.bodyFxScrollTimer = globalThis.setTimeout(() => {
      runtime.bodyFxScrollTimer = null;
      if (!runtime.bodyFxScrollActive) return;
      runtime.bodyFxScrollActive = false;
      if (runtime.bodyFxClassOwner) void runtime.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling').catch(() => {});
      scheduleHostDomSync(180);
    }, delayMs);
  }

  async function removeBodyEffectGovernor() {
    const owner = runtime.bodyFxEventOwner;
    if (owner) for (const binding of runtime.bodyFxEventIds) {
      try { await owner.removeEventListener(binding.type, binding.id, true); }
      catch (error) { debugRecord('body effect listener remove', error?.message || String(error)); }
    }
    runtime.bodyFxEventIds = [];
    runtime.bodyFxEventOwner = null;
  }

  async function installBodyEffectGovernor() {
    if (!runtime.mainDoc) return;
    try {
      runtime.bodyFxClassOwner = await runtime.mainDoc.querySelector('.chattext') || runtime.bodyFxClassOwner;
      if (runtime.bodyFxEventOwner) {
        try { if (await runtime.bodyFxEventOwner.getParent()) return; }
        catch {}
        await removeBodyEffectGovernor();
      }
      const body = await runtime.mainDoc.querySelector('body');
      if (!body) return;
      runtime.bodyFxEventOwner = body;
      const bindings = [
        ['pointerdown', beginBodyScrollEffects],
        ['pointerup', () => endBodyScrollEffects(900)],
        ['pointercancel', () => endBodyScrollEffects(120)],
        ['scrollend', () => endBodyScrollEffects(40)]
      ];
      for (const [type, handler] of bindings) {
        const id = await body.addEventListener(type, handler, true);
        runtime.bodyFxEventIds.push({ type, id });
      }
    } catch (error) { debugRecord('body effect governor install', error?.message || String(error)); }
  }

  async function syncMainEffectsState() {
    if (!runtime.mainDoc) return;
    try {
      const body = await runtime.mainDoc.querySelector('body');
      if (!body) return;
      if (runtime.visualEffectsEnabled) await body.removeClass('x-risu-itemx2-effects-off');
      else await body.addClass('x-risu-itemx2-effects-off');
    } catch (error) { debugRecord('effect setting sync', error?.message || String(error)); }
  }

  async function syncRootFontScale(value) {
    const root = runtime.rootDrawer;
    if (!root) return;
    for (const scale of ['small', 'medium', 'large']) {
      try { await root.removeClass(`x-risu-itemx2-font-${scale}`); } catch {}
    }
    try { await root.addClass(`x-risu-itemx2-font-${['small', 'medium', 'large'].includes(value) ? value : 'small'}`); } catch {}
  }

  async function installMainStyle() {
    try {
      if (runtime.mainStyle && runtime.mainStylePosition === runtime.badgePosition) {
        try {
          if (!(await runtime.mainStyle.getParent())) throw new Error('detached style owner');
          runtime.permissions.mainDom = true;
          runtime.lastDomError = '';
          await installBodyEffectGovernor();
          await syncMainEffectsState();
          await installHostObserver();
          return true;
        } catch {
          runtime.mainStyle = null;
          runtime.mainDoc = null;
          runtime.bodyFxClassOwner = null;
        }
      }
      const doc = await Risuai.getRootDocument();
      if (!doc) {
        runtime.permissions.mainDom = false;
        runtime.lastDomError = '메인 문서 API가 null을 반환했습니다';
        return false;
      }
      runtime.mainDoc = doc;
      runtime.permissions.mainDom = true;
      const existing = await doc.querySelector('style[x-itemx2-style="owner"]');
      if (existing) { runtime.mainStyle = existing; await existing.setTextContent(mainStyleText()); runtime.mainStylePosition = runtime.badgePosition; await installBodyEffectGovernor(); await syncMainEffectsState(); await installHostObserver(); return true; }
      const style = await doc.createElement('style');
      await style.setAttribute('x-itemx2-style', 'owner');
      await style.setTextContent(mainStyleText());
      const head = await doc.querySelector('head');
      if (head) await head.appendChild(style); else await doc.appendChild(style);
      runtime.mainStyle = style;
      runtime.mainStylePosition = runtime.badgePosition;
      runtime.lastDomError = '';
      await installBodyEffectGovernor();
      await syncMainEffectsState();
      await installHostObserver();
      return true;
    } catch (error) {
      runtime.permissions.mainDom = false;
      runtime.mainStyle = null;
      runtime.mainStylePosition = '';
      runtime.mainDoc = null;
      runtime.lastDomError = String(error?.message || error || '알 수 없는 DOM 오류');
      fail('main style connection', error);
      return false;
    }
  }

  function itemsOf(snapshot) {
    const reg = snapshot?.registry || ITEMXCore.newRegistry();
    return reg.order.map((id) => reg.items[id]).filter(Boolean);
  }

  function rootPageItems(loaded) {
    const all = itemsOf(loaded?.snapshot).slice(0, 60);
    const pageCount = Math.max(1, Math.ceil(all.length / ITEMX_ROOT_PAGE_SIZE));
    runtime.rootItemPage = Math.max(0, Math.min(pageCount - 1, runtime.rootItemPage));
    const start = runtime.rootItemPage * ITEMX_ROOT_PAGE_SIZE;
    return all.slice(start, start + ITEMX_ROOT_PAGE_SIZE);
  }

  function itemDetailHtml(item) {
    const motion = runtime.visualEffectsEnabled ? 'full' : 'off';
    const key = `${item.id}:${ITEMXCore.fnv1a(JSON.stringify(item))}:${motion}`;
    if (runtime.detailHtmlCache.has(key)) return runtime.detailHtmlCache.get(key);
    const html = ITEMXRenderer.renderCard(item, { motion });
    runtime.detailHtmlCache.set(key, html);
    while (runtime.detailHtmlCache.size > 60) runtime.detailHtmlCache.delete(runtime.detailHtmlCache.keys().next().value);
    return html;
  }

  async function hydrateCheckedItemDetail(loaded) {
    if (!runtime.mainDoc || !loaded) return false;
    const detailItems = rootPageItems(loaded);
    for (let index = 0; index < detailItems.length; index += 1) {
      const selected = await runtime.mainDoc.querySelector(`#itemx2-detail-${index}:checked`);
      if (!selected) continue;
      const detail = await queryMainClass(`itemx2-root-detail-body-${index}`);
      if (detail) await detail.setInnerHTML(itemDetailHtml(detailItems[index]));
      return Boolean(detail);
    }
    return false;
  }

  async function queryMainClass(className) {
    if (!runtime.mainDoc) return null;
    return await runtime.mainDoc.querySelector(`.x-risu-${className}`)
      || await runtime.mainDoc.querySelector(`.${className}`);
  }

  async function removeRootClickRouter() {
    const owner = runtime.rootClickOwner;
    const bindings = runtime.rootClickBindings.slice();
    if (owner) for (const binding of bindings) {
      try { await owner.removeEventListener(binding.type, binding.id, binding.capture); }
      catch (error) { debugRecord('root click remove', error?.message || String(error)); }
    }
    runtime.rootClickBindings = [];
    runtime.rootClickOwner = null;
    runtime.rootClickBusy = false;
  }

  async function removeRootDrawer() {
    if (runtime.feedbackTimer) globalThis.clearTimeout(runtime.feedbackTimer);
    runtime.feedbackTimer = null;
    await removeRootClickRouter();
    try { if (runtime.rootDrawer) await runtime.rootDrawer.remove(); } catch {}
    if (runtime.mainDoc) {
      try {
        const safeRoots = await runtime.mainDoc.querySelectorAll('[x-itemx2-drawer="owner"]');
        const roots = await Risuai.unwarpSafeArray(safeRoots);
        for (const root of roots) { try { await root.remove(); } catch {} }
      } catch (error) { fail('remove duplicate root drawers', error); }
    }
    runtime.rootDrawer = null;
    runtime.rootFingerprint = '';
    runtime.rootContentReady = false;
  }

  async function mountRootLoading(label = 'ITEMX CODEX 초기화 중…') {
    if (!runtime.mainDoc) return false;
    await removeRootDrawer();
    const root = await runtime.mainDoc.createElement('div');
    await root.setAttribute('x-itemx2-drawer', 'owner');
    await root.setClassName('x-risu-itemx2-root-drawer x-risu-itemx2-booting');
    await root.setInnerHTML(`<div class="itemx2-boot-card" role="status" aria-live="polite"><i></i><span><strong>${ITEMXCore.esc(label)}</strong><small>화면과 모델 연결을 준비하고 있습니다.</small></span></div>`);
    const body = await runtime.mainDoc.querySelector('body');
    if (!body) return false;
    await body.appendChild(root);
    runtime.rootDrawer = root;
    runtime.rootFingerprint = 'booting';
    return true;
  }

  async function updateRootLoading(label) {
    if (!runtime.mainDoc || !runtime.rootDrawer) return;
    try {
      const target = await runtime.mainDoc.querySelector('.x-risu-itemx2-boot-card strong');
      if (target) await target.setTextContent(label);
    } catch (error) { fail('loading label', error); }
  }

  async function showRootFeedback(message, tone = 'success', timeoutMs = 2600) {
    if (!runtime.mainDoc || !runtime.rootDrawer) return false;
    try {
      const toast = await runtime.mainDoc.querySelector('.x-risu-itemx2-feedback');
      if (!toast) return false;
      if (runtime.feedbackTimer) globalThis.clearTimeout(runtime.feedbackTimer);
      runtime.feedbackTimer = null;
      await toast.setTextContent(message);
      for (const value of ['success', 'error', 'working']) await toast.removeClass(`x-risu-itemx2-feedback-${value}`);
      await toast.addClass(`x-risu-itemx2-feedback-${tone}`);
      await toast.addClass('x-risu-itemx2-feedback-on');
      if (timeoutMs > 0) {
        runtime.feedbackTimer = globalThis.setTimeout(() => {
          void toast.removeClass('x-risu-itemx2-feedback-on').catch(() => {});
          runtime.feedbackTimer = null;
        }, timeoutMs);
      }
      return true;
    } catch (error) {
      fail('root feedback', error);
      return false;
    }
  }

  function scheduleHostDomSync(delayMs = 320) {
    if (runtime.hostSyncTimer) globalThis.clearTimeout(runtime.hostSyncTimer);
    runtime.hostSyncTimer = globalThis.setTimeout(async () => {
      runtime.hostSyncTimer = null;
      if (runtime.bodyFxScrollActive) { scheduleHostDomSync(420); return; }
      if (runtime.hostSyncBusy) return;
      runtime.hostSyncBusy = true;
      try {
        await installBodyEffectGovernor();
        await ensureRootInventory();
        await syncHostSettingsVisibility();
      } catch (error) { debugRecord('host DOM sync', error?.message || String(error)); }
      finally { runtime.hostSyncBusy = false; }
    }, delayMs);
  }

  async function installHostObserver() {
    if (!runtime.mainDoc || runtime.hostObserver || typeof Risuai.createMutationObserver !== 'function') return;
    try {
      const body = await runtime.mainDoc.querySelector('body');
      if (!body) return;
      runtime.hostObserver = await Risuai.createMutationObserver((recordsSafe) => {
        void (async () => {
          try {
            const records = await Risuai.unwarpSafeArray(recordsSafe);
            if (!records.length) { scheduleHostDomSync(); return; }
            for (const record of records) {
              const target = await record.getTarget();
              if (!target || !(await target.matches('[x-itemx2-drawer="owner"], [x-itemx2-drawer="owner"] *'))) {
                scheduleHostDomSync();
                return;
              }
            }
          } catch (error) {
            debugRecord('host observer classify', error?.message || String(error));
            scheduleHostDomSync();
          }
        })();
      });
      if (runtime.hostObserver?.observe) await runtime.hostObserver.observe(body, { childList: true, subtree: true });
    } catch (error) {
      runtime.hostObserver = null;
      debugRecord('host observer install', error?.message || String(error));
    }
  }

  async function hostPluginSettingsVisible() {
    if (!runtime.mainDoc || runtime.allowDrawerOverSettings) return false;
    try {
      const safeTargets = await runtime.mainDoc.querySelectorAll('button,[role="button"]');
      const targets = await Risuai.unwarpSafeArray(safeTargets);
      for (const target of targets.slice(0, 96)) {
        const text = String(await target.textContent() || '').replace(/\s+/g, ' ').trim();
        if (!text.includes('ITEMX CODEX · 권한 및 설정')) continue;
        const rect = await target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return true;
      }
    } catch (error) { fail('host settings visibility', error); }
    return false;
  }

  async function syncHostSettingsVisibility() {
    if (!runtime.rootDrawer) return;
    const visible = await hostPluginSettingsVisible();
    if (runtime.hostSettingsVisible === visible) return;
    runtime.hostSettingsVisible = visible;
    try {
      if (visible) await runtime.rootDrawer.addClass('x-risu-itemx2-host-settings');
      else await runtime.rootDrawer.removeClass('x-risu-itemx2-host-settings');
    } catch (error) { fail('host settings badge visibility', error); }
  }

  async function setRootOpen(open) {
    if (!runtime.rootDrawer) return false;
    try {
      if (!(await runtime.rootDrawer.getParent())) return false;
      if (open) await runtime.rootDrawer.addClass('x-risu-itemx2-is-open');
      else {
        await runtime.rootDrawer.removeClass('x-risu-itemx2-is-open');
        runtime.allowDrawerOverSettings = false;
        await syncHostSettingsVisibility();
      }
      return true;
    } catch { return false; }
  }

  async function resetRuntimeForContext(active) {
    const nextKey = active?.key || '';
    if (runtime.activeContextKey === nextKey) return false;
    runtime.activeContextKey = nextKey;
    runtime.rootItemPage = 0;
    runtime.cachedLoaded = null;
    runtime.cachedGeneration = -1;
    runtime.pendingMarkers.clear();
    runtime.pendingMarkersAt = 0;
    runtime.markerHtmlCache.clear();
    runtime.detailHtmlCache.clear();
    runtime.catchUpFingerprint = '';
    runtime.catchUpFailedFingerprint = '';
    runtime.catchUpFailures = 0;
    runtime.catchUpRetryAt = 0;
    runtime.auxCandidateFingerprint = '';
    runtime.cleanupArmedUntil = 0;
    runtime.uiRemountAfter = 0;
    if (runtime.legacyCommitTimer) globalThis.clearTimeout(runtime.legacyCommitTimer);
    runtime.legacyCommitTimer = null;
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = null;
    if (runtime.bodyFxScrollTimer) globalThis.clearTimeout(runtime.bodyFxScrollTimer);
    runtime.bodyFxScrollTimer = null;
    if (runtime.bodyFxScrollActive && runtime.bodyFxClassOwner) {
      try { await runtime.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling'); } catch {}
    }
    runtime.bodyFxScrollActive = false;
    runtime.bodyFxClassOwner = null;
    refreshLatest(active?.chat || { message: [], scriptstate: {} });
    await removeRootDrawer();
    return true;
  }

  async function ensureRootInventory() {
    if (runtime.bodyFxScrollActive) return;
    runtime.remountFallbackAt = Date.now();
    const active = await context();
    const contextChanged = await resetRuntimeForContext(active);
    if (!active) {
      runtime.status = '채팅 진입 대기';
      return;
    }
    if (runtime.remounting) return;
    if (!contextChanged && (runtime.auxActive > 0 || runtime.auxRecoveryPromise || Date.now() < runtime.uiRemountAfter)) return;
    runtime.remounting = true;
    try {
      if (!runtime.hooks.output || !runtime.hooks.display || !runtime.hooks.before || !runtime.hooks.after) await installPipelineHooks();
      if (contextChanged) {
        if (!runtime.mainDoc && !(await installMainStyle())) return;
        const loaded = await rebuildCurrent({ upgradeDisplayRefs: true });
        if (loaded) await openRootInventory({ open: false, loaded });
        void checkForUpdate();
        return;
      }
      if (!runtime.mainDoc && !(await installMainStyle())) return;
      let drawerAttached = false;
      if (runtime.rootDrawer) {
        try { drawerAttached = Boolean(await runtime.rootDrawer.getParent()); }
        catch { runtime.rootDrawer = null; }
      }
      if (!drawerAttached) {
        const safeMounted = await runtime.mainDoc.querySelectorAll('[x-itemx2-drawer="owner"]');
        const mounted = await Risuai.unwarpSafeArray(safeMounted);
        if (mounted.length === 1) {
          runtime.rootDrawer = mounted[0];
          await installRootClickRouter(runtime.rootDrawer);
        } else {
          await removeRootClickRouter();
          runtime.rootDrawer = null;
          await openRootInventory({ open: false });
          return;
        }
      }
      let styleAttached = false;
      if (runtime.mainStyle) {
        try { styleAttached = Boolean(await runtime.mainStyle.getParent()); }
        catch { runtime.mainStyle = null; }
      }
      if (!styleAttached) {
        const style = await runtime.mainDoc.querySelector('style[x-itemx2-style="owner"]');
        if (style) runtime.mainStyle = style;
        else { runtime.mainStyle = null; await installMainStyle(); }
      }
    } catch (error) { fail('root remount', error); }
    finally { runtime.remounting = false; }
  }

  async function loadCodexPortraits(character, chat, codexSnapshot, settings) {
    const result = {}, catalog = combinedPortraitAssets(character, await modulePortraitAssets(settings, character, chat), 600);
    if (typeof Risuai.readImage !== 'function') return result;
    const asDataUrl = (value, ext = '') => {
      if (typeof value === 'string') return /^(?:blob:|https?:|data:image\/(?:png|jpeg|webp|gif|avif);base64,)/i.test(value) ? value : '';
      let bytes = null;
      if (value instanceof Uint8Array) bytes = value;
      else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
      else if (Array.isArray(value)) bytes = Uint8Array.from(value);
      else if (value?.data instanceof Uint8Array) bytes = value.data;
      if (!bytes?.length || bytes.length > 12 * 1024 * 1024) return '';
      const lower = String(ext || '').toLowerCase();
      const mime = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png'
        : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
          : bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 ? 'image/webp'
            : bytes[0] === 0x47 && bytes[1] === 0x49 ? 'image/gif'
              : bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 && bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && [0x66, 0x73].includes(bytes[11]) ? 'image/avif'
                : ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' }[lower] || '');
      if (!mime) return '';
      let binary = ''; for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      return `data:${mime};base64,${btoa(binary)}`;
    };
    const monsters = (codexSnapshot?.monsters?.order || []).map((id) => codexSnapshot.monsters.entries[id]).filter(Boolean).slice(0, 20);
    const narrative = (chat?.message || []).slice(-8).map((message) => ITEMXCore.messageText(message)).join('\n');
    await Promise.all(monsters.map(async (monster) => {
      const asset = ITEMXCodex.assetForEntity(catalog, monster, narrative); if (!asset) return;
      const cacheKey = `${character?.chaId || character?.id || 'character'}:${asset.id}:${asset.ext || ''}`;
      if (runtime.portraitCache.has(cacheKey)) { result[monster.id] = runtime.portraitCache.get(cacheKey); return; }
      try {
        const image = asDataUrl(await Risuai.readImage(asset.id), asset.ext);
        if (image) {
          result[monster.id] = image;
          if (image.length <= 4 * 1024 * 1024) {
            runtime.portraitCache.set(cacheKey, image);
            runtime.portraitCacheBytes += image.length;
            while (runtime.portraitCache.size > 24 || runtime.portraitCacheBytes > 16 * 1024 * 1024) {
              const oldest = runtime.portraitCache.keys().next().value, removed = runtime.portraitCache.get(oldest) || '';
              runtime.portraitCache.delete(oldest); runtime.portraitCacheBytes = Math.max(0, runtime.portraitCacheBytes - removed.length);
            }
          }
        }
      } catch {}
    }));
    return result;
  }

  const skillEmoji = (skill) => ITEMXCore.resolveSkillGlyph(skill);
  const encounterEmoji = (monster) => ITEMXCore.resolveMonsterGlyph(monster);

  const themeText = (value) => String(value || '').trim().toLowerCase();
  function skillTheme(skill) {
    const value = themeText(`${skill.affinity || ''} ${skill.school || ''}`);
    if (/화염|불|fire|flame|ember/.test(value)) return 'fire';
    if (/빙|냉|서리|ice|frost|cold/.test(value)) return 'ice';
    if (/번개|뇌|전기|lightning|thunder|electric/.test(value)) return 'lightning';
    if (/암흑|어둠|그림자|dark|shadow|void/.test(value)) return 'dark';
    if (/빛|신성|광휘|light|holy|radiant/.test(value)) return 'light';
    return 'arcane';
  }
  function skillRankTier(rank, rarityMode = 'world') {
    const value = themeText(rank);
    const tiers = [
      ['empyrean', /empyrean|창천|천상|초월|금기|transcendent/],
      ['mythical', /mythical|신화|신공|현경|mythic/],
      ['legendary', /legendary|전설|화경/],
      ['epic', /epic|에픽|절기|초절정/],
      ['unique', /unique|유니크|비전|절정|영웅/],
      ['rare', /rare|레어|희귀|상급|고급|일류/],
      ['magic', /magic|매직|비범|중급|숙련|이류/],
      ['normal', /normal|common|일반|기초|초급|하급|삼류/]
    ];
    const matched = tiers.find(([, pattern]) => pattern.test(value));
    if (matched) return matched[0];
    return rarityMode === 'itemx' ? 'normal' : 'magic';
  }
  function skillFxClasses(skill, rarityMode = 'world') {
    const type = ['active', 'passive', 'sealed'].includes(themeText(skill.type)) ? themeText(skill.type) : 'active';
    const status = ['learned', 'equipped', 'sealed', 'lost'].includes(themeText(skill.status)) ? themeText(skill.status) : 'learned';
    const tier = skillRankTier(skill.rank, rarityMode);
    return `itemx2-skill-theme-${skillTheme(skill)} itemx2-skill-rank-${tier} rarity-${tier} itemx2-skill-type-${type} itemx2-skill-status-${status}`;
  }
  function encounterTheme(monster) {
    const value = themeText(monster.kind);
    if (/용|dragon|drake|wyrm/.test(value)) return 'dragon';
    if (/언데드|망령|유령|좀비|undead|ghost|specter|zombie/.test(value)) return 'undead';
    if (/골렘|기계|인형|구조체|construct|golem|machine|automaton/.test(value)) return 'construct';
    if (/수생|어류|해양|aquatic|fish|marine|serpent/.test(value)) return 'aquatic';
    if (/곤충|벌레|insect|bug|arachnid|spider/.test(value)) return 'insect';
    if (/야수|짐승|동물|beast|animal|wolf|tiger/.test(value)) return 'beast';
    if (/인간|인물|사람|전사|기사|마법사|human|humanoid|person|warrior|knight|mage/.test(value)) return 'humanoid';
    return 'unknown';
  }
  function encounterThreatLevel(value) {
    const text = themeText(value);
    if (/최상|극위험|재앙|catastrophic|extreme|sss|\bss\b/.test(text)) return 3;
    if (/고위험|위험|high|dangerous/.test(text)) return 2;
    if (/중간|중위험|medium|moderate/.test(text)) return 1;
    return 0;
  }
  function encounterFxClasses(monster) {
    const relation = themeText(monster.relation), status = themeText(monster.status);
    const warning = monster.active || /hostile|적대|enemy|전투/.test(relation) ? 'itemx2-encounter-warning' : '';
    const sparring = /대련|spar|rival|friendly/.test(relation) ? 'itemx2-encounter-sparring' : '';
    const ended = /ended|defeated|escaped|dead|lost|종료|격퇴|패배|도주|사망|소실/.test(status) ? 'itemx2-encounter-ended' : '';
    return `itemx2-encounter-theme-${encounterTheme(monster)} itemx2-threat-${encounterThreatLevel(monster.threat)} ${warning} ${sparring} ${ended}`.trim();
  }
  const codexListFx = (domain, classes) => `<span class="itemx2-codex-fx itemx2-codex-list-fx itemx2-${domain}-list-fx ${classes}" aria-hidden="true"></span>`;
  const codexHeroFx = (domain) => `<span class="itemx2-codex-fx itemx2-codex-hero-fx itemx2-${domain}-hero-fx" aria-hidden="true"><i></i><b></b><em></em></span>`;

  function skillSummaryHtml(skill, rarityMode = 'world') {
    const knownMastery = skill.mastery != null && Number.isFinite(Number(skill.mastery));
    const filled = knownMastery ? Math.max(0, Math.min(5, Math.ceil(Number(skill.mastery) / 20))) : 0;
    const levelLabel = skill.level == null ? 'Lv.미상' : `Lv.${Number(skill.level)}`;
    const masteryLabel = knownMastery ? `숙련 ${Number(skill.mastery)}%` : '숙련 미상';
    return `${codexListFx('skill', skillFxClasses(skill, rarityMode))}<span class="itemx2-codex-glyph">${ITEMXCore.esc(skillEmoji(skill))}</span><span class="itemx2-codex-copy"><strong>${ITEMXCore.esc(skill.name)}</strong><small>${ITEMXCore.esc(skill.rank)} · ${levelLabel} · ${masteryLabel}</small><span class="itemx2-codex-tags"><i>✨ ${ITEMXCore.esc(skill.type)}</i><i>${ITEMXCore.esc(skill.status)}</i>${skill.affinity ? `<i>${ITEMXCore.esc(skill.affinity)}</i>` : ''}</span></span><span class="itemx2-skill-meta"><small>소모</small><b>${ITEMXCore.esc(skill.cost || '없음')}</b><small>재사용</small><b>${ITEMXCore.esc(skill.cooldown || '없음')}</b></span><span class="itemx2-mastery">${Array.from({ length: 5 }, (_, index) => `<i class="${index < filled ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  function skillPageHtml(skill, back, rarityMode = 'world') {
    const knownMastery = skill.mastery != null && Number.isFinite(Number(skill.mastery));
    const mastery = knownMastery ? Math.max(0, Math.min(10, Math.ceil(Number(skill.mastery) / 10))) : 0;
    const levelLabel = skill.level == null ? '미상' : `Lv.${Number(skill.level)}`;
    const masteryLabel = knownMastery ? `${Number(skill.mastery)}%` : '미상';
    const effects = (skill.effects || []).map((one) => `<i>${ITEMXCore.esc(one)}</i>`).join('') || '<i>기록 없음</i>';
    const affinity = skillTheme(skill), tier = skillRankTier(skill.rank, rarityMode);
    const fx = ITEMXRenderer.renderSkillFx({ id: skill.id, name: skill.name, affinity }, tier, 'full');
    const vars = ITEMXRenderer.itemVars({ id: skill.id, name: skill.name, theme: 'arcane', rarity: tier, affinity });
    return `<div class="itemx-codex-page itemx2-codex-page">${back}<section class="itemx-codex-hero itemx-skill-hero craft-arcane ${skillFxClasses(skill, rarityMode)}" style="${vars}">${fx}<span class="itemx-codex-hero-glyph">${ITEMXCore.esc(skillEmoji(skill))}</span><span class="itemx-codex-hero-copy"><small>✨ ARCANE SKILL RECORD</small><strong>${ITEMXCore.esc(skill.name)}</strong><span>${ITEMXCore.esc(skill.rank)} · ${ITEMXCore.esc(skill.school || '미분류')} · ${ITEMXCore.esc(skill.status)}</span></span></section><div class="itemx-codex-stat-grid"><span class="itemx-codex-stat"><small>LEVEL</small><strong>${levelLabel}</strong></span><span class="itemx-codex-stat"><small>TYPE / TARGET</small><strong>${ITEMXCore.esc(skill.type || '미분류')} · ${ITEMXCore.esc(skill.target || '미상')}</strong></span><span class="itemx-codex-stat"><small>COST</small><strong>${ITEMXCore.esc(skill.cost || '없음')}</strong></span><span class="itemx-codex-stat"><small>COOLDOWN</small><strong>${ITEMXCore.esc(skill.cooldown || '없음')}</strong></span></div><section class="itemx-codex-section"><h4>✨ 숙련도 · ${masteryLabel}</h4><span class="itemx-codex-mastery">${Array.from({ length: 10 }, (_, index) => `<i class="${index < mastery ? 'on' : ''}"></i>`).join('')}</span></section>${skill.description ? `<section class="itemx-codex-section"><h4>📜 기술 해설</h4><p>${ITEMXCore.esc(skill.description)}</p></section>` : ''}<section class="itemx-codex-section"><h4>💫 발현 효과</h4><span class="itemx-codex-chip-row">${effects}</span></section><section class="itemx-codex-section"><h4>📈 성장 기록</h4><p>${ITEMXCore.esc(skill.growth || '기록 없음')}</p><small>ID · ${ITEMXCore.esc(skill.id)}</small></section></div>`;
  }

  function monsterSummaryHtml(monster, portrait = '') {
    const visual = portrait ? `<img src="${ITEMXCore.esc(portrait)}" alt="">` : `<span class="itemx2-codex-glyph">${ITEMXCore.esc(encounterEmoji(monster))}</span>`;
    return `${codexListFx('encounter', encounterFxClasses(monster))}${visual}<span class="itemx2-codex-copy"><strong>${ITEMXCore.esc(monster.name)}</strong><small>${ITEMXCore.esc(monster.kind)} · 위협 ${ITEMXCore.esc(monster.threat)} · ${ITEMXCore.esc(monster.status)}</small><span class="itemx2-codex-tags"><i>⚔️ ${ITEMXCore.esc(monster.relation)}</i>${(monster.weaknesses || []).slice(0, 2).map((one) => `<i>🎯 약점 ${ITEMXCore.esc(one)}</i>`).join('')}</span></span><span class="itemx2-codex-glyph">${monster.active ? '⚔️' : '📖'}</span>`;
  }

  function monsterPageHtml(monster, portrait, back) {
    const visual = portrait ? `<img class="itemx-monster-portrait" src="${ITEMXCore.esc(portrait)}" alt="">` : `<span class="itemx-codex-hero-glyph">${ITEMXCore.esc(encounterEmoji(monster))}</span>`;
    const chips = (label, values, fallback) => `<section class="itemx-codex-section"><h4>${label}</h4><span class="itemx-codex-chip-row">${(values || []).map((one) => `<i>${ITEMXCore.esc(one)}</i>`).join('') || `<i>${fallback}</i>`}</span></section>`;
    const outcomeLabels = { ended: '교전 종료', escaped: '도주', defeated: '토벌', dead: '사망', unknown: '결말 기록' };
    const outcomeStatus = themeText(monster.outcomeStatus || monster.status);
    const outcome = monster.outcome ? `<section class="itemx-codex-section itemx2-encounter-outcome"><span class="itemx2-encounter-outcome-head"><h4>⚔️ 최근 전투 결과</h4><i>${ITEMXCore.esc(outcomeLabels[outcomeStatus] || '결말 기록')}${monster.outcomeEncounter ? ` · ${Number(monster.outcomeEncounter)}번째 조우` : ''}</i></span><p>${ITEMXCore.esc(monster.outcome)}</p></section>` : '';
    return `<div class="itemx-codex-page itemx2-codex-page">${back}<section class="itemx-codex-hero itemx-monster-hero ${encounterFxClasses(monster)}">${codexHeroFx('encounter')}<b class="itemx-threat-banner">⚠️ THREAT · ${ITEMXCore.esc(monster.threat || '미상')}</b>${visual}<span class="itemx-codex-hero-copy"><small>⚔️ ENCOUNTER ARCHIVE</small><strong>${ITEMXCore.esc(monster.name)}</strong><span>${ITEMXCore.esc(monster.kind || '미분류')} · ${ITEMXCore.esc(monster.relation)} · ${ITEMXCore.esc(monster.status)}</span></span></section><div class="itemx-codex-stat-grid"><span class="itemx-codex-stat"><small>ENCOUNTERS</small><strong>⚔️ ${Number(monster.encounterCount) || 1}회</strong></span><span class="itemx-codex-stat"><small>COMBAT STATE</small><strong>${monster.active ? '🔥 현재 교전 기록' : '📖 보관 기록'}</strong></span></div>${outcome}${monster.description ? `<section class="itemx-codex-section"><h4>👁️ 관찰 기록</h4><p>${ITEMXCore.esc(monster.description)}</p></section>` : ''}${chips('🏷️ 별칭', monster.aliases, '없음')}${chips('🎯 확인된 약점', monster.weaknesses, '미상')}${chips('🛡️ 확인된 내성', monster.resistances, '미상')}${chips('💥 관측 행동', monster.moves, '미상')}<section class="itemx-codex-section"><small>ID · ${ITEMXCore.esc(monster.id)}</small></section></div>`;
  }

  function rootBadgeHtml() {
    const update = runtime.update.available ? `<span class="itemx2-update-indicator" x-itemx2-update="${ITEMXCore.esc(runtime.update.latest)}" aria-label="ITEMX CODEX 업데이트 가능">↑</span>` : '';
    return `<div class="itemx2-native-badge" x-itemx2-badge="launcher" aria-label="ITEMX CODEX"><img src="${ITEMX_BADGE_ICON}" alt="ITEMX CODEX">${update}</div><div class="itemx2-aux-status ${runtime.auxActive > 0 ? 'itemx2-aux-status-on' : ''}" aria-live="polite"><i></i><span class="itemx2-aux-status-label">${ITEMXCore.esc(runtime.auxLabel)}</span></div><div class="itemx2-feedback" role="status" aria-live="polite"></div>`;
  }

  const updateLabelHtml = () => runtime.update.available ? `<span class="itemx2-update-label" x-itemx2-update="${ITEMXCore.esc(runtime.update.latest)}">UPDATE</span>` : '';

  function rootInventoryHtml(loaded, open = true, tab = 'inventory') {
    if (!open) return `${rootBadgeHtml()}<div class="itemx2-root-layer"><section class="itemx-panel itemx2-root-panel" aria-label="ITEMX CODEX"><div class="itemx2-tab-loading itemx2-open-loading" role="status" aria-live="polite"><i></i><strong>인벤토리 여는 중</strong><small>저장된 화면을 준비하고 있답니다.</small></div></section></div>`;
    const all = itemsOf(loaded.snapshot).slice(0, 60);
    const pageCount = Math.max(1, Math.ceil(all.length / ITEMX_ROOT_PAGE_SIZE));
    runtime.rootItemPage = Math.max(0, Math.min(pageCount - 1, runtime.rootItemPage));
    const pageStart = runtime.rootItemPage * ITEMX_ROOT_PAGE_SIZE;
    const inventoryPage = tab === 'inventory' ? all.slice(pageStart, pageStart + ITEMX_ROOT_PAGE_SIZE) : [];
    const skills = (loaded.codexSnapshot?.skills?.order || []).map((id) => loaded.codexSnapshot.skills.entries[id]).filter(Boolean).slice(0, 60);
    const monsters = (loaded.codexSnapshot?.monsters?.order || []).map((id) => loaded.codexSnapshot.monsters.entries[id]).filter(Boolean).slice(0, 60);
    const counts = {
      all: all.length, owned: all.filter((item) => item.possession === 'owned').length,
      equipped: all.filter((item) => item.location === 'equipped').length,
      observed: all.filter((item) => item.possession === 'observed').length,
      removed: all.filter((item) => item.possession === 'removed').length
    };
    const filters = [['all', '전체'], ['owned', '보유'], ['equipped', '장착'], ['observed', '관찰'], ['removed', '소실']];
    const controls = filters.map(([key]) => `<input class="itemx2-root-control itemx2-root-filter-${key}" id="itemx2-filter-${key}" name="itemx2-filter" type="radio" ${key === 'all' ? 'checked' : ''}>`).join('');
    const skillList = tab === 'skills' ? (skills.map((skill, index) => `<div class="itemx2-codex-entry"><input class="itemx2-root-control itemx2-codex-entry-choice" id="itemx2-skill-${index}" name="itemx2-skill-detail" type="radio"><label class="itemx2-codex-card itemx2-codex-summary itemx2-skill-card" for="itemx2-skill-${index}">${skillSummaryHtml(skill, loaded.rarityMode)}</label>${skillPageHtml(skill, '<label class="itemx-codex-back" for="itemx2-skill-none">‹ 스킬 목록</label>', loaded.rarityMode)}</div>`).join('') || '<div class="itemx2-codex-empty">아직 확정된 스킬이 없답니다.</div>') : '';
    const monsterList = tab === 'bestiary' ? (monsters.map((monster, index) => {
      const portrait = loaded.portraits?.[monster.id] || '';
      return `<div class="itemx2-codex-entry"><input class="itemx2-root-control itemx2-codex-entry-choice" id="itemx2-monster-${index}" name="itemx2-monster-detail" type="radio"><label class="itemx2-codex-card itemx2-codex-summary itemx2-bestiary-card ${monster.active ? 'active' : ''}" for="itemx2-monster-${index}">${monsterSummaryHtml(monster, portrait)}</label>${monsterPageHtml(monster, portrait, '<label class="itemx-codex-back" for="itemx2-monster-none">‹ 조우 목록</label>')}</div>`;
    }).join('') || '<div class="itemx2-codex-empty">실제 전투나 합의된 대련이 발생하면 등록된답니다.</div>') : '';
    const list = tab === 'inventory' ? (inventoryPage.map((item, index) => {
      const detailId = `itemx2-detail-${index}`;
      const tile = ITEMXRenderer.renderTile(item).replace(/^<button\b/, '<span').replace(/<\/button>$/, '</span>');
      const classes = [item.possession === 'owned' && 'itemx2-match-owned', item.location === 'equipped' && 'itemx2-match-equipped', item.possession === 'observed' && 'itemx2-match-observed', item.possession === 'removed' && 'itemx2-match-removed'].filter(Boolean).join(' ');
      return `<div class="itemx2-root-item ${classes}"><input class="itemx2-root-control itemx2-root-detail-choice" id="${detailId}" name="itemx2-detail" type="radio"><label class="itemx2-root-tile-label itemx2-root-tile-${index}" for="${detailId}">${tile}</label><div class="itemx2-root-detail itemx-body"><label class="itemx-back itemx2-root-back" for="itemx2-detail-none">‹ 목록으로</label><div class="itemx-detail itemx2-root-detail-body-${index}"><span class="itemx2-detail-loading">상세 정보를 불러오는 중…</span></div></div></div>`;
    }).join('') || '<div class="itemx2-root-empty">표시할 아이템이 없답니다.</div>') : '';
    const enabled = loaded.enabled === true;
    const positionChoices = tab === 'settings' ? BADGE_POSITIONS.map(([key, label]) => `<button class="itemx2-position-choice itemx2-position-${key} ${runtime.badgePosition === key ? 'itemx2-position-on' : ''}" type="button">${label}</button>`).join('') : '';
    const fontChoices = tab === 'settings' ? [['small', '소'], ['medium', '중'], ['large', '대']].map(([value, label]) => `<button class="itemx2-font-choice itemx2-setting-font-${value} ${loaded.fontScale === value ? 'itemx2-font-on' : ''}" type="button">${label}</button>`).join('') : '';
    const managerRows = tab === 'settings' ? (all.map((item, index) => `<div class="itemx2-manager-row"><span class="itemx2-manager-name"><strong>${ITEMXCore.esc(ITEMXCore.resolveItemEmoji(item))} ${ITEMXCore.esc(item.name)}</strong><small>${ITEMXCore.esc(item.displayRarity || item.rarity)} · ${ITEMXCore.esc(item.possession)} / ${ITEMXCore.esc(item.location)}</small></span><span class="itemx2-manager-actions"><button class="itemx2-manager-reroll-${index}" type="button">재감정</button><button class="itemx2-manager-remove itemx2-manager-remove-${index}" type="button" ${item.possession === 'removed' ? 'disabled' : ''}>제거</button></span></div>`).join('') || '<div class="itemx2-root-empty">관리할 아이템이 없습니다.</div>') : '';
    const manager = `<details class="itemx2-manager-fold"><summary>아이템 관리 <small>현재 화면에서 접기·펼치기</small></summary><div class="itemx2-manager-body"><label class="itemx2-manager-label">수정 지시 · 비워두면 순수 재감정<div class="itemx2-manager-editor itemx2-manager-note" contenteditable="true" role="textbox" aria-label="아이템 수정 지시"></div></label><div class="itemx2-manager-list">${managerRows}</div><div class="itemx2-manager-create"><label class="itemx2-manager-label">신규 아이템 생성 지시<div class="itemx2-manager-editor itemx2-manager-create-note" contenteditable="true" role="textbox" aria-label="신규 아이템 생성 지시"></div></label><button class="itemx2-root-setting-button itemx2-manager-create-button" type="button">＋ 신규 아이템 생성</button></div></div></details>`;
    const connection = connectionSummary();
    const chips = [['hook', connection.hook], ['dom', connection.dom], ['listener', connection.listener]].map(([key, [label, tone]]) => `<i class="itemx2-status-chip itemx2-status-chip-${tone} itemx2-connection-${key}">${label}</i>`).join('');
    const domainControls = [['items', '무기·아이템', loaded.itemsEnabled, '감정·손상·소실'], ['skills', '스킬', loaded.skillsEnabled, '습득·숙련·봉인'], ['encounters', '전투 도감', loaded.encountersEnabled, '적대·대련·전투']].map(([key, label, value, note]) => `<button class="itemx2-domain-card itemx2-setting-domain-${key} ${value ? 'itemx2-setting-on' : ''}" type="button"><strong>${label} · ${value ? 'ON' : 'OFF'}</strong><small>${note}</small></button>`).join('');
    const debugLog = runtime.debugEntries.slice(-12).reverse().map((entry) => `${new Date(entry.at).toLocaleTimeString('ko-KR', { hour12: false })} ${entry.where}\n${entry.detail}`).join('\n\n') || '기록 없음';
    const debugPanel = `<details class="itemx2-manager-fold itemx2-debug-fold"><summary>디버그 진단 <small>${loaded.debugEnabled ? 'ON · 최근 30건' : 'OFF'}</small></summary><div class="itemx2-debug-body"><button class="itemx2-root-setting-button itemx2-setting-debug ${loaded.debugEnabled ? 'itemx2-setting-on' : ''}" type="button">로그 ${loaded.debugEnabled ? 'ON' : 'OFF'}</button><div class="itemx2-debug-grid"><b>문맥</b><span>${ITEMXCore.esc(loaded.key)}</span><b>세대</b><span>${runtime.generation}</span><b>스냅숏</b><span>${ITEMXCore.esc(loaded.snapshot.fingerprint || '-')} / ${ITEMXCore.esc(loaded.codexSnapshot.fingerprint || '-')}</span><b>항목</b><span>${counts.all} / ${skills.length} / ${monsters.length}</span><b>마지막 오류</b><span>${ITEMXCore.esc(runtime.lastHookError || runtime.lastDomError || '없음')}</span></div><pre class="itemx2-debug-log">${ITEMXCore.esc(debugLog)}</pre><button class="itemx2-root-setting-button itemx2-setting-debug-clear" type="button">로그 비우기</button></div></details>`;
    const cleanupArmed = runtime.cleanupArmedUntil > Date.now();
    const settings = `<div class="itemx2-root-settings"><section class="itemx2-root-setting-card"><span><strong>연결 및 권한</strong><small>첫 연결에서는 Risu가 모델 처리와 화면 접근 권한을 각각 물을 수 있습니다.</small><span class="itemx2-status-row">${chips}</span></span><button class="itemx2-root-setting-button itemx2-root-setting-button-primary itemx2-setting-connect ${runtime.connectionBusy ? 'itemx2-root-setting-button-busy' : ''}">${runtime.connectionBusy ? '확인 중…' : connection.ready ? '다시 확인' : '연결하기'}</button></section><section class="itemx2-root-setting-card"><span><strong>보조 모델 상태</strong><small class="itemx2-aux-setting-status">${ITEMXCore.esc(auxStatusText())}</small></span><button class="itemx2-root-setting-button itemx2-setting-aux-run" ${runtime.auxActive > 0 ? 'disabled' : ''}>${runtime.auxActive > 0 ? '처리 중…' : '지금 검사'}</button></section><section class="itemx2-root-setting-card"><span><strong>기능별 추적</strong><small>OFF는 새 수집만 멈추며 기존 기록은 보존합니다.</small></span></section><div class="itemx2-domain-grid">${domainControls}</div><section class="itemx2-root-setting-card"><span><strong>사이드 배지 위치</strong><small>선택 즉시 배지와 패널이 이동하고 저장됩니다.</small></span></section><div class="itemx2-position-grid">${positionChoices}</div>${manager}<section class="itemx2-root-setting-card"><span><strong>현재 봇 ITEMX CODEX</strong><small>${enabled ? '활성 상태입니다.' : '현재 봇에서 비활성 상태입니다.'}</small></span><button class="itemx2-root-setting-button itemx2-setting-toggle">${enabled ? 'ON' : 'OFF'}</button></section><section class="itemx2-root-setting-card"><span><strong>메인 출력</strong><small>메인 모델에 활성화된 기능의 규약만 주입합니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-main">${loaded.mainOutput ? 'ON' : 'OFF'}</button></section><section class="itemx2-root-setting-card"><span><strong>보조 출력</strong><small>활성화된 기능만 자동 검사합니다. 수동 재감정은 아이템 기능을 사용합니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-aux">${AUX_LABELS[loaded.auxOutput] || AUX_LABELS.missing}</button></section><section class="itemx2-root-setting-card"><span><strong>등급 기준</strong><small>아이템과 스킬의 세계관 등급명은 보존하고 내부 시각 등급의 판정 기준을 선택합니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-rarity ${loaded.rarityMode === 'itemx' ? 'itemx2-setting-on' : ''}">${RARITY_MODE_LABELS[loaded.rarityMode] || RARITY_MODE_LABELS.world}</button></section><section class="itemx2-root-setting-card"><span><strong>시각 이펙트</strong><small>본문 카드·인벤토리·스킬·조우의 장식 효과를 한 번에 켜거나 끕니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-effects ${loaded.effectsEnabled ? 'itemx2-setting-on' : ''}">${loaded.effectsEnabled ? 'ON' : 'OFF'}</button></section><section class="itemx2-root-setting-card"><span><strong>모듈 에셋 초상화</strong><small>활성 모듈의 캐릭터 에셋을 조우 초상화 후보에 더합니다. 권한·탐색·이미지 로드 실패 시 이모지로 표시합니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-module-assets ${loaded.moduleAssetsEnabled ? 'itemx2-setting-on' : ''}">${loaded.moduleAssetsEnabled ? 'ON' : 'OFF'}</button></section><section class="itemx2-root-setting-card"><span><strong>글자 크기</strong><small>인벤토리·스킬·조우의 주요 글자만 즉시 조절합니다.</small></span></section><div class="itemx2-font-grid">${fontChoices}</div><section class="itemx2-root-setting-card"><span><strong>채팅 저장소</strong><small>${counts.all}개 · ${ITEMXCore.esc(runtime.status)}</small></span><button class="itemx2-root-setting-button itemx2-setting-rebuild">재구축</button></section><section class="itemx2-root-setting-card"><span><strong>현재 채팅 ITEMX 기록 제거</strong><small>현재 봇을 OFF로 바꾸고, 이 채팅 본문의 마커와 ITEMX/CODEX 원장을 삭제합니다. 되돌릴 수 없습니다.</small></span><button class="itemx2-root-setting-button itemx2-setting-cleanup ${cleanupArmed ? 'itemx2-setting-cleanup-armed' : ''}">${cleanupArmed ? '다시 눌러 완전 제거' : '현재 채팅 정리'}</button></section>${debugPanel}<section class="itemx2-root-setting-card"><span><strong>플러그인</strong><small>ITEMX CODEX ${ITEMX_PLUGIN_VERSION}</small></span></section></div>`;
    const pager = pageCount > 1 ? `<span class="itemx2-root-pager"><button class="itemx2-root-page-prev" type="button" ${runtime.rootItemPage === 0 ? 'disabled' : ''}>‹</button><b>${runtime.rootItemPage + 1} / ${pageCount}</b><button class="itemx2-root-page-next" type="button" ${runtime.rootItemPage >= pageCount - 1 ? 'disabled' : ''}>›</button></span>` : '';
    const shownEnd = Math.min(all.length, pageStart + inventoryPage.length);
    const inventoryContent = `<div class="itemx2-root-inventory"><nav class="itemx-seg itemx2-root-filters">${filters.map(([key, label]) => `<label class="itemx-seg-i" for="itemx2-filter-${key}">${label} <span class="itemx-seg-n">${counts[key]}</span></label>`).join('')}</nav><div class="itemx-tools itemx2-root-tools"><span class="itemx-tool">${loaded.effectsEnabled ? '✨ 이펙트 ON' : '◇ 이펙트 OFF'}</span><span class="itemx-search">채팅별 저장소</span></div><div class="itemx-body"><div class="itemx-grid">${list}</div></div><footer class="itemx-pf"><span>${all.length ? `${pageStart + 1}-${shownEnd}` : '0'} / ${all.length}점${itemsOf(loaded.snapshot).length > 60 ? ' · 첫 60점' : ''}</span>${pager}</footer></div>`;
    const skillsContent = `<div class="itemx2-root-skills itemx2-root-tab-active"><input class="itemx2-root-control" id="itemx2-skill-none" name="itemx2-skill-detail" type="radio" checked><div class="itemx2-codex-note">장착·봉인·본문에서 다시 언급된 스킬만 모델 문맥에 제한적으로 전달됩니다.</div>${skillList}</div>`;
    const bestiaryContent = `<div class="itemx2-root-bestiary itemx2-root-tab-active"><input class="itemx2-root-control" id="itemx2-monster-none" name="itemx2-monster-detail" type="radio" checked><div class="itemx2-codex-note">단순 등장인물 목록이 아니라 실제 적대·전투·합의된 대련만 기록합니다.</div>${monsterList}</div>`;
    const activeContent = tab === 'skills' ? skillsContent : tab === 'bestiary' ? bestiaryContent : tab === 'settings' ? settings : inventoryContent;
    const tabs = [['inventory', '📦 인벤'], ['skills', '✨ 스킬'], ['bestiary', '⚔️ 조우'], ['settings', '⚙️ 설정']].map(([key, label]) => `<button class="itemx-main-tab itemx2-root-tab-${key} ${tab === key ? 'itemx-main-tab-on' : ''}" type="button">${label}</button>`).join('');
    const headerStatus = `${enabled ? `보유 ${counts.owned} · 장착 ${counts.equipped} · 관찰 ${counts.observed}` : '현재 봇 비활성'} · ${ITEMXCore.esc(runtime.status)}`;
    return `${controls}${rootBadgeHtml()}<div class="itemx2-root-layer"><section class="itemx-panel itemx2-root-panel" aria-label="ITEMX CODEX"><input class="itemx2-root-control" id="itemx2-detail-none" name="itemx2-detail" type="radio" checked><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX CODEX · ${ITEMX_VERSION_LABEL}${updateLabelHtml()}</span><span class="itemx-ph-title">${ITEMXCore.esc(loaded.character.name || '인벤토리')}</span><span class="itemx-ph-sub"><!--ITEMX2-HEADER-START-->${headerStatus}<!--ITEMX2-HEADER-END--></span></span><button class="itemx-ph-btn itemx2-root-close" type="button" aria-label="닫기">✕</button></header><nav class="itemx-main-tabs"><!--ITEMX2-NAV-START-->${tabs}<!--ITEMX2-NAV-END--></nav><div class="itemx2-root-tab-body"><!--ITEMX2-BODY-START-->${activeContent}<!--ITEMX2-BODY-END--></div></section></div>`;
  }

  function rootInventoryRegions(html) {
    const source = String(html || '');
    const between = (start, end) => {
      const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
      return from >= 0 && to >= 0 ? source.slice(from + start.length, to) : null;
    };
    return {
      header: between('<!--ITEMX2-HEADER-START-->', '<!--ITEMX2-HEADER-END-->'),
      nav: between('<!--ITEMX2-NAV-START-->', '<!--ITEMX2-NAV-END-->'),
      body: between('<!--ITEMX2-BODY-START-->', '<!--ITEMX2-BODY-END-->')
    };
  }

  async function updateRootRegions(html) {
    if (!runtime.mainDoc || !runtime.rootDrawer) return false;
    const regions = rootInventoryRegions(html);
    if (regions.header == null || regions.nav == null || regions.body == null) return false;
    const header = await runtime.mainDoc.querySelector('.x-risu-itemx-ph-sub');
    const nav = await runtime.mainDoc.querySelector('.x-risu-itemx-main-tabs');
    const body = await runtime.mainDoc.querySelector('.x-risu-itemx2-root-tab-body');
    if (!header || !nav || !body) return false;
    try {
      await header.setInnerHTML(regions.header);
      await nav.setInnerHTML(regions.nav);
      await body.setInnerHTML(regions.body);
      return true;
    } catch (error) {
      debugRecord('root region fallback', error?.message || String(error));
      return false;
    }
  }

  const rootStateFingerprint = (loaded) => [loaded.snapshot?.fingerprint, loaded.codexSnapshot?.fingerprint, Number(loaded.enabled), Number(loaded.itemsEnabled), Number(loaded.skillsEnabled), Number(loaded.encountersEnabled), Number(loaded.mainOutput), loaded.auxOutput, loaded.rarityMode, Number(loaded.moduleAssetsEnabled), Number(loaded.debugEnabled)].join(':');

  async function installRootClickRouter(owner) {
    if (!owner || (runtime.rootClickOwner === owner && runtime.rootClickBindings.length)) return;
    await removeRootClickRouter();
    const routeBadge = async (event) => {
      try {
        const badge = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-native-badge');
        if (!badge) return false;
        const rect = await badge.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return false;
        const cached = runtime.cachedLoaded;
        const cacheReady = cached && cached.key === runtime.activeContextKey && runtime.cachedGeneration === runtime.generation;
        if (runtime.rootContentReady && cacheReady && runtime.rootFingerprint === rootStateFingerprint(cached) && await setRootOpen(true)) return true;
        await setRootOpen(true);
        const loaded = cacheReady ? cached : await cachedOrRebuildCurrent();
        if (!loaded) return true;
        await openRootInventory({ open: true, loaded, tab: runtime.activeRootTab });
        return true;
      } catch (error) { fail('native badge click', error); return true; }
    };
    const routeControls = async (event) => {
      try {
        const close = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-root-close');
        if (close) {
          const closeRect = await close.getBoundingClientRect();
          if (event.clientX >= closeRect.left && event.clientX <= closeRect.right && event.clientY >= closeRect.top && event.clientY <= closeRect.bottom) {
            await setRootOpen(false);
            return;
          }
        }
        for (const [tab, label] of [['inventory', '인벤토리'], ['skills', '스킬'], ['bestiary', '조우 도감'], ['settings', '설정']]) {
          const button = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-root-tab-${tab}`);
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
          if (runtime.rootTabBusy || runtime.activeRootTab === tab) return;
          runtime.rootTabBusy = true;
          try {
            if (tab === 'inventory') runtime.rootItemPage = 0;
            const body = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-root-tab-body');
            if (body) await body.setInnerHTML(`<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>${label} 불러오는 중</strong><small>선택한 탭만 준비하고 있답니다.</small></div>`);
            await delay(24);
            await openRootInventory({ open: true, tab });
          } finally { runtime.rootTabBusy = false; }
          return;
        }
        for (const [direction, selector] of [[-1, '.x-risu-itemx2-root-page-prev'], [1, '.x-risu-itemx2-root-page-next']]) {
          const button = runtime.mainDoc && await runtime.mainDoc.querySelector(selector);
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
          if (runtime.rootTabBusy) return;
          const loaded = await cachedOrRebuildCurrent();
          if (!loaded) return;
          const pageCount = Math.max(1, Math.ceil(Math.min(60, itemsOf(loaded.snapshot).length) / ITEMX_ROOT_PAGE_SIZE));
          const nextPage = Math.max(0, Math.min(pageCount - 1, runtime.rootItemPage + direction));
          if (nextPage === runtime.rootItemPage) return;
          runtime.rootItemPage = nextPage;
          runtime.rootTabBusy = true;
          try {
            const body = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-root-tab-body');
            if (body) await body.setInnerHTML('<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>아이템 불러오는 중</strong><small>16개씩 나누어 준비하고 있답니다.</small></div>');
            await delay(24);
            await openRootInventory({ open: true, tab: 'inventory', loaded });
          } finally { runtime.rootTabBusy = false; }
          return;
        }
        if (runtime.activeRootTab === 'inventory') {
          const cached = runtime.cachedLoaded;
          const cacheReady = cached && cached.key === runtime.activeContextKey && runtime.cachedGeneration === runtime.generation;
          const loaded = cacheReady ? cached : await cachedOrRebuildCurrent();
          if (loaded && loaded.key === runtime.activeContextKey) {
            // SafeElement listeners are document-level. While this async
            // callback awaits, the label's native radio action can already
            // hide the clicked tile, making its rectangle zero-sized. Yield
            // once, then use the settled :checked state as the authoritative
            // target before retaining coordinate hit-testing as a fallback.
            await delay(0);
            if (await hydrateCheckedItemDetail(loaded)) return;
            const detailItems = rootPageItems(loaded);
            for (let index = 0; index < detailItems.length; index += 1) {
              const tile = await queryMainClass(`itemx2-root-tile-${index}`);
              if (!tile) continue;
              const rect = await tile.getBoundingClientRect();
              if (rect.width <= 0 || rect.height <= 0 || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
              const detail = await queryMainClass(`itemx2-root-detail-body-${index}`);
              if (detail) await detail.setInnerHTML(itemDetailHtml(detailItems[index]));
              return;
            }
          }
        }
        if (runtime.activeRootTab !== 'settings') return;
        const managerFold = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-fold');
        if (managerFold) {
          const foldRect = await managerFold.getBoundingClientRect();
          const insideManager = event.clientX >= foldRect.left && event.clientX <= foldRect.right && event.clientY >= foldRect.top && event.clientY <= foldRect.bottom;
          if (insideManager) {
            const loaded = await cachedOrRebuildCurrent();
            if (loaded) {
              const managedItems = itemsOf(loaded.snapshot).slice(0, 60);
              const noteElement = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-note');
              const note = (await noteElement?.textContent())?.trim() || '';
              for (let index = 0; index < managedItems.length; index += 1) {
                const target = managedItems[index];
                const reroll = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-manager-reroll-${index}`);
                if (reroll) {
                  const rect = await reroll.getBoundingClientRect();
                  if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
                    runtime.status = note ? '정보 수정 감정 중' : '아이템 재감정 중';
                    try {
                      const itemEvent = await runItemModel('reroll', loaded, target, note);
                      await commitManualEvents(loaded, [itemEvent], note ? '정보 수정' : '재감정');
                    } catch (error) {
                      runtime.status = '재감정 실패';
                      if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX: ${error.message || error}`);
                    }
                    await openRootInventory({ open: true, tab: 'settings' });
                    return;
                  }
                }
                const remove = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-manager-remove-${index}`);
                if (remove) {
                  const rect = await remove.getBoundingClientRect();
                  if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
                    if (target.possession === 'removed') return;
                    if (typeof Risuai.alertConfirm === 'function' && !(await Risuai.alertConfirm(`${target.name}을(를) 현재 채팅 인벤토리에서 제거할까요?`))) return;
                    const itemEvent = { kind: 'patch', patch: { id: target.id, action: null, op: 'remove', fields: {}, quantity: null, destination: '', reason: 'manual_remove', slot: null, inputs: null, outputs: null, equip: null, unequip: null } };
                    try { await commitManualEvents(loaded, [itemEvent], '수동 제거'); }
                    catch (error) { runtime.status = '수동 제거 실패'; if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX: ${error.message || error}`); }
                    await openRootInventory({ open: true, tab: 'settings' });
                    return;
                  }
                }
              }
              const create = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-create-button');
              if (create) {
                const rect = await create.getBoundingClientRect();
                if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
                  const createNoteElement = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-manager-create-note');
                  const createNote = (await createNoteElement?.textContent())?.trim() || '';
                  if (!createNote) { if (typeof Risuai.alertError === 'function') await Risuai.alertError('ITEMX CODEX: 생성할 아이템 설명을 입력하세요.'); return; }
                  runtime.status = '신규 아이템 생성 중';
                  try {
                    const itemEvent = await runItemModel('create', loaded, null, createNote);
                    await commitManualEvents(loaded, [itemEvent], '신규 생성');
                  } catch (error) {
                    runtime.status = '아이템 생성 실패';
                    if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX: ${error.message || error}`);
                  }
                  await openRootInventory({ open: true, tab: 'settings' });
                  return;
                }
              }
            }
          }
        }
        const connect = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-connect');
        if (connect) {
          const rect = await connect.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            if (runtime.connectionBusy) return;
            runtime.connectionBusy = true;
            runtime.status = '연결 및 권한 확인 중';
            await updateConnectionUi();
            await showRootFeedback('ITEMX CODEX 연결과 권한을 확인하는 중입니다…', 'working', 0);
            try {
              const connected = await installPipelineHooks({ prompt: true });
              const styled = await installMainStyle();
              runtime.status = connected && styled ? '연결 및 권한 정상' : connected ? '화면 연결 실패' : '모델 훅 연결 실패';
              if (connected && styled) {
                await showRootFeedback('ITEMX CODEX 연결 및 권한 확인 완료', 'success');
              } else {
                await showRootFeedback(`연결 확인 실패 · ${(!connected ? runtime.lastHookError : runtime.lastDomError) || runtime.status}`, 'error', 3600);
              }
              if ((!connected || !styled) && typeof Risuai.alertError === 'function') {
                await Risuai.alertError(`ITEMX CODEX 연결 확인 실패: ${(!connected ? runtime.lastHookError : runtime.lastDomError) || runtime.status}`);
              }
            } finally {
              runtime.connectionBusy = false;
              await updateConnectionUi();
            }
            return;
          }
        }
        const auxRun = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-aux-run');
        if (auxRun) {
          const rect = await auxRun.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            if (runtime.auxActive > 0) return;
            runtime.status = '보조 모델 수동 검사 중';
            await recoverAuxiliaryOutput({ force: true });
            return;
          }
        }
        for (const [key, label] of BADGE_POSITIONS) {
          const choice = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-position-${key}`);
          if (!choice) continue;
          const rect = await choice.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
          runtime.badgePosition = key;
          await Risuai.pluginStorage.setItem('badgePosition', key);
          runtime.status = `배지 위치 · ${label}`;
          if (runtime.rootDrawer) {
            for (const [other] of BADGE_POSITIONS) await runtime.rootDrawer.removeClass(`x-risu-itemx2-pos-${other}`);
            await runtime.rootDrawer.addClass(`x-risu-itemx2-pos-${key}`);
          }
          await installMainStyle();
          for (const [other] of BADGE_POSITIONS) {
            const button = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-position-${other}`);
            if (!button) continue;
            if (other === key) await button.addClass('x-risu-itemx2-position-on');
            else await button.removeClass('x-risu-itemx2-position-on');
          }
          return;
        }
        const toggle = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-toggle');
        if (toggle) {
          const rect = await toggle.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent();
              if (!loaded) return;
              const next = !(await isEnabled(loaded.character));
              await setEnabled(loaded.character, next);
              runtime.status = next ? '현재 봇 활성화' : '현재 봇 비활성화';
              await updateRootSettingButton('.x-risu-itemx2-setting-toggle', next ? 'ON' : 'OFF', next);
            });
            return;
          }
        }
        const main = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-main');
        for (const [domain, key, label] of [['items', 'itemsEnabled', '무기·아이템'], ['skills', 'skillsEnabled', '스킬'], ['encounters', 'encountersEnabled', '전투 도감']]) {
          const button = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-setting-domain-${domain}`);
          if (!button) continue;
          const rect = await button.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
          await applyRootSetting(async () => {
            const loaded = await rebuildCurrent(); if (!loaded) return;
            const current = await outputSettings(loaded.character), value = !current[key];
            await setDomainEnabled(loaded.character, domain, value);
            runtime.cachedLoaded = null; runtime.status = `${label} · ${value ? 'ON' : 'OFF'}`;
            await openRootInventory({ open: true, tab: 'settings' });
          });
          return;
        }
        const debug = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-debug');
        if (debug) {
          const rect = await debug.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent(); if (!loaded) return;
              const value = !(await outputSettings(loaded.character)).debugEnabled;
              await setDebugEnabled(loaded.character, value); runtime.cachedLoaded = null; runtime.status = `디버그 로그 · ${value ? 'ON' : 'OFF'}`;
              await openRootInventory({ open: true, tab: 'settings' });
            });
            return;
          }
        }
        const debugClear = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-debug-clear');
        if (debugClear) {
          const rect = await debugClear.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            runtime.debugEntries = []; runtime.status = '디버그 로그 비움';
            await openRootInventory({ open: true, tab: 'settings' }); return;
          }
        }
        if (main) {
          const rect = await main.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent();
              if (!loaded) return;
              const value = !(await outputSettings(loaded.character)).mainOutput;
              await setMainOutput(loaded.character, value);
              runtime.status = `메인 출력 · ${value ? 'ON' : 'OFF'}`;
              await updateRootSettingButton('.x-risu-itemx2-setting-main', value ? 'ON' : 'OFF', value);
            });
            return;
          }
        }
        const aux = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-aux');
        if (aux) {
          const rect = await aux.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent();
              if (!loaded) return;
              const current = (await outputSettings(loaded.character)).auxOutput;
              const value = current === 'missing' ? 'always' : current === 'always' ? 'off' : 'missing';
              await setAuxOutput(loaded.character, value);
              runtime.status = `보조 출력 · ${AUX_LABELS[value]}`;
              await updateRootSettingButton('.x-risu-itemx2-setting-aux', AUX_LABELS[value], value !== 'off');
            });
            return;
          }
        }
        const rarity = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-rarity');
        if (rarity) {
          const rect = await rarity.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await rebuildCurrent();
              if (!loaded) return;
              const current = (await outputSettings(loaded.character)).rarityMode;
              const value = current === 'itemx' ? 'world' : 'itemx';
              await setRarityMode(loaded.character, value);
              runtime.status = `등급 기준 · ${RARITY_MODE_LABELS[value]}`;
              loaded.rarityMode = value;
              runtime.rootFingerprint = '';
              await openRootInventory({ open: true, loaded });
            });
            return;
          }
        }
        const effects = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-effects');
        if (effects) {
          const rect = await effects.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await cachedOrRebuildCurrent();
              if (!loaded) return;
              const value = !(cachedSettings(loaded.character) || await outputSettings(loaded.character)).effectsEnabled;
              await setEffectsEnabled(loaded.character, value);
              loaded.effectsEnabled = value;
              runtime.status = `시각 이펙트 · ${value ? 'ON' : 'OFF'}`;
              await openRootInventory({ open: true, tab: 'settings', loaded });
            });
            return;
          }
        }
        const moduleAssets = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-module-assets');
        if (moduleAssets) {
          const rect = await moduleAssets.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            await applyRootSetting(async () => {
              const loaded = await cachedOrRebuildCurrent(); if (!loaded) return;
              const current = cachedSettings(loaded.character) || await outputSettings(loaded.character);
              let value = false;
              if (current.moduleAssetsEnabled) {
                await setModuleAssetsEnabled(loaded.character, false);
              } else {
                value = await enableModuleAssets(loaded.character, loaded.chat);
                if (!value && typeof Risuai.alertError === 'function') await Risuai.alertError('모듈 에셋 권한이 허용되지 않았습니다. 조우 초상화는 이모지로 표시됩니다.');
              }
              loaded.moduleAssetsEnabled = value;
              runtime.status = value ? '모듈 에셋 초상화 · ON' : current.moduleAssetsEnabled ? '모듈 에셋 초상화 · OFF' : '모듈 에셋 권한 없음 · 이모지 폴백';
              runtime.rootFingerprint = '';
              await openRootInventory({ open: true, tab: 'settings', loaded });
            });
            return;
          }
        }
        for (const [value, label] of [['small', '소'], ['medium', '중'], ['large', '대']]) {
          const font = runtime.mainDoc && await runtime.mainDoc.querySelector(`.x-risu-itemx2-setting-font-${value}`);
          if (!font) continue;
          const rect = await font.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) continue;
          await applyRootSetting(async () => {
            const loaded = await cachedOrRebuildCurrent();
            if (!loaded) return;
            await setFontScale(loaded.character, value);
            loaded.fontScale = value;
            runtime.status = `글자 크기 · ${label}`;
            for (const scale of ['small', 'medium', 'large']) {
              const button = await runtime.mainDoc.querySelector(`.x-risu-itemx2-setting-font-${scale}`);
              if (!button) continue;
              if (scale === value) await button.addClass('x-risu-itemx2-font-on');
              else await button.removeClass('x-risu-itemx2-font-on');
            }
          });
          return;
        }
        const cleanup = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-cleanup');
        if (cleanup) {
          const rect = await cleanup.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            if (runtime.cleanupArmedUntil <= Date.now()) {
              runtime.cleanupArmedUntil = Date.now() + 7000;
              runtime.status = '정리 확인 대기 · 7초 안에 다시 누르세요';
              await showRootFeedback('되돌릴 수 없습니다. 7초 안에 정리 버튼을 다시 누르면 현재 봇을 끄고 이 채팅 기록만 제거합니다.', 'error', 6500);
              await openRootInventory({ open: true, tab: 'settings' });
              return;
            }
            runtime.status = '현재 채팅 ITEMX 기록 정리 중';
            await showRootFeedback('현재 채팅의 ITEMX 마커와 저장 원장을 정리하는 중입니다…', 'working', 0);
            try {
              const result = await cleanCurrentChatItemx();
              await showRootFeedback(`정리 완료 · 본문 ${result.cleanedMessages}개 · 마커 ${result.removedMarkers}개`, 'success', 3600);
              if (result.loaded) await openRootInventory({ open: true, tab: 'settings', loaded: result.loaded });
            } catch (error) {
              runtime.cleanupArmedUntil = 0;
              runtime.status = '현재 채팅 정리 실패';
              await showRootFeedback(`정리 실패 · ${error.message || error}`, 'error', 4200);
              if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX 정리 실패: ${error.message || error}`);
            }
            return;
          }
        }
        const rebuild = runtime.mainDoc && await runtime.mainDoc.querySelector('.x-risu-itemx2-setting-rebuild');
        if (rebuild) {
          const rect = await rebuild.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            runtime.cachedLoaded = null;
            const loaded = await rebuildCurrent();
            if (loaded) await openRootInventory({ open: true, tab: 'settings', loaded });
          }
        }
      } catch (error) { fail('native setting click', error); }
    };
    const id = await owner.addEventListener('click', async (event) => {
      if (runtime.rootClickBusy) return;
      runtime.rootClickBusy = true;
      try {
        if (await routeBadge(event)) return;
        await routeControls(event);
      } catch (error) { fail('root click router', error); }
      finally { runtime.rootClickBusy = false; }
    }, true);
    runtime.rootClickOwner = owner;
    runtime.rootClickBindings = [{ type: 'click', id, capture: true }];
  }

  async function openRootInventory(options = {}) {
    return enqueue('ui:root-drawer', () => openRootInventoryNow(options));
  }

  async function openRootInventoryNow({ open = true, tab = 'inventory', loaded: suppliedLoaded = null } = {}) {
    try {
      runtime.panelOpen = false;
      try { await Risuai.hideContainer(); } catch {}
      const loaded = suppliedLoaded || await cachedOrRebuildCurrent();
      if (!loaded) throw new Error('No active chat context');
      if (runtime.activeContextKey && runtime.activeContextKey !== loaded.key) return;
      loaded.enabled = await isEnabled(loaded.character);
      Object.assign(loaded, await outputSettings(loaded.character));
      runtime.debugEnabled = loaded.debugEnabled;
      loaded.portraits = tab === 'bestiary' && loaded.encountersEnabled ? await loadCodexPortraits(loaded.character, loaded.chat, loaded.codexSnapshot, loaded) : {};
      const styled = await installMainStyle({ prompt: true });
      if (!styled || !runtime.mainDoc) {
        runtime.status = '메인 화면 권한 필요';
        if (typeof Risuai.alertError === 'function') await Risuai.alertError('ITEMX CODEX를 열려면 메인 화면 권한이 필요합니다.');
        return;
      }
      let root = runtime.rootDrawer, attached = false;
      if (root) {
        try { attached = Boolean(await root.getParent()); }
        catch { root = null; }
      }
      if (!attached) {
        await removeRootDrawer();
        root = await runtime.mainDoc.createElement('div');
      }
      await root.setAttribute('x-itemx2-drawer', 'owner');
      await root.setClassName(`x-risu-itemx2-root-drawer x-risu-itemx2-pos-${runtime.badgePosition} x-risu-itemx2-font-${loaded.fontScale || 'small'}${open ? ' x-risu-itemx2-is-open' : ''}${loaded.effectsEnabled ? '' : ' x-risu-itemx2-effects-off'}`);
      const html = rootInventoryHtml(loaded, open, tab);
      const regionUpdated = attached && open && runtime.rootContentReady && await updateRootRegions(html);
      if (!regionUpdated) await root.setInnerHTML(html);
      if (!attached) {
        const body = await runtime.mainDoc.querySelector('body');
        if (!body) throw new Error('Main document body unavailable');
        if (runtime.activeContextKey !== loaded.key) return;
        await body.appendChild(root);
        if (runtime.activeContextKey !== loaded.key) { await root.remove(); return; }
      }
      runtime.rootDrawer = root;
      runtime.rootFingerprint = rootStateFingerprint(loaded);
      runtime.rootContentReady = open;
      runtime.activeRootTab = tab;
      await installRootClickRouter(root);
    } catch (error) {
      runtime.status = '인벤토리 열기 오류';
      await removeRootDrawer();
      fail('openRootInventory', error);
    }
  }

  function matches(item) {
    if (ui.filter === 'owned' && item.possession !== 'owned') return false;
    if (ui.filter === 'equipped' && item.location !== 'equipped') return false;
    if (ui.filter === 'observed' && item.possession !== 'observed') return false;
    if (ui.filter === 'removed' && item.possession !== 'removed') return false;
    const q = ui.query.trim().toLowerCase();
    return !q || [item.name, item.id, item.itemType, item.displayRarity, item.affinity, item.affinity2].some((value) => String(value || '').toLowerCase().includes(q));
  }

  function drawInventory(loaded) {
    const root = document.querySelector('#itemx2-root');
    if (!root) return;
    const all = itemsOf(loaded.snapshot), selected = ui.selected && all.find((item) => item.id === ui.selected);
    const counts = {
      all: all.length, owned: all.filter((item) => item.possession === 'owned').length,
      equipped: all.filter((item) => item.location === 'equipped').length,
      observed: all.filter((item) => item.possession === 'observed').length,
      removed: all.filter((item) => item.possession === 'removed').length
    };
    const visible = ui.tab === 'inventory' ? all.filter(matches).slice(0, 60) : [];
    if (ui.tab === 'settings' && (!ui.manageId || !all.some((item) => item.id === ui.manageId))) ui.manageId = all.find((item) => item.possession !== 'removed')?.id || all[0]?.id || null;
    const managed = ui.tab === 'settings' && ui.manageId ? all.find((item) => item.id === ui.manageId) : null;
    const manageOptions = ui.tab === 'settings' ? all.map((item) => `<option value="${ITEMXCore.esc(item.id)}" ${item.id === ui.manageId ? 'selected' : ''}>${ITEMXCore.esc(ITEMXCore.resolveItemEmoji(item))} ${ITEMXCore.esc(item.name)} · ${ITEMXCore.esc(item.id)}</option>`).join('') : '';
    const enabled = loaded.enabled === true;
    const inventoryContent = !enabled
      ? `<div class="itemx-disabled"><strong>현재 봇에서 ITEMX CODEX가 꺼져 있답니다.</strong><span>설정 탭에서 다시 활성화할 수 있습니다.</span><button class="itemx-tool" data-tab="settings">설정 열기</button></div>`
      : (selected ? `<div class="itemx-body"><button class="itemx-back" data-action="back">‹ 목록으로</button><div class="itemx-detail">${ITEMXRenderer.renderCard(selected, { motion: ui.motion ? 'full' : 'off' })}</div></div>` : `<nav class="itemx-seg">${[['all', '전체'], ['owned', '보유'], ['equipped', '장착'], ['observed', '관찰'], ['removed', '소실']].map(([key, label]) => `<button class="itemx-seg-i ${ui.filter === key ? 'itemx-seg-on' : ''}" data-filter="${key}">${label} <span class="itemx-seg-n">${counts[key]}</span></button>`).join('')}</nav><div class="itemx-tools"><button class="itemx-tool" data-action="motion">${ui.motion ? '✦ 모션' : '◇ 정지'}</button><input class="itemx-search itemx-search-input" value="${ITEMXCore.esc(ui.query)}" placeholder="검색" aria-label="검색"><button class="itemx-tool" data-action="rebuild">↻</button></div><div class="itemx-body"><div class="itemx-grid">${visible.map(ITEMXRenderer.renderTile).join('') || '<div class="itemx-empty">표시할 아이템이 없답니다.</div>'}</div></div><footer class="itemx-pf">${visible.length}점 표시${all.filter(matches).length > 60 ? ' · 첫 60점' : ''}</footer>`);
    const permissionLabel = runtime.permissions.replacer === true ? '연결됨' : runtime.permissions.replacer === false ? '권한 필요' : '확인 중';
    const styleLabel = runtime.permissions.mainDom === true ? '고정 스타일' : runtime.permissions.mainDom === false ? '본문 폴백' : '확인 중';
    const positionOptions = BADGE_POSITIONS.map(([value, label]) => `<option value="${value}" ${runtime.badgePosition === value ? 'selected' : ''}>${label}</option>`).join('');
    const managerContent = `<section class="itemx-manager"><div class="itemx-manager-title">아이템 운영 도구</div><label class="itemx-manager-field"><span>대상 아이템</span><select data-action="manage-select" ${all.length ? '' : 'disabled'}>${manageOptions || '<option>아이템 없음</option>'}</select></label><label class="itemx-manager-field"><span>수정 지시 · 비워두면 순수 재감정</span><textarea data-action="manage-note" placeholder="예: 이름은 그대로 두고 내구도를 31/100으로, 화염 속성은 제거"></textarea></label><div class="itemx-manager-actions"><button class="itemx-tool" data-action="manage-reroll" ${managed ? '' : 'disabled'}>🔄 정보 수정·재감정</button><button class="itemx-tool itemx-manager-danger" data-action="manage-remove" ${managed && managed.possession !== 'removed' ? '' : 'disabled'}>🗑 수동 제거</button></div><div class="itemx-manager-current">${managed ? `${ITEMXCore.esc(managed.name)} · ${ITEMXCore.esc(managed.displayRarity || managed.rarity)} · ${ITEMXCore.esc(managed.possession)} / ${ITEMXCore.esc(managed.location)}` : '선택 가능한 아이템이 없습니다.'}</div><label class="itemx-manager-field"><span>신규 아이템 생성 지시</span><textarea data-action="create-note" placeholder="예: 주인공이 획득한 번개 속성의 희귀 장검"></textarea></label><button class="itemx-tool" data-action="manage-create">＋ 신규 아이템 생성 시도</button><small class="itemx-manager-help">보조 모델 결과는 ITEMX 엄격 파서와 id 검증을 통과한 경우에만 채팅별 사건 원장에 반영됩니다.</small></section>`;
    const domainControls = [['items', '무기·아이템', loaded.itemsEnabled], ['skills', '스킬', loaded.skillsEnabled], ['encounters', '전투 도감', loaded.encountersEnabled]].map(([key, label, value]) => `<button class="itemx-tool ${value ? 'itemx-setting-on' : ''}" data-action="domain-${key}">${label} ${value ? 'ON' : 'OFF'}</button>`).join('');
    const debugLog = runtime.debugEntries.slice(-12).reverse().map((entry) => `${new Date(entry.at).toLocaleTimeString('ko-KR', { hour12: false })} ${entry.where}\n${entry.detail}`).join('\n\n') || '기록 없음';
    const debugContent = `<details class="itemx-codex-fold"><summary><strong>디버그 진단 · ${loaded.debugEnabled ? 'ON' : 'OFF'}</strong><small>훅·스냅숏·최근 로그</small></summary><div class="itemx-codex-detail"><span>문맥 ${ITEMXCore.esc(loaded.key)}</span><span>스냅숏 ${ITEMXCore.esc(loaded.snapshot.fingerprint || '-')} / ${ITEMXCore.esc(loaded.codexSnapshot.fingerprint || '-')}</span><span>오류 ${ITEMXCore.esc(runtime.lastHookError || runtime.lastDomError || '없음')}</span><div class="itemx-manager-actions"><button class="itemx-tool ${loaded.debugEnabled ? 'itemx-setting-on' : ''}" data-action="debug-toggle">로그 ${loaded.debugEnabled ? 'ON' : 'OFF'}</button><button class="itemx-tool" data-action="debug-clear">비우기</button></div><pre class="itemx-debug-log">${ITEMXCore.esc(debugLog)}</pre></div></details>`;
    const cleanupArmed = runtime.cleanupArmedUntil > Date.now();
    const settingsContent = `<div class="itemx-settings">${managerContent}<section class="itemx-setting-card"><span><strong>기능별 추적</strong><small>OFF는 새 수집만 멈추며 기존 기록은 보존합니다.</small></span></section><div class="itemx-domain-controls">${domainControls}</div><section class="itemx-setting-card"><span><strong>현재 봇 ITEMX CODEX</strong><small>${enabled ? '활성 상태입니다.' : '모든 모델 규약과 처리를 멈춥니다.'}</small></span><button class="itemx-tool ${enabled ? 'itemx-setting-on' : ''}" data-action="toggle">${enabled ? 'ON' : 'OFF'}</button></section><section class="itemx-setting-card"><span><strong>메인 출력</strong><small>활성화된 기능의 규약만 주입합니다.</small></span><button class="itemx-tool ${loaded.mainOutput ? 'itemx-setting-on' : ''}" data-action="main-output">${loaded.mainOutput ? 'ON' : 'OFF'}</button></section><section class="itemx-setting-card"><span><strong>보조 출력</strong><small>활성화된 기능만 누락 복구합니다.</small></span><button class="itemx-tool" data-action="aux-output">${AUX_LABELS[loaded.auxOutput] || AUX_LABELS.missing}</button></section><section class="itemx-setting-card"><span><strong>등급 기준</strong><small>아이템과 스킬의 세계관 등급명은 보존하고 내부 시각 등급의 판정 기준을 선택합니다.</small></span><button class="itemx-tool ${loaded.rarityMode === 'itemx' ? 'itemx-setting-on' : ''}" data-action="rarity-mode">${RARITY_MODE_LABELS[loaded.rarityMode] || RARITY_MODE_LABELS.world}</button></section><section class="itemx-setting-card"><span><strong>시각 이펙트</strong><small>본문 카드·인벤토리·스킬·조우 효과를 한 번에 제어합니다.</small></span><button class="itemx-tool ${loaded.effectsEnabled ? 'itemx-setting-on' : ''}" data-action="effects">${loaded.effectsEnabled ? 'ON' : 'OFF'}</button></section><section class="itemx-setting-card"><span><strong>모듈 에셋 초상화</strong><small>활성 모듈 에셋을 사용하며 실패하면 이모지로 표시합니다.</small></span><button class="itemx-tool ${loaded.moduleAssetsEnabled ? 'itemx-setting-on' : ''}" data-action="module-assets">${loaded.moduleAssetsEnabled ? 'ON' : 'OFF'}</button></section><section class="itemx-setting-card"><span><strong>글자 크기</strong><small>인벤토리·스킬·조우 UI에 적용합니다.</small></span><select class="itemx-position-select" data-action="font-scale"><option value="small" ${loaded.fontScale === 'small' ? 'selected' : ''}>소</option><option value="medium" ${loaded.fontScale === 'medium' ? 'selected' : ''}>중</option><option value="large" ${loaded.fontScale === 'large' ? 'selected' : ''}>대</option></select></section><section class="itemx-setting-card"><span><strong>사이드 배지 위치</strong><small>기존 ITEMX 모듈과 같은 여섯 방향 배치입니다.</small></span><select class="itemx-position-select" data-action="badge-position">${positionOptions}</select></section><section class="itemx-setting-card"><span><strong>모델 처리 권한</strong><small>${permissionLabel} · 요청 주입과 원시 태그 정리에 필요합니다.</small></span><button class="itemx-tool" data-action="permissions">권한 요청</button></section><section class="itemx-setting-card"><span><strong>본문 카드 스타일</strong><small>${styleLabel} · 거부되어도 메시지별 스타일로 표시합니다.</small></span><button class="itemx-tool" data-action="style">다시 연결</button></section><section class="itemx-setting-card"><span><strong>채팅 저장소 재구축</strong><small>본문 사건과 수동 사건 원장을 시간순으로 다시 읽습니다.</small></span><button class="itemx-tool" data-action="rebuild">재구축</button></section><section class="itemx-setting-card"><span><strong>현재 채팅 ITEMX 기록 제거</strong><small>현재 봇을 OFF로 바꾸고 이 채팅 본문의 마커와 ITEMX/CODEX 원장을 삭제합니다.</small></span><button class="itemx-tool itemx-manager-danger" data-action="cleanup-chat">${cleanupArmed ? '다시 눌러 완전 제거' : '현재 채팅 정리'}</button></section>${debugContent}<p class="itemx-setting-note">보조 복구는 활성화된 도메인의 검증된 마커만 반영합니다.</p></div>`;
    const iframeSkills = ui.tab === 'skills' ? (loaded.codexSnapshot?.skills?.order || []).map((id) => loaded.codexSnapshot.skills.entries[id]).filter(Boolean) : [];
    const iframeMonsters = ui.tab === 'bestiary' ? (loaded.codexSnapshot?.monsters?.order || []).map((id) => loaded.codexSnapshot.monsters.entries[id]).filter(Boolean) : [];
    const selectedSkill = ui.selectedSkill && iframeSkills.find((one) => one.id === ui.selectedSkill);
    const selectedMonster = ui.selectedMonster && iframeMonsters.find((one) => one.id === ui.selectedMonster);
    const skillRows = iframeSkills.map((one) => `<button class="itemx-codex-list-button itemx2-codex-card itemx2-codex-summary" data-skill-id="${ITEMXCore.esc(one.id)}">${skillSummaryHtml(one, loaded.rarityMode)}</button>`).join('');
    const monsterRows = iframeMonsters.map((one) => `<button class="itemx-codex-list-button itemx2-codex-card itemx2-codex-summary itemx2-bestiary-card ${one.active ? 'active' : ''}" data-monster-id="${ITEMXCore.esc(one.id)}">${monsterSummaryHtml(one, loaded.portraits?.[one.id] || '')}</button>`).join('');
    const skillsContent = `<div class="itemx-settings">${selectedSkill ? skillPageHtml(selectedSkill, '<button class="itemx-codex-back" data-action="back-skill">‹ 스킬 목록</button>', loaded.rarityMode).replace('itemx2-codex-page', 'itemx-codex-page-active') : `<div class="itemx-codex-list">${skillRows || '<div class="itemx-empty">아직 확정된 스킬이 없답니다.</div>'}</div>`}</div>`;
    const bestiaryContent = `<div class="itemx-settings">${selectedMonster ? monsterPageHtml(selectedMonster, loaded.portraits?.[selectedMonster.id] || '', '<button class="itemx-codex-back" data-action="back-monster">‹ 조우 목록</button>').replace('itemx2-codex-page', 'itemx-codex-page-active') : `<div class="itemx-codex-list">${monsterRows || '<div class="itemx-empty">실제 전투나 합의된 대련이 발생하면 등록된답니다.</div>'}</div>`}</div>`;
    const content = ui.tab === 'settings' ? settingsContent : ui.tab === 'skills' ? skillsContent : ui.tab === 'bestiary' ? bestiaryContent : inventoryContent;
    root.innerHTML = `<div class="risu-shell"><main class="stage itemx-plugin-stage ${runtime.compactContainer ? '' : 'itemx-plugin-stage-fallback'}"><section class="itemx-panel itemx2-font-${loaded.fontScale || 'small'} ${loaded.effectsEnabled ? '' : 'itemx2-effects-off'}" aria-label="ITEMX CODEX"><header class="itemx-ph"><span class="itemx-ph-text"><span class="itemx-ph-eyebrow">ITEMX CODEX · ${ITEMX_VERSION_LABEL}${updateLabelHtml()}</span><span class="itemx-ph-title">${ITEMXCore.esc(loaded.character.name || '인벤토리')}</span><span class="itemx-ph-sub">${enabled ? `보유 ${counts.owned} · 장착 ${counts.equipped} · 관찰 ${counts.observed}` : '현재 봇 비활성'} · ${ITEMXCore.esc(runtime.status)}</span></span><button class="itemx-ph-btn" data-action="close" aria-label="닫기">✕</button></header><nav class="itemx-main-tabs"><button class="itemx-main-tab ${ui.tab === 'inventory' ? 'itemx-main-tab-on' : ''}" data-tab="inventory">📦 인벤</button><button class="itemx-main-tab ${ui.tab === 'skills' ? 'itemx-main-tab-on' : ''}" data-tab="skills">✨ 스킬</button><button class="itemx-main-tab ${ui.tab === 'bestiary' ? 'itemx-main-tab-on' : ''}" data-tab="bestiary">⚔️ 조우</button><button class="itemx-main-tab ${ui.tab === 'settings' ? 'itemx-main-tab-on' : ''}" data-tab="settings">⚙️ 설정</button></nav>${content}</section></main></div>`;
    root.querySelector('[data-action="close"]')?.addEventListener('click', () => { void closeInventory(); });
    root.querySelector('[data-action="back"]')?.addEventListener('click', () => { ui.selected = null; drawInventory(loaded); });
    root.querySelector('[data-action="back-skill"]')?.addEventListener('click', () => { ui.selectedSkill = null; drawInventory(loaded); });
    root.querySelector('[data-action="back-monster"]')?.addEventListener('click', () => { ui.selectedMonster = null; drawInventory(loaded); });
    root.querySelector('[data-action="motion"]')?.addEventListener('click', () => { ui.motion = !ui.motion; drawInventory(loaded); });
    root.querySelector('[data-action="toggle"]')?.addEventListener('click', async () => { loaded.enabled = !enabled; await setEnabled(loaded.character, loaded.enabled); runtime.status = loaded.enabled ? '현재 봇 활성화' : '현재 봇 비활성화'; drawInventory(loaded); });
    for (const [domain, key, label] of [['items', 'itemsEnabled', '무기·아이템'], ['skills', 'skillsEnabled', '스킬'], ['encounters', 'encountersEnabled', '전투 도감']]) root.querySelector(`[data-action="domain-${domain}"]`)?.addEventListener('click', async () => {
      loaded[key] = !loaded[key]; await setDomainEnabled(loaded.character, domain, loaded[key]); runtime.status = `${label} · ${loaded[key] ? 'ON' : 'OFF'}`; drawInventory(loaded);
    });
    root.querySelector('[data-action="debug-toggle"]')?.addEventListener('click', async () => { loaded.debugEnabled = !loaded.debugEnabled; await setDebugEnabled(loaded.character, loaded.debugEnabled); runtime.status = `디버그 로그 · ${loaded.debugEnabled ? 'ON' : 'OFF'}`; drawInventory(loaded); });
    root.querySelector('[data-action="debug-clear"]')?.addEventListener('click', () => { runtime.debugEntries = []; runtime.status = '디버그 로그 비움'; drawInventory(loaded); });
    root.querySelector('[data-action="main-output"]')?.addEventListener('click', async () => { loaded.mainOutput = !loaded.mainOutput; await setMainOutput(loaded.character, loaded.mainOutput); runtime.status = `메인 출력 · ${loaded.mainOutput ? 'ON' : 'OFF'}`; drawInventory(loaded); });
    root.querySelector('[data-action="aux-output"]')?.addEventListener('click', async () => { loaded.auxOutput = loaded.auxOutput === 'missing' ? 'always' : loaded.auxOutput === 'always' ? 'off' : 'missing'; await setAuxOutput(loaded.character, loaded.auxOutput); runtime.status = `보조 출력 · ${AUX_LABELS[loaded.auxOutput]}`; drawInventory(loaded); });
    root.querySelector('[data-action="rarity-mode"]')?.addEventListener('click', async () => { loaded.rarityMode = loaded.rarityMode === 'itemx' ? 'world' : 'itemx'; await setRarityMode(loaded.character, loaded.rarityMode); runtime.status = `등급 기준 · ${RARITY_MODE_LABELS[loaded.rarityMode]}`; drawInventory(loaded); });
    root.querySelector('[data-action="effects"]')?.addEventListener('click', async () => { loaded.effectsEnabled = !loaded.effectsEnabled; await setEffectsEnabled(loaded.character, loaded.effectsEnabled); runtime.status = `시각 이펙트 · ${loaded.effectsEnabled ? 'ON' : 'OFF'}`; drawInventory(loaded); });
    root.querySelector('[data-action="module-assets"]')?.addEventListener('click', async () => {
      if (loaded.moduleAssetsEnabled) {
        loaded.moduleAssetsEnabled = false; await setModuleAssetsEnabled(loaded.character, false); runtime.status = '모듈 에셋 초상화 · OFF'; drawInventory(loaded); return;
      }
      const enabled = await enableModuleAssets(loaded.character, loaded.chat);
      loaded.moduleAssetsEnabled = enabled;
      runtime.status = enabled ? '모듈 에셋 초상화 · ON' : '모듈 에셋 권한 없음 · 이모지 폴백';
      if (!enabled && typeof Risuai.alertError === 'function') await Risuai.alertError('모듈 에셋 권한이 허용되지 않았습니다. 조우 초상화는 이모지로 표시됩니다.');
      drawInventory(loaded);
    });
    root.querySelector('[data-action="font-scale"]')?.addEventListener('change', async (event) => { const value = event.target.value; await setFontScale(loaded.character, value); loaded.fontScale = value; runtime.status = `글자 크기 · ${{small:'소',medium:'중',large:'대'}[value]}`; drawInventory(loaded); });
    root.querySelector('[data-action="rebuild"]')?.addEventListener('click', async () => { const next = await rebuildCurrent(); if (next) { next.enabled = await isEnabled(next.character); drawInventory(next); } });
    root.querySelector('[data-action="cleanup-chat"]')?.addEventListener('click', async () => {
      if (runtime.cleanupArmedUntil <= Date.now()) {
        runtime.cleanupArmedUntil = Date.now() + 7000;
        runtime.status = '정리 확인 대기 · 7초 안에 다시 누르세요';
        drawInventory(loaded); return;
      }
      runtime.status = '현재 채팅 ITEMX 기록 정리 중'; drawInventory(loaded);
      try {
        const result = await cleanCurrentChatItemx();
        if (result.loaded) drawInventory(result.loaded);
      } catch (error) {
        runtime.cleanupArmedUntil = 0; runtime.status = '현재 채팅 정리 실패';
        if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX 정리 실패: ${error.message || error}`);
        drawInventory(loaded);
      }
    });
    root.querySelector('[data-action="permissions"]')?.addEventListener('click', async () => {
      runtime.status = '모델 처리 권한 확인 중'; drawInventory(loaded);
      const connected = await installPipelineHooks({ prompt: true });
      if (connected && typeof Risuai.alert === 'function') await Risuai.alert('ITEMX CODEX 모델 처리 권한이 연결되었습니다.');
      else if (!connected && typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX 권한 연결 실패: ${runtime.lastHookError || runtime.status}`);
      const next = await rebuildCurrent(); if (next) { next.enabled = await isEnabled(next.character); drawInventory(next); }
    });
    root.querySelector('[data-action="style"]')?.addEventListener('click', async () => {
      runtime.status = '본문 화면 연결 중'; drawInventory(loaded);
      const styled = await installMainStyle({ prompt: true });
      if (styled && typeof Risuai.alert === 'function') await Risuai.alert('ITEMX CODEX 본문 화면 연결이 완료되었습니다.');
      else if (!styled && typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX 화면 연결 실패: ${runtime.lastDomError || runtime.status}`);
      drawInventory(loaded);
    });
    root.querySelector('[data-action="badge-position"]')?.addEventListener('change', async (event) => { const value = event.target.value; if (!BADGE_POSITIONS.some(([key]) => key === value)) return; runtime.badgePosition = value; await Risuai.pluginStorage.setItem('badgePosition', value); if (runtime.rootDrawer) { for (const [other] of BADGE_POSITIONS) await runtime.rootDrawer.removeClass(`x-risu-itemx2-pos-${other}`); await runtime.rootDrawer.addClass(`x-risu-itemx2-pos-${value}`); } await installMainStyle(); runtime.status = `배지 위치 · ${BADGE_POSITIONS.find(([key]) => key === value)?.[1] || value}`; drawInventory(loaded); });
    root.querySelector('[data-action="manage-select"]')?.addEventListener('change', (event) => { ui.manageId = event.target.value; drawInventory(loaded); });
    root.querySelector('[data-action="manage-remove"]')?.addEventListener('click', async () => {
      try {
        const target = itemsOf(loaded.snapshot).find((item) => item.id === ui.manageId); if (!target) throw new Error('대상 아이템이 없습니다.');
        if (typeof Risuai.alertConfirm === 'function' && !(await Risuai.alertConfirm(`${target.name}을(를) 현재 채팅 인벤토리에서 제거할까요?`))) return;
        runtime.status = '수동 제거 처리 중'; drawInventory(loaded);
        const event = { kind: 'patch', patch: { id: target.id, action: null, op: 'remove', fields: {}, quantity: null, destination: '', reason: 'manual_remove', slot: null, inputs: null, outputs: null, equip: null, unequip: null } };
        const next = await commitManualEvents(loaded, [event], '수동 제거'); if (next) { next.enabled = await isEnabled(next.character); drawInventory(next); }
      } catch (error) { runtime.status = '수동 제거 실패'; if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX: ${error.message || error}`); drawInventory(loaded); }
    });
    root.querySelector('[data-action="manage-reroll"]')?.addEventListener('click', async () => {
      try {
        const target = itemsOf(loaded.snapshot).find((item) => item.id === ui.manageId); if (!target) throw new Error('대상 아이템이 없습니다.');
        const note = root.querySelector('[data-action="manage-note"]')?.value?.trim() || '';
        runtime.status = note ? '정보 수정 감정 중' : '아이템 재감정 중'; drawInventory(loaded);
        const event = await runItemModel('reroll', loaded, target, note);
        const next = await commitManualEvents(loaded, [event], note ? '정보 수정' : '재감정'); if (next) { next.enabled = await isEnabled(next.character); drawInventory(next); }
      } catch (error) { runtime.status = '재감정 실패'; if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX: ${error.message || error}`); drawInventory(loaded); }
    });
    root.querySelector('[data-action="manage-create"]')?.addEventListener('click', async () => {
      try {
        const note = root.querySelector('[data-action="create-note"]')?.value?.trim() || ''; if (!note) throw new Error('생성할 아이템 설명을 입력하세요.');
        runtime.status = '신규 아이템 생성 중'; drawInventory(loaded);
        const event = await runItemModel('create', loaded, null, note);
        const next = await commitManualEvents(loaded, [event], '신규 생성'); ui.manageId = event.item.id; if (next) { next.enabled = await isEnabled(next.character); drawInventory(next); }
      } catch (error) { runtime.status = '아이템 생성 실패'; if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX: ${error.message || error}`); drawInventory(loaded); }
    });
    root.querySelectorAll('[data-tab]').forEach((el) => el.addEventListener('click', () => {
      if (ui.tab === el.dataset.tab) return;
      ui.tab = el.dataset.tab; ui.selected = null; ui.selectedSkill = null; ui.selectedMonster = null;
      const current = root.querySelector('.itemx-main-tabs')?.nextElementSibling;
      if (current) current.innerHTML = '<div class="itemx2-tab-loading" role="status" aria-live="polite"><i></i><strong>탭 불러오는 중</strong><small>선택한 화면만 준비하고 있답니다.</small></div>';
      setTimeout(() => drawInventory(loaded), 24);
    }));
    root.querySelectorAll('[data-filter]').forEach((el) => el.addEventListener('click', () => { ui.filter = el.dataset.filter; drawInventory(loaded); }));
    root.querySelectorAll('[data-item-id]').forEach((el) => el.addEventListener('click', () => { ui.selected = el.dataset.itemId; drawInventory(loaded); }));
    root.querySelectorAll('[data-skill-id]').forEach((el) => el.addEventListener('click', () => { ui.selectedSkill = el.dataset.skillId; drawInventory(loaded); }));
    root.querySelectorAll('[data-monster-id]').forEach((el) => el.addEventListener('click', () => { ui.selectedMonster = el.dataset.monsterId; drawInventory(loaded); }));
    root.querySelector('.itemx-search-input')?.addEventListener('input', (event) => { ui.query = event.target.value; drawInventory(loaded); const input = root.querySelector('.itemx-search-input'); input?.focus(); input?.setSelectionRange(ui.query.length, ui.query.length); });
  }

  function reducedMotion() {
    return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async function closeInventory({ immediate = false } = {}) {
    runtime.panelOpen = false;
    const transition = ++runtime.panelTransition;
    const panel = typeof document === 'undefined' ? null : document.querySelector('.itemx-panel');
    if (panel && !immediate && !reducedMotion()) {
      panel.classList.remove('itemx-plugin-panel-in');
      panel.classList.add('itemx-plugin-panel-out');
      await Promise.race([
        new Promise((resolve) => panel.addEventListener('animationend', resolve, { once: true })),
        delay(210)
      ]);
    }
    if (transition !== runtime.panelTransition || runtime.panelOpen) return;
    await Risuai.hideContainer();
    runtime.allowDrawerOverSettings = false;
    await syncHostSettingsVisibility();
  }

  async function openInventory(tab = 'inventory') {
    if (tab === 'inventory') return openRootInventory();
    const transition = ++runtime.panelTransition;
    runtime.panelOpen = true;
    ui.tab = tab;
    try {
      const compact = window.innerWidth <= 520;
      const panelWidth = compact ? Math.max(320, window.innerWidth - 32) : 420;
      const panelHeight = Math.max(420, Math.min(700, Math.round(window.innerHeight * (compact ? 0.72 : 0.78))));
      runtime.compactContainer = true;
      try {
        await Risuai.resizeContainer(panelHeight, panelWidth);
      } catch (error) {
        runtime.compactContainer = false;
        runtime.status = 'PocketRisu 호환 모드';
        log('resizeContainer unavailable; using bounded fullscreen fallback');
      }
      document.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${ITEMX_STYLE}\n${codexPageStyle()}\nhtml,body{height:100%;min-height:0!important;overflow:hidden;background:transparent!important}.risu-shell{height:100%;min-height:0;background:transparent}.itemx-plugin-stage{width:100%;height:100%;min-height:0;display:block;padding:8px}.itemx-plugin-stage .itemx-panel{width:100%;height:100%;margin:0;max-height:none}.itemx-plugin-stage-fallback{display:flex;align-items:flex-end;justify-content:flex-end;padding:12px;background:transparent}.itemx-plugin-stage-fallback .itemx-panel{width:min(420px,100%);height:min(700px,72dvh);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.58)}.itemx-plugin-panel-in{animation:itemx-plugin-panel-in 190ms cubic-bezier(.2,.78,.2,1) both}.itemx-plugin-panel-out{pointer-events:none;animation:itemx-plugin-panel-out 160ms cubic-bezier(.4,0,1,1) both}@keyframes itemx-plugin-panel-in{from{opacity:0;transform:translate3d(0,7px,0) scale(.982)}to{opacity:1;transform:none}}@keyframes itemx-plugin-panel-out{from{opacity:1;transform:none}to{opacity:0;transform:translate3d(0,5px,0) scale(.988)}}.itemx-search-input{font:inherit;outline:none}.itemx-empty{padding:2rem;text-align:center;color:#77839c}.itemx-disabled{display:grid;gap:12px;padding:28px;color:#93a2ba;overflow:auto}.itemx-disabled strong{color:#f4f0e6}.itemx-disabled .itemx-tool{justify-self:start}.itemx-main-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid #171d2b}.itemx-main-tab{min-width:0;min-height:44px;border:0;border-bottom:2px solid transparent;background:#0d121c;color:#77839c;font:inherit;font-size:.72rem;white-space:nowrap;cursor:pointer}.itemx-main-tab-on{border-bottom-color:#d4af6e;color:#f2ead9;font-weight:800}.itemx-panel>.itemx-body{flex:1;min-height:0;overflow:auto}.itemx-settings{display:grid;gap:10px;padding:16px;overflow:auto}.itemx-setting-card{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px;border:1px solid #1c2331;border-radius:12px;background:#0d121c}.itemx-setting-card span{display:grid;gap:4px}.itemx-setting-card strong{color:#edf2fb}.itemx-setting-card small,.itemx-setting-note{color:#77839c;line-height:1.45}.itemx-setting-on{border-color:#6baf88;color:#a9e6c2}.itemx-position-select{min-height:38px;padding:0 10px;border:1px solid #2b3547;border-radius:9px;background:#151d2a;color:#cbd7e9}.itemx-setting-note{margin:2px 4px 0;font-size:.72rem}.itemx-manager{display:grid;gap:10px;padding:14px;border:1px solid #303a4e;border-radius:13px;background:#0b1019}.itemx-manager-title{color:#f0d79d;font-weight:800}.itemx-manager-field{display:grid;gap:5px;color:#8592a8;font-size:.76rem}.itemx-manager-field select,.itemx-manager-field textarea{width:100%;padding:9px;border:1px solid #293448;border-radius:9px;background:#121925;color:#e3e9f3;font:inherit}.itemx-manager-field textarea{min-height:72px;resize:vertical}.itemx-manager-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.itemx-manager-danger{border-color:#65333a!important;color:#ffadb5!important}.itemx-manager-current,.itemx-manager-help{color:#718097;font-size:.72rem;line-height:1.45}.itemx-codex-fold{border:1px solid #263247;border-radius:12px;background:#0d121c;overflow:hidden}.itemx-codex-fold summary{display:grid;gap:4px;padding:14px;cursor:pointer;list-style:none}.itemx-codex-fold summary::-webkit-details-marker{display:none}.itemx-codex-fold summary strong{color:#edf2fb}.itemx-codex-fold summary small{color:#8494ad}.itemx-codex-detail{display:grid;gap:7px;padding:11px 14px 14px;border-top:1px solid #202b3c;color:#bdc8d9;font-size:.72rem;line-height:1.5}.itemx-codex-detail b{color:#7788a2}.itemx-domain-controls{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.itemx-debug-log{max-height:180px;overflow:auto;padding:9px;border:1px solid #202b3d;border-radius:8px;background:#080d15;color:#91a2ba;font:10px/1.45 monospace;white-space:pre-wrap}@media(prefers-reduced-motion:reduce){.itemx-plugin-panel-in,.itemx-plugin-panel-out{animation:none!important}}@media(max-width:380px){.itemx-plugin-stage{padding:6px}.itemx-setting-card{align-items:flex-start;flex-direction:column}.itemx-grid{grid-template-columns:1fr}.itemx-manager-actions,.itemx-domain-controls{grid-template-columns:1fr}}</style>`;
      document.body.innerHTML = '<div id="itemx2-root"></div>';
      const loaded = await rebuildCurrent();
      if (!loaded) throw new Error('No active chat context');
      loaded.enabled = await isEnabled(loaded.character);
      Object.assign(loaded, await outputSettings(loaded.character));
      runtime.debugEnabled = loaded.debugEnabled;
      drawInventory(loaded);
      await Risuai.showContainer(runtime.compactContainer ? 'floating' : 'fullscreen');
      const panel = document.querySelector('.itemx-panel');
      if (panel && transition === runtime.panelTransition && runtime.panelOpen && !reducedMotion()) panel.classList.add('itemx-plugin-panel-in');
    } catch (error) {
      if (transition === runtime.panelTransition) runtime.panelOpen = false;
      runtime.status = '인벤토리 열기 오류';
      try { await Risuai.hideContainer(); } catch {}
      fail('openInventory', error);
    }
  }

  async function toggleCurrentBot() {
    const ctx = await context(); if (!ctx) return;
    const next = !(await isEnabled(ctx.character)); await setEnabled(ctx.character, next);
    runtime.status = next ? '현재 봇 활성화' : '현재 봇 비활성화';
    await openRootInventory({ open: true, tab: 'settings' });
  }

  async function openSettingsFromRisuMenu() {
    const active = await context();
    if (!active) {
      runtime.allowDrawerOverSettings = false;
      runtime.status = '채팅 진입 대기';
      const message = 'ITEMX CODEX는 채팅봇에 진입한 뒤 사용할 수 있습니다.';
      if (typeof Risuai.alertNormal === 'function') await Risuai.alertNormal(message);
      else if (typeof Risuai.alertError === 'function') await Risuai.alertError(message);
      return;
    }
    runtime.activeContextKey = active.key;
    runtime.allowDrawerOverSettings = true;
    let styled = Boolean(runtime.mainDoc) || await installMainStyle();
    const loadingStarted = styled ? Date.now() : 0;
    if (styled) await mountRootLoading('ITEMX CODEX 설정 불러오는 중…');
    await updateRootLoading('연결과 권한 확인 중…');
    const connected = await installPipelineHooks({ prompt: true });
    if (!styled) {
      await delay(300);
      styled = await installMainStyle();
      if (styled) await mountRootLoading('ITEMX CODEX 설정 불러오는 중…');
    }
    await updateRootLoading('인벤토리 상태 확인 중…');
    runtime.status = connected && styled ? '연결 및 권한 정상' : connected ? '화면 연결 실패' : '모델 훅 연결 실패';
    if (loadingStarted) await delay(Math.max(0, 260 - (Date.now() - loadingStarted)));
    if (styled) await openRootInventory({ open: true, tab: 'settings' });
    else await openInventory('settings');
  }

  async function installPipelineHooks({ prompt = false } = {}) {
    if (runtime.hookInstallPromise) return runtime.hookInstallPromise;
    const pending = installPipelineHooksNow({ prompt }).finally(() => {
      if (runtime.hookInstallPromise === pending) runtime.hookInstallPromise = null;
    });
    runtime.hookInstallPromise = pending;
    return pending;
  }

  async function installDisplayHooks() {
    if (!runtime.hooks.process) { await Risuai.addRisuScriptHandler('process', processHandler); runtime.hooks.process = true; }
    if (!runtime.hooks.output) { await Risuai.addRisuScriptHandler('output', outputFallback); runtime.hooks.output = true; }
    if (!runtime.hooks.display) { await Risuai.addRisuScriptHandler('display', displayHandler); runtime.hooks.display = true; }
  }

  async function installPipelineHooksNow({ prompt = false } = {}) {
    try {
      await installDisplayHooks();
      const permission = typeof Risuai.requestPluginPermission === 'function'
        ? await Risuai.requestPluginPermission('replacer')
        : true;
      runtime.permissions.replacer = permission === true;
      if (!runtime.permissions.replacer) {
        if (runtime.hooks.before) { try { await Risuai.removeRisuReplacer('beforeRequest', beforeRequest); } catch {} }
        if (runtime.hooks.after) { try { await Risuai.removeRisuReplacer('afterRequest', afterRequest); } catch {} }
        runtime.hooks.before = false;
        runtime.hooks.after = false;
        runtime.lastHookError = '모델 처리 권한이 허용되지 않았습니다';
        runtime.status = '모델 처리 권한 필요';
      } else {
        if (!runtime.hooks.before) { await Risuai.addRisuReplacer('beforeRequest', beforeRequest); runtime.hooks.before = true; }
        if (!runtime.hooks.after) { await Risuai.addRisuReplacer('afterRequest', afterRequest); runtime.hooks.after = true; }
      }
      if (!runtime.hooks.listener) {
        if (typeof Risuai.addRisuChatListener !== 'function') {
          runtime.hooks.listener = 'unsupported';
          log('chat listener unavailable; continuing with core request/output hooks');
        } else try {
          await Risuai.addRisuChatListener('output', async (event) => {
            try {
              await rebuildCurrent();
              await catchUpLatestOutput();
              await ensureRootInventory();
            } catch (error) { fail('chat listener', error); }
          });
          runtime.hooks.listener = true;
        } catch (error) {
          const message = String(error?.message || error || '');
          if (!/API method addRisuChatListener not found/i.test(message)) throw error;
          runtime.hooks.listener = 'unsupported';
          log('chat listener unavailable; continuing with core request/output hooks');
        }
      }
      if (runtime.permissions.replacer) {
        runtime.lastHookError = '';
        runtime.status = prompt ? '모델 처리 권한 연결됨' : '정상';
      }
      return runtime.permissions.replacer;
    } catch (error) {
      runtime.permissions.replacer = false;
      runtime.lastHookError = String(error?.message || error || '알 수 없는 모델 훅 오류');
      runtime.status = '모델 연결 오류';
      fail('pipeline hooks', error);
      return false;
    }
  }

  try {
    await loadBadgePosition();
    const setting = await Risuai.registerSetting('ITEMX CODEX · 권한 및 설정', openSettingsFromRisuMenu, '💎', 'html', 'itemx2-current-bot');
    if (setting?.id) runtime.uiParts.push(setting.id);
    await installDisplayHooks();
    const initial = await context();
    let connected = false, styled = false;
    if (initial) {
      runtime.activeContextKey = initial.key;
      runtime.status = '초기 화면 연결 중';
      await outputSettings(initial.character);
      styled = await installMainStyle();
      const loadingStarted = styled ? Date.now() : 0;
      if (styled) await mountRootLoading('ITEMX CODEX 초기화 중…');
      await updateRootLoading('모델 처리 연결 중…');
      connected = await installPipelineHooks();
      await updateRootLoading('채팅 인벤토리 복원 중…');
      await rebuildCurrent({ upgradeDisplayRefs: true });
      if (loadingStarted) await delay(Math.max(0, 320 - (Date.now() - loadingStarted)));
      if (styled) await openRootInventory({ open: false });
      void checkForUpdate();
    } else {
      runtime.status = '채팅 진입 대기';
    }
    runtime.remountTimer = globalThis.setInterval(() => {
      if (runtime.bodyFxScrollActive) return;
      if (!runtime.activeContextKey || !runtime.hostObserver || Date.now() - runtime.remountFallbackAt >= 10000) void ensureRootInventory();
    }, 1200);
    runtime.catchUpTimer = globalThis.setInterval(() => { void catchUpLatestOutput().catch((error) => fail('latest output catch-up', error)); }, 4500);
    runtime.updateTimer = globalThis.setInterval(() => { void checkForUpdate(); }, ITEMX_UPDATE_CHECK_MS);
    if (initial) void catchUpLatestOutput().catch((error) => fail('initial output catch-up', error));
    if (connected && styled) runtime.status = '정상';
    log(`v${ITEMX_PLUGIN_VERSION} ready`);
  } catch (error) {
    runtime.status = '초기화 오류';
    await removeRootDrawer();
    if (typeof Risuai.alertError === 'function') await Risuai.alertError(`ITEMX CODEX 초기화 실패: ${error.message || error}`);
    fail('bootstrap', error);
  }

  await Risuai.onUnload(async () => {
    runtime.panelOpen = false;
    runtime.panelTransition += 1;
    if (runtime.remountTimer) globalThis.clearInterval(runtime.remountTimer);
    runtime.remountTimer = null;
    if (runtime.catchUpTimer) globalThis.clearInterval(runtime.catchUpTimer);
    runtime.catchUpTimer = null;
    if (runtime.updateTimer) globalThis.clearInterval(runtime.updateTimer);
    runtime.updateTimer = null;
    if (runtime.hostSyncTimer) globalThis.clearTimeout(runtime.hostSyncTimer);
    runtime.hostSyncTimer = null;
    if (runtime.feedbackTimer) globalThis.clearTimeout(runtime.feedbackTimer);
    runtime.feedbackTimer = null;
    if (runtime.auxToastTimer) globalThis.clearTimeout(runtime.auxToastTimer);
    runtime.auxToastTimer = null;
    if (runtime.legacyCommitTimer) globalThis.clearTimeout(runtime.legacyCommitTimer);
    runtime.legacyCommitTimer = null;
    if (runtime.bodyFxStartTimer) globalThis.clearTimeout(runtime.bodyFxStartTimer);
    runtime.bodyFxStartTimer = null;
    if (runtime.bodyFxScrollTimer) globalThis.clearTimeout(runtime.bodyFxScrollTimer);
    runtime.bodyFxScrollTimer = null;
    if (runtime.bodyFxScrollActive && runtime.bodyFxClassOwner) {
      try { await runtime.bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling'); } catch {}
    }
    runtime.bodyFxScrollActive = false;
    try { await Risuai.hideContainer(); } catch {}
    await removeRootDrawer();
    await removeBodyEffectGovernor();
    try { if (runtime.hostObserver?.disconnect) await runtime.hostObserver.disconnect(); } catch {}
    runtime.hostObserver = null;
    try { await Risuai.removeRisuScriptHandler('output', outputFallback); } catch {}
    try { await Risuai.removeRisuScriptHandler('display', displayHandler); } catch {}
    try { await Risuai.removeRisuScriptHandler('process', processHandler); } catch {}
    try { await Risuai.removeRisuReplacer('beforeRequest', beforeRequest); } catch {}
    try { await Risuai.removeRisuReplacer('afterRequest', afterRequest); } catch {}
    for (const id of runtime.uiParts) { try { await Risuai.unregisterUIPart(id); } catch {} }
    try { if (runtime.mainStyle) await runtime.mainStyle.remove(); } catch {}
  });
})();
