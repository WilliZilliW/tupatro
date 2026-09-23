# Tupatro

A browser game: the Finnish trick-taking game **tuppi** in Balatro's roguelike structure.

**Tupatro is the roguelike itself**, not one mode among several: the run with antes, blinds, money,
the shop, the jokers and the tuppipakka, `g.challenge === null`, the one **Single player** opens and
the only one `tupatro-scores-v1` records. Everywhere this file says _the main game_ or _the main
run_, that is Tupatro. Every `ChallengeId` is an **alternate rule set** beside it — and the one
whose id is `"tupatro"` is the lobby-only match mode **Multiplayer Tupatro**, named for the temput
it borrows from the roguelike. The id does not change: it is saved state, it is hashed on the wire,
and renaming it would cost a `SAVE_VERSION` and a `NET_VERSION` for a label. Read `"tupatro"` in
code as the mode, "Tupatro" in prose as the roguelike, and spell the mode out when it is the
subject.

**React 19 + TypeScript + Vite.** State lives in one `useReducer` store; the game rules are a
pure, framework-free core that the store calls. `npm run build` emits a static site to `dist/`,
which CI deploys to GitHub Pages.

Game description: [README.md](README.md).

Multiplayer, where it stands and what is left: [docs/multiplayer.md](docs/multiplayer.md).

**The game is bilingual: Finnish and English.** Every player-facing string lives in
`src/i18n/fi.ts` and `src/i18n/en.ts` and is reached through `t()`. **No player-facing string
literal belongs anywhere else in `src/`** — a test fails if one appears. Finnish is the
original and the fallback, because tuppi is a Finnish game.

Two things stay Finnish in both languages: the tuppi terms used _as_ terms (tuppi, rami, nolo,
sooli, ryöstö, näyttö, maantuntopakko, tuppipakka) — they are the names of the things, the way
"trump" and "trick" are, and the rules panel explains each — and the four seats' names (Seija,
Raimo, Veikko, Sirpa), who are characters rather than strings and live in `SEATS` in
`game/constants.ts`, never in a catalogue. Only the seat the window is drawn for is localised:
"Sinä" / "You", and which seat that is follows the viewing seat, not a fixed 0.

**Everything written for developers is English**: code comments, this file, the README, test
names and output, CI step names, `package.json` metadata, commit messages. Finnish appears in
`src/` only as _data_ — the strings in `fi.ts`, and the Finnish example words the render test
screens English output for.

## Commands

```bash
npm run dev        # Vite dev server with HMR on http://localhost:5173
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serve the production build locally
npm test           # vitest run — 2,858 permanent tests in the last reported run
npm run test:watch # vitest in watch mode
npm run typecheck  # tsc -b --noEmit
npm run lint       # eslint
npm run format     # prettier --write
```

`npm install` is required — React is a runtime dependency now, along with Immer.

## Requirement to pull request

Work enters this project as a **spec**, not as a chat message. `docs/specs/<date>-<slug>.md` is the
contract; `docs/specs/TEMPLATE.md` is its shape, and the spec is committed in the same pull request
as the code it describes.

```bash
/req "the requirement, in a sentence or two"   # quick: spec -> build -> gates -> push
/req --full "..."                              # + recon, audit, playtest, balance, mutation
/req --screen "..."                            # + an agent at the browser (normally your job)
/rework <branch> "<feedback>"                  # re-enter after review, same three modes
/verify [stage] [branch|commit]                # run the skipped stages against work that exists
```

`/req` is **quick by default** — four agents, no audit — so read the diff yourself; `--full` buys
back the whole pipeline, and nothing escalates to it on its own, a `rule` or `scoring` spec
included. **`/verify` is how you buy a stage back afterwards**, without re-running the pipeline: it
fans the same audit, mutation, balance, playtest and screen agents out over a diff that is already
there — a dirty tree, an unmerged branch, or a merge that has already landed. It writes no code and
pushes nothing, and with no stage named it runs exactly what quick mode skipped for that spec's
kind. Reach for it the moment a `rule` spec lands unaudited. **Looking at the running
game is yours**, in both: the pull request hands you the screen agent's own checklist under Look at
this in the browser whenever a change wants one, and `--screen` puts an agent at the browser
instead when that is inconvenient.

`/req` branches first: `spec/<date>-<slug>` off **`origin/main`**, before the spec is written.
Nothing in the pipeline commits to `main`, and no stage creates a branch of its own.

How that pipeline is built, staged and bounded: [.claude/workflows/README.md](.claude/workflows/README.md).

## Non-negotiable rules

1. **The pure core stays pure.** `game/cards` `constants` `content` `economy` `rng` `rules`
   `scoring` `ai` `shop` `schedule` `save` `types` `actions` take state as a parameter, never import
   React, never touch the DOM, never import the reducer or a component, and never import
   `i18n`. That boundary is what lets the rule tests run in milliseconds without a browser,
   and `invariants.test.ts` enforces every clause of it.
2. **The reducer is pure — really pure.** React's StrictMode calls it twice in development. The
   seeded RNG state (`g.rngState`) and the card-uid counter (`g.uidSeq`) therefore live **in the
   state**, not in module variables. `makeRng`/`makeMint` are short-lived cursors the reducer
   reads from state and writes back. A module-level counter would desync under StrictMode and
   break replay.
3. **No player-facing text outside `src/i18n/`.** Use `t("key")`, `tList("key")` for the
   rules-panel lists, `nameOf`/`descOf`/`emblemOf` for data-table rows, `seatName(p, you)` for
   players, and `fmt(n)` for numbers — thousands are grouped differently per language. `t()` is
   typed against the catalogue, so an unknown literal key is a **compile error**. Adding a string
   means adding the key to `fi.ts`; `en.ts` then does not compile until it has the key too.
4. **Tuppi's rules are never invented.** They are checked against a source. See below.
5. **Balance is never guessed.** It is measured, headlessly. See below.

## Tuppi's rules come from a source, not from memory

This game was first built wrong: tuppi was remembered as a whist-style trump game. Real tuppi
has **no trump suit at all**, and its core is the rami/nolo declaration, which was missing
entirely. The whole game logic had to be rewritten.

When touching the rules, verify against these:

- The Oulunsalo senior tuppi club's rule sheet (Antti Auer, 9 September 2022) — best source,
  the club's own
- <https://korttipeliopas.fi/tuppi>

The club's rule sheet beat both Wikibooks and the SEO content farms. Prefer the primary source.
Where a rule is open to interpretation, write the chosen reading into a comment.

The current implementation is documented in the game's own rules panel
(`components/screens/Rules.tsx`). **If you change a rule, update that panel and the README
too** — otherwise the game teaches the player something false.

## Architecture

Three layers, and the arrows only point one way:

```
game/          pure logic + the reducer      no React, no DOM
hooks/         the store, the clock, drag    React, no markup
components/    markup only                   read state, dispatch actions
i18n/          the catalogues and t()        data + one provider
```

**One deviation from "markup only", and it is named.** Eight components read a board while they
render, because the boards they draw are not part of `GameState`: `GameOver`, `Victory` and
`ScoresModal` call `readScores()` from `game/storage.ts`, `SinglePlayer` and `ChallengeOver` call
`readChallengeScores()`, `RaceOver`, **`Lobby`** and `SinglePlayer` again call
`readRaceScores()` — the lobby because it is where a hosted match is started, and the
single-player screen because each of its rows reads its own mode's board, which for the two
match modes is a `RaceRow` on its own key — and `RpsOver` calls `readRpsScores()`, the one board
that is neither shape: no ante, no blind and no score at all, only a result and a round count.
`SinglePlayer` reads one more thing while it renders,
which is not a board: each row and the roguelike's own Continue call `readChallengeRun` / `readRun`
to ask whether that mode has a game waiting, through the same door and under the same rule — a
component may _read_ the store, never write it directly. They still may not name `localStorage`
themselves — `game/storage.ts` is the one door, and the `persistence` invariant scans
`src/components/` as well as `src/game/` to keep it that way. A component may _read_ the store
through that door; nothing more.

**One state object.** Everything mutable lives on `GameState`, and `createRun()` defines every
key so nothing is ever `undefined` (a test checks that every field in the type is initialised).
Component-local `useState` is for genuinely local things only — the seed input's draft text,
the drag order mid-gesture.

**The reducer uses Immer.** `produce` lets `reducer.ts` read as though it mutated while
producing immutable state — the same pattern Redux Toolkit uses. Write to the draft; never
return it.

**Timing is data, not calls.** This is the part worth understanding before changing anything.
The game advances by itself in several places: opponents declare and play, tricks resolve,
hands end. `schedule.ts` answers a pure question about all of it — _given this state, what
happens next and when?_

```ts
nextTick(g); // -> { key, action, delay } | null   (null = waiting for the player)
```

`useGameLoop` sets one timer for that answer, and React's effect cleanup cancels it when the
step changes or the component unmounts, so **cancellation is not a separate concern** — a
pending timer can never be caught by a new run. The effect depends only on `tick.key`, not on
the whole state, or rearranging your hand would reset the opponent's turn timer.

Two consequences worth remembering:

- **A phase that does not change is a loop.** `nextTick` returns the same tick forever if the
  action does not move the state on. `handend` needed an explicit `if (g.screen) return null`
  because the phase deliberately stays `handend` while the result is on screen. The headless
  driver catches this class of bug (React's dep-keyed effect quietly hides it).
- **`useGameLoop` is the only `setTimeout` call site in the project.** A test asserts that.
  Everything time-based belongs there.

**Overlays are state, not calls.** There is no `showShop()`. `g.screen` is the flow-driven view
(blind select, shop, deal end, cash out, game over, victory), `g.modal` is the one the player
opened on top of it (rules, seed, restart, scores) and `g.menu` is the start menu and the three
views reached from it (`"start"`, `"single"` — everything played against nobody but the game, the
roguelike and all five alternate rule sets — and `"lobby"`, the chair table a game **with other
people** is configured at, whose own views are the room, the code swap and the way into either) a visit boots
into and the rail's New game button raises — three fields because closing the rules must return to
whatever was underneath. `Screens.tsx` draws them **modal → menu
→ screen**: a modal opened over the menu closes back to the menu, and the menu covers the screen a
resumed run is sitting on rather than replacing it, so the return button in the lobby's footer
(`closeMenu`) puts the player back exactly where they were. `nextTick` returns `null` while
`g.menu` is set, because the menu can go up mid-deal where `g.screen` is `null` and the opponents
would otherwise play on behind it.

**Anything with a side effect happens in the reducer, not while rendering.** A screen that
awarded money as it drew itself would pay twice on a redraw — a language switch is enough.
Rewards are computed in the transition and stored on the screen payload; the reducer guards
against a repeat, and a test holds the line.

## Module layout

| Module                          | Responsibility                                                                                          | Pure?      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| `game/types.ts`                 | Every shape in one place                                                                                | types only |
| `game/constants.ts`             | Suits, seats, `teamOf`/`sameTeam`/`partnerOf`, trick types, blind tables                                | yes        |
| `game/content.ts`               | `JOKERS` `ENH` `CONSUMABLES` `VOUCHERS` `BOSSES` (two pools) `PARTIES` `CHALLENGES`                     | data only  |
| `game/cards.ts`                 | Card creation (`Mint`), card queries, chip values                                                       | yes        |
| `game/economy.ts`               | `econOf(g, p)`: one seat's wallet, and nothing else                                                     | yes        |
| `game/rng.ts`                   | Seeded generator (`Rng`), seed handling, shuffle                                                        | yes        |
| `game/rules.ts`                 | Follow-suit, trick winner, who scores                                                                   | yes        |
| `game/scoring.ts`               | Trick types, tuppi multiplier, trick scoring                                                            | yes        |
| `game/laydown.ts`               | The challenge laydown: `pipValue` `isSet` `isRun` `comboOk` `validateLay`                               | yes        |
| `game/race.ts`                  | The race: `dealScores` `matchOver` `raceWinner` `seatOfTeam` `matchModeOf`                              | yes        |
| `game/points.ts`                | Tuppi's own point table: `dealPoints`, and nothing else                                                 | yes        |
| `game/nami.ts`                  | Nami's own point tables: `namiValue` `namiTrick` `NAMI_VARIANT`                                         | yes        |
| `game/rps.ts`                   | Rock-Paper-Scissors: `makeRpsDeck` `rpsThrowOf` `rpsCompare` `rpsWinner`                                | yes        |
| `game/politics.ts`              | Politiikka's own two arithmetics, half one: `politicsMode` (the rotation) and `sofiaIn` (the ♥Q's rule) | yes        |
| `game/puolue.ts`                | Politiikka's own two arithmetics, half two: `termOf` `governmentFor` `puolueValue` `puolueTrick`        | yes        |
| `game/ai.ts`                    | Opponent heuristics, sooli risk                                                                         | yes        |
| `game/shop.ts`                  | Shop stock rolling, sell values                                                                         | yes        |
| `game/state.ts`                 | `createRun`, hand sorting                                                                               | yes        |
| `game/actions.ts`               | The `Action` union                                                                                      | types only |
| `game/reducer.ts`               | `(state, action) => state`. The whole controller                                                        | yes        |
| `game/schedule.ts`              | `nextTick`: what happens next, and when                                                                 | yes        |
| `game/drive.ts`                 | Headless `advance`/`act` — no timers, no browser                                                        | yes        |
| `game/save.ts`                  | `dehydrate`/`rehydrate`: the run as a JSON-safe snapshot                                                | yes        |
| `game/scores.ts`                | The scoreboard row, its order and the top-ten truncation                                                | yes        |
| `game/storage.ts`               | `localStorage` for the best ante, the saved run and the scoreboard                                      | effects    |
| `net/protocol.ts`               | `SCOPE` `hashState` `parseMsg` `guestMay`: the whole of what a peer may do                              | yes        |
| `net/session.ts`                | The relay: the host numbers, a guest requests, the clock is the host's                                  | yes        |
| `net/signal.ts`                 | The invitation: an SDP compacted to a ~430-character code, and back                                     | yes        |
| `net/qr.ts`                     | A QR encoder, byte mode, level L, versions 1–25. No dependency                                          | yes        |
| `net/seating.ts`                | A room's two sides: waiting-room admission and which peer is the host                                   | yes        |
| `net/rtc.ts`                    | **The only file that names `RTCPeerConnection`**                                                        | effects    |
| `net/room.ts`                   | **The only file that imports `trystero`**                                                               | effects    |
| `hooks/netContext.ts`           | The session as the window sees it, and its no-op default                                                | React      |
| `hooks/useNet.ts`               | `useNet(): Net`, and `useSpectating(): boolean` — the table question, asked once                        | React      |
| `hooks/useNetGame.ts`           | The peer connections, the session, and the dispatch every consumer gets                                 | React      |
| `i18n/fi.ts` `en.ts`            | The catalogues; `fi.ts` is the source of `LocaleKey`                                                    | data only  |
| `i18n/index.ts`                 | `translate` `translateList` `formatNumber` `nameOfIn` …                                                 | yes        |
| `i18n/LocaleProvider.tsx`       | Locale as React state                                                                                   | React      |
| `hooks/seatContext.ts`          | The viewing-seat context and its setter's (default `0`, and a no-op)                                    | React      |
| `hooks/SeatProvider.tsx`        | `SeatProvider`: the viewing seat as `useState`, both contexts                                           | React      |
| `hooks/useSeat.ts`              | `useViewSeat(): Seat` `useSetViewSeat()`                                                                | React      |
| `hooks/useSeatSync.ts`          | The one writer of the viewing seat: follows `g.seats`                                                   | React      |
| `hooks/gameContexts.ts`         | The two contexts, so tests can inject any state                                                         | React      |
| `hooks/GameContext.tsx`         | `GameProvider`: the store + the clock                                                                   | React      |
| `hooks/useGame.ts`              | `useGameState` `useDispatch`                                                                            | React      |
| `hooks/useGameLoop.ts`          | The clock. **The only `setTimeout` in the project**                                                     | React      |
| `hooks/useHandDrag.ts`          | Pointer drag reordering of your own hand                                                                | React      |
| `components/rail/*`             | The wooden rail: `Rail` (strip, five pages, dots) and its plates                                        | markup     |
| `components/table/*`            | Felt, seats, trick slots, mode box, score pop                                                           | markup     |
| `components/table/PrivateTable` | Instead of the felt while a display is here: bar, mode box, panel                                       | markup     |
| `components/hand/*`             | Your hand, sort tools, the hint line                                                                    | markup     |
| `components/panels/*`           | Decision panels drawn **over** the felt                                                                 | markup     |
| `components/screens/*`          | Full overlays, the menu, the lobby, the `Screens` router; eight read a board                            | markup     |
| `components/MoveButton`         | A button that moves the game. The shared table draws none                                               | markup     |
| `components/pairLabels`         | `usePairLabels`: us/them from a chair, both pairs' names from the table                                 | React      |
| `components/PlayingCard`        | One card, everywhere                                                                                    | markup     |
| `src/test/*`                    | Render harness, card factories, the headless bot                                                        | tests      |

`g.phase` is one of: `blindselect` `swap` `declare` `soolioffer` `sooligive` `sooliready` `play`
`resolve` `trickend` `laydown` `handend` `shop` `rpsthrow` `rpsreveal`. **A new phase has four touch
points**: `nextTick`, `Panels`, `Hint`, and `SPREAD_PHASES` in `Hand.tsx` — Rock-Paper-Scissors'
own two are the one exception, since its `Hand.tsx` branch is keyed off `g.challenge === "rps"`
rather than the phase, ahead of `SPREAD_PHASES` entirely — the mode's hand is twelve cards clicked
one at a time and never spread. The render test sweeps every phase in both languages, so a
forgotten one fails there rather than in the browser.

## Adding or changing text

1. Add the key to `src/i18n/fi.ts`. `en.ts` is typed as `Catalogue`, derived from `fi.ts`, so it
   **will not compile** until it has the key too. Keys are flat and dotted: `area.thing`.
   Data-table rows carry their own key (`joker.ramikone`), and `nameOf`/`descOf`/`emblemOf`
   append `.n` / `.t` / `.g`. Only the parties have a `.g`: their emblem abbreviates the
   translated name, while every other table's `g` glyph is a language-neutral symbol and stays
   in `content.ts`.
2. Use `{placeholders}` for anything interpolated, and keep the same set in both languages — a
   placeholder present in one and not the other renders as literal braces. A test checks this;
   the type cannot.
3. Numbers go through `fmt()`, never `toLocaleString` with a hardcoded tag.
4. Need a formatted value _inside_ a sentence? Use `<Interpolate>`, which splits the translated
   string and drops a React node into the placeholder. Never `dangerouslySetInnerHTML`.
5. A string that emphasises a word carries `<b>`/`<i>` and must be rendered through `<Rich>`,
   which parses those two tags into `<strong>`/`<em>`. React escapes a plain string, so a
   catalogue tag rendered as `{t("key")}` prints as literal text — `render.test.tsx` fails on
   any tag reaching `textContent`.
6. Toasts are carried as `{ key, vars, suit?, nameKey? }` and translated in `Toasts.tsx` — the
   reducer does not know the language. `suit` is resolved through `suitPart.*` because the
   Finnish sentence takes a partitive.

**A diacritic search cannot find Finnish.** "palkkio", "tavoite", "Panos" and "Temput" each
survived a separate ä/ö sweep. So does a moved field: `j.n` is a property access, not a string
literal, so when joker names moved to the catalogue the UI silently printed `undefined`.

`src/test/render.test.tsx` is the guard for both. It renders every screen, panel and phase in
both languages and fails on `undefined`, on `[object Object]`, on `NaN`, on a leaked catalogue
key, and on any word from a Finnish stopword list appearing in English output. Extend the list
rather than trusting a grep. Match leaked keys against the **actual catalogue**, not a regex
shape — a shape-based check matched ordinary prose ("…blind." followed by "SIDE DECK") and a
brittle test is worse than none.

## The state is seat-absolute; the viewing seat is not in it

`GameState` does not mean "seat 0 is the human". Nothing in `src/game/` may assume it.

- **Teams, not us and them.** `teamOf(p)` is `p % 2` — tuppi partners sit across the table and
  seats are numbered clockwise — with `sameTeam(a, b)` and `partnerOf(p)` beside it in
  `constants.ts`. The old `isUs(p)` is gone. Trick counts are `g.tricks[team]`, one pair of
  numbers indexed by team, not the `usTricks` / `themTricks` pair they replaced. `scoresFor`,
  `tuppiInfo`, `tuppiMult`, `finalScore` and `scoreTrick` all take the team they are asked about,
  and `ScoreContext` carries that team plus the two seats it is made of, so the jokers that name a
  seat (`kaveri`, `etukasi`, `kaksoiskaveri`) and the `umpimahka` boss read the run owner and its
  partner instead of a numeric literal.
- **Who is human is data.** `g.seats` is `[SeatKind, SeatKind, SeatKind, SeatKind]`, `"human"` or
  `"ai"` each; single player is `["human", "ai", "ai", "ai"]`. `nextTick` returns `null` for a seat
  marked `"human"` and a tick for one marked `"ai"`, and `aiDeclare` / `aiPlay` / `aiLaydown` refuse
  on the same test. **No gate compares a seat with `0`.**
- **Every player action carries the seat it acts for.** `declare`, `finishSwap`, `pickSideCard`,
  `acceptSooli`, `declineSooli`, `sooliGive`, `startSooliPlay`, `layCards`, `passLaydown`,
  `setSortMode`, `reorderHand` and `moveCard` all take a `p: Seat`, and each reducer case opens by
  guarding that `d.seats[p] === "human"` and, where the phase is turn-based, that it is that seat's
  turn. Sooli is seat-absolute too: `d.sooliSeat` is the seat playing alone, and the sit-out, the
  bust test, the rotation and `sooliOrder`'s tail read it and `partnerOf(it)`.

**The viewing seat lives in a React context, never on `GameState`.** `hooks/seatContext.ts` holds
two contexts — the seat (default `0`) and its setter (default a **no-op**, so a window with no
provider simply cannot change seats) — `hooks/SeatProvider.tsx` the provider, which keeps the seat
in `useState` seeded from its `seat` prop, and `hooks/useSeat.ts` the `useViewSeat(): Seat` and
`useSetViewSeat()` hooks — the same three-file split `localeContext.ts` / `LocaleProvider.tsx` /
`useI18n.ts` uses, so the provider file exports components only and Fast Refresh keeps working.
`main.tsx` mounts it beside `LocaleProvider` and **outside** `GameProvider`. Components read the
seat from it rather than writing `0`: `Hand`, `HandTools`, `Hint`, the panels, `Table`, `Seats`,
`ModeBox`, `DealEnd`, `GameOver`. `Seats.tsx` and `Table.tsx` place a seat at
`POS[(p - you + 4) % 4]`, which is the identity at `you === 0`.

The reason it is a context and not a field: under the planned lockstep multiplayer every peer runs
the same reducer over the same actions and every peer's state has to be byte-identical, so "which
seat am I" would be the one field that differed — and the one field that could desync a replay. It
is a property of the window, not of the game. `invariants.test.ts` holds that line: it reads the
`GameState` block of `types.ts` and fails on a field named `you`, `viewSeat`, `self`, `me` or
`mySeat`, and fails on any file under `src/game/` importing the seat context.

**A run started at seat 0 is still bit-identical.** `game/seats.test.ts` pins that as literals for
three named seeds and an aggregate over fifty, and holds the rotation test that plays the same deal
with the human at each of the four seats and asserts the same winners, the same `tricks`, the same
declaration and the same `rngState`. It also plays whole blinds from seats 3 and 1 through the bot,
which is where a reducer guard hardcoded to seat 0 would stall.

**The lobby is what moves the seat, and one effect is what makes the window follow.**
`components/screens/Lobby.tsx` is the one place a game **with other people** is configured
(`g.menu === "lobby"`, reached from the start menu's **Multiplayer**, and the only menu view it has
— the room's code box, the code swap and the way into either are its own views, held in component
state and reached by its own buttons), and its Start is the **one `startChallenge` site with a chair
plan**: it carries the four chairs as `seats` — each chair this window's player, a peer, or the
game. **The lobby is multiplayer-only.** `LOBBY_MODES` is `["tupatro", "race", "tuppi"]`, `net.match`
is typed `MatchId` and defaults to `"tupatro"`, and `useNetGame`'s `start` sends `startChallenge` and
nothing else — so the roguelike is a **compile error** here rather than a filtered option, and the
`peersHere` gate that used to refuse it is gone with the mode it refused. **The other door is
`"single"`**: `components/screens/SinglePlayer.tsx` holds Continue, the new roguelike run and every
other alternate rule set, every one of them dispatched with **no `seats`** — the single-human
board. That screen knows nothing about the network at all; the **door** is what is gated, which
asks to hang up first — see `2026-09-16-confirm-hang-up-to-play-single` — rather than refusing
outright. The restart confirmation went back with the destructive click: `RestartConfirm`'s confirm
dispatches a bare `{ type: "newRun" }`, and `net.start()` has one call site, the lobby's. A render
case asserts no button on the start menu dispatches `newRun`, which is the same case
`2026-09-07-new-game-skips-seat-picker` installed, read the other way round. The chair plan is the
session's, never on `GameState` and never in the save.

**No chair is picked by hand, on either route, and the first page no longer offers to.** The
You / Open / AI table that used to sit above the mode picker decided nothing in a room —
`openRoom()` overwrites every chair with `"ai"` and `onLobby` rebuilds them from the roster the
host places its players in — and it stood on the same page as the line saying the host does the
placing, which is the control that lies `MoveButton.tsx` exists to forbid, drawn as a picker. So
`net.setChair` is gone from the context, from `useNetGame` and from the stub, `lobby.kindMe` /
`kindOpen` / `kindAi` and `lobby.partner` are gone from both catalogues, and the landing page is a
title, one line and the four ways out — see below for where the name and the mode moved.
**It no longer explains how the connection works, either**:
`lobby.readable` ("no server… every machine holds every hand") and `lobby.roomRelay` (the room's
public Nostr relay) moved to the pages where a session exists and this window is in it — the
host's room page, below the roster and the mode picker for the same fold reason as everything
else there, and the guest's or shared table's waiting page, below the status line, with
`lobby.roomRelay` guarded on `net.room` so the code swap is not told about a relay it does not
have. **The code-swap host page deliberately draws neither line**: the requirement named only the
room and the guest/table branches, so a host running a code swap reads "every machine holds every
hand" in the rules panel (`rules.mp`) and nowhere on this screen — see
`docs/specs/2026-09-15-move-lobby-connection-texts-into-room.md`. **The code swap keeps its chairs
by opening all of them**:
`planFor(mine)` marks the host's chair `"me"` and every other chair `"open"`, so `invite()` builds
three invitations and the display's, and a chair nobody answers is the AI's by `seatsFor()`'s
existing rule rather than by a kind somebody set. `.seatpick` is the room's two lists now — the
waiting-room roster and the chair assignment — and `.seatpick.selected` and `.seatpick .kinds` went
with the picker.

**That page's Start went with it, and `lobby.startNote` with that.** There are **two** Starts, both
a host's: the room page's, gated on `net.canStart`, and the code-swap host page's, gated on `ready`.
The third — on the page before a session exists — had no peer to wait for, so `net.start()` there
dispatched straight to the reducer and began a match against three bots: the single-player screen's
own two rows, minus the `single.replaceAsk` confirmation `ChallengeRow` asks before replacing a
saved match, and minus `ownerSeat(prev)`, since it sent a chair plan whose human was always seat 0.
It was load-bearing while the page had a picker to start from. The footer is now **Open a room ·
Join a game · Other ways to connect · Back**, with the room promoted to the primary button, and
playing alone is behind Single player where the confirmation lives. `render.test.tsx` asserts the
page draws neither `btn.startMatch` nor `btn.startAlone` in either language and that no footer
button reaches `net.start`, with a host's page as the vacuity guard.

**Open a room stopped acting from that footer, and gained a setup step of its own
(`2026-09-15-lobby-setup-steps-host-join`).** The landing page (`view === "pick"`) is a title, a
dek and the four footer controls and nothing else — the name field and the mode picker (with its
best-result line) both left it, one step down, for a fourth `Lobby.tsx` view, `"open"`. Open a
room there is a plain navigation button (`onClick={() => setView("open")}`, no `disabled`); the
real `net.openRoom()` call, gated on `validName`, lives on the page it opens, alongside
`<NameField />` and `<ModePick />`, under `t("lobby.openTitle")` / `t("lobby.openDek")`. That
page's own footer is two controls, Open a room then Back — the same shape the join page already
has — and Back returns to the landing page rather than the start menu. Each of the lobby's two
first-party routes now asks its own question on its own page: the host's for a name and a mode,
the guest's for a room code, and the landing page asks only which route.

`lobby.dek` was rewritten to name the choice between the two routes rather than instruct the
player to type a name into a field that is no longer on that page — `render.test.tsx`'s
`.lobbymode` markers for "the landing page" moved to `.lobbyfoot`/`btn.openRoom` accordingly, since
the mode picker they used to key off is gone from that page too.

**The join page asks one question and offers two buttons: Join a room and Back.** Other ways to
connect is gone from it — a second route beside the field is a second question asked before the
first is answered — and **Back is the table now, not the menu**: the page is one step inside the
lobby (the table's own Join a game opens it), so the step back is the step that was taken, and the
lobby is left from the table below by the Back that was always there.

**Which side of the code swap a window is on is the player's own answer now, not an inference.**
`SwapSide` is `"host" | "join"`, it is `useState` in `Lobby.tsx` seeded from the hash
(`fromLink !== null ? "join" : "host"`), and `SwapSidePick` — the same `.kind` two-button shape
`JoinAs` and `ModePick` use — is drawn under the swap's prose and above the box, so it decides what
the page draws. `lobby.swapSide` asks the question, `lobby.sideHost` / `lobby.sideJoin` are the two
answers ("I'm starting one" / "I have a code") and each carries its own dek.

**What it replaced was wrong in both directions.** The side used to be `guestSide = joining ||
linked`, where `joining` was the prop `Screens` passed for `g.menu === "join"` — a view **no button
ever dispatched**, since the table's Join a game is a local `setView("join")` — so at runtime the
side was `linked` alone, a `#j=` code in the hash at mount. Every route that is not a link therefore
arrived hosting side up, and a player handed a **raw** code had nowhere to paste it: not from the
join page's old Other ways button, not from the table's, and not from the escape on a guest's
waiting page. In the other direction a window opened from somebody's QR could only be the joining
side until it left the page, which is what `setLinked(false)` was for. Both are gone with the
inference: the hash seeds the switch and the switch owns it from there, across leaving the page and
coming back. **`menu: "join"` is gone**, and its removal is the rest of this: `MenuView` is
`"start" | "single" | "lobby"`, `Screens` has one lobby branch, and `Lobby` takes no `joining`
prop — the room's code box is a view inside the component, reached by the table's own Join a game,
and a `#j=` link reaches the swap by reading the hash rather than by a menu state. Tests walk to
that page now (`joinPage()` in `render.test.tsx` renders the table and clicks the button), because
setting an unreachable state by hand is what let a case assert, for as long as it passed, that a
guest taking a quiet room's escape landed on the paste box — in the running game it landed on the
host's page. `createRun(seed, bestAnte,
seat)` builds `seats` from a single chair, and `startChallenge` passes `ownerSeat(prev)` so
entering a challenge with no table does not move the player back to seat 0.

**`canStart` answers seating only, and whether anybody else is here is a second, separate
question.** `hostSession.canStart()` and `net.canStart` are `players.size > 0 && every seat !==
null`, and `openLobby` puts the host itself in `players` under `ROOM_HOST_ID` — so a host that
picked its own chair in a room nobody has answered satisfies both, which is correct (a room of one
may start, three chairs to the game) and was drawn as **"Everyone is here."** until the readiness
line stopped being one boolean. Both now carry a comment saying so, and folding solitude in would
break `seating.test.ts`'s _"removes a dropped player and frees its assignment"_. What answers the
second question is the lobby's own: `othersInRoom(net)` — the roster minus `ROOM_HOST_ID`. It used
to be the narrower of two predicates; `peersHere`, which also counted a settled chair and the
shared display, went with the roguelike gate it existed for. `lobby.allHere` is withheld until somebody else
is there, `lobby.othersHere` reports the number through `fmt()` in all three states, `lobby.alone`
states the consequence (the first numbered action locks the room for the rest of the match) and the
Start button swaps to `btn.startAlone`. **Start's enablement is `!net.canStart`**, with no clause
about company, because starting alone is a choice a host is entitled to make — and no clause about
the mode either, now that every mode the lobby offers is a match. The code-swap host page draws the same alone line when no chair is settled and no chairless
invitation was answered, and there a settled display _does_ count as somebody who turned up — two
predicates, on purpose, because a display is not a player in a room.

`hooks/useSeatSync.ts` is the **one writer of the viewing seat**: `GameProvider` calls it beside
`useGameLoop`, and with a single human it sets the context to `ownerSeat(g)` only when
`g.seats[you]` is not `"human"` and some seat is. The reason is that `g.seats` is saved and the
viewing seat cannot be — a run resumed at seat 2 would otherwise leave every panel dispatching for
an `"ai"` seat, every guard refusing, and the deal never advancing. It uses no timer;
`useGameLoop` stays the only `setTimeout` call site.

**With more than one human in an offline state it does make a choice: it follows `waitingSeat(g)`.**
This is mechanical rather than cosmetic — the panels dispatch for
`useViewSeat()` and the reducer refuses an action for a seat whose turn it is not, so without it a
two-human match stalls in silence with no error. **The clause sits ahead of the "already human,
leave it alone" early return**, because with two humans the window can be looking at a human seat
and still at the wrong one; a case in `GameContext.test.tsx` fails if it is appended after instead.
The multiplayer lobby no longer creates this state: each person uses a separate browser.

**Every seat reads as itself.** `SEATS` carries four characters — Seija, Raimo, Veikko, Sirpa — and
`SeatInfo` is `{ name, short }` with no key: `seatNameIn(locale, p, you: Seat | null)` returns
`"seat.you"` when `p === you` and the character's name otherwise, so "Sinä" / "You" follows the
window — and `null` is the shared table, whose window is nobody's chair, so every seat there reads
as its own character. `I18n.seatName` is `(p, you) => string` with **no default**, so the compiler
finds every call site. No catalogue string names a character — `grep "Veikko\|Raimo\|Sirpa\|Seija" src/i18n/` finds nothing — because a
character's chair is the player's to take; the nine strings that used to say "Veikko" name the
partner by relation instead ("kumppanisi" / "your partner"). What is still **not** done: rendering
two humans at once, and changing seats mid-run — `ownerSeat(g)` owns the wallet, so moving seats
would hand the player an empty one.

## The wallet belongs to a seat, and the seat is always a parameter

`GameState` has no `money`, no `jokers` and no `shop`. The seventeen fields that were the run's
live in a `PlayerEconomy` record — `money`, `jokers`, `consumables`, `vouchers`, `jokerSlots`,
`consSlots`, `shopSlots`, `chipBonus`, `tuppiBonus`, `sideDeck`, `sideSlots`, `swaps`, `swapsLeft`,
`usedSide`, `shop`, `shopAfterBoss`, `rerollCost` — and `g.economies` is four of them, one per
seat. `createRun` builds all four from one `newEconomy()`; the run owner's holds the shell and the
other three stay empty, which `invariants.test.ts` and a bot-driven blind both hold.

- **Every pure function that needs a wallet takes the seat whose wallet it is** and resolves it
  through `econOf(g, p)` in `game/economy.ts`: `chipValue`, `tuppiInfo`, `tuppiMult`, `finalScore`,
  `scoreTrick`, `rollShopStock`, `anySwapAvailable`. `econOf` is that module's only export.
- **There is deliberately no `myEcon(g)`.** The pure core is not allowed to learn who is looking.
  Under the planned lockstep multiplayer every peer runs the same reducer over the same actions, so
  a wallet resolved from the window would be the one value that differed between peers — and a
  card's chip value that depended on which window was open would desync a replay. The invariant
  greps **every** file under `src/` — tests and fixtures included, because a fixture helper is what
  reaches for such a name first, and `invariants.test.ts` itself is the one exemption since it has
  to spell the list — for `myEcon`, `localSeat`, `seatKind`, `usTricks` and `themTricks`: the four
  names the seat-absolute change replaced do not come back.
- **`scoreTrick` scores the side `scoresFor` picked, not the trick winner.** In nolo and in sooli
  those are opposites — the game scores the tricks a side _dodged_ — so the wallet it reads is the
  one `resolveTrick` already passes as `owner`. Handed the winner's, every dodged trick would score
  an empty purse. **What guards that choice is the pair of cases in `scoring.test.ts` and
  `reducer.test.ts`, not `seats.test.ts`'s golden.** `basicPolicy` never buys, so every wallet in a
  golden run holds no joker and a `chipBonus` of 0 — all four are indistinguishable and the golden
  passes with the wallet resolved from the winner. Do not cite it as proof of this decision; giving
  the measured policy a purchase would move every pinned literal.
- **The five economy actions carry a seat.** `buy`, `reroll`, `sellJoker`, `sellSideCard` and
  `useConsumable` each take `p: Seat`, each case opens with the same silent
  `if (d.seats[action.p] !== "human") return;` every other seat-carrying action has — ahead of
  every toast, `temppukielto`'s included — and each reads and writes `d.economies[action.p]`. The
  run-flow transitions that also move money (`skipBlind`, `toShop`, `cashOut`, `resolveTrick`'s
  payout) carry no seat and credit `econOf(d, ownerSeat(d))`.
- **One shop is rolled, for the owner.** Four shelves would draw four times the randomness and
  move every literal in `seats.test.ts`; an AI seat's shop has no buyer. `startDeal` does refill
  `swapsLeft` and `usedSide` for all four wallets — that costs no randomness.
- **A component reads `econOf(g, useViewSeat())`.** The rail plates, the shop, the replace picker,
  the swap panel and `Victory` all do, and `PlayingCard` prints `chipValue(g, useViewSeat(), card)`:
  the chip number answers "what is this card worth to me". In single player the viewer is the owner,
  so no printed number moved. `Slate`, `DealEnd`, `GameOver` and `CashOut` pass **two** seat-shaped
  arguments to `tuppiInfo` and they are different questions — the team is the viewer's side, the
  seat is `ownerSeat(g)`, whose wallet holds the jokers that pay for the multiplier.
- **Test fixtures fold.** `st({ jokers: [...] })` and `loadedState({ money: 20 })` still read that
  way: `splitEcon` in `src/test/factories.ts` sends an economy field named at the top level into
  seat 0's wallet, and `withEcon(g, p, over)` / `withOver(g, over)` are there for the cases that
  mean another seat.

## The transport is a relay, and the host is the clock

`src/net/` carries actions between browsers over WebRTC. There is no server of ours, and there are
**two routes to the same session** — above the door a room and a pasted invitation are
indistinguishable, which is why `role` is the same on both and `net.room` is what the lobby
branches on.

- **The manual route.** No signalling library at all: two `RTCPeerConnection`s are introduced by a
  string the players move between themselves — a clipboard, a chat window, or a QR code held to a
  camera. `signal.ts`, `qr.ts` and `rtc.ts` are its whole of it, and it is the route that needs no
  third party on the network path. It stays because of that.
- **The room route**, and the one a player will actually use: the host reads out eight characters
  and everybody types them. `room.ts` is the one file that imports **Trystero**, pinned at
  `0.25.3` over its default Nostr strategy, and it is to `trystero` what `rtc.ts` is to raw
  WebRTC. `seating.ts` holds the decisions — a named player enters unassigned, a table enters
  chairless, and a guest learns which peer is the host from the first message it receives, because
  the relay is a star and no guest ever messages another — so they are testable with no room at
  all, which is what `seating.test.ts` does. The host assigns the waiting-room roster through
  `hostSession.assign`; the first numbered action freezes those seats.

**`trystero@0.25.3` is pinned exactly, and the caret is a trap.** `0.25.4` publishes an empty
tarball — no `dist` — and so does every `@trystero-p2p/*` package at that version, so a range
would break the build the moment npm resolved to it. It is the project's first dependency that
costs real bundle: **+60.8 kB, +22.0 kB gzipped** (382.0 → 442.8 kB, 121.4 → 143.4 kB gzipped),
measured by building once with the import stubbed and once with it live. Nostr's `@noble/secp256k1`
is most of it, so a strategy switch is also a size decision.

**A room's code is its name _and_ its password.** `roomIdFor` puts `NET_VERSION` in the room id,
so two protocol versions cannot meet at all rather than meeting and being turned away by `hello`;
the code is handed to Trystero as its `password`, so a relay operator carries session descriptions
it cannot read. **`normalizeRoomCode` in `net/room.ts` is the one spelling of "typed code to
canonical code"**, and both halves go through it — `openRoom` normalises once and uses that value
for the password, the room id and the returned `Room.code`, and `enterRoom` calls it instead of
folding the string itself — because a password normalised differently from the id would put two
peers in the same room holding different encryption keys, with no connection and nothing on screen
to explain why. **LAN only means less in a room**: the signalling always crosses a public relay,
so there the switch would omit STUN and nothing more, which is why it is now drawn on the code
swap's own page alone. **Drawn there is not scoped there**, and the difference is a wart worth
knowing rather than a fixed thing: `net.lan` is the window's own state and `openRoom` /
`enterRoom` still read it through `lanRef`, so a player who ticks it on that page and walks back
can open or enter a room with STUN omitted and no label on any room page saying so — a room whose
peers can then only meet on one network. The rules panel is what says the switch belongs to the
code swap; no room page says anything about it. Scoping the flag to the route it is drawn on is a
`useNetGame` change and has not been made.

**The wire carries actions, not state.** Every peer runs the same reducer over the same ordered
stream from the same seed. That is what the seat-absolute state and the per-seat economy were
built for, and it is why a hosted game needs no new rule anywhere in `src/game/`.

- **The host is the sequencer and the clock.** It numbers every shared action, applies it once and
  broadcasts it. A guest's click is a _request_; what moves a guest's state is the numbered action
  that comes back. One sequencer makes the ordering trivially identical on every peer, and costs a
  guest one round trip on its own click — no optimistic application, and so no rollback.
- **`useGameLoop` did not change, and must not.** A guest's clock fires exactly as the host's
  does; `SCOPE` drops it. The whole integration is one function swapped: `GameProvider` hands every
  consumer `net.dispatch`, which offline _is_ the reducer's own dispatch.
- **`SCOPE` in `protocol.ts` is a `Record<Action["type"], Scope>`.** Adding a member to the
  `Action` union is a **compile error** until it is classified `local`, `seat`, `flow` or `auto`.
  Do not widen it to a partial map.
- **Nine of the eleven `local` actions are exactly the ones the hash ignores, and the other two are
  named exceptions that pay for themselves** — the open modal, the toast, the hand's order, the sort
  mode. A test asserts that pairing both ways, so a local action that starts touching a hashed
  field fails rather than desyncing. A hand's uids are **sorted** before hashing, because a guest
  dragging its own cards is not a divergence. **`leaveChallenge` is the first exception**: it
  restores _this_ window's own `parked` run, which is a different run on every peer, so it moves
  the hash — and it is `local` because the window that sends it **stops being a peer in the same
  click**, not because it touches nothing shared. **`resumeGame` is the second**: it restores this
  window's own localStorage slot, equally a different game on every peer, but it does not have to
  hang the session up itself the way `leaveChallenge` does, because it cannot be reached inside one
  at all — the start menu's Single player door hangs the session up in the same click that opens
  the single-player screen, through the `"hangup"` modal's confirm, so the window has already
  stopped being a peer before the screen that dispatches `resumeGame` is drawn — and every dispatch
  site is a `MoveButton` too. `protocol.test.ts` keeps the exception list at length **two**, so a
  third candidate has to argue rather than cite either as a precedent.
- **Nothing about the session is on `GameState`**, for the same reason the viewing seat is not:
  every peer's state has to be byte-identical. `invariants.test.ts` fails on a `GameState` field
  named `net` `peer` `peers` `conn` `channel` `session` or `host`, on any file under `src/game/`
  importing `../net`, on a second file naming `RTCPeerConnection`, and on a second file importing
  `trystero`. `room.ts` therefore cannot spell the connection's own class name even in prose, and
  says so where the comment would have gone.
- **The hash covers `seats`, `challenge`, `raceDeal` and `raceScores`** as well as the deal's own
  fields. `seats` is the sharpest of them: it decides whose clock ticks — `nextTick` returns `null`
  for a `"human"` seat — so a peer that thinks a chair is AI runs a step no other peer sends.
- **The relay stamps a missing seed.** The dispatch `useNetGame` hands down replaces an absent
  `seed` on `newRun` and `startChallenge` with `makeSeed()` **while a session is live**, because
  otherwise every peer calls `normalizeSeed(undefined)` and draws its own — a divergence on action
  number one. Offline nothing is stamped: the reducer already draws one, and an action reaching it
  unchanged is what the offline tests inspect.
- **One divergence is deliberate**: `bestAnte` is each browser's own, and the hash ignores it. No
  rule reads it.
- **No timers.** `useGameLoop` stays the only `setTimeout` call site. ICE gathering is awaited by
  event, and where it never finishes — a STUN server that answers nothing — the lobby hands over
  the code built from the candidates gathered so far rather than a deadline nobody chose.

**A peer may hold no chair at all: that is the shared table.** `GuestRole` is `"player" | "table"`,
it travels in `hello` — which is what took `NET_VERSION` to `2`, since a v1 host would seat a
display as a player and wait for its clicks for ever — and a table is welcomed with `seat: null`.
It is **a chair nobody claimed, not a chair given up**, and both routes into a session can carry
one.

- **In a room it types the eight characters like everybody else.** `waitingRoomSeating` admits a
  named player into the roster without a chair and admits a display outside that roster with
  `seat: null`. The host assigns every player, including itself; duplicate occupancy is refused,
  connected unassigned players block Start, and empty chairs become AI. Names are temporary labels,
  not credentials. This host-controlled roster took `NET_VERSION` to `5`: a v4 peer expects
  arrival-order seating and must not enter the same room.
- **On the code swap it is a fifth connection**, built for every host and asked for by nobody:
  `invite()` builds one extra link reserving no chair. A device that answers a _chair's_ invitation
  and says "table" is honoured too, and that chair falls back to the AI, because the joining
  device's answer is authoritative in both directions.
- **`guestSession.welcomed()` and not `seat()` is what `guestSeating` greets on.** A room greets
  every peer it sees while the host has not answered, and a display's seat is `null` for the whole
  match — so a seat test would hello the second arrival and the host would refuse it as `late`,
  throwing the screen out of a match it was already showing. That is the sharpest bug this route
  had, and `seating.test.ts` holds it.
- **The host says a display is here, and that sentence is the whole of `NET_VERSION` 8.**
  `{ t: "table"; on: boolean }` is the new `NetMsg` member — `parseMsg` accepts it only when `on`
  is a boolean, and `SCOPE`, `scopeOf`, `guestMay` and `hashState` are untouched, because nothing
  about it is an action. `hostSession` keeps an explicit `tables: Set<string>` and broadcasts after
  every change to it **and after every welcome**, so a player admitted later than the display hears
  it too; the host's own window is told through an `onTables` dep rather than by receiving its own
  broadcast, exactly like `onGuest`. **The set is not a scan of `seats` for `null`** — an
  unassigned room player's chair is `null` as well (`hello`'s `isWaitingPlayer` branch and
  `assign(id, null)` both write one), so a value-based test would put every window into the private
  view the moment somebody entered a room unseated, which is the case `session.test.ts` pins. The
  table's `bye`, `leave`, `refuse` and `remove` all lower it again, and a display dropping
  mid-match puts the board back on every screen rather than leaving four people staring at a dead
  one. A guest with `as: "table"` still sends nothing and still only listens. The version bump is
  the ordinary rule — a v7 host never sends the message, so a v8 player window would sit on the
  full board for a match a display is already showing, with no way to learn better — and room ids
  and invitation codes carry it, so the two builds cannot meet at all.
- **`Net.tableHere` is where the window reads it, and it is a property of the session.** It
  defaults to `false` in the no-provider context and in `stubNet`, `useNetGame` writes it from
  `onTables` on both sides and both routes and clears it on `hangUp`, and — like the role, the
  viewing seat and everything else about a session — it is **never on `GameState`**:
  `invariants.test.ts` has `tableHere` on the field blocklist beside `spectator` and `spectating`,
  and `grep -n "tableHere" src/game/` finds nothing. **It follows the welcome, not the data
  channel**, the same rule `onGuest` carries, so a device that opens the chairless link and is
  refused with `bye` and `nochair` does not raise it. `App.tsx` reads exactly
  `net.live && net.tableHere && !useSpectating()` and draws `PrivateTable` in `.felt`'s own grid
  row instead of the board — and, since `2026-09-19-private-table-layout-hand-placement`, `<Hand />`
  moves inside that same component rather than staying `#app`'s own third grid child: `PrivateTable`
  draws the declaration box and the phase's decision panel inside `.privstage` (a positioned
  element that is `#declpanel`'s containing block and takes whatever height the hand does not need),
  then the hand, its sort tools and its hint line beneath it, at their ordinary size, in the area
  the felt normally occupies. `#app`'s own hand row gets nothing placed in it and collapses, since
  its grid rows are `minmax(0,1fr) auto` with no explicit floor. **A shared table window is
  unaffected** — `useSpectating()` wins — and so is every offline window. The escape hatch is
  `useState` in `App.tsx` and a plain button rather than a `MoveButton`, because it moves nothing:
  window-local, unsynchronised, unsaved and absent from `hashState`.

- **Three independent layers make it read-only, and each is tested where it lives — except for one
  action, which has only the third.**
  `guestMay(a, seat: Seat | null)` returns `false` for **every** key of `SCOPE` when the seat is
  null — that clause comes **first**, ahead of the `scope === "flow"` line, or a table would click
  Continue and move a match it is only watching. `guestSession` with `as: "table"` applies numbered
  `act` messages and `local` intents and sends nothing else. And `components/MoveButton.tsx` draws
  nothing at all while spectating, so no screen shows a control that would lie.
  **`leaveChallenge` and `resumeGame` are the two exceptions, and `MoveButton` is their only
  guard.** `guestSession.intent` applies a `local` intent **before** the `as === "table"` drop, and
  nothing is sent, so `guestMay` is never asked: a table that reached `leaveChallenge` would leave
  the match into a fresh `createRun(undefined, bestAnte)` and go on applying numbered `act`s against
  it with no banner, because `hashing.due` is set by `endTrick` alone — and a table that reached
  `resumeGame` would do the same into whatever its own `tupatro-run-v1` (or nothing at all) held.
  Both are invisible to the table sweep, whose `onlyLocal` filter drops them — which is why
  `render.test.tsx` asserts both result screens and the single-player screen **by name**, the
  `btn.backToRun` / `btn.continue` / `btn.play` labels and the `leaveChallenge` / `resumeGame`
  dispatches alike, with a vacuity guard on a window that holds a chair. A third `local` action that
  moves the game would need the same treatment; the exception list is length two on purpose. Rules
  and SCORES are ordinary buttons on purpose: both are `local`, and somebody at
  the shared screen looking a rule up is what the panel is for — Rules on the start menu, SCORES on
  the single-player screen and on every overlay that covers the rail. **A modal is one such click away**,
  which is why `SeedDialog` and `RestartConfirm` draw their `newRun` buttons through `MoveButton`
  too: the rail's seed chip is an ordinary button, so a `flow` action left inside a modal is two
  clicks from a table window.
- **The start menu can go up on a table without the table touching anything, and that is why
  `Menu` and `SinglePlayer` draw `MoveButton`s too.** `g.menu` is state, and the table's rail draws
  no New game button, but the rail is not the only way to that screen — a `flow` action drawn
  behind any menu view is refused the day it is drawn. **`leaveChallenge` used to be the route
  that put a table there and no longer is**: it is `local` now, so no numbered action lands a peer
  on `menu: "start"`, and `Back to your run` on the two result screens calls `net.hangUp()` in the
  same click — the window that goes back to its own roguelike stops being a peer instead of
  sequencing its own run's ticks into a match the others are still playing. **What the peers left
  behind are told depends on who left, and that asymmetry is the relay's rather than this
  reclassification's.** The host hanging up closes every link, so each peer's `onClose` raises
  `dropped` — on both routes. A **guest** hanging up reaches the host on the room route only
  (`hostSeating`'s `onDrop` → `hostSession.leave` → `dropped`); on the code swap `useNetGame`'s
  `onClose` marks that chair `"failed"` and sets no status at all, and the **other guests are told
  nothing**, because the relay is a star and no `bye` is broadcast. The match then stalls on a
  chair `g.seats` still calls `"human"`, silently — `hashing.due` is set by `endTrick` alone, so no
  banner follows. Saying more to them needs a new `SessionStatus` or a new `NetMsg`, which is a
  transport increment and is in Known gaps, not here. Continue in `SinglePlayer` is a `MoveButton`
  for that reason: it is the third `leaveChallenge` dispatch site, and `local` alone is
  no longer enough to leave a button ordinary once it can reach that one exception (see the note on
  `leaveChallenge` above, and the guard on it further down). **Both of the menu's doors are
  `MoveButton`s, and dispatch nothing but `showMenu`**: a table configures nothing and starts
  nothing, so neither door is a control it draws, and its own way out of a session is the banner's
  Hang up rather than a door. The menu's one other button — Rules — stays ordinary, being `local`
  with no `leaveChallenge` behind it, and so does `SinglePlayer`'s `ScoresButton`. The menu's own Leave button is gone: a
  challenge is left from its result screen, and `ChallengeOver`'s and `RaceOver`'s Back to your run
  are `MoveButton`s in its place. **The rail kit page's three wallet controls are `MoveButton`s
  too**, for the hosted main-game run in Known gaps. **`SinglePlayer`'s three flow controls — the
  new run, Continue and every Play — are `MoveButton`s as defence in depth, not because the screen
  is reachable while still a peer**: `Menu`'s Single player button asks to hang up first while a
  session is live — on a host, a guest and a table alike, though a table draws no such button at
  all — so no window still holding a chair reaches that screen without leaving the session in the
  same click, and the sweep sets `menu: "single"` directly rather than clicking through. That gate
  is therefore load-bearing for more than the stall its own comment names, and opening it would
  take more than a flag: `ChallengePlate` still names the two sides through `chal.us` and
  `chal.them`.
- **The sweep's dimensions are `Screen["kind"]`, `Phase`, `Modal` and `MenuView`**, each keyed off
  its own union so a new member fails to type-check until it is listed — the phase dimension by
  `PHASE_PANEL`, a `Record<Phase, boolean>` whose value says whether the phase draws a decision
  panel, which is also what the panel sweep is filtered from. `g.modal` and `g.menu` are
  dimensions of the sweep, not afterthoughts: the criterion is its heading — nothing on a table
  window can move the game — and a sweep keyed off screens alone met the letter of that while the
  menu stood wide open. Each dimension carries a vacuity guard that clicks the same screen on a
  window holding a chair and asserts the game _does_ move: `dealend` for the screens, the seed
  dialog for the modals, the start menu followed through its Single player door to that screen's
  new-run button — and through its Multiplayer door to the lobby's Start — for the menus, since
  every button on the menu itself is `local`, the kit page for the rail, and the
  `declare` phase for the phases — a phase's own controls are drawn on the felt with no screen
  over it, which is exactly what that sweep clicks.
- **Which window is the table is a property of the window**, exactly like the viewing seat and the
  session: `NetRole` carries it, `useSpectating()` is the one question the components ask, and
  `invariants.test.ts` fails on a `GameState` field named `spectator` or `spectating`. `table`
  cannot join that blocklist — `GameState.table` is Tuppi-Rummikub's laydown table, and the three
  meanings of the word never meet in one file.
- **`useSeatSync` writes nothing for a table, and that clause is first.** A table's `net.seat` is
  null exactly as an offline window's is, so without the flag the multi-human clause would follow
  `waitingSeat` and swing a board four people are watching round between turns.
- **No offline table.** With no session there is no peer to advance the player-gated phases and the
  board would stall on the first one — the mechanical reason the seat-picker spec refused a
  spectator, unchanged. A table also cannot join a match in progress: there is no reconnect, and
  `hostSession` refuses any peer arriving after the first numbered action with `late`.
- **A table is a peer for the hash**, and a divergence on it raises the same banner as any other —
  a board drawing a game nobody else is playing is exactly what the hash is for. It writes no save
  and files no board row — but **`GameProvider`'s `if (net.live) return;` is only half of that**.
  The banner's Leave hangs the session up _and_ raises the start menu, and the menu covers the
  screen rather than replacing it, so the save effect runs once more with `net.live` false and the
  `raceover` result still on screen. Filing there would put a networked match on
  `tupatro-race-v1` under `raceRowFor`'s `ownerTeam(g)` — a pair the display has no relation to.
  What stops it is a second guard: **the challenge branch returns while `state.menu` is set**, one
  clause ahead of the board writes, for the same reason the main run's snapshot is not written
  under the menu. It cannot be folded into the general menu guard below, because the
  `gameover`/`victory` branch has to stay ahead of that one.
- **The host's Start does not wait for the shared table, and the invitation is built every time.**
  The switch that used to ask for it first is gone: a screen could always answer a _chair's_ code
  and say "table", so **Invite a shared table too** never decided whether a display could join —
  only whether the host was shown a code that reserves no chair. `invite()` therefore builds the
  chairless link unconditionally, chairs first and the display's last, and `ready` in `Lobby.tsx`
  is `(open.length > 0 || net.tableInvite !== null) && open.every((c) => settled(c.state))` with no
  `tableInvite.state` in it. **The gate had to go with the switch**: built unconditionally, an
  unanswered invitation says only that nobody answered a code most hosts never hand out, so waiting
  on it would leave every code-swap host with a Start that never enables. Connected before Start is
  still the display's single precondition — there is no reconnect, and `hostSession` refuses a peer
  arriving after the first numbered action with `late` — and what says so is `lobby.tableDek`, one
  line in the display's own block, rather than a disabled button. The room route has always carried
  exactly this risk, so the two routes now agree. The cost accepted is one more
  `RTCPeerConnection`, its ICE gathering and, without **LAN only**, one STUN round trip per hosted
  code swap. **A room reads a different field for the same fact, and reads it in both directions.**
  A display that typed the room code claims no chair, so `openRoom`'s own `onGuest` writes nothing —
  `net.tableInvite` means the chairless invitation the code swap built and its answer state, and a
  room builds neither. What the host reads instead is `net.tableHere`, the flag `onTables` already
  sets on the welcome and lowers again the moment `hostSession`'s `tables` set empties — a display
  closing its tab included, since that runs through the same `leave` path a dropped player's does.
  `Lobby.tsx`'s room-host branch draws `lobby.tableJoined` on that flag, and a second row in the
  roster (`.seatpick.tablerow`, `lobby.tableWho` / `lobby.tableNoChair`, no button — the host has no
  id to pass `net.removePlayer` for a display) for as long as it is true, so the host is told the
  display has left as well as that it arrived. A _chair_ answered by a table is the opposite case and is settled at once: that
  chair is played by the game.
  **What sets that `connected` is the welcome, not the data channel — for every invitation the
  host builds, a chair's included. No `onOpen` in `useNetGame.ts` writes a state.** A channel
  opening says a device answered, not that `hostSession` admitted it. On the chairless link a
  device that answers and says `"player"` is refused with `bye` and `nochair`, and `settled()`
  reads `"connected"`: written on the channel alone, the display's block would stop drawing its
  code, its QR and its Connect for an invitation nobody took — the host left with no way to hand it
  out again, under a line saying the screen is in. **On a chair's link the same shape ends worse**,
  because there Start _is_ gated on `open.every(settled)`: a peer one `NET_VERSION` out of step
  opens the channel and is then refused with `bye`, and `hostSession` neither closes the link nor
  releases the chair, so `onClose` never fires — a chair left `"connected"` is mapped to `"human"`
  by `seatsFor()`, Start is enabled, and the deal stalls at the first player-gated phase with no
  error to show for it. `onGuest(peer, as, chair)` is the honest signal in both cases, it is only
  ever called after a peer has been seated, and `useNetGame.test.tsx` stubs `net/rtc.ts` and fires
  the callbacks by hand to hold the difference for the chair and for the table.
- **An answered invitation stops being offered, whichever thing answered it.** A chair a display
  claimed is `"table"` and not `"connected"`, so a block gated on `"connected"` alone went on
  drawing that chair's code, its QR, its answer box and a live Connect for a link whose peer was
  already here — the control that lies `MoveButton.tsx` exists to forbid — and reading as unsettled
  while `ready` counted it as settled. `settled(state)` in `Lobby.tsx` is the one test for both
  endings, and it is why the two blocks read alike. **Clicking that button also threw**:
  `link.take(code)` hands a second answer to a stable connection, `setRemoteDescription` rejects,
  and `connect` had a fulfilment handler only. It has both now, and the rejection is reported as
  `"refused"` — the sixth `SdpProblem`, the one that does not come from `signal.ts`, because a code
  the parser is perfectly happy with is what the browser refuses here.

**Every peer can read every hand**, in devtools, because there is no server. That is accepted — it
is a game to play with people you know — and the rules panel says so rather than implying
otherwise. So does the fact that the invitation carries your public address unless **LAN only** is
on, which omits STUN entirely.

**A networked run is never saved.** `GameProvider` returns before `writeRun` while a session is
live, the same shape the challenge's guard has and for a sharper reason: `seats` is saved and a
session cannot be, so a resumed board naming humans with no peers behind them stalls on the first
gated phase.

**The QR encoder's own reader cannot prove it.** `qr.test.ts` contains a reader, and a round trip
through it proves the placement, the masking and the format bits — but it shares this encoder's
assumptions, which is exactly how a transposed format field passed every test while scanning as
nothing at all. The check that found it was an outside decoder, and the check that replaced that
is a byte-for-byte comparison against the `qrcode` npm package over 25 versions and three masks.
Neither is a dependency; both were installed in a scratch directory and used once. **If you change
the encoder, do that comparison again.**

## Randomness always goes through the run's `Rng`

A run has a seed (`g.seed`) and a generator state (`g.rngState`), and the same seed with the
same player decisions produces the same run: identical deals, bosses and shop stock.

- **Do not use `Math.random` in game logic.** The only permitted site is `makeSeed()` in
  `rng.ts`, which draws a new seed. ESLint forbids it elsewhere and a test asserts there is
  exactly one call site.
- **Rendering must not consume randomness.** A test checks that no component touches
  `Math.random` or an `Rng`. If a component drew a number, replay would break the moment the
  screen repainted a different number of times.
- The reducer creates the cursor from state and writes it back:
  `const rng = makeRng(d.rngState); … d.rngState = rng.state`. Pass `rng` down as a parameter;
  never reach for one.
- Any string works as a seed (`normalizeSeed` trims and upper-cases it). Generated seeds are 8
  characters and avoid the confusable `O/0/I/1`.

## There are two suit orders, and only one of them may touch the engine

`SUITS` is `["S", "H", "D", "C"]` and `HAND_SUITS` is `["S", "H", "C", "D"]`, both in
`constants.ts`. The second exists because a hand reads better when no two neighbours share a
colour — ♠ ♥ ♣ ♦ rather than ♠ ♥ ♦ ♣ — so the boundary between two suits is visible without
reading the pips. Every suit now has its own colour (`docs/specs/2026-09-16-four-suit-colors.md`);
the order does not move to match, since `game/state.test.ts`'s alternation case and, through
`bot.ts`'s positional picks, the 50-seed aggregate would move with it for a layout preference.

**`SUITS` is the engine's and does not move.** It builds the deck (`makeDeck` pushes in its
order), rolls the shop's card offer and rolls the party map, all of which run through the seeded
`Rng`. Reordering it reshuffles every deal, boss and shop roll for every existing seed: a shared
seed would stop reproducing its run across builds, the scoreboard's seed column would compare
runs that are not the same run, and every pinned literal in `seats.test.ts` would move at once —
which is exactly when the golden stops being able to tell a deliberate change from a broken one.

**`HAND_SUITS` is the layout, and it stops at the player.** `bySuitThenRank`, `byRankThenSuit`
(the rank mode's tie-break) and `sortHand` for a `"human"` seat use it. `sortHand` for an `"ai"`
seat deliberately does not: `chooseAI` reads a hand in order and breaks a tie by taking the first
candidate, so laying the layout order over an opponent's hand would let a display choice change
how the opponent plays. Nobody sees a hidden hand, and tidiness for one is not worth that. A
human seat does get it even when `applySort` never reaches them — `sooliGive` re-sorts a partner,
and an offline multi-human state draws the window for whichever human is to play.

**`HAND_SUITS`'s alternation is colour-neutral almost everywhere, and two modes are the
exception.** Traditional Tuppi and the Tuppi Race are dealt from the two-colour deck
`2026-09-19-traditionally-coloured-match-cards` added (`.trad` on the card root, ♦ and ♣ repainted
to ♥'s and ♠'s hex), so in those two modes alone `HAND_SUITS`'s ♠ ♥ ♣ ♦ order is once again
literally black/red/black/red, the way it reads on a physical deck. The array itself does not
move; only the colours a card resolves to do.

**Introducing it still moved the 50-seed aggregate**, and that is worth knowing before reading the
golden. The three named seeds kept every scalar — deals, outcome, money, ante, `blindIdx`,
`runScore` — and only their seat-0 hand literal reordered. What moved the aggregate is `bot.ts`:
the policy picks by _position_ in the hand it is handed, so a reordered hand hands it a different
card on some seeds. A player clicks a card and is unaffected, so the shift is recorded rather than
treated as a balance change.

## Card identity is `uid`, not `id`

- `id` = the card type, e.g. `"S14"`. Use it for presentation only.
- `uid` = the individual, minted by `mkCard`. **Every identity comparison uses `uid`**, and it
  is also the React `key` for hand cards and trick slots.

The side deck can bring a duplicate into hand (two A♠). An `id`-based comparison would break
card play, the drag ordering and the legal-card set — and an `id`-based React key would make two
identical cards share one DOM node. A tie is won by the card played earlier, because
`currentWinner` compares with a strict `>` — do not change it to `>=`.

Because `uid` is the key, the drop animation needs no bookkeeping: a trick slot mounts once, so
a CSS mount animation plays exactly once. Do not add a set of already-animated card ids — the
key already carries that information.

## Enhancements bend rules, they do not just add numbers

The two most important entries in `ENH` touch the rules, not the score:

- **stone** — no suit (`matchesSuit` → false, but `legalCards` always lets it through) and no
  rank (`currentWinner` never picks it). If a stone card leads a trick, the led suit comes from
  the next suited card — which is why `leadSuit()` scans the trick instead of just reading
  `g.trick[0]`.
- **wild** — counts as every suit both when following suit and in the winner comparison, and
  completes a flush in `evalTrick`.

When adding an enhancement, walk **all four** touch points: `legalCards`, `currentWinner`,
`evalTrick`, and `chipValue`/`scoreTrick`. The stone card needed all four.

**The tuppipakka swap needs the same card.** A side-deck card replaces its own twin — same
suit, same rank — and nothing else, so the side deck changes what your cards do and never
which cards you hold. `swapTargets`/`canSwapIn`/`anySwapAvailable` in `rules.ts` are the one
place that rule lives; the reducer guards the swap with them, and skips the `swap` phase
entirely when nothing matches, so the player is never parked in a phase with no move. **The
swap is select then confirm.** The twin is unique — a deck holds one of each card, and a card
already swapped in is excluded — so `swapTargets` returns at most one card and _which_ card is
replaced is never a choice. Whether to spend the swap is: a click on a tuppipakka card selects
it, the panel draws an infobox about that card — the enhancement's name and description, the
card it would replace, and the reason when it cannot be taken — and the footer's Swap button
dispatches `pickSideCard`. Cancel takes the selection back. The selection is a `uid` in
`SwapPanel.tsx`'s own `useState`, never on `GameState` and so never in the save. Every
side-deck card is selectable, the dimmed ones included, so the panel no longer sends a doomed
`pickSideCard` — and neither does the bot, which checks `swapsLeft` and `anySwapAvailable` first.
The reducer's guards and their toasts stay as the rule's authority even though no dispatch site
reaches them any more, so `reducer.test.ts` covers both of them directly: `toast.swapNoMatch`
and `toast.noSwapsLeft`. The hand is read during the `swap` phase, never clicked. A card already
swapped in is not a target either — trading it away would spend a second swap to end up with
fewer enhancements.

## A challenge is an alternate rule set, not a modifier — and there are eight of them

`g.challenge` is `null` in a main-game run and every field beside it — `table`, `layHands`,
`layTurn`, `layNo`, `layPassed`, `layScores`, `parked`, `raceDeal`, `raceBase`, `raceScores`,
`rpsRound`, `rpsWins`, `rpsCards` — is then inert. Set, it means a run with **none of the
roguelike shell**: no ante, no blind, no money, no shop, no jokers, no vouchers and no tuppipakka.
Consumables are the one exception, and only for `"tupatro"` — see below.

**`ChallengeId` is `"rummikub" | "rps" | MatchId` with
`MatchId = "race" | "tuppi" | "tupatro" | "nami" | "namihard" | "politiikka"`, and no branch in the reducer tests
`d.challenge` for truth.** Every `if (d.challenge)` was written when there was one mode and each
meant "rummikub"; two of them would have given a race deal a forced rami with no declaration and
turned its thirteenth trick into a laydown. All of them test the id now — `startDeal`,
`resolveTrick`, `endTrick`, `showHandResult` and `endHand` — and `invariants.test.ts` fails on a
bare `d.challenge` truthiness test coming back, and on a helper that puts `d.challenge` in front of
a `)` or a `?`. Spell the ids: `d.challenge === "race" || d.challenge === "tuppi" || d.challenge
=== "tupatro"` where the point table's the same, and likewise for the two Nami ids together where
theirs is. **The reverse is a trap too**: `GameContext.tsx`'s no-write guard and `Rail.tsx`'s page
list are correct for _any_ challenge and must not be narrowed to an id — only the plate inside the
first rail page, `Rail.tsx`'s own three-vs-two-page choice for Multiplayer Tupatro's temput box and its own
`chalRow.id === "rps"` choice for `RpsPlate`, and all three test it. The plate and those two read
the mode through `matchModeOf(id): MatchId | null` in `game/race.ts`, an exhaustive switch over
`ChallengeId | null` that failed to compile the moment `"rps"` joined `ChallengeId` — the
replacement for the `id === "tuppi" ? "tuppi" : "race"` two-way ternary that used to answer this in
`MatchPlate.tsx`, `RaceOver.tsx` and `GameContext.tsx`, and that would have silently called
Rock-Paper-Scissors, a Multiplayer Tupatro match or a Nami match a race. `matchModeOf("rps")` returns `null`:
Rock-Paper-Scissors is a `ChallengeId` and deliberately not a `MatchId` — it banks no scale, has no
point target and reuses none of `raceDeal` / `raceBase` / `raceScores`, carrying its own three
fields (`rpsRound`, `rpsWins`, `rpsCards`) instead. Borrowing the race's three fields would have
cost no new state and is refused anyway, on the same "the field is inert outside a match mode"
argument `PositionLine`/`BestLine` in `SinglePlayer.tsx` already read as a fact.

**`startChallenge` reads the target off the `CHALLENGES` row.** `Challenge` carries `target` as
well as `deals`, `0` for rummikub, each match mode's own number, and `RPS_ROUNDS` for
Rock-Paper-Scissors — where it counts _rounds_ rather than points — so a seventh mode needs no id
test there at all.

**A challenge is left from its result screen or from the single-player screen's Continue.**
`ChallengeOver` and `RaceOver` dispatch `leaveChallenge` on Back to your run; `SinglePlayer`
dispatches it too, because Continue there means the solo roguelike and behind a challenge that run
is `parked`. The click sends `leaveChallenge` and then `closeMenu`, since the reducer's case lands
on the start menu on its way past. `invariants.test.ts` pins exactly those three sites, and the
comment there names what now holds the line: the Single player **door** asks rather than refuses
while a session is live, through the `"hangup"` modal, and its confirm hangs the session up before
`menu: "single"` is ever set — so that dispatch reaches this screen only after the window has
already stopped being a peer, and `net.hangUp`'s own site list gained a sixth entry for the dialog
that does the asking. The reducer's case is unchanged and still restores
`parked` whole. **A challenge in progress is therefore escapable** — it was not between the menu's
old Leave button going and Continue arriving, and a new run was the only other offer, which
destroys the run it was asked to go back to. A new run still replaces the whole state, parked run
included.

**Tuppi-Rummikub** is four forced-rami deals whose tricks score nothing — `resolveTrick` returns
early into that branch, so `scoreTrick`, the tuppi multiplier and `ctx.payout` are never reached.
What the thirteen tricks produce is the two laydown hands.

**The race** is the opposite shape: ordinary tuppi with the declaration, sooli and _ryöstö_ all
present, scored by exactly the main game's arithmetic, played deal after deal until a pair reaches
`RACE_TARGET` (12,000, in `constants.ts`, measured — the figures are in the README). It has no
fixed length, so `deals`/`blindDeals`/`dealsLeft` stay at 0 and `raceDeal` is the counter; the
match target rides in the ordinary `g.target`. `game/race.ts` holds the whole of its arithmetic and
is in `PURE_CORE`.

- **`resolveTrick` scores each trick for _both_ pairs**, each against **that pair's own seat**
  (`seatOfTeam(t)`), never the winner's and never the owner's. Every wallet in a race is empty, so
  a wrong seat produces the right number by accident, and **each call site needs its own guard**:
  `race.test.ts` makes one wallet non-empty for `dealScores`, and `reducer.test.ts` drives
  `resolveTrick` itself with the **non-owner's** pair holding the only non-empty purse, because the
  reducer's call is a separate path that `race.test.ts` never reaches. `ctx.payout` is discarded:
  nobody has a purse.
- **`endHand` banks both pairs and touches neither `dealsLeft` nor `blindScore`.** `handScore`
  stays the run owner's pair's, which is what the shared screens and toasts report.
- **`showHandResult` must always open a screen**, `raceover` or `dealend`. `nextTick`'s `handend`
  case returns a tick whenever `g.screen` is null and the phase deliberately stays `handend`, so a
  branch that opened none would fire forever. Its key is `handend:0` in every race deal, which is
  safe only because the intervening steps' keys differ.
- **A busted sooli scores nothing for anybody**, which knowingly contradicts the source
  (korttipeliopas.fi gives the declarers 24 points). Tupatro's `tuppiInfo` returns 0 on `sooliBust`
  and the race keeps that rather than moving the main game's numbers. **In sooli only the soloist's
  pair banks**: `scoresFor` and `tuppiInfo` are team-blind there, so crediting both would count the
  same number twice.
- **`startChallenge` carries the whole table**, `seats?: [SeatKind, SeatKind, SeatKind, SeatKind]`,
  and `createRun(seed, prev.bestAnte, ownerSeat(prev), seats)` is the one construction site. The
  lobby's four chairs are what fill it, so two humans may be **partners** as well as opponents, and
  a challenge dispatched with no table at all — Tuppi-Rummikub — gets one human in the parked run's
  own chair. **An all-AI board is refused by a runtime guard, not by the type**: `nextTick` would
  stall on it at the first player-gated phase, never dealing a card, so a table naming no `"human"`
  falls back to that same single-human board. This replaced a `humans: 1 | 2 | 3 | 4` count, which
  could seat people only clockwise from the owner and knew nothing about which chair a peer holds.
- `waitingSeat(g)` in `schedule.ts` says which human seat an offline multi-human state is waiting
  on, and `useSeatSync` follows it whenever more than one seat is human. The multiplayer lobby does
  not expose local pass-and-play; every person joins from a separate browser.

**Traditional Tuppi** is the third mode and the race's twin: exactly the same deal, scored by
**tuppi's own point table** and played to `TUPPI_TARGET` (52, in `constants.ts` — **tuppi's number,
not measured**; what is measured is the match length that falls out of it, and the figures are in
the README). It reuses `raceDeal`, `raceBase`, `raceScores`, `target`, the `raceover` screen,
`matchOver` and `raceWinner`, so `GameState` gained no field and `SAVE_VERSION` stayed `3`.

- **`game/points.ts` is the table and nothing else.** `dealPoints(g): [number, number]`, team-
  indexed, over a `Pick` of `tricks` `mode` `ramTeam` `sooli` `sooliBust` `sooliSeat` — no wallet,
  no boss, no `base` and no `raceBase`, because a deal's worth here is its trick count.
- **Away from sooli the table is exactly `4 × tuppiMult`**, and `points.test.ts` asserts that
  identity for every trick count so the two scales cannot drift apart. It is deliberately not
  _implemented_ as `4 × tuppiMult`: that function reads a wallet and a boss this mode does not
  have, and the sooli row is a real disagreement rather than a scale factor.
- **A busted sooli pays the declaring pair 24 here and nobody in the other two modes.** `tuppiInfo`
  was not touched, so no main-game or race number moved. Two answers to one situation, in two
  modes, on purpose — the rules panel and the README both say which is which.
- **`resolveTrick` in `"tuppi"` scores nothing**: no `scoreTrick`, nothing into `base` or
  `raceBase`, `d.pop` stays null, and the felt has no score pop because there is no per-trick
  number for one to carry — the rail plate's running deal points are what replace it. Party support
  is still tallied; that block runs above the id branches.
- **`endHand` banks `dealPoints` for `"tuppi"` and `dealScores` for `"race"`, never one call for
  both.** The two scales are not convertible, and a conflated branch would bank a five-figure chip
  score against a target of 52.
- **Traditional match totals are not cumulative for both pairs.** Only one pair may be up.
  When it loses a deal, `endHand` resets both `raceScores` and the awarded `handScore` to zero,
  without banking the winner's deal value. From 0–0, or on a continuing winning rise, normal
  points are added. This applies to rami, ryöstö, nolo and both sooli outcomes. The race keeps
  independent cumulative totals. `dealPoints` stays the raw point table; `MatchDealEnd` treats
  0–0 after a completed traditional deal as a reset, showing zero awarded points and explaining
  it in both locales. The September 9 spec supersedes the initial mode's cumulative assumption.
  Measured pace is now much longer; README has the replacement figures. Early deal termination,
  and stopping declarations at first rami remain separate gaps. Both-defender sooli is covered
  below for both match modes.
  **The reset raised `NET_VERSION` to 3; that version is historical now.** v2 peers still bank
  cumulative points and would desync on the first reset. Current version **11** also requires the
  match-sooli rules (v4's), the room-first lobby roster (v5's), the `local` classification of
  `leaveChallenge` (v6's), bot sooli in the main run (v7's), the shared table's own `table`
  message (v8's), the fourth challenge id `"tupatro"` (v9's), Ikiliikkuja's own draw for the ♣K
  (v10's) and the guest `resume`/`catchup` pair (v11's); hello, invitation and room-version gates
  keep older builds out. A reducer rule change
  can require a network-version bump even with an unchanged wire shape.
- **The board is a fifth key, `tupatro-tuppi-v1`**, and `readRaceScores`/`writeRaceScores` take the
  `MatchId` rather than defaulting to one — the same trap the race's key already avoids one level
  down, since a `RaceRow` fits every match mode.
- **The mode the lobby starts lives on the net context** (`net.match` / `net.setMatch`, default
  `"tupatro"`), never on `GameState` and never in a save, and `net.start()` sends it through `matchRef`
  so the value on the click is the one the picker shows. The initial mode did not change `SCOPE`,
  `hashState`, `parseMsg` or `guestMay`; a guest learns the mode from the
  host's numbered `startChallenge`.

**Multiplayer Tupatro** (id `"tupatro"`) is the fourth mode and Traditional Tuppi's twin: the identical deal, `dealPoints`, the
identical `TUPPI_TARGET` and the identical lost-lead reset — `endHand`'s reset clause tests
`d.challenge !== "race"` rather than `=== "tuppi"` so it covers both point-table modes at once —
with one thing added: each seat's wallet draws a temppu at the start of every deal.

- **The supply is a draw, because a match has no money to buy one with.** `startDeal`'s match
  branch, for `"tupatro"` only, loops the four seats in order and calls `pick(rng, CONSUMABLES)`
  once per seat per `TUPATRO_DRAW` (in `constants.ts`, `1`, with the supply argument in its own
  comment) — always, whatever the seat's box already holds. The draw is kept only for a `"human"`
  seat with `consumables.length < consSlots`; an AI seat's, or a full box's, is discarded.
  `startChallenge` itself hands the mode empty boxes like any other — `createRun`'s defaults —
  because it is `startDeal`, called a moment later in the same function, that fills them; the "none
  of the roguelike shell" comment at that construction site says so.
- **Ikiliikkuja: a second draw site, the ♣K itself.** `playCardInner` in `reducer.ts` draws by
  exactly the same rule — `pick(rng, CONSUMABLES)` before the keep/discard test, kept only for a
  `"human"` seat with room — for the seat that plays the ♣K into a trick, gated on
  `d.challenge === "tupatro"`. `isKingOfClubs(c)` in `cards.ts` (suit and rank, a card-type
  question, not `uid`) is the one face test, shared with `PlayingCard.tsx`'s portrait so the two can
  never name different cards. The player is told by an addressed toast (`toast.ikiliikkuja` names
  the drawn temppu; `toast.ikiliikkujaFull` fires when the box had no room), nobody else's window
  draws either. **What no longer holds is "a Multiplayer Tupatro deal costs a fixed amount of randomness"** —
  whether the ♣K reaches a trick varies (it can sit unplayed in a sooli's sitting-out hand, or a
  `uusijako` redeal can put a fresh one back into play), so the count of `pick` calls a deal spends
  is no longer fixed. What survives, because both sites take the `pick` before the keep/discard
  test either way, is the narrower claim: what a seat is _holding_ can never change what the _next_
  deal deals.
- **A spent temppu acts for the seat that spent it, in every mode now, Multiplayer Tupatro included.** This is
  the one delivered behaviour the feature changes outside the new mode: `useConsumable` stopped
  calling `ownerSeat` — `kannanvaihto`'s new declarer, `vaihtokauppa`'s "worst card" owner and
  `tikkivarkaus`'s theft are all the acting seat `p`'s, not the run owner's. The main run is
  unaffected in the common case (its one human _is_ the owner) except for the theft's target, which
  is a real correction there: it used to pick the first trick card that was not the owner's, which
  in a sooli could be the soloist's own partner and steal nothing that mattered. It names the
  soloist now, by the table below — moving no pinned literal, since `basicPolicy` never buys a
  temppu in the golden runs.
- **`reveal: boolean` and `steal: boolean` became `revealTo: Seat | null` and
  `stealFor: Seat | null`**, each carrying the seat that armed it rather than a bare flag —
  `startDeal` clears both to null and nothing else does. `Seats.tsx` turns the other hands face up
  only when `!spectating && g.revealTo === you && p !== you`, and the addressed toast rule below is
  the theft's: broadcasting `toast.theftArmed` would tell the opponents the next trick is stolen.
- **`resolveTrick`'s theft table, read from what each side is trying to do rather than from a rule
  sheet, since no source knows the move**: in **rami** the spender's own side takes the trick, in
  **nolo** it is pushed onto the other side, and in **sooli** a defender pushes it onto the soloist
  (busting the sooli) while the soloist pushes it onto anyone else — its own sitting-out partner
  would change nothing. `d.stealFor` is read once and cleared to null in the same branch that used
  to read `d.steal`.
- **`Toast` gained `p?: Seat`.** The five `useConsumable` toasts (`toast.peeked`,
  `toast.theftArmed`, `toast.becameNolo`/`toast.becameRami`, `toast.swapped`, `toast.redealt`) carry
  it; `Toasts.tsx` draws nothing when `toast.p` is set and is not the viewing seat, or when the
  window is spectating. The guard toasts ahead of the spend (`toast.tricksBanned`,
  `toast.waitForDeal`, `toast.onlyBeforeFirstTrick`, `toast.noFlipInSooli`) are unaddressed, same as
  before.
- **Bots never spend a temppu.** Teaching `chooseAI` to would need a new `auto` action, a
  `nextTick` arm, a `SCOPE` entry and a heuristic of its own — named in the spec as the obvious next
  one and the honest fix for what this means for balance: a Multiplayer Tupatro match against bots is lopsided
  in the humans' favour by construction, and the measurement in the README reports how lopsided.
- **Multiplayer Tupatro is the one `CHALLENGES` row the single-player screen does not draw**, and the two lists
  are deliberately not the same list: `LOBBY_MODES` carries it, `SOLO_MODES` in `SinglePlayer.tsx`
  filters it out. It was asked for as a multiplayer mode, and the bullet above is why that is also
  the mechanically right answer — a solo board would deal the player four draws a deal against three
  opponents holding none. The first delivery put it on both screens, because both screens map
  `CHALLENGES`; that is what the filter exists to stop. A bot that could spend a temppu is what
  would earn it a row there. `render.test.tsx` spells the three solo ids out rather than deriving
  them from the filter, so a test cannot pass by agreeing with a mistake.
- **`Rail.tsx` draws a third challenge page for `"tupatro"` alone**: the match plate, an `rp-kit`
  page holding `<ConsumablesBox />` on its own — no jokers, no side deck, the rest of the shell
  stays absent — then the game page. Every other challenge keeps its two-page strip.
  `ConsumablesBox` already reads `econOf(g, useViewSeat())` and draws through `MoveButton`, so a
  shared table watching a Multiplayer Tupatro rail sees a full box and can click none of it, same as the main
  game's wallet.
- **`NET_VERSION` moved to `9`, then to `10`.** `parseMsg` does not validate challenge ids, so a v8
  peer given a numbered `startChallenge {id: "tupatro"}` would run _main-game_ rules against it
  rather than refusing the mode outright — that was v9. `hashState`'s `purses` line also hashes
  each wallet's consumable ids, so a box that diverges between peers raises the banner instead of
  hiding behind `rngState`. **v10 is Ikiliikkuja's**: a v9 peer's reducer draws nothing when the ♣K
  is played, so the first one played in a Multiplayer Tupatro match diverges `rngState` and one wallet's box on
  that peer alone. Neither bump touches `SCOPE`, `guestMay`, `parseMsg` or the `NetMsg` union.
- **`SAVE_VERSION` stays `3`, the sixth non-bump.** `revealTo`/`stealFor` are null at every
  boundary a snapshot is taken at — `startDeal` clears them and no screen opens mid-trick — so a v3
  payload's stale `reveal`/`steal` booleans carry nothing a resumed run needs. `rehydrate` accepts
  `"tupatro"` through its existing `CHALLENGES` check, with no new positional read.
- **Out of scope, named rather than silently skipped:** temput in Traditional Tuppi, the Race or
  Tuppi-Rummikub; the rest of the roguelike shell in any match (money, shop, jokers, vouchers,
  tuppipakka, swap phase, blinds, bosses, cash-out); an AI that spends a temppu; new temput beyond
  the five in `CONSUMABLES`; per-seat `consSlots` tuning or a discard picker; and a multi-human
  Multiplayer Tupatro save (`soloBoard` still gates the run slot, exactly as the other two match modes).

**Nami** is the fifth and sixth mode, in two variants sharing one shape: ordinary tuppi trick play
with **no declaration, no rami, no nolo, no sooli and no _ryöstö_** — there is nothing for them to
decide, because a deal's worth is the point value of the cards a pair captured, not a bet on their
count. It is a **custom mode, not tuppi's own rule**: its point tables come from GitHub issue #7
verbatim, and the rules panel and README present it as this game's own, beside Tuppi-Rummikub. Each
variant is its own `ChallengeId` (`"nami"` easy, `"namihard"` hard) rather than one id with a flag,
because the id is already state, already saved and already hashed.

- **`game/nami.ts` is the whole of the arithmetic and nothing else.** `namiValue(v, card)` reads a
  card's rank alone, `namiTrick(v, cards)` sums a trick, and `NAMI_VARIANT` maps each id to its
  table (`"easy"` / `"hard"`) — no wallet, no boss, no `base`, no `GameState`, the same shape
  `pipValue` uses and for the same reason. `chipValue`, `pipValue` and `namiValue` are three
  different questions kept in three different functions on purpose.
- **Both tables sum to exactly +4 over the whole deck.** That is the match's own termination proof:
  every card in the deck is captured across a deal's thirteen tricks, so after `n` deals the two
  pairs' `raceScores` always sum to `4n` and the leader is never below `2n` — a Nami match cannot
  fail to end, pinned in `nami.test.ts` for an arbitrary split of the deck as well as the whole one.
- **`startDeal`'s Nami arm skips the declaration outright**: `mode` is set to `"rami"` only so
  every mode-reading path has a defined value (it means nothing else here, exactly as it does not
  for Tuppi-Rummikub), `ramSeat`/`ramTeam` stay null, the elder hand leads, and play begins at
  once — no swap phase either, the same shell absence every match mode has.
- **`resolveTrick`'s Nami arm calls no `scoreTrick`**: `namiTrick(variant, cards)` goes straight
  into `raceBase[teamOf(winner)]` with nothing further applied — unlike the race's chips × mult,
  a Nami trick's value is already the whole answer. No score pop, since there is no per-trick
  number in this scale for one to carry; party support is tallied above the id branches, as every
  mode's is.
- **`endHand` banks `raceBase` into `raceScores` cumulatively, like the race, never Traditional
  Tuppi's "only one pair may be up" reset** — that rule is tuppi's own point table's, and Nami
  plays neither of tuppi's tables.
- **`chooseAI` gains a per-trick Nami branch**, gated on the challenge id: "does this side want
  this trick" is recomputed from `namiTrick` over the cards already on the table under the deal's
  variant, false on a lead, and the answer feeds the existing win/duck machinery unchanged. It
  draws no randomness, so a Nami deal replays identically from its seed, and gating it on the id
  keeps `seats.test.ts`'s pinned literals and the 50-seed aggregate from moving.
- **`NAMI_TARGET` (40) and `NAMI_HARD_TARGET` (140), in `constants.ts`, are measured, not tuppi's
  and not guessed** — see README.md for the full candidate table. The hard variant's target moved
  from its own starting guess of 180, which measured a median past the spec's 8–20-deal band.
- **Two more boards, two more saved slots, the same shape as the race's and the traditional
  match's**: `MATCH_KEY` in `storage.ts` gains `tupatro-nami-v1` and `tupatro-namihard-v1`, and
  each variant's own run slot follows `challengeRunKey(id)` for free — no change needed there.
- **Single player only.** `LOBBY_MODES` in `Lobby.tsx` stays `["tupatro", "race", "tuppi"]`, so
  Nami never reaches the lobby's picker, the wire, or a shared table; `NET_VERSION` is unmoved by
  Nami — it stands at **10**, Multiplayer Tupatro's own two bumps, above — since Nami changes no wire shape of
  its own.

**Rock-Paper-Scissors** is the seventh mode, and the one that is not tuppi at all: no trick, no
declaration, no wallet — but it is played with cards, and it is the one mode whose whole rule is a
comparison of two suits. Its player-facing name is **Rock - Paper - Scissors - Aluminium Foil**, in
both catalogues (`challenge.rps.n` and every other key that names the mode), spelled out because
foil stopped being a footnote the moment it became a fourth throw; the code identifiers (`rps.ts`,
`RpsTable`, `RPS_ROUNDS`, the `"rps"` challenge id) stay short, the same split every other renamed
mode in this file already has. `startDeal`'s RPS arm sits _before_ `dealCards` and returns from there, but
it is not card-free: it shuffles `makeRpsDeck(mint)` — the **ordinary 52**, since all four suits are
throws — and deals `RPS_HAND` (12) to `ownerSeat(d)` and to `rpsFoe(d)`, so `uidSeq` moves by 52 and
the other two chairs keep empty hands. `dealCards` is skipped because it deals thirteen to all four.
Both cards are committed blind, exactly like the physical game expressed in a turn-based reducer:
the opponent's card is drawn from the run's own seeded `Rng` at the _start_ of a round, before the
player can act — in `startDeal`'s arm for round one and in `resolveRps`'s own next-round branch for
every one after — so it cannot react to the player even in principle.

- **Two new phases, `rpsthrow` and `rpsreveal`.** `nextTick` returns `null` for `rpsthrow` (the
  player's own decision) and, for `rpsreveal`, a tick for `resolveRps` behind `if (g.screen) return
null` — the same `handend` guard, because `resolveRps` ends the match by setting `g.screen` while
  leaving the phase at `rpsreveal`. Its key carries `g.rpsRound`, or the twelve rounds would share
  one key and the second would never fire. `waitingSeat` answers `rpsthrow` with `ownerSeat(g)`.
- **`rps.ts` is the rule and nothing else**: `makeRpsDeck`, `rpsThrowOf`, `rpsCompare`, `RPS_THROWS`,
  `beats(a, b)`, `rpsOver(round)`, `rpsWinner(wins)` and `rpsFoe(g)`, which answers "who plays" —
  `ownerSeat(g)`'s neighbour, `(ownerSeat(g) + 1) % 4` — since this mode seats two players, not
  four, and the other two chairs sit out entirely.
- **Four throws, one per suit: ♥ paper, ♠ rock, ♦ scissors, ♣ aluminium foil.** Only the three-way
  cycle is WRPSA v1.0's; the mapping and the fourth throw are the requirement's own, with no source
  anywhere, and the rules panel says so. `beats` is a `Record<RpsThrow, RpsThrow[]>` rather than the
  one-to-one map a three-throw cycle allowed, because foil takes two pairings: **foil wraps rock and
  paper, and only scissors cut it.**
- **The table is asymmetric on purpose, and that is arithmetic rather than a half-made choice.** Six
  pairings over four throws is 1.5 wins each, so a table deciding every pair of _different_ throws
  cannot make them equally strong; the fair alternative — a four-cycle whose two diagonals tie —
  cannot contain WRPSA's three edges, since those three already close a cycle of their own. The
  edges stay and scissors and foil win two pairings each. The asymmetry is **between throws, never
  between players**: both reveal from the same deck, which is what the README's 500-match sweep
  measures.
- **The ♣K and ♣Q are honours, not a throw — and so is Sofia, the ♥Q, on the losing side.**
  `rpsCompare` decides all three ahead of the throw table — the ♣K over every other card, the ♣Q
  over everything but the ♣K, and Sofia **under** everything but herself — and `rpsThrowOf`
  therefore answers `null` for exactly those three cards and `"foil"`/`"paper"` for every other club
  or heart. All three read `isKingOfClubs` / `isQueenOfClubs` / `isSofia` from `game/cards.ts`, the
  same predicates `PlayingCard.tsx`'s portraits use, so the rule and the face can never name
  different cards — Sofia's portrait (`src/assets/sofia.png`, cropped, colour- and sharpness-matched
  to `vaykka.png`/`katri-ristiakka.png` by hand) is unconditional exactly like the two clubs', in
  every mode, not only Politiikka; her letter badge (`.sofia`, the "S") is what stays Politiikka-only
  — see the Politiikka section below for that split. `isSofia(a) ? isSofia(b) ? 0 : -1` rather than a
  bare `-1` is what keeps `rpsCompare(x, x) === 0` for every card, Sofia included, which the
  antisymmetry sweep over the whole deck would otherwise catch at the one card compared to itself.
  Rank decides nothing anywhere else, and `rps.test.ts` pins that over every rank of every suit,
  Sofia's own exclusion (rank 12 of hearts) included.
- **Exactly `RPS_ROUNDS` (12) rounds, no early stop, no replay, and a draw is a real outcome.**
  `RPS_ROUNDS` and `RPS_HAND` are deliberately the same number: a hand is spent one card per round,
  so the match ends when the hands do. `resolveRps` adds one to `rpsWins[team]` only when
  `rpsCompare` is non-zero but always adds one to `rpsRound`, so a tie counts for neither side and is
  **not** replayed — WRPSA v1.0 replays it and decides a match at two wins, and both of its clauses
  are overruled here; the disagreement is written above `resolveRps`, because both look like missing
  code. `rpsWinner` returns `0 | 1 | "draw"` and **never `null`**: a draw is not "not decided yet",
  and returning null for it would make `rpsRowFor` file every drawn match as a loss.
- **`revealRps` carries a seat and a `uid`, exactly like every other player action**:
  `d.seats[p] === "human"`, the phase is `rpsthrow`, `p` is not the seat `rpsFoe` is, that seat has
  not already revealed this round, and the `uid` is in that seat's hand — identity by **uid**, never
  `id`. The card is **moved** out of the hand into `rpsCards[teamOf(p)]`, and `resolveRps` clears
  both slots before the next round.
- **State carries cards, not throws.** `rpsCards: [Card | null, Card | null]` is team-indexed like
  `rpsWins`, and there is deliberately no "last result" field: the felt recomputes the round's
  outcome from `rpsCompare`. `SAVE_VERSION` stays **3** and `hashState` is unchanged — the mode
  writes no snapshot and reaches no session, and `rpsCards` is null at every boundary a snapshot
  would be taken at.
- **The felt is `RpsTable`, drawn by `Table.tsx` in place of the ordinary felt**, gated on
  `g.challenge === "rps"` and read ahead of every hook the ordinary felt calls, since a component
  may not call a hook conditionally. It draws the two revealed cards, the running score, the round
  of twelve, the opponent's remaining count through `table.cardCount`, the round's outcome and the
  suit-to-throw legend built from `SM[s].g`. `Hand.tsx`'s `"rps"` branch draws the viewing seat's
  own cards as clickable `PlayingCard`s dispatching `revealRps` — no `HandTools`, no drag
  reordering, and the `Hint` line kept so `#app`'s grid row does not collapse. `Rail.tsx` draws
  `RpsPlate` in place of `ChallengePlate`, tested by id beside Multiplayer Tupatro's own three-page
  choice.
- **The opponent's card sits face down on the felt for the whole `rpsthrow` phase, not a bare card
  count.** It really is already drawn before the player can act (`startDeal`'s own arm, above), so
  `RpsTable` draws it that way: a static `.rpscardback` box, the same back pattern `.rpsdown` paints
  but with no animation and an explicit size, since there is no `PlayingCard` sibling to size the box
  the way `.rpsflip`'s own relative parent does. Both slots — "You" and "Opponent" — are drawn in
  every phase now, `rpsthrow` included, so the felt's own shape never jumps between selecting and
  revealing; "You" is simply empty until the phase becomes `rpsreveal`.
- **Face down, then both cards turn together — in CSS, with no timer and no extra phase.** The two
  slots draw a `.rpsdown` back over the card and one delayed animation turns it away; the slot is
  keyed by `uid`, so it mounts once a round and turns once, the same reason the trick's drop
  animation needs no bookkeeping, and the verdict line has a matching delayed fade so it cannot
  precede the cards. **`nextTick`'s `rpsreveal` delay is 1700 ms**: face down for 0.4s, turning until
  0.7s, verdict from 0.72s, then a full extra second after the reveal itself before the round
  resolves — 0.7s + 1000ms = 1700ms. `useGameLoop` is still the only `setTimeout` call site.
- **Whichever card lost the round spins and flies off the felt after it turns, in CSS, with no
  state of its own.** `Turned` in `RpsTable.tsx` takes a `lost: boolean` prop and adds a `.rpslost`
  class beside `.rpsflip` when it is true; its own delayed animation (`.8s`, `.45s` duration) starts
  once `.rpsturn` has finished and ends by `1.25s`, comfortably inside the `1.7s` an ordinary round
  keeps its cards for, so it is never cut off by the next round clearing `rpsCards`. `RpsTable`
  passes `cmp !== null && cmp < 0` for "You"'s own card and `cmp !== null && cmp > 0` for the
  opponent's, so a tie (`cmp === 0`) leaves both alone. **This started as Sofia's own effect** — she
  always loses this mode's own round, so `isSofia(card)` was the original gate — **and is now every
  losing card's**: she is simply the losing side most reliably, not a special case in the component
  any more (`isSofia` is no longer imported here at all; `rpsCompare` already handles her rule).
  `render.test.tsx`'s own describe block for this covers an ordinary loss on either side, a tie
  (neither card marked), and Sofia's own round (still marked — she is just never the exception).
- **The final round's own transition is split in two, so the result screen waits.** `resolveRps`
  settles the match arithmetic (`rpsWins`, `rpsRound`) exactly as any other round, but on the round
  that reaches `RPS_ROUNDS` it deliberately does **not** set `g.screen` — it returns with the phase
  still `rpsreveal` and the final round's own two cards still sitting in `rpsCards`, so the felt goes
  on showing them, verdict line included. A second `auto` action, `showRpsOver`, is what actually
  opens the `rpsover` screen; `nextTick`'s `rpsreveal` case checks `rpsOver(g.rpsRound)` ahead of its
  ordinary branch and, once true with the screen still null, schedules `showRpsOver` on its own
  2600 ms delay — longer than the 1700 ms reveal delay, on purpose: the player just watched the match
  decide itself and gets a beat to read it before the overlay covers the felt. Both reducer cases
  guard on `d.phase === "rpsreveal"`, and `showRpsOver` additionally refuses when `d.screen` is
  already set or the match is not yet actually over, so neither can double-fire.
- **`Panels()` draws nothing at all for `rpsthrow`, and `RpsRevealPanel` is gone.** A `#declpanel`
  box is `position:absolute` and centred over the felt, so it used to cover `RpsTable` rather than
  sit beside it — the one mode where the decision is a hand click, not a panel button, had no
  business hiding the felt behind one. `PHASE_PANEL.rpsthrow` in `render.test.tsx` is `false` now,
  and its own sweeps (`PANEL_PHASES`, both copies) drop `rpsthrow` automatically rather than needing
  a second edit.
- **The suit legend, the foil rule, the honours' rule and Sofia's rule live in `RpsTable` alone,
  and are drawn on every round, not only the first.** They used to be duplicated into the panel
  that is now gone, and were then gated on `g.rpsRound === 0` — drawn once and never again, on the
  theory that a twelve-round match repeating the full rules eleven more times was worth fixing. That
  gate is gone: the face-down opponent card already shows for itself that the throw is drawn but
  hidden (the one line the legend block used to spell out, `rps.throwHelp`, is deleted from both
  catalogues for saying nothing the card does not already show), but the suit-to-throw mapping and
  the three honours' rules are exactly the reference a player still needs on round eleven, not only
  round one — so they stay on screen the whole match.
- **Every round already played is recorded in `rpsHistory`, oldest first, and drawn to the felt's
  own top-left corner — plain suit-coloured rank text, not a `PlayingCard`, sized so all twelve rows
  fit with nothing to scroll.** `GameState.rpsHistory: Array<{ cards: [Card, Card]; winner: 0 | 1 |
  "tie" }>` is team-indexed exactly like `rpsCards` was for that round — never "mine"/"theirs" — so
  the state stays seat-absolute even here. `resolveRps` appends the entry it is about to clear
  `rpsCards` from, in the same step that updates `rpsWins`, so the two can never disagree;
  `startDeal`'s RPS arm resets it to `[]` for a new match or a replayed seed, the same as `rpsRound`
  and `rpsWins`. `RpsHistory` in `RpsTable.tsx` is its own component, to `.rpsboard`'s left inside a
  shared `.rpsfeltrow` — it draws nothing at all until the first entry exists, so a match with none
  yet looks exactly as it always did. `.rpshistory` is `align-self:flex-start` against
  `.rpsfeltrow`'s own centring of `.rpsboard`, which is what anchors it to the felt's own top-left
  corner rather than sharing the board's vertical centre — read as a fixed log beside a live board,
  not one composition. A `PlayingCard`'s own internal text is a fixed size and clips long before a
  card shrinks small enough for twelve of them to fit in one column, which is why the row is plain
  text instead: rank, a suit glyph coloured by `var(--suit-*)`, and a short won/lost/drawn label.
  Below 560px there is no room for a second column beside `.rpsboard`, so `.rpshistory` switches out
  of flex into CSS multi-column layout (`columns:3`, `break-inside:avoid` on each row) and wraps
  above the board instead — later in `index.css` than the unconditional `.rpshistory` rule on
  purpose, since two rules of equal specificity resolve by source order regardless of which media
  query is active, and a first attempt at this put the override earlier in the file, in the
  project's shared 560px block, where it silently lost every time.
- **Making the legend and the honours' rules permanent made `.rpsboard` permanently as tall as it
  used to be only on round one, and that clips a short felt.** `.rpsfeltrow`'s own
  `align-items:center` centres `.rpshistory` and `.rpsboard` together against `.felt{overflow:hidden}`,
  so once their combined height passed the felt's own available height it clipped symmetrically from
  both ends — `.rpshistory`'s top and `.rpsboard`'s bottom equally — measured at 360x640, worse in
  Finnish than English since the honours' rules run longer there (the clubs rule is two sentences).
  A block scoped to `@media (max-width:560px), (max-height:480px) and (max-width:920px)` — after
  every rule above it, for the same source-order reason — shrinks `.rpsboard`'s own gaps and font
  sizes, shrinks `.rpscardback` to match `.card`'s own short-window size (it did not before, and sat
  taller than the revealed cards beside it), and, in the narrow-portrait case alone, widens
  `.rpsboard` from its row-layout 280px to the felt's own width — the extra width is what keeps the
  honours' rules to two wrapped lines instead of three. Measured with the full 12-round history
  filled at 1280x800, 844x390, 390x844 and 360x640, in both languages: no clipping, no scroll.
- **`PlayingCard` prints no chip corner in this mode.** A chip count is meaningless where nothing is
  scored; the suit pip and the felt's legend carry the mapping instead. Hidden rather than
  repurposed into a throw glyph, because a new glyph needs a tofu probe.
- **Its own result screen, `RpsOver`, and its own board, `tupatro-rps-v1` at
  `RPS_SCORES_VERSION` 2.** `RpsRow` is `{ seed, result, wins, losses, at }` with
  `result: "won" | "lost" | "drawn"` — no score at all — sorted won, then drawn, then lost; then
  most rounds won, then fewest lost, then the earliest timestamp. The version bump is what discards
  rows written under the first-to-two rule rather than re-sorting them under a rule they were never
  played by, and it adds no `removeItem`. `RpsOver` dispatches `leaveChallenge` (a fourth site now)
  and calls `net.hangUp()` defensively, exactly as `ChallengeOver` does, even though no live session
  can ever actually reach this screen.
- **The opponent does not save its honours**, and that is the honest cost of adding no AI: it reveals
  uniformly from what it still holds, so a player who keeps the ♣K for a round that matters has an
  edge the bot never takes. A bot that saves its trump is the obvious next spec, and the README
  reports the measured shares rather than claiming the mode is even against a thinking opponent.
- **Not resumable, and single player only.** The mode reaches no screen at all before its result,
  and `GameProvider` only ever writes a snapshot at a screen boundary, so `readChallengeRun("rps")`
  stays `null` for the whole match and the single-player row's Continue only ever appears for the
  match this window is already in. `LOBBY_MODES` is untouched, so Rock-Paper-Scissors never reaches
  the lobby, the wire or a shared table; `SCOPE` gains three entries (`revealRps` seat, `resolveRps`
  auto, `showRpsOver` auto) and that is the _only_ change to `protocol.ts` — `NET_VERSION`,
  `hashState`, `guestMay`, `parseMsg` and the `NetMsg` union are all byte-identical.

**Politiikka** is the eighth mode: ordinary tuppi trick play — thirteen tricks, no trump,
_maantuntopakko_, the highest card of the led suit wins, ace high — with **no declaration at all**.
The deal type is a fixed rotation instead: odd `raceDeal` is a hallituspeli (rami, "the government's
game"), even is an oppositiopeli (nolo, "the opposition's game"). A **government** sits over the
top of that rotation — 3–5 of the game's thirteen existing `PARTIES`, drawn at the start of the
match and held for **four deals** (a term) before a fresh one is drawn — and a deal's worth is the
parties of the cards a pair captured, not its trick count. One card, the ♥Q ("Sofia"), wins every
trick she is played into regardless of rank, and is an ordinary card for that party scoring: her
value comes from her own party like any other card's. **This was two modes, GitHub issue #49's own
chat (the rotation and Sofia) and issue #63's own unfinished one (the government and its scale),
shipped as two separate rows on 2026-09-19 and merged into this one on 2026-09-20** — see
`docs/specs/2026-09-20-combine-politics-modes.md`; neither half has any source at all, exactly like
Ikiliikkuja's ♣K and Rock-Paper-Scissors' two clubs.

- **`game/politics.ts` and `game/puolue.ts` are this mode's two arithmetics, and nothing else**:
  `politicsMode(dealNo): Mode` answers the rotation (odd = `"rami"`, even = `"nolo"`) and
  `sofiaIn(trick): TrickPlay | null` answers "is the loud one in this trick", both in `politics.ts`;
  `termOf(dealNo)`, `governmentFor(seed, term)`, `puolueValue(gov, mode, party)` and
  `puolueTrick(gov, mode, parties)` are in `puolue.ts`, which reads `politicsMode` directly rather
  than re-exporting it — one function, one import path. Neither file touches a wallet, a boss or a
  `base`, so both sit in `PURE_CORE` beside `points.ts`, `nami.ts` and `rps.ts`.
  `isSofia(c) = c.s === "H" && c.r === 12` lives in `cards.ts` beside `isKingOfClubs`/
  `isQueenOfClubs`, the same card-type-not-uid shape, and it is the one test both `currentWinner`
  and `PlayingCard`'s marker read.
- **The government is derived from the seed, never stored.** `governmentFor` draws from
  `makeRng(seedHash(seed + ":gov:" + term))`, the same trick `rollParties` uses, so it costs no
  `GameState` field and no `SAVE_VERSION` bump, and a resumed match keeps its government because
  `seed` and `raceDeal` are both already saved.
- **`startDeal`'s one arm increments `raceDeal` before calling `politicsMode`**, so deal one reads
  as a hallituspeli, fires `toast.newGov` on a term rollover (`(raceDeal - 1) % PUOLUE_TERM === 0`,
  deal 1 included), and goes straight to `beginPlay`: `ramSeat`/`ramTeam` stay null, the elder hand
  leads, and there is no `runDeclarations`, no swap phase (a match has no tuppipakka), no sooli
  offer, no _ryöstö_ and no temppu draw — nothing for any of them to hang off with no declaration.
- **`currentWinner` answers Sofia before the strict `>` comparison, gated on the id.** `sofiaIn`
  runs first when `g.challenge === "politiikka"`; the rank comparison and the stone/wild handling
  below it are byte-identical for every other mode, main game included. She still has to follow suit
  like any other card — `legalCards`/`matchesSuit` are untouched — so the rule is only ever about who
  _wins_ a trick she was legally played into.
- **`resolveTrick` scores the parties of a trick's cards under the deal's own government and mode,
  in one arm**: `d.raceBase[teamOf(w.p)] += puolueTrick(governmentFor(d.seed,
termOf(d.raceDeal)), d.mode, cards.map(c => partyOf(d, c)))`, plus `toast.sofia` when
  `sofiaIn(d.trick)` is non-null, so the player is told why a queen just beat an ace. No
  `scoreTrick`, no tuppi multiplier, no money, `d.pop` stays null. A government card pays in a
  hallituspeli and costs nothing in an oppositiopeli; an opposition card is the mirror — the issue
  names one side per deal type and is silent about the other, so this is the literal reading.
- **The naive ±1 reading does not terminate, which is why `GOV_POINT`/`OPP_POINT` are separate,
  measured constants**, constrained by `3 x GOV_POINT > 10 x OPP_POINT` (worst case a 3-party
  government) — the full proof is in `puolue.ts`'s own comment and `puolue.test.ts`, including the
  paragraph added on 2026-09-20 confirming Sofia cannot break it: she redistributes which pair a
  trick's value goes to, never how much value a deal's 52 cards carry in total.
- **`endHand` banks `raceBase` into `raceScores` for both pairs, cumulatively, in the Nami arm —
  never the `race`/`tuppi`/`tupatro` branch.** That branch also carries Traditional Tuppi's
  lost-lead reset (`d.challenge !== "race"`), which is tuppi's own rule for a pair that _declared_ a
  rami and lost it. Nobody declares in Politiikka, so there is no lead to knock down; giving it the
  reset anyway is the sharpest trap the spec names, and a `reducer.test.ts` case pins the branch is
  not widened. `dealPoints` and `points.ts` are untouched and no longer reachable from this mode at
  all — it banked tuppi's own point table before the 2026-09-20 merge, on the id's own now-retired
  `POLITIIKKA_TARGET` and `tupatro-politiikka-v1`.
- **`chooseAI` keeps the two clauses each half already had, gated on the id, and learns nothing
  new**: a trick already holding Sofia cannot be won, so the "can I win this" filter is empty and
  the existing win/duck machinery takes over unchanged; separately, whether the cards already on the
  table are worth taking under the deal's own government and mode, recomputed trick by trick — the
  same shape Nami's own `wantsTricks` clause has. Neither consumes randomness, so a Politiikka deal
  replays identically from its seed.
- **The target is `POLITIIKKA_TARGET` (100) in `constants.ts`, re-measured from scratch on
  2026-09-20** rather than inherited from either half: Sofia feeds the party-capture scale directly,
  so the mode's old scale's target could not simply carry over. 200 seeded matches, all AI, both
  rule clauses live, walked past every candidate with the trajectory technique (`raceScores` never
  resets here). 70–90 miss the spec's band (median under 8 deals); 100 is the smallest candidate
  that clears it — median 9, p90 13, every match finished. `(GOV_POINT, OPP_POINT) = (4, 1)` are
  unchanged, re-confirmed by the same run. See README.md for the full candidate table.
- **Its own board, `tupatro-politiikka-v2`** (moved up from v1 on 2026-09-20, since a v1 row was
  played on the old dealPoints scale against a different target and cannot be sorted against a
  party-point row) **, and its own saved slot, `tupatro-run-politiikka-v2`, through a documented
  per-id record in `challengeRunKey`** rather than the plain `tupatro-run-<id>-v1` every other id
  gets — so a run saved under either retired half is simply not found. No other board key or run
  slot moved. `SAVE_VERSION` stays 3 and `RACE_SCORES_VERSION` stays 1: `GameState` gained no field,
  `raceDeal` already carries the rotation and is already saved, and `rehydrate` rejects a payload
  naming the retired id through its existing `CHALLENGES` check.
- **A rail page of its own, `GovBox`, lists the term's government** — `Rail.tsx` draws a three-page
  strip (`rp-challenge`, `rp-gov`, `rp-game`) the same shape Multiplayer Tupatro's `rp-kit` page has.
  `PlayingCard` marks a government party's own emblem with a class of its own, gated on this id
  alone; `trad` stays exactly `"tuppi" | "race"`. Sofia's own letter badge (the "S") is gated the
  same way, but that is now the _only_ Politiikka-only thing about her — her portrait, added for
  Rock-Paper-Scissors' own always-loses rule, draws in every mode, this one included.
- **`ModeBox` has one politics arm**, drawing the deal's own real `mode`
  (hallituspeli/oppositiopeli) and a note pointing at `GovBox`, and never calls
  `seatName(ramSeat ?? 0, …)`, which would invent a declarer. `Hint` is untouched — `mode` is a real
  `"rami"`/`"nolo"` here, so the ordinary follow/lead lines are already true.
- **Single player only, exactly like Nami and Rock-Paper-Scissors.** `LOBBY_MODES` is untouched, so
  no session can ever carry the id; `NET_VERSION` stays 11 and `protocol.ts` is byte-identical.

**Every mode that runs a declaration offers sooli to both defenders, bots included.** The
[both-defenders spec](docs/specs/2026-09-09-both-defenders-sooli.md) shipped this for the two
match modes alone, with final gates, mutation checks and browser verification passed; **its
"main game retains its single human-defender offer" criterion is reversed by
[2026-09-16-ai-takes-sooli-when-sensible](docs/specs/2026-09-16-ai-takes-sooli-when-sensible.md)**,
which is implemented in the working tree, and the house tie-break below now covers the main
roguelike run too. The primary Oulun seniorit sheet (Antti Auer, 9 September 2022) and
korttipeliopas.fi allow either defender but do not settle competing claims. Sequential offers are
a **house rule**: humans before bots, then clockwise from the dealer's left within the same kind.
First acceptance wins; a decline reaches the next defender, and only both declines start rami. No
offers for nolo or the declaring pair.

- `sooliCandidates` derives the order for every mode alike; `sooliSeat` carries the active
  candidate and then the soloist. No new state fields or timer sites, in either spec. `aiSooli`
  carries both seat and phase, is guarded against stale/wrong-seat/wrong-phase actions, and is
  scheduled only for AI seats through `nextTick` — which, since the September 16 spec, no longer
  gates that scheduling on `g.challenge` either. Human responses cannot act for bots. The
  both-defenders work took `NET_VERSION` to **4**, which is historical: **5** is the later
  room-first lobby protocol, **6** is the `leaveChallenge` reclassification, **7** is the
  main-run offer and **8** is the shared table's `table` message. `SCOPE` classifies `aiSooli` as
  `auto`, the parser validates it, and older peers are rejected before play.
- **Bot acceptance reads only its own hand and consumes no RNG:** at most one 10–K and at
  least one A, 2 or 3 in every occupied suit — a **stone** card counts as neither, since it can
  never win a trick and has no suit to guard, and a **wild** card guards every suit the hand
  holds when its own rank would guard one, since it follows every suit. Its discard is the
  highest sooli rank, ace low. Exchange and readiness run automatically; the declarer leads, the
  soloist plays last and its partner sits out. The partner's return remains private and random.
- **Match return draws use a UID-sorted copy of the partner's hand; the main run's stays
  unsorted.** Local sorting/reordering is deliberately absent from the hash, so a match's
  drawing by its displayed index would pick different cards on different peers from the same RNG
  value — the main run has no such peer to diverge from, and its hand order is part of the saved
  state, so canonicalizing it would move every replay for no reason. Canonicalize the match copy,
  not the hand, and use `uid`, not face identity.
- **In a sooli only the soloist's pair banks, in every mode.** The race already restricted this to
  the soloist's pair (`dealScores`); the main run now reads the same way, in `tuppiInfo` and
  `resolveTrick`, once the run owner's pair can be the non-soloist side. `tuppiInfo`'s `sooliSeat`
  parameter answers a non-soloist team with `mult: 0` and its own need key rather than the
  soloist's own `need.sooli` / `need.sooliBust`, and the `$6` cash-out bonus follows the same
  gate. `scoresFor`'s own sooli branch stays team-blind by design — the soloist is either team's
  same question — so the gate belongs at each caller, not inside it.
- Only the active human sees offer/exchange/readiness controls. Other seats see named waiting,
  never that soloist's exchanged cards; `ModeBox` names the actual soloist. Fixed network seats do
  not switch. This is UI privacy, not protection against devtools.

Neither target nor scoring changed: Race stays cumulative to 12,000 with bust 0; Traditional
stays reset-banked to 52 with raw sooli values 24 held / 24 to the declarers on a bust.
[README balance](README.md#the-race) records the **final, post-canonical-return** measurement:
2,400 matches / 34,972 deals, all completed, with independent banking totals checked after
every deal. Policy A uses AI declaration/card play at the human seat but declines human sooli;
it is not fully symmetric. Its Traditional median is 30 deals (mean 39.265, maximum 284), Race
median eight (mean 8.0875). The baseline Traditional median 30.5 and older cumulative median
eight are historical, not current. In Traditional A, 98/170 bot attempts busted: conservative
does not mean optimal. Main-game `SEED0`…`SEED199` is **1,440 deals, mean 763.928472**, measured
after `2026-09-16-ai-takes-sooli-when-sensible` let bot defenders solo in the main run; the
1,634-deal aggregate at mean 659.235618 this line used to carry was never reproducible and is
withdrawn. Intermediate noncanonical measurements must not replace the final table, and a figure
here must agree with the README's — they disagreed for one commit, which is what withdrew it.

`laydown.ts` is the rule and the reducer is its authority: the `layCards` case re-runs
`validateLay` rather than trusting `LaydownPanel`, and `aiLaydown` runs `chooseLaydown`'s answer
through the same function and **passes rather than throwing** if it is rejected. Six refusals, one
toast key each, all six reached directly in `reducer.test.ts`.

Two things about the challenge break the project's own patterns, deliberately:

- **The 60-second turn is timing that is not data.** It is a limit on a human's thinking, so it
  lives in `useGameLoop` (a fourth effect, keyed on the turn's number) and **not** in `nextTick`.
  A tick for the player's own turn would make `drive.ts` auto-pass for a bot that has a move and
  every headless measurement of the mode would measure nothing. It is the only such timing in the
  project, and it is invisible to the headless driver by design.
- **`startChallenge`, `leaveChallenge` and `resumeGame` replace the whole state**, so all three sit
  in `gameReducer`'s produce callback beside `newRun` rather than inside `apply()`, which mutates
  the draft in place. `original(d)` is what they read: `dehydrate` must see plain objects, not
  Immer drafts. A challenge started from within a challenge (Play again) carries `parked` across
  rather than dehydrating the challenge, because `dehydrate` drops `parked` and the main run would
  be lost — `resumeGame` gives `parked` the identical rule.

A challenge **is saved now**, on a slot of its own: `GameProvider`'s effect still returns before
`writeRun` whenever `state.challenge !== null`, but inside that branch it writes
`tupatro-run-<id>-v1` at the same screen boundaries the main run uses, clearing that slot instead
on the two result screens — right before the board row is filed exactly as before. Both the write
and the clear are gated on `soloBoard(state)`: a two-human board has no single seat to hand a
resumed game back to. `game/storage.ts`'s `readChallengeRun` / `writeChallengeRun` /
`clearChallengeRun` are the door, `save.ts`'s `resumable(raw, id, bestAnte)` is what a Continue
button trusts before offering one — `rehydrate` plus two refusals, a mismatched id or a non-solo
board — and the single-player screen's per-row Continue dispatches `{ type: "resumeGame", saved }`
with the raw payload. **Booting still lands on the main run alone**: `initialState` reads only
`tupatro-run-v1`, so a reload still opens the start menu over the roguelike, and a challenge in
progress waits on its own row rather than resuming itself — see the persistence gap below for what
that does and does not fix. Tuppi-Rummikub's own board is still `tupatro-challenge-<id>-v1`, and
each match mode's is still **`tupatro-race-v1`** or **`tupatro-tuppi-v1`**; none of the four board
keys changed shape, and neither did `SAVE_VERSION`, which stays 3 — see `save.ts`'s header comment
for why a challenge's own fields are validated rather than bumped.

**A match mode's key is deliberately not `tupatro-challenge-<id>-v1`, and the two modes do not
share one either.** A `RaceRow` is a _superset_ of
a `ChallengeRow` — seed, score, at — and both board versions are `1`, so `parseChallengeScores`
accepts a race payload without complaint and simply sorts it by the wrong key: a lost race worth
more points would outrank a won one. Two parsers over one key is how a board silently becomes a
different board, and `scores.test.ts` pins exactly that. The same argument one level up is why the
two match modes have a key each: one row shape over two scales, and a 52-point traditional match
filed on `tupatro-race-v1` would be outranked by every chip-scale row there. A match board files
**lost matches too**, unlike a challenge's, and sorts won first, then the **fewest deals**, then
the higher score.

## The scoring order is locked

In `scoreTrick` the order is:

1. card additions (`mult` cards; `bonus` is already in `chipValue`)
2. joker additions (`j.add`)
3. card multipliers (`glass`, `steel`)
4. joker multipliers (`j.xm`)
5. retriggers (`j.retrig`) and money (`j.won`, gold cards, via `ctx.payout`)

In Balatro the order is the joker row's order and the player drags it themselves. Here it is
automatic, so purchase order cannot silently cost score. **This is a deliberate deviation** — if
you ever add joker drag-reordering, remove the automatic ordering at the same time.

`scoreTrick` is pure: it **returns** `ctx.payout` rather than adding to `g.money`. The reducer
applies it. Do not reintroduce the mutation.

## Balance is measured, headlessly

The ante thresholds (`ANTES`) were set by measuring, not guessing. Simulation runs the real game
rather than a separate model, because a model and the game would drift apart.

Because timing is data, measurement needs neither a browser nor anything stubbed.
`game/drive.ts` plays the automatic steps synchronously, and `src/test/bot.ts` supplies the
decisions:

```ts
import { playRun, basicPolicy } from "./src/test/bot";

const runs = Array.from({ length: 200 }, (_, i) => playRun(`SEED${i}`, basicPolicy));
const scored = runs.flatMap((r) => r.deals);
// mean deal score, win rate by ante, whatever the question is
```

Write the measurement as a throwaway script or a `*.test.ts` you delete afterwards. Seed the
runs to make a measurement reproducible.

**A bot measures the bot, not the mechanic.** The first side-deck measurement suggested the side
deck made scores _worse_ — because the test bot swapped blindly and dumped its highest card,
which is right in nolo and wrong in rami. Given a sensible policy (decide the line before
swapping), the same side deck was worth +49%. If a mechanic's value lies in a _decision_, the
`Policy` has to make that decision or the measurement is worthless.

That +49% was measured before the same-card rule. Under it there is no card to give up, so
`basicPolicy.swap` simply takes every swap it can, and a full mixed side deck measures +8%.

Measuring it also caught the shop: `rollCardOffer` used to hand every stone card a fixed
**2♠**, which under the same-card rule made a second stone card unbuyable in practice — both
queued for the one card in the deck. Stone is rolled a suit and a rank like every other
enhancement now. A stone card plays with neither; the pair says only which card it upgrades,
which is why `PlayingCard` prints it (behind the `twin` prop) in the tuppipakka and nowhere
else — on the felt it would read as a card that could follow suit.

Current measured figures are in the README. Update them when balance changes.

## Tests

2,858 permanent tests passed in the last reported run, Vitest + Testing Library, co-located
with the code they cover. Final both-defenders gates passed; browser probes covered both locales
and match modes at 1280×500 and 390×844. The spec records the verification limits.

| File                         | Covers                                                             |
| ---------------------------- | ------------------------------------------------------------------ |
| `game/laydown.test.ts`       | Pip values, sets, runs, and every one of validateLay's refusals    |
| `game/race.test.ts`          | Per-pair deal scoring, the win test, and that a match terminates   |
| `game/points.test.ts`        | Tuppi's point table 0-13, and the 4 x tuppiMult identity           |
| `game/nami.test.ts`          | Both point tables, the whole-deck sums, the sum-to-4 identity      |
| `game/rps.test.ts`           | The four-throw table, the deck, antisymmetry, rank-blindness       |
| `game/politics.test.ts`      | The rami/nolo rotation, and that exactly one card answers isSofia  |
| `game/puolue.test.ts`        | The government draw, the five scoring cases, the termination proof |
| `game/seats.test.ts`         | The pinned engine golden, and the same deal played from any seat   |
| `game/state.test.ts`         | Hand layout order: the colours alternate, the engine's does not    |
| `game/rules.test.ts`         | Follow-suit, trick winner, stone and wild, deck, content purity    |
| `game/scoring.test.ts`       | Trick types, the whole multiplier table, enhancements, bosses      |
| `game/reducer.test.ts`       | Flow: declaration, sooli, cash-out, shop, tricks, a whole blind    |
| `game/rng.test.ts`           | Seed normalisation, replay determinism, whole-run replay           |
| `game/save.test.ts`          | Snapshot round trip, every rejection, identical play after it      |
| `game/scores.test.ts`        | Board order, truncation, idempotence, every parse rejection        |
| `net/seating.test.ts`        | A room's chairs, a full table, and which peer a guest calls host   |
| `net/room.test.ts`           | The room id, the two configs, targeted sends, a peer leaving       |
| `hooks/GameContext.test.tsx` | Resume, seed precedence, when the run is written and cleared       |
| `hooks/useNetGame.test.tsx`  | The host's link wiring: what marks the table's invitation live     |
| `i18n/i18n.test.ts`          | Placeholders, list lengths, data rows, no stray Finnish            |
| `test/render.test.tsx`       | Every screen, panel, modal, menu and phase in both languages       |
| `test/invariants.test.ts`    | Source boundaries, one timer site, one `Math.random`, no `let`     |
| `test/harness.tsx`           | `renderWith(state, ui, locale, seat)` and `loadedState()`          |
| `test/bot.ts`                | The headless policy bot, for flow tests and balance                |

`hooks/gameContexts.ts` exists so `renderWith` can inject **any** state into **any** component
without a test-only door in production code. Use it; do not add an `initialState` prop to
`GameProvider`.

**Run a mutation test when you add assertions.** Break the rule on purpose and check that a test
fails:

```bash
cp src/game/rules.ts .bak
perl -pi -e 's/rv\(g, t\.card\) > rv/rv(g, t.card) >= rv/' src/game/rules.ts
npx vitest run; mv -f .bak src/game/rules.ts
```

This exposed a weakness in an earlier test: "a stone card does not win the trick" used a two,
which would not have won anyway. An assertion has to use a card that **would** win without the
rule.

Browser testing is still worth doing for what jsdom cannot show: layout, animation, and how the
timing actually feels. Use `npm run dev` and drive it with `element.click()`.

## UI rules learned the hard way

**Most important content first in a panel.** `#declpanel` scrolls on a short window and the
buttons sit in a sticky footer. This broke twice: first the RAMI/NOLO buttons were hidden, then
the side-deck cards. Put whatever the decision needs (hand strength, the cards to pick from)
**before** the explanatory prose. Always test at a window height of ~500 px too. It broke a third
time in the shop's replace picker, which is not `#declpanel` at all — `.overlay` is the scroller
there — and a full tuppipakka of five rows pushed confirm and cancel below the fold at 1280x500
and at 360x740. `.replacepick .row` is sticky now for the same reason. **A footer of buttons in a
list that grows with the player's inventory needs the sticky treatment wherever it is drawn.**

**An overlay covers the rail, so a rail button is not "always" reachable.** `.overlay` is
`position:fixed; inset:0`, and every `Screen` renders through it — the rail's Rules, SCORES and
Menu buttons can only be clicked with `g.screen === null` and `g.menu === null`. That is why
the start menu carries a Rules button of its own, why the single-player screen behind it carries
the board's, why the blind select and
the game-over screen carry Rules buttons of their own, and why every screen that does not already
draw the board (`BlindSelect`, `Shop`, `DealEnd`, `CashOut`) holds a `ScoresButton`.
**SCORES is not on the start menu**: the board `ScoresModal` draws is `readScores()` alone, the
solo roguelike's own top ten on `tupatro-scores-v1`, so it lives behind the Single player door with
the run it records. That door asks to hang up before it opens while a session is live, which makes
the board unreachable from the menu without leaving the session first — accepted, because no
session writes a row to that key. A new screen
needs the same, or the board it hides becomes unreachable. The sweep's `SCREENS` fixture in
`src/test/render.test.tsx` is keyed off `Screen["kind"]`, so a new kind fails to type-check until it
is listed there with a Scores button or a drawn board. The gate is the compiler — `npm run
typecheck` and `npm run build`; Vitest transpiles without type-checking, so `npm test` alone cannot
see a missing kind. **The menu is not covered by that fixture**, since it is keyed off
`Screen["kind"]` and the menu is a third field — `Menu` and `SinglePlayer` are held by hand-written
tests in the same file instead. The board is reached the other way round from before: it was
`Challenges` that got there through Back, because the menu held SCORES; now `SinglePlayer` draws
the `ScoresButton` itself and `Menu` reaches the board only through that door.

**A list inside a scrolling panel must not scroll on its own.** `LaydownPanel` first gave
`.layrows` and `.layhand` a `max-height` and `overflow-y:auto` of their own. Inside `#declpanel`,
which is itself the scroller and whose footer is sticky, that put each list's last rows _under_
the footer, where `elementFromPoint` returns the footer and a click cannot reach them: measured
over CDP at 1280x500 with six rows on the table, every row and every hand card unreachable. One
scroller — the panel — and the lists grow inside it, the same shape as `.replacepick`. Measured
after, at **1280x800**, **1280x500** and **390x844**: no page scroll, the footer's three buttons
on screen and hit-testable, and every row and every hand card reachable.

**A wrapper that generates no box still has to be named in the selectors.** `Rail.tsx` wraps its
plates in five `.railpage` elements so a phone can swipe between them, and outside
`@media (max-width:560px)` those wrappers are `display:contents`. That alone does not leave the
wide layouts alone: `.rail > *{flex:1 1 190px}` in the 820 px block matched the wrappers, which have
no box to give the basis to, so the wrapping row at 800x600 collapsed to one column. The selector
is `.rail > *, .railpage > *` now, and it must stay **before** the `.railbtns{flex-basis:100%}` rule
that overrides it. The next wrapper needs the same treatment, and jsdom cannot see any of it —
`npm test` lays out nothing, so the proof is a Chrome-emulation reading at 800x600.

**Decision panels are not modal.** The declaration, the side-deck swap and the sooli card choice
all render through `DeclPanel` on top of the felt, not through `Overlay`. The reason: the player
has to see and rearrange their own hand while deciding. `Overlay` is only for views where the
hand is not needed (blind select, shop, rules, results).

**An automatic choice is not a decision.** The sooli card exchange was implemented correctly per
the rules, but the game picked the card for you and reported it in a toast that vanished — the
player never saw it. If a rule gives the player a choice, make it a visible step (`sooligive` →
`sooliready`).

**Do not optimise the renderer.** One context means every consumer re-renders on any state
change. For 13 cards that is far below anything a player can perceive. Measure before adding
`memo`, selectors or a store library.

**Test new glyphs against tofu.** Draw the glyph to a canvas and compare pixels against U+E000;
a width comparison gives false results in monospace. Stick to widely supported characters:
suits, arrows, geometric shapes, letters and digits. Ten exotic glyphs (⌫ ✇ ☚ ✤ ⚑ ✎ ⚒ ☺ ♛ ♻) were
replaced for this reason.

**The AI is heuristics.** `chooseAI` branches on whether the side wants tricks (`rami`) or wants
to dodge them (`nolo`/`sooli`). Leading a low card against a sooli is lethally strong, so there
is a deliberate 0.35 randomness there — otherwise sooli would succeed 4% of the time. Do not
"fix" it to be optimal.

**`src/index.css` is hand-formatted and excluded from Prettier.** It is one deliberately compact
stylesheet, and it targets `#app` and `#declpanel` by id — those two ids are load-bearing.
Everything else is classes.

**A media-query override loses silently if it sits earlier in the file than the rule it means to
override.** Two selectors of equal specificity resolve by source order alone, and that is true
_inside_ a media query exactly as it is outside one — whether the query's own condition is true or
false decides nothing about ordering. `.rpshistory`'s narrow-width layout (Rock-Paper-Scissors' own
history strip, above) first landed inside the project's shared `@media (max-width:560px)` block near
the top of the file, ahead of the unconditional `.rpshistory` rule declared later, in the
Rock-Paper-Scissors section — so the later, unconditional rule always won, at every width, and the
phone layout silently kept the desktop one. Caught only by an actual screenshot at 390×844, not by
reading the CSS: jsdom lays out nothing, so `npm test` cannot see this class of bug at all. Put a
narrow-width override for a component's own rule **after** that rule, in the same section, in a
media block of its own if the component does not already have one nearby — do not assume the
project's one shared 560px block is late enough in the file for a component declared further down.

**Guard clauses over nesting.** Early `return` on the impossible cases; keep the happy path
unindented. Every `case` in the reducer starts with its guards.

**Effect functions must be total.** Joker and enhancement effects run inside `scoreTrick` with
no error boundary; a throw kills the deal. Do not assume array lengths or optional fields.

**`content.ts` is data, not logic.** Joker effects read everything they need from the scoring
context (`c.money`, `c.sideDeckEnh`, `c.payout`) rather than the live state, which is why the
table stays pure and testable. A test asserts no effect reaches for game state. Adding a joker
is one entry and no engine change. Adding an **enhancement** or a **boss** is not — see the four
touch points above. A boss also picks a side: `SMALL_BOSSES` is the mild pool the small boss
blind draws from, `BIG_BOSSES` the harsh one for the big boss blind, and `BOSSES` is their
concatenation — the one table `save.ts` and the i18n test look in.

**No module-level `let`.** A test enforces it. Mutable module state is invisible to the reducer
and does not survive StrictMode.

**Comments say why, not what.** The valuable ones record a decision
that looks like a bug: the strict `>` in `currentWinner`, the deliberate randomness in the
anti-sooli AI, the `if (g.screen)` guards that stop a tick from looping.

**Formatting is Prettier's job**, with `// prettier-ignore` on the compact data tables
(`JOKERS`, `ENH`, `SM`, `TYPES`, the `createRun` literal) where one entry per three lines beats
one property per line. Run `npm run format`; CI checks it.

## Known gaps

Deliberate, not forgotten:

**Start-menu scope update (September 14), which reverses the September 13 one.** The menu asks the
question again: **Single player** (`{ type: "showMenu", view: "single" }`) and **Multiplayer**
(`{ type: "showMenu", view: "lobby" }`) are its two doors, and with Rules and the language
button they are the whole of it — **SCORES is behind Single player**, in `SinglePlayer.tsx`'s
footer beside Back, because the board it opens is the solo roguelike's own and no session files a
row on it; the door's own confirmation therefore hides it from a live window without a hang-up in
between, deliberately. **The menu itself still dispatches no run at all**; what moved is
where the run is dispatched from. `SinglePlayer.tsx` holds Continue, the new roguelike run and all
five alternate rule sets, and `RestartConfirm`'s confirm dispatches a bare `{ type: "newRun" }`
again — `2026-09-07-new-game-skips-seat-picker`'s criterion, reinstated one screen lower. The
lobby is multiplayer-only: `LOBBY_MODES` is `["tupatro", "race", "tuppi"]`, `net.match` is a
`MatchId` defaulting to `"tupatro"`, and
`peersHere` and `lobby.runSolo` are gone with the mode they refused.

The September 9 rules that stand, one screen down: **Continue** belongs to a started roguelike with
exactly one human seat, or to a run `parked` behind a challenge, and it is a `MoveButton` because
of the `leaveChallenge` it dispatches. **`2026-09-16-confirm-hang-up-to-play-single` withdraws the
door's `disabled={net.live}`**: a disabled button fires no click event, so the guard could not also
ask a question. The door is an ordinary `MoveButton` now, and its handler branches on `net.live` to
open the `"hangup"` modal instead of the single-player screen; `HangUpConfirm.tsx`'s confirm calls
`net.hangUp()` before it dispatches `closeModal` and `showMenu "single"`, so this window has
already left the session by the time that screen draws. `menu.singleLive` still carries both
reasons under the door — resuming a run of your own is walking out of a session not yet left, and
every mode there builds a one-person board a guest's chair could not play — it just no longer sends
the reader to the lobby to hang up first, since the door does that itself. The seed dialog and
`newRun`'s `flow` scope are unchanged, so the hosted-main-game gap now runs through the seed chip
**alone**.
See `docs/specs/2026-09-16-confirm-hang-up-to-play-single.md`,
`docs/specs/2026-09-14-single-player-separate-from-multiplayer.md`,
`docs/specs/2026-09-13-lobby-first-solo-and-viewer.md`,
`docs/specs/2026-09-09-start-menu-solo-run.md` and `Menu.test.tsx`.

**The contextual return moved into the lobby (September 14, again), off the start menu it had just
been widened to cover.** The **return label reads the game behind the menu, never the
session** — `lobby.returnChallenge` / `lobby.returnMatch` / `lobby.returnGame`, all local
`closeMenu` actions, keyed off `g.challenge` and not off `net` — but it is no longer on the start
menu at all: it is drawn once in `Lobby.tsx`, immediately before Hang up, on every live footer a
window with a session can land the menu on (the host's room page, the host's code-swap page, and
the guest's and shared table's waiting page), gated on `net.live && runStarted`. The menu itself
reads no game state any more — `useGameState` left `Menu.tsx` with the button — so offline the two
Continues on the single-player screen are the whole way back, exactly as before this button
existed. See `docs/specs/2026-09-14-move-return-button-to-lobby.md`.

**Nobody new joins a match already under way, but a guest that was already in it can come back —
on the room route.** `2026-09-19-guest-reconnect-mid-match` (`docs/multiplayer.md` has the fuller
account) gave `hostSession.sequence()` a bounded ring buffer (`RESUME_LOG_MAX`, `src/net/protocol.ts`)
of every action it has broadcast and an `enrolled` map of every peer it has ever welcomed, pruned
only while the lobby is still open. A guest whose link drops and reopens sends `resume` naming the
next action number it needs — `guestSeating.onPeer` calls it instead of `hello()` once
`session.welcomed()` is true — and the host answers with `catchup`, carrying exactly the actions it
missed for `guestSession` to replay through the same path `act` uses. **Late joining by a peer that
was never in the match, and a host coming back, both still refuse exactly as before**:
`hostSession.receive`'s `hello` case still refuses any peer once `seq.n > 0` with `bye` and `late`,
and a `resume` the host cannot honour — never welcomed, no match started, or asking for an action
outside the retained log — is `bye` plus the new `stale` status rather than `late`, since that peer
really was in the match. The code-swap route gets none of it: its `RTCPeerConnection` closing is
terminal and nothing re-offers an invitation, so a drop there still ends the game. What shipped
before this for the cases it still does not cover stands unchanged: the code where a latecomer can
read it (`NetBanner` draws `net.room` as text while live) and an honest refusal on the window that
arrives too late (`SessionStatus`'s `refused` member, `guestSession` mapping a `bye` **before**
`welcomed()` to it and one after to `dropped`). The current version is **11** — see the two version
paragraphs above, and `docs/multiplayer.md`.

**The lobby's Start stays enabled while a match is under way, and the new return button makes that
reachable in a way it was not before.** `net.canStart` (backed by `hostSession.canStart`) is
seating only — `players.size > 0 && every seat !== null` — and knows nothing about `seq.n`, so a
host who opens the lobby mid-match to click **Back to match** / **Back to challenge** / **Back to
game** is one unconfirmed click away from `Lobby.tsx`'s `start`, whose `net.start()` sends
`startChallenge` — a `flow` action in `SCOPE`, so the host numbers and broadcasts it — and re-deals
the match for every peer with no warning. No confirmation and no `seq.n`-aware gate is added; the
fix is one or the other, and is not in this spec (`docs/specs/2026-09-14-move-return-button-to-lobby.md`).

- **Accessibility.** No ARIA roles or labels anywhere but the phone rail's two page arrows, which
  carry one each; the cards are focusable divs. `focus-visible` and `prefers-reduced-motion` are
  handled, the semantics are not. **Focus order no longer matches visual order in the rail, at any
  width**: `.railbtns` moved into the page-5 wrapper, so it is DOM position 3 of `.rail` and
  `order:1` restores the pixels but not the tab sequence. Tabbing reaches Rules / SCORES / New game
  before the joker sell buttons and the consumable buttons on a desktop, and on a phone the tab
  order is not the swipe order.
- **Run persistence is a snapshot at screen boundaries.** `game/save.ts` turns the state into
  a JSON-safe snapshot and back; `GameProvider` writes it to `tupatro-run-v1` whenever
  `g.screen` is set — blind select, deal end, cash-out, shop — and clears it on game over and
  victory, so a refresh resumes at the last screen and never in the middle of a trick. Content
  that carries functions (jokers, consumables, the boss, the shop stock) is stored as ids and
  looked back up in the tables; `menu`, `modal`, `toast`, `toastSeq` and `pop` are not saved, and
  `partyMap` is recomputed from the seed. **Nothing is written while the start menu is up**: the
  boot path puts every visit on the menu, and New Game may still replace the run, so the snapshot
  on disk stays the one the player has not chosen between yet — a first visit with no save writes
  nothing at all. The `gameover`/`victory` branch stays ahead of that guard, so a resumed end
  screen still clears its save and files its row. `runStarted` — what puts Continue on the menu —
  rides along in the snapshot and `rehydrate` reads it as `?? true`, because every save written
  before the menu shipped is a real run. Two consequences: a reload is an undo for a bad deal,
  because the snapshot carries `rngState` and the next deal comes out the same, and a save from
  another `SAVE_VERSION` is discarded rather than migrated. The scoreboard is a **separate key**
  (`tupatro-scores-v1`) on purpose: `clearRun()` removes the run key and nothing else, so a
  finished run wipes its snapshot and leaves its row on the board. **`SAVE_VERSION` was
  deliberately not bumped when the scoreboard shipped**: a save written before it resumes with
  `runScore` at `0` and so under-reports itself once on the board, which is a better trade than
  discarding every save in flight. It is documented, not migrated, and it happens once per such
  save. **It was deliberately not bumped again for the four-blind ante**, and that one is larger:
  a save written under three blinds carries a three-element `beaten` while the type now says four,
  so `beaten[3]` reads `undefined` — falsy, and the blind draws as not beaten — and the array grows
  to four the moment the big boss is won. `blindDeals` is missing from such a save and recovers to
  its `createRun` value, because `rehydrate` starts from `createRun(seed)`. A resumed run gains a
  blind, never loses one, with one exception: a save sitting at `ante: 8, blindIdx: 2` would have
  won on its next `nextBlind` under the eight-ante ladder and now plays antes 9 and 10 instead.
  Both are one-off, on saves already in flight. **A typed-as-four / runtime-three divergence is the
  price of not bumping** — TypeScript cannot see through `rehydrate`'s cast, so a future field that
  is read positionally rather than by truthiness needs the bump this one did not.
  **A challenge run's own fields were never written to disk at all, at first**, which was the
  third deliberate non-bump and the mildest: every field the challenge added arrived at its
  `createRun` value for a save written before it (`challenge: null`, an empty `table` and
  `layHands`, `parked: null`), none of them was read positionally, and a challenge in progress was
  never itself saved — so a reload during one lost it, and resumed the main run at its last screen
  instead. **`2026-09-14-per-challenge-continue` reverses exactly that reading**: a challenge now
  writes a snapshot of its own, at the same boundaries and on the same keep-or-discard rule as the
  main run — see the challenge section above for the mechanism. Reading `table`, `layHands` and
  `challenge` back for real is what took this non-bump from mild to needing validation rather than
  a bump; that is the fifth non-bump, below the race's. Booting still does not resume a challenge
  automatically — that stays a deliberate limit, not a gap this reverses — so a reload still opens
  the start menu over the main run, and a challenge in progress waits on its own row, one click
  away, at the deal it last reached; every mid-deal exit is still the result screen's Back to your
  run or the single-player screen's Continue, never a reload. The parked main run still lives in
  `parked` in state; `"parked"` is in `Dropped` and `DROPPED_KEYS`, so a snapshot can never nest and
  a parked run never reaches disk. The challenge's own board is still a **third key**
  (`tupatro-challenge-rummikub-v1`), written on `challengeover`; `clearRun()` still removes only the
  main run key, and each challenge's own run slot is cleared by `clearChallengeRun` instead, right
  before that write.
  **`SAVE_VERSION` is `2` now, and that bump reversed the habit of the three non-bumps above.**
  Making the state seat-absolute _removed_ two fields — `usTricks` and `themTricks` became
  `tricks[team]` — which is not the "a field added later arrives at its `createRun` value" case the
  three rest on: a v1 payload carries a trick count under a name nothing reads any more, and a run
  resumed from it would report 0–0 for a deal it had half played. `seats`, `tricks` and `sooliSeat`
  ride along in a v2 snapshot like any other field.
  **`SAVE_VERSION` is `3` now, and that is the second bump, for the same kind of reason as the
  first.** The seventeen economy fields _moved_ out of the top level into `economies[seat]`, so a v2
  payload carries a purse and an inventory under names nothing reads any more, and a run resumed
  from it would start over at `createRun`'s six dollars with none of the jokers it had bought.
  `SavedRun`'s top level now stores only the boss by id; each wallet is a `SavedEconomy` carrying
  its own jokers and consumables as ids and its shop as `SavedShopItem[]`, and `rehydrate` rejects
  the save **whole** on the first unknown id, on a malformed side-deck card, or on an `economies`
  array that is not four long — `econOf` reads it positionally, so a short array would leave a
  seat's wallet `undefined` rather than empty.
  **There is no migration in `save.ts` any more, and a v2 save is discarded by the version gate
  like any other.** `upgradeV2` — which folded a v2 payload's seventeen flat fields into
  `economies[0]` and left the other three at `newEconomy()` — is deleted along with its two lines in
  `rehydrate` and its four behaviour tests, and `SAVE_VERSION` stays `3`, because deleting a
  migration is not a shape change and bumping would throw away every v3 save in flight for nothing.
  **The price is paid, not deferred: every run still saved under v2 is gone for good**, exactly as
  every v1 run went when `upgradeV1` was deleted. That is what those upgrades were always for — a
  few days of grace, "days, not versions", after which the loss they postponed arrives.
  **The record of why they existed, because the shape of the decision recurs.** Each bought the runs
  in flight one release: `upgradeV1` for the seat-absolute change, `upgradeV2` for the per-seat
  economy. Each was lossless by construction (v2 had one wallet, and the run owner was the only seat
  that could spend it) and each refused rather than guessed — a payload missing `money`, `jokers`,
  `consumables` or `vouchers`, or carrying a non-number where a count belongs, was rejected exactly
  as it would be with no upgrade at all, because a partial migration is worse than none. **At most
  one exists at a time, and today none does**: `upgradeV1` was deleted the day `upgradeV2` arrived,
  so no `v1 → v2 → v3` chain ever formed, which is how migration code stops being temporary. A
  future shape change may write one more the same way — with its own deletion note and its own
  clock — but it deletes the previous one first, and `save.test.ts`'s
  `it.each([0, 1, 2, 4, 99])` version-gate cases are what fail if an upgrade is reintroduced
  quietly.
  **`SAVE_VERSION` stays `3` for the race, and that is a fourth deliberate non-bump of the mild
  kind.** `raceDeal`, `raceBase` and `raceScores` are _added_ fields, not moved or removed ones, so
  a v3 payload written before the mode arrives at `createRun`'s `0` / `[0,0]` / `[0,0]` — the right
  values for any older save, since nothing reads them outside a race. `raceScores` is read
  positionally, but an added positional field is not the widened-array case `beaten` was: there is
  no shorter runtime array to diverge from the type. **A race was itself never written at all, at
  first** — the fields only mattered in a main-game snapshot, where they sat at those values — and
  that is the half of this non-bump `2026-09-14-per-challenge-continue` changed: a race (and a
  traditional match) now writes its own `tupatro-run-race-v1` / `tupatro-run-tuppi-v1` slot too, at
  the same boundaries, which is why the fifth non-bump below exists at all. The race's own board is
  a **fourth key**, `tupatro-race-v1` (a traditional match's is a fifth, `tupatro-tuppi-v1`), and
  `clearRun()` still removes only the main run key.
  **`SAVE_VERSION` stays `3` for a fifth time, and this is the mildest one of all: nothing moved,
  nothing was removed, and nothing is newly read positionally without a check guarding it.** A
  challenge's own run slot (`tupatro-run-<id>-v1`, distinct from every board key above) is what
  finally reads `table`, `layHands` and `challenge` back — `save.ts`'s header comment carries the
  full argument, and `save.test.ts` holds the five named rejections that make it stand: `cardOk` is
  strengthened to check a card's suit, rank, id and uid as well as its enhancement, and `rehydrate`
  rejects a `table` that is not an array of legal cards, a `layHands` that is not exactly two such
  arrays, or a `challenge` that is neither `null` nor a known id — each a whole rejection, the same
  rule the `economies` array already had. `resumable(raw, id, bestAnte)` is the new read a Continue
  button trusts: `rehydrate` plus two refusals, a payload for the wrong id and a board that is not
  `soloBoard` — both read as no save at all. `game/storage.ts` gained `challengeRunKey`,
  `readChallengeRun`, `writeChallengeRun` and `clearChallengeRun` to hold the three slots, and
  `invariants.test.ts`'s pinned `removeItem` list grew from one entry to two.
- **Nothing behind Single player can be started while a session is live without leaving it first**,
  and the menu's door says so with a line under it before it asks the question. Every mode there is
  dispatched with no seat table, so each builds the single-human board it has always had — a guest
  whose chair came back `"ai"` would have every dispatch refused and nothing on screen to explain
  it, and resuming a run of your own is walking out of a session you have not left. **The two match
  modes do not need that door**: the lobby's
  chairs seat their hosted form. What is left is a multi-human laydown for Tuppi-Rummikub, which is
  untested territory and a measurement of its own.
- **A networked race files no row on any browser's board.** `GameProvider`'s `if (net.live) return;`
  sits ahead of the board writes, and moving it is not enough: `raceRowFor` reads `ownerTeam(g)`,
  so every peer would file the run owner's pair's result and a guest on the losing pair would
  record a win. It needs the window's own seat inside a pure scores function.
- **Multiplayer has no AFK timer and no nicknames, and reconnect now covers only one of its two
  routes.** `2026-09-19-guest-reconnect-mid-match` lets a guest whose link drops **in a room** come
  back into the same match: `hostSession` keeps a bounded ring buffer of every action it has
  sequenced (`RESUME_LOG_MAX`, `src/net/protocol.ts`) and an `enrolled` map of every peer it has
  ever welcomed, so a `resume` naming the next action number a returning peer needs is answered
  with a `catchup` carrying exactly the block it missed, and `guestSession` replays that block
  through the same path `act` uses. A peer arriving after the first numbered action that was
  **never** in this match is still refused at the door with `bye` and `late`, unchanged — that is
  late joining, not reconnect, and this spec leaves it refused. **The code-swap route gets none of
  this**: its `RTCPeerConnection` closing is terminal, nothing re-offers an invitation, and a
  dropped peer there still ends the game exactly as before. **A departure is announced in one
  direction only, still.** The host leaving — by hanging up, by Back to your run, or by closing the
  tab — closes every link and every peer raises `dropped`. A guest leaving reaches the host only in
  a room, through `hostSeating`'s `onDrop`; on the code-swap route the host's chair goes to
  `"failed"` with no banner, and the **other guests hear nothing at all**, since the host
  broadcasts no `bye` and no guest ever messages another. A chair whose peer genuinely will not
  return still stalls the match on a seat `g.seats` names `"human"`, with no AFK timer to notice.
  Announcing a departure or a return to the other guests is a transport increment of its own and is
  deliberately not bundled into this one. **The spectator is built and is the shared table**, and it
  shares the room-route reconnect: a display's link dropping there comes back through the identical
  `resume`/`catchup` path, since `guestSession` with `as: "table"` takes it too — `hostSession`'s
  `receive` puts a resumed display back into `tables` and calls `notifyTables()` the same way a
  welcome does. It still has to be connected before Start and still cannot join a match already
  under way from cold. One table per session — the lobby builds one chairless invitation, and
  nothing iterates — and no layout for a television: the table draws the felt and rail the game
  already has. A hosted main-game run also has one economy, `ownerSeat(g)`'s, which in
  a hosted game need not be the host's. **It is reachable, and the claim that it was not was
  false**: `newRun` is a `flow` action, so any window that holds a chair can put every peer into a
  main-game run — the rail's seed chip reaches `SeedDialog`, whose confirmation dispatches
  `newRun`, which the host numbers and broadcasts. **That seed chip is now the only such door**:
  the start menu's Single player button asks to hang up before it opens while a session is live, so
  `RestartConfirm` is still unreachable from a live window — reaching it costs leaving the session
  first — and the lobby starts a match and nothing else. **What is fixed is the consequence, not the door**: every control on that run's rail
  that would spend the wallet — `JokerList`'s sell, `SideDeckBox`'s sell and `ConsumablesBox`'s
  rows — is a `MoveButton`, so a shared table watching a hosted main-game run stays read-only, and
  a sweep in `render.test.tsx` clicks a full wallet's rail on a table to hold it. **The labels on
  that rail were part of the other half, and the run's result screens are the part still open.**
  `Tally` is the main game's one plate that names a side, and "Me" / "He" is written from a chair,
  so it takes `usePairLabels`' spectating half and names the two pairs by their characters. One
  sweep covers the cross product — every table state, race and main game alike, is read for
  `seat.you`, `chal.us`, `chal.them`, `rail.us` and `rail.them` in both locales — because a
  race-only sweep is what let `rail.us` survive on a plate the race never draws, and a second loop
  with a second key list would leave that hole the other way up. **What is not fixed is that run's
  own result screens**: `MainDealEnd`'s `why.ramiShort` / `why.noloBust` and `GameOver`'s
  `over.title` / `over.ramiShort` / `over.noloBust` speak in the second person, and the numbers
  above them are `teamOf(useViewSeat())`'s with nothing saying whose — a display watching a hosted
  main-game run to its end is told "You were put in the sheath" about a pair it is not. Those are
  the main game's strings, and neutralising them is a second set of catalogue lines for a mode no
  lobby starts, so it is recorded here rather than half-done. The one economy itself is unfixed.
  Do not fix it by teaching the shop who is looking; that is `myEcon` coming back.
- **Both routes connect and play; what is unmeasured is the network they cross.** Two windows on
  `npm run dev` have been played through a room and through the code swap, so the codec, the QR
  encoder, the sequencer, Nostr relay reachability and the peer ids the mesh hands out have all
  been seen to work end to end rather than only in tests. That check produced **no timing figure**
  — how long an arrival takes is still unknown — and **no two-network result**: NAT traversal
  between two networks and TURN-less failure on a symmetric NAT stay unproven, and a relay
  unreachable from a given network stays ordinary failure with no diagnosis in the UI. Neither is
  a LAN-only reading: the switch has not been measured either way.
- **No error boundary.** A throwing joker effect breaks the deal silently.
- **Mobile is verified in emulation only.** The phone breakpoint (`@media (max-width:560px)`) and
  the landscape one (`max-height:480px and max-width:920px`) were measured in headless Chrome,
  driven over the DevTools protocol with a device-metrics override and synthesized touch, at
  **390x844**, **360x740** and **844x390**: felt and whole hand on screen with no page scroll,
  a finger pan that drives the hand row to its own end, every hand card and decision-panel button
  hit-testable, and no trick card clipped by or over a seat. **The rail's own buttons are no longer
  among them**: `.railbtns` is ordinary content of the game page now, not a sticky footer, so Rules,
  SCORES and New game are off-screen until the strip is turned to page 5. The same readings at
  **1280x800**, **1280x500**, **1000x700** and **800x600** are identical to the pre-change build.
  **No physical device was used**, so the `env(safe-area-inset-*)` padding — emulation reports no
  insets — and how the pan and the tap actually feel are unproven. Below 360 px wide is not a
  target, and drag-to-reorder is a pointer gesture only: a finger pans the row and `HandTools`
  does the ordering.
- **Below 560 px the rail is not a column any more.** It is a board of
  `clamp(min(218px, 30svh), 100svh - 434px, 258px)` plus the safe-area top inset, holding `.brand`, a
  horizontal scroll-snap strip of five `.railpage` elements and a row of two arrow buttons. The
  mechanism is `scroll-snap-type:x mandatory` with `scroll-snap-stop:always` and nothing else — no
  gesture code, no `touch-action` rule, no library — and the page index is component-local
  `useState` in `Rail.tsx`, not `GameState` and not in the save. Every page carries
  `overflow-y:auto`, so a page that outgrows the strip scrolls itself.
  **`overscroll-behavior-y:contain` on a page, never `overscroll-behavior:contain`, and that one
  axis is the whole swipe.** A page is a scroll container and the shorthand contains _both_ axes, so
  a horizontal gesture that started on a page was contained there and never chained out to the
  strip: measured over CDP with touch emulation, a real swipe across `.rp-blind` at 390x844 left
  `.railstrip.scrollLeft` at **0**, and the identical swipe with the x axis released moved it to
  **362** — one page, snapped. That is why the swipe was reported dead on some screens and not
  others: it failed on exactly the pages that scroll. The y axis still has to be contained, or a
  finger reaching the end of a page chains out to the browser's pull-to-refresh. `scroll-snap-stop`
  is the other half: a fling crossed two pages without it, and a page the finger never asked to skip
  is worse than a slower walk.
  **Swipe order and DOM order differ, deliberately.** A finger meets **blind**, **deal**, **kit**,
  **support**, **game** (seed chip, language, the Rules / SCORES / New game footer); the DOM — and so
  the tab order — has game second, because one wrapper has to hold both the seed chip and the footer
  and those are DOM positions 2 and 11. `.rp-game{order:1}` is what reconciles them, and the arrows
  and the scroll index are indexed by the swipe order, not the DOM's. The rail opens on the blind;
  opening on the seed chip would break "most important content first".
  **The arrows outlived the bug that prompted them.** Five dots shipped first, as an indicator only,
  and the strip did not answer a swipe on the pages that scroll — the axis bug above. That is fixed,
  and the arrows stay: they are the keyboard and pointer route to a page, they say which end of the
  strip you are on, and a rail with neither dots nor arrows tells the player nothing about the four
  pages they cannot see. `.railarrow.prev` / `.railarrow.next` are `disabled` at the ends rather than
  removed so the row cannot shift, and draw their glyphs through `::before` so the buttons hold no
  text of their own — `rail.prevPage` and `rail.nextPage` are their only strings. They are 64x12
  drawn and 64x24 to a finger, the extra 12 px coming from a transparent `::after` that reaches into
  the strip above and the felt below.
  **The swipe is measured, not assumed.** With touch emulation over CDP at 390x844 and 360x640, four
  swipes forward walk blind -> deal -> kit -> support -> game and four back reverse it exactly, one
  page per gesture, every landing an exact multiple of the strip's width; a vertical swipe on
  `.rp-blind` moves its own `scrollTop` and leaves `.railstrip.scrollLeft` and `window.scrollY` at 0.
  The probe is a throwaway script driving `Input.dispatchTouchEvent`; jsdom cannot see any of this,
  so `npm test` is not where this is proven.
  **Three measured numbers make up that height, and all three bind.** 258 px is the ceiling: at
  360x740 in play `.felt` is 350 px in blind select and 301.5 px in a deal, and drops through its
  300 px floor — a delivered criterion — from 260 up. 218 px is what the support page's two columns
  of 13 rows want, since 150 px of strip is what they fill. 434 px is what the rest of the column
  costs, so between the two bounds the rail leaves the felt exactly what it needs. `svh` and not
  `dvh`: it is the viewport with the URL bar shown and does not move when the bar hides, so the felt
  never resizes mid-swipe. **The inset is added to the height rather than folded into the padding**,
  because `box-sizing:border-box` would otherwise take it out of the strip.
  **The floor is `min(218px, 30svh)` and the `min()` is the whole point.** A flat 218 px is an
  absolute length that knows nothing about the screen, so on a short window it went on claiming
  218 px of a viewport that no longer had it: the felt measured 150 px at 390x500, 23 px at 560x400
  and **8 px** at 480x360 — a table too small to play on, where the `max-height:30dvh` this replaced
  degraded gracefully, because a percentage cannot outgrow its own screen. 30svh reproduces that old
  behaviour wherever the floor binds and binds nowhere else: at 727 px and taller 30svh is past the
  218 px it is `min()`'d with, so no phone the pages were measured on moves a pixel. Below that the
  support page stops fitting, which is why every page scrolls itself now. Measured after: rail 150 /
  felt **218** at 390x500, rail 120 / felt **150** at 560x400, rail 108 / felt **122** at 480x360.
  Measured the same way, blind select, `.felt` per size: **454** at 390x844 (rail 258), **350** at
  360x740 (rail 258), **302** at 375x667 (rail 233), **302** at 360x640 (rail 206, where the flat
  floor gave 290 and clipped the support page's 13th row — 154 px of rows in 138 px of strip, with
  no scroll to reach it). `.railstrip.scrollWidth` is exactly five times its `clientWidth`, each
  page's rect is flush with the strip's left at `scrollLeft = i * clientWidth`, and the next arrow
  walks 0 -> 362 -> 724 -> 1086 -> 1448 at 390x844 with prev reversing it exactly. **In play the felt
  is under 300 px on any phone shorter than 740 px**, as it already was before the pages, and
  `.rp-blind` is 199 px of content in a 190 px page, so it scrolls those 9 px even on an ordinary
  blind — no rail height that keeps the felt above its floor at 360x740 can avoid that.

## Deploying

`npm run build` writes a static site to `dist/`. `.github/workflows/deploy.yml` builds it on
every push to `main` and publishes it to GitHub Pages; `ci.yml` runs lint, typecheck, format,
tests and build on every push and pull request.

`vite.config.ts` sets `base: "./"` so the same build works at a domain root and under a Pages
project path without a rebuild. Do not hardcode absolute asset paths.
