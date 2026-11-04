---
id: 2026-11-04-politix-multiplayer-lobby
title: Play Politix with up to three people through the lobby, on the room route and the code swap
kind: rule
status: proposed
source: >
  Politix rule sheet, Touko Tahkokallio / Onni Games 2009
  (<https://lautapeliopas.fi/wp-content/uploads/2009/06/Politix_ohjeet.pdf>), pp. 1–2 and 6: 2–6
  players in two or three parties, parties and characters chosen "by lot or by agreement", and
  partners may not show each other their hands. This spec changes no Politix rule. It only lets
  people rather than the game hold the three playing seats that
  `2026-11-04-rework-politix-three-parties` already defines. Neither tuppi source (the Oulunsalo
  senior tuppi club rule sheet, Antti Auer, 9 September 2022, and <https://korttipeliopas.fi/tuppi>)
  covers this game.
---

# Play Politix with up to three people through the lobby, on the room route and the code swap

## What

Politix (id `"politix"`) shows up in the lobby's mode picker next to Multiplayer Tupatro, the Race,
Traditional Tuppi and Rock-Paper-Scissors. In a room, the host can put up to three players in
Politix's three playing chairs. On the code swap, the host gets invitations for exactly those
chairs. The game's own `pxMove` AI plays any playing chair nobody takes, and the fourth chair sits
out as the Politix rules already require. Each player sees only their own action cards. A shared
display shows the public felt and no hand. The result screen gives every window its own party's
result, and a display gets the winning party's name.

The single-player version of Politix does not change. All other modes keep byte-identical
behaviour, saves, goldens and boards. The only thing that moves for them is the `NET_VERSION` bump
the requirement asks for, which changes every room id and invitation code. That is a wire change,
not a behaviour change.

## Prior specs and documents

- **This spec reverses one line in each of two delivered specs.** That reversal is the reason this
  spec exists. `2026-11-03-add-politix-card-game-mode` (Assumptions: "Single player only … no lobby
  entry and no hashing"; Out of scope: "Multiplayer, the lobby, a shared table, `NET_VERSION`,
  `hashState`") and `2026-11-04-rework-politix-three-parties` (criterion 1: "`NET_VERSION`,
  `SCOPE`, `hashState`, `LOBBY_MODES` … are unchanged"; Out of scope: "Multiplayer Politix, a lobby
  entry, a shared table — still single player only") both rule out exactly what this requirement
  asks for. **This spec takes precedence for those lines only.** Every other part of both specs
  stays in force: the rules, the deck, the AI, the board, and the fact that a game cannot be
  resumed. Neither spec file is edited here.
- **Copies the shape of `2026-09-23-rps-two-player-multiplayer` (delivered) without changing what
  it delivered.** It reuses that spec's `LobbyId`, `playsChair`, `planFor`, `chooseMatch`,
  `seatsFor`, `PrivateTable` arm and result-screen hang-up. The one change to RPS code is that
  `playsChair` moves from `useNetGame.ts` into a shared module and gains a `"politix"` arm. Its
  `"rps"` answer stays the same, and `useNetGame.test.tsx`'s RPS cases must pass unedited.
- **Overlaps `2026-09-19-guest-reconnect-mid-match` (delivered) and gets reconnect for free.** The
  resume log is per-action and does not care which mode is running. A whole Politix game is
  30–150 turns (README's measured median band), roughly one sequenced action per turn, so it fits
  well inside `RESUME_LOG_MAX` (2000).
- **Overlaps `2026-09-16-shared-table-private-player-view` and
  `2026-09-19-private-table-layout-hand-placement` (delivered).** `PrivateTable` gets a Politix arm,
  just as it got an RPS arm. The display's read-only rule does not change.
- **Not already delivered:** `LOBBY_MODES` is `["tupatro", "race", "tuppi", "rps"]`, `LobbyId` is
  `MatchId | "rps"`, `hashState` has no Politix input, `hashing.due` is set only for `endTrick` and
  `resolveRps`, and `NET_VERSION` is **13** on `origin/main` (`e3aa317`).
- **The docs quote the wrong version, and that is fixed here as part of the work.** `CLAUDE.md`
  ("Current version **12**", twice) and `docs/multiplayer.md` ("**12** is the current version")
  were not updated when RPS's same-throw tie-break moved `NET_VERSION` to 13.

## Acceptance criteria

- [ ] **Politix is a lobby mode, typed through the lobby's own type.** In `src/game/types.ts`,
      `LobbyId` becomes `MatchId | "rps" | "politix"`. `MatchId` and `ChallengeId` do not change,
      and `matchModeOf("politix")` still returns `null`. `LOBBY_MODES` in `Lobby.tsx` becomes
      `["tupatro", "race", "tuppi", "rps", "politix"]`. `ModePick`'s best line gets a Politix
      branch that reads `readPolitixScores()[0]` and renders the existing `px.best` key. Passing
      `"politix"` to `readRaceScores` is a compile error. In both locales, `render.test.tsx`'s
      "draws a button per match mode" case grows to five names, and the host's room page has
      `.modepicks button[data-mode="politix"]`, enabled.
- [ ] **One `playsChair` decides which chairs a mode seats, and every site reads it.**
      `playsChair(m: LobbyId, p: Seat): boolean` is exported from `src/net/seating.ts`. It returns
      `p === 0 || p === 1` for `"rps"`, `p !== 3` for `"politix"` and `true` for every other mode.
      `useNetGame.ts` imports it for `seatsFor`, `planFor` and `chooseMatch`. `Lobby.tsx`'s
      `plays()` filter and the room host's chair-assignment list read it too, so the string
      `net.match !== "rps"` no longer appears in `src/components/screens/Lobby.tsx`.
      `seating.test.ts` pins all three answers for all four seats.
- [ ] **The lobby seats exactly Politix's three playing chairs, on both routes.** While
      `net.match === "politix"`, the room host's assignment list draws chairs 0, 1 and 2 only. That
      page and the code-swap host page both draw a new line, `lobby.pxThree`. `planFor(0)` opens
      chairs 1 and 2 and leaves chair 3 `"ai"`, so `invite()` builds two chair invitations plus
      the chairless display link. `seatsFor()` answers `["human", "human", "human", "ai"]` once
      both chairs are connected, and `["human", "human", "ai", "ai"]` while only chair 1 is.
      `chooseMatch("politix")` frees a room player sitting in chair 3 and leaves chairs 0–2 alone.
      A chair-3 peer that connected under another mode becomes a stray chair, and its warning reads
      a new `lobby.pxSitsOut` instead of `lobby.rpsSitsOut`. `net.canStart` does not change.
      `useNetGame.test.tsx` asserts the two-chair plan, both `seatsFor()` answers and the freeing of
      chair 3.
- [ ] **The sitting-out seat stays the delivered rule, `ownerSeat(g) + 3`.** `pxSetup`, its call
      in `startDeal` and `ownerSeat` are byte-identical. `reducer.test.ts` pins three cases.
      Seats `["human","human","human","ai"]` give `party[3] === null` and a non-null party for the
      other three. Seats `["ai","human","human","ai"]` make seat 1 the owner, so
      `party[0] === null`, `party[3]` is not null, and `nextTick` schedules `aiPolitix` for seat 3
      on its turn. For all seven non-empty sets of humans the lobby can produce (subsets of chairs
      0–2), no human seat has a `null` party.
- [ ] **The game's AI plays every empty playing chair, and only the host's clock moves it.**
      `pxMove`, `aiPolitix`, `nextTick` and `waitingSeat` do not change. A `session.test.ts` case
      runs a three-seat Politix match (host at 0, guest at 1, AI at 2) through the existing
      host/guest harness to the `politixover` screen, with `pxMove` deciding for both humans. It
      asserts that the guest's `hashState` equals the host's after every numbered action, and that
      `aiPolitix` reaches the guest's reducer only as a numbered `act`.
- [ ] **The hash covers Politix, and a Politix action triggers a comparison.** `hashState` in
      `src/net/protocol.ts` appends one Politix component **only when `g.politix !== null`**, so
      its input for every non-Politix state is byte-identical to `origin/main`. The component holds:
      `turn`, `turnNo`, `event`, `party`, `politicians`, each seat's hand uids **sorted**, the uids
      of `draw`, `discard`, `voterDeck` and `table` in game order, each seat's `scandals` uids and
      `burn` uid, and `collected` and `turns` in `PX_PARTIES` order. Both `hashing.due` sites in
      `src/net/session.ts` read one exported predicate, `hashAfter(a: Action): boolean` in
      `protocol.ts`. It is true for `endTrick`, `resolveRps`, `pxDraw`, `pxRest`, `pxPlay`,
      `pxDiscard` and `aiPolitix`. `protocol.test.ts` asserts that the hash moves when each listed
      Politix field changes and stays put when a hand is reordered, that `hashAfter` answers true
      for those seven types and false for `playCard`, and that `SCOPE`, `guestMay`, `parseMsg`, the
      `NetMsg` union and the two-entry exception list are unchanged.
- [ ] **`NET_VERSION` is 14, and every gate and document that names the version agrees.**
      `NET_VERSION` in `protocol.ts` is `14`. Its comment gets a sentence for v14: a v13 peer's
      lobby cannot seat Politix, its `hashState` has no Politix input, and its session never
      compares a hash after a Politix action, so a v13 peer in a Politix match diverges with no
      banner. The room id (`roomIdFor`) and the `hello` version check already read the constant.
      The literal `13` in `protocol.test.ts` and `session.test.ts` becomes `14`, and their test
      names stop saying "12". `CLAUDE.md`'s two "Current version" sentences, its Known-gaps version
      line and `docs/multiplayer.md`'s version paragraph all name **14** as current. That
      paragraph also gains the reasons for 13 and 14.
- [ ] **A hand is shown only to the window that holds it.** `PolitixTable` (the felt) still shows
      every seat's hand as a count only. `PolitixHand` draws `px.hands[useViewSeat()]` and nothing
      else, and a shared-table window draws no `Hand` at all (`App.tsx`, unchanged). On a
      spectating window, `PolitixPlate` drops its `px.hand` line. Politix's refusal toasts
      (`PX_TOAST`'s eight and `toast.pxNoBurnout`) carry `p: action.p`, so only the refused seat's
      window shows them. In both locales, `render.test.tsx` asserts two things. A player window at
      seat 1, in a state where seats 0–2 hold 4, 5 and 6 cards, draws exactly 5 cards in its hand
      zone. A spectating window draws no `.pxhandzone` and no `px.hand` text on the rail.
- [ ] **The private player view and the shared display both work for Politix.** The markup
      inside `PolitixTable` moves into a new `PolitixBoard` component in the same file, and
      `PolitixTable` wraps it in `.tablewrap > .felt.pxfelt` as before. When
      `g.challenge === "politix"`, `PrivateTable` draws `<PolitixBoard />` in `.privstage` instead
      of `<ModeBox />` and `<Panels />`, and `<Hand />` stays below it unchanged. If the board is
      taller than the stage it scrolls inside `.privstage` and never pushes `.handzone` off screen.
      `render.test.tsx` renders a player window with `net.tableHere` true and asserts the turn
      line, three politician areas and the player's own hand are present and no ModeBox text is.
      In a browser at 1280×800, 1280×500, 390×844 and 844×390, the Play and Draw buttons can be
      clicked. The PR records how this was checked; a temporary, uncommitted `App.tsx` bypass is
      acceptable, as RPS used.
- [ ] **The result screen is right on every window of a networked match.** In
      `PolitixOver.tsx`, Back to your run calls `net.hangUp()` when `net.live` and then
      dispatches `leaveChallenge`. A live, non-spectating window shows `net.leaveHangsUp`. While
      `net.live`, the board shows `disk` with no row merged in, exactly as `RpsOver` does. On a
      spectating window, the headline names the result rather than reading the default seat 0:
      new `pxOver.wonBy {party}` for one winner and new `pxOver.drawnBy {parties}` for a tie. A
      chair-holder's window still reads `pxOver.won` / `pxOver.drawn` / `pxOver.lost` from
      `screen.parties[useViewSeat()]`. Play again and Replay seed still pass `seats: g.seats`.
      `GameContext.tsx` does not change, because its `if (net.live) return;` already files no
      row. `invariants.test.ts`'s `net.hangUp` site list gains
      `src/components/screens/PolitixOver.tsx`. `render.test.tsx` asserts three things: one
      `politixover` payload reads won at the winning party's seat and lost at another, a display
      reads `pxOver.wonBy`, and Back calls the stub `hangUp` when live.
- [ ] **Single player and every other mode are untouched, and that is asserted.** `SOLO_MODES`
      still draws Politix. A `reducer.test.ts` golden plays a whole single-human Politix game for
      a fixed seed with `pxMove` deciding (`playPolitix`). It pins the final `turnNo`, `collected`,
      `turns` and `rngState` to the values `origin/main` produces for that seed, recorded before
      any `src/` edit. `seats.test.ts`'s pinned literals and 50-seed aggregate do not move.
      `git diff origin/main -- src/game/` touches only `types.ts` (`LobbyId`), `reducer.ts` (the
      Politix refusal toasts gaining `p`) and tests. `SAVE_VERSION` stays 3,
      `POLITIX_SCORES_VERSION` stays 2 and no storage key changes.
- [ ] **Text, docs and gates.** Both catalogues gain `lobby.pxThree`, `lobby.pxSitsOut`,
      `pxOver.wonBy` and `pxOver.drawnBy`, with matching placeholder sets. In both languages, the
      last item of `rules.politix` is rewritten to say that up to three people can play Politix
      from the lobby, that the game plays an empty playing chair, that each player sees only their
      own hand, and that a networked game files no board row; the list keeps its length. Four
      places describe the multiplayer route and stop saying "single player only" / "not in the
      lobby": README's "The challenges: Politix", `CLAUDE.md`'s Politix paragraph, `CLAUDE.md`'s
      `LOBBY_MODES` quotations and its sentence on which boards `Lobby` reads, and
      `docs/multiplayer.md`'s mode-picker list. `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` pass,
      and the PR reports the test count.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run.** This section is the reviewer's only warning about what was guessed.

- **The two "single player only" decisions are reversed on purpose.** Both Politix specs on `main`
  excluded the lobby, the hash and a `NET_VERSION` bump because a bump changes every mode's room
  ids. This requirement asks for the bump explicitly, so this spec takes precedence on those lines
  only.
- **The sitting-out chair is `ownerSeat + 3`, the rule as delivered, so it is not always chair 3.**
  The lobby offers chairs 0–2, and `ownerSeat` is the lowest-index human. If the host leaves chair
  0 empty, the owner moves to chair 1 or 2. Chair 0 (Seija) then sits out, and the AI plays chair 3
  (Sirpa) instead. Under every lobby-reachable seating, every human still plays: they sit within
  `owner…owner+2`. Fixing the sitting-out chair at 3 would change the rule the requirement says
  stays as it is. For that reason, `lobby.pxThree` does not name the chair that sits out, only that
  one does. **Reviewer: this is the one place the lobby's list of three chairs and the felt's
  three politicians can disagree about which character the game plays.**
- **The code-swap host is always chair 0**, because `Lobby.tsx` builds the plan from
  `net.chairs[0]` when no chair is `"me"`. This means the code swap always sits chair 3 out.
  `playsChair` is not asked about the host's own chair. If a future change let the host take chair
  3, `seatsFor` would mark the host `"ai"`, the same latent edge RPS's chairs 2 and 3 already have.
- **Hidden hands, decided per layer.** On the wire, a Politix action carries only the acting
  seat's uids (`pxPlay.cards`, `pxDiscard.uids`), and `guestMay` already limits a `"seat"` action
  to the sender's own chair. In state, every peer holds every hand, because the reducer is
  replicated. This is the devtools exposure the project already accepts for every mode. In the UI,
  only the viewing seat's hand is drawn, the felt shows counts, and a display draws no hand. No
  partner rule applies: three parties of one have no partners.
- **The refusal toasts become addressed (`p`).** Without that, one player's refused play would
  appear on every window. The Play button is disabled whenever `pxResolve` refuses, so this is
  almost never reached. The change is a few lines inside `reducer.ts`'s Politix section, and single
  player looks identical because the owner is the viewer. It is the only reducer edit, and it is
  the one place this spec goes beyond "lobby/net wiring".
- **The private player view draws the full public board, not just the hand.** The RPS precedent
  does the same, and so does the fact that the hand bar's target pickers name seats whose
  burnouts, scandals and politicians are only shown on the felt. A player who has to look up at
  the display to aim a scandal would be worse served. Scrolling inside `.privstage` is accepted on
  short windows.
- **A networked Politix game files no board row in any browser.** That gap is inherited from
  `GameContext.tsx`'s `if (net.live) return;` and from `politixRowFor` reading `ownerSeat`, the
  same gap CLAUDE.md records for the race and RPS. Both players see the correct result.
- **The hash is complete rather than minimal.** `rngState` and `uidSeq` would catch most
  divergences anyway. But the pile order, the table and the per-seat specials decide every later
  turn, and pinpointing a divergence at the turn it happens is what the banner is for. It is
  appended only for a Politix state, so the hash string for other modes does not change.
- **A comparison after every Politix seat or auto action**, including a refused one. A refused
  action leaves both peers in the same state, so comparing costs one message and tells nobody
  anything false.
- **No balance measurement.** The single-human path is byte-identical, and pinned by the golden.
  With people at the chairs, the decisions are theirs, so there is nothing to tune. The README's
  200-game sweep stays an all-AI measurement and says so.
- **No offline pass-and-play.** Two or three humans on one board can only be reached from a
  hand-built state. `useSeatSync` would follow `waitingSeat`, but no screen offers this.
- **`challenge.politix.t` is not changed.** It describes three parties of one competing for
  voters, which is true whoever holds the chairs. The lobby's own `lobby.pxThree` carries the
  seating fact.

## Touch points

- `src/game/types.ts`: `LobbyId` gains `"politix"`.
- `src/game/reducer.ts`: `PX_TOAST` refusals and `toast.pxNoBurnout` carry `p: action.p` (in the
  `pxRest` / `pxPlay` cases).
- `src/game/reducer.test.ts`: sit-out seat for lobby seatings, the single-human golden, the
  addressed toasts.
- `src/net/protocol.ts`: `NET_VERSION` 14 and its comment, the Politix `hashState` component,
  `hashAfter`.
- `src/net/session.ts`: both `hashing.due` sites read `hashAfter`.
- `src/net/seating.ts`: `playsChair` (moved from `useNetGame.ts`, with a `"politix"` arm).
- `src/net/protocol.test.ts`, `src/net/session.test.ts`, `src/net/seating.test.ts`: version
  literals, hash inputs, `hashAfter`, a networked Politix match, `playsChair`.
- `src/hooks/useNetGame.ts`: import `playsChair`. `match`/`setMatch` already typed `LobbyId`.
- `src/hooks/useNetGame.test.tsx`: two-chair plan, `seatsFor()`, `chooseMatch` freeing chair 3.
- `src/components/screens/Lobby.tsx`: `LOBBY_MODES`, `ModePick`'s Politix best line, `plays()`
  and the chair list through `playsChair`, `lobby.pxThree`, `lobby.pxSitsOut` for stray chairs.
- `src/components/table/PolitixTable.tsx`: extract `PolitixBoard`.
- `src/components/table/PrivateTable.tsx`: the `"politix"` arm.
- `src/components/screens/PolitixOver.tsx`: hang-up on Back, no row merged while live,
  spectator headline.
- `src/components/rail/PolitixPlate.tsx`: no hand line on a spectating window.
- `src/index.css`: `.privstage` scrolling for the Politix board only, placed after its base rule.
- `src/i18n/fi.ts`, `src/i18n/en.ts`: `lobby.pxThree`, `lobby.pxSitsOut`, `pxOver.wonBy`,
  `pxOver.drawnBy`, the last `rules.politix` item.
- `src/test/render.test.tsx`, `src/test/invariants.test.ts` (the `net.hangUp` site list).
- `README.md`, `CLAUDE.md`, `docs/multiplayer.md`.

## Out of scope

- Any change to a Politix rule: `pxSetup`, the sit-out seat, `pxResolve`, `pxMove`, the deck, the
  politicians, the events, scoring, `PX_TURN_CAP`. See
  `2026-11-04-rework-politix-three-parties`.
- Choosing the party or the politician in the lobby. Both stay drawn by lot.
- Four humans, the sheet's five-player rule, or seating anybody in the sitting-out chair.
- Filing a board row for a networked game, or making `politixRowFor` viewer-relative.
- Saving or resuming a Politix game, networked or not.
- An AFK timer, a forfeit, an AI taking over a dropped human's chair, or announcing a departure on
  the code swap.
- A Politix `Continue` on the lobby's return button beyond what `lobby.returnChallenge` already
  does.
- Any `SCOPE`, `guestMay`, `parseMsg` or `NetMsg` change. Politix's five actions are already
  classified.
- Fixing the latent "host at a chair the mode does not play" edge for RPS or Politix.
- New art or images, or any publisher text.

## Source

- **Politix rule sheet (Tahkokallio / Onni Games 2009), p. 1–2.** Two to six players split into
  two or three parties, and parties and characters are chosen "by lot or by agreement". Three
  parties of one (three players) is a legal setup and is the one `2026-11-04-rework-politix-three-parties`
  implements. Whether a seat is a person or the game is not a rule question; the sheet assumes
  people at every seat, and the AI at an empty chair is this game's own.
- **p. 6.** Partners may not show each other their hands. There are no partners here, and every
  hand is shown only to its own window in any case, which the UI criteria enforce.
- **Neither tuppi source applies.** The Oulunsalo senior tuppi club rule sheet (Antti Auer,
  9 September 2022) and <https://korttipeliopas.fi/tuppi> describe a different game. This spec
  does not touch tuppi's name, terms or rules.
