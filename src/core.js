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
  const ACTIONS = new Set([
    'acquire',
    'transfer',
    'consume',
    'equip',
    'unequip',
    'move',
    'transform',
    'destroy',
    'restore',
    'swap'
  ]);
  const OPS = new Set(['merge', 'remove', 'restore']);
  const RARITY_LABELS = {
    normal: '일반',
    magic: '매직',
    rare: '레어',
    unique: '유니크',
    epic: '에픽',
    legendary: '전설',
    mythical: '신화',
    empyrean: '창천'
  };
  const FIELD_ALIASES = {
    id: 'id',
    name: 'name',
    이름: 'name',
    type: 'type',
    분류: 'type',
    종류: 'type',
    emoji: 'emoji',
    rarity: 'internalrarity',
    internalrarity: 'internalrarity',
    grade: 'internalrarity',
    등급: 'internalrarity',
    display: 'displayrarity',
    displayrarity: 'displayrarity',
    표기: 'displayrarity',
    power: 'power',
    위력: 'power',
    required: 'required',
    요구: 'required',
    durability: 'durability',
    내구: 'durability',
    내구도: 'durability',
    cost: 'cost',
    price: 'cost',
    value: 'cost',
    가치: 'cost',
    possession: 'possession',
    location: 'location',
    count: 'count',
    slot: 'slot',
    pin: 'pin',
    theme: 'theme',
    craft: 'theme',
    affinity: 'affinity',
    affinity2: 'affinity2',
    condition: 'condition',
    effects: 'effects',
    effect: 'effects',
    augments: 'augments',
    augment: 'augments',
    trivia: 'trivia',
    desc: 'trivia',
    description: 'trivia',
    action: 'action',
    op: 'op',
    quantity: 'quantity',
    destination: 'destination',
    reason: 'reason',
    사유: 'reason',
    inputs: 'inputs',
    outputs: 'outputs',
    equip: 'equip',
    unequip: 'unequip'
  };

  const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
  const clean = (value, max = 800) => {
    if (value == null) return '';
    return String(value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  };
  const decodeEntities = (value) =>
    clean(
      String(value ?? '')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&amp;/gi, '&')
    );
  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const fnv1a = (value) => {
    let h = 0x811c9dc5;
    const bytes =
      typeof TextEncoder !== 'undefined'
        ? new TextEncoder().encode(String(value))
        : Array.from(Buffer.from(String(value)));
    for (const b of bytes) {
      h ^= b;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  const randomId = () =>
    globalThis.crypto?.randomUUID?.() || `itemx2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const bytesToB64 = (bytes) => {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  };
  const b64ToBytes = (value) => {
    if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(value, 'base64'));
    const bin = atob(value);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  };
  const encodePayload = (value) =>
    bytesToB64(new TextEncoder().encode(JSON.stringify(value)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  const decodePayload = (value) => {
    try {
      const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
      return JSON.parse(new TextDecoder().decode(b64ToBytes(padded)));
    } catch {
      return null;
    }
  };
  const marker = (payload) => `<!--ITEMX2:${encodePayload(payload)}-->`;

  function isUsableGlyph(value) {
    const glyph = clean(value, 24);
    if (!glyph || glyph === '❔' || /[\s<>\u0000-\u001f]/u.test(glyph) || /[\p{L}\p{N}]/u.test(glyph)) return false;
    try {
      const pictographs = glyph.match(/\p{Extended_Pictographic}/gu) || [];
      const regions = glyph.match(/\p{Regional_Indicator}/gu) || [];
      return (
        (pictographs.length === 1 || (glyph.includes('\u200d') && pictographs.length > 1) || regions.length === 2) &&
        pictographs.length + regions.length > 0
      );
    } catch {
      return /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/u.test(glyph);
    }
  }

  function itemEmojiFallback(item = {}) {
    const text = `${item.itemType || item.type || ''} ${item.name || ''}`.toLowerCase();
    const choices = [
      [/(?:검|도|blade|sword|katana)/, '🗡️'],
      [/(?:방패|갑옷|방어구|shield|armor)/, '🛡️'],
      [/(?:활|석궁|bow|crossbow)/, '🏹'],
      [/(?:지팡이|완드|staff|wand)/, '🪄'],
      [/(?:총|포|gun|rifle|cannon)/, '🔫'],
      [/(?:반지|ring)/, '💍'],
      [/(?:목걸이|부적|necklace|amulet|talisman)/, '📿'],
      [/(?:장화|신발|boots?|shoes?)/, '👢'],
      [/(?:물약|포션|약품|potion|elixir)/, '🧪'],
      [/(?:책|서|두루마리|book|tome|scroll)/, '📖'],
      [/(?:광석|금속|재료|원석|ore|ingot|material|stone)/, '🧱']
    ];
    return choices.find(([pattern]) => pattern.test(text))?.[1] || '📦';
  }

  const resolveItemEmoji = (item) => (isUsableGlyph(item?.emoji) ? clean(item.emoji, 24) : itemEmojiFallback(item));
  const resolveSkillGlyph = (skill = {}) => {
    if (isUsableGlyph(skill.glyph || skill.emoji)) return clean(skill.glyph || skill.emoji, 24);
    const text = `${skill.affinity || ''} ${skill.type || skill.kind || ''} ${skill.name || ''}`.toLowerCase();
    return (
      [
        [/(?:fire|화염|불꽃)/, '🔥'],
        [/(?:ice|빙결|서리)/, '❄️'],
        [/(?:lightning|번개|뇌전)/, '⚡'],
        [/(?:heal|회복|치유)/, '💚'],
        [/(?:shield|방어|보호)/, '🛡️'],
        [/(?:stealth|은신|암영)/, '🌫️'],
        [/(?:slash|검|도법)/, '🗡️']
      ].find(([p]) => p.test(text))?.[1] || '✨'
    );
  };
  const resolveMonsterGlyph = (monster = {}) => {
    if (isUsableGlyph(monster.glyph || monster.emoji)) return clean(monster.glyph || monster.emoji, 24);
    const text = `${monster.kind || monster.type || ''} ${monster.name || ''}`.toLowerCase();
    return (
      [
        [/(?:dragon|용|룡)/, '🐉'],
        [/(?:wolf|늑대)/, '🐺'],
        [/(?:rabbit|토끼)/, '🐇'],
        [/(?:undead|망자|해골|좀비)/, '💀'],
        [/(?:slime|슬라임)/, '🫧'],
        [/(?:golem|골렘)/, '🗿'],
        [/(?:insect|벌레|곤충)/, '🐛']
      ].find(([p]) => p.test(text))?.[1] || '🐾'
    );
  };

  function field(xml, name) {
    const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, 'i');
    const m = String(xml).match(re);
    return m ? decodeEntities(m[1].replace(/<[^>]*>/g, ' ')) : '';
  }

  function attrs(text) {
    const out = {};
    String(text || '').replace(
      /([A-Za-z_\u3131-\uD79D][\w\-\u3131-\uD79D]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
      (_, key, a, b, c) => {
        out[key.toLowerCase()] = decodeEntities(a ?? b ?? c ?? '');
        return '';
      }
    );
    return out;
  }

  function listPairs(value, max = 12) {
    if (!value) return [];
    return String(value)
      .split(';;')
      .slice(0, max)
      .map((part) => {
        const [name, ...rest] = part.split('::');
        return { name: clean(name, 160), desc: clean(rest.join('::'), 800) };
      })
      .filter((one) => one.name);
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
      if (canonical && value != null && clean(value) !== '')
        out[canonical] = clean(value, canonical === 'trivia' ? 1200 : 800);
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
    let possession = POSSESSIONS.has((f.possession || '').toLowerCase())
      ? f.possession.toLowerCase()
      : location === 'unknown'
        ? 'observed'
        : 'owned';
    if (possession === 'removed') location = 'unknown';
    const count = /^\d+$/.test(f.count || '') ? Math.max(0, Number(f.count)) : 1;
    const item = {
      id,
      name,
      itemType: clean(f.type, 160) || '기타',
      emoji: clean(f.emoji, 24),
      rarity,
      displayRarity: clean(f.displayrarity, 80) || RARITY_LABELS[rarity],
      power: clean(f.power, 160),
      required: clean(f.required, 160),
      durability: clean(f.durability, 160),
      cost: clean(f.cost, 160),
      possession,
      location,
      count,
      slot: clean(f.slot, 80) || null,
      pin: /^(1|true)$/i.test(f.pin || ''),
      trivia: clean(f.trivia, 1200),
      theme,
      affinity,
      affinity2,
      condition,
      effects: Array.isArray(raw.effects)
        ? raw.effects
            .slice(0, 12)
            .map((x) => ({ name: clean(x.name, 160), desc: clean(x.desc, 800) }))
            .filter((x) => x.name)
        : listPairs(f.effects),
      augments: Array.isArray(raw.augments)
        ? raw.augments
            .slice(0, 12)
            .map((x) => ({ name: clean(x.name, 160), desc: clean(x.desc, 800) }))
            .filter((x) => x.name)
        : listPairs(f.augments),
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
    const visual = field(body, 'visual') ? body.match(/<visual\b[^>]*>([\s\S]*?)<\/visual\s*>/i)?.[1] || '' : body;
    for (const key of ['theme', 'craft', 'affinity', 'affinity2', 'condition']) {
      const value = field(visual, key);
      if (value) raw[key] = value;
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
    if (action && op) return { error: 'patch_conflicting_operation' };
    if (!action && !op) return { error: 'patch_missing_operation' };
    if (!id && action !== 'transform' && action !== 'swap') return { error: 'patch_no_id' };
    const fields = {};
    const map = {
      name: 'name',
      type: 'itemType',
      emoji: 'emoji',
      internalrarity: 'rarity',
      displayrarity: 'displayRarity',
      power: 'power',
      required: 'required',
      durability: 'durability',
      cost: 'cost',
      trivia: 'trivia',
      theme: 'theme',
      affinity: 'affinity',
      affinity2: 'affinity2',
      condition: 'condition',
      location: 'location',
      possession: 'possession',
      count: 'count',
      slot: 'slot'
    };
    for (const [from, to] of Object.entries(map)) if (f[from] != null) fields[to] = f[from] === '-' ? null : f[from];
    if (Array.isArray(raw.effects)) fields.effects = raw.effects;
    if (Array.isArray(raw.augments)) fields.augments = raw.augments;
    if (op === 'merge' && ['location', 'possession', 'count', 'slot'].some((key) => key in fields))
      return { error: 'patch_merge_state_field' };
    if (op === 'merge' && Object.keys(fields).length === 0) return { error: 'patch_empty_merge' };
    const quantity = f.quantity ? parseQuantity(f.quantity) : null;
    if (f.quantity && quantity == null) return { error: 'patch_bad_quantity' };
    const inputs = parseItemList(f.inputs),
      outputs = parseItemList(f.outputs);
    if (action === 'transform' && (!inputs || !outputs)) return { error: 'patch_transform_shape' };
    if (action === 'swap' && (!ID_RE.test(f.equip || '') || !ID_RE.test(f.unequip || '') || !f.slot))
      return { error: 'patch_swap_shape' };
    return {
      patch: {
        id,
        action,
        op,
        fields,
        quantity,
        destination: clean(f.destination, 160),
        reason: clean(f.reason, 160),
        slot: clean(f.slot, 80) || null,
        inputs,
        outputs,
        equip: f.equip || null,
        unequip: f.unequip || null
      }
    };
  }

  function newRegistry() {
    return { order: [], items: {}, diagnostics: [] };
  }
  function insert(reg, item) {
    if (!reg.items[item.id]) reg.order.push(item.id);
    reg.items[item.id] = item;
  }
  function diagnostic(reg, code, detail = '') {
    reg.diagnostics.push({ code, detail });
    if (reg.diagnostics.length > 50) reg.diagnostics.shift();
  }
  function available(item) {
    if (!item || item.possession === 'removed') return 0;
    const value = item.count == null || String(item.count).trim() === '' ? 1 : Number(item.count);
    return Number.isFinite(value) ? Math.max(0, value) : 1;
  }
  function removeQuantity(item, quantity) {
    const have = available(item),
      take = quantity === 'all' ? have : quantity || 1;
    if (take < 1 || take > have) return false;
    item.count = have - take;
    if (item.count === 0) {
      item.possession = 'removed';
      item.location = 'unknown';
      item.slot = null;
    }
    return true;
  }
  function slotConflict(reg, id, slot) {
    return reg.order
      .map((key) => reg.items[key])
      .find(
        (other) =>
          other &&
          other.id !== id &&
          other.possession !== 'removed' &&
          other.location === 'equipped' &&
          (other.slot === slot ||
            (other.slot === 'two_hands' && ['main_hand', 'off_hand'].includes(slot)) ||
            (slot === 'two_hands' && ['main_hand', 'off_hand'].includes(other.slot)))
      );
  }

  function applyExam(reg, source) {
    const item = clone(source),
      prev = reg.items[item.id];
    const provided = new Set(item._provided || []);
    delete item._provided;
    if (prev) {
      // Omitted appraisal fields are not evidence that established details
      // became empty. Explicit patches remain the way to clear a field.
      const descriptive = {
        itemType: 'type',
        emoji: 'emoji',
        rarity: 'internalrarity',
        displayRarity: 'displayrarity',
        power: 'power',
        required: 'required',
        durability: 'durability',
        cost: 'cost',
        trivia: 'trivia',
        theme: 'theme',
        affinity: 'affinity',
        affinity2: 'affinity2',
        condition: 'condition',
        effects: 'effects',
        augments: 'augments'
      };
      for (const [property, provenance] of Object.entries(descriptive)) {
        if (!provided.has(provenance)) item[property] = clone(prev[property]);
      }
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
    item.emoji = resolveItemEmoji(item);
    if (
      item.location === 'equipped' &&
      (item.possession !== 'owned' || (item.slot && slotConflict(reg, item.id, item.slot)))
    ) {
      diagnostic(reg, 'exam_invalid_equipped', item.id);
      item.possession = 'owned';
      item.location = 'inventory';
      item.slot = null;
    }
    insert(reg, item);
    return item;
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
    if (
      !patch ||
      (patch.action && patch.op) ||
      (patch.action && !ACTIONS.has(patch.action)) ||
      (patch.op && !OPS.has(patch.op)) ||
      (!patch.action && !patch.op)
    ) {
      diagnostic(reg, 'patch_bad_operation', patch?.id || '');
      return null;
    }
    if (patch.action === 'transform') {
      const aggregate = (rows) =>
        (rows || []).reduce((totals, row) => totals.set(row.id, (totals.get(row.id) || 0) + row.quantity), new Map());
      const inputs = aggregate(patch.inputs),
        outputs = aggregate(patch.outputs);
      if (
        !inputs.size ||
        !outputs.size ||
        [...inputs].some(([id, quantity]) => available(reg.items[id]) < quantity) ||
        [...outputs.keys()].some((id) => !reg.items[id])
      ) {
        diagnostic(reg, 'action_invalid_transform');
        return null;
      }
      const affected = new Map(
        [...new Set([...inputs.keys(), ...outputs.keys()])].map((id) => [id, clone(reg.items[id])])
      );
      for (const [id, quantity] of inputs)
        if (!removeQuantity(affected.get(id), quantity)) {
          diagnostic(reg, 'action_invalid_transform');
          return null;
        }
      for (const [id, quantity] of outputs) {
        const item = affected.get(id),
          have = item.possession === 'owned' ? available(item) : 0;
        item.count = have + quantity;
        item.possession = 'owned';
        item.location = 'inventory';
        item.slot = null;
        item.removedReason = null;
      }
      for (const [id, item] of affected) reg.items[id] = item;
      return reg.items[patch.outputs[0]?.id] || null;
    }
    if (patch.action === 'swap') {
      const oldItem = reg.items[patch.unequip],
        newItem = reg.items[patch.equip];
      if (
        !oldItem ||
        !newItem ||
        oldItem.location !== 'equipped' ||
        oldItem.possession !== 'owned' ||
        available(oldItem) < 1 ||
        newItem.possession !== 'owned' ||
        available(newItem) < 1 ||
        (oldItem.slot && oldItem.slot !== patch.slot)
      ) {
        diagnostic(reg, 'action_invalid_swap');
        return null;
      }
      const conflict = slotConflict(reg, newItem.id, patch.slot);
      if (conflict && conflict.id !== oldItem.id) {
        diagnostic(reg, 'action_slot_occupied', conflict.id);
        return null;
      }
      oldItem.location = 'inventory';
      oldItem.slot = null;
      newItem.possession = 'owned';
      newItem.location = 'equipped';
      newItem.slot = patch.slot;
      return newItem;
    }
    const item = patch.id && reg.items[patch.id];
    if (!item) {
      diagnostic(reg, 'patch_unknown_id', patch.id || patch.action);
      return null;
    }
    if (patch.action) {
      if (['transfer', 'consume', 'destroy'].includes(patch.action)) {
        if (patch.quantity == null && available(item) > 1) {
          diagnostic(reg, 'action_quantity_required', item.id);
          return null;
        }
        if (!removeQuantity(item, patch.quantity)) {
          diagnostic(reg, 'action_insufficient_quantity', item.id);
          return null;
        }
        if (item.possession === 'removed') item.removedReason = patch.reason || patch.action;
      } else if (patch.action === 'acquire') {
        if (patch.quantity === 'all') {
          diagnostic(reg, 'action_bad_quantity', item.id);
          return null;
        }
        const have = item.possession === 'owned' ? available(item) : 0;
        item.count = have + (patch.quantity || 1);
        item.possession = 'owned';
        item.location = 'inventory';
        item.removedReason = null;
      } else if (patch.action === 'restore') {
        item.count = patch.quantity === 'all' ? 1 : patch.quantity || Math.max(available(item), 1);
        item.possession = 'owned';
        item.location = 'inventory';
        item.removedReason = null;
      } else if (patch.action === 'equip') {
        const conflict = slotConflict(reg, item.id, patch.slot);
        const failure = !patch.slot ? 'action_slot_required'
          : item.possession !== 'owned' ? 'action_acquire_required'
          : available(item) < 1 ? 'action_insufficient_quantity'
          : conflict ? 'action_slot_occupied' : null;
        if (failure) {
          diagnostic(reg, failure, conflict ? conflict.id : item.id);
          return null;
        }
        item.possession = 'owned';
        item.location = 'equipped';
        item.slot = patch.slot;
      } else if (patch.action === 'unequip') {
        if (item.location !== 'equipped') {
          diagnostic(reg, 'action_not_equipped', item.id);
          return null;
        }
        item.location = 'inventory';
        item.slot = null;
      } else if (patch.action === 'move') {
        const destination = patch.fields.location || patch.destination;
        if (!LOCATIONS.has(destination) || destination === 'equipped' || item.possession === 'removed') {
          diagnostic(reg, 'action_invalid_move', item.id);
          return null;
        }
        item.location = destination;
        item.slot = null;
      }
      return item;
    }
    if (patch.op === 'merge') applyFields(item, patch.fields);
    else if (patch.op === 'remove') {
      item.possession = 'removed';
      item.location = 'unknown';
      item.slot = null;
      item.count = 0;
      item.removedReason = patch.reason;
    } else if (patch.op === 'restore') {
      applyFields(item, patch.fields);
      item.possession ||= 'owned';
      if (item.possession === 'removed') item.possession = 'owned';
      item.location = item.location === 'unknown' ? 'inventory' : item.location;
      item.count = Math.max(1, Number(item.count) || 1);
      item.removedReason = null;
    }
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
    while ((m = xml.exec(text)))
      matches.push({ start: m.index, end: xml.lastIndex, raw: m[0], kind: 'xml', tag: m[1], attrs: m[2], body: m[3] });
    while ((m = bracket.exec(text)))
      matches.push({ start: m.index, end: bracket.lastIndex, raw: m[0], kind: 'bracket', body: m[1] });
    return matches
      .sort((a, b) => a.start - b.start || b.end - a.end)
      .filter((one, index, all) => !all.slice(0, index).some((prev) => one.start < prev.end));
  }

  function stripResidualTransport(text) {
    let out = String(text);
    const opener = /<(?:itemExam|itemPatch|itemx)\b/i.exec(out);
    if (opener) {
      let boundary = out.indexOf('\n\n', opener.index);
      while (boundary >= 0) {
        const suffix = out.slice(boundary + 2).trimStart();
        if (
          !/^<\/?(?:id|name|type|emoji|internalrarity|displayrarity|power|required|durability|cost|possession|location|count|slot|pin|theme|craft|affinity2?|condition|trivia|effects?|effectname|effectdesc|augments?|augmentname|augmentdesc|action|op|quantity|destination|reason|inputs|outputs|equip|unequip)\b/i.test(
            suffix
          )
        )
          break;
        boundary = out.indexOf('\n\n', boundary + 2);
      }
      out = boundary < 0 ? out.slice(0, opener.index) : out.slice(0, opener.index) + out.slice(boundary + 2);
    }
    const bracket = /\[(?:itemx|아이템)\s*:/i.exec(out);
    if (bracket) out = out.slice(0, bracket.index) + out.slice(bracket.index).replace(/^[^\r\n]*/, '');
    out = out.replace(/<\/?(?:itemExam|itemPatch|itemx)\b[^>]*>?/gi, '');
    return out
      .replace(/^\s*```(?:xml)?\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function comparisonView(item) {
    if (!item) return null;
    const keys = [
      'id',
      'name',
      'power',
      'durability',
      'rarity',
      'displayRarity',
      'count',
      'required',
      'cost',
      'status',
      'level',
      'mastery',
      'rank',
      'cooldown',
      'relation',
      'threat'
    ];
    const out = Object.fromEntries(keys.filter((key) => item[key] != null).map((key) => [key, item[key]]));
    if (Array.isArray(item.effects))
      out.effects = item.effects.map((one) => (typeof one === 'string' ? one : { name: one.name }));
    return out;
  }

  function extractResponse(content, baseRegistry = newRegistry(), options = {}) {
    // Planning text is not an instruction source. Fail closed on an unclosed block.
    const original = String(content || '');
    if (/<(?:Thoughts|Thought|think|thinking|DSThink)\b[^>]*>/i.test(original)) {
      const blocks = [];
      let prefix = '__ITEMX_PROTECTED__';
      while (original.includes(prefix)) prefix += '_';
      const masked = original.replace(/<(Thoughts|Thought|think|thinking|DSThink)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
        (block) => { const key = prefix + blocks.length + '__'; blocks.push([key, block]); return key; });
      const result = extractResponse(masked, baseRegistry, options);
      for (const [key, block] of blocks) result.content = result.content.replace(key, () => block);
      return result;
    }
    const text = String(content || '');
    const reg = clone(baseRegistry || newRegistry());
    const transports = collectTransports(text);
    if (!transports.length && !/(?:<\/?(?:itemExam|itemPatch|itemx)\b|\[(?:itemx|아이템)\s*:)/i.test(text))
      return { content: text, registry: reg, events: [], errors: [] };
    const out = [];
    const events = [];
    const errors = [];
    let cursor = 0;
    transports.forEach((part, index) => {
      out.push(text.slice(cursor, part.start));
      const parsed =
        part.kind === 'xml'
          ? parseXml(part.tag, part.attrs, part.body, `${part.raw}:${index}`)
          : parseBracket(part.body, `${part.raw}:${index}`);
      if (options.prepareEvent && (parsed.item || parsed.patch)) {
        const prepared = options.prepareEvent(
          parsed.item ? { kind: 'exam', item: parsed.item } : { kind: 'patch', patch: parsed.patch },
          reg
        );
        if (!prepared) {
          cursor = part.end;
          return;
        }
        if (prepared.kind === 'exam') parsed.item = prepared.item;
        else parsed.patch = prepared.patch;
      }
      if (parsed.item) {
        const previous = comparisonView(reg.items[parsed.item.id]);
        const event = { kind: 'exam', item: parsed.item },
          view = clone(applyEvent(reg, event));
        if (view) {
          events.push(event);
          out.push(marker({ v: VERSION, event, view, previous }));
        } else {
          const error = reg.diagnostics.at(-1)?.code || 'event_apply_failed';
          errors.push(error);
          out.push(marker({ v: VERSION, error }));
        }
      } else if (parsed.patch) {
        const previous = comparisonView(reg.items[parsed.patch.id]);
        const event = { kind: 'patch', patch: parsed.patch },
          view = clone(applyEvent(reg, event));
        if (view) {
          events.push(event);
          out.push(marker({ v: VERSION, event, view, previous }));
        } else {
          const error = reg.diagnostics.at(-1)?.code || 'event_apply_failed';
          errors.push(error);
          out.push(marker({ v: VERSION, error }));
        }
      } else {
        const error = parsed.error || 'invalid_transport';
        errors.push(error);
        out.push(marker({ v: VERSION, error }));
      }
      cursor = part.end;
    });
    out.push(text.slice(cursor));
    return { content: stripResidualTransport(out.join('')), registry: reg, events, errors };
  }

  function messageText(message) {
    return typeof message?.data === 'string'
      ? message.data
      : typeof message?.content === 'string'
        ? message.content
        : '';
  }
  function eventsFromText(text) {
    const events = [];
    String(text || '').replace(MARKER_RE, (_, encoded) => {
      const payload = decodePayload(encoded);
      if (payload?.v === VERSION && payload.event) events.push(payload.event);
      return '';
    });
    return events;
  }
  function rebuild(messages) {
    const reg = newRegistry();
    let transport = '';
    for (const msg of messages || []) {
      const text = messageText(msg);
      for (const event of eventsFromText(text)) {
        applyEvent(reg, event);
        transport += marker({ v: VERSION, event });
      }
    }
    return { schema: VERSION, rev: 1, fingerprint: fnv1a(transport), updatedAt: Date.now(), registry: reg };
  }
  function readSnapshot(chat) {
    try {
      const raw = chat?.scriptstate?.[STATE_KEY];
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed?.schema === VERSION && parsed.registry ? parsed : null;
    } catch {
      return null;
    }
  }
  function writeSnapshot(chat, snapshot) {
    const next = clone(chat || {});
    next.scriptstate = { ...(next.scriptstate || {}) };
    next.scriptstate[CHAT_KEY] ||= randomId();
    const encoded = JSON.stringify(snapshot);
    if (encoded.length <= 524288) next.scriptstate[STATE_KEY] = encoded;
    else delete next.scriptstate[STATE_KEY];
    return next;
  }
  function requestView(text) {
    return String(text || '').replace(MARKER_RE, (_, encoded) => {
      const payload = decodePayload(encoded);
      const item = payload?.event?.kind === 'exam' ? payload.event.item : null;
      return item ? `[${resolveItemEmoji(item)} ${item.name} | id=${item.id}]` : '';
    });
  }
  function anchor(snapshot, max = 12000) {
    const reg = snapshot?.registry || newRegistry();
    const items = reg.order
      .map((id) => reg.items[id])
      .filter(Boolean)
      .sort((a, b) => Number(b.location === 'equipped') - Number(a.location === 'equipped'));
    const lines = ['[ITEMX 2 · CURRENT INVENTORY · authoritative]'];
    for (const item of items) {
      const bits = [
        `id=${item.id}`,
        `name=${item.name}`,
        `type=${item.itemType}`,
        `rarity=${item.rarity}`,
        `possession=${item.possession}`,
        `location=${item.location}`,
        `count=${item.count || 0}`
      ];
      for (const key of ['slot', 'power', 'durability', 'theme', 'affinity', 'affinity2', 'condition'])
        if (item[key]) bits.push(`${key}=${item[key]}`);
      if (item.effects?.length)
        bits.push(
          `effects=${item.effects
            .slice(0, 3)
            .map((one) => `${one.name}::${one.desc}`)
            .join(' ;; ')}`
        );
      const line = `- ${bits.join(' | ')}`;
      if (lines.join('\n').length + line.length > max) break;
      lines.push(line);
    }
    lines.push('Use existing ids. Emit events only for settled item creation or change.');
    return lines.join('\n');
  }

  return {
    VERSION,
    STATE_KEY,
    CHAT_KEY,
    MARKER_RE,
    RARITY_LABELS,
    esc,
    fnv1a,
    marker,
    decodePayload,
    parseXml,
    parseBracket,
    normalizeItem,
    normalizePatch,
    newRegistry,
    applyEvent,
    extractResponse,
    comparisonView,
    eventsFromText,
    rebuild,
    readSnapshot,
    writeSnapshot,
    requestView,
    anchor,
    messageText,
    clone,
    isUsableGlyph,
    itemEmojiFallback,
    resolveItemEmoji,
    resolveSkillGlyph,
    resolveMonsterGlyph
  };
})();

if (typeof globalThis !== 'undefined') globalThis.ITEMXCore = ITEMXCore;
