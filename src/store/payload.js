/* Frozen card payloads. A committed card keeps the view and previous view it
 * showed, so it renders without a replay. Both are stored as a difference:
 * the view against the entity the event itself carries, the previous view
 * against the view. Most fields match, so a row holds only what changed.
 *
 *   vd/pd  { d: changed or added fields, u: removed field names }
 *   v/p    full objects (rows written before 2.5.1, or no object to compare)
 */
const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function difference(base, target) {
  const d = {};
  for (const [key, value] of Object.entries(target)) if (!same(value, base[key])) d[key] = value;
  const u = Object.keys(base).filter((key) => !(key in target));
  return u.length ? { d, u } : { d };
}

export function patched(base, diff) {
  const out = JSON.parse(JSON.stringify(base));
  for (const key of diff.u || []) delete out[key];
  return Object.assign(out, JSON.parse(JSON.stringify(diff.d || {})));
}

const entityOf = (event) => (object(event?.item) ? event.item : object(event?.entity) ? event.entity : null);

// Writes the frozen view and previous view of `row`, replacing older forms.
export function freeze(row, view, previous) {
  delete row.v;
  delete row.p;
  delete row.vd;
  delete row.pd;
  if (!object(view)) return row;
  const base = entityOf(row.e);
  if (base) row.vd = difference(base, view);
  else row.v = view;
  if (object(previous)) row.pd = difference(view, previous);
  else if (previous != null) row.p = previous;
  else row.p = null;
  return row;
}

// The frozen { view, previous } of `row`, or null when it has none.
export function thaw(row) {
  let view = null;
  if (object(row?.v)) view = row.v;
  else if (row?.vd && entityOf(row.e)) view = patched(entityOf(row.e), row.vd);
  if (!view) return null;
  const previous = row.pd ? patched(view, row.pd) : (row.p ?? null);
  return { view, previous };
}

export const isFrozen = (row) => Boolean(row?.v || row?.vd);
