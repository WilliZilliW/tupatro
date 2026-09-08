---
id: 2026-09-08-trystero-rooms
title: Join a hosted race by typing a room code
kind: infra
status: proposed
---

# Join a hosted race by typing a room code

## What

A host opens a room and reads out an eight-character code; up to three other players type that
code and are seated. No pasting of a 430-character invitation, no answer to carry back, no
per-chair exchange. The manual paste/QR route stays exactly as it is, as the route that needs no
third party on the network path.

Signalling comes from [Trystero](https://github.com/dmotz/trystero), pinned at `0.25.3`, over
its default Nostr strategy. Trystero owns the peer mesh; `src/net/session.ts` — the relay, the
sequencer, the hash comparison — does not change at all, because a Trystero room already speaks
in the shape `SessionDeps` wants: a peer id, a `send(peer, text)`, and a message stream.

## Acceptance criteria

- [ ] `trystero` is a pinned exact runtime dependency at `0.25.3` in `package.json`
      (`"trystero": "0.25.3"`, no caret). `0.25.4` publishes an empty tarball — no `dist` — and
      so does every `@trystero-p2p/*` package at that version; a caret range would break the
      build the moment npm resolved to it.
- [ ] `src/net/room.ts` is the only file under `src/` that imports `trystero`, asserted by a new
      clause in `src/test/invariants.test.ts` beside the existing `RTCPeerConnection` clause.
- [ ] `src/net/session.ts`, `src/net/protocol.ts`, `src/net/signal.ts` and `src/net/qr.ts` are
      unchanged except for `hostSession`'s new `refuse(peer)`, and all four still pass the
      `needs no browser` invariant.
- [ ] Nothing under `src/game/` changes. `hashState`, `SCOPE` and `NET_VERSION` are untouched.
- [ ] `openRoom()` takes its `joinRoom` as an injected default parameter, so `room.test.ts`
      drives a whole host/guest pair — join, seat, a numbered action, a peer leaving — against a
      fake room with no browser and no network.
- [ ] The room id carries `NET_VERSION`: two peers on different protocol versions cannot meet in
      the same room at all, rather than meeting and being turned away by `hello`.
- [ ] The room code is the room's Trystero `password`, so a relay operator carries session
      descriptions it cannot read.
- [ ] The code is drawn by `makeSeed()` from `src/game/rng.ts`. `Math.random` still has exactly
      one call site.
- [ ] A guest that joins a room whose open chairs are all taken is told so: the host answers
      `bye` through `hostSession.refuse(peer)` and the guest's status reads `dropped`, rather
      than sitting on "waiting for the host" for ever.
- [ ] `useGameLoop` is still the only `setTimeout` call site, and `src/net/room.ts` contains no
      timer of its own.
- [ ] Every new string is in `src/i18n/fi.ts` and `src/i18n/en.ts`, with matching placeholders.
      `i18n.test.ts` and `render.test.tsx` pass.
- [ ] `render.test.tsx` covers the lobby's three new states — the room-code entry, the host with
      a room open, and a guest waiting in a room — in both languages.
- [ ] A networked race is still never saved: `GameProvider`'s `if (net.live) return;` covers a
      room session exactly as it covers a manual one, because a room sets the same `role`.
- [ ] `npm run lint`, `npm run typecheck`, `npm run format` and `npm test` are green.
- [ ] The bundle cost is measured and written down, not estimated: build once with the `trystero`
      import stubbed and once with it live. Measured at **+60.8 kB raw, +22.0 kB gzipped**
      (382.0 → 442.8 kB, 121.4 → 143.4 kB gzipped).

## Assumptions

- **The room code is a name, not a secret handshake.** Anyone who has it can take an open chair,
  first come first served — the host does not approve arrivals. That matches the manual route,
  where anyone holding the invitation code can answer it.
- **Chairs are handed out in seat order as peers arrive.** The host cannot say "this code is for
  Raimo's chair"; the first peer to join gets the lowest-numbered open chair. Per-chair codes are
  what the manual route is for.
- **LAN only means less in a room than it does in the manual route.** A room's signalling always
  crosses public Nostr relays, so the switch only omits STUN. The lobby says so rather than
  implying a room can be private to one network.
- **Nostr, not MQTT or BitTorrent.** Chosen for relay uptime today. `src/net/room.ts` imports the
  bare `trystero` entry point, which is the Nostr strategy, so switching strategy later is one
  import line.
- **No reconnect, still.** A peer that drops mid-match ends the match, exactly as on the manual
  route. Trystero's `onPeerLeave` reaches `hostSession.leave`, which is the existing behaviour.

## Touch points

- `package.json` — `trystero` at `0.25.3`, exact.
- `src/net/room.ts` — **new.** The second effects file in `src/net/`, beside `rtc.ts`: it names
  `joinRoom` and nothing above it does. Exports `ROOM_APP_ID`, `roomIdFor(code)`,
  `openRoom(code, lan, ev, join?)` and a `Room` of `{ code, self, send, peers, close }`.
- `src/net/session.ts` — `HostSession.refuse(peer)`: send `bye`, drop the peer, report
  `dropped`. The one addition; the sequencer is untouched.
- `src/hooks/netContext.ts` — `Net` gains `room: string | null`, `openRoom(seat)` and
  `enterRoom(code)`; the no-op default gains all three.
- `src/hooks/useNetGame.ts` — the room's own `onPeer` / `onDrop` / `onMessage` wired to the
  existing `hostSession` / `guestSession`. A guest learns which peer is the host by whichever
  peer answers its `hello` with a `welcome`.
- `src/components/screens/Lobby.tsx` — a Room button beside Host game and Join game, a code box,
  and the host's own code to read out.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the new `lobby.room*` keys.
- `src/test/invariants.test.ts` — the one-importer clause.
- `src/net/room.test.ts` — **new.** A fake `joinRoom`, two sessions, a seated guest.
- `src/test/render.test.tsx` — the three new lobby states.
- `CLAUDE.md`, `docs/multiplayer.md`, `src/components/screens/Rules.tsx` — the transport section
  says two routes now, and that a room's relay is a third party.

## Out of scope

- Deleting or shrinking the manual paste/QR route. It stays whole, tests included.
- Reconnect, spectators, nicknames, an AFK timer.
- Hosting a main-game run across browsers. Still unreachable from any screen, as `CLAUDE.md`
  records.
- Filing a race row on a guest's board. `raceRowFor` reads `ownerTeam(g)`, so this is still the
  documented gap.
- TURN. A room that cannot traverse a NAT fails; nobody's TURN credentials go in the build.
