---
id: 2026-09-08-separate-multiplayer-connection-routes
title: Make the room the primary way to connect and demote the code swap behind Other ways to connect
kind: ui
status: proposed
---

# Make the room the primary way to connect and demote the code swap behind Other ways to connect

## What

A player who wants to play with somebody else is asked **one** question at the door — host, or
join — and then meets **one** way to connect: a room. The host's chair table offers Start the
match, **Open a room**, and a link to **Other ways to connect**; the join page offers a room-code
box, **Join a room**, and the same link. The second route is named for the first time — **Code
swap** / **Koodien vaihto**, because swapping two codes is the one thing a room never asks for —
and it lives one level down, behind that link, on both sides.

Three defects go with it, all of them read out of `src/components/screens/Lobby.tsx` as it stands
today: `btn.hostGame` means "go to the chair table" on the Multiplayer door and "start the manual
route" in the chair-table footer (lines 316–318); the chair-table footer offers **Join game**
(lines 319–321) inside the path the player entered by choosing Host; and the join view's Back is
`setView("pick")` (line 263), so a player who chose Join lands in the host's chair table. After
this, both Backs at that level go to `{ type: "showMenu", view: "multi" }`.

No tuppi rule, no score, no balance figure, no protocol message, no saved field and nothing under
`src/game/` or `src/net/` changes. `g.menu` keeps its five values: the third page is a third value
of `Lobby.tsx`'s existing component-local `view` state.

## Prior specs and documents

- **Overlaps `2026-09-08-trystero-rooms` (delivered) and finishes what it left half done.** That
  spec's touch point for the lobby was "a Room button beside Host game and Join game, a code box",
  which is exactly the flat five-button footer and the two-heading join page this replaces. Its
  out-of-scope line "Deleting or shrinking the manual paste/QR route. It stays whole, tests
  included" **still holds and is re-pinned below**: the route keeps every capability, its codec,
  its QR and its tests, and only its rank and its name change. Nothing in `src/net/room.ts`,
  `seating.ts`, `session.ts`, `protocol.ts`, `signal.ts` or `qr.ts` is touched.
- **Overlaps `2026-09-08-webrtc-transport` (delivered) in its vocabulary, and this reading wins on
  the strings only.** That spec is titled for "the invitation carried by copy-paste or a QR code"
  and its criteria name the invite code and the answer box. The mechanism is unchanged; the words
  **invitation code** / **answer code** and their Finnish **Kutsukoodi** / **Vastauskoodi** are
  retired in favour of **Your code** / **Their code**, because host-vs-answer is protocol jargon
  and `net.bad.kind` exists precisely because players cross those two up. A reviewer should see
  this as a deliberate reversal of that spec's naming, not as drift.
- **Overlaps `2026-09-08-multiplayer-behind-one-door` (delivered) at the lobby's Back buttons and
  extends its own fix.** It changed the table view's Back from `"start"` to `"multi"` and left the
  join view's Back at `setView("pick")`; that leftover is bug 3 above. Its criterion that neither
  lobby view is a dead end, and that `grep -c "net.hangUp" src/components/screens/Lobby.tsx` is
  `0`, **is contradicted in one narrow place and this reading wins**: the room pages' escape hatch
  calls `net.hangUp` (see the criterion and the assumption), so that grep becomes `1`. The
  Multiplayer door itself, its session line and its Hang up button are untouched.
- **Leaves `2026-09-07-multiplayer-seat-selection-lobby` and `2026-09-08-race-starts-from-the-lobby`
  (both delivered) alone**, and criteria re-pin them: the four chairs, `net.setChair`,
  `net.seatsFor()`, `lobby.partner`, the `RaceLine` and Start's always-enabled behaviour do not
  move.
- **Corrects two documents that are now factually wrong.** `CLAUDE.md`'s known-gaps entry at lines
  996–1003 and `docs/multiplayer.md`'s stage-4 bullet ("The live handshake is unverified") and
  stage-5 paragraph ("Unverified, and one step further out") all say no browser has completed
  either handshake. The user reports both routes now play manually. **`README.md`'s "Playing with
  other people" section never learned about rooms at all** — `2026-09-08-trystero-rooms` listed
  `CLAUDE.md`, `docs/multiplayer.md` and `Rules.tsx` as touch points and not the README — so it
  still describes the code swap as the only way to connect. That is pre-existing drift this spec
  catches and fixes rather than leaves.
- **Not already delivered.** Today `Lobby.tsx` has `useState<"pick" | "join">`, five flat buttons
  in the chair-table footer, both routes stacked under two `<h3>`s on one join page, `LanSwitch` on
  the chair table and on the join page, and no string anywhere containing "Other ways", "Code swap"
  or "Koodien vaihto".

## Acceptance criteria

- [ ] **The host's chair table footer is four buttons and names the route it starts.** In
      `Lobby.tsx`'s final `return` (today lines 305–325) the `.lobbyfoot` row holds, in DOM order:
      `btn.startMatch` → `net.start()`, `btn.openRoom` → `net.openRoom(mine)`, `btn.otherWays` →
      `setView("more")`, and `btn.back` → `dispatch({ type: "showMenu", view: "multi" })`. The
      `btn.joinGame` button is gone and `net.invite` is **not** called from this view.
      `grep -c 'btn.hostGame\|btn.joinGame' src/components/screens/Lobby.tsx` is `0`, so the label
      that did double duty now has exactly one meaning — the Multiplayer door's, which is
      unchanged. Tests in both locales assert the four labels, the four effects, and that clicking
      Other ways to connect dispatches nothing.
- [ ] **The join page holds the room and nothing else, and its Back leaves the lobby.** With
      `menu: "join"` and no session the page renders `lobby.joinTitle`, `lobby.roomHint`, the
      `#roomcode` input, `btn.joinRoom` → `net.enterRoom(roomCode)`, `btn.otherWays` →
      `setView("more")` and `btn.back` → `{ type: "showMenu", view: "multi" }`. It renders no
      `#hostcode` textarea, no `btn.join`-shaped code-swap control and no `LanSwitch`.
      `grep -c 'setView("pick")' src/components/screens/Lobby.tsx` is `0` — bug 3 — and the
      delivered "joins a room with the typed code" case still passes with `net.enterRoom` called
      with the untrimmed `"abcd1234"`.
- [ ] **One method list, parameterised by side, with one row written as a literal.** `Lobby.tsx`
      declares exactly one component for the Other-ways page, taking the side as a prop (a
      `joining`-shaped boolean, not two page components); `grep -c 'lobby.moreTitle'` and
      `grep -c 'className="methods"'` in that file are each `1`, and no `METHODS` array or
      `Record<…, LocaleKey>` method table is introduced. The page renders `lobby.moreTitle`, one
      `.method` element headed `lobby.swapTitle` with `lobby.swapWhy` as its dek, and `btn.back`
      returning to the page it came from — `"pick"` on the host side, `"join"` on the join side,
      asserted separately for both. On the host side the method's button is `btn.swapHost` and
      calls `net.invite(mine)` once; on the join side it is `btn.swapCodes`, the `#hostcode`
      textarea is present, and clicking it calls `net.join` with the typed text.
- [ ] **Nothing about this reaches the state, the action union or the wire.** `MenuView` in
      `src/game/types.ts` still reads `"start" | "challenges" | "multi" | "lobby" | "join"`;
      `src/game/actions.ts`, `src/game/reducer.ts` and `SCOPE` in `src/net/protocol.ts` are
      unchanged, and `net/protocol.test.ts` passes unedited. The page is a third value of the
      existing `useState` in `Lobby.tsx` (`"pick" | "join" | "more"`), `GameState` gains no field,
      `SAVE_VERSION` stays **3**, and no file under `src/game/` or `src/net/` appears in the diff.
- [ ] **A room that cannot be reached says so and offers the other way, inline.** While a room
      session has not yet got everybody in — a guest with `net.seat === null`, or a host whose open
      chairs are not all `connected` — the room page renders one `.netescape` element carrying
      `lobby.roomTrouble` and a `btn.otherWays` button; clicking it calls `net.hangUp()` exactly
      once, dispatches nothing, and leaves the window on the Other-ways page for that side. It is
      **absent** once the guest is seated and once the host is `ready`, and absent from every page
      where `net.room` is `null`. Tested in both locales with `stubNet({ role: "guest", live: true,
seat: null, room: ROOM })` and with the delivered `inRoom()` helper.
- [ ] **`LanSwitch` renders on the code-swap pages only.** `grep -c '<LanSwitch />'
src/components/screens/Lobby.tsx` is `1` and the call site is inside the method-list
      component, so the switch appears on the host's and the join side's Other-ways page and
      nowhere else. Tests in both locales assert `container.querySelector(".lanswitch")` is `null`
      for the chair table, for the join page, for a host with a room open and for a guest in a
      room, and non-null on both Other-ways pages. `net.lan` and `net.setLan` are unchanged.
- [ ] **A `#j=` link still lands on the code-swap guest page with the box filled.** With
      `window.location.hash` set to `#j=<code>`, `Lobby` opens on `view: "more"` with the join
      side's method showing and `#hostcode`'s value equal to `codeInHash`'s result — from
      `menu: "join"` **and** from `menu: "lobby"`, since the link wins over the door it was opened
      behind (the side the page shows is `joining || fromLink !== null`). `src/net/signal.ts` and
      `codeInHash` are unchanged, and the QR still encodes `joinUrl(code)`.
- [ ] **The catalogue, `fi.ts` first, with the retired vocabulary gone from `src/i18n/`.** Added:
      `btn.otherWays` ("Muut yhteystavat" / "Other ways to connect"), `btn.swapHost` ("Aloita
      koodien vaihto" / "Start a code swap"), `btn.swapCodes` ("Vaihda koodit" / "Swap codes"),
      `lobby.moreTitle` (the same words as `btn.otherWays`), `lobby.swapTitle` ("Koodien vaihto" /
      "Code swap"), `lobby.swapWhy` — which states the route's own reason, that the browsers meet
      with **no relay in the middle and nobody on the network path**, and does **not** describe it
      as something to try when a room fails — `lobby.yourCode` ("Koodisi" / "Your code"),
      `lobby.theirCode` ("Toisen koodi" / "Their code") and `lobby.roomTrouble`. Removed:
      `lobby.invite`, `lobby.yourAnswer`, `lobby.pasteHost`, `lobby.answerBox`,
      `lobby.manualTitle`, `lobby.joinDek`, `btn.join`. Reworded in place, keys unchanged:
      `lobby.hostTitle`, `lobby.hostDek`, `lobby.inviteReady`, `lobby.inviteGathering`,
      `lobby.answerHint`, `lobby.qrAlt`, `net.bad.format` and `net.bad.kind`. Afterwards
      `grep -rn 'Kutsukoodi\|Vastauskoodi\|kutsukoodi\|vastauskoodi\|invitation code\|answer code'
src/i18n/` finds nothing, `{n}` stays the only placeholder in `lobby.inviteGathering` in both
      catalogues, and `i18n.test.ts` passes.
- [ ] **The render sweep covers both new pages in both languages.** `src/test/render.test.tsx`
      gains entries for the host's Other-ways page and the join side's Other-ways page in the
      net-stubbed sweep beside the delivered `["the lobby joining", "join", () => stubNet()]`, each
      checked by the existing `check()` for no `undefined`, no `[object Object]`, no `NaN`, no
      leaked catalogue key and no Finnish stopword in English output. The delivered lobby cases
      that name the removed strings — "joins with the code in the box", "says why a pasted code was
      refused" — are moved onto the Other-ways page rather than deleted.
- [ ] **The two documents the player reads say which route is the one to use.** `rules.mp`'s first
      entry in both catalogues names **Avaa huone** / **Open a room** as the way to connect and
      **Koodien vaihto** / **Code swap** as what sits behind **Muut yhteystavat** / **Other ways to
      connect**, with its no-relay reason; it no longer calls the second route "Isännöi peliä" /
      "Host a game", its LAN-only sentence says the switch belongs to the code swap,
      `tList("rules.mp")` keeps four entries in both languages so `i18n.test.ts`'s list-length
      check passes, and every `<b>` still renders through `<Rich>`. `README.md`'s "Playing with
      other people" section — which today never mentions a room — names the room as the way to
      connect (one eight-character code, read out, open chairs filled in arrival order, introduced
      by a public Nostr relay that is not ours and encrypted by the code), then the code swap behind
      Other ways to connect as the route with nobody on the network path, and says LAN only lives
      with the code swap; the start-menu paragraph at line 27 keeps its six choices in three groups.
- [ ] **The two stale verification claims are corrected precisely, and what is still unmeasured is
      kept.** `CLAUDE.md`'s known-gaps entry at lines 996–1003 is replaced by one entry saying that
      both routes have been played manually between two windows on `npm run dev` — so the codec,
      the QR, the relay, the sequencer, Nostr relay reachability and the peer ids the mesh hands
      out have all been seen to work end to end — and that this produced **no timing figure** for
      how long an arrival takes, and **no two-network result**: NAT traversal between two networks
      and TURN-less failure on a symmetric NAT stay unproven, and a relay unreachable from a given
      network stays ordinary failure. It claims no measurement and no LAN-only result that was not
      taken. `docs/multiplayer.md`'s stage-4 bullet and stage-5 closing paragraph are corrected to
      the same bounds. The known gaps for reconnect, AFK, nicknames, spectators and the unfiled
      race row are untouched.
- [ ] **Every gate is green and the two page sizes are measured in a browser.** `npm run lint`,
      `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and
      `npm run build` all pass; `useGameLoop` stays the only `setTimeout` call site, `Math.random`
      stays one call site, no module-level `let` is added, and `CLAUDE.md`'s test count is updated
      if `npm test` prints a number other than 1,299. With `npm run dev` at **1280x500** and
      **390x844**, recorded in the pull request for the join page and both Other-ways pages: no
      element of the footer covers a control at its own centre by `elementFromPoint`, every button
      is hit-testable, and the `.lobbyfoot.flow` decision is stated as a reading — the join page
      drops `flow` (and so gets the sticky footer) only if it is measured not to scroll at both
      sizes, and the comment in `Lobby.tsx` at lines 255–258 and the one in `src/index.css` at line
      1003, which both justify `flow` by the join page carrying two routes, are rewritten to
      whichever is true after the split.

## Assumptions

Nobody answered a question while these were written. Each is a reading that could have gone the
other way, and each is a consequence a reviewer should look for in the diff.

- **"Koodien vaihto" is unconfirmed Finnish, and it is the name the whole rename hangs off.** The
  user was asked and did not answer. It is used here for host ("Aloita koodien vaihto"), guest
  ("Vaihda koodit"), the method's heading and the rules panel. Of every string in this spec it is
  the one most likely to want a native ear; changing it later is four catalogue values and no code.
- **The CLAUDE.md correction is written to the weaker of the two readings of what was verified.**
  The user reports both routes now work manually but did not say whether it was two windows on one
  machine or two machines on two networks, nor whether an arrival was timed. The correction
  therefore claims only that both routes have been seen to connect and play, and keeps NAT
  traversal across two networks, symmetric-NAT failure and arrival time as unmeasured. If the
  checks were in fact run across two networks, the entry understates them and should be widened by
  whoever knows.
- **Taking `LanSwitch` off the chair table removes the ability to open a LAN-only room.**
  `useNetGame.openRoom` reads `lanRef.current` at the moment the room is opened, and after this the
  only page that can set it is reached _after_ choosing the code swap — so every room omits nothing
  and always uses STUN. This follows the requirement's reasoning (a room's signalling crosses a
  public relay regardless, so the label promises privacy it cannot give) and it is still a
  capability that exists today and will not tomorrow. A reviewer who disagrees wants the switch
  back on the chair table with a room-specific caption.
- **The room page's escape hatch hangs up.** A room session is live the moment `enterRoom` or
  `openRoom` is called, so reaching the code swap from a failing room means leaving the room; the
  button therefore calls `net.hangUp()` and then shows the Other-ways page. That is why
  `grep -c "net.hangUp" src/components/screens/Lobby.tsx` becomes `1`, contradicting a delivered
  criterion of `2026-09-08-multiplayer-behind-one-door`.
- **A host who escapes a room loses the chair plan.** `hangUp` resets `chairs` to `OFF_CHAIRS`, so
  the host lands on the Other-ways page with seat 0 as "me" and the other three as the game, and
  has to set the table again. Preserving the plan across a hang-up is a `useNetGame` change and is
  out of scope.
- **"Not everybody is in yet" is the failure state, because silence is what failure looks like.**
  Neither route has a timeout — `CLAUDE.md` says so, and `useGameLoop` is the only timer — so a
  blocked relay is indistinguishable from a host who has not started. The escape is therefore shown
  for the whole waiting period rather than after a detected failure, and `lobby.roomTrouble` is
  worded as "if nothing is happening, try another way" rather than as an assertion that the room has
  failed.
- **Seven catalogue values are reworded that the requirement did not name.** `lobby.hostTitle`
  ("Kutsut"), `lobby.hostDek`, `lobby.inviteReady`, `lobby.inviteGathering`, `lobby.answerHint`,
  `lobby.qrAlt` and `net.bad.format` / `net.bad.kind` all speak of a _kutsu_ or a _vastaus_. Leaving
  them would keep the retired vocabulary on the very pages the rename is for. The keys are kept,
  because the protocol reason they report has not changed; only their words move.
- **`net.bad.kind`'s chosen reading is "the code is from your own side of the swap."** The
  underlying condition is an offer pasted where an answer belongs or the reverse, which is the exact
  host/answer distinction being retired, so it is restated by side rather than by kind. If that
  reads as vaguer than the sentence it replaces, the alternative is keeping one piece of jargon
  precisely where players already stumble.
- **`btn.join` and `lobby.joinDek` are deleted along with the four keys the requirement named.**
  Their only readers were the join page's code-swap half, which is now labelled `btn.swapCodes` and
  `lobby.swapWhy`; a catalogue entry nothing reads is drift, the same reading
  `2026-09-08-multiplayer-behind-one-door` recorded when it deleted `btn.toMenu`.
- **The Multiplayer door's own two buttons keep their labels.** `btn.hostGame` and `btn.joinGame`
  stay on `Multi.tsx` meaning host and join, which is the meaning they never lost; naming the door
  after intent is the requirement's own structure. Only the chair-table footer's second, colliding
  use goes.
- **The README is edited although the requirement's blast radius did not list it.** It currently
  presents the code swap as the only way to connect and never mentions a room, so shipping this
  change without it would leave the project's front page describing the demoted route as the whole
  feature.
- **`docs/multiplayer.md` is corrected although the requirement named only `CLAUDE.md`.** It carries
  the same unverified claim twice, and `CLAUDE.md` points at it as where multiplayer's status lives;
  correcting one and not the other is how a document becomes the wrong one to trust.

## Touch points

- `src/components/screens/Lobby.tsx` — the `view` state gains `"more"`; the chair-table footer's
  four buttons; the join page reduced to the room; one method-list component holding the code swap,
  `LanSwitch`, the `#hostcode` box and the refusal warning; `.netescape` on both room pages; the
  `flow` comment at lines 255–258
- `src/i18n/fi.ts` then `src/i18n/en.ts` — nine keys added, seven removed, nine reworded,
  `rules.mp` rewritten
- `src/index.css` — `.methods`, `.method`, `.netescape`, hand-formatted, classes only, and the
  `.lobbyfoot.flow` comment at line 1003
- `src/components/screens/Rules.tsx` — nothing structural; `rules.mp` is a `tList` and the four
  entries stay four
- `src/test/render.test.tsx` — the chair-table footer's four buttons, the join page's contents and
  its Back, both Other-ways pages and their Backs, the room escape, the `LanSwitch` absences, the
  `#j=` link, and two sweep entries
- `README.md` — "Playing with other people": the room first, the code swap behind Other ways
- `CLAUDE.md` — the known-gaps entry at lines 996–1003, and the test count if it moves
- `docs/multiplayer.md` — the stage-4 verification bullet and the stage-5 closing paragraph

## Out of scope

- **Anything under `src/net/`**: `room.ts`, `seating.ts`, `session.ts`, `protocol.ts`, `signal.ts`,
  `qr.ts` and `rtc.ts` are untouched. No `SCOPE` entry, no `NET_VERSION` change, no new message.
- **Anything under `src/game/`**, `GameState`, the reducer, the action union and `SAVE_VERSION`.
  No `MenuView` value is added.
- **Deleting, shrinking or disabling the code swap.** It keeps every capability, its per-chair
  codes, its QR, its LAN-only switch and its tests; only its rank, its name and its page move.
- **A third connection route, a `METHODS` data table, or any shape built for a route that does not
  exist.** The one row is written as a literal, and the second method introduces the shape.
- **Reconnect, an AFK timer, nicknames, spectators, TURN, and a timeout on either route.**
- **Filing a race row on a guest's board**, and teaching `raceRowFor` which seat is looking — still
  the delivered debt in `docs/multiplayer.md`.
- **Hosting a main-game run across browsers**, and Tuppi-Rummikub over a session.
- **Preserving the chair plan across `net.hangUp`**, and any change to `useNetGame`.
- **The Multiplayer door's labels, its session line and its Hang up button.**
- **ARIA, focus order and keyboard routes** through the new page — accessibility stays the
  documented known gap.
