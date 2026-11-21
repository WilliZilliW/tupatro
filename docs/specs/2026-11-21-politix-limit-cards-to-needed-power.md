---
id: 2026-11-21-politix-limit-cards-to-needed-power
title: Politix — spend only the cards a take needs, return the rest, and end the turn only with End turn
kind: rule
status: proposed
source: Politix rule sheet (Touko Tahkokallio, Onni Games 2009), pp. 3–5, read from the PDF in this run (lautapeliopas.fi/wp-content/uploads/2009/06/Politix_ohjeet.pdf)
---

# Politix — spend only the cards a take needs, return the rest, and end the turn only with End turn

## What

Today a Politix take spends **every** politicking card the player selected (`pxResolve` puts all of
them in `used` and `discard`), even when the power they add is more than the voter cards of that
group on the table can absorb, and a take **ends the turn** at once (`pxDoPlay` → `pxFinishTurn` in
`src/game/reducer.ts`). After this spec a take spends only as many of the selected tactic/coffee
cards as it needs to win the same number of voter cards — each point of power above the need still
wins one more card of the same group, until none of that group is left on the table or the power
runs out — and the **surplus cards stay in the player's hand**, with an addressed toast saying how
many. For a human seat a take **no longer ends the turn**: the turn ends only when the player presses
**End turn** (`pxPass`), or Rest before anything was played. The one exception is the game itself
ending when the last voter card leaves the table. The game's AI is unchanged in what it plays.

**Contradicts a delivered spec, on purpose.** `docs/specs/2026-11-20-politix-end-turn-button.md`
(delivered in 5e6f822) requires "a play that takes voter cards still ends the turn" and "a
specials-plus-take play in a single `pxPlay` behaves exactly as today", and `reducer.test.ts` pins
`expect(px(s).turn).toBe(1)` after a human take (the _"two cards + skill 2 + recession 1"_ case,
around line 4921, among others). **This spec wins for a human seat**, because the requirement says
in so many words that the turn must end only when End turn is pressed, never automatically. That
spec's other decisions — the special-only play keeping the turn, the hand limit at End turn, Rest
refused once something has been played, `px.last` kept on an End turn that follows a play — stand
and are extended here, not reversed. For an **AI** seat a take still ends the turn in the same
transition, as that spec required.

**Departs from the sheet, on the requester's word.** The sheet lets a player play "as many cards as
they wish" (p. 4, _"pelaa kädestään haluamansa määrän"_) and sends every played politicking card to
the discard pile (p. 5, _"Pelatut politikointikortit ... asetetaan poistopakkaan"_). Returning the
surplus is this game's own rule; the rules panel and README say so.

## Acceptance criteria

### The rule (`pxResolve`, pure)

- [ ] **Only the needed cards are spent.** In `src/game/politix.ts`, when `pxResolve` accepts a
      take, let `power` be the power of **all** selected politicking cards (as today) and
      `take = pxTakeCount(power, need, onTable)` (unchanged). The surplus is
      `power − (need + take − 1)`. `pxResolve` keeps back `r = min(surplus, cards.length − 1)`
      of the selected politicking cards, never the last tactic card, so the play still holds at
      least one tactic card. The kept-back cards are **not** in `used` and **not** in `discard`;
      every other selected card is in both, exactly as today. Specials are unaffected.
- [ ] **Which cards come back is deterministic: coffees first, then tactic cards, each from the end
      of `play.cards`.** Coffee breaks are returned before tactic cards because they are wild and
      worth more in hand; within a kind, the card later in `play.cards` is returned first. At least
      one tactic card is always kept, so `noTactic` can never follow from the trimming.
- [ ] **`PxResult`'s ok arm gains `returned: string[]`** — the uids kept back, in the order they
      were chosen. `power`, `need` and `take` keep their meaning (`power` is still all selected
      cards' power, so `PolitixHand`'s "power / need" line is unchanged). A special-only play and
      every refusal carry no `returned` (or an empty one on the ok arm with `take: 0`).
- [ ] **The take is the same with the kept cards as with all of them.** `politix.test.ts` has a
      case for a selection that overshoots: youth's growl need 3, two youth on the table, skill 0,
      no event, no symbol, and six growl cards selected (power 6, take 2, surplus 2). It asserts
      `take` is 2, `used` holds exactly the first four growl cards, `returned` the last two, and
      re-resolving with only the `used` cards gives the same `take`. A second case puts one youth on
      the table under the same conditions and selects, in this order, growl, coffee A, growl,
      coffee B (power 4, take 1, surplus 1), and asserts `returned` is exactly `[coffee B]` — a
      **coffee** before any tactic card, the later one first. A third case selects exactly enough
      cards and asserts `returned` is empty and `used` is unchanged from today.
- [ ] **A second take in the same turn is refused.** `PolitixState` in `src/game/types.ts` gains
      `tookThisTurn: boolean`; `pxSetup` initialises it `false`. `pxResolve` returns the new
      refusal `"oneTake"` for a play with politicking cards when `px.tookThisTurn` is true — checked
      before `"weak"`, so the refusal does not depend on the power. A special-only play after a take
      is still accepted. `PX_TOAST` in `reducer.ts` maps `oneTake` to the new key
      `toast.pxOneTake`.

### The turn (reducer)

- [ ] **The surplus stays in the hand.** In `reducer.ts`'s `pxDoPlay`, the hand filter already
      removes only `res.used`, so the returned cards stay where they were in `px.hands[p]`. A
      `reducer.test.ts` case dispatches a human `pxPlay` that overshoots and asserts the returned
      uids are still in `px.hands[0]` and not in `px.discard`, the used ones are in `px.discard`,
      and `px.collected` grew by `take`.
- [ ] **The player is told.** When `res.returned.length > 0`, `pxDoPlay` raises an addressed toast
      `{ key: "toast.pxReturned", vars: { n }, p }` with `n = res.returned.length`. New key in both
      catalogues — fi: "{n} tarpeetonta korttia palasi käteesi." / en: "{n} unneeded cards went back
      to your hand." The same `reducer.test.ts` case asserts the toast's key, `p` and `n`.
- [ ] **A take keeps the turn for a human seat.** After an accepted take from a `"human"` seat,
      `pxDoPlay` removes the voter cards, credits `px.collected`, writes `px.last` as the `"take"`
      record and calls `pxRefill` exactly as today, then sets `playedThisTurn = true` and
      `tookThisTurn = true` and **does not** call `pxFinishTurn`: `d.phase` stays `"pxturn"`,
      `px.turn`, `px.turnNo` and `px.turns` are unchanged, no seat draws and `d.rngState` is
      unchanged by the take itself. A `reducer.test.ts` case asserts all of that, then asserts a
      second politicking `pxPlay` is refused with `toast.pxOneTake` (state otherwise unchanged), a
      special-only `pxPlay` is accepted with the turn still 0, and `pxPass` then passes the turn
      with `px.turns` for the seat's party up by exactly **1**.
- [ ] **Emptying the table still ends the game at once.** If after the take and `pxRefill`
      `px.table` is empty, a human take calls `pxFinishTurn` as today, so `politixover` opens in the
      same transition (sheet p. 4: the game ends _immediately_ when every voter card is collected).
      A `reducer.test.ts` case takes the last voter cards with an empty voter deck and asserts
      `d.screen.kind === "politixover"`.
- [ ] **`tookThisTurn` is cleared where `playedThisTurn` is.** `pxEndTurn` sets both `false` before
      the turn passes.
- [ ] **What `px.last` says.** A take writes the `"take"` record, replacing any earlier `"play"`
      record of the same turn (as today). A special-only play **after** a take leaves the `"take"`
      record in place (it does not overwrite it with `"play"`). `pxPass` after a take leaves it too
      (already so, since `playedThisTurn` is true). `reducer.test.ts` asserts the special-after-take
      case.
- [ ] **Rest stays refused once anything has been played**, a take included — already so through
      `playedThisTurn`; the take-then-Rest case is added to the existing Rest test, with a burnout
      present so the test would fail without the rule.
- [ ] **The hand limit is checked at End turn.** A human take that leaves more than `PX_HAND_MAX`
      cards (possible now that surplus cards return) parks in `pxdiscard` only after `pxPass`, not
      after the take. `reducer.test.ts` covers it.
- [ ] **The AI's turn still ends in one step.** `aiPolitix`'s take ends the AI seat's turn in the
      same transition, exactly as today. `bestTake` already chooses the fewest cards that reach its
      take, so an AI take returns nothing; `politix.test.ts` asserts, over the `PXLEGAL` loop's
      plays, that every accepted AI take has `returned` empty.
- [ ] **`pxMove` passes once its seat has taken this turn.** `pxMove` gains one guard: in `pxturn`,
      if `px.tookThisTurn` is true it returns `{ type: "pxPass", p }`. Only a human seat can be in
      that state, so no AI decision changes; it keeps the bot-driven loops in `politix.test.ts`
      (`"PXTURN"`, `"PXLEGAL"`) from proposing a refused second take forever, and
      _"only ever proposes a play the rule accepts"_ keeps passing.
- [ ] **The headless drivers mirror the AI, so no measurement or golden moves.** `playPolitix` in
      `src/test/bot.ts` and the local `playPolitix` helper in `reducer.test.ts` dispatch `pxPass`
      for the seat after **any** `pxMove` answer that was a `pxPlay` which left the phase at
      `pxturn` for that seat with no screen (today the condition also requires a special-only play;
      that clause is dropped). Then, **unedited**: `reducer.test.ts`'s _"plays a whole single-human
      game for a fixed seed to the pinned result"_ (its `turnNo`, `collected`, `turns` and
      `rngState` literals) and `politix.test.ts`'s replay, settle and three measured cases. README's
      Politix balance tables are not touched.
- [ ] **Existing cases that pinned a take ending a human turn are edited, not deleted.** Every
      `reducer.test.ts` assertion of `px(s).turn` being `1` straight after a human take (e.g. the
      _"two cards + skill 2 + recession 1"_ case) becomes `0`, or gains a `pxPass` before it,
      whichever the implementer finds clearer; every other assertion in them is unchanged.

### The window

- [ ] **The action bar stays up after a take**, End turn drawn, Rest not drawn (already so through
      `playing` and `playedThisTurn` in `src/components/hand/PolitixHand.tsx`). The Play button is
      disabled for a selection holding politicking cards after a take, because `pxResolve` refuses
      it — no new disabling code is required.
- [ ] **The hint says what is left.** New key `hint.pxTook` — fi: "Voit vielä pelata
      erikoiskortteja tai lopettaa vuoron." / en: "You can still play special cards or end your
      turn." `Hint.tsx` shows it in `pxturn` on the viewer's own turn when `px.tookThisTurn` is
      true; otherwise `hint.pxMore` / `hint.pxTurn` exactly as today. A `render.test.tsx` case in
      both locales: with `playedThisTurn: true, tookThisTurn: true` and a burnout in front of the
      viewing seat, `<Hand />` draws End turn, draws no Rest, and the hint reads `hint.pxTook`.
- [ ] **New toast keys exist in both catalogues**: `toast.pxReturned` (with `{n}` in both) and
      `toast.pxOneTake` — fi: "Voit voittaa äänestäjiä vain kerran vuorossa." / en: "You can win
      voters only once a turn." `i18n.test.ts` (placeholders), the render sweep and the stopword
      test pass.

### The documents (the game must not teach a false rule)

- [ ] **Rules panel, both locales, same item count.** In `rules.politix` (`src/i18n/fi.ts`,
      `src/i18n/en.ts`): the turn item says a play that wins voters no longer ends the turn — voters
      may be won once per turn, special cards may be played before and after, and the turn ends when
      **End turn** is pressed (or by resting before anything is played), except that the game ends
      at once when the last voter card leaves the table. The power item ("If power reaches the
      group's need…") adds that only the cards the take needs are spent and the unneeded ones go
      back to the hand, and that this is the player's own rule (the sheet discards every played
      card). Reviewer reads both strings.
- [ ] **`src/game/politix.ts`'s header comment**: the reading "A play that takes voters ends the
      turn (p. 4…)" and "the most cards affordable are taken automatically" are rewritten to the new
      readings (one take a turn, the turn ends with End turn, surplus returned coffees first, game
      end immediate).
- [ ] **README** "The challenges: Politix": the turn bullet, the taking bullet and the specials
      sentence ("a take after them ends the turn") say the same as the rules panel; the
      `NET_VERSION` line reads 18 and adds "v18 spends only the cards a take needs and keeps the turn
      after a take".
- [ ] **CLAUDE.md**: the Politix paragraph says a human take keeps the turn and returns surplus
      cards, and `NET_VERSION` is 18; the "Current version **17**" list in the Traditional Tuppi
      section reads 18 and gains "(v18's) Politix's surplus return and turn continuing after a
      take"; the Known gaps "The current version is" line reads 18. Neither file still calls 17 the
      current version.
- [ ] **docs/multiplayer.md**: the version paragraph gains a **18** sentence matching the
      `protocol.ts` comment.

### The wire

- [ ] **`NET_VERSION` is 18.** `src/net/protocol.ts`'s comment gets a v18 sentence: a v17 peer's
      reducer discards every selected card and ends a human's turn on a take, so its hand, discard
      pile and turn diverge on the first overshooting or human take — a reducer-rule bump with no
      message shape, `SCOPE`, `guestMay` or `parseMsg` change. `protocol.test.ts`'s and
      `session.test.ts`'s version assertions read 18.
- [ ] **`tookThisTurn` is hashed.** `politixHash` appends `px.tookThisTurn ? 1 : 0`;
      `protocol.test.ts`'s _"moves when a Politix field changes"_ list gains
      `{ tookThisTurn: true }`.

### Gates

- [ ] `npm run typecheck`, `npm run lint`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
      `npm test` and `npm run build` pass. Mutation: discarding the returned cards anyway (putting
      every selected card in `used`) fails the new `politix.test.ts` and `reducer.test.ts` cases;
      calling `pxFinishTurn` after a human take fails the keep-the-turn case; deleting the
      `oneTake` refusal fails the second-take case; returning tactic cards before coffees fails the
      coffee-first case.

## Assumptions

- **"The turn must end only when End turn is pressed" overrides the delivered rule that a take ends
  the turn** (`2026-11-20-politix-end-turn-button`). The requirement says it outright, so this spec
  reverses that one criterion for human seats. AI seats keep ending their turn after one play.
- **Still only one take per turn.** The requirement does not say whether a second take is allowed
  once the turn no longer ends after the first. The sheet's p. 4 is explicit — _"voi hän vuorollaan
  taivutella vain yhtä kansanryhmää ja vain yhdellä politikointitavalla"_ (one group, one tactic per
  turn) — so a second politicking play is refused with a toast; only specials (and End turn) may
  follow a take. **If the requester wanted several takes per turn, this is wrong.**
- **The game still ends at once when the last voter card leaves the table**, even mid-turn. That is
  the game ending, not the turn (sheet p. 4: _"jolloin peli päättyy välittömästi"_). Waiting for End
  turn there would leave a player with nothing left to win and nothing that could change the score.
- **The table refills right after the take, not at End turn** (sheet p. 4: _"Välittömästi … pöydällä
  esillä olevat kansanryhmäkortit täydennetään"_). An event surfacing on that refill is active for
  the rest of the turn, but with one take a turn it can no longer change that seat's power.
- **"Use only the needed number of cards" means the fewest selected cards that still win the same
  number of voter cards** as all the selected cards would. It never lowers the take: a player who
  selects five cards to win three still wins three, with the fourth and fifth returned.
- **Coffee breaks are returned before tactic cards**, later-selected first within a kind, and at
  least one tactic card is always spent. The requirement names no order; coffees are wild and the
  AI's own discard scorer already values them highest, so a player is better off keeping them.
  There is no picker for which card comes back — the toast reports how many did. **If the player
  should choose, this is wrong.**
- **"Power is left over" is power the table cannot absorb**, i.e. above `need + onTable − 1` for that
  group. Power from the politician, the event or the party symbol counts toward the need first, so
  a player with a high skill may get back every card but one.
- **`px.last` keeps the `"take"` record when specials follow a take** in the same turn: the felt's
  last-move line then says what was won rather than "played special cards". The specials themselves
  are visible in front of the seats.
- **New state is a dedicated boolean, `tookThisTurn`**, beside `playedThisTurn`, for the same reason
  the earlier spec gave (inferring from `px.last` breaks under fixtures). It is hashed because a
  rule reads it. Politix writes no save, so `SAVE_VERSION` does not move.
- **`POLITIX_SCORES_VERSION` stays 3.** Turns are still counted once per seat turn and the number of
  takes per turn is unchanged; returned cards can make a human's game slightly shorter in turns, and
  that comparison against older rows is accepted rather than discarding the board.
- **`pxMove` gains one guard (pass after its seat has taken)** although the AI is otherwise
  unchanged; no AI seat can reach that state, so no AI decision moves.
- **The primary source was read in this run** (pp. 3–5 of the PDF). It sends all played cards to the
  discard pile, so the surplus return is this game's own rule.

## Touch points

- `src/game/types.ts` — `PolitixState.tookThisTurn: boolean`.
- `src/game/politix.ts` — `pxResolve` (trim to the needed cards, `returned`, `"oneTake"`),
  `PxResult`, `PxRefusal`, `pxSetup` (initialise the flag), `pxMove` (pass after a take), header
  comment.
- `src/game/reducer.ts` — `PX_TOAST` (`oneTake`), `pxDoPlay` (keep the turn after a human take
  unless the table is empty, set both flags, `toast.pxReturned`, leave a `"take"` `px.last` in place
  on a later special-only play), `pxEndTurn` (clear `tookThisTurn`).
- `src/net/protocol.ts` — `NET_VERSION` 18 and its comment; `politixHash`.
- `src/components/hand/Hint.tsx` — `hint.pxTook`.
- `src/components/hand/PolitixHand.tsx` — no change expected; confirm the bar after a take.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `hint.pxTook`, `toast.pxReturned`, `toast.pxOneTake`; two
  `rules.politix` items.
- `src/test/bot.ts` — `playPolitix` mirror condition widened to any `pxPlay` that keeps the turn.
- Tests: `src/game/politix.test.ts`, `src/game/reducer.test.ts` (new cases, the edited take cases,
  the local `playPolitix` helper), `src/net/protocol.test.ts`, `src/net/session.test.ts`,
  `src/test/render.test.tsx`.
- Docs: `README.md`, `CLAUDE.md`, `docs/multiplayer.md`.

## Out of scope

- Letting the player choose which surplus cards come back, or a preview in the action bar of how
  many cards a play will spend.
- A second take in one turn; anything after the game has ended.
- Teaching `pxMove` to chain specials, play after a take, or overshoot; any re-measurement.
- Moving the table refill to End turn.
- Renaming `pxPass` or `px.btn.pass`; any new `Action` member, phase or `nextTick` arm.
- Hashing `px.last`.
- The special-only turn mechanics already delivered by
  [`2026-11-20-politix-end-turn-button`](2026-11-20-politix-end-turn-button.md), except where
  extended above.

## Source

- **Politix rule sheet (Tahkokallio / Onni Games 2009), p. 3**: a turn is draw three _or_ play
  cards; the hand limit of ten is checked at the end of the turn. The automatic draw is this game's
  own (`2026-11-06-politix-side-piles-refill-deck`); the limit at turn end is the sheet's and is
  kept at End turn.
- **p. 4**: the player picks one group and one tactic and plays _"haluamansa määrän"_ (as many as
  they wish) of that tactic's cards and coffee breaks; power at least the need wins one card, and
  each further card of the same group costs one more power (worked example: 3 + 1 + 1 = 5 wins
  three). The table is refilled immediately after the take; the game ends immediately when every
  voter card is collected. _"voi hän vuorollaan taivutella vain yhtä kansanryhmää ja vain yhdellä
  politikointitavalla"_ — one group and one tactic per turn, which is why a second take is refused.
- **p. 5**: _"Pelatut politikointikortit ja pelistä poistetut erikoiskortit asetetaan
  poistopakkaan"_ — every played politicking card goes to the discard pile. **Returning surplus
  cards contradicts this**; it is the requester's own rule and is labelled so in the rules panel,
  README and the comment block in `politix.ts`.
- The sheet says nothing about the turn continuing after a take; ending it only at End turn is the
  requester's rule. Neither tuppi source (Oulunsalo club sheet, korttipeliopas.fi) applies; Politix
  is not tuppi.
