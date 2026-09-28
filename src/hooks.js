/* Host hook registration. main.js supplies the handlers once; this module owns
 * adding, re-adding after a browser resume, and removing them on unload. The
 * v3 bridge keeps callback identity, so each handler is created exactly once. */
import { hookState, permission, setHook, setLastError, setPermission } from './connection.js';
import { emit } from './events.js';
import { host } from './host.js';
import { t } from './i18n.js';
import { fail, log } from './kernel.js';
import { setStatus } from './status.js';

let handlers = null;

export function configureHooks(value) {
  handlers = Object.freeze({ ...value });
}

const required = () => {
  if (!handlers) throw new Error('ITEMX hooks used before configureHooks');
  return handlers;
};

export async function installDisplayHooks() {
  const h = required();
  for (const mode of ['process', 'output', 'display'])
    if (!hookState(mode)) {
      await host().addRisuScriptHandler(mode, h[mode]);
      setHook(mode, true);
    }
}

// Host-side hook sets can be rebuilt independently of a still-alive plugin
// iframe. Re-adding the same callback is idempotent because RisuAI stores
// handlers in Sets and the v3 bridge preserves callback identity.
export async function refreshHookBindings() {
  const h = required();
  for (const mode of ['process', 'output', 'display']) await host().addRisuScriptHandler(mode, h[mode]);
  if (permission('replacer')) {
    await host().addRisuReplacer('beforeRequest', h.before);
    await host().addRisuReplacer('afterRequest', h.after);
  }
}

export async function installPipelineHooks({ prompt = false } = {}) {
  const h = required();
  try {
    await installDisplayHooks();
    const granted =
      typeof host().requestPluginPermission === 'function' ? await host().requestPluginPermission('replacer') : true;
    setPermission('replacer', granted === true);
    if (granted !== true) {
      const quiet = (work) =>
        Promise.resolve()
          .then(work)
          .catch(() => {});
      if (hookState('before')) await quiet(() => host().removeRisuReplacer('beforeRequest', h.before));
      if (hookState('after')) await quiet(() => host().removeRisuReplacer('afterRequest', h.after));
      setHook('before', false);
      setHook('after', false);
      setLastError('hook', t('pipeline.006'));
      setStatus(t('pipeline.005'));
    } else {
      if (!hookState('before')) {
        await host().addRisuReplacer('beforeRequest', h.before);
        setHook('before', true);
      }
      if (!hookState('after')) {
        await host().addRisuReplacer('afterRequest', h.after);
        setHook('after', true);
      }
    }
    if (!hookState('listener')) {
      if (typeof host().addRisuChatListener !== 'function') {
        setHook('listener', 'unsupported');
        log('chat listener unavailable; continuing with core request/output hooks');
      } else
        try {
          await host().addRisuChatListener('output', h.listener);
          setHook('listener', true);
        } catch (error) {
          const message = String(error?.message || error || '');
          if (!/API method addRisuChatListener not found/i.test(message)) throw error;
          setHook('listener', 'unsupported');
          log('chat listener unavailable; continuing with core request/output hooks');
        }
    }
    if (granted === true) {
      setLastError('hook', '');
      setStatus(prompt ? t('pipeline.004') : t('runtime.003'));
    }
    await emit('hooks');
    return granted === true;
  } catch (error) {
    setPermission('replacer', false);
    setLastError('hook', String(error?.message || error || t('pipeline.002')));
    setStatus(t('pipeline.001'));
    fail('pipeline hooks', error);
    return false;
  }
}

// The host does not drop script handlers, replacers or chat listeners of an
// unloaded plugin; every one is detached here, concurrently.
export function removeHooks() {
  if (!handlers) return Promise.resolve();
  const h = handlers;
  const quiet = (work) =>
    Promise.resolve()
      .then(work)
      .catch(() => {});
  return Promise.all([
    quiet(() => host().removeRisuScriptHandler('output', h.output)),
    quiet(() => host().removeRisuScriptHandler('display', h.display)),
    quiet(() => host().removeRisuScriptHandler('process', h.process)),
    quiet(() => host().removeRisuReplacer('beforeRequest', h.before)),
    quiet(() => host().removeRisuReplacer('afterRequest', h.after)),
    hookState('listener') === true
      ? quiet(() => host().removeRisuChatListener('output', h.listener))
      : Promise.resolve()
  ]);
}
