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
  desync from. `dehydrate` already produces the snapshot a reconnect would need.
- **No AFK timer** (copy the challenge's 60 seconds), **no nicknames**, **no spectator** — the
  last still needs an auto-advance path for the seven player-gated phases.
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
  a change of its own.
- **A hosted main-game run has one economy, and it is `ownerSeat(g)`'s** — the first human seat,
  which in a hosted game need not be the host. **It is unreachable rather than fixed**: nothing
  dispatches a hosted `newRun` any more, since the lobby starts a race, and `newRun`'s optional
  `seats` is parked for the increment that wants it back. Do not fix it by teaching the shop who
  is looking; that is `myEcon` coming back.
- **The live handshake is unverified.** The relay, the codec, the encoder and the lobby are all
  tested, and Chrome accepted a rebuilt offer and answer without complaint — but this environment's
  browser completes no ICE connection even for raw unpacked SDP, so nobody has yet watched two
  browsers actually play. `npm run dev`, two windows, **LAN only**, is the check.

**Stage 5 — a room code instead of a pasted invitation. Built, unverified live**
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
- `net.room`, `net.openRoom(seat)` and `net.enterRoom(code)` on the context; an Open a room button
  beside Host a game, a big spaced code to read out, and a one-line code box to type into.

Three things it deliberately does not do:

- **Name a chair.** One code for the whole table means the code cannot say which chair it is for,
  so arrivals fill the open chairs in seat order, first come first served. The manual route is the
  one that can promise a named chair, and that is now a reason it exists.
- **Make LAN only mean what it means on the manual route.** A room's signalling always crosses a
  public relay, so there the switch omits STUN and nothing more. The lobby and the rules panel
  both say so.
- **Replace the manual route.** It keeps its tests, its codec and its QR encoder, and it is the
  route with no third party on the network path.

**Unverified, and one step further out than stage 4's handshake.** The wiring is tested against a
relay with no network in it and the seating with no room at all, so what nobody has watched is a
browser joining a real Nostr relay from this code: relay reachability, the peer ids the mesh hands
out, and how long an arrival actually takes are all unmeasured. Two windows on `npm run dev`,
**Open a room** in one and the code typed into the other, is the check — and it is a better check
than the manual route's, because it needs no ICE connection to be provable up to the point the
relay hands over.

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
