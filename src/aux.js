/* ITEMX aux owner. Concatenated inside the runtime closure. */
import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import * as Quality from './engine/quality.js';
import { chatIsStreaming, context, readChat } from './chat-io.js';
import {
  ITEMX_AUX_AUTO_ATTEMPTS,
  ITEMX_AUX_PROMPT_REVISION,
  ITEMX_AUX_SETTLE_MS,
  ITEMX_AUX_TIMEOUT_MS
} from './config.js';
import { isUnloading } from './connection.js';
import { emit } from './events.js';
import { host } from './host.js';
import { t } from './i18n.js';
import { debugRecord, fail, withTimeout, workQueue } from './kernel.js';
import {
  commitManualEvents,
  commitRecords,
  presentationRecord,
  project,
  rebuildCurrent,
  replayFingerprint,
  writeDocument
} from './ledger.js';
import { enrichLore } from './lore-sync.js';
import { encounterEntities, modulePortraitAssets, prepareInlinePortraits } from './portraits.js';
import { activeContextKey, invalidateLoaded } from './session.js';
import { isEnabled, settingsFor } from './settings.js';
import { setStatus } from './status.js';
import { anchorKeys, requestText } from './store/anchors.js';
import { readDocument } from './store/document.js';
import {
  anchorTransport,
  enabledCodexDomains,
  itemxProtocolText,
  protocolForSettings,
  stripItemTransport
} from './transport.js';

const messageData = (message) => Core.messageText(message);
const GUARD_LIMIT = 128;

export function modelText(result) {
  if (typeof result === 'string') return result;
  if (typeof result?.result === 'string') return result.result;
  if (typeof result?.content === 'string') return result.content;
  if (typeof result?.text === 'string') return result.text;
  return '';
}

export function auxiliaryProviderError(value) {
  const text = value instanceof Error ? String(value.message || value) : modelText(value);
  if (
    !/(?:Unknown Plugin detected\. Please change the model or enable the corresponding plugin\.|Plugin calls are blocked by the caller\.)/i.test(
      text
    )
  )
    return null;
  const error = new Error(t('aux.059'));
  error.code = 'AUX_PROVIDER_UNAVAILABLE';
  return error;
}

// Model-call state, private to this module. `active` counts calls in flight;
// `last` is the latest outcome shown by the side indicator and settings card.
let active = 0;
let last = { state: 'idle', label: '', at: 0, events: null };

export const auxActive = () => active;
export const auxLast = () => ({ ...last });

export async function setAuxOutcome(state, label, events = null) {
  last = { state, label, events, at: Date.now() };
  await emit('aux', { active, last: { ...last }, outcome: true });
}

// A timed-out request is abandoned, not cancelled: the provider keeps working
// (and billing) until it answers. It stays counted in `active` until then, so
// no automatic pass starts a second paid request beside it.
export async function runAuxModel(prompt, label = t('aux.041')) {
  if (typeof host().runLLMModel !== 'function') throw new Error(t('aux.040'));
  active += 1;
  last = { state: 'running', label, at: Date.now(), events: null };
  setStatus(label);
  await emit('aux', { active, last: { ...last }, outcome: false });
  let request;
  try {
    request = Promise.resolve(
      host().runLLMModel({ messages: [{ role: 'user', content: prompt }], mode: 'otherAx', allowPlugins: true })
    );
  } catch (error) {
    request = Promise.reject(error);
  }
  const report = async () => {
    if (active === 0) await setAuxOutcome(last.state, last.label, last.events);
    else await emit('aux', { active, last: { ...last }, outcome: false });
  };
  let settled = false,
    returned = false;
  void request
    .catch(() => {})
    .then(async () => {
      settled = true;
      active = Math.max(0, active - 1);
      // After a timeout the caller is long gone; report the late answer here.
      if (returned) await report();
    });
  try {
    const result = await workQueue.external(() => withTimeout(request, ITEMX_AUX_TIMEOUT_MS, t('aux.039')));
    const providerError = auxiliaryProviderError(result);
    if (providerError) throw providerError;
    workQueue.forget('aux-provider');
    last = { state: 'done', label: t('aux.038'), at: Date.now(), events: null };
    return result;
  } catch (error) {
    const providerError = auxiliaryProviderError(error) || error;
    if (providerError?.code === 'AUX_PROVIDER_UNAVAILABLE') workQueue.remember('aux-provider', 'unavailable');
    last = { state: 'failed', label: t('aux.037'), at: Date.now(), events: null };
    throw providerError;
  } finally {
    returned = true;
    if (settled) await report();
  }
}

// The auxiliary pass's record for a message, kept in the document so it
// survives cache loss: which configuration processed it and with what result.
export const auxGuard = (doc, chatId) => doc?.guards?.aux?.[chatId] || null;

function setGuard(doc, chatId, record) {
  const guards = doc.guards.aux;
  delete guards[chatId];
  guards[chatId] = { ...record, at: Date.now() };
  const ids = Object.keys(guards);
  for (const id of ids.slice(0, Math.max(0, ids.length - GUARD_LIMIT))) delete guards[id];
}

export function messageMetadata(message) {
  if (message?.metadata && typeof message.metadata === 'object') return message.metadata;
  try {
    return typeof message?.metadata === 'string' ? JSON.parse(message.metadata) : {};
  } catch {
    return {};
  }
}

export function incompleteCommittedOutput(source) {
  const text = String(source || '').trim();
  if (!text) return true;
  if ((text.match(/```/g) || []).length % 2 === 1) return true;
  for (const tag of ['thoughts', 'analysis']) {
    const opens = (text.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
    const closes = (text.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (opens > closes) return true;
  }
  return /<[^>]*$/.test(text);
}

export function automaticAuxReady(chat, index, source) {
  const message = chat?.message?.[index];
  const metadata = messageMetadata(message);
  return (
    !chat?.isStreaming && !message?.isStreaming && metadata.bgContinue !== true && !incompleteCommittedOutput(source)
  );
}

export function automaticAuxSettled(ctx, index, source) {
  const fingerprint = `${ctx.key}:${index}:${Core.fnv1a(source)}`;
  return workQueue.settled('aux-settle', fingerprint, ITEMX_AUX_SETTLE_MS);
}

export function stateItemEvidence(chat) {
  const rows = [];
  const keyPattern =
    /(weapon|armor|item|inventory|equipment|outfit|accessor|gear|belonging|무기|방어구|아이템|장비|의상|소지품)/i;
  for (const [key, raw] of Object.entries(chat?.scriptstate || {})) {
    // ITEMX must not feed either its own derived state or stale
    // legacy ITEMX module state back to the model as world evidence.
    if (/itemx/i.test(key) || !keyPattern.test(key)) continue;
    const value = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);
    if (!value || /^(?:none|null|undefined|없음|무|0|\[\]|\{\})$/i.test(value)) continue;
    rows.push(`${key} = ${value.slice(0, 500)}`);
    if (rows.length >= 24 || rows.join('\n').length >= 4000) break;
  }
  return rows.length ? rows.join('\n').slice(0, 4000) : '(no item-like state variables)';
}

export const LIGHTBOARD_DATA_RE =
  /(?:^|\n)[ \t]*---[ \t]*\r?\n[ \t]*\[LBDATA START\][\s\S]*?\[LBDATA END\][ \t]*\r?\n[ \t]*---[ \t]*(?=\r?\n|$)/gi;

export function stripAuxiliaryDataBlocks(value) {
  return String(value || '').replace(LIGHTBOARD_DATA_RE, '\n');
}

export function auxiliaryVisibleText(value) {
  const text = requestText(stripAuxiliaryDataBlocks(value)).replace(
    /<(thoughts|analysis)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    ''
  );
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function clipAuxiliaryText(value, max) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  const head = Math.floor(max * 0.42),
    tail = max - head;
  return `${text.slice(0, head)}\n…[middle omitted for bounded auxiliary context]…\n${text.slice(-tail)}`;
}

export function auxiliaryConversationContext(chat, targetIndex) {
  const messages = Array.isArray(chat?.message) ? chat.message : [];
  let userIndex = -1;
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    if (/^(?:user|human)$/i.test(String(messages[index]?.role || messages[index]?.type || ''))) {
      userIndex = index;
      break;
    }
  }
  const triggeringUser =
    userIndex >= 0
      ? clipAuxiliaryText(auxiliaryVisibleText(messageData(messages[userIndex])), 3000)
      : '(triggering user turn unavailable)';
  const rows = [];
  let consumed = 0;
  const historyEnd = userIndex >= 0 ? userIndex : targetIndex;
  for (let index = historyEnd - 1; index >= 0 && rows.length < 6 && consumed < 9000; index -= 1) {
    const message = messages[index];
    const visible = clipAuxiliaryText(auxiliaryVisibleText(messageData(message)), 3600);
    if (!visible) continue;
    const role = /^(?:user|human)$/i.test(String(message?.role || message?.type || '')) ? 'USER' : 'ASSISTANT';
    const row = `[message ${index} · ${role}]\n${visible}`;
    if (consumed + row.length > 9000) {
      const remaining = 9000 - consumed;
      if (remaining >= 500) rows.unshift(clipAuxiliaryText(row, remaining));
      break;
    }
    rows.unshift(row);
    consumed += row.length;
  }
  return { triggeringUser, recent: rows.join('\n\n') || '(no earlier narrative context)' };
}

export function assistantMessageIndex(chat, preferred = null) {
  const messages = Array.isArray(chat?.message) ? chat.message : [];
  if (Number.isInteger(preferred) && preferred >= 0 && preferred < messages.length) return preferred;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!messageData(message).trim()) continue;
    if (/^(?:user|human)$/i.test(String(message?.role || message?.type || ''))) continue;
    return index;
  }
  return -1;
}

// The events a pass committed, [] when it had nothing to do, null when it
// failed or lost a race: the shape the settings action reports.
export async function recoverAuxiliaryOutput(options = {}) {
  const result = await recoverAuxiliaryOutputNow(options);
  return result.status === 'ok' || result.status === 'skip' ? result.events : null;
}

export function stableEventValue(value) {
  if (Array.isArray(value)) return value.map(stableEventValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableEventValue(value[key])])
    );
  return value;
}

export function eventValueKey(value) {
  return JSON.stringify(stableEventValue(value));
}

export function auxiliaryEventReconciler(domain, initial, represented, narrative) {
  const names = new Map(),
    aliases = new Map();
  const normalize = (value) =>
    String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, '');
  const entries = (state) => (domain === 'item' ? state.items : state.monsters.entries);
  const index = (entity) => {
    const name = normalize(entity?.name);
    if (!name) return;
    if (!names.has(name)) names.set(name, new Set());
    names.get(name).add(entity.id);
  };
  Object.values(entries(initial)).forEach(index);
  const repeatedActions = new Set(represented.filter((event) => event.kind === 'patch').map(eventValueKey));
  const lastBatchAction = new Map();
  const known = (value) => value != null && !/^(?:|none|unknown|미상|미분류)$/i.test(String(value).trim());
  const separateMention = (name) => {
    const text = String(narrative || '').normalize('NFKC');
    const at = text.indexOf(name);
    if (at < 0) return false;
    return /또\s*다른|별개|두\s*번째|세\s*번째|한\s*(?:자루|개|마리)\s*더|\b(?:another|different|second|third)\b/i.test(
      text.slice(Math.max(0, at - 65), at + name.length + 65)
    );
  };
  return (source, state) => {
    const event = Core.clone(source),
      registry = entries(state);
    if (event.kind === 'exam') {
      const entity = domain === 'item' ? event.item : event.entity;
      if (!registry[entity.id] && !separateMention(entity.name)) {
        const provided = new Set(entity._provided || []);
        const keys =
          domain === 'item'
            ? [
                ['itemType', 'type'],
                ['rarity', 'internalrarity'],
                ['affinity', 'affinity'],
                ['affinity2', 'affinity2'],
                ['power', 'power'],
                ['durability', 'durability'],
                ['condition', 'condition'],
                ['possession', 'possession'],
                ['location', 'location']
              ]
            : [
                ['kind', 'type'],
                ['portrait', 'portrait']
              ];
        const candidates = [...(names.get(normalize(entity.name)) || [])]
          .map((id) => registry[id])
          .filter(
            (prior) =>
              prior &&
              normalize(prior.name) === normalize(entity.name) &&
              keys.every(
                ([key, raw]) =>
                  !provided.has(raw) ||
                  !known(entity[key]) ||
                  !known(prior[key]) ||
                  normalize(entity[key]) === normalize(prior[key])
              )
          );
        if (candidates.length === 1) {
          aliases.set(entity.id, candidates[0].id);
          entity.id = candidates[0].id;
          entity.name = candidates[0].name;
        } else if (candidates.length > 1) {
          // Preserve ambiguous old records; do not create yet another guessed identity.
          return null;
        }
      }
      index(entity);
    } else {
      const patch = event.patch;
      for (const key of ['id', 'equip', 'unequip'])
        if (aliases.has(patch[key]) && !registry[patch[key]]) patch[key] = aliases.get(patch[key]);
      for (const key of ['inputs', 'outputs'])
        for (const row of patch[key] || []) if (aliases.has(row.id) && !registry[row.id]) row.id = aliases.get(row.id);
      const signature = eventValueKey(event);
      const target = patch.id || eventValueKey([patch.equip, patch.unequip, patch.inputs, patch.outputs]);
      if (repeatedActions.has(signature) || lastBatchAction.get(target) === signature) return null;
      // Preserve real equip -> unequip -> equip (and analogous state cycles).
      lastBatchAction.set(target, signature);
    }
    return event;
  };
}

export function itemEventState(reg, event) {
  const patch = event.patch || {};
  const ids = [
    event.item?.id,
    patch.id,
    patch.equip,
    patch.unequip,
    ...(patch.inputs || []).map((x) => x.id),
    ...(patch.outputs || []).map((x) => x.id)
  ].filter(Boolean);
  return eventValueKey(ids.map((id) => reg.items[id] || null));
}

// One auxiliary pass over the latest (or given) response. The result says what
// happened: `ok` (events, possibly none, committed with their guard), `skip`
// (nothing to do or not allowed now), `conflict` (the chat changed under us;
// try again later) or `fail`. `called` says whether the model was reached;
// only a failure after a model call counts toward the retry limit.
const skip = (reason) => ({ status: 'skip', reason, events: [], called: false });

export async function recoverAuxiliaryOutputNow({ messageIndex = null, force = false } = {}) {
  const ctx = await context();
  if (!ctx || !(await isEnabled(ctx.character))) return skip('disabled');
  const settings = await settingsFor(ctx.character);
  if (!settings.itemsEnabled && !settings.skillsEnabled && !settings.encountersEnabled) return skip('domains');
  if (settings.auxOutput === 'off' && !force) return skip('off');
  if (workQueue.revision('aux-provider') === 'unavailable' && !force) return skip('provider');
  const index = assistantMessageIndex(ctx.chat, messageIndex);
  if (index < 0) return skip('no-message');
  // A malformed document is surfaced here, before any model call.
  const doc = readDocument(ctx.chat);
  const messages = ctx.chat.message || [];
  if (!force && doc.restoredThrough && messages.findIndex((one) => one?.chatId === doc.restoredThrough) >= index)
    return skip('restored');
  const source = messageData(messages[index]);
  if (!force && !automaticAuxReady(ctx.chat, index, source)) return skip('not-ready');
  const sourceHash = Core.fnv1a(source);
  // Guarded by the stable message id: the commit below rewrites the body, so
  // a body-derived key would invalidate itself.
  const chatId = messages[index]?.chatId || `idx-${index}`;
  const guardKey = `${settings.auxOutput}:${Number(settings.itemsEnabled)}${Number(settings.skillsEnabled)}${Number(settings.encountersEnabled)}:q${Quality.REVISION}:p${ITEMX_AUX_PROMPT_REVISION}`;
  if (!force && guardSettled(auxGuard(doc, chatId), guardKey)) return skip('guarded');
  if (typeof host().runLLMModel !== 'function') return skip('no-model');

  let called = false;
  return (async () => {
    const current = await readChat(ctx.characterIndex, ctx.chatIndex);
    if (!current || Core.fnv1a(messageData(current.message?.[index])) !== sourceHash)
      return { status: 'conflict', events: [], called };
    if (!force && !automaticAuxReady(current, index, messageData(current.message[index]))) return skip('not-ready');
    const loaded = project({ ...ctx, chat: current });
    if (!force && guardSettled(auxGuard(loaded.doc, chatId), guardKey)) return skip('guarded');
    const snapshot = loaded.snapshot;
    const codexSnapshot = loaded.codexSnapshot;
    // Events this message already carries, which the model must not repeat.
    const represented = anchorKeys(source)
      .map((key) => loaded.doc.events[key])
      .filter((row) => row && row.c === (current.message[index]?.chatId || ''))
      .map((row) => row.e);
    const committedNarrative = clipAuxiliaryText(auxiliaryVisibleText(messageData(current.message[index])), 14000);
    if (!committedNarrative && !force) return skip('empty');
    const conversation = auxiliaryConversationContext(current, index);
    const domains = enabledCodexDomains(settings);
    const requested = [
      settings.itemsEnabled && 'items',
      settings.skillsEnabled && 'skills',
      settings.encountersEnabled && 'encounters'
    ]
      .filter(Boolean)
      .join(', ');
    const moduleAssets = settings.encountersEnabled ? await modulePortraitAssets(settings, ctx.character, current) : [];
    const protocolOptions = {
      narrative: [conversation.triggeringUser, conversation.recent, committedNarrative].filter(Boolean).join('\n'),
      entities: encounterEntities(codexSnapshot)
    };
    const itemRecoveryRules = settings.itemsEnabled
      ? `Recover every settled item acquisition, creation, equipment, damage, loss, destruction or material appraisal omitted by the main output, even when the main output already emitted some other ITEMX events. Reuse existing ids from CURRENT INVENTORY. For a genuinely new item, emit a complete itemExam with coherent identity, rarity, visual theme, affinity only when established, and concrete effects supported by context. If the triggering turn and committed output conclusively correct an existing item's name or descriptive identity, including an earlier misspelling, emit itemPatch op=merge for that existing id with only the corrected descriptive fields; never re-emit a complete itemExam merely to correct an existing item. CURRENT INVENTORY is authoritative for continuity, not for a contradicted typo.`
      : '';
    const codexRecoveryRules = domains.length
      ? `Recover settled changes only for enabled CODEX domains, plus first discovery of an already-owned persistent player skill absent from CURRENT ACTIVE SKILLS. Skills include owned, usable character-bound powers, command authorities, supernatural marks, contract rights, transformations and summoning faculties. Finite or rechargeable charges belong in cost/state; they do not make the enduring capability transient, and individual charges are not items or skills. One-use consumables remain items; decorative marks or lore facts without usable effects stay excluded. Emit one skillExam for a confirmed missing capability and reuse existing ids. A bracketed word or generic action alone is not proof. Keep NPC or opponent techniques only in encounter moves unless the player acquires them. Track later learning, mastery, equipment, sealing or loss. For encounters, track actual hostility, combat or accepted sparring; never register mere mentions, rumors, passive NPCs or unaccepted challenges.`
      : '';
    const prompt = `${protocolForSettings(settings, ctx.character, moduleAssets, protocolOptions)}\n\nYou are the ITEMX context-aware auxiliary regeneration pass. Enabled domains: ${requested}. Read the triggering user turn, recent narrative continuity, committed assistant output, authoritative registries, and non-ITEMX state evidence together. Output transport for enabled domains only, with no prose or code fence. Recover every settled change omitted by the main output. ${itemRecoveryRules} ${codexRecoveryRules} Multiple events must be emitted as separate blocks in narrative order. The committed assistant output decides what actually happened; earlier context resolves identity, continuity, ownership, prior damage and user intent. Do not merely catch or copy nouns, do not invent plausible events, do not repeat events already represented in the authoritative registries, and output exactly NONE when nothing is missing.\n\n${settings.itemsEnabled ? `CURRENT INVENTORY:\n${Core.anchor(snapshot)}` : 'ITEM DOMAIN DISABLED'}\n\n${domains.length ? `CURRENT ACTIVE SKILLS AND ENCOUNTERS:\n${Codex.anchor(codexSnapshot, committedNarrative, 9000, { enabledDomains: domains })}` : 'CODEX DOMAINS DISABLED'}\n\nTRIGGERING USER TURN:\n${conversation.triggeringUser}\n\nRECENT NARRATIVE CONTEXT (oldest to newest):\n${conversation.recent}\n\nCOMMITTED ASSISTANT OUTPUT (visible narrative only):\n${committedNarrative}\n\nNON-ITEMX STATE EVIDENCE:\n${stateItemEvidence(current)}`;
    setStatus(t('aux.036'));
    called = true;
    const response = await runAuxModel(prompt, t('aux.035'));
    const raw = modelText(response);
    if (!raw) throw new Error(t('aux.034'));
    const itemReconciler = auxiliaryEventReconciler(
      'item',
      snapshot.registry,
      represented.filter((event) => !event.domain),
      committedNarrative
    );
    const monsterReconciler = auxiliaryEventReconciler(
      'monster',
      codexSnapshot,
      represented.filter((event) => event.domain === 'monster'),
      committedNarrative
    );
    const parsed = settings.itemsEnabled
      ? Core.extractResponse(raw, snapshot.registry, { prepareEvent: itemReconciler })
      : { content: stripItemTransport(raw), events: [], errors: [] };
    const validationRegistry = Core.clone(snapshot.registry);
    const validItems = [],
      partials = [],
      rejectedIds = [];
    const checkedIds = new Set();
    const acceptItemEvent = (event) => {
      const before = itemEventState(validationRegistry, event);
      if (Core.applyEvent(validationRegistry, event) == null) return false;
      if (before !== itemEventState(validationRegistry, event)) validItems.push(event);
      return true;
    };
    const itemSiblings = parsed.events.filter((event) => event.kind === 'exam').map((event) => event.item);
    const itemEvidenceContext = [conversation.triggeringUser, conversation.recent, committedNarrative]
      .filter(Boolean)
      .join('\n\n');
    for (const event of parsed.events) {
      if (event.kind !== 'exam') {
        acceptItemEvent(event);
        continue;
      }
      let evidence = Quality.detectItemEvidence(committedNarrative, event.item, itemSiblings);
      if (!evidence.segment) evidence = Quality.detectItemEvidence(itemEvidenceContext, event.item, itemSiblings);
      const quality = Quality.validateRecoveredItem(event, evidence);
      if (quality.status === 'rejected') {
        rejectedIds.push(event.item.id);
        continue;
      }
      const accepted =
        quality.status === 'partial' ? Quality.projectSafePartial(event, quality, validationRegistry) : event;
      if (!acceptItemEvent(accepted)) continue;
      checkedIds.add(event.item.id);
      if (quality.status === 'partial') partials.push({ ...quality, event: accepted, sourceEvent: event });
    }
    let unresolvedPartials = partials;
    if (partials.length) {
      const partialMap = new Map(partials.map((one) => [one.event.item.id, one]));
      const repaired = new Map();
      try {
        const repairResponse = await runAuxModel(Quality.repairPrompt(partials, committedNarrative), t('aux.033'));
        const repairRaw = modelText(repairResponse);
        const repairParsed = repairRaw ? Core.extractResponse(repairRaw, validationRegistry) : { events: [] };
        for (const event of repairParsed.events) {
          const accepted = Quality.acceptRepair(event, partialMap, validationRegistry);
          if (!accepted || !acceptItemEvent(accepted)) continue;
          const fields = repaired.get(accepted.patch.id) || new Set();
          Object.keys(accepted.patch.fields || {}).forEach((key) => fields.add(key));
          repaired.set(accepted.patch.id, fields);
        }
      } catch (error) {
        fail('auxiliary partial repair', error);
      }
      unresolvedPartials = partials
        .map((one) => ({ ...one, missing: one.missing.filter((key) => !repaired.get(one.event.item.id)?.has(key)) }))
        .filter((one) => one.missing.length);
    }
    const skillEvidenceText = [conversation.triggeringUser, conversation.recent, committedNarrative]
      .filter(Boolean)
      .join('\n\n');
    const codexParsed = Codex.extractResponse(parsed.content, codexSnapshot, {
      enabledDomains: domains,
      reconcileExistingSkills: true,
      suppressUnchanged: true,
      prepareEvent: (event, state) => (event.domain === 'monster' ? monsterReconciler(event, state) : event),
      rarityMode: settings.rarityMode,
      skillEvidenceText
    });
    const validationCodex = Codex.clone(codexSnapshot);
    const validCodex = codexParsed.events.filter((event) => Codex.applyEvent(validationCodex, event) != null);
    const valid = [...validItems, ...validCodex];
    debugRecord('auxiliary', {
      requested,
      events: valid.length,
      itemEvents: validItems.length,
      codexEvents: validCodex.length,
      partials: partials.length,
      partialFinal: unresolvedPartials.length,
      rejected: rejectedIds.length
    });
    const allErrors = [...parsed.errors, ...codexParsed.errors];
    if (!valid.length && allErrors.length) throw new Error(t('aux.032', allErrors[0]));

    const guard = { k: guardKey, q: Quality.REVISION };
    // Transport markers of the valid events, anchored into the message below.
    const reg = Core.clone(snapshot.registry);
    const markers = validItems.map((event) => {
      const id = event.item?.id || event.patch?.id;
      const previous = Core.comparisonView(reg.items[id]);
      const view = Core.clone(Core.applyEvent(reg, event));
      const partial = unresolvedPartials.find((one) => one.event.item.id === id);
      const review = { source: 'auxiliary', checked: checkedIds.has(id), missing: partial?.missing || [] };
      return Core.marker({ v: Core.VERSION, event, view, previous, review });
    });
    const codexReg = Codex.clone(codexSnapshot);
    for (const event of validCodex) {
      const priorRegistry = event.domain === 'skill' ? codexReg.skills : codexReg.monsters;
      const previous = Codex.clone(priorRegistry.entries[event.entity?.id || event.patch?.id] || null);
      const view = Codex.clone(Codex.applyEvent(codexReg, event));
      markers.push(Codex.marker({ v: Codex.VERSION, event, view, previous, review: { source: 'auxiliary' } }));
    }
    if (valid.length) prepareInlinePortraits(ctx, codexReg, settings);
    let records = [];
    const written = await writeDocument(ctx, async (doc, latest) => {
      const message = latest.message?.[index];
      if (!message || Core.fnv1a(messageData(message)) !== sourceHash) return false;
      if (!valid.length) {
        setGuard(
          doc,
          chatId,
          rejectedIds.length
            ? { ...guard, state: 'rejected', events: 0, rejectedIds }
            : { ...guard, state: 'none', events: 0 }
        );
        return {};
      }
      const field = typeof message.data === 'string' ? 'data' : typeof message.content === 'string' ? 'content' : '';
      if (!field) return false;
      const anchored = anchorTransport(message[field], markers.join('\n'), {
        seed: `${ctx.key}|${chatId}|aux|${doc.seq}`,
        doc
      });
      records = anchored.records;
      commitRecords(doc, records, typeof message.chatId === 'string' ? message.chatId : '');
      setGuard(doc, chatId, {
        ...guard,
        state: unresolvedPartials.length || rejectedIds.length ? 'partial_final' : 'complete',
        events: valid.length,
        partialIds: [...unresolvedPartials.map((one) => one.event.item.id), ...rejectedIds]
      });
      const chat = {
        ...latest,
        message: latest.message.map((one, at) => (at === index ? { ...one, [field]: anchored.content } : one))
      };
      await enrichLore(ctx, doc, chat);
      return { chat };
    });
    if (!written) return { status: 'conflict', events: [], called };
    const stillActive = activeContextKey() === ctx.key;
    if (!valid.length) {
      if (stillActive) {
        setStatus(rejectedIds.length ? t('aux.031') : t('aux.029'));
        await setAuxOutcome(
          rejectedIds.length ? 'failed' : 'done',
          rejectedIds.length ? t('aux.030') : t('aux.028'),
          0
        );
      }
      return { status: 'ok', events: [], called };
    }
    if (stillActive) {
      workQueue.remember('host-settling', ctx.key);
      await emit(
        'markers-armed',
        records.map((record) => record.key)
      );
      await emit('output-committed', written.chat);
      invalidateLoaded();
      setStatus(t('aux.027', valid.length));
      await setAuxOutcome(
        unresolvedPartials.length || rejectedIds.length ? 'failed' : 'done',
        unresolvedPartials.length || rejectedIds.length
          ? t('aux.026', unresolvedPartials.length + rejectedIds.length)
          : t('aux.025', valid.length),
        valid.length
      );
    }
    return { status: 'ok', events: valid, called };
  })().catch(async (error) => {
    fail('auxiliary recovery', error);
    if (activeContextKey() === ctx.key) {
      setStatus(t('aux.024'));
      await setAuxOutcome('failed', t('aux.023', String(error?.message || error).slice(0, 80)));
    }
    // A missing provider is quarantined for the session, never retried or counted.
    if (error?.code === 'AUX_PROVIDER_UNAVAILABLE') return skip('provider');
    if (called && !force) await recordFailure(ctx, index, sourceHash, chatId, guardKey);
    return { status: 'fail', events: [], called, error };
  });
}

// A guard settles its message unless it records failures below the limit.
function guardSettled(guard, key) {
  if (guard?.k !== key) return false;
  return guard.state !== 'failed' || (guard.attempts || 0) >= ITEMX_AUX_AUTO_ATTEMPTS;
}

// Failed attempts are counted in the document, so a reload does not reset the
// retry limit and re-bill the same message.
async function recordFailure(ctx, index, sourceHash, chatId, guardKey) {
  try {
    await writeDocument(ctx, (doc, latest) => {
      if (Core.fnv1a(messageData(latest.message?.[index])) !== sourceHash) return false;
      const prior = auxGuard(doc, chatId);
      const attempts = (prior?.k === guardKey && prior.state === 'failed' ? prior.attempts || 0 : 0) + 1;
      setGuard(doc, chatId, { k: guardKey, q: Quality.REVISION, state: 'failed', events: 0, attempts });
      return {};
    });
  } catch (error) {
    debugRecord('aux failure record', error?.message || String(error));
  }
}

export async function runItemModel(task, loaded, target = null, instruction = '') {
  if (typeof host().runLLMModel !== 'function') throw new Error(t('aux.022'));
  const settings = await settingsFor(loaded.character);
  if (!settings.itemsEnabled) throw new Error(t('aux.021'));
  const targetJson = target ? JSON.stringify(target) : 'null';
  const prompt = `${itemxProtocolText(settings.rarityMode)}\n\nYou are running a manual ITEMX management transaction. Output ITEMX transport only; no prose and no code fence.\n${task === 'create' ? 'Create exactly one genuinely new item from the user description. Emit exactly one complete itemExam with a new snake_case id.' : 'Reappraise exactly the supplied existing item. Emit exactly one complete itemExam, keep its id, possession, location, slot and count, and update descriptive/appraisal fields according to the instruction. Never remove it and never create another id.'}\n\nCURRENT INVENTORY:\n${Core.anchor(loaded.snapshot)}\n\nTARGET ITEM JSON:\n${targetJson}\n\nUSER INSTRUCTION:\n${instruction || (task === 'create' ? 'Create a fitting new item.' : 'Roll a fresh appraisal while preserving established facts not contradicted by context.')}`;
  const response = await runAuxModel(prompt, task === 'create' ? t('aux.020') : t('aux.019'));
  const raw = modelText(response);
  if (!raw) throw new Error(t('aux.018'));
  const parsed = Core.extractResponse(raw, loaded.snapshot.registry);
  if (parsed.errors.length || parsed.events.length !== 1 || parsed.events[0].kind !== 'exam')
    throw new Error(t('aux.017', parsed.errors[0] || `events=${parsed.events.length}`));
  const event = parsed.events[0];
  if (task === 'create') {
    if (loaded.snapshot.registry.items[event.item.id]) throw new Error(t('aux.016'));
    event.item.possession = 'owned';
    event.item.location = 'inventory';
    event.item.slot = null;
    event.item.count = Math.max(1, Number(event.item.count) || 1);
  } else {
    if (!target || event.item.id !== target.id) throw new Error(t('aux.015'));
    event.item.possession = target.possession;
    event.item.location = target.location;
    event.item.slot = target.slot || null;
    event.item.count = target.count;
  }
  return event;
}

export async function repairOneItem(loaded, id) {
  if (!loaded?.itemsEnabled) throw new Error(t('aux.014'));
  if (!loaded || active) throw new Error(t('aux.013'));
  const record = presentationRecord('item', id);
  const missing = record.review?.missing || [];
  if (!missing.length) throw new Error(t('aux.012'));

  return (async () => {
    const active = await context();
    if (!active || active.key !== loaded.key) throw new Error(t('aux.011'));
    const chat = active.chat;
    if (chatIsStreaming(chat)) throw new Error(t('aux.010'));
    const expectedFingerprint = replayFingerprint(chat);
    const sourceIndex = record.review?.evidenceIndex ?? record.messageIndex;
    const source = messageData(chat.message?.[sourceIndex]);
    const reg = project(active).snapshot.registry,
      item = reg.items[id];
    if (!item || item.possession === 'removed') throw new Error(t('aux.009'));
    const conversation = auxiliaryConversationContext(chat, sourceIndex);
    const narrative = [conversation.triggeringUser, conversation.recent, auxiliaryVisibleText(source)].join('\n\n');
    const evidence = Quality.detectItemEvidence(narrative, item, Object.values(reg.items));
    if (!evidence.segment) throw new Error(t('aux.008'));
    const partial = { event: { kind: 'exam', item }, missing, evidence };
    const raw = modelText(await runAuxModel(Quality.repairPrompt([partial], narrative), t('aux.007', item.name)));
    const parsed = Core.extractResponse(raw, reg);
    const partialMap = new Map([[id, partial]]);
    const events = parsed.events.map((event) => Quality.acceptRepair(event, partialMap, reg)).filter(Boolean);
    if (events.length !== 1 || parsed.events.length !== 1 || parsed.errors.length) throw new Error(t('aux.006'));
    const latest = await context();
    if (!latest || latest.key !== loaded.key || replayFingerprint(latest.chat) !== expectedFingerprint)
      throw new Error(t('aux.005'));
    const remaining = missing.filter((key) => !Object.prototype.hasOwnProperty.call(events[0].patch.fields, key));
    // This transaction already owns the queue; commitManualEvents only writes.
    await commitManualEvents(
      { ...loaded, chat: latest.chat, expectedFingerprint },
      events,
      t('aux.004'),
      { source: 'auxiliary', checked: true, missing: remaining, evidenceIndex: sourceIndex },
      false
    );
    if (activeContextKey() === loaded.key)
      await setAuxOutcome(
        remaining.length ? 'failed' : 'done',
        remaining.length ? t('aux.003', remaining.length) : t('aux.002'),
        events.length
      );
  })()
    .then(() => rebuildCurrent())
    .catch(async (error) => {
      if (activeContextKey() === loaded.key && !isUnloading()) await setAuxOutcome('failed', t('aux.001'), 0);
      throw error;
    });
}
