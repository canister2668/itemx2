/* Portable state, deliberately independent of chat messages and other modules. */
const ITEMXBackup = (() => {
  const FORMAT = 'itemx-codex-backup';
  const MAX_BYTES = 32 * 1024 * 1024;
  const domains = ['item', 'skill', 'monster'];
  const fields = {
    item: 'id name itemType emoji rarity displayRarity power required durability cost possession location count slot pin trivia theme affinity affinity2 condition effects augments',
    skill:
      'id name glyph rank school type status level mastery cost cooldown target affinity description effects growth _inferred _placeholder',
    monster:
      'id name glyph aliases kind threat relation status active portrait weaknesses resistances moves description encounterCount outcome outcomeStatus outcomeEncounter'
  };
  const arrays = new Set('effects augments aliases weaknesses resistances moves _inferred _placeholder'.split(' '));
  const numbers = new Set('count level mastery encounterCount outcomeEncounter'.split(' '));
  const booleans = new Set(['pin', 'active']);
  const nullable = new Set('level mastery slot affinity affinity2 condition'.split(' '));
  const bad = () => {
    throw new Error('ITEMX 백업 형식이 올바르지 않습니다. 원본 백업 파일을 선택해 주세요.');
  };
  const object = (x) => x && typeof x === 'object' && !Array.isArray(x);
  function entity(domain, raw) {
    if (
      !object(raw) ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(raw.id || '') ||
      ['__proto__', 'constructor', 'prototype'].includes(raw.id) ||
      typeof raw.name !== 'string' ||
      !raw.name.trim()
    )
      bad();
    const result = {};
    for (const key of fields[domain].split(' ')) {
      const value = raw[key];
      if (value === undefined) continue;
      if (value === null && nullable.has(key)) {
        result[key] = null;
        continue;
      }
      if (arrays.has(key)) {
        if (!Array.isArray(value) || value.length > 100) bad();
        result[key] = value.map((one) => {
          if (domain === 'item' && ['effects', 'augments'].includes(key)) {
            if (!object(one) || typeof one.name !== 'string' || typeof one.desc !== 'string') bad();
            return { name: one.name, desc: one.desc };
          }
          if (typeof one !== 'string') bad();
          return one;
        });
      } else if (numbers.has(key)) {
        if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) bad();
        result[key] = value;
      } else if (booleans.has(key)) {
        if (typeof value !== 'boolean') bad();
        result[key] = value;
      } else {
        if (typeof value !== 'string' || value.length > 100000) bad();
        result[key] = value;
      }
    }
    const required =
      domain === 'item'
        ? ['count', 'effects', 'augments']
        : domain === 'skill'
          ? ['effects']
          : ['aliases', 'weaknesses', 'resistances', 'moves', 'active'];
    if (required.some((key) => result[key] === undefined)) bad();
    const states =
      domain === 'item'
        ? ['owned', 'observed', 'removed']
        : domain === 'skill'
          ? ['learned', 'equipped', 'sealed', 'lost']
          : ['active', 'ended', 'escaped', 'defeated', 'dead', 'unknown'];
    if (!states.includes(domain === 'item' ? result.possession : result.status)) bad();
    if (domain === 'skill' && !['active', 'passive', 'sealed'].includes(result.type)) bad();
    if (domain === 'monster' && !['hostile', 'sparring', 'neutral', 'allied', 'unknown'].includes(result.relation))
      bad();
    return result;
  }
  function parse(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES)
      throw new Error('백업은 32 MiB 이하의 JSON 파일이어야 합니다.');
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      bad();
    }
    if (raw?.format !== FORMAT || raw.version !== 1 || !object(raw.records) || !ITEMXHistory.LIMITS.includes(raw.after))
      bad();
    const records = {};
    for (const domain of domains) {
      if (!Array.isArray(raw.records[domain])) bad();
      const seen = new Set();
      records[domain] = raw.records[domain].map((row) => {
        if (!object(row) || typeof row.kept !== 'boolean' || typeof row.archived !== 'boolean') bad();
        const one = entity(domain, row.entity);
        if (seen.has(one.id)) bad();
        seen.add(one.id);
        let history = null;
        if (row.history !== null) {
          if (
            !object(row.history) ||
            !Number.isSafeInteger(row.history.age) ||
            row.history.age < 0 ||
            typeof row.history.reason !== 'string'
          )
            bad();
          history = { age: row.history.age, reason: row.history.reason.slice(0, 160) };
        }
        return { entity: one, kept: row.kept, archived: row.archived, history };
      });
    }
    return {
      format: FORMAT,
      version: 1,
      source: typeof raw.source === 'string' ? raw.source.slice(0, 240) : '',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 80) : '',
      after: raw.after,
      records
    };
  }
  function capture(loaded) {
    const records = {};
    for (const domain of domains)
      records[domain] = ITEMXHistory.entries(loaded, domain).map((row) => ({
        entity: entity(domain, row.entity),
        kept: row.kept,
        archived: row.archived,
        history: row.cycle ? { age: row.age, reason: row.reason } : null
      }));
    const value = {
      format: FORMAT,
      version: 1,
      source: loaded.character?.name || '',
      createdAt: new Date().toISOString(),
      after: ITEMXHistory.preferences(loaded.chat).after,
      records
    };
    return parse(JSON.stringify(value));
  }
  function counts(value) {
    return domains.map((domain) => value.records[domain].length);
  }
  function restore(value, chat) {
    const item = {
      schema: ITEMXCore.VERSION,
      rev: 2,
      registry: ITEMXCore.newRegistry(),
      history: {},
      fingerprint: '',
      updatedAt: Date.now()
    };
    const codex = ITEMXCodex.snapshot();
    codex.history = { skill: {}, monster: {} };
    const prefs = { after: value.after, keep: {}, archived: {} };
    const at = (chat.message || []).length - 1;
    for (const domain of domains) {
      const registry = domain === 'item' ? item.registry : domain === 'skill' ? codex.skills : codex.monsters;
      const history = domain === 'item' ? item.history : codex.history[domain];
      for (const row of value.records[domain]) {
        const one = ITEMXCore.clone(row.entity),
          key = `${domain}:${one.id}`;
        registry.order.push(one.id);
        (registry.items || registry.entries)[one.id] = one;
        if (row.history) {
          const source = `import:${domain}:${one.id}:${ITEMXCore.fnv1a(JSON.stringify(row))}`;
          history[one.id] = { at, source, reason: row.history.reason, ageOffset: row.history.age };
          if (row.archived) prefs.archived[key] = source;
        }
        if (row.kept) prefs.keep[key] = true;
      }
    }
    return { item, codex, prefs };
  }
  return { MAX_BYTES, parse, capture, counts, restore };
})();
