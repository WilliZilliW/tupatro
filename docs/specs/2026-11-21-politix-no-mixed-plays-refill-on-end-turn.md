---
id: 2026-11-21-politix-no-mixed-plays-refill-on-end-turn
title: Politix — block mixing specials with politicking cards at selection, and refill the table at End turn
kind: rule
status: proposed
source: Politix rule sheet (Touko Tahkokallio, Onni Games 2009), p. 4 (the table is refilled immediately after a take; the game ends immediately when every voter card is collected), as recorded in 2026-11-21-politix-limit-cards-to-needed-power — not re-read in this run
---

# Politix — block mixing specials with politicking cards at selection, and refill the table at End turn

## What

Two changes to Politix, both from the requester's own words.

1. **The hand stops a mixed selection being built.** Today `PolitixHand.tsx`'s `toggle` silently
   ignores a click on a tactic card of a second tactic once one tactic is selected, but lets
   politicking cards (tactic cards and coffee breaks) and special cards (scandal, burnout, yesterday's
   news) be selected together, leaves **Play** clickable for that mix and lets the reducer refuse it
   with `toast.pxMixed`. After this spec the click that would mix the two kinds is ignored in exactly
   the way the second-tactic click already is, so a mixed play can no longer be assembled in the hand
   and **Play** is disabled for every selection `pxResolve` refuses.
2. **The voter cards on the table are refilled when the turn ends, not right after a take.** Today
   `pxDoPlay` calls `pxRefill` immediately after removing the taken voter cards. After this spec the
   table keeps its gaps for the rest of a human's turn, and is refilled to eight (and any event on the
   way surfaces) when the turn ends — on **End turn** (`pxPass`), and equally on Rest and at the end
   of an AI seat's turn. The game still ends at once when no voter card is left on the table **or**
   in the voter deck.

**Contradicts a delivered spec, on purpose.**
[`2026-11-21-politix-limit-cards-to-needed-power`](2026-11-21-politix-limit-cards-to-needed-power.md)
(delivered in 7ee70ec) has two lines this reverses:

- its review-rework criterion _"`PolitixHand` leaves Play clickable for a mixed selection (and keeps
  the selection) so the refusal is told rather than silently disabled"_, pinned by `render.test.tsx`'s
  _"leaves Play clickable for a mixed selection so the refusal is told, and keeps the selection"_
  (around line 8170). **This spec wins**: the requirement says to block the mix at selection, the
  same way two tactics are blocked, not only with a refusal toast. The rule itself (`pxResolve`'s
  `"mixed"` refusal and `toast.pxMixed`) is **kept** as the reducer's authority.
- its assumption _"The table refills right after the take, not at End turn"_ and its Out of scope line
  _"Moving the table refill to End turn"_. **This spec wins**: the requirement asks for exactly that.

**Departs from the sheet, on the requester's word.** The sheet's p. 4 refills the table
_"välittömästi"_ (immediately) after a take. Refilling at the end of the turn is this game's own
rule; the rules panel, README and `politix.ts`'s header say so.

## Acceptance criteria

### The hand (`src/components/hand/PolitixHand.tsx`)

- [ ] **A click that would mix the two kinds is ignored while playing.** Define the two kinds once in
      the component: _politicking_ = `kind === "tactic" || kind === "coffee"`, _special_ =
      `kind === "scandal" || kind === "burnout" || kind === "news"`. In `toggle`, while `playing`, a
      click on an **unselected** card of one kind when the current selection already holds a card of
      the other kind returns without changing `picked` — the same early `return` shape as the
      existing second-tactic guard, which stays. Deselecting a selected card is always allowed. No
      toast and no new state.
- [ ] **The discard step is unaffected.** In `pxdiscard` (`discarding`), any mix of cards can still
      be selected for throwing away, exactly as today (both guards are gated on `playing`).
- [ ] **Play is disabled for every refused selection again.** The Play `MoveButton`'s `disabled` is
      `!res || !res.ok` (the `mixed` exception is removed), the `mixed` constant is deleted, and
      `doPlay` resets the selection after every dispatch, as before the delivered spec's rework. The
      comment above it is replaced by one saying why the mix is blocked at selection (requester's rule;
      the reducer's refusal remains for any other sender).
- [ ] **`render.test.tsx` replaces the "leaves Play clickable for a mixed selection…" case** with
      cases, in both locales, that render `<Hand />` on the viewer's own `pxturn` and assert: - special first: clicking a scandal then a growl tactic card leaves only the scandal
      `aria-pressed="true"`, the growl `aria-pressed="false"`, no group `select` (`px.pickGroup`)
      is drawn, and clicking Play dispatches a `pxPlay` with `cards: []` and the scandal in
      `specials`; - politicking first: clicking a growl then a burnout leaves only the growl pressed, no
      special target `select` is drawn; - a coffee counts as politicking: clicking a coffee then a news card leaves the news unpressed; - deselection: after growl is selected, clicking growl again then the scandal selects the
      scandal; - discard step: with `phase: "pxdiscard"` and eleven cards in hand including a tactic and a
      scandal, both can be selected (`aria-pressed="true"`).
      Each case would fail with the guard removed (the second click would select).

### The rule (`src/game/politix.ts`, pure)

- [ ] **`pxResolve` keeps the `"mixed"` refusal** and its position right after `"empty"`;
      `PX_TOAST.mixed` and `toast.pxMixed` stay in both catalogues. `politix.test.ts`'s existing
      `"mixed"` case and `reducer.test.ts`'s `toast.pxMixed` row are unchanged.
- [ ] **`"oneTake"` is checked before `"noTactic"` and `"noGroup"`.** Inside the
      `if (cards.length > 0)` block, `if (px.tookThisTurn) return refuse("oneTake")` becomes the first
      line. Reason: with the refill deferred, the group just taken is usually gone from the table for
      the rest of the turn, and a second take must still be told `toast.pxOneTake`, not
      `toast.pxNoGroup`. A `politix.test.ts` case: `tookThisTurn: true`, a table with **no** youth,
      a growl play aimed at youth → `refusal: "oneTake"`.

### The turn (`src/game/reducer.ts`)

- [ ] **A take no longer refills the table.** `pxDoPlay`'s take branch does not call `pxRefill`.
      After a human take that keeps the turn, `px.table` is exactly the pre-take table minus the taken
      cards, `px.voterDeck` and `px.event` are unchanged.
- [ ] **The refill runs when a turn ends.** `pxFinishTurn` calls `pxRefill(px)` as its **first**
      step, before the hand-limit check and before `pxEndTurn`, so every turn end refills: `pxPass`,
      `pxRest`, an AI seat's take or special-only play (`aiPolitix`), and a human take that ends the
      game. Because the refill precedes the hand-limit check, a human parked in `pxdiscard` sees the
      refilled table, and `pxDiscard` → `pxEndTurn` needs no refill of its own. `pxRefill` draws no
      randomness, so `d.rngState` is unaffected by the move.
- [ ] **The game still ends at once.** After a human take, the turn is kept when
      `px.table.length > 0 || px.voterDeck.some((v) => v.group !== null)`; otherwise `pxDoPlay` calls
      `pxFinishTurn` in the same transition (whose refill surfaces any remaining events and leaves the
      table empty, so `pxEndTurn` opens `politixover`). This is the same outcome as today's
      "refill, then test `px.table.length`", without the refill.
- [ ] **`reducer.test.ts` — edited cases, not deleted.** - _"takes the affordable voter cards, banks them for the party and refills the table"_: right
      after the take the table holds **no** farmers card (the two farmers are still in
      `voterDeck`); after the `pxPass` it already dispatches, the table holds both farmers. Rename
      to say the refill happens at End turn. - _"refills the table to eight from the voter deck, an event on the way going to the event
      slot"_: after the take `px.table` has `PX_TABLE − 3` cards and `px.event` is `null`; after a
      `pxPass` from seat 0 the table has `PX_TABLE` cards, `px.event` is `"recession"` and `"ev1"`
      is not on the table. - _"returns the surplus to the hand, tells the seat, and keeps the turn"_: the second take
      (`again`) still gets `toast.pxOneTake` (this now depends on the reorder above, since no youth
      is back on the table); its `voterDeck` comment is corrected. - _"ends the game at once when the take empties the table"_ and _"ends the game the moment the
      last voter card leaves, naming the winner"_ pass unedited (their `voterDeck` is empty).
- [ ] **New `reducer.test.ts` cases.** - A human take that empties the table while `voterDeck` still holds a voter card: `d.screen` is
      `null`, `phase` is `"pxturn"`, `px.turn` is unchanged and `px.table` is empty; `pxPass` then
      refills the table and passes the turn. - A human take that empties the table while `voterDeck` holds **only an event**: `politixover`
      opens in the same transition. - An AI seat's take (`aiPolitix`, a fixture where `pxMove` returns a take): after the one
      transition the table is refilled and the turn has passed — the AI's observable result is
      unchanged. - A human take followed by `pxRest` is still refused (unchanged), and a `pxRest` from a fresh
      turn with a gap in the table refills it.

### The headless drivers and the golden

- [ ] **No pinned figure moves.** The human seat in `playPolitix` (`src/test/bot.ts`) and the local
      helper in `reducer.test.ts` already dispatch `pxPass` straight after a take that keeps the turn,
      and nothing reads the table in between, so the refill happens in the next transition with the
      same result. Then, **unedited**: `reducer.test.ts`'s _"plays a whole single-human game for a
      fixed seed to the pinned result"_ (its `turnNo`, `collected`, `turns` and `rngState`
      literals), `politix.test.ts`'s replay, settle and measured cases. README's Politix balance
      tables are not touched. If any of these moves, the implementation has changed more than the
      refill's timing and must be fixed, not re-pinned.

### The documents (the game must not teach a false rule)

- [ ] **Rules panel, both locales, same item count.** In `rules.politix` (`src/i18n/fi.ts`,
      `src/i18n/en.ts`): the refill item ("An empty draw pile is rebuilt… The table is refilled to
      eight; an event that surfaces…") says the table is refilled to eight **when the turn ends**
      (the player's own rule — the sheet refills right after a take), so an event that surfaces takes
      effect from the next turn; the end-of-game item says the game ends at once when the last voter
      card has been won, i.e. none is left on the table or in the voter deck. The turn item's "never
      both at once" stays. Reviewer reads both strings in both languages.
- [ ] **`src/game/politix.ts`'s header comment** gains the reading "the table is refilled when a turn
      ends, not right after a take (requester's rule; p. 4 refills immediately)" and the
      "one kind per play" line adds that the hand blocks the mix at selection. `pxRefill`'s own comment
      ("p. 4: refill to eight") adds when it is called.
- [ ] **README** "The challenges: Politix": the eight-voter-cards bullet or the turn bullet says when
      the table is refilled, and the game-end bullet matches the rules panel; the `NET_VERSION` line
      reads 19 and adds "v19 refills the table at the end of the turn rather than after a take".
- [ ] **CLAUDE.md**: the Politix paragraph says `NET_VERSION` is 19 and the table refills at turn
      end; the "Current version **18**" list in the Traditional Tuppi section reads 19 and gains
      "Politix's table refilled at turn end (v19's)"; the Known gaps "The current version is **18**"
      line reads 19. Neither `CLAUDE.md`, `README.md` nor `docs/multiplayer.md` still calls 18 the
      current version.
- [ ] **docs/multiplayer.md**: the version paragraph gains a **19** sentence matching the
      `protocol.ts` comment.

### The wire

- [ ] **`NET_VERSION` is 19.** `src/net/protocol.ts`'s comment gets a v19 sentence: a v18 peer's
      reducer refills the table right after a take, so after a human's take its `table`, `voterDeck`
      and `event` differ from a v19 peer's and the hash compared after `pxPlay` diverges — a
      reducer-rule bump with no message shape, `SCOPE`, `guestMay`, `parseMsg` or `politixHash`
      change. `protocol.test.ts`'s and `session.test.ts`'s version assertions read 19. The
      selection guard is window-local and needs no bump.

### Gates

- [ ] `npm run typecheck`, `npm run lint`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
      `npm test` and `npm run build` pass, with `render.test.tsx`'s sweep, the stopword test and
      `i18n.test.ts` (placeholders, list lengths) among them. Mutation: deleting the new `toggle`
      guard fails the new render cases; putting `pxRefill` back after the take fails the edited
      refill cases; dropping the `voterDeck` clause from the keep-the-turn test fails the
      "empties the table while a voter card is still in the deck" case; moving `oneTake` back below
      `noGroup` fails the new `politix.test.ts` case and the edited surplus case.

## Assumptions

- **"Kansanryhmäkortit" in the requirement means the politicking cards in the hand** — tactic cards
  and coffee breaks — not the voter-group cards on the table, which are never in a hand. The "different
  types" whose mixing is already prevented are the four tactics. This matches the computed task's own
  paraphrase ("politicking (voter-group) cards").
- **A coffee break counts as politicking**, so coffee + special is blocked too. `pxResolve` already
  treats a coffee as a politicking card, and a coffee with no tactic is refused anyway.
- **"Block it at selection, the same way" means the click is silently ignored**, exactly as the
  second-tactic click is today: no toast, no dimming, no tooltip. Greying out the unselectable cards
  would be a visual change the existing tactic lock does not have either; it is out of scope. **If the
  requester wanted the blocked cards visibly marked, this is incomplete.**
- **The reducer's `"mixed"` refusal and `toast.pxMixed` stay.** The hand can no longer build a mixed
  play, but a guest's or a stale window's `pxPlay` could still carry one, and the reducer is the
  authority (the same reasoning that keeps the tuppipakka swap's unreachable toasts).
- **"After End turn" is read as "when the turn ends"**: End turn, Rest, and the end of an AI seat's
  turn all refill. Rest ends the turn just as End turn does; leaving the table gapped across seats
  after a rest would starve the next player. For an AI seat the take and the turn end are one
  transition, so nothing observable changes there.
- **The refill happens before the hand-limit discard step**, not after it: `pxFinishTurn` refills
  first, so a human over the limit chooses discards with the refilled table already showing. Both
  orders are "after End turn"; this one keeps a single refill site and leaves `pxDiscard` untouched.
- **An event surfacing on the refill now takes effect from the next seat's turn.** With one take a
  turn it could not have changed the taker's power anyway.
- **The game still ends at once when the last voter card is won** — if the take empties the table and
  the voter deck holds no voter card. If the deck still holds voter cards, the human keeps the turn
  with an empty table (specials and End turn remain) and the table refills at End turn. Waiting for End
  turn when nothing can be refilled would leave a finished game on screen with nothing left to do.
- **`oneTake` moves ahead of `noTactic`/`noGroup`.** Otherwise a second take aimed at the group just
  emptied would be told "no such group on the table" rather than "only once a turn". The previous
  spec placed it only "before `weak`"; this is a narrowing of that, not a reversal.
- **`NET_VERSION` goes to 19** because v18 is on `origin/main` (7ee70ec) and a v18 peer's reducer
  refills at the take. No state field is added, so `politixHash` and `SAVE_VERSION` do not move;
  Politix writes no save. `POLITIX_SCORES_VERSION` stays 3 — turns are counted exactly as before.
- **No re-measurement.** The AI's decisions read the table only at the start of its own turn, which
  is refilled in both the old and new orders, and the drivers press End turn straight after a human
  take, so the golden and README tables are expected byte-identical; the criterion above holds that.
- **The primary sheet was not re-read in this run**; the p. 4 "välittömästi" reading is the one
  `2026-11-21-politix-limit-cards-to-needed-power` recorded from the PDF.

## Touch points

- `src/components/hand/PolitixHand.tsx` — `toggle` (kind guard beside the tactic guard), Play's
  `disabled`, `doPlay`, the `mixed` constant and its comment.
- `src/game/politix.ts` — `pxResolve` (move the `oneTake` check first in the politicking block),
  header comment, `pxRefill`'s comment.
- `src/game/reducer.ts` — `pxDoPlay` (no `pxRefill` after a take; keep-the-turn test reads
  `voterDeck`), `pxFinishTurn` (`pxRefill` first), the comments above both.
- `src/net/protocol.ts` — `NET_VERSION` 19 and its comment.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — two `rules.politix` items (refill, game end).
- Tests: `src/test/render.test.tsx` (replace the mixed-Play case), `src/game/politix.test.ts`
  (`oneTake` before `noGroup`), `src/game/reducer.test.ts` (edited refill and surplus cases, new
  cases), `src/net/protocol.test.ts`, `src/net/session.test.ts`.
- Docs: `README.md`, `CLAUDE.md`, `docs/multiplayer.md`.

## Out of scope

- Dimming, greying or explaining the cards a click cannot select; a toast on the ignored click.
- Removing the `"mixed"` refusal, `PX_TOAST.mixed` or `toast.pxMixed`.
- Any change to what an AI seat plays (`pxMove`, `bestTake`, `pxAiDiscard`), or any re-measurement.
- A second take in one turn, the surplus-return rule, or anything else delivered by
  [`2026-11-21-politix-limit-cards-to-needed-power`](2026-11-21-politix-limit-cards-to-needed-power.md)
  beyond the two lines reversed above.
- Hiding the gaps in the felt's voter row or re-laying `PolitixTable` for fewer than eight cards
  (the table already shrinks near the end of a game); a reviewer should still look at it, below.
- Renaming `pxPass` / `px.btn.pass`; any new `Action`, phase, `GameState` field or `nextTick` arm.

**Look at in the browser:** on your own turn, select a scandal and try to add a tactic card (nothing
happens), and the reverse; take voters and watch the felt keep the gaps until **End turn**, then
refill (and an event banner appear if one surfaced), at 1280x800 and 390x844.

## Source

- **Politix rule sheet (Tahkokallio / Onni Games 2009), p. 4**: after a take _"välittömästi … pöydällä
  esillä olevat kansanryhmäkortit täydennetään"_ — the table is refilled **immediately**. **Refilling
  at the end of the turn contradicts this**; it is the requester's own rule and is labelled so in the
  rules panel, README and `politix.ts`. Same page: the game ends immediately when every voter card is
  collected — kept, as "none on the table or in the voter deck".
- **p. 4/p. 5**: the sheet lets one play hold politicking cards and specials together. Refusing the mix
  is the requester's rule from the delivered spec; blocking it at selection is this requirement's
  addition and changes no rule.
- Neither tuppi source (Oulunsalo club sheet, korttipeliopas.fi) applies; Politix is not tuppi.
