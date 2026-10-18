/* Model pipeline: request protocol injection, output anchoring and the commit
 * of a finished response into the ledger document. Emits `chat-synced` for
 * the UI to follow. */
import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import * as EntityHistory from './engine/history.js';
import { markOutputFlush, scrollActive } from './activity.js';
import {
  assistantMessageIndex,
  automaticAuxReady,
  automaticAuxSettled,
  auxActive,
  recoverAuxiliaryOutputNow
} from './aux.js';
import { context } from './chat-io.js';
import { ITEMX_AUX_AUTO_ATTEMPTS, ITEMX_AUX_SETTLE_MS } from './config.js';
import { hookState, isUnloading } from './connection.js';
import { emit } from './events.js';
import { t } from './i18n.js';
import { debugRecord, dispatch, fail, workQueue } from './kernel.js';
import { cachedOrRebuildCurrent, commitRecords, rebuildCurrent, stampFrom, writeDocument } from './ledger.js';
import { enrichLore, scanLorebookEncounters } from './lore-sync.js';
import { encounterEntities, modulePortraitAssets, prepareInlinePortraits } from './portraits.js';
import {
  activeContextKey,
  addPending,
  currentLatestKeys,
  dropPending,
  freshLoaded,
  pendingEntries,
  pendingRecord,
  setPendingOwner,
  setLatestKeys
} from './session.js';
import { isEnabled, settingsFor } from './settings.js';
import { setStatus } from './status.js';
import { anchorKeys, messageKeys, stripTransport } from './store/anchors.js';
import { readDocument } from './store/document.js';
import { forgetStoredPending, restoreStoredPending, storePending } from './pending-store.js';
import { fold, stampStart } from './store/replay.js';
import { anchorize, enabledCodexDomains, hasRawTransport, protocolForSettings, requestSafeText } from './transport.js';

export function mainRequestType(type) {
  return !/(translate|emotion|memory|otherax|aux|submodel|image|tts)/i.test(String(type || ''));
}

export function requestEndsWithModelTurn(messages) {
  if (!Array.isArray(messages) || !messages.length) return false;
  const last = messages[messages.length - 1] || {};
  const role = String(last.role || '').trim();
  // Risu's Google formatter handles multimodal messages before its normal
  // role switch and maps every non-user multimodal turn to Gemini `model`.
  if (Array.isArray(last.multimodals) && last.multimodals.length > 0) {
    return !/^(?:user|human)$/i.test(role);
  }
  return /^(?:assistant|model|char)$/i.test(role);
}

export function injectRequestProtocol(messages, instruction) {
  const protocol = { role: 'system', content: instruction, name: 'ITEMX_2_PROTOCOL' };
  // Risu's Google formatter converts a non-leading system turn following a
  // model turn into a user turn. This preserves continuation semantics while
  // satisfying Gemini's requirement that requests never end with model.
  return requestEndsWithModelTurn(messages) ? [...messages, protocol] : [protocol, ...messages];
}

// Seed of the anchor keys of the response being generated in `loaded`'s chat:
// the triggering user message, stable for every flush and hook pass of one
// response, including a pass the host runs again after the commit. A reroll
// gets fresh keys because the committed ones no longer stand in any message.
function turnSeed(loaded) {
  const messages = loaded.chat?.message || [];
  let user = '';
  for (let index = messages.length - 1; index >= 0 && !user; index -= 1)
    if (/^(?:user|human)$/i.test(String(messages[index]?.role || ''))) user = messages[index].chatId || `u${index}`;
  return `${loaded.key}|${user}`;
}

function liveAnchorIn(chat) {
  return (key, row) => {
    const owner = (chat?.message || []).find((message) => message?.chatId && message.chatId === row.c);
    return Boolean(owner && messageKeys(owner).includes(key));
  };
}

export function scheduleLegacyCommitRecovery(confirm = false) {
  if (auxActive() > 0) return;
  workQueue.clearTimer('legacyCommitTimer');
  workQueue.schedule(
    'legacyCommitTimer',
    async () => {
      try {
        await catchUpLatestOutput({ syncUi: false });
        await syncAfterCommit();
        if (!confirm && auxActive() === 0) scheduleLegacyCommitRecovery(true);
      } catch (error) {
        fail('legacy commit recovery', error);
      }
    },
    1800,
    false
  );
}

// Card anchors this response was given but no longer carries, when it still
// carries others: proof it is the same response, edited after ITEMX anchored
// it (typically by another output-rewriting plugin). Without a surviving
// anchor identity is uncertain (reroll, deletion), so nothing is reported.
// Diagnostic only: no repair, no write, no model call.
const reportedAnchorLoss = new Set();
export function lostAnchors(chatKey, source, latest = currentLatestKeys()) {
  const ours = [...latest].filter((key) => pendingRecord(key)?.chatKey === chatKey);
  const present = new Set(anchorKeys(source));
  if (!ours.some((key) => present.has(key))) return [];
  return ours.filter((key) => !present.has(key));
}

// Pending records of earlier messages whose own commit failed (in this
// session, or restored after a reload). Each remembers its owner message id,
// so only that message is looked up, from the end and within a short window:
// a long chat is never scanned, and an owner further back is left alone.
const ORPHAN_WINDOW = 24;
function orphanPending(ctx, latestIndex) {
  const owners = new Map();
  for (const [key, record] of pendingEntries(ctx.key))
    if (record.owner) owners.set(record.owner, [...(owners.get(record.owner) || []), key]);
  if (!owners.size) return [];
  const messages = ctx.chat.message || [];
  const rows = [];
  for (
    let index = messages.length - 1;
    index >= Math.max(0, messages.length - ORPHAN_WINDOW) && owners.size;
    index -= 1
  ) {
    const keys = owners.get(messages[index]?.chatId);
    if (!keys || index === latestIndex) continue;
    owners.delete(messages[index].chatId);
    const present = messageKeys(messages[index]);
    for (const key of keys) if (present.includes(key)) rows.push({ key, index });
  }
  return rows;
}

// Consecutive failed commits per chat; the user is told once per chat until
// a commit lands again.
const commitFailures = new Map();

// Commits the latest response: its anchors whose parsed records are pending
// become document events owned by the message, and raw tags the output hook
// never saw are anchored now. One write, lore enrichment included.
export async function commitLatestOutput(ctx) {
  const index = assistantMessageIndex(ctx.chat);
  if (index < 0) return { ctx, index, changed: false };
  await restoreStoredPending(ctx.key);
  const source = Core.messageText(ctx.chat.message[index]);
  const pending = anchorKeys(source).filter((key) => pendingRecord(key)?.chatKey === ctx.key);
  const lost = lostAnchors(ctx.key, source);
  if (lost.length && !reportedAnchorLoss.has(lost.join())) {
    reportedAnchorLoss.add(lost.join());
    debugRecord('anchor changed', { lost: lost.length, kept: pending.length });
    setStatus(t('pipeline.anchor-changed', lost.length));
    void emit('notify', { message: t('pipeline.anchor-changed', lost.length), tone: 'error' });
  }
  const raw = hasRawTransport(source);
  const orphans = orphanPending(ctx, index);
  // Without new cards the pass may still owe the chat its state entries: a
  // chat from before them, or entries a reroll or deletion left behind.
  const restamp = pending.length || raw || orphans.length ? -1 : stampStart(ctx.chat, readDocument(ctx.chat));
  if (!pending.length && !raw && !orphans.length && restamp < 0) return { ctx, index, changed: false };
  const settings = await settingsFor(ctx.character);
  let events = 0,
    errors = 0,
    landed = [];
  let result;
  try {
    result = await writeDocument(ctx, async (doc, latest) => {
      const message = latest.message?.[index];
      if (Core.messageText(message) !== source) return false;
      if (restamp >= 0) return stampFrom(doc, latest, restamp) ? {} : false;
      // An orphan lands only while its anchor still stands in its message.
      const orphanRows = orphans.filter(
        (row) => !doc.events[row.key] && messageKeys(latest.message?.[row.index]).includes(row.key)
      );
      for (const row of orphanRows) {
        const owner = latest.message[row.index];
        commitRecords(
          doc,
          [{ key: row.key, ...pendingRecord(row.key) }],
          typeof owner?.chatId === 'string' ? owner.chatId : ''
        );
      }
      const chatId = typeof message?.chatId === 'string' ? message.chatId : '';
      const fresh = pending.filter((key) => !doc.events[key]);
      commitRecords(
        doc,
        fresh.map((key) => ({ key, ...pendingRecord(key) })),
        chatId
      );
      // Orphans another write already landed are done too.
      landed = [...orphans.map((row) => row.key), ...fresh];
      let text = source;
      if (raw) {
        const state = fold(latest, doc, { upTo: index });
        const anchored = anchorize(source, {
          state: { registry: state.item.registry, codex: state.codex },
          settings,
          seed: `${ctx.key}|${index}|repair|${doc.seq}`,
          doc
        });
        commitRecords(doc, anchored.records, chatId);
        text = anchored.content;
        events = anchored.events;
        errors = anchored.errors;
      }
      const field = typeof message.data === 'string' ? 'data' : 'content';
      const chat =
        text === source
          ? latest
          : { ...latest, message: latest.message.map((one, at) => (at === index ? { ...one, [field]: text } : one)) };
      stampFrom(doc, chat, Math.min(index, ...orphanRows.map((row) => row.index)));
      await enrichLore(ctx, doc, chat);
      return { chat };
    });
  } catch (error) {
    // Keep what was parsed, with the message that owns it: memory alone does
    // not survive a reload.
    const owner = ctx.chat.message?.[index]?.chatId;
    if (typeof owner === 'string' && owner) setPendingOwner(pending, owner);
    const keys = [...pending, ...orphans.map((row) => row.key)];
    await storePending(ctx.key, keys).catch((storeError) => debugRecord('pending store write', storeError?.message));
    const failures = (commitFailures.get(ctx.key) || 0) + 1;
    commitFailures.set(ctx.key, failures);
    if (failures === 1 && keys.length) {
      const message = t('pipeline.commit-failed', keys.length);
      setStatus(message);
      void emit('notify', { message, tone: 'error' });
    }
    throw error;
  }
  if (!result) return { ctx, index, changed: false };
  commitFailures.delete(ctx.key);
  dropPending([...pending, ...landed]);
  await forgetStoredPending(ctx.key, [...pending, ...landed]).catch((error) =>
    debugRecord('pending store forget', error?.message)
  );
  const stillActive = activeContextKey() === ctx.key;
  if (stillActive) {
    workQueue.remember('host-settling', ctx.key);
    void emit('data-reset');
    if (raw) setStatus(errors ? t('pipeline.010', errors) : t('pipeline.009', events));
  }
  debugRecord('commit output', {
    committed: pending.length,
    orphans: landed.length - pending.length,
    repaired: raw,
    events,
    errors
  });
  return { ctx: { ...ctx, chat: result.chat }, index, changed: true };
}

// Every pass that reached the model counts toward the retry limit, whether it
// failed or lost its write; a race before any model call is tried again soon.
export const auxVerdict = (result) =>
  result.status === 'ok' || result.status === 'skip' ? true : result.called ? false : 'retry';

export async function catchUpLatestOutput({ syncUi = true } = {}) {
  if (!activeContextKey() || auxActive() > 0 || scrollActive()) return;
  let ctx = await context();
  if (!ctx || !(await isEnabled(ctx.character))) return;
  const index = assistantMessageIndex(ctx.chat);
  if (index < 0) return;
  const source = Core.messageText(ctx.chat.message[index]);
  if (!automaticAuxReady(ctx.chat, index, source)) return;
  // The finished response is committed at once; only the auxiliary pass waits
  // for the text to settle.
  const committed = await commitLatestOutput(ctx);
  ctx = committed.ctx;
  if (activeContextKey() !== ctx.key) return;
  if (!automaticAuxSettled(ctx, index, Core.messageText(ctx.chat.message[index]))) {
    // The first sighting never counts as settled. Without this re-check the listener path
    // waits for the 45 s watchdog before the auxiliary pass runs.
    workQueue.schedule(
      'auxSettleTimer',
      () => catchUpLatestOutput({ syncUi }).catch((error) => fail('aux settle re-check', error)),
      ITEMX_AUX_SETTLE_MS + 150
    );
    if (committed.changed && syncUi) await syncAfterCommit();
    return;
  }
  const messageId = ctx.chat.message?.[index]?.chatId || `idx-${index}`;
  const attempt = await workQueue.attempt(
    'catch-up',
    `${ctx.key}:${index}:msg-${messageId}`,
    () => recoverAuxiliaryOutputNow({ messageIndex: index }),
    auxVerdict,
    Infinity,
    ITEMX_AUX_AUTO_ATTEMPTS
  );
  if ((attempt.skipped || !attempt.value?.events.length) && !committed.changed) return;
  if (syncUi) await syncAfterCommit();
}

// After a commit: rebuild the projection, apply lorebook enrichment, and let the
// UI (event bursts, drawer) follow the new state.
export async function syncAfterCommit() {
  const loaded = await rebuildCurrent();
  if (loaded?.encountersEnabled && loaded?.lorebookEncounterEnabled) await scanLorebookEncounters({ silent: true });
  await emit('chat-synced', loaded);
  return loaded;
}

export function scheduleCommittedOutputSync() {
  return dispatch(
    'committed-output',
    async () => {
      await catchUpLatestOutput({ syncUi: false });
      await syncAfterCommit();
    },
    false,
    { ready: () => !scrollActive() }
  ).catch((error) => fail('chat listener', error));
}

export function armCatchUpWatchdog() {
  if (isUnloading()) return;
  workQueue.clearTimer('catchUpTimer');
  const interval = hookState('listener') === true ? 45000 : 4500;
  workQueue.schedule(
    'catchUpTimer',
    () => {
      return catchUpLatestOutput().catch((error) => fail('latest output catch-up', error));
    },
    interval,
    true
  );
}

export const beforeRequest = async (messages, type) => {
  // Translation is a view of the original response, not a new world-state
  // request; its text is left as the host built it.
  if (/translate/i.test(String(type || ''))) return messages || [];
  const safeMessages = (messages || []).map((message) =>
    typeof message?.content === 'string' ? { ...message, content: requestSafeText(message.content) } : message
  );
  if (!mainRequestType(type)) return safeMessages;
  try {
    const loaded = await cachedOrRebuildCurrent();
    if (!loaded || !(await isEnabled(loaded.character))) return safeMessages;
    const settings = await settingsFor(loaded.character);
    if (!settings.mainOutput) return safeMessages;
    if (!settings.itemsEnabled && !settings.skillsEnabled && !settings.encountersEnabled) return safeMessages;
    const recent = safeMessages
      .slice(-4)
      .map((message) => message.content || '')
      .join('\n');
    const domains = enabledCodexDomains(settings);
    const moduleAssets = settings.encountersEnabled
      ? await modulePortraitAssets(settings, loaded.character, loaded.chat)
      : [];
    const instruction = `${protocolForSettings(settings, loaded.character, moduleAssets, { narrative: recent, entities: encounterEntities(loaded.codexSnapshot) })}${settings.itemsEnabled ? `\n\n${Core.anchor(EntityHistory.requestSnapshot(loaded, recent))}` : ''}${domains.length ? `\n\n${Codex.anchor(loaded.codexSnapshot, recent, 9000, { enabledDomains: domains })}` : ''}`;
    debugRecord('beforeRequest', {
      items: settings.itemsEnabled,
      skills: settings.skillsEnabled,
      encounters: settings.encountersEnabled,
      messages: safeMessages.length
    });
    return injectRequestProtocol(safeMessages, instruction);
  } catch (error) {
    fail('beforeRequest', error);
    return safeMessages;
  }
};

export const processHandler = async (content) => requestSafeText(content);

// Anchors a model response. The parsed records wait in the session until the
// finished response is committed; the display hook renders them meanwhile.
export async function processOutput(content, type) {
  if (!mainRequestType(type)) return content;
  content = Core.stripInventoryEcho(content);
  // Without a raw tag there is nothing to parse.
  if (!hasRawTransport(content)) return content;
  try {
    // Streaming calls this per flush. The projection beforeRequest just built
    // is still fresh, so a flush reads nothing from the host.
    const loaded = freshLoaded() || (await cachedOrRebuildCurrent());
    if (!loaded) return content;
    if (!(await isEnabled(loaded.character)) || !loaded.mainOutput) return stripTransport(content);
    const result = anchorize(content, {
      state: { registry: loaded.snapshot.registry, codex: loaded.codexSnapshot },
      settings: loaded,
      seed: turnSeed(loaded),
      doc: loaded.doc,
      liveAnchor: liveAnchorIn(loaded.chat)
    });
    // A key reused from the document is already committed; only new ones wait.
    for (const record of result.records)
      if (!loaded.doc.events[record.key]) addPending(record.key, { ...record, chatKey: loaded.key });
    prepareInlinePortraits(loaded, result.codexSnapshot, loaded);
    if (result.records.length || result.errors) {
      const keys = result.records.map((record) => record.key);
      setLatestKeys(keys);
      void emit('markers');
      void emit('markers-armed', keys);
      setStatus(result.errors ? t('pipeline.008', result.errors) : t('pipeline.007', result.events));
      debugRecord('processOutput', { events: result.events, errors: result.errors });
    }
    return result.content;
  } catch (error) {
    fail('processOutput', error);
    return stripTransport(content);
  }
}

export const afterRequest = async (content, type) => processOutput(content, type);

// The host runs the output script handler for every streaming flush and once
// for a non-streamed main response; each run keeps the output window open.
export const outputFallback = async (content) => {
  markOutputFlush();
  const processed = await processOutput(content, 'main');
  if (hookState('listener') === 'unsupported' && auxActive() === 0) scheduleLegacyCommitRecovery();
  return processed;
};
