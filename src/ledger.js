/* ITEMX ledger owner. Concatenated inside the runtime closure. */
  function refreshLatest(chat, lookup = buildMessageEventLookup(chat)) {
    loadMessageEventLedger(chat, lookup);
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    let latest = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      const text = messageData(messages[i]);
      if (messageEvents(text, 'item', lookup).length || messageEvents(text, 'codex', lookup).length) {
        latest = text;
        break;
      }
    }

    const persisted = markerCodes(latest);
    for (const marker of workQueue.recent('uncommitted-markers', 12000) || []) persisted.add(marker);
    pipelineState.latestMarkers = persisted;
  }

  function manualLedger(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_MANUAL_KEY];
      const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // Manual events are authoritative source facts. Never truncate them by
      // count: doing so can discard an old exam while retaining later patches.
      return Array.isArray(rows)
        ? rows.filter((row) => row && Number.isInteger(row.afterIndex) && row.event?.kind)
        : [];
    } catch {
      return [];
    }
  }

  function messageEventLedger(chat) {
    try {
      const raw = chat?.scriptstate?.[ITEMX_MESSAGE_EVENT_KEY];
      const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // Every compact ref in a surviving message needs its event payload for
      // deterministic replay, including edits or rerolls of old messages.
      return Array.isArray(rows)
        ? rows.filter(
            (row) =>
              row &&
              /^[A-Za-z0-9_-]{1,80}$/.test(row.ref || '') &&
              ['item', 'codex'].includes(row.domain) &&
              row.payload?.event
          )
        : [];
    } catch {
      return [];
    }
  }

  function checkpointShapeValid(value) {
    return Boolean(
      value &&
      Number.isInteger(value.boundary) &&
      value.item?.registry &&
      value.codex?.skills &&
      Array.isArray(value.rows) &&
      Array.isArray(value.manual)
    );
  }

  function readCheckpointRecord(chat) {
    const raw = chat?.scriptstate?.[ITEMX_CHECKPOINT_KEY];
    if (!raw) return { status: 'absent', value: null, reason: '' };
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!checkpointShapeValid(value)) throw new Error('Invalid imported baseline event');
    return { status: 'ok', value, reason: '' };
  }

  function readReplayBaseline(chat) {
    return readCheckpointRecord(chat).value;
  }

  function assertLogReadable(chat) {
    ITEMXStorage.log(chat); // Malformed authoritative data must be surfaced, never overwritten.
    return false;
  }

  const FROZEN_MESSAGE =
    ITEMXText("ledger.030");

  function prefixMarkerFingerprint(chat, boundary) {
    let source = `b:${boundary}`;
    for (let index = 0; index <= boundary; index += 1) {
      const markers = messageData(chat?.message?.[index]).match(
        /<!--(?:ITEMX2|CODEX2)(?::[A-Za-z0-9_-]+|@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?)-->/g
      );
      if (markers) source += `|${index}:${markers.join('')}`;
    }
    return ITEMXCore.fnv1a(source);
  }

  function checkpointStatus(chat) {
    const checkpoint = readReplayBaseline(chat);
    if (checkpoint?.v === ITEMX_CHECKPOINT_VERSION) {
      const messages = Array.isArray(chat?.message) ? chat.message : [];
      let boundary = checkpoint.boundary;
      if (checkpoint.sealedThroughId) {
        const located = messages.findIndex((message) => message?.chatId === checkpoint.sealedThroughId);
        boundary = located >= 0 ? located : -1;
      } else boundary = Math.min(boundary, messages.length - 1);
      return { checkpoint: { ...checkpoint, boundary }, valid: true };
    }
    const valid = Boolean(
      checkpoint &&
      checkpoint.boundary < (chat?.message || []).length &&
      checkpoint.prefix === prefixMarkerFingerprint(chat, checkpoint.boundary)
    );
    return { checkpoint, valid };
  }

  function buildMessageEventLookup(chat) {
    const archived = readReplayBaseline(chat)?.rows || [];
    const rows = [...archived, ...messageEventLedger(chat)],
      itemByRef = new Map(),
      codexByRef = new Map(),
      payloads = new Map();
    for (const row of rows) {
      if (row.domain === 'item') itemByRef.set(row.ref, row.payload);
      else if (row.domain === 'codex') codexByRef.set(row.ref, row.payload);
      payloads.set(`${row.domain}:${row.ref}`, row.payload);
    }
    return { rows, itemByRef, codexByRef, payloads };
  }

  function replaySourceFingerprint(chat) {
    const state = chat?.scriptstate || {};
    const stable = (value) => (typeof value === 'string' ? value : JSON.stringify(value ?? null));
    const status = checkpointStatus(chat),
      start = status.valid ? status.checkpoint.boundary + 1 : 0;
    let source = `${status.valid ? `${status.checkpoint.boundary}:${status.checkpoint.prefix}` : stable(state[ITEMX_CHECKPOINT_KEY])}|${stable(state[ITEMX_MANUAL_KEY])}|${stable(state[ITEMX_MESSAGE_EVENT_KEY])}`;
    const markerRe = /<!--(?:ITEMX2|CODEX2)(?::[A-Za-z0-9_-]+|@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?)-->/g;
    for (let index = start; index < (chat?.message || []).length; index += 1) {
      const markers = messageData(chat.message[index]).match(markerRe);
      if (markers) source += `|${index}:${markers.join('')}`;
    }
    return ITEMXCore.fnv1a(source);
  }

  function loadMessageEventLedger(chat, lookup = buildMessageEventLookup(chat)) {
    pipelineState.eventPayloads = new Map(lookup.payloads);
    presentationState.presentationRecords = null;
  }

  const storageBytes = (value) => {
    const source = String(value ?? '');
    return typeof TextEncoder === 'function' ? new TextEncoder().encode(source).length : source.length;
  };

  function boundedObjectTail(value, count, bytes) {
    const entries = Object.entries(value || {}).slice(-count);
    while (entries.length && storageBytes(JSON.stringify(Object.fromEntries(entries))) > bytes) entries.shift();
    return Object.fromEntries(entries);
  }

  function itemxStorageFootprint(chat) {
    const state = ITEMXStorage.persist(chat).scriptstate || {};
    let stateBytes = 0,
      markerBytes = 0,
      markerCount = 0;
    for (const key of CHAT_DATA_KEYS || []) {
      if (!Object.prototype.hasOwnProperty.call(state, key)) continue;
      stateBytes += storageBytes(typeof state[key] === 'string' ? state[key] : JSON.stringify(state[key]));
    }
    for (const message of chat?.message || []) {
      const matches = messageData(message).match(
        /<!--(?:ITEMX2|CODEX2)(?::[A-Za-z0-9_-]+|@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?)-->/g
      );
      for (const marker of matches || []) {
        markerCount += 1;
        markerBytes += storageBytes(marker);
      }
    }
    return { stateBytes, markerBytes, markerCount, totalBytes: stateBytes + markerBytes };
  }

  function createCheckpoint(itemSource, codexSource, boundary, sealedThroughId, previouslyPruned = false) {
    // A checkpoint replaces the authoritative event prefix. Never discard state
    // to meet a storage budget: the removed events cannot reconstruct it later.
    const item = ITEMXCore.clone(itemSource),
      codex = ITEMXCodex.clone(codexSource);
    const counts = {
      item: item.registry.order.length,
      skill: codex.skills.order.length,
      monster: codex.monsters.order.length
    };
    const checkpoint = {
      v: ITEMX_CHECKPOINT_VERSION,
      boundary,
      sealedThroughId: sealedThroughId || '',
      item,
      codex,
      rows: [],
      manual: [],
      storage: { originalCounts: counts, storedCounts: counts, pruned: previouslyPruned }
    };
    return { checkpoint, encoded: JSON.stringify(checkpoint) };
  }

  function embeddedViewCode(payload, domain) {
    const view = payload?.view;
    if (!view) return '';
    const codexEvent = payload?.event || {};
    const codexView =
      codexEvent.domain === 'skill'
        ? {
            i: view.id,
            n: view.name,
            g: view.glyph,
            r: view.rank,
            h: view.school,
            t: view.type,
            s: view.status,
            l: view.level,
            m: view.mastery,
            c: view.cost,
            o: view.cooldown,
            a: view.affinity,
            x: view.target,
            w: view.growth,
            z: view.description,
            f: (view.effects || []).slice(0, 2),
            j: view._inferred
          }
        : {
            i: view.id,
            n: view.name,
            g: view.glyph,
            k: view.kind,
            t: view.threat,
            r: view.relation,
            s: view.status,
            a: view.active,
            o: view.outcome,
            c: view.encounterCount,
            f: (view.moves || []).slice(0, 3)
          };
    const previous = payload?.previous
      ? { m: payload.previous.mastery, s: payload.previous.status, v: ITEMXCore.comparisonView(payload.previous) }
      : undefined;
    const envelope =
      domain === 'codex'
        ? {
            v: ITEMXCodex.VERSION,
            d: codexEvent.domain || '',
            k: codexEvent.kind,
            a: codexEvent.patch?.action,
            o: codexEvent.patch?.op,
            q: Object.keys(codexEvent.patch?.fields || {}),
            e: codexView,
            r: payload.review,
            p: previous
          }
        : {
            v: ITEMXCore.VERSION,
            p: ITEMXCore.comparisonView(payload.previous),
            r: payload.review,
            i: {
              i: view.id,
              n: view.name,
              t: view.itemType,
              e: view.emoji,
              r: view.rarity,
              d: view.displayRarity,
              p: view.power,
              q: view.required,
              u: view.durability,
              c: view.cost,
              o: view.possession,
              l: view.location,
              k: view.count,
              s: view.slot,
              h: view.theme,
              a: view.affinity,
              b: view.affinity2,
              x: view.condition,
              f: (view.effects || []).map((row) => [row.name, row.desc]),
              g: (view.augments || []).map((row) => [row.name, row.desc]),
              z: view.trivia
            }
          };
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
    if (payload?.view)
      return domain === 'codex'
        ? { v: payload.v, event: { domain: payload.domain || '' }, view: payload.view }
        : { v: payload.v, view: payload.view };
    if (domain === 'codex' && payload?.e) {
      const item = payload.e,
        skill = payload.d === 'skill';
      const view = skill
        ? {
            id: item.i,
            name: item.n,
            glyph: item.g,
            rank: item.r,
            school: item.h,
            type: item.t,
            status: item.s,
            level: item.l,
            mastery: item.m,
            cost: item.c,
            cooldown: item.o,
            affinity: item.a,
            target: item.x,
            growth: item.w,
            description: item.z,
            effects: item.f || [],
            _inferred: item.j
          }
        : {
            id: item.i,
            name: item.n,
            glyph: item.g,
            kind: item.k,
            threat: item.t,
            relation: item.r,
            status: item.s,
            active: item.a,
            outcome: item.o,
            encounterCount: item.c,
            moves: item.f || []
          };
      const event = { domain: payload.d || '', kind: payload.k || 'exam' };
      if (event.kind === 'patch')
        event.patch = {
          id: item.i,
          action: payload.a || null,
          op: payload.o || null,
          fields: Object.fromEntries((payload.q || []).map((key) => [key, true]))
        };
      return {
        v: payload.v,
        event,
        view,
        review: payload.r,
        previous: payload.p?.v || (payload.p ? { mastery: payload.p.m, status: payload.p.s } : null)
      };
    }
    if (domain !== 'item' || !payload?.i) return null;
    const item = payload.i;
    return {
      v: payload.v,
      previous: payload.p,
      review: payload.r,
      view: {
        id: item.i,
        name: item.n,
        itemType: item.t,
        emoji: item.e,
        rarity: item.r,
        displayRarity: item.d,
        power: item.p,
        required: item.q,
        durability: item.u,
        cost: item.c,
        possession: item.o,
        location: item.l,
        count: item.k,
        slot: item.s,
        theme: item.h,
        affinity: item.a,
        affinity2: item.b,
        condition: item.x,
        effects: (item.f || []).map((row) => ({ name: row[0], desc: row[1] })),
        augments: (item.g || []).map((row) => ({ name: row[0], desc: row[1] })),
        trivia: item.z
      }
    };
  }

  function itemMarkerPayload(marker) {
    const full = String(marker || '').match(/^<!--ITEMX2:([A-Za-z0-9_-]+)-->$/);
    if (full) return ITEMXCore.decodePayload(full[1]);
    const ref = String(marker || '').match(/^<!--ITEMX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->$/);
    if (!ref) return null;
    return pipelineState.eventPayloads.get(`item:${ref[1]}`) || inlineViewPayload(ref[2], 'item') || null;
  }

  function itemPayloadId(payload) {
    return payload?.view?.id || payload?.event?.item?.id || payload?.event?.patch?.id || '';
  }

  function coalesceAdjacentItemMarkers(content) {
    const source = String(content || '');
    const re = /<!--ITEMX2:[A-Za-z0-9_-]+-->|<!--ITEMX2@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?-->/g;
    const rows = [];
    let match;
    while ((match = re.exec(source)))
      rows.push({ start: match.index, end: re.lastIndex, raw: match[0], payload: itemMarkerPayload(match[0]) });
    if (rows.length < 2) return source;
    const hidden = new Set();
    for (let index = 0; index < rows.length - 1; index += 1) {
      const current = rows[index],
        next = rows[index + 1];
      const id = itemPayloadId(current.payload),
        nextId = itemPayloadId(next.payload);
      if (id && id === nextId && next.payload?.view && !source.slice(current.end, next.start).trim()) hidden.add(index);
    }
    if (!hidden.size) return source;
    let output = '',
      cursor = 0;
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
        if (source.match(ITEMX_REF_RE) || source.match(ITEMX_CODEX_REF_RE)) {
          latestIndex = index;
          break;
        }
      }
    }
    let next = null,
      changed = false;
    for (let index = 0; index < messages.length; index += 1) {
      const original = messageData(messages[index]);
      const keepInline = index === latestIndex;
      let source = original.replace(ITEMX_REF_RE, (raw, ref, inline) =>
        keepInline
          ? inline
            ? raw
            : compactRefMarker('ITEMX2', ref, byKey.get(`item:${ref}`), 'item')
          : bareRefMarker('ITEMX2', ref)
      );
      source = source.replace(ITEMX_CODEX_REF_RE, (raw, ref, inline) =>
        keepInline
          ? inline
            ? raw
            : compactRefMarker('CODEX2', ref, byKey.get(`codex:${ref}`), 'codex')
          : bareRefMarker('CODEX2', ref)
      );
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
    if (chat?.scriptstate?.[ITEMXStorage.LOG]) return ITEMXStorage.replay(chat).codex;
    const state = options.base ? ITEMXCodex.clone(options.base) : ITEMXCodex.snapshot();
    state.history ||= { skill: {}, monster: {} };
    const messages = chat?.message || [],
      start = Math.max(0, options.start || 0),
      end = Math.min(messages.length - 1, options.end ?? messages.length - 1);
    let transport = options.transport || '';
    for (let index = start; index <= end; index += 1) {
      const narrative = messageData(messages[index]);
      let occurrence = 0;
      for (const event of messageEvents(narrative, 'codex', lookup)) {
        // Events are reconciled exactly once when committed. Replay is a pure
        // fold over stored facts, never a second interpretation of prose.
        const domain = event.domain,
          id = event.entity?.id || event.patch?.id;
        const registry = ITEMXCodex.storeFor(state, domain);
        const before = registry.entries[id] ? { ...registry.entries[id] } : null;
        const applied = ITEMXCodex.applyEvent(state, event);
        if (applied != null)
          ITEMXHistory.observe(
            state.history[domain],
            domain,
            before,
            registry.entries[id],
            event,
            index,
            () => `${messages[index]?.chatId || index}:${occurrence}:${ITEMXCore.fnv1a(JSON.stringify(event))}`
          );
        occurrence++;
        transport += JSON.stringify(event);
      }
    }
    state.fingerprint = ITEMXCore.fnv1a(transport);
    state.updatedAt = Date.now();
    return state;
  }

  function compactMessageTransports(chat, index) {
    const next = ITEMXCore.clone(chat),
      message = next.message?.[index];
    if (!message) return { chat: next, changed: false };
    let source = messageData(message),
      ordinal = 0,
      changed = false;
    const rows = messageEventLedger(next),
      byKey = new Map(rows.map((row) => [`${row.domain}:${row.ref}`, row]));
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
      text.replace(ITEMX_REF_RE, (_, ref) => {
        used.add(`item:${ref}`);
        return '';
      });
      text.replace(ITEMX_CODEX_REF_RE, (_, ref) => {
        used.add(`codex:${ref}`);
        return '';
      });
    }
    // Remove only orphaned rows. Count/byte truncation corrupts replay by
    // leaving refs in messages whose authoritative events no longer exist.
    const kept = [...byKey.entries()].filter(([key]) => used.has(key)).map(([, row]) => row);
    next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_MESSAGE_EVENT_KEY]: JSON.stringify(kept) };
    const reconciled = reconcileStoredRefViews(next, index).chat;
    return { chat: refreshReplayCache(reconciled), changed: true };
  }

  function refreshReplayCache(chat, options = {}) {
    // Cache maintenance cannot truncate the log, markers, or manual history.
    return ITEMXStorage.hydrate(ITEMXStorage.persist(chat));
  }

  function rebuildWithManual(chat, lookup = buildMessageEventLookup(chat), options = {}) {
    if (chat?.scriptstate?.[ITEMXStorage.LOG]) return ITEMXStorage.replay(chat).item;
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    const start = Math.max(0, options.start || 0),
      end = Math.min(messages.length - 1, options.end ?? messages.length - 1);
    const ledger = options.manual || [
        ...(start === 0 ? readReplayBaseline(chat)?.manual || [] : []),
        ...manualLedger(chat)
      ],
      manualByIndex = new Map(),
      manualTail = [],
      reg = options.registry ? ITEMXCore.clone(options.registry) : ITEMXCore.newRegistry();
    for (const row of ledger) {
      if (row.afterIndex < 0 || row.afterIndex >= messages.length) {
        if (end === messages.length - 1) manualTail.push(row);
      } else if (row.afterIndex < start || row.afterIndex > end) continue;
      else {
        const rows = manualByIndex.get(row.afterIndex) || [];
        rows.push(row);
        manualByIndex.set(row.afterIndex, rows);
      }
    }
    const history = ITEMXCore.clone(options.history || {});
    const occurrences = new Map();
    let transport = options.transport || '';
    const apply = (event, at) => {
      const occurrence = occurrences.get(at) || 0;
      occurrences.set(at, occurrence + 1);
      const patch = event.patch || {};
      const ids = [
        ...new Set(
          [
            event.item?.id,
            patch.id,
            patch.equip,
            patch.unequip,
            ...(patch.inputs || []).map((x) => x.id),
            ...(patch.outputs || []).map((x) => x.id)
          ].filter(Boolean)
        )
      ];
      const prior = new Map(ids.map((id) => [id, reg.items[id] ? { ...reg.items[id] } : null]));
      const applied = ITEMXCore.applyEvent(reg, event);
      if (applied != null)
        for (const id of ids)
          ITEMXHistory.observe(
            history,
            'item',
            prior.get(id),
            reg.items[id],
            event,
            at,
            () => `${messages[at]?.chatId || at}:${occurrence}:${ITEMXCore.fnv1a(JSON.stringify(event))}`
          );
      transport += ITEMXCore.marker({ v: ITEMXCore.VERSION, event });
    };
    for (let index = start; index <= end; index += 1) {
      for (const event of messageEvents(messageData(messages[index]), 'item', lookup)) apply(event, index);
      for (const row of manualByIndex.get(index) || []) apply(row.event, index);
    }
    for (const row of manualTail) apply(row.event, Math.min(row.afterIndex, messages.length - 1));
    return {
      history,
      schema: ITEMXCore.VERSION,
      rev: 2,
      fingerprint: ITEMXCore.fnv1a(transport),
      updatedAt: Date.now(),
      registry: reg
    };
  }

  async function rebuildCurrent({ upgradeDisplayRefs = false } = {}) {
    const ctx = await context();
    if (!ctx) return null;
    return (async () => {
      let latestChat = await readChat(ctx.characterIndex, ctx.chatIndex);
      if (!latestChat) return null;
      if (
        upgradeDisplayRefs &&
        !assertLogReadable(latestChat) &&
        !latestChat.isStreaming &&
        !(latestChat.message || []).some((message) => message?.isStreaming)
      ) {
        const reconciled = reconcileStoredRefViews(latestChat);
        if (reconciled.changed && pipelineState.activeContextKey === ctx.key) {
          await saveChat(ctx.characterIndex, ctx.chatIndex, reconciled.chat);
          latestChat = reconciled.chat;
          debugRecord('display refs', 'kept one self-contained view and compacted older refs');
        }
      }
      assertLogReadable(latestChat);
      const lookup = buildMessageEventLookup(latestChat);
      const checkpoint = checkpointStatus(latestChat);
      const usableCheckpoint =
        checkpoint.valid && checkpoint.checkpoint.item.history && checkpoint.checkpoint.codex.history;
      const manual = usableCheckpoint
        ? manualLedger(latestChat)
        : [...(checkpoint.checkpoint?.manual || []), ...manualLedger(latestChat)];
      const replay = usableCheckpoint
        ? {
            start: checkpoint.checkpoint.boundary + 1,
            registry: checkpoint.checkpoint.item.registry,
            history: checkpoint.checkpoint.item.history,
            base: checkpoint.checkpoint.codex
          }
        : {};
      const snapshot = rebuildWithManual(latestChat, lookup, { ...replay, manual });
      const codexBase = rebuildCodexWithLedger(latestChat, lookup, replay);
      const lorebookSourceFingerprint = encounterRegistryFingerprint(codexBase);
      const codexSnapshot = ITEMXLorebook.apply(codexBase, ITEMXLorebook.read(latestChat));
      const settings = await outputSettings(ctx.character);
      refreshLatest(latestChat, lookup);
      // Normal rebuilds are deliberately read-only. Writing an entire chat
      // snapshot here can race another module's output hook and restore an
      // older assistant message over its freshly appended display markers.
      const storagePruned = checkpoint.checkpoint?.storage?.pruned === true;
      const storageWarning = itemxStorageFootprint(latestChat).totalBytes >= ITEMX_STORAGE_WARNING_BYTES;
      const storageStatus =
        [
          storageWarning ? ITEMXText("ledger.029") : '',
          storagePruned ? ITEMXText("ledger.028") : ''
        ]
          .filter(Boolean)
          .join(' · ') || ITEMXText("ledger.027");
      uiState.status = ITEMXText("ledger.026", storageStatus, snapshot.registry.order.length, codexSnapshot.skills.order.length, codexSnapshot.monsters.order.length);
      const loaded = {
        ...ctx,
        chat: latestChat,
        snapshot,
        codexSnapshot,
        lorebookSourceFingerprint,
        replayFingerprint: replaySourceFingerprint(latestChat),
        ...settings
      };
      prepareInlinePortraits(loaded, codexSnapshot, settings);
      pipelineState.cachedLoaded = loaded;
      workQueue.remember('loaded-generation', pipelineState.generation);
      return loaded;
    })();
  }

  const CHAT_DATA_KEYS = [
    ITEMXStorage.LOG, ITEMXStorage.PREFS, ITEMXStorage.CACHE,
    ITEMXCore.STATE_KEY,
    ITEMXCore.CHAT_KEY,
    ITEMXCodex.STATE_KEY,
    ITEMX_MANUAL_KEY,
    ITEMX_MESSAGE_EVENT_KEY,
    ITEMX_CHECKPOINT_KEY,
    ITEMX_AUX_KEY,
    ITEMX_LORE_KEY,
    ITEMXHistory.KEY
  ];

  function backupState(ctx) {
    const chat = ITEMXStorage.hydrate(ctx.chat),
      lookup = buildMessageEventLookup(chat),
      status = checkpointStatus(chat);
    const usable = status.valid && status.checkpoint.item.history && status.checkpoint.codex.history;
    const replay = usable
      ? {
          start: status.checkpoint.boundary + 1,
          registry: status.checkpoint.item.registry,
          history: status.checkpoint.item.history,
          base: status.checkpoint.codex
        }
      : {};
    const manual = usable ? manualLedger(chat) : [...(status.checkpoint?.manual || []), ...manualLedger(chat)];
    return {
      ...ctx,
      snapshot: rebuildWithManual(chat, lookup, { ...replay, manual }),
      codexSnapshot: ITEMXLorebook.apply(rebuildCodexWithLedger(chat, lookup, replay), ITEMXLorebook.read(chat))
    };
  }

  function requireBackupIdle(chat) {
    if (!chat || chat.isStreaming || chat.message?.some((m) => m.isStreaming || m.bgContinue))
      throw new Error(ITEMXText("ledger.025"));
  }

  async function exportCurrentBackup(key) {
    const ctx = await context();
    if (!ctx || ctx.key !== key) throw new Error(ITEMXText("ledger.024"));
    requireBackupIdle(ctx.chat);
    return ITEMXBackup.capture(backupState(ctx));
  }

  async function prepareBackupImport(text, key, mode = 'empty') {
    if (!['empty', 'replace'].includes(mode)) throw new Error(ITEMXText("ledger.023"));
    const value = ITEMXBackup.parse(text),
      ctx = await context();
    if (!ctx || ctx.key !== key) throw new Error(ITEMXText("ledger.022"));
    requireBackupIdle(ctx.chat);
    const loaded = backupState(ctx);
    const previousCounts = [
      loaded.snapshot.registry.order.length,
      loaded.codexSnapshot.skills.order.length,
      loaded.codexSnapshot.monsters.order.length
    ];
    if (mode === 'empty' && previousCounts.some(Boolean))
      throw new Error(ITEMXText("ledger.021"));
    if (mode !== 'replace' && !ITEMXBackup.counts(value).some(Boolean))
      throw new Error(ITEMXText("ledger.020"));
    return { value, key, mode, previousCounts, expected: JSON.stringify(ctx.chat) };
  }

  async function commitBackupImport(preview) {
    return (async () => {
      const ctx = await context();
      if (!ctx || ctx.key !== preview.key) throw new Error(ITEMXText("ledger.019"));
      requireBackupIdle(ctx.chat);
      if (JSON.stringify(ctx.chat) !== preview.expected)
        throw new Error(ITEMXText("ledger.018"));
      const checked = await prepareBackupImport(JSON.stringify(preview.value), preview.key, preview.mode);
      if (checked.expected !== preview.expected) throw new Error(ITEMXText("ledger.017"));
      const value = checked.value;
      const restored = ITEMXBackup.restore(value, ctx.chat);
      const boundary = (ctx.chat.message || []).length - 1;
      const checkpoint = createCheckpoint(
        restored.item,
        restored.codex,
        boundary,
        ctx.chat.message?.[boundary]?.chatId
      );
      checkpoint.checkpoint.restored = true;
      const base = ITEMXCore.clone(ctx.chat);
      if (preview.mode === 'replace') {
        for (const message of base.message || []) {
          for (const field of ['data', 'content']) {
            if (typeof message[field] !== 'string') continue;
            message[field] = message[field]
              .replace(ITEMXCore.MARKER_RE, '')
              .replace(ITEMXCodex.MARKER_RE, '')
              .replace(ITEMX_REF_RE, '')
              .replace(ITEMX_CODEX_REF_RE, '');
          }
        }
        base.scriptstate = { ...base.scriptstate };
        for (const key of CHAT_DATA_KEYS)
          if (![ITEMX_AUX_KEY, ITEMXCore.CHAT_KEY, ITEMXStorage.LOG].includes(key)) delete base.scriptstate[key];
      }
      const next = {
        ...base,
        scriptstate: {
          ...base.scriptstate,
          [ITEMX_CHECKPOINT_KEY]: JSON.stringify(checkpoint.checkpoint),
          [ITEMXHistory.KEY]: JSON.stringify(restored.prefs),
          [ITEMX_MANUAL_KEY]: '[]'
        }
      };
      const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
      const active = await context();
      if (
        !active ||
        active.key !== ctx.key ||
        JSON.stringify(latest) !== preview.expected ||
        JSON.stringify(active.chat) !== preview.expected
      )
        throw new Error(ITEMXText("ledger.016"));
      await saveChat(ctx.characterIndex, ctx.chatIndex, next);
      pipelineState.cachedLoaded = null;
      workQueue.remember('loaded-generation', -1);


      presentationState.markerHtmlCache.clear();
      presentationState.detailHtmlCache.clear();
      pipelineState.generation++;
      refreshLatest(next);
      uiState.status =
        preview.mode === 'replace'
          ? ITEMXText("ledger.015")
          : ITEMXText("ledger.014");
      return value;
    })();
  }

  function cleanChatPluginData(chat) {
    const next = ITEMXCore.clone(chat),
      messages = Array.isArray(next?.message) ? next.message : [];
    let cleanedMessages = 0,
      removedMarkers = 0,
      removedStateKeys = 0;
    for (const message of messages) {
      const original = messageData(message);
      const markers =
        original.match(/<!--(?:ITEMX2|CODEX2)(?::[A-Za-z0-9_-]+|@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?)-->/g) || [];
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
      delete next.scriptstate[key];
      removedStateKeys += 1;
    }
    return { chat: next, cleanedMessages, removedMarkers, removedStateKeys };
  }

  async function cleanCurrentChatItemx() {
    const ctx = await context();
    if (!ctx) throw new Error(ITEMXText("ledger.013"));
    const result = await (async () => {
      const active = await context();
      if (!active || active.key !== ctx.key) throw new Error(ITEMXText("ledger.012"));
      const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
      if (!latest) throw new Error(ITEMXText("ledger.011"));
      if (latest.isStreaming || (latest.message || []).some((message) => message?.isStreaming || message?.bgContinue)) {
        throw new Error(ITEMXText("ledger.010"));
      }
      const cleaned = cleanChatPluginData(latest);
      workQueue.assertCurrent();
      await Risuai.setChatToIndex(ctx.characterIndex, ctx.chatIndex, cleaned.chat);
      // Cleanup is intended for leaving ITEMX behind. Disable this bot only
      // after the chat write succeeds so catch-up cannot immediately recreate
      // the markers that were just removed.
      await setEnabled(ctx.character, false);
      return cleaned;
    })();
    uiState.cleanupArmedUntil = 0;
    pipelineState.latestMarkers.clear();

    workQueue.forget('uncommitted-markers');
    pipelineState.eventPayloads = new Map();
    presentationState.markerHtmlCache.clear();
    presentationState.detailHtmlCache.clear();
    workQueue.forget('catch-up');
    workQueue.forget('aux-settle');
    pipelineState.cachedLoaded = null;
    workQueue.remember('loaded-generation', -1);
    pipelineState.generation += 1;
    uiState.status = ITEMXText("ledger.009", result.removedMarkers);
    const loaded = await rebuildCurrent();
    if (loaded) loaded.enabled = false;
    return { ...result, loaded };
  }

  async function removeLegacyPluginStorage() {
    if (typeof Risuai.pluginStorage.keys !== 'function' || typeof Risuai.pluginStorage.removeItem !== 'function')
      return 0;
    let keys = [];
    try {
      keys = await Risuai.pluginStorage.keys();
    } catch {
      return 0;
    }
    if (!Array.isArray(keys)) return 0;
    const legacy = keys.filter((key) => String(key).startsWith('auxZero:'));
    let removed = 0;
    for (const key of legacy)
      try {
        await Risuai.pluginStorage.removeItem(key);
        removed += 1;
      } catch {}
    return removed;
  }

  async function compactCurrentChatStorage() {
    const ctx = await context();
    if (!ctx) throw new Error(ITEMXText("ledger.008"));
    const result = await (async () => {
      const active = await context();
      if (!active || active.key !== ctx.key) throw new Error(ITEMXText("ledger.007"));
      const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
      if (!latest) throw new Error(ITEMXText("ledger.006"));
      if (latest.isStreaming || (latest.message || []).some((message) => message?.isStreaming || message?.bgContinue))
        throw new Error(ITEMXText("ledger.005"));
      if (assertLogReadable(latest)) throw new Error(FROZEN_MESSAGE);
      const before = itemxStorageFootprint(latest);
      const compacted = refreshReplayCache(latest, { force: true, keepMessages: 8 });
      const aux = auxiliaryHistory(compacted);
      compacted.scriptstate = {
        ...(compacted.scriptstate || {}),
        [ITEMX_AUX_KEY]: JSON.stringify(boundedObjectTail(aux, 64, ITEMX_AUX_HISTORY_MAX_BYTES))
      };
      await saveChat(ctx.characterIndex, ctx.chatIndex, compacted);
      const legacyKeysRemoved = await removeLegacyPluginStorage();
      return { chat: compacted, before, after: itemxStorageFootprint(compacted), legacyKeysRemoved };
    })();
    uiState.storageCleanupArmedUntil = 0;
    pipelineState.cachedLoaded = null;
    workQueue.remember('loaded-generation', -1);


    pipelineState.eventPayloads = new Map();
    presentationState.markerHtmlCache.clear();
    presentationState.detailHtmlCache.clear();
    pipelineState.generation += 1;
    const saved = Math.max(0, result.before.totalBytes - result.after.totalBytes);
    uiState.status = ITEMXText("ledger.004", Math.round(saved / 1024));
    const loaded = await rebuildCurrent({ upgradeDisplayRefs: true });
    return { ...result, savedBytes: saved, loaded };
  }

  async function cachedOrRebuildCurrent() {
    const active = await context();
    if (!active) return null;
    const cached = pipelineState.cachedLoaded;
    if (
      cached?.key === active.key &&
      workQueue.revision('loaded-generation') === pipelineState.generation &&
      cached.replayFingerprint === replaySourceFingerprint(active.chat)
    )
      return { ...cached, chat: active.chat };
    return rebuildCurrent();
  }

  async function cachedRequestState() {
    const active = await context();
    if (!active) return null;
    const cached = pipelineState.cachedLoaded;
    if (
      cached?.key === active.key &&
      workQueue.revision('loaded-generation') === pipelineState.generation &&
      cached.replayFingerprint === replaySourceFingerprint(active.chat)
    )
      return { ...cached, chat: active.chat };
    return rebuildCurrent();
  }

  async function commitManualEvents(loaded, events, label, review = { source: 'manual' }, refresh = true) {
    if (!loaded || !Array.isArray(events) || !events.length) throw new Error('No manual events to commit');
    const latest = await readChat(loaded.characterIndex, loaded.chatIndex);
    if (!latest) throw new Error('Chat disappeared during manual operation');
    if (assertLogReadable(latest)) throw new Error(FROZEN_MESSAGE);
    if (loaded.expectedChat && JSON.stringify(latest) !== JSON.stringify(loaded.expectedChat))
      throw new Error(ITEMXText("ledger.003"));
    const ledger = manualLedger(latest);
    const afterIndex = Math.max(-1, (latest.message || []).length - 1);
    const scratch = rebuildWithManual(latest).registry;
    for (const event of events) {
      const previous = ITEMXCore.comparisonView(scratch.items[event.item?.id || event.patch?.id]);
      const view = ITEMXCore.clone(ITEMXCore.applyEvent(scratch, event));
      if (!view) throw new Error(ITEMXText("ledger.002"));
      ledger.push({
        at: Date.now(),
        afterIndex,
        label,
        event: ITEMXCore.clone(event),
        presentation: { previous, view: ITEMXCore.comparisonView(view), review }
      });
    }
    let next = ITEMXCore.clone(latest);
    next.scriptstate = { ...(next.scriptstate || {}), [ITEMX_MANUAL_KEY]: JSON.stringify(ledger) };
    next = refreshReplayCache(next);
    const snapshot = rebuildWithManual(
      next,
      buildMessageEventLookup(next),
      checkpointStatus(next).valid
        ? {
            start: readReplayBaseline(next).boundary + 1,
            registry: readReplayBaseline(next).item.registry,
            manual: manualLedger(next)
          }
        : {}
    );
    await saveChat(loaded.characterIndex, loaded.chatIndex, ITEMXCore.writeSnapshot(next, snapshot));
    uiState.status = ITEMXText("ledger.001", label, events.length);
    return refresh ? rebuildCurrent() : null;
  }
