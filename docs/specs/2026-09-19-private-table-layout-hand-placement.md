---
id: 2026-09-19-private-table-layout-hand-placement
title: Draw the player's own hand inside the private zone while a shared table is showing the board
kind: ui
status: proposed
---

# Draw the player's own hand inside the private zone while a shared table is showing the board

## What

While a shared table is connected and a chair-holder's window has the board hidden, the window
stops drawing a table-shaped empty box above a hand row of its own. The private zone takes the
whole of the right-hand column and **contains the player's cards**: the phase's decision panel
sits in the upper part of the zone exactly as it sat on the felt, and the hand, its sort tools and
the hint line are drawn inside the same frame beneath it, in the area the felt normally occupies.

Nothing else moves. The cards keep their size, the hand row keeps its shape, the decision panel
keeps the room it had on the felt, and toggling the board back on restores today's window exactly.
No rule, no score, no wire message and no saved field is touched.

## Prior specs and documents

- **Extends `2026-09-16-shared-table-private-player-view` (delivered, commit `10e1ec0`) and
  reverses one of its criteria.** That spec built `net.tableHere`, the `{ t: "table"; on }`
  message, `NET_VERSION` 8, `App.tsx`'s `privateMode` condition and `PrivateTable.tsx`. All of
  that stands. What is reversed, in as many words, is its criterion that
  `PrivateTable.tsx` draws `.tablewrap > .private` "containing `.privbar`, `<ModeBox />` and
  `<Panels />` **and nothing else**", together with the Assumption that "the private zone keeps the
  felt's grid row rather than giving its space to the hand" and that "it will therefore look empty
  during `play`, above a hand of ordinary size". **The later reading wins**, because issue #57 is
  the player's own report about that arrangement. The _reason_ the earlier spec gave for it is not
  reversed and is honoured below: `#declpanel` must keep a positioned, full-size containing block,
  so the panel's own box is preserved (see Acceptance criteria) rather than halved.
- **Touches nothing in `2026-09-08-shared-table-view-multiplayer` (delivered).** The shared table's
  own window is unchanged: it draws the felt, the four chairs, the trick and no hand, and
  `useSpectating()` is still read first.
- **Does not overlap `2026-09-19-host-sees-shared-table-arrive`**, the branch carrying item 1 of
  the same issue (the host's indication that a display has entered). That work is in
  `useNetGame.ts`, `session.ts` and the lobby; this one is in `App.tsx`, `PrivateTable.tsx` and
  `index.css`. If both land, the only file they share is documentation.
- **Not already delivered.** On `main` today `App.tsx` renders `<Hand />` as `#app`'s own third
  grid child in every non-spectating window, and `PrivateTable.tsx` renders `.privbar`, `ModeBox`
  and `Panels` only. `grep -n "handzone" src/components/table/PrivateTable.tsx` finds nothing.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or a measurement recorded in the pull
request.

- [ ] **`<Hand />` is rendered exactly once, and in the private view it is inside the zone.**
      `src/App.tsx` renders it inside `PrivateTable` while `privateMode && !showBoard`, and as
      `#app`'s third grid child in every other case. A case in `src/test/render.test.tsx` renders
      `<App />` over a `stubNet` with `role: "guest"`, `live: true`, `seat: 2`, `status: "live"`
      and `tableHere: true`, and asserts `container.querySelectorAll(".handzone")` has length
      **1**, that `container.querySelector(".private .handzone")` is not null, and that `.felt`,
      `.seat`, `.slot` and `.pop` are all absent. The vacuity guard is the same render with
      `tableHere: false`: one `.handzone`, **not** under `.private`, and `.felt` with four `.seat`s.
- [ ] **Exactly one `#declpanel` exists in the DOM, ever, and it never contains or covers the
      hand.** `Panels` is rendered inside a new positioned element of the zone
      (`.privstage` — the panel's containing block, the private view's answer to `.felt`), which is
      a sibling of `.handzone` and not an ancestor of it. A case per panel phase, read off
      `PHASE_PANEL` rather than listed by hand, asserts `querySelectorAll("#declpanel")` has length
      1 in the private view and 1 on the full board, and that
      `container.querySelector(".privstage #declpanel")` is not null while
      `container.querySelector("#declpanel .handzone")` is null.
- [ ] **`.private` is a column in `src/index.css`**: `.privstage` (`flex:1`, `position:relative`,
      drawing nothing of its own) then `.handzone`, with `.privbar` and `.modebox` keeping their
      absolute corners. The block carries a comment saying why the panel's containing block is the
      stage and not `.private` itself — the hand is a flow sibling now, and a panel centred on the
      whole zone would sit on top of the cards, which `DeclPanel`'s own comment forbids.
- [ ] **Measured: the hand does not change size or jump when the board is toggled.** A Chrome
      reading over CDP at **1280x800**, **1280x500**, **390x844** and **844x390**, in the `play`
      phase and in `declare`, comparing the private view with the same window after
      **Show board**: `.handrow`'s width and height and `.hcard`'s width and height are
      **identical**, and `.handrow`'s top edge differs by **at most 24 px**. Figures in the pull
      request body.
- [ ] **Measured: the cards are inside the table's own frame.** In the same reading,
      `.handrow`'s rect is contained within `.private`'s rect at all four sizes, and `.private`'s
      own rect spans the column — its height is within 4 px of `.tablewrap`'s, and `#app`'s hand
      row is 0 px tall (nothing is placed in it).
- [ ] **Measured: the decision panel keeps the room it had on the felt.** In `declare` at the same
      four sizes, `#declpanel`'s height in the private view is within **24 px** of its height on
      the full board at the same size, its sticky `.row` buttons are on screen and returned by
      `document.elementFromPoint` at their own centres, and `document.elementFromPoint` over the
      centre of **every** `.hcard` returns that card or a descendant of it — the panel covers no
      card. `document.documentElement.scrollHeight === window.innerHeight` at every size.
- [ ] **The private view is still playable.** A render case in the `play` phase with the seat to
      act asserts the `.hcard.playable` set is non-empty and that clicking one dispatches
      `{ type: "playCard", p: 2, uid }`.
- [ ] **The toggle still works and still dispatches nothing.** Clicking `btn.showBoard` draws
      `.felt` and four `.seat`s with the single `.handzone` back outside `.private`; clicking
      `btn.hideBoard` on the floating bar returns to the zone with the hand inside it; the dispatch
      spy is **not called at all** by either click, and both buttons stay plain `button`s rather
      than `MoveButton`s.
- [ ] **Nothing else moves.** The shared table's own window still draws `.felt`, four `.seat`s and
      no `.handzone` (`useSpectating()` first); an offline window is byte-identical to before; the
      rail's pages are the same set with `tableHere` true and false; and the delivered shared-table
      sweeps in `render.test.tsx` — every `Screen["kind"]`, `Phase`, `Modal` and `MenuView`, with
      their vacuity guards — pass unchanged.
- [ ] **No new player-facing string is required, and any that is added exists in both
      `src/i18n/fi.ts` and `src/i18n/en.ts` with matching placeholder sets.** `render.test.tsx`'s
      `check()` reads the private view in both locales for leaked keys, `undefined`, `NaN` and
      stray Finnish in English output.
- [ ] **Nothing under `src/game/`, `src/net/` or `src/hooks/` changes.** `git diff --stat` names no
      file in those three directories, `NET_VERSION` stays **11**, `SAVE_VERSION` stays **3**,
      `SCOPE`, `guestMay`, `parseMsg` and `hashState` are untouched, and no `GameState` field is
      added — `src/test/invariants.test.ts` keeps `tableHere` on its blocklist and passes unchanged.
- [ ] **Documentation and gates.** `docs/multiplayer.md`'s shared-table paragraph, `README.md`'s
      shared-table paragraph and `CLAUDE.md`'s transport section say that a player's window draws
      its own hand **inside** the private zone rather than beneath it, and the test-count lines in
      `CLAUDE.md` and `README.md` match what `npm test` prints. `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` all pass.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The requirement's two sentences are read as a request, not a bug report.** "Your cards are
  shown at the area which normally is the table" is taken as _what the private view should do_,
  not as a description of what it does today. The reason is measured rather than assumed: a static
  reproduction of both DOMs against the shipped `src/index.css`, driven in headless Chrome at
  1280x800 and 1280x500, gives `.private` **exactly** `.felt`'s rect (294,14,970,582 at 1280x800)
  and **byte-identical** rects for `.handzone`, `.handrow`, `.handtools`, `.hint` and `.hcard` in
  both states. The hand does not move today, so the literal complaint reading names nothing that
  could be fixed. **If the reviewer meant the opposite** — "hiding the table must not change the
  layout, and today it wrongly puts my cards in the table's area" — then this change is the wrong
  direction and the first criterion is the line to object to; the fix in that case would be to
  delete the private view's separate layout altogether, not to refine it.
- **Both readings are served as far as they can both be.** The hand's size does not change and its
  position moves by at most 24 px, so the window does not visibly reflow when the board is toggled.
  What changes is that the frame the table is drawn in now encloses the cards instead of stopping
  above them.
- **The hand sits at the bottom of the zone, not floating in its centre.** Centring it would put
  the decision panel in half a column: at 1280x500 the zone is ~282 px tall and the hand needs
  ~199 px of it, so a centred hand leaves `#declpanel` about 157 px against the 282 px it has
  today. The delivered spec named the panel's room as "the one thing in this change that must not
  break", and a stage that takes the remaining height keeps it within a couple of dozen pixels.
  The consequence to accept: the upper part of the zone is still empty during `play`.
- **The cards keep their size and the hand keeps its tools and hint line.** Enlarging the cards,
  wrapping the hand into two rows or re-proportioning the row for the space the felt gave up is a
  measurement rather than a guess — the delivered spec said so, and it is still out of scope here.
- **`#app`'s grid is not touched.** Row 2 collapses because nothing is placed in it, so the zone
  grows into the column by itself. A grid-template change would move the offline window too.
- **Nothing is added to the wire, to `GameState` or to the save.** Which window draws which layout
  is a property of the window, exactly as `tableHere` and the viewing seat are, so no peer has to
  agree and `NET_VERSION` does not move.
- **The board-shown half of the toggle is untouched**, `.privbar.float` at the bottom-right
  included, and it is still window-local, unremembered and unsynchronised.
- **The stage draws nothing of its own.** No trick, no seats, no score, no "look at the shared
  screen" artwork: that was the delivered spec's named follow-up and it stays one.
- **The shared table's own window, every offline window and every hot-seat board are untouched.**
  `useSpectating()` is still tested before `tableHere`.
- **Item 1 of issue #57 is somebody else's branch.** Nothing here reads or writes `net`, so the two
  can land in either order.

## Touch points

The files and functions this is expected to change. All real.

- `src/App.tsx` — `<Hand />` moves inside `PrivateTable` while the private view is up; it stays
  `#app`'s third grid child otherwise, and `spectating` still suppresses it entirely.
- `src/components/table/PrivateTable.tsx` — gains `.privstage` around `<Panels />` and `<Hand />`
  after it; its header comment's claim about the box keeping the felt's row is rewritten.
- `src/index.css` — `.private` becomes a flex column, `.privstage` is added as the panel's
  containing block, and the phone (`max-width:560px`) and short-window
  (`max-height:480px and max-width:920px`) blocks get whatever padding the reading above needs.
  Hand-formatted and outside Prettier's scope, as ever.
- `src/components/hand/Hand.tsx` — **expected unchanged**; it must render identically in either
  parent, and a prop added to it here would be a smell.
- `src/components/panels/Panels.tsx` — **expected unchanged**; `#declpanel` is positioned by CSS
  against whichever stage encloses it.
- `src/test/render.test.tsx` — the private-view cases named above (there are none today: `.private`
  appears in that file exactly once, as a null assertion on the shared table's own window).
- `README.md` — the shared-table paragraph.
- `docs/multiplayer.md` — "A player's own device notices, and draws less while a table is
  watching".
- `CLAUDE.md` — the transport section's sentence about what `App.tsx` draws instead of the board,
  and the test-count line.

## Out of scope

- **Drawing the trick, the seats, the running score or anything else inside the stage.** Still the
  follow-up the delivered spec named.
- **Bigger cards, a two-row hand, or any re-proportioning of the hand row** for the space the felt
  gave up. A measurement, not a guess.
- **Remembering the board toggle** across reloads or matches, and any `game/storage.ts` key for it.
- **The shared table's own window**, a television layout, a distance-readable type scale, and more
  than one table per session.
- **Item 1 of issue #57** — the host's indication that a display has entered — which is delivered on
  `spec/2026-09-19-host-sees-shared-table-arrive`.
- **Anything on the wire**: `NetMsg`, `SCOPE`, `guestMay`, `parseMsg`, `hashState`, `NET_VERSION`,
  the signalling codec, the QR encoder and the room id are all untouched.
- **Any tuppi rule, any score, any balance figure, any `GameState` field and `SAVE_VERSION`.**
  `src/game/` is not modified and `src/game/seats.test.ts` must not move a literal.
- **Accessibility.** The zone's button carries no ARIA beyond its own label; the known gap stands.

## Source

Not a rule or scoring change: no trick, declaration, point or card behaviour is touched, and
`src/game/` is not modified. The Oulunsalo senior tuppi club's rule sheet (Antti Auer,
9 September 2022) and <https://korttipeliopas.fi/tuppi> both describe four players at one table
holding their own cards; drawing a player's own cards inside the frame that stands for that table is a layout
decision, not a reading of either source.
