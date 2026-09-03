/* ITEMX 2 recovery quality: conservative narrative evidence and safe partials. */
const ITEMXQuality = (() => {
  'use strict';
  const REVISION = 3;
  const DETAIL_FIELDS = ['power', 'effects', 'augments', 'required', 'durability', 'cost'];
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const digits = (value) => String(value ?? '').match(/\d[\d,]*/g)?.map((one) => one.replace(/,/g, '')) || [];
  const FIELD_LABEL = /(?:공격력|위력|damage|attack|atk|(?:요구|필요)\s*(?:레벨|조건)|required\s*(?:level|condition)|내구도?|durability|가격|가치|정가|price|cost|value)/i;

  function evidenceValue(value) {
    let out = clean(value);
    const boundary = out.search(new RegExp(`\\s+(?:[/|;,·]\\s*)?(?=${FIELD_LABEL.source})`, 'i'));
    if (boundary >= 0) out = out.slice(0, boundary);
    return clean(out.replace(/[|;,·/]+$/g, ''));
  }

  function qualitativeMatches(actual, expected) {
    const normalize = (value) => clean(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const actualNormalized = normalize(actual), expectedNormalized = normalize(expected);
    if (!actualNormalized || !expectedNormalized) return false;
    if (actualNormalized.includes(expectedNormalized) || expectedNormalized.includes(actualNormalized)) return true;
    const tokens = clean(expected).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    return tokens.length > 0 && tokens.every((token) => {
      const normalized = normalize(token);
      return normalized.length > 1 && actualNormalized.includes(normalized);
    });
  }

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
    const paragraphStart = source.lastIndexOf('\n\n', at);
    let start = paragraphStart < 0 ? 0 : paragraphStart + 2;
    let end = source.indexOf('\n\n', at + name.length);
    if (end < 0) end = source.length;
    end = Math.min(source.length, end + 900);
    for (const other of siblings) {
      const otherName = clean(other?.name);
      if (!otherName || otherName === name) continue;
      const otherAt = source.toLowerCase().indexOf(otherName.toLowerCase(), start);
      if (otherAt >= 0 && otherAt < at) start = at;
      else if (otherAt > at && otherAt < end) end = otherAt;
    }
    return source.slice(start, end).slice(0, 2400);
  }

  function detectItemEvidence(text, item, siblings = []) {
    const segment = relevantItemNarrative(text, item, siblings);
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
    const requiredHit = segment.match(/(?:(?:요구|필요)\s*(?:레벨|조건)|required\s*(?:level|condition))\s*[:：]?\s*([^\n]{0,180})/i);
    const durabilityHit = segment.match(/(?:내구도?|durability)\s*[:：]?\s*([^\n]{0,180})/i);
    const costHit = segment.match(/(?:가격|가치|정가|price|cost|value)\s*[:：]?\s*([^\n]{0,180})/i);
    const requiredText = requiredHit ? evidenceValue(requiredHit[1]) : '';
    const durabilityText = durabilityHit ? evidenceValue(durabilityHit[1]) : '';
    const costText = costHit ? evidenceValue(costHit[1]) : '';
    const powerText = powerHit ? evidenceValue(powerHit[1]) : '';
    return {
      segment,
      power: Boolean(powerText && digits(powerText).length), powerText, powerValues: digits(powerText).slice(0, 2),
      effects: effectAt >= 0 && effectNames.length > 0, effectNames,
      augments: Boolean(augmentHit), augmentLevel: augmentHit ? clean(augmentHit[1]).replace(/\s+/g, '') : '',
      required: Boolean(requiredText), requiredText, requiredValues: digits(requiredText),
      durability: Boolean(durabilityText && digits(durabilityText).length), durabilityText, durabilityValues: digits(durabilityText).slice(0, 2),
      cost: Boolean(costText && /[\d₩$€¥]/.test(costText)), costText, costValues: digits(costText).slice(0, 2)
    };
  }

  function validateRecoveredItem(event, evidence) {
    if (event?.kind !== 'exam' || !event.item?.id || !event.item?.name) return { status: 'rejected', event, missing: [], evidence };
    // An auxiliary appraisal without a matching narrative segment is not a
    // weak appraisal; it is an unsupported identity and must never be saved.
    if (!evidence?.segment) return { status: 'rejected', event, missing: [], evidence };
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
    for (const key of ['required', 'durability', 'cost']) {
      if (evidence[key] && (!provided.has(key) || !repairFieldMatches(key, item[key], evidence))) missing.push(key);
    }
    return { status: missing.length ? 'partial' : 'complete', event, missing: [...new Set(missing)], evidence };
  }

  function projectSafePartial(event, result, registry) {
    const prior = registry?.items?.[event.item.id], source = ITEMXCore.clone(event.item), evidence = result.evidence || {};
    const item = prior ? ITEMXCore.clone(prior) : source;
    const property = { type: 'itemType', internalrarity: 'rarity', displayrarity: 'displayRarity' };
    if (prior) for (const key of source._provided || []) {
      const target = property[key] || key;
      if (!result.missing.includes(key) && !['possession','location','count','slot','pin'].includes(key)) item[target] = ITEMXCore.clone(source[target]);
    }
    item.id = source.id; item.name = source.name;
    for (const key of ['required', 'durability', 'cost']) if (!evidence[key] && !prior) item[key] = '';
    for (const key of result.missing || []) {
      if (key === 'effects' || key === 'augments') item[key] = prior?.[key] ? ITEMXCore.clone(prior[key]) : [];
      else item[key] = prior?.[key] || '';
    }
    item.emoji = ITEMXCore.resolveItemEmoji(item);
    item._provided = (source._provided || []).filter((key) => !result.missing.includes(key) && (!DETAIL_FIELDS.includes(key) || evidence[key]));
    return { kind: 'exam', item };
  }

  function repairFieldMatches(key, value, evidence) {
    if (key === 'effects') {
      const actual = (value || []).map((one) => `${one.name} ${one.desc}`).join(' ').toLowerCase();
      return evidence.effectNames?.every((name) => actual.includes(name.toLowerCase()));
    }
    if (key === 'augments') {
      const actual = (value || []).map((one) => `${one.name} ${one.desc}`).join(' ').replace(/\s+/g, '');
      return Boolean(evidence.augmentLevel && actual.includes(evidence.augmentLevel));
    }
    const actual = clean(value), expected = key === 'power' ? evidence.powerValues : evidence[`${key}Values`] || [];
    if (!actual) return false;
    if (key === 'required' && expected.length === 0) return qualitativeMatches(actual, evidence.requiredText);
    if (!expected.length) return false;
    return expected.every((number) => digits(actual).includes(number));
  }

  function repairPrompt(partials, narrative) {
    const rows = partials.map((one) => `- id=${one.event.item.id} | name=${one.event.item.name} | missing=${one.missing.join(', ')} | evidence=${one.evidence.segment.slice(0, 1800)}`).join('\n');
    return `Repair ONLY the incomplete ITEMX items listed below. Do not create items. Preserve id and identity. Emit exactly one <itemPatch><id>...</id><op>merge</op> per item that can be repaired, filling only its listed missing fields from explicit narrative evidence. Never emit actions or possession, location, count, slot, required, durability or cost unless that exact field is listed missing. Use <effects><effect><effectname>...</effectname><effectdesc>...</effectdesc></effect></effects> and the equivalent augments structure. Output no prose or code fence; output NONE if nothing is supported.\n\nINCOMPLETE ITEMS:\n${rows}\n\nCOMMITTED NARRATIVE:\n${String(narrative || '').slice(0, 14000)}`;
  }

  function acceptRepair(event, partialMap, registry) {
    if (event?.kind !== 'patch' || event.patch?.op !== 'merge' || event.patch.action) return null;
    const partial = partialMap.get(event.patch.id), keys = Object.keys(event.patch.fields || {});
    if (!partial || !keys.length || keys.some((key) => !partial.missing.includes(key))) return null;
    if (keys.some((key) => !repairFieldMatches(key, event.patch.fields[key], partial.evidence || {}))) return null;
    const scratch = ITEMXCore.clone(registry);
    return ITEMXCore.applyEvent(scratch, event) ? event : null;
  }

  return { REVISION, narrativeText, relevantItemNarrative, detectItemEvidence, validateRecoveredItem, projectSafePartial, repairPrompt, acceptRepair };
})();

if (typeof globalThis !== 'undefined') globalThis.ITEMXQuality = ITEMXQuality;
