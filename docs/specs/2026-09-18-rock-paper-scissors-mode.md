---
id: 2026-09-18-rock-paper-scissors-mode
title: Add Rock-Paper-Scissors, a seventh single-player rule set played with no cards at all
kind: rule
status: proposed
source: >
  Official WRPSA Rock Paper Scissors Rules v1.0 (<https://wrpsa.com/rules>) for the three-way cycle,
  the best-of-three format and the replayed tie. **This mode is not tuppi**, and neither tuppi
  source knows it: the Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) and
  <https://korttipeliopas.fi/tuppi> describe a four-handed trick-taking game with a rami/nolo
  declaration and say nothing about a hand game. It therefore ships the way Tuppi-Rummikub and Nami
  already do — as this game's own side mode, presented as such in the rules panel and the README —
  and it must never be labelled as tuppi or scored on tuppi's tables. See **Source** below.
---

# Add Rock-Paper-Scissors, a seventh single-player rule set played with no cards at all

## What

The single-player screen gains a seventh row beside Tuppi-Rummikub, the race, Traditional Tuppi,
and Nami's two variants: **Rock-Paper-Scissors** (_Kivi-paperi-sakset_). The player throws one of
three hands; the game throws one of its own, drawn at random from the run's own seeded generator
_before_ the player picks, so it cannot react to them. The first side to win **two** decided rounds
wins the match; a round where both throw the same is replayed and counts as nothing. The match ends
on a result screen of its own with a board of its own — won or lost, and in how few rounds.

Nothing else moves. No card is dealt, no trick is played, no declaration happens, and the roguelike
shell is as absent as it is in every other alternate rule set.

## Prior specs and documents

- **Extends `2026-09-06-tuppi-rummikub-challenge` (delivered) in shape, and takes none of its
  code.** That spec is the precedent for a `ChallengeId` that suspends tuppi's scoring outright;
  this one goes a step further and suspends the deal. No laydown, no `laydown.ts`, no `laydown`
  phase, no `LAYDOWN_TURN_MS`.
- **Overlaps `2026-09-16-nami-game-mode` (delivered) and reverses nothing in it.** Nami's argument
  for leaving `NET_VERSION` alone — the lobby cannot start the mode, so no session can reach it —
  is reused verbatim here and restated under Assumptions rather than cited as a precedent that
  needs no argument.
- **Deliberately does _not_ extend `2026-09-07-race-to-target-mode`,
  `2026-09-08-traditional-tuppi-multiplayer-mode` or `2026-09-16-tupatro-match-mode-with-consumables`.**
  Rock-Paper-Scissors is a `ChallengeId` and **not** a `MatchId`: it banks no scale, has no point
  target, and reuses none of `raceDeal` / `raceBase` / `raceScores`. Borrowing those three fields
  would have cost no new state, and is refused on purpose — see the first assumption.
- **Overlaps `2026-09-14-per-challenge-continue` (delivered) and gets nothing from it, which is a
  consequence rather than an omission.** `GameProvider` writes a snapshot only when `g.screen` is
  set, and this mode reaches no screen before its result, so `tupatro-run-rps-v1` is never written
  and no Continue is ever offered for it. Criterion 10 pins that, and the third assumption says
  what it costs the player.
- **Overlaps `2026-09-14-single-player-separate-from-multiplayer` and
  `2026-09-16-confirm-hang-up-to-play-single` (both delivered), and changes neither.** The mode is
  reached exactly as the other six are: a `SOLO_MODES` row on `SinglePlayer.tsx`, `startChallenge`
  with no `seats`, and the Single player door's existing hang-up question ahead of all of it.
- Nothing here is already delivered. `grep -rn "rps\|scissors\|paperi" src/` finds nothing today,
  `ChallengeId` has six members, and `Phase` has twelve.

## Acceptance criteria

- [ ] **A seventh id, and it is not a match.** `ChallengeId` in `src/game/types.ts` is
      `"rummikub" | "rps" | MatchId` with `MatchId` unchanged; `CHALLENGES` in `content.ts` gains
      `{id:"rps", key:"challenge.rps", g:…, deals:0, target:RPS_WINS}` with a glyph already proven
      against tofu in this project (`"◆"` unless the implementer prefers another from the proven
      set); `RPS_WINS = 2` lives in `constants.ts` with the WRPSA citation in its comment;
      `matchModeOf("rps")` returns `null` — the switch in `race.ts` is exhaustive, so this is a
      compile error until it is handled — and `LOBBY_MODES` in `Lobby.tsx` is untouched. A test
      asserts `matchModeOf("rps") === null`, and the render sweep finds the row on the
      single-player screen in both locales.
- [ ] **`src/game/rps.ts` is the rule and nothing else, and `rps.test.ts` pins all nine pairings.**
      It exports `RPS_THROWS: RpsThrow[]`, `beats(a: RpsThrow, b: RpsThrow): boolean`,
      `rpsOver(wins: [number, number]): boolean`, `rpsWinner(wins: [number, number]): 0 | 1 | null`
      and `rpsFoe(g: GameState): Seat` — no wallet, no boss, no card, no `i18n`, the same shape
      `points.ts` and `nami.ts` have — and is added to `PURE_CORE` in `invariants.test.ts` and to
      `CLAUDE.md`'s module table. Its test pins rock over scissors, scissors over paper and paper
      over rock, the three reverse pairings as false and the three matching pairings as ties
      (`beats` false both ways); a property case asserts every throw beats exactly one other and
      loses to exactly one other, so the table cannot be edited into a dominant throw; and
      `rpsOver` / `rpsWinner` are pinned for every reachable `wins` pair from `[0,0]` to `[2,1]`.
- [ ] **The opponent's throw is drawn before the player's, from the run's own `Rng`.** It is set by
      `startDeal`'s RPS arm and by `resolveRps` when the next round begins, through
      `pick(rng, RPS_THROWS)` on the cursor the reducer reads from `d.rngState` and writes back —
      never `Math.random`, and never inside `chooseAI`, which is not touched at all. A
      `reducer.test.ts` case plays one seed twice, throwing rock every round in the first run and
      paper every round in the second, and asserts the **identical sequence of opponent throws** in
      both.
- [ ] **First to two decided rounds; a tie is replayed and counts as nothing.** `resolveRps` adds
      one to `rpsWins[team]` and one to `rpsRound` for a decided round, and changes neither for a
      tie. A headless sweep of **at least 200 seeded matches** driven through `drive.ts`'s `act` /
      `advance` asserts every match settles, every one ends `2–0` or `2–1`, no entry of `rpsWins`
      ever exceeds `RPS_WINS`, `rpsRound` equals the sum of the two, and the `rpsover` screen's
      `won` agrees with `rpsWinner(rpsWins) === ownerTeam(g)`.
- [ ] **The opponent really is uniform, and that is the one measured claim.** Over **at least 300**
      seeded opponent throws collected from that same sweep, each of the three appears at least 60
      times against a uniform expectation of 100; the figure that ships goes in `README.md` beside
      the other modes'. `game/seats.test.ts`'s pinned literals and its 50-seed aggregate do not
      move, because no RPS branch is added to any path another mode takes.
- [ ] **No card is dealt and no card randomness is spent.** `startDeal`'s RPS arm sits after the
      per-deal clears and **before `dealCards`**, and returns from there: `hands` stay
      `[[], [], [], []]`, `trick` stays empty, `mode` / `ramSeat` / `ramTeam` stay null, `sooli` and
      `sooliBust` stay false, `shows` stays empty, and `uidSeq` never moves. The id is spelled out
      (`d.challenge === "rps"`), never tested for truth — `invariants.test.ts` greps for that.
      `reducer.test.ts` asserts all of it after `startChallenge`.
- [ ] **Two new phases, each with all four touch points.** `Phase` gains `"rpsthrow"` and
      `"rpsreveal"`. `nextTick` returns `null` for `rpsthrow` (the player's own decision) and a
      `{ type: "resolveRps" }` tick for `rpsreveal` **behind `if (g.screen) return null`**, the
      guard `handend` needed; `waitingSeat` answers `rpsthrow` with the run owner's seat when it is
      human; `Panels` draws `RpsThrowPanel` for `rpsthrow`; `Hint` has a line for each; neither
      joins `SPREAD_PHASES`; `PHASE_PANEL` in `render.test.tsx` lists both. A test drives a whole
      match through `advance` and asserts it settles rather than throwing
      `"advance: did not settle"`.
- [ ] **Two new actions, both classified, and nothing else on the wire.** `Action` gains
      `{ type: "throwRps"; p: Seat; throw: RpsThrow }` and `{ type: "resolveRps" }` /* auto */;
      `SCOPE` in `src/net/protocol.ts` classifies them `"seat"` and `"auto"` and that is the
      **only** change to that file — `NET_VERSION`, `hashState`, `guestMay`, `parseMsg` and the
      `NetMsg` union are byte-identical. The `throwRps` case opens with the same guards every
      seat-carrying action has: `d.seats[p] === "human"`, the phase is `rpsthrow`, `p` is the seat
      `rpsFoe` is not, and that seat has not already thrown. Each refusal is reached directly in
      `reducer.test.ts`.
- [ ] **The felt, the hand and the rail draw the mode and nothing false.** `Table.tsx` returns
      `<RpsTable />` for the mode — the two throw slots, the round score against `RPS_WINS`, the
      round number, the decided round's outcome computed from `beats` rather than stored, and
      `<Panels />` — and `Hand.tsx` returns its `<Hint />` alone, with no `HandTools` and no cards,
      so the `#app` grid row does not collapse. `Rail.tsx` draws `RpsPlate` in place of
      `ChallengePlate` on a two-page strip, and its page list stays correct for _any_ challenge
      rather than being narrowed to ids. `render.test.tsx` sweeps both phases and the result screen
      in both locales, and `RpsThrowPanel`'s three buttons sit above the prose and are reachable at
      **1280×500** and **390×844** (the `#declpanel` sticky-footer rule).
- [ ] **Its own result screen and its own board.** `Screen` gains
      `{ kind: "rpsover"; won: boolean; wins: [number, number]; rounds: number }` and
      `screens/RpsOver.tsx` draws it: the result, both totals, Play again (`startChallenge` for
      `"rps"`), Back to your run (`leaveChallenge` through a `MoveButton`) and the board it has just
      filed — so its `SCREENS` fixture entry is `how: "drawn"`, and `CLAUDE.md`'s "seven components
      read a board while they render" becomes eight. `scores.ts` gains `RPS_SCORES_VERSION`,
      `RpsRow` (`seed`, `won`, `rounds`, `at`), `rpsRowFor`, `addRpsScore` and `parseRpsScores`;
      `storage.ts` gains `readRpsScores` / `writeRpsScores` on **`tupatro-rps-v1`** and no
      `removeItem`; `GameContext.tsx` files the row on the `rpsover` screen. `scores.test.ts` pins
      the order (won first, then the **fewest** rounds, then the earlier timestamp), idempotence
      under a repeated effect, and every parse rejection, and a test asserts an RPS match leaves
      `tupatro-scores-v1`, all five `MATCH_KEY` entries and `tupatro-challenge-rummikub-v1`
      untouched.
- [ ] **The single-player row tells the truth, and never offers a Continue from disk.** No snapshot
      is written for the mode, because it reaches no screen before its result: a test asserts
      `readChallengeRun("rps")` is null after a match is under way, so `resumable` returns null and
      the row's Continue appears only while `g.challenge === "rps"` (the `closeMenu` branch).
      `PositionLine` and `BestLine` in `SinglePlayer.tsx` each gain an RPS branch — rounds won so
      far, and the board's best row — so neither reads `raceDeal` / `raceScores` for a mode that
      never fills them. `render.test.tsx`'s spelled-out solo-id list grows from three to four.
- [ ] **Text, docs, and the versions that do not change.** Both catalogues carry every new key with
      matching placeholder sets — `challenge.rps.n` / `.t`, the three throws, the felt's and the
      plate's lines, `hint.rpsThrow` / `hint.rpsReveal`, the result screen's, the board's empty
      state and a `rules.rps*` section stating the three throws, the replayed tie, first-to-two and
      that the mode is **not tuppi** — with no player-facing literal anywhere outside `src/i18n/`
      and every number through `fmt()`. `Rules.tsx`, `README.md` (a mode section plus the measured
      uniformity figure) and `CLAUDE.md` (the module table, the challenge paragraph, the phase
      list, the board keys and the board-reading component count) are all updated.
      `SAVE_VERSION` stays **3**.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Best-of-three" is read as first to two _decided_ rounds, with a tied round replayed and
  counted as nothing.** This is the WRPSA rule (see Source) and it is also the only reading this
  codebase can carry cheaply: a match can then never be drawn, which is what lets the result screen
  hold a plain `won: boolean` exactly as `raceover` holds `winner: 0 | 1`. The rejected reading —
  exactly three rounds, most wins takes it — can end 1–1 with a tie, and there is no draw state
  anywhere in this project to put that in.
- **Rock-Paper-Scissors is a `ChallengeId` but deliberately not a `MatchId`, and it does not borrow
  `raceDeal` / `raceBase` / `raceScores`.** Borrowing them would have added no `GameState` field
  and no save concern, and is refused anyway: those three are documented as inert outside a match
  mode, `PositionLine` and `BestLine` branch on exactly that, and quietly filling them for a
  non-match would be the same conflation the `d.challenge` truthiness invariant exists to stop.
  The price is three new fields — `rpsRound: number`, `rpsWins: [number, number]` and
  `rpsThrows: [RpsThrow | null, RpsThrow | null]`, both pairs **team-indexed** like every other
  score in this game — initialised in `createRun` like every other field.
- **The mode is not resumable, and a match abandoned through the menu is lost.** That follows from
  the existing save rule rather than from a decision to drop it: `GameProvider` writes only when
  `g.screen` is set, and RPS reaches no screen between its first throw and its result. Writing at a
  phase boundary instead is a change to how every mode is saved and is out of scope. A best-of-three
  is seconds long, so the loss is small — but it is a real difference from the other six rows, and
  the row must not draw a Continue that leads nowhere.
- **The opponent's throw is drawn at the start of each round, before the player picks, and sits in
  `rpsThrows`.** It therefore cannot react to the player even in principle, which is a stronger
  claim than "the code does not look" and is what criterion 4's two-run test checks. It is
  readable in devtools like every hand in this project already is; that is accepted and the rules
  panel already says why.
- **Two players, not four.** The human is `ownerSeat(g)` and the opponent is the seat to its left,
  `(ownerSeat(g) + 1) % 4`, so the two sit on different teams and the team-indexed `rpsWins` works
  with `ownerTeam` unchanged. The other two chairs sit out entirely and nothing ever schedules
  them. The alternative — a first-class "two-seat" notion — would touch the seat machinery of every
  other mode for one side game.
- **`RPS_WINS = 2` is the requirement's own number, not a guessed balance figure**, so rule 5 has
  almost nothing to bite on here: against a uniform opponent the player's win rate is exactly 50%
  whatever they do, and there is no lever to tune. What _is_ measured is that the opponent is
  really uniform and that every match terminates, which is criteria 4 and 5.
- **The mode is single player only** — `LOBBY_MODES` untouched — and `NET_VERSION` therefore stays
  at the working tree's value with only the two `SCOPE` entries added. The argument is Nami's,
  restated rather than cited: no window holding a chair can dispatch `startChallenge` for `"rps"`,
  because the Single player door hangs the session up first and the only other dispatch site is the
  RPS result screen's Play again, which exists only inside an RPS match. If the implementer finds a
  route that puts `"rps"` on the wire, the version bumps and the reason is written down — an older
  peer's `parseMsg` does not validate challenge ids and would run main-game rules against one.
- **CLAUDE.md and the working tree disagree about two things, and this spec is written against the
  tree.** CLAUDE.md states `NET_VERSION` is **10** and that Ikiliikkuja's draw ships with
  `isKingOfClubs` in `game/cards.ts` and a draw site in `playCardInner`; in the tree on this branch
  `src/net/protocol.ts` has `NET_VERSION = 9`, `isKingOfClubs` is a local `const` inside
  `PlayingCard.tsx`, and `grep -rn "ikiliikkuja" src/` finds nothing. "`NET_VERSION` is unchanged"
  in criterion 8 means unchanged from whatever the tree holds at implementation time. Flagged
  because a later reader will reasonably trust the document.
- **New state fields are not validated by `rehydrate`**, following `raceScores`'s own precedent
  rather than the `economies` array's. They can reach disk only at their `createRun` defaults,
  since the mode writes no snapshot of its own and a main-run save is taken with the mode inert.
  `SAVE_VERSION` stays 3 for the same reason the race's addition did.
- **The result screen is a new `Screen` kind rather than a reuse of `challengeover`.** The
  requirement asked for its own; `ChallengeRow`'s single `score` column also has no meaning for a
  best-of-three, where the interesting numbers are won/lost and how few rounds it took — which is
  the `RaceRow` shape, on a board `readRaceScores` cannot serve because it is keyed by `MatchId`.
- **Names and glyphs.** Finnish "Kivi-paperi-sakset", English "Rock-Paper-Scissors", and the three
  throws are translated words (Kivi / Paperi / Sakset). None of them is a tuppi term, so the
  keep-it-Finnish rule for tuppi/rami/nolo/sooli does not reach them. No new exotic glyph is
  introduced: the row's `g` and any throw glyph come from the set already proven against tofu in
  this project.
- **The reveal is a lingering phase, not a stored result.** `rpsreveal` holds both throws for one
  tick's delay and the felt computes the outcome from `beats`; no `rpsLast` field is added, and a
  tie is visible for exactly that beat before the next round clears the slots.

## Touch points

- `src/game/types.ts` — `RpsThrow`, `ChallengeId`, `Phase`'s two new members, the `rpsover`
  `Screen`, and the three `rps*` `GameState` fields with the comment saying they are inert
  elsewhere
- `src/game/constants.ts` — `RPS_WINS`, with the WRPSA citation in its comment
- `src/game/content.ts` — the `CHALLENGES` row
- `src/game/rps.ts` — **new**: `RPS_THROWS`, `beats`, `rpsOver`, `rpsWinner`, `rpsFoe`
- `src/game/rps.test.ts` — **new**: the nine pairings, the cycle property, the win test
- `src/game/state.ts` — `createRun` initialises the three fields
- `src/game/reducer.ts` — `startDeal`'s RPS arm before `dealCards`, the `throwRps` case and its
  guards, `resolveRps` and the `rpsover` transition
- `src/game/reducer.test.ts` — a whole match, the two-run determinism case, every refusal
- `src/game/schedule.ts` — `nextTick`'s two arms (`rpsreveal` behind the `g.screen` guard) and
  `waitingSeat`'s
- `src/game/actions.ts` — `throwRps` and `resolveRps`
- `src/game/race.ts` — `matchModeOf`'s new arm, answering `null`
- `src/game/scores.ts`, `src/game/scores.test.ts` — `RpsRow` and its board
- `src/game/storage.ts` — `readRpsScores` / `writeRpsScores` on `tupatro-rps-v1`
- `src/hooks/GameContext.tsx` — the `rpsover` branch that files the row
- `src/net/protocol.ts` — the two `SCOPE` entries, and nothing else
- `src/components/table/Table.tsx`, `src/components/table/RpsTable.tsx` (**new**)
- `src/components/panels/Panels.tsx`, `src/components/panels/RpsThrowPanel.tsx` (**new**)
- `src/components/hand/Hand.tsx`, `src/components/hand/Hint.tsx`
- `src/components/rail/Rail.tsx`, `src/components/rail/RpsPlate.tsx` (**new**)
- `src/components/screens/RpsOver.tsx` (**new**), `Screens.tsx`, `SinglePlayer.tsx`, `Rules.tsx`,
  `src/i18n/fi.ts`, `src/i18n/en.ts`, `src/index.css`, `src/test/render.test.tsx`,
  `src/test/invariants.test.ts`, `README.md`, `CLAUDE.md`

## Out of scope

- Rock-Paper-Scissors in the lobby, on the wire or on a shared table; any new `NetMsg`, `hashState`
  field, `parseMsg` clause, `guestMay` clause or `NET_VERSION` bump.
- Resuming an RPS match, a Continue row for it, or writing a snapshot at a phase boundary for any
  mode.
- Any change to the main game's, the race's, Traditional Tuppi's, Tupatro's, Nami's or
  Tuppi-Rummikub's arithmetic, to `scoreTrick`, to `chooseAI`, or to the deliberate 0.35 anti-sooli
  randomness.
- A smarter opponent: pattern reading, frequency counting, a difficulty setting, or anything that
  makes the throw depend on the player's history. It is uniform, and criterion 5 holds it there.
- Best-of-five, best-of-seven, a player-chosen match length, lizard-Spock or any extension of the
  three throws, and RPS as a tie-break inside a tuppi deal.
- A second human playing RPS, pass-and-play, a seat picker, or any use of the two sitting-out
  chairs.
- Cards, a trick, a declaration or a wallet in the mode; money staked on a round; a per-round timer
  or a per-round toast.
- Filing RPS rows on `tupatro-scores-v1` or merging its board with any other board, and adding a
  `removeItem` outside the two sites `invariants.test.ts` already pins.
- RPS support in `src/test/bot.ts`'s `Policy`, beyond whatever the measurement test itself needs.
- Animation beyond a CSS mount animation on the revealed throws, and sound.

## Source

- **Official WRPSA Rock Paper Scissors Rules v1.0**, <https://wrpsa.com/rules> — the three-way
  cycle (rock blunts scissors, scissors cuts paper, paper covers rock), and a standard match as
  **best of three, decided when one player has won two rounds**. Matching throws are a tie, are
  replayed immediately, and **do not count toward the match score**. Both readings this spec
  depends on are therefore the published rule and not a house decision; the implementer should
  still write "a tie is replayed and counts as nothing — WRPSA v1.0" into the comment above
  `resolveRps`, because it is the clause that looks like a missing increment.
- **The tuppi sources say nothing about this mode, and that is the finding, not an oversight.** The
  Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) and
  <https://korttipeliopas.fi/tuppi> both describe a four-handed, no-trump trick-taking game built
  on the rami/nolo declaration, _maantuntopakko_, sooli and _ryöstö_. None of that appears here.
  Rule 4 — "tuppi's rules are never invented" — is about tuppi, and this mode makes no claim on
  tuppi's name: like Tuppi-Rummikub's laydown and Nami's point tables, it is presented in the rules
  panel and the README as **this game's own side mode**, and no tuppi term (tuppi, rami, nolo,
  sooli, ryöstö, näyttö, maantuntopakko, tuppipakka) is used for any part of it.
- **The one thing the requirement and the sources do not settle, and the chosen reading.** Neither
  says who throws first or whether a throw is committed before the opponent's is drawn. The reading
  taken here is that both throws are committed blind — the game's is drawn from the run's seeded
  `Rng` at the _start_ of the round, before the player can act — which is the physical game's
  simultaneity expressed in a turn-based reducer. It belongs in a comment on `startDeal`'s RPS arm
  and on `resolveRps`'s next-round branch, because a later reader will otherwise move the draw next
  to the comparison, where it would be free to peek and no test but criterion 4's would notice.

## For the implementer: the traps in this codebase this change walks into

1. **`rpsreveal` is the `handend` trap.** `nextTick` returns a tick for a phase that does not move
   the state on, for ever. `resolveRps` ends the match by setting `g.screen` and leaving the phase
   at `rpsreveal`, so that arm needs `if (g.screen) return null` exactly as `handend` does, and
   `drive.ts`'s `advance` throwing `"advance: did not settle"` is how a headless test catches the
   omission that React's dep-keyed effect hides.
2. **`d.challenge` may not sit in front of `)`, `?` or `&&` in the reducer.** Spell the id:
   `d.challenge === "rps"`. `invariants.test.ts` greps for both shapes.
3. **`startDeal`'s RPS arm must sit before `dealCards`**, not after it, or the mode spends a full
   deal's randomness and moves `uidSeq` for thirteen cards nobody ever sees.
4. **A new `CHALLENGES` row is a compile error until both catalogues have `.n` and `.t`**, because
   `i18n.test.ts` iterates the table. Add the Finnish key first; `en.ts` is typed from `fi.ts` and
   will not compile until it has it too.
5. **The `SCREENS` fixture is keyed off `Screen["kind"]`, and Vitest does not type-check.** A
   missing `rpsover` entry is caught by `npm run typecheck` and `npm run build`, not by `npm test`.
   The same is true of `Phase` and `PHASE_PANEL`, and of `SCOPE`'s two new members.
6. **`matchModeOf` is the exhaustive switch that will ask.** Adding `"rps"` to `ChallengeId` breaks
   its compile until the arm exists, which is the point — `Rail.tsx`, `MatchPlate.tsx`,
   `RaceOver.tsx` and `GameContext.tsx` all read it, and every one of them must treat `"rps"` as
   "not a match" rather than falling back to the race.
7. **`Hand` returning nothing collapses a grid row.** `#app` is a three-row grid; return the
   `handzone` wrapper with `<Hint />` inside it, not `null`, and check the felt's height at
   360×740 where the rail's floor already binds.
8. **`RpsThrowPanel` is drawn through `DeclPanel`, which scrolls with a sticky footer.** The three
   throw buttons are the decision and go **above** the prose — the rule that broke three times in
   `#declpanel`, `.replacepick` and `LaydownPanel`. Measure at 1280×500 and 390×844; jsdom lays
   nothing out.
9. **`Panels` returns null while spectating and that is what keeps the mode read-only on a shared
   table** — even though no session can reach the mode, the guard is the one that must not be
   bypassed by drawing the buttons directly on the felt in `RpsTable`.
