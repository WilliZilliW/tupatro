---
id: 2026-09-08-webrtc-transport
title: Play a run across browsers over WebRTC, with the invitation carried by copy-paste or a QR code
kind: infra
status: proposed
---

# Play a run across browsers over WebRTC, with the invitation carried by copy-paste or a QR code

## What

The start menu gains **Host a game** and **Join a game**. Hosting opens the lobby, which is no
longer a seat picker for a run that has nobody in it: the host takes a chair, marks each of the
other three as _open_ or _AI_, and gets one invitation code per open chair. A guest pastes that
code, gets an answer code back, and returns it to the host. When every open chair is filled the
host starts the run, and from then on the four seats are played from up to four browsers.

The wire carries **actions, not state**. Every peer runs the same reducer over the same ordered
action stream from the same seed, which is what `2026-09-07-seat-absolute-game-state` and
`2026-09-07-per-seat-economy` were built for. The host is the sequencer and the clock: it numbers
every action, broadcasts it, and is the only peer whose `nextTick` reaches the reducer. A guest's
click is a request; what changes a guest's state is the numbered action that comes back.

There is **no server of ours and no signalling library**: two `RTCPeerConnection`s are introduced
by a string the players move between themselves — a clipboard, a chat window, or a QR code shown
on one screen and scanned by the other device's camera. A STUN server is used by default so the
two can meet across NATs, and a **LAN only** switch turns even that off for a game on one network.

Nothing about the rules, the scoring, the ante ladder or the single-player run changes, and no
mode is added. This is the transport `docs/multiplayer.md` calls Stage 4, built before Stage 3's
race mode because a relay that carries `Action` carries whichever mode it is handed.

## Prior specs and documents

- **Delivers the "per-window choice" `2026-09-07-multiplayer-seat-selection-lobby` owed.** That
  spec's `useSeatSync` is a **single-human heuristic** and says so in its own comment: with two
  humans on one board `ownerSeat` is the wrong answer for at least one window. This change gives
  it the answer instead of a guess — the seat the host assigned — and does it **without adding a
  second writer of the viewing seat**: the assigned seat is passed _into_ `useSeatSync`, which
  stays the one hook that calls `useSetViewSeat`. Its repair path is untouched and still runs when
  no session is live.
- **Re-routes the lobby that `2026-09-07-new-game-skips-seat-picker` left with no route in.** That
  spec's criterion — New Game dispatches `newRun` (or raises the restart confirmation) and never
  `showMenu: "lobby"` — **stands verbatim and a criterion below re-pins it**. Host a game is a
  different button. Single player still never sees a seat picker.
- **Depends on `2026-09-07-seat-absolute-game-state` (delivered) and must not weaken it.** Every
  banned name — `you`, `viewSeat`, `self`, `me`, `mySeat`, `localSeat`, `myEcon`, `seatKind`,
  `usTricks`, `themTricks` — stays banned, and this change adds `net`-shaped names to the same
  blocklist for the same reason: the session is a property of the window, so a `GameState` field
  naming it would be the one field that differed between peers.
- **Depends on `2026-09-07-per-seat-economy` (delivered).** Untouched: `econOf(g, p)` stays the
  only door to a wallet and the pure core still never asks who is looking.
- **Overlaps `2026-09-04-resume-a-run-after-a-refresh`.** `SAVE_VERSION` stays **3** and no field
  is added, removed or moved. What changes is one guard in `GameProvider`: **a run with a live
  session is never written**, the same rule and nearly the same reason as the challenge's. A
  resumed board whose `seats` names humans with no peers behind them would stall on the first
  gated phase — `nextTick` returns `null` for a `"human"` seat and there would be nobody to act.
- **Amends `docs/multiplayer.md` in this same pull request.** Stage 4's checklist is rewritten to
  what actually shipped and what did not (no reconnect, no AFK timer, no nicknames, no spectator),
  and the "transport has to replace `useSeatSync`'s heuristic" debt is struck. Stage 3 is left
  exactly as `2026-09-07-race-to-target-mode` will find it.
- **Does not touch `2026-09-07-race-to-target-mode` (proposed, unbuilt, on this branch's parent
  commit).** The relay classifies actions by `Action["type"]`, so the race mode's actions get
  classified when they exist; a criterion below makes that a compile error rather than an
  oversight.

## Acceptance criteria

### The protocol is pure, and exhaustive over the action union

- [ ] `src/net/protocol.ts` exports `SCOPE`, typed `Record<Action["type"], Scope>` with
      `Scope = "local" | "seat" | "flow" | "auto"`. It is a `Record`, not a partial map: **adding
      a member to the `Action` union is a compile error until it is classified.** `npm run
    typecheck` is the gate.
- [ ] The four scopes are assigned as follows, and a test asserts the exact membership of each:
      **local** (never leaves the window) `showMenu` `closeMenu` `openModal` `closeModal`
      `dismissToast` `clearPop` `setSortMode` `reorderHand` `moveCard`; **seat** (relayed, carries
      the seat it acts for) `declare` `finishSwap` `pickSideCard` `acceptSooli` `declineSooli`
      `sooliGive` `startSooliPlay` `playCard` `layCards` `passLaydown` `buy` `reroll` `sellJoker`
      `sellSideCard` `useConsumable`; **flow** (relayed, no seat, any human may click)
      `newRun` `startBlind` `skipBlind` `startChallenge` `leaveChallenge` `nextDeal` `toShop`
      `nextBlind`; **auto** (the clock's, host only) `aiDeclare` `finishDeclare` `aiPlay`
      `resolveTrick` `endTrick` `showHandResult` `aiLaydown`.
- [ ] The nine local actions are exactly the ones that touch no field the desync hash reads. A
      test asserts it mechanically: for each of them, applying it to a loaded state leaves
      `hashState` unchanged.
- [ ] `hashState(g)` is deterministic, order-insensitive in each hand (a hand's uids are sorted
      before hashing, because `reorderHand` is local and a guest's own drag must not read as a
      divergence) and covers at least `seed` `rngState` `uidSeq` `phase` `turn` `leader` `trickNo`
      `tricks` `dealsLeft` `ante` `blindIdx` `mode` `declIdx` `sooliSeat`, the trick's uids in
      order, every hand's sorted uids, and every economy's `money` and joker ids. Tests: equal
      states hash equal; a state differing only in `reorderHand` hashes equal; a state differing
      in any one of the listed fields hashes differently.
- [ ] `parseMsg(text)` returns `NetMsg | null` and **never throws**, for any string: malformed
      JSON, a valid JSON non-object, a known `t` with wrong field types, an unknown `t`. A peer is
      a person you know, but a dropped frame or an old build is not an exception the app may die
      on. A table-driven test covers all four rejections.
- [ ] `guestMay(action, seat)` is the host's admission test and is the only place a peer's
      authority is decided: a guest may send a **seat** action whose `p` equals the seat the host
      assigned it, and any **flow** action. It refuses every **auto** action, every **local**
      action, and any seat action naming a seat that is not its own. Four cases, four tests.

### The session is the whole relay, and it is testable with no browser

- [ ] `src/net/session.ts` holds the ordering and nothing about WebRTC: it is constructed with a
      `send`, an `apply` and a status callback, so a test wires two sessions to each other's
      `receive` and needs no `RTCPeerConnection`. It names neither `RTCPeerConnection` nor
      `document` nor `window`, and imports no React — the same boundary the pure core has, checked
      by `invariants.test.ts`.
- [ ] **The flagship test**: a host session and one guest session, each driving its own
      `gameReducer` over its own state, play a whole blind with `basicPolicy` acting for two human
      seats. After it, `hashState` is equal on both, and `dehydrate` of both is deeply equal.
      This is the criterion that says lockstep works; it must fail if the host stops broadcasting,
      if the guest applies its own intents, or if the guest runs the clock.
- [ ] The host applies an action **once**, locally, at the moment it numbers it, and broadcasts the
      same numbered action to every peer. A test asserts the host's state never advances twice for
      one intent.
- [ ] A guest's intent for a **seat** or **flow** action does not change the guest's own state
      until the numbered action arrives back. A test asserts the guest's hash is unchanged
      immediately after `intent` and changed after the round trip.
- [ ] A guest's **local** action never reaches `send`, and does change the guest's own state at
      once. A test asserts both halves.
- [ ] A guest's **auto** action is dropped, not sent. This is what lets `useGameLoop` run unchanged
      on every peer: a guest's clock fires, the classifier drops it, and only the host's tick
      becomes an action. A test asserts nothing is sent and the state does not move.
- [ ] Numbered actions apply in order. A guest that receives `n` when it expected `n - 1` or
      `n + 1` raises a status of `"desync"` and stops applying rather than applying out of order.
      A test drives a gap and asserts both.
- [ ] Every peer sends a `hash` message at the end of each trick (on `endTrick`), and the host
      compares it against its own hash for that action number. A mismatch raises `"desync"` on the
      host. A test forces one by mutating a guest's state behind the session's back.
- [ ] `NET_VERSION` is a constant, carried in `hello` and in every signalling code, and a peer on
      another version is refused with a distinct status rather than allowed to desync later.

### The invitation is a string, and the string is small

- [ ] `src/net/signal.ts` exports `packSdp(kind, sdp)` and `unpackSdp(code)`. A code is
      `"T" + NET_VERSION + kind + base64url(compact)`, where `kind` is `"H"` for the host's offer
      and `"G"` for the guest's answer, and `compact` keeps only the ICE ufrag, the ICE password,
      the DTLS fingerprint, the setup role and the candidates — the rest of the SDP is boilerplate
      for one data channel and is rebuilt by `unpackSdp`.
- [ ] `unpackSdp` round-trips a **real** browser SDP: `src/net/sdp.fixture.ts` holds one captured
      offer and one captured answer, and the test asserts that unpacking the packing of each
      yields an SDP with the same ufrag, password, fingerprint, setup role and candidate list.
- [ ] `unpackSdp` returns `null` — never throws — for: an empty string, a code with the wrong
      prefix, a code from another `NET_VERSION`, a code of the wrong kind (an answer pasted into
      the offer box), and base64 that does not decode. Each gets its own test, and the lobby shows
      a different message for the wrong-kind and wrong-version cases, because those are the two a
      player will actually hit.
- [ ] A packed offer captured from Chrome with the default STUN server is **under 700 characters**.
      The test asserts it against the fixture, so a change to the compact format that doubles the
      code fails rather than merely getting worse.

### The QR code is drawn here, and proven by decoding it back

- [ ] `src/net/qr.ts` exports `qrMatrix(text): boolean[][]` — byte mode, error correction level L,
      the smallest version from 1 to 25 that fits, and the mask chosen by the standard penalty
      rules. No dependency is added to `package.json`; `npm ls --prod` shows the same three
      runtime dependencies as before (`immer`, `react`, `react-dom`).
- [ ] `src/net/qr.test.ts` contains a **reader** — unmask, walk the module placement backwards,
      read the mode and length, and recover the bytes — and round-trips every case through it:
      the empty string, one character, a string at each of several version boundaries, a full
      invite code, and 8-bit-clean UTF-8. A round trip through the project's own reader proves the
      placement and the masking; it does **not** prove the Reed-Solomon table, so:
- [ ] The generated matrix is decoded by an **independent** decoder as a one-off manual check, and
      the result is written into the spec's delivery notes: a scratch page loading a QR decoder
      from a CDN, reading a rendered invite code back. This is the same kind of proof as the
      device-metrics readings in `2026-09-05-swipeable-rail-pages-on-phone` — measured once, in a
      browser, and recorded rather than automated.
- [ ] Structural tests hold the parts a reader would not notice: three finder patterns with their
      separators, the timing patterns, the dark module, alignment patterns for the versions that
      have them, a module count of `4 * version + 17`, and format information that decodes back to
      the level and mask that were used.
- [ ] `components/net/QrCode.tsx` draws the matrix as **SVG** — one `<path>` of rectangles, a
      `viewBox` of the module count plus a quiet zone of 4, `shape-rendering="crispEdges"`, and
      `role="img"` with a translated label. Not a canvas: an SVG is testable in jsdom, prints, and
      survives a browser zoom. A render test asserts the module count and that both colours come
      from CSS custom properties, so the code stays scannable in either theme.
- [ ] The QR encodes a **deep link**, not the bare code: `location.origin + location.pathname +
    "#j=" + code`. A phone's own camera app opens it, and the app reads `location.hash` on boot
      and prefills the join box, so the offer leg costs one scan and no typing. The answer leg is
      still a paste — a laptop has no camera in the general case, and reading a QR is out of scope
      below.

### The lobby hosts and joins

- [ ] `Menu.tsx` gains **Host a game**, which dispatches `{ type: "showMenu", view: "lobby" }`.
      New Game's button and its `runStarted ? restart : newRun` branch are **byte-identical** after
      this change — `2026-09-07-new-game-skips-seat-picker` is not disturbed.
- [ ] Joining needs no menu button of its own beyond one: **Join a game** opens the same lobby in
      its guest half. A boot with `#j=<code>` in the location hash opens it there with the code
      already in the box.
- [ ] The lobby's host half seats the host at any of the four chairs and marks each other chair
      _open_ or _AI_, so 1, 2, 3 or 4 humans are all reachable, and the run it starts carries the
      whole `seats` tuple. `newRun` gains an optional `seats?: [SeatKind, SeatKind, SeatKind,
    SeatKind]`, `createRun` gains the matching optional parameter, and the existing `seat`
      parameter keeps working exactly as it does — every current call site compiles unchanged and
      `src/game/seats.test.ts`'s pinned literals do not move.
- [ ] The host's invite code appears **per open chair**, with a Copy button and its QR, and a box
      to paste that chair's answer. A chair shows its connection state: waiting for an answer,
      connecting, connected, failed.
- [ ] Start is disabled until every open chair is connected, and the run it starts is the host's
      `newRun` — relayed like any other flow action, so every peer creates the same run from the
      same seed on the same numbered action.
- [ ] A guest that has sent its answer waits, and lands in the run when the host starts it. The
      guest's window shows its **own** seat: `useSeatSync` is given the assigned seat and sets the
      context to it, and the four panels a seat can act from dispatch for that seat.
- [ ] `components/net/NetBanner.tsx` shows the session's state during play — who is connected, and
      a warning when the status is `"desync"` or a peer has dropped. It is drawn outside the
      overlay so a screen cannot hide it.
- [ ] The rules panel gains a short multiplayer section, in both languages, saying the three true
      things: **every peer can read every hand** in devtools because there is no server (that is
      the accepted trade, and the mode text must not imply otherwise), the invite code carries your
      network address unless **LAN only** is on, and a dropped peer ends the game because there is
      no reconnect yet.

### Nothing about the window leaks into the state, and the boundaries hold

- [ ] `GameState` gains **no** field. `invariants.test.ts` fails on a `GameState` field named
      `net`, `peer`, `peers`, `conn`, `channel`, `session` or `host`, in the same shape as the
      viewing-seat blocklist and for the same reason.
- [ ] No file under `src/game/` imports `../net`, and `invariants.test.ts` asserts it. The relay
      knows the game; the game does not know the relay.
- [ ] `RTCPeerConnection` is named in exactly one file, `src/net/rtc.ts`, exactly as `localStorage`
      is named only in `src/game/storage.ts`. `invariants.test.ts` asserts the list.
- [ ] `src/net/protocol.ts`, `src/net/session.ts`, `src/net/signal.ts` and `src/net/qr.ts` name no
      `document`, no `window`, no `localStorage` and import no React. They are added to the pure
      list `invariants.test.ts` already walks (as a second list, since they are not `src/game/`).
- [ ] `useGameLoop.ts` stays the only `setTimeout` call site in `src/` — the transport adds no
      timer of its own, and the invariant that says so passes unchanged. ICE gathering is awaited
      through `icegatheringstatechange`, not a deadline.
- [ ] `Math.random` stays a single call site in `rng.ts`. Peer identifiers come from
      `crypto.randomUUID()`, which is not the game's randomness and cannot move a deal.
- [ ] No module-level `let` is added, and `npm run lint`, `npm run typecheck`,
      `npx prettier --check .`, `npm test` and `npm run build` all pass.
- [ ] A run with a live session is never written to `tupatro-run-v1`: `GameProvider` returns before
      `writeRun` when the session is live, the way it already does for a challenge. A test asserts
      nothing is written during a session and that the snapshot on disk is untouched by one.
- [ ] Every player-facing string added lives in `src/i18n/fi.ts` and `src/i18n/en.ts` and is
      reached through `t()`. `i18n.test.ts` and `render.test.tsx` pass, the lobby's three states
      (offline, hosting, joining) render in both languages, and no Finnish word from the stopword
      list appears in the English lobby.

## Assumptions

Nobody answered a question while these were written down; each is a reading that could have gone
the other way.

- **The host is the sequencer and the clock.** The alternative — every peer running its own clock
  and agreeing by convention — needs a deterministic tie-break for every automatic step and gives
  four chances to diverge. One sequencer makes the ordering trivially identical and costs a guest
  one round trip of latency on its own click. Latency is the accepted price.
- **A guest sees its own click only after the round trip.** No optimistic local application. It is
  the difference between a relay that can be reasoned about and one that needs a rollback.
- **Hand order, sort mode and the open modal are window-local.** They change `GameState`, so peers
  do differ in them, and the hash is defined to ignore exactly that difference. The alternative —
  relaying a guest's drag — would let one player reorder another's hand, since `sortMode` and
  `customOrder` are single fields rather than per-seat ones.
- **The economy stays the run owner's.** On the main game's run, `ownerSeat(g)` is the first human
  seat, so in a hosted game the shop and the wallet belong to whichever human sits earliest, not
  to whoever clicks. That is wrong for a four-human game and it is **not fixed here**: the race
  mode is the mode this is for, and it has no economy at all. It is written into
  `docs/multiplayer.md` as a debt rather than papered over.
- **STUN by default, with an off switch.** `stun.l.google.com:19302` is a third party, and the
  handoff already accepts that WebRTC cannot introduce two browsers by itself. LAN only omits
  `iceServers` entirely, which keeps the "no backend of ours" claim literally true for a game on
  one network. No TURN: a relay server is a backend, and two players behind symmetric NATs will
  have to use LAN only or another network.
- **The QR is written, not read.** Encoding is a few hundred lines and testable; decoding is a
  camera permission, a video pipeline and a much larger algorithm, and the deep-link trick means
  the phone's own camera app does the reading for the leg that matters.
- **Up to four peers, star topology.** Guests never talk to each other, so a four-human game is
  three connections and six pasted codes rather than six connections and twelve.

## Touch points

- `src/net/protocol.ts` — new. `Scope`, `SCOPE`, `NetMsg`, `parseMsg`, `guestMay`, `hashState`,
  `NET_VERSION`.
- `src/net/session.ts` — new. `hostSession`, `guestSession`, the ordering, the status.
- `src/net/signal.ts` — new. `packSdp`, `unpackSdp`, the compact SDP form.
- `src/net/sdp.fixture.ts` — new. One captured offer, one captured answer.
- `src/net/rtc.ts` — new, and the only file naming `RTCPeerConnection`. Offer/answer creation, ICE
  gathering awaited by event, the data channel, `ICE_SERVERS` and the LAN-only path.
- `src/net/qr.ts` — new. Byte mode, level L, versions 1–25.
- `src/hooks/useNetGame.ts` — new. The refs holding the peer connections, the wrapped dispatch, the
  session's status as React state. Called by `GameProvider` beside `useGameLoop`.
- `src/hooks/netContext.ts`, `src/hooks/useNet.ts` — new. The context and its hooks, split the way
  `seatContext.ts` / `useSeat.ts` are, so Fast Refresh keeps working.
- `src/hooks/GameContext.tsx` — provides the net context, passes the wrapped dispatch to
  `useGameLoop` and to children, passes the assigned seat to `useSeatSync`, and skips `writeRun`
  while a session is live.
- `src/hooks/useSeatSync.ts` — takes the assigned seat and prefers it; stays the one writer.
- `src/components/screens/Lobby.tsx` — reworked into the host/join lobby.
- `src/components/net/QrCode.tsx`, `src/components/net/NetBanner.tsx` — new.
- `src/components/screens/Menu.tsx` — Host a game and Join a game. New Game untouched.
- `src/components/screens/Rules.tsx` — the multiplayer section.
- `src/game/actions.ts`, `src/game/state.ts` — `newRun`'s optional `seats`, `createRun`'s optional
  parameter. Nothing else in `src/game/` changes.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the lobby, the banner, the rules section.
- `src/index.css` — the lobby's host/join blocks, the QR figure, the banner.
- `src/test/invariants.test.ts` — the four new boundaries.
- `docs/multiplayer.md`, `CLAUDE.md`, `README.md` — what shipped and what did not.

## Out of scope

- **Reconnect.** A dropped peer ends the game. `dehydrate` already produces the snapshot a
  reconnect would need, and that is where the next increment starts.
- **The AFK timer.** The challenge's 60-second turn is the shape to copy; it is not copied here.
- **Nicknames**, spectators, and any lobby list. A spectator needs an auto-advance path for the
  seven player-gated phases and is refused for the reason `2026-09-07-multiplayer-seat-selection-lobby`
  gave.
- **Reading a QR code with the camera.**
- **TURN, and any automatic signalling** — Trystero, PeerJS, a tracker or a relay.
- **The race mode**, and the shop-ownership question inside a hosted main-game run.
- **Cheat-proofing.** Lockstep means every peer holds every hand. Named in the rules text rather
  than mitigated.
