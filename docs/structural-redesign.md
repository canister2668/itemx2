# Structural redesign verification

Six sequential gates on `structural/2.2.0`; no push is part of this work.

1. `188b937` pins the stock API declaration at upstream
   `669b12ceabe1c5066d3dadbe0973f2188d10cc97`. AST checks reject unknown direct,
   computed and optional API access. `resizeContainer` is the explicitly tested
   exception with a rejected-call fallback.
2. `02be791` introduces one intent scheduler. Pending work of the same kind is
   coalesced; active work gets a successor. External model calls temporarily
   permit reentrant host hooks, and reacquire ownership before committing.
   Teardown cancels pending work and waits for running owners.
3. `f0ef889` separates state into sealed domain ports backed by private closures.
   The flat runtime had 118 fields; the current declared ports have 57 fields
   plus the UI query view. No Busy/Promise/Pending/Fingerprint state fields remain.
4. `f131ad2` installs the three-document persistence boundary and central settings
   schema. The legacy replay DTO keys exist only in memory; the host write
   boundary persists `itemx:log`, `itemx:prefs`, and `itemx:cache`.
5. `869ffa5` splits domain implementations and consolidates CSS in `style.js` and
   `style.css`. `runtime.js` is 168 lines of bootstrap and teardown.
6. The shared panel uses the same radio body and click router in the host bridge
   and iframe. Search uses contenteditable plus explicit confirmation. Runtime
   messages (457 strings/templates after removing duplicate UI) live in
   `src/locales/ko.json`; localization is resolved at build time.

## Storage semantics

- The log retains events without `view` or `previous`; those are replay products.
  Cache maintenance does not truncate facts or message markers. Full transport
  markers and their compact refs are aliases of the same fact.
- A one-time imported baseline preserves already-folded state. New backups
  imported in replace mode append a reset baseline, retaining the preceding log.
  Repeating an identical restore also appends a new baseline; content deduplication
  cannot erase the reset operation. This regression was reproduced before the fix.
- Legacy orphan refs are retained as inactive historical facts, so importing
  them does not resurrect entities already removed from the old replay.
- History preferences are canonical. Auxiliary guards, snapshots and enrichment
  are disposable cache data. Invalid cache JSON rebuilds; invalid authoritative
  data fails explicitly. There is no checkpoint migration/freeze chain.
- Settings are one `itemx:settings` document with global and character sections;
  defaults and validation are in `settings-store.js`. No custom compression.

## Production conversion and deployment

Production port 16003 is currently served by `LIVE-SERVER`, which retains the
`risu-haejeok-trial-app` network alias. PostgreSQL is
`risu-haejeok-trial-postgres` / `risuai_trial`.

The step-4 converter backed up all selected state rows, message projections and
settings before changing anything. Revision locking and compare-and-set checks
protect against edits after backup. Nineteen chats received 57 documents with 88
log rows. This includes 17 ITEMX2 chats and two older ITEMX snapshot-only chats.
The two existing folded ITEMX2 checkpoints preserve their available final state;
previously removed history cannot be recovered.

Backup: `/volume2/risu/backups/itemx2-production/storage-20260919-074148/before.json`

Step-4 plugin backup:
`/volume2/risu/backups/itemx2-production/production-itemx-20260919-074151.json`

Step-4 deployed SHA-256:
`68d1099a118bff68d12060cee9e6252b5772e262b1dfd5d9b4cd23ca7c7420a2`

Rollback of the old persistence format requires restoring the matching chat and
settings backup together with the old plugin; replacing only the bundle cannot
restore the old storage representation. The converter refuses a second apply.

Step-6 deployed SHA-256:
`586bf44ba56e7164dab269275eeb305eea98343bf643602e2a2668a8afdcbb86`

Step-6 plugin backup:
`/volume2/risu/backups/itemx2-production/production-itemx-20260919-080640.json`

Both deployments verified the canonical plugin script and `system.plugins`
projection against the local bundle. The production HTTP endpoint returned 200.
The final gate passed **230 tests, zero failures and zero skips**, including the
previously optional Chromium settings layout gate. The old eight keys totalled
132,204 UTF-8 bytes; the converted three documents total 98,255 bytes.

## Evidence and repeatable checks

- `npm run build && ITEMX_SETTINGS_BROWSER=1 npm test` enables the existing
  browser gate as well as all original tests and new regression coverage.
- `tests/baseline-render.test.mjs` compares the original `22fde72` bundle's HTML.
  Only the intentionally added, explicitly marked search controls are excluded.
- `scripts/convert-storage.mjs` compared 19 backed-up chats with the old replay,
  including lifecycle metadata, 57 nonempty rendered views and cache deletion.
- `node scripts/verify-shared-panel-browser.mjs` drives Chromium at 390px and
  900px in both native iframe and emulated host-bridge modes. It checks filters
  without body rewrites, item/skill details, confirmed search and reset, settings
  toggles, and the first confirmation step for storage cleanup.
- Screenshots and machine-readable results are in `artifacts/shared-panel/`.

The browser checks use real Chromium DOM/CSS and a host API adapter fixture.
They do not constitute an authenticated production-browser or real-model test.
`core.js`, `codex.js`, and `main-protocol.txt` remain unchanged.

## Performance follow-up

The reinforcement review found two omissions in the initial redesign: there
was no reusable derived replay checkpoint, and the 1,200 ms post-commit remount
quiet period had been dropped. Both are now restored. The earlier 98,255-byte
conversion measurement describes the initial documents, not the warmed cache
after this follow-up.

- `itemx:cache.replay` stores the replay position, item/codex state, lifecycle
  occurrence counters and display projections. Events remain exclusively in the
  authoritative log; the cached projections omit their event copies. The ordered
  prefix and cache checksum must match before reuse. Late historical insertions,
  changed message identities, compact-marker aliases and damaged cache data
  invalidate the checkpoint. Missing cache data performs one full reconstruction.
  Baseline-only chats need zero folds without a second snapshot. The obsolete
  `cache.item` and `cache.codex` copies are no longer persisted.
- Capture indexes event identities with a Map, avoiding repeated full-log
  searches. Cache validation and document serialization still scan bytes; this
  is not constant-time end-to-end storage. The log is never truncated.
- The queue records the post-commit quiet period by context identity. Failed
  auxiliary attempts, including exceptions, retain 10/20/40/80/120-second retry
  intervals (the existing `5000 * 2 ** failures` policy). A new message identity
  remains eligible immediately.
- Scroll callbacks and their end timers can run while an external model call is
  suspended. Heavy committed-output and DOM jobs remain deferred. The pause
  class now belongs to the body so multiple message containers are covered.
  A scoped rule also pauses card-level aura, border and lightning animations and
  pseudo-elements that the older FX-layer selector missed. Removing the class
  resumes them; the effects themselves are preserved.
- Regression tests retain 64 marker HTML entries, 60 detail HTML entries, 24
  original portraits, their existing 16 MiB string-length budget, and 64 thumbnails.

The final gate passed **240 tests, zero failures and zero skips**. The original
205 tests remain present. The 19-chat replay/57-render differential verification
also passes with the new checkpoints and after deleting the derived cache.

### Measurements and limits

`node scripts/measure-replay-browser.mjs` compares the previous `b4fe1c2` bundle
with the current bundle in fresh Chromium iframe realms, using 3,000 messages and
900 events. These timings cover local hydration plus state replay, not host RPC
or PostgreSQL latency. Twelve samples per scenario produced:

| Scenario | Previous median | Current median | Previous/current event applications |
| --- | ---: | ---: | ---: |
| Unchanged chat | 223.1 ms | 127.4 ms | 1,800 / 0 |
| One appended event | 200.9 ms | 107.9 ms | 1,802 / 1 |
| Lost cache | 205.0 ms | 117.4 ms | 1,800 / 900 |

The synthetic fixture's serialized three-document size increases from 220,079
to 742,886 UTF-8 bytes: the event log stays 220,036 bytes, preferences 36 bytes,
and the display/checkpoint cache is 522,814 bytes. Historical cards require their
reconstructed display projections to avoid folding old events on every read.
No application-level compression is added. Whole-document host writes and their
write amplification remain; these results do **not** establish lower database
write latency or compressed disk usage. Re-running the 19-chat offline conversion
produces 182,670 bytes (log 76,229 + preferences 684 + cache 105,757); production
chat data is not re-imported by this follow-up.

`node scripts/verify-scroll-browser.mjs` drives real scroll events at 390px and
900px with 72 cards across two message containers and all 11 affinities. It checks
animation pause/resume, heavy-work deferral both with and without an outstanding
model call, and one committed batch for three coalesced intents. The model and
host bridge are fixtures; no physical-device FPS or live-model behavior is claimed.

`node scripts/verify-style-rules.mjs` parses generated styles with Chromium CSSOM.
The stage-5 split (`f131ad2` to `869ffa5`) preserves rule text **and order**, including
1,385 main-sheet rule objects and nested rules within their serialized text. The
current main sheet has 1,394 objects, retaining every original rule and adding
search and scroll-pause rules. The separate shell, inline, controls, skins, badge,
codex, scroll, effects and settings components are also compared.

The shared-panel browser check now records 12 filter, tab and detail samples per
mode/width, including two animation frames after each interaction. In this small
two-item fixture, filter medians were about 33 ms, main tabs 67–74 ms, and details
34–52 ms. These include the explicit frame waits and are not input-latency or FPS
claims. Radio filtering preserves the body HTML; main section tabs still use the
shared controller. Raw data is in `artifacts/performance/` and
`artifacts/shared-panel/results.json`; the Node VM benchmark is separate from the
Chromium measurements and must not be presented as browser timing.

This completion fix for step 6 was deployed as a same-version 2.2.0 replacement.
The deployer backed up the previous plugin to
`/volume2/risu/backups/itemx2-production/production-itemx-20260919-083403.json`.
The canonical setting value, `system.plugins.script`, and local bundle all match
SHA-256 `5fb51e18ccbd790bc9ed40ab427d5c039d78c2f1186b33224e75d664200967d1`.
Unrelated settings/plugin rows were verified unchanged. The verified production
app mapping remains `LIVE-SERVER`, alias `risu-haejeok-trial-app`, port 16003; its
local HTTP endpoint returned 200. No chat migration or Git push was performed.
