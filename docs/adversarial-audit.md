# ITEMX v2.3.0 adversarial audit

Scope: `024e910..f289864`, eight follow-up commits and the original redesign. Functional VM tests are not timing measurements. Physical Android/iOS behavior is not inferred from desktop Chromium.

## 1. Per-job chat cache — confirmed data-loss defect

Before the fix, `tests/chat-concurrency.test.mjs` failed both same-job and `external()` cases: a host append disappeared (2 messages became 1). A third case demonstrated an unchecked write after a fresh read. Queue tokens survive external model waits (up to 90 seconds); the host is not governed by this queue.

Reads now always cross the host boundary. Each returned object has immutable raw-read provenance in a WeakMap. Every write (including cleanup) names its source read, detaches its proposal synchronously, reads the host again, and rejects observed changes without writing. There is no retry of stale proposals. Caller mutation and unrelated scriptstate changes are preserved by this check.

**Limit:** official API v3 only supplies whole-chat get/set, not atomic CAS. The final read-to-set RPC interval remains a host race. This is optimistic conflict detection, not a claim of complete transactional isolation. The live b7085 implementation snapshots reads and assigns `char.chats[chatIndex] = chat` on writes (`v3.svelte.ts:1134–1153`).

## 2. Shallow persist — no independent race in synchronous capture

`capture()` is synchronous and only reads messages. API bridge `factory.ts:249–266` serializes arguments and calls `postMessage` synchronously in the Promise executor, so the original save path cloned the message at submission, before a caller could mutate it after return. `persist()` alone intentionally returns a shared array; it is not a detached snapshot API. The new asynchronous conflict check detaches the proposal before awaiting, with regression coverage. No claim that shared references themselves make five synchronous capture reads concurrent.

## 3. Replay memo — confirmed invalid key

Replay consumes more than message count and endpoints: `capture()` scans full transport markers in all bodies and DTO events; replay derives history identity from intermediate `chatId`s. Three reproduction tests failed for changed body, replaced middle identity with unchanged count/endpoints, and newly added DTO events. The key now serializes exact log/cache/DTO inputs and every message ID/text. It does not use a collision-prone hash or mutable object identity. Unrelated scriptstate remains outside the projection memo and passes through hydrate.


## 4. Scroll governor — confirmed activation and teardown defects

`continueBodyScrollEffects()` scheduled the 80 ms start timer, then `endBodyScrollEffects(220)` immediately cleared it. Both wheel and touch failed deterministic timer tests. Real Chromium also timed out waiting for suppression. Short native `scrollend` increments exposed a second debounce starvation case. Actual scroll now activates pause immediately; pointerdown retains its tap debounce. Continued scrolling preserves the pending stop policy. Late events after `hostState.unloading` cannot arm timers.

`clearScrollTimers()` is called on context reset, browser resume and unload. Clearing a pending start cannot reactivate the old context (tested). `wake()` is safe outside the queue: `pump()` synchronously checks `active` and `closed`; it does not admit a second owner. SafeElement class calls are synchronous host DOM operations reached through FIFO postMessage requests, not concurrent JS mutations of shared state.

The 390/900 px Chromium fixture covers 72 cards, two chat containers, all 11 affinities and a threat-ring card: 1,734 running animations become 1,734 paused, with zero running while scrolling. They resume afterward. Heavy calls during scroll: **0**; three duplicate committed requests become one batch; scroll end completes while the model promise is still suspended. See `artifacts/performance/scroll.json`. This is browser behavior, not a physical-phone FPS claim.

## 5. Light post-scroll pass — confirmed dropped refresh, no proven permanent loss

A pending full `hostSyncTimer` was replaced by a light pass when scrolling stopped. The reproduction observed zero full refreshes instead of one. Full/light intents now have distinct queue timer keys, so the full refresh survives.

There is no permanent-loss path solely from skipping the closed drawer while the host and queue continue responding: committed-output sync independently rebuilds and ensures the drawer; legacy recovery retries after 1.8 seconds; the remount watchdog checks after 10 seconds (1.2 seconds without an observer); catch-up runs at 4.5 seconds without a listener or 45 seconds with one. `repairCommittedTransport()` precedes the auxiliary dedup guard. These are scheduling intervals, not hard latency guarantees during a suspended job or host failure. The old light/full collision could delay visible updates until those paths ran.

## 6. Removing body content-visibility — justified stability tradeoff, higher initial work

No functional defect in retaining `contain:layout paint style` was found. Removing `content-visibility` does increase initial layout work. A fresh Chromium 149 fixture (390x844, 120 real cards, FX disabled to isolate layout, three runs) measured:

| Body rule | Initial layout range | Cumulative document-height change while scrolling |
| --- | ---: | ---: |
| Current contain only | 326–385 ms | 0 px |
| Prior auto + 520 px estimate | 153–156 ms | 8,205 px |
| Auto + measured 273.36 px first card | 424–578 ms including initial measurement | 66 px |

`contain-intrinsic-size` estimates the content box, whereas this simple measured alternative uses the border-box height; even equal cards therefore retained an offset. Variable text, fonts and expanded details further prevent one global constant from being exact. A measured-per-card solution must include its measurement and invalidation cost. These results establish the height-estimation mechanism and its initial-work tradeoff; they **do not establish that this was the user's exact mobile flicker cause**, nor prove that auto is always slower. Keep the current body rule; bounded panel tiles still use auto. No FX/style layers were removed by this audit. Final data: `artifacts/performance/card-layout-audit.json`.

An initial FX-enabled stress attempt exhausted the browser container's temporary shared-memory backing and was excluded. The final layout experiment ran separately with animations disabled; real FX preservation is tested by the scroll fixture above.

## 7. Whole-chat writes — confirmed merge opportunity, fixed

The reported 12 locations include 11 operations plus the runtime API wrapper; they do not mean 12 writes per response.

| Path | Before | After | Evidence |
| --- | ---: | ---: | --- |
| process/output/afterRequest transformation before host commit | 0 | 0 | `response-write-count.test.mjs` |
| Main transport compaction, without lore changes | 1 | 1 | same executable test |
| Main transport plus new lore enrichment | 2 | **1** | reproduction failed with 2; merged case asserts stored enrichment |
| Repeated sync for the same committed response | 0 additional | 0 additional | same executable test |
| Auxiliary success, rejection, or NONE receipt | 1 | 1 | `aux-stability.test.mjs`; exclusive branches |
| Auxiliary success plus new lore enrichment | up to 2 | 1 | same enrichment helper on the auxiliary success write |
| Main repair followed by a necessary auxiliary model completion | up to 3 with lore | up to 2 with lore | two durability boundaries separated by the model wait |

`enrichPendingChat()` computes optional derived lore before the authoritative write and does not write separately. Optional lore failure cannot prevent the event commit. A later standalone lore scan still writes once if entries have actually changed in the meantime. Main transport cannot safely be held uncommitted for the auxiliary model's 90-second timeout merely to combine those two distinct commits.

Manual operations, cleanup, explicit compaction, backup restore, preference changes and resume-only reference repair are not automatic per-response writes. Every one uses the verified writer. A read-only rebuild now consumes the snapshot just fetched by `context()` instead of doing a second get (2 → 1); this is a single snapshot use, not a cache served to future callers. Actual writes retain a new conflict-check read.

## 8. Original redesign — real remaining costs and one queue defect

**Portraits:** `external()` previously occurred only around auxiliary model I/O. A held `readImage` promise prevented a queued output hook from running; the regression reproduced this before the fix. Portrait reads now yield once for the entire batch of at most four concurrent workers. The external region uses local maps only; cache mutation resumes under queue ownership. One five-second deadline covers the whole optional image batch, including retries. Cancellation prevents new retries, and a context change discards results. Unresolved host RPCs cannot be physically aborted through the stock image API, but their late result cannot commit UI/cache state. Image/cache size caps are unchanged.

This remains a cooperative single-owner queue, not independent render lanes. Reentrant host hooks can run during image I/O; non-reentrant UI work still waits for the bounded image batch. CPU replay/render work also remains serial. The test establishes scheduling blockage and its removal for hooks, not a measured human-perception latency.

**Replay:** cache checkpoints are actually used. Native counters for 90/900/3,000 events give 0 event folds for unchanged cached persist, 1 for one appended event, and exactly N after cache loss. Nevertheless capture, sorting/prefix validation, checksum and serialization traverse the full history. A whole-string storage API also rewrites the log; append-only facts do not imply constant-time persistence.

The confirmed unnecessary cost was `itemxStorageFootprint()` calling `persist()` on every rebuild solely to display a size warning. It now counts existing canonical documents and markers directly, excluding hydrated DTO duplicates. Native Node 22 (ordinary Function compilation, three warmups, eight measured samples) reported at 3,000 events: size check **131.04 → 8.47 ms**, persist calls per size check **1 → 0**. Persist itself remained about **120 ms**; 900 events about **38 ms**. Timing varies with this NAS's load and must not be quoted as phone timing. The deterministic fold/call counts are the stronger evidence. See `artifacts/performance/adversarial-native.json`; no VM-context performance numbers were used.

**Live migration:** a repeatable-read, read-only Postgres snapshot contained 20 canonical chats (one more than the stated 19). All original 19 exist, and all **88 migrated authoritative rows** remain byte-semantically identical by ID. All 20 have log/prefs/cache and produce identical item/codex/payload projections with the cache removed. Four imported baselines consist of two preexisting checkpoints plus two v1 snapshots; the already folded pre-checkpoint history is not claimed to have been recovered. No binary messages required alternate decoding. Raw chats remain only in a mode-0600 backup, not in Git or public artifacts. `scripts/audit-live-storage.py` makes no database writes.

## 9. Placeholder rejection — confirmed false positives, fixed

A literal `-` item name with a concrete ID was rejected; so were names such as `Unknown`. Symbolic effect names with a substantive description were dropped by the string-pair parser. Active skill `...`, `?` and `unknown` costs/cooldowns became affirmative claims of no cost/no restriction.

Name rejection now requires template/missing identity evidence as well as a placeholder name. Concrete IDs preserve literal names; echoed all-placeholder templates are still rejected. Described symbolic effects survive. Unknown active costs/conditions use narrative-based unknown wording, while explicit NONE/없음 retains the existing no-cost contract. Ordinary one-letter Korean/Latin names and codex names were never length-rejected; tests also preserve those cases. Existing template tests were retargeted to actual template IDs rather than preserving the overbroad name ban.

## Additional search regression and validation

The header toggle introduced in `54aabe3` became unchecked after search confirmation rebuilt the panel, hiding the reset button. The browser test reproduced that failure. Confirmed nonempty queries now keep the toggle checked. The 390/900 px drawer and frame browser runs pass filtering without rewriting the body, search/clear, skill/detail navigation, settings and cleanup confirmation. See `artifacts/shared-panel/results.json` and adjacent screenshots.

Exact HTML comparison against `f289864` covers 16 nonempty panel combinations and all 11 affinity card markups. The historical `22fde72` render oracle also remains enabled. The intentional placeholder and active-search behavior changes have separate tests. Tests were added before fixes; stale-cache, replay-input, scroll, coalescing, symbolic-name, portrait-hook, footprint, search and lore-write reproductions all failed on the corresponding pre-fix code.

Final gate: `npm run build && ITEMX_SETTINGS_BROWSER=1 npm test` — **284 passed, 0 failed, 0 skipped**. The normally skipped settings browser case ran all 12 width/font/surface combinations. Browser fixtures use fresh headless instances and no production login or real-user profile.

## Release boundary

Data-loss fixes only were committed as `a07a430` and deployed as v2.3.0. Live SHA-256 was verified against the then-local bundle:

`9adabf3dd827e7282e5a841a4afc9c8567dfb26a2de6a7138dd7e1e67cc5b707`

Rollback backup: `/volume2/risu/backups/itemx2-production/production-itemx-20260919-124701.json`. The deployment checked both plugin storage projections and that unrelated plugin values were unchanged. Performance, scroll, search and placeholder fixes in the subsequent audit commit are **not deployed**, per the user's release condition. No push was performed. The remaining atomic-get/set limitation and linear log serialization cost are explicitly unresolved architectural limits, not hidden by passing tests.
