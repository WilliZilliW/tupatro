---
id: 2026-09-06-tuppi-rummikub-challenge
title: Add Tuppi-Rummikub, the first challenge — four forced-rami deals with a Rummikub laydown
kind: rule
status: proposed
source: Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022); korttipeliopas.fi/tuppi; Rummikub's own rules for the set/run definitions
---

# Add Tuppi-Rummikub, the first challenge — four forced-rami deals with a Rummikub laydown

## What

The Challenges list stops being empty. Its one row, **Tuppi-Rummikub**, starts a standalone run
with none of the roguelike shell: no antes, no blinds, no targets, no shop, no money, no jokers,
no vouchers, no consumables and no tuppipakka. A challenge run is **four deals**, every one of
them forced rami — no declaration, no nolo, no sooli, no ryöstö — and the tricks decide nothing but
who holds which cards afterwards.

When the thirteenth trick is over, each side's won cards become that side's hand for a **laydown**
played Rummikub-style: sets and runs go on the table, a turn scores the pip value of what it put
there, and every card still in hand at the end costs a point. The four deals' net scores add up to
the run's score, which goes on **the challenge's own top-ten board** under a storage key of its
own. Nothing about it is measured against `ANTES`, and its numbers are not comparable with the
main game's.

## Prior specs

- **Contradicts `2026-09-06-start-menu-with-continue-and-challenges`**, deliberately and in two
  clauses of its delivered criteria: "an empty-state line `challenges.empty` … **zero** list rows"
  and "no `Challenge` type, no content table, no `GameState` field and no rule switch is added: a
  search for `Challenge` under `src/game/` finds nothing". **This spec's reading wins**: the list
  gets one row, `challenges.empty` is removed from both catalogues and from
  `Challenges.tsx`, and `src/game/` gains a `Challenge` type, a `CHALLENGES` table and a
  `GameState.challenge` field. That spec said as much itself ("a later spec adds all of it at
  once"); this is that spec. Everything else it delivered — the menu, `runStarted`, the
  modal → menu → screen order, the menu-up write guard — stands unchanged.
- **Overlaps `2026-09-04-local-top-ten-scoreboard`.** The challenge board is a _second_ board with
  its own row shape, its own version and its own key; the main board's shape, sorting, truncation
  and `tupatro-scores-v1` key are untouched, and the "clearRun removes the run key and nothing
  else" promise is preserved. Anything about the main board is out of scope here.
- **Overlaps `2026-09-05-swipeable-rail-pages-on-phone`.** That spec's five pages, their swipe
  order and the measured rail height stay exactly as delivered **for a main-game run**. A challenge
  run draws a different, shorter page set, because four of the five pages describe a shell the
  challenge does not have. The height clamp is not touched, so nothing it measured is invalidated.
- **Overlaps `2026-09-04-resume-a-run-after-a-refresh`.** A challenge run is never written to
  `tupatro-run-v1`; the main run's snapshot stands untouched through a challenge and the main run
  itself is parked in state, so leaving a challenge gives it back exactly. `SAVE_VERSION` is not
  bumped — see the criteria.

## Acceptance criteria

- [ ] **The laydown's rules are pure and named.** A new `src/game/laydown.ts` (added to
      `PURE_CORE` in `src/test/invariants.test.ts`) exports `pipValue`, `isSet`, `isRun`,
      `comboOk` and `validateLay`. `src/game/laydown.test.ts` asserts: a set is 3 **or** 4 cards of
      one rank with all suits distinct (three jacks pass, four pass, two fail, and J♠ J♠ J♥ fails
      on the repeated suit, built with two distinct `uid`s); a run is 3 or more cards of one suit
      with strictly consecutive ranks; `12,13,14` of a suit passes and `14,2,3` and `13,14,2` both
      fail, because a rank is only ever 2–14 and an ace is only ever 14 — runs do not wrap;
      `pipValue` is the rank (A 14, K 13, Q 12, J 11, else the number) and is **not** `chipValue`,
      which is A 11 and courts 10. The requirement's two worked examples are two of the tests:
      J+J+J laid scores **33**, and 6♥ added to 3♥4♥5♥ scores **6**. Mutation-check `isRun` by
      relaxing its consecutiveness and confirm a test fails.
- [ ] **`validateLay` is the whole legality of a turn, and the reducer is its authority.**
      `validateLay(table, hand, combos)` takes the table as it stands, the mover's laydown hand and
      the proposed table as rows of `uid`s, and returns either `{ ok: true, table, laid }` or
      `{ ok: false, key }`. Six rules, one test and one distinct toast key each: every `uid` names a
      card on the table or in that hand (`toast.layUnknownCard`); no `uid` appears twice
      (`toast.layDuplicate`); every card already on the table appears somewhere in the proposal —
      the table may be rearranged, nothing may leave it (`toast.layTableCardMissing`); every row is
      a legal set or run (`toast.layIllegalCombo`); **any row containing a card that was already on
      the table contains at most one card laid this turn**, while a row made entirely of newly laid
      cards may be three or more (`toast.layOneCard`); and at least one card is laid
      (`toast.layNothing`). The `layCards` case in `src/game/reducer.ts` re-runs `validateLay` and
      toasts on failure rather than trusting the panel, and `reducer.test.ts` reaches all six
      toasts directly.
- [ ] **The state and the phase.** `src/game/types.ts` gains `ChallengeId = "rummikub"`,
      `Challenge`, the `Screen` kind `{ kind: "challengeover"; score: number }`, the `Phase`
      `"laydown"` and these `GameState` fields: `challenge: ChallengeId | null`, `table: Card[][]`,
      `layHands: [Card[], Card[]]`, `layTurn: 0 | 1`, `layNo: number`, `layPassed: number`,
      `layScores: [number, number]`, `parked: SavedRun | null`. `createRun` initialises every one
      of them (`null`, `[]`, `[[], []]`, `0`, `0`, `0`, `[0, 0]`, `null`), so the "defines every
      state field in createRun" invariant keeps passing. The phase's four touch points are all
      walked: `nextTick`, `Panels`, `Hint` (`hint.laydown` / `hint.laydownWait`), and
      `SPREAD_PHASES` in `Hand.tsx`, which is **deliberately left alone** with a comment — during
      the laydown `hands[0]` is empty and the cards are drawn by the panel. `PHASES` in
      `src/test/render.test.tsx` gains `"laydown"`.
- [ ] **A challenge run is four forced-rami deals and nothing else.**
      `{ type: "startChallenge"; id: ChallengeId; seed?: string }` produces a run with
      `challenge` set, `runStarted: true`, `menu: null`, `deals`/`blindDeals`/`dealsLeft` from the
      `CHALLENGES` row (4), `target: 0`, `money: 0`, empty `jokers`, `consumables`, `vouchers` and
      `sideDeck`, `boss: null`, and the first deal already dealt — no `blindselect` screen. Its
      deals skip `swap`, `declare`, `soolioffer`, `sooligive` and `sooliready` outright:
      `startDeal` sets `mode: "rami"`, `ramSeat: null`, `ramTeam: null`, `leader` to the elder hand
      (`(dealer + 1) % 4`) and `phase: "play"`. A `reducer.test.ts` case plays a whole challenge
      deal through `src/game/drive.ts` and asserts the set of phases visited is exactly
      `play`, `resolve`, `trickend`, `laydown`, `handend`; another asserts `startChallenge` from a
      state with jokers, money and a side deck yields none of them; a third asserts `d.sooli` is
      never true and `toShop`/`nextBlind` are never reached.
- [ ] **Won cards become the laydown hands, and the rami's winner leads.** In a challenge
      `resolveTrick` appends the trick's four cards to `layHands[isUs(winner) ? 0 : 1]` and scores
      nothing else. After the thirteenth trick the deal enters `laydown` with `table: []`,
      `layNo: 0`, `layPassed: 0`, `layScores: [0, 0]`, both hands sorted by suit then rank, and
      `layTurn` = `0` when `usTricks >= 7`, else `1` — the side that won the rami leads, and with
      13 tricks exactly one side always has seven. Tests: the two hands hold 52 cards between them
      with no `uid` repeated and each hand's length is four times that side's tricks; a 7–6 split
      leads with side 0 and a 6–7 split with side 1.
- [ ] **The turn cycle ends when neither side can place.** `layCards` and `passLaydown` both end
      the turn: `layNo++`, `layTurn` flips, and `layPassed` becomes `0` after a lay and
      `layPassed + 1` after a pass. At `layPassed >= 2` the laydown ends. Tests: alternating
      lay/pass never ends the laydown; two passes in a row do; a side whose hand is empty passes;
      the driver settles (no `advance: did not settle`) over 20 seeded challenge runs.
- [ ] **Scoring is pips laid minus cards left, and nothing else.** A lay adds
      `sum(pipValue(laid))` to `layScores[side]`. When the laydown ends the deal's score is
      `layScores[0] - layHands[0].length`, which is allowed to be **negative and is not clamped**;
      it goes to `handScore`, is added to `blindScore`, and `dealsLeft--`. `showHandResult` in a
      challenge opens `{ kind: "dealend", score }` while deals remain and otherwise sets
      `runScore = blindScore` and opens `{ kind: "challengeover", score: blindScore }`. Tests: in a
      whole challenge run `scoreTrick` is never called (spy or assert `base === 0`, `scored === 0`,
      `pop === null` throughout), `money` never changes from `0`, `tuppiInfo`'s multiplier never
      reaches the score, and the four `dealend`/`challengeover` scores sum consistently
      (`runScore` equals the sum of the four `handScore`s).
- [ ] **The clock: the opponents are on `nextTick`, the player's 60 seconds are not.**
      `nextTick` returns a tick for the laydown **only** when `layTurn === 1`
      (`{ key: "lay:<layNo>", action: { type: "aiLaydown" }, delay: 900 }`) and `null` on the
      player's turn, so `null` still means "waiting for the player" and `drive.ts` never passes for
      a policy that has a move. The 60-second cap is a fourth effect in
      `src/hooks/useGameLoop.ts` — still the only module that calls `setTimeout`, still balanced
      against `clearTimeout` — depending on `phase === "laydown" && layTurn === 0 ? layNo : -1`, so
      that placing a card mid-turn does **not** restart it, and dispatching
      `{ type: "passLaydown" }` after `LAYDOWN_TURN_MS = 60_000`, exported from
      `src/game/schedule.ts` beside `TOAST_MS` and `POP_MS`. Tests with fake timers: the pass fires
      at 60 s; a `layCards` that leaves it the player's turn again does not reset the timer; the
      timer is gone once `layTurn === 1`.
- [ ] **The opponents play the laydown by the same rules.** `chooseLaydown(g, side)` in
      `src/game/ai.ts` returns proposed rows or `null` to pass, and `aiLaydown` in the reducer runs
      its answer through the same `validateLay` and **passes rather than throwing** if it is
      rejected. Its search is deliberately the simple subset: extend existing combinations by one
      card each, then lay whatever fresh sets and runs the remaining hand affords, highest pip
      first; it never splits or merges. Tests: it extends 3♥4♥5♥ with a held 6♥; it lays a fresh
      set; it returns `null` with a hand that cannot move; and over 20 seeded challenge runs every
      table it produces passes `comboOk` on every row.
- [ ] **The challenge keeps its own board under its own key.** `src/game/scores.ts` gains
      `CHALLENGE_SCORES_VERSION`, `ChallengeRow = { seed, score, at }`, `challengeRowFor`,
      `addChallengeScore` (sorted by score descending, ties to the earlier `at`, truncated to
      `SCORES_MAX`, idempotent on seed+score exactly as `addScore` is) and `parseChallengeScores`
      with the same reject-anything-else contract. `src/game/storage.ts` gains
      `readChallengeScores(id)` / `writeChallengeScores(id, rows)` under
      `` `tupatro-challenge-${id}-v1` `` — for this challenge, `tupatro-challenge-rummikub-v1` —
      and adds no `removeItem`, so the invariant that only `clearRun` removes a key still holds.
      `GameProvider`'s effect writes that board on `challengeover` and, in a challenge, calls
      neither `clearRun()` nor `writeRun()`. Tests in `scores.test.ts` for the row order, the
      truncation, the idempotence and every parse rejection; a test in `GameContext.test.tsx` that
      finishing a challenge leaves `tupatro-scores-v1` and `tupatro-run-v1` byte-identical to what
      they were before it started.
- [ ] **The views.** `Challenges.tsx` lists the `CHALLENGES` table — one row, `nameOf` / `descOf` /
      the row's glyph, this challenge's best score from its own board — with a Play button
      dispatching `{ type: "startChallenge", id: "rummikub" }`, and keeps its Back button;
      `challenges.empty` is gone from the component and from both catalogues. `LaydownPanel.tsx`
      renders through `DeclPanel` from `Panels.tsx` with `key={g.layNo}`, so a new turn remounts it
      and its workspace: the table's rows first, then your laydown hand, then a **sticky** footer of
      Lay / Reset / Pass, with the turn's 60 seconds shown as a CSS-animated bar and no JS clock.
      A click selects a card and a click on a row moves it there; Reset is the only undo; Lay is
      disabled unless the panel's own `validateLay` passes and dispatches
      `{ type: "layCards", combos }`. `ChallengeOver.tsx` draws the run's total and the challenge
      board (class `.scoreboard`), with Play again, Replay seed and Back to menu; `DealEnd` hands
      off to a challenge branch showing deal _n_ of 4, the points laid, the cards left and the run
      total. `SCREENS` in `render.test.tsx` gains `challengeover` as `how: "drawn"` — the fixture is
      compiler-bound, so `npm run typecheck` fails until it is there. The render sweep's `VIEWS`
      gains the Challenges list with its row, the laydown panel mid-turn, the challenge deal end
      and the challenge-over screen, all in both languages with no `undefined`, no
      `[object Object]`, no `NaN`, no leaked key and no Finnish in English output.
- [ ] **The rail tells the truth during a challenge.** `Rail.tsx` builds its page list from the
      state: the delivered five pages for a main-game run, unchanged in class, order and content —
      the existing "puts every plate on its own page, in the documented order" test still passes
      untouched — and for a challenge **two**: `rp-challenge` (a new `ChallengePlate` with the
      challenge's name, deal _n_ of 4, the run total so far, this deal's tricks and, during the
      laydown, both sides' laid points) and the unchanged `rp-game`. `PAGES` becomes the page
      list's length, so the arrows disable at the ends of a two-page strip as well, and `.brand`
      shows the challenge's name in place of `rail.ante`. No plate that reads money, jokers, the
      tuppipakka, consumables, the blind or the target is rendered in a challenge. Tests: the page
      classes and the arrow bounds for both page sets, and that no `.jokers`, `.sidelist`,
      `.cons`, `.blindplate` or `.slate` element exists in a challenge rail. The rail height clamp
      in `src/index.css` is not touched.
- [ ] **Leaving a challenge gives the run back exactly, and disk is never disturbed.**
      `startChallenge` parks the current state as `parked: dehydrate(d)`;
      `{ type: "leaveChallenge" }` returns `rehydrate(d.parked, d.bestAnte)` with `menu: "start"`,
      falling back to a fresh unstarted run at the menu when there is nothing parked or the parked
      snapshot is rejected. `"parked"` joins `Dropped` and `DROPPED_KEYS` in `src/game/save.ts`, so
      a snapshot can never nest and a parked run is never written to disk;
      `SAVE_VERSION` **stays 1**, which is safe here because every new field's `createRun` value is
      the right one for a save written before this change (`challenge: null`, empty `table` and
      `layHands`, `parked: null`) and none of them is read positionally. `GameProvider` returns
      before `writeRun` whenever `state.challenge !== null`. The menu shows a Leave-the-challenge
      button only while `challenge !== null`, and it is the only site that dispatches
      `leaveChallenge`. Tests: park from a mid-deal main run, start and finish a challenge, leave,
      and assert the restored state deep-equals the parked one (jokers, consumables, the boss and
      the shop resolve back to the same table objects); a dehydrated snapshot carries no `parked`
      key; nothing is written to `tupatro-run-v1` at any point during a challenge.
- [ ] **The documents, the measurement and the gates.** `Rules.tsx` gains a Challenges section
      (`rules.challengeTitle` + a `tList` of the laydown's rules: forced rami, won cards become the
      hand, sets and runs, the one-card extension, free rearranging, 60 seconds, pips laid minus
      cards left, four deals, no wrap through the ace) and README gains the same in prose plus the
      challenge's own balance table — **measured**, not guessed: `src/test/bot.ts` gains
      `Policy.laydown` and a `playChallenge(seed, policy)` helper, and a throwaway script over at
      least 200 seeded runs reports median and mean run score, the spread and how often a run
      scores below zero, with the caveat written down that the bot's laydown is the same greedy
      search the opponents use. `CLAUDE.md` gains the challenge to its module layout, phase list,
      known-gaps persistence bullet and the named storage-reading deviation (`Challenges` and
      `ChallengeOver` read the challenge board while rendering, through `game/storage.ts` and
      nothing else), and both files' test counts are updated. `npm run lint`,
      `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and
      `npm run build` all pass, the challenge's glyph is tofu-tested against U+E000 by canvas
      pixels, and one browser reading is recorded in the pull request: at **1280x800**,
      **1280x500** and **390x844**, a whole laydown turn is playable — every row, every hand card
      and all three footer buttons reachable with no page scroll and the footer never below the
      fold.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The trick phase scores nothing.** The requirement describes a score for the laydown and for no
  other part of a challenge deal, so the thirteen tricks exist only to deal the two laydown hands:
  no `evalTrick`, no chips × mult, no tuppi multiplier, no ryöstö, no money. A deal's score is the
  laydown's alone. This is what makes "nothing in it needs to match the main game's scores" true —
  a whole challenge run scores in the low hundreds where a main-game blind scores thousands.
- **"Each side's won cards become its hand" is taken literally: two hands, not four.** The laydown
  is played by the two partnerships — you play your side's hand, the AI plays the opponents' — and
  turns alternate between them. Your partner does not take a turn of their own, and the run's score
  is your side's. The alternative reading, four hands of the cards each seat personally won, was
  rejected because tuppi collects tricks by partnership and the requirement says "side".
- **"The side that won the Rami" is the side with at least seven of the thirteen tricks.** There is
  no declarer to point at in a forced-rami deal, and seven is what wins a rami in tuppi. Exactly one
  side always has it. That reading goes in a comment in the reducer.
- **"Extend … by at most one card per turn" is read per combination, not per turn.** Formally: a
  row that contains any card which was already on the table may contain at most one card laid this
  turn; a row of entirely new cards may be three or more. The alternative — one extension in the
  whole turn — is the harsher reading and was rejected because the sentence qualifies "any
  combination", not "a turn".
- **A deal's score may be negative** and is not clamped: a side that wins four cards and cannot use
  them scores −4. The run total may therefore be negative too, and the board sorts it as it is.
- **A turn that places nothing is a pass, and two consecutive passes end the laydown.** That is the
  operational reading of "turns go round until nobody can place another card", and it terminates:
  each turn either lays at least one of the 52 cards or passes.
- **The 60-second cap is a real-time limit on a human's thinking, not a step of the game**, so it
  lives in `useGameLoop` and not in `nextTick`. A tick for the player's own turn would make
  `drive.ts` auto-pass for a bot that has a move, and every headless measurement of the mode would
  measure nothing. The cost: this is timing that is not data, the only such timing in the project,
  and it is invisible to the headless driver by design.
- **Starting a challenge parks the main run in state and asks no confirmation.** Leaving the
  challenge restores it exactly, including mid-deal, because the park is a full `dehydrate`. A
  challenge run itself is never saved, so **reloading the page during a challenge loses the
  challenge** and resumes the main run at its last snapshot. New Game from the menu during a
  challenge still discards everything, parked run included, as New Game always has.
- **The elder hand — the seat to the dealer's left — leads the first trick**, since a forced-rami
  deal has no declarer whose right-hand neighbour would lead. That is tuppi's own default opening
  lead in nolo, and it rotates with the dealer across the four deals.
- **The laydown's interaction is click-to-select then click-a-row**, in a workspace local to
  `LaydownPanel` and committed by one `layCards` action; Reset is the only undo and there is no
  drag. The AI plays the same rules with a simpler search — it extends and lays, and never splits
  or merges a combination. That is a weaker opponent, not a different rule set, and it is written
  into the panel's comment and the README so nobody reads it as a bug.
- **No Rummikub rule the requirement did not name is imported**: no jokers or wildcards, no
  30-point initial meld, no pool to draw from, no time-race variant. The deck is the tuppi deck of
  52, so a card is unique and no combination can contain the same card twice.
- **Parties and support keep working in a challenge** — the emblem is card-face data, not part of
  the roguelike shell the requirement strips — but no rail plate shows the tally during one, and it
  affects no score. The challenge rail is two pages, not five.

## Touch points

The files and functions this is expected to change. Name real ones.

- `src/game/laydown.ts` — new: `pipValue`, `isSet`, `isRun`, `comboOk`, `validateLay`
- `src/game/types.ts` — `ChallengeId`, `Challenge`, `Phase` `"laydown"`, the `challengeover`
  `Screen` kind, and the eight new `GameState` fields
- `src/game/content.ts` — `CHALLENGES`, one row: `{ id: "rummikub", key, g, deals: 4 }`
- `src/game/state.ts` — `createRun` initialises every new field
- `src/game/actions.ts` — `startChallenge`, `leaveChallenge`, `layCards`, `passLaydown`,
  `aiLaydown`
- `src/game/reducer.ts` — the challenge branch in `startDeal`, `resolveTrick`, `endTrick`,
  `showHandResult`; `startLaydown`/`endLaydown`; the five new cases
- `src/game/schedule.ts` — `nextTick`'s `laydown` case and `LAYDOWN_TURN_MS`
- `src/game/ai.ts` — `chooseLaydown`
- `src/game/scores.ts` — `ChallengeRow`, `challengeRowFor`, `addChallengeScore`,
  `parseChallengeScores`, `CHALLENGE_SCORES_VERSION`
- `src/game/storage.ts` — `readChallengeScores`, `writeChallengeScores`
- `src/game/save.ts` — `"parked"` in `Dropped` and `DROPPED_KEYS`
- `src/hooks/useGameLoop.ts` — the fourth effect, the laydown turn cap
- `src/hooks/GameContext.tsx` — the `challengeover` branch and the no-write-in-a-challenge guard
- `src/components/panels/LaydownPanel.tsx`, `src/components/panels/Panels.tsx`
- `src/components/screens/Challenges.tsx`, `ChallengeOver.tsx`, `ChallengeBoard.tsx`,
  `Screens.tsx`, `DealEnd.tsx`, `Menu.tsx`, `Rules.tsx`
- `src/components/rail/Rail.tsx`, `src/components/rail/ChallengePlate.tsx`
- `src/components/hand/Hint.tsx`, `src/components/hand/Hand.tsx` (the `SPREAD_PHASES` comment)
- `src/i18n/fi.ts` then `src/i18n/en.ts` — the challenge row, the laydown panel, the new toasts,
  the new screens, the rules list; `challenges.empty` removed
- `src/index.css` — the laydown panel's rows, its sticky footer and the 60-second bar
- `src/game/laydown.test.ts`, `reducer.test.ts`, `scores.test.ts`, `save.test.ts`,
  `GameContext.test.tsx`, `i18n.test.ts`, `render.test.tsx`, `invariants.test.ts`, `test/bot.ts`
- `CLAUDE.md`, `README.md`

## Out of scope

What this deliberately does not do, so the implementation does not drift into it.

- A second challenge, a challenge unlock, a challenge-specific modifier or any change to the main
  game's rules, ANTES, blinds, shop, jokers, vouchers, consumables, bosses or measured balance.
- Rummikub's own extras: jokers or wildcards, the 30-point initial meld, a draw pile, the timed
  race variant, or two decks.
- Drag-and-drop anywhere in the laydown, and any undo finer than Reset.
- Saving or resuming a challenge run, and bumping `SAVE_VERSION`.
- A numeric countdown for the 60 seconds; the bar is CSS and there is no second JS clock.
- Merging the challenge board into the main board, or sharing one board between challenges.
- Re-measuring the main game's balance table, or comparing challenge scores with it.
- ARIA, focus order or keyboard shortcuts for the laydown beyond the project's existing
  `focus-visible`; accessibility stays the documented known gap.
- Any change to the five-page rail a main-game run draws, or to the measured rail height clamp.
- Rendering the support tally, money, jokers or the tuppipakka anywhere in a challenge.

## Source

Rule and scoring changes only. Which source was checked, and what it says. Where a rule is open to
interpretation, state the chosen reading — it also belongs in a code comment.

- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** and
  <https://korttipeliopas.fi/tuppi>, checked for the part of the challenge that _is_ tuppi: four
  players in two partnerships, 13 cards each, `"Pelissä on maantuntopakko, mutta ei valttia"` — the
  follow-suit obligation, no trump — and `"Tikin voittaa suurin pelattu kortti ajettua maata"`, the
  highest card of the led suit takes the trick. Rami is won with **seven** tricks. All of that is
  what the challenge's trick phase already does through `rules.ts`, unchanged.
- **The source contradicts the requirement in one place, and the requirement wins knowingly**: in
  tuppi the declaration (`näyttö`) is the core of the game, and nolo, sooli and ryöstö follow from
  it. Tuppi-Rummikub removes all four. That is not a claim about tuppi — it is a _challenge_, an
  alternate rule set the player opts into from a separate list, and the main game's declaration is
  untouched. The rules panel says so in the same words, so the game does not teach the player that
  tuppi has no declaration.
- **Rummikub** for the laydown's vocabulary: a _group_ (here, a set) is three or four tiles of the
  same number in different colours, a _run_ is three or more consecutive numbers in one colour, and
  a run does not wrap round the end of the sequence —
  <https://www.pagat.com/rummy/rummikub.html> and the publisher's own rules,
  <https://rummikub.com/wp-content/uploads/2019/12/2600-English-1.pdf>. Suits stand in for colours,
  so a set is three or four cards of one rank with all suits distinct. The ace is 14 and only 14,
  which is exactly what makes Q-K-A a run and A-2-3 not one, and the code needs no wrap check for
  it — the ranks 2–14 cannot wrap. Everything else about the laydown — the one-card extension cap,
  the 60-second turn, the pip-minus-hand scoring, four deals — is **this game's own**, not
  Rummikub's, and is written down here because there is no source to check it against.
