---
id: 2026-09-14-per-challenge-continue
title: Save every single-player game on its own slot, and continue each from its row
kind: ui
status: proposed
---

# Save every single-player game on its own slot, and continue each from its row

## What

A player who leaves Tuppi-Rummikub, the Tuppi Race or Traditional Tuppi can come back to it. Each
of the three writes a snapshot of its own — at the same screen boundaries the roguelike already
uses, under a key of its own — so the **Single player** screen draws a **Continue** on every row
that has a game waiting, beside the roguelike's own Continue above the list. A row with nothing
saved draws **Play** by itself. Where a row has a game waiting, **Play** asks before it destroys
it, the way the roguelike's New game asks.

Today no challenge is written at all: `GameProvider` returns before `writeRun` whenever
`state.challenge !== null`, `parked` is dropped from every snapshot, and a reload during a
challenge loses it. After this, a reload still lands on the start menu over the main run — the boot
path is unchanged — and the challenge waits on its row, one click away, at the last deal it
finished.

No tuppi rule, no score, no balance figure and no byte on the wire changes. `SAVE_VERSION` stays
**3**, `NET_VERSION` stays **6**, and **no migration is written** — see the criterion that says why
the project's time-boxed-migration preference is not triggered here.

## Prior specs

- **Reverses one delivered decision of `2026-09-06-tuppi-rummikub-challenge`, and this reading
  wins.** That spec's _"a challenge run itself is never saved, so reloading the page during a
  challenge loses the challenge"_ is withdrawn, and its Out of scope line _"Saving or resuming a
  challenge run, and bumping `SAVE_VERSION`"_ is exactly the item this spec picks up. What that
  spec decided and this one **keeps**: `parked` stays in `Dropped` and `DROPPED_KEYS`, so a
  snapshot still can never nest; the main run's snapshot still stands untouched while a challenge
  is played; and `leaveChallenge` still gives the parked run back whole, mid-deal included.
- **Extends `2026-09-04-resume-a-run-after-a-refresh` (delivered) rather than contradicting it.**
  Its rule — _a snapshot at screen boundaries, so a reload rewinds to the last screen and never
  into the middle of a trick_ — is applied verbatim to the three challenges, and its _"an old save
  is discarded, not upgraded"_ line is left standing because nothing here discards anything.
- **Overlaps `2026-09-07-drop-dead-save-upgrade` and triggers none of it.** That spec left the save
  path with one rule and no exception. This change alters no field of `SavedRun`, so there is no
  shape change, no bump, and no migration to time-box; `save.ts` still holds no upgrade function.
- **Amends one delivered criterion of `2026-09-14-single-player-separate-from-multiplayer`** (this
  branch's parent, on `main`). Its criterion that each row's Play dispatches _"exactly
  `{ type: "startChallenge", id }` with **no** `seats`"_ still holds for a row with nothing saved;
  on a row that has a game waiting the same dispatch now sits behind an in-row confirmation. Its
  Continue, its `.singlerun` block, its `btn.newGame` and `restart` modal route, its footer, and its
  _"that screen knows nothing about the network"_ grep are all untouched — the screen still reads
  no session state, and the three new reads go through `game/storage.ts` like the board reads it
  already makes.
- **Overlaps `2026-09-12-fix-leave-challenge-desync` and has to argue past its literal list.** That
  spec pinned `HASH_MOVERS` in `protocol.test.ts` at length **one** _"so a second candidate has to
  argue rather than cite precedent"_. This spec adds the second, `resumeGame`, and the argument is
  written out below rather than left as a precedent citation. `leaveChallenge` itself keeps every
  property that spec gave it: still `local`, still guarded by `MoveButton`, still hung up in the
  same click on the two result screens.
- **Overlaps `2026-09-09-start-menu-solo-run` and `2026-09-13-lobby-first-solo-and-viewer` in
  Continue's meaning, and keeps it.** Continue for the roguelike still means _resume the solo
  roguelike wherever it is_: `closeMenu` when you are in it, `leaveChallenge` then `closeMenu` when
  it is parked. A third branch is added underneath — the snapshot on disk — for the case those
  specs could not reach, a challenge resumed after a reload with nothing parked.
- **Not already delivered.** `grep -n "challenge" src/hooks/GameContext.tsx` finds the early-return
  branch that writes a board row and nothing else; `grep -rn "tupatro-run" src/game/storage.ts`
  finds one key; `src/game/actions.ts` has no `resumeGame`; `SinglePlayer.tsx` reads two board
  functions and no save.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

- [ ] **Four slots, one door, and no key read by two parsers.** `src/game/storage.ts` gains
      `challengeRunKey(id: ChallengeId)` — which builds `tupatro-run-<id>-v1` — plus
      `readChallengeRun(id)`,
      `writeChallengeRun(id, s)` and `clearChallengeRun(id)`, each guarded by try/catch like every
      other call there; `readRun` / `writeRun` / `clearRun` and `RUN_KEY` are untouched. A case in
      `storage`'s own tests (or `save.test.ts`) asserts the three save keys
      (`tupatro-run-rummikub-v1`, `tupatro-run-race-v1`, `tupatro-run-tuppi-v1`) are distinct from
      all five board keys (`tupatro-scores-v1`, `tupatro-challenge-rummikub-v1`,
      `tupatro-challenge-race-v1` as `readChallengeScores` would build it, `tupatro-race-v1`,
      `tupatro-tuppi-v1`) and that `readChallengeScores(id)` and `readChallengeRun(id)` never read
      the same string. `invariants.test.ts`'s pinned `removeItem` list grows from `["RUN_KEY"]` to
      exactly two entries — the run key and `challengeRunKey(id)` — both inside `storage.ts`, with
      its existing `clearRun` regex assertion unchanged and a comment saying a board key is still
      never removed.
- [ ] **Written at the same boundaries as the main run, on a solo board, and never in a session.**
      `GameProvider`'s effect keeps `if (!screen) return;` and `if (net.live) return;` ahead of
      everything and keeps the challenge branch's `if (state.menu !== null) return;`. Inside that
      branch: on `raceover` and on `challengeover` it calls `clearChallengeRun(state.challenge)`
      before filing the board row exactly as it files it today; otherwise it calls
      `writeChallengeRun(state.challenge, dehydrate(state))`. Both the write and the clear are
      gated on `soloBoard(state)` — exactly one seat marked `"human"`. Cases in
      `GameContext.test.tsx` assert, for a rummikub state and for a race state: a `dealend` screen
      writes the mode's key and leaves the other three keys and `tupatro-run-v1` untouched; a state
      with `screen: null` writes nothing; a state with `menu: "start"` writes nothing; a state with
      `net.live` writes nothing on any of the four keys; a two-human board writes nothing and
      clears nothing; and a `challengeover` / `raceover` state clears that mode's key and still
      files its board row.
- [ ] **`SAVE_VERSION` stays 3 and no migration is written, and the spec says why that is not a
      discard.** `SavedRun`'s shape does not change: `challenge`, `table`, `layHands`, `layTurn`,
      `layNo`, `layPassed`, `layScores`, `raceDeal`, `raceBase` and `raceScores` are already carried
      by `dehydrate`'s rest-spread, and `parked` stays in `Dropped` and `DROPPED_KEYS`. No run in
      flight is therefore thrown away — a v3 `tupatro-run-v1` payload loads unchanged and the three
      new keys start empty — so the project's recorded preference for a short, time-boxed migration
      over a discard has nothing to buy here. `save.test.ts`'s `it.each([0, 1, 2, 4, 99])` version
      gate is unchanged, `grep -n "upgrade" src/game/save.ts` finds nothing, and the header comment
      records this as a **fourth deliberate non-bump**, of the mildest kind: no field moved, none
      was removed, and none is newly read positionally.
- [ ] **The cards survive the round trip or the save is refused whole.** `cardOk` in `save.ts` is
      strengthened from "the enhancement is known" to: `s` is one of `SUITS`, `r` is a number, `id`
      is a string, `uid` is a string, and `enh` is null, absent or known. `rehydrate` additionally
      rejects when `table` is not an array whose every element passes `cardsOk`, when `layHands` is
      not an array of exactly two that each pass `cardsOk`, and when `challenge` is neither null nor
      an id in `CHALLENGES` — each a whole rejection returning `null`, never a partial load, the
      same rule the `economies` array already has. Named cases in `save.test.ts` cover all five
      rejections, plus a round trip of a mid-Rummikub state: every row of `table`, both `layHands`
      and every `uid` in them are identical after `dehydrate` → `rehydrate`, `uidSeq` is unchanged,
      and a case asserts the stricter `cardOk` rejects **no** snapshot `dehydrate` produces (every
      minted card carries all four fields). Nothing deeper is validated: the existing comment's
      rule — the version and the content ids, not coherence — still stands, so `raceScores` and the
      counts are trusted as before.
- [ ] **One new action, `resumeGame`, and the reducer is its authority.**
      `src/game/actions.ts` gains `{ type: "resumeGame"; saved: unknown }` — `unknown` because it is
      the same payload `rehydrate` takes and it never crosses the wire. Its case sits in
      `gameReducer`'s produce callback beside `newRun`, `startChallenge` and `leaveChallenge`,
      reading `original(d) ?? d`, and it: rehydrates with `prev.bestAnte`; **returns `prev`
      unchanged** when the payload does not rehydrate, silently, because the screen never offers a
      Continue for a save that does not; sets `menu: null`; and sets `parked` by exactly
      `startChallenge`'s rule — `prev.challenge !== null ? prev.parked : dehydrate(prev)` when the
      resumed game is a challenge, and `null` when it is the roguelike. Cases in `reducer.test.ts`
      assert each of those four, including that resuming a challenge from the roguelike parks the
      **live** state (mid-deal, not the disk copy) and that resuming a second challenge carries the
      park across rather than nesting it.
- [ ] **The second hash-moving `local` action, argued rather than cited.** `SCOPE` classifies
      `resumeGame` as `local`, so `guestMay` refuses it for every seat including a chair-holder, and
      `protocol.test.ts`'s `HASH_MOVERS` becomes `["leaveChallenge", "resumeGame"]` with its
      length assertion changed from one to two and a comment carrying this action's own argument:
      the game it restores is **this window's own localStorage**, a different game on every peer, so
      it could never be broadcast; and unlike `leaveChallenge` it does not hang the session up
      because it cannot be reached inside one — the start menu's Single player door is
      `disabled={net.live}` and returns early in its own handler, and every dispatch site is a
      `MoveButton`. `invariants.test.ts` pins the dispatch site list for `type: "resumeGame"` under
      `src/components/` at exactly `["src/components/screens/SinglePlayer.tsx"]`, with a comment
      saying that list is what makes the door load-bearing. `NET_VERSION` stays **6**: the wire
      shape is unchanged, `isAction` needs no case, and no reducer rule two peers must agree on
      moves, since the action is unreachable in a session.
- [ ] **Every row draws Play, and Continue when it has a game to return to.** In
      `SinglePlayer.tsx`, a mode row's Continue is drawn when `g.challenge === row.id` (dispatching
      `{ type: "closeMenu" }`, because you are in that game) or when
      `resumable(readChallengeRun(row.id), row.id, g.bestAnte)` is non-null (dispatching
      `{ type: "resumeGame", saved }` with the raw payload). The roguelike's Continue above the list
      keeps its two delivered branches and gains a third underneath them, in this precedence: in it
      (`closeMenu`), parked (`leaveChallenge` then `closeMenu`), then
      `resumable(readRun(), null, g.bestAnte)` (`resumeGame`) — parked wins over disk because it is
      at least as fresh, being taken at the click rather than at the last boundary. `resumable(raw,
id, bestAnte)` is a new export of `game/save.ts`: `rehydrate` plus two refusals — the
      payload's `challenge` must equal `id`, and the board must be `soloBoard` — so a race slot
      holding a rummikub payload and a save naming two humans both read as no save at all.
      `GameContext.tsx`'s `initialState` uses it for the boot read too. Render cases assert each
      branch's exact dispatch in both locales, and that a row whose slot is empty, whose payload is
      for another mode, or whose payload fails the version gate draws Play and no Continue.
- [ ] **A saved row says what is waiting on it, in one line.** Above the existing best-result line,
      a row with a Continue draws its position: `single.savedDeals` with `{deal}` and `{deals}` for
      Tuppi-Rummikub (`deals - dealsLeft` of `row.deals`), `single.savedMatch` with `{deal}`,
      `{us}` and `{them}` for the two match modes (`raceDeal`, and `raceScores` indexed
      `ownerTeam` first), and `single.savedRun` with `{ante}` for the roguelike. Every number goes
      through `fmt()`. The line is read from whatever that row's Continue would resume — the live
      state for the game you are in, the parked snapshot for a parked roguelike, the slot
      otherwise — so it can never describe a different game from the one the click leads to. A test
      seeds a rummikub slot at deal 3 of 4 and a race slot at deal 8 with known totals and asserts
      both lines in both locales.
- [ ] **Play on a row that has a game waiting asks first.** The row draws an in-row confirmation
      instead of its buttons — `single.replaceAsk` with `{name}`, a `MoveButton` carrying
      `btn.yesRestart` that dispatches exactly `{ type: "startChallenge", id: row.id }` with no
      `seats` and no `seed`, and an ordinary ghost `btn.cancel` that dismisses it. Which row is
      asking is component-local `useState<ChallengeId | null>` in `SinglePlayer.tsx`, never on
      `GameState` and so never in a save or on the wire, the same shape `SwapPanel`'s selected uid
      has. It is drawn **inside `li.chalrow`**, replacing that row's buttons, so no confirmation can
      end up under the overlay's fold. A row with no Continue starts its game on the first click,
      unchanged. Render cases assert both paths, and that cancelling dispatches nothing at all.
- [ ] **Text.** `single.savedRun`, `single.savedDeals`, `single.savedMatch` and `single.replaceAsk`
      exist in `fi.ts` and `en.ts` with matching placeholder sets; no other key is added and none is
      removed; `btn.play`, `btn.continue`, `btn.yesRestart` and `btn.cancel` are reused rather than
      duplicated. `i18n.test.ts`'s parity, placeholder, list-length and stray-Finnish cases pass,
      and `render.test.tsx`'s sweep finds no leaked key, no `undefined`, no `NaN` and no Finnish
      word in English output on the single-player screen with all four slots seeded.
- [ ] **A table draws none of it, and a networked match leaves nothing behind on any peer.**
      `render.test.tsx`'s table sweep for `menu: "single"` runs with all four slots seeded and, by
      name rather than through `onlyLocal` — which filters `local` away and so cannot see
      `resumeGame` — asserts no button carries `btn.continue` or `btn.play`, and that clicking
      everything dispatches neither `resumeGame` nor `startChallenge`. A `GameContext.test.tsx` case
      drives a networked race to `raceover` with `net.live` true and asserts all four save keys are
      byte-identical to what was there before, on the host's window and on a guest's.
- [ ] **Documentation and gates.** `CLAUDE.md`'s challenge section (_"A challenge is **never
      saved**"_), its persistence Known gap (_"a reload during a challenge loses the challenge"_),
      its `MoveButton` / `leaveChallenge` notes and its named list of components that read a board
      while they render; `README.md`'s challenge and persistence paragraphs; `save.ts`'s
      `SAVE_VERSION` and `Dropped` comments; and `types.ts`'s _"A challenge is not saved, so none of
      this reaches the snapshot except `parked`"_ comment all say what is true after this change,
      and the test-count lines match what `npm test` prints. All five gates pass: `npm run lint`,
      `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`,
      `npm run build`. One browser reading is recorded in the pull request at **1280x800**,
      **1280x500** and **390x844**: the single-player screen with all four games saved — four
      Continues, three Plays, the three position lines, Back and SCORES all reachable by scrolling
      `.overlay` and every one of them hit-testable at 500 px height — and one round trip of start a
      race, play a deal, open the menu, Continue Tuppi-Rummikub, come back and Continue the race at
      the deal it reached.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"A row with nothing saved draws Play alone" is read as "draws Play by itself", not as a button
  labelled _Play alone_.** Every row keeps the delivered `btn.play` label in both states; what
  changes is whether a Continue is drawn beside it. The following sentence about starting a new
  game on a row that already has one is what settles it: Play has to be present in both states for
  that sentence to mean anything. **If the reviewer meant a new label, it is one key.**
- **Booting still lands on the main run, and a challenge is resumed by a click.** `initialState`
  reads `tupatro-run-v1` and nothing else, so a reload mid-laydown or mid-deal opens the start menu
  over the roguelike exactly as today, and the challenge waits on its row at the last deal it
  finished. The alternative — a "last played" pointer that boots into the challenge — needs a fifth
  key and a decision about what the start menu's return button then says, and is left out.
- **The granularity is the main run's, unchanged: screen boundaries only.** A challenge writes at
  the `dealend` between deals and nowhere else, so a reload mid-trick, mid-declaration or
  mid-laydown rewinds to the previous deal's end, and **a challenge abandoned during its first deal
  has no save at all** — its row draws Play by itself. That is the same trade the roguelike already
  makes, with the same consequence that a reload is an undo for a bad deal, and the alternative
  (writing mid-deal) is refused for the reason the delivered comment gives.
- **Walking out of a game writes nothing on the way out; the slot already holds the last
  boundary.** Clicking Continue on another row happens with `g.menu` set, where nothing is written,
  so the game you leave reverts to its last `dealend` when you come back. The roguelike is the one
  exception, and it is the delivered one: `startChallenge` and now `resumeGame` park it **whole**
  with `dehydrate(prev)`, mid-deal included.
- **`parked` stays a single slot, stays out of every snapshot, and never nests.** A resumed
  challenge therefore has `parked: null`, and the roguelike is reached from its own slot instead —
  which is the third branch of the roguelike row's Continue. The consequence, stated rather than
  hidden: the two result screens' **Back to your run** is unchanged, so on a challenge resumed
  after a reload it lands on the start menu with a fresh unstarted run, and the roguelike is one
  further click away on its own row. Nothing is lost; it is one click, and fixing it would put a
  second `resumeGame` dispatch site inside a session's reach.
- **A finished game leaves a board row and no Continue.** `challengeover` and `raceover` clear the
  mode's slot, mirroring `clearRun()` on `gameover` / `victory`. Neither ever removes a board key.
- **Continue on the row of the game you are already in means `closeMenu`**, so the row is never a
  lie about which game the click leads to, and the same three-branch shape covers all four rows.
- **The confirmation is component-local and drawn in the row, not a new `Modal` member.** `Modal` is
  a bare string union with nowhere to carry which row is asking, so a modal would split the
  question across `GameState` and component state; in-row keeps it in one place and out of the
  save, the sweep and the wire. The roguelike's New game keeps its `restart` modal and its
  `runStarted` test — a deliberate asymmetry between the row above the list and the rows in it,
  left rather than unified because unifying it moves a delivered criterion for no player-visible
  gain.
- **The key names are invented here**: `tupatro-run-<id>-v1`, chosen to read as "the run of mode
  `<id>`" and deliberately not `tupatro-challenge-<id>-v1`, which is the board's. The three slots
  share `SAVE_VERSION` with the main run, so a future bump discards all four together.
- **`resumable` refuses a save whose board is not one human**, and `initialState` uses it for the
  main run too. That closes at read time a hole the main run's write side still has — a hosted
  roguelike that hangs up on a screen can write a two-human snapshot — without touching the main
  run's write conditions and the delivered tests around them.
- **The position line's content is chosen here**: the deal reached for all three challenges, both
  pairs' match totals for the two match modes with the run owner's pair first, and the ante for the
  roguelike. The score so far is deliberately **not** shown for Tuppi-Rummikub, whose running total
  is a negative-going laydown number that means nothing out of context.
- **`resumeGame` is `local` and makes the exception list two.** The alternative — `flow` — would let
  `guestMay` admit a stranger's snapshot through `req`, since `isAction` accepts any type present in
  `SCOPE`; that is a worse trade than arguing for a second name on a pinned list.

## Touch points

The files and functions this is expected to change. All real.

- `src/game/storage.ts` — `challengeRunKey`, `readChallengeRun`, `writeChallengeRun`,
  `clearChallengeRun`; the comment saying which keys are saves and which are boards.
- `src/game/save.ts` — `cardOk` strengthened; `rehydrate`'s `table`, `layHands` and `challenge`
  rejections; the new `resumable` export; the `SAVE_VERSION` comment's fourth non-bump.
- `src/game/actions.ts` — the `resumeGame` member and its comment.
- `src/game/reducer.ts` — `resumeGame`, beside `startChallenge` and `leaveChallenge` in the produce
  callback.
- `src/game/rules.ts` — `soloBoard(g)`, beside `ownerSeat` / `ownerTeam`.
- `src/game/types.ts` — the challenge block's comment: these fields now do reach a snapshot.
- `src/net/protocol.ts` — `SCOPE`'s new entry and the comment on the local block.
- `src/hooks/GameContext.tsx` — the challenge branch of the save effect; `initialState` via
  `resumable`.
- `src/components/screens/SinglePlayer.tsx` — the roguelike Continue's third branch, each row's
  Continue, the position lines, the in-row confirmation and its `useState`.
- `src/index.css` — the row's confirmation line and the position line, inside the existing
  hand-formatted blocks.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the four new keys.
- `src/game/save.test.ts` — the five rejections, the mid-Rummikub round trip, `resumable`.
- `src/game/reducer.test.ts` — `resumeGame`'s four behaviours.
- `src/hooks/GameContext.test.tsx` — when each slot is written, cleared and left alone.
- `src/net/protocol.test.ts` — `HASH_MOVERS` of two, `resumeGame`'s scope and `guestMay`.
- `src/test/invariants.test.ts` — the `removeItem` list, the `resumeGame` dispatch-site list.
- `src/test/render.test.tsx` — the rows' two states, the confirmation, the table sweep by name.
- `src/components/screens/Menu.test.tsx` — the single-player screen's Continue set.
- `README.md`, `CLAUDE.md` — the challenge is saved now; the persistence gap is rewritten.

## Out of scope

- **Any tuppi rule, any score, any balance figure and any `GameState` field.**
  `src/game/{rules,scoring,ai,laydown,points,race}.ts` gain nothing but `soloBoard`, and no literal
  in `seats.test.ts` may move.
- **Booting into the game you last played**, and any "last played" pointer or fifth key.
- **Finer save granularity**: no mid-deal, mid-trick or mid-laydown snapshot, for either the main
  run or a challenge.
- **The two result screens' Back to your run**, which keeps dispatching `leaveChallenge` and hanging
  the session up, and lands on a fresh run when nothing is parked.
- **The main run's write conditions.** No `soloBoard` guard is added to the `tupatro-run-v1` branch;
  the read-side refusal in `resumable` is what this spec does about it.
- **Saving a networked game, and filing a board row for one.** Both stay refused, on every peer.
- **Multi-human challenge saves**, and the multi-human laydown they would need.
- **Migrating anything**, a per-slot save version, and any `SAVE_VERSION` or `NET_VERSION` bump.
- **The protocol**: `hashState`, `parseMsg`, `guestMay`'s body, every `NetMsg` shape, the
  signalling codec and the QR encoder.
- **Accessibility.** No ARIA roles, labels or focus management beyond what the new buttons inherit;
  the rail's focus-order gap stands.
