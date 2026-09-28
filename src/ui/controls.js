import { auxActive, auxLast } from '../aux.js';
import { hookState, permission } from '../connection.js';
import { t } from '../i18n.js';
import { fail, workQueue } from '../kernel.js';
import { openRootInventory } from './panel.js';
import { mainDoc } from './style.js';
import { panelDocument } from './surface.js';
import { uiState } from './view-state.js';
export function auxStatusText() {
  if (auxActive() > 0) return auxWorkingLabel() || t('aux.058');
  const last = auxLast();
  if (!last?.at) return t('aux.057');
  const time = new Date(last.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${last.label} · ${time}`;
}

export function connectionSummary() {
  const hook =
    permission('replacer') === true
      ? [t('aux.056'), 'on']
      : permission('replacer') === false
        ? [t('aux.055'), 'off']
        : [t('aux.054'), 'warn'];
  const dom =
    permission('mainDom') === true
      ? [t('aux.053'), 'on']
      : permission('mainDom') === false
        ? [t('aux.052'), 'off']
        : [t('aux.051'), 'warn'];
  const listener =
    hookState('listener') === 'unsupported'
      ? [t('aux.050'), 'warn']
      : hookState('listener')
        ? [t('aux.049'), 'on']
        : [t('aux.048'), 'warn'];
  return {
    hook,
    dom,
    listener,
    ready: permission('replacer') === true && permission('mainDom') === true
  };
}

export async function updateConnectionUi() {
  if (!mainDoc()) return;
  const connection = connectionSummary();
  const chips = [
    ['hook', connection.hook],
    ['dom', connection.dom],
    ['listener', connection.listener]
  ];
  for (const [key, [label, tone]] of chips) {
    const chip = await mainDoc().querySelector(`.x-risu-itemx2-connection-${key}`);
    if (!chip) continue;
    await chip.setTextContent(label);
    await chip.removeClass('x-risu-itemx2-status-chip-on');
    await chip.removeClass('x-risu-itemx2-status-chip-warn');
    await chip.removeClass('x-risu-itemx2-status-chip-off');
    await chip.addClass(`x-risu-itemx2-status-chip-${tone}`);
  }
  const button = await mainDoc().querySelector('.x-risu-itemx2-setting-connect');
  if (!button) return;
  await button.setTextContent(
    workQueue.isActive('connect') ? t('aux.047') : connection.ready ? t('aux.046') : t('aux.045')
  );
  if (workQueue.isActive('connect')) await button.addClass('x-risu-itemx2-root-setting-button-busy');
  else await button.removeClass('x-risu-itemx2-root-setting-button-busy');
}

// A switch draws its knob with a child <i>, so setTextContent would delete it:
// the control turns into a bare pill that shows nothing while on, because the
// on state paints text transparent. Patch the state only and leave the knob.
export async function updateRootSwitch(selector, on, onClass = 'x-risu-itemx2-setting-on') {
  const control = await findRootControl(selector);
  if (!control) return repaintRootFallback();
  if (on) await control.addClass(onClass);
  else await control.removeClass(onClass);
  if (uiState.panelOpen) await control.setAttribute('aria-checked', on ? 'true' : 'false');
  else await updateHostSwitchAria(control, selector, on);
  return true;
}

export async function updateHostSwitchAria(control, selector, on) {
  // Stock SafeElement rejects non-x- attributes. Its sanitized HTML setter is
  // the supported way to update ARIA. Replace only this button, retaining its
  // contents; clicks are delegated on the drawer, not bound to the button.
  const html = await control.getOuterHTML();
  const next = html.replace(/^(<button\b[^>]*\baria-checked=")(true|false)(")/, `$1${on ? 'true' : 'false'}$3`);
  if (next === html) return;
  const focused = await findRootControl(`${selector}:focus`);
  await control.setOuterHTML(next);
  if (focused) {
    const replacement = await findRootControl(selector);
    if (replacement) await replacement.focus();
  }
}

export async function updateRootSegment(group, values, current) {
  let patched = false;
  for (const value of values) {
    const button = await findRootControl(`.x-risu-itemx2-seg-${group}-${value}`);
    if (!button) continue;
    patched = true;
    if (value === current) await button.addClass('x-risu-itemx2-seg-on');
    else await button.removeClass('x-risu-itemx2-seg-on');
  }
  return patched || repaintRootFallback();
}

// 도메인 카드는 스위치가 아니다. 자식 <i> 가 노브가 아니라 상태 글자라서
// 여기서만 글자를 갱신한다. 이 둘을 한 함수로 합치면 언젠가 노브를 지운다.
export async function updateRootDomainCard(selector, on, label) {
  const card = await findRootControl(selector);
  if (!card) return repaintRootFallback();
  if (on) await card.addClass('x-risu-itemx2-setting-on');
  else await card.removeClass('x-risu-itemx2-setting-on');
  const state = await card.querySelector('i');
  if (state) await state.setTextContent(label);
  return true;
}

export async function findRootControl(selector) {
  // Use the same surface as click hit-testing. A hidden host drawer can still
  // match while the iframe panel is open; searching it first patches a copy.
  const doc = panelDocument();
  if (!doc) return null;
  const bare = selector.replace('.x-risu-', '.');
  for (const query of [selector, bare]) {
    try {
      const found = await doc.querySelector(query);
      if (found) return found;
    } catch {}
  }
  return null;
}

// 제자리 패치가 실패해도 화면이 옛 상태로 남지 않게 하는 단 하나의 대비.
// 호출부에 흩어 두면 토글이 늘 때마다 같은 코드를 또 쓰게 된다.
export async function repaintRootFallback() {
  if (!uiState.rootOpen) return false;
  await openRootInventory({ open: true, tab: uiState.activeRootTab });
  return true;
}

export async function updateRootSettingButton(selector, label, enabled = null) {
  const button = await findRootControl(selector);
  if (!button) return;
  await button.setTextContent(label);
  if (enabled === true) await button.addClass('x-risu-itemx2-setting-on');
  else if (enabled === false) await button.removeClass('x-risu-itemx2-setting-on');
}

export const auxWorkingLabel = () => (auxLast().state === 'idle' ? t('aux.044') : auxLast().label);

export async function syncAuxIndicator() {
  try {
    if (!mainDoc()) return;
    const indicator = await mainDoc().querySelector('.x-risu-itemx2-aux-status');
    if (!indicator) return;
    const label = await indicator.querySelector('.x-risu-itemx2-aux-status-label');
    if (label) await label.setTextContent(auxActive() > 0 ? auxWorkingLabel() : auxLast().label);
    const settingLabel = await mainDoc().querySelector('.x-risu-itemx2-aux-setting-status');
    if (settingLabel) await settingLabel.setTextContent(auxStatusText());
    const runButton = await mainDoc().querySelector('.x-risu-itemx2-setting-aux-run');
    if (runButton) {
      await runButton.setTextContent(auxActive() > 0 ? t('aux.043') : t('aux.042'));
      if (auxActive() > 0) await runButton.addClass('x-risu-itemx2-root-setting-button-busy');
      else await runButton.removeClass('x-risu-itemx2-root-setting-button-busy');
    }
    const recent = auxLast().at && Date.now() - auxLast().at < 2600;
    if (auxActive() > 0 || recent) await indicator.addClass('x-risu-itemx2-aux-status-on');
    else await indicator.removeClass('x-risu-itemx2-aux-status-on');
    if (auxLast().state === 'done' && auxActive() === 0) await indicator.addClass('x-risu-itemx2-aux-status-done');
    else await indicator.removeClass('x-risu-itemx2-aux-status-done');
    if (auxLast().state === 'failed' && auxActive() === 0) await indicator.addClass('x-risu-itemx2-aux-status-failed');
    else await indicator.removeClass('x-risu-itemx2-aux-status-failed');
  } catch (error) {
    fail('aux indicator', error);
  }
}
