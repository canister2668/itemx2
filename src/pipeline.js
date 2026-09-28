/* Model pipeline: request protocol injection, output transport extraction and
 * the committed-output catch-up. Emits `chat-synced` for the UI to follow. */
import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import * as EntityHistory from './engine/history.js';
import { scrollActive } from './activity.js';
import {
  assistantMessageIndex,
  automaticAuxReady,
  automaticAuxSettled,
  auxActive,
  recoverAuxiliaryOutput
} from './aux.js';
import { context, readChat, saveChat } from './chat-io.js';
import {
  ITEMX_AUX_AUTO_ATTEMPTS,
  ITEMX_AUX_SETTLE_MS,
  ITEMX_CODEX_REF_RE,
  ITEMX_PROTOCOL_TEXT,
  ITEMX_REF_RE
} from './config.js';
import { hookState, isUnloading } from './connection.js';
import { emit } from './events.js';
import { t } from './i18n.js';
import { debugRecord, dispatch, fail, workQueue } from './kernel.js';
import {
  assertLogReadable,
  buildMessageEventLookup,
  cachedOrRebuildCurrent,
  compactMessageTransports,
  rebuildCodexWithLedger,
  rebuildCurrent,
  rebuildWithManual,
  refreshLatest
} from './ledger.js';
import { enrichPendingChat, scanLorebookEncounters } from './lore-sync.js';
import { markerCodes, messageData } from './markers.js';
import {
  combinedPortraitAssets,
  encounterEntities,
  modulePortraitAssets,
  prepareInlinePortraits
} from './portraits.js';
import { activeContextKey, currentLatestMarkers, invalidateLoaded, setLatestMarkers } from './session.js';
import { isEnabled, settingsFor } from './settings.js';
import { setStatus } from './status.js';

export function itemxProtocolText(rarityMode = 'world') {
  const policy =
    rarityMode === 'itemx'
      ? `## ITEMX Rarity Policy: FORCED\nITEMX rarity is an internal relative power and visual tier, not necessarily the world's printed grade name. Preserve the setting's local grade wording in display. An explicit user-requested ITEMX tier always wins. When the narrative conclusively establishes a newly appraised item as the setting's absolute highest grade, ultimate pinnacle, server/world-unique apex, or beyond the existing grade system, emit rarity=empyrean even if the setting calls that grade Epic; keep the local wording and distinction in display. Use mythical or legendary for clearly lower relative standings. Do not promote from ornate prose alone: the apex standing must be settled by the narrative.`
      : `## ITEMX Rarity Policy: WORLD FIRST\nTreat the setting's literal item grade as authoritative. Map its stated grade to the nearest literal ITEMX rarity and do not promote it merely because it is described as the setting's best. Preserve the local grade wording in display.`;
  return `${ITEMX_PROTOCOL_TEXT}\n\n${policy}`;
}

export const enabledCodexDomains = (settings) =>
  [settings.skillsEnabled && 'skill', settings.encountersEnabled && 'monster'].filter(Boolean);

export const stripItemTransport = (content) =>
  Core.extractResponse(String(content || ''), Core.newRegistry()).content.replace(Core.MARKER_RE, '');

export const stripAllTransport = (content) =>
  Codex.extractResponse(stripItemTransport(content), Codex.snapshot(), {
    enabledDomains: []
  }).content.replace(Codex.MARKER_RE, '');

export const OWNED_TRANSPORT_HINT_RE =
  /<!--(?:ITEMX2|CODEX2)(?::|@)|<\/?(?:itemExam|itemPatch|itemx|skillExam|skillPatch|monsterExam|monsterPatch)\b|\[(?:itemx|아이템)\s*:/i;

export function processTransportStripper(content) {
  const source = Core.stripInventoryEcho(content);
  if (!OWNED_TRANSPORT_HINT_RE.test(source)) return source;
  return stripAllTransport(source)
    .replace(ITEMX_REF_RE, '')
    .replace(ITEMX_CODEX_REF_RE, '')
    .replace(/\[(?:itemx|아이템)\s*:[^\]\r\n]{0,2048}\]/gi, '');
}

export function protocolForSettings(settings, character, moduleAssets = [], options = {}) {
  const parts = [];
  if (settings.itemsEnabled) parts.push(itemxProtocolText(settings.rarityMode));
  const domains = enabledCodexDomains(settings);
  if (domains.length) {
    const portraitRows = domains.includes('monster')
      ? combinedPortraitAssets(character, moduleAssets, Codex.ASSET_CATALOG_MAX)
      : [];
    const names = Codex.portraitProtocolNames(portraitRows, {
      narrative: options.narrative || '',
      entities: options.entities || [],
      max: Codex.PORTRAIT_PROTOCOL_MAX
    });
    parts.push(Codex.protocol(names, { enabledDomains: domains, rarityMode: settings.rarityMode }));
  }
  return parts.join('\n\n');
}

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

export function anchorText(value) {
  return String(value || '')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

export function positionMarkersByNarrative(content) {
  // Planning is not visible narrative. A name mentioned there must never
  // pull a committed card out of the response body.
  const protectedResult = Core.protectPlanning(content, (masked) => ({
    content: positionMarkersByNarrative(masked)
  }));
  if (protectedResult) return protectedResult.content;
  const source = String(content || '');
  const markers = [];
  source.replace(Core.MARKER_RE, (_, code, index) => {
    const payload = Core.decodePayload(code);
    markers.push({ code, payload, prefix: 'ITEMX2', index });
    return '';
  });
  source.replace(Codex.MARKER_RE, (_, code, index) => {
    const payload = Codex.decodePayload(code);
    markers.push({ code, payload, prefix: 'CODEX2', index });
    return '';
  });
  markers.sort((a, b) => a.index - b.index);
  if (!markers.length) return source;

  const narrative = source.replace(Core.MARKER_RE, '').replace(Codex.MARKER_RE, '').trimEnd();
  const pieces = narrative.split(/(\n{2,})/);
  const placements = new Map();
  const trailerIndex = pieces.findIndex(
    (piece, index) =>
      index % 2 === 0 && /^\s*(?:\[(?:status|state|route)\b|<(?:state|status|route|risu[-_]))/i.test(piece)
  );
  for (const marker of markers) {
    const item =
      marker.prefix === 'ITEMX2'
        ? marker.payload?.event?.kind === 'exam'
          ? marker.payload.event.item
          : marker.payload?.view
        : marker.payload?.view || marker.payload?.event?.entity;
    const name = String(item?.name || '').trim();
    const exact = anchorText(name);
    const terms = name
      .split(/[\s·:()[\]{}〈〉《》「」『』/\\,_-]+/u)
      .map(anchorText)
      .filter((term) => term.length >= 2);
    let bestIndex = -1,
      bestScore = 0;
    for (let index = 0; index < pieces.length; index += 2) {
      const paragraph = anchorText(pieces[index]);
      if (!paragraph) continue;
      const exactHit = exact.length >= 2 && paragraph.includes(exact);
      const hits = terms.filter((term) => paragraph.includes(term)).length;
      const enoughTerms = terms.length > 1 ? hits >= Math.min(2, terms.length) : hits === 1;
      if (!exactHit && !enoughTerms) continue;
      const score = (exactHit ? 10000 : 0) + hits * 100;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) {
      const prefixText = source.slice(0, marker.index).replace(Core.MARKER_RE, '').replace(Codex.MARKER_RE, '');
      bestIndex = Math.min(Math.max(0, (prefixText.split(/\n{2,}/).length - 1) * 2), Math.max(0, pieces.length - 1));
      if (bestIndex % 2) bestIndex -= 1;
      if (trailerIndex >= 0 && bestIndex >= trailerIndex) bestIndex = Math.max(0, trailerIndex - 2);
    }
    if (trailerIndex >= 0 && bestIndex >= trailerIndex) bestIndex = Math.max(0, trailerIndex - 2);
    const list = placements.get(bestIndex) || [];
    list.push(marker);
    placements.set(bestIndex, list);
  }
  for (const [index, rows] of placements) {
    pieces[index] = `${pieces[index].trimEnd()}\n\n${rows.map((row) => `<!--${row.prefix}:${row.code}-->`).join('\n')}`;
  }
  let positioned = pieces.join('').trimEnd();
  return positioned;
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

export async function repairCommittedTransport(ctx, index, source) {
  if (assertLogReadable(ctx?.chat)) return null;
  const settings = await settingsFor(ctx.character);
  const lookup = buildMessageEventLookup(ctx.chat);
  const base = rebuildWithManual(ctx.chat, lookup).registry;
  const parsed = settings.itemsEnabled
    ? Core.extractResponse(source, base)
    : { content: stripItemTransport(source), events: [], errors: [] };
  const codexBase = rebuildCodexWithLedger(ctx.chat, lookup, { rarityMode: settings.rarityMode });
  const codexParsed = Codex.extractResponse(parsed.content, codexBase, {
    enabledDomains: enabledCodexDomains(settings),
    rarityMode: settings.rarityMode,
    skillEvidenceText: source
  });
  const positioned = positionMarkersByNarrative(codexParsed.content);
  const needsCompaction = Core.MARKER_RE.test(positioned) || Codex.MARKER_RE.test(positioned);
  Core.MARKER_RE.lastIndex = 0;
  Codex.MARKER_RE.lastIndex = 0;
  if (positioned === source && !needsCompaction) return { ctx, source };
  const latest = await readChat(ctx.characterIndex, ctx.chatIndex);
  if (!latest || Core.fnv1a(messageData(latest.message?.[index])) !== Core.fnv1a(source)) return null;
  const next = Core.clone(latest);
  const message = next.message?.[index];
  if (typeof message?.data === 'string') message.data = positioned;
  else if (typeof message?.content === 'string') message.content = positioned;
  else return null;
  const compacted = compactMessageTransports(next, index).chat;
  const compactedSource = messageData(compacted.message?.[index]);
  const compactedLookup = buildMessageEventLookup(compacted);
  const snapshot = rebuildWithManual(compacted, compactedLookup);
  const stillActive = activeContextKey() === ctx.key;
  if (stillActive) {
    refreshLatest(compacted, compactedLookup);
    void emit('data-reset');
    invalidateLoaded();
    workQueue.remember('host-settling', ctx.key);
  }
  await saveChat(
    ctx.characterIndex,
    ctx.chatIndex,
    await enrichPendingChat(ctx, Core.writeSnapshot(compacted, snapshot)),
    latest
  );
  const errors = parsed.errors.length + codexParsed.errors.length,
    events = parsed.events.length + codexParsed.events.length;
  if (stillActive) setStatus(errors ? t('pipeline.010', errors) : t('pipeline.009', events));
  return { ctx: { ...ctx, chat: compacted }, source: compactedSource };
}

export async function catchUpLatestOutput({ syncUi = true } = {}) {
  if (!activeContextKey() || auxActive() > 0 || scrollActive()) return;
  let ctx = await context();
  if (!ctx || !(await isEnabled(ctx.character))) return;
  const index = assistantMessageIndex(ctx.chat);
  if (index < 0) return;
  let source = messageData(ctx.chat.message[index]);
  if (!automaticAuxReady(ctx.chat, index, source)) return;
  if (!automaticAuxSettled(ctx, index, source)) {
    // The first sighting never counts as settled. Without this re-check the listener path
    // waits for the 45 s watchdog before the auxiliary pass runs.
    workQueue.schedule(
      'auxSettleTimer',
      () => catchUpLatestOutput({ syncUi }).catch((error) => fail('aux settle re-check', error)),
      ITEMX_AUX_SETTLE_MS + 150
    );
    return;
  }
  const repaired = await repairCommittedTransport(ctx, index, source);
  if (!repaired) return;
  ctx = repaired.ctx;
  if (activeContextKey() !== ctx.key) return;
  // The guard must survive our own rewrite. recoverAuxiliaryOutput commits a new
  // message body, so a body-derived hash invalidates itself and the next open of
  // the same chat re-runs recovery forever. Anchor on the stable message id.
  const messageId = ctx.chat.message?.[index]?.chatId || `idx-${index}`;
  const fingerprint = `${ctx.key}:${index}:msg-${messageId}`;
  const attempt = await workQueue.attempt(
    'catch-up',
    fingerprint,
    () => recoverAuxiliaryOutput({ messageIndex: index }),
    Array.isArray,
    Infinity,
    ITEMX_AUX_AUTO_ATTEMPTS
  );
  if (attempt.skipped) return;
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
  // request. Removing its card markers here makes them impossible to retain.
  if (/translate/i.test(String(type || ''))) return messages || [];
  const safeMessages = (messages || []).map((message) => ({
    ...message,
    content: processTransportStripper(message.content)
  }));
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

export const processHandler = async (content) => processTransportStripper(content);

export async function processOutput(content, type) {
  if (!mainRequestType(type)) return content;
  content = Core.stripInventoryEcho(content);
  // Streaming calls this per flush. Without any owned marker or tag there is nothing to
  // extract, so skip the full chat read and ledger rebuild.
  if (!OWNED_TRANSPORT_HINT_RE.test(content)) return content;
  try {
    const ctx = await context();
    if (!ctx) return content;
    const enabled = await isEnabled(ctx.character);
    const settings = await settingsFor(ctx.character);
    if (!enabled || !settings.mainOutput) return stripAllTransport(content);
    const lookup = buildMessageEventLookup(ctx.chat);
    const base = rebuildWithManual(ctx.chat, lookup).registry;
    const result = settings.itemsEnabled
      ? Core.extractResponse(content, base)
      : { content: stripItemTransport(content), events: [], errors: [] };
    const codexResult = Codex.extractResponse(
      result.content,
      rebuildCodexWithLedger(ctx.chat, lookup, { rarityMode: settings.rarityMode }),
      { enabledDomains: enabledCodexDomains(settings), rarityMode: settings.rarityMode, skillEvidenceText: content }
    );
    const reviewed = codexResult.content.replace(/<!--(ITEMX2|CODEX2):([A-Za-z0-9_-]+)-->/g, (raw, prefix, code) => {
      const core = prefix === 'ITEMX2' ? Core : Codex;
      const payload = core.decodePayload(code);
      return payload?.event
        ? core.marker({ ...payload, review: payload.review || { source: 'main', checked: false } })
        : raw;
    });
    prepareInlinePortraits(ctx, codexResult.snapshot, settings);
    const positioned = positionMarkersByNarrative(reviewed);
    void emit('markers-armed', positioned);
    if (
      result.events.length ||
      result.errors.length ||
      codexResult.events.length ||
      codexResult.errors.length ||
      codexResult.content !== content
    ) {
      setLatestMarkers(markerCodes(positioned));
      void emit('markers');
      workQueue.remember('uncommitted-markers', new Set(currentLatestMarkers()));
      const errors = result.errors.length + codexResult.errors.length,
        events = result.events.length + codexResult.events.length;
      setStatus(errors ? t('pipeline.008', errors) : t('pipeline.007', events));
      invalidateLoaded({ drop: false });
      debugRecord('processOutput', {
        itemEvents: result.events.length,
        codexEvents: codexResult.events.length,
        errors
      });
    }
    return positioned;
  } catch (error) {
    fail('processOutput', error);
    return stripAllTransport(content);
  }
}

export const afterRequest = async (content, type) => processOutput(content, type);

export const outputFallback = async (content) => {
  const processed = await processOutput(content, 'main');
  if (hookState('listener') === 'unsupported' && auxActive() === 0) scheduleLegacyCommitRecovery();
  return processed;
};
