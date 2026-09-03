/* ITEMX 2 shared renderer. The chat body and plugin inventory call this file. */
const ITEMXRenderer = (() => {
  'use strict';
  const esc = (value) => globalThis.ITEMXCore ? ITEMXCore.esc(value) : String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const affinities = {
    fire: { name: '화염', icon: '🔥', c: '#ff7a3d', g: 'rgba(255,122,61,.42)' }, ice: { name: '냉기', icon: '❄️', c: '#58cbf5', g: 'rgba(88,203,245,.40)' },
    lightning: { name: '번개', icon: '⚡', c: '#f5d13c', g: 'rgba(245,209,60,.38)' }, wind: { name: '바람', icon: '🌪️', c: '#86e5c4', g: 'rgba(134,229,196,.34)' },
    earth: { name: '대지', icon: '🪨', c: '#c69a5c', g: 'rgba(198,154,92,.34)' }, light: { name: '광휘', icon: '☀️', c: '#ffe6a8', g: 'rgba(255,230,168,.40)' },
    dark: { name: '암흑', icon: '🌑', c: '#9a6bff', g: 'rgba(154,107,255,.42)' }, arcane: { name: '비전', icon: '✦', c: '#7f9cff', g: 'rgba(127,156,255,.40)' }, poison: { name: '맹독', icon: '☠️', c: '#a6e34a', g: 'rgba(166,227,74,.36)' },
    blood: { name: '혈기', icon: '🩸', c: '#d1354f', g: 'rgba(209,53,79,.42)' }, void: { name: '공허', icon: '🕳️', c: '#ff5ec2', g: 'rgba(255,94,194,.42)' }
  };
  const crafts = {
    arcane: { name: '마도', eyebrow: 'CODEX · APPRAISAL', shapes: ['shard', 'shard', 'shard', 'diamond'], paths: ['rise', 'drift', 'pulse'], colors: [['#d8b25c', '#f6e6bd'], ['#b8873a', '#ffe9b5']], accent: '#d8b25c', glow: 'rgba(216,178,92,.30)', ambient: { rays: 4, veil: 5 } },
    forged: { name: '대장간', eyebrow: 'FORGE · ASSAY', shapes: ['ash', 'ash', 'ash', 'shard'], paths: ['rise', 'drift'], colors: [['#e07a3a', '#ffd0a0'], ['#8a6440', '#e8b184']], accent: '#e07a3a', glow: 'rgba(224,122,58,.30)', ambient: { fog: 3, rays: 4, veil: 5 } },
    oriental: { name: '무림', eyebrow: '兵器鑑定', shapes: ['ash', 'ash', 'ash', 'petal'], paths: ['sway', 'sway', 'drift'], colors: [['#b9aa91', '#756957'], ['#d0b67f', '#8b7045'], ['#a33a40', '#e08a83']], accent: '#b82f36', glow: 'rgba(184,47,54,.22)', ambient: { fog: 3, rays: 4, veil: 5 } },
    clockwork: { name: '시계공학', eyebrow: 'ATELIER · No.', shapes: ['gear', 'gear', 'gear', 'block'], paths: ['turn', 'rise'], colors: [['#c98a2e', '#f3dfae'], ['#a9803c', '#ffe4b0']], accent: '#c98a2e', glow: 'rgba(201,138,46,.32)', ambient: { scan: 4, veil: 5 } },
    synthetic: { name: '합성체', eyebrow: 'GEAR SCAN', shapes: ['block', 'block', 'block', 'streak'], paths: ['jitter', 'rise'], colors: [['#4ef2ff', '#0a3a44'], ['#ff3d6e', '#3a0d1c']], accent: '#4ef2ff', glow: 'rgba(78,242,255,.35)', ambient: { scan: 1, veil: 3 } },
    celestial: { name: '천체', eyebrow: 'ASTRA · AUGURY', shapes: ['cross', 'cross', 'cross', 'diamond'], paths: ['pulse', 'rise', 'drift'], colors: [['#ffd98a', '#fff6e0'], ['#9fb4ff', '#e6ecff']], accent: '#ffd98a', glow: 'rgba(255,217,138,.30)', ambient: { rays: 2, veil: 3 } },
    organic: { name: '유기체', eyebrow: 'SYLVAN · READING', shapes: ['petal', 'petal', 'petal', 'ash'], paths: ['sway', 'drift'], colors: [['#7fe0a1', '#eafbe6'], ['#4a9c62', '#bff0cd']], accent: '#7fe0a1', glow: 'rgba(127,224,161,.28)', ambient: { fog: 2, rays: 4, veil: 5 } }
  };
  const reactions = {
    'fire+wind': ['화염폭풍', '불티가 바람의 궤도를 타고 휘몰아친다.'], 'fire+ice': ['열충격', '상반된 온도가 충돌하여 방어를 파쇄한다.'],
    'ice+lightning': ['극뢰', '빙결된 대상 사이로 번개가 연쇄 전도된다.'], 'fire+light': ['성화', '정화의 불꽃이 타락한 존재에게 추가 피해를 준다.'],
    'dark+void': ['심연붕괴', '공간을 잠식해 대상의 저항을 안쪽으로 붕괴시킨다.'], 'blood+poison': ['혈독', '상처에 스며든 독성이 맥박마다 증폭된다.'],
    'earth+wind': ['사암폭풍', '연마된 모래가 넓은 범위를 지속 절삭한다.']
  };
  const rarityLabels = { normal: '일반', magic: '매직', rare: '레어', unique: '유니크', epic: '에픽', legendary: '전설', mythical: '신화', empyrean: '창천' };
  const particleBudget = { normal: 4, magic: 6, rare: 8, unique: 16, epic: 16, legendary: 16, mythical: 16, empyrean: 16 };
  const ambientLevel = { normal: 1, magic: 2, rare: 3, unique: 3, epic: 4, legendary: 4, mythical: 5, empyrean: 5 };
  const locationLabels = { inventory: '소지품', equipped: '장착', storage: '보관', unknown: '위치 불명' };
  const possessionLabels = { observed: '관찰', owned: '보유', removed: '소실' };
  const rarityColors = { normal: '#5c6577', magic: '#6fa8e8', rare: '#45c8c0', unique: '#a888f0', epic: '#dd7be0', legendary: '#f0a640', mythical: '#ff7a7a', empyrean: '#ffe9a8' };

  const keyFor = (a, b) => [a, b].sort().join('+');
  const reactionFor = (a, b) => reactions[keyFor(a, b)] || ['이중 공명', `${affinities[a]?.name || a}과 ${affinities[b]?.name || b}의 성질이 번갈아 발현된다.`];
  const itemVars = (item) => {
    const craft = crafts[item.theme] || crafts.arcane, primary = affinities[item.affinity] || { c: craft.accent, g: craft.glow }, secondary = affinities[item.affinity2] || primary;
    return `--p:${primary.c};--pg:${primary.g};--s:${secondary.c};--sg:${secondary.g};--rk:${rarityColors[item.rarity] || rarityColors.normal}`;
  };

  function currentEffects(item, motion = 'full') {
    if (motion === 'off') return '';
    const craft = crafts[item.theme] || crafts.arcane, rarity = item.rarity || 'normal';
    const level = ambientLevel[rarity] || 1, count = motion === 'lite' ? Math.min(10, particleBudget[rarity] || 4) : (particleBudget[rarity] || 4);
    let rays = '';
    if (craft.ambient.rays && level >= craft.ambient.rays) [4, 44, 77, 119, 158, 196, 233, 271, 306, 339].forEach((r, i) => { rays += `<i style="--r:${r}deg;--w:${[5.1, 2.8, 7.4, 3.3, 6, 4.2, 8.1, 3, 5.6, 2.5][i]}%"></i>`; });
    let motes = '';
    const seed = parseInt(ITEMXCore.fnv1a(item.id || item.name || '?'), 16) || 1;
    for (let i = 0; i < count; i++) {
      const n = seed + i * 43, z = 2 + (n % 5) * .75, shape = craft.shapes[n % craft.shapes.length], path = craft.paths[(n * 3 + 1) % craft.paths.length], pair = craft.colors[n % craft.colors.length];
      motes += `<i class="craft-mote shape-${shape} path-${path} ${shape === 'diamond' ? 'diamond' : ''}" style="--x:${n % 101}%;--z:${z}px;--mh:${z * 2.8}px;--ca:${pair[0]};--cb:${pair[1]};--o:${.22 + (n % 4) * .1};--d:${7 + (n % 8)}s;--delay:-${(n % 9) * .75}s;--drift:${-34 + (n % 69)}px;--drift2:${(34 - (n % 69)) * .7}px"></i>`;
    }
    const fog = craft.ambient.fog && level >= craft.ambient.fog ? '<div class="current-fog"><span class="current-fog-visual"></span></div>' : '';
    const scan = craft.ambient.scan && level >= craft.ambient.scan ? '<div class="current-scan"></div>' : '';
    const veil = craft.ambient.veil && level >= craft.ambient.veil ? '<div class="current-veil"><span class="current-veil-visual"></span></div>' : '';
    return `<div class="current-fx">${rays ? `<div class="current-rays">${rays}</div>` : ''}${fog}${scan}${veil}${motes}</div>`;
  }

  function affinityEffects(kind, role, rarity, motion = 'full') {
    if (!kind || !affinities[kind] || motion === 'off') return '';
    const a = affinities[kind], tag = kind === 'lightning' ? 'b' : 'i', budgetScale = Math.max(.28, (particleBudget[rarity] || 4) / 16);
    let count = kind === 'lightning' ? 14 : (kind === 'ice' ? 18 : (kind === 'wind' ? 11 : 16));
    count = Math.max(3, Math.ceil(count * budgetScale * (role === 'secondary' ? .68 : 1) * (motion === 'lite' ? .72 : 1)));
    let bits = '';
    for (let i = 0; i < count; i++) {
      const style = `--x:${(i * 37 + 11) % 98}%;--y:${(i * 29 + 7) % 91}%;--z:${4 + (i % 5) * 2.3}px;--h:${24 + (i % 6) * 9}px;--iw:${2.5 + (i % 5) * 1.4}px;--ih:${10 + (i % 5) * 3.5}px;--ph:${7 + (i % 5) * 2.4}px;--d:${2.5 + (i % 7) * .76}s;--delay:-${(i % 8) * .63}s;--drift:${-42 + (i * 23) % 85}px;--sk:${-18 + (i * 11) % 37}deg;--r:${-38 + (i * 31) % 77}deg;--ac:${a.c}`;
      bits += `<${tag} style="${style}"></${tag}>`;
    }
    const secondary = role === 'secondary' ? ' secondary' : '';
    const extra = kind === 'lightning' ? `<div class="lightning-field${secondary}" style="--ac:${a.c}"></div>` : (kind === 'ice' ? `<div class="ice-cracks${secondary}" style="--ac:${a.c}"></div>` : '');
    const movingSignature = ['fire', 'wind', 'earth', 'light', 'dark', 'poison', 'blood', 'void'].includes(kind);
    const signature = kind === 'ice' ? '' : `<div class="affinity-signature sig-${kind}${secondary}" style="--ac:${a.c}">${movingSignature ? '<span class="affinity-signature-visual"></span>' : ''}</div>`;
    return `${signature}${extra}<div class="afx afx-${kind}${role === 'secondary' ? ' afx-secondary' : ''}" style="--ac:${a.c}">${bits}</div>`;
  }

  function affinityUi(item) {
    if (!item.affinity) return '';
    const primary = affinities[item.affinity];
    let out = `<span class="affinity-chip" style="--chip:${primary.c}">${primary.icon} ${primary.name}<small>${item.affinity2 ? '주속성' : '단일 속성'}</small></span>`;
    if (item.affinity2) {
      const secondary = affinities[item.affinity2], reaction = reactionFor(item.affinity, item.affinity2);
      out += `<span class="affinity-chip" style="--chip:${secondary.c}">${secondary.icon} ${secondary.name}<small>부속성</small></span><span class="affinity-chip reaction-chip">✦ ${esc(reaction[0])}</span>`;
    }
    return `<div class="affinity-row">${out}</div>`;
  }

  function renderSkillFx(skill, rarity = 'normal', motion = 'full') {
    const affinity = affinities[skill?.affinity] ? skill.affinity : 'arcane';
    const item = { id: skill?.id || skill?.name || 'skill', name: skill?.name || '스킬', theme: 'arcane', rarity: rarityLabels[rarity] ? rarity : 'normal', affinity };
    return `<div class="itemx-fx itemx2-skill-weapon-fx">${currentEffects(item, motion)}<div class="affinity-fx">${affinityEffects(affinity, 'primary', item.rarity, motion)}</div></div>`;
  }

  function stats(item) {
    const values = [['위력', item.power], ['요구', item.required], ['내구', item.durability], ['가치', item.cost]].filter(([, value]) => value);
    if (!values.length) return '';
    return `<div class="itemx-stats">${values.map(([key, value]) => `<div class="itemx-stat"><span class="itemx-statk">${key}</span><span class="itemx-statv">${esc(value)}</span></div>`).join('')}</div>`;
  }

  function effectSection(item) {
    const effects = Array.isArray(item.effects) ? item.effects : [], augments = Array.isArray(item.augments) ? item.augments : [];
    let out = '';
    if (effects.length) out += `<div class="itemx-gap"></div><div class="itemx-section-label">특수 효과</div><div class="itemx-effects">${effects.map((one) => `<div class="itemx-effect"><span class="itemx-efname">${esc(one.name)}</span> <span>${esc(one.desc)}</span></div>`).join('')}</div>`;
    if (augments.length) out += `<div class="itemx-gap"></div><div class="itemx-section-label">증강</div><div class="itemx-effects">${augments.map((one) => `<div class="itemx-effect"><span class="itemx-efname">${esc(one.name)}</span> <span>${esc(one.desc)}</span></div>`).join('')}</div>`;
    return out;
  }

  function themeDecor(theme) {
    if (theme !== 'oriental') return '';
    return '<div class="itemx-oriental-paper"></div><i class="itemx-oriental-ink itemx-oriental-ink-a"></i><i class="itemx-oriental-ink itemx-oriental-ink-b"></i><div class="itemx-oriental-frame"></div><span class="itemx-oriental-seal" aria-hidden="true">鑑<br>定</span>';
  }

  function renderCard(item, options = {}) {
    if (!item) return '';
    const theme = crafts[item.theme] ? item.theme : 'arcane', rarity = rarityLabels[item.rarity] ? item.rarity : 'normal', motion = options.motion || 'full';
    const classes = ['itemx-card', `craft-${theme}`, `rarity-${rarity}`, item.condition ? `condition-${item.condition}` : '', motion === 'off' ? 'motion-off' : (motion === 'lite' ? 'motion-lite' : ''), options.inline ? 'itemx-inline-card' : ''].filter(Boolean).join(' ');
    const possession = possessionLabels[item.possession] || item.possession || '관찰', location = locationLabels[item.location] || item.location || '위치 불명';
    const fx = motion === 'off' ? '' : `<div class="itemx-fx">${currentEffects(item, motion)}<div class="affinity-fx">${affinityEffects(item.affinity, 'primary', rarity, motion)}${affinityEffects(item.affinity2, 'secondary', rarity, motion)}</div></div><div class="itemx-cond"></div>`;
    return `<article class="${classes}" style="${itemVars(item)}" data-itemx-id="${esc(item.id)}">${themeDecor(theme)}${fx}<div class="itemx-content"><div class="itemx-head"><div class="itemx-medallion"><span class="itemx-emoji">${esc(ITEMXCore.resolveItemEmoji(item))}</span></div><div class="itemx-titles"><div class="itemx-eyebrow">${esc(crafts[theme].eyebrow)}</div><span class="itemx-name">${esc(item.name || '???')}</span><span class="itemx-tier">${esc(item.displayRarity || rarityLabels[rarity])}</span><span class="itemx-subline"><span>${esc(possession)} · ${esc(location)}</span><span>${esc(item.itemType || '기타')}</span>${Number(item.count) > 1 ? `<span>×${Number(item.count)}</span>` : ''}</span></div></div>${affinityUi(item)}<div class="itemx-rule"></div>${stats(item)}${effectSection(item)}${item.trivia ? `<div class="itemx-flavor">${esc(item.trivia)}</div>` : ''}</div></article>`;
  }

  function renderTile(item) {
    const icons = [item.affinity && affinities[item.affinity]?.icon, item.affinity2 && affinities[item.affinity2]?.icon].filter(Boolean).join('');
    return `<button class="itemx-tile rarity-${esc(item.rarity || 'normal')}" style="${itemVars(item)}" data-item-id="${esc(item.id)}"><span class="itemx-tile-bar"></span>${item.location === 'equipped' ? '<span class="itemx-tile-eq"></span>' : ''}${icons ? `<span class="itemx-tile-aff">${icons}</span>` : ''}<span class="itemx-tile-em">${esc(ITEMXCore.resolveItemEmoji(item))}</span><span class="itemx-tile-nm">${esc(item.name || '???')}</span><span class="itemx-tile-meta"><span class="itemx-tile-rk">${esc(item.displayRarity || rarityLabels[item.rarity] || '일반')}</span><span class="itemx-tile-lc">${esc(item.itemType || '기타')}</span></span></button>`;
  }

  function renderMarkerPayload(payload, options = {}) {
    if (!payload || payload.error) return '';
    if (payload.view) return renderCard(payload.view, options);
    const id = payload.event?.patch?.id;
    return id ? `<span class="itemx-event-chip">ITEMX CODEX · ${esc(id)} 변경</span>` : '';
  }

  return { affinities, crafts, rarityLabels, reactions, particleBudget, renderCard, renderTile, renderMarkerPayload, renderSkillFx, itemVars };
})();

if (typeof globalThis !== 'undefined') globalThis.ITEMXRenderer = ITEMXRenderer;
