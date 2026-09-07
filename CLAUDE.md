# Tupatro

A browser game: the Finnish trick-taking game **tuppi** in Balatro's roguelike structure.

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
npm test           # vitest run — 830 tests
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
/req "the requirement, in a sentence or two"   # requirement -> spec -> code -> PR
/rework 42                                     # re-enter after review, same branch
```

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

**One deviation from "markup only", and it is named.** `GameOver`, `Victory` and `ScoresModal`
call `readScores()` from `game/storage.ts` while they render, and `Challenges` and `ChallengeOver`
call `readChallengeScores()` the same way, because the boards they draw are not part of
`GameState`. They still may not name `localStorage` themselves — `game/storage.ts` is the
one door, and the `persistence` invariant scans `src/components/` as well as `src/game/` to keep
it that way. A component may _read_ the store through that door; nothing more.

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
opened on top of it (rules, seed, restart, scores) and `g.menu` is the start menu and the two views reached from it
(`"start"`, `"challenges"`, `"lobby"` — the seat picker New Game opens) a visit boots into and the
rail's New game button raises — three fields because closing the rules must return to whatever was
underneath. `Screens.tsx` draws them **modal → menu
→ screen**: a modal opened over the menu closes back to the menu, and the menu covers the screen a
resumed run is sitting on rather than replacing it, so Continue (`closeMenu`) puts the player back
exactly where they were. `nextTick` returns `null` while `g.menu` is set, because the menu can go
up mid-deal where `g.screen` is `null` and the opponents would otherwise play on behind it.

**Anything with a side effect happens in the reducer, not while rendering.** A screen that
awarded money as it drew itself would pay twice on a redraw — a language switch is enough.
Rewards are computed in the transition and stored on the screen payload; the reducer guards
against a repeat, and a test holds the line.

## Module layout

| Module                    | Responsibility                                                                      | Pure?      |
| ------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| `game/types.ts`           | Every shape in one place                                                            | types only |
| `game/constants.ts`       | Suits, seats, `teamOf`/`sameTeam`/`partnerOf`, trick types, blind tables            | yes        |
| `game/content.ts`         | `JOKERS` `ENH` `CONSUMABLES` `VOUCHERS` `BOSSES` (two pools) `PARTIES` `CHALLENGES` | data only  |
| `game/cards.ts`           | Card creation (`Mint`), card queries, chip values                                   | yes        |
| `game/economy.ts`         | `econOf(g, p)`: one seat's wallet, and nothing else                                 | yes        |
| `game/rng.ts`             | Seeded generator (`Rng`), seed handling, shuffle                                    | yes        |
| `game/rules.ts`           | Follow-suit, trick winner, who scores                                               | yes        |
| `game/scoring.ts`         | Trick types, tuppi multiplier, trick scoring                                        | yes        |
| `game/laydown.ts`         | The challenge laydown: `pipValue` `isSet` `isRun` `comboOk` `validateLay`           | yes        |
| `game/ai.ts`              | Opponent heuristics, sooli risk                                                     | yes        |
| `game/shop.ts`            | Shop stock rolling, sell values                                                     | yes        |
| `game/state.ts`           | `createRun`, hand sorting                                                           | yes        |
| `game/actions.ts`         | The `Action` union                                                                  | types only |
| `game/reducer.ts`         | `(state, action) => state`. The whole controller                                    | yes        |
| `game/schedule.ts`        | `nextTick`: what happens next, and when                                             | yes        |
| `game/drive.ts`           | Headless `advance`/`act` — no timers, no browser                                    | yes        |
| `game/save.ts`            | `dehydrate`/`rehydrate`: the run as a JSON-safe snapshot                            | yes        |
| `game/scores.ts`          | The scoreboard row, its order and the top-ten truncation                            | yes        |
| `game/storage.ts`         | `localStorage` for the best ante, the saved run and the scoreboard                  | effects    |
| `i18n/fi.ts` `en.ts`      | The catalogues; `fi.ts` is the source of `LocaleKey`                                | data only  |
| `i18n/index.ts`           | `translate` `translateList` `formatNumber` `nameOfIn` …                             | yes        |
| `i18n/LocaleProvider.tsx` | Locale as React state                                                               | React      |
| `hooks/seatContext.ts`    | The viewing-seat context and its setter's (default `0`, and a no-op)                | React      |
| `hooks/SeatProvider.tsx`  | `SeatProvider`: the viewing seat as `useState`, both contexts                       | React      |
| `hooks/useSeat.ts`        | `useViewSeat(): Seat` `useSetViewSeat()`                                            | React      |
| `hooks/useSeatSync.ts`    | The one writer of the viewing seat: follows `g.seats`                               | React      |
| `hooks/gameContexts.ts`   | The two contexts, so tests can inject any state                                     | React      |
| `hooks/GameContext.tsx`   | `GameProvider`: the store + the clock                                               | React      |
| `hooks/useGame.ts`        | `useGameState` `useDispatch`                                                        | React      |
| `hooks/useGameLoop.ts`    | The clock. **The only `setTimeout` in the project**                                 | React      |
| `hooks/useHandDrag.ts`    | Pointer drag reordering of your own hand                                            | React      |
| `components/rail/*`       | The wooden rail: `Rail` (strip, five pages, dots) and its plates                    | markup     |
| `components/table/*`      | Felt, seats, trick slots, mode box, score pop                                       | markup     |
| `components/hand/*`       | Your hand, sort tools, the hint line                                                | markup     |
| `components/panels/*`     | Decision panels drawn **over** the felt                                             | markup     |
| `components/screens/*`    | Full overlays, the menu, the lobby, the `Screens` router; five read a board         | markup     |
| `components/PlayingCard`  | One card, everywhere                                                                | markup     |
| `src/test/*`              | Render harness, card factories, the headless bot                                    | tests      |

`g.phase` is one of: `blindselect` `swap` `declare` `soolioffer` `sooligive` `sooliready` `play`
`resolve` `trickend` `laydown` `handend` `shop`. **A new phase has four touch points**: `nextTick`,
`Panels`, `Hint`, and `SPREAD_PHASES` in `Hand.tsx`. The render test sweeps every phase in both
languages, so a forgotten one fails there rather than in the browser.

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
`components/screens/Lobby.tsx` is the third menu view (`g.menu === "lobby"`), reached from New Game
and from the restart confirmation — neither of which starts a run any more, so the old run survives
until the lobby's Start dispatches `{ type: "newRun", seat }`. The pending selection is
component-local `useState`, never on `GameState` and never in the save. `createRun(seed, bestAnte,
seat)` builds `seats` from it, and `startChallenge` passes `ownerSeat(prev)` so entering a challenge
does not move the player back to seat 0.

`hooks/useSeatSync.ts` is the **one writer of the viewing seat**: `GameProvider` calls it beside
`useGameLoop`, and it sets the context to `ownerSeat(g)` only when `g.seats[you]` is not `"human"`
and some seat is. The reason is that `g.seats` is saved and the viewing seat cannot be — a run
resumed at seat 2 would otherwise leave every panel dispatching for an `"ai"` seat, every guard
refusing, and the deal never advancing. It is a **single-human heuristic**: with two humans
`ownerSeat` is the wrong answer for at least one window, so the transport increment has to replace
it with a per-window choice. It uses no timer; `useGameLoop` stays the only `setTimeout` call site.

**Every seat reads as itself.** `SEATS` carries four characters — Seija, Raimo, Veikko, Sirpa — and
`SeatInfo` is `{ name, short }` with no key: `seatNameIn(locale, p, you)` returns `"seat.you"` when
`p === you` and the character's name otherwise, so "Sinä" / "You" follows the window. `I18n.seatName`
is `(p, you) => string` with **no default**, so the compiler finds every call site. No catalogue
string names a character — `grep "Veikko\|Raimo\|Sirpa\|Seija" src/i18n/` finds nothing — because a
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

## The challenge is an alternate rule set, not a modifier

`g.challenge` is `null` in a main-game run and every field beside it — `table`, `layHands`,
`layTurn`, `layNo`, `layPassed`, `layScores`, `parked` — is then inert. Set, it means a run with
**none of the roguelike shell**: no ante, no blind, no target, no money, no shop, no jokers, no
vouchers, no consumables and no tuppipakka. Four forced-rami deals, and the tricks score nothing —
`resolveTrick` returns early into the challenge branch, so `scoreTrick`, the tuppi multiplier and
`ctx.payout` are never reached. What the thirteen tricks produce is the two laydown hands.

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
- **`startChallenge` and `leaveChallenge` replace the whole state**, so they sit in `gameReducer`'s
  produce callback beside `newRun` rather than inside `apply()`, which mutates the draft in place.
  `original(d)` is what they read: `dehydrate` must see plain objects, not Immer drafts. A
  challenge started from within a challenge (Play again) carries `parked` across rather than
  dehydrating the challenge, because `dehydrate` drops `parked` and the main run would be lost.

A challenge is **never saved**: `GameProvider` returns before `writeRun` whenever
`state.challenge !== null`, and the only thing a challenge writes is its own board, on
`challengeover`, under `tupatro-challenge-<id>-v1`. Reloading during one loses the challenge and
resumes the main run at its last snapshot.

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

830 tests, Vitest + Testing Library, co-located with the code they cover.

| File                         | Covers                                                           |
| ---------------------------- | ---------------------------------------------------------------- |
| `game/laydown.test.ts`       | Pip values, sets, runs, and every one of validateLay's refusals  |
| `game/seats.test.ts`         | The pinned engine golden, and the same deal played from any seat |
| `game/rules.test.ts`         | Follow-suit, trick winner, stone and wild, deck, content purity  |
| `game/scoring.test.ts`       | Trick types, the whole multiplier table, enhancements, bosses    |
| `game/reducer.test.ts`       | Flow: declaration, sooli, cash-out, shop, tricks, a whole blind  |
| `game/rng.test.ts`           | Seed normalisation, replay determinism, whole-run replay         |
| `game/save.test.ts`          | Snapshot round trip, every rejection, identical play after it    |
| `game/scores.test.ts`        | Board order, truncation, idempotence, every parse rejection      |
| `hooks/GameContext.test.tsx` | Resume, seed precedence, when the run is written and cleared     |
| `i18n/i18n.test.ts`          | Placeholders, list lengths, data rows, no stray Finnish          |
| `test/render.test.tsx`       | Every screen, panel and phase in both languages                  |
| `test/invariants.test.ts`    | Source boundaries, one timer site, one `Math.random`, no `let`   |
| `test/harness.tsx`           | `renderWith(state, ui, locale, seat)` and `loadedState()`        |
| `test/bot.ts`                | The headless policy bot, for flow tests and balance              |

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
New game buttons can only be clicked with `g.screen === null` and `g.menu === null`. That is why
the start menu carries Rules and SCORES buttons of its own, why the blind select and
the game-over screen carry Rules buttons of their own, and why every screen that does not already
draw the board (`BlindSelect`, `Shop`, `DealEnd`, `CashOut`) holds a `ScoresButton`. A new screen
needs the same, or the board it hides becomes unreachable. The sweep's `SCREENS` fixture in
`src/test/render.test.tsx` is keyed off `Screen["kind"]`, so a new kind fails to type-check until it
is listed there with a Scores button or a drawn board. The gate is the compiler — `npm run
typecheck` and `npm run build`; Vitest transpiles without type-checking, so `npm test` alone cannot
see a missing kind. **The menu is not covered by that fixture**, since it is keyed off
`Screen["kind"]` and the menu is a third field — `Menu` and `Challenges` are held by hand-written
tests in the same file instead, and `Challenges` reaches the board through Back rather than
directly.

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

## Coding practices

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
  **A challenge run is never written at all**, which is the third deliberate non-bump and the
  mildest: `GameProvider` returns before `writeRun` whenever `state.challenge !== null`, so the
  main run's snapshot sits on disk untouched through a challenge and **a reload during a challenge
  loses the challenge** and resumes the main run at its last screen. The parked main run lives in
  `parked` in state; `"parked"` is in `Dropped` and `DROPPED_KEYS`, so a snapshot can never nest
  and a parked run never reaches disk. `SAVE_VERSION` stays `1` because every field the challenge
  adds is right at its `createRun` value for a save written before it (`challenge: null`, an empty
  `table` and `layHands`, `parked: null`) and none of them is read positionally — unlike `beaten`,
  this one adds no typed-as-wider / runtime-narrower field. The challenge's own board is a **third
  key** (`tupatro-challenge-rummikub-v1`), written on `challengeover`; `clearRun()` still removes
  the run key and nothing else.
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
