---
id: 2026-09-14-single-player-separate-from-multiplayer
title: Split the start menu into a single-player door and a multiplayer door
kind: ui
status: proposed
---

# Split the start menu into a single-player door and a multiplayer door

## What

The start menu asks the question it stopped asking on 13 September: **are you playing alone?** It
offers exactly three things and the language button — **Single player**, **Multiplayer**, **Rules**
— and a player who wants to play alone is never taken to the chair table. Behind Single
player are **Continue** (unchanged in meaning: resume the solo roguelike wherever it is, leaving a
parked challenge on the way), a **new roguelike run**, the list of all three alternate rule sets
— Tuppi-Rummikub, the Tuppi Race and Traditional Tuppi — each started against bots, and **SCORES**,
in the footer beside Back. Behind
Multiplayer is the lobby, which becomes multiplayer-only: its mode picker offers the two match modes
and the roguelike leaves it entirely, taking the "the roguelike is for one player" warning and the
peer gate with it.

No tuppi rule, no score, no balance figure and no byte on the wire changes. `NET_VERSION` stays
**6** and `SAVE_VERSION` stays **3**.

## Amendment, 14 September: SCORES moves behind the single-player door

Reviewed and reworked in the same branch. As first delivered this spec put **SCORES** on the start
menu beside Rules; it is on the **single-player screen** instead, and the criteria below are
rewritten rather than left standing with the code disagreeing with them.

**Why.** The board `ScoresModal` draws is `readScores()` alone — the solo roguelike's own top ten
on `tupatro-scores-v1`. Nothing else writes to that key: a challenge files on
`tupatro-challenge-<id>-v1`, a match on `tupatro-race-v1` / `tupatro-tuppi-v1`, and a networked
match files nothing at all. It is a single-player board, so it belongs behind the single-player
door with the run it records, and the menu is left as two doors, Rules and the language button.

**The consequence, stated rather than left silent.** The Single player door is
`disabled={net.live}` and refuses in its own handler, so with SCORES behind it **the roguelike's
board is unreachable from the start menu while a session is live.** That is **accepted**: the board
holds finished solo runs, no session writes a row to it, and a window in a session has no run of
its own on screen to compare against. Nothing else moves to compensate — the rail's own SCORES
button and the copies on `BlindSelect`, `Shop`, `DealEnd` and `CashOut` are explicitly out of
scope and stay where they are, because they exist for the overlay that covers the rail rather than
for this menu.

## Prior specs

This requirement moves a line that has now been moved three times. Every reversal below is
deliberate and the reviewer is meant to see it as one.

- **Contradicts `2026-09-13-lobby-first-solo-and-viewer` (on `main`) in its central criterion, and
  this requirement's reading wins.** That spec's _"The start menu stops asking whether you are
  playing alone or with other people"_, its _"Solo is the default plan and one click"_ criterion
  (lobby Start dispatching `newRun`), its _"Three modes, on the window and not in the state"_
  (`LobbyMode = "run" | MatchId`), its _"The roguelike is for one player, and says so"_ (`peersHere`
  and `lobby.runSolo`) and its _"The confirmation moves to the destructive click"_ (`RestartConfirm`
  calling `net.start()`) are all **withdrawn**. The stated reason is that the chair table in front of
  a solo player is what made the menu confusing. Everything else that spec delivered stands
  untouched: the in-play room code in `NetBanner`, the `"refused"` session status, the late-join
  record in `docs/multiplayer.md`, Hang up in the lobby footer, and the shared table's read-only
  guarantee.
- **Re-reverses `2026-09-07-new-game-skips-seat-picker` back on, one screen lower.** Its criteria
  that `newRun` is dispatched as a bare `{ type: "newRun" }` from a menu-side button and from
  `RestartConfirm`'s confirm are **reinstated** — but on the single-player screen, not on the start
  menu itself. Its criterion that `grep -rn '"lobby"' src/components/` finds the view only in
  `Screens.tsx` stays withdrawn: `Menu.tsx` dispatches the lobby view from the Multiplayer button.
- **Supersedes `2026-09-09-start-menu-solo-run` in placement, not in meaning.** Continue keeps every
  property that spec delivered — the `runStarted && (solo || parked)` predicate, `leaveChallenge`
  then `closeMenu` for a parked run, a `MoveButton` because of that dispatch — and moves one screen
  down. Its _"a live session cannot start a shared roguelike through the start menu"_ is met by the
  door instead of by two separate disabled buttons.
- **Supersedes `2026-09-06-start-menu-with-continue-and-challenges`'s button list and its
  `MenuView`.** `"challenges"` is replaced by the single-player view; Continue and New Game leave the
  menu's own markup.
- **Partly restores `2026-09-08-multiplayer-behind-one-door`.** A **Multiplayer** button is on the
  menu again and is the one door to the lobby — but `Multi.tsx` is **not** resurrected and
  `MenuView` gains no `"multi"`: the door opens the lobby directly, and hosting, joining, the mode
  and Hang up stay inside it exactly as `2026-09-13` left them.
- **Overlaps `2026-09-13-room-lobby-honest-ready-signal` and changes none of its decisions.**
  `othersInRoom`, `lobby.othersHere`, `lobby.alone`, `lobby.allHere`, `lobby.needAssignments`,
  `settled()`, `nobodyAnswered`, `startsAlone` and `canStart`'s seating-only meaning are all
  untouched. What does go is `peersHere`, whose only two consumers are the roguelike gate and the
  mode picker's warning — both removed here. That is a deletion, not a change of the readiness
  signal.
- **Overlaps `2026-09-12-fix-leave-challenge-desync` and confirms it.** `leaveChallenge` stays
  `local`, its exception list in `protocol.test.ts` stays length one, and `MoveButton` stays its
  only guard — which is why Continue is still a `MoveButton` after the move, and why
  `invariants.test.ts`'s pinned list of `leaveChallenge` sites has to name the new file.
- **Not already delivered.** Today `Menu.tsx` draws Continue, New game, Join a game and Challenges;
  `MenuView` is `"start" | "challenges" | "lobby" | "join"`; `LOBBY_MODES` is `["run","race","tuppi"]`
  and `net.match` defaults to `"run"`; `RestartConfirm`'s confirm calls `net.start()`;
  `Challenges.tsx` filters `race` and `tuppi` out of its list.

## Acceptance criteria

Each line is checkable by a named test, a named grep, or by reading a named file.

- [ ] **The menu is three offers and the language button.** `src/components/screens/Menu.tsx` draws
      Single player (`btn.singlePlayer`), Multiplayer (`btn.multiplayer`), Rules (`btn.rules`) and
      the `langbtn`, and no Continue, SCORES, New game, Join a game or Challenges
      button. It also draws the contextual return button (`menu.returnChallenge` /
      `menu.returnMatch` / `menu.returnGame`, `closeMenu` only) whenever `g.runStarted` — including
      a solo run, which today falls through to Continue. A case in `Menu.test.tsx` asserts the exact
      button-label set in both locales, with `runStarted` false and true, and that no label equals
      `translate(locale, "btn.continue")` or `translate(locale, "btn.scores")` in **either**
      catalogue. `grep -n "ScoresButton" src/components/screens/Menu.tsx` finds nothing.
- [ ] **Single player is the gated door, and the gate is enforced as well as drawn.** The button is
      a `MoveButton` that dispatches exactly `{ type: "showMenu", view: "single" }`, is
      `disabled={net.live}`, **returns early in its own handler while `net.live`** (a guard that is
      drawn and not enforced is one restyle away from gone), and is followed by `menu.singleLive`
      while live — one line giving both reasons: resuming a run walks out of a session, and these
      modes build a single-human board a guest cannot play. A render case asserts, for a live host,
      a live guest and a table, that the button is disabled or absent and that clicking it dispatches
      nothing, in both locales; and that offline it is enabled and dispatches exactly that action.
- [ ] **Multiplayer is the one door to the lobby, and stays open while live.** The button is a
      `MoveButton` dispatching exactly `{ type: "showMenu", view: "lobby" }` and carries no
      `disabled`, because the lobby footer is where Hang up lives. `Menu.test.tsx`'s delivered
      _"reaches a hang-up from the start menu in two clicks"_ case passes unchanged for host, guest
      and table.
- [ ] **`MenuView` swaps one member and the router follows.** `src/game/types.ts` has
      `MenuView = "start" | "single" | "lobby" | "join"`; `Screens.tsx` routes `"single"` to
      `SinglePlayer`; `src/components/screens/Challenges.tsx` is renamed to `SinglePlayer.tsx`.
      `render.test.tsx`'s `TABLE_MENUS` — a `Record<MenuView, true>`, so it fails to compile until
      the member is listed — covers `"single"` and finds no dispatch that moves the game and no
      `net` method called, and its offline vacuity guard follows menu → Single player → the new-run
      button to a `newRun` dispatch on a window that holds a chair.
- [ ] **The single-player screen holds Continue, a new run, and all three modes.** `SinglePlayer.tsx`
      draws, in this order: `single.title`, a dek, Continue (drawn only when
      `runStarted && (solo || parked !== null)`, dispatching `leaveChallenge` when parked and then
      `closeMenu`), a new-run button (`btn.newRun`) dispatching exactly `{ type: "newRun" }` when
      `!runStarted` and exactly `{ type: "openModal", modal: "restart" }` when `runStarted`, the list
      of **all** `CHALLENGES` rows with no id filter — three `li.chalrow` elements — each Play
      dispatching exactly `{ type: "startChallenge", id }` with **no** `seats`, and a footer
      (`.row.singlefoot`, separated from the list by a rule) holding a Back button dispatching
      `{ type: "showMenu", view: "start" }` and the `ScoresButton`, which dispatches exactly
      `{ type: "openModal", modal: "scores" }`. SCORES is an ordinary button, like Rules — it is
      `local` and reads rather than plays — while Continue, the new-run button and every Play
      are `MoveButton`s. Render cases assert each dispatch in both locales, and a case in
      `Menu.test.tsx` asserts SCORES is on this screen, inside `.singlefoot` and outside
      `.singlerun`, and absent from the start menu, in both locales.
- [ ] **That screen knows nothing about the network.** `grep -n "useNet\|net\.\|spectat" src/components/screens/SinglePlayer.tsx`
      finds nothing but the `MoveButton` import, and a render case for `menu: "single"` finds no
      `.seatpick`, no `.roominput`, no `.codebox` and no `.netescape` element, and text containing
      none of `lobby.name`, `lobby.roomTitle`, `lobby.startNote` or `lobby.readable` in either
      locale. The two match rows' descriptions (`challenge.race.t`, `challenge.tuppi.t`) lose their
      trailing chair-and-browser clause in both catalogues, so the rows describe a rule set and
      nothing else: `grep -n "toisessa selaimessa\|another browser" src/i18n/` finds neither row.
- [ ] **The lobby is multiplayer-only.** `LOBBY_MODES` in `Lobby.tsx` is `["race", "tuppi"]`;
      `LobbyMode` is deleted and `netContext.ts` types `match`/`setMatch` as `MatchId`, defaulting
      to `"race"` in `useNetGame.ts`, so `"run"` is a **compile error** rather than a filtered
      option; `useNetGame`'s `start` sends `startChallenge` only and its `newRun` branch goes;
      `peersHere`, `blocked`, the `runStarted` read and the `openModal restart` branch leave
      `Lobby.tsx` along with the `useGameState` import. `lobby.runSolo`, `lobby.modeRun` and
      `lobby.modeRunDek` are removed from both catalogues, and `i18n.test.ts`'s _"names the lobby's
      roguelike mode without interpolating anything"_ case goes with them.
      `grep -rn '"run"' src/hooks/ src/components/screens/Lobby.tsx` finds no lobby mode.
- [ ] **The restart confirmation belongs to the destructive click again.** `RestartConfirm.tsx`'s
      confirm dispatches exactly `{ type: "newRun" }` and calls no `net` method; its cancel
      dispatches `{ type: "closeModal" }` and returns to the single-player screen, since `g.menu` is
      still `"single"` underneath. Both buttons stay `MoveButton`s.
      `grep -rn "net.start()" src/components/` finds `Lobby.tsx` and nothing else, and
      `Menu.test.tsx`'s delivered restart case is rewritten to the new route and asserts the `newRun`
      dispatch and that cancelling leaves `runStarted` and the run intact.
- [ ] **The `leaveChallenge` site list moves with Continue.** `invariants.test.ts`'s pinned list is
      `ChallengeOver.tsx`, `RaceOver.tsx`, `SinglePlayer.tsx`, and its comment says what now holds
      the line: the Single player **door** is `disabled={net.live}`, so that dispatch is still
      unreachable in a session and `net.hangUp`'s five sites still do not gain a sixth.
- [ ] **Each row reads its own board.** A `race` or `tuppi` row reads `readRaceScores(id)` and draws
      `race.bestWon` for a won match and `challenges.noBest` otherwise; the `rummikub` row keeps
      `readChallengeScores(id)`. This is not cosmetic: `readChallengeScores("race")` reads the empty
      key `tupatro-challenge-race-v1`, so a row left on the challenge parser would report "no result
      yet" for every match ever won. A test seeds `tupatro-race-v1`, `tupatro-tuppi-v1` and
      `tupatro-challenge-rummikub-v1` and asserts the three lines, in both locales.
- [ ] **The roguelike's board is a single-player board, and the door may shut on it.** With SCORES
      behind `disabled={net.live}`, the start menu offers no route to `tupatro-scores-v1` while a
      session is live, and that is accepted rather than compensated for: no session writes a row to
      that key. The live-role case in `Menu.test.tsx` asserts the button is **absent** from the menu
      for a live host, a live guest and a table, and the rail's SCORES button and the copies on
      `BlindSelect`, `Shop`, `DealEnd` and `CashOut` do not move: a grep for `ScoresButton` under
      `src/components/` finds `ScoresModal.tsx`, `BlindSelect.tsx`, `Shop.tsx`, `DealEnd.tsx`,
      `CashOut.tsx` and `SinglePlayer.tsx`, and nowhere else.
- [ ] **Text.** `btn.singlePlayer`, `btn.multiplayer`, `btn.newRun`, `single.title`, `single.dek`,
      `single.runDek`, `single.modes` and `menu.singleLive` exist in both `fi.ts` and `en.ts` with
      matching placeholder sets; `menu.soloOnly` and `menu.noChallenge` are removed from both, and
      `grep -rn "menu.soloOnly\|menu.noChallenge\|lobby.runSolo\|lobby.modeRun" src/` finds nothing.
      `i18n.test.ts`'s parity, placeholder, list-length and stray-Finnish cases pass, and its
      `rules.mp` case is untouched — `rules.mp[0]` already says "**Multiplayer** on the menu" and
      becomes true again with no rewrite.
- [ ] **Documentation and gates.** `README.md`'s start-menu paragraph, its _Playing with other
      people_ and _Challenges_ sections, `CLAUDE.md`'s overlays paragraph, its lobby section, its
      `MenuView` and `leaveChallenge` notes and its start-menu Known gap, and `docs/multiplayer.md`'s
      first paragraph all name the two doors and no longer say New game opens the lobby; the
      test-count lines match what `npm test` prints. All five gates pass: `npm run lint`,
      `npm run typecheck`, `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`,
      `npm run build`. One browser reading is recorded in the pull request at **1280x800**,
      **1280x500** and **390x844**: the single-player screen with a run in progress (Continue, the
      new-run button, three rows and Back all on screen or reachable by scrolling `.overlay`, and
      every one of them hit-testable at 500 px height — the lesson `.replacepick` and `LaydownPanel`
      each learned), and the click count menu → Single player → new run.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The names are invented here.** The view is `"single"`, the component is
  `src/components/screens/SinglePlayer.tsx` (a rename of `Challenges.tsx`, so the file's history
  follows), and the new keys live under `single.*`. If the reviewer wants `"solo"`, the change is one
  literal and four key names.
- **The contextual return button stays, and is now drawn for a solo run too.** "Four things and
  nothing else" is read as the menu's fixed _offers_; Back to challenge / Back to match / Back to
  game is a control about the game already behind the menu, and deleting it would strand a player
  who opened the menu mid-match with no way down but a door labelled Single player. Drawing it for a
  solo run as well is new: it replaces the one job the old Continue did on that screen, so closing
  the menu stays one click from every game. **If the reviewer meant the menu to hold literally five
  elements, this is the line to object to.**
- **The whole `net.live` gate is the door's.** `SinglePlayer.tsx` does not read the net context at
  all — that is what makes "no network prose" enforceable by a grep rather than by taste — so the
  screen carries no disabled state and no explanation of its own. Inside it, the three flow controls
  are `MoveButton`s, which covers a shared table but not a live player holding a chair; a live player
  cannot reach the screen, because the door is disabled **and** refuses in its handler. A state with
  `net.live` and `menu: "single"` is reachable only by test injection.
- **`menu: "join"` stays in `MenuView` with no dispatch site left anywhere in `src/`.** The guest
  route is the lobby's own Join a game button, which switches the lobby's internal view. The member
  is kept because the requirement names only the `"challenges"` replacement, and because deleting it
  would also delete `Lobby`'s `joining` prop and the `#j=` deep link's landing logic. **That is a
  dead route the reviewer may reasonably ask to delete**, and it is left here rather than removed
  silently.
- **`net.match` defaults to `"race"` and the lobby can no longer start a roguelike at all.** With
  `LobbyMode` gone, the hosted-main-game gap in Known gaps now runs through the **seed dialog**
  alone: the rail's seed chip raises it, `newRun` is still a `flow` action, and that door is out of
  scope here. The gap narrows; it does not close.
- **The new-run button dispatches a bare `{ type: "newRun" }` — no `seat: you`**, unlike
  `GameOver`'s and `Victory`'s buttons. That restores the seat-0 single-player board pinned by
  `2026-09-07-new-game-skips-seat-picker`, and `useSeatSync` moves the window to it.
- **The race and Traditional Tuppi started from this screen are single-human boards**: no `seats` on
  the action, so `startChallenge` seats the owner and gives the other three chairs to the game. Their
  multi-human form is unchanged and still starts from the lobby.
- **The two match modes' descriptions are edited, which changes text the lobby also draws.** The
  clause removed ("every chair may hold a person at this screen, a person in another browser, or the
  game") is network prose on a single-player screen and stale on the lobby, where each person now
  uses a separate browser; the chair table and `lobby.startNote` say it there.
- **A single-player race or Traditional match still files its board row** on `tupatro-race-v1` /
  `tupatro-tuppi-v1` and is still never saved. Nothing about a challenge's persistence changes; the
  screen is a new door to the same modes.
- **No protocol change.** `SCOPE`, `guestMay`, `hashState`, `parseMsg`, every `NetMsg` shape and
  `NET_VERSION` 6 are untouched; `showMenu` stays `local`, so both doors move nothing on the wire.
- **The lobby's layout is otherwise left alone.** Removing one mode from the picker is the only
  change to its markup; the room page, the chair table, the code swap's pages and the readiness lines
  are not redesigned.

## Touch points

The files and functions this is expected to change. All real.

- `src/components/screens/Menu.tsx` — the three buttons, the door gate and its reason line, the
  return button's widened condition; Continue's markup and its `leaveChallenge` dispatch leave, and
  so does the `ScoresButton`.
- `src/components/screens/SinglePlayer.tsx` — renamed from `Challenges.tsx`: the id filter goes,
  Continue and the new-run button arrive above the list, the `ScoresButton` arrives in the footer
  beside Back, `ChallengeRow` picks its board per id.
- `src/components/screens/Screens.tsx` — the `"single"` route.
- `src/components/screens/RestartConfirm.tsx` — confirm dispatches `newRun`; the comment names its
  new raiser.
- `src/components/screens/Lobby.tsx` — `LOBBY_MODES`, `ModePick`, `peersHere`, `blocked`, `start`,
  the `useGameState` import.
- `src/game/types.ts` — `MenuView`.
- `src/hooks/netContext.ts` — `LobbyMode` deleted; `match`/`setMatch` typed `MatchId`.
- `src/hooks/useNetGame.ts` — `match` defaults to `"race"`; `start` loses its `newRun` branch.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the new keys, the removed keys, the two trimmed descriptions.
- `src/index.css` — the single-player screen's header block above `.challist` and the `.singlefoot`
  rule under it, inside the existing hand-formatted blocks.
- `src/components/screens/Menu.test.tsx` — the new button set, SCORES' new home, the door's gate,
  the restart route.
- `src/test/render.test.tsx` — the menu's dispatch cases, the single-player screen's three controls
  and its three rows, `TABLE_MENUS`'s `"single"` and the offline vacuity guard.
- `src/test/invariants.test.ts` — the `leaveChallenge` site list and its comment.
- `src/i18n/i18n.test.ts` — the retired `lobby.modeRun` case.
- `src/hooks/useNetGame.test.tsx` — `start` no longer sends `newRun`.
- `README.md`, `CLAUDE.md`, `docs/multiplayer.md` — the two doors, the lobby's two modes, the gap
  that now runs through the seed dialog.

## Out of scope

- **Any tuppi rule, any score, any balance figure, `SAVE_VERSION`, and any `GameState` field.**
  `src/game/{rules,scoring,ai,laydown,points,race}.ts` are untouched and no literal in
  `seats.test.ts` may move.
- **The protocol**: `SCOPE`, `guestMay`, `hashState`, `parseMsg`, `NET_VERSION`, the signalling
  codec and the QR encoder. No byte on the wire changes.
- **The room-first roster and the readiness lines** — names, assignment, removal, duplicate refusal,
  `othersInRoom`, `lobby.alone`, `lobby.allHere` — stay exactly as delivered.
- **Late join, reconnect, a retained action log and the `"refused"` status.** Documented in
  `2026-09-13-lobby-first-solo-and-viewer` and deliberately unbuilt.
- **The seed dialog and the rail's seed chip**, and the `newRun` they still dispatch.
- **Every other `ScoresButton`**: the rail's, and the copies on `BlindSelect`, `Shop`, `DealEnd` and
  `CashOut`. They exist because an overlay covers the rail, which the single-player screen does not
  change, and none of them moves.
- **A hosted main-game roguelike**: the one economy at `ownerSeat(g)` and the second-person strings
  in `MainDealEnd` and `GameOver` stay as they are.
- **Multi-human Tuppi-Rummikub and the multi-human laydown.**
- **Filing a board row for a networked match, and saving a networked run.** Both stay refused.
- **Accessibility.** No ARIA roles, labels or focus management beyond what the moved controls already
  carry; the rail's focus-order gap stands.
- **A television layout for the shared table**, and more than one table per session.
