---
id: 2026-09-04-view-the-scoreboard-any-time
title: Open the top-ten scoreboard from the rail at any time, and close four coverage holes it shipped with
kind: ui
status: proposed
---

# Open the top-ten scoreboard from the rail at any time, and close four coverage holes it shipped with

## What

The top-ten board is reachable only on the game-over and victory overlays today, which means a
player can read it exactly twice per run and never while playing. After this a third button in the
rail's footer opens it as a player-opened overlay: `g.modal` gains a `"scores"` kind, `Screens`
routes it to a small new component that draws the existing `Scoreboard` with `readScores()`, and
closing it returns to whatever was underneath — the shop, the blind select, or the felt mid-deal —
exactly as the rules modal already does.

The rail button alone does not reach "any time", because `.overlay` covers the rail whenever a
screen is up. So `ScoresModal.tsx` exports a second component, `ScoresButton`, and the four screens
that do not already draw the board — `BlindSelect`, `Shop`, `DealEnd` and `CashOut` — each carry one.
No board is drawn on those screens; the button opens the same modal.

The same change repairs four holes an audit found in the board delivered on this branch in commit
`793eba1`. Each was proven by a mutation that survives all 359 tests: the Victory screen's
display-time merge, the thousands separator on the points column, the won/lost label, and an
invariant whose regex cannot see a string-literal argument. All four are test-side; the row shape,
the sort, the truncation, `tupatro-best` and `tupatro-scores-v1` are untouched.

Two documentation statements the board left wrong are also fixed: `CLAUDE.md` still calls
`components/` "markup only" while three components call `readScores()` during render, and neither
`README.md` nor `CLAUDE.md` records that `SAVE_VERSION` was deliberately not bumped, so a run saved
before the board shipped resumes with `runScore` at `0` and under-reports itself once on the board.

## Acceptance criteria

- [ ] `Modal` in `src/game/types.ts` is `"rules" | "seed" | "restart" | "scores"`, and
      `src/components/screens/Screens.tsx` routes `modal === "scores"` to the new component beside
      the three existing modal branches. No new `Screen` kind, no new `g.phase` — so `nextTick`,
      `Panels`, `Hint` and `SPREAD_PHASES` are untouched — and `SAVE_VERSION` is unchanged, with
      `modal` still absent from `dehydrate`, so `src/game/save.test.ts` needs no edit and stays
      green.
- [ ] `src/components/screens/ScoresModal.tsx` exists and renders `<Overlay>` holding
      `<Scoreboard rows={readScores()} />` and one `btn.back` button dispatching
      `{ type: "closeModal" }`. It imports neither `addScore` nor `rowFor` and never names
      `localStorage`: the in-progress run is **not** merged in. Test in `src/test/render.test.tsx`
      with a stubbed store holding the three `STORED` rows and `loadedState({ modal: "scores" })`:
      exactly three `.scorerow` elements, and none of their `.sseed` texts equals `g.seed`.
- [ ] `src/components/rail/Rail.tsx` gains a third `.railbtns` `button` labelled `t("btn.scores")`,
      beside Rules and New game; the `.railtop` seed chip and the language button are unchanged. A
      render test clicks it and asserts `dispatch` was called with exactly
      `{ type: "openModal", modal: "scores" }`, following the existing assertion at
      `src/test/render.test.tsx:421`.
- [ ] `src/components/screens/ScoresModal.tsx` exports a second component, `ScoresButton`, a
      `btn ghost` button labelled `t("btn.scores")` that dispatches
      `{ type: "openModal", modal: "scores" }`, and `BlindSelect`, `Shop`, `DealEnd` and `CashOut`
      each render exactly one of them. Neither of those four screens draws `.scoreboard`. The sweep in
      `src/test/render.test.tsx` covers every `Screen` kind — its fixture is keyed off
      `Screen["kind"]`, so a kind that neither carries the button nor draws the board is a compile
      error — and asserts, per kind, either the single button and its dispatch or a drawn
      `.scoreboard`.
- [ ] Closing returns to what was underneath, mid-run included. Render test: with
      `loadedState({ screen: { kind: "shop" }, shop: SHOP, modal: "scores" })`, `<Screens />` shows
      `.scoreboard` and no shop markup; the identical state with `modal: null` shows the shop and no
      `.scoreboard`. Reducer test in `src/game/reducer.test.ts`: from a mid-deal state,
      `openModal` with `"scores"` then `closeModal` returns a state deep-equal to the original —
      `screen`, `phase`, `blindScore`, `rngState` and `uidSeq` all untouched.
- [ ] One new catalogue key, `btn.scores`, added to `src/i18n/fi.ts` first and then to
      `src/i18n/en.ts` (which will not compile until it is there); the board itself reuses every
      existing `score.*` key. `VIEWS` in `src/test/render.test.tsx` gains
      `["the scores modal", () => loadedState({ modal: "scores" }), () => <Screens />]`, swept in
      both languages by the existing suite, and with jsdom's absent `Storage` the guarded
      `readScores()` returns `[]` so the modal renders `t("score.empty")` rather than throwing.
- [ ] **Hole 1 — the Victory merge.** A render test asserts the display-time merge on `Victory.tsx`
      the way `src/test/render.test.tsx:382` does for `GameOver`: with only the three `STORED` rows
      written and **no** row pre-written for the run, `<Screens />` on
      `loadedState({ screen: { kind: "victory" } })` shows four `.scorerow .sseed` values and one of
      them is `g.seed`. Mutation check to run and record: replacing
      `addScore(readScores(), rowFor(g, true, at))` in `src/components/screens/Victory.tsx:18` with a
      bare `readScores()` must make `npm test` fail.
- [ ] **Hole 2 — the points column.** A per-language test asserts `.spts` on a row with
      `runScore >= 1000` equals `formatNumber(locale, row.runScore)` and, for `fi`, is not
      `String(row.runScore)` — the pattern already used for the support counts at
      `src/test/render.test.tsx:274`. Mutation check: changing `{fmt(row.runScore)}` at
      `src/components/screens/Scoreboard.tsx:35` to `{row.runScore}` must make `npm test` fail.
- [ ] **Hole 3 — the result label.** A test renders a board holding one `won: true` row and one
      `won: false` row and asserts each row's `.sres` text equals `translate(locale, "score.won")`
      and `translate(locale, "score.lost")` respectively, in both languages, asserting on text and
      not on the `won` class. Mutation check: swapping `t("score.won")` for `t("score.lost")` at
      `src/components/screens/Scoreboard.tsx:37` must make `npm test` fail.
- [ ] **Hole 4 — the `removeItem` invariant.** The capture in `src/test/invariants.test.ts:95`
      matches a literal argument as well as an identifier (e.g. `/removeItem\(\s*([^)]*)\)/g`), the
      number of captured calls equals the number of `removeItem(` occurrences in the stripped body,
      and the captured list is still exactly `["RUN_KEY"]`. Two mutation checks: rewriting
      `removeItem(RUN_KEY)` as `removeItem("tupatro-run-v1")`, and adding a second
      `localStorage.removeItem(SCORES_KEY)` to `clearRun`, must each make `invariants.test.ts` fail.
- [ ] The board's own code is byte-unchanged: `git diff` on the branch shows no edit to
      `src/game/scores.ts` or `src/game/storage.ts`, `src/game/scores.test.ts` is unchanged and
      green, and `tupatro-best`, `tupatro-scores-v1`, `ScoreRow`, `SCORES_MAX`, the `compare` order
      and `parseScores` keep their current behaviour. `Scoreboard.tsx` keeps `rows` as its only
      prop.
- [ ] The docs record the deviations where the laws are stated, not only here. `CLAUDE.md:104`
      (`components/  markup only`) and the `components/screens/*` row at `CLAUDE.md:183` say that
      three components — `GameOver`, `Victory` and `ScoresModal` — read the browser store through
      `game/storage.ts` during render, and that the `persistence` invariant scans `src/components/`
      so no component may name `localStorage` itself; the modal list at `CLAUDE.md:142` and the
      comments in `src/game/types.ts:112` and `src/components/screens/Screens.tsx:12` gain `scores`.
      `README.md`'s "Saved runs" section and the run-persistence known gap in `CLAUDE.md` both state
      that `SAVE_VERSION` was deliberately not bumped for the scoreboard, so a run saved before it
      shipped resumes with `runScore` `0` and under-reports itself once on the board. The test count
      `359` is updated in both files to the number `npm test` prints.
- [ ] A browser reading recorded in the pull request, because jsdom shows no layout: with
      `npm run dev` at **1280x800**, **1280x500**, **390x844**, **360x740** and **844x390**, with
      `.rail.scrollTop === 0`, all **three** `.railbtns button` rects are fully inside the viewport
      (`top >= 0`, `bottom <= innerHeight`), `document.elementFromPoint()` at each centre returns
      that button or a descendant, no label is clipped (`scrollWidth <= clientWidth` on each
      button), and with the board open the `btn.back` button is reachable by scrolling inside
      `.overlay` at 1280x500 and 390x844.
- [ ] Gates green: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **This contradicts a delivered spec, deliberately.** `2026-09-04-local-top-ten-scoreboard`
  (delivered on this branch as commit `793eba1`) puts under Out of scope: "A board anywhere other
  than the two end overlays — not on the blind select, not in the rail, not behind a modal of its
  own." This requirement asks for precisely a rail button and a modal of its own. **This spec's
  reading wins** — the line was scoping for that change, and the user has since seen the board and
  asked for it to be reachable. The reversal is named here so the reviewer sees it rather than
  discovering it in the diff. The reversal extends to the four screen buttons below, so it is stated
  once and in full: a rail button, a modal of its own, and a `ScoresButton` on the blind select, the
  shop, the deal-end screen and the cash-out screen. Everything else in that spec's Out of scope
  still holds: no clear button, no export, no timestamp column, no highlighting of the
  just-finished row, and still no _board_ drawn anywhere but the two end overlays and the modal.
- **The surface is wider than "a rail button" because an overlay hides the rail.** `.overlay` is
  `position:fixed; inset:0; z-index:40` (`src/index.css:466-467`), so the rail's SCORES button
  cannot be clicked while any `Screen` is up — the same limitation that already gave the blind
  select and the game-over screen their own Rules buttons. This spec's own What section promises the
  board closes back to "the shop, the blind select", which is impossible without a way _in_ from
  those screens. Hence `ScoresButton` on the four screens that do not already draw the board. It
  opens the modal and draws no board of its own, so "the board lives in two end overlays and one
  modal" stays true.
- **The seed button is not in the row the new button joins.** The requirement says "beside the
  existing Rules and Seed buttons", but Seed is a `.seedchip` in `.railtop` at the top of the rail
  and Rules and New game are the `.railbtns` footer. The new button goes in `.railbtns` as a third
  `.tinybtn`. Consequence: two delivered specs pin the footer at exactly **two** buttons —
  `2026-09-03-rail-buttons-and-localised-party-emblems` ("both `.railbtns button` elements have a
  bounding rect fully inside the viewport") and `2026-09-03-playable-on-a-phone-screen` (the same at
  390x844, 360x740, 844x390). Their **intent** — every rail button reachable and hit-testable —
  wins and is re-measured for three; only the count changes, and the emulation reading above is the
  proof. If three `flex:1` buttons cannot hold their labels at 360 px, the fix is CSS
  (`flex-wrap`), not a shorter row.
- **The mid-run board shows finished runs only.** `readScores()` and nothing else, per the
  requirement: the run in progress has no result yet, so it is absent from the board a player opens
  mid-run. A player who has banked 12,000 this run sees no row for it until the run ends. The
  display-time `addScore(readScores(), rowFor(...))` merge stays where it is — on the two end
  screens, where the run is over — and is not copied into the modal.
- **The new component is `src/components/screens/ScoresModal.tsx`**, named after `RestartConfirm`
  and `SeedDialog`. It adds no heading of its own — `Scoreboard` already renders `score.title` as an
  `h3` — and its single close button reuses `btn.back`, the key `Rules.tsx` already uses, so the
  change adds exactly one catalogue key.
- **`btn.scores`' wording is the implementer's**, subject to fitting the three-button footer at
  360 px: something short in both languages (Finnish around "Tulokset", English around "Scores").
  A long label is a layout defect, caught by the no-clipping criterion above.
- **The open board does not survive a refresh.** `modal` is not part of the snapshot, and this spec
  does not add it, so reloading with the board open resumes at the last screen boundary with the
  board closed. `SAVE_VERSION` is not bumped here either.
- **All four coverage holes are test-side, and the production code they cover is assumed correct.**
  If the new Victory assertion fails against `Victory.tsx` as written, that is a real bug and the
  **component** is fixed, not the assertion — say so in the pull request, because it would mean the
  won run was missing from its own board.
- **The invariant is widened, not weakened.** The promise stays exactly what it was: `src/` removes
  a storage key from `clearRun` alone, and only `RUN_KEY`. Only the regex that reads the argument
  changes, so a literal key can no longer slip past it.
- **The documentation deviation is recorded, not removed.** Components still may not name
  `localStorage`; `game/storage.ts` stays the single door and the `persistence` invariant keeps
  scanning `src/components/`. What `CLAUDE.md` gains is the honest statement that a component may
  _read_ the store through that door during render.
- **The `SAVE_VERSION` note is documentation only.** No migration, no bump, no backfill of
  `runScore` for a save in flight. The under-report happens once per pre-scoreboard save and then
  never again.
- **Classified `ui`.** The diff is a rail button, an overlay, one catalogue key and a re-measured
  layout, so the render sweep in both languages and the browser reading are the checks that would
  catch a mistake. The test-side repairs read like `infra`, but `infra` would skip the render and
  layout gates that the rail button actually needs. No rule, no scoring path, no balance number is
  touched, so `rule`, `scoring` and `balance` are all wrong.
- **`2026-09-04-local-top-ten-scoreboard` is treated as delivered** (commit `793eba1` is on this
  branch) even though its front matter still reads `status: proposed`. This spec does not edit that
  file.

## Touch points

- `src/game/types.ts` — `Modal` gains `"scores"`; the comment at line 112 lists it.
- `src/components/screens/Screens.tsx` — one more modal branch, and the comment at line 12.
- `src/components/screens/ScoresModal.tsx` — **new**, and it exports **two** components:
  `ScoresModal` (`Overlay` + `Scoreboard rows={readScores()}` + a `btn.back` button dispatching
  `closeModal`) and `ScoresButton` (a `btn ghost` button dispatching
  `{ type: "openModal", modal: "scores" }`).
- `src/components/screens/BlindSelect.tsx`, `src/components/screens/Shop.tsx`,
  `src/components/screens/DealEnd.tsx`, `src/components/screens/CashOut.tsx` — one `ScoresButton`
  each, because the overlay hides the rail. These four do not draw the board.
- `src/components/rail/Rail.tsx` — a third `.tinybtn` in `.railbtns` dispatching
  `{ type: "openModal", modal: "scores" }`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `btn.scores`, in that order.
- `src/index.css` — only if three `flex:1` buttons need wrapping at 360 px; hand-formatted, by
  class, still excluded from Prettier.
- `src/test/render.test.tsx` — the scores modal in `VIEWS`; the modal over the shop and the
  close-returns-underneath pair; the rail button's dispatch; the per-kind sweep keyed off
  `Screen["kind"]`; the Victory merge; the `.spts`
  thousands separator; the won/lost labels.
- `src/game/reducer.test.ts` — `openModal` `"scores"` then `closeModal` leaves the rest of the state
  untouched.
- `src/test/invariants.test.ts` — the `removeItem` capture at line 95 widened to a literal argument,
  with a count check.
- `CLAUDE.md` — the layer table at line 104, the `components/screens/*` row, the modal list at line
  142, the run-persistence known gap, the test count.
- `README.md` — the "Saved runs" section (the `SAVE_VERSION` note) and the test count.

## Out of scope

- Any change to `src/game/scores.ts` or `src/game/storage.ts`: the row shape, `compare`, `SCORES_MAX`,
  `parseScores`, `tupatro-best`, `tupatro-run-v1` and `tupatro-scores-v1` stay exactly as they are.
- A clear-the-board button, editing, export, import, copy-to-clipboard, sync or any account.
- Showing the in-progress run on the board opened mid-run, previewing its `runScore`, or
  highlighting the just-finished row on the end screens.
- A date or timestamp column, and therefore any date formatting in `src/i18n/`.
- Bumping or migrating `SAVE_VERSION`, saving `modal` in the snapshot, or backfilling `runScore` for
  a save written before the board shipped — the consequence is documented, not fixed.
- Sorting, filtering or paging the board, and any board longer than ten rows.
- Drawing the board on the blind select, in the rail itself, or on any screen other than the two end
  overlays and the new modal. The blind select, the shop, the deal-end screen and the cash-out
  screen carry a `ScoresButton` that opens the modal — a way in, not a board.
- ARIA roles, labels, focus trapping or keyboard shortcuts for the new button and overlay — the
  known accessibility gap in `CLAUDE.md` is unchanged.
- A headless balance measurement: no rule, scoring path, `ANTES` value or economy number changes.

## Source

Not a rule or scoring change. The Oulunsalo senior tuppi club rule sheet (Antti Auer,
9 September 2022) and <https://korttipeliopas.fi/tuppi> cover the deal, the näyttö, rami/nolo,
ryöstö, sooli and the 52-point match; neither says anything about keeping or displaying a record of
finished games, which is a Balatro-side concern. Nothing here reads, reinterprets or alters a tuppi
scoring rule: the board displays `runScore`, a sum the game already banked at cash-out, and no value
flows back into play.
