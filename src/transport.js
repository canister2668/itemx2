/* Model transport: the protocol text sent to the model and the conversion of
 * its tags into anchors. Parsing produces transport markers inside one pass;
 * they are positioned by narrative and replaced by anchors plus records. */
import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import { ITEMX_PROTOCOL_TEXT } from './config.js';
import { protocolPortraitAssets } from './portraits.js';
import { activeContextKey, cachedLoaded, pendingRecord } from './session.js';
import { cachedSettings } from './settings.js';
import {
  TRANSPORT_MARKER_RE,
  allocateKey,
  anchor,
  plainKoreanAlias,
  requestText,
  shieldPlainText,
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

// Whether ITEMX is turned off for the bot of the open chat, from memory only
// (the display hook asks on every render). The projection is dropped by every
// write, so the character it named is remembered per chat. Unknown counts as
// enabled.
let disabledProbe = { key: '', character: null };
export function itemxDisabled() {
  const key = activeContextKey();
  const loaded = cachedLoaded();
  if (key && loaded?.key === key && loaded.character) disabledProbe = { key, character: loaded.character };
  if (!key || disabledProbe.key !== key) return false;
  return cachedSettings(disabledProbe.character)?.enabled === false;
}

// A transport tag inside a planning block or `inline code` is a mention, never
// a transport, and a Korean `[아이템: …]` line without an id= / name= field is
// story text: the parsers leave all of them in place, so treating one as
// pending raw output would re-run the commit on every catch-up. The text is
// therefore judged exactly as the parsers will see it. With ITEMX turned off
// for the bot nothing is a transport: its messages are left as they are.
export function hasRawTransport(text) {
  if (itemxDisabled()) return false;
  const source = String(text || '');
  if (!RAW_TRANSPORT_RE.test(source)) return false;
  let visible = shieldPlainText(source).text;
  Core.protectPlanning(visible, (masked) => {
    visible = masked;
    return { content: '' };
  });
  return RAW_TRANSPORT_RE.test(visible);
}

// What the model is shown of a stored or streamed text: no anchors, no old
// markers, no transport of any kind. With ITEMX turned off for the bot only
// its own anchors are taken out.
export function requestSafeText(content) {
  if (itemxDisabled()) return requestText(content);
  const source = requestText(Core.stripInventoryEcho(content));
  if (!RAW_TRANSPORT_RE.test(source) && !/<!--(?:ITEMX2|CODEX2):/.test(source)) return source;
  return stripTransport(source).replace(/\[(itemx|아이템)\s*:([^\]\r\n]{0,2048})\]/gi, (raw, tag, body) =>
    tag.toLowerCase() !== 'itemx' && plainKoreanAlias(body) ? raw : ''
  );
}

export function protocolForSettings(settings, character, moduleAssets = [], options = {}) {
  const parts = [];
  if (settings.itemsEnabled) parts.push(itemxProtocolText(settings.rarityMode));
  const domains = enabledCodexDomains(settings);
  if (domains.length) {
    const portraitRows = domains.includes('monster')
      ? protocolPortraitAssets(character, moduleAssets, Codex.ASSET_CATALOG_MAX)
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

// A status/state block or a bracket-only line is not narrative: a name in it
// never decides where a card goes.
const STATUS_PIECE_RE = /^\s*(?:\[(?:status|state|route)\b|<(?:state|status|route|risu[-_])|\[[^\]\n]*\]\s*$)/i;

const normalizedName = (value) =>
  String(value || '')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');

// Paragraphs that lie inside a code fence or an HTML block (a status window,
// a table): `true` where a piece starts or ends inside one. A card placed
// after such a piece would land inside the block, and a name written there is
// not narrative. A block that opens and closes within one piece encloses
// nothing.
const FENCE_LINE_RE = /^[ \t]*(?:`{3,}|~{3,})/;
const BLOCK_TAG_RE =
  /<(\/?)(?:div|table|details|section|article|aside|pre|blockquote|ul|ol|figure|fieldset|form|style|script|svg)\b[^>]*>/gi;
export function enclosedPieces(pieces) {
  let fence = false,
    depth = 0;
  return pieces.map((piece, index) => {
    const startedInside = fence || depth > 0;
    if (index % 2 === 0 && (piece.includes('<') || piece.includes('```') || piece.includes('~~~')))
      for (const line of piece.split('\n')) {
        if (FENCE_LINE_RE.test(line)) fence = !fence;
        else if (!fence)
          for (const tag of line.matchAll(BLOCK_TAG_RE)) {
            if (tag[0].endsWith('/>')) continue;
            depth = tag[1] ? Math.max(0, depth - 1) : depth + 1;
          }
      }
    return startedInside || fence || depth > 0;
  });
}

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
  // Each paragraph is normalized once, not once per marker: streaming runs
  // this on every flush over the whole response.
  const normalizedPieces = pieces.map((piece, index) => (index % 2 ? '' : normalizedName(piece)));
  const enclosed = enclosedPieces(pieces);
  // The nearest paragraph outside every block: before the block first, so the
  // card stays above a status window that closes the response.
  const outside = (index) => {
    if (!enclosed[index]) return index;
    for (let at = index - 2; at >= 0; at -= 2) if (!enclosed[at]) return at;
    for (let at = index + 2; at < pieces.length; at += 2) if (!enclosed[at]) return at;
    return index;
  };
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
    // The paragraph the model put the marker after. The protocol asks for the
    // marker right after the paragraph where the event happens, so a name
    // match may only pull it back to the nearest earlier mention: an
    // encounter foreshadowed in the opening (or named in a status header) must
    // not show its card above the fight. A marker on its own lines leaves only
    // blank lines behind, which the split merges into the preceding gap.
    const prefixText = source.slice(0, marker.index).replace(Core.MARKER_RE, '').replace(Codex.MARKER_RE, '');
    const ownParagraphs = prefixText.trimEnd() ? prefixText.trimEnd().split(/\n{2,}/).length : 1;
    let ownIndex = Math.min((ownParagraphs - 1) * 2, Math.max(0, pieces.length - 1));
    if (ownIndex % 2) ownIndex -= 1;
    // Nearness wins over match quality: the opening may use the full name
    // and the fight a short one, and the card still belongs to the fight.
    let before = -1,
      after = -1;
    for (let index = 0; index < pieces.length; index += 2) {
      const paragraph = normalizedPieces[index];
      if (!paragraph || enclosed[index] || STATUS_PIECE_RE.test(pieces[index])) continue;
      const exactHit = exact.length >= 2 && paragraph.includes(exact);
      const hits = terms.filter((term) => paragraph.includes(term)).length;
      const enoughTerms = terms.length > 1 ? hits >= Math.min(2, terms.length) : hits === 1;
      if (!exactHit && !enoughTerms) continue;
      if (index <= ownIndex) before = index;
      else if (after < 0) after = index;
    }
    let bestIndex = before >= 0 ? before : after >= 0 ? after : ownIndex;
    if (trailerIndex >= 0 && bestIndex >= trailerIndex) bestIndex = Math.max(0, trailerIndex - 2);
    bestIndex = outside(bestIndex);
    const list = placements.get(bestIndex) || [];
    list.push(marker);
    placements.set(bestIndex, list);
  }
  for (const [index, rows] of placements) {
    pieces[index] = `${pieces[index].trimEnd()}\n\n${rows.map((row) => `<!--${row.prefix}:${row.code}-->`).join('\n')}`;
  }
  return pieces.join('').trimEnd();
}

// Positions the transport markers in `content` and replaces each with an
// anchor. Keys derive from `seed` (chat, turn) and the marker itself, so every
// pass over the same response agrees; `doc` keys are never reused.
// `markers` are appended to `content` first.
export const anchorTransport = (content, markers, options) =>
  anchorMarkers(`${String(content || '').trimEnd()}\n\n${markers}`, options);

function anchorMarkers(text, { seed, doc, review = null, liveAnchor = null }) {
  const records = [];
  const used = new Set();
  let ordinal = 0;
  const positioned = positionMarkersByNarrative(text);
  const out = positioned.replace(TRANSPORT_MARKER_RE, (raw, prefix, code) => {
    const payload = (prefix === 'ITEMX2' ? Core : Codex).decodePayload(code);
    if (!payload?.event || payload.error) return '';
    // A marker may stand in model text: it never carries reader authority.
    payload.event = Core.modelEvent(payload.event);
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
  const text = String(content || '');
  // Story text the engine would take for transport is shielded while parsing.
  const shield = shieldPlainText(text);
  const items = settings.itemsEnabled
    ? Core.extractResponse(shield.text, state.registry)
    : { content: stripItemTransport(shield.text), events: [], errors: [] };
  const codex = Codex.extractResponse(items.content, state.codex, {
    enabledDomains: enabledCodexDomains(settings),
    rarityMode: settings.rarityMode,
    skillEvidenceText: text
  });
  const anchored = anchorMarkers(shield.restore(codex.content), { seed, doc, review, liveAnchor });
  return {
    content: anchored.content,
    records: anchored.records,
    events: items.events.length + codex.events.length,
    errors: items.errors.length + codex.errors.length,
    codexSnapshot: codex.snapshot
  };
}
