/* Session store: what the runtime knows about the active chat. Private state;
 * other modules read through the getters and change it through the commands. */
let activeKey = '';
let loaded = null;
let generation = 0;
let loadedGeneration = -1;
let latestKeys = new Set();

// Events parsed from model output whose anchors are not committed yet, keyed
// by anchor key. The display hook renders them until the commit folds them in.
const pending = new Map();
const PENDING_LIMIT = 64;

export const activeContextKey = () => activeKey;
export const isActive = (key) => Boolean(key) && key === activeKey;

export function setActiveContextKey(key) {
  activeKey = String(key || '');
}

// The last projection of the active chat, possibly stale.
export const cachedLoaded = () => loaded;

// The cached projection only while nothing has invalidated it since.
export const freshLoaded = () =>
  loaded && loaded.key === activeKey && loadedGeneration === generation ? loaded : null;

export function storeLoaded(value) {
  loaded = value;
  loadedGeneration = generation;
}

export function updateCachedChat(key, chat) {
  if (loaded?.key === key) loaded.chat = chat;
}

// Any change to chat data or replay inputs. The next reader rebuilds.
export function invalidateLoaded({ drop = true } = {}) {
  if (drop) loaded = null;
  generation += 1;
}

export const currentGeneration = () => generation;

// Anchor keys of the newest response, which alone may animate.
export const currentLatestKeys = () => latestKeys;
export function setLatestKeys(keys) {
  latestKeys = new Set(keys);
}

export function addPending(key, record) {
  pending.delete(key);
  pending.set(key, { ...record, at: Date.now() });
  while (pending.size > PENDING_LIMIT) pending.delete(pending.keys().next().value);
}
export const pendingRecord = (key) => pending.get(key) || null;
export const pendingEntries = (chatKey) => [...pending].filter(([, record]) => record.chatKey === chatKey);
export function dropPending(keys) {
  for (const key of keys) pending.delete(key);
}

export function resetSession(key = '') {
  activeKey = String(key || '');
  loaded = null;
  generation += 1;
  latestKeys = new Set();
  pending.clear();
}
