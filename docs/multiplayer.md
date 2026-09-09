# Multiplayer: where it stands and what is left

A handoff, not a spec. The specs are in `docs/specs/`; this file says which of them have landed,
what was deliberately discarded on the way, and what the next person has to decide. Read it before
touching `g.seats`, `g.economies` or anything named `localSeat`.

## The mode being built

A **separate mode**, not a modifier on a run: two partnerships race to a target point total, and
the first pair across wins. The roguelike economy comes with it — money, chips, jokers, tuppipakka
and the tricks themselves all count. The ante ladder does not: no antes, no blinds, no bosses.

Four decisions were settled before any code was written, and they are settled. Reopen them only
with a reason, not from taste.

- **The wallet belongs to a seat.** Each player owns money, jokers, consumables and a side deck,
  and shops separately. The scoring side's wallet pays and is paid.
- **Any seat is human or AI**, decided by `g.seats`. That covers 2v2, mixed human/AI pairs, and an
  AI taking over a seat whose peer dropped. The AI already plays every seat, so this costs the
  engine nothing.
- **No bosses in the mode.** A debuff that hits both pairs is noise; one that hits a single pair is
  unfair. The two pools stay for the main game.
- **Transport is lockstep**, not authoritative: a shared seed plus relayed player actions, every
  peer running the same reducer. **Every peer can therefore read every hand** in devtools. That is
  accepted — it is a game to play with people you know — and the mode's own rules text must say so
  rather than implying otherwise. Cheat-proofing needs a server or mental poker, and neither is
  worth it here.

Signalling is somebody else's server by necessity (WebRTC cannot introduce two browsers by itself)
— Trystero over BitTorrent trackers or Nostr, the PeerJS cloud broker, or manual SDP paste for the
zero-infrastructure case. The GitHub Pages build stays static either way. "No backend" means no
backend of **ours**.

## What has landed, and must not be undone

Two changes are on `main`, and between them they are the whole foundation:

1. **The state is seat-absolute** (`docs/specs/2026-09-07-seat-absolute-game-state.md`). No seat-0
   assumption anywhere in `src/game/`: `tricks[team]` instead of `usTricks`/`themTricks`,
   `sameTeam(a, b)` instead of `isUs(p)`, every player action carrying the seat it acts for, and
   `g.seats` saying who is human. The **viewing seat is a React context**, never a field.
2. **The wallet belongs to a seat** (`docs/specs/2026-09-07-per-seat-economy.md`). `PlayerEconomy`
   holds the seventeen fields that used to be the run's, `g.economies` is four of them, and every
   pure function that needs one takes the seat and resolves it through `econOf(g, p)`.

CLAUDE.md carries the full rules for both. The short version of why the viewing seat is not in the
state: under lockstep, every peer's state has to be byte-identical, so "which seat am I" would be
the single field that differed — and the single field that could desync a replay. It is a property
of the window, not of the game.

`invariants.test.ts` holds both lines mechanically. It fails on a `GameState` field named `you`,
`viewSeat`, `self`, `me` or `mySeat`, on any file under `src/game/` importing the seat context, and
on the strings `myEcon`, `localSeat`, `seatKind`, `usTricks` and `themTricks` appearing anywhere
under `src/`. If one of those tests fails, the design is being undone — not the test being wrong.

**One trap worth naming.** `scoreTrick` reads the wallet of the side `scoresFor` picked, **not the
trick winner's**. In nolo and in sooli those are opposite — the game scores the tricks a side
_dodged_ — so handing it the winner's wallet would score an empty purse on every dodged trick. The
requirement as originally written said "the winner's"; it was wrong, and the build corrected it.
What guards the choice is a pair of cases in `scoring.test.ts` and `reducer.test.ts`. It is **not**
guarded by the golden in `seats.test.ts`, because `basicPolicy` never buys anything, so all four
wallets in a golden run are empty and indistinguishable. Do not cite the golden as proof of it.

## The seat picker landed too

`2026-09-07-multiplayer-seat-selection-lobby` is on `main` (PR #22). New Game opens a lobby that
seats the player at any of the four chairs; `newRun` carries an optional `seat`, `MenuView` gained
`"lobby"`, and the cast gained a fourth character (**Seija**) because seat 0 is no longer always
the player's. Nine catalogue strings stopped naming Veikko as your partner, since at three of the
four seats he is not.

That change is what first drove `g.seats` from the UI rather than from a test, so the two
refactors above are now exercised by a real player path. Two things in it matter to what comes
next:

- **`useSeatSync` is the single writer of the viewing seat**, and it fires only when the window is
  looking at a seat that is not `"human"` — repairing an impossible value rather than making a
  choice. `g.seats` is saved and the viewing seat cannot be, so a run started at seat 2 and then
  resumed would otherwise leave the window at seat 0, where every guard refuses and the deal never
  advances.
- **It was a single-human heuristic, and transport has now paid that debt.** With two humans on
  one board `ownerSeat` is the wrong answer for at least one window, so `useSeatSync(g, netSeat)`
  takes the chair the host assigned and prefers it outright; the repair path is untouched and
  still runs when no session is live. It is **still the one writer of the viewing seat** — the
  seat is handed _in_ rather than the transport being given a setter of its own.

A spectator or "table" role was deliberately refused there, for a mechanical reason worth
remembering: `nextTick` returns `null` for the seven player-gated phases, so a board with no
`"human"` seat **stalls on the first blind select and never deals a card**. Spectating is not "all
seats AI and hide the hands"; it needs an auto-advance path for every screen and every gated phase.
It belongs to transport, where there is another device for it to mirror.

**It has landed there** (`docs/specs/2026-09-08-shared-table-view-multiplayer.md`), and the refusal
above was not reversed to do it. A shared table's `g.seats` is the same seat table every peer has,
with the humans on the players' own devices; its own clock is dropped by the relay exactly as a
guest's is, and it advances only on the host's numbered actions. **A table is therefore reachable
only inside a live session and never offline** — an offline "spectate" button would be precisely
the stall described above, and a render case pins that no menu or lobby control reaches one.

## The `multiplayer-mode` branch is fully superseded — delete it, do not merge it

`origin/multiplayer-mode` (tip `2d5d996`, worktree `~/projects/tupatro-mp`) carries seven
increments of earlier multiplayer work. It is green and it was good work; it also solved the same
problem `main` now solves differently, because it merged `main` thirty-four minutes before the
seat-absolute change landed on it.

| increment                            | status                                         |
| ------------------------------------ | ---------------------------------------------- |
| 1 per-seat controllers               | superseded by `g.seats`                        |
| 2 input routed through `localSeat`   | superseded by actions carrying `p: Seat`       |
| 3 per-seat view                      | superseded by `SeatProvider` / `useViewSeat()` |
| 4 lobby and relative seat names      | reimplemented and merged (PR #22)              |
| 5 money per seat                     | ported as `PlayerEconomy`                      |
| 6 jokers and consumables per seat    | ported                                         |
| 7 side deck and shop config per seat | ported                                         |

Increments 5–7 were **reimplemented rather than cherry-picked**, on purpose: every hunk of them
touched a line `main` had since replaced, so a rebase would have conflicted end to end and skipped
the verification the pipeline gives. The data model in them is what `PlayerEconomy` is; credit for
the shape belongs there.

What must **not** come back with increment 4, and why:

- **`localSeat` on `GameState`** — it is the field that cannot exist under lockstep, per above.
- **`myEcon(g)`** — it resolved the wallet from the viewer, which made a card's chip value depend on
  which window was open. That is a desync generator, and it also reached into the pure core
  (`chipValue`, `scoring.ts`, `shop.ts`, `rules.ts`).
- **`seatKind`** — the same concept as `g.seats`, under a second name.
- **`usTricks` / `themTricks`** — replaced by `tricks[team]`.

Every one of the seven increments is now either superseded or reimplemented on `main`, so nothing
on that branch is still wanted. **Delete it.** A stale branch that looks like live multiplayer work
is a trap: the next person to find it may merge it whole and reintroduce all four banned names at
once. Its worktree at `~/projects/tupatro-mp` can go with it.

## Debts, most urgent first

1. **`startDeal`'s swap gate reads the owner's wallet while `pickSideCard` charges `action.p`'s,
   and `finishSwap` from any human seat runs the declarations for everyone.** Both are harmless
   while one seat is human and wrong the moment two are. They do not bite today because only the
   run owner has a side deck, so the `swap` phase is skipped outright for the others — but a
   hosted game with a second human and a bought tuppipakka would find them. Stage 3b's problem,
   recorded here so it is not discovered by a bug report.
2. **Three merged spec branches and two stale worktrees are still around**: `origin/spec/2026-09-07-per-seat-economy`,
   `...-multiplayer-seat-selection-lobby`, `...-drop-dead-save-upgrade`, and the worktrees at
   `~/projects/tupatro-sa` and `~/projects/tupatro-mp`. Housekeeping, but a merged branch that
   looks live is how the `multiplayer-mode` divergence started.

## What is left to build

**Stage 3 was one item and is now two.** It shipped shell-less, which reverses a decision written
at the top of this document — see the warning under 3b.

**Stage 3a — the race mode, and it has its network now. Delivered**
(`docs/specs/2026-09-07-race-to-target-mode.md`, then
`docs/specs/2026-09-08-race-starts-from-the-lobby.md`). It shipped local first — fully measurable
headlessly and playable hot-seat with no peer — and the second spec gave it the wire: the lobby's
chairs are what start it, so a race is played across browsers, at one screen, or against nothing
but the AI, and the same Start button does all three. It is a second `ChallengeId`
(`"race"`) rather than a mode field of its own, because `g.challenge` already means "an alternate
rule set with none of the roguelike shell" and every piece of machinery the race needs — parking
the main run, never writing `tupatro-run-v1`, a per-mode board key, the two-page rail, the Leave
button, the whole-state `startChallenge` — is already attached to it and already tested.

What landed: `RACE_TARGET = 12_000` in `constants.ts`, **measured** over two samples of 24,000
headless deals (median match: seven deals; the tables are in the README, which carries the
authoritative figures); `game/race.ts` with
`dealScores` / `matchOver` / `raceWinner`; `raceDeal`, `raceBase` and `raceScores` on `GameState`;
a `raceover` screen; a board of its own under `tupatro-race-v1`; `waitingSeat(g)` in `schedule.ts`;
and a seat map on `startChallenge`. **That map replaced a `humans: 1 | 2 | 3 | 4` count**, which
could only seat people clockwise from the run owner and so could not express two humans as
partners — nor a table a session picked. `startChallenge` now takes
`seats?: [SeatKind, SeatKind, SeatKind, SeatKind]` and refuses an all-AI table at runtime, seating
one human in the parked run's own chair, because the type can no longer refuse it.
Retired within the mode: `ante`, `blindIdx`, `beaten`, `blindDeals`, `dealsLeft`, the blind table,
victory at ante 10.

The wire needed three things the transport had shipped without, and each was a divergence waiting
rather than a feature:

- **`hashState` covers `seats`, `challenge`, `raceDeal` and `raceScores`.** `seats` is the sharpest
  of them: it decides whose clock ticks, so a peer that thinks a chair is AI runs a step the other
  peer never sends, and nothing would have noticed.
- **The relay stamps a missing seed.** `net.start()` sent `seed: undefined`, every peer called
  `normalizeSeed(undefined)` and each drew its own — a divergence on action number one. The
  wrapped dispatch fills it in once, on the window that clicked, and only while a session is live;
  offline the reducer still draws it and no dispatch site moved.
- **`ChairKind` gained `"hot"`.** A person at this screen was not expressible before, and without
  it the 1–4-people-at-one-screen race would have needed a browser connected to itself.

Two consequences that matter to stage 4:

- **`useSeatSync` now follows `waitingSeat(g)` on a multi-human board.** That is what makes hot
  seat work at all — the reducer refuses an action for a seat whose turn it is not — but it is
  still a **single-window** heuristic, not a per-window seat. **Replacing it with a per-window
  choice is still the first thing transport owes**, and the race is now the mode that will show
  the difference the moment two devices are involved.
- **There is no curtain.** Whoever is at the screen sees the hand of whoever is to play. That is
  consistent with the lockstep stance at the top of this document — every peer can read every hand
  — and the mode's rules text says so rather than implying otherwise.

**Stage 3c — Traditional Tuppi, the second thing the same chairs start. Delivered**
(`docs/specs/2026-09-08-traditional-tuppi-multiplayer-mode.md`). A third `ChallengeId` (`"tuppi"`)
beside the race, with `MatchId = "race" | "tuppi"` naming the pair of them: the same thirteen
tricks, the same declaration, sooli and _ryöstö_, scored by **tuppi's own point table** — four
points a trick from the seventh, a _ryöstö_ worth double, 24 for a sooli — and played to **52**.
The lobby's chair table gained a picker over the two, held on the net context beside the chair plan
(`net.match` / `net.setMatch`, default `"race"`), and `net.start()` stopped hardcoding
`id: "race"`.

**The transport did not change at all**, which was the point of building it this way: the mode
rides in the `id` field of a `startChallenge` the host already numbers and broadcasts, and `SCOPE`,
`hashState`, `parseMsg` and `guestMay` are byte-identical — `challenge`, `raceDeal` and
`raceScores` were already hashed. A guest has no picker and learns the mode from the host's
numbered action, the same route the seed and the seats take.

What landed: `TUPPI_TARGET = 52` in `constants.ts` (tuppi's number, **not** measured — what was
measured is the match length that falls out of it, a median of eight deals, in the README);
`game/points.ts` with `dealPoints`, a `Pick` of six fields and no wallet in sight; a third
`CHALLENGES` row and a `target` on all three, so `startChallenge` reads the target as data with no
id test left in it; and a board of its own under **`tupatro-tuppi-v1`**, a fifth key, because a
`RaceRow` fits both modes and a 52-point match filed on the race's board would be outranked by
every chip-scale row there.

One rule genuinely differs between the modes, deliberately: a **busted sooli** pays the declaring
pair 24 here and nobody in the main game or the race. `tuppiInfo` was not touched, so no existing
number moved; the rules panel and the README state which mode is which.

**Stage 3b — a race with the roguelike economy. Not built, and it owes a measurement.**

> **Warning: 3a deliberately reversed a decision written above.** "The mode being built" says the
> roguelike economy comes _with_ the race — money, chips, jokers, tuppipakka and the tricks
> themselves all counting. It does not. The delivered race has **no economy at all**: every seat's
> `PlayerEconomy` stays empty for the whole match, there is nothing to buy, and the bot needs no
> purchasing policy. **Do not implement a shop into the mode that shipped** — that is this stage,
> and it is a separate one.

Two things 3b must not guess:

- **A second target.** Adding an economy moves the deal-score distribution the 12,000 was measured
  against, so the number is a fresh measurement, not an inherited one.
- **The cash-out formula.** The blind reward and interest ladder it used to hang on is gone inside
  the mode. Payout proportional to deal score plus interest on the bank is the obvious starting
  shape, but it is a measurement, not an assumption.

The policy bot has to make the decisions the mode is about, or the measurement is worthless — the
side-deck lesson in CLAUDE.md, which measured a mechanic as harmful because the bot played it
badly. **A racing bot that never buys measures a race with no economy in it**, which is exactly
what `basicPolicy` measures today and exactly why 3a's figures are figures about a race with no
economy rather than about this one.

**Stage 4 — transport. Delivered** (`docs/specs/2026-09-08-webrtc-transport.md`). Ahead of stage
3, because a relay that carries `Action` carries whichever mode it is handed, and the race mode
was still a spec. What shipped:

- `src/net/protocol.ts` — `SCOPE`, a `Record<Action["type"], Scope>` over four scopes, so **a new
  action is a compile error until it is classified**. The race mode's actions will land there the
  day they exist. Also `hashState`, `parseMsg` (never throws, for any string) and `guestMay`, the
  host's whole admission test.
- `src/net/session.ts` — the relay. **The host is the sequencer and the clock**: it numbers every
  shared action, applies it once and broadcasts it; a guest's click is a request, a guest's clock
  is dropped by the classifier, and what moves a guest's state is only the numbered action coming
  back. That is why `useGameLoop` needed no change at all — one dispatch, swapped underneath it.
- `src/net/signal.ts` — the invitation, compacted from ~850 characters of SDP to a **430-character
  base64url code** by keeping the ufrag, the password, the fingerprint, the setup role and the
  candidates and rebuilding the rest.
- `src/net/qr.ts` — a hand-written QR encoder, byte mode, level L, versions 1–25, **no
  dependency**. It draws a link with the code in the fragment, so a phone's camera app opens the
  game with the box already filled.
- `src/net/rtc.ts` — the one file allowed to name `RTCPeerConnection`, checked by
  `invariants.test.ts` the way `storage.ts` is for `localStorage`.
- `hooks/useNetGame.ts` + `netContext.ts` + `useNet.ts`, `components/screens/Lobby.tsx` reworked
  into a host/join room, `components/net/{QrCode,NetBanner}.tsx`, and the menu's one Multiplayer
  door plus the `components/screens/Multi.tsx` view behind it, which holds Host a game, Join a
  game, Hang up and the session line.

Four boundaries hold it in place, all mechanical: `src/game/` may not import `src/net/`, `GameState`
may name no session field (`net` `peer` `peers` `conn` `channel` `session` `host`), the four pure
net modules touch no DOM and no React, and `useGameLoop` is **still the only `setTimeout` call
site** — ICE gathering is awaited by event, and where it never finishes the lobby offers the code
built from the candidates gathered so far.

What stage 4 did **not** do, and the next person owns:

- **No reconnect.** A dropped peer ends the game, and a peer that arrives after the first action
  was numbered is refused at the door with a `late` status rather than joining a game it would
  desync from. `dehydrate` already produces the snapshot a reconnect would need. **The shared
  table pays for that with its one real limitation**: it has to be connected before Start and
  cannot be plugged in at deal five. That is why the host's Start is disabled while the shared
  table's own invitation is still unanswered — the precondition is invisible, and a Start that
  said "everybody is here" while the display was still answering would lose the feature to one
  click, silently and for the whole match. **The answer that counts is the welcome, not the data
  channel, and that is true of every invitation the host builds** — no `onOpen` in `useNetGame.ts`
  writes a state any more. On the chairless link a device that answers and says `"player"` is
  refused with `nochair`, so a gate keyed on the channel would open with no display behind it; on a
  _chair's_ link the same shape ends worse, because a peer one `NET_VERSION` out of step opens the
  channel and is then refused with `bye` — and `hostSession` neither closes the link nor releases
  the chair, so `onClose` never fires. A chair left `"connected"` there is mapped to `"human"` by
  `seatsFor()`, which is a seat with nobody behind it and the stall `nextTick` has no way out of.
  `onGuest(peer, as, chair)` is what marks a chair connected, a chair `"table"`, or the shared
  table's block connected, and it is only ever called after a peer has been seated. **Once it has,
  the lobby stops offering that invitation, whichever thing answered it**: `settled(state)` in
  `Lobby.tsx` covers `"connected"` and `"table"` alike, so a chair a display claimed no longer
  draws a code, a QR and a Connect for a link whose peer is already here. Clicking that button
  handed a second answer to a stable connection, where `setRemoteDescription` rejects — `connect`
  reports that as the `"refused"` problem now instead of leaving an unhandled rejection and a
  silent host.
- **No AFK timer** (copy the challenge's 60 seconds) and **no nicknames**.
- **The spectator is built, and it is the shared table**
  (`docs/specs/2026-09-08-shared-table-view-multiplayer.md`). `NET_VERSION` went to `2` for it:
  `hello` carries `as: GuestRole` — `"player"` or `"table"` — and `welcome` may carry `seat: null`.
  Three independent layers keep such a peer read-only, and each is tested where it lives:
  `guestMay(a, null)` refuses **every** key of `SCOPE` at the host's door (a case iterates
  `Object.keys(SCOPE)`, because a null test written after the `flow` line would let Continue
  through), `guestSession` with `as: "table"` sends nothing but applies the numbered stream, and
  `MoveButton` draws no control that would move the game — which is why `<App />` on a table has
  no hand, no panel, no New game and no Continue. **The third layer reaches the start menu too**,
  because `leaveChallenge` is a `flow` action: the host clicking Back to your run on the result
  screen lands every peer on `menu: "start"` with the session still live, so `Menu`'s New game,
  `ChallengeOver`'s and `RaceOver`'s Back to your run and the rail kit page's three wallet buttons
  are `MoveButton`s as well, and the sweep in `render.test.tsx` has a
  `MenuView` dimension beside its `Screen`, `Phase` and `Modal` ones. `Challenges`' Play is a
  `MoveButton` too, but as defence in depth rather than as a live route: the only door to that list
  is `Menu`'s Challenges button, which is `disabled` while a session is live, so the sweep sets
  `menu: "challenges"` directly rather than clicking through.
  **Both routes into a session carry one, and the room is the one that matters** — it is how people
  actually join. A room's chair is set aside by the **hello** rather than by the arrival, since
  what arrives at a room is a device and the code cannot say what kind: `hostSeating`'s `claim`
  gives a `"player"` the lowest free chair and a `"table"` none, and hands the chair back when
  `hostSession` refuses the peer — which works because a refused peer is now removed from the
  broadcast set, as only `late` used to be. Two smaller things fell out of that: `guestSeating`
  greets on `session.welcomed()` and not on `session.seat()`, because a display's seat is null for
  the whole match and a seat test would hello the second arrival and be refused as `late`; and the
  host's room page fills the shared table's own line from the welcome, since a display in a room
  has no invitation of its own to report progress on. The code swap keeps its fifth connection and
  its **Invite a shared table too** switch, which is the route that can promise a named chair and
  so the route that has to reserve nothing for the display.
  What it is **not**: not a second table (one line, one invitation, and nothing iterates), not a
  layout for a television, and not a curtain on anybody's own device — lockstep still means every
  peer holds every hand, the table included, which is exactly why it draws none of them.
- **No TURN**, and no automatic signalling. Two players behind symmetric NATs have LAN only or
  another network.
- **Tuppi-Rummikub cannot be started from inside a session**, and the menu's button is still
  disabled while one is live. It is dispatched with no seat table at all and so builds the
  single-human board it has always had: a guest's chair would come back `"ai"` and every dispatch
  from it would be silently refused. The race no longer needs that door — the lobby's chairs are
  what seat it — so what is left here is a multi-human laydown, which is untested territory and a
  measurement of its own. **This was the "first thing to fix if the race is to be played over the
  wire", and it is fixed for the race.**
- **A networked race files no row on any browser's board.** `GameProvider` returns before the
  board writes while a session is live, and moving that guard is not enough: `raceRowFor` reads
  `ownerTeam(g)`, so every peer would file the run owner's pair's result and a guest on the losing
  pair would record a win. It needs the window's own seat inside a pure scores function, which is
  a change of its own. **`net.live` alone does not hold that line at the end of a match**: the
  shared table's Leave hangs up and raises the start menu, the menu covers the `raceover` screen
  rather than replacing it, and the save effect then runs again with the session gone. The
  challenge branch returns while `state.menu` is set for exactly that, and
  `GameContext.test.tsx` watches a whole match and then leaves it to pin the empty board.
- **A hosted main-game run has one economy, and it is `ownerSeat(g)`'s** — the first human seat,
  which in a hosted game need not be the host. **It is reachable, and calling it unreachable was
  wrong.** The lobby starts a race, but the lobby is not the only door: `newRun` is a `flow`
  action, and the rail's New game button (start menu → New game → the restart confirmation) and
  the rail's seed chip (the seed dialog's two buttons) both reach one from inside a live session,
  where the host numbers and broadcasts it. Every peer then builds a main-game run from the one
  seed, and only `ownerSeat(g)`'s wallet is filled. What has been fixed is the shared table's
  half: the rail kit page's sell and use buttons are `MoveButton`s, so a display watching such a
  run still cannot spend anything, and `Tally` — that rail's one plate that names a side — drops
  "Me" / "He" for the two pairs' characters while spectating, since a screen reachable from a
  session may not be labelled from a chair's point of view. **That run's result screens are not
  fixed**: `MainDealEnd`'s `why.ramiShort` / `why.noloBust` and `GameOver`'s `over.title` /
  `over.ramiShort` / `over.noloBust` are written in the second person, and their numbers are the
  viewing seat's team's with nothing saying whose, so a display watching such a run to its end is
  told it was put in the sheath about a pair it has no relation to. Neutralising them is a second
  set of catalogue lines for the main game, and it belongs with the economy below rather than
  half-done here. The economy itself is unfixed, and `newRun`'s optional `seats`
  is still parked for the increment that wants a hosted main-game run properly. Do not fix it by
  teaching the shop who is looking; that is `myEcon` coming back.
- **The handshake connects, and the network it crosses is what is unmeasured.** Two windows on
  `npm run dev` have played a match through the code swap, so the codec, the QR encoder and the
  sequencer have been seen to work end to end and not only in tests. What that check did not
  produce is a figure or a second network: how long the exchange takes is untimed, NAT traversal
  between two networks and TURN-less failure on a symmetric NAT stay unproven, and the **LAN only**
  switch has not been measured either way.

**Stage 5 — a room code instead of a pasted invitation. Built and played**
(`docs/specs/2026-09-08-trystero-rooms.md`). The manual route works and nobody will use it: two
players moving a 430-character code and a 430-character answer between themselves, per chair, is
four exchanges for a full table. A room is one code, read out loud.

[Trystero](https://github.com/dmotz/trystero) carries the introductions, pinned at **`0.25.3`**
over its default **Nostr** strategy. What it changed above the door is nothing: a Trystero room
already speaks in the shape `SessionDeps` wants — a peer id, a `send(peer, text)` and a message
stream — so `session.ts`, `protocol.ts` and `hashState` are untouched, and the whole of the
sequencer, the admission test and the hash comparison work for a room exactly as they do for a
pasted code. **The two routes end in the same `role`**; `net.room` is the only thing the lobby
branches on.

What landed:

- `src/net/room.ts` — the door, and **the only file that imports `trystero`**, checked by
  `invariants.test.ts` beside the `RTCPeerConnection` clause. `roomIdFor` puts `NET_VERSION` in
  the room id, so two protocol versions cannot meet at all; the code is handed over as Trystero's
  `password`, so a relay carries session descriptions it cannot read.
- `src/net/seating.ts` — the decisions, in the fifth browser-free net module: an arrival takes the
  lowest free open chair, a full table answers `bye` through `hostSession.refuse` rather than
  leaving a guest waiting for a welcome, and a guest works out which peer is the host from the
  first message it receives, because the relay is a star and no guest ever messages another. It
  also greets a new peer **only while it has no seat** — a second `hello` after the first action
  is numbered is what the host refuses as `late`, and it would cost a seated guest its chair.
- `hostSession.refuse(peer)` — the one addition to the relay.
- `net.room`, `net.openRoom(seat)` and `net.enterRoom(code, as)` on the context; an Open a room button
  on the chair table, a big spaced code to read out, and a one-line code box to type into.
  `docs/specs/2026-09-08-separate-multiplayer-connection-routes.md` then made the room the way to
  connect and moved the pasted route one level down, behind **Other ways to connect**, where it is
  named the **code swap** — the whole change is `Lobby.tsx`, the catalogue and the stylesheet, and
  nothing under `src/net/`.

Three things it deliberately does not do:

- **Name a chair.** One code for the whole table means the code cannot say which chair it is for,
  so arrivals fill the open chairs in seat order, first come first served. The manual route is the
  one that can promise a named chair, and that is now a reason it exists.
- **Make LAN only mean what it means on the manual route.** A room's signalling always crosses a
  public relay, so there the switch omits STUN and nothing more. It is drawn on the code swap's
  own page alone now, so no room page carries the switch or a caption about it, and the **rules
  panel** is what says the switch belongs to the code swap — the lobby no longer says it
  anywhere. Drawn there is not scoped there: `net.lan` is window state that `openRoom` /
  `enterRoom` still read, so a player who ticks it and walks back opens a room with STUN omitted
  and nothing on screen saying so. Scoping the flag to its route is a `useNetGame` change and is
  not made.
- **Replace the manual route.** It keeps its tests, its codec and its QR encoder, and it is the
  route with no third party on the network path.

**Played, and bounded exactly as stage 4 is.** Two windows on `npm run dev` — **Open a room** in
one and the code typed into the other — have joined a real Nostr relay and played a match, so
relay reachability and the peer ids the mesh hands out are no longer only tested against a relay
with no network in it. What that leaves unmeasured is the same two things: **how long an arrival
takes** was not timed, and nothing has been run across **two networks**, so NAT traversal and
TURN-less failure on a symmetric NAT stay unproven. A relay unreachable from a given network is
still ordinary failure, silent, with no diagnosis in the UI — which is what the room page's way
out to the code swap is for.

## How work enters, and two things that will bite

`/req "the requirement"` — spec, recon, build, audit, playtest, balance, mutation, fix, push. It
branches `spec/<date>-<slug>` off `origin/main` first and never commits to `main`. `--quick` skips
verification for a diff you will read yourself, and escalates itself back to the full pipeline if
the spec turns out to be `kind: rule` or `kind: scoring`.

- **The pipeline does not commit its own harness.** It commits `src/`, the spec, CLAUDE.md and
  README. An edit to `.claude/workflows/deliver.js` made during a run is not in the resulting PR,
  and is lost at the merge. Commit harness fixes separately.
- **A stage that returns badly kills the whole run.** The recon stage once called
  `StructuredOutput({input: "<json string>"})` five times instead of passing fields at the top
  level, and five schema failures abort the workflow. `LAW` in `deliver.js` now spells the call
  shape out for every agent; keep it there.

Gates, all of which CI also runs: `npm test`, `npm run typecheck`, `npm run lint`,
`npx prettier --check`, `npm run build`. Vitest does not type-check, so `npm test` alone cannot see
a missing `Screen` kind — the compiler is the gate for that.
