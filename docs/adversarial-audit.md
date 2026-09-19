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
