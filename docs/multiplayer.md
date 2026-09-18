# Multiplayer: where it stands, and what is left

Two browsers play the same game by running the same reducer over the same ordered stream of
actions from the same seed. There is no server of ours: `src/net/` carries the actions over
WebRTC, the host numbers them, and every peer applies what it is handed. The architecture of that
relay is described in [CLAUDE.md](../CLAUDE.md); this file is the player-visible shape of it and
the one limitation that is deliberately unbuilt.

## One door: the lobby

A game with other people is configured in one place. **Multiplayer** on the start menu opens the
lobby, and the lobby's own **Join a game** opens it from the guest's side. The start menu's other
door, **Single player**, leads nowhere near it: everything played against nobody but the game lives
behind that one, and while a session is live it asks before it opens — a **hang up multiplayer?**
confirmation, since going through it ends this window's session. The lobby holds:

- **Four chairs.** Each one is you, a person in another browser, or the game. The table opens with
  you at your own chair and the game at the other three, so a chair is only ever handed out on
  purpose.
- **A mode picker with three entries**: the Tuppi Race, Traditional Tuppi and Tupatro — the same
  traditional deal with one thing added, a one-shot trick card (temppu) drawn for each seat every
  deal. The roguelike is not among them and cannot be — it is a game for one, one wallet at the
  run's owner seat and result screens written in the second person, so it lives behind Single
  player and `net.match` is typed `MatchId` rather than filtered. Tupatro's own temput are the
  first piece of the roguelike economy a match mode has: everything else of it — money, the shop,
  jokers, vouchers, the tuppipakka, blinds, bosses, cash-out — stays unbuilt for every match mode,
  Tupatro included, exactly as the roguelike economy this file's Known limitations section
  describes below.
- **Hosting, joining and Hang up.** A room's eight characters, the code swap one level down under
  _Other ways to connect_, and Hang up wherever a session is live — on the host, a guest and the
  shared table alike.

- **An honest count of who is in the room.** The room host page reports how many players other
  than the host have been admitted, in every state, and a room of one is never described as
  "Everyone is here." — that sentence waits for somebody else. Starting alone stays the host's to
  choose and Start is not gated on a second peer; it simply says **Start alone** and states the
  consequence, because the first numbered action locks the room for the rest of the match. A
  welcomed shared display is not counted as a player: it holds no chair and has its own line.
  `net.canStart` answers seating only — every admitted player holds a chair — and the host is in
  its own roster, so it can never answer whether anybody else is here.

Start is the one site that turns the chairs and the picker into an action, and it sends exactly
one: `startChallenge` for whichever of the three match modes the picker holds, carrying the chair
plan as `seats`. There is no roguelike branch left to take — `net.match` is typed `MatchId`, so
`"run"` is a compile error rather than an option the lobby filters out — and the restart
confirmation left with it, back to the destructive click it belongs to: the new-run button on the
single-player screen, which is the one place `newRun` is dispatched from a menu.

## Nobody joins a match already under way

**Every player and the shared table has to be connected before Start.** This is not a missing
feature that will appear by itself; it falls out of three decisions in the session model, and each
of them is in the source:

1. **`hostSession.receive`'s `hello` case refuses any peer once `seq.n > 0`** (`src/net/session.ts`).
   It replies `bye`, drops the peer and raises `late`. The numbered stream starts at 1, and a peer
   that missed part of it would desync on its first applied action.
2. **No action log is kept.** `sequence()` applies, broadcasts and forgets. Neither the host nor
   `useNetGame` retains the ordered actions, so there is nothing to catch a latecomer up with.
3. **A guest's stream begins at action one.** `guestSession.receive`'s `act` case requires
   `m.n === stream.next`, starting at 1, and stops on the first gap. A window handed action 400 as
   its first message reports `desync` and applies nothing.

There is also no reconnect: a device that drops is out for the rest of the match.

**What a later increment would need**, if late joining is ever built: a retained ordered log on the
host (or a state snapshot) with a decided memory bound, a new `NetMsg` to carry it, `parseMsg`
validation for that message, guest-side stream repositioning, and a `NET_VERSION` bump. It also
needs a measurement nobody has taken — several thousand replayed dispatches through React on the
joining window. That is a transport increment with its own spec, and bundling it with a screen
change would put a protocol change and a menu change in one pull request.

**What ships in its place**, and it is honest rather than complete:

- **The room's code stays on screen while the game is played.** `NetBanner` draws `net.room` as
  text while a session is live, so a latecomer can read it off any window — over the felt and over
  a result screen alike, since the banner is the one element outside `.overlay`. The code is for
  the _next_ match. The code-swap route has no room code, and then the banner draws nothing extra.
- **A window refused at the door is told which door refused it.** `SessionStatus` has a `refused`
  member: a `bye` arriving before `guestSession`'s `welcomed()` is the host saying no, and one
  arriving after it is a session that ended. The banner says the host refused the connection and
  names an already-started match as the likeliest reason, in place of "The link dropped."

## The shared table

A peer may hold no chair at all. It types the room code like everybody else and says **Shared
table**, or it answers the chairless invitation the code swap builds for every host. It draws the
felt, the trick and the score, and nothing that belongs to one player: `guestMay` refuses every
action for a seat-less peer, `guestSession` with `as: "table"` sends nothing, and `MoveButton`
draws no control that would move the game. In the lobby it sees no Start, no chair controls and no
mode picker — there is nothing for it to configure.

One table per session, and the same precondition as everybody else: connected before Start.

**A player's own device notices, and draws less while a table is watching.** The host broadcasts a
new message, `{ t: "table", on }`, the moment a display is welcomed or leaves — and once more after
every later welcome, so a player admitted after the display still hears it — which is the wire
change that took `NET_VERSION` to **8**: a v7 host never sends it, so a v8 build would otherwise sit
on the full felt for a match a display is already showing, with no way to learn better. Every
window that holds a chair reads the fact as `net.tableHere`, a property of the session exactly like
the role and the viewing seat, and never of `GameState`. While it is true and the window is not
itself the shared table, `App.tsx` swaps the felt for a small private zone — the declaration box,
the phase's decision panel, and nothing else — above the player's own hand, sort tools and hint
line, which stay exactly where they are. The rail, the wallet, the shop and the overlay screens are
untouched. A bar of the zone's own carries a window-local toggle to bring the board back on that
one screen; it dispatches nothing, is not remembered, and reads no differently from a curtain over
the felt — every peer still holds every hand, in devtools, exactly as before.

`NET_VERSION` has moved twice since: **9** added Tupatro as a fourth challenge id, which an older
peer's `parseMsg` would otherwise accept without complaint and then run main-game rules against;
**10** is the current version, for the ♣K's own effect in Tupatro (Ikiliikkuja — see the README's
Tupatro section) drawing a card an older peer's reducer does not know to draw. Neither bump changed
a message shape; both are reducer-rule bumps of the kind this file's `NET_VERSION` line has moved
for before.

## Known limitations

- No reconnect, no late join, no catch-up replay, no AFK timer.
- **A departure is announced in one direction only.** The host leaving closes every link and every
  peer raises `dropped`. A guest leaving reaches the host in a room; on the code swap the host's
  chair goes to `"failed"` and the other guests hear nothing, because the relay is a star and no
  `bye` is broadcast.
- **Every peer holds every hand**, in devtools, because there is no server. It is a game to play
  with people you know, and the rules panel says so.
- A networked run is never saved and files no board row.
- **A hosted main-game roguelike is not offered, but it is still reachable**, and saying otherwise
  would be saying something false. The lobby cannot start one, and the start menu's Single player
  door now hangs the session up before it opens rather than refusing outright — so the way in
  without leaving the session is still the rail's **seed chip**: `newRun` is a `flow` action, so
  the confirmation inside `SeedDialog` puts every peer into a roguelike run with one economy at
  the run owner's seat and second-person strings on its result screens. What is guarded is the
  consequence rather than the door — every rail control that would spend that wallet is a
  `MoveButton`, so a shared table stays read-only — and the result screens are the part still
  open.
