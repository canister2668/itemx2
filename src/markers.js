import * as Codex from './engine/codex.js';
import * as Core from './engine/core.js';
import { ITEMX_CODEX_REF_RE, ITEMX_REF_RE } from './config.js';
import { eventPayload } from './session.js';
export const messageData = (message) => Core.messageText(message);

export const markerCodes = (text) => {
  const out = new Set();
  String(text || '').replace(Core.MARKER_RE, (_, code) => {
    out.add(`ITEMX2:${code}`);
    return '';
  });
  String(text || '').replace(Codex.MARKER_RE, (_, code) => {
    out.add(`CODEX2:${code}`);
    return '';
  });
  String(text || '').replace(ITEMX_REF_RE, (_, ref) => {
    out.add(`ITEMX2@${ref}`);
    return '';
  });
  String(text || '').replace(ITEMX_CODEX_REF_RE, (_, ref) => {
    out.add(`CODEX2@${ref}`);
    return '';
  });
  return out;
};

export function embeddedViewCode(payload, domain) {
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
    ? { m: payload.previous.mastery, s: payload.previous.status, v: Core.comparisonView(payload.previous) }
    : undefined;
  const envelope =
    domain === 'codex'
      ? {
          v: Codex.VERSION,
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
          v: Core.VERSION,
          p: Core.comparisonView(payload.previous),
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
  const marker = Core.marker(envelope);
  return marker.startsWith('<!--ITEMX2:') && marker.endsWith('-->') ? marker.slice('<!--ITEMX2:'.length, -3) : '';
}

export function compactRefMarker(prefix, ref, payload, domain) {
  const code = embeddedViewCode(payload, domain);
  return `<!--${prefix}@${ref}${code ? `:${code}` : ''}-->`;
}

export function inlineViewPayload(code, domain) {
  if (!code) return null;
  const payload = Core.decodePayload(code);
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

export function itemMarkerPayload(marker) {
  const full = String(marker || '').match(/^<!--ITEMX2:([A-Za-z0-9_-]+)-->$/);
  if (full) return Core.decodePayload(full[1]);
  const ref = String(marker || '').match(/^<!--ITEMX2@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?-->$/);
  if (!ref) return null;
  return eventPayload(`item:${ref[1]}`) || inlineViewPayload(ref[2], 'item') || null;
}

export function itemPayloadId(payload) {
  return payload?.view?.id || payload?.event?.item?.id || payload?.event?.patch?.id || '';
}

export function coalesceAdjacentItemMarkers(content) {
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

export function bareRefMarker(prefix, ref) {
  return `<!--${prefix}@${ref}-->`;
}

export function presentationPayloads(text) {
  const rows = [];
  String(text || '').replace(
    /<!--(ITEMX2|CODEX2)(?::([A-Za-z0-9_-]+)|@([A-Za-z0-9_-]{1,80})(?::([A-Za-z0-9_-]+))?)-->/g,
    (raw, prefix, code, ref, inline, at) => {
      const domain = prefix === 'ITEMX2' ? 'item' : 'codex';
      const payload = code
        ? (domain === 'item' ? Core : Codex).decodePayload(code)
        : eventPayload(`${domain}:${ref}`) || inlineViewPayload(inline, domain);
      if (payload?.view && !payload.error)
        rows.push({ payload, domain: domain === 'codex' ? payload.event?.domain : 'item', at });
      return raw;
    }
  );
  return rows;
}
