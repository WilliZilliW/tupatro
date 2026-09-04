# Tupatro

A browser game: the Finnish trick-taking game **tuppi** in Balatro's roguelike structure.

**React 19 + TypeScript + Vite.** State lives in one `useReducer` store; the game rules are a
pure, framework-free core that the store calls. `npm run build` emits a static site to `dist/`,
which CI deploys to GitHub Pages.

Game description: [README.md](README.md).

**The game is bilingual: Finnish and English.** Every player-facing string lives in
`src/i18n/fi.ts` and `src/i18n/en.ts` and is reached through `t()`. **No player-facing string
literal belongs anywhere else in `src/`** — a test fails if one appears. Finnish is the
original and the fallback, because tuppi is a Finnish game.

Two things stay Finnish in both languages: the tuppi terms used _as_ terms (tuppi, rami, nolo,
sooli, ryöstö, näyttö, maantuntopakko, tuppipakka) — they are the names of the things, the way
"trump" and "trick" are, and the rules panel explains each — and the opponents' names (Raimo,
Veikko, Sirpa), who are characters rather than strings. Only the player is localised: "Sinä" /
"You".

**Everything written for developers is English**: code comments, this file, the README, test
names and output, CI step names, `package.json` metadata, commit messages. Finnish appears in
`src/` only as _data_ — the strings in `fi.ts`, and the Finnish example words the render test
screens English output for.

## Commands

```bash
npm run dev        # Vite dev server with HMR on http://localhost:5173
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serve the production build locally
npm test           # vitest run — 435 tests
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

1. **The pure core stays pure.** `game/cards` `constants` `content` `rng` `rules` `scoring`
   `ai` `shop` `schedule` `save` `types` `actions` take state as a parameter, never import
   React, never touch the DOM, never import the reducer or a component, and never import
   `i18n`. That boundary is what lets the rule tests run in milliseconds without a browser,
   and `invariants.test.ts` enforces every clause of it.
2. **The reducer is pure — really pure.** React's StrictMode calls it twice in development. The
   seeded RNG state (`g.rngState`) and the card-uid counter (`g.uidSeq`) therefore live **in the
   state**, not in module variables. `makeRng`/`makeMint` are short-lived cursors the reducer
   reads from state and writes back. A module-level counter would desync under StrictMode and
   break replay.
3. **No player-facing text outside `src/i18n/`.** Use `t("key")`, `tList("key")` for the
   rules-panel lists, `nameOf`/`descOf`/`emblemOf` for data-table rows, `seatName(p)` for
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
call `readScores()` from `game/storage.ts` while they render, because the board they draw is not
part of `GameState`. They still may not name `localStorage` themselves — `game/storage.ts` is the
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
(blind select, shop, deal end, cash out, game over, victory) and `g.modal` is the one the player
opened on top of it (rules, seed, restart, scores) — two fields because closing the rules must
return to whatever was underneath.

**Anything with a side effect happens in the reducer, not while rendering.** A screen that
awarded money as it drew itself would pay twice on a redraw — a language switch is enough.
Rewards are computed in the transition and stored on the screen payload; the reducer guards
against a repeat, and a test holds the line.

## Module layout

| Module                    | Responsibility                                                           | Pure?      |
| ------------------------- | ------------------------------------------------------------------------ | ---------- |
| `game/types.ts`           | Every shape in one place                                                 | types only |
| `game/constants.ts`       | Suits, seats, trick types, blind tables                                  | yes        |
| `game/content.ts`         | `JOKERS` `ENH` `CONSUMABLES` `VOUCHERS` `BOSSES` (two pools) `PARTIES`   | data only  |
| `game/cards.ts`           | Card creation (`Mint`), card queries, chip values                        | yes        |
| `game/rng.ts`             | Seeded generator (`Rng`), seed handling, shuffle                         | yes        |
| `game/rules.ts`           | Follow-suit, trick winner, who scores                                    | yes        |
| `game/scoring.ts`         | Trick types, tuppi multiplier, trick scoring                             | yes        |
| `game/ai.ts`              | Opponent heuristics, sooli risk                                          | yes        |
| `game/shop.ts`            | Shop stock rolling, sell values                                          | yes        |
| `game/state.ts`           | `createRun`, hand sorting                                                | yes        |
| `game/actions.ts`         | The `Action` union                                                       | types only |
| `game/reducer.ts`         | `(state, action) => state`. The whole controller                         | yes        |
| `game/schedule.ts`        | `nextTick`: what happens next, and when                                  | yes        |
| `game/drive.ts`           | Headless `advance`/`act` — no timers, no browser                         | yes        |
| `game/save.ts`            | `dehydrate`/`rehydrate`: the run as a JSON-safe snapshot                 | yes        |
| `game/scores.ts`          | The scoreboard row, its order and the top-ten truncation                 | yes        |
| `game/storage.ts`         | `localStorage` for the best ante, the saved run and the scoreboard       | effects    |
| `i18n/fi.ts` `en.ts`      | The catalogues; `fi.ts` is the source of `LocaleKey`                     | data only  |
| `i18n/index.ts`           | `translate` `translateList` `formatNumber` `nameOfIn` …                  | yes        |
| `i18n/LocaleProvider.tsx` | Locale as React state                                                    | React      |
| `hooks/gameContexts.ts`   | The two contexts, so tests can inject any state                          | React      |
| `hooks/GameContext.tsx`   | `GameProvider`: the store + the clock                                    | React      |
| `hooks/useGame.ts`        | `useGameState` `useDispatch`                                             | React      |
| `hooks/useGameLoop.ts`    | The clock. **The only `setTimeout` in the project**                      | React      |
| `hooks/useHandDrag.ts`    | Pointer drag reordering of your own hand                                 | React      |
| `components/rail/*`       | The wooden rail: blind, score, tally, jokers, side deck, tricks, support | markup     |
| `components/table/*`      | Felt, seats, trick slots, mode box, score pop                            | markup     |
| `components/hand/*`       | Your hand, sort tools, the hint line                                     | markup     |
| `components/panels/*`     | Decision panels drawn **over** the felt                                  | markup     |
| `components/screens/*`    | Full overlays, the `Screens` router; three read the board                | markup     |
| `components/PlayingCard`  | One card, everywhere                                                     | markup     |
| `src/test/*`              | Render harness, card factories, the headless bot                         | tests      |

`g.phase` is one of: `blindselect` `swap` `declare` `soolioffer` `sooligive` `sooliready` `play`
`resolve` `trickend` `handend` `shop`. **A new phase has four touch points**: `nextTick`,
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
swap is one click.** The twin is unique — a deck holds one of each card, and a card already
swapped in is excluded — so `swapTargets` returns at most one card and there is nothing for
the player to choose. `pickSideCard` performs the whole swap; the hand is read during the
`swap` phase, never clicked. A card already swapped in is not a target either — trading it away would spend a second
swap to end up with fewer enhancements.

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

435 tests, Vitest + Testing Library, co-located with the code they cover.

| File                         | Covers                                                          |
| ---------------------------- | --------------------------------------------------------------- |
| `game/rules.test.ts`         | Follow-suit, trick winner, stone and wild, deck, content purity |
| `game/scoring.test.ts`       | Trick types, the whole multiplier table, enhancements, bosses   |
| `game/reducer.test.ts`       | Flow: declaration, sooli, cash-out, shop, tricks, a whole blind |
| `game/rng.test.ts`           | Seed normalisation, replay determinism, whole-run replay        |
| `game/save.test.ts`          | Snapshot round trip, every rejection, identical play after it   |
| `game/scores.test.ts`        | Board order, truncation, idempotence, every parse rejection     |
| `hooks/GameContext.test.tsx` | Resume, seed precedence, when the run is written and cleared    |
| `i18n/i18n.test.ts`          | Placeholders, list lengths, data rows, no stray Finnish         |
| `test/render.test.tsx`       | Every screen, panel and phase in both languages                 |
| `test/invariants.test.ts`    | Source boundaries, one timer site, one `Math.random`, no `let`  |
| `test/harness.tsx`           | `renderWith(state, ui, locale)` and `loadedState()`             |
| `test/bot.ts`                | The headless policy bot, for flow tests and balance             |

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
**before** the explanatory prose. Always test at a window height of ~500 px too.

**An overlay covers the rail, so a rail button is not "always" reachable.** `.overlay` is
`position:fixed; inset:0`, and every `Screen` renders through it — the rail's Rules, SCORES and
New game buttons can only be clicked with `g.screen === null`. That is why the blind select and
the game-over screen carry Rules buttons of their own, and why every screen that does not already
draw the board (`BlindSelect`, `Shop`, `DealEnd`, `CashOut`) holds a `ScoresButton`. A new screen
needs the same, or the board it hides becomes unreachable. The sweep's `SCREENS` fixture in
`src/test/render.test.tsx` is keyed off `Screen["kind"]`, so a new kind fails to type-check until it
is listed there with a Scores button or a drawn board. The gate is the compiler — `npm run
typecheck` and `npm run build`; Vitest transpiles without type-checking, so `npm test` alone cannot
see a missing kind.

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

- **Accessibility.** No ARIA roles or labels; the cards are focusable divs. Keyboard play,
  `focus-visible` and `prefers-reduced-motion` are handled, the semantics are not.
- **Run persistence is a snapshot at screen boundaries.** `game/save.ts` turns the state into
  a JSON-safe snapshot and back; `GameProvider` writes it to `tupatro-run-v1` whenever
  `g.screen` is set — blind select, deal end, cash-out, shop — and clears it on game over and
  victory, so a refresh resumes at the last screen and never in the middle of a trick. Content
  that carries functions (jokers, consumables, the boss, the shop stock) is stored as ids and
  looked back up in the tables; `modal`, `toast`, `toastSeq` and `pop` are not saved, and
  `partyMap` is recomputed from the seed. Two consequences: a reload is an undo for a bad deal,
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
- **No error boundary.** A throwing joker effect breaks the deal silently.
- **Mobile is verified in emulation only.** The phone breakpoint (`@media (max-width:560px)`) and
  the landscape one (`max-height:480px and max-width:920px`) were measured in headless Chrome,
  driven over the DevTools protocol with a device-metrics override and synthesized touch, at
  **390x844**, **360x740** and **844x390**: felt and whole hand on screen with no page scroll,
  a finger pan that drives the hand row to its own end, every hand card, decision-panel button
  and rail button hit-testable, and no trick card clipped by or over a seat. The same readings at
  **1280x800**, **1280x500**, **1000x700** and **800x600** are identical to the pre-change build.
  **No physical device was used**, so the `env(safe-area-inset-*)` padding — emulation reports no
  insets — and how the pan and the tap actually feel are unproven. Below 360 px wide is not a
  target, and drag-to-reorder is a pointer gesture only: a finger pans the row and `HandTools`
  does the ordering.

## Deploying

`npm run build` writes a static site to `dist/`. `.github/workflows/deploy.yml` builds it on
every push to `main` and publishes it to GitHub Pages; `ci.yml` runs lint, typecheck, format,
tests and build on every push and pull request.

`vite.config.ts` sets `base: "./"` so the same build works at a domain root and under a Pages
project path without a rebuild. Do not hardcode absolute asset paths.
