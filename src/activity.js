/* Host activity the runtime defers heavy work for: while the reader scrolls
 * the chat, queued rewrites and drawer refreshes wait. Written by the chat
 * presentation layer, read by the pipeline and the drawer. */
let scrolling = false;

export const scrollActive = () => scrolling;

export function setScrollActive(value) {
  scrolling = Boolean(value);
}

// The output window: a main response is being written into the chat. The host
// runs the output hook on every streaming flush and repaints the whole message
// each time, so presentation-only work (card animation, host DOM sync) waits
// for the window to close. The window closes on the chat output listener, on
// unload or context switch, or by itself once no flush arrived for
// OUTPUT_IDLE_MS; it can never outlive a stalled or aborted stream.
export const OUTPUT_IDLE_MS = 1500;
let output = false;
let outputTimer = null;
let outputSink = null;

export const outputActive = () => output;

// The presentation layer listens: (true) on open, (false) on close.
export function setOutputWindowSink(sink) {
  outputSink = typeof sink === 'function' ? sink : null;
}

function notify(active) {
  try {
    outputSink?.(active);
  } catch (error) {
    console.error('[ITEMX 2] output window', error);
  }
}

export function markOutputFlush() {
  if (outputTimer) globalThis.clearTimeout(outputTimer);
  outputTimer = globalThis.setTimeout(() => endOutputWindow(), OUTPUT_IDLE_MS);
  if (output) return;
  output = true;
  notify(true);
}

export function endOutputWindow() {
  if (outputTimer) globalThis.clearTimeout(outputTimer);
  outputTimer = null;
  if (!output) return;
  output = false;
  notify(false);
}
