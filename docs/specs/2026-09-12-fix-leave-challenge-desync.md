---
id: 2026-09-12-fix-leave-challenge-desync
title: Make leaving a challenge or match a per-window decision that also leaves the session
kind: ui
status: proposed
---

# Make leaving a challenge or match a per-window decision that also leaves the session

## What

Today **Back to your run** silently splits a live session into two unrelated games. `leaveChallenge`
is classified `flow` in `SCOPE`, so the host numbers it and broadcasts it, and then every peer
resolves it **against its own state**: `leaveChallenge(prev)` returns
`rehydrate(prev.parked) ?? createRun(undefined, prev.bestAnte)`, and `parked` is each window's own
private roguelike — or, with nothing parked, a fresh `makeSeed()`. A host booted from `HOSTRUN` and
a guest booted from `GUESTRUN` end up on two different seeds from one broadcast action, and
`hashState` disagrees from that instant. Filed as GitHub issue
[#30](https://github.com/santtu-seppanen/tupatro/issues/30).

**Nothing tells anybody.** `hashing.due` is set only by `endTrick`, so `localHash` reports nothing
until the next trick resolves — and after the leave both peers sit on `menu: "start"`, where
`nextTick` returns `null` (`src/game/schedule.ts:22`), so no further trick ever resolves. The
`desync` banner the transport was built around is never raised. The session stays "live" with each
peer playing a different game.

After this change, leaving a challenge or a match is what it always actually was: **a decision by
one window about its own private parked run**. `leaveChallenge` becomes a `local` action, so it is
never broadcast and never resolved twice, and the two result screens that offer it **hang the
session up in the same click** — a window that has gone back to its own roguelike is no longer a
peer, and leaving it sequencing its own run's ticks into peers still sitting in the race would be
worse than the bug. The peers left behind leave the same way; whether they are _told_ is the
relay's pre-existing asymmetry, set out in the Assumptions below and left where it was.
`Play again` and `Replay seed` are unchanged and remain the paths that keep the table together.

## Prior specs this changes

- **Reverses an Assumption of
  [`2026-09-08-multiplayer-behind-one-door`](2026-09-08-multiplayer-behind-one-door.md).** That spec
  wrote: "`leaveChallenge` stays `flow`, so over a live session Back to your run takes every peer
  out of the race, and each peer then restores its own parked run — or `createRun(undefined)`, which
  draws its own seed. The peers' hashes differ from that moment and **the banner may say they have
  drifted apart**." The reading in this spec wins, and the last clause of that one was **factually
  wrong**: the banner cannot say so, for the mechanical reason above. That spec also put "hanging up
  automatically … when `leaveChallenge` is dispatched" under **Out of scope**; this spec does exactly
  that, deliberately, and a reviewer must see the reversal rather than discover it.
- **Decides the question [`2026-09-08-race-starts-from-the-lobby`](2026-09-08-race-starts-from-the-lobby.md)
  parked**: "`leaveChallenge` staying `flow`: any human's Leave still ends the match for everybody.
  Making it a per-seat concession is a separate decision." This is that decision, and the answer is
  neither of the two it imagined: leaving is per **window**, and the window that leaves leaves the
  session, so the match does end for everybody — through a hang-up, honestly, rather than through a
  broadcast that resolves differently on every peer. Whether the peers left behind are _told_ so
  depends on who clicked: the `dropped` banner everywhere when the host goes, and on a guest's
  departure the host's own banner in a room and nothing anywhere else. That asymmetry is the
  relay's and is left exactly where it was; the Assumptions below set it out in full.
- **Depends on [`2026-09-09-start-menu-solo-run`](2026-09-09-start-menu-solo-run.md) and changes
  nothing in it.** `Menu`'s Continue is the third `leaveChallenge` site and is `disabled={net.live}`,
  so it cannot be clicked inside a session and needs no hang-up. That `disabled` is now load-bearing
  for this fix as well as for that spec's scope rule.
- **Overlaps [`2026-09-08-shared-table-view-multiplayer`](2026-09-08-shared-table-view-multiplayer.md)
  in one sharp place.** Its table sweep filters clicks through `onlyLocal`, i.e.
  `SCOPE[type] !== "local"`, so reclassifying this action would silently drop it out of what that
  sweep checks. Scoped in here: the table's read-only guarantee for this button is re-asserted by
  **name**, not through the scope filter. Everything else about the shared table is out of scope.
- **[`2026-09-08-webrtc-transport`](2026-09-08-webrtc-transport.md)'s `flow` list** (its line 81)
  names `leaveChallenge`; that list is historical from this spec onwards.
- **The reducer's own contract from
  [`2026-09-06-tuppi-rummikub-challenge`](2026-09-06-tuppi-rummikub-challenge.md) is untouched.**
  `leaveChallenge(prev)` keeps its delivered body, `parked` keeps its meaning, and `SAVE_VERSION`
  does not move.

## Acceptance criteria

- [ ] `SCOPE.leaveChallenge` is `"local"` in `src/net/protocol.ts`, and `protocol.test.ts`'s scope
      lists follow: `of("local")` is the ten names and `of("flow")` the seven
      (`newRun` `startBlind` `skipBlind` `startChallenge` `nextDeal` `toShop` `nextBlind`). The
      "classifies every action exactly once" case still passes, and `guestMay` needs no change —
      a `local` scope already falls through to `false`, so a `req` carrying this action is ignored.
- [ ] `NET_VERSION` is `5` in `src/net/protocol.ts`, and its comment says why a bump is needed with
      an unchanged wire shape: a v4 host still broadcasts a numbered `leaveChallenge` that a v5 peer
      would apply — the bug itself — and a v4 guest's `req` is now ignored, leaving it stuck on the
      result screen. `grep -n "NET_VERSION\|\"T4\|-v4-" src/net/` shows the constant only, with no
      second literal: `signal.ts`'s code prefix and `roomIdFor`'s room id derive from it.
- [ ] A new case in `src/net/session.test.ts` wires a host and **two** guests over the relay, each
      booted from a different seed and a different `parked`, puts all three into one race with a
      single numbered `startChallenge`, and then calls `intent({ type: "leaveChallenge" })` on guest
      A. Asserted: no message left guest A (`sent.toHost` unchanged), `host.count()` did not advance,
      and `hashState(host)` and `hashState(guestB)` are **equal to each other and unchanged from
      before the leave**. Guest A's own state is the parked run it had, which is why the three hashes
      cannot all be equal.
      The host's mirror is asserted in the same case: `host.intent({ type: "leaveChallenge" })`
      applies locally, sequences nothing, sends no `act` to either guest, and leaves both guests'
      hashes where they were.
- [ ] A case in the same file pins the bug this replaces, so the fix cannot be quietly undone: the
      same action applied **directly through `gameReducer`** to two peers whose `parked` differs
      produces two different `hashState`s, and no `desync` status is raised afterwards
      (`status.host` contains no `desync`) because nothing sets `hashing.due` once both peers sit on
      `menu: "start"`. Both halves are asserted — the divergence and the silence.
- [ ] `protocol.test.ts`'s "a local action" block keeps its nine delivered cases asserting the hash
      does not move, and adds `leaveChallenge` as **one named exception in a literal list of one**:
      a case asserts `scopeOf` is `"local"` and that the hash **does** move (so the exception is not
      vacuous), and a case asserts the exception list has length 1, so a second exception is a test
      failure rather than a precedent.
- [ ] `src/components/screens/RaceOver.tsx` and `src/components/screens/ChallengeOver.tsx`: Back to
      your run calls `net.hangUp()` when `net.live` and then dispatches `{ type: "leaveChallenge" }`.
      **Offline it is unchanged** — `render.test.tsx`'s delivered case "gives the parked run back
      from %s" passes verbatim, `dispatch` called exactly once and `net.hangUp` not at all.
- [ ] A new render case, both locales and both result screens: with
      `stubNet({ role: "host", live: true, status: "live", seat: 0 })`, one click on Back to your run
      calls `net.hangUp` exactly once and dispatches `leaveChallenge` exactly once — and dispatches
      no `showMenu`, `newRun` or `startChallenge`.
- [ ] The shared table still draws no such button, asserted by **name**: a case renders both result
      screens on a `watching()` window and finds no button whose label is `btn.backToRun`, and
      `net.hangUp` uncalled after `clickEverything`. This does not go through `onlyLocal`, which now
      filters this action away.
- [ ] `src/components/screens/Menu.tsx` is unchanged: Continue still dispatches `leaveChallenge`
      then `closeMenu` and stays `disabled={net.live}`, `Menu.test.tsx`'s
      `[{ type: "leaveChallenge" }]` expectation passes verbatim, and the file is **not** a
      `net.hangUp` site.
- [ ] `src/test/invariants.test.ts`: the `leaveChallenge` site list is still the same three files,
      and the `net.hangUp` site list grows to five — `src/components/net/NetBanner.tsx`,
      `src/components/screens/Lobby.tsx`, `src/components/screens/Multi.tsx`,
      `src/components/screens/RaceOver.tsx`, `src/components/screens/ChallengeOver.tsx` — with the
      reason written above it in the same shape the existing comment has.
- [ ] One new key, `net.leaveHangsUp`, added to `src/i18n/fi.ts` first and then `src/i18n/en.ts`, no
      placeholders in either, drawn on both result screens only when `net.live && !spectating` so a
      table is not told about a button it cannot see. `rules.mp`'s fourth entry (the "no reconnecting"
      paragraph) gains a sentence in both locales saying that going back to your own run ends the
      session for everybody — **same list length, no new key**, so `i18n.test.ts`'s list-length and
      placeholder cases and the render sweep pass. `Rules.tsx` needs no code change.
- [ ] Docs corrected: CLAUDE.md's "`leaveChallenge` is `flow`: the host raising its own menu and
      clicking Back to your run is numbered and broadcast …" passage, its "**The nine `local`
      actions are exactly the ones the hash ignores**" claim (ten, with one named exception that is
      paid for by the hang-up), and both "`NET_VERSION` is **4**" statements; README's _Playing with
      other people_ section gains one sentence saying Back to your run ends the session, and its
      _What comes from tuppi_ section's "network version **4**; old v3 tabs are rejected" — the
      third such statement, and a player-facing instruction about which builds interoperate — is
      corrected to 5 and v4 in the same change.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The requirement's first direction is taken and its second is refused, not deferred.**
  Broadcasting the host's resolved post-`leaveChallenge` state would break the project's own law that
  **the wire carries actions, not state**, and it is wrong on its own terms: the host's `parked` is
  the host's private roguelike, so applying it everywhere would destroy each guest's own parked run
  and put the host's seed, wallet and jokers on every peer's screen. There is no shared answer to
  "what were you doing before the match" to converge on.
- **`local` on its own would be worse than the bug, so the hang-up is mandatory rather than
  optional.** A host that restored its own roguelike while still sequencing would go on numbering
  and broadcasting its own run's `auto` ticks to guests still sitting in the race. The requirement
  did not ask for a hang-up; without one the first direction it offered is not a fix.
- **The player-visible consequence is a real change: Back to your run now ends the session for
  everybody.** Play again and Replay seed are untouched and are the paths that keep the table
  together. **What the peers left behind are _told_ is asymmetric, and the asymmetry is the
  relay's, not this change's** — verified in the delivered code rather than assumed. A **host**
  hanging up closes every link, so every peer's `onClose` raises the existing `dropped` banner, on
  both routes. A **guest** hanging up reaches the host in a room only (`hostSeating`'s `onDrop` →
  `hostSession.leave` → `dropped`); on the code swap `useNetGame`'s `onClose` marks that chair
  `"failed"` and sets no `SessionStatus`, and the **other guests are told nothing at all**, because
  the host broadcasts no `bye` and no guest ever messages another — their match simply stops on a
  chair `g.seats` still names `"human"`, with no banner, since `hashing.due` is set by `endTrick`
  alone. Making the report symmetric is a transport increment (a relayed `bye`, or a status of its
  own) and is refused here by the Out of scope clause below; CLAUDE.md's Known gaps and the README
  say plainly which case is announced and which is not, so nothing claims a banner that does not
  arrive.
- **The delivered pairing "the `local` actions are exactly the ones the hash ignores" is broken by
  this, knowingly.** `leaveChallenge` becomes the tenth `local` action and the only one that moves
  the hash. It is `local` because the window that sends it **stops being a peer in the same click**,
  not because it touches nothing shared. The pairing is restated as "nine hash-invisible, plus one
  named exception, and the list of exceptions has length one" rather than dropped, so the next
  candidate has to argue rather than cite precedent.
- **The alternative considered and rejected**: keep `flow` and simply disable the three Leave
  buttons while `net.live`, making the player hang up from the Multiplayer door first. It changes no
  scope and needs no version bump, but it fences the bug off instead of fixing it — `SCOPE` would
  still say this action may be broadcast, and a fourth call site added later brings the desync back
  with no test to catch it. A reviewer who values the pairing above that should ask for this
  instead.
- **`NET_VERSION` is bumped although no message shape changes.** Mixed builds are exactly where this
  bug survives: a v4 host broadcasts the numbered leave and a v5 guest applies it, and a v4 guest's
  `req` is ignored by a v5 host and leaves it stuck. This follows the v3 and v4 precedent — both
  were reducer-rule bumps with unchanged wire shapes — and it refuses every cross-build session in
  flight at the door, which is the intended cost.
- **`ChallengeOver`'s hang-up is unreachable today and is written anyway.** Tuppi-Rummikub cannot be
  started while a session is live (`Menu`'s Challenges is `disabled={net.live}`), so that branch is
  defence in depth, the same reading `Challenges`' Play `MoveButton` already carries. Two result
  screens that disagree about what their identical button does is the worse outcome.
- **`Menu.tsx` is deliberately left alone and given no hang-up.** Its Continue is
  `disabled={net.live}`, so it is unreachable in a session; adding a fourth hang-up site for an
  unreachable click would be noise. The cost is that this fix now depends on that `disabled`:
  enabling Continue during a session reopens the hole.
- **The reducer is not touched at all.** `leaveChallenge(prev)` keeps
  `rehydrate(prev.parked) ?? createRun(undefined, prev.bestAnte)`, fresh random seed included.
  Offline that is the correct behaviour and nothing shared reads it any more. A reviewer expecting
  the fix to be in `src/game/` will not find it there.
- **One new string, and its wording is the implementer's.** The key name `net.leaveHangsUp` is fixed
  so the docs and tests can name it; the Finnish and English sentences are not dictated here. It
  lives in the `net.*` area because it is a statement about the session, not about a match.
- **Nothing new is built for the peers left behind.** A message saying "somebody went back to their
  own run" would need a new `SessionStatus` and a new `NetMsg`, which is a transport increment and
  not this fix.
- **Classified `ui`, not `infra`, although most of the diff is in `src/net/`.** The delivered change
  a player sees is two buttons and one line of text, and `ui` runs the playtest and screen stages —
  the two that can catch a window that restores a run and then stalls, or a Finnish sentence that
  overflows a result screen. Tuppi's rules, its point tables and every measured figure are
  untouched, so `rule` or `balance` would mis-cite a source and measure nothing.

## Touch points

- `src/net/protocol.ts` — `SCOPE.leaveChallenge` → `"local"`; `NET_VERSION` → `5` and the comment
  that says why an unchanged wire shape still needs it
- `src/net/protocol.test.ts` — the four scope lists; the "a local action" block's one named exception
  and its non-vacuity case
- `src/net/session.test.ts` — the three-peer leave case, the host's mirror of it, and the pinned
  divergence-and-silence case
- `src/components/screens/RaceOver.tsx` — Back to your run hangs up when `net.live`; the
  `net.leaveHangsUp` line, gated on `net.live && !spectating`
- `src/components/screens/ChallengeOver.tsx` — the same two changes; it gains `useNet` and
  `useSpectating`
- `src/components/screens/Menu.tsx` — **deliberately unchanged**, named here so nobody "completes"
  the pattern by adding a hang-up to it
- `src/game/reducer.ts` — **deliberately unchanged**: `leaveChallenge(prev)` keeps its delivered body
- `src/net/session.ts`, `src/hooks/useNetGame.ts` — **deliberately unchanged**; `hostSession.intent`
  and `guestSession.intent` already apply a `local` action without sending anything, and `send`
  reads `roleRef.current` synchronously, so a hang-up in the same click handler routes the dispatch
  straight to the reducer
- `src/i18n/fi.ts` then `src/i18n/en.ts` — `net.leaveHangsUp` added; `rules.mp`'s fourth entry
  amended in both, list length unchanged
- `src/test/invariants.test.ts` — the `net.hangUp` site list grows from three to five, with its
  reason; the `leaveChallenge` site list unchanged
- `src/test/render.test.tsx` — the live-session click cases for both result screens, the table's
  `btn.backToRun`-by-name case, and the now-stale `leaveChallenge` is a `flow` action comment above
  `TABLE_MENUS`
- `src/hooks/GameContext.test.tsx` — no change expected; the delivered `leaveChallenge` case and the
  save guards (`if (net.live) return;` and the challenge branch's `if (state.menu !== null) return;`)
  already cover the live → off transition this click makes
- `CLAUDE.md` — the `flow` passage in the shared-table section, the "nine `local` actions" claim,
  and both `NET_VERSION` statements
- `README.md` — one sentence in _Playing with other people_

## Out of scope

- **Carrying state on the wire in any form**: a new `NetMsg`, a snapshot message, reconnect, or
  catching a late peer up. The relay stays actions-only.
- **Any change to the reducer's `leaveChallenge`, to `parked`, to `SAVE_VERSION` or to the
  snapshot's shape.** A challenge and a networked run are still never saved.
- **Any tuppi rule, scoring or balance change.** No figure in the README moves, no measurement is
  asked for, and no rule source is cited because none is touched.
- **Telling the peers left behind anything new** — a new `SessionStatus`, a "player left" message, a
  relayed `bye`, or an AFK timer. They get exactly what the delivered relay already gives them: the
  `dropped` banner when the host goes, and on a guest's departure the host's own banner in a room
  and nothing anywhere else.
- **Hanging up automatically when a match ends, when a peer drops, or from the rail.** Only the two
  result screens' Back to your run hangs up.
- **Making leaving a per-seat concession, a vote, or a confirmation dialog**, and leaving a match
  mid-deal by any new route.
- **Filing a board row for a networked match**, and `raceRowFor`'s `ownerTeam(g)` debt.
- **Tuppi-Rummikub over a session**, and enabling `Menu`'s Challenges button while `net.live`.
- **The hosted main-game run's second-person result screens and its single economy** — still the
  documented known gaps.
- **ARIA, focus order and keyboard routes** through the result screens; accessibility stays the
  documented known gap.
