---
id: 2026-09-07-new-game-skips-seat-picker
title: Start a single-player run straight from New Game, with no seat picker in the way
kind: ui
status: proposed
---

# Start a single-player run straight from New Game, with no seat picker in the way

## What

New Game starts a run again. With no run in flight it dispatches `{ type: "newRun" }` and the
player is on the blind select; with a run in flight it raises the restart confirmation, and "Yes,
new game" starts the fresh run on that click. A run started either way seats the player at seat 0,
exactly as every run did before `2026-09-07-multiplayer-seat-selection-lobby` shipped.

Nothing else that spec built is removed. `Lobby.tsx` stays in the tree and stays routed for
`g.menu === "lobby"`, `newRun` keeps its optional `seat`, `seatNameIn` keeps its required `you`,
`useSeatSync` stays the single writer of the viewing seat, `startChallenge` keeps carrying
`ownerSeat(prev)`, the relative seat naming stays and Seija stays seat 0's character. What changes
is only which dispatches can reach the lobby: after this, nothing in the single-player menu can,
and the lobby is reserved for the multiplayer mode that comes next.

## Prior specs

- **Reverses one flow change of `2026-09-07-multiplayer-seat-selection-lobby` (on `main`, PR #22),
  and only that.** That spec's criterion _"`Menu.tsx`'s New Game dispatches
  `{ type: "showMenu", view: "lobby" }` … it never dispatches `newRun`. `RestartConfirm.tsx`'s
  confirm button dispatches `{ type: "showMenu", view: "lobby" }` instead of `newRun`"_ is
  **withdrawn**. Its assumption _"New Game routes through the lobby, and the restart confirmation
  stops being the destructive click"_ is withdrawn with it: confirming is destructive again. Every
  other criterion of that spec — the lobby's own markup and three catalogue keys, `createRun`'s
  third parameter, `newRun`'s `seat`, `startChallenge`'s `ownerSeat(prev)`, `useSeatSync`, the
  four-character `SEATS`, `seatNameIn(locale, p, you)`, the nine de-named strings, the `.seatpick`
  CSS block — **stands and must still pass**. The reviewer should read this as a deliberate
  reversal of a delivered flow, not a bug fix: a single-player player is handed a decision they
  never asked to make, and the cost of undoing it is that the lobby now has no route in until
  transport ships.
- **Restores two delivered criteria of `2026-09-06-start-menu-with-continue-and-challenges` (on
  `main`), and this reading wins.** _"with `runStarted: false` the New Game button dispatches
  `{ type: "newRun" }` and nothing else; with `runStarted: true` it dispatches
  `{ type: "openModal", modal: "restart" }` and never `newRun`"_ and _"`RestartConfirm` keeps … its
  confirm (`btn.yesRestart` → `newRun`)"_ are true again, verbatim. The rest of that spec was never
  disturbed and is not touched here.
- **Overlaps `2026-09-07-seat-absolute-game-state` and `2026-09-07-per-seat-economy` (both on
  `main`) in nothing.** No engine call changes. `GameState` still names no viewing seat, `econOf`
  is still the only door to a wallet, `ownerSeat(g)` is still the shell's owner, and
  `src/game/seats.test.ts`'s pinned literals, its fifty-seed aggregate and its rotation test are
  **untouched** — this spec changes no engine input, so no engine output may move.
- **Overlaps `2026-09-04-resume-a-run-after-a-refresh` (delivered).** `SAVE_VERSION` stays **3**
  and no field is added, removed or moved. One live consequence is handled rather than ignored: a
  v3 save written by the lobby build can seat the human at 1, 2 or 3, and such a run still resumes
  at that seat with `useSeatSync` moving the window to it. Starting a fresh run from that window
  puts the player back at seat 0 and the same hook brings the window back — a criterion below pins
  it, because it is the one path where this revert could leave a window looking at an `"ai"` seat.
- **Overlaps `2026-09-06-tuppi-rummikub-challenge` (delivered) in one line that does not change.**
  `startChallenge` keeps passing `ownerSeat(prev)`. With single player back at seat 0 that is `0`,
  which is what it was before the lobby, so the challenge is unaffected either way.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

### The route out of the menu

- [ ] `src/components/screens/Menu.tsx`'s New Game button dispatches exactly
      `{ type: "newRun" }` when `runStarted` is false and exactly
      `{ type: "openModal", modal: "restart" }` when it is true. It dispatches no `showMenu` and
      carries no `seat`. The delivered `it.each` in `src/test/render.test.tsx`,
      _"dispatches from New Game with runStarted %s"_, is updated to those two pairs and still
      asserts `dispatch` was called exactly once.
- [ ] `src/components/screens/RestartConfirm.tsx`'s confirm button (`btn.yesRestart`) dispatches
      exactly `{ type: "newRun" }`; its cancel button still dispatches `{ type: "closeModal" }` and
      its two strings (`restart.title`, `restart.body`) are unchanged. The delivered case
      _"cancels the restart confirmation rather than continuing a run"_ in
      `src/test/render.test.tsx` asserts `newRun` on the confirm click.
- [ ] The delivered case _"starts no run from the menu or its confirmation"_ in
      `src/test/render.test.tsx` is **replaced by its inverse**, under a name that says so: with
      `menu: "start"` and `runStarted: false`, and with `modal: "restart"`, clicking every button
      in the container produces at least one `{ type: "newRun" }` and **no**
      `{ type: "showMenu", view: "lobby" }` on any of the three fixtures the old case swept.
- [ ] `grep -rn '"lobby"' src/components/` finds the view only in
      `src/components/screens/Screens.tsx`'s route. No component under `src/components/`
      dispatches `{ type: "showMenu", view: "lobby" }`, and a test in `src/test/render.test.tsx`
      asserts it for the menu and the confirmation directly.
- [ ] A run started from the menu is seated at 0. `src/game/reducer.test.ts`'s delivered case
      _"seats the human at 0 when newRun names no seat"_ passes unchanged, and a new case asserts
      `gameReducer({ ...createRun("X"), menu: "start", modal: "restart" }, { type: "newRun" })`
      yields `seats === ["human","ai","ai","ai"]`, `runStarted === true`, `menu === null` and
      `modal === null`.

### What the lobby keeps

- [ ] `src/components/screens/Lobby.tsx` is unchanged except for its header comment, and
      `src/components/screens/Screens.tsx` still routes `menu === "lobby"` to it in the delivered
      **modal → menu → screen** order. The comment in one of the two files states that the view is
      **reserved for the multiplayer mode**, not dead code, and names what has to arrive before it
      has a route in again (a transport increment: a session, and a lobby that joins one rather
      than configuring a local run). A reader must not be able to mistake it for an oversight.
- [ ] The lobby's delivered render tests all pass unchanged, so the view stays proven rather than
      merely present: the `VIEWS` sweep entry named "the lobby" (which renders `<Screens />` over
      `loadedState({ menu: "lobby" })`), _"draws the four seats in engine order and marks one"_, _"moves the
      selection without dispatching"_, _"names the partner of the selected seat"_, _"starts the run
      at the selected seat and goes back to the menu"_ and _"draws modal over lobby over screen"_.
      Its three catalogue keys (`lobby.title`, `lobby.dek`, `lobby.partner`) stay in both
      `src/i18n/fi.ts` and `src/i18n/en.ts` and stay drawn in both languages by that sweep.
- [ ] `MenuView` in `src/game/types.ts` keeps `"lobby"`, `{ type: "newRun" }` in
      `src/game/actions.ts` keeps `seat?: Seat`, `createRun(seed?, bestAnte = 0, seat: Seat = 0)`
      in `src/game/state.ts` keeps its third parameter, and `nextTick` still returns `null` for
      `menu: "lobby"` — `src/game/reducer.test.ts`'s delivered assertions for all four pass
      untouched.
- [ ] `src/hooks/useSeatSync.ts`, `src/hooks/seatContext.ts`, `src/hooks/SeatProvider.tsx` and
      `src/hooks/useSeat.ts` are unchanged except where a comment names the lobby as the thing that
      moves the seat, which is corrected to name the multiplayer mode. `useSeatSync` stays the one
      writer, still uses no timer, and `src/test/invariants.test.ts` still finds exactly one
      `setTimeout` call site.
- [ ] `src/hooks/GameContext.test.tsx`'s three delivered seat cases pass unchanged, and one is
      added: rendered inside `<SeatProvider seat={3}>` over a save whose `seats` seat the human at
      3, clicking a button that dispatches `{ type: "newRun" }` with no seat leaves the probe
      reading **0** — the window follows the fresh run back to seat 0 rather than staying on a seat
      the reducer now refuses to act for.
- [ ] `src/game/constants.ts` is untouched: `SEATS` still carries four `{ name, short }` entries
      and seat 0 is still `{ name: "Seija", short: "S" }`, even though a single-player player never
      sees the name. `seatNameIn(locale, p, you)` and `I18n.seatName: (p, you) => string` keep the
      required `you` parameter with no default, and `src/i18n/i18n.test.ts`'s viewer-relative cases
      pass unedited.
- [ ] The nine de-named catalogue strings keep naming the partner by relation and not as Veikko:
      `grep -n "Veikko\|Raimo\|Sirpa\|Seija" src/i18n/fi.ts src/i18n/en.ts` still finds
      **nothing**.

### The one string that is now false

- [ ] `rules.intro` in both `src/i18n/fi.ts` and `src/i18n/en.ts` loses its closing sentence about
      picking a seat — Finnish "Paikkasi valitset ennen ajon alkua." and English "You pick your
      seat before the run starts." — and keeps every other word, "kumppanisi" / "your partner"
      included. Nothing else in the string moves, `src/components/screens/Rules.tsx`'s markup is
      unchanged, and `src/i18n/i18n.test.ts`'s placeholder-parity and stray-Finnish cases and
      `src/test/render.test.tsx`'s rules-panel case pass.

### Documentation

- [ ] `CLAUDE.md` is corrected in the three places it now describes the lobby as the way a run
      starts: the overlays paragraph (`g.menu` is `"start"`, `"challenges"` and `"lobby"`, but
      `"lobby"` is reached from no single-player dispatch), and the section headed **"The lobby is
      what moves the seat, and one effect is what makes the window follow"**, whose sentence
      _"reached from New Game and from the restart confirmation — neither of which starts a run any
      more"_ is now false. The rewrite says: single player starts at seat 0 from New Game, the
      lobby is built and routed but reserved for multiplayer, `useSeatSync` is still the one writer
      and still needed because a lobby-era save can seat the human elsewhere.
- [ ] `README.md`'s **"New game opens a seat picker before it starts anything"** paragraph is
      removed or rewritten to what is true — New game starts a run at once, asking first only when
      Continue is on offer — and the sentence in the paragraph above it, _"goes straight to the seat
      picker when it is not"_, is corrected. No README paragraph may leave a player expecting a
      picker. The four characters may still be named as the table's cast; the README must not claim
      the player chooses among them.
- [ ] `docs/multiplayer.md` is corrected where it reports the delivered state: the paragraph saying
      _"New Game opens a lobby"_ and the stage-4 row now record that the lobby ships but is
      unreachable until transport, so the multiplayer status document does not overstate what a
      player can do.
- [ ] The test-count lines in `CLAUDE.md` (two: the `npm test` comment and the tests-section
      heading) and `README.md` (three) match what `npm test` prints after this change.
- [ ] All five gates pass: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.
- [ ] One browser reading recorded in the PR body, because jsdom lays nothing out: with
      `npm run dev` at **1280x800** and **390x844**, New Game on a fresh boot lands on the blind
      select with no intermediate screen, and with a run in flight New Game → "Yes, new game" lands
      on a blind select at ante 1. Both readings state the click count from menu to felt, which is
      the thing this spec exists to reduce.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **`rules.intro`'s last sentence is edited, which is a narrow exception to the requirement's
  "the nine catalogue strings … stay as they are".** The requirement's intent is that the Veikko
  de-naming survives, and it does. But that string tells the player "Paikkasi valitset ennen ajon
  alkua." / "You pick your seat before the run starts.", and after this change they do not.
  CLAUDE.md is explicit that the rules panel must not teach the player something false, so the
  sentence is dropped rather than left standing. **If the reviewer meant that string to be frozen
  literally, this is the line to object to** — it is one sentence in two files.
- **The lobby stays reachable only through `g.menu === "lobby"`, which no shipped code sets.**
  That is exactly the state the requirement asks for, and it means `Lobby.tsx` is unreachable in
  the running app and is exercised only by `src/test/render.test.tsx`. The alternative readings
  were both rejected: deleting the lobby (the requirement forbids it, and the multiplayer increment
  needs it), and leaving a hidden route in (a debug key, a URL parameter) — which is untested
  surface and a second way to start a run. A comment is the whole mitigation, and the render tests
  are what stop it rotting.
- **New Game and the restart confirmation dispatch a bare `{ type: "newRun" }` with no `seat`,
  rather than `seat: useViewSeat()`.** The seed dialog, `GameOver` and `Victory` keep carrying the
  viewing seat, as the lobby spec delivered, because those replay a run the player was already
  playing. New Game means "a fresh single-player run", and single player is seat 0 by definition —
  passing the window's seat would let a lobby-era save's seat 3 propagate into every subsequent
  fresh run with nothing in the UI able to change it back. `useSeatSync` then walks the window back
  to 0, which a criterion pins.
- **`ownerSeat(prev)` in `startChallenge` is left alone even though it now always evaluates to 0.**
  Removing it would be a second reversal the requirement does not ask for, and it is the correct
  expression regardless of which seat the run happens to be at.
- **`docs/multiplayer.md` is treated as in scope** although the requirement names only CLAUDE.md
  and README.md. CLAUDE.md links to it as the answer to "where does multiplayer stand", and it
  currently reports the lobby as the way New Game behaves. A status document that is wrong is worse
  than no status document.
- **No `SAVE_VERSION` bump, no migration, no new key.** Nothing about the saved shape changes.
  A lobby-era save seating the human at 1–3 keeps resuming at that seat; that is a run in flight
  and it stays playable, which is why `useSeatSync` may not be removed with the route that
  motivated it.
- **The `.seatpick` / `.lobbyfoot` block in `src/index.css` stays**, including its measured
  sticky-footer note, because the markup it styles stays. No CSS is added or removed by this spec.
- **No new catalogue key and no removed catalogue key.** The three `lobby.*` keys stay because the
  view stays; `btn.startRun` and `btn.back` were already shared. The only text edit is the deletion
  inside `rules.intro`, so the i18n surface shrinks by one sentence and nothing else.
- **Classified `ui`, and deliberately not `i18n` or `infra`.** The change is a routing and
  interaction change with a one-sentence text edit riding along; `i18n` would skip the screen and
  playtest stages, and playtest — can a player get from the menu to a playable felt — is the whole
  point of this spec. `rule` was considered and rejected: no tuppi rule moves, `src/game/rules.ts`,
  `scoring.ts`, `ai.ts` and `laydown.ts` are untouched, and `rule` would skip the screen stage that
  matters when an overlay leaves the flow. Two mutation checks are worth running by hand and their
  output belongs in the PR body: put `{ type: "showMenu", view: "lobby" }` back in `Menu.tsx` and
  in `RestartConfirm.tsx`, and confirm the updated render cases fail on each.
- **"No engine output moves" is read as a hard gate, not an aspiration.** The PR body should show
  `git diff --stat` proving `src/game/seats.test.ts`, `src/game/rules.ts`, `src/game/scoring.ts`,
  `src/game/ai.ts` and `src/game/content.ts` are untouched.

## Touch points

The files and functions this is expected to change. All real.

- `src/components/screens/Menu.tsx` — the New Game `onClick`: `newRun` when `runStarted` is false,
  the restart modal when it is true; its comment.
- `src/components/screens/RestartConfirm.tsx` — the confirm button dispatches `newRun`; its
  comment.
- `src/components/screens/Lobby.tsx` — header comment only: reserved for the multiplayer mode.
- `src/components/screens/Screens.tsx` — the `menu === "lobby"` branch stays; a comment may name
  why it has no route in.
- `src/hooks/useSeatSync.ts`, `src/hooks/seatContext.ts` — comments that name the lobby as the
  thing that moves the seat.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `rules.intro` loses its seat-picking sentence.
- `src/test/render.test.tsx` — the New Game `it.each`, the restart-confirmation case, the inverted
  "starts no run" case, a case asserting no menu path reaches the lobby; every lobby case
  unchanged.
- `src/game/reducer.test.ts` — one case for `newRun` from the menu with the restart modal up; the
  `menu: "lobby"` tick guard and the seat cases unchanged.
- `src/hooks/GameContext.test.tsx` — the new case: a bare `newRun` from a window at seat 3 leaves
  the probe at 0.
- `CLAUDE.md`, `README.md`, `docs/multiplayer.md` — the documentation criteria above.

## Out of scope

- **Deleting `Lobby.tsx`, its route, its three catalogue keys or its CSS block.** The requirement
  is explicit that all of it stays for the multiplayer mode.
- **Removing `newRun`'s `seat`, `createRun`'s third parameter, `MenuView`'s `"lobby"`,
  `seatNameIn`'s `you`, `useSeatSync`, `SeatProvider`'s setter context or `startChallenge`'s
  `ownerSeat(prev)`.** Every one stays; a lobby-era save and the next increment both need them.
- **Renaming Seija out of `SEATS`, or restoring `SEATS[0]`'s old `key: "seat.you"`.** The relative
  naming stays.
- **Putting Veikko back into the nine de-named strings.**
- **Transport, a session, a peer, a second device, a shared "table" display, a spectator role or
  more than one human seat.** All still `2026-09-07-multiplayer-seat-selection-lobby`'s successor's
  work, and GitHub issue #20 remains undelivered.
- **Any tuppi rule, any number, any phase.** `src/game/{rules,scoring,ai,laydown,shop,content,
constants}.ts` are untouched and `src/game/seats.test.ts` must not move a literal.
- **A `SAVE_VERSION` bump or a migration for lobby-era saves seated away from 0.** They resume at
  their seat, deliberately.
- **The seed dialog, `GameOver` and `Victory` keeping the viewing seat on their `newRun`.**
  Unchanged, and their delivered assertions stay.
- **Rail, felt, hand and overlay layout.** No CSS changes at all, so the delivered phone and
  short-window measurements stand without being re-measured.
- **Accessibility.** No ARIA roles, labels or focus management; the known gap stands.

## Source

Not a rule or scoring change: no rule of tuppi is at stake, and `src/game/rules.ts`,
`scoring.ts`, `ai.ts` and `laydown.ts` are untouched. This section records what was checked anyway,
because the change edits `rules.intro`, which the rules panel draws.

- **<https://korttipeliopas.fi/tuppi>** and the **Oulunsalo senior tuppi club rule sheet (Antti
  Auer, 9 September 2022)**, as quoted in `2026-09-07-seat-absolute-game-state` and re-checked for
  `2026-09-07-multiplayer-seat-selection-lobby`: partners sit across the table, seats are numbered
  clockwise, and every positional rule is stated relative to the dealer or the elder hand. **Neither
  source names a seat for anybody or gives the player a choice of chair.**
- **Chosen reading, already recorded in `src/components/screens/Lobby.tsx`'s comment and unchanged
  here:** which chair a player sits in is not a rule of tuppi, so seating them at 0 without asking
  is as faithful as letting them pick. The rules panel therefore stops promising a choice, and no
  rule text beyond that one sentence moves.
