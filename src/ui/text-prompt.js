/* One text box over the plugin container, for anything the reader types: the search
 * query, reappraisal and creation instructions, the author note. The drawer itself is
 * drawn through the v3 SafeElement API, whose sanitizer drops `contenteditable` and
 * which cannot read an <input>'s value, so typing happens here in a real <textarea>. */
import { host } from '../host.js';
import { t } from '../i18n.js';
import { entry } from '../kernel.js';
import { openRootInventory } from './panel.js';
import { uiState } from './view-state.js';

export const TEXT_PROMPT_STYLE =
  'body{margin:0;background:#0c121c;color:#e4eaf4;font:15px/1.6 system-ui}#itemx-prompt{max-width:680px;margin:auto;padding:20px;box-sizing:border-box}#itemx-prompt header{display:flex;align-items:center;justify-content:space-between;gap:12px}#itemx-prompt h2{margin:0;font-size:1.15rem}#itemx-prompt section{padding:16px;margin:16px 0;border:1px solid #33435d;border-radius:12px}#itemx-prompt p{margin:0 0 10px;color:#9fadc4;font-size:.85rem;overflow-wrap:anywhere;white-space:pre-line}#itemx-prompt textarea{display:block;box-sizing:border-box;width:100%;padding:10px;background:#090e17;color:#e4eaf4;border:1px solid #40516c;border-radius:8px;font:inherit;line-height:1.55;resize:vertical}#itemx-prompt textarea:focus{outline:none;border-color:#7d93b8}#itemx-prompt .count{margin-top:6px;color:#7d8ba4;font-size:.75rem;text-align:right}#itemx-prompt .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}#itemx-prompt button{min-height:44px;padding:10px 14px;border:1px solid #536884;border-radius:8px;background:#1a2940;color:#eef3fc;font:inherit;cursor:pointer}#itemx-prompt #ix-p-ok{border-color:#d4af6e;background:#292316;color:#f3dcaa;font-weight:700}#ix-p-status{padding:10px;background:#142137;overflow-wrap:anywhere}#ix-p-status:empty{display:none}';

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

export const textPromptHtml = (options) => {
  const max = options.max || 1000;
  return `<main id="itemx-prompt"><header><h2>${esc(options.title)}</h2><button id="ix-p-close" type="button">${t('ui-editor.close')}</button></header><section>${options.note ? `<p>${esc(options.note)}</p>` : ''}<textarea id="ix-p-text" rows="${options.rows || 6}" maxlength="${max}" placeholder="${esc(options.placeholder || '')}">${esc(options.value || '')}</textarea><div class="count" id="ix-p-count"></div><div class="actions"><button id="ix-p-ok" type="button">${esc(options.submitLabel || t('ui-prompt.ok'))}</button>${options.clearLabel ? `<button id="ix-p-clear" type="button">${esc(options.clearLabel)}</button>` : ''}</div></section><p id="ix-p-status" role="status" aria-live="polite"></p></main>`;
};

/* options: title, note, value, placeholder, max, rows, submitLabel, required, clearLabel,
 * tab (drawer tab to reopen), onSubmit(text). onSubmit runs after the window has closed,
 * so a long model call shows its progress in the drawer as before. */
export async function openTextPrompt(options) {
  if (uiState.backupOpen) return;
  uiState.backupOpen = true;
  const max = options.max || 1000;
  document.body.innerHTML = textPromptHtml(options);
  const style = document.getElementById('itemx-prompt-style') || document.createElement('style');
  style.id = 'itemx-prompt-style';
  style.textContent = TEXT_PROMPT_STYLE;
  if (!style.isConnected) document.head.appendChild(style);
  const get = (id) => document.getElementById(id);
  const box = get('ix-p-text');
  const count = () => {
    get('ix-p-count').textContent = `${box.value.length} / ${max}`;
  };
  box.addEventListener('input', count);
  count();
  let done = false;
  const close = async (text) => {
    if (done) return;
    done = true;
    style.remove();
    uiState.backupOpen = false;
    await host().hideContainer();
    if (text == null) {
      await openRootInventory({ open: true, tab: options.tab });
      return;
    }
    await options.onSubmit(text);
  };
  get('ix-p-close').onclick = entry('ui-action', () => close(null), true);
  get('ix-p-ok').onclick = entry(
    'ui-action',
    async () => {
      const text = box.value.replace(/\r\n?/g, '\n').trim().slice(0, max);
      if (options.required && !text) {
        get('ix-p-status').textContent = options.required;
        box.focus();
        return;
      }
      await close(text);
    },
    true
  );
  if (options.clearLabel) {
    get('ix-p-clear').onclick = () => {
      box.value = '';
      count();
      box.focus();
    };
  }
  try {
    await host().showContainer('fullscreen');
  } catch (error) {
    uiState.backupOpen = false;
    style.remove();
    throw error;
  }
  try {
    box.focus();
  } catch {
    /* focus may be refused before the container is shown */
  }
}
