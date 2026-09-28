/* Runtime kernel: the one work queue, logging and phase timing. Every other
 * module imports these instead of sharing a closure. */
import * as WorkQueue from './work-queue.js';

export const workQueue = WorkQueue.create();

// Model hooks may run while a commit-lane job waits on the model; drawer and
// host-DOM work has its own lane.
const REENTRANT = ['output', 'before-request', 'after-request'];
const VIEW = ['portraits', 'update'];
export const dispatch = (kind, work, unique = false, options = {}) =>
  workQueue.enqueue({
    kind,
    work,
    unique,
    lane: VIEW.includes(kind) ? 'view' : 'commit',
    ...options,
    reentrant: REENTRANT.includes(kind)
  });

export const entry =
  (kind, work, unique = false) =>
  (...args) =>
    dispatch(kind, () => work(...args), unique);

export const log = (...args) => console.log('[ITEMX 2]', ...args);

// The debug log is shown in the settings panel of a bot with debug enabled.
let debugOn = false,
  debugEntries = [];
export const debugEnabled = () => debugOn;
export const debugLog = () => debugEntries.slice();
export function setDebugEnabled(value) {
  debugOn = Boolean(value);
}
export function clearDebugLog() {
  debugEntries = [];
}
export const debugRecord = (where, detail = '') => {
  if (!debugOn) return;
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
  debugEntries.push({ at: Date.now(), where: String(where), detail: String(text || '').slice(0, 500) });
  if (debugEntries.length > 30) debugEntries.splice(0, debugEntries.length - 30);
  console.log(`[ITEMX 2 · DEBUG] ${where}`, detail);
};

export const fail = (where, error) => {
  debugRecord(`ERROR · ${where}`, error?.message || String(error));
  console.error(`[ITEMX 2] ${where}`, error);
};

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Phase timing, always on and cheap: a counter and a running total per phase.
// The costs that matter here are host round-trips, which no benchmark outside
// the browser can show, so the numbers have to come from the reader's session.
const phaseStats = new Map();
// Not every host exposes performance in the plugin frame; Date.now is coarser
// but never throws, and a missing clock must not break a chat read.
export const now = () => (typeof performance === 'object' && performance?.now ? performance.now() : Date.now());
const mark = (phase, startedAt) => {
  const ms = now() - startedAt;
  const row = phaseStats.get(phase) || { calls: 0, total: 0, worst: 0 };
  row.calls += 1;
  row.total += ms;
  if (ms > row.worst) row.worst = ms;
  phaseStats.set(phase, row);
  return ms;
};
export const timed = async (phase, work) => {
  const startedAt = now();
  try {
    return await work();
  } finally {
    mark(phase, startedAt);
  }
};
export const timedSync = (phase, work) => {
  const startedAt = now();
  try {
    return work();
  } finally {
    mark(phase, startedAt);
  }
};
export const phaseReport = () =>
  [...phaseStats]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(
      ([phase, row]) =>
        `${phase} x${row.calls} avg ${(row.total / row.calls).toFixed(1)}ms max ${row.worst.toFixed(1)}ms`
    )
    .join('\n') || '-';

export async function withTimeout(promise, timeoutMs, message) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) globalThis.clearTimeout(timer);
  }
}
