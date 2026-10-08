/* ITEMX 2 shared renderer. The chat body and plugin inventory call this file. */
import * as Core from '../engine/core.js';
import { t } from '../i18n.js';
const esc = Core.esc;
const affinities = {
  fire: { name: t('render.001'), icon: '🔥', c: '#ff7a3d', g: 'rgba(255,122,61,.42)' },
  ice: { name: t('render.002'), icon: '❄️', c: '#58cbf5', g: 'rgba(88,203,245,.40)' },
  lightning: { name: t('render.003'), icon: '⚡', c: '#f5d13c', g: 'rgba(245,209,60,.38)' },
  wind: { name: t('render.004'), icon: '🌪️', c: '#86e5c4', g: 'rgba(134,229,196,.34)' },
  earth: { name: t('render.005'), icon: '🪨', c: '#c69a5c', g: 'rgba(198,154,92,.34)' },
  light: { name: t('render.006'), icon: '☀️', c: '#ffe6a8', g: 'rgba(255,230,168,.40)' },
  dark: { name: t('render.007'), icon: '🌑', c: '#9a6bff', g: 'rgba(154,107,255,.42)' },
  arcane: { name: t('render.008'), icon: '✦', c: '#7f9cff', g: 'rgba(127,156,255,.40)' },
  poison: { name: t('render.009'), icon: '☠️', c: '#a6e34a', g: 'rgba(166,227,74,.36)' },
  blood: { name: t('render.010'), icon: '🩸', c: '#d1354f', g: 'rgba(209,53,79,.42)' },
  void: { name: t('render.011'), icon: '🕳️', c: '#ff5ec2', g: 'rgba(255,94,194,.42)' }
};
const crafts = {
  arcane: {
    name: t('render.012'),
    eyebrow: 'ITEMX · APPRAISAL',
    shapes: ['shard', 'shard', 'shard', 'diamond'],
    paths: ['rise', 'drift', 'pulse'],
    colors: [
      ['#d8b25c', '#f6e6bd'],
      ['#b8873a', '#ffe9b5']
    ],
    accent: '#d8b25c',
    glow: 'rgba(216,178,92,.30)',
    ambient: { rays: 4, veil: 5 }
  },
  forged: {
    name: t('render.013'),
    eyebrow: 'FORGE · ASSAY',
    shapes: ['ash', 'ash', 'ash', 'shard'],
    paths: ['rise', 'drift'],
    colors: [
      ['#e07a3a', '#ffd0a0'],
      ['#8a6440', '#e8b184']
    ],
    accent: '#e07a3a',
    glow: 'rgba(224,122,58,.30)',
    ambient: { fog: 3, rays: 4, veil: 5 }
  },
  oriental: {
    name: t('render.014'),
    eyebrow: '兵器鑑定',
    shapes: ['ash', 'ash', 'ash', 'petal'],
    paths: ['sway', 'sway', 'drift'],
    colors: [
      ['#b9aa91', '#756957'],
      ['#d0b67f', '#8b7045'],
      ['#a33a40', '#e08a83']
    ],
    accent: '#b82f36',
    glow: 'rgba(184,47,54,.22)',
    ambient: { fog: 3, rays: 4, veil: 5 }
  },
  clockwork: {
    name: t('render.015'),
    eyebrow: 'ATELIER · No.',
    shapes: ['gear', 'gear', 'gear', 'block'],
    paths: ['turn', 'rise'],
    colors: [
      ['#c98a2e', '#f3dfae'],
      ['#a9803c', '#ffe4b0']
    ],
    accent: '#c98a2e',
    glow: 'rgba(201,138,46,.32)',
    ambient: { scan: 4, veil: 5 }
  },
  synthetic: {
    name: t('render.016'),
    eyebrow: 'GEAR SCAN',
    shapes: ['block', 'block', 'block', 'streak'],
    paths: ['jitter', 'rise'],
    colors: [
      ['#4ef2ff', '#0a3a44'],
      ['#ff3d6e', '#3a0d1c']
    ],
    accent: '#4ef2ff',
    glow: 'rgba(78,242,255,.35)',
    ambient: { scan: 1, veil: 3 }
  },
  celestial: {
    name: t('render.017'),
    eyebrow: 'ASTRA · AUGURY',
    shapes: ['cross', 'cross', 'cross', 'diamond'],
    paths: ['pulse', 'rise', 'drift'],
    colors: [
      ['#ffd98a', '#fff6e0'],
      ['#9fb4ff', '#e6ecff']
    ],
    accent: '#ffd98a',
    glow: 'rgba(255,217,138,.30)',
    ambient: { rays: 2, veil: 3 }
  },
  organic: {
    name: t('render.018'),
    eyebrow: 'SYLVAN · READING',
    shapes: ['petal', 'petal', 'petal', 'ash'],
    paths: ['sway', 'drift'],
    colors: [
      ['#7fe0a1', '#eafbe6'],
      ['#4a9c62', '#bff0cd']
    ],
    accent: '#7fe0a1',
    glow: 'rgba(127,224,161,.28)',
    ambient: { fog: 2, rays: 4, veil: 5 }
  }
};
const reactions = {
  'fire+wind': [t('render.019'), t('render.020')],
  'fire+ice': [t('render.021'), t('render.022')],
  'ice+lightning': [t('render.023'), t('render.024')],
  'fire+light': [t('render.025'), t('render.026')],
  'dark+void': [t('render.027'), t('render.028')],
  'blood+poison': [t('render.029'), t('render.030')],
  'earth+wind': [t('render.031'), t('render.032')]
};
const rarityLabels = {
  normal: t('render.033'),
  magic: t('render.034'),
  rare: t('render.035'),
  unique: t('render.036'),
  epic: t('render.037'),
  legendary: t('render.038'),
  mythical: t('render.039'),
  empyrean: t('render.040')
};
const particleBudget = {
  normal: 4,
  magic: 6,
  rare: 8,
  unique: 16,
  epic: 16,
  legendary: 16,
  mythical: 16,
  empyrean: 16
};
const ambientLevel = { normal: 1, magic: 2, rare: 3, unique: 3, epic: 4, legendary: 4, mythical: 5, empyrean: 5 };
const locationLabels = {
  inventory: t('render.041'),
  equipped: t('presentation.046'),
  storage: t('render.043'),
  unknown: t('render.044')
};
const possessionLabels = { observed: t('ui-panel.049'), owned: t('ui-panel.051'), removed: t('ui-panel.badge-loss') };
const rarityColors = {
  normal: '#5c6577',
  magic: '#6fa8e8',
  rare: '#45c8c0',
  unique: '#a888f0',
  epic: '#dd7be0',
  legendary: '#f0a640',
  mythical: '#ff7a7a',
  empyrean: '#ffe9a8'
};

const keyFor = (a, b) => [a, b].sort().join('+');
const reactionFor = (a, b) =>
  reactions[keyFor(a, b)] || [
    t('render.048'),
    t('render.dual-resonance-desc', affinities[a]?.name || a, affinities[b]?.name || b)
  ];
const itemVars = (item) => {
  const craft = crafts[item.theme] || crafts.arcane,
    primary = affinities[item.affinity] || { c: craft.accent, g: craft.glow },
    secondary = affinities[item.affinity2] || primary;
  return `--p:${primary.c};--pg:${primary.g};--s:${secondary.c};--sg:${secondary.g};--rk:${rarityColors[item.rarity] || rarityColors.normal}`;
};

function currentEffects(item, motion = 'full') {
  if (motion === 'off') return '';
  const craft = crafts[item.theme] || crafts.arcane,
    rarity = item.rarity || 'normal';
  const level = ambientLevel[rarity] || 1,
    count = motion === 'lite' ? Math.min(3, particleBudget[rarity] || 4) : particleBudget[rarity] || 4;
  let rays = '';
  if (craft.ambient.rays && level >= craft.ambient.rays)
    [4, 44, 77, 119, 158, 196, 233, 271, 306, 339].forEach((r, i) => {
      rays += `<i style="--r:${r}deg;--w:${[9.81, 5.38, 14.23, 6.35, 11.54, 8.08, 15.58, 5.77, 10.77, 4.81][i]}%"></i>`;
    });
  let motes = '';
  const seed = parseInt(Core.fnv1a(item.id || item.name || '?'), 16) || 1;
  for (let i = 0; i < count; i++) {
    const n = seed + i * 43,
      z = 2 + (n % 5) * 0.75,
      shape = craft.shapes[n % craft.shapes.length],
      path = craft.paths[(n * 3 + 1) % craft.paths.length],
      pair = craft.colors[n % craft.colors.length];
    motes += `<i class="craft-mote shape-${shape} path-${path} ${shape === 'diamond' ? 'diamond' : ''}" style="--x:${n % 101}%;--z:${z}px;--mh:${z * 2.8}px;--ca:${pair[0]};--cb:${pair[1]};--o:${0.22 + (n % 4) * 0.1};--d:${7 + (n % 8)}s;--delay:-${(n % 9) * 0.75}s;--drift:${-34 + (n % 69)}px;--drift2:${(34 - (n % 69)) * 0.7}px"></i>`;
  }
  const fog =
    craft.ambient.fog && level >= craft.ambient.fog
      ? '<div class="current-fog"><span class="current-fog-visual"></span></div>'
      : '';
  const scan = craft.ambient.scan && level >= craft.ambient.scan ? '<div class="current-scan"></div>' : '';
  const veil =
    craft.ambient.veil && level >= craft.ambient.veil
      ? '<div class="current-veil"><span class="current-veil-visual"></span></div>'
      : '';
  return `<div class="current-fx">${rays ? `<div class="current-rays">${rays}</div>` : ''}${fog}${scan}${veil}${motes}</div>`;
}

// Affinities whose signature is a field rather than particles get one body layer.
const bodyLayers = { wind: 'wind', earth: 'earth', dark: 'dark', arcane: 'arcane', blood: 'blood', void: 'void' };

function affinityEffects(kind, role, rarity, motion = 'full') {
  if (!kind || !affinities[kind] || motion === 'off') return '';
  const a = affinities[kind],
    tag = kind === 'lightning' ? 'b' : 'i',
    budgetScale = Math.max(0.28, (particleBudget[rarity] || 4) / 16);
  let count =
    kind === 'lightning'
      ? 10
      : kind === 'ice'
        ? 12
        : kind === 'wind'
          ? 8
          : kind === 'fire'
            ? 14
            : kind === 'poison'
              ? 12
              : 10;
  count = Math.max(
    motion === 'lite' ? 1 : 3,
    Math.ceil(count * budgetScale * (role === 'secondary' ? 0.68 : 1) * (motion === 'lite' ? 0.2 : 1))
  );
  let bits = '';
  for (let i = 0; i < count; i++) {
    const style = `--x:${(i * 37 + 11) % 98}%;--y:${(i * 29 + 7) % 91}%;--z:${4 + (i % 5) * 2.3}px;--h:${24 + (i % 6) * 9}px;--iw:${2.5 + (i % 5) * 1.4}px;--ih:${10 + (i % 5) * 3.5}px;--ph:${7 + (i % 5) * 2.4}px;--d:${2.5 + (i % 7) * 0.76}s;--delay:-${(i % 8) * 0.63}s;--drift:${-42 + ((i * 23) % 85)}px;--sk:${-18 + ((i * 11) % 37)}deg;--r:${-38 + ((i * 31) % 77)}deg;--ac:${a.c}`;
    bits += `<${tag} style="${style}"></${tag}>`;
  }
  const secondary = role === 'secondary' ? ' secondary' : '';
  // Body layers per affinity: flame sheets, strike flash, cauldron haze, descending light.
  // Their opacity scales with the card's rarity intensity (--int), so low tiers stay quiet.
  const extra =
    kind === 'lightning'
      ? `<div class="lightning-field${secondary}" style="--ac:${a.c}"></div><div class="lightning-flash${secondary}" style="--ac:${a.c}"></div>`
      : kind === 'ice'
        ? `<div class="ice-cracks${secondary}" style="--ac:${a.c}"></div>`
        : kind === 'fire'
          ? `<div class="affinity-flames${secondary}" style="--ac:${a.c}"><b class="af-f2"></b><b class="af-f1"></b><b class="af-f3"></b></div>`
          : kind === 'poison'
            ? `<div class="poison-miasma${secondary}" style="--ac:${a.c}"></div>`
            : kind === 'light'
              ? `<div class="light-veilfall${secondary}" style="--ac:${a.c}"></div><div class="light-ground${secondary}" style="--ac:${a.c}"></div>`
              : bodyLayers[kind]
                ? `<div class="affinity-body body-${bodyLayers[kind]}${secondary}" style="--ac:${a.c}"></div>`
                : '';
  const movingSignature = ['fire', 'wind', 'earth', 'light', 'dark', 'poison', 'blood', 'void'].includes(kind);
  const signature =
    kind === 'ice'
      ? ''
      : `<div class="affinity-signature sig-${kind}${secondary}" style="--ac:${a.c}">${movingSignature ? '<span class="affinity-signature-visual"></span>' : ''}</div>`;
  return `${signature}${extra}<div class="afx afx-${kind}${role === 'secondary' ? ' afx-secondary' : ''}" style="--ac:${a.c}">${bits}</div>`;
}

function renderSkillFx(skill, rarity = 'normal', motion = 'full') {
  const affinity = affinities[skill?.affinity] ? skill.affinity : 'arcane';
  const item = {
    id: skill?.id || skill?.name || 'skill',
    name: skill?.name || t('ui-settings.045'),
    theme: 'arcane',
    rarity: rarityLabels[rarity] ? rarity : 'normal',
    affinity
  };
  const form = skillForm(skill);
  return `<div class="itemx-fx itemx2-skill-weapon-fx itemx2-skill-form-${form}">${currentEffects(item, motion)}<div class="affinity-fx">${affinityEffects(affinity, 'primary', item.rarity, motion)}</div>${motion !== 'off' && form !== 'default' ? `<span class="itemx2-codex-fx itemx2-technique-material" aria-hidden="true"></span>` : ''}</div>`;
}

function skillForm(skill) {
  const classify = (value) => {
    const text = String(value || '').toLowerCase();
    const groups = [
      ['slash', /검술|참격|발도|베기|도법|검법|swordplay|slash|swordsmanship/],
      ['ward', /방어술|결계|방벽|보호막|shield|barrier|ward/],
      ['heal', /치유|회복술|치료술|회복 마법|healing|restoration/],
      ['shadow', /은신|잠행|저주|stealth|concealment|curse/]
    ].filter(([, pattern]) => pattern.test(text));
    return groups.length === 1 ? groups[0][0] : 'default';
  };
  const named = classify(skill?.name);
  return named !== 'default' ? named : classify(`${skill?.school || ''} ${skill?.description || ''}`);
}

const reviewLabels = {
  power: t('render.050'),
  required: t('render.051'),
  durability: t('render.052'),
  cost: t('render.053'),
  effects: t('render.054'),
  augments: t('render.055'),
  level: t('render.056'),
  mastery: t('render.057'),
  cooldown: t('presentation.031')
};
const known = (value) =>
  value != null && String(value).trim() !== '' && !/^(?:미상|미분류|unknown|none)$/i.test(String(value));
function changes(previous, current, domain = 'item') {
  if (!previous || !current) return [];
  const keys =
    domain === 'item'
      ? [
          ['power', t('render.050')],
          ['durability', t('render.052')],
          ['displayRarity', t('render.059')],
          ['count', t('render.060')],
          ['required', t('render.051')],
          ['cost', t('render.061')]
        ]
      : domain === 'skill'
        ? [
            ['level', t('render.056')],
            ['mastery', t('render.057')],
            ['rank', t('render.059')],
            ['cost', t('presentation.033')],
            ['cooldown', t('presentation.031')],
            ['status', t('presentation.007')]
          ]
        : [
            ['status', t('render.064')],
            ['relation', t('presentation.008')],
            ['threat', t('presentation.010')]
          ];
  const out = keys
    .filter(([key]) => known(previous[key]) && known(current[key]) && String(previous[key]) !== String(current[key]))
    .map(([key, label]) => ({ key, label, before: String(previous[key]), after: String(current[key]) }));
  const effects = (entity) =>
    (Array.isArray(entity.effects) ? entity.effects : [])
      .map((one) => (typeof one === 'string' ? one : one?.name))
      .filter(Boolean);
  if (Array.isArray(previous.effects) && Array.isArray(current.effects)) {
    const before = effects(previous),
      after = effects(current);
    for (const name of after.filter((name) => !before.includes(name)))
      out.push({ key: 'effects', label: t('render.067'), before: '', after: name });
    for (const name of before.filter((name) => !after.includes(name)))
      out.push({ key: 'effects', label: t('render.068'), before: name, after: '' });
  }
  return out.slice(0, 6);
}
function changesHtml(previous, current, domain = 'item') {
  const rows = changes(previous, current, domain);
  if (!rows.length) return '';
  return `<section class="itemx2-change-note" aria-label="${t('render.changes')}"><strong>${t('render.changes')}</strong>${rows.map((row) => `<span><small>${esc(row.label)}</small>${row.before ? `<del>${esc(row.before)}</del>` : ''}${row.before && row.after ? '<b aria-hidden="true">→</b>' : ''}${row.after ? `<em>${esc(row.after)}</em>` : ''}</span>`).join('')}</section>`;
}
function reviewHtml(review, entity) {
  const source = { main: t('render.069'), auxiliary: t('render.070'), manual: t('render.071') }[review?.source] || '';
  const missing = (Array.isArray(review?.missing) ? review.missing : []).filter((key) =>
    Object.prototype.hasOwnProperty.call(reviewLabels, key)
  );
  const inferred = (Array.isArray(entity?._inferred) ? entity._inferred : []).filter((key) =>
    Object.prototype.hasOwnProperty.call(reviewLabels, key)
  );
  if (!source && !review?.checked && !missing.length && !inferred.length) return '';
  return `<section class="itemx2-review-note ${missing.length ? 'itemx2-review-partial' : ''}">${source ? `<small>${esc(source)}</small>` : ''}${review?.checked ? `<small>${t('render.review-checked')}</small>` : ''}${inferred.length ? `<span>${t('render.review-inferred')} · ${esc(inferred.map((key) => reviewLabels[key]).join(', '))}</span>` : ''}${missing.length ? `<strong>${t('render.review-partial')}</strong><span>${t('render.review-unresolved')} · ${esc(missing.map((key) => reviewLabels[key]).join(', '))}</span><small>${t('render.review-preserved')}</small>` : ''}</section>`;
}
function eventKind(payload, domain = 'item') {
  const current = payload?.view,
    previous = payload?.previous;
  if (!current) return '';
  if (domain === 'monster')
    return previous &&
      !['defeated', 'dead', 'ended', 'escaped'].includes(previous.status) &&
      ['defeated', 'dead', 'ended', 'escaped'].includes(current.status)
      ? 'resolved'
      : '';
  if (domain === 'skill') return !previous && payload.event?.kind === 'exam' ? 'learned' : '';
  if (!previous) return 'acquired';
  const numerator = (value) => {
    const found = String(value || '').match(/^\s*(\d+(?:\.\d+)?)\s*\//);
    return found ? Number(found[1]) : null;
  };
  const before = numerator(previous?.durability),
    after = numerator(current.durability);
  if (before != null && after != null && after < before) return 'damage';
  const power = (value) => {
    const match = String(value || '')
      .replace(/,/g, '')
      .match(/^\s*(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  };
  const from = power(previous?.power),
    to = power(current.power);
  const ranks = Object.keys(rarityLabels);
  const upgraded =
    previous &&
    ((from != null && to != null && to > from) ||
      (ranks.includes(previous.rarity) && ranks.indexOf(current.rarity) > ranks.indexOf(previous.rarity)));
  // A generic stat change is not necessarily a successful enhancement.
  return upgraded && /강화|제련|enhanc|upgrad/i.test(`${payload.event?.patch?.reason || ''} ${current.name || ''}`)
    ? 'enhanced'
    : '';
}

// ── 2.6 card ──────────────────────────────────────────────────────────
// One layout for chat and drawer; the effect layer is a pack: 'prism' (light,
// grouped particles) or 'classic' (the 2.5 layer). Every class is ixp- prefixed.
const conditionLabels = {
  blessed: t('render.cond-blessed'),
  cursed: t('render.cond-cursed'),
  corrupted: t('render.cond-corrupted'),
  glitched: t('render.cond-glitched'),
  sealed: t('render.cond-sealed')
};
// Particle motion and palette per affinity.
const prismMotion = {
  fire: { k: 'rise', cl: ['#ffb36b', '#ff6a2b', '#ffd89a'] },
  ice: { k: 'fall', cl: ['#e8f8ff', '#9fe0ff'], shape: 'flake' },
  lightning: { k: 'blink', cl: ['#fff6b8', '#ffd83d'] },
  wind: { k: 'blow', cl: ['#c9fff0', '#5fe3b8'], shape: 'streak' },
  earth: { k: 'fall', cl: ['#e8c08a', '#9c7444'] },
  light: { k: 'rise', cl: ['#fff6d8', '#ffe08a'] },
  dark: { k: 'fall', cl: ['#b9a3ff', '#6a4ad8'] },
  arcane: { k: 'rise', cl: ['#c6d2ff', '#7f9cff'] },
  poison: { k: 'rise', cl: ['#d4ff9a', '#9be04a'], shape: 'bubble' },
  blood: { k: 'fall', cl: ['#ff7a8c', '#c41f3c'], shape: 'drop' },
  void: { k: 'blink', cl: ['#ff9be0', '#9c6bff'] }
};
const RANKS = Object.keys(rarityLabels);
const SPARKS = [0, 0, 3, 4, 6, 8, 10, 12];
const SWARMS = [0, 0, 0, 0, 2, 3, 4, 4];
// Deterministic per item, so a re-render never reshuffles the particles.
function seeded(text) {
  let h = parseInt(Core.fnv1a(String(text || '?')), 16) >>> 0 || 1;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let x = Math.imul(h ^ (h >>> 15), 1 | h);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (list, r) => list[Math.floor(r() * list.length)];

function prismSparks(item, count, bokeh) {
  const p = prismMotion[item.affinity];
  if (!p || !count) return '';
  const q = prismMotion[item.affinity2] || p,
    r = seeded(`${item.id || item.name}#p`);
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = i % 3 === 2 ? q : p,
      big = bokeh && i < 3,
      z = big ? 16 + r() * 14 : (a.shape === 'flake' ? 6 : a.shape === 'bubble' ? 7 : 3) + r() * 3,
      y = a.k === 'rise' ? 55 + r() * 40 : a.k === 'fall' ? r() * 45 : 10 + r() * 75,
      shape = big ? ' ixp-bokeh' : a.shape ? ` ixp-k-${a.shape}` : '';
    out += `<i class="ixp-spark${shape}" style="--x:${(4 + r() * 92).toFixed(1)}%;--y:${y.toFixed(1)}%;--z:${z.toFixed(1)}px;--c:${pick(a.cl, r)};--k:ixp-${a.k};--d:${(3.5 + r() * 4.5).toFixed(2)}s;--w:-${(r() * 8).toFixed(2)}s;--o:${(big ? 0.25 + r() * 0.2 : 0.45 + r() * 0.5).toFixed(2)};--dx:${Math.round(-24 + r() * 48)}px"></i>`;
  }
  return out;
}

// A swarm is one 2px dot whose box-shadow draws 12-16 particles; the whole
// group moves with a single transform+opacity animation.
function prismSwarms(item, count) {
  if (!count) return '';
  const p = prismMotion[item.affinity],
    palette = p ? [...p.cl, ...(prismMotion[item.affinity2]?.cl || [])] : ['#fff6d8', '#ffffff'],
    kind = p ? p.k : 'rise',
    r = seeded(`${item.id || item.name}#s`);
  let out = '';
  for (let j = 0; j < count; j++) {
    const dots = [],
      m = 12 + Math.floor(r() * 5);
    for (let i = 0; i < m; i++) {
      const x = Math.round(r() * 440),
        y = Math.round(20 + r() * 340),
        big = r() < 0.12,
        col = pick(palette, r);
      dots.push(
        big
          ? `${x}px ${y}px ${8 + Math.round(r() * 6)}px ${3 + Math.round(r() * 3)}px color-mix(in srgb,${col} 35%,transparent)`
          : `${x}px ${y}px ${1 + Math.round(r() * 3)}px ${(r() * 1.6).toFixed(1)}px ${col}`
      );
    }
    const d = 5 + r() * 4;
    out += `<i class="ixp-swarm" style="box-shadow:${dots.join(',')};--k:ixp-s-${kind};--d:${d.toFixed(2)}s;--w:-${((j * d) / count + r()).toFixed(2)}s;--dx:${Math.round(-30 + r() * 60)}px"></i>`;
  }
  return out;
}

function prismBurst(item) {
  const p = prismMotion[item.affinity],
    palette = p ? [...p.cl, '#ffffff'] : ['#ffffff', '#fff1c2'],
    r = seeded(`${item.id || item.name}#b`),
    dots = [];
  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2 + r() * 0.3,
      distance = 70 + r() * 150;
    dots.push(
      `${Math.round(Math.cos(angle) * distance)}px ${Math.round(Math.sin(angle) * distance * 0.8)}px ${1 + Math.round(r() * 3)}px ${(0.5 + r() * 2).toFixed(1)}px ${pick(palette, r)}`
    );
  }
  return `<i class="ixp-burst" style="box-shadow:${dots.join(',')}"></i>`;
}

function prismLayers(item, rank, motion) {
  if (motion === 'off') return { hero: '', back: '', front: '', fresh: '' };
  const lite = motion === 'lite',
    sig =
      rank >= 4
        ? `<div class="ixp-sig ixp-sig-${prismMotion[item.affinity] && item.affinity !== 'arcane' ? item.affinity : 'none'}"></div>`
        : '',
    rim = rank >= 4 ? '<div class="ixp-rim"></div>' : '',
    edge = rank >= 4 ? '<div class="ixp-edge"></div>' : '',
    sheen = rank >= 5 ? '<div class="ixp-sheen"></div>' : '',
    fresh =
      rank >= 4
        ? `<div class="ixp-flash"></div><i class="ixp-shock"></i>${rank >= 5 ? `<i class="ixp-shock ixp-shock2"></i>${prismBurst(item)}` : ''}`
        : '';
  return {
    hero: prismSparks(item, Math.min(SPARKS[rank], lite ? 6 : 99), rank >= 6),
    back: `${rim}${sig}`,
    front: `${prismSwarms(item, Math.min(SWARMS[rank], lite ? 2 : 9))}${edge}${sheen}`,
    fresh
  };
}

function classicLayer(item, theme, rarity, motion) {
  if (motion === 'off') return '';
  const strong = ['legendary', 'mythical', 'empyrean'].includes(rarity);
  const classes = [
    'ixp-cfx',
    `craft-${theme}`,
    `rarity-${rarity}`,
    strong ? 'itemx2-strong' : '',
    item.condition ? `condition-${item.condition}` : '',
    motion === 'lite' ? 'motion-lite' : '',
    item.affinity && item.affinity2 && item.affinity !== item.affinity2
      ? `itemx2-blend-${keyFor(item.affinity, item.affinity2).replace('+', '-')}`
      : ''
  ]
    .filter(Boolean)
    .join(' ');
  return `<div class="${classes}" style="${itemVars(item)}"><div class="itemx-fx">${currentEffects(item, motion)}<div class="affinity-fx">${affinityEffects(item.affinity, 'primary', rarity, motion)}${affinityEffects(item.affinity2, 'secondary', rarity, motion)}</div></div><div class="itemx-cond"></div>${strong ? '<div class="itemx-edge" aria-hidden="true"></div>' : ''}</div>`;
}

function prismStats(item) {
  const rows = [
    [t('render.050'), item.power],
    [t('render.072'), item.required],
    [t('render.073'), item.durability],
    [t('render.061'), item.cost]
  ].filter(([, value]) => value);
  if (!rows.length) return '';
  return `<dl class="ixp-stats">${rows
    .map(([label, value]) => {
      const gauge = label === t('render.073') && String(value).match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
      if (gauge && Number(gauge[2]) > 0) {
        const pct = Math.max(0, Math.min(100, Math.round((Number(gauge[1]) / Number(gauge[2])) * 100)));
        return `<div class="ixp-stat"><dt>${label}</dt><dd>${esc(gauge[1])} <small>/ ${esc(gauge[2])}</small></dd><div class="ixp-meter${pct < 35 ? ' low' : ''}"><i style="--v:${pct}%"></i></div></div>`;
      }
      return `<div class="ixp-stat"><dt>${label}</dt><dd>${esc(value)}</dd></div>`;
    })
    .join('')}</dl>`;
}

function prismTags(item) {
  const primary = affinities[item.affinity];
  if (!primary) return '';
  const secondary = item.affinity2 && item.affinity2 !== item.affinity ? affinities[item.affinity2] : null;
  let out = `<span class="ixp-tag" style="--c:${primary.c}">${primary.icon} ${esc(primary.name)}</span>`;
  if (secondary)
    out += `<span class="ixp-tag" style="--c:${secondary.c}">${secondary.icon} ${esc(secondary.name)}</span><span class="ixp-tag ixp-combo">✦ ${esc(reactionFor(item.affinity, item.affinity2)[0])}</span>`;
  return `<div class="ixp-tags">${out}</div>`;
}

function prismList(item) {
  const effects = Array.isArray(item.effects) ? item.effects : [],
    augments = Array.isArray(item.augments) ? item.augments : [];
  const rows = [
    ...effects.map((one) => `<li><b>${esc(one.name)}</b>${esc(one.desc)}</li>`),
    ...augments.map(
      (one) => `<li class="aug"><b>${esc(one.name)}<small>${t('render.055')}</small></b>${esc(one.desc)}</li>`
    )
  ];
  return rows.length ? `<ul class="ixp-list" aria-label="${t('render.054')}">${rows.join('')}</ul>` : '';
}

// options: motion 'full'|'lite'|'off', fx 'prism'|'classic', fold (inline: start
// closed), previous (the item before this event, for the change note).
function renderCard(item, options = {}) {
  if (!item) return '';
  const theme = crafts[item.theme] ? item.theme : 'arcane',
    rarity = rarityLabels[item.rarity] ? item.rarity : 'normal',
    rank = RANKS.indexOf(rarity),
    motion = options.motion || 'full',
    pack = options.fx === 'classic' ? 'classic' : 'prism';
  const classes = [
    'ixp',
    `ixp-${pack}`,
    `ixp-r-${rarity}`,
    `ixp-t-${theme}`,
    item.condition && conditionLabels[item.condition] ? `ixp-c-${item.condition}` : '',
    motion === 'off' ? 'motion-off' : motion === 'lite' ? 'motion-lite' : '',
    options.inline ? 'itemx-inline-card' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const primary = affinities[item.affinity],
    secondary = affinities[item.affinity2] || primary,
    vars = `--p:${primary ? primary.c : 'var(--a)'};--s:${secondary ? secondary.c : 'var(--a)'}`;
  const layers =
    pack === 'prism'
      ? prismLayers(item, rank, motion)
      : { hero: '', back: classicLayer(item, theme, rarity, motion), front: '', fresh: '' };
  const possession = possessionLabels[item.possession] || item.possession || t('ui-panel.049'),
    location = locationLabels[item.location] || item.location || t('render.044'),
    state = conditionLabels[item.condition] ? `<span class="ixp-state">${conditionLabels[item.condition]}</span>` : '',
    count = Number(item.count) > 1 ? `<b class="ixp-x">×${Number(item.count)}</b>` : '';
  // The acquisition burst lives in the summary so a folded card still plays it.
  const hero = `<summary class="ixp-hero">${layers.fresh}${layers.hero}<div class="ixp-icon"><span>${esc(Core.resolveItemEmoji(item))}</span>${count}</div><div class="ixp-title"><span class="ixp-rank">${esc(item.displayRarity || rarityLabels[rarity])}</span><span class="ixp-name">${esc(item.name || '???')}</span><span class="ixp-sub"><span>${esc(item.itemType || t('render.item-type-other'))}</span><span>${esc(possession)} · ${esc(location)}</span>${state}</span></div><span class="ixp-more">${t('render.expand')}</span></summary>`;
  const body = `<div class="ixp-body">${prismTags(item)}${prismStats(item)}${prismList(item)}${options.previous ? changesHtml(options.previous, item) : ''}${item.trivia ? `<p class="ixp-lore">${esc(item.trivia)}</p>` : ''}</div>`;
  return `<details class="${classes}" style="${vars}" data-itemx-id="${esc(item.id)}"${options.fold ? '' : ' open'}>${hero}${layers.back}${body}${layers.front}</details>`;
}

function renderTile(item) {
  const icons = [item.affinity && affinities[item.affinity]?.icon, item.affinity2 && affinities[item.affinity2]?.icon]
    .filter(Boolean)
    .join('');
  return `<button class="itemx-tile rarity-${esc(item.rarity || 'normal')}" style="${itemVars(item)}" data-item-id="${esc(item.id)}"><span class="itemx-tile-bar"></span>${item.location === 'equipped' ? '<span class="itemx-tile-eq"></span>' : ''}${icons ? `<span class="itemx-tile-aff">${icons}</span>` : ''}<span class="itemx-tile-em">${esc(Core.resolveItemEmoji(item))}</span><span class="itemx-tile-nm">${esc(item.name || '???')}</span><span class="itemx-tile-meta"><span class="itemx-tile-rk">${esc(item.displayRarity || rarityLabels[item.rarity] || rarityLabels.normal)}</span><span class="itemx-tile-lc">${esc(item.itemType || t('render.item-type-other'))}</span></span></button>`;
}

function renderMarkerPayload(payload, options = {}) {
  if (!payload || payload.error) return '';
  if (payload.view) return renderCard(payload.view, { ...options, previous: payload.previous });
  const id = payload.event?.patch?.id;
  return id ? `<span class="itemx-event-chip">ITEMX · ${esc(id)} ${t('render.changed')}</span>` : '';
}

export {
  affinities,
  crafts,
  rarityLabels,
  reactions,
  particleBudget,
  renderCard,
  renderTile,
  renderMarkerPayload,
  renderSkillFx,
  skillForm,
  changes,
  changesHtml,
  reviewHtml,
  eventKind,
  itemVars
};
