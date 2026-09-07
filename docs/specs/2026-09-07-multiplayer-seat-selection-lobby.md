---
id: 2026-09-07-multiplayer-seat-selection-lobby
title: Let the player choose which of the four seats to sit at, in a lobby before the run starts
kind: ui
status: proposed
---

# Let the player choose which of the four seats to sit at, in a lobby before the run starts

## What

New Game stops silently seating the player at seat 0. It opens a **lobby** — a third menu view
beside the start menu and the challenges list — that shows the four seats, who partners whom, and
starts the run at the seat the player picked. The chosen seat becomes the run's only `"human"` seat
in `g.seats`, and the window's viewing seat follows it, so the felt draws that seat at the bottom,
the hand is that seat's hand and the rail's money, jokers and tuppipakka are that seat's wallet.

This is the first time anything in the UI sets `g.seats` or the viewing seat to something other
than the single-player default. The machinery it drives was built by
`2026-09-07-seat-absolute-game-state` and `2026-09-07-per-seat-economy` and has until now been
exercised only by tests.

Two consequences the player sees: the seat decides which hand a given seed deals you and where you
sit in the deal rotation, and the seat you take is a chair a character used to occupy — so the cast
gains a fourth member (**Seija**), and the nine catalogue strings that call your partner "Veikko"
stop naming him, because at three of the four seats he is not your partner.

**This does not deliver GitHub issue #20.** See Assumptions: there is no transport, no second
device and no shared-display mode here.

## Prior specs

- **Continues `2026-09-07-seat-absolute-game-state`** (in `main`; front matter still says
  `proposed`, the code is shipped). That spec's **Out of scope** named this work exactly:
  _"Rendering the table from a seat other than 0. `SEATS[0]` still carries `key: "seat.you"` … so a
  viewing seat of 1 would draw an empty name at seat 0. A fourth character name, the seat labels
  and the joker text that says 'Veikko' are the follow-up."_ This spec is that follow-up. It
  reverses nothing in it: the viewing seat stays a React context, `GameState` gains no `you` /
  `viewSeat` / `self` / `me` / `mySeat` / `localSeat` field, and both delivered invariant cases in
  `src/test/invariants.test.ts` must still pass untouched.
- **Continues `2026-09-07-per-seat-economy`** (in `main`). Its **Out of scope** said _"Rendering
  from a seat other than 0. The viewing seat is still a constant `0`; nothing lets a player change
  seats."_ This spec is the thing that lets them. `econOf(g, p)` stays the only door to a wallet,
  `ownerSeat(g)` (the first `"human"` seat) stays the single owner of the roguelike shell, and no
  pure function learns who is looking.
- **Contradicts two delivered criteria of `2026-09-06-start-menu-with-continue-and-challenges`, and
  the lobby reading wins.** That spec says New Game _"with `runStarted: false` … dispatches
  `{ type: "newRun" }` and nothing else"_ and that `RestartConfirm`'s _"confirm (`btn.yesRestart` →
  `newRun`)"_. Both now route through the lobby: New Game opens the lobby (via the restart
  confirmation when a run is in flight), and only the lobby's Start dispatches `newRun`. **The
  reviewer should see this as a reversal**: starting a run now carries a decision that has to be
  made before the run exists, and a confirmation that no longer destroys the run on its own click
  is a change to a delivered flow, not an accident. Everything else in that spec stands — the menu
  is still a third view field, the clock is still stopped while `g.menu` is set, and nothing is
  written to `tupatro-run-v1` while it is up.
- **Overlaps `2026-09-04-resume-a-run-after-a-refresh` (delivered).** `SAVE_VERSION` stays **3**:
  no field is added, removed or moved. `seats` already rides in the v3 snapshot, so the seat a run
  was started at already survives a refresh; what is new is that the window has to follow it back
  (see the criteria on `useSeatSync`). Every v3 save written before this ships carries
  `["human","ai","ai","ai"]` and resumes exactly as it does today.
- **Overlaps `2026-09-06-tuppi-rummikub-challenge` (delivered).** The challenge's rules, its
  60-second turn, its board and its never-saved rule are untouched. One line changes:
  `startChallenge` builds its state with the seat the parked run was played at, so entering a
  challenge does not silently move the player back to seat 0.
- **Overlaps `2026-09-05-swipeable-rail-pages-on-phone` (delivered).** No rail markup and no rail
  CSS changes, so its measured page heights and felt floors stand without being re-measured. The
  lobby is an `.overlay` like every other menu view and is measured on its own.
- **Does not deliver, and is not, `2026-09-05-multiplayer-lobby` on the abandoned
  `origin/multiplayer-mode` branch.** That spec's shape informed this one and its approach is
  **not** ported: it put `localSeat` on `GameState` (forbidden by the delivered invariant, and
  `localSeat` is on `invariants.test.ts`'s banned-name list), it opened the lobby as a modal over
  the blind select and let `sitAt` move the player mid-run — which the per-seat economy has since
  made destructive, because a seat's wallet is the run's inventory — and it made the seat **names
  relative** to the local seat. See Assumptions for why the relative reading is rejected here.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

### The lobby

- [ ] `MenuView` in `src/game/types.ts` becomes `"start" | "challenges" | "lobby"`, and
      `src/components/screens/Screens.tsx` routes `menu === "lobby"` to a new
      `src/components/screens/Lobby.tsx` in the delivered **modal → menu → screen** order, so Rules
      or SCORES opened over the lobby closes back to the lobby. A test renders `<Screens />` with
      `loadedState({ menu: "lobby", modal: "rules" })` and finds the rules panel, and with
      `loadedState({ menu: "lobby", screen: { kind: "shop" }, shop: SHOP })` finds the lobby and no
      shop.
- [ ] `Lobby.tsx` renders through `Overlay` and holds, in this DOM order: `lobby.title`,
      `lobby.dek`, **four** seat rows in seat order 0, 1, 2, 3, a partner line, and a footer with
      Start (`btn.startRun`) and Back (`btn.back`). Each row is a `<button className="seatpick">`
      carrying `data-seat={p}`, the seat's avatar letter (`SEATS[p].short`) and the seat's name from
      `seatName(p, sel)` — so the selected row reads "Sinä" / "You" and the other three read their
      characters. Exactly one row carries a `selected` class.
- [ ] The pending selection is component-local `useState` in `Lobby.tsx`, initialised from
      `useViewSeat()`, and is **never** on `GameState` and never in the save — the same shape
      `SwapPanel.tsx`'s selection uses. Clicking a row moves the selection and dispatches
      **nothing**; the partner line updates to `lobby.partner` with `seatName(partnerOf(sel), sel)`.
      A test with `renderWith(loadedState({ menu: "lobby" }), <Screens />, "fi", 2)` asserts the
      row for seat 2 is selected on mount, clicks the row for seat 1, asserts the selection moved
      and that `dispatch` has not been called.
- [ ] Start dispatches exactly `{ type: "newRun", seat }` with the selected seat and nothing else;
      Back dispatches exactly `{ type: "showMenu", view: "start" }`. Both asserted in
      `src/test/render.test.tsx`, including that Start from a lobby opened at viewing seat 0 with
      the selection moved to 3 sends `{ type: "newRun", seat: 3 }`.
- [ ] The clock stays stopped in the lobby. `nextTick(g)` returns `null` for a state whose
      `nextTick` is otherwise non-null with `menu: "lobby"` — the delivered `g.menu !== null` guard
      in `src/game/schedule.ts` already covers it and must not be narrowed. Asserted in
      `src/game/reducer.test.ts` beside the existing `menu: "start"` case.

### The route in

- [ ] `src/components/screens/Menu.tsx`'s New Game dispatches `{ type: "showMenu", view: "lobby" }`
      when `runStarted` is false and `{ type: "openModal", modal: "restart" }` when it is true. It
      never dispatches `newRun`. `src/components/screens/RestartConfirm.tsx`'s confirm button
      (`btn.yesRestart`) dispatches `{ type: "showMenu", view: "lobby" }` instead of `newRun`; its
      cancel is unchanged. Both delivered tests in `src/test/render.test.tsx` that assert the old
      dispatches are updated, and a new one asserts no path from the menu dispatches `newRun`
      directly.
- [ ] The seed dialog and the two end screens keep dispatching `newRun` directly and carry the
      seat the window is at, so a reseed or a replay does not silently move the player back to seat
      0: `src/components/screens/SeedDialog.tsx` (both buttons), `src/components/screens/GameOver.tsx`
      (both buttons) and `src/components/screens/Victory.tsx` pass `seat: useViewSeat()`. Asserted
      by updating the delivered dispatch assertions for those five buttons, at least one of them
      rendered at a non-zero seat.

### The seat on the run

- [ ] `createRun(seed?, bestAnte = 0, seat: Seat = 0)` in `src/game/state.ts` builds `seats` with
      `"human"` at `seat` and `"ai"` in the other three. The default keeps every existing call site
      compiling unchanged, and `createRun("X")` is deep-equal to what it returns today — asserted in
      `src/game/reducer.test.ts`.
- [ ] `{ type: "newRun" }` in `src/game/actions.ts` gains `seat?: Seat`, and the case in
      `src/game/reducer.ts` passes it: `createRun(action.seed, d.bestAnte, action.seat ?? 0)`.
      `src/game/reducer.test.ts` asserts `newRun` with `seat: 2` yields
      `seats === ["ai","ai","human","ai"]`, `ownerSeat(g) === 2`, `runStarted === true`,
      `menu === null`, and all four `economies` deep-equal to `newEconomy()`.
- [ ] `startChallenge` in `src/game/reducer.ts` builds its state with `ownerSeat(prev)`, so a
      challenge started from a run seated at 2 is played at seat 2 and `leaveChallenge` gives the
      parked run back unchanged. Asserted in `src/game/reducer.test.ts`.
- [ ] The engine's output for a run started at seat 0 is **bit-identical**: the pinned literals and
      the fifty-seed aggregate in `src/game/seats.test.ts` and its rotation test are **unchanged**,
      and the PR body shows `git diff` on that file touching no literal.
- [ ] A whole blind is playable from a seat that is not 0, headlessly. A new case in
      `src/game/seats.test.ts` runs `playBlind(createRun("LOBBY1", 0, 3))` from `src/test/bot.ts`
      and asserts the run reaches a screen (it does not stall), that `g.tricks[0] + g.tricks[1]`
      is 13 after each deal, and that `econOf(state, 3)` is the wallet that moved while
      `econOf(state, 0 | 1 | 2)` stay deep-equal to `newEconomy()`. The same for seat 1, so both
      teams are covered.

### The window follows the run

- [ ] `src/hooks/seatContext.ts` gains a second context for the setter, whose default is a **no-op**
      (a window with no provider cannot change seats, and `GameProvider` is rendered without one in
      `src/hooks/GameContext.test.tsx`). `src/hooks/SeatProvider.tsx` holds the seat in `useState`
      initialised from its existing `seat` prop and provides both contexts, so
      `renderWith(state, ui, locale, seat)` in `src/test/harness.tsx` keeps working unchanged.
      `src/hooks/useSeat.ts` gains `useSetViewSeat(): (p: Seat) => void`; `useViewSeat()` is
      unchanged and every existing call site is untouched.
- [ ] A new hook `src/hooks/useSeatSync.ts` exports `useSeatSync(g: GameState): void`. In an
      effect, and only when `g.seats[you] !== "human"` **and** `g.seats` contains at least one
      `"human"`, it sets the viewing seat to `ownerSeat(g)`. `GameProvider` calls it beside
      `useGameLoop`. A comment in the file records why: `g.seats` is saved and the viewing seat is
      not, so a run resumed at seat 2 would otherwise leave the window looking at a seat it cannot
      act for — every panel would dispatch for an `"ai"` seat, every guard would refuse, and the
      deal would never advance. It uses no timer: `useGameLoop` stays the only `setTimeout` call
      site, which `src/test/invariants.test.ts` already asserts.
- [ ] `src/hooks/GameContext.test.tsx` covers it, wrapping `<SeatProvider>` around `<GameProvider>`
      with a probe that renders `useViewSeat()`: a save whose `seats` seats the human at 2 resumes
      with the probe reading `2`; the delivered `SAVED` save (human at 0) resumes with the probe
      reading `0`; and dispatching `{ type: "newRun", seat: 3 }` moves the probe to `3`. **Shown to
      bite**: with the effect's body removed the first and third fail, recorded in the PR body.
- [ ] `GameState` still names no viewing seat and `src/game/` still imports no seat context: the
      delivered invariant case _"names no viewing seat in GameState, and keeps the context out of
      the core"_ passes **unedited**, and so does _"ports none of the four names main replaced"_ —
      nothing added here may be called `localSeat` or `seatKind`.

### Every seat reads as itself

- [ ] `SEATS` in `src/game/constants.ts` carries **four** characters: seat 0 gains
      `{ name: "Seija", short: "S" }` in place of `{ key: "seat.you", short: "S" }`, and `SeatInfo`
      loses its optional `key`, so all four entries are `{ name, short }`. The four `short` letters
      stay `S`, `R`, `V`, `I` — distinct, and no avatar in single player moves.
- [ ] `seatNameIn(locale, p, you)` in `src/i18n/index.ts` returns `translate(locale, "seat.you")`
      when `p === you` and `SEATS[p].name` otherwise; `I18n.seatName` in
      `src/i18n/localeContext.ts` becomes `(p: Seat, you: Seat) => string` with **no default**, so
      the compiler finds every call site. All seven pass `useViewSeat()`:
      `components/hand/Hint.tsx`, `components/panels/{SooliOffer,SooliReady,DeclarePanel}.tsx`,
      `components/table/{Seats,Table,ModeBox}.tsx`.
- [ ] `src/i18n/i18n.test.ts` asserts, in both locales: `seatNameIn(loc, 0, 0)` is "Sinä" / "You"
      and `seatNameIn(loc, 1 | 2 | 3, 0)` are "Raimo", "Veikko", "Sirpa" — unchanged from today —
      and `seatNameIn(loc, 2, 2)` is "Sinä" / "You" with `seatNameIn(loc, 0, 2)` "Seija". A loop
      asserts that for every viewing seat exactly one of the four names is the "you" string.
- [ ] `src/test/render.test.tsx` renders `<App />` at viewing seat **2** in both languages and
      finds no `undefined`, no `[object Object]`, no `NaN`, no leaked catalogue key and no Finnish
      in English output; it asserts `.seat-s` carries the `us` class and reads "Sinä" / "You", and
      that the row for seat 0 reads "Seija". The delivered case _"puts the viewing seat at the
      bottom of the felt"_ (`expect(south).toBe(SEATS[seat].short)`) still passes unchanged, because
      the avatar stays absolute.

### The text stops calling your partner Veikko

- [ ] These nine keys, in **both** `src/i18n/fi.ts` and `src/i18n/en.ts`, name the partner by
      relation instead of by character: `joker.kaveri.t`, `joker.kaksoiskaveri.t`,
      `cons.vaihtokauppa.t`, `boss.umpimahka.t`, `hint.sooliGive`, `sooli.body`, `sooliGive.title`,
      `sooliGive.fine` and `rules.intro`. Each occurrence of "Veikko" (in any Finnish case:
      Veikolle, Veikon, Veikolta) becomes "kumppanisi" in the appropriate case / "your partner", and
      no other word in those strings changes. `rules.intro` additionally stops asserting a fixed
      cast around you: the Finnish reads "Istut aina alhaalla, kumppanisi on vastapäätä ja kaksi
      muuta vastustavat. Paikkasi valitset ennen ajon alkua." and the English the same in English.
- [ ] `grep -n "Veikko\|Raimo\|Sirpa\|Seija" src/i18n/fi.ts src/i18n/en.ts` finds **nothing**: no
      catalogue string names a character, because a character's seat is now the player's to take.
      The character names live only in `SEATS` in `src/game/constants.ts`, which is where CLAUDE.md
      says they belong.
- [ ] `src/i18n/i18n.test.ts`'s placeholder-parity, list-length and stray-Finnish cases pass
      unchanged, and `src/test/render.test.tsx` still finds no leaked key on the rules panel, the
      sooli panels or the shop rows in either language.
- [ ] Exactly three new keys, added to `fi.ts` first and then `en.ts`: `lobby.title`, `lobby.dek`
      and `lobby.partner` (carrying `{who}` in both languages). Start and Back reuse the existing
      `btn.startRun` and `btn.back`. The `VIEWS` sweep in `src/test/render.test.tsx` gains one entry
      — `loadedState({ menu: "lobby" })` through `<Screens />` — so the lobby is drawn in both
      languages by the delivered guard.

### Documentation and gates

- [ ] `CLAUDE.md` is corrected where it is now false. The seat-absolute section's closing paragraph
      says _"Rendering from a seat other than 0 is **not** done: `SEATS[0]` still carries
      `key: "seat.you"` … and the joker text still says 'Veikko'"_ — it is rewritten to say what is
      true after this: the lobby sets `g.seats` and the window follows through `useSeatSync`, the
      cast is four characters, "Sinä"/"You" follows the viewing seat, and no catalogue string names
      a character. The module table gains `hooks/useSeatSync.ts` and names the lobby in the
      `components/screens/*` row; the overlays paragraph names the third menu view; the test-count
      line matches what `npm test` prints.
- [ ] `README.md` gains a paragraph under **Playing it**: New Game opens a seat picker, the four
      chairs belong to Seija, Raimo, Veikko and Sirpa, you take the chair you pick, your partner
      sits across, and the seat decides which hand a given seed deals you. Its test-count line is
      corrected to what `npm test` prints (it currently says 716).
- [ ] `src/components/screens/Rules.tsx`'s markup is unchanged — only the `rules.intro` string
      moves — and no rule of tuppi changes: `src/game/{rules,scoring,ai,laydown}.ts` are untouched
      by this spec, which a reviewer can check from the diff.
- [ ] `src/index.css` gains one hand-formatted block for `.seatpick` and the lobby's rows, classes
      only, and touches no existing rail or felt selector.
- [ ] All five gates pass: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`.
- [ ] One browser reading recorded in the PR body, because jsdom lays nothing out: with
      `npm run dev` at **1280x800**, **1280x500** and **390x844**, the lobby's four rows and both
      footer buttons are on screen and hit-testable with no page scroll — the delivered rule that a
      footer of buttons under a growing list needs the sticky treatment applies, and 500 px of
      height is where this project has broken three times. At 390x844, start a run at seat 2 and
      confirm the felt draws seat 2 at the bottom with "Sinä" on it and Seija at the top-left seat.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **This spec does not deliver GitHub issue #20, and nothing in it should be read as doing so.**
  Issue #20 asks for a device joining a multiplayer session to be selectable as a shared "table"
  display that mirrors the board live while players use their own phones. There is no multiplayer
  in this repository: no transport, no peer, no session, no action queue, no second device.
  What ships here is the next honest increment of the chain (seat-absolute state → per-seat
  economy → **a lobby that seats the local player**). **For #20 to ship, the increment after this
  one has to be transport**: a session (peer connection or relay), an action queue that replays the
  same `Action` list on every peer in lockstep — which is precisely why `GameState` carries no
  viewing seat — and a lobby that joins a session rather than configuring a local run. Only then
  does a "table" role mean anything, because only then is there another device to mirror.
- **A "table" / spectator role is deliberately not in this increment**, and the reason is
  mechanical rather than aesthetic. `nextTick` in `src/game/schedule.ts` returns `null` for
  `blindselect`, `swap`, `soolioffer`, `sooligive`, `sooliready`, `shop` and for `handend` while a
  screen is up: those steps are a human's decision, not a timer. A board with no `"human"` seat
  therefore **stalls on the first blind-select screen and never deals a card**. A spectator mode is
  not "set all four seats to AI and hide the hands"; it needs an auto-advance path for every screen
  and every player-gated phase, which is a larger surface than the lobby itself and is exactly the
  class of bug the playtest stage exists to catch. On one device it would also show a board nobody
  is playing. It is deferred to the transport increment, where it has a purpose. **If the reviewer
  wants a demo/attract mode on one screen, that is a separate spec** and it should be specified as
  auto-advance, not as a seat role.
- **The seat is chosen when the run starts and cannot be changed mid-run.** The abandoned branch
  let `sitAt` move the player at the blind select; under `2026-09-07-per-seat-economy` that is
  destructive — `ownerSeat(g)` is the first `"human"` seat, so moving seats hands the player
  `newEconomy()` and silently drops the run's money, jokers, vouchers and tuppipakka. No action in
  this spec changes `seats` on a live run; only `newRun` and `startChallenge` build them.
- **Exactly one seat is human.** The lobby seats one player and marks the other three `"ai"`. No
  hot seat, no two humans on one device, no hand hiding between turns.
- **The window seat is corrected from the state by one effect, and the lobby does not set it.**
  There is exactly one writer of the viewing seat — `useSeatSync` — and it fires only when the
  window is looking at a seat that is not `"human"`. The lobby dispatches `newRun` and lets the
  effect follow; a resumed save does the same. The alternative (the lobby calls a setter itself)
  needs two writes to stay in step and still needs the effect for the resume case, so it is the
  same code with an extra way to drift. **This is not the viewing seat moving into `GameState`**:
  the context is still what every component renders from, and the effect only repairs an impossible
  value. It is nevertheless a single-human heuristic — with two humans, `ownerSeat` is the wrong
  answer for at least one window — so the transport increment must replace it with a per-window
  choice. That is written into the hook's comment.
- **No new `localStorage` key.** The seat rides in the run snapshot's `seats`, which v3 already
  carries, and the window follows it on resume. A separate `tupatro-seat` key was rejected because
  a remembered preference and a resumed run can disagree (pick a seat, leave the lobby, resume the
  old run) and the reconciliation would be needed anyway.
- **`SAVE_VERSION` stays 3.** No field is added, removed or moved; `menu` is already dropped from
  the snapshot, so `"lobby"` never reaches disk; every save written before this ships seats the
  human at 0 and resumes unchanged. This is not a fourth deliberate non-bump of the kind CLAUDE.md
  warns about — there is no shape change to defer.
- **A fourth character is invented and named Seija.** Seat 0's chair needs an occupant for the
  three configurations where the player is not in it. Seija is a Finnish name of the same
  generation as Raimo, Veikko and Sirpa, gives the cast two women and two men, and keeps `short:
"S"` — the letter seat 0 already draws — so no avatar in single player moves and the four letters
  (S, R, V, I) stay distinct. **The name is a guess and is the cheapest line in this spec to
  change**; only `SEATS[0].name` and two documentation sentences carry it.
- **Seat names are absolute, not relative to the viewer — this is the fork, and the abandoned
  branch took the other road.** `2026-09-05-multiplayer-lobby` on `origin/multiplayer-mode` made
  the names relative (`seatName(seatIndex(p, local))`), which costs **zero** catalogue edits: your
  partner is always at relative index 2, so "Veikko is your partner" stays true at every seat.
  It is rejected for two reasons. First, it makes the seat choice invisible: every seat would look
  identical from the chair — you south, Veikko north, Raimo west, Sirpa east — so a player-visible
  increment would show the player nothing but a different hand. Second, it is wrong for the
  multiplayer this chain is heading towards: under two peers the same person would read as "Raimo"
  in one window and "Sirpa" in another, and it would have to be undone. The cost of the absolute
  reading is the eighteen rewritten strings below, and it is paid here on purpose.
- **The partner's name is not interpolated into those strings; the relation is used instead.**
  `descOfIn` / `nameOfIn` take no variables, so a joker's description cannot carry one at all, and
  the Finnish strings need the name in three different cases (Veikolle, Veikon, Veikolta), which no
  `{placeholder}` can produce. "kumppanisi" / "your partner" is correct at every seat and needs no
  new i18n machinery.
- **The `kaveri` joker keeps its `g: "V"` glyph** even though its text no longer names Veikko. It
  is a one-letter label nobody decodes, `content.ts` is data this spec has no reason to touch, and
  a new glyph would need the tofu check CLAUDE.md requires.
- **New Game routes through the lobby, and the restart confirmation stops being the destructive
  click.** "Yes, new game" now opens the lobby and the old run survives until Start. This is
  strictly safer than today and it reverses a delivered criterion, which is why it is also named
  under **Prior specs**.
- **The end screens and the seed dialog do not route through the lobby**, following
  `2026-09-06-start-menu-with-continue-and-challenges`'s reading that those runs are already over
  and nothing would be discarded. They pass the current viewing seat so a replay stays where the
  player sat. **If the reviewer wants the seat re-picked on a replay, those five buttons are the
  lines to change.**
- **The lobby lists the four seats in engine order and states the partnership, not the deal
  order.** A rotated table diagram would read better but four rows are what a test can assert, and
  the felt already draws the chosen seat at the bottom the moment the run starts. The deal order is
  deliberately not shown: the dealer rotates on every `startBlind` and `nextDeal`
  (`d.dealer = (d.dealer + 1) % 4`), so "you declare first here" would be false after one deal.
- **The lobby carries Back but no SCORES button**, following the Challenges precedent: the board is
  two clicks away (Back, then SCORES on the menu), so the "an overlay must not hide the board" rule
  is met transitively. A reviewer who disagrees should ask for a `ScoresButton`, as that spec's
  assumption already invites.
- **No seat is claimed to be better or worse, and none is measured.** Every balance figure in the
  README was measured with the human at seat 0. Sitting elsewhere changes which hand a seed deals
  you and where the dealer rotation puts you; nothing in `content.ts`, `constants.ts` or the ante
  table moves, and `seats.test.ts`'s pinned literals must not move either. A per-seat balance
  measurement is out of scope and is named there.
- **`createRun` gains a third parameter with a default of `0`** rather than a required one, so
  every existing call site — `rehydrate`, `initialState`, `startChallenge`, dozens of tests — keeps
  compiling and no pinned golden can move.
- **Classified `ui`, and the two stages that skips are named.** `ui` runs gates, audit, playtest
  and the screen check; `rule` would add balance and mutation but **skip the screen stage**, and
  this change adds a whole overlay with a button footer and rewrites eighteen catalogue strings —
  the stage that catches an unreachable button and overflowing text is the one that matters here,
  and playtest (a run that cannot finish) is the deadlock risk this change actually carries. No
  rule of tuppi moves and no number moves, so balance has nothing to measure; the two mutation
  checks worth running by hand are named in the criteria (remove `useSeatSync`'s effect body;
  revert `seatNameIn`'s `p === you` test) and their output belongs in the PR body.

## Touch points

The files and functions this is expected to change. All real.

- `src/game/types.ts` — `MenuView` gains `"lobby"`.
- `src/game/state.ts` — `createRun(seed?, bestAnte = 0, seat: Seat = 0)`; the `seats` line of its
  `// prettier-ignore` literal.
- `src/game/actions.ts` — `{ type: "newRun"; seed?: string; seat?: Seat }`.
- `src/game/reducer.ts` — the `newRun` case passes `action.seat ?? 0`; `startChallenge` passes
  `ownerSeat(prev)`.
- `src/game/constants.ts` — `SeatInfo` loses `key`; `SEATS[0]` becomes the fourth character.
- `src/i18n/index.ts` — `seatNameIn(locale, p, you)`.
- `src/i18n/localeContext.ts`, `src/i18n/LocaleProvider.tsx` — `seatName: (p, you) => string`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the nine de-named keys and the three new `lobby.*` keys.
- `src/hooks/seatContext.ts` — the setter context, with a no-op default.
- `src/hooks/SeatProvider.tsx` — the seat as `useState`, both providers.
- `src/hooks/useSeat.ts` — `useSetViewSeat()`.
- `src/hooks/useSeatSync.ts` — **new.** The one writer of the viewing seat.
- `src/hooks/GameContext.tsx` — `useSeatSync(state)` beside `useGameLoop`.
- `src/components/screens/Lobby.tsx` — **new.**
- `src/components/screens/Screens.tsx` — the `menu === "lobby"` branch.
- `src/components/screens/Menu.tsx`, `src/components/screens/RestartConfirm.tsx` — New Game and the
  confirmation route to the lobby.
- `src/components/screens/{SeedDialog,GameOver,Victory}.tsx` — `newRun` carries the viewing seat.
- `src/components/table/{Seats,Table,ModeBox}.tsx`, `src/components/hand/Hint.tsx`,
  `src/components/panels/{SooliOffer,SooliReady,DeclarePanel}.tsx` — `seatName(p, you)`.
- `src/index.css` — one block for the lobby's rows, classes only.
- `src/game/reducer.test.ts` — `newRun` with a seat, `createRun`'s default, `startChallenge`'s seat,
  the `menu: "lobby"` tick guard.
- `src/game/seats.test.ts` — the two non-zero-seat blinds; the pinned literals untouched.
- `src/hooks/GameContext.test.tsx` — the resume-at-seat-2 probe and the `newRun` probe.
- `src/i18n/i18n.test.ts` — the viewer-relative `seatNameIn` cases.
- `src/test/render.test.tsx` — the lobby in `VIEWS`, the lobby's buttons, the updated Menu and
  RestartConfirm dispatches, the `<App />` render at seat 2.
- `CLAUDE.md`, `README.md` — the documentation criteria above.

## Out of scope

- **Everything GitHub issue #20 actually asks for.** No transport, no peer connection, no relay, no
  session, no lockstep action queue, no second device, no live update across two browsers, no
  join flow, no "is this device a player or the table" prompt, no screen-size auto-suggestion.
- **A table / spectator role, and an all-AI board.** Named in Assumptions with the reason: every
  screen and every player-gated phase would need an auto-advance path first.
- **More than one human seat**, hot-seat pass-and-play, and hiding a hand between two local turns.
- **Changing seats mid-run**, and any action that writes `g.seats` on a live run.
- **Splitting or summing two live wallets.** `ownerSeat(g)` stays the single owner of the money,
  the shop, the jokers and the tuppipakka, exactly as `2026-09-07-per-seat-economy` left it.
- **Any rule or number.** No tuppi rule, no ante threshold, no price, no slot count, no joker, no
  enhancement, no boss and no new phase. `src/game/{rules,scoring,ai,laydown,shop,content}.ts` are
  untouched and `seats.test.ts`'s literals must not move.
- **A per-seat balance measurement.** Whether a seat is worth more than another is unmeasured and
  unclaimed.
- **Letting either defender take the sooli**, which the club's rule sheet allows and this engine has
  never implemented — still its own spec.
- **Interpolating a character's name into a data-table description.** `descOfIn` takes no variables
  and Finnish case inflection makes it impractical; the relation is used instead.
- **A `SAVE_VERSION` bump, a migration, or a new `localStorage` key.**
- **Rail, felt and hand layout.** No rail markup and no rail CSS changes, so the delivered phone
  measurements stand; only the lobby's own block is added to `src/index.css`.
- **Accessibility.** No ARIA roles, labels or focus management for the lobby beyond the project's
  existing `focus-visible`; the known gap stands.
- **Renaming or re-illustrating the existing three characters**, and any per-seat AI personality —
  `chooseAI` is uniform and stays so.

## Source

Not a rule or scoring change, so no rule is at stake; this section records what was checked anyway,
because the change edits `rules.intro`, which the rules panel draws.

- **<https://korttipeliopas.fi/tuppi>**, re-read for this spec. It confirms four players in two
  teams (_"joukkue"_), that the elder hand shows first (_"Etukäsi näyttää ensimmäisenä"_) and that
  showing continues clockwise, that in nolo the elder hand leads and in rami the player before the
  declarer leads. **It states no seating arrangement and no fixed seat for anybody** — every
  positional rule is relative to the dealer or the elder hand. Nothing in it is touched by letting
  the player pick which chair they sit in.
- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)**, as read and quoted in
  `2026-09-07-seat-absolute-game-state`: partners sit across the table, seats are numbered
  clockwise, and `teamOf(p) = p % 2` is the delivered reading of that. This spec inherits it and
  changes nothing about who partners whom.
- **Chosen reading, to be written into a comment in `src/components/screens/Lobby.tsx`:** which
  chair a player sits in is not a rule of tuppi — the rules are stated relative to the dealer and
  the elder hand — so the lobby may seat the player anywhere without touching the game. What it
  changes is which hand a seed deals them and where the rotating deal puts them.
