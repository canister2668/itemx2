/* Parsed cards whose commit failed, kept in plugin storage until a later
 * commit lands them. Without this a failed write lost them on reload: the
 * message keeps only the anchors, and the parsed events lived in memory. */
import * as Core from './engine/core.js';
import { host } from './host.js';
import { debugRecord } from './kernel.js';
import { addPending, pendingRecord } from './session.js';

export const PENDING_STORE_KEY = 'itemx:pending';
const CHAT_LIMIT = 8;
const ENTRY_LIMIT = 64;

async function readStore() {
  try {
    const raw = await host().pluginStorage.getItem(PENDING_STORE_KEY);
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    debugRecord('pending store read', error?.message || String(error));
    return {};
  }
}

async function writeStore(value) {
  const chats = Object.entries(value).filter(([, rows]) => rows && Object.keys(rows).length);
  // The most recently saved chats win; each keeps its newest entries.
  chats.sort((a, b) => newest(b[1]) - newest(a[1]));
  const kept = Object.fromEntries(
    chats.slice(0, CHAT_LIMIT).map(([chatKey, rows]) => [
      chatKey,
      Object.fromEntries(
        Object.entries(rows)
          .sort((a, b) => (b[1].at || 0) - (a[1].at || 0))
          .slice(0, ENTRY_LIMIT)
      )
    ])
  );
  await host().pluginStorage.setItem(PENDING_STORE_KEY, JSON.stringify(kept));
}

const newest = (rows) => Math.max(0, ...Object.values(rows).map((row) => row.at || 0));

// Saves the in-memory records of `keys`.
export async function storePending(chatKey, keys) {
  const rows = keys.map((key) => [key, pendingRecord(key)]).filter(([, record]) => record?.chatKey === chatKey);
  if (!rows.length) return;
  const store = await readStore();
  store[chatKey] = { ...(store[chatKey] || {}), ...Object.fromEntries(rows) };
  await writeStore(store);
}

// Removes `keys` once they are committed (or provably gone).
export async function forgetStoredPending(chatKey, keys) {
  const store = await readStore();
  const rows = store[chatKey];
  if (!rows || !keys.some((key) => key in rows)) return;
  for (const key of keys) delete rows[key];
  await writeStore(store);
}

// Puts the stored records of this chat back into the session once, so the
// next commit can land them. Returns the restored keys.
const restored = new Set();
export async function restoreStoredPending(chatKey) {
  if (restored.has(chatKey)) return [];
  restored.add(chatKey);
  const rows = (await readStore())[chatKey] || {};
  const keys = [];
  for (const [key, record] of Object.entries(rows)) {
    if (pendingRecord(key) || record?.chatKey !== chatKey || !record.event) continue;
    // Restored cards are old news: they render, but never animate as new.
    addPending(key, { ...record, event: Core.modelEvent(record.event), restored: true });
    keys.push(key);
  }
  if (keys.length) debugRecord('pending restored', { keys: keys.length });
  return keys;
}

// A fresh page load starts with nothing restored; tests reset it the same way.
export function resetPendingRestore() {
  restored.clear();
}
