/* Persistence boundary. The replay engines retain their in-memory DTOs; only
 * these three documents cross the host API. Legacy import is an offline tool. */
const ITEMXStorage = (() => {
  const LOG = 'itemx:log', PREFS = 'itemx:prefs', CACHE = 'itemx:cache';
  const DTO = Object.freeze({ manual: '$__itemx2_manual_events', messages: '$__itemx2_message_events', baseline: '$__itemx2_checkpoint', aux: '$__itemx2_aux_processed', lore: '$__itemx2_lore_enrichment', prefs: '$__itemx2_history_preferences', item: '$__itemx2_state', codex: '$__itemx2_codex_state' });
  const clone = value => JSON.parse(JSON.stringify(value));
  const parse = (raw, fallback) => raw == null || raw === '' ? fallback : typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
  function log(chat) {
    const value = parse(chat?.scriptstate?.[LOG], { v: 1, rows: [] });
    if (value?.v !== 1 || !Array.isArray(value.rows) || value.rows.some(row => !row?.id || !row.event?.kind)) throw new Error('ITEMX authoritative log is invalid');
    return value;
  }
  function cache(chat) {
    try { const value = parse(chat?.scriptstate?.[CACHE], {}); return value?.v === 1 ? value : {}; } catch { return {}; }
  }
  function append(rows, entry) {
    const prior = rows.find(row => row.id === entry.id);
    if (prior) { if (JSON.stringify(prior.event) !== JSON.stringify(entry.event)) throw new Error('ITEMX event identity collision'); return; }
    rows.push(clone(entry));
  }
  function capture(chat, { legacy = false } = {}) {
    const state = chat?.scriptstate || {}, document = log(chat), rows = document.rows;
    const checkpoint = parse(state[DTO.baseline], null);
    if (checkpoint && !rows.some(row => row.id === checkpoint.logId)) {
      if (![1, 2].includes(checkpoint.v) || !checkpoint.item?.registry || !checkpoint.codex?.skills) throw new Error('Cannot import unreadable authoritative checkpoint');
      const event = { kind: 'baseline', item: checkpoint.item, codex: checkpoint.codex, boundary: checkpoint.boundary, sealedThroughId: checkpoint.sealedThroughId || '', restored: Boolean(checkpoint.restored), storage: checkpoint.storage || {} };
      // Import is an operation, even when its state equals an earlier import.
      // Hydrated baselines are identified by logId above and are never appended twice.
      append(rows, { id: `baseline:${rows.length}:${ITEMXCore.fnv1a(JSON.stringify(event))}`, domain: 'baseline', event });
    }
    const messageRows = [...(legacy ? checkpoint?.rows || [] : []), ...parse(state[DTO.messages], [])];
    for (const row of messageRows) if (row.payload?.event) {
      const located = (chat.message || []).findIndex(message => ITEMXCore.messageText(message).includes(`@${row.ref}`));
      const parsedIndex = parseInt(row.ref.slice(1).split('_')[0], 36);
      const index = located >= 0 ? located : Number.isFinite(parsedIndex) ? parsedIndex : 0;
      append(rows, { id: `${row.domain}:${row.ref}`, domain: row.domain, ref: row.ref, ...(legacy && (located < 0 || (checkpoint && index <= (checkpoint.sealedThroughId ? (chat.message || []).findIndex(message => message.chatId === checkpoint.sealedThroughId) : checkpoint.boundary))) ? { inactive: true } : {}), messageIndex: index, offset: located >= 0 ? ITEMXCore.messageText(chat.message[located]).indexOf(`@${row.ref}`) : 0, messageId: chat.message?.[index]?.chatId || '', ordinal: parseInt(row.ref.split('_')[1], 36) || 0, code: row.ref.split('_').at(-1), event: row.payload.event, ...(row.payload.review ? { review: row.payload.review } : {}) });
    }
    const manuals = [...(legacy ? checkpoint?.manual || [] : []), ...parse(state[DTO.manual], [])];
    manuals.forEach((row, index) => {
      if (!row.event?.kind) return;
      const identity = row.id || `manual:${index}:${ITEMXCore.fnv1a(JSON.stringify([row.afterIndex, row.at, row.event]))}`;
      append(rows, { id: identity, domain: 'item', afterIndex: row.afterIndex, at: row.at, label: row.label, event: row.event, ...(row.presentation?.review ? { review: row.presentation.review } : {}) });
    });
    // Full transport markers can still be present until the next output commit.
    // Capture their facts too, without changing the user's message text.
    (chat.message || []).forEach((message, index) => {
      const text = ITEMXCore.messageText(message);
      for (const [domain, engine] of [['item', ITEMXCore], ['codex', ITEMXCodex]]) {
        let ordinal = 0;
        for (const match of text.matchAll(new RegExp(engine.MARKER_RE.source, 'g'))) {
          const payload = engine.decodePayload(match[1]);
          if (!payload?.event) continue;
          const at = ordinal++;
          const id = `inline:${domain}:${message.chatId || index}:${at}:${ITEMXCore.fnv1a(match[1])}`;
          append(rows, { id, domain, messageId: message.chatId || '', messageIndex: index, offset: match.index, ordinal: at, code: ITEMXCore.fnv1a(match[1]), event: payload.event });
        }
      }
    });
    return document;
  }
  function replay(chat) {
    const document = capture(chat), baselineIndex = document.rows.findLastIndex(row => row.domain === 'baseline');
    const baseline = document.rows[baselineIndex]?.event;
    const item = baseline ? clone(baseline.item) : { registry: ITEMXCore.newRegistry(), history: {} };
    const codex = baseline ? clone(baseline.codex) : ITEMXCodex.snapshot();
    item.history ||= {}; codex.history ||= { skill: {}, monster: {} };
    const payloads = new Map(), manuals = [], occurrences = new Map();
    const rows = document.rows.slice(baselineIndex + 1).map((row, order) => ({ ...row, order })).sort((a, b) =>
      (a.afterIndex ?? a.messageIndex ?? 0) - (b.afterIndex ?? b.messageIndex ?? 0) || Number('afterIndex' in a) - Number('afterIndex' in b) || (a.offset ?? a.ordinal ?? a.order) - (b.offset ?? b.ordinal ?? b.order));
    for (const row of rows) {
      if (row.inactive) continue;
      // A compact ref aliases a previously captured full marker, not a second event.
      if (row.id.startsWith('inline:') && rows.some(other => !other.inactive && other.ref && other.domain === row.domain && other.code === row.code && (other.messageId || other.messageIndex) === (row.messageId || row.messageIndex))) continue;
      const identity = row.id;
      const event = row.event, domain = row.domain === 'item' ? 'item' : event.domain;
      const registry = domain === 'item' ? item.registry.items : ITEMXCodex.storeFor(codex, domain).entries;
      const id = event.item?.id || event.entity?.id || event.patch?.id;
      const ids = [...new Set([id, event.patch?.equip, event.patch?.unequip, ...(event.patch?.inputs || []).map(x => x.id), ...(event.patch?.outputs || []).map(x => x.id)].filter(Boolean))];
      const prior = new Map(ids.map(key => [key, registry[key] ? clone(registry[key]) : null]));
      const engine = domain === 'item' ? ITEMXCore : ITEMXCodex;
      const view = engine.applyEvent(domain === 'item' ? item.registry : codex, event);
      const at = row.afterIndex ?? row.messageIndex ?? 0, occurrenceKey = `${row.domain}:${at}`, occurrence = occurrences.get(occurrenceKey) || 0;
      occurrences.set(occurrenceKey, occurrence + 1);
      if (view != null) for (const key of ids) ITEMXHistory.observe(domain === 'item' ? item.history : codex.history[domain], domain, prior.get(key), registry[key], event, at, () => `${row.messageId || chat.message?.[at]?.chatId || at}:${occurrence}:${ITEMXCore.fnv1a(JSON.stringify(event))}`);
      const payload = { v: engine.VERSION, event: clone(event), view: view == null ? null : clone(view), previous: domain === 'item' ? ITEMXCore.comparisonView(prior.get(id)) : prior.get(id) || null, ...(row.review ? { review: row.review } : {}) };
      payloads.set(identity, payload);
      if (row.ref) payloads.set(`${row.domain}:${row.ref}`, payload);
      if ('afterIndex' in row) manuals.push({ id: row.id, afterIndex: row.afterIndex, at: row.at, label: row.label, event: row.event, presentation: { previous: payload.previous, view: ITEMXCore.comparisonView(payload.view), review: row.review } });
    }
    return { item: { ...item, schema: ITEMXCore.VERSION, rev: 2, fingerprint: ITEMXCore.fnv1a(JSON.stringify(document)), updatedAt: 0 }, codex: { ...codex, updatedAt: 0 }, payloads, manuals };
  }

  function hydrate(chat) {
    if (!chat || !chat.scriptstate?.[LOG]) return chat;
    const next = clone(chat), state = next.scriptstate, document = log(next), derived = cache(next);
    const baselineIndex = document.rows.findLastIndex(row => row.domain === 'baseline');
    const baseline = document.rows[baselineIndex]?.event;
    const rows = document.rows.slice(baselineIndex + 1);
    const boundary = baseline?.sealedThroughId ? (next.message || []).findIndex(message => message.chatId === baseline.sealedThroughId) : baseline?.boundary ?? -1;
    const projected = replay(chat);
    state[DTO.messages] = JSON.stringify(rows.filter(row => row.ref).map(row => ({ ref: row.ref, domain: row.domain, payload: projected.payloads.get(`${row.domain}:${row.ref}`) })).filter(row => row.payload));
    state[DTO.manual] = JSON.stringify(projected.manuals);
    if (baseline) state[DTO.baseline] = JSON.stringify({ v: 2, ...baseline, logId: document.rows[baselineIndex].id, boundary, rows: [], manual: [] });
    else delete state[DTO.baseline];
    state[DTO.prefs] = JSON.stringify(parse(state[PREFS], { after: 10, keep: {}, archived: {} }));
    for (const field of ['aux', 'lore', 'item', 'codex']) if (derived[field] !== undefined) state[DTO[field]] = JSON.stringify(derived[field]);
    return next;
  }
  function persist(chat, options = {}) {
    const next = clone(chat), state = next.scriptstate ||= {}, document = capture(next, options), prior = cache(next);
    const prefs = parse(state[DTO.prefs], parse(state[PREFS], { after: 10, keep: {}, archived: {} }));
    const derived = { v: 1, ...prior };
    for (const field of ['aux', 'lore', 'item', 'codex']) if (state[DTO[field]] !== undefined) derived[field] = parse(state[DTO[field]], null);
    for (const key of Object.values(DTO)) delete state[key];
    state[LOG] = JSON.stringify(document); state[PREFS] = JSON.stringify(prefs); state[CACHE] = JSON.stringify(derived);
    return next;
  }
  return { LOG, PREFS, CACHE, DTO, log, cache, capture, replay, hydrate, persist };
})();
