---
id: 2026-09-13-room-lobby-honest-ready-signal
title: Tell the host who is actually in the room before Start
kind: ui
status: proposed
---

# Tell the host who is actually in the room before Start

## What

A host who opens a room is told how many other people have actually connected, and a room holding
nobody but the host never reads as **"Everyone is here."** The readiness line names the real state —
nobody else yet, somebody still unassigned, or everybody seated — the Start button says which of the
two things it is about to do (start a match with the people who are here, or start alone against the
game), and the alone state states the consequence: once Start numbers the first action, anybody who
types the room code afterwards is turned away for the rest of the match.

Nothing about who may start changes. A host may still deliberately start a room of one with three AI
chairs; what changes is that the screen stops telling them the opposite first.

## The bug, precisely

`src/components/screens/Lobby.tsx` line 319 draws the room-first host page's whole readiness summary
from one boolean:

```tsx
<p className="dek">{net.canStart ? t("lobby.allHere") : t("lobby.needAssignments")}</p>
```

`net.canStart` in `src/hooks/useNetGame.ts` is
`role === "host" && players.length > 0 && players.every((player) => player.seat !== null)`, and
`hostSession.canStart()` in `src/net/session.ts` is `players.size > 0 && lobby().every((p) => p.seat
!== null)`. `openLobby(name)` puts the host itself in `players` under `ROOM_HOST_ID`, so the moment
the host picks its own chair from the `lobby.assignSeat` select — with zero guests connected — both
read `true`, Start enables and the page says **"Everyone is here."** The roster above it does show a
list of one, and `roomEscape`'s "If nothing is happening, try another way to connect" is drawn
underneath, but the summary line contradicts both of them, and it is the line that sits directly
above the button.

The cost of acting on that line is not recoverable: `start` sends `newRun`/`startChallenge`,
`sequence()` takes `seq.n` to 1, and from then on `hostSession.receive`'s `hello` case answers every
arrival with `bye` and raises `late`. There is no reconnect and no catch-up, so from the guest's side
the room code simply never works — the honest refusal they see (`net.refused`) explains why but
cannot undo it.

## Prior specs

- **Overlaps `2026-09-11-room-first-multiplayer-lobby` (delivered, on `main`) and reverses none of
  it.** Its criterion _"Start is disabled while any connected player is unassigned, and the lobby
  states that reason"_ stands exactly as delivered, and so does its assumption _"Empty chairs are AI
  rather than closed chairs, so one to four connected players can start"_ — **a room of one may still
  start.** This spec adds a second, separate question beside the seating gate, and changes what the
  page says rather than who may press the button. The roster, the assignment rules, duplicate-chair
  refusal, `PLAYER_NAME_MAX` and `NET_VERSION` 5's reason are untouched.
- **Reaches into a file `2026-09-13-lobby-first-solo-and-viewer` (this branch) put out of scope**,
  and the distinction is worth reading: that spec's out-of-scope line is _"the room-first roster:
  names, assignment, removal, duplicate refusal and the Start gate on unassigned players stay
  exactly as delivered"_. The **gate** does stay. The **readiness line** is what changes, which that
  spec did not touch. Its `net.refused` work is what tells the locked-out guest why, so the guest
  side of this bug is already delivered and gets no further spec here.
- **Changes one delivered test literal from `2026-09-09-shared-table-always-invited`, and its
  substance wins.** That spec deliberately ungated the code-swap host's Start from the chairless
  invitation, and `render.test.tsx`'s case _"starts whatever the shared table's own invitation says
  (%s)"_ pins both `start.disabled === false` **and** `lobby.allHere` on a host with no open chair
  and nobody connected. The enablement is that spec's point and is preserved; the `allHere`
  assertion is the same untruth as the room's and is replaced by the new alone line. **Which reading
  wins: Start stays enabled there, the sentence changes.**
- **Not already delivered.** `grep -n "allHere" src/components/screens/Lobby.tsx` finds the string on
  both host pages today with no peer count anywhere in the file, and `net.players` is read only for
  the roster rows, the `lobby.assignSeat` selects and `peersHere`.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

- [ ] **A room of one never reads as everyone.** On the room-first host page
      (`net.role === "host" && net.room`) `lobby.allHere` is drawn only when at least one room player
      other than `ROOM_HOST_ID` is connected **and** `net.canStart` is true. A case in
      `src/test/render.test.tsx` renders `inRoom()` with `players` holding the seated host alone, in
      both locales, and asserts the page does **not** contain `lobby.allHere`.
- [ ] **The count is on screen in every state.** The host page draws one line reporting how many room
      players other than the host are connected, drawn in all three states (nobody else, somebody
      unassigned, everybody seated), with the number through `fmt()`. Render cases cover 0, 1 and 3
      others in both locales.
- [ ] **The alone state states the consequence.** With no other room player connected, the page draws
      a line saying the host is the only player in the room and that starting now turns away anybody
      who joins afterwards, for the rest of the match. A render case reads it in both locales.
- [ ] **Start says which of the two things it does.** With no other room player connected the room
      host page's Start carries its own label key (`btn.startAlone`) instead of `btn.startMatch`, and
      with at least one it carries `btn.startMatch`. Both are the same `MoveButton`. A render case
      asserts both labels and that clicking the alone one still calls `net.start` exactly once — the
      capability is preserved, not removed.
- [ ] **Start's enablement does not change.** The room host page's Start keeps
      `disabled={!net.canStart || blocked}` with no new clause, and `useNetGame`'s `start` keeps its
      single `if (roomRef.current && !host.current?.canStart()) return;` guard. The delivered
      expectations in `src/net/seating.test.ts` (_"removes a dropped player and frees its
      assignment"_, which asserts `canStart()` is `true` with the host alone and seated),
      `src/net/session.test.ts` and `src/hooks/useNetGame.test.tsx` all keep their current values.
- [ ] **`canStart` says what it means, in a comment, and gains no clause.** `hostSession.canStart()`
      in `src/net/session.ts` and `net.canStart` in `src/hooks/useNetGame.ts` each carry a comment
      stating that they answer seating only — every admitted player holds a chair — and are not a
      test of whether anybody else is here, naming the seating test above as what fails if solitude
      is folded in.
- [ ] **The code-swap host page loses the same untruth and keeps its Start.** When no chair's state is
      settled (`"connected"` or `"table"`) and no chairless invitation has been answered, that page
      draws the alone line instead of `lobby.allHere`; `ready` and the button's `disabled` are
      unchanged. `render.test.tsx`'s _"starts whatever the shared table's own invitation says (%s)"_
      keeps `start.disabled === false` and swaps its `lobby.allHere` expectation for the new key.
- [ ] **A connected shared display is not a player.** The count and the alone test read room players
      other than the host only; a welcomed display is still reported by `lobby.tableSeated` and does
      not turn the alone line off. `peersHere(net)` — the roguelike's refusal — is unchanged and
      still counts a display, a settled chair and a room player alike.
- [ ] **Text.** Every new key exists in `src/i18n/fi.ts` and `src/i18n/en.ts` with matching
      placeholder sets, the count line is phrased so neither locale needs a 0/1/many branch, and
      `src/i18n/i18n.test.ts`'s parity and stray-Finnish cases pass. No player-facing literal appears
      in `Lobby.tsx`.
- [ ] **Nothing on the wire, nothing in the state.** `NET_VERSION` stays **6**; `SCOPE`, `guestMay`,
      `hashState`, `parseMsg` and every `NetMsg` shape are untouched, and `src/test/invariants.test.ts`
      still finds no session-shaped field on `GameState`. `git diff --stat` shows no file under
      `src/game/`.
- [ ] **Documentation.** `README.md`'s _"Start begins the match once every connected player has a
      chair"_ paragraph and `docs/multiplayer.md`'s room section say the host is told how many people
      are in the room and that starting alone is a deliberate choice rather than a readiness state;
      `CLAUDE.md`'s lobby paragraph records that `canStart` answers seating only and that the
      readiness line is a separate question. No document may claim Start waits for a second peer.
- [ ] **Gates.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` all pass,
      and the test-count lines in `CLAUDE.md` and `README.md` match what `npm test` prints. One
      browser reading is recorded in the pull request body at **1280x800**, **1280x500** and
      **390x844**: the room host page in all three states, the sticky `.lobbyfoot` buttons
      hit-testable in each, and the Finnish alone line not overflowing its panel.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **Start is not hard-gated on a second peer, and this is the line to object to if that is what was
  wanted.** The requirement's closing sentence asks for "a clear, honest signal of whether anyone
  else has actually connected before they start", so this spec makes the screen honest — the count,
  the alone line, and a Start button that names the alone case — and leaves the button clickable. A
  hard gate would reverse `2026-09-11-room-first-multiplayer-lobby`'s delivered assumption that one
  to four connected players can start, break `seating.test.ts`'s `canStart()` expectation after the
  last guest drops, and strand a host who opened a room and then decided to play alone with a wall
  display watching.
- **No confirmation modal.** "You are alone — start anyway?" would need a new member of `Modal` on
  `GameState` for a question that is entirely the window's, plus a new row in `render.test.tsx`'s
  modal dimension. The Start button's own label carries it instead.
- **A welcomed shared display does not satisfy "somebody else is here" for this line.** It plays no
  chair, so a host with a display on the wall is still the only player, and the display already has
  its own line. A reviewer who wants "a display counts" should say so; it is one predicate.
- **"Connected" means the roster, not the channel.** A `RoomPlayer` other than the host exists only
  after `hostSession.receive`'s `hello` case admitted it, which is the same honest signal `onGuest`
  gives the code-swap route — deliberately not an open data channel, for the reason CLAUDE.md
  records.
- **The number reported is _others_, not the room's total.** One number the host can compare against
  the people they are on a call with, rather than a total they have to subtract themselves from.
- **The count line is phrased as a label with a colon** ("Muita pelaajia: {n}" / "Other players
  here: {n}"), because a 0/1/many branch in one locale and not the other is exactly what the
  placeholder parity test cannot catch.
- **`canStart` is not renamed.** `seatingReady` would read better and would touch `session.ts`,
  `seating.test.ts`, `session.test.ts`, `netContext.ts`, `useNetGame.ts`, `useNetGame.test.tsx`,
  `harness.tsx` and `render.test.tsx` to say what a comment says for free. The comment is the fix.
- **The guest side needs nothing.** A peer refused after the first action is already told
  `net.refused` ("The host refused the connection. The likeliest reason is a match already under
  way…"), delivered by `2026-09-13-lobby-first-solo-and-viewer` on this branch.
- **`roomEscape` stays drawn unconditionally on the room host page.** Its "If nothing is happening"
  line was contradicted by the summary above it and is consistent with the new one; moving or gating
  it is churn with no criterion behind it.
- **Late join stays unbuilt.** It is the only change that would make the lockout survivable, and it
  is a transport increment with its own spec — the reasoning is recorded in
  `2026-09-13-lobby-first-solo-and-viewer` and `docs/multiplayer.md`.

## Touch points

The files and functions this is expected to change. All real.

- `src/components/screens/Lobby.tsx` — a helper beside `peersHere`/`settled` answering "how many
  other room players are here"; the room host page's summary line, its count line and its Start
  label; the code-swap host page's `ready ? allHere : needAll` line; `fmt` added to the `useI18n()`
  destructure in `Lobby`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the alone line, the count line and `btn.startAlone`.
- `src/net/session.ts` — a comment on `hostSession.canStart`. No logic change.
- `src/hooks/useNetGame.ts` — a comment on the `canStart` field in the returned memo. No logic change.
- `src/test/render.test.tsx` — new cases beside `inRoom()` and _"lets the host assign connected room
  players to chairs"_; the changed literal in _"starts whatever the shared table's own invitation
  says (%s)"_.
- `src/index.css` — only if the alone line needs a class beyond the existing `.dek` / `.warn`, inside
  the hand-formatted lobby block.
- `README.md`, `docs/multiplayer.md`, `CLAUDE.md` — what the host is told, and what `canStart` means.

## Out of scope

- **Disabling the room host's Start while it is alone**, and any other change to who may press it.
  `net.canStart`, `hostSession.canStart()` and `useNetGame`'s `start` guard keep their delivered
  behaviour.
- **A confirmation modal, a two-step Start, or any new `Modal` member.**
- **Renaming `canStart`.**
- **Late join, reconnect, a retained action log, catch-up replay and snapshots.** The lockout after
  `seq.n > 0` stays exactly as delivered.
- **The guest, shared-table and join pages**, `net.refused`, and `NetBanner`.
- **The room roster's own rules**: names, assignment, moving, removal, duplicate-chair refusal and
  the Start gate on unassigned players.
- **`peersHere` and the roguelike's refusal**, which is a different question and already counts every
  kind of peer.
- **`NET_VERSION`, `SCOPE`, `guestMay`, `hashState`, `parseMsg`, every wire shape, the signalling
  codec and the QR encoder.** No byte on the wire changes.
- **Any tuppi rule, any score, any balance figure, `SAVE_VERSION`, and any `GameState` field.**
  `src/game/` is untouched and `src/game/seats.test.ts` must not move a literal.
- **Accessibility.** No ARIA roles, labels or focus management beyond what the existing controls
  carry; the known gap stands.
