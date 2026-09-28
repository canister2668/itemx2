/* Chat-body presentation: the display hook's card rendering, one-shot event
 * bursts, and the scroll governor that pauses card effects while the reader
 * scrolls. All state here is private to this module. */
import * as Codex from '../engine/codex.js';
import * as Core from '../engine/core.js';
import * as Renderer from '../render/renderer.js';
import { scrollActive, setScrollActive } from '../activity.js';
import { assistantMessageIndex, eventValueKey } from '../aux.js';
import { ITEMX_CODEX_REF_RE, ITEMX_REF_RE } from '../config.js';
import { isUnloading } from '../connection.js';
import { emit } from '../events.js';
import { t } from '../i18n.js';
import { debugRecord, workQueue } from '../kernel.js';
import { coalesceAdjacentItemMarkers, inlineViewPayload, messageData, presentationPayloads } from '../markers.js';
import { positionMarkersByNarrative } from '../pipeline.js';
import { inlinePortraitImages } from '../portraits.js';
import { codexInlineEventHtml } from '../render/codex-cards.js';
import { activeContextKey, currentLatestMarkers, eventPayload } from '../session.js';
import { FX_MODES, SKIN_MODES } from '../settings.js';
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

export function eventBurstKey(payload) {
  return `e${Core.fnv1a(activeContextKey())}_${Core.fnv1a(JSON.stringify([payload.event, payload.view]))}`;
}

export function decorateInlineEvent(html, payload, domain) {
  const kind = Renderer.eventKind(payload, domain);
  if (!kind || !html) return html;
  return html.replace(/^<(article|section)([^>]*)>/, (opening) =>
    opening.replace(
      />$/,
      ` x-itemx2-event="${eventBurstKey(payload)}"><span class="itemx2-event-burst itemx2-burst-${kind}" aria-hidden="true"></span>`
    )
  );
}

export function armEventBursts(text) {
  if (!visualEffectsEnabled || isUnloading()) return;
  for (const [key, candidate] of bursts) if (candidate.expires < Date.now()) bursts.delete(key);
  for (const { payload, domain } of presentationPayloads(text)) {
    if (!Renderer.eventKind(payload, domain)) continue;
    const key = eventBurstKey(payload);
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
  for (const { payload } of presentationPayloads(messageData(message))) {
    const candidate = bursts.get(eventBurstKey(payload));
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

export function suppressRepeatedDisplayStates(content) {
  // Display-only: never delete ledger events. A -> B -> A remains three states.
  const last = new Map();
  return String(content || '').replace(
    /<!--(ITEMX2|CODEX2)([:@])([A-Za-z0-9_-]+)(?::([A-Za-z0-9_-]+))?-->/g,
    (raw, prefix, mode, code, inline) => {
      const domain = prefix === 'ITEMX2' ? 'item' : 'codex';
      const payload =
        mode === ':'
          ? Core.decodePayload(code)
          : eventPayload(`${domain}:${code}`) || inlineViewPayload(inline, domain);
      const view = payload?.view;
      if (!view?.id || payload.error) return raw;
      const key = `${domain}:${payload.event?.domain || 'item'}:${view.id}`;
      const signature = eventValueKey(view);
      const duplicate = last.get(key) === signature;
      last.set(key, signature);
      return duplicate ? '' : raw;
    }
  );
}

export const displayHandler = (content, portraits = {}) => {
  const raw = Core.stripInventoryEcho(content);
  if (!raw.includes('<!--ITEMX2') && !raw.includes('<!--CODEX2')) return raw;
  const positioned = raw.includes('<!--ITEMX2:') || raw.includes('<!--CODEX2:') ? positionMarkersByNarrative(raw) : raw;
  const source = coalesceAdjacentItemMarkers(suppressRepeatedDisplayStates(positioned));
  let found = false,
    hasFullCard = false,
    hasCodexCard = false;
  const renderPayload = (cacheKey, payload, motion) => {
    const key = `${cacheKey}:${motion}`;
    if (markerHtmlCache.has(key)) return markerHtmlCache.get(key);
    const html = decorateInlineEvent(Renderer.renderMarkerPayload(payload, { inline: true, motion }), payload, 'item');
    markerHtmlCache.set(key, html);
    while (markerHtmlCache.size > 64) markerHtmlCache.delete(markerHtmlCache.keys().next().value);
    return html;
  };
  const markerMotion = (key) => {
    if (fxMotion === 'off') return 'off';
    if (!currentLatestMarkers().size) return 'lite';
    return currentLatestMarkers().has(key) ? 'lite' : 'off';
  };
  const rendered = source
    .replace(Core.MARKER_RE, (_, code) => {
      found = true;
      const payload = Core.decodePayload(code);
      if (!payload || payload.error) return '';
      const motion = markerMotion(`ITEMX2:${code}`);
      const html = renderPayload(`item:${code}`, payload, motion);
      if (html) {
        hasFullCard = true;
        return html;
      }
      const item = payload.event?.kind === 'exam' ? payload.event.item : payload.view;
      return item
        ? `<span class="itemx-event-chip">${Core.esc(Core.resolveItemEmoji(item))} ${Core.esc(item.name || item.id)}</span>`
        : '';
    })
    .replace(Codex.MARKER_RE, (_, code) => {
      found = true;
      const payload = Codex.decodePayload(code);
      if (!payload || payload.error) return '';
      const html = decorateInlineEvent(
        codexInlineEventHtml(
          payload,
          markerMotion(`CODEX2:${code}`),
          portraits[payload.view?.id || payload.event?.entity?.id] || ''
        ),
        payload,
        payload.event?.domain
      );
      if (html) {
        hasCodexCard = true;
        return html;
      }
      return '';
    })
    .replace(ITEMX_REF_RE, (_, ref, inline) => {
      found = true;
      const payload = eventPayload(`item:${ref}`) || inlineViewPayload(inline, 'item');
      if (!payload || payload.error) return `<span class="itemx-event-chip">${t('presentation.002.1')}</span>`;
      const motion = markerMotion(`ITEMX2@${ref}`);
      const html = renderPayload(`item-ref:${ref}`, payload, motion);
      if (html) {
        hasFullCard = true;
        return html;
      }
      const item = payload.view || payload.event?.item;
      return item
        ? `<span class="itemx-event-chip">${Core.esc(Core.resolveItemEmoji(item))} ${Core.esc(item.name || item.id)}</span>`
        : `<span class="itemx-event-chip">📦 ITEMX · ${Core.esc(ref)}</span>`;
    })
    .replace(ITEMX_CODEX_REF_RE, (_, ref, inline) => {
      found = true;
      if (!inline && !currentLatestMarkers().has(`CODEX2@${ref}`)) return '';
      const payload = eventPayload(`codex:${ref}`) || inlineViewPayload(inline, 'codex');
      if (!payload || payload.error)
        return inline ? `<span class="itemx-event-chip">${t('presentation.001.1')}</span>` : '';
      const html = decorateInlineEvent(
        codexInlineEventHtml(
          payload,
          markerMotion(`CODEX2@${ref}`),
          portraits[payload.view?.id || payload.event?.entity?.id] || ''
        ),
        payload,
        payload.event?.domain
      );
      if (html) {
        hasCodexCard = true;
        return html;
      }
      return '';
    });
  if (!found) return source;
  if (mainStyleInstalled()) return rendered;
  return `<style>${ITEMX_CHIP_STYLE}${ITEMX_PRESENTATION_STYLE}${hasFullCard ? ITEMX_CHAT_STYLE : ''}${hasCodexCard ? `${ITEMX_CODEX_INLINE_STYLE}${ITEMX_CODEX_INLINE_DENSE_STYLE}${ITEMX_CODEX_INLINE_APPRAISAL_STYLE}` : ''}</style>${rendered}`;
};

export function displayWithPortraits(content) {
  const monsters = {};
  const collect = (payload) => {
    if (payload?.event?.domain !== 'monster' || payload.error) return;
    const entity = payload.view || payload.event.entity;
    if (entity?.id) monsters[entity.id] = entity;
  };
  String(content || '').replace(Codex.MARKER_RE, (_, code) => {
    collect(Codex.decodePayload(code));
    return '';
  });
  String(content || '').replace(ITEMX_CODEX_REF_RE, (_, ref, inline) => {
    collect(eventPayload(`codex:${ref}`) || inlineViewPayload(inline, 'codex'));
    return '';
  });
  // Display hooks must never call back into the host. A host render may be
  // waiting for this callback, and concurrent message renders amplify reads.
  const portraits = inlinePortraitImages(Object.values(monsters), activeContextKey());
  return displayHandler(content, portraits);
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
