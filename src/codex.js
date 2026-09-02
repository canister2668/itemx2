/* ITEMX CODEX core: deterministic skill and encounter-bestiary replay. */
const ITEMXCodex = (() => {
  'use strict';
  const VERSION = 1;
  const STATE_KEY = '$__itemx2_codex_state';
  const MARKER_RE = /<!--CODEX2:([A-Za-z0-9_-]+)-->/g;
  const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
  const SKILL_TYPES = new Set(['active', 'passive', 'sealed']);
  const SKILL_STATUS = new Set(['learned', 'equipped', 'sealed', 'lost']);
  const RELATIONS = new Set(['hostile', 'sparring', 'neutral', 'allied', 'unknown']);
  const ENCOUNTER_STATUS = new Set(['active', 'ended', 'escaped', 'defeated', 'dead', 'unknown']);
  const SKILL_ACTIONS = new Set(['learn', 'equip', 'unequip', 'mastery', 'seal', 'unseal', 'forget']);
  const ITEMX_SKILL_RANKS = new Set(['normal', 'magic', 'rare', 'unique', 'epic', 'legendary', 'mythical', 'empyrean']);
  const MONSTER_ACTIONS = new Set(['encounter', 'end', 'escape', 'defeat', 'kill', 'ally']);
  const OPS = new Set(['merge', 'remove', 'restore']);
  const clean = (value, max = 800) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const emptySkillValue = (value) => /^(?:|none|null|unknown|n\/a|없음|해당\s*없음|미상)$/i.test(clean(value, 120));
  const costValue = (value, type = 'active', status = '') => {
    const result = clean(value, 120);
    if (!emptySkillValue(result)) return result;
    if (type === 'passive') return '상시 효과 · 별도 소모 없음';
    if (type === 'sealed' || status === 'sealed') return '봉인 상태 · 발동 불가';
    return result ? '별도 소모 없음' : '발동 자원 · 서사 기준';
  };
  const cooldownValue = (value, type = 'active', status = '') => {
    const result = clean(value, 120);
    if (emptySkillValue(result)) {
      if (type === 'passive') return '상시 적용';
      if (type === 'sealed' || status === 'sealed') return '봉인 해제 후 사용 가능';
      return result ? '재사용 제한 없음' : '사용 후 회복 필요';
    }
    return /(?:\d+\s*)?(?:턴|라운드|turns?|rounds?|actions?|initiative)/i.test(result) ? '상황 조건 충족 후' : result;
  };
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fnv = (value) => ITEMXCore.fnv1a(String(value));
  const marker = (payload) => ITEMXCore.marker(payload).replace('<!--ITEMX2:', '<!--CODEX2:');
  const decodePayload = ITEMXCore.decodePayload;

  function field(body, name) {
    const hit = String(body).match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, 'i'));
    return hit ? clean(hit[1].replace(/<[^>]*>/g, ' '), name === 'description' ? 1200 : 800) : '';
  }
  function attrs(text) {
    const out = {};
    String(text || '').replace(/([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, key, a, b, c) => { out[key.toLowerCase()] = clean(a ?? b ?? c); return ''; });
    return out;
  }
  function list(value, max = 12) {
    if (!value) return [];
    const parts = String(value).includes(';;') ? String(value).split(';;') : String(value).split(',');
    return [...new Set(parts.map((one) => clean(one, 180)).filter(Boolean))].slice(0, max);
  }
  function scalar(body, a, key) { return clean(a[key] || field(body, key)); }
  function normalizeId(value, prefix, seed) { return ID_RE.test(value || '') ? value : `${prefix}_${fnv(seed)}`; }
  function boundedNumber(value, min, max) {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : null;
  }
  const mastery = (value) => boundedNumber(value, 0, 100);
  const skillLevel = (value) => boundedNumber(value, 1, 999);

  function normalizeSkillExam(raw, seed) {
    const name = clean(raw.name, 160); if (!name) return { error: 'skill_no_name' };
    const type = SKILL_TYPES.has(raw.type) ? raw.type : 'active';
    const status = SKILL_STATUS.has(raw.status) ? raw.status : (type === 'sealed' ? 'sealed' : 'learned');
    return { event: { domain: 'skill', kind: 'exam', entity: {
      id: normalizeId(raw.id, 'skill', seed), name, glyph: ITEMXCore.resolveSkillGlyph({ ...raw, name, type }), rank: clean(raw.rank, 80) || '미분류', school: clean(raw.school, 120), type, status,
      level: skillLevel(raw.level), mastery: mastery(raw.mastery), cost: costValue(raw.cost, type, status), cooldown: cooldownValue(raw.cooldown, type, status), target: clean(raw.target, 120), affinity: clean(raw.affinity, 80),
      description: clean(raw.description, 1200), effects: list(raw.effects), growth: clean(raw.growth, 800),
      _provided: Object.keys(raw).filter((key) => raw[key] !== '')
    } } };
  }
  function normalizeMonsterExam(raw, seed) {
    const name = clean(raw.name, 160); if (!name) return { error: 'monster_no_name' };
    const relation = RELATIONS.has(raw.relation) ? raw.relation : 'unknown';
    const status = ENCOUNTER_STATUS.has(raw.status) ? raw.status : 'unknown';
    return { event: { domain: 'monster', kind: 'exam', entity: {
      id: normalizeId(raw.id, 'encounter', seed), name, glyph: ITEMXCore.resolveMonsterGlyph({ ...raw, name, kind: raw.type }), aliases: list(raw.aliases, 8), kind: clean(raw.type, 100) || '미분류', threat: clean(raw.threat, 80) || '미상', relation, status,
      active: status === 'active' && ['hostile', 'sparring'].includes(relation), portrait: clean(raw.portrait, 160), weaknesses: list(raw.weaknesses), resistances: list(raw.resistances), moves: list(raw.moves), description: clean(raw.description, 1200), encounterCount: 1,
      outcome: clean(raw.outcome, 600), outcomeStatus: raw.outcome ? status : '', outcomeEncounter: raw.outcome ? 1 : 0,
      _provided: Object.keys(raw).filter((key) => raw[key] !== '')
    } } };
  }
  function normalizePatch(domain, raw) {
    const id = ID_RE.test(raw.id || '') ? raw.id : null; if (!id) return { error: `${domain}_patch_no_id` };
    const allowedActions = domain === 'skill' ? SKILL_ACTIONS : MONSTER_ACTIONS;
    const action = allowedActions.has(raw.action) ? raw.action : null, op = OPS.has(raw.op) ? raw.op : null;
    if (!action && !op) return { error: `${domain}_patch_missing_operation` };
    const allowed = domain === 'skill'
      ? ['name','glyph','rank','school','type','status','level','mastery','cost','cooldown','target','affinity','description','effects','growth']
      : ['name','glyph','aliases','type','threat','relation','status','portrait','weaknesses','resistances','moves','description','outcome'];
    const fields = {};
    for (const key of allowed) if (raw[key] !== '') fields[key === 'type' && domain === 'monster' ? 'kind' : key] = ['effects','aliases','weaknesses','resistances','moves'].includes(key) ? list(raw[key]) : clean(raw[key], key === 'description' ? 1200 : key === 'outcome' ? 600 : 800);
    if ('mastery' in fields) { fields.mastery = mastery(fields.mastery); if (fields.mastery == null) delete fields.mastery; }
    if ('level' in fields) { fields.level = skillLevel(fields.level); if (fields.level == null) delete fields.level; }
    if ('cost' in fields) fields.cost = costValue(fields.cost, fields.type, fields.status);
    if ('cooldown' in fields) fields.cooldown = cooldownValue(fields.cooldown, fields.type, fields.status);
    return { event: { domain, kind: 'patch', patch: { id, action, op, fields } } };
  }
  function parseTransport(tag, attrText, body, seed) {
    const a = attrs(attrText), raw = {};
    for (const key of ['id','name','glyph','rank','school','type','status','level','mastery','cost','cooldown','target','affinity','description','effects','growth','aliases','threat','relation','portrait','weaknesses','resistances','moves','outcome','action','op']) raw[key] = scalar(body, a, key).toLowerCase && ['type','status','relation','action','op'].includes(key) ? scalar(body, a, key).toLowerCase() : scalar(body, a, key);
    const lower = tag.toLowerCase();
    if (lower === 'skillexam') return normalizeSkillExam(raw, seed);
    if (lower === 'monsterexam') return normalizeMonsterExam(raw, seed);
    return normalizePatch(lower.startsWith('skill') ? 'skill' : 'monster', raw);
  }
  function registry() { return { order: [], entries: {}, diagnostics: [] }; }
  function snapshot() { return { schema: VERSION, skills: registry(), monsters: registry(), fingerprint: '', updatedAt: Date.now() }; }
  function put(reg, entity) { if (!reg.entries[entity.id]) reg.order.push(entity.id); reg.entries[entity.id] = entity; return entity; }
  function applyEvent(state, event) {
    if (!event || !['skill','monster'].includes(event.domain)) return null;
    const reg = event.domain === 'skill' ? state.skills : state.monsters;
    if (event.kind === 'exam') {
      if (!event.entity?.id || !ID_RE.test(event.entity.id)) { reg.diagnostics.push({ code: 'exam_invalid' }); return null; }
      const prior = reg.entries[event.entity.id], next = clone(event.entity), provided = new Set(next._provided || []);
      delete next._provided;
      if (prior && event.domain === 'skill') {
        for (const key of ['status', 'mastery', 'level', 'cost', 'cooldown']) if (!provided.has(key)) next[key] = prior[key];
      }
      if (event.domain === 'skill') { next.cost = costValue(next.cost, next.type, next.status); next.cooldown = cooldownValue(next.cooldown, next.type, next.status); next.glyph = ITEMXCore.resolveSkillGlyph(next); }
      if (prior && event.domain === 'monster') {
        for (const key of ['status', 'active', 'relation', 'encounterCount']) if (!provided.has(key)) next[key] = prior[key];
        next.encounterCount = Number(prior.encounterCount) || 1;
        if (!provided.has('outcome')) {
          next.outcome = prior.outcome || '';
          next.outcomeStatus = prior.outcomeStatus || '';
          next.outcomeEncounter = Number(prior.outcomeEncounter) || 0;
        } else {
          next.outcomeStatus = next.status;
          next.outcomeEncounter = next.encounterCount;
        }
      }
      if (event.domain === 'monster') { next.active = next.status === 'active' && ['hostile', 'sparring'].includes(next.relation); next.glyph = ITEMXCore.resolveMonsterGlyph(next); }
      return put(reg, next);
    }
    const entity = reg.entries[event.patch?.id]; if (!entity) { reg.diagnostics.push({ code: 'patch_missing', id: event.patch?.id }); return null; }
    const { action, op, fields } = event.patch;
    if (op === 'remove') { entity.status = 'lost'; entity.active = false; }
    else if (op === 'restore') Object.assign(entity, clone(fields), { status: event.domain === 'skill' ? 'learned' : 'active', active: event.domain === 'monster' });
    else if (op === 'merge') Object.assign(entity, clone(fields));
    if (event.domain === 'skill') {
      entity.cost = costValue(entity.cost, entity.type, entity.status);
      entity.cooldown = cooldownValue(entity.cooldown, entity.type, entity.status);
      entity.glyph = ITEMXCore.resolveSkillGlyph(entity);
      if (entity._inferred && fields && ('level' in fields || 'mastery' in fields)) {
        const explicitProgress = new Set(Object.keys(fields).filter((key) => key === 'level' || key === 'mastery'));
        entity._inferred = entity._inferred.filter((key) => !explicitProgress.has(key));
      }
      if (action === 'equip') entity.status = 'equipped'; if (action === 'unequip' || action === 'learn' || action === 'unseal') entity.status = 'learned';
      if (action === 'seal') entity.status = 'sealed'; if (action === 'forget') entity.status = 'lost'; if (action === 'mastery' && 'mastery' in fields) entity.mastery = mastery(fields.mastery);
    } else {
      entity.glyph = ITEMXCore.resolveMonsterGlyph(entity);
      if (action === 'encounter') { entity.status = 'active'; entity.active = true; entity.encounterCount = (Number(entity.encounterCount) || 1) + 1; }
      const endStatus = { end: 'ended', escape: 'escaped', defeat: 'defeated', kill: 'dead', ally: 'ended' }[action];
      if (endStatus) {
        entity.status = endStatus; entity.active = false; if (action === 'ally') entity.relation = 'allied';
        if (fields.outcome) { entity.outcome = fields.outcome; entity.outcomeStatus = endStatus; entity.outcomeEncounter = Number(entity.encounterCount) || 1; }
      } else if (fields.outcome) {
        entity.outcomeStatus = ENCOUNTER_STATUS.has(entity.status) ? entity.status : 'unknown';
        entity.outcomeEncounter = Number(entity.encounterCount) || 1;
      }
      if (ENCOUNTER_STATUS.has(entity.status)) entity.active = entity.status === 'active';
    }
    return entity;
  }
  function collect(text) {
    const out = [], re = /<(skillExam|skillPatch|monsterExam|monsterPatch)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi; let m;
    while ((m = re.exec(String(text)))) out.push({ start: m.index, end: re.lastIndex, raw: m[0], tag: m[1], attrs: m[2], body: m[3] });
    return out;
  }
  function stripResidual(text) {
    let out = String(text), hit = /<(?:skillExam|skillPatch|monsterExam|monsterPatch)\b/i.exec(out);
    if (hit) {
      let boundary = out.indexOf('\n\n', hit.index);
      while (boundary >= 0) {
        const suffix = out.slice(boundary + 2).trimStart();
        if (!/^<\/?(?:id|name|glyph|rank|school|type|status|level|mastery|cost|cooldown|target|affinity|description|effects|growth|aliases|threat|relation|portrait|weaknesses|resistances|moves|outcome|action|op)\b/i.test(suffix)) break;
        boundary = out.indexOf('\n\n', boundary + 2);
      }
      out = boundary < 0 ? out.slice(0, hit.index) : out.slice(0, hit.index) + out.slice(boundary + 2);
    }
    return out.replace(/<\/?(?:skillExam|skillPatch|monsterExam|monsterPatch)\b[^>]*>?/gi, '').replace(/^\s*```(?:xml)?\s*$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  function skillEvidenceSegments(text, entity) {
    const name = clean(entity?.name, 160).toLowerCase();
    const school = clean(entity?.school, 120).toLowerCase();
    const schoolTokens = school.split(/[\s·/|:_-]+/).filter((one) => one.length >= 2);
    const lines = String(text || '').split(/\r?\n|(?<=[.!?。！？])\s+/);
    const matches = lines.map((line, index) => {
      const lower = line.toLowerCase();
      let score = name && lower.includes(name) ? 4 : 0;
      if (school && lower.includes(school)) score = Math.max(score, 3);
      else if (schoolTokens.some((token) => lower.includes(token)) && /숙련|기술|스킬|skill|proficiency|grade|\blv\b|level/i.test(line)) score = Math.max(score, 2);
      return { line, index, score };
    }).filter((one) => one.score > 0);
    const near = new Set();
    for (const match of matches) for (let index = Math.max(0, match.index - 2); index <= Math.min(lines.length - 1, match.index + 2); index += 1) near.add(index);
    return { matches, context: [...near].sort((a, b) => a - b).map((index) => lines[index]).join('\n') };
  }
  function explicitSkillNumber(segments, pattern, min, max) {
    let best = null;
    for (const segment of segments) {
      pattern.lastIndex = 0; let hit;
      while ((hit = pattern.exec(segment.line))) {
        const value = boundedNumber(hit[1], min, max);
        if (value == null) continue;
        const candidate = { value, score: segment.score, index: segment.index, offset: hit.index };
        if (!best || candidate.score > best.score || (candidate.score === best.score && (candidate.index > best.index || (candidate.index === best.index && candidate.offset > best.offset)))) best = candidate;
      }
    }
    return best?.value ?? null;
  }
  function inferredSkillProgress(source, entity, hasPrior = false) {
    const text = clean(source, 2400);
    const newlyLearned = /새로|처음|초보|입문|방금[\s\S]{0,30}(?:배우|습득|익히)|배웠|습득했|newly\s+learned|just\s+learned|just\s+acquired|novice|beginner/i.test(text);
    if (newlyLearned) return { level: 1, mastery: 0, tier: 'novice' };
    const tiers = [
      { re: /초월|신화적|절대자|대종사|극의|극성|화경|transcenden|grandmaster|apotheosis/i, level: 10, mastery: 97, tier: 'transcendent' },
      { re: /달인|대가|완성(?:했|된|한)|마스터(?:했|급|리)|mastered|\bmaster\b/i, level: 9, mastery: 90, tier: 'master' },
      { re: /고인물|베테랑|노련|고수|수백\s*번|수천\s*번|수년|평생|오랫동안|주력기|비전|veteran|expert/i, level: 7, mastery: 75, tier: 'veteran' },
      { re: /능숙|익숙|숙련|반복|실전|자주|여러\s*번|trained|practiced|proficient|experienced/i, level: 5, mastery: 55, tier: 'practiced' },
      { re: /사용해\s*온|보유|장착|구사|사용한다|이미\s*(?:알|익|배)|already|owns|uses|equipped/i, level: 4, mastery: 40, tier: 'established' }
    ];
    for (const tier of tiers) if (tier.re.test(text)) return { level: tier.level, mastery: tier.mastery, tier: tier.tier };
    if (hasPrior) return null;
    return { level: entity?.type === 'passive' ? 4 : 3, mastery: entity?.type === 'passive' ? 35 : 25, tier: 'baseline' };
  }
  function reconcileSkillEvent(event, evidenceText = '', options = {}) {
    const next = clone(event);
    if (next?.domain !== 'skill') return next;
    const entity = next.kind === 'exam' ? next.entity : null;
    if (entity) {
      const evidence = skillEvidenceSegments(evidenceText, entity);
      const level = explicitSkillNumber(evidence.matches, /(?:\bLv\.?|레벨|level)\s*[:：.]?\s*(\d{1,3})/ig, 1, 999);
      const masteryValue = explicitSkillNumber(evidence.matches, /(?:숙련도|mastery)\s*[:：]?\s*(\d{1,3})\s*%/ig, 0, 100);
      const source = evidence.context;
      const provided = new Set(entity._provided || []);
      const inferred = new Set(entity._inferred || []);
      const estimate = inferredSkillProgress(source, entity, Boolean(options.priorSkill));
      if (level != null) { entity.level = level; provided.add('level'); inferred.delete('level'); }
      else if (estimate && (entity.level == null || (estimate.tier !== 'novice' && entity.level <= 1))) {
        entity.level = estimate.level; provided.add('level'); inferred.add('level');
      } else if (entity.level != null) inferred.add('level');
      if (masteryValue != null) { entity.mastery = masteryValue; provided.add('mastery'); inferred.delete('mastery'); }
      else if (estimate && (entity.mastery == null || (estimate.tier !== 'novice' && entity.mastery <= 0))) {
        entity.mastery = estimate.mastery; provided.add('mastery'); inferred.add('mastery');
      } else if (entity.mastery != null) inferred.add('mastery');
      if (options.rarityMode === 'itemx' && !ITEMX_SKILL_RANKS.has(String(entity.rank || '').toLowerCase())) {
        entity.rank = 'normal'; provided.delete('rank');
      }
      entity._provided = [...provided];
      entity._inferred = [...inferred];
    }
    return next;
  }
  function extractResponse(content, base = snapshot(), options = {}) {
    const text = String(content || ''), state = clone(base), parts = collect(text), output = [], events = [], errors = [], enabled = new Set(options.enabledDomains || ['skill', 'monster']); let cursor = 0;
    if (!parts.length && !/<\/?(?:skillExam|skillPatch|monsterExam|monsterPatch)\b/i.test(text)) return { content: text, snapshot: state, events, errors };
    parts.forEach((part, index) => {
      output.push(text.slice(cursor, part.start));
      const domain = part.tag.toLowerCase().startsWith('skill') ? 'skill' : 'monster';
      if (!enabled.has(domain)) { cursor = part.end; return; }
      const parsed = parseTransport(part.tag, part.attrs, part.body, `${part.raw}:${index}`);
      if (parsed.event?.domain === 'skill') parsed.event = reconcileSkillEvent(parsed.event, options.skillEvidenceText ?? text, { ...options, priorSkill: state.skills.entries[parsed.event.entity?.id] });
      if (parsed.event) { const view = clone(applyEvent(state, parsed.event)); events.push(parsed.event); output.push(marker({ v: VERSION, event: parsed.event, view })); }
      else { errors.push(parsed.error || 'codex_invalid_transport'); output.push(marker({ v: VERSION, error: parsed.error || 'codex_invalid_transport' })); }
      cursor = part.end;
    });
    output.push(text.slice(cursor)); return { content: stripResidual(output.join('')), snapshot: state, events, errors };
  }
  function eventsFromText(text) { const out = []; String(text || '').replace(MARKER_RE, (_, code) => { const payload = decodePayload(code); if (payload?.v === VERSION && payload.event) out.push(payload.event); return ''; }); return out; }
  function rebuild(messages) { const state = snapshot(); let transport = ''; for (const msg of messages || []) for (const event of eventsFromText(ITEMXCore.messageText(msg))) { applyEvent(state, event); transport += marker({ v: VERSION, event }); } state.fingerprint = fnv(transport); state.updatedAt = Date.now(); return state; }
  function requestView(text) { return String(text || '').replace(MARKER_RE, (_, code) => { const p = decodePayload(code), e = p?.view || p?.event?.entity; return e ? `[${p.event?.domain === 'skill' ? 'SKILL' : 'ENCOUNTER'} ${e.name} | id=${e.id}]` : ''; }); }
  function normalizeAssetName(value, stem = false) {
    let result = clean(value, 240);
    try { result = result.normalize('NFKC'); } catch {}
    result = result.replace(/\\/g, '/').replace(/\s+/g, ' ').trim().toLowerCase();
    return stem ? result.replace(/\.(?:png|jpe?g|webp|gif|avif)$/i, '') : result;
  }
  function assetLookup(rows, requestedName) {
    const requested = clean(requestedName, 240); if (!requested) return null;
    const exact = (rows || []).find((row) => row.name === requested); if (exact) return exact;
    const normalized = normalizeAssetName(requested);
    const normalizedMatches = (rows || []).filter((row) => normalizeAssetName(row.name) === normalized);
    if (normalizedMatches.length === 1) return normalizedMatches[0];
    const stem = normalizeAssetName(requested, true);
    const stemMatches = (rows || []).filter((row) => normalizeAssetName(row.name, true) === stem);
    return stemMatches.length === 1 ? stemMatches[0] : null;
  }
  function assetForEntity(rows, entity, narrative = '') {
    const explicit = clean(entity?.portrait, 240);
    if (explicit && explicit.toUpperCase() !== 'NONE') {
      const matched = assetLookup(rows, explicit);
      if (matched) return matched;
    }
    const identities = [entity?.id, entity?.name, ...(entity?.aliases || [])]
      .map((value) => normalizeAssetName(value, true))
      .filter((value) => value.length >= 2);
    if (!identities.length) return null;
    const candidates = (rows || []).filter((row) => {
      const stem = normalizeAssetName(row?.name, true);
      return identities.some((identity) => stem === identity || stem.startsWith(`${identity}_`) || stem.startsWith(`${identity}-`) || stem.startsWith(`${identity} `));
    });
    if (!candidates.length) return null;
    const representativeKinds = ['standing', 'default', 'neutral', 'normal', 'idle', 'indifferent', 'serious'];
    for (const kind of representativeKinds) {
      const direct = candidates.find((row) => identities.some((identity) => normalizeAssetName(row.name, true) === `${identity}_${kind}`));
      if (direct) return direct;
      const variant = candidates.find((row) => new RegExp(`(?:^|[_ -])${kind}$`, 'i').test(normalizeAssetName(row.name, true)));
      if (variant) return variant;
    }
    const context = String(narrative || '').toLowerCase();
    let recent = null, recentAt = -1;
    for (const row of candidates) {
      const at = context.lastIndexOf(String(row.name || '').toLowerCase());
      if (at > recentAt) { recent = row; recentAt = at; }
    }
    return recentAt >= 0 ? recent : candidates[0];
  }
  function assetCatalog(character, max = 100, includeEmotion = false) {
    const limit = Math.max(0, Math.min(1000, Number(max) || 0)), seen = new Set();
    const collectAssets = (source, emotion = false) => {
      const rows = [];
      for (const tuple of source || []) {
        if (!Array.isArray(tuple)) continue;
        const [name, id, ext] = tuple, n = clean(name, 160);
        if (!n || !id || seen.has(n)) continue;
        seen.add(n); rows.push({ name: n, id: clean(id, 240), ext: emotion ? '' : clean(ext, 20) });
      }
      return rows;
    };
    const additional = collectAssets(character?.additionalAssets), emotions = includeEmotion ? collectAssets(character?.emotionImages, true) : [];
    if (!includeEmotion || additional.length + emotions.length <= limit) return additional.concat(emotions).slice(0, limit);
    const emotionSlots = Math.min(emotions.length, Math.max(1, Math.floor(limit / 4)));
    return additional.slice(0, Math.max(0, limit - emotionSlots)).concat(emotions.slice(0, emotionSlots));
  }
  function activeModuleAssetCatalog(database, character, chat, max = 400) {
    const activeIds = new Set();
    const addIds = (values) => { for (const value of values || []) { const id = clean(value, 160); if (id) activeIds.add(id); } };
    addIds(database?.enabledModules); addIds(character?.modules); addIds(chat?.modules);
    addIds(String(database?.moduleIntergration || '').split(',').map((value) => value.trim()).filter(Boolean));
    const tuples = [], seenModules = new Set();
    for (const module of database?.modules || []) {
      if (!module || (!activeIds.has(module.id) && !activeIds.has(module.namespace))) continue;
      const moduleKey = clean(module.id || module.namespace, 160); if (moduleKey && seenModules.has(moduleKey)) continue;
      if (moduleKey) seenModules.add(moduleKey);
      tuples.push(...(module.assets || []));
    }
    const personaId = clean(chat?.bindedPersona || database?.selectedPersona, 160);
    const persona = (database?.personas || []).find((one) => [one?.id, one?.chaId].some((value) => clean(value, 160) === personaId));
    if (persona?.embeddedModule?.assets) tuples.push(...persona.embeddedModule.assets);
    return assetCatalog({ additionalAssets: tuples }, max, false);
  }
  function anchor(state, narrative = '', max = 9000, options = {}) {
    const lines = ['[ITEMX CODEX · ACTIVE CONTEXT · authoritative]'];
    const skills = state?.skills || registry(), monsters = state?.monsters || registry(), text = String(narrative).toLowerCase(), enabled = new Set(options.enabledDomains || ['skill', 'monster']);
    if (enabled.has('skill')) for (const one of skills.order.map((id) => skills.entries[id]).filter(Boolean).filter((x) => ['equipped','sealed'].includes(x.status) || text.includes(x.name.toLowerCase())).slice(0, 8)) lines.push(`- SKILL id=${one.id} | name=${one.name} | type=${one.type} | status=${one.status} | level=${one.level ?? 'unknown'} | mastery=${one.mastery ?? 'unknown'} | effect=${one.effects.slice(0, 3).join(' ;; ')}`);
    if (enabled.has('monster')) for (const one of monsters.order.map((id) => monsters.entries[id]).filter(Boolean).filter((x) => x.active || [x.name, ...(x.aliases || [])].some((n) => n && text.includes(n.toLowerCase()))).slice(0, 4)) lines.push(`- ENCOUNTER id=${one.id} | name=${one.name} | relation=${one.relation} | status=${one.status} | threat=${one.threat} | weakness=${one.weaknesses.slice(0, 3).join(',')}${one.outcome ? ` | latest_outcome=${clean(one.outcome, 220)}` : ''}`);
    return lines.join('\n').slice(0, max);
  }
  function protocol(assetNames = [], options = {}) {
    const assets = assetNames.slice(0, 180).map((x) => clean(x, 160)).filter(Boolean).join(' ;; ').slice(0, 12000) || 'NONE';
    const enabled = new Set(options.enabledDomains || ['skill', 'monster']), sections = ['## ITEMX CODEX TRANSPORT', 'Emit these hidden transports only when the narrative settles a change. Never expose the tags as prose.'];
    const skillRankRule = options.rarityMode === 'itemx'
      ? 'Use only ITEMX rank values normal|magic|rare|unique|epic|legendary|mythical|empyrean, based on explicit narrative power and prestige; do not inflate an unsupported rank.'
      : "Preserve the setting's own native rank, realm, discipline grade or proficiency wording exactly; do not replace it with ITEMX rarity names.";
    if (enabled.has('skill')) sections.push(`Skills: <skillExam><id>snake_case</id><name>...</name><glyph>choose one fitting emoji that reflects the skill identity, form or use; do not mechanically repeat a default and never use ❔</glyph><rank>...</rank><school>...</school><type>active|passive|sealed</type><status>learned|equipped|sealed|lost</status><level>...</level><mastery>...</mastery><cost>...</cost><cooldown>...</cooldown><target>...</target><affinity>...</affinity><description>...</description><effects>one ;; two</effects><growth>...</growth></skillExam>. Update with <skillPatch><id>...</id><action>learn|equip|unequip|mastery|seal|unseal|forget</action> or <op>merge|remove|restore</op> plus changed fields only.</skillPatch> ${skillRankRule}`, "The player skill registry records persistent named capabilities, techniques, proficiencies and masteries. First explicit confirmation that the player already owns, uses, has mastered, has equipped, or is concretely known to possess one is a settled discovery event even when it was learned before this turn; emit skillExam if it is absent from ACTIVE CONTEXT. Registry discovery is not the moment of learning: never default a veteran or previously owned skill to level 1 or mastery 0 merely because it is first recorded. Preserve an explicit numeric skill or directly associated proficiency level/mastery from the narrative. If the setting has no explicit numeric scale, infer a conservative normalized level from 1 to 10 and mastery from 0 to 100 using the character's demonstrated experience with that skill: novice 1/0, established 4/40, practiced 5/55, veteran 7/75, master 9/90, transcendent 10/97. Treat these as estimates and never exaggerate beyond the narrative. Level 1 or mastery 0 is valid only when the narrative supports a newly learned or untrained skill. A bracketed word or generic action alone is not proof. Do not register an NPC or opponent's technique as a player skill; keep it in that encounter's moves unless the player actually acquires it. Track later learning, mastery, equipment, sealing and loss. Transient buffs and flavor descriptions are not skills. Always write informative cost and cooldown fields instead of bare NONE. Preserve explicit world-native resources, quantities and timing first. When exact numbers are absent, infer a conservative qualitative description from the demonstrated mechanism and intensity, such as slight mana drain, stamina exertion, sustained concentration, one ammunition, continuous use, brief recovery, magical stabilization, or a named narrative condition. Passive skills should say they are continuously applied and whether they require upkeep; sealed skills should state their unlock condition when known. Use '별도 소모 없음' or '재사용 제한 없음' only when the narrative actually supports cost-free or continuous use. Never invent precise numbers, a daily limit or a resource foreign to the setting. Cooldowns must never use turns, rounds, actions or initiative.");
    if (enabled.has('monster')) sections.push('Encounter bestiary: register only actual hostility/combat or an accepted duel/spar. Mentions, rumors, passive NPCs and unaccepted challenges do not register. Group unnamed mobs. Use <monsterExam><id>snake_case</id><name>...</name><glyph>choose one fitting emoji that reflects the creature identity or form; do not mechanically repeat a default and never use ❔</glyph><aliases>a ;; b</aliases><type>...</type><threat>...</threat><relation>hostile|sparring|neutral|allied|unknown</relation><status>active|ended|escaped|defeated|dead|unknown</status><portrait>exact asset name or NONE</portrait><weaknesses>...</weaknesses><resistances>...</resistances><moves>...</moves><description>...</description><outcome>latest completed combat result only; one or two concise sentences grounded in the narrative, including who or what delivered the decisive resolution and how; omit while unresolved or unsupported</outcome></monsterExam>. Update with <monsterPatch><id>...</id><action>encounter|end|escape|defeat|kill|ally</action><outcome>latest completed combat result when the narrative establishes it</outcome> or <op>merge|remove|restore</op> plus changed fields only.</monsterPatch> Preserve the previous outcome when a new encounter begins. Replace it only when a later combat is conclusively resolved. Never invent a victor, finishing move, wound, capture or death.', `AVAILABLE PORTRAIT ASSET NAMES (exact match only): ${assets}`);
    sections.push('Use existing ids. Close every tag. Multiple events are separate blocks in narrative order.');
    return sections.join('\n');
  }
  return { VERSION, STATE_KEY, MARKER_RE, esc, clone, marker, decodePayload, registry, snapshot, applyEvent, reconcileSkillEvent, extractResponse, eventsFromText, rebuild, requestView, normalizeAssetName, assetLookup, assetForEntity, assetCatalog, activeModuleAssetCatalog, anchor, protocol };
})();
if (typeof globalThis !== 'undefined') globalThis.ITEMXCodex = ITEMXCodex;
