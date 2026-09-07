---
id: 2026-09-07-seat-absolute-game-state
title: Make GameState seat-absolute and move the viewing seat into a React context
kind: rule
status: proposed
source: Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022); <https://korttipeliopas.fi/tuppi> — tuppi's rules are stated relative to the dealer and the elder hand, never to a fixed seat, so no rule of play changes here
---

# Make GameState seat-absolute and move the viewing seat into a React context

## What

`GameState` stops meaning "seat 0 is the human". Trick counts become `tricks[team]`, `isUs(p)`
becomes `teamOf(p)` / `sameTeam(a, b)`, every `hands[0]` / `shows[0]` in the reducer and the pure
core becomes the acting seat, the player actions that carried no seat gain one, and the gates that
decide whether the clock plays a seat stop testing `p === 0` and read a new `seats: SeatKind[]`
field instead. The viewing seat leaves `GameState` entirely and becomes a React context in
`src/hooks/`, mounted beside `LocaleProvider`, because under the planned lockstep multiplayer every
peer's state must be byte-identical and a "you" field would be the one field that differs.

Nothing a player can see or do changes. Single-player is `you = 0` with
`seats = ["human", "ai", "ai", "ai"]`, and the deal-by-deal output of the game must be **bit-identical**
to the current build for the same seed and the same decisions. The new capability is for the
developer only: the engine can be run with the human at any seat, and a bot-driven rotation test
proves it.

## Prior specs

- **Overlaps `2026-09-04-resume-a-run-after-a-refresh` (delivered).** That spec's Assumptions say
  plainly: _"bumping `SAVE_VERSION` is the tool for a state-shape change"_ and _"a future shape
  change bumps `SAVE_VERSION` so old saves are rejected and overwritten in place"_. This change
  **removes** two `GameState` fields (`usTricks`, `themTricks`) rather than adding, so it is the
  first true shape change since that spec shipped. **`SAVE_VERSION` is bumped to 2 here** — see
  Assumptions. That follows the delivered spec's text; it departs from the _practice_ of the three
  deliberate non-bumps recorded in CLAUDE.md (`2026-09-04-local-top-ten-scoreboard`,
  `2026-09-04-ten-antes-and-two-boss-blinds`, `2026-09-06-tuppi-rummikub-challenge`), each of which
  only ever added a field whose `createRun` value was right for an older save. That is a reversal of
  habit, not of a decision, and the reviewer should see it: **every run in flight is discarded on
  first load after this ships.**
- **Overlaps `2026-09-06-tuppi-rummikub-challenge` (delivered).** `layHands`, `layScores` and
  `layTurn` are already indexed by _team_, not by seat, so they are already seat-absolute; only
  `layHands[0]` inside `endLaydown`, the `layTurn === 0` gates and the `usTricks >= 7` test in
  `startLaydown` are touched. The challenge's rules, its 60-second turn and its board are untouched.
- **Overlaps `2026-09-06-tuppipakka-swap-info-and-cancel` (delivered).** The swap's select-then-confirm
  shape, its infobox and its guards are unchanged; `swapTargets` / `canSwapIn` / `anySwapAvailable`
  and `pickSideCard` / `finishSwap` only gain the seat they act for.
- **Contradicts nothing else.** No delivered spec asserts that seat 0 is the player; the assumption
  was never written down, only coded.

## Acceptance criteria

Each is checkable by a named test or by reading a named file.

### The state

- [ ] `src/game/types.ts` declares `export type SeatKind = "human" | "ai"`, and `GameState` carries
      `seats: [SeatKind, SeatKind, SeatKind, SeatKind]`, `tricks: [number, number]` (indexed by
      team) and `sooliSeat: Seat | null`. `usTricks` and `themTricks` no longer exist anywhere in
      `src/` — `grep -r "usTricks\|themTricks" src/` finds nothing.
- [ ] `createRun` in `src/game/state.ts` initialises `seats: ["human", "ai", "ai", "ai"]`,
      `tricks: [0, 0]` and `sooliSeat: null`. The existing invariant
      _"defines every state field in createRun"_ in `src/test/invariants.test.ts` passes unchanged.
- [ ] `GameState` carries **no** field naming the viewing seat. A new case in
      `src/test/invariants.test.ts` reads the `GameState` block of `types.ts` and asserts no field is
      named `you`, `viewSeat`, `self`, `me` or `mySeat`, and that no file under `src/game/` imports
      the seat context module. The case must be shown to fail when such a field is added (mutation
      check, recorded in the PR).

### The us/them axis

- [ ] `src/game/constants.ts` exports `teamOf(p: Seat): 0 | 1`, `sameTeam(a: Seat, b: Seat): boolean`
      and `partnerOf(p: Seat): Seat`; `isUs` is gone from `src/`. `teamOf(0) === teamOf(2) === 0`
      and `teamOf(1) === teamOf(3) === 1`, asserted in `src/game/rules.test.ts`.
- [ ] `scoresForUs(g, winnerSeat)` in `src/game/rules.ts` becomes a function that takes the team it
      is asked about — e.g. `scoresFor(g, team, winnerSeat)` — and its sooli branch tests
      `winnerSeat !== g.sooliSeat` rather than `winnerSeat !== 0`. `src/game/rules.test.ts` covers
      both teams and a sooli seated somewhere other than 0.
- [ ] `src/game/scoring.ts` takes the team as a parameter: `tuppiInfo`, `tuppiMult`, `finalScore`
      and `scoreTrick` read `g.tricks[team]` and `g.tricks[1 - team]`, and `robbery` is
      `g.mode === "rami" && g.ramTeam !== team`. The steel count in `scoreTrick` reads the hand of
      the seat that owns the run's inventory, passed in, never `g.hands[0]`.
- [ ] `ScoreContext` carries no us/them or seat-0 field: `usBefore` / `themBefore` are replaced by
      team-indexed counts plus the team being scored, and it gains the two seats the joker table
      needs. In `src/game/content.ts` the three jokers that name a seat are rewritten with no
      numeric seat literal left: `kaveri` (`c.winner === 2`), `etukasi` (`c.lead === 0`) and
      `kaksoiskaveri` (`c.winner === 2 || c.lead === 2`). `src/game/scoring.test.ts` asserts each of
      the three fires for a run owner seated at 1 as it does for one seated at 0.

### The seats that lack one

- [ ] These actions in `src/game/actions.ts` gain a `p: Seat`: `declare`, `finishSwap`,
      `pickSideCard`, `acceptSooli`, `declineSooli`, `sooliGive`, `startSooliPlay`, `layCards`,
      `passLaydown`, `setSortMode`, `reorderHand`, `moveCard`. Each case in `src/game/reducer.ts`
      opens with a guard that the named seat is `"human"` in `d.seats`, and — where the phase is
      turn-based — that it is that seat's turn. `src/game/reducer.test.ts` reaches at least the
      `declare`, `pickSideCard`, `sooliGive` and `layCards` guards with a wrong seat and asserts the
      state is unchanged.
- [ ] Sooli is seat-absolute. `finishDeclare` records the defending seat the offer goes to in
      `d.sooliSeat`; `resolveTrick`'s bust test, `endTrick`'s sooli rotation, the partner's sit-out
      (`d.hands[2] = []`) and `d.sooliOrder`'s trailing `0` all read `d.sooliSeat` and
      `partnerOf(d.sooliSeat)`. `src/game/reducer.test.ts` plays a sooli with `sooliSeat` at 1 and
      asserts the partner that sits out is seat 3 and that the sooli player plays last.
- [ ] The clock's gates read `seats`, not `0`. In `src/game/schedule.ts`, `nextTick` returns `null`
      for the declaration when `g.seats[g.declSeq[g.declIdx]] === "human"`, for `play` when
      `g.seats[g.turn] === "human"`, and for `laydown` when either seat of `g.layTurn`'s team is
      human. In `src/game/reducer.ts`, `aiDeclare`, `aiPlay` and `aiLaydown` refuse on the same
      test. A test in `src/game/reducer.test.ts` asserts `nextTick` returns a tick for a seat marked
      `"ai"` and `null` for the same seat marked `"human"`.
- [ ] `src/game/ai.ts` names no seat literal: `chooseAI`'s `umpimahka` branch tests
      "the run owner's partner", and `handPower`, `aiDeclare`, `sooliRisk` and `chooseLaydown` take
      the seat or team they are asked about. `sooliRisk(g)` in particular no longer reads
      `g.hands[0]`.

### The viewing seat

- [ ] A new context module `src/hooks/seatContext.ts` exports the context, `src/hooks/SeatProvider.tsx`
      the provider (default value `0`) and `src/hooks/useSeat.ts` the `useViewSeat(): Seat` hook —
      the same three-file split `localeContext.ts` / `LocaleProvider.tsx` / `useI18n.ts` uses, so the
      provider file exports components only and Fast Refresh keeps working. `src/main.tsx` mounts it
      beside `LocaleProvider`, outside `GameProvider`.
- [ ] Every component and hook that carried a seat-0 literal reads the context instead:
      `components/hand/Hand.tsx` (`hands[0]`, `legalCards(g, 0)`, `shows[0]`, `playCard p: 0`),
      `components/hand/HandTools.tsx`, `components/hand/Hint.tsx`, `components/panels/Panels.tsx`,
      `components/panels/LaydownPanel.tsx`, `components/panels/SwapPanel.tsx`,
      `components/panels/SooliOffer.tsx`, `components/panels/SooliGive.tsx`,
      `components/panels/SooliReady.tsx`, `components/panels/DeclarePanel.tsx`,
      `components/table/Table.tsx`, `components/table/Seats.tsx`, `components/table/ModeBox.tsx`,
      `components/screens/DealEnd.tsx`, `components/screens/GameOver.tsx` and
      `hooks/useGameLoop.ts`. `Seats.tsx` and `Table.tsx` place a seat at
      `POS[(p - you + 4) % 4]`, which is the identity at `you === 0`.
- [ ] `renderWith` in `src/test/harness.tsx` wraps the tree in the seat provider and takes the seat
      as an optional argument defaulting to `0`. `src/test/render.test.tsx` passes with no change to
      what it asserts, in both languages, for every screen, panel and phase.

### Bit-identical, and proven

- [ ] A new test file — `src/game/seats.test.ts` — pins the current build's output. For three named
      seeds it asserts `playRun(seed, basicPolicy, 4)` produces exactly the `deals` array, the
      `outcome`, `state.money`, `state.ante` and per-seat hand ids that the **pre-change** build
      produces, as literals in the test, plus one aggregate over fifty seeds (`SEAT0`…`SEAT49`): the
      sum of every deal score and the count of each outcome, again as literals captured before the
      change. Any drift in the engine moves at least one of them.
- [ ] The same file holds the **rotation test**. For each of the four configurations
      `seats` = human at seat _k_ and `"ai"` elsewhere, _k_ ∈ {0,1,2,3}, one named seed, ante 1,
      blind index 0 (so: no boss, no jokers, no side deck, no shop, `sortMode: "suit"`,
      `customOrder: false`), the first deal is played to its thirteenth trick by a bot policy that
      mirrors the opponents' own heuristics (see Assumptions). The test asserts, across all four
      configurations:
  - the sequence of thirteen winning seats is identical;
  - `g.tricks` is identical, and `g.tricks[0] + g.tricks[1] === 13`;
  - `g.mode`, `g.ramSeat`, `g.ramTeam` and `g.leader` are identical;
  - `g.rngState` at the deal's end is identical — a divergence here means the human-driven seat
    consumed randomness the AI-driven seat did not, and the test must say so;
  - the deal score banked for the human's team agrees between _k_ = 0 and _k_ = 2, and between
    _k_ = 1 and _k_ = 3.
- [ ] The rotation test is shown to bite: with `teamOf` mutated to `p === 0 || p === 1` (or the
      `seats` gate in `nextTick` reverted to `=== 0`), it fails. The mutation and its output are
      recorded in the PR body, per CLAUDE.md's mutation-test rule.
- [ ] `src/test/bot.ts`: `Policy`'s methods take the acting seat, `basicPolicy` reads that seat's
      hand rather than `hands[0]`, and `playToScreen` / `playChallenge` act for whichever seat
      `s.seats[s.turn] === "human"` names instead of throwing on `s.turn !== 0`. `basicPolicy`'s
      decisions for seat 0 are unchanged, which the pinned test above proves.

### Persistence and documentation

- [ ] `SAVE_VERSION` in `src/game/save.ts` is `2`, its comment records why this shape change bumps
      where three additions did not, and `src/game/save.test.ts` asserts a payload carrying `v: 1`
      (with `usTricks` / `themTricks` and no `tricks`) is **rejected**, not migrated. A fresh
      round trip of the new shape carries `seats`, `tricks` and `sooliSeat`.
- [ ] `CLAUDE.md` is updated: the module table's `constants.ts` row, the "us/them" language wherever
      it appears, the Known gaps entry on run persistence (the bump, and that runs in flight are
      discarded once), and a short section on what seat-absolute means and where the viewing seat
      lives. `README.md`'s persistence section says a run saved by an older version is discarded.
- [ ] `components/screens/Rules.tsx` and the `rules.*` catalogue keys are **unchanged**: no rule of
      tuppi moves, so the panel must not be edited. A diff that touches them is a defect.
- [ ] `src/i18n/fi.ts` and `src/i18n/en.ts` are unchanged. No new player-facing string is needed, and
      the catalogue's existing seat references stay right because the viewing seat is 0.
- [ ] All five gates pass: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **`SAVE_VERSION` is bumped to 2, and every run in flight is lost once.** The requirement says
  nothing about saves. Two fields are removed, so an old payload is a different shape, and the
  delivered resume spec says the bump is the tool for exactly that. The alternative — not bumping —
  is survivable (`rehydrate` starts from `createRun`, so `tricks` would land at `[0, 0]` and only
  the deal-end screen's trick split would misreport, once) and would have preserved runs in flight.
  It was rejected because a fourth consecutive non-bump is the drift CLAUDE.md itself warns about,
  and because a removed field is not the "field added later arrives at its createRun value" case the
  three precedents rest on. **If preserving in-flight runs matters more than the shape discipline,
  this is the line to change**, and only this one.
- **The rotation test needs a mirroring bot, and the requirement's "identical team scores" is only
  true for one.** A bot playing `basicPolicy` at seat 3 makes different choices from the AI that
  would otherwise sit there, so the four configurations would play four different games and their
  scores would legitimately differ — the requirement as written is not checkable. The reading taken:
  the rotation test uses a policy that returns exactly what `aiDeclare` / `chooseAI` would return
  for that seat, so all four configurations play the identical thirteen tricks and any difference is
  the bug the test is looking for. That is why the fixture is pinned to a boss-free, joker-free,
  side-deck-free first deal with the sooli declined: those are precisely the paths where `chooseAI`
  draws from the run's `Rng`, and a human-driven seat would not draw it. The `rngState` assertion is
  the tripwire if that ever stops holding.
- **"Identical team scores" is read as within-parity.** The roguelike shell (money, target,
  `blindScore`, `handScore`, the side deck, the jokers) still belongs to **one** team, so with the
  human at seat 1 the run banks team 1's score. Configurations 0 and 2 are compared with each other,
  1 with 3, and the cross-team claim is carried instead by the identical `tricks` pair and the
  identical winner sequence. Generalising the run's inventory to more than one team is not attempted.
- **The team of a seat is `p % 2`.** Seats 0 and 2 are team 0, seats 1 and 3 team 1 — exactly what
  `isUs` encodes today. Partnerships in tuppi are across the table and this is not a rule change.
- **`seats` is a four-element tuple, not an open `SeatKind[]`.** The requirement writes
  `seats: SeatKind[]`; a tuple is one, and it makes `seats[3]` non-optional the way `hands` and
  `shows` already are.
- **Sooli grew a seat the requirement did not list.** The sooli player is hardcoded as seat 0 in
  five places (`sooliOrder`'s trailing `0`, the sit-out `hands[2] = []`, the bust test, `endTrick`'s
  rotation and `scoresForUs`), so `sooliSeat` is added to `GameState` and `acceptSooli`,
  `declineSooli` and `startSooliPlay` gain a seat alongside the five actions named. Without this the
  rotation test cannot run a sooli at all and the change would not be seat-absolute.
- **The sooli offer goes to a human on the defending side, and to nobody otherwise.** Today the
  `soolioffer` phase is entered on `ramTeam === 1`, which is an us/them test. It becomes: a seat
  marked `"human"` whose team is not `ramTeam`. With `seats = ["human","ai","ai","ai"]` that is seat
  0 whenever the declarer is seat 1 or 3 — identical to today. The AI is still never offered sooli,
  which is the current behaviour, not a new restriction. The club's rule sheet allows either
  defender to take it; implementing that choice is a rule change and is out of scope.
- **Hand order stays one shared field.** `sortMode`, `customOrder` and the order of a hand's array
  are presentational, but they live on `GameState` and stay there; `setSortMode`, `reorderHand` and
  `moveCard` gain a seat so they act on the right hand. Under real multiplayer two peers would fight
  over one `sortMode` — a known limitation, named here and not fixed.
- **Three jokers and one boss stop naming a seat, and their text does not.** `kaveri`, `etukasi` and
  `kaksoiskaveri` read the run owner's seat and its partner from `ScoreContext`; the `umpimahka`
  boss targets the owner's partner rather than seat 2. Their catalogue strings still say "Veikko",
  which stays true because the viewing seat is 0. Making that text follow the seat is out of scope.
- **The context lives in `src/hooks/`, not `src/i18n/`.** "Beside `LocaleProvider`" is read as
  "mounted in the same provider stack, built the same way" — the viewing seat is not text, and
  `src/hooks/` is already where the project keeps its contexts (`gameContexts.ts`).
- **The context's value is a constant `0` in this change.** Nothing sets it; there is no UI and no
  action to change seats. It exists so the literal `0` leaves the components.
- **This is classified `rule`, though it changes no rule.** It rewrites `rules.ts`, `scoring.ts`,
  `ai.ts`, `schedule.ts` and most of `reducer.ts`, so the failure modes it can produce are a deal
  that never advances and a score that silently moves. `rule` is the kind that runs playtest,
  balance and mutation; `infra` would run only the gates and the audit and would skip exactly the
  checks this change needs. The balance stage should find **no** change: any movement in the
  measured numbers is a defect here, not a result.

## Touch points

The files and functions this is expected to change. All real.

- `src/game/types.ts` — `SeatKind`; `GameState.seats`, `.tricks`, `.sooliSeat`; remove
  `usTricks` / `themTricks`; `ScoreContext`'s us/them and seat fields.
- `src/game/constants.ts` — `teamOf`, `sameTeam`, `partnerOf` replace `isUs`.
- `src/game/state.ts` — `createRun`'s literal; `sortHand(g, p: 1 | 2 | 3)` widens to `Seat`;
  `applySort(g)` takes the seat.
- `src/game/rules.ts` — `scoresForUs` → team-parameterised and `sooliSeat`-aware;
  `swapTargets` / `canSwapIn` / `anySwapAvailable` take the seat.
- `src/game/scoring.ts` — `tuppiInfo`, `tuppiMult`, `finalScore`, `scoreTrick` take the team; the
  steel count stops reading `g.hands[0]`.
- `src/game/content.ts` — `kaveri`, `etukasi`, `kaksoiskaveri`, `ylitikki`, `tuppisuu`.
- `src/game/ai.ts` — `handPower`, `aiDeclare`, `chooseAI` (`umpimahka`), `sooliRisk`,
  `chooseLaydown`.
- `src/game/schedule.ts` — `nextTick`'s `declare`, `play` and `laydown` gates.
- `src/game/reducer.ts` — `startDeal`, `dealCards`, `finishDeclare`, `resolveTrick`, `endTrick`,
  `startLaydown`, `endLaydown`, `useConsumable` (`kannanvaihto`, `vaihtokauppa`), and the
  `pickSideCard`, `finishSwap`, `declare`, `aiDeclare`, `acceptSooli`, `declineSooli`, `sooliGive`,
  `startSooliPlay`, `playCard`, `aiPlay`, `layCards`, `passLaydown`, `aiLaydown`, `setSortMode`,
  `reorderHand`, `moveCard` cases.
- `src/game/actions.ts` — the twelve actions that gain `p: Seat`.
- `src/game/save.ts` — `SAVE_VERSION` to 2 and its comment.
- `src/hooks/seatContext.ts` — **new.** The context.
- `src/hooks/SeatProvider.tsx` — **new.** The provider.
- `src/hooks/useSeat.ts` — **new.** `useViewSeat()`.
- `src/hooks/useGameLoop.ts` — the laydown turn's `layTurn === 0`.
- `src/main.tsx` — mount the provider beside `LocaleProvider`.
- `src/components/hand/{Hand,HandTools,Hint}.tsx`,
  `src/components/panels/{Panels,DeclarePanel,SwapPanel,SooliOffer,SooliGive,SooliReady,LaydownPanel}.tsx`,
  `src/components/table/{Table,Seats,ModeBox}.tsx`,
  `src/components/screens/{DealEnd,GameOver}.tsx` — read the seat from the context; dispatch it.
- `src/test/bot.ts` — `Policy`, `basicPolicy`, `playToScreen`, `playChallenge`; the mirroring policy
  the rotation test uses.
- `src/test/harness.tsx` — `renderWith` wraps the seat provider; `loadedState` sets `tricks`.
- `src/game/seats.test.ts` — **new.** The pinned golden and the rotation test.
- `src/test/invariants.test.ts` — the new "no viewing seat in `GameState`" case.
- `src/game/{rules,scoring,reducer,save}.test.ts`, `src/test/render.test.tsx` — updated for the new
  shapes.
- `CLAUDE.md`, `README.md` — the documentation criteria above.

## Out of scope

- **Any multiplayer.** No transport, no lockstep loop, no peer, no lobby, no action queue, no seat
  picker, no UI at all. This is the seam only.
- **Rendering the table from a seat other than 0.** `SEATS[0]` still carries `key: "seat.you"` and
  seats 1–3 still carry the three character names, so a viewing seat of 1 would draw an empty name
  at seat 0. A fourth character name, the seat labels and the joker text that says "Veikko" are the
  follow-up.
- **More than one human on the board.** `seats` can express it and the reducer will honour the
  gates, but the run's money, target, jokers, side deck and banked score still belong to a single
  team, and `finishSwap` still starts the declarations on one seat's say-so.
- **An all-AI configuration playing itself.** `seats = ["ai","ai","ai","ai"]` would make `nextTick`
  never return `null`; whether that is useful is a separate question and no test asserts it.
- **Letting either defender take the sooli**, which the club's rule sheet allows and this engine has
  never implemented. That is a rule change and needs its own spec.
- **Changing any number.** No balance tuning, no new joker, no new enhancement, no new phase. The
  balance stage should measure exactly what it measured before.
- **Migrating saves across the bump.** An old save is discarded, as
  `2026-09-04-resume-a-run-after-a-refresh` specified.
- **Per-peer hand order.** `sortMode` and `customOrder` stay single-valued on `GameState`.

## Source

- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022).** Tuppi is four players
  in two partnerships sitting across from each other. Every positional rule in the sheet is stated
  relative to the **dealer** or the **elder hand** (etukäsi, the seat to the dealer's left) — who
  shows first, who leads in nolo, who leads in rami — and never relative to a fixed seat. The
  engine's `declOrder(dealer)`, `d.leader = (dealer + 1) % 4` and `d.leader = (first + 3) % 4`
  already encode that faithfully. The `isUs(p) = p === 0 || p === 2` axis is not from the rule sheet;
  it is a rendering convenience that leaked into the rules. **This change removes the convenience
  and leaves every rule exactly as the sheet states it.**
- **<https://korttipeliopas.fi/tuppi>.** Confirms the same: four players in partnerships,
  _"Etukäsi näyttää ensimmäisenä"_ (the elder hand shows first) with the declaration continuing
  clockwise; in nolo the elder hand leads, and in rami
  _"ramaajasta eli ramia näyttäneestä pelaajasta edellinen pelaaja"_ (the player before the one who
  declared rami) leads. It also states the sooli reading the engine already follows — one player of
  the defending pair may play alone — including that it is a defender's choice, which the engine
  offers only to the human seat and which this change does not widen.
- **Chosen reading, to be written into a comment in `constants.ts` beside `teamOf`:** a seat's team
  is `p % 2`, because tuppi partners sit opposite each other and seats are numbered clockwise. That
  is the same partition `isUs` expressed; nothing about who partners whom changes.
