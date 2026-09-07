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

## In flight: the seat-selection lobby

`origin/spec/2026-09-07-multiplayer-seat-selection-lobby` (Santtu Seppänen) is **finished, green
and waiting on review** — 831 tests, typecheck, lint and Prettier all clean, and it merges into
`main` with no conflicts. **Do not start this work; it is done.** Its spec is committed on the
branch.

It is `multiplayer-mode`'s increment 4 rebuilt on the current model, and it does more than that
increment did: New Game opens a lobby that seats the player at any of the four chairs, `newRun`
gains an optional `seat`, `MenuView` gains `"lobby"`, and the cast gains a fourth character
(**Seija**) because seat 0 is no longer always the player. `SEATS[0]` losing `key: "seat.you"` is
what the seat-absolute spec listed as its own follow-up.

It respects both foundations: no viewing seat on `GameState`, and both invariant cases untouched.
The viewing seat gets exactly one writer, `useSeatSync`, and it fires only when the window is
looking at a seat that is not `"human"` — repairing an impossible value rather than making a
choice. `g.seats` is saved and the viewing seat cannot be, so a run started at seat 2 and then
resumed would otherwise leave the window at seat 0, where every guard refuses and the deal never
advances.

Three things a reviewer has to decide rather than check:

- **It does not deliver issue #20** and says so. That issue wants a device joining as a shared
  table display; this has no transport, no peer and no second device.
- **A spectator role was refused for a mechanical reason.** `nextTick` returns `null` for the seven
  player-gated phases, so a board with no `"human"` seat stalls on the first blind select and never
  deals. Spectating needs an auto-advance path for every screen, which is a larger surface than the
  lobby. Deferred to transport, correctly.
- **It reverses two delivered criteria** of the start-menu spec: New Game and `RestartConfirm`'s
  confirm no longer dispatch `newRun` themselves, only the lobby's Start does. The spec flags this
  as a reversal rather than letting it pass as an accident.

Its ceiling is named in its own code: `useSeatSync` is a single-human heuristic, and with two
humans on one board `ownerSeat` is the wrong answer for at least one window. The transport
increment has to replace it with a per-window choice.

## The `multiplayer-mode` branch is superseded — read this before merging it

`origin/multiplayer-mode` (tip `2d5d996`, worktree `~/projects/tupatro-mp`) carries seven
increments of earlier multiplayer work. It is green and it was good work; it also solved the same
problem `main` now solves differently, because it merged `main` thirty-four minutes before the
seat-absolute change landed on it.

| increment                            | status                                         |
| ------------------------------------ | ---------------------------------------------- |
| 1 per-seat controllers               | superseded by `g.seats`                        |
| 2 input routed through `localSeat`   | superseded by actions carrying `p: Seat`       |
| 3 per-seat view                      | superseded by `SeatProvider` / `useViewSeat()` |
| **4 lobby and relative seat names**  | **reimplemented — see the branch in flight**   |
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

So: port increment 4's lobby and relative seat naming onto the current model, then **delete the
branch**. A stale branch that looks like live multiplayer work is a trap — the next person to find
it may merge it whole and reintroduce all four names at once.

## Debts, most urgent first

1. **`startChallenge` discards the run's seating — already fixed on the lobby branch.** On `main`
   it builds from `createRun(seed, prev.bestAnte)` and never carries `prev.seats`, so a challenge
   entered from a run seated anywhere but 0 is played at seat 0. Latent only while nothing writes
   `g.seats` — and the lobby is the first thing that does, which is why that branch fixes it in the
   same change, passing `ownerSeat(prev)` into `createRun`. Nothing to do here beyond merging it.
2. **`startDeal`'s swap gate reads the owner's wallet while `pickSideCard` charges `action.p`'s.**
   Identical while one seat is human, a divergence the moment a second one is — so it is really a
   stage-3 item, listed here so it is not discovered by a bug report.

Neither is work for `main`: 1 comes with the lobby merge and 2 belongs to stage 3. What used to
head this list — deleting `upgradeV2` and dropping the unread `ScoreContext.lostBefore` — is done,
and the stale README test count with it.

## What is left to build

**Stage 3 — the race mode, local and against the AI.** Everything except the network, which means
it is fully measurable headlessly and playable hotseat before any peer exists. New: a target, pair
totals, the win test, the mode's screens and its rules text. Retired within the mode: `ante`,
`blindIdx`, `beaten`, `blindDeals`, the blind table, victory at ante 10.

Two things it must not guess:

- **The target number.** There is no ante ladder to inherit one from, so it comes out of a
  measurement: `playRun` over seeded runs, deal-score distribution, target chosen from it. Balance
  is never guessed in this project.
- **The cash-out formula.** Same reason — the blind reward and interest ladder it used to hang on
  is gone inside the mode. Payout proportional to deal score plus interest on the bank is the
  obvious starting shape, but it is a measurement, not an assumption.

The policy bot has to make the decisions the mode is about, or the measurement is worthless — the
side-deck lesson in CLAUDE.md, which measured a mechanic as harmful because the bot played it
badly. A racing bot that never buys measures a race with no economy in it.

**Stage 4 — transport.** `hooks/useNetGame.ts` beside `useGameLoop`, a lobby, seat assignment, the
action relay, and a desync hash — hash `rngState`, `uidSeq` and the trick each trick and compare,
because a divergence caught late is unattributable. Then reconnect from a `dehydrate` snapshot,
the AFK timer (the challenge's 60-second turn already exists to copy), and nicknames.

Transport stays last deliberately. It is the only stage that cannot be verified headlessly, and a
race mode people can play hotseat is worth having before a network is added to it.

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
