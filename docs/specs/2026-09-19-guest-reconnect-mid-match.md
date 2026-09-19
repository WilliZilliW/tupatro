---
id: 2026-09-19-guest-reconnect-mid-match
title: Let a guest whose link drops rejoin the same match and catch up
kind: infra
status: proposed
---

# Let a guest whose link drops rejoin the same match and catch up

## What

A guest whose connection fails in the middle of a hosted match can come back into **the same
session** instead of being turned away at the door. The host keeps the numbered actions it has
broadcast in a bounded log, recognises a returning peer, hands it the block it missed, and the guest
repositions its numbered stream onto that point and plays on. Today the same event is terminal:
`hostSession.receive`'s `hello` case refuses any peer once `seq.n > 0` with `bye` and `late`,
`sequence()` keeps no log, and `guestSession`'s `act` case stops dead on the first gap.

This is **reconnect for a guest whose window is still open**, on the room route. Late joining by a
peer that was never in the match stays refused, and so does a host coming back.

## Acceptance criteria

- [ ] `NET_VERSION` in `src/net/protocol.ts` is `11`, and the comment above it says why in the same
      shape every earlier bump uses: a v10 host has no `resume` case, so a v11 guest would ask a
      question it can never be answered and sit on `dropped` for ever. `roomIdFor` already carries
      the version, so the two builds cannot meet.
- [ ] `NetMsg` gains exactly two members and no more: `{ t: "resume"; v: number; from: number }`
      (a guest asking to come back, naming the next action number it needs) and
      `{ t: "catchup"; from: number; acts: readonly Action[] }` (the host's ordered answer).
      `hashState`, `SCOPE`, `scopeOf` and `guestMay` are untouched — a resume is not an action.
- [ ] `parseMsg` validates both, and `src/net/protocol.test.ts` pins each refusal: `resume` is
      `null` unless `v` is a number and `from` is an integer `>= 1`; `catchup` is `null` unless
      `from` is an integer `>= 1` and `acts` is an array of length `<= RESUME_LOG_MAX` whose every
      element passes `isAction`. Both are added to the round-trip list at `protocol.test.ts:331`.
- [ ] `RESUME_LOG_MAX` is exported from `protocol.ts` beside `PLAYER_NAME_MAX` and is `2000`, with
      the measurement in its comment: a match deal costs ~95 numbered actions at ~22 bytes of JSON
      each, so the cap is ~21 deals of history and ~45 kB of serialised actions retained.
- [ ] `hostSession` retains every sequenced action in a ring buffer bounded by `RESUME_LOG_MAX`,
      and `src/net/session.test.ts` sequences `RESUME_LOG_MAX + 50` actions and asserts the host
      answers a resume from the oldest retained number and refuses one below it.
- [ ] A guest welcomed before the first numbered action and dropped mid-match (`hostSession.leave`)
      is re-admitted by `resume`: the host puts it back in the broadcast set at the chair it held —
      and back into `tables` if it was the shared display, with `notifyTables()` after — replies
      `catchup` carrying exactly the actions numbered `from`…`seq.n`, and raises `live` for that
      peer rather than `late`. A case in `session.test.ts`.
- [ ] Every refusal the host can still make is pinned in `session.test.ts`: a `hello` once
      `seq.n > 0` is still `bye` + `late` (late joining is unchanged), and a `resume` the host
      cannot honour — a peer it never welcomed into this match, `seq.n === 0`, a `from` below the
      retained floor, or a `from` above `seq.n + 1` — is `bye` + the new `stale` status.
- [ ] `guestSession` gains `resume()` and a `catchup` case. A `catchup` whose `from` equals
      `stream.next` applies each action in order through the same path `act` uses (advancing
      `stream.next`, setting `hashing.lastN`, raising `hashing.due` on `endTrick`), clears
      `stream.stopped`, and reports `live`; any other `from` is `desync` and applies nothing.
- [ ] `session.test.ts` drives a match across the seam: a guest is dropped mid-deal, the host
      sequences further actions, the guest resumes and then plays on to the end of the deal, and
      `hashState(host) === hashState(guest)` after the catchup and after the following numbered
      actions — no action applied twice and none skipped.
- [ ] `guestSeating.onPeer` calls `session.resume()` when `session.welcomed()` is true and
      `session.hello()` when it is not, replacing the current one-armed `if`; a case in
      `src/net/seating.test.ts` asserts both arms.
- [ ] `SessionStatus` gains `resuming` and `stale`; `NetBanner`'s `SAYS` is
      `Record<SessionStatus, LocaleKey>` so it fails to compile until both have a key, and
      `net.resuming` / `net.stale` exist in `src/i18n/fi.ts` and `src/i18n/en.ts`.
- [ ] No player-facing string still says reconnecting does not exist: `rules.mp`'s fourth entry and
      `hangup.body` are rewritten in **both** locales to say what is now true — a dropped link can
      come back into the same match, hanging up cannot, and a device that was never in the match
      still cannot join one under way.
- [ ] The prose that documents the old limit is corrected: `docs/multiplayer.md`'s "Nobody joins a
      match already under way" section and its Known limitations bullet, `README.md`'s
      "Everybody … has to be connected before you click Start" paragraph, and CLAUDE.md's
      "Multiplayer has no reconnect…" lines and the `late` comment in `session.ts`.
- [ ] `npm run lint`, `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`,
      `npm test` and `npm run build` all pass.

## Assumptions

Nobody answered a question during this run. Each of these is a reading that was chosen, not
confirmed.

- **"Loses its connection" is read as the transport failing under a window that is still open.**
  The guest keeps its `GameState`, its seat and its `stream.next` in memory, so the catchup is a
  tail rather than the whole match. **A guest that reloads the page is not covered** and is named
  under Out of scope: it would need an identity that survives the reload and a replay from action
  one, which the bounded log cannot promise.
- **Room route only, in practice.** `hostSession` and `guestSession` know nothing about the route,
  so the resume path works for any peer whose messages reach the host again — but only the room
  route can re-establish a link by itself (Trystero's `onPeerJoin` for the same `selfId`, which is
  stable for the life of the page). The code swap's `RTCPeerConnection` closing is terminal, its
  chair goes to `"failed"`, and nothing re-offers an invitation; that is unchanged, and no UI to
  re-hand a code is added.
- **The returning peer is identified by the transport's peer id, not by anything in the message.**
  `resume` carries no id: the host answers the peer the message arrived from. That is unspoofable
  within this model — a guest is a person you know, not a threat model, as `guestMay`'s comment
  already says — and it is why a reload, which draws a new `selfId`, is out.
- **Two decided bounds, not one.** The action log is a ring buffer of `RESUME_LOG_MAX` entries. The
  chair map for readmission (`enrolled`, peer id → `{ chair: Seat | null; table: boolean }`) holds
  one entry per peer welcomed into this session, and entries are deleted by `refuse`, `remove` and
  `leave` **only while `seq.n === 0`** — so lobby churn does not accumulate and a match's map is at
  most the four chairs plus one display, since no new peer is admitted after the first numbered
  action.
- **`RESUME_LOG_MAX = 2000` is chosen, and the per-deal figure behind it is measured rather than
  guessed.** Driving a race and a traditional match headlessly through `nextTick` and `basicPolicy`
  over twelve seeds each, counting every action `SCOPE` does not classify `local`: **95.1** and
  **96.3** actions per deal, **22.4** bytes of JSON per action. The reproduction is a throwaway
  script over `game/drive.ts`'s pieces, not a kept test. A chair-holding guest's real catchup is far
  shorter than the cap — the match stalls at its own seat's turn within a trick — so the cap binds
  only for the shared display, which holds no chair and never stalls anybody.
- **The shared table is included**, because it is a `GuestSession` with `as: "table"` and takes the
  identical path. "Guests only" is read as "not the host", and a display that drops and comes back
  re-raises `tableHere` through `notifyTables()`. `rules.mp`'s fifth entry stays true as written —
  the display still has to be connected before Start.
- **A guest-side `stopped` stream is always repositionable.** The only thing that sets it is a gap
  in the numbered stream, and over a reliable ordered channel a gap means the link broke; a hash
  disagreement is raised on the host and does not stop a guest. So a `catchup` clearing `stopped` is
  not papering over a divergence.
- **`stale` is a new status rather than reusing `dropped` or `late`.** "Peli oli jo alkanut." is
  false for a peer that was in the match, and "Yhteys katkesi." hides why it cannot come back. Two
  new strings per locale is the price of not lying on the banner.
- **`hostSession.leave` still removes the roster entry** (`players`) mid-match; only `enrolled` is
  retained. The lobby is over by then, `g.seats` was frozen at Start, and `assign` already refuses
  once `seq.n > 0`, so the roster has nothing left to decide.
- **A guest's clicks while it is away are lost.** No request queue and no replay of `req`; the
  player clicks again. A chair whose peer is away still stalls the match at that seat's turn, which
  is what makes reconnect worth having and is not itself changed.
- **`useNetGame.ts` is expected to need no change at all.** The new statuses travel through the
  existing `onStatus` path and `Net` gains no field. If the implementation finds it does need one,
  that is a deviation worth saying out loud in the pull request.

## Touch points

- `src/net/protocol.ts` — `NET_VERSION` to `11` with its comment; `RESUME_LOG_MAX`; the two new
  `NetMsg` members; their `parseMsg` cases and an integer test beside `isSeat`/`isChair`.
- `src/net/session.ts` — `SessionStatus` gains `resuming` and `stale`; `hostSession` gains the
  bounded log (written in `sequence()`), the `enrolled` map (written at the welcome), and a
  `resume` case in `receive`; `GuestSession` gains `resume()`, and `guestSession` gains the
  `catchup` case plus a shared helper for applying one numbered action.
- `src/net/seating.ts` — `guestSeating.onPeer` asks `welcomed()` and calls `resume()` or `hello()`.
- `src/net/protocol.test.ts` — round-trip and refusal cases for `resume` and `catchup`.
- `src/net/session.test.ts` — readmission, every refusal, the ring-buffer bound, and a match driven
  across the drop with `hashState` compared on both sides of the seam.
- `src/net/seating.test.ts` — the two arms of `onPeer`.
- `src/components/net/NetBanner.tsx` — `SAYS` gains the two keys (a compile error until it does).
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `net.resuming`, `net.stale`; the rewrites of `rules.mp[3]`
  and `hangup.body`.
- `docs/multiplayer.md`, `README.md`, `CLAUDE.md` — the paragraphs that state the old limit.

## Out of scope

- **Late joining by a peer that was never in the match**, and **host reconnect**. Both stay refused
  exactly as today; the `hello`-after-`seq.n > 0` branch and its `late` status do not move.
- **A guest that reloaded the page.** It has no state, no `stream.next` and a new peer id; it would
  need a persisted identity and a replay from action one, which the bounded log cannot promise.
  See the first assumption.
- **Reconnect on the code-swap route**, and any UI for re-handing an invitation mid-match.
- **A snapshot message.** This spec picks the retained log of the two the requirement offers; a
  `{ t: "state" }` carrying a dehydrated run is a different increment with a different bound.
- **Announcing a departure or a return to the other guests.** The relay is a star and no `bye` is
  broadcast; that gap is recorded in CLAUDE.md and is not fixed here.
- **An AFK timer, an AI takeover for an absent seat, or pausing the match while a chair is away.**
- **Queueing or replaying a guest's own `req` messages sent while it was disconnected.**
- **A networked match filing a board row or writing a save**, and the hosted main-game run's
  second-person result screens — both still open, both recorded in CLAUDE.md's Known gaps.
- **A timing measurement of how long a reconnect takes over a real relay.** Nothing in this project
  has one, and jsdom cannot produce it; the pull request should say so rather than imply otherwise.

## Relation to the specs already delivered

Nothing here reverses a delivered decision. Reconnect is listed under **Out of scope** in
`2026-09-08-webrtc-transport`, `2026-09-08-trystero-rooms`, `2026-09-08-shared-table-view-multiplayer`,
`2026-09-13-lobby-first-solo-and-viewer`, `2026-09-13-room-lobby-honest-ready-signal`,
`2026-09-14-single-player-separate-from-multiplayer`, `2026-09-14-move-return-button-to-lobby`,
`2026-09-16-shared-table-private-player-view`, `2026-09-16-tupatro-match-mode-with-consumables` and
`2026-09-18-king-of-clubs-ikiliikkuja`; this spec is the increment every one of them deferred, and
it takes the shape they each described — a retained ordered log with a decided bound, a new message,
`parseMsg` validation, guest-side repositioning and a `NET_VERSION` bump.

Two of them leave player-facing text this must correct rather than quietly contradict:
`2026-09-12-fix-leave-challenge-desync` put the "no reconnecting" sentence into `rules.mp`'s fourth
entry, and `2026-09-16-confirm-hang-up-to-play-single` put "there is no reconnect: the match cannot
be rejoined" into `hangup.body`. The conclusion of both — **hanging up is irreversible** — still
holds and must keep holding: a window that hangs up builds a fresh `GuestSession`, which is not
`welcomed()`, so it says `hello` and is refused as `late`. It is the _reason_ those strings give
that stops being true.
