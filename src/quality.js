/* ITEMX 2 recovery quality: conservative narrative evidence and safe partials. */
const ITEMXQuality = (() => {
  'use strict';
  const REVISION = 1;
  const DETAIL_FIELDS = ['power', 'effects', 'augments', 'required', 'durability', 'cost'];
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const digits = (value) => String(value ?? '').match(/\d[\d,]*/g)?.map((one) => one.replace(/,/g, '')) || [];

  function narrativeText(value) {
    return String(value || '')
      .replace(/<(thoughts|analysis)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(ITEMXCore.MARKER_RE, '').replace(/<!--CODEX2:[A-Za-z0-9_-]+-->/g, '')
      .replace(/<\/?[A-Za-z][^>]*>/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function relevantItemNarrative(text, item, siblings = []) {
    const source = narrativeText(text), name = clean(item?.name);
    if (!source || name.length < 2) return '';
    const at = source.toLowerCase().indexOf(name.toLowerCase());
    if (at < 0) return '';
    let start = Math.max(0, source.lastIndexOf('\n\n', at) + 2);
    let end = source.indexOf('\n\n', at + name.length);
    if (end < 0) end = source.length;
    end = Math.min(source.length, end + 900);
    for (const other of siblings) {
      const otherName = clean(other?.name);
      if (!otherName || otherName === name) continue;
      const otherAt = source.toLowerCase().indexOf(otherName.toLowerCase(), at + name.length);
      if (otherAt >= 0 && otherAt < end) end = otherAt;
    }
    return source.slice(start, end).slice(0, 2400);
  }

  function detectItemEvidence(text, item, siblings = []) {
    const segment = relevantItemNarrative(text, item, siblings);
    const labeled = (pattern) => pattern.test(segment);
    const powerHit = segment.match(/(?:공격력|위력|damage|attack|atk)\s*[:：]?\s*([^\n]{0,90})/i);
    const effectAt = segment.search(/(?:고유\s*효과|특수\s*효과|unique\s*effects?|special\s*effects?)/i);
    const effectTail = effectAt >= 0 ? segment.slice(effectAt, effectAt + 1400) : '';
    const effectNames = [
      ...[...effectTail.matchAll(/[\[【「](.{2,80}?)[\]】」]/g)].map((m) => clean(m[1])),
      ...[...effectTail.matchAll(/\*\*([^*\n]{2,80})\*\*/g)].map((m) => clean(m[1])),
      ...[...effectTail.matchAll(/(?:^|\n)\s*(?:[-•]|\d+[.)])\s*([^:\n：—]{2,60})\s*[:：—]/g)].map((m) => clean(m[1]))
    ].filter((name, index, all) => !/^(?:특수\s*효과|고유\s*효과|effects?)$/i.test(name) && all.indexOf(name) === index).slice(0, 12);
    const augmentHit = segment.match(/(?:강화|제련|인챈트|enhancement|upgrade)[^\n]{0,45}?(\+\s*\d{1,3}|\d{1,3}\s*강)/i)
      || segment.match(/(\+\s*\d{1,3})[^\n]{0,24}(?:강화|제련|인챈트)/i);
    return {
      segment,
      power: Boolean(powerHit && digits(powerHit[1]).length), powerValues: powerHit ? digits(powerHit[1]).slice(0, 2) : [],
      effects: effectAt >= 0 && effectNames.length > 0, effectNames,
      augments: Boolean(augmentHit), augmentLevel: augmentHit ? clean(augmentHit[1]).replace(/\s+/g, '') : '',
      required: labeled(/(?:요구|필요)\s*(?:레벨|조건)|required\s*(?:level|condition)/i),
      durability: labeled(/(?:내구도?|durability)\s*[:：]?\s*\d/i),
      cost: labeled(/(?:가격|가치|정가|price|cost|value)\s*[:：]?\s*[\d₩$€¥]/i)
    };
  }

  function validateRecoveredItem(event, evidence) {
    if (event?.kind !== 'exam' || !event.item?.id || !event.item?.name) return { status: 'rejected', event, missing: [], evidence };
    if (!evidence?.segment) return { status: 'complete', event, missing: [], evidence };
    const item = event.item, provided = new Set(item._provided || []), missing = [];
    if (evidence.power) {
      const actual = digits(item.power);
      if (!provided.has('power') || evidence.powerValues.some((value) => !actual.includes(value))) missing.push('power');
    }
    if (evidence.effects) {
      const actual = (item.effects || []).map((one) => `${one.name} ${one.desc}`).join(' ').toLowerCase();
      if (!provided.has('effects') || evidence.effectNames.some((name) => !actual.includes(name.toLowerCase()))) missing.push('effects');
    }
    if (evidence.augments) {
      const actual = (item.augments || []).map((one) => `${one.name} ${one.desc}`).join(' ').replace(/\s+/g, '');
      if (!provided.has('augments') || !actual.includes(evidence.augmentLevel)) missing.push('augments');
    }
    for (const key of ['required', 'durability', 'cost']) if (evidence[key] && (!provided.has(key) || !clean(item[key]))) missing.push(key);
    return { status: missing.length ? 'partial' : 'complete', event, missing: [...new Set(missing)], evidence };
  }

  function projectSafePartial(event, result, registry) {
    const prior = registry?.items?.[event.item.id], source = ITEMXCore.clone(event.item), evidence = result.evidence || {};
    const item = prior ? { ...ITEMXCore.clone(prior), id: source.id, name: source.name } : source;
    for (const key of ['required', 'durability', 'cost']) if (!evidence[key] && !prior) item[key] = '';
    for (const key of result.missing || []) {
      if (key === 'effects' || key === 'augments') item[key] = prior?.[key] ? ITEMXCore.clone(prior[key]) : [];
      else item[key] = prior?.[key] || '';
    }
    item.emoji = ITEMXCore.resolveItemEmoji(item);
    item._provided = (source._provided || []).filter((key) => !result.missing.includes(key) && (!DETAIL_FIELDS.includes(key) || evidence[key]));
    return { kind: 'exam', item };
  }

  function repairPrompt(partials, narrative) {
    const rows = partials.map((one) => `- id=${one.event.item.id} | name=${one.event.item.name} | missing=${one.missing.join(', ')} | evidence=${one.evidence.segment.slice(0, 1800)}`).join('\n');
    return `Repair ONLY the incomplete ITEMX items listed below. Do not create items. Preserve id and identity. Emit exactly one <itemPatch><id>...</id><op>merge</op> per item that can be repaired, filling only its listed missing fields from explicit narrative evidence. Never emit actions or possession, location, count, slot, required, durability or cost unless that exact field is listed missing. Use <effects><effect><effectname>...</effectname><effectdesc>...</effectdesc></effect></effects> and the equivalent augments structure. Output no prose or code fence; output NONE if nothing is supported.\n\nINCOMPLETE ITEMS:\n${rows}\n\nCOMMITTED NARRATIVE:\n${String(narrative || '').slice(0, 14000)}`;
  }

  function acceptRepair(event, partialMap, registry) {
    if (event?.kind !== 'patch' || event.patch?.op !== 'merge' || event.patch.action) return null;
    const partial = partialMap.get(event.patch.id), keys = Object.keys(event.patch.fields || {});
    if (!partial || !keys.length || keys.some((key) => !partial.missing.includes(key))) return null;
    const scratch = ITEMXCore.clone(registry);
    return ITEMXCore.applyEvent(scratch, event) ? event : null;
  }

  return { REVISION, narrativeText, relevantItemNarrative, detectItemEvidence, validateRecoveredItem, projectSafePartial, repairPrompt, acceptRepair };
})();

if (typeof globalThis !== 'undefined') globalThis.ITEMXQuality = ITEMXQuality;
