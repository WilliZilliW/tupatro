# Tupatro

A browser game: the Finnish trick-taking game **tuppi** in Balatro's roguelike structure.
Source lives in `src/` as ES modules; `node build.js` assembles them into one
self-contained `dist/tupatro.html`, which is what gets published as an Artifact.
**The repo holds source only** — `dist/` is gitignored, so build before you run or publish.

Game description: [README.md](README.md).

**The game is bilingual: Finnish and English.** Every player-facing string lives in
`src/locale/fi.js` and `src/locale/en.js` and is reached through `t()`. **No player-facing
string literal belongs anywhere else in `src/`** — a test fails if one appears. Finnish is the
original and the fallback, because tuppi is a Finnish game.

Two things stay Finnish in both languages: the tuppi terms used *as* terms (tuppi, rami, nolo,
sooli, ryöstö, näyttö, maantuntopakko, tuppipakka) — they are the names of the things, the way
"trump" and "trick" are, and the rules panel explains each — and the opponents' names (Raimo,
Veikko, Sirpa), who are characters rather than strings. Only the player is localised: "Sinä" /
"You".

Code **comments** inside `src/` are Finnish. Everything around the game is English: this file,
the README, test names and output, CI step names, `package.json` metadata, commit messages.

## Commands

```bash
npm run build     # src/ -> dist/tupatro.html
npm test          # build, then 129 tests (rules against src/, invariants against the build)
npm run lint      # eslint
npm run format    # prettier --write
npm start         # serves dist/ on http://localhost:8732/tupatro.html
```

`npm install` is only needed for eslint/prettier. The game itself has **no runtime
dependencies** and never should.

## Non-negotiable rules

1. **The built file is self-contained.** The Artifact CSP blocks scripts from anywhere but a
   couple of CDNs, so the published page cannot load a local `game.js`. `build.js` therefore
   emits one `<style>` block, one `<script>` block and no external script references, and it
   verifies all three before writing. The only external reference is Google Fonts, and every
   font has a real fallback stack.
2. **`<meta charset="utf-8">` is the first line of the output.** Without it the Finnish ä/ö
   break when the file is opened straight from disk. It lives at the top of
   `src/index.html`; do not move it below `<title>`.
3. **No player-facing text outside `src/locale/`.** Use `t("key")`, `tList("key")` for the
   rules-panel lists, `nameOf`/`descOf` for data-table rows, `seatName(p)` for players, and
   `fmt(n)` for numbers — thousands are grouped differently per language. Adding a string
   means adding the key to **both** catalogues; the tests check parity, placeholder parity and
   that no key the code asks for is missing.
4. **Never commit the build.** `dist/` is gitignored: the repo holds source only, so there
   is no generated file to drift out of date or to churn in diffs. CI builds it and uploads
   it as a workflow artifact. Run `npm run build` before running, testing or publishing.
5. **Tuppi's rules are never invented.** They are checked against a source. See below.
6. **Balance is never guessed.** It is measured. See below.

## Tuppi's rules come from a source, not from memory

This game was first built wrong: tuppi was remembered as a whist-style trump game. Real
tuppi has **no trump suit at all**, and its core is the rami/nolo declaration, which was
missing entirely. The whole game logic had to be rewritten.

When touching the rules, verify against these:

- The Oulunsalo senior tuppi club's rule sheet (Antti Auer, 9 September 2022) — best source,
  the club's own
- <https://korttipeliopas.fi/tuppi>

The club's rule sheet beat both Wikibooks and the SEO content farms. Prefer the primary
source. Where a rule is open to interpretation, write the chosen reading into a comment.

The current implementation is documented in the game's own `showRules()` panel. **If you
change a rule, update that panel and the README too** — otherwise the game teaches the
player something false.

## Module layout

| Module | Responsibility | Pure? |
|---|---|---|
| `src/locale/fi.js` | Finnish strings, the original and the fallback | data only |
| `src/locale/en.js` | English strings, same keys | data only |
| `src/i18n.js` | `t` `tList` `fmt` `nameOf` `descOf` `seatName`, locale state | yes |
| `src/constants.js` | Suits, seats, trick types, blind tables | yes |
| `src/cards.js` | Card creation, card-level queries, chip values | yes |
| `src/content.js` | `JOKERS` `ENH` `CONSUMABLES` `VOUCHERS` `BOSSES` | yes, data only |
| `src/rng.js` | Seeded generator, seed handling, shuffle | yes |
| `src/rules.js` | Follow-suit, trick winner, who scores | yes |
| `src/scoring.js` | Trick types, tuppi multiplier, trick scoring | yes |
| `src/ai.js` | Opponent heuristics | yes |
| `src/state.js` | `G`, `newGame`, timers, hand sorting | owns state |
| `src/flow.js` | Run/deal/trick flow, the controller | side effects |
| `src/shop.js` | Shop stock and purchases | side effects |
| `src/ui/dom.js` | Overlay, panel and toast helpers | DOM |
| `src/ui/render.js` | `render` = rail + table + hand, card drag | DOM |
| `src/ui/screens.js` | The `show*` screens and decision panels | DOM |
| `src/main.js` | Boot, event wiring, the debug surface | side effects |
| `src/index.html` | Page template with `<!--STYLE-->` / `<!--SCRIPT-->` | — |
| `src/style.css` | All styling | — |

`build.js` declares the concatenation order and **refuses to build if any file under `src/`
is missing from that list** — a module left out is invisible to the tests, which import real
ES modules, and shows up only as a `ReferenceError` in the browser. That is exactly how the
i18n layer first shipped broken.

`build.js` declares the concatenation order. Cycles between the side-effect modules are
tolerated (functions are hoisted and only called after boot), but **the pure core must stay
acyclic and must not import `state.js`** — that boundary is what lets the rule tests run
without a browser, and a test enforces it.

`G.phase` is one of: `blindselect` `swap` `declare` `sooligive` `sooliready` `play` `resolve`
`handend` `shop`. Every new phase must also be added to `renderHand`'s hint text and to the
`spread` class condition.

## Coding practices

**The pure core takes state explicitly.** `rules`, `scoring`, `cards`, `ai` and `rng`
functions receive the state as their first parameter (`g`), never reach for the module-level
`G`, and never touch the DOM. Tests build a plain object and call them directly. Keep it that
way: if a new rule function needs state, add a parameter, not an import.

**`content.js` is data, not logic.** Joker effects read everything they need from the scoring
context (`c.money`, `c.sideDeckEnh`, `c.payout`) rather than the live state, which is why the
table stays pure and testable. Adding a joker is one entry and no engine change. Adding an
**enhancement** or a **boss** is not — see the four touch points below.

**One state object.** Everything mutable lives on `G`, and `newGame()` defines every key so
nothing is ever `undefined`. Do not add ad-hoc module-level state. Note that you cannot
assign to an imported binding — `animatedIds` is a `const Set` that gets `.clear()`ed for
exactly this reason.

**All timers go through `later()`.** It is the only place that calls `setTimeout`, so
`clearTimers()` can always cancel everything when a run restarts. A test asserts there is
exactly one `setTimeout` call site.

**Handlers are assigned, not added.** Rendering is a full `innerHTML` redraw, so
`el.onclick = fn` is idempotent — `addEventListener` would stack duplicates if a node ever
survived a redraw. Use `addEventListener` only for what `on*` cannot express (the pointer
events in `initHandDrag`).

**Guard clauses over nesting.** Early `return` on the impossible cases; keep the happy path
unindented.

**Comments say why, not what**, in Finnish, inside `src/`. The valuable ones record a
decision that looks like a bug: the strict `>` in `currentWinner`, the deliberate randomness
in the anti-sooli AI.

**Effect functions must be total.** Joker and enhancement effects run inside `scoreTrick`
with no error boundary; a throw kills the deal. Do not assume array lengths or optional
fields.

**Do not optimise the renderer.** Full redraw is fast enough for 13 cards. Measure first.

**Formatting is Prettier's job**, with `// prettier-ignore` on the compact data tables
(`JOKERS`, `ENH`, `SM`, the `G` literal) where one entry per three lines beats one property
per line. Run `npm run format`; CI checks it.

## Adding or changing text

1. Add the key to `src/locale/fi.js` **and** `src/locale/en.js`. Keys are flat and dotted:
   `area.thing`. Data-table rows carry their own key (`joker.ramikone`), and `nameOf`/`descOf`
   append `.n` / `.t`.
2. Use `{placeholders}` for anything interpolated, and keep the same set in both languages —
   a placeholder present in one and not the other renders as literal braces.
3. Numbers go through `fmt()`, never `toLocaleString` with a hardcoded tag.
4. `npm test` then checks parity, placeholders, list lengths, that every requested key exists,
   and that no Finnish literal has crept back into the code.

A missing key renders as the key itself rather than throwing, so a mistake is visible in the
UI rather than silent — but the tests should catch it first.

**Watch out for strings without ä/ö.** The conversion missed "palkkio", "tavoite", "Panos" and
the static labels in `src/index.html` precisely because a diacritic-based search cannot see
them. When checking for leftovers, read the rendered page in English rather than grepping the
source.

## Randomness always goes through `rnd()`

A run has a seed (`G.seed`), and `rnd()` is a mulberry32 derived from it. The same seed and
the same player decisions produce the same run: identical deals, bosses and shop stock.

- **Do not use `Math.random` in game logic.** The only permitted site is `makeSeed()` in
  `rng.js`, which draws a new seed. ESLint forbids it elsewhere and a test counts the sites.
- **Rendering must not consume randomness.** If a draw function calls `rnd()`, replay breaks
  as soon as the screen repaints a different number of times.
- **Never wire a run start straight to `onclick`.** `onclick = startRun` would pass an Event
  object in as the `seed`. Use `() => startRun()`. This is in the tests.
- Any string works as a seed (`setSeed` trims and hashes it). Generated seeds are 8
  characters and avoid the confusable `O/0/I/1`.

## Card identity is `uid`, not `id`

- `id` = the card type, e.g. `"S14"`. Use it for presentation only.
- `uid` = the individual, assigned by `mkCard`. **Every identity comparison uses `uid`.**

The side deck can bring a duplicate into hand (two A♠). An `id`-based comparison would break
`playCard`, the drag ordering and the legal-card set. A tie is won by the card played earlier,
because `currentWinner` compares with a strict `>` — do not change it to `>=`.

## Enhancements bend rules, they do not just add numbers

The two most important entries in `ENH` touch the rules, not the score:

- **stone** — no suit (`matchesSuit` → false, but `legalCards` always lets it through) and no
  rank (`currentWinner` never picks it). If a stone card leads a trick, the led suit comes
  from the next suited card — which is why `leadSuit()` scans the trick instead of just
  reading `g.trick[0]`.
- **wild** — counts as every suit both when following suit and in the winner comparison, and
  completes a flush in `evalTrick`.

When adding an enhancement, walk **all four** touch points: `legalCards`, `currentWinner`,
`evalTrick`, and `chipValue`/`scoreTrick`. The stone card needed all four.

## The scoring order is locked

In `scoreTrick` the order is:

1. card additions (`mult` cards; `bonus` is already in `chipValue`)
2. joker additions (`j.add`)
3. card multipliers (`glass`, `steel`)
4. joker multipliers (`j.xm`)
5. retriggers (`j.retrig`) and money (`j.won`, gold cards, via `ctx.payout`)

In Balatro the order is the joker row's order and the player drags it themselves. Here it is
automatic, so purchase order cannot silently cost score. **This is a deliberate deviation** —
if you ever add joker drag-reordering, remove the automatic ordering at the same time.

## Balance is measured in the browser

The ante thresholds (`ANTES`) were set by measuring, not guessing. Simulation runs the game
itself rather than a separate model, because a model and the game would drift apart.

The bundle is wrapped in an IIFE, so nothing leaks to global scope. `src/main.js` exposes a
deliberate console surface, `window.tupatro`, for exactly this purpose. The pattern: replace
`setTimeout` with a synchronous call and a whole deal plays out at once.

```js
const T = window.tupatro;
const orig = window.setTimeout;
window.setTimeout = (fn) => { try { if (typeof fn === "function") fn(); } catch {} return 0; };
T.startRun("SEED");
// ... click [data-*] buttons and call T.playCard(0, ...) until the blind resolves
window.setTimeout = orig;
```

Run in batches of roughly 60–80 blinds. More than ~300 at once hits the `javascript_tool`
timeout; split the runs. Seed the run to make a measurement reproducible.

**A bot measures the bot, not the mechanic.** The first side-deck measurement suggested the
side deck made scores *worse* — because the test bot swapped blindly and dumped its highest
card, which is right in nolo and wrong in rami. Given a sensible policy (decide the line
before swapping), the same side deck was worth +49%. If a mechanic's value lies in a
*decision*, the bot has to make that decision or the measurement is worthless.

Current measured figures are in the README. Update them when balance changes.

## Tests

`test/` imports the real modules — there is no bundling or extraction in the test path.

| File | Covers |
|---|---|
| `test/rules.test.js` | Follow-suit, trick winner, stone and wild, deck, content purity |
| `test/scoring.test.js` | Trick types, the whole multiplier table, enhancements, bosses, order |
| `test/seed.test.js` | Seed normalisation, replay determinism, shop replay |
| `test/i18n.test.js` | Catalogue parity, placeholders, key coverage, no stray Finnish |
| `test/build.test.js` | Build output invariants, source boundaries, timer and RNG rules |
| `test/harness.js` | Assertions and the summary. No test framework on purpose |

**Run a mutation test when you add assertions.** Break the rule on purpose and check that a
test fails:

```bash
cp src/rules.js .bak
sed -i '' 's/rv(g, t.card) > rv(g, best.card)/rv(g, t.card) >= rv(g, best.card)/' src/rules.js
npm test; mv -f .bak src/rules.js
```

This exposed a weakness in an earlier test: "a stone card does not win the trick" used a two,
which would not have won anyway. An assertion has to use a card that **would** win without
the rule. It also caught a brittle test that matched a textual pattern Prettier later
reflowed — prefer invariants that survive formatting.

Browser testing is still needed for what the unit tests cannot cover: the UI, phase flow, the
AI and balance. When driving the browser, use `element.click()` through `javascript_tool`;
the `computer` tool's synthetic click sometimes fails to register right after a navigation.

## UI rules learned the hard way

**Most important content first in a panel.** `#declpanel` scrolls on a short window and the
buttons sit in a sticky footer. This broke twice: first the RAMI/NOLO buttons were hidden,
then the side-deck cards. Put whatever the decision needs (hand strength, the cards to pick
from) **before** the explanatory prose. Always test at a window height of ~500 px too.

**Decision panels are not modal.** The declaration, the side-deck swap and the sooli card
choice all render through `declPanel` on top of the felt, not through `overlay`. The reason:
the player has to see and rearrange their own hand while deciding. `overlay()` is only for
views where the hand is not needed (blind select, shop, rules, results).

**An automatic choice is not a decision.** The sooli card exchange was implemented correctly
per the rules, but the game picked the card for you and reported it in a toast that vanished
— the player never saw it. If a rule gives the player a choice, make it a visible step.

**`innerHTML` and future XSS.** Rendering is full redraw via `innerHTML`. That is safe only
because every value is internal to the game. If you ever add player-written text — a name, a
seed label, a save title — do not interpolate it; set it with `textContent`.

**Test new glyphs against tofu.** Draw the glyph to a canvas and compare pixels against
U+E000; a width comparison gives false results in monospace. Stick to widely supported
characters: suits, arrows, geometric shapes, letters and digits. Ten exotic glyphs
(⌫ ✇ ☚ ✤ ⚑ ✎ ⚒ ☺ ♛ ♻) were replaced for this reason.

**The AI is heuristics.** `chooseAI` branches on whether the side wants tricks (`rami`) or
wants to dodge them (`nolo`/`sooli`). Leading a low card against a sooli is lethally strong,
so there is a deliberate 0.35 randomness there — otherwise sooli would succeed 4% of the
time. Do not "fix" it to be optimal.

## Known gaps

Deliberate, not forgotten:

- **Accessibility.** No ARIA roles or labels; the cards are focusable divs. Keyboard play,
  `focus-visible` and `prefers-reduced-motion` are handled, the semantics are not.
- **No run persistence.** An eight-ante run is lost on refresh. Only the best ante is stored.
- **No error boundary.** A throwing joker effect breaks the deal silently.
- **Mobile is unverified.** The responsive CSS exists but has never been tested on a phone.

## Publishing the Artifact

The game is published at
<https://claude.ai/code/artifact/9135a061-41af-4557-8272-a3a8c79ee39d>.

Publish the **built** `dist/tupatro.html`, and **always to the same URL** by passing the
`url` parameter. Without it a new artifact is created and the old link falls behind. This matters
especially when the file has moved — a changed path alone is enough to create a new artifact.

Do not pass the favicon (🃏) on a republish, so that it stays the same.
