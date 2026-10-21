/* Reader's editor for items and skills: a full-screen form over the plugin container, like
 * the backup panel. A save is one manual ledger row marked `reader`. Every field has a lock
 * toggle; the locked fields become the entity's `locked`, so later model exams and patches
 * leave them alone. Editing a field turns its lock on; the reader can turn it off again
 * before saving. */
import * as Codex from '../engine/codex.js';
import * as Core from '../engine/core.js';
import * as Renderer from '../render/renderer.js';
import { commitManualEvents, cachedOrRebuildCurrent } from '../ledger.js';
import { host } from '../host.js';
import { t } from '../i18n.js';
import { entry } from '../kernel.js';
import { openRootInventory, showRootFeedback } from './panel.js';
import { uiState } from './view-state.js';

// kind: text | number | select | pairs (`name :: desc` lines) | lines | area.
const SPECS = {
  item: {
    tab: 'inventory',
    title: t('ui-editor.title'),
    lockable: Core.LOCKABLE,
    fields: [
      { key: 'name', label: t('ui-editor.name'), kind: 'text', max: 160 },
      { key: 'itemType', label: t('ui-editor.type'), kind: 'text', max: 160 },
      { key: 'emoji', label: t('ui-editor.emoji'), kind: 'text', max: 24 },
      { key: 'displayRarity', label: t('ui-editor.display-rarity'), kind: 'text', max: 80 },
      { key: 'power', label: t('ui-editor.power'), kind: 'text', max: 160 },
      { key: 'required', label: t('ui-editor.required'), kind: 'text', max: 160 },
      { key: 'durability', label: t('ui-editor.durability'), kind: 'text', max: 160 },
      { key: 'cost', label: t('ui-editor.cost'), kind: 'text', max: 160 },
      { key: 'rarity', label: t('ui-editor.rarity'), kind: 'select', options: () => rarityTable() },
      { key: 'theme', label: t('ui-editor.theme'), kind: 'select', options: () => labelTable('theme', Core.THEMES) },
      {
        key: 'affinity',
        label: t('ui-editor.affinity'),
        kind: 'select',
        none: true,
        options: () => labelTable('affinity', Core.AFFINITIES)
      },
      {
        key: 'affinity2',
        label: t('ui-editor.affinity2'),
        kind: 'select',
        none: true,
        options: () => labelTable('affinity', Core.AFFINITIES)
      },
      {
        key: 'condition',
        label: t('ui-editor.condition'),
        kind: 'select',
        none: true,
        options: () => labelTable('condition', Core.CONDITIONS)
      },
      { key: 'effects', label: t('ui-editor.effects'), kind: 'pairs' },
      { key: 'augments', label: t('ui-editor.augments'), kind: 'pairs' },
      { key: 'trivia', label: t('ui-editor.trivia'), kind: 'area', max: 1200 }
    ]
  },
  skill: {
    tab: 'skills',
    title: t('ui-editor.skill-title'),
    lockable: Codex.SKILL_LOCKABLE,
    fields: [
      { key: 'name', label: t('ui-editor.name'), kind: 'text', max: 160 },
      { key: 'glyph', label: t('ui-editor.emoji'), kind: 'text', max: 24 },
      { key: 'rank', label: t('ui-editor.skill-rank'), kind: 'text', max: 80 },
      { key: 'school', label: t('ui-editor.skill-school'), kind: 'text', max: 120 },
      { key: 'level', label: t('ui-editor.skill-level'), kind: 'number', min: 1, max: 999 },
      { key: 'mastery', label: t('ui-editor.skill-mastery'), kind: 'number', min: 0, max: 100 },
      { key: 'cost', label: t('ui-editor.skill-cost'), kind: 'text', max: 120 },
      { key: 'cooldown', label: t('ui-editor.skill-cooldown'), kind: 'text', max: 120 },
      { key: 'target', label: t('ui-editor.skill-target'), kind: 'text', max: 120 },
      { key: 'affinity', label: t('ui-editor.affinity'), kind: 'text', max: 80 },
      {
        key: 'type',
        label: t('ui-editor.skill-type'),
        kind: 'select',
        options: () => ({
          active: t('codex.type-active'),
          passive: t('codex.type-passive'),
          sealed: t('codex.type-sealed')
        })
      },
      { key: 'effects', label: t('ui-editor.effects'), kind: 'lines' },
      { key: 'description', label: t('ui-editor.trivia'), kind: 'area', max: 1200 },
      { key: 'growth', label: t('ui-editor.skill-growth'), kind: 'area', max: 800 }
    ]
  }
};
const specOf = (domain) => SPECS[domain === 'skill' ? 'skill' : 'item'];
const WIDE = new Set(['pairs', 'lines', 'area']);

function rarityTable() {
  return Object.fromEntries([...Core.RARITIES].map((key) => [key, Core.RARITY_LABELS[key] || key]));
}
function labelTable(group, allowed) {
  const table = Renderer.editorLabels()[group];
  return Object.fromEntries([...allowed].map((key) => [key, table[key] || key]));
}

const cut = (value, max) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

// One `name :: description` per line, as the transport writes them.
export function listText(rows) {
  return (rows || []).map((one) => (one.desc ? `${one.name} :: ${one.desc}` : one.name)).join('\n');
}
export function parseList(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => {
      const [name, ...rest] = line.split('::');
      return { name: cut(name, 160), desc: cut(rest.join('::'), 800) };
    })
    .filter((one) => one.name)
    .slice(0, 12);
}
// Skill effects are plain lines.
export function parseLines(text) {
  return [
    ...new Set(
      String(text || '')
        .split(/\r?\n/)
        .map((line) => cut(line, 180))
        .filter(Boolean)
    )
  ].slice(0, 12);
}
function parseNumber(text, min, max) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : null;
}

const emptyValue = (spec) =>
  ['pairs', 'lines'].includes(spec.kind) ? [] : spec.kind === 'number' || spec.none ? null : '';

// Fields of `form` that differ from `entity`. For items a grade label that followed the old
// grade moves to the new one.
export function editedFields(entity, form, domain = 'item') {
  const spec = specOf(domain);
  const next = { ...form };
  if (
    domain !== 'skill' &&
    next.rarity !== entity.rarity &&
    next.displayRarity === entity.displayRarity &&
    (!entity.displayRarity || entity.displayRarity === Core.RARITY_LABELS[entity.rarity])
  )
    next.displayRarity = Core.RARITY_LABELS[next.rarity];
  const fields = {};
  for (const field of spec.fields) {
    if (!(field.key in next)) continue;
    const before = entity[field.key] ?? emptyValue(field);
    if (JSON.stringify(next[field.key]) !== JSON.stringify(before)) fields[field.key] = next[field.key];
  }
  return fields;
}

export function editEvent(entity, fields, lock, domain = 'item') {
  const patch = { id: entity.id, action: null, op: 'merge', fields, lock };
  if (domain === 'skill') return { domain: 'skill', kind: 'patch', reader: true, patch };
  return {
    kind: 'patch',
    reader: true,
    patch: {
      ...patch,
      quantity: null,
      destination: '',
      reason: 'manual_edit',
      slot: null,
      inputs: null,
      outputs: null,
      equip: null,
      unequip: null
    }
  };
}

// The drawer's one-tap lock: every editable field, or none, with no field change.
export function lockAllEvent(entity, locked, domain = 'item') {
  return editEvent(entity, {}, locked ? [...specOf(domain).lockable] : [], domain);
}
export const isLocked = (entity) => Array.isArray(entity?.locked) && entity.locked.length > 0;

export function lockedNames(entity, domain = 'item') {
  const names = Object.fromEntries(specOf(domain).fields.map((field) => [field.key, field.label]));
  return (Array.isArray(entity?.locked) ? entity.locked : []).map((key) => names[key] || key).join(', ');
}

const option = (value, label, selected) =>
  `<option value="${Core.esc(value)}"${selected ? ' selected' : ''}>${Core.esc(label)}</option>`;

function controlHtml(field, entity) {
  const id = `ix-f-${field.key}`,
    value = entity[field.key];
  if (field.kind === 'select')
    return `<select id="${id}">${field.none ? option('', t('ui-editor.none'), !value) : ''}${Object.entries(
      field.options()
    )
      .map(([key, label]) => option(key, label, key === value))
      .join('')}</select>`;
  if (field.kind === 'pairs') return `<textarea id="${id}" rows="4">${Core.esc(listText(value))}</textarea>`;
  if (field.kind === 'lines') return `<textarea id="${id}" rows="4">${Core.esc((value || []).join('\n'))}</textarea>`;
  if (field.kind === 'area')
    return `<textarea id="${id}" rows="3" maxlength="${field.max}">${Core.esc(value ?? '')}</textarea>`;
  if (field.kind === 'number')
    return `<input id="${id}" type="text" inputmode="numeric" value="${Core.esc(value ?? '')}">`;
  return `<input id="${id}" type="text" maxlength="${field.max}" value="${Core.esc(value ?? '')}">`;
}

function formHtml(entity, domain) {
  const spec = specOf(domain);
  const locked = new Set(Array.isArray(entity.locked) ? entity.locked : []);
  // A div, not a label: a label would forward taps on its text to the lock button.
  const fieldHtml = (field) => {
    const on = locked.has(field.key);
    const hint =
      field.kind === 'pairs'
        ? t('ui-editor.list-hint')
        : field.kind === 'lines'
          ? t('ui-editor.lines-hint')
          : field.kind === 'number'
            ? t('ui-editor.number-hint', field.min, field.max)
            : '';
    return `<div class="field${WIDE.has(field.kind) ? ' wide' : ''}${on ? ' on' : ''}" data-field="${field.key}"><div class="head"><span>${field.label}</span><button class="lk" type="button" data-key="${field.key}" aria-pressed="${on}" title="${t('ui-editor.lock-toggle')}">${on ? '🔒' : '🔓'}</button></div>${hint ? `<small>${hint}</small>` : ''}${controlHtml(field, entity)}</div>`;
  };
  const grid = spec.fields
    .filter((field) => !WIDE.has(field.kind))
    .map(fieldHtml)
    .join('');
  const wide = spec.fields
    .filter((field) => WIDE.has(field.kind))
    .map(fieldHtml)
    .join('');
  return `<main id="itemx-editor"><header><h2>${spec.title}</h2><button id="ix-e-close" type="button">${t('ui-editor.close')}</button></header><p id="ix-e-target"></p><section><p class="note">${domain === 'skill' ? t('ui-editor.skill-lock-note') : t('ui-editor.lock-note')}</p><div class="bulk"><button id="ix-e-lock-all" type="button">${t('ui-editor.lock-all')}</button><button id="ix-e-unlock-all" type="button">${t('ui-editor.unlock-all')}</button></div><div class="grid">${grid}</div>${wide}<div class="actions"><button id="ix-e-save" type="button">${t('ui-editor.save')}</button></div></section><p id="ix-e-status" role="status" aria-live="polite"></p></main>`;
}

const STYLE =
  'body{margin:0;background:#0c121c;color:#e4eaf4;font:15px/1.6 system-ui}#itemx-editor{max-width:720px;margin:auto;padding:20px;box-sizing:border-box}#itemx-editor header{display:flex;align-items:center;justify-content:space-between;gap:12px}#itemx-editor h2{margin:0;font-size:1.15rem}#itemx-editor section{padding:16px;margin:16px 0;border:1px solid #33435d;border-radius:12px}#itemx-editor .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px 14px}#itemx-editor .field{display:grid;gap:4px;min-width:0;font-size:.85rem;color:#b9c6da}#itemx-editor .field.wide{margin-top:14px}#itemx-editor .field small{color:#7d8ba4;font-size:.75rem}#itemx-editor .head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:34px}#itemx-editor .head>span{min-width:0;overflow-wrap:anywhere}#itemx-editor .lk{flex:0 0 auto;min-width:40px;min-height:32px;margin:0;padding:0 8px;border-color:#36445a;background:#111a28;font-size:.95rem;line-height:1;opacity:.6}#itemx-editor .field.on .lk{border-color:#d4af6e;background:#292316;opacity:1}#itemx-editor .field.on>.head>span{color:#f3dcaa;font-weight:700}#itemx-editor .field.on input,#itemx-editor .field.on select,#itemx-editor .field.on textarea{border-color:#8a7240}#itemx-editor .bulk{margin:8px 0 14px}#itemx-editor input[type=text],#itemx-editor select,#itemx-editor textarea{box-sizing:border-box;width:100%;padding:9px 10px;background:#090e17;color:#e4eaf4;border:1px solid #40516c;border-radius:8px;font:inherit}#itemx-editor textarea{resize:vertical;line-height:1.5}#itemx-editor button{padding:10px 14px;margin:4px 8px 4px 0;border:1px solid #536884;border-radius:8px;background:#1a2940;color:#eef3fc;font:inherit;cursor:pointer}#itemx-editor #ix-e-save{border-color:#d4af6e;background:#292316;color:#f3dcaa;font-weight:700}#itemx-editor [hidden]{display:none}#itemx-editor .note{margin:6px 0 0;color:#8f9db4;font-size:.8rem;overflow-wrap:anywhere}#itemx-editor .actions{margin-top:14px}#ix-e-status{padding:10px;background:#142137;overflow-wrap:anywhere}#ix-e-status:empty{display:none}';

function readForm(get, domain) {
  const form = {};
  for (const field of specOf(domain).fields) {
    const raw = get(`ix-f-${field.key}`).value;
    if (field.kind === 'select') form[field.key] = raw || (field.none ? null : raw);
    else if (field.kind === 'pairs') form[field.key] = parseList(raw);
    else if (field.kind === 'lines') form[field.key] = parseLines(raw);
    else if (field.kind === 'number') form[field.key] = parseNumber(raw, field.min, field.max);
    else if (field.kind === 'area')
      form[field.key] = String(raw || '')
        .trim()
        .slice(0, field.max);
    else form[field.key] = cut(raw, field.max);
  }
  if (domain !== 'skill' && form.affinity2 && form.affinity2 === form.affinity) form.affinity2 = null;
  return form;
}

export async function openEntityEditor(loaded, entity, domain = 'item') {
  if (uiState.backupOpen || !loaded || !entity) return;
  // The flag also keeps the drawer from remounting over the form while it is open.
  uiState.backupOpen = true;
  const spec = specOf(domain);
  const original = Core.clone(entity);
  let busy = false;
  document.body.innerHTML = formHtml(original, domain);
  const style = document.getElementById('itemx-editor-style') || document.createElement('style');
  style.id = 'itemx-editor-style';
  style.textContent = STYLE;
  if (!style.isConnected) document.head.appendChild(style);
  const get = (id) => document.getElementById(id);
  get('ix-e-target').textContent = t('ui-editor.target', original.name || original.id, original.id);
  const status = (text) => {
    get('ix-e-status').textContent = text;
  };
  const close = async () => {
    style.remove();
    uiState.backupOpen = false;
    await host().hideContainer();
    await openRootInventory({ open: true, tab: spec.tab });
  };
  const run = async (work) => {
    if (busy) return;
    busy = true;
    try {
      await work();
    } catch (error) {
      status(t('ui-editor.failed', error.message || String(error)));
    } finally {
      busy = false;
    }
  };
  const current = (fresh) =>
    domain === 'skill'
      ? fresh.codexSnapshot?.skills?.entries?.[original.id]
      : fresh.snapshot?.registry?.items?.[original.id];
  const commit = async (fields, lock, label, done) => {
    const fresh = await cachedOrRebuildCurrent();
    if (!fresh || fresh.key !== loaded.key) throw new Error(t('ui-editor.chat-changed'));
    if (!current(fresh)) throw new Error(t('ui-editor.gone'));
    await commitManualEvents(fresh, [editEvent(original, fields, lock, domain)], label);
    await close();
    await showRootFeedback(done, 'success', 3200);
  };
  const locks = new Set(Array.isArray(original.locked) ? original.locked : []);
  const paint = (key) => {
    const box = document.querySelector(`.field[data-field="${key}"]`);
    if (!box) return;
    const on = locks.has(key);
    box.classList.toggle('on', on);
    const button = box.querySelector('.lk');
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? '🔒' : '🔓';
  };
  const setLock = (key, on) => {
    if (on) locks.add(key);
    else locks.delete(key);
    paint(key);
  };
  for (const button of document.querySelectorAll('.lk'))
    button.onclick = () => setLock(button.dataset.key, !locks.has(button.dataset.key));
  // Editing a field locks it; the reader may still unlock it before saving.
  for (const box of document.querySelectorAll('.field')) {
    const lockOnEdit = () => setLock(box.dataset.field, true);
    for (const control of box.querySelectorAll('input,select,textarea')) {
      control.addEventListener('input', lockOnEdit);
      control.addEventListener('change', lockOnEdit);
    }
  }
  if (domain !== 'skill') {
    // A grade label that followed the grade follows the new one at once, in the form and in
    // the lock, so the saved label is never an unlocked field a model can set back.
    let shownRarity = original.rarity;
    get('ix-f-rarity').addEventListener('change', () => {
      const next = get('ix-f-rarity').value,
        label = get('ix-f-displayRarity');
      const followed = !label.value.trim() || label.value.trim() === Core.RARITY_LABELS[shownRarity];
      shownRarity = next;
      if (!followed) return;
      label.value = Core.RARITY_LABELS[next] || '';
      setLock('displayRarity', true);
    });
  }
  get('ix-e-lock-all').onclick = () => spec.lockable.forEach((key) => setLock(key, true));
  get('ix-e-unlock-all').onclick = () => spec.lockable.forEach((key) => setLock(key, false));
  get('ix-e-close').onclick = entry('ui-action', () => run(close), true);
  get('ix-e-save').onclick = entry(
    'ui-action',
    () =>
      run(async () => {
        const form = readForm(get, domain);
        if (!form.name) return status(t('ui-editor.name-required'));
        const fields = editedFields(original, form, domain);
        const lock = spec.lockable.filter((key) => locks.has(key));
        const before = spec.lockable.filter((key) => original.locked?.includes(key));
        if (!Object.keys(fields).length && lock.join() === before.join()) return status(t('ui-editor.no-change'));
        status(t('ui-editor.saving'));
        await commit(fields, lock, t('ui-editor.label'), t('ui-editor.saved', form.name));
      }),
    true
  );
  try {
    await host().showContainer('fullscreen');
  } catch (error) {
    uiState.backupOpen = false;
    style.remove();
    throw error;
  }
}
