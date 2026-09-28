# ITEMX recovery quality implementation plan

Status: implementation-ready plan, no code changes included

Target: ITEMX 2 RisuAI API v3 plugin

Scope: auxiliary item recovery quality, bounded repair, icon policy, and skill/encounter parity

## 한국어 핵심 요약

이 계획은 구조상 유효하지만 내용이 빈약한 보조모델 폴백을 그대로 확정하는 문제를 고친다.

- 아이템은 `complete / partial / rejected`로 판정한다.
- 판정은 필드 개수가 아니라 해당 아이템의 본문 근거와 저장 결과를 대조한다.
- 일반 재료는 능력치와 효과가 없어도 정상이다.
- 상세 감정문에 명시된 공격력·강화·효과가 빠졌을 때만 `partial`로 판정한다.
- `partial`이어도 ID·이름·소유권·수량 등 확정 사실은 보존한다.
- 환각된 요구 레벨·내구도·가격 등은 partial 선저장에서 제거한다.
- 같은 메시지의 불완전 아이템은 한 번의 배치 보조호출로만 보완한다.
- 보완은 새 감정이 아니라 허용된 필드의 `itemPatch op=merge`만 받는다.
- 보완 실패 후 자동 재시도하지 않으며 아이템은 `partial_final`로 남긴다.
- 전체 과정은 메모리에서 조립한 뒤 채팅 저장과 UI 무효화를 각각 한 번만 수행한다.
- `<sys>`나 특정 봇 상태변수는 인식하지 않는다. 임의 래퍼 안의 자연어 의미를 읽는다.
- 아이템·스킬·몬스터 이모지는 모델의 자유로운 단일 이모지 선택을 우선한다.
- 누락·잘못된 값·`❔`에만 로컬 결정론적 폴백을 적용하며 추가 모델호출은 하지 않는다.
- 스킬은 영구적인 기술·능력·숙련 변화만 기록하고 일시적 전투 연출은 제외한다.
- 정상 출력에는 추가 모델호출이 없고, 실제 상세정보 누락에서만 최대 한 번 호출한다.
- 기준 회귀 사례는 `+12 심연의 묵시록`이며 실제 공격력·강화·세 효과·아이콘을 모두 검증한다.

## 1. Outcome

ITEMX must preserve every item event that is clearly settled by the narrative without accepting a degraded appraisal as complete.

The implementation must:

- keep item identity, ownership, location, and quantity even when appraisal details are incomplete;
- distinguish a legitimate simple material from an equipment appraisal that lost explicit stats or effects;
- repair all incomplete items from one assistant message in at most one batched auxiliary call;
- never retry automatically after that bounded repair;
- commit the recovered message, ledger, snapshots, and auxiliary history atomically;
- let the model choose expressive, item-specific emoji/glyphs;
- use deterministic icon fallback only for missing, invalid, or placeholder values;
- apply the same free-choice-plus-fallback policy to items, skills, and encounters;
- infer persistent skill or proficiency changes from narrative meaning, not from a bot-specific wrapper such as `<sys>`;
- add negligible work to normal outputs and no additional model call unless a high-confidence omission is detected.

## 2. Confirmed defect fixture

The Erencha output for `+12 심연의 묵시록` explicitly established:

- item type: one-handed sword;
- rarity: Epic;
- attack: `4,850 ~ 5,320`;
- enhancement: `+12`, physical attack `+185%`, defense penetration `35%`;
- three named effects: `심연의 포식`, `종말의 전조`, and `완전한 결속`;
- creator/original owner information.

The committed ITEMX event instead contained:

- generic power `1500-3999`;
- invented requirement `레벨 100`;
- invented durability `350/350`;
- auction result reused as fixed item cost;
- `emoji: ❔`;
- `effects: []` and `augments: []`.

This was not a transport collision. The auxiliary model returned a structurally valid but semantically incomplete fallback, `applyEvent()` accepted it, and the existing processed guard prevented an automatic second examination.

This fixture is the primary regression case.

## 3. Non-goals

- Do not recognize or depend on `<sys>` or any other bot-specific wrapper.
- Do not modify Erencha or another character/module to accommodate ITEMX.
- Do not require effects on mundane materials merely because an item exists.
- Do not invent stats, requirements, durability, cost, affinities, or effects to satisfy a field-count rule.
- Do not replace a valid model-selected emoji with a rigid type table.
- Do not scan and reappraise the entire historical chat automatically.
- Do not add per-item model calls, retry loops, streaming-time recovery, or intermediate UI remounts.

## 4. Core design

### 4.1 Preserve field provenance before defaults

`src/core.js` currently normalizes missing values before the recovery layer can tell whether the model supplied them. Mirror the provenance mechanism already used by CODEX:

```js
item._provided = ['id', 'name', 'type', 'emoji', 'power', 'effects'];
```

Requirements:

- Build `_provided` from canonical raw transport keys before defaults are applied.
- Distinguish an omitted field from an explicitly supplied empty value.
- Preserve provenance on the event long enough for validation and replay.
- Remove `_provided` from registry entities and render views.
- Keep old markers without `_provided` readable; they use legacy inference and placeholder checks.

This provenance must cover at least:

- identity: `id`, `name`, `type`, `emoji`;
- appraisal: rarity/display rarity, power, required, durability, cost, trivia;
- presentation: theme, affinity, affinity2, condition;
- collections: effects and augments;
- state: possession, location, count, slot, pin.

### 4.2 Separate narrative evidence from output completeness

Add a recovery-quality layer in `src/runtime.js` with pure helpers that can be unit tested:

```js
detectItemEvidence(narrative, candidate)
validateRecoveredItem(event, evidence, registry)
projectSafePartial(event, evidence, registry)
```

`validateRecoveredItem()` returns:

```js
{
  status: 'complete' | 'partial' | 'rejected',
  event,
  missing: ['power', 'effects'],
  unsupported: ['required', 'durability'],
  evidence: { power: true, effects: true, augments: true }
}
```

The validator asks whether the recovered event covers facts explicitly established by the relevant narrative. It must not merely count fields.

### 4.3 Wrapper-agnostic narrative handling

Evidence extraction operates on visible narrative text while treating markup wrappers as syntax noise:

- preserve the inner text of unknown XML/HTML-like wrappers;
- remove ITEMX/CODEX transports and hidden thought/analysis blocks using existing helpers;
- never special-case `<sys>`, Erencha variables, or another module's tag names;
- recognize item facts in ordinary prose, lists, quoted tooltips, tables, and arbitrary wrappers.

The detector is deliberately conservative. Failure to detect evidence does not reject an item and does not cause a repair call.

### 4.4 Attribute evidence to the correct item

Never run effect/stat regexes over the entire 14,000-character auxiliary narrative and assign the result to every item.

For each candidate:

1. locate exact item names and known aliases;
2. identify the closest appraisal/acquisition paragraph or structured block;
3. stop the window at the next independently named item or strong section boundary;
4. retain a bounded surrounding context for pronoun continuity;
5. mark evidence ambiguous when two items cannot be separated safely.

Ambiguous evidence must not create a partial repair request. The item remains preserved with the facts that are certain.

### 4.5 Evidence policy

High-confidence evidence includes:

- explicitly labeled numeric stats or ranges;
- explicitly labeled enhancement, forging, socket, engraving, or upgrade data;
- named or enumerated effects/options with descriptions;
- explicit ownership, acquisition, equipment, transfer, loss, destruction, or quantity changes;
- explicit item type, rarity, durability, requirement, cost, affinity, or condition.

Generic combat prose such as “damage increased” must not become an item effect unless the relevant item context establishes that it is a persistent item property.

Explicit setting values win. Rarity-based power ranges are a fallback only when a full appraisal is requested and the narrative supplies no literal value. A literal attack range must not be replaced by the rarity band's generic minimum and maximum.

### 4.6 Three validation states

#### Complete

- identity is valid;
- all high-confidence facts established in that item's narrative segment are represented;
- omitted optional fields have no detected narrative evidence;
- ordinary materials may have empty stats and effects.

#### Partial

- identity and the settled item event are valid;
- one or more high-confidence narrative facts are missing or contradicted;
- unsupported invented fields may also be present;
- the item must be preserved, not discarded.

#### Rejected

- name is missing or the event cannot be parsed/applied;
- the ID is invalid and cannot be safely normalized;
- the event targets an unrelated or forbidden ID during repair;
- a repair attempts state mutation outside its allowed scope.

One rejected event must not reject sibling items from the same message.

## 5. Safe partial projection

Do not construct a partial item by spreading the entire degraded event. That would preserve hallucinated fields.

`projectSafePartial()` creates a new object containing only:

- valid ID and name;
- explicitly supported type and rarity;
- settled possession, location, count, and slot;
- appraisal fields supported by the item's evidence segment;
- an icon resolved by the icon policy below;
- existing authoritative fields when enriching a known ID.

Unsupported invented requirement, durability, cost, power, affinity, effects, and augments are removed or inherited from an existing authoritative item rather than committed as new facts.

The projected partial exists in the in-memory transaction. It is committed even if the single repair call fails, so the item itself never disappears.

## 6. Bounded batch repair

Collect all partial items from the assistant message and invoke the auxiliary model at most once:

```text
Repair ONLY the listed incomplete ITEMX items.
Do not create new items or change identity/state.
Preserve id, name, possession, location, slot and count.
Fill only the listed missing fields supported by each supplied evidence segment.
Do not invent effects for ordinary materials.
Return itemPatch op=merge blocks only.
Return nothing for an item when the supplied evidence does not support a repair.
```

Repair validation rules:

- only `itemPatch op=merge` is accepted;
- patch IDs must be in the partial-ID whitelist;
- supplied fields must be a subset of that item's missing/repairable fields;
- possession, location, count, slot, pin, actions, transform, and swap are forbidden;
- every patch is applied to an independent scratch registry;
- one failed patch does not invalidate accepted sibling patches;
- no second automatic repair call is allowed.

Use `itemPatch op=merge`, not a replacement `itemExam`, so descriptive repair cannot resurrect, unequip, move, or collapse a stack.

## 7. Atomic recovery transaction

One auxiliary recovery transaction performs:

```text
parse initial response
→ validate all events
→ project safe partials in memory
→ make zero or one batch repair call
→ validate and merge accepted repair patches
→ create/position markers
→ compact transports and rebuild snapshots
→ write chat once
→ invalidate cache/generation once
→ render once
```

Do not write a partial chat before the repair call and then write it again. If repair fails or times out, commit the in-memory partial result once.

## 8. Auxiliary history and loop prevention

Extend the processed record while remaining compatible with existing `{ at, events }` rows:

```js
{
  at,
  qualityRevision,
  state: 'complete' | 'partial_final' | 'rejected',
  events,
  partialIds: []
}
```

Rules:

- `complete`: no automatic rerun;
- `partial_final`: item preserved, bounded repair exhausted, no automatic rerun;
- `rejected`: rejected candidates recorded for diagnostics, no automatic rerun;
- `force=true`: a user-requested manual inspection may retry;
- quality revision changes may re-evaluate only the current settled output, never the entire history automatically.

The guard is written only after the single transaction reaches its final state.

## 9. Emoji and glyph policy

### 9.1 Model choice is primary

The ITEMX 1.1 and 1.2 protocols required a single emoji but did not impose a closed type-to-icon table. Preserve that expressive behavior.

Update protocols to say:

- item: choose one fitting emoji representing the item's identity, form, or use; do not use `❔`;
- skill: choose one fitting emoji representing its manifestation, action, affinity, or function; do not repeat `✨` mechanically;
- encounter: choose one fitting emoji representing species, form, ecology, or threat; do not repeat `⚔️` mechanically.

A valid model-selected emoji must never be overwritten merely because a deterministic table would choose another.

### 9.2 Validate presentation tokens

Add a shared presentation helper:

```js
isUsableGlyph(value)
resolveItemEmoji(item)
resolveSkillGlyph(skill)
resolveMonsterGlyph(monster)
```

Accept one visible emoji grapheme, including a valid variation selector or ZWJ sequence. Reject:

- empty values;
- `❔` and replacement glyphs;
- ordinary words or markup;
- control characters;
- oversized multi-symbol strings.

### 9.3 Deterministic fallback is secondary

Fallback must be local and must not trigger another model call.

- Item fallback uses specific item type/name families, then a neutral `📦` fallback.
- Skill fallback may use affinity/type families, then `✨` only as the final generic value.
- Encounter fallback may use explicit kind/name families, then `🐾` or another neutral encounter value instead of treating every entity as combat.

Legacy records containing `❔`, missing glyphs, or invalid text receive fallback at normalization/render time. This guarantees correct display without automatically rewriting every historical message. An explicit rebuild may upgrade stored views later.

For the confirmed fixture, `+12 심연의 묵시록` resolves to a fitting model choice when supplied; otherwise its known one-handed-sword identity resolves locally to `🗡️`.

## 10. Skill and encounter parity

CODEX already records `_provided` for skill and monster exams. Reuse that provenance for quality checks rather than creating a separate scheme.

Skill recovery must be semantic and wrapper-agnostic:

- record a named, persistent capability, technique, proficiency, or mastery acquisition;
- patch persistent level/mastery changes on an existing ID;
- exclude transient buffs, ordinary movement, flavor-only attacks, and system notifications without a settled capability change;
- do not depend on state-variable names or bot markup.

Encounter behavior remains event-based:

- actual hostility, combat, or accepted sparring may register;
- mention, rumor, passive NPC appearance, or an unaccepted challenge does not register;
- icon freedom and fallback follow the shared policy.

Do not add an automatic second CODEX model call in this patch unless a CODEX event participates in the same already-required batch repair. Initial scope should repair item appraisal completeness and improve CODEX prompt/icon validation without expanding normal call counts.

## 11. Implementation phases

### Phase A — provenance and presentation primitives

Files:

- `src/core.js`
- `src/codex.js`
- `src/renderer.js`
- tests for core and CODEX

Work:

- add item `_provided` provenance;
- keep provenance out of registry/render entities;
- add shared glyph validation and domain fallbacks;
- make renderers safe for legacy `❔` values;
- update item, skill, and encounter protocol wording.

### Phase B — evidence and validation

Files:

- `src/runtime.js`
- optionally a new small `src/quality.js` if extraction makes runtime harder to audit;
- focused quality tests

Work:

- extract item-specific narrative segments;
- detect conservative high-confidence evidence;
- classify complete/partial/rejected;
- create safe partial projections;
- expose debug summaries without storing full prompts or model output.

### Phase C — one-shot repair transaction

Files:

- `src/runtime.js`
- auxiliary stability/runtime mock tests

Work:

- batch partial items into one repair prompt;
- accept whitelisted merge patches only;
- apply per item;
- perform one final chat write and one UI invalidation;
- add quality-aware processed history and manual-force behavior.

### Phase D — legacy and regression behavior

Work:

- display fallback for existing placeholder icons;
- re-evaluate the current settled output under a new quality revision;
- retain explicit manual inspection for older historical records;
- verify no live database or character/module changes are required.

## 12. Required tests

### Parser and provenance

- omitted emoji/effects are distinguishable from explicitly supplied values;
- `_provided` does not leak into inventory/render entities;
- old events without `_provided` still rebuild;
- valid ZWJ emoji is accepted; `❔`, text, and markup are rejected.

### Item quality

- ordinary ore/material with no stats or effects is complete and causes no repair call;
- detailed weapon appraisal missing effects becomes partial;
- literal attack range is preserved instead of replaced by a rarity range;
- invented requirement/durability/cost are removed from safe partial projection;
- explicit enhancement becomes an augment or another documented descriptive field;
- acquisition plus later sale yields separate appraisal/state events rather than one removed exam.

### Confirmed fixture

For `+12 심연의 묵시록`, assert:

- no `❔` icon;
- actual attack and `+12` enhancement evidence retained;
- all three named effects retained after repair;
- unsupported level/durability/fixed-price fields absent;
- appraisal and sale are not collapsed incorrectly;
- one auxiliary repair call maximum;
- one final `setChatToIndex()` maximum.

### Multiple items

- all identities are preserved when one of several items is partial;
- evidence from item A is not assigned to item B;
- all partials share one repair call;
- one bad repair patch does not reject siblings;
- marker order remains narrative order.

### Loop and lifecycle

- streaming output makes no validation/repair call;
- complete outputs do not call repair;
- `partial_final` does not retry automatically;
- manual force can retry once;
- rerolls and context switches do not commit stale results;
- no drawer opening, flicker, or repeated remount occurs during repair.

### Skills and encounters

- a persistent named capability is detected in plain prose and inside an arbitrary wrapper with identical behavior;
- transient combat prose is not registered as a skill;
- model-selected skill/monster glyphs are preserved;
- missing glyphs receive local fallback without a model call.

## 13. Performance gates

Normal settled output:

- zero added model calls;
- one bounded narrative pass and per-event validation only;
- no additional chat write;
- no additional full inventory render.

Incomplete detailed appraisal:

- at most one added auxiliary call per assistant message;
- all incomplete items batched into that call;
- one final chat write and one UI generation increment;
- timeout/failure ends in `partial_final` without retry.

Test instrumentation must count:

- `runLLMModel` calls;
- `getChatFromIndex` and `setChatToIndex` calls;
- rebuilds and UI invalidations;
- accepted, partial, repaired, and rejected event counts.

No visual effect, particle count, or animation quality reduction is part of this work.

## 14. Diagnostics and UX

Debug mode may show compact structured records such as:

```text
quality: items=3 complete=2 partial=1 rejected=0
repair: attempted=1 accepted=1 failed=0
state: complete
```

Do not store complete auxiliary prompts or raw model responses in chat history. The user-facing status may distinguish:

- `보조 복구 완료 · N건`;
- `상세정보 보완 완료 · N건`;
- `아이템 보존 · 상세정보 일부 미완성`.

The last state must not blink, reopen the drawer, or loop.

## 15. Verification and release gate

Before release:

1. run the complete Node test suite;
2. build the plugin and verify source/dist version consistency;
3. run the API v3 runtime mock tests with call counters;
4. verify the browser UI for inline card, inventory detail, skill detail, and encounter detail;
5. test a multi-item detailed appraisal and the confirmed `+12 심연의 묵시록` fixture;
6. test on PocketRisu 1.10.0 mobile without using obsolete PocketRisu sources;
7. inspect the produced diff and public bundle for secrets or bot-specific tags;
8. update the public repository only after explicit commit/push authorization;
9. deploy/restart live Risu only after explicit deployment authorization.

## 16. Definition of done

This work is complete only when:

- a semantically incomplete but structurally valid item exam cannot silently become complete;
- a partial item remains in inventory even when repair fails;
- ordinary materials are not overvalidated or decorated with invented effects;
- detailed appraisals retain explicit stats, enhancements, and effects;
- model-selected item/skill/monster emoji remain expressive;
- missing or placeholder icons never render as `❔` when a safe local fallback exists;
- multiple items are isolated and repaired in one bounded batch;
- no bot-specific wrapper or state key is required;
- automatic recovery cannot loop;
- normal-output call count and UI write/remount count do not regress.
