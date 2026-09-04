---
id: 2026-09-04-local-top-ten-scoreboard
title: Keep a local top-10 scoreboard of finished runs and show it on the end screens
kind: ui
status: proposed
---

# Keep a local top-10 scoreboard of finished runs and show it on the end screens

## What

A finished run now leaves a trace. `GameState` gains `runScore`, the total of every blind score
banked at cash-out — nothing totals a run today — and when a run ends the provider files one row
under a new `localStorage` key, `tupatro-scores-v1`: seed, ante, blindIdx, runScore, whether the run
was won, and a timestamp. The board keeps the best ten, sorted best first, and is **never** cleared
with the run snapshot, so game over wipes `tupatro-run-v1` and leaves the board standing.

The board is drawn on the game-over and the victory overlay, seed column included, so a player can
read a past run's seed and replay it with the seed dialog. A new pure module `src/game/scores.ts`
owns the row shape, the sort and the top-ten truncation; `src/game/storage.ts` stays the one door to
the browser store. `tupatro-best` keeps being written exactly as it is today.

No tuppi rule, no scoring path and no balance number changes: `runScore` is a sum of numbers the
game already computed, and nothing reads it back into the game.

## Acceptance criteria

- [ ] `src/game/scores.ts` exists and is pure: it exports `SCORES_VERSION`, `SCORES_MAX = 10`,
      `type ScoreRow = { seed: string; ante: number; blindIdx: number; runScore: number; won: boolean; at: number }`,
      `rowFor(g: GameState, won: boolean, at: number): ScoreRow`,
      `addScore(rows: ScoreRow[], row: ScoreRow): ScoreRow[]` and `parseScores(raw: unknown): ScoreRow[]`.
      It imports neither React, the DOM, `localStorage`, `i18n`, `reducer` nor any component, calls
      no `Date.now()` (the caller passes `at`), and is added to `PURE_CORE` in
      `src/test/invariants.test.ts`, where it passes those cases.
- [ ] `addScore` sorts **best first**: `won` true before false, then higher `ante`, then higher
      `runScore`, then earlier `at`; and it keeps at most `SCORES_MAX` rows. `src/game/scores.test.ts`
      feeds a deliberately shuffled ten-row list and asserts the exact resulting `seed` order, then
      asserts that an eleventh row worse than all of them is dropped and an eleventh better than the
      last evicts exactly that last row.
- [ ] `addScore` is idempotent on an equal row: two rows equal on `seed`, `ante`, `blindIdx`,
      `runScore` and `won` are the same row whatever their `at`, and the **existing** row is kept
      with its original `at`. Test:
      `addScore(addScore(rows, r), { ...r, at: r.at + 5000 })` deep-equals `addScore(rows, r)`.
- [ ] `parseScores` never throws and returns `[]` for each of: `raw` not an object, a payload whose
      `v !== SCORES_VERSION`, `rows` not an array, and a row with a missing or wrongly typed field
      (one case per field type checked). Given a valid payload of fifteen rows it returns the ten
      best in `addScore` order. One test case per rejection in `src/game/scores.test.ts`.
- [ ] `GameState` gains `runScore: number` in `src/game/types.ts`, `createRun` initialises it to `0`
      in `src/game/state.ts` (the existing "defines every state field in createRun" invariant covers
      it), and `cashOut` in `src/game/reducer.ts` does `d.runScore += d.blindScore`. Tests in
      `src/game/reducer.test.ts`: driving a seeded run with `src/test/bot.ts` past two cleared
      blinds leaves `runScore` equal to the sum of those two blind scores; dispatching
      `showHandResult` twice on the same cash-out does not add it twice (the existing `d.screen`
      guard); the blind the run dies on adds nothing, so a `gameover` state's `runScore` equals the
      total from the blinds already banked; and `newRun` returns `runScore` to `0`.
- [ ] `src/game/storage.ts` holds `SCORES_KEY = "tupatro-scores-v1"` beside `BEST_KEY` and `RUN_KEY`
      and exports `readScores(): ScoreRow[]` (parse through `parseScores`, `[]` on anything else) and
      `writeScores(rows: ScoreRow[]): void`, each wrapped in `try/catch` so a private window degrades
      to no board rather than a thrown render. A test writes both keys, calls `clearRun()`, and
      asserts the run key is gone and the scores key is byte-identical; an `invariants.test.ts` case
      asserts the only `removeItem(` call site in `src/` is in `clearRun` and that it names `RUN_KEY`.
- [ ] The single screen effect in `src/hooks/GameContext.tsx` — and no other site — records the run:
      on `screen.kind === "gameover"` or `"victory"` it calls `clearRun()` as today and
      `writeScores(addScore(readScores(), rowFor(state, screen.kind === "victory", Date.now())))`.
      Tests in `src/hooks/GameContext.test.tsx`: mounting on a saved `gameover` screen leaves
      `localStorage["tupatro-run-v1"]` null while `tupatro-scores-v1` holds exactly one row with that
      run's seed, ante, blindIdx and runScore and `won === false`; the same on a `victory` screen
      gives `won === true`; and after a further dispatch and re-render the board still holds exactly
      one row.
- [ ] `src/components/screens/Scoreboard.tsx` is presentational: its only prop is `rows: ScoreRow[]`,
      it imports nothing from `src/game/storage.ts`, and it renders one line per row with the rank,
      the seed, `{ante}/8`, `t(BLIND_KEYS[row.blindIdx])`, `fmt(row.runScore)` and `t("score.won")`
      or `t("score.lost")`. With `rows={[]}` it renders `t("score.empty")` and no table.
- [ ] `GameOver.tsx` and `Victory.tsx` render `<Scoreboard rows={addScore(readScores(), rowFor(g, won, at))} />`
      with `at` from a `useState(() => Date.now())` initialiser, and a comment says why the merge
      exists: a child's effect runs before the provider's, so on the commit that first shows the end
      screen the row is not on disk yet and the run would be missing from its own board. Test with
      `renderWith` and a stubbed store holding three rows: four lines are shown and one of them
      carries the current seed; with the identical row already stored, still four lines and no
      duplicate.
- [ ] The new keys `score.title`, `score.empty`, `score.rank`, `score.blind`, `score.points`,
      `score.won` and `score.lost` are added to `src/i18n/fi.ts` first and then `src/i18n/en.ts`
      (which will not compile until they are there); the seed and ante column headers reuse
      `seed.label` and `over.ante`. `src/test/render.test.tsx` gains two cases —
      `<Scoreboard rows={…ten rows…} />` and `<Scoreboard rows={[]} />` — which are swept in both
      languages by the existing suite, so no `undefined`, `NaN`, `[object Object]`, leaked key or
      Finnish word in English output.
- [ ] The docs describe the second key: `CLAUDE.md` gains a `game/scores.ts` row in the module table,
      its `game/storage.ts` row names the board, and the run-persistence known gap says the board is
      **not** cleared with the run. `README.md`'s "Saved runs" section gains a scoreboard paragraph
      naming `tupatro-scores-v1`, the ten rows, the sort order, and that the seed is there to be
      replayed. The test counts in both files are updated from 319 to the number `npm test` prints.
- [ ] A browser reading recorded in the pull request, because jsdom shows no layout: with
      `npm run dev`, a board of ten rows on the game-over overlay at **1280x800**, **1280x500** and
      **390x844** — every row legible, nothing clipped, and the New game, Replay seed and Rules
      buttons still reachable by scrolling inside `.overlay`.
- [ ] Gates green: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The requirement never said the board is drawn anywhere; this spec draws it.** It names the key,
  the row, the sort and the write site, and says "the seed is shown so a highscore is replayable".
  A board that is stored and never displayed is dead data, so it is rendered on the game-over and
  victory overlays — the two moments the requirement already names — and nowhere else. That decision
  is what pulls in a new component, seven catalogue keys and CSS. If the reviewer wanted storage
  only, the display is the part to cut.
- **The just-finished run is merged into the board at display time.** React runs a child's effect
  before its parent's, so on the commit that first shows the end screen the provider has not written
  yet; a screen that only read the store would leave the run that just ended off its own board until
  something else re-rendered. Both screens therefore show `addScore(readScores(), rowFor(...))`,
  which is the same pure function the writer uses.
- **Rows equal on everything but the timestamp collapse into one.** That is what makes the write
  idempotent under StrictMode's double effect and under any re-render, and it is why no `useRef`
  guard is needed. The cost: replaying a seed and playing it identically files one row, not two —
  the second identical result is silently absent.
- **The sort is best first and ties break on the earliest timestamp.** The requirement gave the sort
  keys ("won then ante then runScore") but no direction; won runs above lost, higher ante above
  lower, higher score above lower, and whoever got there first keeps the slot.
- **`runScore` counts only what cash-out banked, so the blind you died on counts nothing.** The
  requirement puts the accumulation exactly there. A player who scores 4,900 into a 5,000 target and
  loses sees a row with the previous blinds' total and no trace of that last blind. A skipped blind
  likewise adds nothing. This is the requirement's own arithmetic, not a slip — but it will read as
  one to a player.
- **`SAVE_VERSION` is not bumped.** A run saved before this change resumes with `runScore` at
  `createRun`'s `0` and therefore under-reports itself on the board, once, for saves in flight.
  Bumping would discard every in-progress run in exchange for one accurate leaderboard row.
- **The stored payload is `{ v: SCORES_VERSION, rows }`, not a bare array.** The requirement fixed
  only the key name. Carrying the version inside follows the delivered convention of
  `2026-09-04-resume-a-run-after-a-refresh` (`tupatro-run-v1` holds `v: SAVE_VERSION`), so a shape
  change rejects and overwrites in place rather than orphaning a key nothing cleans up.
- **The timestamp is stored and not shown.** Showing a date needs locale-aware date formatting, of
  which this project has no equivalent to `fmt()`; `at` exists to break ties and to date a row for a
  future feature. Adding a date column would mean adding date formatting to `src/i18n/`.
- **`Date.now()` is called in the React layer only** — in `GameProvider` and in the two end screens —
  and passed into `rowFor`, so `src/game/scores.ts` stays deterministic and testable like the rest of
  the core.
- **The two end screens import `readScores` from `src/game/storage.ts`.** A component reaching the
  browser store is a small break with "components read state and dispatch", and the alternatives —
  a third context, or drilling rows from `GameProvider` through `App` and `Screens` — are more drift
  for less. To keep the door single, the `persistence` invariant is extended to scan
  `src/components/` too, so no component may name `localStorage` itself.
- **Classified `ui`, not `infra`.** Half the diff is state and storage, which reads like the
  delivered `infra` spec for run persistence — but this one puts new content, new strings and a new
  table on two overlays in two languages, and the checks that would catch a mistake there are the
  render sweep and a layout reading. `scoring` was considered and rejected: `scoreTrick`, the
  multiplier table and `ANTES` are untouched, and `runScore` only adds up blind scores the game had
  already computed.
- **This contradicts no delivered spec, and corrects one line by addition.**
  `2026-09-03-party-emblems-and-support` says "`localStorage` still holds only the best ante";
  `2026-09-04-resume-a-run-after-a-refresh` already made that two keys, and this makes it three. The
  run-persistence spec's rule that game-over and victory clear the run is kept exactly — the board is
  a separate key on purpose, and the acceptance criteria pin that `clearRun()` cannot touch it.
- **The board and `tupatro-best` are allowed to overlap.** The requirement says to leave the best
  ante writing alone, so the "best ante" line on the game-over screen and the board's top row can
  report the same run twice. Nothing merges or migrates one key into the other.
- **No rule, phase or panel changes**, so `components/screens/Rules.tsx` is untouched and there is no
  new `g.phase` and no new `g.screen` kind — the scoreboard is a block inside two existing overlays.

## Touch points

- `src/game/scores.ts` — **new, pure.** `ScoreRow`, `SCORES_VERSION`, `SCORES_MAX`, `rowFor`,
  `addScore`, `parseScores`. Added to `PURE_CORE` in the invariants test.
- `src/game/types.ts` — `runScore: number` on `GameState`, beside `blindScore` and `handScore`.
- `src/game/state.ts` — `createRun` initialises `runScore: 0`; a new run therefore resets it.
- `src/game/reducer.ts` — `cashOut()` gains `d.runScore += d.blindScore`, under the existing
  `showHandResult` guard that already stops the reward being paid twice.
- `src/game/storage.ts` — `SCORES_KEY = "tupatro-scores-v1"`, `readScores`, `writeScores`, both
  `try/catch`ed. `clearRun` unchanged: it removes the run key and nothing else.
- `src/hooks/GameContext.tsx` — the existing `state.screen` effect records the row on `gameover` and
  `victory` next to the `clearRun()` it already calls. No new effect, no ref.
- `src/components/screens/Scoreboard.tsx` — **new.** Rows in, markup out.
- `src/components/screens/GameOver.tsx`, `src/components/screens/Victory.tsx` — render the board
  under the existing lines, above the button row.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `score.*` keys; `seed.label` and `over.ante` reused.
- `src/index.css` — the board's rows, in the hand-formatted stylesheet, by class.
- `src/game/scores.test.ts` — **new.** Sort, truncation, idempotence, every `parseScores` rejection.
- `src/game/reducer.test.ts` — `runScore` accumulation, no double count, reset on `newRun`.
- `src/hooks/GameContext.test.tsx` — the row written at game over and at victory, the run key cleared
  while the board survives, one row after a re-render.
- `src/test/render.test.tsx` — a full board and an empty board, swept in both languages.
- `src/test/invariants.test.ts` — `scores.ts` in `PURE_CORE`; the persistence case extended to
  `src/components/`; the `removeItem` call-site case.
- `README.md`, `CLAUDE.md` — the second key, the module row, the known-gap wording, test counts.

## Out of scope

- Any server, account, sync or sharing of the board; export, import or a copy-to-clipboard button.
- A "clear the scoreboard" button or any other way to edit the board from the game.
- Showing the timestamp, a date column or a relative time, and therefore any date formatting in
  `src/i18n/`.
- Highlighting or marking the just-finished run's row within the board.
- Feeding `runScore` back into the game — no reward, money, unlock, ante or shop consequence, so
  nothing here needs a headless balance measurement.
- Recording an abandoned run: only `gameover` and `victory` file a row, and closing the tab mid-run
  files nothing.
- A board anywhere other than the two end overlays — not on the blind select, not in the rail, not
  behind a modal of its own.
- Filtering, paging or sorting the board by another column; ten rows is the whole feature.
- Merging, migrating or changing `tupatro-best`, and changing anything about how the run snapshot is
  written, cleared or versioned (`SAVE_VERSION` is not bumped).
- Counting the failed blind's partial score into `runScore`, and any second total (best blind, deals
  played, tricks won) on the row.

## Source

Not a rule or scoring change. The Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi> describe the deal, the näyttö, rami/nolo, ryöstö and
sooli, and a match that ends when a pair reaches 52 points; they say nothing about keeping a record
of finished games, which is a Balatro-side concern. `runScore` is a plain sum of blind scores the
game already computed at cash-out, so no tuppi scoring rule is read, reinterpreted or altered here.
