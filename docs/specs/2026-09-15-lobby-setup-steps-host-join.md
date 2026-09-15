---
id: 2026-09-15-lobby-setup-steps-host-join
title: Reduce the lobby's landing page to four ways out, and give Open a room a setup step of its own
kind: ui
status: proposed
---

# Reduce the lobby's landing page to four ways out, and give Open a room a setup step of its own

## What

The lobby's landing page — **Set the table**, `g.menu === "lobby"` with no session, the page the
start menu's **Multiplayer** door opens — becomes a title, one line of prose and the four ways out
(**Open a room**, **Join a game**, **Other ways to connect**, **Back**). The name field, the mode
picker and the mode's best-result line leave it.

**Open a room** stops acting from that page. It becomes a navigation button like **Join a game**
beside it, opening a host-setup page of its own that holds the name field, the mode picker with its
best line, a real **Open a room** that calls `net.openRoom()` once the name is valid, and a **Back**
to the landing page. **Join a game** already opens its own page with its own name field and keeps
exactly what it has.

After this, each of the lobby's two first-party routes asks its own questions on its own page, and
the landing page asks one question only: which route. Nothing about the transport, the protocol,
the reducer or any rule changes — `NET_VERSION` stays **6** and `SAVE_VERSION` stays **3**.

## Prior specs

Read before writing. This is the fifth change to this screen in eight days, so the overlaps are
named here rather than rediscovered mid-implementation.

- **Contradicts one delivered sentence in
  [2026-09-14-single-player-separate-from-multiplayer](2026-09-14-single-player-separate-from-multiplayer.md),
  and this spec's reading should win.** That spec left the first page as "a name, a mode and the
  ways out", recorded verbatim in `CLAUDE.md`. This spec moves the name and the mode one step down
  each. **Nothing that spec actually decided is reversed**: its Start removal stands (no Start is
  added anywhere), `lobby.startNote` is not recreated, the chair picker is not restored, and its
  footer of four controls stays four controls in the same order. What changes is only _where the two
  inputs are drawn_, which that spec described rather than defended. `CLAUDE.md` is edited to say so,
  in the same paragraph.
- **Overlaps [2026-09-15-lobby-other-ways-as-text-link](2026-09-15-lobby-other-ways-as-text-link.md)
  (delivered on this branch; `.linkbtn` is at `src/index.css` line 1128).** Its delivered case
  _"draws Other ways to connect as a link, not a button, in the chair table's footer"_
  (`render.test.tsx` line 1302) pins the four `.lobbyfoot` class names on this exact page as
  `["btn", "btn ghost", "linkbtn", "btn ghost"]`. It must pass **unedited**: Open a room keeps
  `className="btn"` even though its `onClick` changes, and the link is not moved. Re-styling that
  control is out of scope here.
- **Overlaps
  [2026-09-15-move-lobby-connection-texts-into-room](2026-09-15-move-lobby-connection-texts-into-room.md)
  (delivered).** It emptied this same page of `lobby.readable` and `lobby.roomRelay`. Its criterion
  that the landing page draws neither stays true and gets easier; its criterion that the **host's
  room page** draws both is untouched, and neither line is added to the new host-setup page — see
  Out of scope.
- **Overlaps [2026-09-11-room-first-multiplayer-lobby](2026-09-11-room-first-multiplayer-lobby.md)
  and [2026-09-13-room-lobby-honest-ready-signal](2026-09-13-room-lobby-honest-ready-signal.md)**
  only in that the pages they own — the host's room page and its readiness lines — are not touched.
  The `<ModePick />` drawn on the host's room page (`Lobby.tsx` line 392) and on the code-swap host
  page (line 537) stays exactly where it is; this spec adds a **third** call site, it does not move
  the two that exist.
- **Not already delivered.** `Lobby.tsx` line 190 declares `useState<"pick" | "join" | "more">`;
  there is no host-setup view, and line 718's Open a room calls `net.openRoom()` directly with
  `disabled={!validName}` from the landing page.

## Acceptance criteria

Every line is checkable by a test in `src/test/render.test.tsx` or `src/i18n/i18n.test.ts`, or by
reading a named file. The one subjective judgement is named as such at the end.

- [ ] **The landing page holds a title, a dek and four footer controls, and nothing else.** On
      `loadedState({ menu: "lobby" })` with the default off-session net, in both locales:
      `container.querySelector("h2")?.textContent` is `translate(locale, "lobby.title")`, the page
      renders `translate(locale, "lobby.dek")`, and `container.querySelector(sel)` is `null` for each
      of `".roominput"`, `"input"`, `".lobbymode"`, `".modepicks"`, `".netlabel"`, `".seatpick"` and
      `".joinas"`. Every `<button>` the lobby renders is one of the four in `.lobbyfoot` (`Screens`
      draws the lobby alone, so `container.querySelectorAll("button")` has length 4).
- [ ] **The mode's best line leaves that page with the picker.** The landing page's `textContent`
      contains neither `translate(loc, "challenges.noBest")` nor `translate(loc, "race.bestWon", …)`
      in either locale. With an empty board `readRaceScores` returns `[]`, so `challenges.noBest` is
      the line that would otherwise show.
- [ ] **Open a room on the landing page navigates and does nothing else.** A case clicks
      `btn.openRoom` there and asserts `net.openRoom` was **not** called, `dispatch` was not called,
      and `net.enterRoom` / `net.invite` / `net.start` were not called. The button is **not**
      `disabled` with an empty `net.name`, because there is no name on that page to be invalid.
- [ ] **The host-setup page holds the name, the mode and the board.** After that click, in both
      locales: `.roominput` and `.lobbymode` are both non-null, the page renders
      `translate(locale, "lobby.name")` and `translate(locale, "lobby.nameHint")`, and
      `.modepicks button[data-mode="race"]` / `[data-mode="tuppi"]` are both present with `race`
      carrying `on` by default.
- [ ] **Its Open a room is the real one, and is gated on the name.** With `net.name` empty the
      footer's `btn.openRoom` is `disabled` and clicking it calls nothing; with a stub net carrying
      a valid name it is enabled, and one click calls `net.openRoom` exactly **once**, with no
      argument, and `dispatch` not at all.
- [ ] **Its footer is exactly two controls, Open a room then Back**, and Back is `setView("pick")`:
      one click returns to a page where `labelled(container, "btn.openRoom")` has length 1,
      `.lobbymode` is null and `dispatch` has not been called; a second Back then dispatches
      `{ type: "showMenu", view: "start" }`. This is the shape the join page already has
      (`btn.joinRoom` + `btn.back`, `Lobby.tsx` lines 669–686).
- [ ] **The join flow is unchanged.** `joinPage()` still reaches the room-code page in one click
      from the landing page, and the delivered case _"holds the room and nothing else on the join
      page, and goes back to the table"_ (line 1426) passes unedited. **No `ModePick` and no best
      line are added to it**: a case asserts `.lobbymode` is null on that page in both locales. See
      Assumptions.
- [ ] **`lobby.dek` no longer instructs the player to type a name.** Both catalogues' `lobby.dek`
      are rewritten to describe the choice between the two routes, with no imperative about a name
      field and no claim that a room is opened "here". A case in `i18n.test.ts` asserts
      `fi["lobby.dek"]` does not match `/nimesi/i` and `en["lobby.dek"]` does not match
      `/your name/i` — prose pointing at an absent control is the same untruth `MoveButton.tsx`
      exists to forbid.
- [ ] **Two keys are added, fi first.** `lobby.openTitle` and `lobby.openDek` are added to
      `src/i18n/fi.ts` and then to `src/i18n/en.ts` (which does not compile until they are there),
      adjacent to the other `lobby.*` entries. Neither carries a placeholder, so `i18n.test.ts`'s
      placeholder and list cases pass unedited, and neither contains the retired invitation
      vocabulary that case at line 92 forbids. The host-setup page's `<h2>` is `t("lobby.openTitle")`
      and its dek is `t("lobby.openDek")`.
- [ ] **No other string is touched.** `git diff src/i18n/` shows exactly three changed entries per
      catalogue: the reworded `lobby.dek` and the two new keys. `lobby.title`, `lobby.name`,
      `lobby.nameHint`, `lobby.mode`, `lobby.roomHint`, `btn.openRoom`, `btn.joinGame`,
      `btn.otherWays` and `btn.back` are byte-identical.
- [ ] **The view union is a four-member literal type.** `Lobby.tsx` line 190 becomes
      `useState<"pick" | "open" | "join" | "more">`, still seeded from `fromLink` exactly as
      today, so a `#j=` link still lands on the code swap and a fifth view cannot appear without
      being named. `NameField` and `ModePick` are **reused**, not duplicated.
- [ ] **Every test that reached the picker, the name field or `net.openRoom` through the landing
      page walks the extra step instead of being deleted.** Named individually under Touch points:
      lines 1110, 1125, 1137, 1180, 1198, 1227, 1313, 2028, 2064, 2751 and the board block at
      3631–3693. No case is removed, and no assertion is left that cannot fail.
- [ ] **The new page is swept for leaks.** A row is added to the leak sweep's lobby list
      (`render.test.tsx` line 2704) reaching the host-setup page by `press(c, "btn.openRoom")`, so
      its two new strings are checked for `undefined`, `[object Object]`, a leaked catalogue key and
      Finnish in English output.
- [ ] **Nothing outside one component, one test file, two catalogues, one i18n test and two
      documents moves.** No file under `src/game/`, `src/net/` or `src/hooks/` is in the diff;
      `GameState`, the `Action` union, `MenuView`, `SCOPE`, `guestMay`, `hashState`, `Net` (including
      `openRoom`'s signature) and `OFF_CHAIRS` are unchanged; `Lobby` gains no prop; `readRaceScores`
      keeps its single component call site inside `ModePick`, and `src/components/` still names
      `localStorage` nowhere, so `invariants.test.ts`'s `persistence` case passes unedited.
- [ ] **No new CSS.** `git diff src/index.css` is empty: the new page reuses `.lobbyfoot`,
      `.lobbymode`, `.netlabel`, `.roominput` and `.dek`. No wrapper `<div>` without a rule of its
      own is introduced — the `.railpage` trap.
- [ ] **The shared table is unaffected and still moves nothing.** The `TABLE_MENUS` sweep's lobby row
      (line 4163) passes unedited: a table's `net.role` returns from the guest/table branch before
      any of these pages, so `net.openRoom` stays uncalled and `onlyLocal(dispatch)` stays empty.
- [ ] **Every gate passes**: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build`. The
      permanent test count rises.
- [ ] **Measured in a Chromium browser over CDP against `npm run dev`**, at **1280×500** and
      **390×844**, on the landing page and on the new host-setup page: the overlay is the only
      scroller (`scrollHeight` equals `clientHeight` on `documentElement`) with `window.scrollY` at
      0 (no page scroll outside `.overlay`), and
      `document.elementFromPoint` at each `.lobbyfoot` button's own centre returns that button or a
      child of it. Record the four readings in the pull request; jsdom lays nothing out, so the
      unit suite is not where this is proven.
- [ ] **`CLAUDE.md` says where the two inputs are drawn.** The lobby paragraph that reads "the setup
      page is a name, a mode and the ways out" and the footer sentence naming **Open a room · Join a
      game · Other ways to connect · Back** are rewritten: the landing page is a title, a line and
      the four ways out; the name and the mode are on the Open a room step; Open a room is
      navigation there and the action one page down. No other document is left claiming otherwise.

**One criterion is subjective and is named as such.** Whether the shortened landing page reads as
deliberate rather than as a page something fell off cannot be asserted by a test. A reviewer should
open Multiplayer at 1280×800 and at 390×844 in both locales and look at three things: that the title
and the single dek do not leave the four controls stranded at the bottom of a tall empty overlay,
that **Open a room** still reads as the primary of the four, and that the host-setup page's heading
makes it obvious which of the two routes was taken.

## Assumptions

Nobody answered a question during this run. Each of these is a reading that was chosen, and a
reviewer who disagrees with one should say so before the diff is merged.

- **The join page gains no mode picker and no best line, and this is the assumption most likely to
  be disputed.** The requirement says name entry, mode picking and the board "move into the Open a
  room and Join a game flows themselves", which read literally could put a picker on both. It is
  read as _each thing goes to the flow that needs it_, because the requirement's own parenthetical
  enumerates the host step as "name + mode + the real Open a room action" and says of the join flow
  only that it "already opens its own page with its own name field". A guest does not choose the
  mode: it arrives with the host's numbered `startChallenge`, and `net.match` on a guest's window is
  a default nobody reads. A picker there would be a control that lies, and a best line beside it
  would describe a mode the guest may not be about to play.
- **`lobby.dek` is reworded rather than moved.** It currently reads "Enter your name and open a
  room. Once the others join, the host places every player in a chair." / "Kirjoita nimesi ja avaa
  huone…" — an instruction about a field that is leaving the page. Moving the string to the new page
  and adding a new key for the landing page was rejected only because `lobby.title` and `lobby.dek`
  are the pair that names this page. **The two deks' wording is this spec's choice, not the
  requirement's**: the landing page's should name the choice between hosting and joining, and
  `lobby.openDek` should carry the sentence about the host placing every player in a chair, which is
  what the old dek's second half said and is true of the page that now opens the room.
- **The new view is named `"open"`, and the new keys `lobby.openTitle` / `lobby.openDek`.** The names
  are this spec's, matching `btn.openRoom`. `"host"` was rejected for the view because
  `net.role === "host"` means something else two branches above it in the same file, and
  `lobby.hostTitle` is already the code swap's.
- **The host-setup page's `<h2>` repeats its own button's words** ("Open a room" / "Avaa huone" is
  the natural translation of `lobby.openTitle`). That is accepted: the heading says which route was
  taken and the footer button performs it, the same shape the join page has with `lobby.joinTitle`
  and `btn.joinRoom`. It is not a collision for the tests, which match button labels by `textContent`
  and read the heading through `querySelector("h2")`.
- **Hanging up from a room lands on the host-setup page, not on the landing page.** `view` is not
  reset anywhere, so a host who opens a room and then hangs up re-renders with `view === "open"` and
  sees the page they started from, one Back away from the landing page. This is a behaviour change
  nobody asked for and is judged an improvement; the alternative — resetting `view` on
  `net.role === "off"` — needs an effect or a render-time write and is not worth one. `roomEscape`'s
  `toOtherWays` still sets `"more"` explicitly and is unaffected.
- **Open a room on the landing page is enabled unconditionally.** The `validName` gate (`Lobby.tsx`
  line 305) moves with the field it validates; a navigation button disabled by a field that is not on
  screen would be unexplainable. `validName` keeps its other call site, the join page's
  `btn.joinRoom`.
- **Open a room keeps `className="btn"` and its position.** Only its `onClick` changes. The delivered
  class-order case is a signal this spec would rather not spend, and the requirement asked for a
  moved step, not a restyled footer.
- **The board-reading block's three cases walk to the new page rather than being re-pointed at the
  single-player rows.** `render.test.tsx`'s `inLobby(match)` helper (line 3644) exists to prove the
  lobby reads `tupatro-race-v1` / `tupatro-tuppi-v1` through `game/storage.ts` while it renders; that
  proof must survive the move, so the helper presses `btn.openRoom` before querying `.lobbymode`. Its
  describe block is a separate `describe.each` and has no access to the lobby block's `press` /
  `labelled` helpers, so it needs a two-line local one.
- **`README.md` is not changed.** Its "You enter a short name, open a room, and assign every
  connected player… to one of the four chairs" and "A picker beside the chairs says which of the two
  match modes Start begins" both stay true one page later — the picker is drawn on the host's room
  page too, and neither sentence names the landing page.
- **`docs/multiplayer.md` is not changed either, and one of its bullets is already stale.** Its "Four
  chairs. …The table opens with you at your own chair" bullet described the chair picker that
  `2026-09-14-single-player-separate-from-multiplayer` deleted; it was stale before this spec and is
  not made more so by it. Fixing it belongs to whoever owns that list.
- **No measurement of balance, no rule and no source citation.** This moves two controls between two
  pages of a configuration screen. Nothing reads a card, a score or a seat differently, so the
  `source` front-matter field is omitted as the template allows for a non-`rule`, non-`scoring` kind.

## Touch points

- `src/components/screens/Lobby.tsx`
  - line 190 — the view union gains `"open"`; the `fromLink` seeding is unchanged, and the comment
    above it gains the fourth page.
  - a new branch immediately before the `view === "join"` one (today line 636) — `if (view ===
"open")`, drawing `t("lobby.openTitle")`, `t("lobby.openDek")`, `<NameField />`, `<ModePick />`
    and a `.lobbyfoot` of `<button className="btn" disabled={!validName} onClick={() =>
net.openRoom()}>` plus `<button className="btn ghost" onClick={() => setView("pick")}>`. Its
    comment says why the action moved off the page before it.
  - lines 691–741, the final `return` ("the table, before anyone is invited") — `<NameField />` (695)
    and `<ModePick />` (705) are removed; the footer's Open a room (718–720) becomes `onClick={() =>
setView("open")}` with no `disabled`, keeping `className="btn"`. The long comment at 696–716 is
    rewritten: the chair-picker half is history the page no longer needs, and what belongs there is
    why this page asks only which route.
  - line 305 `validName`, lines 744–759 `NameField`, lines 880–911 `ModePick` — read and reused
    unchanged.
- `src/i18n/fi.ts` (lines 348–350) — `lobby.dek` reworded; `lobby.openTitle` and `lobby.openDek`
  added beside it. `src/i18n/en.ts` (lines 359–361) — the same three, or it does not compile.
- `src/i18n/i18n.test.ts` — one case asserting `lobby.dek` no longer names a name field in either
  language.
- `src/test/render.test.tsx`, the `/* ---------- the lobby ---------- */` block —
  - a `hostSetup()` helper beside `joinPage()` (line 1098): render the lobby, `press(container,
"btn.openRoom")`, return the result.
  - _"picks no chair before a room exists"_ (1110) — its `.roominput` and `.lobbymode` assertions
    (1117–1118) invert to `toBeNull()`, and the case's comment is rewritten; the `h2`, `.seatpick`,
    `.kind[data-kind]`, `btn.openRoom` and `dispatch` assertions stay.
  - _"opens with the race picked"_ (1125), _"draws a button per match mode and describes the chosen
    one"_ (1137), _"describes the traditional mode once the picker is on it"_ (1180) and _"asks the
    session to change mode and dispatches nothing"_ (1198) — each walks through `hostSetup()` before
    querying `.lobbymode` / `.modepicks`. Their assertions are otherwise unchanged.
  - _"offers no Start before a session exists"_ (1227) — its loop clicks every `.lobbyfoot` button on
    the landing page, and one of them now navigates mid-loop. Confirm the case still holds
    (`net.start` uncalled, no `startChallenge`) and re-point it if the re-render makes the remaining
    clicks vacuous.
  - _"reaches the code swap from the chair table without starting it"_ (1313) — its
    `expect(container.querySelector(".lobbymode")).toBeNull()` (1325) becomes vacuous, since the page
    it came from no longer draws one. Replace it with an assertion that still discriminates
    (`.methods` present, `btn.openRoom` absent) rather than leaving one that cannot fail.
  - _"keeps the side the link picked until the switch changes it"_ (2028) — line 2041 uses
    `.lobbymode` as the landing page's marker after Back. Re-point it at something the landing page
    still draws (`labelled(container, "btn.openRoom")` of length 1).
  - _"opens a room from the table"_ (2064) — the click that expects `net.openRoom` to have been
    called now has to walk the extra step: press `btn.openRoom` on the landing page, then again on
    the host-setup page. `stubNet({ name: "Host" })` keeps it enabled.
  - _"draws modal over lobby over screen"_ (2751) — lines 2754 and 2762 use `.lobbymode` as the
    lobby's own marker over and under. Re-point both at `.lobbyfoot`, which the landing page still
    draws.
  - the leak sweep's lobby list (2704) — a row for the host-setup page, reached by `press(c,
"btn.openRoom")`.
  - new cases for: the landing page's emptiness and its missing best line; Open a room navigating
    without calling `net.openRoom`; the host-setup page's contents, its two-button footer, its
    disabled/enabled Open a room and its Back; and `.lobbymode` absent from the join page.
- `src/test/render.test.tsx`, the board-reading block (3631–3695) — `inLobby(match)` (3644) presses
  `btn.openRoom` before returning the container, so _"gives each match its own won-in-N-deals line
  and the challenge a score"_ (3654), _"says there is no result yet when a match board holds only a
  loss"_ (3683) and _"says the same with no rows at all"_ (3689) go on proving the lobby reads its
  own board.
- `CLAUDE.md` — the lobby paragraphs describing the setup page and its footer.

## Out of scope

- **The host's room page** (`net.role === "host" && net.room`), its roster, its chair assignment, its
  readiness lines, its `<ModePick />` and its Start. Untouched.
- **The code-swap host page, the `OtherWays` page, `SwapSidePick`, `JoinAs` and `LanSwitch`.**
  Untouched, including the decision that the code-swap host page draws neither `lobby.readable` nor
  `lobby.roomRelay`.
- **The guest's and shared table's waiting page**, and every `roomEscape` block.
- **Drawing `lobby.readable` or `lobby.roomRelay` on the new host-setup page.** No session exists
  there yet, which is exactly the argument
  `2026-09-15-move-lobby-connection-texts-into-room` used to take them off the landing page.
- **A mode picker, a best line or any host-only control on the join page.** See Assumptions.
- **Restyling any footer control**, `.linkbtn` included, and any change to `.lobbyfoot`'s stickiness.
- **Restoring a chair picker, a Start or `lobby.startNote` to any pre-session page.** All three were
  removed deliberately and stay removed.
- **The `Net` context's shape**: no new field, no new method, no change to `openRoom`, `enterRoom`,
  `setName` or `setMatch`, and no scoping of `net.lan` to the route its switch is drawn on (a named
  wart in `CLAUDE.md`, and a `useNetGame` change).
- **Anything under `src/game/` or `src/net/`**: no `NET_VERSION`, `SAVE_VERSION`, `SCOPE`,
  `hashState`, `parseMsg`, reducer or schedule change, and no `MenuView` member.
- **Resetting the lobby's view when a session ends.** See the hang-up assumption.
- **Accessibility semantics** beyond keeping every control a focusable `<button>` or a labelled
  `<input>`. ARIA stays the project-wide gap it is.
- **Any tuppi rule, score, target or balance figure.**
