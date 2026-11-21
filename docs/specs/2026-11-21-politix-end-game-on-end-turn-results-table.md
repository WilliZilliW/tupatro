---
id: 2026-11-21-politix-end-game-on-end-turn-results-table
title: Politix — end the game on End turn after the last voter is won, and redraw the result table left–centre–right with the deciding count circled and each party's members named
kind: rule
status: proposed
source: Politix rule sheet (Touko Tahkokallio, Onni Games 2009), p. 4 ("…kunnes kaikki kansanryhmäkortit on kerätty pelipöydältä, jolloin peli päättyy välittömästi") and p. 6 ("Pelin päättyminen ja pisteiden lasku", the weakest-group comparison and its worked example) — re-read from the PDF in this run
---

# Politix — end the game on End turn after the last voter is won, and redraw the result table

## What

1. **A human who wins the last voter card keeps the turn, and the game ends when they press End
   turn.** Today `pxDoPlay` in `src/game/reducer.ts` opens `politixover` in the take's own
   transition once no voter card is left on the table or in the voter deck. After this spec a
   human's take always keeps the turn; pressing **End turn** (`pxPass`) is what opens the result.
   An AI seat's take still ends its turn, and so the game, in one transition, as every AI turn does.
2. **The result screen's table is a real grid with the parties in left – centre – right order.**
   `PolitixOver.tsx` today prints each voter group as one joined string (`"3 – 1 – 4"`) in
   `PX_PARTIES` order (right, centre, left). After this spec each count is its own cell in its own
   party's column, the columns read Left, Centre, Right (only the parties in play), and the turn
   counts are a row of the same grid.
3. **The count that decided the game is circled, by the sheet's rule, not by size.** The winner's
   deciding count — the one at the first position where its ascending-sorted group counts beat the
   best other party's — gets a ring, and a caption says the ringed count decided the game.
4. **The headline box names who was in each party**: Left, Centre, Right (in play only), each with
   its seat names, "You" for the viewing seat.

**Contradicts delivered specs, on purpose.**
[`2026-11-21-politix-limit-cards-to-needed-power`](2026-11-21-politix-limit-cards-to-needed-power.md)
(criterion _"Emptying the table still ends the game at once"_, its assumption _"The game still ends
at once when the last voter card leaves the table, even mid-turn"_) and
[`2026-11-21-politix-no-mixed-plays-refill-on-end-turn`](2026-11-21-politix-no-mixed-plays-refill-on-end-turn.md)
(criterion _"The game still ends at once"_, its new case _"A human take that empties the table while
`voterDeck` holds only an event: `politixover` opens in the same transition"_, and its assumption
_"Waiting for End turn when nothing can be refilled would leave a finished game on screen with
nothing left to do"_). **This spec wins**: the requirement asks for exactly the reverse. Everything
else those two specs delivered (one take a turn, surplus return, no mixed plays, refill at turn end)
stands unchanged.

**Contradicts the sheet, on the requester's word.** p. 4 says the game ends _välittömästi_
(immediately) when every voter card has been collected. Ending it on End turn is this game's own
rule; `politix.ts`'s header, the rules panel and README say so. The **winner rule is not changed** —
part 3 only draws the sheet's p. 6 rule on the screen.

## Acceptance criteria

### The rule (`src/game/reducer.ts`)

- [ ] **A human take always keeps the turn.** In `pxDoPlay`, the keep-the-turn test after a take is
      `d.seats[p] === "human"` alone (the `px.table.length > 0 || px.voterDeck.some(...)` clause is
      removed); `playedThisTurn` and `tookThisTurn` are set and the function returns. An AI seat's
      take still calls `pxFinishTurn` in the same transition. The comment above it says the game
      ends on End turn (the requester's rule; sheet p. 4 ends it immediately).
- [ ] **End turn ends the game.** No change is needed in `pxFinishTurn`/`pxEndTurn`: `pxRefill`
      surfaces any remaining event and leaves the table empty, the hand-limit step is skipped
      because `px.table.length === 0`, and `pxEndTurn` counts the turn and opens `politixover`. A
      `reducer.test.ts` case asserts exactly this sequence: after the final human take
      `screen === null`, `phase === "pxturn"`, `px.turn` unchanged, `tookThisTurn === true`,
      `px.table` empty; after `{ type: "pxPass", p }` `screen.kind === "politixover"` and the
      taker's party's `turns` went up by exactly one (the same count the old one-step ending gave).
- [ ] **The kept turn cannot change the result.** A case plays a special (e.g. a burnout on an
      opponent) between the final take and End turn: `screen` stays `null`, and after `pxPass` the
      `politixover` payload's `counts` equal `px.collected` as it stood after the take. `pxRest`
      after the final take is refused (unchanged rule, `playedThisTurn`).
- [ ] **AI seats are unchanged.** A case where an AI seat's `aiPolitix` take empties the table
      with no voter card in the deck opens `politixover` in that one transition.
- [ ] **`reducer.test.ts` cases edited, not deleted**: _"ends the game at once when the take empties
      the table"_, _"ends the game at once when only an event is left in the deck"_ and _"ends the
      game the moment the last voter card leaves, naming the winner"_ are renamed to say End turn
      ends the game, assert `screen === null` after the take, then dispatch `pxPass` and keep their
      existing `politixover` assertions (winners, turns, parties, `nextTick(s) === null`). The
      event case also asserts `px.event === "recession"` on the final state.
- [ ] **No pinned figure moves.** `reducer.test.ts`'s `playPolitix` helper, `src/test/bot.ts`'s
      `playPolitix` and `session.test.ts`'s Politix wire game already press `pxPass` after a human
      take that keeps the turn (`pxMove` returns `pxPass` when `tookThisTurn`), and `pxEndTurn`
      opens the screen before `pxBeginTurn` draws, so no randomness moves. Unedited: the golden
      _"plays a whole single-human game for a fixed seed to the pinned result"_ (`turnNo`,
      `collected`, `turns`, `rngState`), `politix.test.ts`'s replay and measured cases, README's
      Politix balance tables. If any moves, the implementation is wrong; do not re-pin.
- [ ] **`NET_VERSION` is 20.** A v19 peer opens `politixover` on the final take where a v20 peer
      keeps the turn. `src/net/protocol.ts`'s comment gains the v20 line (reducer-rule bump, no
      message shape, `SCOPE`, `guestMay`, `parseMsg` or `politixHash` change);
      `protocol.test.ts` and `session.test.ts` assert 20.

### The hint (`src/components/hand/Hint.tsx`)

- [ ] **The waiting player is told End turn finishes the game.** When it is the viewer's
      `pxturn`, `px.tookThisTurn` is true, `px.table` is empty and no card in `px.voterDeck` has a
      `group`, the hint reads the new key `hint.pxLastTaken` (fi: _"Viimeinenkin äänestäjäkortti on
      voitettu. Lopeta vuoro, niin peli päättyy."_; en: _"The last voter card is won. End your turn
      to finish the game."_) instead of `hint.pxTook`. `render.test.tsx` asserts it in both
      locales, and asserts `hint.pxTook` still shows when the deck still holds a voter card.

### The pure decider (`src/game/politix.ts`)

- [ ] **`pxDecider` names the count that decided the game.** New export
      `pxDecider(counts: Record<PxPartyId, number[]>, turns: Record<PxPartyId, number>, inPlay: PxPartyId[], winners: PxPartyId[]): Partial<Record<PxPartyId, number | "turns">>`,
      reusing the private `pxCompare`. Rule: the _runner-up_ is the best party in `inPlay` that is
      not in `winners` (by `pxCompare`). If there is none (every party in play tied), it returns
      `{}`. Otherwise for each winner: sort the winner's and the runner-up's counts ascending; at
      the first index `k` where they differ, the decisive value is the winner's `sorted[k]`, and the
      answer is the **first index in `PX_GROUPS` order** whose count equals it; if no index differs
      (decided on fewer turns), the answer is `"turns"`. Pure, no randomness, in `PURE_CORE`
      already.
- [ ] **`politix.test.ts` pins it with the sheet's own p. 6 example.** Right = 6 white-collar,
      5 blondes, 4 workers, 2 hippies, 2 farmers, 1 youth; Left = 6 youth, 5 farmers, 5 hippies,
      3 workers, 2 blondes, 1 white-collar (in `PX_GROUPS` order: right `[2,4,6,1,5,2]`, left
      `[5,3,1,6,2,5]`). `pxWinnerIds` says `["left"]` and `pxDecider` returns
      `{ left: PX_GROUPS.indexOf("workers") }` — the third-weakest group, as the sheet says, and not
      a 6, the biggest number. Further cases: equal vectors with fewer turns → `"turns"`; a two-way
      draw over a weaker third party → one entry per tied winner; a full three-way tie → `{}`; a
      decisive value held by two groups → the earlier `PX_GROUPS` index.

### The result screen (`src/components/screens/PolitixOver.tsx`)

- [ ] **Column order is left – centre – right.** A component-level constant
      `RESULT_ORDER: PxPartyId[] = ["left", "centre", "right"]`, filtered by `pxPartiesInPlay`,
      orders every column. `PX_PARTIES` is **not** reordered.
- [ ] **One cell per count, in its party's column.** The per-group `cashline` strings and the
      per-party `{party} · Turns` lines are replaced by one grid (`.pxresult`): a header row (empty
      corner, then each party's `px.party.*` name), six group rows (`px.group.*`, then one cell per
      party carrying `data-party` and `data-group` and the text `fmt(screen.counts[party][i])`),
      and a turns row (`pxOver.turns`, then cells with `data-party` and `data-row="turns"` and
      `fmt(screen.turns[party])`). `px.scoreHead`/`px.scoreHead2` are no longer read here (they stay
      in the catalogue; `PolitixTable.tsx` still uses them). The seed line, the board and the
      buttons are unchanged.
- [ ] **The deciding count is circled.** The cell `pxDecider(screen.counts, screen.turns, inPlay,
screen.winners)` names for each winner carries the class `pxwin`, drawn in `src/index.css` as
      a ring (`border-radius:50%` and a border), added after any rule it overrides. When at least
      one cell is ringed, a caption under the grid reads the new key `pxOver.circled` (fi:
      _"Ympyröity luku ratkaisi pelin."_; en: _"The circled count decided the game."_); with no
      ring it is not drawn.
- [ ] **`render.test.tsx`, both locales**: (a) the header cells read Vasemmisto/Keskusta/Oikeisto
      and Left/Centre/Right in that order for three parties, and Centre then Right for a
      `["right","centre"]` two-party result; (b) with the sheet's example counts every
      `[data-party][data-group]` cell's text equals that party's count for that group; (c) exactly
      one `.pxwin`, on `data-party="left"` `data-group="workers"`, and the caption is present;
      (d) a turns-decided payload rings `[data-party=<winner>][data-row="turns"]`; (e) a full tie
      draws no `.pxwin` and no caption.
- [ ] **The headline box names the members.** The headline and the member lines sit in one box
      (`.pxwinner`): for each party in `RESULT_ORDER` that is in play, one line from the new key
      `pxOver.members` (`"{party}: {names}"` in both locales), `names` being the seats whose
      `screen.parties[seat]` is that party, in seat order, each through
      `seatName(seat, spectating ? null : useViewSeat())`, joined with `", "` as the existing
      `drawnBy` join is. `render.test.tsx` asserts, both locales: a three-player result at seat 0
      lists "Sinä"/"You" on seat 0's party's line and the characters' names (from `SEATS`) on the
      others; a four-player result lists two names on each of its two lines; a spectating window
      lists no `seat.you`.

### The documents

- [ ] **Rules panel, both locales, same item count** (`rules.politix` in `src/i18n/fi.ts` and
      `src/i18n/en.ts`): the turn item's "The game itself still ends at once when the last voter
      card leaves the table" and the end-of-game item's "The game ends at once when the last voter
      card has been won" both say the game ends when the player who won the last voter card ends
      their turn (the player's own rule; the sheet ends it immediately). The end-of-game item
      gains one sentence: the result table rings the count that decided the game.
- [ ] **`src/game/politix.ts`'s header** reading about the game end is rewritten the same way.
      **README.md**'s Politix bullet ("The game ends the moment the last voter card is won") and
      **CLAUDE.md**'s Politix paragraph ("unless the table is empty, which ends the game at once")
      and its `NET_VERSION` mentions, and **docs/multiplayer.md**'s version list (gains **20**),
      are updated.

## Assumptions

- **"Drawn the last voter card" means won the last voter card with a take** — the take after which
  no voter card is left on the table or in the voter deck. The case where the table empties but the
  deck still holds voter cards already keeps the turn and refills at End turn; it is unchanged.
- **Only a human seat waits for End turn.** An AI seat has no button; its take ends its turn and so
  the game in one transition, exactly as today. A networked human seat waits like a local one.
- **The kept turn after the last take is a real turn**: specials may still be played and are
  harmless — no special changes `collected` — and Rest stays refused. The turn is counted once, at
  End turn, so `turns` (the sheet's tie-break) is identical to the old one-step ending.
- **"Winning group's count" was read as the winning party's deciding count** under the sheet's p. 6
  rule: the winner's value at the first ascending-sorted position where it beats the best non-winner.
  One cell per winner. Where that value appears in several of the winner's groups, the first in
  `PX_GROUPS` order is ringed (the sheet itself is ambiguous there: "hipit tai farmarit"). When the
  win came from fewer turns, the turns cell is ringed. On a full tie of every party nothing is ringed
  because no count decided anything; in a draw between some parties, each tied winner gets the ring
  that beat the rest.
- **"Circle" is a CSS ring** (`.pxwin`), plus a one-line caption so the ring is explained; the
  caption is this spec's addition.
- **"The winner box" is the headline box at the top of `PolitixOver`**, and it lists every party in
  play with its members, not only the winner's — the requirement says "who was left, who was centre
  and who was right". The viewing seat reads "You"/"Sinä"; a shared display reads characters only.
- **Only the result screen is reordered.** `PX_PARTIES` stays right–centre–left because it is the
  order of every per-party record and of `pxWinner`'s tie order; the felt's score block, the party
  plates and the rail's `PolitixPlate` keep their current order.
- **The turn lines move into the grid** as its last row; a ring on a turns cell needs a cell to sit on.
- **A new hint line** (`hint.pxLastTaken`) is this spec's addition, so a player looking at an empty
  table knows End turn finishes the game.
- **`NET_VERSION` goes to 20**; no state field is added, so `SAVE_VERSION`, `politixHash` and
  `POLITIX_SCORES_VERSION` do not move.

## Touch points

- `src/game/reducer.ts` — `pxDoPlay` (keep-the-turn test after a take, its comment).
- `src/game/politix.ts` — new `pxDecider`; header comment on the game end.
- `src/components/screens/PolitixOver.tsx` — `RESULT_ORDER`, the `.pxresult` grid, the `pxwin`
  ring and caption, the `.pxwinner` box with member lines.
- `src/components/hand/Hint.tsx` — `hint.pxLastTaken` branch ahead of `hint.pxTook`.
- `src/index.css` — `.pxresult`, `.pxwin`, `.pxwinner`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `hint.pxLastTaken`, `pxOver.members`, `pxOver.circled`, two
  `rules.politix` items.
- `src/net/protocol.ts` — `NET_VERSION` 20 and comment.
- Tests: `src/game/reducer.test.ts`, `src/game/politix.test.ts`, `src/test/render.test.tsx`,
  `src/net/protocol.test.ts`, `src/net/session.test.ts`.
- Docs: `README.md`, `CLAUDE.md`, `docs/multiplayer.md`.

## Out of scope

- Changing the winner rule, the tie-break or `pxWinner`/`pxWinnerIds`.
- Reordering `PX_PARTIES`, the felt's score block, the party plates or `PolitixPlate`.
- Any change to what an AI seat plays or when its turn ends; any re-measurement.
- A confirmation dialog on End turn, or auto-ending the game after a delay (no new timer).
- Rewording `challenge.politix.t` (the single-player row's blurb), which stays true.
- The Politix board (`PolitixBoard`, `tupatro-politix-v1`) and its row shape.
- Everything delivered by
  [`2026-11-21-politix-limit-cards-to-needed-power`](2026-11-21-politix-limit-cards-to-needed-power.md)
  and [`2026-11-21-politix-no-mixed-plays-refill-on-end-turn`](2026-11-21-politix-no-mixed-plays-refill-on-end-turn.md)
  beyond the "ends at once" lines reversed above.

**Look at in the browser:** win the last voter card on your own turn — the table is empty, the hint
says End turn finishes the game, and End turn opens the result. On the result, at 1280x800 and
390x844 in both languages: three columns Left/Centre/Right with counts aligned under their headers,
one ring on the deciding count (not on the biggest number), the caption under it, and the headline
box listing each party's members with "You" on yours; repeat with a four-player game.

## Source

- **Politix rule sheet (Tahkokallio / Onni Games 2009), p. 4**: _"Tämän jälkeen peli jatkuu
  normaalisti, kunnes kaikki kansanryhmäkortit on kerätty pelipöydältä, jolloin peli päättyy
  välittömästi."_ — the game ends **immediately**. **Ending it on End turn contradicts this**; it is
  the requester's rule and is labelled so in the rules panel, README and `politix.ts`.
- **p. 6, "Pelin päättyminen ja pisteiden lasku"**: _"Peli päättyy, kun joku pelaajista saa
  politikoitua puolelleen viimeisen kansanryhmäkortin pelipöydältä."_ Parties compare the group
  they hold fewest of; the most there wins; a tie moves to the second fewest, and so on; a full tie
  goes to fewer turns. Its worked example (right 6/5/4/2/2/1 against left 6/5/5/3/2/1) is decided at
  the third-weakest group — the left's 3 workers against the right's 2 — which is the count
  `pxDecider` rings and the `politix.test.ts` case pins. Unchanged by this spec.
- Neither tuppi source (Oulunsalo club sheet, korttipeliopas.fi) applies; Politix is not tuppi.
