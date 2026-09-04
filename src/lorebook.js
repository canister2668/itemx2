const ITEMXLorebook = (() => {
  'use strict';

  const VERSION = 1;
  const STATE_KEY = '$__itemx2_lore_enrichment';
  const PUBLIC_MARKER_RE = /(?:^|\n)\s*\[ITEMX-PUBLIC\]\s*(?:\n|$)/i;
  const MAX_ROWS = 160;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const text = (value, max = 400) =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  const normalize = (value) => {
    const source = String(value ?? '');
    return text(typeof source.normalize === 'function' ? source.normalize('NFKC') : source, 300)
      .toLocaleLowerCase()
      .replace(/[\s·ㆍ・_.\-–—'"“”‘’()[\]{}<>]+/g, '');
  };
  const split = (value, max = 16) => {
    const source = Array.isArray(value) ? value : String(value ?? '').split(/[,;|\n]/);
    return [...new Set(source.map((one) => text(one, 120)).filter(Boolean))].slice(0, max);
  };
  const bool = (value) => value === true || value === 1 || value === '1' || /^true$/i.test(String(value || ''));

  function entryId(entry, index) {
    return text(entry?.id || entry?.uid || entry?.identifier || entry?.comment || entry?.name || `entry-${index}`, 160);
  }

  function entryKeys(entry) {
    return split(entry?.key ?? entry?.keys ?? entry?.keyword ?? entry?.keywords, 32);
  }

  function entryContent(entry) {
    return String(entry?.content ?? entry?.text ?? entry?.value ?? '').slice(0, 12000);
  }

  function eligible(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const mode = text(entry.mode || entry.type || entry.activationMode, 40).toLowerCase();
    if (/^(?:folder|child)$/.test(mode) || bool(entry.useRegex) || bool(entry.regex)) return false;
    if (bool(entry.selective) && text(entry.secondkey || entry.secondaryKey || entry.secondary_key, 160)) return false;
    const chance = entry.activationPercent ?? entry.activation_probability ?? entry.probability;
    if (chance !== undefined && chance !== null && String(chance).trim() !== '') {
      const percent = Number(chance);
      if (!Number.isFinite(percent) || percent !== 100) return false;
    }
    return entryKeys(entry).length > 0 || text(entry.comment || entry.name, 160).length > 0;
  }

  function publicFields(entry) {
    const source = entryContent(entry);
    if (!PUBLIC_MARKER_RE.test(source)) return {};
    const fields = {};
    const aliases = [];
    for (const line of source.split(/\r?\n/).slice(0, 80)) {
      const match = line.match(
        /^\s*(?:[-*]\s*)?(aliases?|별칭|kind|type|종류|portrait|초상화|description|소개|설명)\s*[:：]\s*(.+?)\s*$/i
      );
      if (!match) continue;
      const key = match[1].toLowerCase(),
        value = text(match[2], key === 'description' || key === '소개' || key === '설명' ? 600 : 200);
      if (!value) continue;
      if (/alias|별칭/.test(key)) aliases.push(...split(value, 8));
      else if (/kind|type|종류/.test(key)) fields.kind = value;
      else if (/portrait|초상화/.test(key)) fields.portrait = value;
      else if (/description|소개|설명/.test(key)) fields.description = value;
    }
    if (aliases.length) fields.aliases = [...new Set(aliases)].slice(0, 8);
    return fields;
  }

  function candidate(entry, index) {
    if (!eligible(entry)) return null;
    const keys = entryKeys(entry),
      comment = text(entry.comment || entry.name, 160);
    const labels = [...new Set([...keys, comment].filter(Boolean))];
    return {
      id: entryId(entry, index),
      comment,
      labels,
      norms: [...new Set(labels.map(normalize).filter(Boolean))],
      fields: publicFields(entry)
    };
  }

  function index(entries) {
    const byName = new Map();
    (Array.isArray(entries) ? entries : []).forEach((entry, entryIndex) => {
      const row = candidate(entry, entryIndex);
      if (!row) return;
      for (const name of row.norms) {
        const rows = byName.get(name) || [];
        rows.push(row);
        byName.set(name, rows);
      }
    });
    return byName;
  }

  function identity(monster) {
    return [...new Set([monster?.name, ...(monster?.aliases || [])].map((one) => text(one, 120)).filter(Boolean))];
  }

  function match(monster, lookup) {
    const found = new Map();
    for (const name of identity(monster)) {
      for (const row of lookup.get(normalize(name)) || []) found.set(row.id, row);
    }
    if (found.size !== 1) return { status: found.size ? 'ambiguous' : 'not_found', row: null };
    return { status: 'matched', row: found.values().next().value };
  }

  function safeFields(monster, row) {
    const existing = new Set(identity(monster).map(normalize));
    const aliases = [row.comment, ...(row.fields.aliases || [])]
      .filter((one) => !existing.has(normalize(one)))
      .slice(0, 8);
    const fields = {};
    if (aliases.length) fields.aliases = [...new Set(aliases)];
    if (row.fields.kind) fields.kind = text(row.fields.kind, 120);
    if (row.fields.portrait) fields.portrait = text(row.fields.portrait, 200);
    if (row.fields.description) fields.description = text(row.fields.description, 600);
    return fields;
  }

  function emptyLedger() {
    return { v: VERSION, rows: {}, updatedAt: 0 };
  }

  function read(chat) {
    try {
      const parsed = JSON.parse(chat?.scriptstate?.[STATE_KEY] || 'null');
      if (!parsed || parsed.v !== VERSION || !parsed.rows || typeof parsed.rows !== 'object') return emptyLedger();
      return { v: VERSION, rows: parsed.rows, updatedAt: Number(parsed.updatedAt) || 0 };
    } catch {
      return emptyLedger();
    }
  }

  function scan(snapshot, entries, previous, onlyId = '') {
    const ledger = clone(previous?.v === VERSION ? previous : emptyLedger());
    const lookup = index(entries),
      result = { matched: 0, enriched: 0, removed: 0, unchanged: 0, ambiguous: 0, notFound: 0 };
    const monsters = snapshot?.monsters;
    const liveIds = new Set(monsters?.order || []);
    for (const id of Object.keys(ledger.rows)) {
      if ((!onlyId || onlyId === id) && (!liveIds.has(id) || !monsters?.entries?.[id])) {
        delete ledger.rows[id];
        result.removed += 1;
      }
    }
    for (const id of monsters?.order || []) {
      if (onlyId && id !== onlyId) continue;
      const monster = monsters.entries?.[id];
      if (!monster) continue;
      const found = match(monster, lookup);
      if (found.status === 'ambiguous') {
        result.ambiguous += 1;
        if (ledger.rows[id]) {
          delete ledger.rows[id];
          result.removed += 1;
        }
        continue;
      }
      if (found.status !== 'matched') {
        result.notFound += 1;
        if (ledger.rows[id]) {
          delete ledger.rows[id];
          result.removed += 1;
        }
        continue;
      }
      result.matched += 1;
      const fields = safeFields(monster, found.row);
      if (!Object.keys(fields).length) {
        if (ledger.rows[id]) {
          delete ledger.rows[id];
          result.removed += 1;
        } else result.unchanged += 1;
        continue;
      }
      const next = { fields, source: found.row.id, fingerprint: JSON.stringify(fields), at: Date.now() };
      const before = ledger.rows[id];
      if (before?.source === next.source && before?.fingerprint === next.fingerprint) result.unchanged += 1;
      else {
        ledger.rows[id] = next;
        result.enriched += 1;
      }
    }
    const ids = Object.keys(ledger.rows);
    if (ids.length > MAX_ROWS)
      ids
        .sort((a, b) => (ledger.rows[b]?.at || 0) - (ledger.rows[a]?.at || 0))
        .slice(MAX_ROWS)
        .forEach((id) => delete ledger.rows[id]);
    ledger.updatedAt = Date.now();
    return { ledger, result };
  }

  function apply(snapshot, ledger) {
    const next = clone(snapshot || {}),
      monsters = next?.monsters;
    if (!monsters?.entries) return next;
    for (const id of monsters.order || []) {
      const monster = monsters.entries[id],
        row = ledger?.rows?.[id];
      if (!monster || !row?.fields) continue;
      const fields = row.fields;
      if (Array.isArray(fields.aliases) && fields.aliases.length)
        monster.aliases = [...new Set([...(monster.aliases || []), ...fields.aliases])].slice(0, 12);
      if ((!monster.kind || monster.kind === '미분류') && fields.kind) monster.kind = fields.kind;
      if ((!monster.portrait || monster.portrait === 'NONE') && fields.portrait) monster.portrait = fields.portrait;
      if (!monster.description && fields.description) monster.description = fields.description;
      monster._lore = { source: row.source, at: row.at };
    }
    const ledgerView = Object.entries(ledger?.rows || {}).map(([id, row]) => [
      id,
      row?.fingerprint || '',
      row?.source || ''
    ]);
    next.fingerprint = `${snapshot?.fingerprint || ''}:l${hash(JSON.stringify(ledgerView))}`;
    return next;
  }

  function hash(value) {
    let out = 0x811c9dc5;
    for (const char of String(value || '')) {
      out ^= char.charCodeAt(0);
      out = Math.imul(out, 0x01000193);
    }
    return (out >>> 0).toString(36);
  }

  return { VERSION, STATE_KEY, emptyLedger, read, scan, apply, normalize, eligible, publicFields };
})();
