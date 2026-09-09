---
id: 2026-09-08-shared-table-view-multiplayer
title: Let a large screen join a hosted match as the shared table — a read-only board with no hand on it
kind: ui
status: proposed
---

# Let a large screen join a hosted match as the shared table — a read-only board with no hand on it

## What

A device that joins a hosted match may join as **the table** instead of as a player: a shared
display that draws the felt, the trick, the four chairs and the running score, and nothing that
belongs to one player. The join screen asks which of the two it is before the device connects, and
suggests the table on a wide screen without deciding for anybody.

A table window holds **no chair**. It sends no action of any kind, it draws no hand, no decision
panel and no button that would move the game, and it updates live because it runs the same reducer
over the same numbered action stream every other peer runs. Players keep their phones; the board is
on the wall.

This is the spectator role `2026-09-07-multiplayer-seat-selection-lobby` refused and
`2026-09-08-webrtc-transport` deferred, built where both said it belonged: in the transport, where
there is another device for it to mirror.

## Prior specs and documents

- **Answers the refusal in `2026-09-07-multiplayer-seat-selection-lobby` (delivered) rather than
  reversing it.** That spec refused a "table"/spectator role for a mechanical reason that still
  stands verbatim: `nextTick` returns `null` for `blindselect`, `swap`, `soolioffer`, `sooligive`,
  `sooliready`, `shop` and for `handend` while a screen is up, so **a board with no `"human"` seat
  stalls and never deals a card**. Nothing here weakens that. A table window's `g.seats` is the
  same seat table every peer has, with the humans on the players' own devices; its own clock is
  dropped by the relay exactly as a guest's is, and it advances only on the host's numbered
  actions. **A table is therefore reachable only inside a live session and never offline** — an
  offline "spectate" button would be precisely the stall that spec described, and a criterion below
  pins that it does not exist.
- **Extends `2026-09-08-webrtc-transport` (delivered), and changes its wire.** `NET_VERSION` goes
  from `1` to `2`: `hello` gains the role the joining device chose and `welcome` may carry no seat
  at all. That is the version field doing its job — a v1 host would ignore `as` and seat the table
  as a player, whose every dispatch it would then wait for for ever — and `packSdp` stamps
  `NET_VERSION` into every invitation code, so a code from an older build is refused at the paste
  with the existing `net.bad.version` line.
- **Overlaps `2026-09-08-race-starts-from-the-lobby` (delivered) and scopes to the difference.**
  The lobby's four chairs, their kinds and the Start that turns them into `seats` are untouched;
  what is added beside them is one invitation that belongs to no chair. A session runs a race
  today, so the race's screens (`dealend`, `raceover`) and its rail plate (`RacePlate`) are the
  ones spelled out below — but the read-only rule is written over the whole `Screen` union so a
  future hosted mode cannot arrive with a live button on the table.
- **Depends on `2026-09-07-seat-absolute-game-state` and `2026-09-07-per-seat-economy`
  (both delivered) and must not weaken either.** Nothing goes on `GameState`: which window is the
  table is a property of the window, exactly like the viewing seat and the session, and
  `invariants.test.ts` gains the two names for it. No pure function learns who is looking, and
  `econOf(g, p)` stays the only door to a wallet.
- **Amends `docs/multiplayer.md`, `CLAUDE.md` and `README.md` in this pull request.** Stage 4's
  "no spectator" line and CLAUDE.md's Known gaps entry are struck and replaced by what shipped and
  what did not — no reconnect, so **no table may join a match already in progress**.
- **A naming collision, named so nobody merges the two.** `GameState.table` is Tuppi-Rummikub's
  laydown table and `startChallenge(prev, id, seed, table)` is a seat map. The shared display is
  `NetRole === "table"` in `src/net/` and `src/hooks/netContext.ts` and appears in **no file under
  `src/game/`**. The three meanings never meet in one file, and none of them may be widened into
  another.

## Acceptance criteria

### The wire knows a peer that holds no chair

- [ ] `src/net/protocol.ts` exports `GuestRole = "player" | "table"`; the `hello` message carries
      `as: GuestRole` and `welcome` carries `seat: Seat | null`. `NET_VERSION` is `2`. `parseMsg`
      still never throws for any string — including a v1 `hello` with no `as`, which reads as
      `"player"`, and a `welcome` whose `seat` is `null`. Cases in `protocol.test.ts`.
- [ ] `guestMay(a: Action, seat: Seat | null)` returns **`false` for every key of `SCOPE`** when
      `seat` is `null`, asserted by a test that iterates `Object.keys(SCOPE)` rather than a chosen
      few. That one branch, in one pure function, is the whole of the read-only guarantee on the
      host's side.
- [ ] `hostSession` welcomes a `hello` whose `as` is `"table"` with `seat: null`, keeps the peer in
      the broadcast set, and reports through a new dep `onGuest(peer, as, chair)` which chair — if
      any — the link had reserved, so the lobby can hand it back to the game. A `hello` whose `as`
      is `"player"` on a link with no chair reserved is refused with `bye` and the new status
      `"nochair"`. Both in `session.test.ts`.
- [ ] `guestSession` takes `as` and, when it is `"table"`, applies numbered `act` messages and
      `local` intents and **sends nothing else**: a test that pushes a `seat` action and a `flow`
      action through its `intent` asserts `send` was never called with a `req`.
- [ ] **Live, and in step.** `session.test.ts` wires a host, a player guest and a table guest to
      each other's `receive` and plays a whole race deal headlessly: after every `endTrick` the
      table's `hashState` equals the host's, and over the whole deal the table sent no `req`.

### The lobby offers a table, and the joining device chooses

- [ ] The host's pre-invite chair table carries a switch for a shared-table invitation
      (`Net.wantTable` / `setWantTable`, defaulting **off**). With it on, `invite()` builds one
      extra link that reserves no chair and the host lobby draws its code, its QR and its progress
      in a block of its own; with it off no extra `RTCPeerConnection` is created.
- [ ] The join view asks **Player** or **Shared table** before Join is clicked, on the pasted-code
      path and on the QR deep-link path alike. The preselected answer is Shared table when
      `window.innerWidth >= 900` and Player below it, and either can be clicked to change it — a
      render case sets `window.innerWidth` to `390` and to `1280` and asserts which is preselected,
      and a third clicks the other option and asserts `net.join` received the role it chose.
- [ ] `Net.join` is `(code: string, as: GuestRole) => void`, and a table join leaves the window with
      `role: "table"`, `live: true` and `seat: null`.
- [ ] A chair whose peer joined as the table shows the new `ChairState` `"table"` in the host's
      lobby, **does not block Start** (`ready` treats it as settled, exactly as `"connected"` is)
      and is mapped to `"ai"` by `seatsFor()` — that chair is played by the game.
- [ ] `SessionStatus` gains `"nochair"`; `NetBanner`'s `SAYS` is a `Record<SessionStatus, LocaleKey>`
      so both catalogues must carry the line before it compiles.
- [ ] **No offline spectator exists.** No menu button, no rail button and no screen puts a window
      into the table role without a session: a render case asserts that clicking through the start
      menu and the lobby's pre-invite view reaches no control that sets it.

### A table window is read-only, and shows nothing that belongs to one player

- [ ] `<App />` rendered with `net.role === "table"` contains no `.handzone` and no `.handrow`, and
      `<Panels />` returns `null` in all six panel phases (`declare`, `swap`, `soolioffer`,
      `sooligive`, `sooliready`, `laydown`).
- [ ] **Nothing on a table window can move the game.** A sweep in `render.test.tsx` renders
      `<App />` with a table session over every `Screen["kind"]`, every `g.phase` and both locales,
      clicks every rendered `button`, and asserts the dispatch spy was called only with actions
      whose `SCOPE` is `"local"`. The sweep imports `SCOPE` rather than listing types by hand.
- [ ] The rail's New game button is not rendered on a table window, and `NetBanner` draws the
      table's role plus a Leave control that calls `net.hangUp()` and dispatches
      `{ type: "showMenu", view: "start" }` — the one way off the table without a reload.
- [ ] **No label on a table window is written from a viewer's point of view.** `seatNameIn` and
      `I18n.seatName` take `you: Seat | null` and return the character's own name for every `p`
      when `you` is `null`;
      `Seats`, `Table` and `ModeBox` pass `null` while spectating; `RacePlate`, `DealEnd` and
      `RaceOver` name each pair by its two characters through one new key (`race.pair`, `"{a} & {b}"`,
      the same placeholders in both catalogues). A render sweep asserts the translations of
      `seat.you`, `chal.us` and `chal.them` — "Sinä"/"You", "Te"/"Your side", "Vastustajat"/
      "Opponents" — appear nowhere in a table window's output, in either locale.
- [ ] `Seats` never prints another seat's cards on a table window: the `g.reveal` branch is skipped
      while spectating and every chair shows a card count. A case renders `reveal: true` with a
      table session and asserts no card name from any hand is in the output.
- [ ] **The felt does not swing round between turns.** `useSeatSync` writes the viewing seat not at
      all when the window is the table — the clause sits ahead of the session-seat clause, the
      hot-seat clause and the repair — so the orientation is fixed for the whole match. A case in
      `GameContext.test.tsx` drives `waitingSeat` from seat to seat and asserts the context never
      moves. `useSeatSync` stays the only caller of `useSetViewSeat`.
- [ ] A table window writes no save and files no board row: `GameProvider`'s `if (net.live) return;`
      already covers it, and a case in `GameContext.test.tsx` pins it for the table role
      specifically — `tupatro-run-v1` and `tupatro-race-v1` are both untouched by a whole match
      watched from the table.
- [ ] `invariants.test.ts` adds `spectator` and `spectating` to the `GameState` field blocklist
      beside the session's names, and keeps `src/game/` free of `netContext` and `useNet` imports.
      (`table` cannot join that list: `GameState.table` is Tuppi-Rummikub's.)

### What the player is told

- [ ] The rules panel's multiplayer list (`rules.mp`, both catalogues, same number of items) gains
      the shared table: what it shows, that it must be connected **before** the match starts, and
      that it changes nothing about every player's device holding every hand.
- [ ] `README.md`'s "Playing with other people" section, `docs/multiplayer.md`'s stage-4 list and
      `CLAUDE.md`'s transport section and Known gaps entry say what shipped: a table role, no
      reconnect, one table at a time, and the table is a peer like any other for the purposes of
      the desync hash.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The table must be connected before the host clicks Start, and cannot join a match already in
  progress.** There is no reconnect and no state catch-up: `hostSession` refuses any peer that
  arrives after the first action is numbered with `late`. The requirement's wording ("when a new
  device joins a multiplayer session") reads as though a table could arrive mid-game; it cannot,
  and this spec does not build the snapshot-and-catch-up that would let it. If the reviewer wanted
  a table that can be plugged in at deal five, that is a reconnect spec and this is not it.
- **Amended after `2026-09-08-trystero-rooms` and `-separate-multiplayer-connection-routes` were
  merged in: a display joins by room code too, and that is the route it will actually use.** This
  spec was written when the pasted code was the only way in, so its criteria describe the join view
  as the code-swap page. What shipped asks the question on **both** join pages, and `Net.enterRoom`
  takes a `GuestRole` beside `Net.join`. The one real decision it forced is in `seating.ts`: a
  room's chair is claimed by the **hello** rather than by the arrival, because the code cannot say
  what kind of device typed it, and a chair set aside for a display would be a chair no player
  could take. The claim is provisional — `hostSession` still refuses a version out of step — so a
  chair goes back to the room when the peer is not welcomed, which needed refused peers to leave
  the broadcast set (`version` and `nochair` now delete, as `late` always did). `guestSeating` also
  had to greet on `session.welcomed()` rather than `session.seat()`, since a display's seat is null
  for the whole match and a seat test would have it saying hello to the second arrival and being
  thrown out as `late`.
- **A table is a fifth connection on the code swap, not a chair that was given up.** The scenario in the issue is
  four people with phones around one big screen, which leaves no chair to sacrifice, so the host
  builds one extra invitation that reserves no seat. A device that answers a _chair's_ invitation
  and says "table" is honoured too — that chair simply falls back to the AI — because the joining
  device's answer is authoritative in both directions.
- **The host must ask for the table invitation before inviting anybody** (the switch is read inside
  `invite()`). Turning it on afterwards does not build a link. The alternative — always building a
  fifth peer connection — spends ICE gathering and, without LAN only, a STUN round trip on a
  connection most hosts do not want.
- **The auto-suggested default is `window.innerWidth >= 900`**, a plain width read on first render,
  not a media query and not a device class. 900 puts a landscape phone (844) under it and a tablet
  or laptop over it. It is a suggestion the player can override in either direction, and nothing in
  the game reads it again.
- **`NET_VERSION` is bumped to `2`, which makes every invitation code from the current build
  unusable.** `packSdp` stamps the version into the code and `unpackSdp` refuses a mismatch. A code
  copied into a chat window yesterday stops working; codes are minutes old in practice, and the
  alternative — a v1 host silently seating a table as a player and waiting for its clicks for ever
  — is worse.
- **One table per session.** The host builds one extra invitation; a second display would need a
  second one, and nothing here iterates. Two tables is not refused by the protocol — `guestMay`
  refuses any chairless peer's actions whatever the count — but the lobby offers only one.
- **The table keeps hashing and can report a desync.** It is a peer for the desync comparison, and
  a divergence on the table raises the same banner as any other. That is deliberate: a table drawing
  a board nobody else is playing is exactly the failure the hash exists to catch.
- **The table renders the ordinary felt and rail, not a bigger "TV" layout.** No larger cards, no
  new stylesheet breakpoint, no scaling. The requirement asks for a spectator view, not a redesign,
  and a layout tuned for a television is a measurement (a real screen at a real distance) this
  pipeline cannot make.
- **Hanging up leaves the table window sitting on the start menu, and the match goes on without
  it.** No message is sent to the host, which then sees a dropped peer; a table leaving does not end
  anybody's match because the host's stream does not wait for it.
- **A table window with the rules panel open still draws the rules panel over the board.** Modals
  are `local` actions and stay available — somebody at the shared screen looking a rule up is the
  reason the panel exists.

## Touch points

- `src/net/protocol.ts` — `GuestRole`, `hello.as`, `welcome.seat: Seat | null`, `NET_VERSION = 2`,
  `guestMay(a, seat: Seat | null)`, `parseMsg`'s two cases.
- `src/net/session.ts` — `hostSession`'s peer map becomes `Map<string, Seat | null>`, its `hello`
  case gains the two role branches and the `onGuest` dep; `guestSession` gains `as` and drops
  everything but `local` when it is `"table"`; `SessionStatus` gains `"nochair"`.
- `src/net/protocol.test.ts`, `src/net/session.test.ts` — the exhaustive `guestMay` case, the two
  hello branches, and the three-peer race deal.
- `src/hooks/netContext.ts` — `NetRole` gains `"table"`; `NetChair`'s invitation fields factored
  into a shared `NetInvite` so the table's block reuses them; `Net` gains `tableInvite`,
  `wantTable`, `setWantTable`, and `join` takes a `GuestRole`. `ChairState` gains `"table"`.
- `src/hooks/useNetGame.ts` — the extra chairless link, `links` keyed by `Seat | "table"`, the
  `onGuest` handler that hands a released chair back to the game, `seatsFor()` mapping a `"table"`
  chair to `"ai"`, and `join(code, as)`.
- `src/hooks/useNet.ts` — a `useSpectating(): boolean` beside `useNet`, so six components ask the
  same question once.
- `src/hooks/useSeatSync.ts` — the table clause, first, writing nothing.
- `src/hooks/GameContext.tsx` — passes the table role to `useSeatSync`. The `net.live` save guard is
  unchanged.
- `src/App.tsx` — no `<Hand />` on a table window.
- `src/components/panels/Panels.tsx` — `null` on a table window.
- `src/components/table/{Seats,Table,ModeBox}.tsx` — `seatName(p, null)` while spectating, no
  `g.reveal` hand listing, no "you lead".
- `src/components/rail/{Rail,RacePlate}.tsx` — no New game button; pair names instead of us/them.
- `src/components/screens/{DealEnd,RaceOver}.tsx` — pair names, and no Continue on a table window.
- `src/components/screens/Lobby.tsx` — the host's shared-table switch and code block, the join
  view's Player/Table choice and its width-based default, `ready` treating a `"table"` chair as
  settled.
- `src/components/net/NetBanner.tsx` — the table's own line and the Leave control.
- `src/components/screens/Rules.tsx` — the multiplayer list item (text lives in the catalogues).
- `src/i18n/index.ts`, `src/i18n/LocaleProvider.tsx` — `seatNameIn`/`I18n.seatName` take
  `you: Seat | null`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the join choice, the host's table block, the chair state, the
  banner, `net.nochair`, `race.pair`, the rules line.
- `src/index.css` — the join view's choice row and the table's invitation block. Hand-formatted and
  Prettier-excluded, as always.
- `src/test/harness.tsx` — `stubNet` gains the new `Net` fields (it spreads a `Partial<Net>`, so
  the table cases are one override).
- `src/test/render.test.tsx` — the table sweeps: no hand, only-local dispatch, no you/us/them, no
  revealed hand, no offline route in.
- `src/hooks/GameContext.test.tsx` — the seat that does not move, and the save that is not written.
- `src/test/invariants.test.ts` — `spectator` and `spectating` on the blocklist.
- `docs/multiplayer.md`, `CLAUDE.md`, `README.md` — the documentation criteria above.

## Out of scope

- **Reconnect, and joining a match in progress.** Named in Assumptions. A table that arrives late is
  refused with `late`, exactly as a player is.
- **More than one table**, a lobby list of connected devices, and nicknames.
- **A layout designed for a television**: larger cards, a distance-readable type scale, or a new
  breakpoint. The table draws the felt and rail the game already has.
- **A curtain on the players' own devices.** Lockstep means every peer holds every hand and the
  rules text says so; a table changes nothing about that, and hiding a hot-seat hand is still its
  own spec.
- **A table for a main-game run.** Nothing dispatches a hosted `newRun` — the lobby starts a race —
  so the only mode a table can watch today is the race. No screen or phase outside that is
  hand-verified, only swept.
- **An offline spectator or attract mode.** Refused for the same mechanical reason
  `2026-09-07-multiplayer-seat-selection-lobby` gave: with no session there is no peer to advance
  the player-gated phases, and the board would stall on the first one.
- **Any rule, any number, any score.** `src/game/` changes not at all beyond nothing — no phase, no
  action, no `SCOPE` entry added to the union, and `seats.test.ts`'s pinned literals must not move.
- **The AFK timer, TURN, automatic signalling, and camera-side QR reading** — still the transport's
  open debts.
- **Filing a networked race on a board.** Still blocked by `raceRowFor` reading `ownerTeam(g)`, and
  a table has no team at all, which makes it the clearest case for why that needs the window's own
  seat first.

## Source

Not a rule or scoring change: no tuppi rule, no trick, no declaration and no point is touched. The
club's rule sheet and korttipeliopas both describe a game of four players at one table and say
nothing about who may watch, so there is nothing here to check a spectator against.
