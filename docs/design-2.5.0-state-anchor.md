# ITEMX 2.5.0 — state entries

Status: implemented 2026-10-04 (worktree `itemx24-fix`, not released). Eight review rounds with GPT Astra; the last found no remaining P1.
Owner decisions: ITEMX-only change; no backward-compatibility weight beyond reading the 2.4 document; version 2.5.0;
deleting or editing an *older* message no longer reverts its items ("the past is settled").

## Problem

2.4 folded every ledger event over the chat's current messages from the first one. Haejeok RisuAI keeps only a window
of the newest messages (`chatLoadInitialPages`, default 12, low-spec 4, min 1; full load before generation; trim to
200 / 100 Capacitor / 40 low-spec after it). `getChatFromIndex()` returns the window, so unloaded messages counted as
deleted and their items vanished (Hogwarts: 5 → 1). A chat copy regenerates message ids and lost everything.

## Model

Nothing new is written into message text; the output hook is unchanged. At **commit** (response commit, aux recovery,
raw-tag repair — writes that already existed) ITEMX stores a **state entry** for each message with committed card
anchors: the full state after it. An entry is found again by the message's exact, ordered card-anchor list (text,
survives copies).

Ledger `scriptstate['itemx:ledger']`, schema v2:

| field | content |
|---|---|
| `events` | key → `{ c, d, e, r?, s, v?, p? }`; `v`/`p` card view and previous frozen at commit |
| `manual` | drawer edits `{ id, a, d, e, l, r, s, t }` |
| `states` | newest 8 entries `{ k, c, i, w, t, m, x, b }` — keys, chat id, absolute index, send time, turn, manual seqs included, state `{ item, codex, notes }`, and `b = { x, m, t }` the state the message was built on (`b.x` omitted when equal to the previous entry's `x`) |
| `root` | backup restore `{ x, m, w, i, t }` or null |
| `seq`, `prefs`, `lore`, `guards`, `restoredThrough` | as 2.4 |

`notes` carry per entity the latest `{ previous, review, evidence: { key, chatId } }` for drawer annotations and
single-item repair. A v1 document is read with `states = []`, `root = null` (its restore base is dropped).

## Fold (`store/replay.js`)

- Entry validity, newest first: **present** (a loaded message has exactly its keys) → base at that message;
  **unloaded** (absent, send time before the first loaded message's; index fallback without times) → base before the
  window; else skip. No entry → `root`, else empty, from the first loaded message.
- After the base: each message's card anchors (committed rows or pending records), with manual rows placed after their
  message if loaded, else by creation time among send times (no send times at all: last).
- Turns: base turn plus completed turns after it; a window starting with a reply counts it; unloaded gaps are estimated
  at two messages per turn.
- `grounded` = base, root, or fully loaded. Ungrounded folds never become entries; backup export refuses them.

## Commit (`restampEntries`, `stampFrom`)

- Recompute entries from the changed message on (only the newest 8 tagged messages are computed; the first computed
  fold still freezes every earlier card).
- An absent entry's **owner** is the loaded message holding any of its keys, else the only message with its send
  time, else the message with its id. Message X is rebuilt on its owner entry's base `b` with its current cards and
  manual rows, so a continue, a recovery or an edit — even one removing every card (X then gets a key-less entry found
  by send time or id) — never loses what deleted older messages left behind. Without such an entry X replays from the
  previous valid entry.
- `stampStart` is the single decision for a commit pass without new cards: the minimum of changed owners with a base,
  unowned or proven-gone entries (purge), and the newest card message lacking an entry when grounded. Restamping from
  it clears every condition, so a pass writes at most once.
- Entries are purged only when **proven gone**: fully loaded, or send time inside the loaded window. An absence judged
  by a possibly stale index is kept.
- Frozen `v`/`p` are updated from the replay; a replayed card whose view is null loses them.

## Accepted limits

- Window of 1 right after deleting the newest reply, before any generation.
- Group chats: unloaded-turn estimate; two members emitting the same first event can share a card key (as 2.4).
- Chats without any send times: an orphan manual row runs last in a replay but is fixed into the next entry.
- Recovered output of a non-selected chat (local host patch) is processed against the selected chat (as 2.4).
- Deleting more than 8 tagged replies back falls to the window replay.

## Tests

`tests/state-entries.test.mjs` (windows 12/4/1, reroll, delete newest/older, edit newest, copy, manual order, partial
window, frozen cards, commit stamping and no repeated writes, restore root, and each review repro),
`tests/history.test.mjs` (entry projection keeps history ages), `tests/streaming-equivalence.test.mjs` (output text,
events and display equal to the 2.4 baseline).
