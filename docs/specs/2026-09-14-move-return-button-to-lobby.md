---
id: 2026-09-14-move-return-button-to-lobby
title: Move the start menu's return button into the multiplayer lobby
kind: ui
status: proposed
---

# Move the start menu's return button into the multiplayer lobby

## What

The contextual return — **Back to challenge** / **Back to match** / **Back to game** — leaves the
start menu and is drawn in the **lobby** instead, in each of the three footers a window with a live
session can land on: the host's room page, the host's code-swap page, and the guest's and shared
table's waiting page. It is gated on `net.live && runStarted`, so offline it is drawn nowhere and
the two Continues on the single-player screen are the whole of the way back.

The start menu loses its one control that read `GameState`, and a peer who opens the menu in the
middle of a match keeps a way back onto the felt that is not **Hang up** and not **Start**.

No tuppi rule, no score, no balance figure and no byte on the wire changes. `NET_VERSION` stays
**6**, `SAVE_VERSION` stays **3**, and `SCOPE` is untouched — `closeMenu` was already `local`.

## Why this is not cosmetic

A live window that opens the start menu today has four offers: the return button, **Single player**
(`disabled={net.live}`, and it refuses in its own handler), **Multiplayer**, and **Rules**. Delete
the return button with nothing put in its place and the menu becomes a room with no exit: the
lobby's own **Back** dispatches `{ type: "showMenu", view: "start" }` — back to the menu, not onto
the game — so the only ways out left are `net.hangUp()` and a Start that re-deals the match for
everybody.

**On a host that is also a freeze, and on a guest it is not** — the requirement's stated reason is
exactly true for one of the three roles. `nextTick` returns `null` while `g.menu` is set, and
`SCOPE` classifies the clock's actions `auto`, which only the **host** applies; a guest's timer
fires and its own table drops it, and the numbered action comes back from the host. So a guest's or
a table's open menu stops nothing for anybody else. What it does is leave that person staring at a
menu while a match they are a seat of is played without them, with no route back. Both are worth
fixing and only one of them is a freeze; see the assumption below.

## Prior specs

- **Contradicts `2026-09-14-single-player-separate-from-multiplayer` (same branch lineage, status
  `proposed`) in one clause of its first criterion, and this requirement's reading wins.** That
  criterion has `Menu.tsx` drawing "the contextual return button (`menu.returnChallenge` /
  `menu.returnMatch` / `menu.returnGame`, `closeMenu` only) whenever `g.runStarted` — including a
  solo run", and its assumption _"The contextual return button stays, and is now drawn for a solo
  run too"_ said so in as many words. **Both are withdrawn.** The button leaves that screen
  entirely, and the solo case it was widened to cover goes back to the two Continues one screen
  down, which is where that spec put every other run control. Everything else that spec delivered —
  the two doors, the door's double gate and `menu.singleLive`, SCORES behind Single player,
  `MenuView`'s `"single"`, `LOBBY_MODES`, the `MatchId` typing of `net.match`, `RestartConfirm`'s
  bare `newRun` — stands untouched.
- **Reverses one line of that same spec's "The lobby is multiplayer-only" criterion**, and the
  reviewer is meant to see it: that criterion has "the `runStarted` read and the `openModal restart`
  branch leave `Lobby.tsx` along with the `useGameState` import". `Lobby.tsx` **imports
  `useGameState` again here**, for `runStarted` and `challenge`. The reason the import left was the
  roguelike gate, and that gate is not coming back: `LOBBY_MODES` stays `["race", "tuppi"]`,
  `peersHere` stays deleted, `blocked` stays deleted and no `openModal restart` branch returns. What
  comes back is a read, for a control about the game **behind** the lobby rather than about the
  match the lobby starts.
- **Supersedes `2026-09-09-start-menu-solo-run` in placement, for the second time.** Its criterion
  _"A started challenge, match or shared roguelike also has its own return label, which only lowers
  the menu"_ survives in meaning — same three labels, same `closeMenu`, same reading of `g.challenge`
  rather than of the session, which is what its second follow-up fixed — and is delivered from the
  lobby, and only while a session is live. Its follow-up _"no way back to the parked run"_ is
  untouched: that is the single-player screen's Continue, not this button.
- **Overlaps `2026-09-14-per-challenge-continue` and confirms it.** That spec's per-row Continue,
  which dispatches a bare `closeMenu` when `g.challenge === row.id`, is half of the offline route
  this change leans on, and nothing about it moves. Its out-of-scope note about "a decision about
  what the start menu's return button then says" is narrowed by this change rather than answered: the
  button is not on the start menu any more.
- **Overlaps `2026-09-12-fix-leave-challenge-desync` and changes nothing in it.** `leaveChallenge`
  stays `local` and its exception list in `protocol.test.ts` stays length **one**: `closeMenu` is an
  ordinary `local` action that moves no field `hashState` reads, so it neither joins that list nor
  needs a `MoveButton` around it. The three `leaveChallenge` sites `invariants.test.ts` pins do not
  change.
- **Not already delivered.** `grep -n "menu.return" src/components/screens/Menu.tsx` finds three
  hits today and `grep -n "return" src/components/screens/Lobby.tsx` finds no such control;
  `Menu.tsx` reads `{ runStarted, challenge }` from `useGameState`, and `Lobby.tsx` imports no store
  hook but `useDispatch`.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

- [ ] **The menu draws no return button and stops reading the store.**
      `grep -n "useGameState\|runStarted\|challenge\|lobby.return" src/components/screens/Menu.tsx`
      finds nothing, so `Menu.tsx` reads only `useNet`, `useSpectating`, `useDispatch` and `useI18n`.
      `.menubtns` holds exactly four buttons in this order — `btn.singlePlayer`, `btn.multiplayer`,
      `btn.rules`, the `langbtn` — with `runStarted` **false and true** alike, in both locales, and
      exactly **two** `.menugroup` elements. `Menu.test.tsx`'s _"offers the two doors and nothing
      else with runStarted %s"_ loses its conditional first label and gains
      `lobby.returnChallenge` / `lobby.returnMatch` / `lobby.returnGame` to its both-catalogues
      not-contained list; `render.test.tsx`'s _"draws the menu's five buttons in order…"_ becomes a
      four-button case with `toHaveLength(2)` for the groups, and its _"offers no Continue on the
      menu at all"_ expects `4` for both values of `runStarted`.
- [ ] **The lobby draws exactly one, in a fixed place in each of the three live footers.** Built
      once in `Lobby.tsx` beside the existing `hangUp` const and rendered immediately **before**
      `hangUp` on every page that has one, so the `.lobbyfoot` button order, asserted by index in
      both locales, is: host-in-a-room `[btn.startMatch | btn.startAlone, the return, btn.hangUp,
btn.back]`; host on the code swap `[btn.startMatch, the return, btn.hangUp, btn.back]`; guest
      and shared table `[the return, btn.hangUp, btn.back]`. A case in `render.test.tsx`'s lobby
      block, keyed off the same four stubs its delivered _"hangs up and leaves %s by two separate
      buttons"_ case uses (`hostingNet()`, `inRoom()`, a live guest, a live table), asserts the
      order and that exactly one such button exists per page.
- [ ] **The gate is `net.live && runStarted`, and both halves bind.** With `runStarted: false` no
      return is drawn on any of the three pages; with a session not live the lobby's other pages —
      the offline chair table, the join page and Other ways to connect — draw none either, asserted
      by a both-catalogues label sweep like the delivered _"draws no Hang up on the offline %s
      page"_ case. The `net.live` clause is written even though `net.live` is `role !== "off"` and
      all three pages already test `net.role`; a comment in `Lobby.tsx` says so, so it is not
      simplified away by the next reader.
- [ ] **The label branch and the dispatch are the menu's, unchanged.** `challenge === "rummikub"`
      gives `lobby.returnChallenge`, any other non-null `challenge` gives `lobby.returnMatch`, and
      `null` gives `lobby.returnGame` — including a roguelike with more than one `"human"` seat,
      which must not read as a match. The click dispatches exactly `[{ type: "closeMenu" }]` and
      nothing else, and `gameReducer(g, that)` equals `{ ...g, menu: null }`. `Menu.test.tsx`'s
      _"returns to %s from the menu"_ and _"calls a shared roguelike a game rather than a match"_
      move into `render.test.tsx`'s lobby block, rendered with a live stub, and keep their
      assertions; the label is derived from `g.challenge` and never from `net`, which is the
      correction `2026-09-09-start-menu-solo-run`'s second follow-up made.
- [ ] **It is an ordinary `<button>`, not a `MoveButton`, and that is load-bearing.** `closeMenu` is
      `local`, moves no field `hashState` reads and is not the named `leaveChallenge` exception, and
      a `MoveButton` draws **nothing at all** while spectating — which would strand a shared table on
      a menu with only the banner's Leave left. The table's own case: `render.test.tsx`'s
      `TABLE_MENUS` sweep renders `menu: "lobby"` with **`runStarted: true`** so the sweep actually
      clicks this button, `onlyLocal(dispatch)` is still `[]`, and `net.start`, `net.invite`,
      `net.hangUp` and the rest of the method list are still uncalled.
- [ ] **Getting back into a match is two clicks and hangs nothing up.** For a live host in a room, a
      live host on the code swap, a live guest and a live table, a case walks start menu →
      `btn.multiplayer` → the lobby's return and asserts the dispatches are exactly
      `[{ type: "showMenu", view: "lobby" }]` then `[{ type: "closeMenu" }]`, with `net.hangUp` and
      `net.start` never called. `Menu.test.tsx`'s live-role case _"leaves the return label and the
      lobby door alone inside %s"_ is rewritten to drop its return click and keep the rest: the
      lobby door is enabled for host and guest, absent for a table, Rules is reachable, SCORES is
      not, and no `newRun` is dispatched.
- [ ] **Offline the two Continues are the whole route, and nothing new is added for it.** With no
      session, `grep` finds no `closeMenu` dispatch anywhere under `src/components/screens/` but
      `SinglePlayer.tsx`'s main Continue, its `ChallengeRow`'s Continue, and `Lobby.tsx`'s new one.
      A case asserts that offline, from a solo run and from each of the three challenge ids, the
      start menu holds no button dispatching `closeMenu` and the single-player screen behind it does
      — one Continue, whichever of the two it is — so the return is two clicks rather than one. The
      delivered cases _"continues the exact solo run at seat %s"_ and _"draws Continue for the game
      this window is already in, dispatching closeMenu"_ pass unchanged.
- [ ] **Text: three keys are renamed and nothing is rewritten.** `lobby.returnChallenge`,
      `lobby.returnMatch` and `lobby.returnGame` exist in `fi.ts` and `en.ts` with the values
      `menu.return*` carried, byte for byte ("Takaisin haasteeseen" / "Takaisin otteluun" /
      "Takaisin peliin", "Back to challenge" / "Back to match" / "Back to game"), placed in each
      catalogue's `lobby.*` block. `grep -rn "menu\.return" src/` finds nothing. `i18n.test.ts`'s
      parity, placeholder, list-length and stray-Finnish cases pass with no new case needed — the
      three values interpolate nothing.
- [ ] **Nothing on the wire, in the save or in the pure core moves.** `git diff --stat` touches no
      file under `src/game/` or `src/net/`; `NET_VERSION` is `6`, `SAVE_VERSION` is `3`, `SCOPE`,
      `guestMay`, `hashState` and `parseMsg` are byte-identical, and no literal in `seats.test.ts`
      moves.
- [ ] **The known gap is written down rather than fixed.** `CLAUDE.md`'s Known gaps gains a
      paragraph saying that the lobby's **Start** stays enabled while a match is under way —
      `net.canStart` is `players.size > 0 && every seat !== null` and knows nothing about `seq.n` —
      so a host who opens the lobby mid-match to use this button is one unconfirmed click from
      `net.start()`, which numbers and broadcasts a `startChallenge` that re-deals the match for
      every peer. It names `Lobby.tsx`'s `start`, `hostSession.canStart` and the `flow` scope of
      `startChallenge`, and says the fix is a confirmation or a `seq.n`-aware gate and is not in this
      spec.
- [ ] **Documentation.** `README.md`'s start-menu paragraph drops its "A started game also has
      **Back to challenge**…" sentence, and _Playing with other people_ gains the same sentence for
      the lobby's footer beside Hang up. `CLAUDE.md`'s overlays paragraph (the one that says "so the
      return button (`closeMenu`) puts the player back exactly where they were") and its
      start-menu Known gap name the lobby as the button's home; `src/index.css`'s comment above
      `.menugroup` says two groups rather than "up to three groups". The test-count lines in
      `CLAUDE.md` match what `npm test` prints.
- [ ] **Gates and one browser reading.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` all pass.
      Recorded in the pull request at **1280x800**, **1280x500** and **390x844**, in both locales:
      the host's room page mid-match with a four-button sticky `.lobbyfoot` — every one of the four
      on screen and returning itself from `elementFromPoint` at its own centre, wrapped onto two
      lines or not — and the same for the guest page's three.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The footer position is invented here: immediately before Hang up, on all three pages.** The
  requirement says "dropped into the three footers" and names no order. Before Hang up keeps each
  page's primary action (Start, where there is one) first and puts the two ways of leaving the
  screen — back into the game, or out of the session — next to each other. **If the reviewer wants
  it first on the host pages too, it is one line moved.**
- **It is styled `btn ghost`, not the solid `btn` it wore on the menu.** Start is the one solid
  button in a lobby footer, and a second solid button beside it competes with the page's own
  action. The label and the dispatch are unchanged; only the class differs from the button being
  moved.
- **"Back to match" and "Back" now sit in the same row, and the collision is accepted, not
  solved.** In Finnish they are "Takaisin otteluun" and "Takaisin", which is worse. The requirement
  fixes both labels, so neither is renamed here and no key's value is touched. **This is the line a
  reviewer should look at on the screen rather than in a test** — it is a wording judgement, not
  something an assertion can settle — and the two candidates if it reads badly are relabelling
  `btn.back` on the lobby's pages ("Valikkoon" / "To the menu") or dropping the word "Takaisin"
  from the return labels. Both are catalogue-only changes.
- **The requirement's stated reason is exact for a host and overstated for a guest and a table.**
  `SCOPE` marks the clock's actions `auto` and only the host applies them, so a guest's open menu
  freezes nothing for anybody else; what it does is strand that player. The change is made for both
  cases and the spec says which is which rather than repeating the stronger claim.
- **`runStarted` and not "a match is under way" is the gate, exactly as asked.** A host who opens a
  room while a solo roguelike is behind the menu therefore gets **Back to game** in the lobby's
  footer before any match exists, and clicking it lowers the lobby onto that run with the room still
  open and the banner still up. That is the delivered menu behaviour moved, not a new state, and it
  is right: there is a game behind the menu and this is the way onto it.
- **A guest who has joined a room and is waiting sees no return**, because `runStarted` is false on
  a browser that has started nothing — there is nothing behind the lobby to return to. The host's
  Start sets `runStarted` and `menu: null` on every peer through `startChallenge`, so the match's
  first action lowers the lobby by itself and this button is for the second visit, not the first.
- **The shared table gets the button too**, although the rail draws a table no Menu button
  (`!spectating` in `Rail.tsx`) and no numbered action lands a peer on a menu view since
  `leaveChallenge` became `local` — so a table with `g.menu` set is a test-injected state today. It
  is drawn because the guest and the table share one footer, splitting it would need a role test for
  no gain, and an ordinary `local` button that lowers a menu is exactly the shape Rules and SCORES
  already have on a table.
- **`Lobby.tsx` reads the store again**, which reverses one clause of the 14 September spec. Named
  in Prior specs above rather than done quietly, because that import was removed on purpose.
- **No new CSS rule.** `.lobbyfoot` is a `.row`, which is `flex-wrap:wrap`, so a fourth button wraps
  on a narrow screen and the sticky footer grows by one line. The browser reading is what confirms
  that costs nothing; if it does, the fix is a rule in the hand-formatted `src/index.css` and not a
  change to the button set.
- **The two label cases move to `render.test.tsx`'s lobby block rather than staying in
  `Menu.test.tsx`.** The lobby's footers are asserted there already, beside the hang-up case they
  are keyed off. `Menu.test.tsx` keeps only the negative: the menu draws none of the three labels,
  in either catalogue.
- **Nothing is done about a window that reaches the menu with no lobby to open.** A table's only
  route off the menu is the banner's Leave, as before; this button is drawn for it but the table has
  no way to the menu to begin with.

## Touch points

The files and functions this is expected to change. All real.

- `src/components/screens/Menu.tsx` — the `runStarted &&` `.menugroup` and its button, the `back`
  key branch, the `useGameState` import and the destructure; the comment paragraph about the return
  label goes with them.
- `src/components/screens/Lobby.tsx` — a `useGameState` import and a `{ runStarted, challenge }`
  read, one const beside `hangUp` holding the label branch and the button, and three renders of it:
  the room-first host footer, the code-swap host footer, and the guest/table footer.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `menu.return{Challenge,Match,Game}` renamed to
  `lobby.return*` and moved into each catalogue's `lobby.*` block; values unchanged.
- `src/index.css` — the comment above `.menugroup` ("Up to three groups in the one column"); no
  rule changes.
- `src/components/screens/Menu.test.tsx` — the button-set case, the live-role case
  _"leaves the return label and the lobby door alone inside %s"_, and the two label cases that move
  out.
- `src/test/render.test.tsx` — the menu's button-order and `.menugroup` count, the "no Continue"
  length, the new lobby footer cases, the moved label cases, and `TABLE_MENUS`' lobby row gaining
  `runStarted: true`.
- `README.md` — the start-menu paragraph and _Playing with other people_.
- `CLAUDE.md` — the overlays paragraph, the start-menu Known gap, the new Known gap about Start
  mid-match, and the test count.

## Out of scope

- **The lobby's Start while a match is under way.** `net.canStart` is seating only and stays that
  way; no confirmation, no `seq.n` gate and no disabled Start is added. It is written into Known
  gaps instead, which is what the requirement asks for.
- **`Other ways to connect` on the host's room page**, which calls `net.hangUp()` on the way, and is
  the other mid-match hazard on that screen. Untouched.
- **The rail's Menu button and its `!spectating` gate**, and every other route into `g.menu`.
- **Any tuppi rule, any score, any balance figure, `GameState`, `SAVE_VERSION` and the pure core.**
  `src/game/` is not touched at all.
- **The protocol**: `SCOPE`, `guestMay`, `hashState`, `parseMsg`, `NET_VERSION`, the signalling
  codec and the QR encoder. `closeMenu` was already `local`.
- **The start menu's other three offers** — the Single player door, its `menu.singleLive` line,
  Multiplayer and Rules — and the single-player screen behind the first of them, Continues included.
- **Relabelling `btn.back`**, and any other catalogue value. Only three keys are renamed.
- **Late join, reconnect, a departure announced to the other guests, and the `"refused"` status.**
- **The hosted main-game run**: its one economy at `ownerSeat(g)` and the second-person strings in
  `MainDealEnd` and `GameOver` stay as they are.
- **Accessibility.** No ARIA roles, labels or focus management; the rail's focus-order gap stands,
  and a fourth button in a footer inherits whatever tab order the DOM gives it.
