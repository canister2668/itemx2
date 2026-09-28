/* Connection store: which host hooks, permissions and UI parts this runtime
 * holds. Written by the modules that install them; read by the status UI. */
const hooks = { process: false, output: false, display: false, before: false, after: false, listener: false };
const permissions = { replacer: null, mainDom: null, db: null };
const errors = { hook: '', dom: '' };
const uiParts = [];
const update = { checking: false, checkedAt: 0, latest: '', available: false };
let unloading = false;

export const hookState = (name) => hooks[name];
export function setHook(name, value) {
  hooks[name] = value;
}
export const allHooksInstalled = () => Boolean(hooks.output && hooks.display && hooks.before && hooks.after);

export const permission = (name) => permissions[name];
export function setPermission(name, value) {
  permissions[name] = value;
}

export const lastError = (kind) => errors[kind];
export function setLastError(kind, message) {
  errors[kind] = String(message || '');
}

export const registeredUiParts = () => uiParts.slice();
export function rememberUiPart(id) {
  if (id && !uiParts.includes(id)) uiParts.push(id);
}

export const updateState = () => ({ ...update });
export function setUpdateState(patch) {
  Object.assign(update, patch);
}

export const isUnloading = () => unloading;
export function markUnloading() {
  unloading = true;
}
