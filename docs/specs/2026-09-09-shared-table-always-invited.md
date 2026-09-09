---
id: 2026-09-09-shared-table-always-invited
title: Always build the shared table's invitation, and drop the host's toggle
kind: ui
status: proposed
---

# Always build the shared table's invitation, and drop the host's toggle

## What

On the code-swap route (**Other ways to connect**), a host clicking **Start a code swap** gets one
invitation per open chair **and** the shared display's chairless invitation, every time. The
**Invite a shared table too** switch is gone: a screen could already join by answering any chair's
code and saying "table", so the switch never decided whether a display could join — it only decided
whether the host was shown a code that reserves no chair.

The host therefore makes one decision fewer before inviting anybody, and the code-swap page reads
the way the room page already does: the display's line is always there, and whether a screen turns
up is answered by the screen, not by a checkbox ticked in advance.

## Prior specs and documents

- **Contradicts `2026-09-08-shared-table-view-multiplayer` (delivered) in two named places, and
  this spec's reading wins.** That spec's criterion "The host's pre-invite chair table carries a
  switch for a shared-table invitation (`Net.wantTable` / `setWantTable`, defaulting **off**)" and
  its assumption "The host must ask for the table invitation before inviting anybody … always
  building a fifth peer connection would spend ICE gathering and, without LAN only, a STUN round
  trip on a connection most hosts do not want" are both reversed here. The cost was real and is
  accepted: one extra `RTCPeerConnection` per code-swap host, measured against a switch that
  promised a permission the protocol never asked for. Everything else in that spec stands —
  `guestMay(a, null)`, the three read-only layers, no offline table, one table per session.
- **It also reverses that spec's Start gate**, which CLAUDE.md states as "The host's Start waits for
  the shared table's own invitation". With the invitation always built, an unanswered one no longer
  says a display is expected, so waiting on it would leave every code-swap host with a Start that
  never enables. See the second assumption: the gate goes, the text that replaces it is a line in
  the display's own block, and CLAUDE.md's paragraph is rewritten in this pull request rather than
  left to contradict the code.
- **Untouched by design: `2026-09-08-trystero-rooms` (delivered).** A room never had this switch and
  never gated Start on a display — `openRoom` builds no chairless link, and `hostSeating`'s `claim`
  sets a chair aside on the **hello**, which is what lets a device ask for none. That route is the
  one players use, and this change makes the code swap agree with it rather than the other way
  round.
- **Overlaps `2026-09-08-separate-multiplayer-connection-routes` (delivered) and is scoped to the
  difference.** The Other-ways page keeps its shape, its `LanSwitch`, its `#hostcode` box and its
  two sides; the one control removed from it is `TableSwitch`. Nothing about which route draws
  which page changes, and the LAN switch's known scoping wart is out of scope below.
- **No dependency on `2026-09-07-seat-absolute-game-state` or `-per-seat-economy` is weakened.**
  Nothing here goes on `GameState`, no pure function learns who is looking, and `src/game/` is not
  touched at all.

## Acceptance criteria

- [ ] **The switch is gone from the code, not just from the screen.**
      `grep -rn "wantTable" src/` returns nothing: `Net.wantTable` and `Net.setWantTable` are
      removed from `src/hooks/netContext.ts` (type and default context), the `wantTable` state and
      `wantTableRef` from `src/hooks/useNetGame.ts`, the `TableSwitch` component from
      `src/components/screens/Lobby.tsx`, and the field from `stubNet` in `src/test/harness.tsx`.
      `OtherWays` draws `<JoinAs />` on the joining side and nothing in its place on the hosting
      side.
- [ ] **The two catalogue keys are deleted, in both languages.** `lobby.wantTable` and
      `lobby.wantTableDek` are removed from `src/i18n/fi.ts` **and** `src/i18n/en.ts`. `en.ts` is an
      object literal typed as `Catalogue`, so an orphan key there is an excess-property error:
      `npm run typecheck` is the gate that proves the pair was removed together.
- [ ] **`invite()` always builds exactly one chairless link.** A case in
      `src/hooks/useNetGame.test.tsx` calls `invite(0)` on the four default chairs (`me` plus three
      `ai`) with no other setup and asserts the stub recorded **one** link and
      `tableInvite.state === "waiting"` with a code. This replaces "is not built at all unless the
      host asked for one", whose assertion is now false by design.
- [ ] **A chair's link and the table's are both built, chairs first.** A case with one chair set to
      `open` asserts the stub recorded **two** links, that `links[0]` is the chair's (its `onMessage`
      reaches `hostSession` and a `hello` marks chair 1 `"connected"`) and that `links[1]` is the
      table's (a `hello` with `as: "table"` marks `tableInvite` `"connected"`). `hostingChair()` in
      that file is updated for the new count rather than left asserting one.
- [ ] **The extra connection is one, and it reserves no chair.**
      `src/hooks/GameContext.test.tsx`'s "builds the chairless invitation only when it was asked
      for" becomes a case that hosts once with no chair opened and asserts
      `FakePeer.made.length === 1`, `unpackSdp("H", net.tableInvite.code).ok === true`, and
      `net.seatsFor()` still `["human", "ai", "ai", "ai"]`.
- [ ] **Start no longer waits for the display.** `ready` in `Lobby.tsx` loses its `tableSettled`
      conjunct and reads
      `(open.length > 0 || net.tableInvite !== null) && open.every((c) => settled(c.state))`. The
      delivered `it.each` over `["waiting", "connected", "failed"]` in `render.test.tsx` is inverted:
      `start.disabled` is `false` in all three states, in both locales.
- [ ] **One new line replaces the gate, in both languages.** `lobby.tableDek` (no placeholders, in
      `fi.ts` and `en.ts`) is drawn inside the `lobby.tableChair` block and says two things: the code
      is for a screen and not for a player, and the screen has to be connected before Start because
      it cannot join a match already under way. A render case asserts its translation is inside the
      `.netchair` block that contains `lobby.tableChair`, in both locales.
- [ ] **The display's block still works exactly as delivered.** A render case with `role: "host"`
      and a `waiting` `tableInvite` finds the block, its `.codeblock .codebox` carrying the code, its
      `svg.qr`, its `#anstable` textarea, and a Connect that calls `net.connect("table", <answer>)`.
      `settled()` still hides all of that once the invitation is answered.
- [ ] **The room route is unchanged.** A case asserts `openRoom(0)` builds no link through
      `hostLink` and leaves `tableInvite` `null`, and that a `hello` with `as: "table"` from a room
      peer sets it to `"connected"` with `complete: true`. `src/net/seating.ts` and
      `src/net/session.ts` are not edited.
- [ ] **The rules panel stops telling the player to tick something.** `rules.mp`'s shared-table item
      is rewritten in both catalogues to say the code-swap host is given the display's invitation
      alongside the chairs' and that the display must be connected before the match starts. Both
      lists keep the same number of items, which `i18n.test.ts` asserts.
- [ ] **The documents say what shipped.** `README.md`'s "A big screen can join as the shared table"
      paragraph, `docs/multiplayer.md`'s code-swap line ("keeps its fifth connection and its **Invite
      a shared table too** switch") and `CLAUDE.md`'s "The host's Start waits for the shared table's
      own invitation" paragraph are rewritten: the invitation is always offered, Start does not wait
      for it, and a display that is not connected when Start is clicked is refused with `late`.
- [ ] **The longer page still reaches its footer.** With one open chair and the display's block both
      drawn, the host page's Start and Back are on screen and returned by `elementFromPoint` at
      **1280x500** and **390x844**, measured over CDP — jsdom lays nothing out, so `npm test` cannot
      show this.
- [ ] **Nothing on the wire and nothing in the engine moves.** `NET_VERSION` stays `4`; `SCOPE`,
      `hashState`, `parseMsg`, `guestMay`, `hostSession` and `guestSession` are unedited; no file
      under `src/game/` changes and `seats.test.ts`'s pinned literals do not move. All five gates
      pass: `npm run lint`, `npm run typecheck`, `npx prettier --check`, `npm test`, `npm run build`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **This reverses a delivered decision, deliberately.**
  `2026-09-08-shared-table-view-multiplayer` specified the switch, its default and the reason for
  it. The requirement is a reversal, this spec is where it is recorded, and the earlier spec's file
  is left as written — a delivered spec is history, and it is superseded by name here rather than
  edited. If the reviewer wants the switch back, this is the change to reject, not a detail to
  adjust.
- **The Start gate goes with the switch, and that is the largest consequence.** Today `ready` refuses
  to enable Start while `tableInvite.state` is `"waiting"`, and that gate only makes sense because
  the invitation existed only when the host asked for it. Built unconditionally, an unanswered
  invitation says nothing, so keeping the gate would leave **every** code-swap host with a Start
  that never enables. The gate is therefore dropped, and what replaces it is `lobby.tableDek` plus
  the display's own state line in its block. **The risk this accepts is real**: a host who clicks
  Start before the screen has been welcomed loses it, because `hostSession` refuses any peer
  arriving after the first numbered action with `late`, and there is no reconnect. The room route
  has always had exactly this risk — `openRoom` sets `tableInvite` only from the welcome, so
  `tableSettled` is trivially true there — so this makes the two routes agree rather than inventing
  a new hazard.
- **Two ways of keeping a gate without a switch were considered and refused.** Gating on the host
  having pasted something into `#anstable` needs a way out when the paste is wrong (an empty box is
  the only escape, and nothing on screen says so); a new `"connecting"` `ChairState` set by
  `connect()` needs a union member, a catalogue line and a state machine for both chairs and the
  table. Both are larger than the change asked for, and neither was requested.
- **Every code-swap host now pays for a fifth peer connection**: one more `RTCPeerConnection`, its
  ICE gathering, and — unless **LAN only** is ticked — one more STUN round trip, on every hosted
  code swap whether or not a display ever answers. That is exactly the cost the delivered spec
  refused to pay by default. It is accepted because the code swap is already the slow, manual,
  fallback route, and because the switch bought no privacy or safety, only a connection not made.
- **The chairless code is now always on screen, so a player may paste it.** `hostSession` refuses a
  `hello` whose `as` is `"player"` on a link with no chair with `bye` and `nochair`, and
  `NetBanner` says so. That path is delivered and unchanged; it simply becomes more likely, which is
  why `lobby.tableDek` says whose code it is.
- **`lobby.needAll` / `lobby.allHere` stay keyed on the chairs alone.** "Everyone is here" can
  therefore appear while the display's line still reads "waiting". The alternative is a fourth
  sentence about a device that may not exist; the display's own block is one line above the summary
  and carries its own state.
- **A host with no open chairs can now click Start immediately** on the code-swap page, because the
  always-built `tableInvite` satisfies the first conjunct of `ready` and nothing gates the second.
  That matches the pre-invite chair table, whose Start is deliberately always enabled, and
  `lobby.noChairs` already says there is nobody to wait for.
- **Only the code-swap route changes.** `wantTableRef` is read inside `invite()` and nowhere else,
  so `openRoom`, `enterRoom`, `join`, `seating.ts` and the whole of `src/net/` are untouched. A
  display in a room keeps typing the same eight characters as everybody else.
- **The two keys are deleted rather than left in place.** A catalogue key nothing reads is invisible
  to the compiler and to `i18n.test.ts`; leaving them would be the next reader's dead end.
- **The chairs' links are still built before the table's inside `invite()`.** That ordering is not
  new, but it stops being incidental once both always exist: the updated hook tests index `links[0]`
  and `links[1]` by it, so a reordering would fail them rather than pass silently.

## Touch points

- `src/hooks/netContext.ts` — drop `wantTable` and `setWantTable` from the `Net` type and from the
  default context; rewrite `tableInvite`'s comment ("built for every code-swap host; `null` on the
  room route until a display is welcomed").
- `src/hooks/useNetGame.ts` — delete the `wantTable` state and `wantTableRef`, delete the
  `if (!wantTableRef.current) return;` guard in `invite()` so the chairless `hostLink` is always
  built, and drop both from the returned object and its `useMemo` deps. The `onOpen: () => {}`
  comments stay: the welcome is still the only thing that marks the invitation answered.
- `src/components/screens/Lobby.tsx` — delete `TableSwitch`; `OtherWays` renders `<JoinAs />` on the
  joining side only; `ready` loses `tableSettled` and the `tableSettled` binding goes with it; the
  `lobby.tableChair` block gains `lobby.tableDek`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — remove `lobby.wantTable` and `lobby.wantTableDek`, add
  `lobby.tableDek`, rewrite the shared-table item of `rules.mp`.
- `src/test/harness.tsx` — `stubNet` loses the two fields.
- `src/test/render.test.tsx` — delete "asks for the shared table's invitation before inviting
  anybody"; invert the "waits for the shared table's own invitation" `it.each`; assert
  `lobby.tableDek` inside the block.
- `src/hooks/useNetGame.test.tsx` — `hosting()` drops its `setWantTable(true)`; `hostingChair()`
  expects two links and takes the chair's; "is not built at all unless the host asked for one"
  becomes "is built for every host".
- `src/hooks/GameContext.test.tsx` — "builds the chairless invitation only when it was asked for"
  becomes the unconditional case over `FakePeer.made.length`.
- `src/components/screens/Rules.tsx` — no code change expected; the text lives in the catalogues and
  the item count does not move.
- `src/index.css` — no change expected: the block reuses `.netchair`, which is already styled and
  already inside the sticky-footer layout.
- `README.md`, `docs/multiplayer.md`, `CLAUDE.md` — the three documentation criteria above.

## Out of scope

- **Reconnect, and joining a match in progress.** A display that arrives after the first numbered
  action is still refused with `late`, exactly as a player is. This spec removes a gate; it does not
  remove the reason the gate existed.
- **Any new Start precondition**, including a `"connecting"` invitation state, a countdown, or a
  confirmation dialog before Start when the display is unanswered.
- **More than one shared table.** Still one chairless link, and nothing iterates.
- **The room route**, `seating.ts`, `session.ts`, `protocol.ts` and `NET_VERSION`. No wire change,
  so a build of this and a build of `main` can play together.
- **The LAN switch's scope wart** — `net.lan` is still the window's own and still read by
  `openRoom` / `enterRoom`. Named in CLAUDE.md, fixed elsewhere.
- **A television layout**, larger cards, or any new breakpoint.
- **Any rule, any score, any number.** `src/game/` is untouched and no measurement is required.
- **Filing a networked match on a board**, which still needs the window's own seat inside a pure
  scores function.

## Source

Not a rule or scoring change: no trick, declaration, sooli or point is touched. The Oulunsalo senior
tuppi club's rule sheet (Antti Auer, 9 September 2022) and korttipeliopas.fi describe four players
at one table and say nothing about who may watch, so there is nothing here to check a shared display
against.
