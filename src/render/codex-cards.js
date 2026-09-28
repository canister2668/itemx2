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

export function codexInlineAppraisalStyle(entity, domain) {
  if (domain === 'skill') {
    const tier = skillRankTier(entity?.rank, 'world');
    const affinity = skillTheme(entity || {});
    return {
      tier,
      style: Renderer.itemVars({ id: entity?.id, name: entity?.name, theme: 'arcane', rarity: tier, affinity })
    };
  }
  const level = encounterThreatLevel(entity?.threat);
  const tier = ['normal', 'rare', 'epic', 'legendary'][level] || 'normal';
  const relation = themeText(entity?.relation);
  const affinity = /hostile|적대|enemy/.test(relation) ? 'dark' : /spar|대련/.test(relation) ? 'light' : 'arcane';
  return {
    tier,
    style: Renderer.itemVars({ id: entity?.id, name: entity?.name, theme: 'forged', rarity: tier, affinity })
  };
}

export const INLINE_BODY = {
  fire: 'fire',
  blood: 'fire',
  lightning: 'bolt',
  light: 'bolt',
  dark: 'dark',
  void: 'dark',
  poison: 'haze',
  earth: 'haze',
  ice: 'haze',
  wind: 'haze',
  arcane: 'haze'
};

export const codexInlineBody = (affinity) => {
  const kind = INLINE_BODY[affinity];
  return kind ? `<span class="itemx2-inline-body itemx2-inline-body-${kind}"></span>` : '';
};

export const codexInlineStat = (label, value, from) => {
  const now = Core.esc(value || t('presentation.048'));
  const changed = from != null && String(from) !== '' && String(from) !== String(value);
  const body = changed ? `<s>${Core.esc(from)}</s><u>→</u><em>${now}</em>` : `<span>${now}</span>`;
  return `<i class="${changed ? 'itemx2-inline-stat-changed' : ''}"><b>${Core.esc(label)}</b>${body}</i>`;
};

export function codexInlineEventHtml(payload, motion = 'full', portrait = '') {
  if (!codexInlineEventSignificant(payload)) return '';
  const event = payload.event,
    entity = payload.view || event.entity;
  if (!entity) return '';
  const previous = payload.previous || {},
    action = event.patch?.action || '',
    op = event.patch?.op || '';
  const ended = event.domain === 'monster' && /ended|escaped|defeated|dead/i.test(String(entity.status || ''));
  if (event.domain === 'skill') {
    const appraisal = codexInlineAppraisalStyle(entity, 'skill');
    const labels = {
      learn: ['SKILL LEARNED', t('presentation.047')],
      equip: ['SKILL EQUIPPED', t('presentation.046')],
      unequip: ['SKILL UPDATED', t('presentation.045')],
      mastery: ['SKILL MASTERY UPDATED', t('presentation.044')],
      seal: ['SKILL SEALED', t('presentation.043')],
      unseal: ['SKILL UNSEALED', t('presentation.042')],
      forget: ['SKILL LOST', t('presentation.041')]
    };
    const [kicker, state] =
      event.kind === 'exam'
        ? ['NEW SKILL ARCHIVED', t('presentation.040')]
        : labels[action] ||
          (op === 'remove'
            ? ['SKILL LOST', t('presentation.039')]
            : op === 'restore'
              ? ['SKILL RESTORED', t('presentation.038')]
              : ['SKILL RECORD UPDATED', t('presentation.037')]);
    const mastery = entity.mastery != null && Number.isFinite(Number(entity.mastery)) ? Number(entity.mastery) : null;
    const priorMastery =
      previous.mastery != null && Number.isFinite(Number(previous.mastery)) ? Number(previous.mastery) : null;
    const quick = [
      [
        'LEVEL',
        entity.level == null ? t('presentation.036') : `Lv.${entity.level}`,
        previous.level == null || previous.level === entity.level ? null : `Lv.${previous.level}`
      ],
      [
        t('presentation.035'),
        mastery == null ? t('presentation.034') : `${mastery}%`,
        priorMastery == null ? null : `${priorMastery}%`
      ],
      [t('presentation.033'), entity.cost || t('presentation.032'), previous.cost || null],
      [t('presentation.031'), entity.cooldown || t('presentation.030'), previous.cooldown || null]
    ]
      .map(([label, value, from]) => codexInlineStat(label, value, from))
      .join('');
    const effect =
      (entity.effects || []).slice(0, 2).join(' · ') || entity.description || entity.growth || t('presentation.029');
    const classes = `itemx2-inline-event itemx2-inline-appraisal itemx2-inline-skill itemx2-inline-skill-theme-${skillTheme(entity)} itemx2-inline-tier-${appraisal.tier} ${motion === 'off' ? 'motion-off' : motion === 'lite' ? 'motion-lite' : ''}`;
    const meta = [
      entity.school || t('presentation.028'),
      entity.type || 'active',
      entity.status || 'learned',
      entity.target ? t('presentation.027', entity.target) : ''
    ]
      .filter(Boolean)
      .join(' · ');
    // The chips already carry every change, so the separate change block is gone.
    return `<section class="${classes}" style="${appraisal.style}">${codexInlineBody(entity.affinity)}<div class="itemx2-inline-main"><span class="itemx2-inline-icon"><span>${Core.esc(skillEmoji(entity))}</span></span><span class="itemx2-inline-copy"><small class="itemx2-inline-kicker">${kicker}</small><strong class="itemx2-inline-name">${Core.esc(entity.name || entity.id)}</strong><span class="itemx2-inline-meta">${Core.esc([entity.rank, meta].filter(Boolean).join(' · '))}</span><span class="itemx2-inline-quick">${quick}</span></span><i class="itemx2-inline-state">${state}</i></div><footer class="itemx2-inline-foot"><b>${action === 'mastery' ? t('presentation.026') : t('presentation.025')}</b><span>${Core.esc(effect)}</span><em class="itemx2-inline-more">ITEMX &#8250;</em></footer></section>`;
  }
  const appraisal = codexInlineAppraisalStyle(entity, 'monster');
  const labels = {
    encounter: ['ENCOUNTER RESUMED', t('presentation.024')],
    end: ['ENCOUNTER RESOLVED', t('presentation.023')],
    escape: ['ENCOUNTER RESOLVED', t('presentation.022')],
    defeat: ['ENCOUNTER RESOLVED', t('presentation.021')],
    kill: ['ENCOUNTER RESOLVED', t('presentation.020')],
    ally: ['ENCOUNTER UPDATED', t('presentation.019')]
  };
  const [kicker, state] =
    event.kind === 'exam'
      ? ['ENCOUNTER REGISTERED', entity.status === 'active' ? t('presentation.018') : t('presentation.017')]
      : labels[action] ||
        (op === 'remove'
          ? ['ENCOUNTER LOST', t('presentation.016')]
          : op === 'restore'
            ? ['ENCOUNTER RESTORED', t('presentation.015')]
            : ['ENCOUNTER UPDATED', t('presentation.014')]);
  const detail = entity.outcome || (entity.moves || []).slice(0, 3).join(' · ') || t('presentation.013');
  const warning =
    entity.active && ['hostile', 'sparring'].includes(String(entity.relation || ''))
      ? '<span class="itemx2-inline-warning" aria-hidden="true"></span>'
      : '';
  const quick = [
    [t('presentation.012'), entity.kind || t('presentation.011'), null],
    [t('presentation.010'), entity.threat || t('presentation.009'), previous.threat || null],
    [t('presentation.008'), entity.relation || 'unknown', previous.relation || null],
    [t('presentation.007'), entity.status || 'unknown', previous.status || null]
  ]
    .map(([label, value, from]) => codexInlineStat(label, value, from))
    .join('');
  const classes = `itemx2-inline-event itemx2-inline-appraisal itemx2-inline-encounter itemx2-inline-tier-${appraisal.tier} ${ended ? 'itemx2-inline-ended' : ''} ${motion === 'off' ? 'motion-off' : motion === 'lite' ? 'motion-lite' : ''}`;
  const aliases = Array.isArray(entity.aliases) ? entity.aliases.slice(0, 2).join(' · ') : '';
  return `<section class="${classes}" style="${appraisal.style}">${warning}${ended ? '<span class="itemx2-inline-seal">&#35352;&#37636;</span>' : '<span class="itemx2-inline-scan"></span>'}<div class="itemx2-inline-main"><span class="itemx2-inline-icon">${portrait ? `<img src="${Core.esc(portrait)}" alt="" style="width:100%;height:100%;object-fit:cover">` : `<span>${Core.esc(encounterEmoji(entity))}</span>`}</span><span class="itemx2-inline-copy"><small class="itemx2-inline-kicker">${kicker}</small><strong class="itemx2-inline-name">${Core.esc(entity.name || entity.id)}</strong><span class="itemx2-inline-meta">${Core.esc([entity.kind, aliases || entity.description].filter(Boolean).join(' · ') || t('presentation.004'))}</span><span class="itemx2-inline-quick">${quick}</span></span><i class="itemx2-inline-state">${state}</i></div><footer class="itemx2-inline-foot"><b>${ended ? t('presentation.006') : t('presentation.005')}</b><span>${Core.esc(detail)}</span><em class="itemx2-inline-more">${t('presentation.003.1')}</em></footer></section>`;
}
