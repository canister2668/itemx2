/* Host activity the runtime defers heavy work for: while the reader scrolls
 * the chat, queued rewrites and drawer refreshes wait. Written by the chat
 * presentation layer, read by the pipeline and the drawer. */
let scrolling = false;

export const scrollActive = () => scrolling;

export function setScrollActive(value) {
  scrolling = Boolean(value);
}
