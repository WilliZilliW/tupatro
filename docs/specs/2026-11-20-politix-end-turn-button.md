---
id: 2026-11-20-politix-end-turn-button
title: Politix — keep the turn after a special-only play, and end it with End turn
kind: rule
status: proposed
source: Politix rule sheet (Touko Tahkokallio, Onni Games 2009), pp. 3–5, as recorded in 2026-11-03-add-politix-card-game-mode and 2026-11-04-rework-politix-three-parties (the primary PDF could not be fetched in this run)
---

# Politix — keep the turn after a special-only play, and end it with End turn

## What

Today every `pxPlay` ends the turn (`pxDoPlay` → `pxFinishTurn` in `src/game/reducer.ts`), so a
human who plays a burnout, a scandal or yesterday's news on its own loses the rest of the turn and
cannot follow it with a second special or with a take. After this spec, a **special-only play
leaves the seat in `pxturn`** with its updated hand, so it can play more specials, or a take; a
play that **takes voter cards still ends the turn**; and the turn otherwise ends only when the
player presses **End turn** (`pxPass`) — or Rest, if burnt out and nothing has been played yet.
The hand limit is still checked once, at the end of the turn. The game's AI is unchanged.

**Partly delivered already.** The button that dispatches `pxPass` is already labelled
**End turn** / **Lopeta vuoro** (`px.btn.pass` in `src/i18n/en.ts` / `fi.ts`, pinned by
`render.test.tsx`'s _"draws End turn and not Draw cards on the player's own turn"_, delivered by
`2026-11-06-politix-side-piles-refill-deck`). This spec does not relabel it; what is new is that
pressing it can follow a play.

**Contradicts a delivered criterion, on purpose.** `2026-11-06-politix-side-piles-refill-deck`
requires "a specials-only play that leaves eleven cards also parks in `pxdiscard`", and
`reducer.test.ts` pins it (_"also parks a human in pxdiscard after a specials-only play that leaves
eleven"_), as does the `// a specials-only play passes the turn` assertion in _"puts a scandal and
a burnout in front of an opposing seat, and news removes them"_. For a **human** seat this spec
wins: the special-only play no longer ends the turn, so the discard step moves to the End turn that
follows it. For an **AI** seat the old behaviour stands unchanged.

## Acceptance criteria

### The rule (reducer)

- [ ] **A special-only play keeps the turn for a human seat.** In `src/game/reducer.ts`, a `pxPlay`
      from a `"human"` seat that `pxResolve` accepts with no voter take (`cards` empty or `group`
      null — the branch at the top of `pxDoPlay`) applies the specials exactly as today (scandals,
      burnout, news removal, hand, discard pile) and then **does not** call `pxFinishTurn`:
      `d.phase` stays `"pxturn"`, `px.turn` is unchanged, `px.turnNo` and `px.turns` are unchanged,
      no seat draws, and `d.rngState` is unchanged. A `reducer.test.ts` case plays a scandal on its
      own, asserts all of that, then plays a burnout on its own in the same turn and asserts it is
      accepted and the turn is still seat 0's.
- [ ] **A take still ends the turn, and may follow specials.** After one or more special-only plays
      in the same turn, a `pxPlay` that takes voter cards is accepted by the same `pxResolve` and
      ends the turn exactly as a take does today (`pxRefill`, `pxFinishTurn`, the next seat draws).
      A specials-plus-take play in a single `pxPlay` behaves exactly as today. A `reducer.test.ts`
      case: scandal on its own, then a take → `px.turn` has moved on and `px.turns` for the seat's
      party went up by exactly **1** (one turn, not two).
- [ ] **The turn's state says whether a play has been made.** `PolitixState` in
      `src/game/types.ts` gains `playedThisTurn: boolean`. `pxSetup` in `src/game/politix.ts`
      initialises it `false`; a special-only play sets it `true`; `pxEndTurn` sets it `false`
      before the turn passes (so it is `false` whenever `pxBeginTurn` runs). No other field is added.
- [ ] **End turn is `pxPass`, and it works at any point of the turn.** The action, its `SCOPE`
      entry (`"seat"`), its `pxGate(d, p, "pxturn", "human")` guard and its `HASH_AFTER` entry are
      unchanged; no `Action` member is added or renamed. `pxPass` after a special-only play ends the
      turn through `pxFinishTurn`, so the hand limit runs there.
- [ ] **What `px.last` says.**
  - A special-only play writes `{ p, what: "play", group: null, n }` where `n` is the number of
    cards that left the hand **this turn so far**: the first such play writes its own
    `res.used.length`, each further special-only play in the same turn adds its own to the
    existing `n`.
  - `pxPass` with `playedThisTurn === false` writes `{ p, what: "pass", group: null, n: 0 }` exactly
    as today.
  - `pxPass` with `playedThisTurn === true` **leaves `px.last` as it is** (the `"play"` record), so
    the felt keeps saying "{who} played special cards." rather than the false "{who} ended the turn
    without playing."
  - A take after specials writes the `"take"` record as today, replacing the `"play"` one.
  - `reducer.test.ts` asserts each of the four.
- [ ] **The hand limit is checked at End turn, not after a special-only play.** The existing case
      _"also parks a human in pxdiscard after a specials-only play that leaves eleven"_ is rewritten:
      the special-only play from a twelve-card hand leaves eleven cards with `phase === "pxturn"`;
      the following `pxPass` enters `pxdiscard` with `px.turn` still 0; `pxDiscard` of one card ends
      the turn. The test name changes to say so.
- [ ] **Rest is refused once something has been played this turn.** `pxRest` from a seat with
      `playedThisTurn === true` returns the state unchanged (silent, the same shape as the other
      guards; no new toast key), even with a burnout in front of it. With `playedThisTurn === false`
      Rest behaves exactly as today, including `toast.pxNoBurnout`. A `reducer.test.ts` case covers
      both, with the burnout present in the refused case so the test would fail without the rule.
- [ ] **The AI is unchanged.** `pxMove` in `src/game/politix.ts` is byte-identical. `aiPolitix`'s
      special-only play still ends the AI seat's turn in the same transition (the AI never makes a
      second play in a turn). A `reducer.test.ts` case dispatches `aiPolitix` for an AI seat whose
      `pxMove` answer is a special-only play and asserts the turn has passed.
- [ ] **The headless drivers mirror the AI, so no measurement or golden moves.** `playPolitix` in
      `src/test/bot.ts` and the local `playPolitix` helper in `reducer.test.ts` dispatch `pxPass`
      for the seat immediately after any `pxMove` answer that was a special-only `pxPlay` which left
      the phase at `pxturn` for that seat — making the human seat's sequence produce the same state
      the AI path produces in one step. Then, **unedited**: `reducer.test.ts`'s _"plays a whole
      single-human game for a fixed seed to the pinned result"_ (`turnNo` 24, the `collected`
      literal, `turns` 8/8/8, `rngState` -1103298496); `politix.test.ts`'s replay case, settle case
      and the three _measured_ cases. README's Politix balance tables are not touched.
- [ ] **The existing scandal/burnout/news case is edited, not deleted.** In _"puts a scandal and a
      burnout in front of an opposing seat, and news removes them"_ the line
      `expect(px(s).turn).toBe(1); // a specials-only play passes the turn` becomes an assertion
      that the turn is still 0, and the hand-the-turn-back fixture step is dropped or kept as the
      implementer finds clearer; every other assertion in it is unchanged.

### The window

- [ ] **The action bar stays up after a special-only play.** `src/components/hand/PolitixHand.tsx`
      needs no change for that (`playing` is `myTurn && phase === "pxturn"`); the selection is reset
      after every dispatch as now. **Rest is not drawn while `px.playedThisTurn` is true**, even
      when burnt out. End turn (`px.btn.pass`) is drawn throughout `pxturn`. The local handler may
      be renamed from `doDraw` to `doEnd`; its dispatch stays `{ type: "pxPass", p: you }`.
- [ ] **The hint says the turn continues.** New key `hint.pxMore` in both catalogues —
      fi: "Voit pelata lisää erikoiskortteja, voittaa äänestäjiä tai lopettaa vuoron." /
      en: "You can play more special cards, win voters, or end your turn." `Hint.tsx` shows it in
      `pxturn` when it is the viewer's turn and `px.playedThisTurn` is true; `hint.pxTurn` otherwise,
      as today. A `render.test.tsx` case in both locales: with `playedThisTurn: true` and a burnout
      in front of the viewing seat, `<Hand />` draws End turn, draws no Rest button, and the hint
      reads `hint.pxMore`; with `playedThisTurn: false` and the same burnout, Rest is drawn and the
      hint is `hint.pxTurn`.
- [ ] `render.test.tsx`'s full sweep, the stopword test and `i18n.test.ts` (placeholders, list
      lengths) pass.

### The documents (the game must not teach a false rule)

- [ ] **Rules panel, both locales.** In `rules.politix` (`src/i18n/fi.ts` and `src/i18n/en.ts`,
      same item count as now): the turn item ("Then you play cards, end your turn without playing,
      or, when burnt out, rest.") says that special cards may be played one play after another,
      that a play which wins voters ends the turn, that otherwise the turn ends with **End turn**,
      and that resting is only possible before anything has been played that turn; the specials
      item keeps "may also be played on a turn that wins nothing" and adds nothing that contradicts
      the above. Reviewer reads both strings.
- [ ] **README** "The challenges: Politix": the first bullet (lines ~877–880) and the specials
      sentence (~892) say the same as the rules panel; the `NET_VERSION` line (~924) reads 17 and
      adds "v17 keeps the turn after a special-only play".
- [ ] **CLAUDE.md**: the Politix paragraph (`pxPass` "ends a turn without playing" → ends the turn
      at any point; a special-only human play keeps the turn; `NET_VERSION` is 17); the "Current
      version **16**" list in the Traditional Tuppi section gains "(v17's) Politix's turn continuing
      after a special-only play" and reads 17; the Known gaps line "The current version is **16**"
      reads 17. Neither `CLAUDE.md` nor `README.md` still calls 16 the current `NET_VERSION`.
- [ ] **docs/multiplayer.md**: the version paragraph gains a **17** sentence saying what the
      `protocol.ts` v17 comment says (see The wire).

### The wire

- [ ] **`NET_VERSION` is 17.** `src/net/protocol.ts`'s comment gets a v17 sentence: a v16 peer's
      reducer ends a human seat's turn on a special-only `pxPlay`, so it would pass the turn and draw
      for the next seat where a v17 peer does not — a reducer-rule bump with no message shape,
      `SCOPE`, `guestMay` or `parseMsg` change. `protocol.test.ts`'s _"NET_VERSION is 17"_ and
      `session.test.ts`'s `expect(NET_VERSION).toBe(17)` are updated.
- [ ] **`playedThisTurn` is hashed.** `politixHash` in `src/net/protocol.ts` appends
      `px.playedThisTurn ? 1 : 0`, since a rule (Rest) reads it; `protocol.test.ts`'s _"moves when a
      Politix field changes"_ list gains `{ playedThisTurn: true }`. `px.last` stays unhashed, as
      today.

### Gates

- [ ] `npm run typecheck`, `npm run lint`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
      `npm test` and `npm run build` pass. Mutation: making the special-only branch call
      `pxFinishTurn` again for human seats fails at least the new keep-the-turn case; deleting the
      Rest refusal fails the Rest case; deleting the driver's mirror `pxPass` fails (or hangs to
      the 5,000-step bound and then fails) the pinned golden.

## Assumptions

- **"Specials only on a turn that takes nothing" is read as the sheet's "even", not "only".** The
  requirement's parenthetical says the sheet allows specials _only_ on a turn that takes nothing.
  The sheet as recorded in two delivered specs (p. 5) says specials may be played _even_ on a turn
  that takes nothing, and `pxResolve` already accepts specials and a take in one play. This spec
  keeps that: specials may precede a take in the same turn — in the same `pxPlay` or in earlier
  special-only plays — and the take ends the turn. Reading "only" literally would refuse every
  specials-plus-take play, a rule change nobody asked for. **If "only" was meant, this is wrong.**
- **A take ends the turn because the sheet's p. 4 is one group and one tactic per turn**, not
  because specials are forbidden afterwards. Consequence: nothing can be played after a take — a
  player wanting a special and a take must play the special first.
- **Rest is refused once anything has been played this turn.** The sheet's rest is "losing the
  turn"; a turn that has already played a special has not been lost. Before this spec the case
  could not arise (any play ended the turn). The refusal is silent, with no new toast, because the
  button is not drawn.
- **The new state is a dedicated boolean, `PolitixState.playedThisTurn`, not an inference from
  `px.last`.** Inferring "this seat already played" from `px.last.p === px.turn` is sound in a real
  game (every turn writes `px.last`, and the next seat is always a different one) but breaks under
  test fixtures that hand the turn back by hand. The boolean is hashed because Rest reads it.
  Politix writes no save, so `SAVE_VERSION` does not move.
- **`px.last` after End turn following specials keeps the `"play"` record**, and `n` accumulates
  across the turn's special-only plays. Nothing renders `n` for `"play"` today; it is kept honest
  rather than shown.
- **"Bot unchanged" means `pxMove` and `aiPolitix` both stay as they are** — an AI seat makes at
  most one play a turn, and a special-only one still ends its turn. The headless drivers that run
  `pxMove` for the human seat are adjusted to press End turn straight after such a play, so the
  pinned golden and every README figure stay exactly as they are. A bot that chains specials is not
  built and is not measured.
- **`POLITIX_SCORES_VERSION` stays 3.** Turns are still counted once per seat turn. A human can now
  pack several specials into one turn, which can shorten a game in turns slightly against rows
  filed under the old rule; that comparison is accepted rather than discarding the board.
- **The label is not changed.** "End turn" / "Lopeta vuoro" is already the button's text; the
  catalogue key stays `px.btn.pass` and the action stays `pxPass` (renaming either is churn in
  `SCOPE`, `HASH_AFTER`, the tests and the docs for no player-visible change).
- **No cap on special-only plays per turn.** Each consumes a card, so the turn is finite; the
  sheet names no limit.
- **The primary source was not re-read in this run.** `lautapeliopas.fi` is not reachable from this
  session; the p. 3–5 readings are the ones the two earlier Politix specs recorded from it.

## Touch points

- `src/game/types.ts` — `PolitixState.playedThisTurn: boolean`.
- `src/game/politix.ts` — `pxSetup` initialises it; comment block at the top gains the
  turn-continues reading. `pxMove` unchanged.
- `src/game/reducer.ts` — `pxDoPlay`'s special-only branch (keep the turn for a human seat, set the
  flag, accumulate `px.last.n`); `pxDoPass` (keep `px.last` when the flag is set); `pxEndTurn`
  (clear the flag); the `pxRest` case (refuse when the flag is set); `aiPolitix` (still finishes the
  turn after a special-only play — e.g. a parameter on `pxDoPlay` or an explicit `pxFinishTurn`).
- `src/net/protocol.ts` — `NET_VERSION` 17 and its comment; `politixHash`.
- `src/components/hand/PolitixHand.tsx` — hide Rest when the flag is set.
- `src/components/hand/Hint.tsx` — `hint.pxMore`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `hint.pxMore`; two `rules.politix` items.
- `src/test/bot.ts` — `playPolitix` mirrors the AI with a `pxPass` after a special-only play.
- Tests: `src/game/reducer.test.ts` (new cases, the two edited ones, the local `playPolitix`
  helper), `src/net/protocol.test.ts`, `src/net/session.test.ts`, `src/test/render.test.tsx`.
- Docs: `README.md`, `CLAUDE.md`, `docs/multiplayer.md`.

## Out of scope

- Teaching `pxMove` to chain specials or to play specials before a take; any re-measurement.
- Playing anything after a take; a second take in one turn.
- An undo for a special-only play.
- Renaming `pxPass` or `px.btn.pass`; any new `Action` member, phase or `nextTick` arm.
- Hashing `px.last`.
- A toast for the refused Rest.
- The stale `POLITIX_SCORES_VERSION 2` mention in `CLAUDE.md` (the code says 3) — noted, not this
  spec's change.

## Source

- **Politix rule sheet (Tahkokallio / Onni Games 2009), p. 3**: a turn is draw 3 _or_ play cards;
  hand limit 10 at turn end. This game already replaced draw-or-play with an automatic draw
  (`2026-11-06-politix-side-piles-refill-deck`); the limit staying at turn end is the sheet's.
- **p. 4**: choose one group and one tactic, play that tactic's cards and coffees — one
  politicking play, which is why a take ends the turn here.
- **p. 5**: specials may be played **even on a turn that takes nothing**; burnout is shed by
  resting, which loses the turn. The sheet names no limit on the number of specials per turn and no
  order between specials and the politicking within a turn (this game resolves specials first,
  `2026-11-03-add-politix-card-game-mode`).
- Chosen readings (the turn continues after a special-only play; a take ends it; rest only before
  any play) are this game's own, not the sheet's, and belong in the comment block of
  `src/game/politix.ts` and beside `pxDoPlay` in `reducer.ts`.
- Neither tuppi source (Oulunsalo club sheet, korttipeliopas.fi) applies; Politix is not tuppi.
