---
id: 2026-09-04-screen-sweep-checks-every-kind
title: Bind the screen sweep to the Screen union, and correct the scoreboard spec to the four buttons that shipped
kind: infra
status: proposed
---

# Bind the screen sweep to the Screen union, and correct the scoreboard spec to the four buttons that shipped

## What

Two statements PR #8 left in the repository are false, and this makes them true. The sweep that
claims to open the board "from every screen" is a hand-written array of six tuples with the
`Screen["kind"]` column bound as `_kind` and never read, so a seventh screen kind compiles,
type-checks and leaves all 380 tests green while shipping an overlay from which the board cannot be
reached — exactly the hole the test's own comment and the `CLAUDE.md` paragraph both claim is
closed. After this the fixture is keyed off the `Screen` union itself, so the compiler refuses an
unhandled kind.

The second correction is to a document, not to code. `2026-09-04-view-the-scoreboard-any-time.md`
puts "A board on the blind select, in the rail itself, or on any screen other than the two end
overlays and the new modal" under Out of scope, while the change it describes exports a second
component, `ScoresButton`, and adds it to `BlindSelect.tsx`, `Shop.tsx`, `DealEnd.tsx` and
`CashOut.tsx` — four files its Touch points never name and no criterion covers. The implementation
is right and its reason is already written down in the code; the spec is wrong and is amended to
match what shipped.

No shipped behaviour changes. `ScoresButton` stays exactly where it is, on all four screens.

## Acceptance criteria

- [ ] `SCREENS` in `src/test/render.test.tsx:520` is no longer `Array<[string, Screen["kind"], …]>`.
      It is an object literal annotated with a mapped type over the union —
      `{ [K in Screen["kind"]]: … }`, or an equivalent `Record<Screen["kind"], …>` — so **omitting a
      kind is a compile error** and an unknown key is a compile error too. The `_kind` binding at
      `src/test/render.test.tsx:560` is gone: the key is the kind, and the entry's `Screen` payload
      is typed `Extract<Screen, { kind: K }>` so the key is load-bearing rather than decorative.
- [ ] The six kinds covered today are still covered, asserting exactly what they assert now, and the
      case names still read `opens the board from <label>`: `blindselect`, `shop`, `dealend` and
      `cashout` render no `.scoreboard`, hold exactly one button whose `textContent` equals
      `translate("fi", "btn.scores")`, and dispatch `{ type: "openModal", modal: "scores" }` when it
      is clicked; `gameover` and `victory` render `.scoreboard` with no click. The shop case still
      passes `shop: SHOP` and the cash-out case still passes its full payload.
- [ ] The mutation proof is run and its output pasted into the pull request body: add a seventh
      member to `Screen` in `src/game/types.ts` (e.g. `| { kind: "sidebet" }`) with the branch
      `Screens.tsx` needs to stay exhaustive, and `npm run typecheck` **and** `npm run build` fail
      with an error naming `SCREENS` in `src/test/render.test.tsx`. Both the type and the branch are
      then reverted.
- [ ] The comment above the `describe("the board is reachable from every screen")` block
      (`src/test/render.test.tsx:509-513`) states which gate closes the hole — the compiler, through
      `npm run typecheck` and `npm run build` — because Vitest transpiles without type-checking and
      `npm test` alone cannot see a missing kind. The sentence "A seventh screen with neither is the
      hole this closes" is only kept if it is true as written after the change.
- [ ] The `CLAUDE.md` sentence "A new screen needs the same, or the board it hides becomes
      unreachable; a render test sweeps all six kinds" (`CLAUDE.md:391`) is replaced by wording tied
      to the union and to the gate: the sweep's fixture is keyed off `Screen["kind"]`, so a new
      screen kind fails to type-check until it is listed there with a Scores button or a drawn
      board. No count of kinds is left hardcoded in that sentence.
- [ ] `docs/specs/2026-09-04-view-the-scoreboard-any-time.md` Touch points name all four files that
      gained the button — `src/components/screens/BlindSelect.tsx`, `Shop.tsx`, `DealEnd.tsx`,
      `CashOut.tsx` — and its `ScoresModal.tsx` entry says the file exports **two** components,
      `ScoresModal` and `ScoresButton`.
- [ ] That spec's Out of scope line "A board on the blind select, in the rail itself, or on any
      screen other than the two end overlays and the new modal" no longer contradicts the four
      buttons. The rewritten line keeps the true part — no board is **drawn** anywhere but the two
      end overlays and the modal — and states that four screens carry a button that opens the modal
      instead.
- [ ] That spec gains an acceptance criterion covering the four buttons, written against what
      shipped: each of `BlindSelect`, `Shop`, `DealEnd` and `CashOut` renders exactly one
      `ScoresButton`, clicking it dispatches `{ type: "openModal", modal: "scores" }`, and the sweep
      in `src/test/render.test.tsx` checks every `Screen` kind either carries that button or draws
      the board itself.
- [ ] That spec's Assumptions record **why** the surface is wider than first written: `.overlay` is
      `position:fixed; inset:0; z-index:40` (`src/index.css:466-467`), so the rail's SCORES button
      is unreachable whenever a screen is up, and the spec's own What section promises the board
      closes back to "the shop, the blind select", which is impossible without a way in from those
      screens. The same paragraph extends the reversal it already names of
      `2026-09-04-local-top-ten-scoreboard`'s Out of scope line ("not on the blind select") to cover
      the buttons, so the reversal is stated once and in full.
- [ ] Nothing shipped moves. `git diff main...HEAD --stat` shows no change under
      `src/components/`, `src/game/`, `src/i18n/` or `src/index.css`; the only file changed under
      `src/` is `src/test/render.test.tsx`. `grep -rn "ScoresButton" src/` still lists its export in
      `src/components/screens/ScoresModal.tsx` and its import in the same four screens.
- [ ] The test count is checked, not assumed: if `npm test` prints a number other than **380**, the
      count is updated in `CLAUDE.md:33`, `CLAUDE.md:342`, `README.md:30` and `README.md:57`; if it
      prints 380, all four are left alone.
- [ ] Gates green: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Confirming the suite fails" is read as "the gates fail", not "`npm test` fails".** Vitest
  transpiles with esbuild and does not type-check, so a fixture keyed off the union is caught by
  `npm run typecheck` and `npm run build` while `vitest run` stays green on a seventh kind. The
  requirement asked for exactly this mechanism ("so the compiler rejects an unhandled kind"), so the
  gate that catches it moves from the test run to the compiler. CI runs both, so the hole is closed
  for anything merged — but a developer running only `npm test` locally will not see it, and that is
  why the criteria above force both the test comment and `CLAUDE.md` to name the gate.
- **A runtime source-scan was considered and rejected.** An `invariants.test.ts` check that
  regex-scans the `Screen` union out of `src/game/types.ts` would make `npm test` itself fail, but
  `CLAUDE.md` already warns that a shape-based regex check is brittle and worse than none, and a
  type union is precisely the wrong thing to parse with one. Compile-time it is.
- **Vitest's own type-checking mode is not enabled.** `vitest --typecheck` with `expectTypeOf` would
  fold the compiler into `npm test`, but that is a Vitest and tsconfig configuration change with its
  own include patterns and runtime cost, and it is a bigger decision than this correction.
- **The label column stays hand-written prose.** Only the kind column is bound to the union; "the
  blind select", "the deal-end screen" and so on remain free text, because they exist to make the
  test name readable and nothing can derive them.
- **How the iteration reaches `it.each` is the implementer's.** `Object.entries` widens the key to
  `string`, so a cast such as `Object.keys(SCREENS) as Screen["kind"][]` is acceptable: the
  guarantee lives in the object literal's annotation, not in how it is walked. A cast that would let
  a **missing** key through is not.
- **The seventh kind exists only during the proof.** It is added, observed to break `typecheck` and
  `build`, and reverted in the same sitting; the criterion that `src/game/types.ts` is unchanged in
  the diff is how the reviewer verifies it did not survive.
- **The amended spec keeps `status: proposed`.** Every spec in `docs/specs/` reads `proposed`,
  including ones long since merged, so flipping this one to `delivered` would be a convention change
  smuggled in as a correction. Only the body is amended.
- **No "Amendments" or changelog section is added to the amended spec.** `TEMPLATE.md` has no such
  section and a spec is a contract rather than a log, so the corrections are woven into What,
  Acceptance criteria, Assumptions, Touch points and Out of scope. Consequence: reading that file
  alone will not reveal that it was corrected after delivery — the record of the correction is this
  spec and the git history.
- **`2026-09-04-local-top-ten-scoreboard.md` is not edited.** Its Out of scope line "A board
  anywhere other than the two end overlays — not on the blind select, not in the rail, not behind a
  modal of its own" is now contradicted twice over, but the reversal is already named in the
  scoreboard-any-time spec's Assumptions and that is where it is extended. One place, not two.
- **Classified `infra`.** The diff is a test fixture's typing, two comments and Markdown. No
  component, no CSS, no catalogue key and no rule, scoring path or balance number is touched, and
  the only `src/` file changed is a test — so `ui` would attach a browser layout reading to a change
  that cannot move a pixel, and `rule`, `scoring`, `balance` and `i18n` are all plainly wrong. The
  checks that would actually catch a mistake here are `npm run typecheck`, `npm run build` and
  `npm test`, and `infra` runs all three.
- **The `PHASES` sweep has the identical hole and is left alone.** See Out of scope.
- **`btn.scores` is used as the button's fingerprint.** `scoreButtonsIn` matches on the Finnish
  translation of `btn.scores`, so renaming that key or giving `ScoresButton` a different label
  breaks the sweep. That coupling exists today and is kept rather than replaced with a test id,
  which would be a production-code change.

## Touch points

- `src/test/render.test.tsx` — the `SCREENS` fixture at line 520, the `it.each` callback at line
  560 (drop `_kind`), and the block comment at lines 509-513. `scoreButtonsIn` (line 410),
  `stubStorageWithBoard` (line 392), `STORED` (line 385) and `SHOP` (line 71) are reused unchanged.
- `src/game/types.ts` — **temporarily only**, for the mutation proof; reverted before the pull
  request, and the diff must show it untouched.
- `CLAUDE.md` — the "An overlay covers the rail" paragraph at lines 386-391; the test counts at
  lines 33 and 342 only if `npm test` prints something other than 380.
- `README.md` — the test counts at lines 30 and 57, under the same condition.
- `docs/specs/2026-09-04-view-the-scoreboard-any-time.md` — What, Acceptance criteria (one added for
  the four buttons), Assumptions (why the surface is wider, and the extended reversal), Touch points
  (the four screens and the second export) and Out of scope (the contradicting line).

## Out of scope

- Removing, moving or restyling `ScoresButton`, changing which screens carry it, changing its label
  or its `btn ghost` class, or touching `ScoresModal`, `Scoreboard`, `game/scores.ts`,
  `game/storage.ts` or either `localStorage` key. The implementation is right; only the words about
  it are wrong.
- Adding a seventh `Screen` kind for real, or any new screen, modal or phase.
- The identical hole in the phase sweep: `PHASES` at `src/test/render.test.tsx:313` is a
  hand-written `Phase[]` that happens to list all eleven phases today and would silently miss a
  twelfth. Same class of defect, same fix shape, deliberately not done here — it needs its own
  requirement, and doing it quietly would hide it in a diff about screens.
- Binding `VIEWS` (line 102) to anything: it is a list of arbitrary render fixtures, not an
  enumeration of a union, so there is nothing to be exhaustive about.
- Enabling `vitest --typecheck`, adding `expectTypeOf` assertions, or any change to
  `vite.config.ts`, `tsconfig*.json`, ESLint or the CI workflow.
- A source-scanning invariant over `src/game/types.ts` in `src/test/invariants.test.ts`.
- Any new catalogue key or player-facing string, in either language.
- A browser or emulation layout reading: nothing rendered changes, so the readings recorded for the
  rail and the overlays in the delivered specs still stand.
- Amending any spec other than `2026-09-04-view-the-scoreboard-any-time.md`, and changing any
  spec's `status` front matter.
- A headless balance measurement: no rule, scoring path, `ANTES` value or economy number is touched.
