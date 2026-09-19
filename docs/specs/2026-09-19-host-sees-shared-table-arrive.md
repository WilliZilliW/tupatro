---
id: 2026-09-19-host-sees-shared-table-arrive
title: Show a room host that a shared display is here, from the live signal and in the roster
kind: ui
status: proposed
---

# Show a room host that a shared display is here, from the live signal and in the roster

## What

A host who has opened a room can see, on the room page, that a shared display has entered —
listed with the people who are here, not only as a sentence — and can see that it has **left**,
because the indication is read from the flag the host already receives when the display drops
rather than from a value that is written once and never lowered.

Today the host is told a display has joined and is never told otherwise: the room page's
`lobby.tableJoined` line is keyed off `net.tableInvite`, which on the room route is written at the
welcome and cleared only by Hang up. A display that closes its tab leaves the host reading "A
shared table has joined." for the rest of the lobby, while `net.tableHere` — the honest flag the
host's own `onTables` dep already sets and lowers — says otherwise and is not read on that page at
all.

## Prior specs and documents

**This requirement is partly delivered, and this spec is scoped to the difference.** The sentence
exists and works; what does not exist is a truthful one.

- **`2026-09-13-room-lobby-honest-ready-signal` (delivered) is the spec that put the line on the
  room page**, and its criterion _"A connected shared display is not a player"_ — the count and the
  alone test read room players other than the host only — is **kept exactly**. Nothing here makes a
  display count as company: `othersInRoom`, `lobby.othersHere`, `lobby.alone` and `lobby.allHere`
  are untouched. That spec's own delivered render case _"does not count a welcomed shared display
  as another player in the room"_ keeps every assertion it makes and gains `tableHere: true` in its
  fixture, because the signal the assertion depends on moves. That is a fixture change, not a
  reversal of its criterion, and it is named here so a reviewer does not read the diff as one.
- **`2026-09-16-shared-table-private-player-view` (delivered) built `net.tableHere`**, its
  `{ t: "table"; on: boolean }` message, `hostSession`'s `tables: Set<string>` and the rule that the
  host's own window is told through `onTables` rather than by receiving its own broadcast. This
  spec adds **nothing** to the wire: it reads a flag that already arrives. `NET_VERSION` stays
  **11**, `SCOPE`, `scopeOf`, `guestMay`, `parseMsg`, `hashState` and the `NetMsg` union are
  untouched, and `session.ts` is not modified.
- **Amends one sentence of `CLAUDE.md`'s transport section rather than contradicting a spec.**
  That section says "**A room fills that same field from the welcome**, with no code and no
  candidates … the host would otherwise have no line saying the screen on the wall is in." The
  reason stands — the host must have that line — but the field chosen for it was the wrong one, and
  this spec moves the line to `net.tableHere` and stops the room writing `tableInvite` at all. The
  paragraph is rewritten in the same pull request. **Which reading wins: `tableInvite` means "the
  chairless invitation the code swap built and its answer state", and nothing else.**
- **`2026-09-09-shared-table-always-invited` (delivered) is untouched.** The code-swap host still
  builds a chairless invitation unconditionally, its `net.tableInvite` block still draws the code,
  the QR and the answer box, and `ready` / `nobodyAnswered` / `settled()` keep reading it. That
  page is not this page.
- **`2026-09-08-shared-table-view-multiplayer` (delivered) is untouched.** The display window
  itself does not change: it still draws the board, sends nothing, and reads `lobby.tableSeated` on
  its own waiting page.
- **GitHub issue #57 has two items and this spec is item 1 only.** Item 2 ("hiding the table
  changes the game layout; your cards are shown at the area which normally is the table") is a
  different screen, a different component and its own spec; it is named under Out of scope.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

### The indication reads the live flag, in both directions

- [ ] The room host branch of `src/components/screens/Lobby.tsx` — the one guarded on `net.role`
      being `"host"` with a truthy `net.room` — draws its shared-display line on `net.tableHere`
      and not on `net.tableInvite`. A render case in `src/test/render.test.tsx` builds a
      `roomHost` fixture with `tableHere` true and `tableInvite` null, and asserts the page
      contains `lobby.tableJoined`.
- [ ] **The negative case is the point of this spec** and is a case of its own: a `roomHost`
      fixture with `tableHere` false and a `tableInvite` whose `state` is `"connected"` contains
      **neither** `lobby.tableJoined` nor the roster row below. A page that still draws the line
      from a stale invitation fails here.
- [ ] `grep -n "tableInvite" src/components/screens/Lobby.tsx` returns no hit inside the room host
      branch; every remaining hit is `ready`, `nobodyAnswered`, `settled` or the code-swap host
      page's own block.

### The room stops writing a field it cannot lower

- [ ] `openRoom` in `src/hooks/useNetGame.ts` no longer calls `setTableInvite`. Its `onGuest` dep
      stays (it is required by `HostDeps`) and carries a comment naming why it writes nothing: a
      room learns about a display through `onTables`, and `tableInvite` is the code swap's
      invitation and its answer state alone.
- [ ] `grep -n "setTableInvite" src/hooks/useNetGame.ts` shows sites only inside the code-swap
      `invite()` path and inside `hangUp`.
- [ ] `src/hooks/useNetGame.test.tsx` gains a case on the room route: a host whose `onTables(true)`
      fires reads `tableHere === true` with `tableInvite === null`, and a following
      `onTables(false)` lowers it again. The existing code-swap case — that the table's invitation
      goes live on the **welcome** and not on the channel opening — is unchanged and still passes.

### A display reads with the people who are here

- [ ] The room page's first `.seatpicks` list gains one row when `net.tableHere` is true:
      `.seatpick.tablerow`, holding `.who` with `t("lobby.tableWho")` and a `.dek` with
      `t("lobby.tableNoChair")`, and **no button** — the host has no id to pass `net.removePlayer`
      for a display, and a button that cannot act is the control `MoveButton.tsx` exists to forbid.
      A render case asserts `container.querySelectorAll(".seatpick.tablerow")` has length exactly
      **1** with `tableHere: true` and **0** with `tableHere: false`.
- [ ] `net.players.length` still decides the rest of that list, so the row is drawn beside the
      roster and never inside `net.players.map`. The same render case asserts the player rows are
      the same set with `tableHere` true and false (one `.seatpick` per `net.players` entry, plus
      the chair-assignment list's four, plus this one row).
- [ ] **Counting is untouched.** A `roomHost` fixture holding `HOST_ROW` alone, `canStart` true
      and `tableHere` true still contains `lobby.othersHere` with `n` of 0, still contains
      `lobby.alone`, still does not contain `lobby.allHere`, and its Start still reads
      `btn.startAlone`. `othersInRoom` and `isOther` in `Lobby.tsx` are unchanged.

### Strings and locales

- [ ] `lobby.tableWho` and `lobby.tableNoChair` exist in `src/i18n/fi.ts` and `src/i18n/en.ts`
      with no placeholders in either. `lobby.tableJoined` keeps its text in both. `en.ts` does not
      compile until both keys are present, which is the gate.
- [ ] No player-facing literal is added outside `src/i18n/`, and the new row's text reaches the
      DOM through `t()` only. `src/test/render.test.tsx`'s `check()` reads the room host page with
      a display present in **both** locales and finds no leaked catalogue key, no `undefined`, no
      `NaN`, no `[object Object]` and no Finnish stopword in English output.

### Nothing else moves

- [ ] **No wire change.** `src/net/protocol.ts` and `src/net/session.ts` are not modified.
      `NET_VERSION` is still `11`, and `src/net/protocol.test.ts` and `src/net/session.test.ts`
      pass unchanged, including the three-peer race deal and the unassigned-room-player case that
      pins `tableHere` counting displays rather than null chairs.
- [ ] **Nothing on `GameState`.** `grep -n "tableHere" src/game/` finds nothing, and
      `src/test/invariants.test.ts` keeps `tableHere` on the field blocklist with `spectator` and
      `spectating`. `src/game/` is not modified at all, and `src/game/seats.test.ts` moves no
      pinned literal.
- [ ] The guest page, the shared display's own waiting page (`lobby.tableSeated` /
      `lobby.tableWaiting`), the code-swap host page's `net.tableInvite` block, `NetBanner`,
      `App.tsx`'s `privateMode` and `PrivateTable.tsx` are all byte-identical in behaviour. The
      delivered read-only sweeps over `Screen["kind"]`, `Phase`, `Modal` and `MenuView` in
      `render.test.tsx` pass unchanged.
- [ ] `src/index.css` gains at most one rule, `.seatpick.tablerow{cursor:default}` — `.seatpick`
      sets `cursor:pointer` and this row is not clickable. The file stays hand-formatted and
      excluded from Prettier.
- [ ] **Documentation.** `CLAUDE.md`'s transport section replaces the "a room fills that same field
      from the welcome" sentence with what the room actually reads now, and `docs/multiplayer.md`'s
      _The shared table_ section says the host is told a display is here **and** told when it
      leaves. `README.md`'s _Playing with other people_ is checked and updated only if it claims
      otherwise. The test-count lines in `CLAUDE.md` and `README.md` match what `npm test` prints.
- [ ] **Gates.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` all pass.
- [ ] **A browser reading**, recorded in the pull request body, at **1280x800**, **1280x500** and
      **390x844** on the room host page with a display present: the new row on screen without
      horizontal overflow of its `.seatpicks` grid track, and the sticky `.lobbyfoot` Start and
      Back still hit-testable via `elementFromPoint` at each size.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Show indication that shared table has entered" is read as a lobby change, not a new screen or
  a toast.** During a match the host already has the strongest indication there is: its own window
  swaps the felt for `PrivateTable`, whose bar reads "The board is on the shared display."
  (`priv.note`). That is delivered and is not rebuilt, moved or duplicated here.
- **The requirement is partly delivered, and this spec says so rather than pretending otherwise.**
  `lobby.tableJoined` already renders on the room host page. If the reviewer's reading of issue #57
  item 1 is "there should be a line at all", **it is already there and this whole spec is
  unnecessary** — that is the line to object to. The reading taken is that a line which cannot go
  away is not an indication, and that a host counting heads should find the display in the list of
  who is here.
- **The sentence and the roster row are both kept, so the same fact is stated twice on one page.**
  Removing the delivered sentence would be a reversal of `2026-09-13-room-lobby-honest-ready-signal`
  and would take the fact out of the readiness block that "most important content first" put it in;
  the row alone would not survive a host who reads only the prose above the roster. A reviewer who
  wants one of the two deleted should say which; it is a three-line change either way.
- **The room stops writing `tableInvite` entirely, rather than the lobby reading both fields.**
  Keeping the write and `&&`-ing the two would leave a field whose only possible values on that
  route are `null` and a permanent lie. One meaning per field is the reason; the cost is that a
  reviewer diffing `useNetGame.ts` sees a deleted `setTableInvite` call that looks like a lost
  feature, which is what this bullet exists to pre-empt.
- **The display is one thing, not a count.** `net.tableHere` is a boolean and `hostSession`'s
  `tables` is a `Set` that could in principle hold several displays in a room. One row is drawn
  whatever the size of that set, because nothing between `session.ts` and the window carries the
  number and adding one is a wire change this spec refuses.
- **The row carries no Remove button and no chair select.** A display holds no chair by
  construction and `net.removePlayer` takes a `RoomPlayer` id the lobby never receives for it —
  `players` excludes displays deliberately. Evicting a display from a room is a separate capability
  and is out of scope.
- **The row is not counted as company anywhere.** A host with a display and nobody else still reads
  `lobby.alone` and still starts a match of one. That is the delivered reading and is kept
  deliberately, not by omission.
- **A display that drops mid-lobby makes the indication disappear with no separate notice.** There
  is no "the display left" message and no toast: the row and the line go, the same honest fallback
  `tableHere` already has on a player's window. Announcing a departure is a `SessionStatus` of its
  own and is the transport increment `CLAUDE.md` already records as open.
- **No rule, no score, no number and no balance figure moves.** `src/game/` is not touched, so this
  is a `ui` change and nothing else.

## Touch points

The files and functions this is expected to change. All real.

- `src/components/screens/Lobby.tsx` — the room host branch: the `net.tableHere` condition on the
  `lobby.tableJoined` line, and the `.seatpick.tablerow` row appended to the roster's `.seatpicks`.
- `src/hooks/useNetGame.ts` — `openRoom`'s `onGuest` dep stops calling `setTableInvite` and gains
  the comment saying why.
- `src/hooks/useNetGame.test.tsx` — the room-route `onTables` case beside the delivered code-swap
  welcome case.
- `src/test/render.test.tsx` — the two-direction cases for the line, the roster-row count case, the
  untouched-counting case, the both-locale `check()` read, and the fixture update to the delivered
  _"does not count a welcomed shared display as another player in the room"_ case.
- `src/i18n/fi.ts` — `lobby.tableWho`, `lobby.tableNoChair`.
- `src/i18n/en.ts` — the same two keys, or it does not compile.
- `src/index.css` — `.seatpick.tablerow{cursor:default}`, inside the existing `.seatpick` block.
- `CLAUDE.md` — the transport section's "a room fills that same field from the welcome" sentence,
  and the test count.
- `docs/multiplayer.md` — _The shared table_.
- `README.md` — _Playing with other people_, only if it claims the host is told on the old signal;
  and the test count.

## Out of scope

- **Issue #57 item 2** — the private view's layout, where the player's own cards are drawn in the
  area the felt occupied. Different component (`App.tsx` / `PrivateTable.tsx` / `src/index.css`'s
  `.private` block), different question, its own spec.
- **The code-swap host page.** Its `net.tableInvite` block is already lowered to `"failed"` by the
  link's `onClose`, so it does not have the bug this fixes. `ready`, `nobodyAnswered`, `settled`
  and the chairless invitation are untouched.
- **The shared display's own window**, its waiting page, `lobby.tableSeated` / `lobby.tableWaiting`,
  and any television layout for it.
- **Telling anybody but the host.** A guest's window already switches to `PrivateTable`; no new
  line is added there, and no departure notice is added anywhere.
- **Counting displays, naming them, or evicting one.** No number on the wire, no display name, no
  Remove button, no `net.removePlayer` for a table.
- **Any wire change.** `NET_VERSION`, `SCOPE`, `guestMay`, `hashState`, `parseMsg`, the `NetMsg`
  union, `src/net/session.ts` and `src/net/protocol.ts` all stay as they are.
- **Any `GameState` field, `SAVE_VERSION`, any tuppi rule, any score and any balance figure.**
  `src/game/` is not modified.
- **Late join and reconnect.** A display still has to be connected before Start on both routes, and
  the room route's `resume`/`catchup` path is unchanged.
- **Accessibility.** The new row carries no ARIA beyond its text; the known gap stands.

## Source

Not a rule or scoring change: no trick, no declaration, no point and no card is touched, and
`src/game/` is not modified. The Oulunsalo senior tuppi club's rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi> describe four players at one table and say nothing
about a display on the wall — a shared screen is this project's own arrangement, not a rule read
from either source, and no string added here may imply otherwise.
