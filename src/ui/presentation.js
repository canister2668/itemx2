/* Chat-body presentation: the display hook's card rendering, one-shot event
 * bursts, and the scroll governor that pauses card effects while the reader
 * scrolls. All state here is private to this module. */
import * as Core from '../engine/core.js';
import * as Renderer from '../render/renderer.js';
import { scrollActive, setScrollActive } from '../activity.js';
import { assistantMessageIndex, eventValueKey } from '../aux.js';
import { isUnloading } from '../connection.js';
import { emit } from '../events.js';
import { debugRecord, workQueue } from '../kernel.js';
import { anchorPayload, displayProjection } from '../ledger.js';
import { inlinePortraitImages } from '../portraits.js';
import { codexInlineEventHtml } from '../render/codex-cards.js';
import { activeContextKey, currentLatestKeys } from '../session.js';
import { FX_MODES, SKIN_MODES } from '../settings.js';
import { ANCHOR_RE, anchorKeys, hasAnchor, hasOldMarker, removeOldMarkers } from '../store/anchors.js';
import {
  ITEMX_CHAT_STYLE,
  ITEMX_CHIP_STYLE,
  ITEMX_CODEX_INLINE_APPRAISAL_STYLE,
  ITEMX_CODEX_INLINE_DENSE_STYLE,
  ITEMX_CODEX_INLINE_STYLE,
  ITEMX_PRESENTATION_STYLE,
  SKIN_NAMES,
  mainDoc,
  mainStyleInstalled
} from './style.js';

const bursts = new Map();
const burstSeen = new Set();
const burstOwners = new Set();
const markerHtmlCache = new Map();
let bodyFxClassOwner = null;
let bodyFxEventIds = [];
let bodyFxSawScroll = false;
let fxMotion = 'full';
let visualEffectsEnabled = true;
let visualSkin = 'dark';

export const effectsMotion = () => fxMotion;
export const effectsSkin = () => visualSkin;
export const effectsEnabled = () => visualEffectsEnabled;

// Settings of the active bot decide the effect level and skin of chat cards.
export function applyVisualSettings(settings, patch = null) {
  fxMotion = FX_MODES.includes(settings.effectsLevel) ? settings.effectsLevel : 'full';
  visualEffectsEnabled = fxMotion !== 'off';
  visualSkin = SKIN_MODES.includes(settings.skin) ? settings.skin : 'dark';
  if (patch && 'effectsLevel' in patch) markerHtmlCache.clear();
}

// Armed or committed bursts not yet played.
export const pendingBurstCount = () => bursts.size;
export const markerHtmlCacheSize = () => markerHtmlCache.size;

export function clearMarkerHtmlCache() {
  markerHtmlCache.clear();
}

const payloadDomain = (payload) =>
  payload.domain === 'item' || !payload.event?.domain ? 'item' : payload.event.domain;

export function decorateInlineEvent(html, payload, domain, key) {
  const kind = Renderer.eventKind(payload, domain);
  if (!kind || !html) return html;
  return html.replace(/^<(article|section)([^>]*)>/, (opening) =>
    opening.replace(
      />$/,
      ` x-itemx2-event="${key}"><span class="itemx2-event-burst itemx2-burst-${kind}" aria-hidden="true"></span>`
    )
  );
}

// Anchors of a response being generated: their cards may play a one-shot
// burst once the response is committed.
export function armEventBursts(keys) {
  if (!visualEffectsEnabled || isUnloading()) return;
  for (const [key, candidate] of bursts) if (candidate.expires < Date.now()) bursts.delete(key);
  for (const key of keys || []) {
    const payload = anchorPayload(key);
    if (!payload || !Renderer.eventKind(payload, payloadDomain(payload))) continue;
    if (burstSeen.has(key) || bursts.has(key)) continue;
    if (bursts.size >= 8) break;
    bursts.set(key, { expires: Date.now() + 30000, committed: false });
  }
}

export function burstTimer(fn, ms) {
  return workQueue.later('burst', fn, ms);
}

export function commitEventBursts(chat) {
  if (!bursts.size || chat?.isStreaming) return;
  const message = chat?.message?.[assistantMessageIndex(chat)];
  if (!message || message.isStreaming || message.bgContinue) return;
  let activated = false;
  for (const key of anchorKeys(Core.messageText(message))) {
    const candidate = bursts.get(key);
    if (!candidate || candidate.committed || candidate.expires < Date.now()) continue;
    candidate.committed = true;
    candidate.expires = Date.now() + 3000;
    activated = true;
  }
  if (activated) for (const delayMs of [0, 350, 1000]) burstTimer(flushEventBursts, delayMs);
}

export async function flushEventBursts() {
  if (isUnloading() || !mainDoc() || scrollActive() || !bursts.size) return;

  const key = activeContextKey();
  try {
    let played = 0;
    for (const [id, candidate] of bursts) {
      if (candidate.expires < Date.now() || !visualEffectsEnabled) {
        bursts.delete(id);
        continue;
      }
      if (!candidate.committed || played >= 2) continue;
      const element = await mainDoc().querySelector(`[x-itemx2-event="${id}"]`);
      if (isUnloading() || key !== activeContextKey()) return;
      if (!element) continue;
      // Consume before mutating DOM. Re-rendered markup never contains this class.
      bursts.delete(id);
      burstSeen.add(id);
      while (burstSeen.size > 256) burstSeen.delete(burstSeen.values().next().value);
      burstOwners.add(element);
      await element.addClass('x-risu-itemx2-burst-active');
      if (isUnloading() || key !== activeContextKey()) {
        await element.removeClass('x-risu-itemx2-burst-active');
        burstOwners.delete(element);
        return;
      }
      played++;
      burstTimer(async () => {
        try {
          await element.removeClass('x-risu-itemx2-burst-active');
        } catch {}
        burstOwners.delete(element);
      }, 1350);
    }
  } catch (error) {
    debugRecord('event burst', error?.message || String(error));
  }
}

export function clearEventBursts() {
  workQueue.clearGroup('burst');
  bursts.clear();
  for (const element of burstOwners) void element.removeClass('x-risu-itemx2-burst-active').catch(() => {});
  burstOwners.clear();
}

// The anchors of one message with their payloads, minus the display-only
// repeats: a card identical to the previous card of the same entity, and an
// item card directly followed by a newer card of the same item. Never deletes
// ledger events: A -> B -> A remains three states.
function visibleAnchors(source, loaded) {
  const rows = [...source.matchAll(ANCHOR_RE)].map((match) => ({
    key: match[1],
    start: match.index,
    end: match.index + match[0].length,
    payload: anchorPayload(match[1], loaded)
  }));
  const last = new Map();
  for (const row of rows) {
    const view = row.payload?.view;
    if (!view?.id) continue;
    const entity = `${payloadDomain(row.payload)}:${view.id}`;
    const signature = eventValueKey(view);
    row.hidden = last.get(entity) === signature;
    last.set(entity, signature);
  }
  const shown = rows.filter((row) => !row.hidden);
  for (let index = 0; index < shown.length - 1; index += 1) {
    const current = shown[index],
      next = shown[index + 1];
    if (payloadDomain(current.payload || {}) !== 'item' || payloadDomain(next.payload || {}) !== 'item') continue;
    if (
      current.payload?.view?.id &&
      current.payload.view.id === next.payload?.view?.id &&
      !source.slice(current.end, next.start).trim()
    )
      current.hidden = true;
  }
  return rows;
}

function renderItemCard(key, payload, motion) {
  const cacheKey = `${key}:${motion}`;
  if (markerHtmlCache.has(cacheKey)) return markerHtmlCache.get(cacheKey);
  const html = decorateInlineEvent(
    Renderer.renderMarkerPayload(payload, { inline: true, motion }),
    payload,
    'item',
    key
  );
  markerHtmlCache.set(cacheKey, html);
  while (markerHtmlCache.size > 64) markerHtmlCache.delete(markerHtmlCache.keys().next().value);
  return html;
}

// The display hook. Old markers are hidden; anchors become cards from the
// loaded ledger, which is awaited once per chat. An anchor nothing resolves
// renders as nothing.
export async function displayHandler(content) {
  const raw = Core.stripInventoryEcho(content);
  const source = hasOldMarker(raw) ? removeOldMarkers(raw) : raw;
  if (!hasAnchor(source)) return source;
  const loaded = await displayProjection(anchorKeys(source));
  const rows = visibleAnchors(source, loaded);
  const latest = currentLatestKeys();
  const motion = (key) => (fxMotion === 'off' ? 'off' : !latest.size || latest.has(key) ? 'lite' : 'off');
  const monsters = rows
    .map((row) => row.payload)
    .filter((payload) => payload?.event?.domain === 'monster')
    .map((payload) => payload.view || payload.event.entity)
    .filter((entity) => entity?.id);
  // Display hooks must never call back into the host for portraits: a host
  // render may be waiting for this callback.
  const portraits = monsters.length ? inlinePortraitImages(monsters, activeContextKey()) : {};
  let hasFullCard = false,
    hasCodexCard = false,
    cursor = 0,
    rendered = '';
  for (const row of rows) {
    rendered += source.slice(cursor, row.start);
    cursor = row.end;
    const payload = row.payload;
    if (row.hidden || !payload) continue;
    if (payloadDomain(payload) === 'item') {
      const html = renderItemCard(row.key, payload, motion(row.key));
      if (html) {
        hasFullCard = true;
        rendered += html;
        continue;
      }
      const item = payload.view || payload.event?.item;
      if (item)
        rendered += `<span class="itemx-event-chip">${Core.esc(Core.resolveItemEmoji(item))} ${Core.esc(item.name || item.id)}</span>`;
      continue;
    }
    // Encounter and skill cards stay with the newest response only.
    if (latest.size && !latest.has(row.key)) continue;
    const html = decorateInlineEvent(
      codexInlineEventHtml(payload, motion(row.key), portraits[payload.view?.id || payload.event?.entity?.id] || ''),
      payload,
      payload.event?.domain,
      row.key
    );
    if (html) {
      hasCodexCard = true;
      rendered += html;
    }
  }
  rendered += source.slice(cursor);
  if (mainStyleInstalled() || (!hasFullCard && !hasCodexCard)) return rendered;
  return `<style>${ITEMX_CHIP_STYLE}${ITEMX_PRESENTATION_STYLE}${hasFullCard ? ITEMX_CHAT_STYLE : ''}${hasCodexCard ? `${ITEMX_CODEX_INLINE_STYLE}${ITEMX_CODEX_INLINE_DENSE_STYLE}${ITEMX_CODEX_INLINE_APPRAISAL_STYLE}` : ''}</style>${rendered}`;
}

// FX timers must run even while a queued host/model operation is suspended.
// Their callbacks only change presentation; heavy work stays in the queue.
let scrollStartTimer = null,
  scrollStopTimer = null,
  scrollArmedAt = 0;
export function clearScrollTimers() {
  if (scrollStartTimer) globalThis.clearTimeout(scrollStartTimer);
  if (scrollStopTimer) globalThis.clearTimeout(scrollStopTimer);
  scrollStartTimer = scrollStopTimer = null;
}

// Drops an active scroll pause at once: context switch, resume and unload.
export async function resetScrollEffects() {
  clearScrollTimers();
  const wasActive = scrollActive();
  setScrollActive(false);
  bodyFxSawScroll = false;
  if (wasActive && bodyFxClassOwner) {
    try {
      await bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling');
    } catch {}
  }
}

export function forgetBodyEffectOwner() {
  bodyFxClassOwner = null;
}

export function beginBodyScrollEffects() {
  if (isUnloading()) return;
  bodyFxSawScroll = false;
  if (scrollStartTimer) globalThis.clearTimeout(scrollStartTimer);
  scrollStartTimer = globalThis.setTimeout(() => {
    scrollStartTimer = null;
    activateBodyScrollEffects();
  }, 80);
}

export function activateBodyScrollEffects() {
  if (isUnloading()) return;
  if (scrollActive() || !bodyFxClassOwner) return;
  setScrollActive(true);
  void bodyFxClassOwner.addClass('x-risu-itemx-body-scrolling').catch(() => {});
}

export function continueBodyScrollEffects() {
  if (isUnloading()) return;
  bodyFxSawScroll = true;
  // Scroll fires continuously. Re-arming the stop timer on every event is the
  // only work this path may do, and even that is throttled: once armed, a
  // further event within the window changes nothing.
  const now = Date.now();
  if (now - scrollArmedAt < 60 && scrollStopTimer) return;
  scrollArmedAt = now;
  // A real scroll event confirms movement. Waiting another 80 ms can miss
  // short wheel/programmatic increments whose scrollend arrives immediately.
  if (scrollStartTimer) globalThis.clearTimeout(scrollStartTimer);
  scrollStartTimer = null;
  activateBodyScrollEffects();
  endBodyScrollEffects(220, true);
}

export function endBodyScrollEffects(delayMs = 0, continuing = false) {
  if (isUnloading()) return;
  // Continued scrolling must retain the initial debounce; release cancels it.
  if (!continuing && scrollStartTimer) {
    globalThis.clearTimeout(scrollStartTimer);
    scrollStartTimer = null;
  }
  if (scrollStopTimer) globalThis.clearTimeout(scrollStopTimer);
  scrollStopTimer = globalThis.setTimeout(() => {
    scrollStopTimer = null;
    if (!scrollActive()) return;
    setScrollActive(false);
    if (bodyFxClassOwner) void bodyFxClassOwner.removeClass('x-risu-itemx-body-scrolling').catch(() => {});
    void emit('scroll-idle');
    workQueue.wake();
  }, delayMs);
}

export async function removeBodyEffectGovernor() {
  const owner = bodyFxEventIds[0]?.owner;
  if (owner)
    for (const binding of bodyFxEventIds) {
      try {
        await owner.removeEventListener(binding.type, binding.id, true);
      } catch (error) {
        debugRecord('body effect listener remove', error?.message || String(error));
      }
    }
  bodyFxEventIds = [];
}

export async function installBodyEffectGovernor() {
  if (!mainDoc()) return;
  try {
    const body = await mainDoc().querySelector('body');
    if (!body) return;
    // RisuAI renders one .chattext per message, so querySelector would only
    // ever reach the first one and leave every later card animating. The class
    // goes on body and the rules descend into .chattext from there. That is
    // only safe because suppression now pauses animation and nothing else; the
    // compositing properties that made this scope blink are gone.
    bodyFxClassOwner = body;
    if (bodyFxEventIds[0]?.owner) {
      try {
        if (await bodyFxEventIds[0]?.owner.getParent()) return;
      } catch {}
      await removeBodyEffectGovernor();
    }
    const bindings = [
      ['pointerdown', beginBodyScrollEffects],
      ['scroll', continueBodyScrollEffects],
      ['pointerup', () => endBodyScrollEffects(bodyFxSawScroll ? 220 : 40)],
      ['pointercancel', () => endBodyScrollEffects(bodyFxSawScroll ? 220 : 40)],
      ['scrollend', () => endBodyScrollEffects(40)]
    ];
    for (const [type, handler] of bindings) {
      // Bound directly: entry() would push every scroll event through the
      // work queue, which is the cost this governor exists to avoid.
      const id = await body.addEventListener(type, handler, true);
      bodyFxEventIds.push({ owner: body, type, id });
    }
  } catch (error) {
    debugRecord('body effect governor install', error?.message || String(error));
  }
}

// Effect level and skin classes on the host body, where the chat cards live.
export async function syncMainEffectsState() {
  const root = mainDoc();
  if (!root) return;
  try {
    const body = await root.querySelector('body');
    if (!body) return;
    if (visualEffectsEnabled) await body.removeClass('x-risu-itemx2-effects-off');
    else await body.addClass('x-risu-itemx2-effects-off');
    for (const name of SKIN_NAMES) {
      if (visualSkin === name) await body.addClass(`x-risu-itemx2-skin-${name}`);
      else await body.removeClass(`x-risu-itemx2-skin-${name}`);
    }
  } catch (error) {
    debugRecord('effect setting sync', error?.message || String(error));
  }
}
