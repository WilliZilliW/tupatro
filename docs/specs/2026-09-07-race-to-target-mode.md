---
id: 2026-09-07-race-to-target-mode
title: Add the race mode — two partnerships play ordinary tuppi deal after deal until one reaches a measured target
kind: rule
status: proposed
source: Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022); <https://korttipeliopas.fi/tuppi> — "Peli päättyy, kun toinen joukkueista pääsee 52 pisteeseen. Silloin vastajoukkue on pantu tuppeen." The mode's *structure* is that sentence; its arithmetic and its target are Tupatro's own and are not tuppi's point table. One place where the source and this game's existing scoring disagree is named below rather than implemented.
---

# Add the race mode — two partnerships play ordinary tuppi deal after deal until one reaches a measured target

## What

The Challenges list gains a second row, **Tuppikilpa / Tuppi Race**: an alternate rule set in which
two partnerships play ordinary tuppi — the rami/nolo declaration, sooli, ryöstö and thirteen tricks
— deal after deal until one pair's running total reaches **12,000**. That pair wins the match and
the other is put _tuppeen_. Every deal is scored by exactly the arithmetic the main game already
uses (`evalTrick`, `scoreTrick`, the tuppi multiplier), and the roguelike shell is gone: no ante,
no blind, no per-blind target, no money, no shop, no jokers, no vouchers, no consumables and no
tuppipakka — and so no `swap` phase.

Any seat may be a person or the game, through the existing `g.seats`, so the row starts a match for
one to four humans: solo against three AI, a two-player duel across the table, or a full table on
one screen taking the seat in turn. Nothing about the main game, the ante ladder or the
Tuppi-Rummikub challenge changes, and there is no networking in this change.

## Prior specs and documents

- **Extends `2026-09-06-tuppi-rummikub-challenge` (delivered).** The race is a second
  `ChallengeId`, so `g.challenge`, `parked` / `leaveChallenge`, the never-saved rule, the
  two-page rail strip and the Challenges list are reused rather than duplicated. That spec's
  statement that `ChallengeId` is `"rummikub"` (`src/game/types.ts:113`) and `content.ts`'s comment
  that the `CHALLENGES` row is "the only thing the game layer knows about a challenge"
  (`src/game/content.ts:154-155`) are both **narrowed, not reversed**: the union grows and the race
  adds a second rule branch beside the laydown's. The laydown, `laydown.ts`, `LAYDOWN_TURN_MS`, the
  `laydown` phase and `tupatro-challenge-rummikub-v1` are untouched, and a criterion below pins
  that.
- **Contradicts `docs/multiplayer.md`, and this requirement's reading wins.** That handoff's
  "Stage 3 — the race mode" says the roguelike economy comes _with_ the mode ("money, chips,
  jokers, tuppipakka and the tricks themselves all count") and lists **the cash-out formula** as a
  second thing the stage must measure. This change deliberately builds the race **without** an
  economy: every seat's `PlayerEconomy` stays empty for the whole match, there is nothing to buy,
  and the bot therefore needs no purchasing policy. That is a reversal of a written decision and
  the human must see it: `docs/multiplayer.md` is **edited in this same pull request** to split
  Stage 3 into 3a (this mode, shell-less) and 3b (a race with the economy, still unbuilt and still
  owing a measured cash-out formula), so the next person does not implement a shop into a mode that
  has none. Nothing else in that document changes.
- **Overlaps `2026-09-07-multiplayer-seat-selection-lobby` (delivered).** `MenuView "lobby"` exists
  and is routed but nothing dispatches it. The race does **not** use it: who is human is chosen on
  the race's own row in the Challenges list. Wiring the lobby is out of scope, and
  `Lobby.tsx` and its header comment are not touched.
- **Overlaps `2026-09-07-new-game-skips-seat-picker` (delivered).** New Game's route must stay
  exactly as that spec left it. The criterion is mechanical: `Menu.tsx`'s New Game button and its
  `runStarted ? restart : newRun` branch are byte-identical after this change, and the race adds no
  screen, no modal and no decision anywhere on the New Game path.
- **Overlaps `2026-09-04-local-top-ten-scoreboard` and the challenge board.** The race keeps a
  **third** board with its own row shape, version and key. The main board (`tupatro-scores-v1`),
  the challenge board (`tupatro-challenge-rummikub-v1`) and the "`clearRun` removes the run key and
  nothing else" promise are untouched.
- **Overlaps `2026-09-07-seat-absolute-game-state` and `2026-09-07-per-seat-economy` (both
  delivered).** This is the first mode that actually seats more than one human, so it exercises
  both. Neither is undone: no `GameState` field names a viewing seat, `src/game/` imports no seat
  context, and `myEcon` / `localSeat` / `seatKind` / `usTricks` / `themTricks` stay absent from
  `src/`. `useSeatSync` is **extended** (see the criteria) rather than replaced.
- **Overlaps `2026-09-05-swipeable-rail-pages-on-phone` (delivered).** A race draws the two-page
  challenge strip that spec's successor introduced, with the race's own plate in place of the
  challenge plate. The measured rail height clamp in `src/index.css` is not touched and no page
  count changes.
- Nothing here is already delivered. `src/game/` today contains no race, no per-pair score and no
  `raceover` screen.

## The measurement, and the target it fixes

**The target is measured, not chosen.** There is no ante ladder to inherit a number from, so it was
derived by playing deals headlessly through `game/drive.ts`'s step loop with `src/test/bot.ts`'s
`basicPolicy` and the game's own `chooseAI`, with no boss, no purchase and every wallet at
`newEconomy()` — the same state a golden bot run already exercises. Per deal, each pair's score was
computed as the race will compute it: `scoreTrick` over the tricks `scoresFor` gives that pair,
times `tuppiInfo`'s multiplier for that pair. The model was checked against the engine on every
deal by asserting the run owner's pair reproduced `g.handScore` exactly.

Two samples, 400 seeds × 60 deals = **24,000 deals** each:

| sample                                                       | scoring pair's deal score | median | mean  | 10th–90th | min | max    |
| ------------------------------------------------------------ | ------------------------- | ------ | ----- | --------- | --- | ------ |
| **A** all four seats played by the game's own `chooseAI`     | one pair per deal         | 1,998  | 2,519 | 676–4,950 | 300 | 19,280 |
| **B** `basicPolicy` at seat 0, `chooseAI` at the other three | one pair per deal         | 2,331  | 2,852 | 696–5,720 | 336 | 22,548 |

- **The other pair scored 0 in all 48,000 deals of both samples.** No deal scored for both pairs and
  no deal scored for neither. That is the mode's termination argument and it is not luck: with
  thirteen tricks exactly one side has seven or more, so in rami exactly one side clears the
  multiplier's floor and in nolo exactly one side is at six or fewer. Its one exception is a busted
  sooli, which scores nothing for anybody — see the assumptions.
- Sample A is the honest pace figure. `basicPolicy` is a **handicap**, not a par player: its pair
  won 11.8% of matches at this target against two `chooseAI` seats, while in sample A the two pairs
  are even (51.5% / 48.5%). A lopsided race reaches a target faster than a close one, so B's match
  lengths read short.

Deals to a candidate target, walking each seed's deal sequence and stopping at the first pair at or
past it (400 matches per row, none unfinished inside the 60-deal sample):

| target     | sample | median | mean | 10th | 90th | min | max | ≤2 deals | ≥15 deals |
| ---------- | ------ | ------ | ---- | ---- | ---- | --- | --- | -------- | --------- |
| **12,000** | A      | **8**  | 7.9  | 4    | 12   | 1   | 17  | 1.3%     | 0.8%      |
| 12,000     | B      | 6      | 6.4  | 3    | 9    | 1   | 12  | 5.0%     | 0.0%      |
| 15,000     | A      | 10     | 9.8  | 6    | 14   | 2   | 20  | 0.3%     | 7.3%      |
| 15,000     | B      | 8      | 7.9  | 4    | 12   | 2   | 16  | 2.0%     | 0.8%      |

**The reading: `RACE_TARGET = 12,000`.** A deal costs roughly 50–60 seconds of clock at
`schedule.ts`'s delays (three AI declarations at 620 ms, then thirteen tricks of ~3.5 s each plus
the player's own thinking), so a median match of 8 deals is about 8 minutes — the same order as a
main-game blind sequence and as a Tuppi-Rummikub run, and the 90th percentile of 12 deals keeps a
long match inside a quarter of an hour. 15,000 was measured and rejected: a median of 10 deals with
7.3% of matches at fifteen deals or more is a long sit in a mode with no shop and no ante screen to
break it up. The one-in-400 single-deal finish at 12,000 (a 19,280-point deal exists) is accepted as
a story rather than designed away; capping a deal's contribution would be inventing scoring.

A third sample, taken because a sooli is the one deal that can score nothing for either pair:
with the policy accepting **every** sooli offer, 36.2% of deals were busted soolis worth nothing to
anybody and 1.1% were successful soolis worth a median 6,672 — and matches still finished, at a
median of 11 deals, a maximum of 27, and none unfinished inside 60. That is what makes the
termination criterion below safe to demand.

These figures go in the README the way the ante thresholds do, with the caveat that sample A
measures the game's own heuristics against themselves and sample B measures the test bot.

## Acceptance criteria

- [ ] **The race is a second `ChallengeId`, and no branch tests `g.challenge` for truth any
      more.** `src/game/types.ts:113` becomes `ChallengeId = "rummikub" | "race"` and
      `src/game/content.ts:157` gains one row with `id: "race"`, `key: "challenge.race"`, the
      glyph `→` and `deals: 0` — `deals` is inert for a race, and a criterion below asserts it
      never moves. Every rule branch in `src/game/reducer.ts` that today reads `if (d.challenge)`
      — lines **108**
      (`startDeal`), **237** (`resolveTrick`), **276** (`endTrick`) and **723**
      (`showHandResult`) — tests the id explicitly (`=== "rummikub"` / `=== "race"`).
      `src/test/invariants.test.ts` gains a mechanical check: with comments stripped,
      `src/game/reducer.ts` contains no bare truthiness test of `d.challenge`
      (`/\bd\.challenge\s*(\)|\?|&&)/` finds nothing; `d.challenge === "…"` and
      `d.challenge !== null` are fine). Branches outside the reducer that are correct for _any_
      challenge stay as they are and are named in a comment: `GameContext.tsx:60`'s no-write guard,
      `Menu.tsx:43`'s Leave button, `Rail.tsx:28`'s `chalRow`.
- [ ] **Three new state fields, initialised in `createRun`, and nothing else grows.**
      `src/game/types.ts`'s `GameState` gains `raceDeal: number`, `raceBase: [number, number]` and
      `raceScores: [number, number]`, and `src/game/state.ts`'s `createRun` literal initialises
      them to `0`, `[0, 0]` and `[0, 0]`, so the "defines every state field in createRun"
      invariant (`src/test/invariants.test.ts:257`) keeps passing. The match target rides in the
      existing `g.target`; `base`, `blindScore`, `scored`, `deals`, `blindDeals`, `dealsLeft`,
      `ante`, `blindIdx` and `beaten` gain no new meaning. A test asserts that over a whole
      headless match `deals`, `blindDeals`, `dealsLeft`, `ante`, `blindIdx` and `beaten` are
      identical at the end to what `startChallenge` set, and that `boss` is `null` throughout.
- [ ] **`src/game/race.ts` is a new pure module and holds the whole of the mode's arithmetic.**
      Added to `PURE_CORE` in `src/test/invariants.test.ts:28`. It exports:
      `RACE_TARGET`-free helpers only — `dealScores(g): [number, number]`, which is
      `finalScore({ ...g, base: g.raceBase[t] }, t, seatOfTeam(t))` for each team `t` and so is the
      main game's formula with no second copy of it; `matchOver(g): boolean`
      (`Math.max(...g.raceScores) >= g.target`); and `raceWinner(g): 0 | 1 | null`, the pair at or
      past the target, the higher total when both are (which cannot happen — see the next
      criterion) and `null` when neither is. `seatOfTeam` is local, one line, and carries the
      comment that `teamOf(p) = p % 2` makes seat `t` a seat of team `t`, that the seat is passed
      because the pure core never resolves a wallet from who is looking, and that in a race every
      wallet is empty so the choice changes no arithmetic. `RACE_TARGET = 12_000` lives in
      `src/game/constants.ts` beside `ANTES`, because that is where a measured number lives.
- [ ] **`src/game/race.test.ts` pins the per-pair scoring, case by case.** Built with `st()`-style
      plain states: a rami 7–6 scores for the seven side only and `0` for the other; a rami 9–4
      gives the winner ×3; a **ryöstö** — `ramTeam` is the side with fewer than seven — doubles the
      defending pair's multiplier and leaves the declaring pair at `0`; a nolo 6–7 scores for the
      six side; a nolo 7–6 scores for the six side (the same pair test from the other direction); a
      successful sooli scores ×6 for the soloist's pair only; a **busted sooli scores `0` for both
      pairs**. `matchOver` and `raceWinner` are tested at the boundary (`target - 1`, `target`,
      `target + 1`) and with a pair overshooting. Mutation-check it: change `dealScores` to read
      `g.raceBase[0]` for both teams and confirm a test fails.
- [ ] **A race deal is ordinary tuppi with no shell, and its tricks score for both pairs.**
      `startDeal`'s race branch runs `runDeclarations(d)` — it does **not** enter `swap`, does not
      force a mode, and leaves `ramSeat`/`ramTeam`/`leader` to `finishDeclare` exactly as the main
      game does — and it resets `raceBase` to `[0, 0]` and increments `raceDeal`.
      `resolveTrick`'s race branch adds `scoreTrick(d, t, seatOfTeam(t), w.p, leadSeat, cards).total`
      to `raceBase[t]` for **each** team `t` for which `scoresFor(d, t, w.p)` holds and
      `!d.sooliBust`, sets `d.pop` from the viewer-independent pair the run owner is on (so the
      score pop keeps working unchanged), and credits no money: `ctx.payout` is discarded and a test
      asserts every wallet's `money` is `0` at the end of a match. `endTrick` in a race falls
      through to `endHand`, not `startLaydown`. Tests: a whole race deal driven through
      `src/game/drive.ts` visits exactly the phases `declare`, `play`, `resolve`, `trickend`,
      `handend` (plus the three sooli phases when a sooli is taken) and never `swap`, `laydown`,
      `shop` or `blindselect`; `d.sooli` is reachable; `toShop`, `nextBlind`, `cashOut` and
      `startLaydown` are never reached; `d.table` and `d.layHands` stay empty.
- [ ] **`endHand` banks both pairs and `showHandResult` always opens a screen.** In a race
      `endHand` computes `dealScores(d)`, adds each to `d.raceScores[t]`, sets
      `d.handScore = dealScores[ownerTeam(d)]` for the existing screens and toasts, and **does not
      touch `dealsLeft` or `blindScore`**. `showHandResult`'s race branch opens
      `{ kind: "raceover", winner, scores, deals }` when `matchOver(d)` — also setting
      `d.runScore = d.raceScores[ownerTeam(d)]`, mirroring the challenge's `runScore = blindScore` —
      and `{ kind: "dealend", score: d.handScore }` otherwise. It **never returns without a
      screen**: `nextTick`'s `handend` case returns a tick whenever `g.screen` is null
      (`src/game/schedule.ts:64`), so a race branch that left the screen null would make the
      `handend` step repeat forever. A test drives a state at `handend` in a race with no screen and
      asserts `nextTick` gives exactly one `showHandResult` and `null` thereafter.
- [ ] **`{ type: "startChallenge", id: "race", seed?, humans? }` produces a whole match state.**
      `humans` is typed `1 | 2 | 3 | 4` and defaults to `1`, so an all-AI board — which would stall
      on the first human-gated phase and never deal a card — is not expressible. `startChallenge`
      seats humans clockwise from the parked run's owner seat: `seats[(own + i) % 4] = "human"` for
      `i < humans`, the rest `"ai"`. The resulting state has `challenge: "race"`,
      `target: RACE_TARGET`, `raceDeal: 1`, `raceScores: [0, 0]`, `runStarted: true`,
      `menu: null`, `screen: null`, `boss: null`, `deals`/`blindDeals`/`dealsLeft` all `0`, every
      wallet empty with `money: 0`, the main run parked in `parked`, and the first deal already
      dealt in the `declare` phase. Tests: `startChallenge` from a state with jokers, money, a side
      deck and a boss yields none of them; two humans land on **opposite** teams (seats `own` and
      `own + 1`); four humans leave no `"ai"`; a race started from inside the rummikub challenge
      carries `parked` across unchanged rather than dehydrating the challenge.
- [ ] **Every seeded match terminates with exactly one pair at or past the target.**
      `src/test/bot.ts` gains `playRace(seed, policy = basicPolicy, humans = 1)`, which acts for
      whichever human seat the game is waiting for rather than for `ownerSeat` alone, records each
      deal's `[number, number]` and returns `{ state, deals, winner, dealCount }`. A test plays
      **60 seeds** to their end and asserts, for every one: it finished (no
      `advance: did not settle`, no guard exhaustion, and a hard ceiling of 60 deals per match);
      `raceWinner` is not `null`; the winner's total is `>= RACE_TARGET`; **the loser's total is
      `< RACE_TARGET`**; the winner is the pair with the higher total; and every deal of every match
      scored more than `0` for exactly one pair unless that deal was a busted sooli. A second test
      does the same over 20 seeds with `{ ...basicPolicy, playSooli: () => true }` and asserts the
      matches still finish — the measurement above says a median of 11 deals and a maximum of 27, so
      the 60-deal ceiling holds. A third plays 10 seeds with `humans: 4` and asserts the same
      termination properties, which is what proves the mode needs no seat-0 assumption.
- [ ] **The waiting seat is a pure function, and it is what makes hot-seat work.**
      `src/game/schedule.ts` gains `waitingSeat(g): Seat | null` beside `nextTick`: the human seat
      the game is waiting on — `declSeq[declIdx]` in `declare`, `turn` in `play`, `sooliSeat` in
      `soolioffer`/`sooligive`/`sooliready`, a human seat of `teamOf(layTurn)` in `laydown`,
      `ownerSeat` in `swap` — and `null` under a menu, under a screen, in an automatic phase, or
      when the seat in question is `"ai"`. Tests: it agrees with `nextTick` on every phase
      (`nextTick(g) === null` for a player-gated phase exactly when `waitingSeat(g) !== null`), and
      it returns each of the four seats for a board seated accordingly. `src/hooks/useSeatSync.ts`
      stays **the one writer of the viewing seat** and gains one clause: where more than one seat is
      `"human"`, it follows `waitingSeat(g)` when that is non-null; with a single human its
      behaviour is unchanged, which a test asserts by rendering a single-human race and a
      single-human main run and seeing no seat move. Its header comment records that this is still
      not a per-window choice and that transport must replace it.
- [ ] **The Challenges list hosts the mode, and no existing route is gated.** `Challenges.tsx`
      lists both `CHALLENGES` rows with `nameOf` / `descOf` / the row glyph and a Play button; the
      race row carries a segmented **players** control (1 / 2 / 3 / 4, default 1) whose value is
      component-local `useState` — never `GameState`, so it is never saved — and its Play dispatches
      `{ type: "startChallenge", id: "race", humans }` on the click with no confirmation. The race
      row's third line reads its own board (`t("race.bestWon", { deals })` for a won match,
      `t("challenges.noBest")` with no rows), so the rummikub row's `challenges.best` line is
      unchanged. Tests: two rows render, each Play dispatches its own id, the players control
      changes only the `humans` field of what is dispatched, Back still returns to the menu, and
      `Menu.tsx` is unchanged apart from nothing at all.
- [ ] **The race's own end screen names the winning pair.** `Screen` gains
      `{ kind: "raceover"; winner: 0 | 1; scores: [number, number]; deals: number }`, `Screens.tsx`
      routes it to a new `src/components/screens/RaceOver.tsx`, and `SCREENS` in
      `src/test/render.test.tsx:1275` gains a `raceover` case with `how: "drawn"` — the fixture is
      keyed off `Screen["kind"]`, so this is a **compile error** until it is listed, and
      `npm run typecheck` is the gate that sees it. The screen states, from the viewing seat, whether
      your pair won or was put _tuppeen_, both totals against the target, the number of deals, the
      last deal's per-pair scores from `dealScores(g)` so the deciding deal is not hidden, the seed,
      and the race board (class `.scoreboard`); its buttons are Play again (same `humans`, read from
      `g.seats`), Replay seed and Back to menu, mirroring `ChallengeOver.tsx`.
- [ ] **The deal-end screen and the rail tell the truth during a race.** `DealEnd.tsx:17`'s
      two-way `challenge ? …` becomes a three-way switch on the id, and a new `RaceDealEnd` branch
      draws: this deal's score for each pair, both running totals against the target, the deal
      number, and the tricks — no target-remaining line, no `dealsLeft` line, no cash-out language.
      `Rail.tsx` picks the plate by id (`ChallengePlate` for rummikub, a new
      `src/components/rail/RacePlate.tsx` for the race) and keeps the two-page strip, the page
      classes `rp-challenge` / `rp-game`, the `domOrder` and the arrow bounds exactly as they are.
      `RacePlate` draws the mode's name, the deal number, both pairs' totals against the target and
      this deal's tricks, and reads **no** money, joker, tuppipakka, consumable, blind or
      boss field. Tests: no `.jokers`, `.sidelist`, `.cons`, `.blindplate` or `.slate` element
      exists in a race rail; the strip is two pages; the render sweep draws the race rail, the race
      deal end and the race-over screen in both languages with no `undefined`, no
      `[object Object]`, no `NaN`, no leaked catalogue key and no Finnish in English output.
- [ ] **A race keeps a third board, under a key of its own.** `src/game/scores.ts` gains
      `RACE_SCORES_VERSION`, a `RaceRow` of `seed`, `won`, `deals`, `score` and `at`,
      `raceRowFor(g, at)` (reading `raceScores[ownerTeam(g)]` and whether that pair won),
      `addRaceScore` — won matches first, then the **fewest** deals, then the higher score,
      ties to the earlier `at`, truncated to `SCORES_MAX`, idempotent on everything but `at` exactly
      as `addScore` is — and `parseRaceScores` with the same reject-anything-else contract.
      `src/game/storage.ts` gains `readRaceScores` / `writeRaceScores` under **`tupatro-race-v1`**
      and no `removeItem`, so the "only `clearRun` removes a key" invariant still holds. The key is
      deliberately **not** `tupatro-challenge-race-v1`: `challengeKey` (`storage.ts:92`) is read by
      `parseChallengeScores`, and two parsers sharing one key is how a board gets silently dropped.
      `GameContext.tsx`'s challenge branch writes the race board on `raceover` and the challenge
      board on `challengeover`, and calls neither `writeRun` nor `clearRun` for either. Tests: the
      row order, the truncation, the idempotence and every parse rejection in `scores.test.ts`; and
      in `GameContext.test.tsx`, that finishing a race leaves `tupatro-run-v1`,
      `tupatro-scores-v1` and `tupatro-challenge-rummikub-v1` byte-identical to what they were
      before it started.
- [ ] **A race is never saved, and `SAVE_VERSION` stays 3.** `GameProvider` already returns before
      `writeRun` whenever `state.challenge !== null`, so a reload during a race loses the race and
      resumes the main run at its last snapshot. The three new fields ride along in a main-game
      snapshot through `dehydrate`'s rest-spread and arrive at their `createRun` values in a save
      written before this change; `raceScores` is read positionally, but it is an **added** field
      rather than a widened one, so `createRun`'s `[0, 0]` is the right value for any older save and
      nothing reads it outside a race. Tests in `save.test.ts`: a dehydrated main run round-trips
      with the three fields intact; a v3 payload with the three keys deleted rehydrates to
      `0`/`[0,0]`/`[0,0]` rather than `undefined`; nothing is written to `tupatro-run-v1` at any
      point during a race.
- [ ] **The main game is bit-identical.** `src/game/seats.test.ts` is **not edited**: its pinned
      literals for the three named seeds, its fifty-seed aggregate and its rotation test all pass
      untouched. `ANTES`, `BLIND_MULT`, `BLIND_REWARD`, the two boss pools, the shop, the jokers,
      the vouchers, the consumables, `laydown.ts` and the rummikub challenge's numbers are
      unchanged, and the README's existing balance tables are not re-measured.
- [ ] **The rules panel and the README explain the mode in both languages, and say what it is
      not.** `Rules.tsx` gains a race section (`rules.raceTitle` + a `tList("rules.race")`) whose
      list says: ordinary tuppi with the declaration, sooli and ryöstö; no tuppipakka, shop, money,
      jokers, antes or blinds; each deal scored by this game's trick types, chips × mult and tuppi
      multiplier; one pair scores a deal and the other nothing; first to **12,000** wins and the
      other is put tuppeen; **that 12,000 is Tupatro's own measured number and real tuppi is played
      to 52 points of its own table, which this mode does not use**; a match is a median of eight
      deals; any seat may be a person or the game, up to four on one screen; and that everyone at
      one screen can see the hand of whoever is to play, so a hot-seat match runs on the honour
      system. README gains the same in prose plus the measured tables above, and updates the "one
      of them so far" line in its start-menu paragraph and both test counts. `CLAUDE.md` gains
      `game/race.ts` to the module layout, the race to the challenge section, `tupatro-race-v1` to
      the persistence gap, and the hot-seat limitations named in the assumptions.
- [ ] **The gates, the glyph and one browser reading.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` all pass;
      `src/index.css` stays hand-formatted and Prettier-excluded, and the new views reuse
      `.chalplate`, `.chalrowline`, `.cashline` and `.scoreboard` rather than growing a stylesheet
      of their own. The race row's glyph is tofu-tested against U+E000 by canvas pixels. Because
      `kind: rule` does not run the screen stage, the pull request records one manual reading
      instead, at **1280x800**, **1280x500** and **390x844**: the Challenges list with two rows and
      the players control reachable with no page scroll, and the race deal end and race-over screens
      with every button on screen and hit-testable.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The mode lives in the Challenges list, as a second `ChallengeId`, not behind a menu button of
  its own.** The requirement left the choice open and asked for a reason. The reason is that
  `g.challenge` already means "an alternate rule set with none of the roguelike shell", and every
  piece of machinery the race needs is already attached to it and already tested: parking the main
  run and giving it back exactly, never writing `tupatro-run-v1`, a per-mode board key, the
  two-page rail, the Leave button, the `startChallenge` whole-state replacement. A menu button of
  its own would need a second nullable mode field that must never be set at the same time as
  `challenge`, and duplicate all of it. The cost of the choice is real and is priced into the
  criteria: every `if (d.challenge)` in the reducer was written when there was one challenge and is
  now wrong, so each becomes an explicit id test and an invariant forbids the truthiness test coming
  back. A second cost is vocabulary: the race is called a "challenge" by `btn.leaveChallenge` and
  by the list's title, which are left as they are rather than reworded, because in the UI's own
  vocabulary that is exactly what it is.
- **Who is human is chosen on the race's row, 1 to 4, and humans are seated clockwise.** The
  requirement asked for solo and hot-seat play without saying how the seats are picked. Clockwise
  from the run owner's seat gives a ladder that needs no explaining: 1 is solo against three AI, 2
  is a duel across the table (the two humans are **opponents**, since partners sit across from each
  other and `(own + 1) % 4` is not `partnerOf(own)`), 3 is two humans and an AI against one human,
  4 is a full table. **Two humans as partners against two AI is therefore not reachable in this
  change** — a race is a race between the pairs, and a co-op seating is a different feature.
  Nothing is gated by this: the control defaults to 1 and Play starts on the click.
- **Hot-seat means the viewing seat follows the seat to act, and there is no curtain.** With two
  humans and no view-following the game stalls: the panels dispatch for `useViewSeat()` and the
  reducer refuses an action for a seat whose turn it is not. So `useSeatSync` follows
  `waitingSeat(g)` on a multi-human board. The consequence is that whoever is at the screen sees the
  hand of whoever is to play, and a hidden-information cover ("pass the device") is **out of
  scope**. That is consistent with the project's already-accepted stance for this mode family —
  `docs/multiplayer.md` accepts that under lockstep every peer can read every hand — but it is a
  real limitation and the rules text says so rather than implying otherwise.
- **A deal scores for one pair and the other gets nothing, and that is not a new rule.** It falls
  out of the existing functions: `scoresFor` gives each pair the tricks it took (rami) or dodged
  (nolo), and `tuppiInfo` returns a multiplier of 0 to a pair short of seven in rami or over six in
  nolo. With thirteen tricks exactly one pair clears it. Measured over 48,000 deals: never both,
  never neither. The source agrees — tuppi scores the successful side only.
- **A busted sooli scores nothing for anybody, and this contradicts the source knowingly.**
  korttipeliopas.fi says "Jos soolaaja ottaa yhdenkin tikin, **ramaajat saavat 24 pistettä**" — the
  declarers take the points when the sooli breaks. Tupatro's `tuppiInfo`
  (`src/game/scoring.ts:57`) returns a multiplier of `0` on `sooliBust`, and `endTrick` ends the
  hand the moment the soloist takes a trick, so today the deal scores nothing for either side. The
  requirement forbids a scoring change, so **the race keeps the existing behaviour**, and this is
  written here rather than implemented quietly. Two consequences the reviewer should see: a busted
  sooli advances the race by nothing, and a player who takes and busts a sooli in every deal can
  stall a match indefinitely — which is a choice, not a loop (the state advances, deals are played,
  and the headless test proves termination for policies that do not deliberately stall; measured,
  even a policy that accepts every sooli finished every match). Correcting the busted sooli to the
  source is a `kind: scoring` spec of its own and would move the main game's numbers.
- **In sooli only the soloist's pair banks the deal.** `scoresFor` and `tuppiInfo` are
  team-blind in sooli — they ask about the soloist's seat, not about a team — so calling them for
  both pairs would credit the same number twice and make a sooli a no-op in a race that is decided
  by the difference. `dealScores` therefore gives a successful sooli to `teamOf(g.sooliSeat)` and
  `0` to the other pair. This is the reading the main game already has in practice (the sooli is
  only ever offered to a human, and in single player that human is the run owner), so no main-game
  number moves; it is written into a comment in `race.ts` because the pure functions do not say it
  themselves.
- **The wallets are zeroed to `money: 0`, exactly as the rummikub challenge does.** The requirement
  says every `PlayerEconomy` "stays at `newEconomy()`", and `newEconomy()` carries `money: 6`. The
  two readings differ by six dollars that nothing can spend and nothing reads: with no joker, no
  voucher, no side deck and no `chipBonus`, the only wallet-reading paths in `scoreTrick` are inert.
  `startChallenge` already zeroes every purse (`reducer.ts:376-377`) and the race takes that
  unchanged, so the mode shows no money anywhere and the requirement's real point — the wallets are
  empty, so `scoreTrick` needs no new path — holds either way.
- **A race has no fixed length and no cap.** `dealsLeft` is not used and the reducer has no
  maximum number of deals: a ceiling would be a rule the requirement did not ask for, and a state
  where the match cannot end would be **masked** by one rather than caught. The 60-deal ceiling
  lives in the test, where exceeding it is a failure.
- **`raceDeal` exists only to be displayed and to be sorted on.** The mode needs a deal number for
  the plate, the deal-end screen and the board's "won in N deals", and there is nothing to derive
  one from once `dealsLeft` is unused.
- **The race's board files lost matches too**, like the main board and unlike a challenge's, and
  sorts won matches first, then by the fewest deals: a race won in four deals beats one won in
  twelve. The score is the run owner's pair's total, so a hot-seat match files one row for the seat
  the shell belongs to; a per-seat or per-pair board is out of scope.
- **`g.scored` stays at 0 in a race**, because it counts scoring tricks for one team and a race has
  two. Nothing reads it in the mode: no joker holds a `scoredBefore` effect there and no race view
  draws it. It is named here so it is not mistaken for a bug.
- **`ownerSeat` still means "the first human", and in a hot-seat race that is a heuristic.** Three
  things read it in the race and are therefore the run owner's rather than each player's: which
  seat's hand gets the player-chosen sort in `dealCards`, whose pair the score pop and `handScore`
  describe, and whose pair the board row records. The sort mode and `customOrder` are single global
  fields too, so one player changing the sort changes the next player's. All of it is cosmetic, none
  of it changes a card played or a score, and fixing it needs the per-window state transport owes.
- **The `humans` count is not saved and does not survive a reload**, because a race is not saved at
  all. Play again on the race-over screen reads the count back out of `g.seats`, so a four-player
  match replays as a four-player match.
- **No new phase.** The race needs `declare`, `play`, `resolve`, `trickend` and `handend`, all of
  which exist, so `Phase`, `Panels`, `Hint`, `SPREAD_PHASES` and the render sweep's `PHASES` list
  are untouched. Adding one would mean walking all four touch points; the criteria are written so
  that none is needed.
- **The mode's name is `race` in the code and "Tuppikilpa" / "Tuppi Race" on screen**, with the
  glyph `→` — an arrow, from the character classes CLAUDE.md calls safe, and already in use by the
  `etukasi` joker in this project's font stack. The tofu check is still required.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/game/race.ts` — **new**: `dealScores`, `matchOver`, `raceWinner`, local `seatOfTeam`
- `src/game/constants.ts:60` — `RACE_TARGET = 12_000` beside `ANTES`
- `src/game/types.ts:113` — `ChallengeId`; `:136-153` — the `raceover` `Screen` kind; `:297-313` —
  `raceDeal`, `raceBase`, `raceScores` beside the challenge block
- `src/game/content.ts:157` — the second `CHALLENGES` row
- `src/game/state.ts:65-90` — the three fields in `createRun`'s literal
- `src/game/actions.ts:21` — `humans?: 1 | 2 | 3 | 4` on `startChallenge`
- `src/game/reducer.ts` — `startDeal` (`:108`), `resolveTrick` (`:237`), `endTrick` (`:276`),
  `endHand` (`:291`), `showHandResult` (`:723`), `startChallenge` (`:349`)
- `src/game/schedule.ts` — `waitingSeat`, and the `handend` case's `g.screen` guard read again
  (`:61-69`)
- `src/game/scores.ts:86+` — `RACE_SCORES_VERSION`, `RaceRow`, `raceRowFor`, `addRaceScore`,
  `parseRaceScores`
- `src/game/storage.ts:87+` — `readRaceScores`, `writeRaceScores`, the `tupatro-race-v1` key
- `src/hooks/useSeatSync.ts:30` — the multi-human clause
- `src/hooks/GameContext.tsx:60-68` — the race board on `raceover`
- `src/components/screens/RaceOver.tsx` — **new**; `src/components/rail/RacePlate.tsx` — **new**
- `src/components/screens/Screens.tsx:37-52`, `Challenges.tsx:18-38`, `DealEnd.tsx:15-18`,
  `Rules.tsx:87-90`
- `src/components/rail/Rail.tsx:25-28, 97-101` — the plate chosen by id
- `src/i18n/fi.ts` then `src/i18n/en.ts` — `challenge.race.n` / `.t`, `race.*`, `raceDeal.*`,
  `raceOver.*`, `race.bestWon`, `rules.raceTitle`, `rules.race`
- `src/game/race.test.ts` — **new**; `reducer.test.ts`, `scores.test.ts`, `save.test.ts`,
  `GameContext.test.tsx`, `render.test.tsx` (`SCREENS`, the sweep's views), `invariants.test.ts`
  (`PURE_CORE`, the no-truthiness check), `src/test/bot.ts` (`playRace`)
- `README.md`, `CLAUDE.md`, `docs/multiplayer.md` (Stage 3 split into 3a and 3b)
- **Not touched**: `src/game/seats.test.ts`, `src/game/laydown.ts`, `src/hooks/useGameLoop.ts`,
  `src/components/screens/Menu.tsx`, `src/components/screens/Lobby.tsx`, `src/game/shop.ts`,
  `src/game/save.ts`'s `SAVE_VERSION`

## Out of scope

What this deliberately does not do, so the implementation does not drift into it.

- **Any transport, peer connection, signalling, action relay, desync hash or nickname.** No
  `useNetGame.ts`, no WebRTC, no lobby wiring.
- **An economy in the race** — money, a shop, jokers, vouchers, consumables, a tuppipakka or a
  cash-out formula. That is `docs/multiplayer.md`'s Stage 3b and it owes a measured payout of its
  own.
- **Bosses in the race.** A debuff that hits both pairs is noise and one that hits a single pair is
  unfair; the two pools stay for the main game.
- Changing the main game in any way: `ANTES`, the blind table, the rewards, the interest ladder, the
  bosses, the shop, the balance tables, `base`, `blindScore` or the ante ladder's victory.
- Correcting the busted sooli to the source's "the declarers get the points" — that is a scoring
  change and needs its own spec.
- Tuppi's traditional point table (4 points a trick over six, 24 for a sooli, 52 to win). The
  mode's arithmetic is this game's own, and the rules text says so.
- A hidden-information cover for hot-seat play, a per-window seat choice, a spectator seat, or an
  all-AI board (which would stall on the first gated phase).
- Two humans as partners against two AI, and any seating other than clockwise from the owner.
- A per-seat or per-pair board, merging the race board into the main or challenge board, and any
  change to `tupatro-scores-v1` or `tupatro-challenge-rummikub-v1`.
- Saving or resuming a race, and bumping `SAVE_VERSION`.
- A new phase, a second `setTimeout` call site, or a per-turn time limit like the laydown's.
- The laydown, `laydown.ts`, `chooseLaydown`, `LAYDOWN_TURN_MS`, the rummikub challenge's screens
  and its measured figures.
- Re-measuring the main game's balance, the side deck or the challenge.
- ARIA, focus order and keyboard shortcuts beyond the project's existing `focus-visible`;
  accessibility stays the documented known gap.
- Changing the five-page main-game rail or the measured rail height clamp.
- AI improvements: `chooseAI` and `aiDeclare` play the race exactly as they play the main game,
  including the deliberate 0.35 randomness against a sooli.

## Source

- **<https://korttipeliopas.fi/tuppi>**, checked for the mode's structure, which is the part of it
  that _is_ tuppi: **"Peli päättyy, kun toinen joukkueista pääsee 52 pisteeseen. Silloin
  vastajoukkue on pantu tuppeen."** A tuppi match is exactly this mode's shape — deal after deal
  until one partnership reaches a point total, at which the other is put _tuppeen_ — with no fixed
  number of deals. The same page gives the point table the mode deliberately does **not**
  implement: nolo "Kuudella kasalla joukkue saa neljä pistettä ja jokainen kasa vähemmän lisää
  pisteitä neljällä", rami "Ramissa voittoon tarvitaan seitsemän kasaa. Seitsemästä kasasta saa
  neljä pistettä…", ryöstö "Ryöstetty rami on arvoltaan kaksinkertainen", sooli "Jos soolaaja
  selviää tikeittä, pari saa 24 pistettä."
- **The requirement and the source disagree in two places, and both are recorded rather than
  implemented.** (1) The **target**: tuppi plays to 52 of its own points; this mode plays to 12,000
  of Tupatro's, because Tupatro's deal score is chips × mult and its own multiplier already _is_
  tuppi's point table (7 tricks = ×1, 9 = ×3, ryöstö doubles, sooli ×6 — the shape of every rule
  quoted above). Converting between the two is not attempted, the number is measured, and the rules
  panel and README both say the 12,000 is this game's number and not tuppi's. (2) The **busted
  sooli**: the source gives the declarers 24 points, Tupatro's `tuppiInfo` gives a multiplier of 0
  to everybody, and the race keeps Tupatro's behaviour because the requirement forbids a scoring
  change. Both readings belong in a comment in `race.ts`.
- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** and the same page for
  the parts of play the mode keeps unchanged and does not reimplement: four players in two
  partnerships, thirteen cards each, `maantuntopakko` and no trump, the highest card of the led
  suit taking the trick, the declaration (`näyttö`) from the elder hand clockwise with rami winning
  over nolo, the defender's sooli with its card exchange and the ace playing lowest, and the
  `ryöstö` when the declaring pair falls short of seven. All of that is what `rules.ts`,
  `scoring.ts` and the reducer already do, and the race changes none of it.

## For the implementer: the traps in this codebase this change walks into

1. **`nextTick`'s `handend` case returns a tick whenever `g.screen` is null**
   (`src/game/schedule.ts:61-69`), and the phase deliberately stays `handend` while the result is on
   screen. A race branch of `showHandResult` that returns without opening a screen — because "the
   match is not over, deal again" reads like it needs no screen — is an infinite loop:
   `showHandResult` fires, the state does not move, the tick comes back with the same key. The
   comment at `schedule.ts:62-64` is there because this has already happened once. Always set
   `dealend` or `raceover`. `advance` in `drive.ts:23` throws
   `"advance: did not settle — a tick is probably looping"`, which is how the headless test catches
   it; React's dep-keyed effect hides it in the browser.
2. **A new phase has four touch points, so do not add one.** `nextTick`, `Panels`, `Hint` and
   `SPREAD_PHASES` in `Hand.tsx`, plus the `PHASES` list in `src/test/render.test.tsx:540`. This
   spec is written so the race needs none: it reuses `declare`, `play`, `resolve`, `trickend` and
   `handend`. If you find yourself wanting a `matchover` phase, use the `raceover` **screen**
   instead — overlays are state, not phases.
3. **Every `if (d.challenge)` in the reducer means "rummikub" and will be wrong the moment
   `ChallengeId` has two members.** There are four: `reducer.ts:108`, `:237`, `:276`, `:723`. Two of
   them would silently give a race deal a forced rami with no declaration and turn its thirteenth
   trick into a laydown. Change all four to test the id, and add the invariant that forbids the
   truthiness test coming back. The reverse trap exists too: `GameContext.tsx:60`,
   `Menu.tsx:43` and `Rail.tsx:28` test `challenge` for _any_ challenge and are **correct** — do not
   narrow those to an id.
4. **How the rummikub challenge models a shell-less rule set is the pattern to copy, and it is also
   the pattern to stop copying halfway.** Copy: `startChallenge`'s whole-state replacement outside
   `apply()` in `gameReducer`'s produce callback (`reducer.ts:955-958`) with `original(d)` so
   `dehydrate` sees plain objects and not Immer drafts; parking the main run in `parked`, which is
   in `Dropped` and `DROPPED_KEYS` so a snapshot can never nest; `GameProvider` returning before
   `writeRun` for any challenge; the two-page rail; the Challenges list; the mode's own board key.
   Do **not** copy: `startDeal`'s forced rami, the `resolveTrick` early return that scores nothing,
   `startLaydown`, `dealsLeft` counting a fixed four deals down, `layScores`, or the 60-second turn
   in `useGameLoop`. The race scores its tricks with the ordinary path and has no fixed length.
5. **`scoreTrick` scores the side `scoresFor` picked, not the trick winner.** In nolo and sooli
   those are opposites — the game scores the tricks a side _dodged_. The race calls `scoreTrick`
   once per pair, and each call must be given that pair's own seat, not the winner's. Every wallet
   is empty in the mode, so a wrong seat will not show up as a wrong number; the golden in
   `seats.test.ts` cannot catch it either, for the same reason. `scoring.test.ts` and
   `reducer.test.ts` are where that choice is guarded, and `race.test.ts` must guard it for the race.
6. **Vitest does not type-check.** `npm test` transpiles with esbuild, so a missing `Screen` kind in
   `SCREENS` (`src/test/render.test.tsx:1275`) stays green under `npm test` and fails only under
   `npm run typecheck` and `npm run build`. The same is true of every other compiler-bound fixture.
   Run all three before believing anything.
7. **The reducer must stay pure and the RNG must stay in the state.** Read the cursor from
   `d.rngState` and write it back; never a module-level `let` (a test forbids them) and never
   `Math.random` outside `makeSeed`. Calling `scoreTrick` twice per trick consumes no randomness —
   the only `rng.next()` in that path is the glass-card break, and a race has no glass card — but
   anything you add that draws from the generator will move every seeded figure in this spec.
8. **`nextTick` returns `null` for a `"human"` seat, so a board with no human never deals a card.**
   That is why `humans` is typed `1 | 2 | 3 | 4` and why a spectator seat was refused for the lobby.
   In the other direction, with two humans the reducer refuses an action for a seat whose turn it is
   not, so the viewing seat has to follow the acting one or the match stalls in silence with no
   error.
9. **A bot measures the bot.** `basicPolicy` declares by counting court cards, dumps its highest
   card in rami and its lowest in nolo, and never takes a sooli. Its pair loses about nine matches
   in ten to two `chooseAI` seats. Any figure you re-measure with it is a figure about it — the
   symmetric all-`chooseAI` sample is the one to compare against, and the sooli path is only
   exercised by a policy that overrides `playSooli`.
