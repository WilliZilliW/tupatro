---
id: 2026-09-25-rps-draw-higher-card-wins
title: Break a tied Rock-Paper-Scissors round by rank — the higher card of the same throw wins
kind: rule
status: proposed
source: >
  No source. Rock - Paper - Scissors - Aluminium Foil is this game's own side mode, not tuppi; neither
  the Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) nor
  korttipeliopas.fi/tuppi knows it, and Official WRPSA Rock Paper Scissors Rules v1.0 has no cards
  and no ranks. The high-card tie-break is the requirement's own house rule. The rank order (2 low,
  ace high, `Card.r` 2..14) is the one the rest of the game already uses for tuppi's own trick
  winner.
---

# Break a tied Rock-Paper-Scissors round by rank — the higher card of the same throw wins

## What

In Rock - Paper - Scissors - Aluminium Foil (`g.challenge === "rps"`), two cards of the same throw
no longer tie the round: the card with the **higher rank** takes it, ace high. The deck holds one
of each card, so after this every round in a real match has a winner, and all twelve rounds count
for one side or the other. A drawn **match** (6–6) is still a real result.

The player therefore has a reason to care about rank for the first time in this mode. A high heart
is a stronger paper than a low one.

## Prior specs and documents

- **This reverses one explicit decision of `2026-09-19-card-based-rock-paper-scissors`, which is
  delivered and in the tree.** Its Out of scope line _"Rank mattering anywhere: no high-card
  tie-break inside a suit, no ordering of the 13 hearts"_, its criterion _"it asserts the outcome is
  unchanged when either card's rank is replaced by any other rank of the same suit, so no high-card
  tie-break can creep in"_, and its reading _"two cards of the same suit tie the round"_ are all
  **reversed here, and this spec wins**. The user's requirement asks for exactly that reversal.
  Everything else that spec delivered stands: the four-throw table, the two club honours, Sofia,
  12 rounds, no replayed round, the draw as a real match result, and the board.
- **Its tie-counts-for-neither-side rule stays in the code but can no longer be reached in a
  match.** `resolveRps`'s `if (cmp !== 0)` guard is still correct, since `rpsCompare(x, x)` must
  still answer 0. With one of each card in the deck, two different cards never compare equal after
  this change.
- **Overlaps `2026-09-23-rps-two-player-multiplayer` (delivered) in one place only.** That spec put
  Rock-Paper-Scissors in the lobby (`LOBBY_MODES` includes `"rps"`), and its out-of-scope line
  _"Any change to the throw table, the two club honours, Sofia's rule…"_ was a scope limit for that
  spec, not a ban. Because two humans can now play this mode over the wire, a v12 peer and a v13
  peer would score a same-throw round differently (`rpsWins` is in `hashState`). That is the reason
  for the `NET_VERSION` bump below. Nothing else from that spec changes.
- **Not already delivered.** `src/game/rps.ts`'s `rpsCompare` returns 0 for any two cards of the
  same throw, and `rps.test.ts` pins the rank-blindness this spec removes.

## Acceptance criteria

- [ ] **`rpsCompare` in `src/game/rps.ts` breaks a same-throw tie by rank.** When both cards are
      ordinary throws (neither the ♣K, the ♣Q nor Sofia) and `rpsThrowOf(a) === rpsThrowOf(b)`, it
      returns `1` if `a.r > b.r`, `-1` if `a.r < b.r`, and `0` only if `a.r === b.r`. Different
      throws are still decided by `beats` alone, whatever the ranks are.
- [ ] **The honours come before rank, unchanged.** The ♣K still beats every other card, the ♣Q
      every card but the ♣K, and Sofia (♥Q) still loses to **every** other card, including a lower
      heart: `rpsCompare(C("H", 2), C("H", 12))` is `1`. A foil pairing between two ordinary clubs
      is decided by rank (`rpsCompare(C("C", 14), C("C", 11))` is `1`), and the ♣K and ♣Q are never
      treated as foil.
- [ ] **`src/game/rps.test.ts` pins the new rule.** The `"two hearts tie"`, `"two spades tie"`,
      `"two diamonds tie"` and `"two ordinary clubs tie"` table rows become higher-rank-wins rows
      in both directions (for example `C("H", 7)` vs `C("H", 2)` → `1`, and the reverse → `-1`),
      including an ace-over-king row (`C("S", 14)` vs `C("S", 13)` → `1`). The rank-blindness test
      `"gives the same answer for every rank of the same two suits"` is replaced by two tests:
      (a) for every pair of **different** suits the answer does not depend on either rank, and
      (b) for every same-suit pair of ordinary cards the sign matches `Math.sign(ra - rb)`. The
      antisymmetry sweep (`rpsCompare(a, b) + rpsCompare(b, a) === 0`, and `rpsCompare(x, x) === 0`
      for every card in the 52-card deck) still passes unchanged.
- [ ] **No two distinct cards of the deck tie.** A test over every ordered pair of distinct cards in
      `makeRpsDeck(mint)` asserts `rpsCompare(a, b) !== 0`.
- [ ] **`src/game/reducer.test.ts`'s `"counts a tied round for neither side and does not replay it"`
      is rewritten.** With `C("H", 4)` against `C("H", 9)` in `rpsCards`, `resolveRps` gives the
      round to the side holding the ♥9: its team's `rpsWins` is 1, the other's 0, `rpsRound` is 1
      and the phase is `rpsthrow`.
- [ ] **The headless sweep reflects it.** In `reducer.test.ts`'s `"Rock-Paper-Scissors, measured
over many seeded matches"` block, every match ends with `rpsWins[0] + rpsWins[1] ===
RPS_ROUNDS` (no round goes to neither side), and `"produces every one of the three results
somewhere in the sweep"` still finds a draw. If the sweep's 300 seeds produce no 6–6 match,
      the implementer reports that and does not weaken the assertion.
- [ ] **The golden in `reducer.test.ts`** (`"pins a whole single-human match's final wins, round
and rngState for a fixed seed"`, seed `RPSGOLDEN`) is re-pinned. `rpsWins` may move from
      `[4, 6]` and must now sum to 12. `rngState` must stay `-639918860`, because this change draws
      no extra randomness. If `rngState` moves, that is a bug, not a re-pin.
- [ ] **`NET_VERSION` in `src/net/protocol.ts` becomes `13`**, with one sentence added to the version
      history comment saying that a v12 peer counts a same-throw round as a tie and would diverge
      `rpsWins` from a v13 peer in a two-human match. The two pinned assertions
      (`protocol.test.ts` and `session.test.ts`, `toBe(12)`) become `toBe(13)`. `SCOPE`, `parseMsg`,
      `guestMay`, `hashState` and the `NetMsg` union do not change.
- [ ] **The felt tells the player.** A new catalogue key `rps.rankRule` is added to `src/i18n/fi.ts`
      and `src/i18n/en.ts` (en: "Two cards of the same throw: the higher card wins. Ace is high.", or
      equivalent), with no placeholders, and `RpsTable.tsx` draws it in the same legend block as
      `rps.foilRule`, `rps.clubsRule` and `rps.sofiaRule`, every round. `render.test.tsx` asserts
      it appears on the RPS felt in both languages.
- [ ] **The rules panel is true.** In `rules.rps`, in both catalogues: the line saying _"Rank decides
      nothing anywhere else: the thirteen hearts are the same card in this mode"_ /
      _"Arvo ei ratkaise muualla lainkaan…"_ is rewritten to say rank breaks a same-throw round,
      ace high. The line _"Two cards of the same throw are a tie…"_ / _"Kaksi samaa heittoa on
      tasapeli…"_ is rewritten to say the higher card wins, except that Sofia loses to any other
      card. The list has the same length in both catalogues. The Sofia line (_"…even another heart,
      which would otherwise tie her"_) is reworded so it no longer claims hearts tie.
- [ ] **README.md and CLAUDE.md are true.** README's `## The challenges: Rock-Paper-Scissors`
      section no longer says same-suit cards tie or that rank means nothing. Its
      `### Rock-Paper-Scissors` balance section is re-measured with the same 500-seed method
      (`RPSM0`…`RPSM499`): the won/lost/drawn table, the tied-round count (which should be 0 of
      6,000), the 3σ check on the won/lost gap, and the wins-when-revealed table by throw. The
      measuring script is thrown away afterwards. In CLAUDE.md's Rock-Paper-Scissors section, the
      sentence _"Rank decides nothing anywhere else, and `rps.test.ts` pins that over every rank of
      every suit"_, the tie wording in the `RPS_ROUNDS` bullet, and the `rps.test.ts` row in the Tests
      table (`rank-blindness`) are updated to match.
- [ ] **All gates pass:** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

## Assumptions

- **"Draw" means a tied round, not a drawn match.** The requirement says "in draw bigger card value
  should win" and names a single card, which only makes sense for a round (two cards meet). A drawn
  match (6–6 after 12 rounds) is **left as a draw**, not broken by comparing card totals or the last
  card played. If the user meant the match, this spec is wrong and the drawn-match result screen
  needs a tie-break instead.
- **"Card value" means rank, ace high: 2 < 3 < … < 10 < J < Q < K < A (`Card.r` 2..14).** This is
  the order tuppi's own `currentWinner` uses. It is **not** the chip value (`chipValue`), which this
  mode does not show (no chip corner in `"rps"`) and which the player cannot see. Ace low was not
  considered, since nothing else in the game plays the ace low in trick-taking.
- **Only a same-throw pairing is broken by rank.** Different throws are still decided by `beats`
  alone, so a ♥2 still beats a ♠A (paper covers rock). "Draw" only happens between same-throw
  cards, so the tie-break applies only there.
- **The three honours stay absolute and are decided before rank.** The ♣K and ♣Q were never throws
  and never tie. Sofia (♥Q) keeps her "always loses" rule even against a lower heart, so a ♥2 beats
  her even though Q outranks 2. The requirement did not mention her. Letting her rank count would
  quietly undo the delivered "always loses" rule, so it was not done.
- **Two ordinary clubs (foil against foil) are broken by rank like any other throw**, ace high. The
  ♣K and ♣Q are not foil, so they never enter this comparison.
- **The tie code paths are kept, not deleted.** `rpsCompare(x, x) === 0` is still required by the
  antisymmetry test. `resolveRps`'s `cmp !== 0` guard, the `rps.tied` catalogue key, `RpsTable`'s
  tie branch and the "both cards fly off on a tie" CSS stay, even though a real match can no longer
  reach them. Removing them is cleanup for another spec, and it would touch the render sweep's
  fixtures.
- **`NET_VERSION` is bumped to 13 even though the wire shape does not change.** Two humans can play
  this mode through the lobby, and a mixed-version pair would diverge on `rpsWins` at the first
  same-throw round. CLAUDE.md sets the rule ("a reducer rule change can require a network-version
  bump even with an unchanged wire shape"), and v3/v6/v7/v10/v12 followed it.
- **`SAVE_VERSION` stays 3 and `RPS_SCORES_VERSION` stays 2.** No state shape changes, and this mode
  writes no snapshot. Board rows filed under the old tie rule stay on `tupatro-rps-v1` and are
  sorted with the new ones. This was a judgement call: they were played under a slightly different
  rule, but a board row records wins and losses the same way under both rules, and bumping would
  wipe every player's board for a tie-break.
- **The game's own opponent does not change.** It still reveals uniformly at random, so it takes no
  advantage of rank. Teaching it to spend high cards well is out of scope.
- **A new felt line (`rps.rankRule`) is included, although the requirement did not ask for one.**
  Every other special rule in this mode has a line on the felt, and a rule the screen does not show
  makes a player think the round was scored wrongly.

## Touch points

- `src/game/rps.ts` — `rpsCompare`: same-throw branch compares `a.r` with `b.r`; its header comment
  and `rpsCompare`'s comment drop "rank never enters it" and record the tie-break as the house rule.
  Record that it has no source, and note that it reverses the 2026-09-19 decision.
- `src/game/rps.test.ts` — the table rows, the rank-blindness test replaced by the two tests above,
  a no-two-distinct-cards-tie sweep over the deck.
- `src/game/reducer.ts` — the comment above `resolveRps` (a tie is now unreachable in a match; the
  guard stays for `rpsCompare(x, x)`). No logic change.
- `src/game/reducer.test.ts` — the rewritten tie case, the sweep's sum assertion, the re-pinned
  `RPSGOLDEN` wins.
- `src/net/protocol.ts` — `NET_VERSION` 13 and one sentence of history;
  `src/net/protocol.test.ts`, `src/net/session.test.ts` — the two pinned values.
- `src/components/table/RpsTable.tsx` — draw `rps.rankRule` in the legend.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `rps.rankRule`; three `rules.rps` lines rewritten.
- `src/test/render.test.tsx` — assert `rps.rankRule` on the RPS felt in both locales.
- `README.md` — the RPS rules section and the re-measured `### Rock-Paper-Scissors` balance section.
- `CLAUDE.md` — the RPS section's rank and tie sentences and the Tests-table row.

## Out of scope

- Breaking a drawn **match** (6–6) by any means. It stays a draw on `RpsOver` and on the board.
- Changing the throw table (`BEATS`), the two club honours, Sofia's always-loses rule,
  `RPS_ROUNDS`, `RPS_HAND` or the deck. See `2026-09-19-card-based-rock-paper-scissors`.
- Using rank for different throws, or any rank-based points, bonus or score.
- A smarter opponent that saves high cards or honours.
- Deleting the now-unreachable tie paths (`rps.tied`, the tie branch in `RpsTable`, the both-fly-off
  CSS).
- Showing a chip value or a rank number anywhere new. The card face already shows the rank.
- Every other mode. `currentWinner`, `legalCards`, `evalTrick`, `scoreTrick` and `chipValue` are
  untouched.
- The lobby, `SCOPE`, `hashState`, `parseMsg`, `guestMay` and `NetMsg`, apart from the version
  number.

## Source

- **Official WRPSA Rock Paper Scissors Rules v1.0** (<https://wrpsa.com/rules>): the three-way cycle
  only. It has no cards and no ranks, so it says nothing about breaking a tie by rank. Its own
  answer to a tie, a replay, was already overruled by `2026-09-19-card-based-rock-paper-scissors`.
- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** and
  **<https://korttipeliopas.fi/tuppi>**: neither knows this mode. It makes no claim on tuppi's name
  and uses no tuppi term. The only thing borrowed from tuppi is the rank order, ace high, which is
  how tuppi decides a trick among cards of the led suit and how `rv`/`currentWinner` already order
  `Card.r`.
- **Chosen reading, which also belongs in the comment above `rpsCompare`:** same throw → higher
  rank wins, ace high. The honours are decided first. Sofia loses to every other card whatever its
  rank. This is the requirement's own house rule, with no source.
