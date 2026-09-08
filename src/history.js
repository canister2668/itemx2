/* Display-only lifecycle policy. Never deletes replay facts or revives an entity. */
const ITEMXHistory = (() => {
  const KEY = '$__itemx2_history_preferences';
  const LIMITS = [0, 5, 10, 20];
  const terminal = (domain, entity) =>
    !!entity &&
    (domain === 'item'
      ? entity.possession === 'removed'
      : domain === 'skill'
        ? entity.status === 'lost'
        : ['ended', 'escaped', 'defeated', 'dead'].includes(entity.status));
  const consumable = (entity) =>
    /^(?:consumable|elixir|potion|food|ammunition|ammo|소모품|소비품|단약|영약|물약|음식|식량|탄약)(?:$|[\s/·(])/i.test(
      String(entity?.itemType || '').trim()
    );
  function observe(history, domain, before, after, event, at, source) {
    if (!after?.id) return;
    if (!terminal(domain, after)) {
      delete history[after.id];
      return;
    }
    if (terminal(domain, before) && history[after.id]) return;
    const action = event.patch?.action || event.patch?.op || '';
    const legacyConsumed =
      event.kind === 'exam' &&
      /복용되|복용했|복용 완료|소모되|소모 완료|consumed|used up/i.test(String(after.trivia || ''));
    const spent = domain === 'item' && consumable(after) && (action === 'consume' || legacyConsumed);
    Object.defineProperty(history, after.id, {
      value: {
        at,
        source: typeof source === 'function' ? source() : source,
        reason: spent ? 'consume' : action || after.status || 'removed'
      },
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  function preferences(chat) {
    try {
      const raw = chat?.scriptstate?.[KEY];
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        after: LIMITS.includes(value?.after) ? value.after : 10,
        keep: value?.keep && typeof value.keep === 'object' && !Array.isArray(value.keep) ? value.keep : {},
        archived:
          value?.archived && typeof value.archived === 'object' && !Array.isArray(value.archived) ? value.archived : {}
      };
    } catch {
      return { after: 10, keep: {}, archived: {} };
    }
  }
  function completedTurns(chat) {
    const counts = [];
    let count = 0,
      pending = false;
    const messages = chat?.message || [];
    messages.forEach((message, index) => {
      if (!message?.isComment) {
        if (message.role === 'user') pending = true;
        else if (
          pending &&
          ['char', 'assistant'].includes(message.role) &&
          !message.isStreaming &&
          !(chat.isStreaming && index === messages.length - 1) &&
          String(message.data ?? message.content ?? '').trim()
        ) {
          count++;
          pending = false;
        }
      }
      counts.push(count);
    });
    return { counts, total: count };
  }
  function entry(loaded, domain, entity, prefs = preferences(loaded.chat), turns = completedTurns(loaded.chat)) {
    const history = domain === 'item' ? loaded.snapshot?.history : loaded.codexSnapshot?.history?.[domain];
    const evidence = history?.[entity.id];
    const key = `${domain}:${entity.id}`;
    const closed = terminal(domain, entity);
    const age = evidence
      ? Math.max(
          0,
          (evidence.ageOffset || 0) + turns.total - (evidence.at < 0 ? 0 : (turns.counts[evidence.at] ?? turns.total))
        )
      : 0;
    const kept = prefs.keep[key] === true;
    const automatic = domain === 'item' && consumable(entity) && evidence?.reason === 'consume';
    const cycle = evidence?.source || '';
    const archived =
      closed &&
      !kept &&
      !!cycle &&
      (prefs.archived[key] === cycle || (automatic && prefs.after > 0 && age >= prefs.after));
    return {
      domain,
      entity,
      key,
      closed,
      kept,
      archived,
      automatic,
      cycle,
      age,
      remaining: automatic && prefs.after > 0 && evidence ? Math.max(0, prefs.after - age) : null,
      reason: evidence?.reason || entity.status || 'removed'
    };
  }
  function entries(loaded, domain) {
    const reg =
      domain === 'item'
        ? loaded.snapshot?.registry
        : domain === 'skill'
          ? loaded.codexSnapshot?.skills
          : loaded.codexSnapshot?.monsters;
    const prefs = preferences(loaded.chat),
      turns = completedTurns(loaded.chat);
    return (reg?.order || [])
      .map((id) => (reg.items || reg.entries)[id])
      .filter(Boolean)
      .map((entity) => entry(loaded, domain, entity, prefs, turns));
  }
  function currentEntities(loaded, domain) {
    return entries(loaded, domain)
      .filter((row) => !row.closed || (domain === 'monster' && row.cycle && row.age <= 2 && !row.archived))
      .map((row) => row.entity);
  }
  function requestSnapshot(loaded, narrative = '') {
    const text = String(narrative).normalize('NFKC').toLowerCase();
    const items = {},
      order = [];
    for (const row of entries(loaded, 'item')) {
      const item = row.entity;
      if (!row.closed) {
        items[item.id] = item;
        order.push(item.id);
        continue;
      }
      const mentioned = item.name && text.includes(item.name.normalize('NFKC').toLowerCase());
      // Keep a short recent tombstone to prevent a consumed item being recreated.
      // A pin is a UI preference, never a reason for permanent model injection.
      if (!mentioned && (row.age > 2 || !row.cycle)) continue;
      items[item.id] = {
        id: item.id,
        name: item.name,
        itemType: item.itemType,
        rarity: item.rarity,
        possession: 'removed',
        location: 'unknown',
        count: 0
      };
      order.push(item.id);
    }
    return { ...loaded.snapshot, registry: { ...loaded.snapshot.registry, order, items } };
  }
  return {
    KEY,
    LIMITS,
    terminal,
    consumable,
    observe,
    preferences,
    completedTurns,
    entry,
    entries,
    currentEntities,
    requestSnapshot
  };
})();
