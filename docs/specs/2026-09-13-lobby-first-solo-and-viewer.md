---
id: 2026-09-13-lobby-first-solo-and-viewer
title: Start every game from one lobby, and show the session code while it is played
kind: ui
status: proposed
---

# Start every game from one lobby, and show the session code while it is played

## What

The start menu stops asking whether you are playing alone or with other people. **New game** opens
the lobby, which is the one place a game is configured: four chairs, each of them you, a peer or
the game, and a mode picker that now holds the solo roguelike beside the Tuppi Race and Traditional
Tuppi. Leaving every other chair to the game is what makes a run single-player, and it is one click
from the lobby — the chair table opens pre-filled with the plan New game has always produced.
The **Multiplayer** door is gone: hosting, joining, the mode and Hang up all live in the lobby.

While a session is live the room's code is on screen, in the net banner, instead of only in the
lobby. **A viewer still cannot join a match already in progress** — the session model refuses it,
and the section below says exactly why and what it would take. What ships instead is the code where
a latecomer can read it, and an honest refusal on the window that arrives too late, in place of
today's "The link dropped."

## Prior specs

- **Reverses `2026-09-07-new-game-skips-seat-picker` (delivered, on `main`), and this requirement's
  reading wins.** Its criteria _"`Menu.tsx`'s New Game button dispatches exactly `{ type: "newRun" }`
  when `runStarted` is false"_, _"`RestartConfirm.tsx`'s confirm button dispatches exactly
  `{ type: "newRun" }`"_ and _"`grep -rn '"lobby"' src/components/` finds the view only in
  `Screens.tsx`'s route … a test asserts it for the menu and the confirmation directly"_ are
  **withdrawn**. So is its assumption that a single-player player must not be handed a chair
  decision. That spec's argument was that the picker cost a click and asked a question single player
  never asks; this requirement accepts that cost deliberately, and the cost is bounded by a
  criterion: the lobby opens pre-filled, so menu → New game → Start is two clicks to the felt
  against today's one, with no other interaction. **A reviewer should read this as a deliberate
  second reversal of the same flow, not a bug fix.**
- **Supersedes `2026-09-08-multiplayer-behind-one-door` (delivered) in its central criterion.** The
  menu is no longer "Continue and New game; then Multiplayer and Challenges; then Rules and SCORES":
  `menu === "multi"` and `Multi.tsx` go, and the three things behind that door — Host, Join, Hang up
  — move into the lobby and the banner. Everything else that spec delivered stands: the result
  screens still dispatch `leaveChallenge` themselves, the menu still holds no Leave, and Challenges
  keeps `disabled={net.live}` with `menu.noChallenge`.
- **Partly supersedes `2026-09-09-start-menu-solo-run` (delivered).** Its criterion _"New game and
  its restart confirmation cannot dispatch newRun while a session is live"_ is met in a different
  way and its wording is replaced: **neither dispatches `newRun` at all any more**, at any time —
  the lobby's Start is the one site, and it is gated on its own terms. Its _"Multiplayer, Rules and
  SCORES remain reachable"_ becomes "the lobby, Rules and SCORES remain reachable", since Hang up
  moves with the door. **Continue is untouched**: it still reaches the solo run wherever it is,
  still leaves a parked challenge on the way, and is still `disabled` while `net.live`.
- **Overlaps `2026-09-11-room-first-multiplayer-lobby` (on `main`) and changes none of it.** The
  waiting-room roster, the host-controlled assignment, `PLAYER_NAME_MAX`, duplicate-chair refusal,
  the Start gate on unassigned players and `NET_VERSION` 5's reason are all untouched. This spec
  adds a door in front of that lobby and a third mode inside it; the room's own flow is out of
  scope below.
- **Confirms rather than changes `2026-09-08-shared-table-view-multiplayer` and
  `2026-09-09-shared-table-always-invited` (both delivered).** A shared table still joins by typing
  the room code or answering the chairless invitation, still holds no chair, still draws no control
  that moves the game — and still has to be connected **before Start**. This spec makes that
  limitation visible and documented rather than removing it.
- **Not already delivered.** Today `Menu.tsx` draws a Multiplayer button, `MenuView` carries
  `"multi"`, `useNetGame`'s `start` sends `startChallenge` and nothing else, `net.match` is typed
  `MatchId`, `NetBanner` draws role, status and a table's Hang up with no code, and a guest refused
  at the door is told `net.dropped`.

## Late join: why it cannot work here, and what it would take

The requirement asks for a spectator to join after the game is in progress "if that's feasible
within the current no-reconnect session model". It is not, and this is the record of why rather
than a silent omission.

- `hostSession.receive`'s `hello` case in `src/net/session.ts` refuses any peer once
  `seq.n > 0`: it sends `bye`, drops the peer and raises `late`. That is deliberate — the numbered
  stream starts at 1 and a peer that missed part of it would desync immediately.
- **No action log exists to catch anybody up.** `sequence()` applies, broadcasts and forgets; no
  peer, and nothing in `useNetGame`, retains the ordered actions.
- `guestSession.receive`'s `act` case requires `m.n === stream.next` starting at **1**, and stops
  the stream on the first gap. A peer handed action 400 as its first message reports `desync` and
  applies nothing.
- A catch-up **is** architecturally possible, because the stream is deterministic from action one
  (`startChallenge`/`newRun` carries the seed and the seats, and `hashState` ignores `parked` and
  `bestAnte`). It needs: a retained ordered log on the host with a decision about its memory bound,
  a new `NetMsg` carrying it, `parseMsg` validation for that message, guest-side stream
  repositioning, and a `NET_VERSION` bump. It also needs a measurement nobody has taken — several
  thousand replayed dispatches through React on the joining window.
- That is a transport increment with its own spec. Bundling it with a start-screen restructure would
  put a protocol change and a menu change in one pull request, and the protocol half is the half
  that can desync a live match.

What ships instead: the code is readable during play, so a viewer can be given it for the **next**
match, and the window that arrives too late is told so.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

- [ ] **One door.** `src/components/screens/Menu.tsx` draws no Multiplayer button, `MenuView` in
      `src/game/types.ts` is `"start" | "challenges" | "lobby" | "join"`,
      `src/components/screens/Multi.tsx` is deleted and `Screens.tsx` routes `"lobby"` and `"join"`
      only. A case in `src/test/render.test.tsx` asserts New game dispatches exactly
      `{ type: "showMenu", view: "lobby" }`, Join a game exactly
      `{ type: "showMenu", view: "join" }`, and that **no** button on the menu or in its restart
      confirmation dispatches `newRun` — the inverse of the case
      `2026-09-07-new-game-skips-seat-picker` installed, under a name that says which way it now
      reads.
- [ ] **Solo is the default plan and one click.** Opening the lobby on a fresh boot shows the `me`
      chair at seat 0, the other three `ai`, and the mode picker on the roguelike. Start then
      dispatches exactly `{ type: "newRun", seats: ["human","ai","ai","ai"] }` with no seed, and the
      resulting state has `runStarted === true`, `menu === null`, `screen.kind === "blindselect"`
      and `seats` equal to what `{ type: "newRun" }` produces today — pinned in
      `src/game/reducer.test.ts` against the delivered _"seats the human at 0 when newRun names no
      seat"_ case.
- [ ] **Three modes, on the window and not in the state.** `hooks/netContext.ts` exports
      `LobbyMode = "run" | MatchId`, `net.match` is one and defaults to `"run"`, and
      `useNetGame`'s `start` dispatches `newRun` for `"run"` and `startChallenge` for `"race"` and
      `"tuppi"`, each carrying `seatsFor()`. `src/test/invariants.test.ts` still finds no
      session-shaped field on `GameState`, and `grep -n "match" src/game/types.ts` finds no lobby
      mode there.
- [ ] **The roguelike is for one player, and says so.** While any peer is connected — a room player
      other than the host, a connected shared table, or any chair whose state is `"connected"` or
      `"table"` — the roguelike option is drawn `disabled` and Start refuses it with a line naming
      the reason (one wallet, at `ownerSeat(g)`, and result screens written in the second person).
      A render case asserts the disabled option and the line in both locales, and that no click in
      that state dispatches `newRun`.
- [ ] **The confirmation moves to the destructive click.** `Menu.tsx` raises no modal from New game.
      The lobby's Start raises `{ type: "openModal", modal: "restart" }` when the selected mode is
      `"run"` and `g.runStarted`; `RestartConfirm.tsx`'s confirm calls `net.start()` and its cancel
      dispatches `{ type: "closeModal" }` and returns to the lobby. Race and Traditional raise no
      confirmation, because `startChallenge` parks the run where `newRun` destroys it. Both buttons
      stay `MoveButton`s.
- [ ] **Hang up survives the door it lived behind.** The lobby footer draws Hang up whenever
      `net.live`, on host, guest and table alike, and `NetBanner` keeps the table's. A test drives
      each of the three roles from the start menu to a `net.hangUp` call in at most two clicks and
      asserts `net.live` is false afterwards.
- [ ] **A shared table configures nothing.** With `useSpectating()` true the lobby draws no Start,
      no chair controls and no mode picker. `render.test.tsx`'s table sweep covers `menu: "lobby"`
      and `menu: "join"` and finds no dispatch that moves the game, with the delivered vacuity guard
      — the same screens on a window holding a chair — still asserting that they do.
- [ ] **The code is on screen while the game is played.** `NetBanner.tsx` draws `net.room` while
      `net.live` and a room exists, as text and not as a control, and draws nothing extra when
      `net.room` is `null` (the code-swap route has no room code). A render case reads it in both
      locales with the banner over a `raceover` screen, since the banner is the one element outside
      `.overlay`.
- [ ] **A window refused at the door is told which door refused it.** `SessionStatus` in
      `src/net/session.ts` gains `"refused"`; `guestSession` maps a `bye` arriving before
      `welcomed()` to it and a `bye` after `welcomed()` to `dropped`. `NetBanner`'s `SAYS` is a
      `Record<SessionStatus, LocaleKey>`, so it fails to compile until `net.refused` is listed, and
      that string says the host refused the connection and names an already-started match as the
      likely reason. `src/net/session.test.ts` covers both orders. `NET_VERSION` stays **6**: no
      message shape and no reducer rule changes.
- [ ] **The limitation is written down.** `docs/multiplayer.md`, `README.md` and `CLAUDE.md` state
      that a player or a shared table must be connected before Start, name the three mechanisms that
      make it so (`hostSession`'s `seq.n > 0` refusal, no retained action log, `guestSession`'s
      `stream.next` starting at 1) and name what a later increment needs (a retained log or a
      snapshot, a new message, a `NET_VERSION` bump). No document may imply a viewer can join a
      match under way.
- [ ] **Text.** Every new string exists in both `src/i18n/fi.ts` and `src/i18n/en.ts` with matching
      placeholder sets, and the keys no screen draws any more — `multi.title`, `multi.dek`,
      `multi.hosting`, `multi.joined`, `btn.multiplayer`, and `menu.soloOnly` if its sentence stops
      being true — are removed from both or rewritten. `grep -rn "multi\." src/components/` finds
      nothing, and `src/i18n/i18n.test.ts`'s parity and stray-Finnish cases pass.
- [ ] **Documentation and gates.** `README.md`'s start-menu and _Playing with other people_
      sections, `CLAUDE.md`'s overlays paragraph, its lobby section and its start-menu Known gap,
      and `docs/multiplayer.md` match the shipped flow; the test-count lines in both files match
      what `npm test` prints. All five gates pass: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`. One browser
      reading is recorded in the PR body at **1280x800**, **1280x500** and **390x844**: the click
      count from menu to felt, the lobby's sticky footer hit-testable with the mode picker's extra
      row present, and the banner's code legible over a result screen.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **A solo game opens no room and touches no relay.** The requirement says a solo run is "the same
  hosted session underneath"; that is honoured as _the same screen and the same seat plan_, not as a
  live session. An all-AI Start dispatches straight to the reducer exactly as today. Hosting a
  Trystero room for a one-player game would put a public Nostr relay, a round trip and a failure
  mode in front of a game that currently needs no network at all. **If the reviewer literally meant
  one session type underneath, this is the line to object to.**
- **This is the second reversal of the same flow.** New game becomes two clicks to the felt instead
  of one, and the solo player is shown a chair table again — the exact thing
  `2026-09-07-new-game-skips-seat-picker` removed. The requirement asks for it; the mitigation is
  the pre-filled default plan, and a criterion pins the click count.
- **`menu === "multi"` is deleted rather than kept as a second door**, and the menu keeps a **Join a
  game** button beside New game. Start-versus-join is not the single-player-versus-multiplayer split
  the requirement removes, and a join route hidden behind a button labelled New game would be
  undiscoverable. `MenuView` keeps `"join"` for that reason.
- **A hosted main-game roguelike stays unreachable**, now by a stated refusal rather than by a
  missing route. The Known gaps are the reason: one economy at `ownerSeat(g)`, `MainDealEnd`'s and
  `GameOver`'s second-person strings, no board row and no save. The lobby must not become the door
  that ships a half-built mode.
- **Tuppi-Rummikub is not in the mode picker** and stays on the Challenges list, disabled while a
  session is live. A multi-human laydown is untested territory, and chairs in front of it would
  promise something the mode cannot honour.
- **Late join is not built.** The section above is the whole answer, and the honest refusal message
  is what ships in its place.
- **The in-play code is drawn in `NetBanner` only, not on the rail.** The banner is the one element
  drawn outside `.overlay`, so it is visible over a result screen as well as over the felt; the
  rail's game page is behind every overlay and needs a swipe on a phone.
- **`net.match` defaults to `"run"` and nothing flips it automatically.** A host who opens a room
  and seats players must pick Race or Traditional; the roguelike option is disabled with a reason
  rather than silently reselected, because a hidden state change at the moment a peer connects is
  worse than one click.
- **The restart confirmation is raised for the roguelike alone**, because `newRun` destroys the run
  and `startChallenge` parks it — the same reason Challenges' Play has never confirmed.
- **`SessionStatus` gains a member with no `NET_VERSION` bump.** Nothing on the wire changes and no
  reducer rule moves; the new status is this window's reading of a `bye` it already receives.
- **Continue keeps `disabled={net.live}`; New game loses it**, because opening the lobby dispatches
  a `local` `showMenu` and nothing else. A live guest reaching the lobby sees its waiting page and
  the Hang up button, which is the point.
- **The seed dialog is not folded into the lobby** and keeps its own `newRun`. It remains the second
  `flow` door named in Known gaps; narrowing it is a separate change.

## Touch points

The files and functions this is expected to change. All real.

- `src/components/screens/Menu.tsx` — New game opens the lobby; a Join a game button; the
  Multiplayer button and its live-session line go.
- `src/components/screens/Multi.tsx` — deleted; its three controls move to the lobby.
- `src/components/screens/Screens.tsx` — the `"multi"` route goes.
- `src/components/screens/Lobby.tsx` — the entry page gains the three-mode picker, Join a room, Hang
  up while live, the Start gate for the roguelike and the `useSpectating()` guard; `back` no longer
  lands on `"multi"`.
- `src/components/screens/RestartConfirm.tsx` — confirm calls `net.start()`.
- `src/components/net/NetBanner.tsx` — the room code, and `SAYS` gains `net.refused`.
- `src/game/types.ts` — `MenuView` loses `"multi"`.
- `src/hooks/netContext.ts` — `LobbyMode`, `match`/`setMatch`, the default context.
- `src/hooks/useNetGame.ts` — `start` branches `newRun` / `startChallenge`; `matchRef` widens.
- `src/net/session.ts` — `SessionStatus` gains `"refused"`; `guestSession`'s `bye` case reads
  `welcomed()`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the lobby's mode names, the refusal reasons, the banner's
  code label; the `multi.*` keys go.
- `src/index.css` — the lobby entry page's mode row and the banner's code chip, inside the existing
  hand-formatted blocks.
- `src/components/screens/Menu.test.tsx` — the menu's new button set and its dispatches.
- `src/test/render.test.tsx` — the menu dispatch cases, the lobby's three modes, the table sweep's
  `"lobby"` and `"join"` dimensions, the banner's code.
- `src/game/reducer.test.ts` — `newRun` carrying the lobby's `seats` tuple.
- `src/net/session.test.ts` — `bye` before and after the welcome.
- `src/hooks/useNetGame.test.tsx` — `start` sending `newRun` for `"run"`.
- `README.md`, `CLAUDE.md`, `docs/multiplayer.md` — the flow, the door that is gone, the late-join
  limitation.

## Out of scope

- **Late join, reconnect, catch-up replay, a retained action log, state snapshots or resume tokens.**
  Documented above, deliberately unbuilt.
- **A hosted main-game roguelike across browsers**, the one-economy problem at `ownerSeat(g)` and the
  second-person strings in `MainDealEnd` and `GameOver`.
- **Tuppi-Rummikub in the lobby**, and the Challenges list's own flow and gate.
- **The seed dialog, the rail's seed chip and their `newRun`.**
- **`SCOPE`, `guestMay`, `hashState`, `NET_VERSION`, every wire shape, the signalling codec and the
  QR encoder.** No byte on the wire changes.
- **The room-first roster**: names, assignment, removal, duplicate refusal and the Start gate on
  unassigned players stay exactly as delivered.
- **Any tuppi rule, any score, any balance figure, `SAVE_VERSION`, and any `GameState` field.**
  `src/game/{rules,scoring,ai,laydown,points,race}.ts` are untouched and `src/game/seats.test.ts`
  must not move a literal.
- **Filing a board row for a networked match, and saving a networked run.** Both stay refused.
- **Accessibility.** No ARIA roles, labels or focus management beyond what the moved controls
  already carry; the known gap stands.
- **A television layout for the shared table**, and more than one table per session.
