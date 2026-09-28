/* Model transport: the protocol text sent to the model and the conversion of
 * its tags into anchors. Parsing produces transport markers inside one pass;
 * they are positioned by narrative and replaced by anchors plus records. */
import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import { ITEMX_PROTOCOL_TEXT } from './config.js';
import { combinedPortraitAssets } from './portraits.js';
import { pendingRecord } from './session.js';
import {
  OLD_MARKER_RE,
  TRANSPORT_MARKER_RE,
  allocateKey,
  anchor,
  requestText,
  stripTransport
} from './store/anchors.js';

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

// Raw model tags only; anchors and markers of earlier versions do not count.
export const RAW_TRANSPORT_RE =
  /<\/?(?:itemExam|itemPatch|itemx|skillExam|skillPatch|monsterExam|monsterPatch)\b|\[(?:itemx|아이템)\s*:/i;

// A transport tag inside a planning block or `inline code` is a mention, never
// a transport: the parsers leave it in place, so treating it as pending raw
// output would re-run the commit on every catch-up.
const PLANNING_BLOCK_RE =
  /<(Thoughts|Thought|think|thinking|DSThink|reasoning|analysis)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi;
export function hasRawTransport(text) {
  const visible = String(text || '')
    .replace(PLANNING_BLOCK_RE, '')
    .replace(/`[^`\n]*`/g, '');
  return RAW_TRANSPORT_RE.test(visible);
}

// What the model is shown of a stored or streamed text: no anchors, no old
// markers, no transport of any kind.
export function requestSafeText(content) {
  const source = requestText(Core.stripInventoryEcho(content));
  if (!RAW_TRANSPORT_RE.test(source) && !/<!--(?:ITEMX2|CODEX2):/.test(source)) return source;
  return stripTransport(source).replace(/\[(?:itemx|아이템)\s*:[^\]\r\n]{0,2048}\]/gi, '');
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

const normalizedName = (value) =>
  String(value || '')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');

// Moves each transport marker to the paragraph that names its entity, or keeps
// its relative position, and never below a trailing status block.
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
    markers.push({ code, payload: Core.decodePayload(code), prefix: 'ITEMX2', index });
    return '';
  });
  source.replace(Codex.MARKER_RE, (_, code, index) => {
    markers.push({ code, payload: Codex.decodePayload(code), prefix: 'CODEX2', index });
    return '';
  });
  markers.sort((a, b) => a.index - b.index);
  if (!markers.length) return source;

  const narrative = source.replace(Core.MARKER_RE, '').replace(Codex.MARKER_RE, '').trimEnd();
  const pieces = narrative.split(/(\n{2,})/);
  const placements = new Map();
  // Only a status block that closes the response is a trailer. The same block
  // at the top of a response is a header, and cards belong below it.
  const TRAILER_RE = /^\s*(?:\[(?:status|state|route)\b|<(?:state|status|route|risu[-_]))/i;
  let trailerIndex = -1;
  for (let index = pieces.length - 1 - ((pieces.length - 1) % 2); index >= 0; index -= 2) {
    const piece = pieces[index];
    if (TRAILER_RE.test(piece)) trailerIndex = index;
    else if (piece.trim() && !/^\s*\[[^\]\n]*\]\s*$/.test(piece)) break;
  }
  for (const marker of markers) {
    const item =
      marker.prefix === 'ITEMX2'
        ? marker.payload?.event?.kind === 'exam'
          ? marker.payload.event.item
          : marker.payload?.view
        : marker.payload?.view || marker.payload?.event?.entity;
    const name = String(item?.name || '').trim();
    const exact = normalizedName(name);
    const terms = name
      .split(/[\s·:()[\]{}〈〉《》「」『』/\\,_-]+/u)
      .map(normalizedName)
      .filter((term) => term.length >= 2);
    let bestIndex = -1,
      bestScore = 0;
    for (let index = 0; index < pieces.length; index += 2) {
      const paragraph = normalizedName(pieces[index]);
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
    }
    if (trailerIndex >= 0 && bestIndex >= trailerIndex) bestIndex = Math.max(0, trailerIndex - 2);
    const list = placements.get(bestIndex) || [];
    list.push(marker);
    placements.set(bestIndex, list);
  }
  for (const [index, rows] of placements) {
    pieces[index] = `${pieces[index].trimEnd()}\n\n${rows.map((row) => `<!--${row.prefix}:${row.code}-->`).join('\n')}`;
  }
  return pieces.join('').trimEnd();
}

// Markers of earlier versions are masked while a pass runs, so their data is
// never parsed, positioned or turned into anchors.
function masked(text, work) {
  const saved = [];
  const hidden = String(text || '').replace(OLD_MARKER_RE, (raw) => `\u0000ixold${saved.push(raw) - 1}\u0000`);
  const result = work(hidden);
  result.content = result.content.replace(/\u0000ixold(\d+)\u0000/g, (_, index) => saved[Number(index)]);
  return result;
}

// Positions the transport markers in `content` and replaces each with an
// anchor. Keys derive from `seed` (chat, turn) and the marker itself, so every
// pass over the same response agrees; `doc` keys are never reused.
// `markers` are appended to `content` first; markers already stored in
// `content` belong to earlier versions and stay masked.
export const anchorTransport = (content, markers, options) =>
  masked(content, (text) => anchorMarkers(`${text.trimEnd()}\n\n${markers}`, options));

function anchorMarkers(text, { seed, doc, review = null, liveAnchor = null }) {
  const records = [];
  const used = new Set();
  let ordinal = 0;
  const positioned = positionMarkersByNarrative(text);
  const out = positioned.replace(TRANSPORT_MARKER_RE, (raw, prefix, code) => {
    const payload = (prefix === 'ITEMX2' ? Core : Codex).decodePayload(code);
    if (!payload?.event || payload.error) return '';
    // The event, not its view: a later pass sees the committed state, so the
    // view and previous projections differ while the event is the same.
    const markerSeed = `${seed}|${ordinal++}|${Core.fnv1a(JSON.stringify(payload.event))}`;
    const key = allocateKey(markerSeed, (candidate) => {
      if (used.has(candidate)) return true;
      // A committed key is reused only by a later pass over the same response:
      // its anchor still stands in the message that owns it.
      if (doc.events[candidate]) return !(liveAnchor && liveAnchor(candidate, doc.events[candidate]));
      const pending = pendingRecord(candidate);
      return Boolean(pending && pending.seed !== markerSeed);
    });
    used.add(key);
    records.push({
      key,
      seed: markerSeed,
      domain: prefix === 'ITEMX2' ? 'item' : 'codex',
      event: payload.event,
      view: payload.view || null,
      previous: payload.previous || null,
      review: payload.review || review
    });
    return anchor(key);
  });
  return { content: out, records };
}

// Parses model output against `state` ({ registry, codex }) and anchors every
// event it produced.
export function anchorize(
  content,
  { state, settings, seed, doc, review = { source: 'main', checked: false }, liveAnchor = null }
) {
  return masked(content, (text) => {
    const items = settings.itemsEnabled
      ? Core.extractResponse(text, state.registry)
      : { content: stripItemTransport(text), events: [], errors: [] };
    const codex = Codex.extractResponse(items.content, state.codex, {
      enabledDomains: enabledCodexDomains(settings),
      rarityMode: settings.rarityMode,
      skillEvidenceText: text
    });
    const anchored = anchorMarkers(codex.content, { seed, doc, review, liveAnchor });
    return {
      content: anchored.content,
      records: anchored.records,
      events: items.events.length + codex.events.length,
      errors: items.errors.length + codex.errors.length,
      codexSnapshot: codex.snapshot
    };
  });
}
