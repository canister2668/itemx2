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
  const MONSTER_ACTIONS = new Set(['encounter', 'end', 'escape', 'defeat', 'kill', 'ally']);
  const OPS = new Set(['merge', 'remove', 'restore']);
  const clean = (value, max = 800) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const cooldownValue = (value) => {
    const result = clean(value, 120);
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
  function mastery(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0; }

  function normalizeSkillExam(raw, seed) {
    const name = clean(raw.name, 160); if (!name) return { error: 'skill_no_name' };
    const type = SKILL_TYPES.has(raw.type) ? raw.type : 'active';
    const status = SKILL_STATUS.has(raw.status) ? raw.status : (type === 'sealed' ? 'sealed' : 'learned');
    return { event: { domain: 'skill', kind: 'exam', entity: {
      id: normalizeId(raw.id, 'skill', seed), name, glyph: clean(raw.glyph, 12) || '✨', rank: clean(raw.rank, 80) || '미분류', school: clean(raw.school, 120), type, status,
      level: Math.max(1, Math.min(999, Number(raw.level) || 1)), mastery: mastery(raw.mastery), cost: clean(raw.cost, 120), cooldown: cooldownValue(raw.cooldown), target: clean(raw.target, 120), affinity: clean(raw.affinity, 80),
      description: clean(raw.description, 1200), effects: list(raw.effects), growth: clean(raw.growth, 800),
      _provided: Object.keys(raw).filter((key) => raw[key] !== '')
    } } };
  }
  function normalizeMonsterExam(raw, seed) {
    const name = clean(raw.name, 160); if (!name) return { error: 'monster_no_name' };
    const relation = RELATIONS.has(raw.relation) ? raw.relation : 'unknown';
    const status = ENCOUNTER_STATUS.has(raw.status) ? raw.status : 'unknown';
    return { event: { domain: 'monster', kind: 'exam', entity: {
      id: normalizeId(raw.id, 'encounter', seed), name, glyph: clean(raw.glyph, 12) || '⚔️', aliases: list(raw.aliases, 8), kind: clean(raw.type, 100) || '미분류', threat: clean(raw.threat, 80) || '미상', relation, status,
      active: status === 'active' && ['hostile', 'sparring'].includes(relation), portrait: clean(raw.portrait, 160), weaknesses: list(raw.weaknesses), resistances: list(raw.resistances), moves: list(raw.moves), description: clean(raw.description, 1200), encounterCount: 1,
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
      : ['name','glyph','aliases','type','threat','relation','status','portrait','weaknesses','resistances','moves','description'];
    const fields = {};
    for (const key of allowed) if (raw[key] !== '') fields[key === 'type' && domain === 'monster' ? 'kind' : key] = ['effects','aliases','weaknesses','resistances','moves'].includes(key) ? list(raw[key]) : clean(raw[key], key === 'description' ? 1200 : 800);
    if ('mastery' in fields) fields.mastery = mastery(fields.mastery);
    if ('level' in fields) fields.level = Math.max(1, Math.min(999, Number(fields.level) || 1));
    if ('cooldown' in fields) fields.cooldown = cooldownValue(fields.cooldown);
    return { event: { domain, kind: 'patch', patch: { id, action, op, fields } } };
  }
  function parseTransport(tag, attrText, body, seed) {
    const a = attrs(attrText), raw = {};
    for (const key of ['id','name','glyph','rank','school','type','status','level','mastery','cost','cooldown','target','affinity','description','effects','growth','aliases','threat','relation','portrait','weaknesses','resistances','moves','action','op']) raw[key] = scalar(body, a, key).toLowerCase && ['type','status','relation','action','op'].includes(key) ? scalar(body, a, key).toLowerCase() : scalar(body, a, key);
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
        for (const key of ['status', 'mastery', 'level']) if (!provided.has(key)) next[key] = prior[key];
      }
      if (event.domain === 'skill') next.cooldown = cooldownValue(next.cooldown);
      if (prior && event.domain === 'monster') {
        for (const key of ['status', 'active', 'relation', 'encounterCount']) if (!provided.has(key)) next[key] = prior[key];
        next.encounterCount = Number(prior.encounterCount) || 1;
      }
      if (event.domain === 'monster') next.active = next.status === 'active' && ['hostile', 'sparring'].includes(next.relation);
      return put(reg, next);
    }
    const entity = reg.entries[event.patch?.id]; if (!entity) { reg.diagnostics.push({ code: 'patch_missing', id: event.patch?.id }); return null; }
    const { action, op, fields } = event.patch;
    if (op === 'remove') { entity.status = 'lost'; entity.active = false; }
    else if (op === 'restore') Object.assign(entity, clone(fields), { status: event.domain === 'skill' ? 'learned' : 'active', active: event.domain === 'monster' });
    else if (op === 'merge') Object.assign(entity, clone(fields));
    if (event.domain === 'skill') {
      entity.cooldown = cooldownValue(entity.cooldown);
      if (action === 'equip') entity.status = 'equipped'; if (action === 'unequip' || action === 'learn' || action === 'unseal') entity.status = 'learned';
      if (action === 'seal') entity.status = 'sealed'; if (action === 'forget') entity.status = 'lost'; if (action === 'mastery' && 'mastery' in fields) entity.mastery = mastery(fields.mastery);
    } else {
      if (action === 'encounter') { entity.status = 'active'; entity.active = true; entity.encounterCount = (Number(entity.encounterCount) || 1) + 1; }
      const endStatus = { end: 'ended', escape: 'escaped', defeat: 'defeated', kill: 'dead', ally: 'ended' }[action];
      if (endStatus) { entity.status = endStatus; entity.active = false; if (action === 'ally') entity.relation = 'allied'; }
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
        if (!/^<\/?(?:id|name|glyph|rank|school|type|status|level|mastery|cost|cooldown|target|affinity|description|effects|growth|aliases|threat|relation|portrait|weaknesses|resistances|moves|action|op)\b/i.test(suffix)) break;
        boundary = out.indexOf('\n\n', boundary + 2);
      }
      out = boundary < 0 ? out.slice(0, hit.index) : out.slice(0, hit.index) + out.slice(boundary + 2);
    }
    return out.replace(/<\/?(?:skillExam|skillPatch|monsterExam|monsterPatch)\b[^>]*>?/gi, '').replace(/^\s*```(?:xml)?\s*$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  function extractResponse(content, base = snapshot(), options = {}) {
    const text = String(content || ''), state = clone(base), parts = collect(text), output = [], events = [], errors = [], enabled = new Set(options.enabledDomains || ['skill', 'monster']); let cursor = 0;
    if (!parts.length && !/<\/?(?:skillExam|skillPatch|monsterExam|monsterPatch)\b/i.test(text)) return { content: text, snapshot: state, events, errors };
    parts.forEach((part, index) => {
      output.push(text.slice(cursor, part.start));
      const domain = part.tag.toLowerCase().startsWith('skill') ? 'skill' : 'monster';
      if (!enabled.has(domain)) { cursor = part.end; return; }
      const parsed = parseTransport(part.tag, part.attrs, part.body, `${part.raw}:${index}`);
      if (parsed.event) { const view = clone(applyEvent(state, parsed.event)); events.push(parsed.event); output.push(marker({ v: VERSION, event: parsed.event, view })); }
      else { errors.push(parsed.error || 'codex_invalid_transport'); output.push(marker({ v: VERSION, error: parsed.error || 'codex_invalid_transport' })); }
      cursor = part.end;
    });
    output.push(text.slice(cursor)); return { content: stripResidual(output.join('')), snapshot: state, events, errors };
  }
  function eventsFromText(text) { const out = []; String(text || '').replace(MARKER_RE, (_, code) => { const payload = decodePayload(code); if (payload?.v === VERSION && payload.event) out.push(payload.event); return ''; }); return out; }
  function rebuild(messages) { const state = snapshot(); let transport = ''; for (const msg of messages || []) for (const event of eventsFromText(ITEMXCore.messageText(msg))) { applyEvent(state, event); transport += marker({ v: VERSION, event }); } state.fingerprint = fnv(transport); state.updatedAt = Date.now(); return state; }
  function requestView(text) { return String(text || '').replace(MARKER_RE, (_, code) => { const p = decodePayload(code), e = p?.view || p?.event?.entity; return e ? `[${p.event?.domain === 'skill' ? 'SKILL' : 'ENCOUNTER'} ${e.name} | id=${e.id}]` : ''; }); }
  function assetCatalog(character, max = 100, includeEmotion = false) {
    const rows = [], seen = new Set();
    for (const [name, id, ext] of character?.additionalAssets || []) { const n = clean(name, 160); if (n && id && !seen.has(n)) { seen.add(n); rows.push({ name: n, id: clean(id, 240), ext: clean(ext, 20) }); } if (rows.length >= max) break; }
    if (includeEmotion) for (const [name, id] of character?.emotionImages || []) { const n = clean(name, 160); if (n && id && !seen.has(n)) { seen.add(n); rows.push({ name: n, id: clean(id, 240), ext: '' }); } if (rows.length >= max) break; }
    return rows;
  }
  function anchor(state, narrative = '', max = 9000, options = {}) {
    const lines = ['[ITEMX CODEX · ACTIVE CONTEXT · authoritative]'];
    const skills = state?.skills || registry(), monsters = state?.monsters || registry(), text = String(narrative).toLowerCase(), enabled = new Set(options.enabledDomains || ['skill', 'monster']);
    if (enabled.has('skill')) for (const one of skills.order.map((id) => skills.entries[id]).filter(Boolean).filter((x) => ['equipped','sealed'].includes(x.status) || text.includes(x.name.toLowerCase())).slice(0, 8)) lines.push(`- SKILL id=${one.id} | name=${one.name} | type=${one.type} | status=${one.status} | mastery=${one.mastery} | effect=${one.effects.slice(0, 3).join(' ;; ')}`);
    if (enabled.has('monster')) for (const one of monsters.order.map((id) => monsters.entries[id]).filter(Boolean).filter((x) => x.active || [x.name, ...(x.aliases || [])].some((n) => n && text.includes(n.toLowerCase()))).slice(0, 4)) lines.push(`- ENCOUNTER id=${one.id} | name=${one.name} | relation=${one.relation} | status=${one.status} | threat=${one.threat} | weakness=${one.weaknesses.slice(0, 3).join(',')}`);
    return lines.join('\n').slice(0, max);
  }
  function protocol(assetNames = [], options = {}) {
    const assets = assetNames.slice(0, 100).map((x) => clean(x, 160)).filter(Boolean).join(' ;; ') || 'NONE';
    const enabled = new Set(options.enabledDomains || ['skill', 'monster']), sections = ['## ITEMX CODEX TRANSPORT', 'Emit these hidden transports only when the narrative settles a change. Never expose the tags as prose.'];
    if (enabled.has('skill')) sections.push('Skills: <skillExam><id>snake_case</id><name>...</name><glyph>one fitting emoji such as ✨</glyph><rank>...</rank><school>...</school><type>active|passive|sealed</type><status>learned|equipped|sealed|lost</status><level>1</level><mastery>0..100</mastery><cost>...</cost><cooldown>...</cooldown><target>...</target><affinity>...</affinity><description>...</description><effects>one ;; two</effects><growth>...</growth></skillExam>. Update with <skillPatch><id>...</id><action>learn|equip|unequip|mastery|seal|unseal|forget</action> or <op>merge|remove|restore</op> plus changed fields only.</skillPatch>', "Skill cost preserves the setting's actual resource and scale, for example mana 20, stamina 5%, one bullet, sustained focus, or none. Skill cooldown must never use turns, rounds, actions, or initiative. Express it as real elapsed time (seconds, minutes, hours, days), a frequency such as once per day, a sustained duration, a charge/recovery time, a narrative condition, or none. Do not invent a numeric cost or time when the narrative does not establish one.");
    if (enabled.has('monster')) sections.push('Encounter bestiary: register only actual hostility/combat or an accepted duel/spar. Mentions, rumors, passive NPCs and unaccepted challenges do not register. Group unnamed mobs. Use <monsterExam><id>snake_case</id><name>...</name><glyph>one fitting encounter emoji such as ⚔️</glyph><aliases>a ;; b</aliases><type>...</type><threat>...</threat><relation>hostile|sparring|neutral|allied|unknown</relation><status>active|ended|escaped|defeated|dead|unknown</status><portrait>exact asset name or NONE</portrait><weaknesses>...</weaknesses><resistances>...</resistances><moves>...</moves><description>...</description></monsterExam>. Update with <monsterPatch><id>...</id><action>encounter|end|escape|defeat|kill|ally</action> or <op>merge|remove|restore</op> plus changed fields only.</monsterPatch>', `AVAILABLE PORTRAIT ASSET NAMES (exact match only): ${assets}`);
    sections.push('Use existing ids. Close every tag. Multiple events are separate blocks in narrative order.');
    return sections.join('\n');
  }
  return { VERSION, STATE_KEY, MARKER_RE, esc, clone, marker, decodePayload, registry, snapshot, applyEvent, extractResponse, eventsFromText, rebuild, requestView, assetCatalog, anchor, protocol };
})();
if (typeof globalThis !== 'undefined') globalThis.ITEMXCodex = ITEMXCodex;
