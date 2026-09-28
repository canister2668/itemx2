/* Session store: what the runtime knows about the active chat. Private state;
 * other modules read through the getters and change it through the commands. */
let activeKey = '';
let loaded = null;
let generation = 0;
let loadedGeneration = -1;
let latestMarkers = new Set();
let eventPayloads = new Map();
let ledgerRevision = 0;

export const activeContextKey = () => activeKey;
export const isActive = (key) => Boolean(key) && key === activeKey;

export function setActiveContextKey(key) {
  activeKey = String(key || '');
}

// The last rebuilt projection of the active chat, possibly stale.
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

export const currentLatestMarkers = () => latestMarkers;

export function setLatestMarkers(markers) {
  latestMarkers = new Set(markers);
}

export const eventPayload = (key) => eventPayloads.get(key);

// The per-chat event payloads the display hook resolves compact refs from.
export function setEventPayloads(payloads) {
  eventPayloads = new Map(payloads);
  ledgerRevision += 1;
}

export const currentLedgerRevision = () => ledgerRevision;

export function resetSession(key = '') {
  activeKey = String(key || '');
  loaded = null;
  generation += 1;
  latestMarkers = new Set();
  eventPayloads = new Map();
  ledgerRevision += 1;
}
