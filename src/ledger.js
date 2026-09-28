/* Ledger: the chat's ITEMX document as the runtime sees it. The projection
 * folds the document over the current message order; anchors resolve against
 * that fold; the chat-level operations below are the only writers. */
import * as Backup from './engine/backup.js';
import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import * as Lorebook from './engine/lorebook.js';
import { chatIsStreaming, context, readChat, saveChat } from './chat-io.js';
import { ITEMX_STORAGE_WARNING_BYTES } from './config.js';
import { emit } from './events.js';
import { host } from './host.js';
import { t } from './i18n.js';
import { timedSync, workQueue } from './kernel.js';
import { encounterRegistryFingerprint, prepareInlinePortraits } from './portraits.js';
import {
  activeContextKey,
  cachedLoaded,
  dropPending,
  freshLoaded,
  invalidateLoaded,
  pendingEntries,
  pendingRecord,
  setLatestKeys,
  storeLoaded,
  updateCachedChat
} from './session.js';
import { changeSettings, settingsFor } from './settings.js';
import { setStatus } from './status.js';
import {
  anchorKeys,
  countOldMarkers,
  hasAnchor,
  removeOldMarkers,
  stripAnchors,
  stripTransport
} from './store/anchors.js';
import {
  CACHE_KEY,
  DOCUMENT_KEY,
  OLD_KEYS,
  footprint,
  readCache,
  readDocument,
  withDocument
} from './store/document.js';
import { CHECKPOINT_VERSION, fold } from './store/replay.js';

const messageId = (message) => (typeof message?.chatId === 'string' ? message.chatId : '');

// Everything the fold depends on, hashed without serializing the chat: the
// stored document string and each message's id and anchors.
export function replayFingerprint(chat) {
  const raw = chat?.scriptstate?.[DOCUMENT_KEY];
  let source = typeof raw === 'string' ? raw : raw == null ? '' : JSON.stringify(raw);
  for (const message of chat?.message || []) {
    const text = Core.messageText(message);
    source += `|${messageId(message)}`;
    if (hasAnchor(text)) source += `:${anchorKeys(text).join(',')}`;
  }
  return Core.fnv1a(source);
}

// A read-only projection of `ctx.chat`. `full` folds from the start so every
// anchor has its view; otherwise the cached checkpoint may skip the prefix.
export function project(ctx, settings = {}, { full = false } = {}) {
  const doc = readDocument(ctx.chat);
  const checkpoint = full ? null : readCache(ctx.chat)?.checkpoint || null;
  const pending = (key) => (pendingRecord(key)?.chatKey === ctx.key ? pendingRecord(key) : null);
  const folded = timedSync('replay', () => fold(ctx.chat, doc, { checkpoint, full, pending }));
  const codexBase = folded.codex;
  codexBase.fingerprint = folded.chain;
  const codexSnapshot = Object.keys(doc.lore.rows).length ? Lorebook.apply(codexBase, doc.lore) : codexBase;
  return {
    ...ctx,
    ...settings,
    doc,
    prefs: doc.prefs,
    snapshot: {
      schema: Core.VERSION,
      registry: folded.item.registry,
      history: folded.item.history,
      fingerprint: folded.chain
    },
    codexSnapshot,
    views: folded.views,
    complete: folded.complete,
    checkpoint: folded.checkpoint,
    lorebookSourceFingerprint: encounterRegistryFingerprint(codexBase),
    replayFingerprint: replayFingerprint(ctx.chat)
  };
}

// The views of every step. A checkpointed projection lacks the prefix; the
// first request for an old anchor folds once from the start.
export function fullViews(loaded) {
  if (!loaded) return new Map();
  if (!loaded.complete) {
    const pending = (key) => (pendingRecord(key)?.chatKey === loaded.key ? pendingRecord(key) : null);
    const folded = timedSync('replay:full', () => fold(loaded.chat, loaded.doc, { full: true, pending }));
    loaded.views = folded.views;
    loaded.complete = true;
  }
  return loaded.views;
}

const asPayload = (row) =>
  row?.view
    ? { event: row.event, view: row.view, previous: row.previous, review: row.review, domain: row.domain }
    : null;

// The card behind one anchor: the committed fold's view, else the parsed but
// not yet committed record of the current response.
export function anchorPayload(key, loaded = cachedLoaded()) {
  let row = loaded?.views?.get(`e:${key}`);
  if (!row && loaded && !loaded.complete && loaded.doc?.events?.[key]) row = fullViews(loaded).get(`e:${key}`);
  return asPayload(row) || asPayload(pendingRecord(key));
}

// Anchors of the newest response, the only cards that may animate and the
// source of the side badge's gain/loss count.
export function refreshLatest(loaded) {
  const messages = loaded?.chat?.message || [];
  let keys = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = Core.messageText(messages[index]);
    if (!hasAnchor(text)) continue;
    keys = anchorKeys(text);
    break;
  }
  for (const [key] of pendingEntries(loaded?.key || activeContextKey())) keys.push(key);
  setLatestKeys(keys);
  void emit('markers');
}

export async function rebuildCurrent(ctx = null) {
  ctx ||= await context();
  if (!ctx) return null;
  const settings = await settingsFor(ctx.character);
  const loaded = project(ctx, settings);
  const warning = footprint(ctx.chat).stateBytes >= ITEMX_STORAGE_WARNING_BYTES;
  setStatus(
    t(
      'ledger.026',
      warning ? t('ledger.029') : t('ledger.027'),
      loaded.snapshot.registry.order.length,
      loaded.codexSnapshot.skills.order.length,
      loaded.codexSnapshot.monsters.order.length
    )
  );
  prepareInlinePortraits(loaded, loaded.codexSnapshot, settings);
  storeLoaded(loaded);
  refreshLatest(loaded);
  return loaded;
}

// The cached projection while the chat's replay inputs are unchanged,
// otherwise a fresh one.
export async function cachedOrRebuildCurrent() {
  const active = await context();
  if (!active) return null;
  const cached = freshLoaded();
  if (cached?.key === active.key && cached.replayFingerprint === replayFingerprint(active.chat)) {
    cached.chat = active.chat;
    return cached;
  }
  return rebuildCurrent(active);
}

// The display hook's projection. Anchors the loaded document or the pending
// records know need no host call; an unknown anchor waits for the one load in
// flight (at most once per projection and key, so a stray anchor cannot cause
// a reload per render), bounded so a stalled host never blanks a message.
const DISPLAY_WAIT_MS = 8000;
let displayLoad = null;
const displayMisses = new WeakMap();
const knows = (loaded, key) => Boolean(loaded?.doc?.events?.[key] || pendingRecord(key));
export function displayProjection(keys = []) {
  const loaded = cachedLoaded();
  if (loaded?.key === activeContextKey()) {
    const misses = displayMisses.get(loaded) || new Set();
    const unknown = keys.filter((key) => !knows(loaded, key) && !misses.has(key));
    if (!unknown.length) return loaded;
    for (const key of unknown) misses.add(key);
    displayMisses.set(loaded, misses);
  } else if (keys.length && keys.every((key) => pendingRecord(key))) return loaded;
  displayLoad ||= rebuildCurrent()
    .catch(() => null)
    .finally(() => {
      displayLoad = null;
    });
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = globalThis.setTimeout(() => resolve(cachedLoaded()), DISPLAY_WAIT_MS);
  });
  return Promise.race([displayLoad, timeout]).finally(() => globalThis.clearTimeout(timer));
}

// Latest view, review and message index of each entity, for the drawer's
// change and review annotations.
const records = new WeakMap();
export function presentationRecord(domain, id, loaded = cachedLoaded()) {
  if (!loaded) return {};
  let byEntity = records.get(loaded);
  if (!byEntity) {
    byEntity = new Map();
    for (const row of fullViews(loaded).values()) {
      if (!row.view) continue;
      const rowDomain = row.domain === 'item' ? 'item' : row.event?.domain;
      const entity = row.view.id || row.event?.item?.id || row.event?.patch?.id;
      if (!entity) continue;
      const prior = byEntity.get(`${rowDomain}:${entity}`);
      const review = { ...row.review };
      if (row.manual) {
        review.missing = row.review?.source === 'auxiliary' ? row.review.missing || [] : [];
        review.checked = row.review?.source === 'auxiliary' ? Boolean(row.review.checked) : false;
      } else if (prior?.review?.missing?.length && !row.review?.checked) {
        review.missing = prior.review.missing;
        review.evidenceIndex = prior.review.evidenceIndex ?? prior.messageIndex;
      }
      byEntity.set(`${rowDomain}:${entity}`, {
        event: row.event,
        view: row.view,
        previous: row.previous,
        review,
        messageIndex: row.index
      });
    }
    records.set(loaded, byEntity);
  }
  return byEntity.get(`${domain}:${id}`) || {};
}

// Registers parsed records as committed events of message `chatId`.
export function commitRecords(doc, records, chatId) {
  for (const record of records) {
    if (doc.events[record.key]) continue;
    doc.seq += 1;
    doc.events[record.key] = {
      c: chatId,
      d: record.domain === 'item' ? 'item' : 'codex',
      e: record.event,
      ...(record.review ? { r: record.review } : {}),
      s: doc.seq
    };
  }
}

// The derived cache written alongside a document change: the last projection's
// checkpoint candidate, validated by its chain hash when it is next read.
function cacheFor(key) {
  const loaded = cachedLoaded();
  return loaded?.key === key && loaded.checkpoint?.v === CHECKPOINT_VERSION
    ? { v: 1, checkpoint: loaded.checkpoint }
    : undefined;
}

// Read-modify-write of the chat's document. `change(doc, latest)` edits `doc`
// in place and may return `{ chat }` with replacement messages, or false to
// write nothing. The write lands only if the chat is still the one read.
export async function writeDocument(ctx, change, { idle = true } = {}) {
  workQueue.assertCurrent();
  const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
  if (!latest) throw new Error(t('ledger.006'));
  if (idle && chatIsStreaming(latest)) throw new Error(t('ledger.025'));
  const doc = readDocument(latest);
  const result = await change(doc, latest);
  if (result === false) return null;
  const next = withDocument(
    result?.chat || latest,
    doc,
    result?.cache !== undefined ? result.cache : cacheFor(ctx.key)
  );
  const written = await saveChat(ctx.characterIndex, ctx.chatIndex, next, latest);
  if (activeContextKey() === ctx.key) invalidateLoaded();
  return { chat: written, doc };
}

export async function commitManualEvents(loaded, events, label, review = { source: 'manual' }, refresh = true) {
  if (!loaded || !Array.isArray(events) || !events.length) throw new Error('No manual events to commit');
  await writeDocument(loaded, (doc, latest) => {
    if (loaded.expectedFingerprint && replayFingerprint(latest) !== loaded.expectedFingerprint)
      throw new Error(t('ledger.003'));
    // Validate against the state the rows will actually follow.
    const state = fold(latest, doc, { checkpoint: readCache(latest)?.checkpoint || null });
    const after = messageId(latest.message?.at(-1));
    for (const event of events) {
      const codex = ['skill', 'monster'].includes(event?.domain);
      const applied = codex ? Codex.applyEvent(state.codex, event) : Core.applyEvent(state.item.registry, event);
      if (applied == null) throw new Error(t('ledger.002'));
      doc.seq += 1;
      doc.manual.push({
        id: `m${doc.seq.toString(36)}`,
        a: after,
        d: codex ? 'codex' : 'item',
        e: Core.clone(event),
        l: label,
        r: review,
        s: doc.seq,
        t: Date.now()
      });
    }
  });
  setStatus(t('ledger.001', label, events.length));
  void emit('data-reset');
  return refresh ? rebuildCurrent() : null;
}

export async function saveHistoryPreference(loaded, update) {
  const active = await context();
  if (!active || active.key !== loaded.key) throw new Error(t('ui-panel.057'));
  const result = await writeDocument(active, (doc) => {
    update(doc.prefs);
  });
  // Preferences are display policy: the fold is unchanged, only the inputs moved.
  loaded.prefs = result.doc.prefs;
  loaded.doc = result.doc;
  loaded.chat = result.chat;
  loaded.replayFingerprint = replayFingerprint(result.chat);
  updateCachedChat(loaded.key, result.chat);
  storeLoaded(loaded);
}

export function requireBackupIdle(chat) {
  if (!chat || chatIsStreaming(chat)) throw new Error(t('ledger.025'));
}

// What a backup preview promises not to have changed before its commit. An
// import is a rare explicit action, so it can afford to hash the whole chat.
const chatSignature = (chat) => Core.fnv1a(JSON.stringify(chat));

export async function exportCurrentBackup(key) {
  const ctx = await context();
  if (!ctx || ctx.key !== key) throw new Error(t('ledger.024'));
  requireBackupIdle(ctx.chat);
  return Backup.capture(project(ctx, await settingsFor(ctx.character), { full: true }));
}

export async function prepareBackupImport(text, key, mode = 'empty') {
  if (!['empty', 'replace'].includes(mode)) throw new Error(t('ledger.023'));
  const value = Backup.parse(text),
    ctx = await context();
  if (!ctx || ctx.key !== key) throw new Error(t('ledger.022'));
  requireBackupIdle(ctx.chat);
  const loaded = project(ctx);
  const previousCounts = [
    loaded.snapshot.registry.order.length,
    loaded.codexSnapshot.skills.order.length,
    loaded.codexSnapshot.monsters.order.length
  ];
  if (mode === 'empty' && previousCounts.some(Boolean)) throw new Error(t('ledger.021'));
  if (mode !== 'replace' && !Backup.counts(value).some(Boolean)) throw new Error(t('ledger.020'));
  return { value, key, mode, previousCounts, expected: chatSignature(ctx.chat) };
}

// A restore becomes the document's base state, folded before every message.
// Events of the chat so far are superseded by it, so their anchors go too.
export async function commitBackupImport(preview) {
  const ctx = await context();
  if (!ctx || ctx.key !== preview.key) throw new Error(t('ledger.019'));
  requireBackupIdle(ctx.chat);
  if (chatSignature(ctx.chat) !== preview.expected) throw new Error(t('ledger.018'));
  const checked = await prepareBackupImport(JSON.stringify(preview.value), preview.key, preview.mode);
  if (checked.expected !== preview.expected) throw new Error(t('ledger.017'));
  await writeDocument(
    ctx,
    (doc, latest) => {
      if (chatSignature(latest) !== preview.expected) throw new Error(t('ledger.016'));
      const restored = Backup.restore(checked.value, latest);
      doc.base = { item: { registry: restored.item.registry, history: restored.item.history }, codex: restored.codex };
      doc.prefs = restored.prefs;
      doc.restoredThrough = messageId(latest.message?.at(-1));
      doc.events = {};
      doc.manual = [];
      if (preview.mode === 'replace') doc.lore = Lorebook.emptyLedger();
      return { chat: mapMessages(latest, stripAnchors).chat, cache: null };
    },
    { idle: true }
  );
  void emit('data-reset');
  setStatus(preview.mode === 'replace' ? t('ledger.015') : t('ledger.014'));
  await rebuildCurrent();
  return checked.value;
}

// A copy of `chat` whose message texts went through `map`; messages that did
// not change are shared.
function mapMessages(chat, map) {
  let changed = 0;
  const message = (chat?.message || []).map((one) => {
    const field = typeof one?.data === 'string' ? 'data' : typeof one?.content === 'string' ? 'content' : '';
    if (!field) return one;
    const next = map(one[field]);
    if (next === one[field]) return one;
    changed += 1;
    return { ...one, [field]: next };
  });
  return { chat: changed ? { ...chat, message } : chat, changed };
}

const tidy = (text) => text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

// Removes every ITEMX trace from a chat: anchors, old markers, stray
// transport tags, and the document, cache and old state keys.
export function cleanChatPluginData(chat) {
  let removedMarkers = 0;
  const mapped = mapMessages(chat, (text) => {
    const count = anchorKeys(text).length + countOldMarkers(text);
    const next = removeOldMarkers(tidy(stripTransport(stripAnchors(text))));
    if (next === text) return text;
    removedMarkers += count;
    return next;
  });
  const scriptstate = { ...(chat?.scriptstate || {}) };
  let removedStateKeys = 0;
  for (const key of [DOCUMENT_KEY, CACHE_KEY, ...OLD_KEYS])
    if (Object.prototype.hasOwnProperty.call(scriptstate, key)) {
      delete scriptstate[key];
      removedStateKeys += 1;
    }
  return {
    chat: { ...mapped.chat, scriptstate },
    cleanedMessages: mapped.changed,
    removedMarkers,
    removedStateKeys
  };
}

async function requireIdleActive(errors) {
  const ctx = await context();
  if (!ctx) throw new Error(errors.missing);
  const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
  if (!latest) throw new Error(errors.unreadable);
  if (chatIsStreaming(latest)) throw new Error(errors.streaming);
  return { ctx, latest };
}

function forgetChatRuntime(ctx) {
  setLatestKeys([]);
  dropPending(pendingEntries(ctx.key).map(([key]) => key));
  workQueue.forget('catch-up');
  workQueue.forget('aux-settle');
  invalidateLoaded();
  void emit('data-reset');
}

export async function cleanCurrentChatItemx() {
  const { ctx, latest } = await requireIdleActive({
    missing: t('ledger.013'),
    unreadable: t('ledger.011'),
    streaming: t('ledger.010')
  });
  const cleaned = cleanChatPluginData(latest);
  await saveChat(ctx.characterIndex, ctx.chatIndex, cleaned.chat, latest);
  // Cleanup is for leaving ITEMX behind. Disable the bot only after the write
  // succeeded so catch-up cannot recreate what was just removed.
  await changeSettings(ctx.character, { enabled: false });
  forgetChatRuntime(ctx);
  setStatus(t('ledger.009', cleaned.removedMarkers));
  const loaded = await rebuildCurrent();
  if (loaded) loaded.enabled = false;
  return { ...cleaned, loaded };
}

// Removes the markers of ITEMX 2.0 – 2.3 from message text. Their data is not
// read by this version; the text keeps everything else.
export async function removeOldMarkersCurrent() {
  const { ctx, latest } = await requireIdleActive({
    missing: t('ledger.013'),
    unreadable: t('ledger.011'),
    streaming: t('ledger.010')
  });
  let removedMarkers = 0;
  const mapped = mapMessages(latest, (text) => {
    removedMarkers += countOldMarkers(text);
    return removeOldMarkers(text);
  });
  if (mapped.changed) await saveChat(ctx.characterIndex, ctx.chatIndex, mapped.chat, latest);
  invalidateLoaded();
  void emit('data-reset');
  setStatus(t('ledger.old-markers-done', removedMarkers));
  const loaded = await rebuildCurrent();
  return { cleanedMessages: mapped.changed, removedMarkers, loaded };
}

export async function removeLegacyPluginStorage() {
  const storage = host().pluginStorage;
  if (typeof storage?.keys !== 'function' || typeof storage?.removeItem !== 'function') return 0;
  let keys;
  try {
    keys = await storage.keys();
  } catch {
    return 0;
  }
  if (!Array.isArray(keys)) return 0;
  let removed = 0;
  for (const key of keys.filter((one) => String(one).startsWith('auxZero')))
    try {
      await storage.removeItem(key);
      removed += 1;
    } catch {}
  return removed;
}

export function itemxStorageFootprint(chat) {
  const { stateBytes, oldBytes } = footprint(chat);
  let anchorCount = 0,
    oldMarkerCount = 0;
  for (const message of chat?.message || []) {
    const text = Core.messageText(message);
    if (!text.includes('<!--')) continue;
    anchorCount += anchorKeys(text).length;
    oldMarkerCount += countOldMarkers(text);
  }
  return { stateBytes, oldBytes, anchorCount, oldMarkerCount, totalBytes: stateBytes + oldBytes };
}

// Drops events whose anchors are gone for good (rerolled or deleted), the
// guards of deleted messages and the old state keys, and stores a fresh
// checkpoint. The fold of the current chat is unchanged.
export async function compactCurrentChatStorage() {
  const { ctx, latest } = await requireIdleActive({
    missing: t('ledger.008'),
    unreadable: t('ledger.006'),
    streaming: t('ledger.005')
  });
  const before = itemxStorageFootprint(latest);
  const doc = readDocument(latest);
  const live = new Map();
  for (const message of latest.message || [])
    for (const key of anchorKeys(Core.messageText(message))) live.set(key, messageId(message));
  for (const [key, row] of Object.entries(doc.events)) if (live.get(key) !== row.c) delete doc.events[key];
  const ids = new Set((latest.message || []).map(messageId));
  for (const id of Object.keys(doc.guards.aux)) if (!ids.has(id)) delete doc.guards.aux[id];
  const folded = fold(latest, doc, { full: true });
  const scriptstate = { ...(latest.scriptstate || {}) };
  for (const key of OLD_KEYS) delete scriptstate[key];
  const next = withDocument(
    { ...latest, scriptstate },
    doc,
    folded.checkpoint ? { v: 1, checkpoint: folded.checkpoint } : null
  );
  await saveChat(ctx.characterIndex, ctx.chatIndex, next, latest);
  const legacyKeysRemoved = await removeLegacyPluginStorage();
  const after = itemxStorageFootprint(next);
  invalidateLoaded();
  void emit('data-reset');
  const savedBytes = Math.max(0, before.totalBytes - after.totalBytes);
  setStatus(t('ledger.004', Math.round(savedBytes / 1024)));
  const loaded = await rebuildCurrent();
  return { before, after, savedBytes, legacyKeysRemoved, loaded };
}
