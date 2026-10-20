import * as Core from '../engine/core.js';
import * as Renderer from './renderer.js';
import { t } from '../i18n.js';
export const skillEmoji = (skill) => Core.resolveSkillGlyph(skill);

export const encounterEmoji = (monster) => Core.resolveMonsterGlyph(monster);

export const themeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

export function skillTheme(skill) {
  const value = themeText(`${skill.affinity || ''} ${skill.school || ''}`);
  if (/화염|불|fire|flame|ember/.test(value)) return 'fire';
  if (/빙|냉|서리|ice|frost|cold/.test(value)) return 'ice';
  if (/번개|뇌|전기|lightning|thunder|electric/.test(value)) return 'lightning';
  if (/암흑|어둠|그림자|dark|shadow|void/.test(value)) return 'dark';
  if (/빛|신성|광휘|light|holy|radiant/.test(value)) return 'light';
  return 'arcane';
}

export function skillRankTier(rank, rarityMode = 'world') {
  const value = themeText(rank);
  const tiers = [
    ['empyrean', /empyrean|창천|천상|초월|금기|transcendent/],
    ['mythical', /mythical|신화|신공|현경|mythic/],
    ['legendary', /legendary|전설|화경/],
    ['epic', /epic|에픽|절기|초절정/],
    ['unique', /unique|유니크|비전|절정|영웅/],
    ['rare', /rare|레어|희귀|상급|고급|일류/],
    ['magic', /magic|매직|비범|중급|숙련|이류/],
    ['normal', /normal|common|일반|기초|초급|하급|삼류/]
  ];
  const matched = tiers.find(([, pattern]) => pattern.test(value));
  if (matched) return matched[0];
  return rarityMode === 'itemx' ? 'normal' : 'magic';
}

export function skillFxClasses(skill, rarityMode = 'world') {
  const type = ['active', 'passive', 'sealed'].includes(themeText(skill.type)) ? themeText(skill.type) : 'active';
  const status = ['learned', 'equipped', 'sealed', 'lost'].includes(themeText(skill.status))
    ? themeText(skill.status)
    : 'learned';
  const tier = skillRankTier(skill.rank, rarityMode);
  return `itemx2-skill-theme-${skillTheme(skill)} itemx2-skill-rank-${tier} rarity-${tier} itemx2-skill-type-${type} itemx2-skill-status-${status}`;
}

export function encounterTheme(monster) {
  const value = themeText(monster.kind);
  if (/용|dragon|drake|wyrm/.test(value)) return 'dragon';
  if (/언데드|망령|유령|좀비|undead|ghost|specter|zombie/.test(value)) return 'undead';
  if (/골렘|기계|인형|구조체|construct|golem|machine|automaton/.test(value)) return 'construct';
  if (/수생|어류|해양|aquatic|fish|marine|serpent/.test(value)) return 'aquatic';
  if (/곤충|벌레|insect|bug|arachnid|spider/.test(value)) return 'insect';
  if (/야수|짐승|동물|beast|animal|wolf|tiger/.test(value)) return 'beast';
  if (/인간|인물|사람|전사|기사|마법사|human|humanoid|person|warrior|knight|mage/.test(value)) return 'humanoid';
  return 'unknown';
}

export function encounterThreatLevel(value) {
  const text = themeText(value);
  if (/최상|극위험|재앙|catastrophic|extreme|sss|\bss\b/.test(text)) return 3;
  if (/고위험|위험|high|dangerous/.test(text)) return 2;
  if (/중간|중위험|medium|moderate/.test(text)) return 1;
  return 0;
}

export function encounterFxClasses(monster) {
  const relation = themeText(monster.relation),
    status = themeText(monster.status);
  const warning = monster.active || /hostile|적대|enemy|전투/.test(relation) ? 'itemx2-encounter-warning' : '';
  const sparring = /대련|spar|rival|friendly/.test(relation) ? 'itemx2-encounter-sparring' : '';
  const ended = /ended|defeated|escaped|dead|lost|종료|격퇴|패배|도주|사망|소실/.test(status)
    ? 'itemx2-encounter-ended'
    : '';
  return `itemx2-encounter-theme-${encounterTheme(monster)} itemx2-threat-${encounterThreatLevel(monster.threat)} ${warning} ${sparring} ${ended}`.trim();
}

export const codexListFx = (domain, classes) =>
  `<span class="itemx2-codex-fx itemx2-codex-list-fx itemx2-${domain}-list-fx ${classes}" aria-hidden="true"></span>`;

export const codexHeroFx = (domain) =>
  `<span class="itemx2-codex-fx itemx2-codex-hero-fx itemx2-${domain}-hero-fx" aria-hidden="true"><i></i><b></b><em></em></span>`;

export function codexInlineEventSignificant(payload) {
  const event = payload?.event;
  if (!event || !['skill', 'monster'].includes(event.domain)) return false;
  if (event.kind === 'exam') return true;
  if (event.kind !== 'patch') return false;
  if (event.patch?.action || ['remove', 'restore'].includes(event.patch?.op)) return true;
  const keys = new Set(Object.keys(event.patch?.fields || {}));
  const important =
    event.domain === 'skill'
      ? [
          'name',
          'rank',
          'school',
          'type',
          'status',
          'level',
          'mastery',
          'cost',
          'cooldown',
          'affinity',
          'effects',
          'growth'
        ]
      : ['name', 'kind', 'threat', 'relation', 'status', 'outcome', 'moves', 'weaknesses', 'resistances'];
  return important.some((key) => keys.has(key));
}

// Plain labels of the model's enum values; anything else is shown as written.
const SKILL_TYPES = {
  active: () => t('codex.type-active'),
  passive: () => t('codex.type-passive'),
  sealed: () => t('codex.type-sealed')
};
const SKILL_STATUS = {
  learned: () => t('codex.status-learned'),
  equipped: () => t('codex.status-equipped'),
  sealed: () => t('codex.status-sealed'),
  lost: () => t('codex.status-lost')
};
const RELATIONS = {
  hostile: () => t('codex.rel-hostile'),
  sparring: () => t('codex.rel-sparring'),
  neutral: () => t('codex.rel-neutral'),
  allied: () => t('codex.rel-allied'),
  unknown: () => t('codex.rel-unknown')
};
const ENCOUNTER_STATUS = {
  active: () => t('presentation.018'),
  ended: () => t('presentation.023'),
  escaped: () => t('presentation.022'),
  defeated: () => t('presentation.021'),
  dead: () => t('presentation.020'),
  unknown: () => t('presentation.009')
};
const labelOf = (labels, value, fallback = '') => {
  const known = labels[themeText(value)];
  return known ? known() : String(value || '').trim() || fallback;
};
export const skillTypeLabel = (value) => labelOf(SKILL_TYPES, value, SKILL_TYPES.active());
export const skillStatusLabel = (value) => labelOf(SKILL_STATUS, value, SKILL_STATUS.learned());
export const relationLabel = (value) => labelOf(RELATIONS, value, RELATIONS.unknown());
export const encounterStatusLabel = (value) => labelOf(ENCOUNTER_STATUS, value, ENCOUNTER_STATUS.unknown());

const ENDED = new Set(['ended', 'escaped', 'defeated', 'dead']);
export const encounterEnded = (monster) => ENDED.has(themeText(monster?.status));
const RELATION_TONE = {
  hostile: '#ff5f6d',
  sparring: '#5fa8ff',
  neutral: '#9aa1b2',
  allied: '#5ee3a1',
  unknown: '#c08bff'
};
const ENDED_TONE = '#8a90a0';

const SKILL_ACTIONS = {
  learn: () => t('presentation.047'),
  equip: () => t('presentation.046'),
  unequip: () => t('presentation.045'),
  mastery: () => t('presentation.044'),
  seal: () => t('presentation.043'),
  unseal: () => t('presentation.042'),
  forget: () => t('presentation.039')
};
const ENCOUNTER_ACTIONS = {
  encounter: () => t('presentation.024'),
  end: () => t('presentation.023'),
  escape: () => t('presentation.022'),
  defeat: () => t('presentation.021'),
  kill: () => t('presentation.020'),
  ally: () => t('presentation.019')
};
// The event chip of a skill or encounter card.
function eventState(event, entity, domain) {
  const action = event.patch?.action || '',
    op = event.patch?.op || '';
  if (event.kind === 'exam') {
    if (domain === 'skill') return t('presentation.017');
    // A fight that began and ended in one response arrives as one registration
    // already carrying its result.
    if (encounterEnded(entity)) return encounterStatusLabel(entity.status);
    return entity.active || themeText(entity.status) === 'active' ? t('presentation.018') : t('presentation.017');
  }
  const known = (domain === 'skill' ? SKILL_ACTIONS : ENCOUNTER_ACTIONS)[action];
  if (known) return known();
  if (op === 'remove') return domain === 'skill' ? t('presentation.039') : t('presentation.016');
  if (op === 'restore') return t('presentation.015');
  return t('presentation.014');
}

const knownNumber = (value) => (value != null && Number.isFinite(Number(value)) ? Number(value) : null);
const motionClass = (motion) => (motion === 'off' ? 'motion-off' : motion === 'lite' ? 'motion-lite' : '');
const NO_LAYERS = { hero: '', back: '', front: '', fresh: '' };

function stat(label, value, from, meter) {
  if (value == null || String(value).trim() === '') return '';
  const changed = from != null && String(from) !== '' && String(from) !== String(value);
  const bar =
    meter == null ? '' : `<div class="ixp-meter"><i style="--v:${Math.max(0, Math.min(100, meter))}%"></i></div>`;
  return `<div class="ixp-stat${changed ? ' ixp-up' : ''}"><dt>${Core.esc(label)}</dt><dd>${changed ? `<s>${Core.esc(from)}</s>` : ''}${Core.esc(value)}</dd>${bar}</div>`;
}
const stats = (rows) => {
  const html = rows.join('');
  return html ? `<dl class="ixp-stats">${html}</dl>` : '';
};
// Skill effects are "name" or "name::description" strings.
function effectList(values) {
  const rows = (Array.isArray(values) ? values : [])
    .map((one) => String(one || '').trim())
    .filter(Boolean)
    .map((one) => {
      const [name, ...rest] = one.split('::');
      return `<li><b>${Core.esc(name.trim())}</b>${Core.esc(rest.join('::').trim())}</li>`;
    });
  return rows.length ? `<ul class="ixp-list">${rows.join('')}</ul>` : '';
}
const tag = (color, text) => `<span class="ixp-tag" style="--c:${color}">${Core.esc(text)}</span>`;
const tags = (list) => (list.length ? `<div class="ixp-tags">${list.join('')}</div>` : '');

function frame({ classes, vars, open, icon, rank, name, sub, chip, layers, body }) {
  return `<details class="${classes.filter(Boolean).join(' ')}" style="${vars}"${open ? ' open' : ''}><summary class="ixp-hero">${layers.fresh}${layers.hero}<div class="ixp-icon${icon.portrait ? ' ixp-portrait' : ''}">${icon.html}</div><div class="ixp-title"><span class="ixp-rank">${Core.esc(rank)}</span><span class="ixp-name">${Core.esc(name)}</span><span class="ixp-sub">${sub
    .filter(Boolean)
    .map((one) => `<span>${Core.esc(one)}</span>`)
    .join('')}</span></div>${chip}</summary>${layers.back}<div class="ixp-body">${body}</div>${layers.front}</details>`;
}

// options: motion, open, state (event chip), previous, inline, full (drawer
// extras), rarityMode.
export function renderSkillCard(skill, options = {}) {
  if (!skill) return '';
  const motion = options.motion || 'full',
    previous = options.previous || {},
    tier = skillRankTier(skill.rank, options.rarityMode || 'world'),
    affinity = Renderer.affinities[themeText(skill.affinity)] ? themeText(skill.affinity) : skillTheme(skill),
    tone = Renderer.affinities[affinity]?.c || Renderer.affinities.arcane.c,
    dim = ['sealed', 'lost'].includes(themeText(skill.status));
  const mastery = knownNumber(skill.mastery),
    priorMastery = knownNumber(previous.mastery),
    level = knownNumber(skill.level),
    priorLevel = knownNumber(previous.level);
  const layers =
    motion === 'off' || dim
      ? NO_LAYERS
      : Renderer.prismLayersFor({ id: skill.id, name: skill.name, affinity }, tier, motion);
  const element =
    Renderer.affinities[themeText(skill.affinity)] || (affinity !== 'arcane' && Renderer.affinities[affinity]);
  const body = [
    tags(
      [
        element ? tag(element.c, `${element.icon} ${element.name}`) : '',
        skill.target ? tag(tone, t('codex.target-of', skill.target)) : ''
      ].filter(Boolean)
    ),
    stats([
      stat(t('codex.level'), level == null ? null : `Lv.${level}`, priorLevel == null ? null : `Lv.${priorLevel}`),
      stat(
        t('presentation.035'),
        mastery == null ? null : `${mastery}%`,
        priorMastery == null ? null : `${priorMastery}%`,
        mastery
      ),
      stat(t('presentation.033'), skill.cost, previous.cost),
      stat(t('presentation.031'), skill.cooldown, previous.cooldown)
    ]),
    effectList(skill.effects),
    skill.description ? `<p class="ixp-lore">${Core.esc(skill.description)}</p>` : '',
    options.full && skill.growth ? `<p class="ixp-note"><b>${t('codex.growth')}</b>${Core.esc(skill.growth)}</p>` : '',
    options.full ? `<p class="ixp-id">ID · ${Core.esc(skill.id)}</p>` : ''
  ].join('');
  return frame({
    classes: [
      'ixp',
      'ixp-prism',
      `ixp-r-${tier}`,
      'ixp-codex',
      'ixp-skill',
      dim ? 'ixp-ended' : '',
      motionClass(motion),
      options.inline ? 'itemx-inline-card' : ''
    ],
    vars: `--p:${dim ? ENDED_TONE : tone};--s:${dim ? ENDED_TONE : tone}`,
    open: options.open !== false,
    icon: { html: `<span>${Core.esc(skillEmoji(skill))}</span>` },
    rank: skill.rank || Renderer.rarityLabels[tier],
    name: skill.name || skill.id,
    sub: [skill.school, `${skillTypeLabel(skill.type)} · ${skillStatusLabel(skill.status)}`],
    chip: options.state ? `<span class="ixp-ev">${Core.esc(options.state)}</span>` : '',
    layers,
    body
  });
}

// The encounter's course: met, then fighting or its result. A card for a
// fight that started and ended in one response shows both steps at once.
function encounterTrack(monster) {
  const count = Number(monster.encounterCount) || 1;
  const met = `<span class="ixp-step on"><i></i><b>${t('ui-panel.061')}</b>${count > 1 ? `<small>${t('codex.encounter-nth', count)}</small>` : ''}</span>`;
  const ended = encounterEnded(monster),
    status = themeText(monster.status);
  const result = ended
    ? `<span class="ixp-step on end"><i></i><b>${Core.esc(encounterStatusLabel(status))}</b></span>`
    : status === 'active' || monster.active
      ? `<span class="ixp-step live"><i></i><b>${t('presentation.018')}</b></span>`
      : `<span class="ixp-step"><i></i><b>${Core.esc(encounterStatusLabel(status))}</b></span>`;
  return `<div class="ixp-track">${met}<span class="ixp-link"></span>${result}</div>`;
}

// options: motion, open, state, previous, portrait, inline, full.
export function renderEncounterCard(monster, options = {}) {
  if (!monster) return '';
  const ended = encounterEnded(monster),
    relation = themeText(monster.relation),
    motion = ended ? 'off' : options.motion || 'full',
    tier = ['normal', 'rare', 'epic', 'legendary'][encounterThreatLevel(monster.threat)] || 'normal',
    tone = ended ? ENDED_TONE : RELATION_TONE[relation] || RELATION_TONE.unknown,
    live = !ended && (monster.active || themeText(monster.status) === 'active');
  const layers =
    motion === 'off'
      ? NO_LAYERS
      : Renderer.prismLayersFor(
          { id: monster.id, name: monster.name, affinity: relation === 'hostile' ? 'blood' : '' },
          tier,
          motion
        );
  const aliases = Array.isArray(monster.aliases) ? monster.aliases.filter(Boolean) : [];
  const list = (values) => (Array.isArray(values) ? values.filter(Boolean) : []);
  const body = [
    encounterTrack(monster),
    monster.outcome
      ? `<p class="ixp-note ixp-outcome"><b>${t('presentation.006')}</b>${Core.esc(monster.outcome)}</p>`
      : '',
    tags([
      ...list(monster.weaknesses).map((one) => tag('#5ee3a1', t('codex.weak', one))),
      ...list(monster.resistances).map((one) => tag('#9aa1b2', t('codex.resist', one)))
    ]),
    effectList(list(monster.moves).slice(0, options.full ? 12 : 3)),
    monster.description ? `<p class="ixp-lore">${Core.esc(monster.description)}</p>` : '',
    options.full && monster._lore ? `<p class="ixp-id">${t('ui-panel.098.1')}</p>` : '',
    options.full ? `<p class="ixp-id">ID · ${Core.esc(monster.id)}</p>` : ''
  ].join('');
  const chip = options.state
    ? `<span class="ixp-ev${ended ? ' ixp-ev-seal' : live ? ' ixp-ev-live' : ''}">${Core.esc(options.state)}</span>`
    : '';
  return frame({
    classes: [
      'ixp',
      'ixp-prism',
      `ixp-r-${ended ? 'normal' : tier}`,
      'ixp-codex',
      'ixp-encounter',
      ended ? 'ixp-ended' : '',
      motionClass(motion),
      options.inline ? 'itemx-inline-card' : ''
    ],
    vars: `--p:${tone};--s:${tone}`,
    open: options.open !== false,
    icon: options.portrait
      ? { portrait: true, html: `<img src="${Core.esc(options.portrait)}" alt="">` }
      : { html: `<span>${Core.esc(encounterEmoji(monster))}</span>` },
    rank: t('codex.threat', monster.threat || t('presentation.009')),
    name: monster.name || monster.id,
    sub: [
      monster.kind,
      relationLabel(relation),
      options.full && aliases.length ? aliases.join(' · ') : aliases.slice(0, 1).join('')
    ],
    chip,
    layers,
    body
  });
}

// options: motion, open, portrait.
export function codexInlineEventHtml(payload, options = {}) {
  if (!codexInlineEventSignificant(payload)) return '';
  const event = payload.event,
    entity = payload.view || event.entity;
  if (!entity) return '';
  const domain = event.domain;
  const common = {
    motion: options.motion || 'full',
    open: options.open,
    state: eventState(event, entity, domain),
    previous: payload.previous || {},
    inline: true
  };
  return domain === 'skill'
    ? renderSkillCard(entity, common)
    : renderEncounterCard(entity, { ...common, portrait: options.portrait || '' });
}
