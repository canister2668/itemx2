/* The in-world appraisal line. The protocol asks the narrative to show a newly
 * appraised item in one short line (item window, tooltip, shop label) before
 * the event copies it. Models write it as a bracketed line, often wrapped in
 * `inline code`, and with the event's own `::` / `;;` separators leaking in.
 * The display hook turns that line into a small system window: display only,
 * the stored text and what the model is shown stay as written. A line counts
 * only when it sits next to an item anchor (blank lines and other anchors in
 * between) and names that item, so story text in brackets is left alone. */
import * as Core from '../engine/core.js';
import { t } from '../i18n.js';

// `[ … ]`, optionally wrapped in backticks or bold markers, alone on its line.
const LINE_RE = /^[ \t]*(`{1,2}|\*\*)?[ \t]*\[([^[\]`\n]{2,600})\][ \t]*(`{1,2}|\*\*)?[ \t]*$/;
const ANCHOR_LINE_RE = /^[ \t]*(?:<!--[^\n]*?-->[ \t]*)+$/;
const RAW_TAG_RE = /^\s*(?:itemx|아이템|ITEMX)\s*:/i;

const squash = (text) =>
  String(text || '')
    .replace(/\s+/g, '')
    .toLowerCase();

function lineSpans(source) {
  const spans = [];
  let start = 0;
  while (start <= source.length) {
    const nl = source.indexOf('\n', start);
    const end = nl < 0 ? source.length : nl;
    spans.push({ start, end, text: source.slice(start, end).replace(/\r$/, '') });
    if (nl < 0) break;
    start = nl + 1;
  }
  return spans;
}

const tidy = (text) =>
  String(text || '')
    .replace(/\s*::\s*/g, ' — ')
    .replace(/\s*;;\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

// One `key: value` / `key 12/34` row, or a bare value.
function row(segment) {
  const text = tidy(segment);
  if (!text) return null;
  const colon = text.match(/^([^:：]{1,12})[:：]\s*(.+)$/);
  if (colon) return { key: colon[1].trim(), value: colon[2].trim() };
  const numeric = text.match(/^([^\s\d][^\s]{0,7})\s+([+\-−]?\d.*)$/);
  if (numeric) return { key: numeric[1], value: numeric[2] };
  return { key: '', value: text };
}

// "이름 (등급) - 첫 칸 | 칸 | 칸" → header + rows. Never throws; an odd shape
// keeps its words as plain rows.
export function parseAppraisal(inner, name) {
  const segments = String(inner || '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  let title = '',
    grade = '',
    first = segments.shift() || '';
  const head = first.match(/^(.+?)\s*[(（]([^()（）]{1,16})[)）]\s*(?:[-–—:：·]\s*(.*))?$/);
  if (head) {
    title = head[1].trim();
    grade = head[2].trim();
    first = head[3] || '';
  } else {
    const dash = first.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (dash && squash(dash[1]).includes(squash(name))) {
      title = dash[1].trim();
      first = dash[2];
    } else if (squash(first) === squash(name)) {
      title = first;
      first = '';
    }
  }
  const rows = [first, ...segments].map(row).filter(Boolean);
  return { title: tidy(title) || String(name || ''), grade: tidy(grade), rows };
}

export function appraisalHtml(parsed) {
  const esc = Core.esc;
  const rows = parsed.rows
    .map((one) =>
      one.key
        ? `<div class="ixs-row"><span>${esc(one.key)}</span><b>${esc(one.value)}</b></div>`
        : `<div class="ixs-row ixs-row-wide"><b>${esc(one.value)}</b></div>`
    )
    .join('');
  const grade = parsed.grade ? `<span class="ixs-r">${esc(parsed.grade)}</span>` : '';
  return `<div class="ixs"><div class="ixs-h"><span class="ixs-k">${esc(t('presentation.appraisal'))}</span><b>${esc(parsed.title)}</b>${grade}</div>${rows}</div>`;
}

// Appraisal lines next to item anchors: [{ start, end, key, html }], in text
// order, never overlapping an anchor. `rows` are the display hook's anchor
// rows; `nameOf(row)` gives the item name or ''.
export function findAppraisalLines(source, rows, nameOf) {
  if (!rows.length || !source.includes('[')) return [];
  const spans = lineSpans(source);
  const lineAt = (offset) => {
    let lo = 0,
      hi = spans.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (spans[mid].start <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const used = new Set();
  const found = [];
  const candidate = (index, name) => {
    const span = spans[index];
    if (used.has(index)) return null;
    const match = span.text.match(LINE_RE);
    if (!match || RAW_TAG_RE.test(match[2])) return null;
    if (!squash(match[2]).includes(squash(name))) return null;
    return match[2];
  };
  for (const anchor of rows) {
    const name = nameOf(anchor);
    if (!name || squash(name).length < 2) continue;
    const at = lineAt(anchor.start);
    let hit = -1,
      inner = '';
    for (const step of [-1, 1]) {
      // The nearest line that is neither blank nor anchors only, on each side.
      for (let i = at + step; i >= 0 && i < spans.length; i += step) {
        const text = spans[i].text;
        if (!text.trim() || ANCHOR_LINE_RE.test(text)) continue;
        const got = candidate(i, name);
        if (got !== null) {
          hit = i;
          inner = got;
        }
        break;
      }
      if (hit >= 0) break;
    }
    if (hit < 0) continue;
    used.add(hit);
    found.push({
      start: spans[hit].start,
      end: spans[hit].end,
      key: anchor.key,
      html: appraisalHtml(parseAppraisal(inner, name))
    });
  }
  return found.sort((a, b) => a.start - b.start);
}
