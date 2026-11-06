---
id: 2026-11-06-politix-side-piles-refill-deck
title: Draw three Politix action cards at the start of every turn, lay the voter cards in two rows, and stack the seats down the felt's right edge
kind: rule
status: proposed
source: Politix rule sheet (Touko Tahkokallio, Onni Games 2009), pp. 3–5 — this spec contradicts its p. 3 turn structure on the requester's word
---

# Draw three Politix action cards at the start of every turn, lay the voter cards in two rows, and stack the seats down the felt's right edge

## What

The requirement (Finnish, verbatim): _"pinoa jokaisen pelaajan kortit pelipöydän oikeaan laitaan
alekkain, että pelipöytä jää vapaaksi. jaa kansanryhmäkortit kahteen riviin pöydälle. kun pöydästä
otetaan, se täytetään aina nostopakasta, kunnes kansanryhmä pakka on tyhjä. joka vuorolla pelaaja
nostaa ensin 3 korttia (tämä voi olla automaatti)"_ — stack every player's cards at the right edge
of the table, one under another, so the table stays free; lay the voter-group cards in two rows;
refill the table from the deck after every take until the voter deck is empty; every turn the
player first draws three cards, automatically.

Four sentences, and they are three different things:

1. **A rule change (the reason for `kind: rule`).** Every Politix turn now begins with an
   automatic draw of three action cards (two under burnout). Drawing stops being a turn of its
   own: after the draw the player plays cards, rests (burnt out only), or **ends the turn** without
   playing. The hand limit of ten is checked at the end of every turn, not only after a draw.
2. **A layout change.** Politix's felt becomes two columns: the voter cards, the event, the score
   and the last-move line on the left, and the three seat areas (name, party, hand count and the
   pile of bonus cards) stacked one under another in a single column on the right. The voter cards
   lie in a grid of four columns, so the eight on the table make two rows of four.
3. **Already delivered: the refill.** `pxRefill` in `src/game/politix.ts` already tops the table up
   to `PX_TABLE` (8) from `voterDeck` after every take, an event surfacing on the way counts for
   nothing, and once the voter deck is empty the table simply shrinks. That is the sheet's p. 4
   rule, it is called from `pxDoPlay` in `reducer.ts`, and `reducer.test.ts` ("takes the
   affordable voter cards, banks them for the party and refills the table") pins it. This spec
   builds nothing for that sentence and adds one assertion so the non-exhausted case is pinned too.

## Acceptance criteria

### The turn (rule)

- [ ] **Every turn starts with the draw, inside the transition that starts it.** No new action, no
      new phase and no `nextTick` arm. A helper in `src/game/reducer.ts` (for example
      `pxBeginTurn(d, rng)`) draws `pxDrawCount(px, px.turn)` cards with `pxDrawCards` for the seat
      whose turn is beginning. It runs (a) in `startDeal`'s Politix arm right after `pxSetup`, for
      the starting seat, and (b) every time the turn passes to the next seat. It never runs after
      the game has ended. `pxSetup` itself is unchanged, so `politix.test.ts`'s setup case (every
      playing seat holds `PX_START_HAND` after `pxSetup`) still passes unedited.
- [ ] **Start of game.** A `reducer.test.ts` case starts a Politix game with `startChallenge` and
      asserts the starting seat (`px.turn`) holds `PX_START_HAND + PX_DRAW` (7) cards, the other two
      playing seats hold `PX_START_HAND` (4), and the sitting-out seat holds 0.
- [ ] **Every turn change draws for the next seat.** A case passes the turn from seat 0 and asserts
      that the next playing seat's hand grew by exactly `PX_DRAW`, by `PX_BURNOUT_DRAW` when that
      seat has a burnout, and that the seat which ended its turn drew nothing. A case with an empty
      draw pile and an empty discard pile asserts the draw takes what there is (0) and does not
      throw.
- [ ] **The draw does not overwrite the last move.** `px.last` after a turn change still describes
      the move of the seat that just ended its turn, not the automatic draw.
- [ ] **`pxDraw` is replaced by `pxPass`.** In `src/game/actions.ts` the member
      `{ type: "pxDraw"; p: Seat }` becomes `{ type: "pxPass"; p: Seat }`: ends the turn without a
      play and draws nothing. `grep -rn "pxDraw" src/` finds nothing. `SCOPE` in
      `src/net/protocol.ts` classifies `pxPass` as `"seat"`, `HASH_AFTER` lists it in place of
      `pxDraw`, and `protocol.test.ts`'s lists are edited to match. The reducer case opens with the
      same `pxGate(d, p, "pxturn", "human")` guard `pxDraw` had, and the "ignores every action from a
      seat that is not the one to move" case is edited to use `pxPass`.
- [ ] **`PxLast.what` gains `"pass"` and loses `"draw"`.** In `src/game/types.ts`,
      `what: "pass" | "rest" | "take" | "play"`. A pass writes `{ p, what: "pass", group: null, n: 0 }`.
- [ ] **The hand limit is checked at the end of every turn that does not end the game.** After a
      pass, a rest or a play (take or specials-only), if the game is not over and the seat holds more
      than `PX_HAND_MAX` cards: a `"human"` seat enters `pxdiscard` with the turn still its own, and
      an `"ai"` seat throws away `pxAiDiscard`'s cards inside the same transition. `pxDiscard` then
      ends the turn exactly as before, and the next seat draws. A take that empties the table ends
      the game at once (sheet p. 4, unchanged) with no discard step. `reducer.test.ts`'s "parks a
      human past the hand limit" case is rewritten around a pass from an eleven-card hand, and a
      second case asserts a specials-only play that leaves eleven cards also parks in `pxdiscard`.
- [ ] **Rest under the new turn.** A burnt-out seat has already drawn `PX_BURNOUT_DRAW` when it
      rests. `pxRest` still discards the burnout and ends the turn, and still refuses with
      `toast.pxNoBurnout` without one. The existing rest case keeps passing.
- [ ] **The AI.** `pxMove` in `src/game/politix.ts` returns `{ type: "pxPass", p }` wherever it
      returned `pxDraw`. The order and the heuristics are otherwise unchanged (including "rest under
      burnout with three cards or fewer"), and it still draws no randomness. In `aiPolitix`, a play
      the rule refuses falls back to a pass, not a draw, and the comment says so.
- [ ] **The player is told what was drawn.** When the beginning turn belongs to a `"human"` seat
      and at least one card was drawn, the reducer sets an addressed toast
      `{ key: "toast.pxDrew", vars: { n }, p }`, with `n` the number of cards actually drawn.
      `Toasts.tsx` already hides an addressed toast from every other seat and from a shared table. A
      reducer case asserts the toast's key, `p` and `n` for a human seat and that an AI seat's turn
      sets no such toast.
- [ ] **Measured, not guessed.** `politix.test.ts`'s "measured: 200 seeded all-bot games" case
      passes unedited with the new turn: every game ends within `PX_TURN_CAP`, all 42 voter cards
      are taken, the median total turns is in 20–150 (the floor was 30 until the first measurement under this rule gave a median of 26; a human lowered it to 20 on 2026-11-06), and each party's share of decided games is in
      20–47 %. README's Politix balance table (median, quartiles, 90th percentile, shortest/longest,
      mean, wins per party, draws, shares) is replaced with the figures that run produces. If the
      band does not hold, the implementation stops and reports. It does **not** retune needs, deck
      counts or the AI in this spec.
- [ ] **Versions.** `NET_VERSION` in `src/net/protocol.ts` is **15**, and its comment gets a
      sentence for v15: a v14 peer draws nothing at the start of a turn and knows no `pxPass`, so the
      first Politix turn change would diverge the hands. `POLITIX_SCORES_VERSION` in
      `src/game/scores.ts` is **3**, and `scores.test.ts` asserts a version-2 payload parses to `[]`.
      `SAVE_VERSION` is unchanged (Politix writes no snapshot). Every document that names the current
      network version says 15: `README.md` (the Politix section), `docs/multiplayer.md` and the
      `CLAUDE.md` lines that say "Current version **14**", "`NET_VERSION` is 14" and "The current
      version is **14**", each gaining v15's reason.
- [ ] **Already delivered: the refill, pinned in the non-exhausted case.** One more `reducer.test.ts`
      case: a table of eight with three of one group, a voter deck holding at least four group cards
      and one event, a play that takes all three of the group. It asserts the table is back to exactly
      `PX_TABLE` cards and that an event drawn on the way is `px.event` and not on the table.
      `pxRefill` and `pxDoPlay`'s call to it are unchanged.

### The felt (ui)

- [ ] **Two columns, seats on the right.** `PolitixBoard` in `src/components/table/PolitixTable.tsx`
      renders `.pxfelt` with exactly two element children: `.pxmain` first, holding `.pxhead`,
      `.pxgroups`, `.pxscore` and `.pxlast` in that order, and `.pxseats` last, holding the three
      `.pxseat` areas. Each `.pxseat` keeps its text column and its `.pxpile` exactly as
      `2026-11-06-politix-stacked-bonus-cards` built them. A render case in both locales asserts the
      children, their order and `.pxseats > .pxseat` ×3. The existing `.pxseat` ×3, `.pxpile`,
      `.privstage .pxseat` ×3 and voter-card assertions pass unedited.
- [ ] **The CSS says so.** In `src/index.css`'s `---------- Politix ----------` section, `.pxfelt`
      lays out as a row (`flex-direction:row`, or a two-column grid). `.pxseats` is a single column
      (`flex-direction:column`, or `grid-template-columns` with one track) and does not shrink below
      its content. `.pxmain` takes the remaining width and has `min-width:0`. The old
      `grid-template-columns:repeat(auto-fit,minmax(240px,1fr))` on `.pxseats` is gone.
- [ ] **Two rows of voter cards.** `.pxgroups` is `display:grid` with
      `grid-template-columns:repeat(4, …)`, and 4 is `PX_TABLE / 2`. `.pxvgroup` is
      `display:contents`, so copies of a group stay adjacent and in `PX_GROUPS` order and the DOM
      wrapper with `data-group` stays for the tests. Because `.pxvgroup` makes no box, every
      selector meant for the cards names `.pxvcard` rather than `.pxgroups > *` (see CLAUDE.md on
      `display:contents` wrappers). A case in `src/test/invariants.test.ts` reuses the
      comment-stripped `index.css` parse and asserts: `.pxgroups` declares
      `grid-template-columns:repeat(4`, where 4 is computed as `PX_TABLE / 2` in the test;
      `.pxvgroup` declares `display:contents`; `.pxseats` declares a column direction.
- [ ] **Phones fall back to one column, after the rules they override.** A
      `@media (max-width:560px)` block placed **after** the base Politix rules (source order, per
      CLAUDE.md) sets `.pxfelt` back to a column, with `.pxseats` below `.pxmain`, still one seat
      per row. The voter grid keeps four columns with tracks that may shrink
      (`minmax(0,1fr)`), so the cards still lie in two rows. The invariants case asserts this
      block exists and comes after the base `.pxfelt` rule.
- [ ] **Controls and text.** In `PolitixHand.tsx` the Draw button becomes an End turn button
      (`MoveButton`, `btn ghost`) dispatching `pxPass`. In `src/i18n/fi.ts` and `src/i18n/en.ts`:
  - `px.btn.draw` and `px.last.draw` are removed;
  - `px.btn.pass` is added: fi "Lopeta vuoro", en "End turn";
  - `px.last.pass` is added: fi "{who} lopetti vuoron pelaamatta.", en "{who} ended the turn
    without playing.";
  - `toast.pxDrew` is added: fi "Nostit {n} toimintakorttia.", en "You drew {n} action cards.";
  - `hint.pxTurn` is rewritten to say the cards are already drawn: fi "Sinun vuorosi: kortit on
    nostettu. Valitse pelattavat kortit tai lopeta vuoro.", en "Your turn: your cards are drawn.
    Select the cards to play, or end your turn.".

  `PolitixBoard`'s last-move switch handles `"pass"`, with no `"draw"` branch left. The render
  sweep passes in both locales, and a render case on the player's own `pxturn` asserts
  `px.btn.pass` is drawn and `px.btn.draw` text is not.

- [ ] **The rules panel and README tell the new turn.** In both catalogues, the `rules.politix`
      line "On your turn you either draw three … or play cards" is replaced by: every turn begins by
      drawing three action cards automatically (two when burnt out); then you play cards, end your
      turn, or, when burnt out, rest; the hand limit of ten applies at the end of every turn. The
      first line's "The sheet gives the turn structure" is amended to say the automatic draw is the
      player's own rule and the sheet makes drawing and playing alternatives. `README.md`'s Politix
      section gets the same two edits ("A turn is either drawing three action cards… or playing
      cards" and "The sheet gives the turn structure"). `i18n.test.ts`'s list-length check passes.
- [ ] **Gates.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` pass. The
      layout is checked by eye. A reviewer opens single player, then Politix, and checks:
  - At 1280x800 and 1280x500, the three seat areas are one column at the felt's right edge, one
    under another, and the voter cards are two rows of four to their left with nothing overlapping.
  - At 844x390, the same, with the felt scrolling inside itself and the hand and action bar on
    screen.
  - At 390x844, the seat areas are below the voter cards, the voter cards are still two rows of
    four, and no Finnish group name ("Toimihenkilöt", "Maanviljelijät") is clipped.
  - A 13-card hand (ten held, three drawn) on a phone pans inside the hand row, and End turn is
    reachable.

## Assumptions

- **This contradicts the Politix rule sheet, and the requirement wins.** Sheet p. 3: on a turn a
  player may _either_ "ottaa 3 toimintakorttia lisää käteensä" _or_ "pelata kädessään olevia
  kortteja", and "Nämä vaihtoehdot ovat toisensa poissulkevia" (the two are mutually exclusive).
  The requester asks for a draw at the start of every turn followed by play. Politix is the
  requester's own mode beside the sheet (the deck split and the scandal groups are already the
  requester's notes, not the sheet's), so this is written as a house rule. The rules panel and the
  README must say so and not credit it to the sheet. **If the reviewer wants the sheet's turn back,
  revert this spec's rule half; the layout half stands on its own.**
- **Drawing stops being a choice, so a turn needs a way to end without playing.** That is the new
  `pxPass` ("End turn"). It replaces `pxDraw` instead of sitting beside it, because a second draw
  in one turn is not in the requirement and would give six cards a turn. The alternative, a play
  being mandatory, was rejected: a hand that can take nothing would have no legal move.
- **Burnout still draws two, not three.** The requirement says "3", but the sheet's only burnout
  penalty is drawing two instead of three (p. 5). An always-three draw would make burnout do
  nothing until it is shed. "3" is read as the normal case.
- **A burnt-out seat draws its two before it may rest.** The sheet's rest is chosen "vuoronsa
  aluksi" (at the start of the turn) and loses the turn. The requirement puts the draw first in
  every turn, so the draw happens and the rest then loses only the play.
- **The hand limit moved from after-a-draw to end-of-turn.** The sheet already says end of turn
  (p. 3: "Pelivuoronsa loputtua … korkeintaan kymmenen korttia"). The old code only checked after
  a draw because a draw was the only way to grow the hand. Now the draw starts the turn, so the
  check runs after pass, rest and play. A hand can therefore reach 13 during a turn.
- **The automatic draw is not a "last move".** The felt's last-move line keeps describing what the
  previous seat did. The drawing seat is told by an addressed toast instead, so the other windows
  do not learn its hand size from a broadcast line (the hand counts on the felt already show that
  publicly anyway).
- **The board's rows are discarded.** `POLITIX_SCORES_VERSION` goes 2 → 3 because rows rank by
  fewest turns, and turns under the new rule are not comparable with turns under the old one. This
  follows Rock-Paper-Scissors' precedent (its board version bumped when its rule changed). It
  wipes every player's existing Politix board, once.
- **"Each player's cards" means each seat's area: name, party, hand count and bonus-card pile.** It
  does not mean the hand. The hand is the bottom row and is private. The piles keep their internal
  layout from `2026-11-06-politix-stacked-bonus-cards` (text left, overlapping faces right). Only
  where the seat areas sit changes.
- **This is the layout the previous spec put out of scope.** `2026-11-06-politix-stacked-bonus-cards`
  (delivered in `ba56022`) read "on the right-hand side" as the right of each seat's own area and
  listed "one shared column of bonus cards at the felt's right edge" under Out of scope, saying it
  would be "a layout change on top of this one". This is that change. It reverses nothing that
  spec built.
- **"Two rows" means a four-column grid, not fixed slots.** Eight cards make two rows of four.
  Fewer cards, once the voter deck is empty, fill row by row, so the second row shortens and then
  disappears. Copies of a group stay adjacent and in `PX_GROUPS` order, as the previous spec
  required, so a refilled card goes where its group sorts and not into the slot a taken card left.
  Fixed slots would contradict that spec's grouping, which nobody asked to undo.
- **On a phone the "right edge" cannot hold.** At 390 px wide, a seat column (≈240 px with its pile)
  would leave the voter cards about 120 px. Below 560 px the seats therefore go under the voter
  cards. This is a deviation from the requirement's words, forced by the width.
- **The refill sentence is read as describing what is already built.** "nostopakasta" (from the
  draw pile) is read as the voter deck, the only pile voter cards come from. Nothing in the code
  refills from the action draw pile, and the requirement does not ask for that to change.
- **The previous Politix specs are reversed on the turn structure only.** That is
  `2026-11-04-rework-politix-three-parties` ("a seat's draw turn draws `PX_BURNOUT_DRAW`…" and the
  AI's "else draw") and `2026-11-04-politix-multiplayer-lobby` (`NET_VERSION` 14, and `pxDraw` in
  `HASH_AFTER`). Everything else they delivered stands.

## Touch points

- `src/game/reducer.ts`: the Politix arm of `startDeal`, `pxEndTurn` (turn change, hand-limit
  check, next seat's draw, now taking `rng`), `pxDoDraw` replaced by a pass, `pxDoRest`,
  `pxDoPlay`, the `pxDraw` → `pxPass` case, `pxDiscard`, and `aiPolitix`'s fallback.
- `src/game/politix.ts`: `pxMove` (pass instead of draw), the header comment (the turn reading),
  and the AI comment.
- `src/game/actions.ts`: `pxDraw` → `pxPass`, and the comment.
- `src/game/types.ts`: `PxLast.what`.
- `src/net/protocol.ts`: `NET_VERSION` 15 and its comment, `SCOPE`, `HASH_AFTER`.
- `src/game/scores.ts`: `POLITIX_SCORES_VERSION` 3.
- `src/components/hand/PolitixHand.tsx`: End turn button.
- `src/components/table/PolitixTable.tsx`: `.pxmain` / `.pxseats` structure, the `"pass"`
  last-move line.
- `src/index.css`: the Politix section (`.pxfelt`, `.pxmain`, `.pxseats`, `.pxgroups`,
  `.pxvgroup`, and a trailing `max-width:560px` block).
- `src/i18n/fi.ts`, `src/i18n/en.ts`: `px.btn.pass`, `px.last.pass`, `toast.pxDrew`,
  `hint.pxTurn`, `rules.politix`; remove `px.btn.draw` and `px.last.draw`.
- Tests: `src/game/reducer.test.ts`, `src/game/politix.test.ts` (any `pxDraw` reference),
  `src/net/protocol.test.ts`, `src/game/scores.test.ts`, `src/test/render.test.tsx`,
  `src/test/invariants.test.ts`.
- Docs: `README.md` (Politix rules and balance table, `NET_VERSION`), `docs/multiplayer.md`,
  `CLAUDE.md` (the `NET_VERSION` lines and the Politix paragraph naming `pxDraw`).

## Out of scope

- The refill rule: already delivered (`pxRefill`), and only pinned here.
- Retuning needs, deck counts, `PX_HAND_MAX`, `PX_START_HAND` or the AI's heuristics, even if the
  measurement moves. A failed band is reported, not tuned.
- An AI that plays differently because it now draws every turn.
- Fixed voter-card slots, or animating a draw, a take or a refill.
- Changing the bonus-card pile itself (faces, overlap, order). See
  `2026-11-06-politix-stacked-bonus-cards`.
- Showing the hands of other seats, or how many cards each drew, beyond the existing hand counts.
- Any other mode, and the rail's `PolitixPlate` and `PolitixOver`.

## Source

- **Politix rule sheet, Touko Tahkokallio / Onni Games 2009**
  (<https://lautapeliopas.fi/wp-content/uploads/2009/06/Politix_ohjeet.pdf>), read for this spec:
  - p. 3: "Jokaisella pelaajalla on pelivuorollaan kaksi eri mahdollisuutta … a) ottaa 3
    toimintakorttia lisää käteensä tai b) pelata kädessään olevia kortteja. Nämä vaihtoehdot ovat
    toisensa poissulkevia." **Contradicted** by the requirement's automatic draw. The house rule
    wins, and the rules panel and README credit it to the player, not the sheet.
  - p. 3: at most ten cards in hand at the end of a turn. Kept, and now checked after every turn.
  - p. 4: after a take the table is refilled to eight, an event goes on top of the previous one,
    and once the voter deck runs out the game goes on with fewer. Already implemented by
    `pxRefill`; matches the requirement's third sentence.
  - p. 5: a burnt-out player who draws takes two instead of three, and may rest at the start of
    the turn, losing it. The two-card draw is kept. Resting now follows the automatic draw.
  - p. 2: eight voter cards are turned up "pelialueen keskelle" (in the middle of the play area).
    The sheet says nothing about rows. The two-row layout is presentation only.
- The Oulunsalo senior tuppi club's rule sheet and korttipeliopas.fi do not apply: Politix is not
  tuppi.
