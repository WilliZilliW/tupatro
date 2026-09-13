# Multiplayer: where it stands, and what is left

Two browsers play the same game by running the same reducer over the same ordered stream of
actions from the same seed. There is no server of ours: `src/net/` carries the actions over
WebRTC, the host numbers them, and every peer applies what it is handed. The architecture of that
relay is described in [CLAUDE.md](../CLAUDE.md); this file is the player-visible shape of it and
the one limitation that is deliberately unbuilt.

## One door: the lobby

Every game is configured in one place. **New game** on the start menu opens the lobby, **Join a
game** opens the same lobby from the guest's side, and there is no Multiplayer view between the
menu and either of them. The lobby holds:

- **Four chairs.** Each one is you, a person in another browser, or the game. The table opens on
  the plan a single-player run has always had — you at your own chair, the game at the other three
  — so leaving it alone and clicking Start is a solo run in two clicks.
- **A mode picker with three entries**: the solo roguelike, the Tuppi Race and Traditional Tuppi.
  The roguelike is a game for one — one wallet, at the run's owner seat, and result screens written
  in the second person — so it is drawn `disabled` with that reason the moment anybody else is
  connected, and the lobby's Start refuses it in the handler as well as on the button.
- **Hosting, joining and Hang up.** A room's eight characters, the code swap one level down under
  _Other ways to connect_, and Hang up wherever a session is live — on the host, a guest and the
  shared table alike.

Start is the one site that turns the chairs and the picker into an action: `newRun` for the
roguelike, `startChallenge` for the two match modes, each carrying the chair plan as `seats`. The
roguelike's Start raises the restart confirmation when there is a run to lose, because `newRun`
destroys the run a challenge merely parks.

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

## Known limitations

- No reconnect, no late join, no catch-up replay, no AFK timer.
- **A departure is announced in one direction only.** The host leaving closes every link and every
  peer raises `dropped`. A guest leaving reaches the host in a room; on the code swap the host's
  chair goes to `"failed"` and the other guests hear nothing, because the relay is a star and no
  `bye` is broadcast.
- **Every peer holds every hand**, in devtools, because there is no server. It is a game to play
  with people you know, and the rules panel says so.
- A networked run is never saved and files no board row.
- A hosted main-game roguelike is refused rather than half-built: one economy at the run owner's
  seat, and second-person strings on its result screens.
