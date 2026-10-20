/* Update check: reads the version line of the published bundle once per page
 * load and announces the result on the `update` event. */
import { ITEMX_PLUGIN_VERSION, ITEMX_UPDATE_URL } from './config.js';
import { setUpdateState, updateState } from './connection.js';
import { emit } from './events.js';
import { host } from './host.js';
import { t } from './i18n.js';
import { debugRecord, withTimeout } from './kernel.js';
import { activeContextKey } from './session.js';
export function compareVersions(left, right) {
  const parse = (value) => {
    const [main, prerelease = ''] = String(value || '')
      .trim()
      .replace(/^v/i, '')
      .split('-', 2);
    return {
      main: main.split('.').map((part) => Number.parseInt(part, 10) || 0),
      pre: prerelease ? prerelease.split('.') : []
    };
  };
  const a = parse(left),
    b = parse(right);
  for (let index = 0; index < Math.max(a.main.length, b.main.length); index += 1) {
    const difference = (a.main[index] || 0) - (b.main[index] || 0);
    if (difference) return difference > 0 ? 1 : -1;
  }
  if (!a.pre.length || !b.pre.length) return a.pre.length === b.pre.length ? 0 : a.pre.length ? -1 : 1;
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index += 1) {
    if (a.pre[index] == null || b.pre[index] == null) return a.pre[index] == null ? -1 : 1;
    if (a.pre[index] === b.pre[index]) continue;
    const aNumber = /^\d+$/.test(a.pre[index]) ? Number(a.pre[index]) : null;
    const bNumber = /^\d+$/.test(b.pre[index]) ? Number(b.pre[index]) : null;
    if (aNumber != null && bNumber != null) return aNumber > bNumber ? 1 : -1;
    if (aNumber != null || bNumber != null) return aNumber != null ? -1 : 1;
    return a.pre[index] > b.pre[index] ? 1 : -1;
  }
  return 0;
}

// Once per page load: the first chat after a refresh reads the published
// version line; later chat switches reuse the answer.
let checkedThisLoad = false;

export async function checkForUpdate() {
  if (checkedThisLoad || updateState().checking || !activeContextKey() || typeof host().nativeFetch !== 'function')
    return;
  checkedThisLoad = true;
  setUpdateState({ checking: true });
  try {
    const response = await withTimeout(
      host().nativeFetch(ITEMX_UPDATE_URL, {
        method: 'GET',
        headers: { Range: 'bytes=0-2047' },
        cache: 'no-store'
      }),
      6000,
      t('ui-settings.151')
    );
    if (!response?.ok) throw new Error(t('ui-settings.149', response?.status || t('ui-settings.150')));
    const header = String((await response.text()) || '');
    const latest = header.match(/^\/\/@version\s+([^\s]+)\s*$/m)?.[1] || '';
    if (!latest) throw new Error(t('ui-settings.148'));
    setUpdateState({ checkedAt: Date.now(), latest, available: compareVersions(latest, ITEMX_PLUGIN_VERSION) > 0 });
    await emit('update', updateState());
  } catch (error) {
    debugRecord('update check', error?.message || String(error));
  } finally {
    setUpdateState({ checking: false });
  }
}
