const ITEMXSettings = (() => {
  const KEY = 'itemx:settings';
  const schema = Object.freeze({ enabled: true, mainOutput: true, auxOutput: ['off', 'missing', 'always'], rarityMode: ['world', 'itemx'], itemsEnabled: true, skillsEnabled: true, encountersEnabled: true, debugEnabled: false, effectsEnabled: true, fontScale: ['small', 'medium', 'large'], moduleAssetsEnabled: false, lorebookEncounterEnabled: false, skin: ['dark', 'frost', 'hanji'] });
  function normalize(value = {}) { return Object.fromEntries(Object.entries(schema).map(([key, rule]) => [key, Array.isArray(rule) ? rule.includes(value[key]) ? value[key] : rule[0] : typeof value[key] === 'boolean' ? value[key] : rule])); }
  async function read(api) { const raw = await api.getItem(KEY); const value = typeof raw === 'string' ? JSON.parse(raw) : raw; if (value == null) return { v: 1, global: { badgePosition: 'rm' }, characters: {} }; if (value.v !== 1 || !value.global || !value.characters) throw new Error('Invalid ITEMX settings document'); return value; }
  async function update(api, id, patch) { const doc = await read(api); if (id == null) Object.assign(doc.global, patch); else doc.characters[id] = normalize({ ...doc.characters[id], ...patch }); await api.setItem(KEY, JSON.stringify(doc)); return doc; }
  function migrate(entries) {
    const doc = { v: 1, global: { badgePosition: entries.badgePosition || 'rm' }, characters: {} };
    for (const [key, value] of Object.entries(entries)) for (const [field, rule] of Object.entries(schema)) if (key.startsWith(field + ':')) { const id = key.slice(field.length + 1); doc.characters[id] ||= {}; doc.characters[id][field] = Array.isArray(rule) ? value : value === '1'; }
    for (const id of Object.keys(doc.characters)) doc.characters[id] = normalize(doc.characters[id]);
    return doc;
  }
  return { KEY, schema, normalize, read, update, migrate };
})();
