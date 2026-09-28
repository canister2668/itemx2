/* Upward notifications. Lower layers (stores, pipeline, aux) never import the
 * UI; they emit here and the UI subscribes when main.js composes the runtime. */
const listeners = new Map();

export function on(type, listener) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(listener);
  return () => listeners.get(type)?.delete(listener);
}

// Awaits every listener in registration order. A failing listener is reported
// and never prevents the next one or the emitter's own work.
export async function emit(type, payload) {
  for (const listener of [...(listeners.get(type) || [])]) {
    try {
      await listener(payload);
    } catch (error) {
      console.error(`[ITEMX 2] ${type} listener`, error);
    }
  }
}

export function clearListeners() {
  listeners.clear();
}
