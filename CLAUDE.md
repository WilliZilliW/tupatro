# Tupatro

A browser game: the Finnish trick-taking game **tuppi** in Balatro's roguelike structure.
One file, `tupatro.html`, no dependencies and no build step. Published as an Artifact.

Game description: [README.md](README.md).

**Language policy: Finnish belongs in the game and nowhere else.** `tupatro.html` is Finnish
— every player-facing string and every code comment — because tuppi is a Finnish game.
Everything around it is English: this file, the README, test names and output, CI step names,
`package.json` metadata, commit messages. The two exceptions are proper names and Finnish
domain terms used *as* terms (tuppi, rami, nolo, sooli, ryöstö, näyttö, maantuntopakko,
tuppipakka, kivikortti) — those name the things and match the identifiers in the code, so
translating them would make the docs disagree with the source.

## Non-negotiable rules

1. **The published file is self-contained.** The Artifact CSP blocks scripts from anywhere
   but a couple of CDNs, so the published page cannot load a local `game.js`. One `<style>`
   block, one `<script>` block, no `import`, no `fetch`. The only external reference is
   Google Fonts, and every font has a real fallback stack.

   This governs the **publish format, not the source layout**. Single-file source is not a
   virtue, just the current choice: cheap now (1,900 lines, 76 functions, largest 77) but it
   does not scale. When the file doubles, a second contributor appears, or a real bundler is
   wanted, split the source into `src/` modules and assemble one HTML with a build script.
   Tests are not a reason to split — they already work, see below.
2. **`<meta charset="utf-8">` is the first line of the file.** Without it the Finnish ä/ö
   break when the file is opened straight from disk. Do not move it below `<title>`.
3. **Inside `tupatro.html`, all player-facing text is Finnish.** Code comments too. Variable
   names are English when technical (`phase`, `render`) and Finnish when they name a game
   concept (`sooli`, `ramTeam`, `tuppiInfo`, `sideDeck` → tuppipakka). Outside that file,
   see the language policy above: English.
4. **Tuppi's rules are never invented.** They are checked against a source. See below.
5. **Balance is never guessed.** It is measured. See below.

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

## Balance is measured in the browser

The ante thresholds (`ANTES`) were set by measuring, not guessing. Simulation runs the game
itself in the console rather than a separate model, because a model and the game would drift
apart.

The pattern: replace `setTimeout` with a synchronous call and a whole deal plays out at once.

```js
const orig = window.setTimeout;
window.setTimeout = fn => { try { if (typeof fn === "function") fn(); } catch (e) {} return 0; };
// ... play a blind out by clicking [data-*] buttons and calling playCard(0, ...)
window.setTimeout = orig;
```

Run in batches of roughly 60–80 blinds. More than ~300 at once hits the `javascript_tool`
timeout; split the runs.

**A bot measures the bot, not the mechanic.** The first side-deck measurement suggested the
side deck made scores *worse* — because the test bot swapped blindly and dumped its highest
card, which is right in nolo and wrong in rami. Given a sensible policy (decide the line
before swapping), the same side deck was worth +49%. If a mechanic's value lies in a
*decision*, the bot has to make that decision or the measurement is worthless.

Current measured figures are in the README. Update them when balance changes.

## File layout

Order inside the `<script>` block:

| Part | Contents |
|---|---|
| Constants | `SUITS` `SM` `TYPES` `JOKERS` `ENH` `CONSUMABLES` `VOUCHERS` `BOSSES` `ANTES` |
| State | `let G` — the entire game state in one object; `newGame()` defines every key |
| Cards | `mkCard` `makeDeck` `rv` `chipValue` `applySort` |
| Run flow | `startBlind` → `startDeal` → swap → declaration → `beginPlay` |
| Rules | `leadSuit` `legalCards` `currentWinner` `matchesSuit` |
| Scoring | `evalTrick` `scoreTrick` `tuppiInfo` `finalScore` |
| Shop | `rollShop` `rollCardOffer` `buy` `sellJoker` `sellSideCard` |
| Rendering | `render` = `renderRail` + `renderTable` + `renderHand` |
| Views | `showBlindSelect` `showCashOut` `showShop` `showRules` `showGameOver` |

`G.phase` is one of: `blindselect` `swap` `declare` `sooligive` `sooliready` `play` `resolve`
`handend` `shop`. Every new phase must also be added to `renderHand`'s hint text and to the
`spread` class condition.

**`innerHTML` and future XSS.** Rendering is full redraw via `innerHTML` (21 sites). That is
safe only because every value is internal to the game. If you ever add player-written text —
a name, a seed label, a save title — do not interpolate it into `innerHTML`; set it with
`textContent`.

Rendering is full redraw via `innerHTML`. It is fast enough for 13 cards. **Exception:** card
dragging moves DOM nodes directly and does not redraw mid-drag, or pointer capture breaks.
The array is updated only on `pointerup`.

## Randomness always goes through `rnd()`

A run has a seed (`G.seed`), and `rnd()` is a mulberry32 derived from it. The same seed and
the same player decisions produce the same run: identical deals, bosses and shop stock.

- **Do not use `Math.random` in game logic.** The only permitted site is `makeSeed()`, which
  draws a new seed. A test counts the occurrences and fails if there is more than one.
- **Rendering must not consume randomness.** If an animation or draw function calls `rnd()`,
  replay breaks as soon as the screen repaints a different number of times.
- **Never wire `newGame` straight to `onclick`.** `onclick = newGame` would pass an Event
  object in as the `seed` parameter and the seed would be garbage. Use `() => newGame()`.
  This is in the tests too.
- Any string works as a seed (`setSeed` trims and hashes it). Generated seeds are 8
  characters and avoid the confusable `O/0/I/1`.

The seed is shown at the top of the rail and can be changed by clicking it. The end screens
show the seed and offer a rerun of the same run.

This is also a balance tool: a seeded simulation is reproducible, so measured figures can be
re-checked afterwards.

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
  reading `G.trick[0]`.
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
5. retriggers (`j.retrig`) and money (`j.won`, gold cards)

In Balatro the order is the joker row's order and the player drags it themselves. Here it is
automatic, so purchase order cannot silently cost score. **This is a deliberate deviation** —
if you ever add joker drag-reordering, remove the automatic ordering at the same time.

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

**Test new glyphs against tofu.** Draw the glyph to a canvas and compare pixels against
U+E000; a width comparison gives false results in monospace. Stick to widely supported
characters: suits, arrows, geometric shapes, letters and digits. Ten exotic glyphs
(⌫ ✇ ☚ ✤ ⚑ ✎ ⚒ ☺ ♛ ♻) were replaced for this reason.

**The AI is heuristics.** `chooseAI` branches on whether the side wants tricks (`rami`) or
wants to dodge them (`nolo`/`sooli`). Leading a low card against a sooli is lethally strong,
so there is a deliberate 0.35 randomness there — otherwise sooli would succeed 4% of the
time. Do not "fix" it to be optimal.

## Tests

```bash
npm test         # = node test.js, 110 rule tests, no dependencies
```

CI runs these on every push (`.github/workflows/test.yml`). **Do not push red.**

`test.js` does not import a module. It **extracts the `<script>` block from `tupatro.html`**
and runs it against a small DOM stub. That way the pure rule functions are testable without
a browser and without splitting the source. Internals are exposed by appending a
`return {...}` to the code — add a name to the `EXPORTS` list when you need a new one.

The tests cover the follow-suit obligation, the trick winner, the stone and wild rule
exemptions, trick types, the whole tuppi multiplier table (rami, nolo, ryöstö, sooli, bosses,
vouchers), the scoring order, seeded reproducibility and file integrity.

**Run a mutation test when you add assertions.** Break the rule on purpose and check that a
test fails:

```bash
cp tupatro.html .bak && sed -i '' 's/rv(t.card) > rv(best.card)/rv(t.card) >= rv(best.card)/' tupatro.html
node test.js; mv -f .bak tupatro.html
```

This exposed a weakness in an earlier test: "a stone card does not win the trick" used a two,
which would not have won anyway. An assertion has to use a card that **would** win without
the rule.

Browser testing is still needed for what `test.js` cannot cover: the UI, phase flow, the AI
and balance.

## Dev server and browser testing

```bash
npm start        # python3 serve.py, http://localhost:8732/tupatro.html
```

`serve.py` exists only because Python's `http.server` does not set a charset. It is not part
of the game. `.claude/launch.json` is the preview config. Both can be deleted without losing
anything.

When testing in the browser: the `computer` tool's synthetic click sometimes fails to
register right after a navigation. Use `element.click()` through `javascript_tool` when
testing logic — that is reliable.

## Publishing the Artifact

The game is published at
<https://claude.ai/code/artifact/9135a061-41af-4557-8272-a3a8c79ee39d>.

**Always publish to the same URL** by passing the `url` parameter. Without it a new artifact
is created and the old link falls behind. This matters especially when the file has moved — a
changed path alone is enough to create a new artifact.

Do not pass the favicon (🃏) on a republish, so that it stays the same.
