---
id: 2026-09-08-race-starts-from-the-lobby
title: Start the race from the multiplayer lobby, and give startChallenge the session's seat map
kind: ui
status: proposed
---

# Start the race from the multiplayer lobby, and give startChallenge the session's seat map

## What

The race stops being a row in Challenges and becomes **the mode the lobby starts**. The lobby's
four chairs — each of them the host, a person at this screen, an open chair a peer connects to, or
the game — are what pick `seats`, and Start dispatches `{ type: "startChallenge", id: "race",
seed, seats }`. With peers connected that action is numbered and broadcast, so a race is played
across browsers; with nobody connected the same button starts the same race hot seat against the
AI. `startChallenge` therefore takes a seat map instead of a `humans` count seated clockwise from
the parked run's owner, Challenges keeps only Tuppi-Rummikub, and the 1–4 player picker leaves
with the race.

Nothing about how the race is played changes: the declaration, sooli, _ryöstö_, the thirteen
tricks, the deal arithmetic and `RACE_TARGET` are untouched, and no figure in the README moves.
What changes is the route into the mode, the shape of the action that starts it, and three things
in the relay that a networked race needs and today does not have.

## Prior specs and documents

- **Contradicts `2026-09-08-webrtc-transport` (delivered) on one criterion, and this requirement's
  reading wins.** That spec says "the run it starts is the host's `newRun`" and that the lobby's
  host half "starts a run [that] carries the whole `seats` tuple". After this change the lobby
  starts a **race**, and **hosting a main-game roguelike run across browsers stops being reachable
  from any screen**. That is a reversal a reviewer must see rather than discover. The `newRun`
  action keeps its optional `seats`, and `createRun` its optional `table`, so the capability is
  parked rather than deleted — see Assumptions. Everything else that spec delivered stands: the
  four scopes, the host as sequencer and clock, `guestMay`, the signalling codec, the QR encoder,
  and the rule that a run with a live session is never written.
- **Delivers the debt `docs/multiplayer.md` names as "the first thing to fix if the race is to be
  played over the wire".** That list says a challenge cannot be started from inside a session
  because `startChallenge` rebuilds the seat map from `humans` clockwise and knows nothing about
  which chairs peers hold. This spec fixes exactly that, for the race. The document is edited in
  the same pull request: stage 3a gains its network, the "challenge cannot be started from inside
  a session" bullet is rewritten to the narrower truth (Tuppi-Rummikub cannot), and the "hosted
  main-game run has one economy" bullet is marked unreachable rather than fixed.
- **Narrows `2026-09-07-race-to-target-mode` (delivered) in two places, and reverses one.**
  Narrowed: "who is human is chosen on the race's own row in the Challenges list" becomes "in the
  lobby", and `Lobby.tsx`, which that spec deliberately did not touch, is now the mode's front
  door. Reversed: that spec put "two humans as partners against two AI, and any seating other than
  clockwise from the owner" **out of scope**, and its `humans: 1 | 2 | 3 | 4` made an all-AI board
  inexpressible _in the type_. A per-chair table expresses both, so partners-as-humans becomes
  reachable and the all-AI board is refused by a **runtime guard and a test** instead of by the
  compiler. Everything the mode does after the deal starts — `race.ts`, `RACE_TARGET`, the
  per-pair deal scoring, the busted-sooli reading, the board key `tupatro-race-v1`, the two-page
  rail, `waitingSeat` and `useSeatSync`'s hot-seat clause — is untouched.
- **Leaves `2026-09-07-new-game-skips-seat-picker` (delivered) exactly as it is.** New Game still
  dispatches `newRun` (or raises the restart confirmation) and still reaches no seat picker; a
  criterion below re-pins it byte for byte.
- **Overlaps `2026-09-06-tuppi-rummikub-challenge` (delivered) only in the action's shape.**
  Rummikub is dispatched with no `seats`, which is the same single-human board it has always
  built, and a criterion pins that it does not move. Its board, its laydown, its 60-second turn
  and its screens are untouched.
- **Overlaps `2026-09-04-resume-a-run-after-a-refresh`.** `SAVE_VERSION` stays **3** and no saved
  field is added, removed or moved: `humans` was never on `GameState` and `seats` already is. A
  race is still never saved and a live session still writes no run snapshot.
- Nothing here is already delivered. Today `Net.start()` composes a `newRun`, `startChallenge`
  takes `humans`, and the menu's Challenges button is disabled outright while a session is live.

## Acceptance criteria

- [ ] **`startChallenge` carries a seat map, not a count.** The action is
      `{ type: "startChallenge"; id: ChallengeId; seed?: string; seats?: [SeatKind, SeatKind,
SeatKind, SeatKind] }`; `humans` is gone from `src/game/actions.ts`, from `startChallenge` in
      `src/game/reducer.ts` and from every dispatch site. The reducer uses the given table when it
      names at least one `"human"` and otherwise falls back to one human at `ownerSeat(prev)` with
      three AI — the runtime guard that replaces the type-level "an all-AI board is not
      expressible". Tests in `reducer.test.ts`: a table of four `"ai"` yields exactly one human at
      the owner's chair and `waitingSeat(g) !== null` at the first gated phase; a table naming
      seats 0 and 2 survives verbatim, so two humans are partners; omitting `seats` entirely
      reproduces today's single-human rummikub board field for field. `SCOPE.startChallenge` stays
      `"flow"` and `protocol.test.ts`'s membership assertion is unchanged.
- [ ] **A race built from a table does not read the peer's own state.** With `seats` given,
      `hashState` of `startChallenge` applied to two different prior states — different `seats`,
      different `bestAnte`, one of them mid-run — with the same `id`, `seed` and table is **equal**.
      `parked` and `bestAnte` are the only fields allowed to differ, and the test says so by name.
      This is the lockstep requirement: a guest's own parked run must not move the race it
      receives. `src/test/bot.ts`'s `playRace(seed, policy, humans, maxDeals)` keeps its signature
      and composes the clockwise table itself, so `race.test.ts`'s cases and the README's
      reproduction recipe do not move.
- [ ] **`hashState` covers the fields a race can diverge in.** It gains `seats`, `challenge`,
      `raceDeal` and `raceScores`. `seats` is the sharpest of them: it decides whose clock ticks —
      `nextTick` returns `null` for a `"human"` seat — so a peer that thinks a chair is AI runs a
      step the other peer never sends, and today nothing would notice. Tests in `protocol.test.ts`:
      a state differing only in each of the four hashes differently, and the delivered assertion
      that each of the nine `local` actions leaves the hash unchanged still passes with no edit.
- [ ] **The relay stamps the seed, so every peer builds the same race.** While a session is live,
      the dispatch `useNetGame` hands down replaces a missing `seed` on `newRun` and
      `startChallenge` with `makeSeed()` before the action reaches the session. Today
      `net.start()` sends `seed: undefined`, every peer calls `normalizeSeed(undefined)` and each
      draws its own seed — a divergence on action number one, which the delivered session tests
      never saw because they all pass an explicit seed. Tests: a seedless `startChallenge`
      dispatched through a live host session is broadcast with a non-empty `seed`; two wired
      sessions started that way hold equal `hashState`; offline the action reaches the reducer
      unchanged, with no `seed` field added.
- [ ] **The lobby's Start starts the race, hosted or alone.** `Net.start(seed?)` composes
      `{ type: "startChallenge", id: "race", seed, seats: seatsFor() }` and no longer a `newRun`,
      and goes through the same wrapped dispatch — offline straight to the reducer, hosted numbered
      and broadcast. `Lobby.tsx` carries a Start in **both** halves: the pre-invite table view's is
      always enabled (a `"me"` chair always exists), the host view's stays disabled until every
      open chair is connected, exactly as delivered. The flagship test extends
      `session.test.ts`: a host session and one guest session, each over its own `gameReducer`,
      start a race from a chair table with two human seats and play a whole deal with
      `basicPolicy`; afterwards `hashState` is equal on both and both are still in `challenge:
"race"`.
- [ ] **A chair is human or AI, at this screen or behind a connection.** `ChairKind` gains
      `"hot"`, and `seatsFor()` maps `"me"` and `"hot"` to `"human"` always, `"open"` to `"human"`
      only when its state is `"connected"`, and everything else to `"ai"`. The chair rows offer all
      four kinds and only one chair may be `"me"`, which `setChair` already enforces. This is what
      keeps the 1–4-people-at-one-screen race the Challenges picker delivered, and it reaches a
      table that picker could not: two humans as partners. Tests: `seatsFor()` over each kind and
      each chair state, including an `"open"` chair that never connected mapping to `"ai"`; an
      offline table of me + hot + ai + hot starts a race with three human seats.
- [ ] **Challenges keeps only Tuppi-Rummikub.** `Challenges.tsx` lists `CHALLENGES` minus the race
      row and holds no player-count control: `PLAYER_COUNTS`, the `humans` `useState` and the
      `race.players` control leave the file. `CHALLENGES` in `content.ts` keeps **both** rows,
      because `startChallenge` reads the race row's `deals`. Tests in `render.test.tsx`: the list
      draws one row, no click anywhere in it dispatches `startChallenge` with `id: "race"`, and
      Back still returns to the menu.
- [ ] **The race is named and scored where it is now started.** The lobby's table view names the
      mode through `nameOf` / `descOf` of the race's `CHALLENGES` row and draws the best-result
      line the race row used to carry — `t("race.bestWon", { deals })` for a won match,
      `t("challenges.noBest")` otherwise — read through `readRaceScores()` from `game/storage.ts`,
      which stays the one door to `localStorage`. `Lobby.tsx` joins the named "a component may read
      a board while it renders" deviation, and CLAUDE.md's list and its count are updated to
      include it. Tests: a lobby rendered with a won race on the board shows the line;
      `invariants.test.ts`'s persistence check is unchanged and still passes.
- [ ] **RaceOver replays the table it was played at.** Play again and Replay seed dispatch
      `{ type: "startChallenge", id: "race", seats: g.seats }` — the second with `seed: g.seed` —
      and the `humans` count derived from `g.seats` is gone from the file. A four-chair match
      replays as a four-chair match, and over the wire the button is a flow action like any other,
      so every peer rebuilds the same race. Test: both buttons dispatch the state's own `seats`.
- [ ] **The menu's session gate stays for Tuppi-Rummikub and no longer stands in the race's way.**
      The Challenges button keeps `disabled={net.live}` and its explanatory line, whose text is
      reworded in both catalogues to name Tuppi-Rummikub rather than challenges in general —
      dispatched with no `seats` it still builds a single-human board, so a guest's chair would come
      back `"ai"` and stall. New Game's button and its `runStarted ? restart : newRun` branch are
      **byte-identical** after this change, Host a game and Join a game are untouched, and the
      render case asserting that no click on the menu or its confirmation reaches the seat picker
      still passes.
- [ ] **The text says where the race lives, in both languages.** `rules.race`'s line about "one to
      four people at one screen, chosen on the race's own row" and `rules.mp`'s first line are
      rewritten to say that the lobby is the race's route and that a chair may hold a person here,
      a person elsewhere, or the game; `challenge.race.t` says the same; the new chair kind and the
      lobby's Start line get keys added to `src/i18n/fi.ts` first and `src/i18n/en.ts` second, with
      matching placeholder sets. The rules panel and `README.md` are updated in the same pull
      request — the menu paragraph, "Playing with other people", the Tuppi Race section's route and
      seating bullets, and the balance recipe's `humans: 1`. `i18n.test.ts` and `render.test.tsx`
      pass, and the lobby renders in all four of its states (table, hosting, joining, guest
      waiting) in both languages with no `undefined`, no `[object Object]`, no `NaN`, no leaked
      catalogue key and no Finnish word from the stopword list in English output.
- [ ] **Every boundary that held still holds.** `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test` and `npm run build` all pass.
      `GameState` gains no field and none naming a session or a viewing seat; no file under
      `src/game/` imports `../net`; `useGameLoop` stays the only `setTimeout` call site;
      `Math.random` stays one call site in `rng.ts` and no component names `makeRng` or
      `Math.random`; no module-level `let` is added; `SAVE_VERSION` stays 3; a race is still never
      written to `tupatro-run-v1` and a live session still writes no run snapshot.

## Assumptions

Nobody answered a question while these were written. Each is a reading that could have gone the
other way, and each is a consequence a reviewer should look for in the diff.

- **"Each human or AI, peer-connected or local" is read as a fourth chair kind.** `ChairKind`
  becomes `"me" | "hot" | "open" | "ai"`, so a person at this screen is expressible without a peer.
  The other reading — only the host and connected peers are human — would have **silently deleted
  a delivered capability**, the 2–4-person hot-seat race, which the Challenges picker was the only
  route to.
- **`humans` is deleted rather than kept beside `seats`.** Two ways to say who sits where on one
  action is the drift this project keeps out of the reducer. The price is the type-level guarantee
  CLAUDE.md records — "an all-AI board is not expressible" — which becomes a runtime guard plus a
  test. If the guard is ever removed, `nextTick` stalls at the first gated phase with no error.
- **The lobby starts a race and nothing else.** Hosting a main-game roguelike run across browsers
  becomes unreachable from any screen. `newRun`'s optional `seats` and `createRun`'s optional
  `table` stay in place, exercised by `session.test.ts` and `seats.test.ts`, so the capability is
  parked for a later increment rather than removed — removing them would move `createRun`'s
  signature and the pinned goldens for no gain today.
- **Tuppi-Rummikub stays single-human and stays gated during a session.** Its laydown with two
  humans is untested territory and measuring it is not this change. The menu's disabled button and
  its line are kept for it alone.
- **A networked race files no row on any browser's board.** `GameProvider`'s `if (net.live) return;`
  sits ahead of the board writes and is **not** touched. The reason it is not simply moved:
  `raceRowFor` reads `ownerTeam(g)`, so each peer would file the run owner's pair's result rather
  than its own, and a guest on the losing pair would record a win. Fixing it needs the window's own
  seat inside a pure scores function, which is a change of its own. `docs/multiplayer.md` gains it
  as a named debt.
- **The seed is stamped only while a session is live.** Offline, `normalizeSeed(undefined)` already
  draws one and the behaviour is unchanged, so no test that inspects an offline dispatch moves.
- **An open chair with no peer connected counts as AI when Start is pressed**, rather than blocking
  Start. The lobby says so in one line; the alternative — a disabled Start with an unexplained
  reason — is the worse failure.
- **The lobby's Start reuses `btn.startMatch`** and the mode's name and description come from the
  race's `CHALLENGES` row rather than from new lobby strings, so one catalogue entry names the mode
  everywhere it is offered.
- **`ownerSeat(g)` is still "the first human seat"**, so in a hosted race the run owner may be
  another browser's player. In a race that decides only cosmetics — whose pair `handScore` and the
  score pop describe, which seat's hand takes the sort mode, and whose result the board row would
  hold — and all of it is already the delivered mode's documented limitation.
- **The chairs are read once, when Start is pressed.** A peer that drops afterwards leaves a
  `"human"` seat with nobody behind it; the session's status is what reports that, and there is
  still no reconnect and no AI takeover.

## Touch points

- `src/game/actions.ts` — `startChallenge` loses `humans`, gains
  `seats?: [SeatKind, SeatKind, SeatKind, SeatKind]`; its comment records the all-AI guard.
- `src/game/reducer.ts` — `startChallenge(prev, id, seed, table?)`: the clockwise loop goes, the
  table is used when it names a human, `createRun(seed, prev.bestAnte, ownerSeat(prev), seats)`
  stays the one construction site.
- `src/net/protocol.ts` — `hashState` gains `seats`, `challenge`, `raceDeal`, `raceScores`.
- `src/hooks/useNetGame.ts` — `start()` composes the race; `send()` stamps a missing seed while a
  session is live; `seatsFor()` learns the `"hot"` chair.
- `src/hooks/netContext.ts` — `ChairKind` gains `"hot"`; the default context is unchanged.
- `src/components/screens/Lobby.tsx` — the fourth chair kind, the table view's Start, the mode's
  name and description, the race board's best line, the open-chair note.
- `src/components/screens/Challenges.tsx` — the race row and the player picker leave.
- `src/components/screens/RaceOver.tsx` — Play again and Replay seed carry `g.seats`.
- `src/components/screens/Menu.tsx` — only the gate's explanatory line; New Game untouched.
- `src/components/screens/Rules.tsx` — the race and multiplayer sections read the new route.
- `src/i18n/fi.ts` then `src/i18n/en.ts` — `lobby.kindHot`, the lobby's start and open-chair lines,
  `menu.noChallenge`, `rules.race`, `rules.mp`, `challenge.race.t`.
- `src/index.css` — the table view's Start row and the fourth kind button, if the row needs it.
- `src/test/bot.ts` — `playRace` composes the table; its signature does not move.
- `src/game/reducer.test.ts`, `src/game/race.test.ts`, `src/net/protocol.test.ts`,
  `src/net/session.test.ts`, `src/hooks/GameContext.test.tsx`, `src/test/render.test.tsx`,
  `src/test/invariants.test.ts` — the cases named in the criteria.
- `CLAUDE.md`, `README.md`, `docs/multiplayer.md` — the route, the action's shape, the board-reading
  deviation, and the debts this settles and leaves.

## Out of scope

- **Filing a board row for a networked race**, and teaching `raceRowFor` which seat is looking.
- **Hosting a main-game run across browsers**, and the economy question inside one. `newRun`'s
  `seats` stays; nothing dispatches it.
- **Tuppi-Rummikub over a session**, and any multi-human laydown.
- **A curtain over a hot-seat hand.** Whoever is at the screen still sees the seat that is to play;
  the rules panel keeps saying so.
- **Reconnect, an AFK timer, nicknames, spectators, TURN and automatic signalling** — still the
  transport's next increments.
- **Any rule or scoring change.** `RACE_TARGET`, the per-pair deal scoring, the busted-sooli
  reading and every measured figure in the README stand, and no re-measurement is asked for.
- **An economy or bosses in the race** — `docs/multiplayer.md`'s stage 3b.
- **Changing `SCOPE`'s four scopes, the nine `local` actions, `guestMay`, the signalling codec or
  the QR encoder.**
- **`leaveChallenge` staying `flow`**: any human's Leave still ends the match for everybody. Making
  it a per-seat concession is a separate decision.
- **ARIA, focus order and keyboard routes** through the lobby — accessibility stays the documented
  known gap.
