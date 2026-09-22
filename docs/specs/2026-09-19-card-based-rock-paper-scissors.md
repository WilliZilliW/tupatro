---
id: 2026-09-19-card-based-rock-paper-scissors
title: Play Rock-Paper-Scissors from a card hand — four suits, four throws, twelve rounds
kind: rule
status: proposed
source: >
  The three-way cycle is still Official WRPSA Rock Paper Scissors Rules v1.0 (<https://wrpsa.com/rules>).
  **Everything else here has no source and is the requirement's own house rule**: no authority maps
  hearts/spades/diamonds onto paper/rock/scissors, none knows a King of Clubs that beats every card
  or a Queen of Clubs that loses only to it, and the WRPSA's own replayed tie and first-to-two match
  are both overruled by the requirement's "most wins over a fixed number of rounds takes it" —
  twelve rounds, after the in-flight amendment, and aluminium foil as a fourth throw for ♣ has no
  source either. Neither tuppi
  source knows the mode at all — the Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September
  2022) and <https://korttipeliopas.fi/tuppi> describe a four-handed trick-taking game built on the
  rami/nolo declaration. It therefore ships the way Tuppi-Rummikub's laydown and Nami's point tables
  do: as this game's own side mode, labelled as such, never as tuppi. See **Source** below.
---

# Play Rock-Paper-Scissors from a card hand — four suits, four throws, twelve rounds

> **The requirement was extended three times mid-build.** The **What** and **Acceptance criteria**
> sections below are the original 41-card, three-round reading and are kept for the reversals they
> record; **Amended in flight** is what shipped. Read that section first.

## What

The seventh rule set stops being a blind throw and becomes a card game. Both players are dealt
**three cards** from a **41-card deck** — all of ♥, ♠ and ♦, plus the ♣K and ♣Q and no other club —
and over **exactly three rounds** each reveals one card at a time. A suit is a throw (♥ paper, ♠
rock, ♦ scissors) resolved by the ordinary cycle, two cards of the same suit tie the round, and the
two clubs are trumps: the **♣K beats every other card**, the **♣Q beats every other card except the
♣K**. Whoever wins more of the three rounds wins the match; equal wins is a **drawn match**, which
is a thing this project has never had before.

The player therefore has a decision for the first time in this mode — which of three cards to spend,
and when to spend the trump — instead of a coin flip in three costumes.

## Prior specs and documents

- **Reworks `2026-09-18-rock-paper-scissors-mode`, which is in the tree (its file still reads
  `status: proposed`; `CLAUDE.md` is the record of what is built). Four of its criteria are reversed
  and this reading wins.** Named, because a reversal is the thing a reviewer must see:
  1. _"First to two decided rounds; a tie is replayed and counts as nothing"_ → **exactly three
     rounds are played**, a tie counts as nothing and is **not** replayed, and a match may be drawn.
  2. _"No card is dealt and no card randomness is spent … `uidSeq` never moves"_ → **41 cards are
     minted and shuffled** per match and `uidSeq` moves by 41.
  3. _"`RpsThrowPanel`'s three buttons are the decision"_ → **the hand is the decision**; the panel
     keeps the prose and the legend and loses its buttons.
  4. Its Out of scope line _"Cards, a trick, a declaration or a wallet in the mode"_ → **cards, yes**.
     No trick, no declaration and no wallet: those three stay out.
- **That spec's own objection to this format was correct, and this spec pays for it.** It rejected
  "exactly three rounds, most wins takes it" because a match _"can end 1–1 with a tie, and there is
  no draw state anywhere in this project to put that in"_. A draw state is added here, scoped to
  this mode's result screen and board and to nothing else. Everything else that spec delivered
  stands unchanged — two players not four, `rpsFoe`, the two phases, the `rpsreveal` loop guard, the
  `auto` `resolveRps`, the single-player-only reach, the `tupatro-rps-v1` board and the `SCOPE`
  pair.
- **Relies on `2026-09-19-traditionally-coloured-match-cards` (proposed, in flight) and contradicts
  nothing in it.** That spec gives the two-colour deck to Traditional Tuppi and the Race only and
  names Rock-Paper-Scissors among the modes that keep the four-colour deck of
  `2026-09-16-four-suit-colors`. That is now load-bearing rather than incidental: in this mode the
  suit **is** the throw, so four distinguishable suit colours are what makes a hand readable at a
  glance. Neither spec's behaviour changes; this one records the new dependency.
- **Touches `2026-09-18-king-of-clubs-ikiliikkuja` (in the tree) in one place only.** That spec put
  `isKingOfClubs` in `game/cards.ts` so the ♣K portrait and Tupatro's Ikiliikkuja draw could never
  name different cards. This spec adds a third reader of the same question and moves
  `isQueenOfClubs` — today a local `const` inside `PlayingCard.tsx` — down beside it for the same
  reason. **Ikiliikkuja itself does not change**: that draw is gated on `d.challenge === "tupatro"`
  and `playCardInner` is not reached in this mode at all, so a ♣K played here draws nothing.
- **Overlaps `2026-09-14-per-challenge-continue` and takes nothing from it, as before.** The mode
  still reaches no screen between its first reveal and its result, so no snapshot is written and no
  Continue from disk is ever offered.
- **Nothing here is already delivered.** `grep -n "makeRpsDeck\|rpsCompare\|rpsThrowOf" src/` finds
  nothing, `src/game/rps.ts` holds `RPS_THROWS`/`beats`/`rpsOver`/`rpsWinner`/`rpsFoe` and no card,
  and `startDeal`'s `"rps"` arm still returns before `dealCards`.

## Amended in flight, 22 September 2026 — and these readings win

The requirement was extended three times while the build was under way, and each extension
**reverses** a criterion below rather than adding to it. The criteria are left as written, because a
reviewer has to see what moved; where they disagree with this section, **this section is what
shipped**.

1. **A fourth suit is a fourth throw: ♣ is aluminium foil.** The suit mapping becomes ♥ paper,
   ♠ rock, ♦ scissors, **♣ aluminium foil**, and `RpsThrow` gains `"foil"`. Consequences, each
   reversing something below:
   - **The deck is the ordinary 52, not 41.** A deck holding only the two club honours would leave
     the fourth throw unplayable, so `makeRpsDeck(mint)` returns `makeDeck(mint)` and `uidSeq` moves
     by **52**. The "exactly the 41 named cards" criterion is withdrawn.
   - **The two clubs stay, as honours rather than as the only clubs.** The ♣K still beats every
     card and the ♣Q everything but the ♣K; `rpsCompare` decides them ahead of the throw table, and
     `rpsThrowOf` answers `null` for exactly those two cards and `"foil"` for every other club. The
     portraits and the rule still read the same two predicates in `game/cards.ts`.
   - **`beats` is a `Record<RpsThrow, RpsThrow[]>`.** Foil takes two pairings — it **wraps rock and
     paper, and only scissors cut it** — which the old one-to-one map could not express.
   - **The table cannot be fair, and that is arithmetic.** Six pairings over four throws is 1.5
     wins each, so a table deciding every pair of different throws cannot make them equally strong;
     the fair alternative (a four-cycle whose two diagonals tie) cannot contain WRPSA's three edges,
     because those three already close a cycle of their own. The edges stay: scissors and foil win
     two pairings, rock and paper one. The asymmetry is **between throws, never between players** —
     both sides reveal from the same deck — and the README measures exactly that.
   - **No source, again.** Aluminium foil as a throw is the requirement's own invention, with no
     published rule set behind it, and `rps.ts`, `rules.rps` and the README all say so beside the
     line that already says the mode is not tuppi.
2. **Twelve cards each, and every one of them is played.** `RPS_HAND` and `RPS_ROUNDS` are both
   **12** — deliberately one number twice, since a hand is spent one card per round, so the match
   ends when the hands do and a round nobody has a card for cannot be asked for. Every "three cards"
   and "exactly three rounds" below reads as twelve. The draw stays, and is now reachable in far
   more ways (any even split of the decided rounds).
3. **A revealed card is placed face down and both turn together.** Selecting a card puts it on the
   felt **face down**; a beat later both cards turn at once. It is a `.rpsdown` overlay with one
   delayed CSS animation and a matching delayed fade on the verdict line — **no new phase, no new
   state and no new timer**: the slot is keyed by `uid`, so it mounts once a round and turns once
   (the trick's drop animation's own argument). **`nextTick`'s `rpsreveal` delay is widened from
   900 ms to 1400 ms**, which is the one thing this costs outside CSS: face down until 0.4s, turning
   until 0.7s, verdict from 0.72s — measured in a browser at 900 ms, the round resolved while the
   verdict was still fading in. `useGameLoop` remains the only `setTimeout` call site.

**What did not move**: two players not four, the opponent's card drawn before the player can act,
the two phases, the `rpsreveal` loop guard, the `auto` `resolveRps`, `revealRps`'s five guards and
its `uid` identity, `rpsCards` replacing `rpsThrows`, the hidden chip corner, single-player-only
reach, `SAVE_VERSION` 3, `NET_VERSION` unmoved, the `tupatro-rps-v1` board at
`RPS_SCORES_VERSION` 2, and the draw as a real result on the screen and in the row.

**Measured after the amendments**, since every earlier figure was for a different game: 500 seeded
matches (`RPSM0`…`RPSM499`), all settled in exactly twelve rounds, won 41.8% / lost 44.8% / drawn
13.4%, the won–lost gap 7.5 against a 3σ tolerance of 31.2, revealed suit shares within 0.3 points
of the deck's own 25%, and the ♣K winning **every** one of the 226 rounds it appeared in (the ♣Q
every one of its 236 bar the ♣K's). The full table is in README.md.

## Acceptance criteria

- [ ] **The deck is exactly the 41 named cards.** `makeRpsDeck(mint: Mint): Card[]` in
      `src/game/rps.ts` returns ranks 2–14 of ♥, ♠ and ♦ plus ♣13 and ♣12, and nothing else.
      `rps.test.ts` asserts: length 41; exactly 13 hearts, 13 spades and 13 diamonds; exactly two
      clubs, with ranks 13 and 12; all 41 `uid`s distinct; every `enh` null. `makeDeck` (52 cards)
      is untouched and `rules.test.ts`'s deck cases do not move.
- [ ] **Three cards each, to two seats, from the run's own `Rng`.** The `"rps"` arm of `startDeal`
      shuffles `makeRpsDeck(mint)` with the reducer's `rng` cursor and deals `RPS_HAND` (`3`, in
      `constants.ts`) to `ownerSeat(d)` and to `rpsFoe(d)`. `reducer.test.ts` asserts after
      `startChallenge {id:"rps"}`: both those hands hold 3 cards, the other two seats' hands are
      empty, every card is distinct and comes from the 41-card deck, `trick` is empty, `trickNo` is
      0, `mode`/`ramSeat`/`ramTeam` are null, `sooli` and `sooliBust` are false, no `swap` or
      `declare` phase is ever entered, `phase` is `"rpsthrow"`, and the same seed dealt twice gives
      identical hands uid-for-uid. No `Math.random`, and `chooseAI` is not touched.
- [ ] **Suits are throws, the two clubs are not, and rank never decides anything.**
      `rpsThrowOf(c: Card): RpsThrow | null` answers `"paper"` for ♥, `"rock"` for ♠, `"scissors"`
      for ♦ and `null` for both clubs; `rpsCompare(a: Card, b: Card): 1 | 0 | -1` answers 1 when `a`
      takes the round, −1 when `b` does and 0 for a tie. `rps.test.ts` pins the whole 5×5 table over
      the classes {♥, ♠, ♦, ♣K, ♣Q}: the three cycle pairings and their three reverses, the three
      same-suit ties, ♣K over each of the other four, ♣Q over the three suits and under ♣K; it
      asserts antisymmetry (`rpsCompare(a,b) === -rpsCompare(b,a)`) over **every ordered pair of the
      41-card deck**; and it asserts the outcome is unchanged when either card's rank is replaced by
      any other rank of the same suit, so no high-card tie-break can creep in.
- [ ] **Exactly three rounds, no early stop, no replay.** Each round both seats reveal one card;
      `rpsRound` increments on every round, tied or not, and the match ends once it reaches
      `RPS_ROUNDS` (`3`, in `constants.ts`) **even when one side already has two wins**. A headless
      sweep of **at least 300** seeded matches driven through `drive.ts`'s `act`/`advance` asserts
      every match settles, every one plays exactly 3 rounds, both hands end empty, the two entries of
      `rpsWins` sum to 3 or fewer, and a tied round leaves both of them unchanged.
- [ ] **A drawn match is a real outcome, and `RPS_WINS` is gone.** `rpsWinner` returns
      `0 | 1 | "draw"` in place of the old `0 | 1 | null`, `rpsOver(round: number): boolean` answers
      `round >= RPS_ROUNDS`, and `RPS_WINS` is **deleted** from `constants.ts` so every stale
      first-to-two reading is a compile error rather than a silent one. `Screen` gains
      `{ kind: "rpsover"; result: "won" | "lost" | "drawn"; wins: [number, number] }` (the old
      `won`/`rounds` fields go), `RpsOver` draws all three results, and tests pin 3–0, 2–1, 1–1,
      0–0 and 2–0-with-a-tie against the result each produces.
- [ ] **The player reveals a card; the opponent's is committed before the player can act.**
      `throwRps` is replaced by `{ type: "revealRps"; p: Seat; uid: string }`, classified `"seat"` in
      `SCOPE` beside the unchanged `"auto"` `resolveRps` — the only change to `src/net/protocol.ts`,
      with `NET_VERSION`, `hashState`, `guestMay`, `parseMsg` and the `NetMsg` union byte-identical.
      Five guards, each reached directly in `reducer.test.ts`: `d.seats[p] === "human"`, the phase is
      `rpsthrow`, `p !== rpsFoe(d)`, that seat has not already revealed this round, and the `uid` is
      in that seat's hand (identity by **uid**, never `id`). The opponent's card is drawn by
      `pick(rng, hand)` at the **start** of each round — in `startDeal`'s arm and in `resolveRps`'s
      next-round branch — and a test plays one seed twice, revealing in a different order each time,
      asserting the **identical sequence of opponent cards**.
- [ ] **State carries cards, not throws.** `rpsThrows: [RpsThrow | null, RpsThrow | null]` becomes
      `rpsCards: [Card | null, Card | null]`, team-indexed as before; a revealed card is **moved** out
      of its seat's hand into that slot, and `resolveRps` clears both slots before the next round.
      `createRun` initialises it, `nextTick`'s `rpsreveal` key still carries `g.rpsRound` so the
      three rounds produce three distinct keys, and the arm keeps its `if (g.screen) return null`
      guard. `SAVE_VERSION` stays **3** and `hashState` is unchanged: the mode writes no snapshot,
      reaches no session, and `rpsCards` is null at every boundary a snapshot is taken at.
- [ ] **The felt and the hand draw cards.** `Hand.tsx`'s `"rps"` branch draws the viewing seat's
      remaining cards as clickable `PlayingCard`s dispatching `revealRps`, with no `HandTools` and no
      drag reordering, and keeps the `Hint` line so `#app`'s grid row does not collapse. `RpsTable`
      draws the two revealed cards as `PlayingCard`s during `rpsreveal` only, the running score,
      "round n of 3", the opponent's remaining count through the existing `table.cardCount`, the
      round's outcome computed from `rpsCompare` rather than stored, and the suit→throw legend built
      from `SM[s].g`. The opponent's card is never drawn before the player has revealed. A
      `render.test.tsx` sweep covers both phases and all three results in both locales; the panel's
      content and the three hand cards are reachable at **1280×500** and **390×844**.
- [ ] **The chip corner does not lie in this mode.** `PlayingCard` prints no chip value when
      `g.challenge === "rps"` — a chip count is meaningless with no scoring — and the ♣K and ♣Q keep
      their portraits, drawn through `isKingOfClubs` and a new `isQueenOfClubs` **both exported from
      `game/cards.ts`**, so the portrait and the rule cannot name different cards. `rules.test.ts`
      pins `isQueenOfClubs` the way it already pins `isKingOfClubs`. No new glyph is introduced.
- [ ] **The board records a result that can be a draw.** `RpsRow` becomes
      `{ seed: string; result: "won" | "lost" | "drawn"; wins: number; losses: number; at: number }`
      and `RPS_SCORES_VERSION` goes to **2**, so rows written under the first-to-two rule are
      discarded by the existing version gate rather than re-sorted under a rule they were never
      played by; the key stays `tupatro-rps-v1` and no `removeItem` is added. Order: won, then drawn,
      then lost; then **most** rounds won; then **fewest** rounds lost; then the earlier timestamp.
      `scores.test.ts` pins the order, idempotence under a repeated effect and every parse rejection,
      and a test asserts an RPS match leaves `tupatro-scores-v1`, all five `MATCH_KEY` entries and
      `tupatro-challenge-rummikub-v1` untouched.
- [ ] **Measured, not guessed.** A headless measurement over **at least 500** seeded matches with a
      uniform player policy reports, in `README.md`: the won / lost / drawn shares, the suit share of
      all revealed cards against the deck's own 13/41 (32.9%) per suit, and the share of matches in
      which a club is dealt. Two assertions, not predictions: the **won and lost shares agree within
      a 3σ binomial tolerance** — both sides pick uniformly, so any asymmetry is a bug, not variance
      — and **the holder of the ♣K wins every round it is revealed in**, over that whole sweep.
      `game/seats.test.ts`'s pinned literals and its 50-seed aggregate do not move.
- [ ] **Text and docs, in both languages.** Every reworded and new key lands in `fi.ts` first with
      matching placeholder sets: `challenge.rps.t` (it says "no cards, no deal" today and must stop),
      `rps.throwTitle`/`rps.throwHelp` (choose a card, not a throw), the round-of-three line,
      `rps.tied` (no longer "the round is replayed"), the suit legend, the two clubs' rule, the drawn
      result, the board's columns and `single.savedRps`. `rules.rps` is rewritten in both catalogues
      to equal list lengths, stating the 41-card deck, the mapping, the two clubs, three rounds and
      the draw, and repeating that the mode is **not tuppi**. No player-facing literal outside
      `src/i18n/`; every number through `fmt()`. `Rules.tsx`, `README.md` (the mode section and the
      measurement table) and `CLAUDE.md` (the Rock-Paper-Scissors paragraph, the `rps.ts` module-table
      row and the board row's shape) are all updated.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Play exactly three rounds" is read literally: all three are played, even when the third cannot
  change the result.** A player who wins the first two rounds still reveals the third card. Each
  player is dealt exactly three cards and each round spends one, so the deal and the format agree;
  it also keeps the trump decision alive to the end. This **reverses** the delivered first-to-two
  rule, and every `RPS_WINS` reading with it.
- **A drawn match is therefore possible, and is the first draw state in this project.** Equal round
  wins after three rounds — 1–1 with a tie, 0–0 with three ties, and so on — is a draw, not a loss
  and not a replay. It is confined to the `rpsover` screen, `RpsRow` and this mode's catalogue keys;
  no other mode, board or screen gains one. The alternative (sudden-death extra rounds) was rejected
  because the players have no cards left to play them with.
- **A tied round counts for neither side and is not replayed.** The requirement says two cards of
  the same suit tie the round _and_ that there are exactly three rounds; a replay cannot fit inside
  a fixed three. This overrules WRPSA v1.0's replayed tie, which the delivered mode implements.
- **The suit→throw mapping and the two clubs are the requirement's own invention, and no source
  knows either.** Written into a comment in `rps.ts` as a house rule, exactly the way Nami's point
  tables are. Only the three-way cycle itself keeps its citation.
- **The ♣K and ♣Q always decide their round: nothing ties with a club.** ♣K vs ♣Q is a win for the
  ♣K; ♣K vs ♣K and ♣Q vs ♣Q are unreachable, since the deck holds one of each. Both clubs can be
  dealt into the same hand, in which case that player holds both trumps and one ordinary card — a
  3-in-41 × 2-in-40 outcome that is left as it falls rather than re-dealt.
- **The opponent reveals uniformly at random from the cards it still holds, drawn at the start of the
  round before the player can act.** This keeps the delivered mode's "it cannot react to you even in
  principle" property and adds no AI. The consequence is honest and belongs in the README: the
  opponent spends its trump at a random round, so a player who holds the ♣K back for a decided
  match has an edge the bot never takes. A bot that saves its trump is the obvious next spec.
- **Only two seats are dealt to.** `ownerSeat(g)` and `rpsFoe(g)` get three cards each; the other two
  chairs sit out with empty hands, exactly as they already do, and the remaining 35 cards are never
  dealt to anybody.
- **`RPS_WINS` is deleted rather than redefined**, replaced by `RPS_ROUNDS = 3` and `RPS_HAND = 3`,
  so every call site (`content.ts`'s `CHALLENGES` row, `RpsPlate`, `RpsTable`, `SinglePlayer`) is a
  compile error until it is re-read. The `CHALLENGES` row's `target` becomes `RPS_ROUNDS`, with a
  comment saying it counts rounds and not points.
- **Existing `tupatro-rps-v1` rows are discarded, not migrated.** They record a first-to-two match
  with a "rounds taken" column that a fixed three-round match has no meaning for. The board version
  gate already returns `[]` on a version it does not know, so the cost is exactly one line and the
  loss is a handful of local rows in a mode that is days old.
- **The chip corner is hidden rather than repurposed into a throw glyph.** A per-card rock/paper/
  scissors glyph would need a new symbol proven against tofu, which this project has been burned by;
  the four-colour deck, the suit pip already on the card and the legend on the felt carry the
  mapping instead. If a reviewer wants glyphs on the cards, that is a follow-up with a tofu probe in
  it.
- **The mode stays single player, unresumable and off the wire.** `LOBBY_MODES` untouched,
  `NET_VERSION` unmoved, `SAVE_VERSION` 3, and no snapshot — the mode still reaches no screen
  between the first reveal and its result, so `readChallengeRun("rps")` stays null and the row
  offers no Continue from disk.
- **The panel keeps its place and loses its buttons.** `PHASE_PANEL.rpsthrow` stays `true`:
  `RpsThrowPanel` becomes `RpsRevealPanel`, holding the instruction, the legend and the clubs' rule.
  The decision is the hand below the felt, which is where the cards are; putting three card-shaped
  buttons in the panel as well would be two controls for one choice.

## Touch points

- `src/game/rps.ts` — `makeRpsDeck`, `rpsThrowOf`, `rpsCompare`, the new `rpsWinner`/`rpsOver`;
  `RPS_THROWS`, `beats` and `rpsFoe` kept, with the house-rule comment
- `src/game/rps.test.ts` — the 5×5 table, antisymmetry over the deck, rank-blindness, the deck shape
- `src/game/constants.ts` — `RPS_ROUNDS`, `RPS_HAND`; `RPS_WINS` deleted
- `src/game/cards.ts`, `src/game/rules.test.ts` — `isQueenOfClubs` beside `isKingOfClubs`
- `src/game/types.ts` — `rpsCards` replaces `rpsThrows`; the `rpsover` `Screen`'s `result`
- `src/game/state.ts` — `createRun`'s initialisation
- `src/game/actions.ts` — `revealRps` replaces `throwRps`
- `src/game/reducer.ts` — `startDeal`'s `"rps"` arm (deal and first opponent draw), the `revealRps`
  case and its five guards, `resolveRps` (compare, bank, next round or `rpsover`)
- `src/game/reducer.test.ts` — the deal, every refusal, a whole match, the two-run determinism case
- `src/game/schedule.ts` — `nextTick`'s `rpsreveal` arm and key, `waitingSeat`
- `src/game/scores.ts`, `src/game/scores.test.ts` — `RpsRow`, `RPS_SCORES_VERSION` 2, the new order
- `src/net/protocol.ts` — the one `SCOPE` rename, and nothing else
- `src/components/table/RpsTable.tsx` — the two cards, the legend, the count, the outcome
- `src/components/hand/Hand.tsx` — the `"rps"` branch draws and dispatches
- `src/components/panels/RpsThrowPanel.tsx` → `RpsRevealPanel.tsx`, `panels/Panels.tsx`
- `src/components/PlayingCard.tsx` — no chip corner in `"rps"`; the portrait reads `cards.ts`
- `src/components/rail/RpsPlate.tsx`, `src/components/screens/RpsOver.tsx`, `SinglePlayer.tsx`,
  `Rules.tsx`
- `src/i18n/fi.ts`, `src/i18n/en.ts`, `src/index.css`
- `src/test/render.test.tsx` (the `rps` fixtures, `PHASE_PANEL`, the `SCREENS` entry),
  `src/test/invariants.test.ts`
- `README.md`, `CLAUDE.md`

## Out of scope

- A smarter opponent: saving the ♣K for a decided round, reading the player's suits, a difficulty
  setting, or anything that makes its reveal depend on the player's history.
- Rank mattering anywhere: no high-card tie-break inside a suit, no ordering of the 13 hearts.
- Any other mode's deck or deal. `makeDeck`'s 52 cards, `dealCards`, `legalCards`, `currentWinner`,
  `evalTrick`, `scoreTrick`, `chipValue` and `chooseAI` are untouched, and Tupatro's Ikiliikkuja
  draw still fires only on `d.challenge === "tupatro"`.
- Enhancements in this mode — no stone, wild, glass, steel, gold or bonus card is ever dealt into it,
  and no shop, tuppipakka or wallet exists to introduce one.
- Best-of-five, more than three cards, a player-chosen match length, a re-deal when both clubs land
  in one hand, lizard-Spock, and Rock-Paper-Scissors as a tie-break inside a tuppi deal.
- The lobby, the wire and the shared table: no `LOBBY_MODES` entry, no `NetMsg`, no `hashState`
  field, no `parseMsg` clause, no `guestMay` clause, no `NET_VERSION` bump.
- Resuming a match, a Continue from disk, or writing a snapshot at a phase boundary for any mode.
- Migrating the existing `tupatro-rps-v1` rows, renaming that key, or merging the board with any
  other board.
- Money, temput, jokers, vouchers, a trick, a declaration, a per-round timer, a per-round toast,
  sound, and animation beyond a CSS mount animation on the revealed cards.
- `HandTools`, sorting and drag-to-reorder inside the mode.

## Source

- **Official WRPSA Rock Paper Scissors Rules v1.0**, <https://wrpsa.com/rules> — the three-way cycle
  (rock blunts scissors, scissors cut paper, paper covers rock) is taken from it unchanged and is the
  only clause of it this mode still follows. **Its two other rules are overruled by the
  requirement**: WRPSA replays a tied round and decides a match at two wins; here a tie counts as
  nothing and is not replayed, and the match is exactly three rounds with the most wins taking it.
  That disagreement is written into the comment above `resolveRps`, because both clauses look like
  missing code — a tie that does not increment, and a match that plays a round it cannot need.
- **The suit mapping and the two clubs have no source at all.** No published rule set maps ♥/♠/♦ onto
  paper/rock/scissors, and none knows a King of Clubs that beats everything or a Queen of Clubs that
  loses only to the King. They are the requirement's own invention, and the implementer writes
  exactly that above the table in `rps.ts`: _this is this game's own rule, not a variant of anybody
  else's._ The same sentence belongs in `rules.rps` in both catalogues, beside the line that already
  says the mode is not tuppi.
- **The tuppi sources say nothing about this mode, and that is the finding rather than an oversight.**
  The Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) and
  <https://korttipeliopas.fi/tuppi> describe a four-handed, no-trump trick-taking game built on the
  rami/nolo declaration, _maantuntopakko_, sooli and _ryöstö_. None of that appears here. Rule 4 —
  "tuppi's rules are never invented" — is about tuppi, and this mode makes no claim on tuppi's name:
  no tuppi term (tuppi, rami, nolo, sooli, ryöstö, näyttö, maantuntopakko, tuppipakka) is used for
  any part of it, and **"trump" is this spec's own word for the two clubs, never a suit the deal
  declares** — tuppi has no trump suit, and a reader who meets the word in the catalogue must not
  come away thinking it does. Prefer wording that names the two cards rather than the concept.

## For the implementer: the traps in this codebase this change walks into

1. **`rpsWinner`'s `null` changes meaning, which is the one silent failure here.** It used to mean
   "not decided yet"; a draw is not that. Returning `"draw"` instead of `null` is prescribed so that
   `rpsRowFor`'s `rpsWinner(g.rpsWins) === ownerTeam(g)` cannot quietly file every drawn match as a
   loss. Re-read every call site: `scores.ts`, `RpsOver`, `SinglePlayer`, the reducer.
2. **`d.challenge` may not sit in front of `)`, `?` or `&&`.** Spell the id — `d.challenge === "rps"`
   — in the reducer and everywhere else; `invariants.test.ts` greps for both shapes.
3. **`uidSeq` moves now, and the mint is the reducer's own cursor.** Take `mint` from the parameter
   `startDeal` already has and write it back the way `dealCards` does; a module-level counter would
   desync under StrictMode, and `makeRpsDeck` must take the `Mint` rather than making one.
4. **Identity is `uid`.** `revealRps` looks the card up by uid and the hand cards use `c.uid` as the
   React key; two hearts of the same rank cannot exist in this deck, but the rule does not bend for
   that.
5. **Vitest does not type-check.** A stale `SCREENS` fixture entry, a missing `PHASE_PANEL` member, a
   `SCOPE` key that no longer matches `Action["type"]` and the removed `RPS_WINS` are all caught by
   `npm run typecheck` and `npm run build`, not by `npm test`. Run both.
6. **`rpsreveal` is still the `handend` trap.** `resolveRps` ends the match by setting `g.screen`
   while leaving the phase at `rpsreveal`, so that `nextTick` arm keeps `if (g.screen) return null`,
   and its key must keep `g.rpsRound` in it or three rounds share one key and the second never fires.
   `drive.ts`'s `"advance: did not settle"` is how a headless test catches the omission.
7. **A new `CHALLENGES` row is not added, but its text is rewritten**, and `i18n.test.ts` iterates the
   table: `.n` and `.t` must stay present in both catalogues, and `fi.ts` is edited first because
   `en.ts` is typed from it.
8. **`Hand` must not return `null`.** `#app` is a three-row grid; keep the `handzone` wrapper with
   `Hint` inside it, and check the felt's height at 360×740 where the rail's floor already binds.
9. **The panel scrolls with a sticky footer.** `RpsRevealPanel` is drawn through `DeclPanel`; put the
   legend and the instruction above the prose, and measure at 1280×500 and 390×844 — jsdom lays
   nothing out.
10. **`Panels` returns null while spectating, and `MoveButton` draws nothing there.** No session can
    reach this mode, but the hand's card click is a dispatch site like any other: it must refuse when
    `spectating`, the same way `Hand`'s `sooligive` branch already does.
