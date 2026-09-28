/* Event ledger: compact refs, replay inputs and the chat-level ITEMX operations. */
import * as Backup from './engine/backup.js';
import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import * as EntityHistory from './engine/history.js';
import * as Lorebook from './engine/lorebook.js';
import * as Store from './storage.js';
import { auxiliaryHistory } from './aux.js';
import { context, readChat, saveChat } from './chat-io.js';
import {
  ITEMX_AUX_HISTORY_MAX_BYTES,
  ITEMX_AUX_KEY,
  ITEMX_CHECKPOINT_KEY,
  ITEMX_CHECKPOINT_VERSION,
  ITEMX_CODEX_REF_RE,
  ITEMX_LORE_KEY,
  ITEMX_MANUAL_KEY,
  ITEMX_MESSAGE_EVENT_KEY,
  ITEMX_REF_RE,
  ITEMX_STORAGE_WARNING_BYTES
} from './config.js';
import { emit } from './events.js';
import { host } from './host.js';
import { t } from './i18n.js';
import { debugRecord, workQueue } from './kernel.js';
import { bareRefMarker, compactRefMarker, markerCodes, messageData, presentationPayloads } from './markers.js';
import { stripAllTransport } from './pipeline.js';
import { encounterRegistryFingerprint, prepareInlinePortraits } from './portraits.js';
import {
  activeContextKey,
  cachedLoaded,
  currentGeneration,
  currentLedgerRevision,
  freshLoaded,
  invalidateLoaded,
  setEventPayloads,
  setLatestMarkers,
  storeLoaded
} from './session.js';
import { changeSettings, settingsFor } from './settings.js';
import { setStatus } from './status.js';
export function refreshLatest(chat, lookup = buildMessageEventLookup(chat)) {
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
  setLatestMarkers(persisted);
  void emit('markers');
}

export function manualLedger(chat) {
  try {
    const raw = chat?.scriptstate?.[ITEMX_MANUAL_KEY];
    const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // Manual events are authoritative source facts. Never truncate them by
    // count: doing so can discard an old exam while retaining later patches.
    return Array.isArray(rows) ? rows.filter((row) => row && Number.isInteger(row.afterIndex) && row.event?.kind) : [];
  } catch {
    return [];
  }
}

export function messageEventLedger(chat) {
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

export function checkpointShapeValid(value) {
  return Boolean(
    value &&
    Number.isInteger(value.boundary) &&
    value.item?.registry &&
    value.codex?.skills &&
    Array.isArray(value.rows) &&
    Array.isArray(value.manual)
  );
}

export function readCheckpointRecord(chat) {
  const raw = chat?.scriptstate?.[ITEMX_CHECKPOINT_KEY];
  if (!raw) return { status: 'absent', value: null, reason: '' };
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!checkpointShapeValid(value)) throw new Error('Invalid imported baseline event');
  return { status: 'ok', value, reason: '' };
}

export function readReplayBaseline(chat) {
  return readCheckpointRecord(chat).value;
}

export function assertLogReadable(chat) {
  Store.log(chat); // Malformed authoritative data must be surfaced, never overwritten.
  return false;
}

export const FROZEN_MESSAGE = t('ledger.030');

export function prefixMarkerFingerprint(chat, boundary) {
  let source = `b:${boundary}`;
  for (let index = 0; index <= boundary; index += 1) {
    const markers = messageData(chat?.message?.[index]).match(
      /<!--(?:ITEMX2|CODEX2)(?::[A-Za-z0-9_-]+|@[A-Za-z0-9_-]{1,80}(?::[A-Za-z0-9_-]+)?)-->/g
    );
    if (markers) source += `|${index}:${markers.join('')}`;
  }
  return Core.fnv1a(source);
}

export function checkpointStatus(chat) {
  const checkpoint = readReplayBaseline(chat);
  if (checkpoint?.v === ITEMX_CHECKPOINT_VERSION) {
    const messages = Array.isArray(chat?.message) ? chat.message : [];
    let boundary = checkpoint.boundary;
    if (checkpoint.sealedThroughId) {
      const located = messages.findIndex((message) => message?.chatId === checkpoint.sealedThroughId);
      // The sealed message is gone: replaying from 0 on top of the sealed registry would double-apply.
      if (located < 0) return { checkpoint: { ...checkpoint, boundary: -1 }, valid: false };
      boundary = located;
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

export function buildMessageEventLookup(chat) {
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

export function replaySourceFingerprint(chat) {
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
  return Core.fnv1a(source);
}

// Risu paints the chat body before the plugin can resolve a compact ref, and
// the stock API has no re-render call: writing the chat is the only way to
// make it paint again. That is why leaving the chat and coming back shows the
// cards while a refresh does not. Only a chat that actually carries a ref pays
// for this, and only once per load.
export function chatCarriesDisplayRefs(chat) {
  return (chat?.message || []).some((message) => {
    const text = messageData(message);
    return text.includes('<!--ITEMX2') || text.includes('<!--CODEX2');
  });
}

export async function repaintChatBody(ctx) {
  if (!ctx?.chat || !chatCarriesDisplayRefs(ctx.chat)) return false;
  if (ctx.chat.isStreaming || (ctx.chat.message || []).some((message) => message?.isStreaming)) return false;
  try {
    await saveChat(ctx.characterIndex, ctx.chatIndex, ctx.chat);
    debugRecord('repaint', 'rewrote the chat so resolved refs paint as cards');
    return true;
  } catch (error) {
    // A conflicting write means the host already changed the chat, which
    // repaints it anyway. Nothing to recover.
    debugRecord('repaint skipped', error?.message || String(error));
    return false;
  }
}

export function loadMessageEventLedger(chat, lookup = buildMessageEventLookup(chat)) {
  setEventPayloads(lookup.payloads);
}

export const storageBytes = (value) => {
  const source = String(value ?? '');
  return typeof TextEncoder === 'function' ? new TextEncoder().encode(source).length : source.length;
};

export function boundedObjectTail(value, count, bytes) {
  const entries = Object.entries(value || {}).slice(-count);
  while (entries.length && storageBytes(JSON.stringify(Object.fromEntries(entries))) > bytes) entries.shift();
  return Object.fromEntries(entries);
}

export function itemxStorageFootprint(chat) {
  // Measure documents already on this chat, not a hypothetical rewrite.
  const state = chat?.scriptstate || {};
  const keys = state[Store.LOG] ? [Store.LOG, Store.PREFS, Store.CACHE] : CHAT_DATA_KEYS;
  let stateBytes = 0,
    markerBytes = 0,
    markerCount = 0;
  for (const key of keys) {
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

export function createCheckpoint(itemSource, codexSource, boundary, sealedThroughId, previouslyPruned = false) {
  // A checkpoint replaces the authoritative event prefix. Never discard state
  // to meet a storage budget: the removed events cannot reconstruct it later.
  const item = Core.clone(itemSource),
    codex = Codex.clone(codexSource);
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

export function reconcileStoredRefViews(chat, preferredLatestIndex = null) {
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
    if (!next) next = Core.clone(chat);
    const message = next.message[index];
    if (typeof message.data === 'string') message.data = source;
    else if (typeof message.content === 'string') message.content = source;
    changed = true;
  }
  return { chat: next || chat, changed };
}

export function messageEvents(text, domain, lookup) {
  const byRef = domain === 'item' ? lookup.itemByRef : lookup.codexByRef;
  const found = [];
  const fullRe = domain === 'item' ? Core.MARKER_RE : Codex.MARKER_RE;
  const refRe = domain === 'item' ? ITEMX_REF_RE : ITEMX_CODEX_REF_RE;
  String(text || '').replace(fullRe, (raw, code, index) => {
    const payload = domain === 'item' ? Core.decodePayload(code) : Codex.decodePayload(code);
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

export function rebuildCodexWithLedger(chat, lookup = buildMessageEventLookup(chat), options = {}) {
  if (chat?.scriptstate?.[Store.LOG]) return Store.replayedCodex(chat);
  const state = options.base ? Codex.clone(options.base) : Codex.snapshot();
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
      const registry = Codex.storeFor(state, domain);
      const before = registry.entries[id] ? { ...registry.entries[id] } : null;
      const applied = Codex.applyEvent(state, event);
      if (applied != null)
        EntityHistory.observe(
          state.history[domain],
          domain,
          before,
          registry.entries[id],
          event,
          index,
          () => `${messages[index]?.chatId || index}:${occurrence}:${Core.fnv1a(JSON.stringify(event))}`
        );
      occurrence++;
      transport += JSON.stringify(event);
    }
  }
  state.fingerprint = Core.fnv1a(transport);
  state.updatedAt = Date.now();
  return state;
}

export function compactMessageTransports(chat, index) {
  const next = Core.clone(chat),
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
      const ref = `${domain[0]}${index.toString(36)}_${(ordinal++).toString(36)}_${Core.fnv1a(code)}`;
      byKey.set(`${domain}:${ref}`, { ref, domain, payload: Core.clone(payload) });
      changed = true;
      return compactRefMarker(prefix, ref, payload, domain);
    });
  };
  replace('item', Core.MARKER_RE, Core.decodePayload, 'ITEMX2');
  replace('codex', Codex.MARKER_RE, Codex.decodePayload, 'CODEX2');
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

export function refreshReplayCache(chat, options = {}) {
  // Cache maintenance cannot truncate the log, markers, or manual history.
  return Store.hydrate(Store.persist(chat));
}

export function rebuildWithManual(chat, lookup = buildMessageEventLookup(chat), options = {}) {
  if (chat?.scriptstate?.[Store.LOG]) return Store.replayedItem(chat);
  const messages = Array.isArray(chat?.message) ? chat.message : [];
  const start = Math.max(0, options.start || 0),
    end = Math.min(messages.length - 1, options.end ?? messages.length - 1);
  const ledger = options.manual || [
      ...(start === 0 ? readReplayBaseline(chat)?.manual || [] : []),
      ...manualLedger(chat)
    ],
    manualByIndex = new Map(),
    manualTail = [],
    reg = options.registry ? Core.clone(options.registry) : Core.newRegistry();
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
  const history = Core.clone(options.history || {});
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
    const applied = Core.applyEvent(reg, event);
    if (applied != null)
      for (const id of ids)
        EntityHistory.observe(
          history,
          'item',
          prior.get(id),
          reg.items[id],
          event,
          at,
          () => `${messages[at]?.chatId || at}:${occurrence}:${Core.fnv1a(JSON.stringify(event))}`
        );
    transport += Core.marker({ v: Core.VERSION, event });
  };
  for (let index = start; index <= end; index += 1) {
    for (const event of messageEvents(messageData(messages[index]), 'item', lookup)) apply(event, index);
    for (const row of manualByIndex.get(index) || []) apply(row.event, index);
  }
  for (const row of manualTail) apply(row.event, Math.min(row.afterIndex, messages.length - 1));
  return {
    history,
    schema: Core.VERSION,
    rev: 2,
    fingerprint: Core.fnv1a(transport),
    updatedAt: Date.now(),
    registry: reg
  };
}

export async function rebuildCurrent({ upgradeDisplayRefs = false } = {}) {
  let wroteDisplayRefs = false;
  const ctx = await context();
  if (!ctx) return null;
  return (async () => {
    // A read-only projection uses the snapshot context just fetched. Any
    // optional write below still verifies this read against the live host.
    let latestChat = ctx.chat;
    if (!latestChat) return null;
    if (
      upgradeDisplayRefs &&
      !assertLogReadable(latestChat) &&
      !latestChat.isStreaming &&
      !(latestChat.message || []).some((message) => message?.isStreaming)
    ) {
      const reconciled = reconcileStoredRefViews(latestChat);
      if (reconciled.changed && activeContextKey() === ctx.key) {
        await saveChat(ctx.characterIndex, ctx.chatIndex, reconciled.chat, latestChat);
        latestChat = reconciled.chat;
        wroteDisplayRefs = true;
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
    const codexSnapshot = Lorebook.apply(codexBase, Lorebook.read(latestChat));
    const settings = await settingsFor(ctx.character);
    refreshLatest(latestChat, lookup);
    // Normal rebuilds are deliberately read-only. Writing an entire chat
    // snapshot here can race another module's output hook and restore an
    // older assistant message over its freshly appended display markers.
    const storagePruned = checkpoint.checkpoint?.storage?.pruned === true;
    const storageWarning = itemxStorageFootprint(latestChat).totalBytes >= ITEMX_STORAGE_WARNING_BYTES;
    const storageStatus =
      [storageWarning ? t('ledger.029') : '', storagePruned ? t('ledger.028') : ''].filter(Boolean).join(' · ') ||
      t('ledger.027');
    setStatus(
      t(
        'ledger.026',
        storageStatus,
        snapshot.registry.order.length,
        codexSnapshot.skills.order.length,
        codexSnapshot.monsters.order.length
      )
    );
    const loaded = {
      ...ctx,
      chat: latestChat,
      snapshot,
      codexSnapshot,
      lorebookSourceFingerprint,
      replayFingerprint: replaySourceFingerprint(latestChat),
      // Bootstrap needs to know whether this rebuild already rewrote the chat,
      // so it does not pay for a second whole-chat write just to repaint.
      wroteDisplayRefs,
      ...settings
    };
    prepareInlinePortraits(loaded, codexSnapshot, settings);
    storeLoaded(loaded);
    return loaded;
  })();
}

export const CHAT_DATA_KEYS = [
  Store.LOG,
  Store.PREFS,
  Store.CACHE,
  Core.STATE_KEY,
  Core.CHAT_KEY,
  Codex.STATE_KEY,
  ITEMX_MANUAL_KEY,
  ITEMX_MESSAGE_EVENT_KEY,
  ITEMX_CHECKPOINT_KEY,
  ITEMX_AUX_KEY,
  ITEMX_LORE_KEY,
  EntityHistory.KEY
];

export function backupState(ctx) {
  const chat = Store.hydrate(ctx.chat),
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
    codexSnapshot: Lorebook.apply(rebuildCodexWithLedger(chat, lookup, replay), Lorebook.read(chat))
  };
}

export function requireBackupIdle(chat) {
  if (!chat || chat.isStreaming || chat.message?.some((m) => m.isStreaming || m.bgContinue))
    throw new Error(t('ledger.025'));
}

export async function exportCurrentBackup(key) {
  const ctx = await context();
  if (!ctx || ctx.key !== key) throw new Error(t('ledger.024'));
  requireBackupIdle(ctx.chat);
  return Backup.capture(backupState(ctx));
}

export async function prepareBackupImport(text, key, mode = 'empty') {
  if (!['empty', 'replace'].includes(mode)) throw new Error(t('ledger.023'));
  const value = Backup.parse(text),
    ctx = await context();
  if (!ctx || ctx.key !== key) throw new Error(t('ledger.022'));
  requireBackupIdle(ctx.chat);
  const loaded = backupState(ctx);
  const previousCounts = [
    loaded.snapshot.registry.order.length,
    loaded.codexSnapshot.skills.order.length,
    loaded.codexSnapshot.monsters.order.length
  ];
  if (mode === 'empty' && previousCounts.some(Boolean)) throw new Error(t('ledger.021'));
  if (mode !== 'replace' && !Backup.counts(value).some(Boolean)) throw new Error(t('ledger.020'));
  return { value, key, mode, previousCounts, expected: JSON.stringify(ctx.chat) };
}

export async function commitBackupImport(preview) {
  return (async () => {
    const ctx = await context();
    if (!ctx || ctx.key !== preview.key) throw new Error(t('ledger.019'));
    requireBackupIdle(ctx.chat);
    if (JSON.stringify(ctx.chat) !== preview.expected) throw new Error(t('ledger.018'));
    const checked = await prepareBackupImport(JSON.stringify(preview.value), preview.key, preview.mode);
    if (checked.expected !== preview.expected) throw new Error(t('ledger.017'));
    const value = checked.value;
    const restored = Backup.restore(value, ctx.chat);
    const boundary = (ctx.chat.message || []).length - 1;
    const checkpoint = createCheckpoint(restored.item, restored.codex, boundary, ctx.chat.message?.[boundary]?.chatId);
    checkpoint.checkpoint.restored = true;
    const base = Core.clone(ctx.chat);
    if (preview.mode === 'replace') {
      for (const message of base.message || []) {
        for (const field of ['data', 'content']) {
          if (typeof message[field] !== 'string') continue;
          message[field] = message[field]
            .replace(Core.MARKER_RE, '')
            .replace(Codex.MARKER_RE, '')
            .replace(ITEMX_REF_RE, '')
            .replace(ITEMX_CODEX_REF_RE, '');
        }
      }
      base.scriptstate = { ...base.scriptstate };
      for (const key of CHAT_DATA_KEYS)
        if (![ITEMX_AUX_KEY, Core.CHAT_KEY, Store.LOG].includes(key)) delete base.scriptstate[key];
    }
    const next = {
      ...base,
      scriptstate: {
        ...base.scriptstate,
        [ITEMX_CHECKPOINT_KEY]: JSON.stringify(checkpoint.checkpoint),
        [EntityHistory.KEY]: JSON.stringify(restored.prefs),
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
      throw new Error(t('ledger.016'));
    await saveChat(ctx.characterIndex, ctx.chatIndex, next, latest);
    invalidateLoaded();
    void emit('data-reset');
    refreshLatest(next);
    setStatus(preview.mode === 'replace' ? t('ledger.015') : t('ledger.014'));
    return value;
  })();
}

export function cleanChatPluginData(chat) {
  const next = Core.clone(chat),
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

export async function cleanCurrentChatItemx() {
  const ctx = await context();
  if (!ctx) throw new Error(t('ledger.013'));
  const result = await (async () => {
    const active = await context();
    if (!active || active.key !== ctx.key) throw new Error(t('ledger.012'));
    const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
    if (!latest) throw new Error(t('ledger.011'));
    if (latest.isStreaming || (latest.message || []).some((message) => message?.isStreaming || message?.bgContinue)) {
      throw new Error(t('ledger.010'));
    }
    const cleaned = cleanChatPluginData(latest);
    workQueue.assertCurrent();
    await saveChat(ctx.characterIndex, ctx.chatIndex, cleaned.chat, latest, { cleanup: true });
    // Cleanup is intended for leaving ITEMX behind. Disable this bot only
    // after the chat write succeeds so catch-up cannot immediately recreate
    // the markers that were just removed.
    await changeSettings(ctx.character, { enabled: false });
    return cleaned;
  })();
  setLatestMarkers([]);
  workQueue.forget('uncommitted-markers');
  setEventPayloads([]);
  workQueue.forget('catch-up');
  workQueue.forget('aux-settle');
  invalidateLoaded();
  void emit('data-reset');
  setStatus(t('ledger.009', result.removedMarkers));
  const loaded = await rebuildCurrent();
  if (loaded) loaded.enabled = false;
  return { ...result, loaded };
}

export async function removeLegacyPluginStorage() {
  if (typeof host().pluginStorage.keys !== 'function' || typeof host().pluginStorage.removeItem !== 'function')
    return 0;
  let keys;
  try {
    keys = await host().pluginStorage.keys();
  } catch {
    return 0;
  }
  if (!Array.isArray(keys)) return 0;
  const legacy = keys.filter((key) => String(key).startsWith('auxZero:'));
  let removed = 0;
  for (const key of legacy)
    try {
      await host().pluginStorage.removeItem(key);
      removed += 1;
    } catch {}
  return removed;
}

export async function compactCurrentChatStorage() {
  const ctx = await context();
  if (!ctx) throw new Error(t('ledger.008'));
  const result = await (async () => {
    const active = await context();
    if (!active || active.key !== ctx.key) throw new Error(t('ledger.007'));
    const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
    if (!latest) throw new Error(t('ledger.006'));
    if (latest.isStreaming || (latest.message || []).some((message) => message?.isStreaming || message?.bgContinue))
      throw new Error(t('ledger.005'));
    if (assertLogReadable(latest)) throw new Error(FROZEN_MESSAGE);
    const before = itemxStorageFootprint(latest);
    const compacted = refreshReplayCache(latest, { force: true, keepMessages: 8 });
    const aux = auxiliaryHistory(compacted);
    compacted.scriptstate = {
      ...(compacted.scriptstate || {}),
      [ITEMX_AUX_KEY]: JSON.stringify(boundedObjectTail(aux, 64, ITEMX_AUX_HISTORY_MAX_BYTES))
    };
    await saveChat(ctx.characterIndex, ctx.chatIndex, compacted, latest);
    const legacyKeysRemoved = await removeLegacyPluginStorage();
    return { chat: compacted, before, after: itemxStorageFootprint(compacted), legacyKeysRemoved };
  })();
  invalidateLoaded();
  setEventPayloads([]);
  void emit('data-reset');
  const saved = Math.max(0, result.before.totalBytes - result.after.totalBytes);
  setStatus(t('ledger.004', Math.round(saved / 1024)));
  const loaded = await rebuildCurrent({ upgradeDisplayRefs: true });
  return { ...result, savedBytes: saved, loaded };
}

// The cached projection when the chat's replay inputs are unchanged since it
// was built, otherwise a fresh rebuild.
export async function cachedOrRebuildCurrent() {
  const active = await context();
  if (!active) return null;
  const cached = freshLoaded();
  if (cached?.key === active.key && cached.replayFingerprint === replaySourceFingerprint(active.chat))
    return { ...cached, chat: active.chat };
  return rebuildCurrent();
}

export async function commitManualEvents(loaded, events, label, review = { source: 'manual' }, refresh = true) {
  if (!loaded || !Array.isArray(events) || !events.length) throw new Error('No manual events to commit');
  const latest = await readChat(loaded.characterIndex, loaded.chatIndex);
  if (!latest) throw new Error('Chat disappeared during manual operation');
  if (assertLogReadable(latest)) throw new Error(FROZEN_MESSAGE);
  if (loaded.expectedChat && JSON.stringify(latest) !== JSON.stringify(loaded.expectedChat))
    throw new Error(t('ledger.003'));
  const ledger = manualLedger(latest);
  const afterIndex = Math.max(-1, (latest.message || []).length - 1);
  let scratch = null,
    codexScratch = null;
  for (const event of events) {
    if (['skill', 'monster'].includes(event?.domain)) {
      codexScratch ||= rebuildCodexWithLedger(latest);
      const id = event.entity?.id || event.patch?.id;
      const prior = Codex.storeFor(codexScratch, event.domain).entries[id];
      const previous = prior ? Codex.clone(prior) : null;
      const view = Codex.clone(Codex.applyEvent(codexScratch, event));
      if (!view) throw new Error(t('ledger.002'));
      ledger.push({
        at: Date.now(),
        afterIndex,
        label,
        event: Codex.clone(event),
        presentation: { previous, view, review }
      });
      continue;
    }
    scratch ||= rebuildWithManual(latest).registry;
    const previous = Core.comparisonView(scratch.items[event.item?.id || event.patch?.id]);
    const view = Core.clone(Core.applyEvent(scratch, event));
    if (!view) throw new Error(t('ledger.002'));
    ledger.push({
      at: Date.now(),
      afterIndex,
      label,
      event: Core.clone(event),
      presentation: { previous, view: Core.comparisonView(view), review }
    });
  }
  let next = Core.clone(latest);
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
  await saveChat(loaded.characterIndex, loaded.chatIndex, Core.writeSnapshot(next, snapshot), latest);
  setStatus(t('ledger.001', label, events.length));
  return refresh ? rebuildCurrent() : null;
}

// Latest payload, review and message index of each entity, derived from the
// cached chat and rebuilt when the ledger or the cached projection changes.
let presentationRecords = null;
let presentationRecordsFor = null;
export function presentationRecord(domain, id) {
  const source = `${currentLedgerRevision()}:${currentGeneration()}`;
  if (presentationRecordsFor !== source) {
    presentationRecords = null;
    presentationRecordsFor = source;
  }
  if (!presentationRecords) {
    const records = new Map(),
      chat = cachedLoaded()?.chat;
    const manual = [...(readReplayBaseline(chat)?.manual || []), ...manualLedger(chat)];
    const manualByIndex = new Map();
    for (const row of manual) {
      const index = Math.min(Math.max(-1, row.afterIndex), (chat?.message?.length || 0) - 1);
      const rows = manualByIndex.get(index) || [];
      rows.push(row);
      manualByIndex.set(index, rows);
    }
    const put = (payload, domain, index) => {
      const id = payload.view?.id || payload.event?.item?.id || payload.event?.patch?.id;
      if (id) {
        const prior = records.get(`${domain}:${id}`),
          review = { ...payload.review };
        if (prior?.review?.missing?.length && !payload.review?.checked && payload.review?.source !== 'manual') {
          review.missing = prior.review.missing;
          review.evidenceIndex = prior.review.evidenceIndex ?? prior.messageIndex;
        }
        if (payload.review?.source === 'manual') {
          review.missing = [];
          review.checked = false;
        }
        records.set(`${domain}:${id}`, { ...payload, review, messageIndex: index });
      }
    };
    const putManual = (index) => {
      for (const row of manualByIndex.get(index) || [])
        put(
          { ...row.presentation, event: row.event, review: row.presentation?.review || { source: 'manual' } },
          'item',
          index
        );
    };
    putManual(-1);
    for (let index = 0; index < (chat?.message?.length || 0); index++) {
      for (const row of presentationPayloads(messageData(chat.message[index]))) put(row.payload, row.domain, index);
      putManual(index);
    }
    presentationRecords = records;
  }
  return presentationRecords.get(`${domain}:${id}`) || {};
}
