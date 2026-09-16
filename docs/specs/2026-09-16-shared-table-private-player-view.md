---
id: 2026-09-16-shared-table-private-player-view
title: Give each player's own device a private view while a shared table is connected
kind: ui
status: proposed
---

# Give each player's own device a private view while a shared table is connected

## What

When a session has a **shared table** connected — a screen on the wall that holds no chair and
draws the board — every window that _does_ hold a chair stops drawing the felt. In its place it
draws a small private zone: the declaration box, the decision panel for the phase, and nothing
else, with the player's own hand, its sort tools and the hint line underneath exactly as now. The
rail is untouched, so the wallet, the shop and the match plate stay where they are, and the
overlay screens (shop, deal end, result) are untouched too.

This is the physical table: everybody looks up at the shared cards and keeps their own hand in
their hands. A player who wants the board back on their phone can say so — the private zone's own
bar carries a toggle, window-local, and the choice is not part of the game state.

For a player's device to know a display is in the room, the host has to say so: this adds one
message to the wire and takes `NET_VERSION` to **8**. (Written against a `NET_VERSION` of 6; by
the time this branch rebased onto `main`, an unrelated change had already taken it to 7, so this
spec's own bump landed one version later than planned — 7 to 8, not 6 to 7. The reasoning is
otherwise unchanged.)

## Prior specs and documents

- **Extends `2026-09-08-shared-table-view-multiplayer` (delivered) and reverses nothing in it.**
  That spec built the chairless peer, `useSpectating()`, `guestMay`'s null-seat clause and the
  read-only rule. All of it stands, and the **table window itself does not change at all**: it
  still draws the ordinary felt and rail, still draws no hand, still sends nothing. What changes
  is the _other_ windows, which that spec never looked at.
- **Adjacent to, and deliberately not, that spec's out-of-scope "curtain on the players' own
  devices".** A curtain hides a **hand** from somebody at the same screen (the hot-seat case that
  `2026-09-07-race-to-target-mode` and `2026-09-08-traditional-tuppi-multiplayer-mode` both left
  out). This hides the **board** on a device that has one of its own to look at. The curtain stays
  out of scope, and the word "private" in this spec's title is about layout, not confidentiality:
  every peer still holds every hand in devtools, and the rules panel still says so.
- **Confirms `2026-09-09-shared-table-always-invited` (delivered).** The chairless invitation is
  still built for every code-swap host, and a display still joins a room by typing the code. This
  spec adds nothing to how a table arrives, only a fact the host now relays about it having
  arrived.
- **Overlaps `2026-09-13-lobby-first-solo-and-viewer` (delivered) at `NET_VERSION` and takes the
  other reading.** That spec added `SessionStatus.refused` and explicitly kept `NET_VERSION` at
  `6` because no message shape changed. Here one does — a new `NetMsg` member — so the version
  goes to `7` by the same rule it invoked. Its late-join refusal is untouched: a table still
  cannot be plugged in at deal five, so the flag this spec relays settles before Start in
  practice, and is still allowed to fall back to `false` when the display drops.
- **Depends on `2026-09-07-seat-absolute-game-state` and must not weaken it.** Whether a shared
  display is present is a property of the **session**, exactly like the role and the viewing seat.
  Nothing goes on `GameState`, nothing enters `hashState`, and no pure function under `src/game/`
  learns that a table exists.
- **Not already delivered.** Today `App.tsx` draws `<Table />` for every non-spectating window,
  `Panels` is rendered inside `Table`'s `.felt`, `Net` has no field that says a display is here,
  and a **guest has no way to know at all**: `welcome` carries its own seat, the `lobby` roster
  carries named players only and excludes a display, and nothing else is broadcast. Only the host
  knows, through `net.tableInvite.state === "connected"` and a chair whose `ChairState` is
  `"table"`.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

### The host says a display is here, and every peer hears it

- [ ] `src/net/protocol.ts` adds one member to `NetMsg`: `{ t: "table"; on: boolean }`, and
      `NET_VERSION` is `8` with a sentence in the version comment saying why (a v7 host never
      sends it, so a v8 player window would sit on the full board for a match a display is
      showing). `parseMsg` accepts it only when `on` is a boolean and still never throws for any
      string — cases in `src/net/protocol.test.ts`, including a `{ t: "table" }` with a
      non-boolean `on` returning `null`.
- [ ] `SCOPE`, `scopeOf`, `guestMay` and `hashState` are byte-for-byte unchanged. A test in
      `protocol.test.ts` still iterates `Object.keys(SCOPE)` for the null-seat refusal, and the
      `local`-versus-hash pairing case and the length-two exception list both still pass.
- [ ] `hostSession` in `src/net/session.ts` keeps an explicit `tables: Set<string>` — **not** a
      scan of `seats` for a `null` value. `seats` holds `null` for an unassigned room player too
      (`hello`'s `isWaitingPlayer` branch and `assign(id, null)` both write one), so a
      value-based test would put every window into the private view the moment somebody entered a
      room unseated. `session.test.ts` asserts exactly that case: a named room player admitted and
      left unassigned leaves the flag `false`.
- [ ] The host broadcasts `{ t: "table", on }` after every change to that set and after every
      welcome, so a player admitted **after** the display learns of it too, and calls a new
      `onTables(on: boolean)` dep so its own window reads the same fact through the same path.
      `session.test.ts` covers: a welcomed table raises it for a player guest already connected; a
      player welcomed afterwards is told; the table's `bye`, `leave`, `refuse` and `remove` lower
      it again.
- [ ] `guestSession` takes an `onTables` dep and fires it on the new message. A guest whose `as`
      is `"table"` still **sends nothing**: the existing case asserting no `req` leaves the
      three-peer race deal in `session.test.ts` unchanged, and that deal still ends with the
      table's `hashState` equal to the host's after every `endTrick`.

### The window knows, and nothing on `GameState` does

- [ ] `Net` in `src/hooks/netContext.ts` gains `tableHere: boolean`, defaulting to `false` in the
      no-provider context and in `stubNet`. `useNetGame` sets it from `onTables` on both sides and
      on both routes, and clears it on `hangUp`.
- [ ] **It follows the welcome, not the data channel**, the same rule `onGuest` already carries:
      a device that opens the chairless link and is refused with `bye` and `nochair` must not
      raise it. `src/hooks/useNetGame.test.tsx` stubs `src/net/rtc.ts` and fires the callbacks by
      hand to pin that, beside its existing table-invitation case.
- [ ] `src/test/invariants.test.ts` adds `tableHere` to the `GameState` field blocklist beside
      `spectator` and `spectating`, and `src/game/` still imports neither `../net` nor the net
      context. `grep -n "tableHere" src/game/` finds nothing.

### A player's device draws the private view

- [ ] The condition is exactly `net.live && net.tableHere && !useSpectating()`, read in
      `src/App.tsx`. A **shared table window is unaffected** — `useSpectating()` wins — and so is
      every offline window, where `tableHere` is `false`.
- [ ] `src/components/table/PrivateTable.tsx` draws `.tablewrap > .private` in the same grid row
      `.felt` occupied, containing `.privbar`, `<ModeBox />` and `<Panels />` and nothing else.
      Rendered with `stubNet({ role: "guest", live: true, seat: 2, tableHere: true })` over
      `<App />`, `src/test/render.test.tsx` asserts the container has **no** `.felt`, **no**
      `.seat`, **no** `.slot` and **no** `.pop`, and **does** have `.private`, one `.handrow`, one
      `.handzone` and one `.hint`. The vacuity guard is the same render with `tableHere: false`,
      which draws `.felt` and four `.seat`s.
- [ ] **Exactly one `#declpanel` exists in the DOM, ever.** `Panels` moves out of `Table.tsx`'s
      `.felt` only in the sense that whichever of the two zones is on screen renders it; a render
      case in each panel phase (read off `PHASE_PANEL`, not listed by hand) asserts
      `container.querySelectorAll("#declpanel")` has length exactly 1 in the private view and 1 on
      the full board. The id is load-bearing and two of it is invalid markup.
- [ ] **The private view is still playable**: the same case in the `play` phase asserts the hand's
      `.hcard.playable` set is non-empty for the seat to act and that clicking one dispatches
      `{ type: "playCard", p: 2, uid }` — the legal-move marking and the follow-suit prompt in
      `Hint` are what replace the trick the player can no longer see on their own screen.
- [ ] **The toggle is window-local and dispatches nothing.** `.privbar` carries `t("priv.note")`
      and a plain `button` labelled `btn.showBoard`; clicking it draws `.felt` and `.seat` again
      and swaps the label to `btn.hideBoard`, which returns to `.private`. The state is
      `useState` in `App.tsx` — never on `GameState`, never in the save, never in `hashState` — and
      a render case asserts the dispatch spy was **not called at all** by either click. It is a
      plain button and not a `MoveButton`, because it moves nothing.
- [ ] Every new string exists in both `src/i18n/fi.ts` and `src/i18n/en.ts` with matching
      placeholder sets — `priv.note`, `btn.showBoard`, `btn.hideBoard` — and
      `src/test/render.test.tsx`'s `check()` reads the private view in both locales for leaked
      keys, `undefined`, `NaN` and stray Finnish in English output.

### Nothing else moves

- [ ] The rail is untouched on a private window: `render.test.tsx` asserts `.rail` and its pages
      are the same set with `tableHere` true and false, so the wallet, the shop's stock, the match
      plate and the seed chip stay exactly where they are. The `Screens` overlays are untouched
      too — a result screen's Continue is a `flow` action any chair-holder may click, and hiding it
      would leave a match nobody can advance.
- [ ] The delivered shared-table sweeps in `render.test.tsx` — the read-only sweep over every
      `Screen["kind"]`, `Phase`, `Modal` and `MenuView`, and their vacuity guards — pass unchanged,
      and one of them is re-run with `tableHere: true` to pin that a table window still draws the
      board it is there for.
- [ ] **Documentation.** `docs/multiplayer.md`'s _The shared table_ section, `README.md`'s
      _Playing with other people_ and `CLAUDE.md`'s transport section say what a player's device
      shows while a display is connected, name the new message and the `NET_VERSION` 8 reason, and
      `CLAUDE.md`'s module-layout table gains `components/table/PrivateTable.tsx`. The test-count
      lines in `CLAUDE.md` and `README.md` match what `npm test` prints.
- [ ] **Gates and a browser reading.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` all pass.
      One reading is recorded in the pull request body at **1280x800**, **1280x500** and
      **390x844** on a private window in the `declare` and `play` phases: no page scroll, the
      decision panel's sticky footer buttons on screen and hit-testable, every hand card
      hit-testable, and the private zone's own box not overflowing its grid row.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **A guest cannot currently learn that a display is connected, so the wire changes and
  `NET_VERSION` goes to 8.** (Planned as 6 to 7; an unrelated change reached `main` first and took
  7, so this landed one version later — 7 to 8 — on rebase.) The alternatives were worse: only the
  host would switch (which fails the four-phones-and-a-TV case the shared table was built for), or
  every player would have to tick a box of their own (which the requirement's "when a session has a
  shared table connected" rules out). The cost is the usual one — room ids embed `NET_VERSION` and
  invitation codes stamp it, so a v7 build cannot meet a v8 build at all. **If the reviewer would
  rather not spend a
  protocol version on a layout change, this is the line to object to**, and the fallback is the
  per-window toggle alone, already built here, with the automatic half deleted.
- **The private view hides the trick, and that is the point rather than an oversight.** A player
  cannot see the cards already played on their own screen and must look at the shared display, the
  way they would look at a physical table. What keeps the deal playable on the small screen is
  what is already there: `Hand` marks the legal cards and `Hint` names the led suit and whose turn
  it is. If a reviewer finds that too thin in play, the cheap answer is to draw the trick's cards
  small inside `.private`, and it is deliberately not built here.
- **The toggle is the escape hatch, and it is window-local and unremembered.** It is not written to
  `localStorage`, not on `GameState`, and not synchronised between peers — a reload or a new match
  starts on the private view again while a display is connected. Persisting a display preference is
  a `game/storage.ts` key and its own decision.
- **The other player-facing chrome stays.** The rail (and so the wallet, the shop's stock and the
  match plate), the `Screens` overlays, `NetBanner` and `Toasts` are all untouched. "Minimal" is
  read as "the felt is not duplicated", not as "strip the window to a hand": the requirement names
  wallet and shop as things the player still needs.
- **The private zone keeps the felt's grid row rather than giving its space to the hand.** It will
  therefore look empty during `play`, above a hand of ordinary size. The box is kept because
  `#declpanel` is `position:absolute` and centres inside it, with a `max-height` and a sticky
  footer measured against it; collapsing the row would move the decision panels, which is the one
  thing in this change that must not break. Bigger cards and a re-proportioned phone layout are a
  measurement, not a guess, and are out of scope.
- **The private view does not extend to a shared table's own window**, nor to an offline window,
  nor to a hot-seat board. `useSpectating()` is tested first.
- **`tableHere` falls back to `false` when the display drops**, and the board comes back on every
  player's screen mid-match. That is the honest reading of the flag; the alternative — latching it
  for the match — would leave four people staring at a dead screen with no board anywhere.
- **The flag counts displays, not unassigned players.** Named as a criterion above because
  `hostSession`'s `seats` map already stores `null` for a room player waiting to be seated, and
  the obvious one-line implementation is wrong in exactly that case.
- **No AI seat, no rule and no number moves.** This is a layout change plus one boolean on the
  wire; `src/game/` is not touched and `seats.test.ts`'s pinned literals must not move.
- **The word "private" promises nothing about secrecy.** Every peer still holds every hand, the
  transport is unchanged in that respect, and no catalogue string added here may imply otherwise.

## Touch points

The files and functions this is expected to change. All real.

- `src/net/protocol.ts` — the `{ t: "table"; on: boolean }` member, its `parseMsg` case,
  `NET_VERSION = 8` and the version comment's new sentence.
- `src/net/session.ts` — `hostSession`'s `tables: Set<string>`, the broadcast after every seating
  change and every welcome, the `onTables` dep on both sessions, and `guestSession`'s new case.
- `src/net/protocol.test.ts` — the parse cases and the unchanged `SCOPE`/`guestMay` cases.
- `src/net/session.test.ts` — the raise and lower cases, the unassigned-room-player case, and the
  three-peer race deal still in step.
- `src/hooks/netContext.ts` — `Net.tableHere` and its default.
- `src/hooks/useNetGame.ts` — wiring `onTables` into state on both routes, and clearing on
  `hangUp`.
- `src/hooks/useNetGame.test.tsx` — the welcome-not-the-channel case.
- `src/App.tsx` — the private-view condition, the window-local toggle, and which zone is rendered.
- `src/components/table/PrivateTable.tsx` — new: `.private`, `.privbar`, `<ModeBox />`,
  `<Panels />`.
- `src/components/table/Table.tsx` — unchanged behaviour; it keeps `<Panels />` for the full board.
- `src/components/panels/Panels.tsx` — unchanged; it must render identically inside either zone.
- `src/index.css` — `.private` (positioned, so `#declpanel` still centres) and `.privbar`, inside
  the existing hand-formatted blocks and at the phone and short-window breakpoints.
- `src/i18n/fi.ts` — `priv.note`, `btn.showBoard`, `btn.hideBoard`.
- `src/i18n/en.ts` — the same three keys, or it does not compile.
- `src/test/harness.tsx` — `stubNet` gains `tableHere: false`.
- `src/test/render.test.tsx` — the private-view cases, the panel-count case, the toggle's silence,
  the locale check, and the unchanged table sweeps.
- `src/test/invariants.test.ts` — `tableHere` on the `GameState` blocklist.
- `README.md` — _Playing with other people_.
- `docs/multiplayer.md` — _The shared table_.
- `CLAUDE.md` — the transport section, the module-layout table, the test count.

## Out of scope

- **A curtain over a hot-seat hand**, and any attempt to hide a hand from another peer. Lockstep
  means every peer holds every hand; that is documented, not fixed here.
- **A television layout for the shared table**: larger cards, a distance-readable type scale, a new
  breakpoint, or more than one table per session. The table window does not change at all.
- **Re-proportioning the player's window**: bigger hand cards, a taller hand row, or a different
  `#app` grid while the private view is up. Named in Assumptions as a measurement, not a guess.
- **Drawing the trick, the seats or the score inside the private zone.** If the view proves too
  thin in play, that is a follow-up with a browser reading behind it.
- **Remembering the toggle** across reloads or matches, and any `game/storage.ts` key for it.
- **Late join, reconnect, a retained action log and catch-up replay.** Still refused, still
  documented in `docs/multiplayer.md`.
- **`SCOPE`, `guestMay`, `hashState`, the signalling codec, the QR encoder and the room id's
  shape.** Only the message union and the version number change.
- **Any tuppi rule, any score, any balance figure, any `GameState` field and `SAVE_VERSION`.**
  `src/game/` is untouched and `src/game/seats.test.ts` must not move a literal.
- **Accessibility.** The new bar's button carries no ARIA beyond its own label; the known gap
  stands.

## Source

Not a rule or scoring change: no tuppi rule, no trick, no declaration and no point is touched, and
`src/game/` is not modified. The Oulunsalo senior tuppi club's rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi> both describe four players at one table holding their
own cards and saying nothing to each other about them, which is the arrangement this change draws
rather than a rule it interprets.
