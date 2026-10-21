/* Reader's item editor: a full-screen form over the plugin container, like the backup panel.
 * A save is one manual ledger row marked `reader`. Every field has a lock toggle; the locked
 * fields become the item's `locked`, so later model exams and patches leave them alone.
 * Editing a field turns its lock on; the reader can turn it off again before saving. */
import * as Core from '../engine/core.js';
import * as Renderer from '../render/renderer.js';
import { commitManualEvents, cachedOrRebuildCurrent } from '../ledger.js';
import { host } from '../host.js';
import { t } from '../i18n.js';
import { entry } from '../kernel.js';
import { openRootInventory, showRootFeedback } from './panel.js';
import { uiState } from './view-state.js';

const TEXT_FIELDS = [
  ['name', t('ui-editor.name'), 160],
  ['itemType', t('ui-editor.type'), 160],
  ['emoji', t('ui-editor.emoji'), 24],
  ['displayRarity', t('ui-editor.display-rarity'), 80],
  ['power', t('ui-editor.power'), 160],
  ['required', t('ui-editor.required'), 160],
  ['durability', t('ui-editor.durability'), 160],
  ['cost', t('ui-editor.cost'), 160]
];
const LIST_FIELDS = [
  ['effects', t('ui-editor.effects')],
  ['augments', t('ui-editor.augments')]
];
export const FIELD_NAMES = {
  ...Object.fromEntries(TEXT_FIELDS.map(([key, label]) => [key, label])),
  ...Object.fromEntries(LIST_FIELDS),
  rarity: t('ui-editor.rarity'),
  theme: t('ui-editor.theme'),
  affinity: t('ui-editor.affinity'),
  affinity2: t('ui-editor.affinity2'),
  condition: t('ui-editor.condition'),
  trivia: t('ui-editor.trivia')
};

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

// Fields of `form` that differ from `item`, with a grade label that followed the
// old grade moved to the new one.
export function editedFields(item, form) {
  const next = { ...form };
  if (
    next.rarity !== item.rarity &&
    next.displayRarity === item.displayRarity &&
    (!item.displayRarity || item.displayRarity === Core.RARITY_LABELS[item.rarity])
  )
    next.displayRarity = Core.RARITY_LABELS[next.rarity];
  const fields = {};
  for (const key of Core.LOCKABLE) {
    if (!(key in next)) continue;
    const before =
      item[key] ??
      (['effects', 'augments'].includes(key) ? [] : ['affinity', 'affinity2', 'condition'].includes(key) ? null : '');
    if (JSON.stringify(next[key]) !== JSON.stringify(before)) fields[key] = next[key];
  }
  return fields;
}

export function editEvent(item, fields, lock) {
  return {
    kind: 'patch',
    reader: true,
    patch: {
      id: item.id,
      action: null,
      op: 'merge',
      fields,
      quantity: null,
      destination: '',
      reason: 'manual_edit',
      slot: null,
      inputs: null,
      outputs: null,
      equip: null,
      unequip: null,
      lock
    }
  };
}

// The drawer's one-tap lock: every editable field, or none, with no field change.
export function lockAllEvent(item, locked) {
  return editEvent(item, {}, locked ? [...Core.LOCKABLE] : []);
}
export const isLocked = (item) => Array.isArray(item?.locked) && item.locked.length > 0;

export function lockedNames(item) {
  return (Array.isArray(item?.locked) ? item.locked : []).map((key) => FIELD_NAMES[key] || key).join(', ');
}

const option = (value, label, selected) =>
  `<option value="${Core.esc(value)}"${selected ? ' selected' : ''}>${Core.esc(label)}</option>`;
const select = (id, table, value, none) =>
  `<select id="${id}">${none ? option('', none, !value) : ''}${Object.entries(table)
    .map(([key, label]) => option(key, label, key === value))
    .join('')}</select>`;

function formHtml(item) {
  const labels = Renderer.editorLabels();
  const pick = (table, allowed) => Object.fromEntries(Object.entries(table).filter(([key]) => allowed.has(key)));
  const affinity = pick(labels.affinity, Core.AFFINITIES);
  const rarity = Object.fromEntries([...Core.RARITIES].map((key) => [key, Core.RARITY_LABELS[key] || key]));
  const theme = Object.fromEntries([...Core.THEMES].map((key) => [key, labels.theme[key] || key]));
  const condition = pick(labels.condition, Core.CONDITIONS);
  const locked = new Set(Array.isArray(item.locked) ? item.locked : []);
  // A div, not a label: a label would forward taps on its text to the lock button.
  const field = (key, control, { wide = false, hint = '' } = {}) =>
    `<div class="field${wide ? ' wide' : ''}${locked.has(key) ? ' on' : ''}" data-field="${key}"><div class="head"><span>${FIELD_NAMES[key]}</span><button class="lk" type="button" data-key="${key}" aria-pressed="${locked.has(key)}" title="${t('ui-editor.lock-toggle')}">${locked.has(key) ? '🔒' : '🔓'}</button></div>${hint ? `<small>${hint}</small>` : ''}${control}</div>`;
  const text = TEXT_FIELDS.map(([key, , max]) =>
    field(key, `<input id="ix-f-${key}" type="text" maxlength="${max}" value="${Core.esc(item[key] ?? '')}">`)
  ).join('');
  const lists = LIST_FIELDS.map(([key]) =>
    field(key, `<textarea id="ix-f-${key}" rows="4">${Core.esc(listText(item[key]))}</textarea>`, {
      wide: true,
      hint: t('ui-editor.list-hint')
    })
  ).join('');
  const selects = [
    field('rarity', select('ix-f-rarity', rarity, item.rarity)),
    field('theme', select('ix-f-theme', theme, item.theme)),
    field('affinity', select('ix-f-affinity', affinity, item.affinity, t('ui-editor.none'))),
    field('affinity2', select('ix-f-affinity2', affinity, item.affinity2, t('ui-editor.none'))),
    field('condition', select('ix-f-condition', condition, item.condition, t('ui-editor.none')))
  ].join('');
  const trivia = field(
    'trivia',
    `<textarea id="ix-f-trivia" rows="3" maxlength="1200">${Core.esc(item.trivia ?? '')}</textarea>`,
    { wide: true }
  );
  return `<main id="itemx-editor"><header><h2>${t('ui-editor.title')}</h2><button id="ix-e-close" type="button">${t('ui-editor.close')}</button></header><p id="ix-e-target"></p><section><p class="note">${t('ui-editor.lock-note')}</p><div class="bulk"><button id="ix-e-lock-all" type="button">${t('ui-editor.lock-all')}</button><button id="ix-e-unlock-all" type="button">${t('ui-editor.unlock-all')}</button></div><div class="grid">${text}${selects}</div>${lists}${trivia}<div class="actions"><button id="ix-e-save" type="button">${t('ui-editor.save')}</button></div></section><p id="ix-e-status" role="status" aria-live="polite"></p></main>`;
}

const STYLE =
  'body{margin:0;background:#0c121c;color:#e4eaf4;font:15px/1.6 system-ui}#itemx-editor{max-width:720px;margin:auto;padding:20px;box-sizing:border-box}#itemx-editor header{display:flex;align-items:center;justify-content:space-between;gap:12px}#itemx-editor h2{margin:0;font-size:1.15rem}#itemx-editor section{padding:16px;margin:16px 0;border:1px solid #33435d;border-radius:12px}#itemx-editor .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px 14px}#itemx-editor .field{display:grid;gap:4px;min-width:0;font-size:.85rem;color:#b9c6da}#itemx-editor .field.wide{margin-top:14px}#itemx-editor .field small{color:#7d8ba4;font-size:.75rem}#itemx-editor .head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:34px}#itemx-editor .head>span{min-width:0;overflow-wrap:anywhere}#itemx-editor .lk{flex:0 0 auto;min-width:40px;min-height:32px;margin:0;padding:0 8px;border-color:#36445a;background:#111a28;font-size:.95rem;line-height:1;opacity:.6}#itemx-editor .field.on .lk{border-color:#d4af6e;background:#292316;opacity:1}#itemx-editor .field.on>.head>span{color:#f3dcaa;font-weight:700}#itemx-editor .field.on input,#itemx-editor .field.on select,#itemx-editor .field.on textarea{border-color:#8a7240}#itemx-editor .bulk{margin:8px 0 14px}#itemx-editor input[type=text],#itemx-editor select,#itemx-editor textarea{box-sizing:border-box;width:100%;padding:9px 10px;background:#090e17;color:#e4eaf4;border:1px solid #40516c;border-radius:8px;font:inherit}#itemx-editor textarea{resize:vertical;line-height:1.5}#itemx-editor button{padding:10px 14px;margin:4px 8px 4px 0;border:1px solid #536884;border-radius:8px;background:#1a2940;color:#eef3fc;font:inherit;cursor:pointer}#itemx-editor #ix-e-save{border-color:#d4af6e;background:#292316;color:#f3dcaa;font-weight:700}#itemx-editor [hidden]{display:none}#itemx-editor .note{margin:6px 0 0;color:#8f9db4;font-size:.8rem;overflow-wrap:anywhere}#itemx-editor .actions{margin-top:14px}#ix-e-status{padding:10px;background:#142137;overflow-wrap:anywhere}#ix-e-status:empty{display:none}';

function readForm(get) {
  const form = {};
  for (const [key, , max] of TEXT_FIELDS) form[key] = cut(get(`ix-f-${key}`).value, max);
  for (const key of ['rarity', 'theme']) form[key] = get(`ix-f-${key}`).value;
  for (const key of ['affinity', 'affinity2', 'condition']) form[key] = get(`ix-f-${key}`).value || null;
  if (form.affinity2 && form.affinity2 === form.affinity) form.affinity2 = null;
  for (const [key] of LIST_FIELDS) form[key] = parseList(get(`ix-f-${key}`).value);
  form.trivia = String(get('ix-f-trivia').value || '')
    .trim()
    .slice(0, 1200);
  return form;
}

export async function openItemEditor(loaded, item) {
  if (uiState.backupOpen || !loaded || !item) return;
  // The flag also keeps the drawer from remounting over the form while it is open.
  uiState.backupOpen = true;
  const original = Core.clone(item);
  let busy = false;
  document.body.innerHTML = formHtml(original);
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
    await openRootInventory({ open: true, tab: 'inventory' });
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
  const commit = async (fields, lock, label, done) => {
    const fresh = await cachedOrRebuildCurrent();
    if (!fresh || fresh.key !== loaded.key) throw new Error(t('ui-editor.chat-changed'));
    if (!fresh.snapshot?.registry?.items?.[original.id]) throw new Error(t('ui-editor.gone'));
    await commitManualEvents(fresh, [editEvent(original, fields, lock)], label);
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
  // A grade label that followed the grade follows the new one at once, in the form and in the
  // lock, so the saved label is never an unlocked field a model can set back.
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
  get('ix-e-lock-all').onclick = () => Core.LOCKABLE.forEach((key) => setLock(key, true));
  get('ix-e-unlock-all').onclick = () => Core.LOCKABLE.forEach((key) => setLock(key, false));
  get('ix-e-close').onclick = entry('ui-action', () => run(close), true);
  get('ix-e-save').onclick = entry(
    'ui-action',
    () =>
      run(async () => {
        const form = readForm(get);
        if (!form.name) return status(t('ui-editor.name-required'));
        const fields = editedFields(original, form);
        const lock = Core.LOCKABLE.filter((key) => locks.has(key));
        const before = Core.LOCKABLE.filter((key) => original.locked?.includes(key));
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
