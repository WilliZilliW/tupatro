# Tupatro

**Tuppi × Balatro** — the Finnish trick-taking game _tuppi_ wrapped in a roguelike
deckbuilder. React 19 + TypeScript, built with Vite and deployed as a static site.

Playable in **Finnish and English** — the button next to the seed switches language, and the
browser's language is used on first load. Finnish is the original, and the tuppi terms (rami,
nolo, sooli, ryöstö) stay untranslated in both, because they are the names of the things.

## Playing it

```bash
npm install
npm run dev        # http://localhost:5173
```

Or build the static site and serve it:

```bash
npm run build      # -> dist/
npm run preview
```

## Developing it

```bash
npm install
npm run dev        # Vite dev server with HMR
npm run build      # tsc -b && vite build -> dist/
npm test           # vitest run — 380 tests
npm run test:watch
npm run typecheck
npm run lint
npm run format
```

The rules are a pure, framework-free core; React only draws them. State lives in one
`useReducer` store, and the game's automatic steps (opponents playing, tricks resolving) are
described as data by `nextTick`, which is what lets the whole game be played headlessly in
tests.

| Layer                               | Modules                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| Text                                | `i18n/fi` `i18n/en` `i18n/index`                                  |
| Pure core (no DOM, state passed in) | `constants` `cards` `content` `rng` `rules` `scoring` `ai` `shop` |
| Store                               | `state` `actions` `reducer`                                       |
| Clock                               | `schedule` `hooks/useGameLoop`                                    |
| Headless play                       | `drive` (+ `test/bot`)                                            |
| View                                | `components/*`                                                    |

## Tests

```bash
npm test
```

372 tests on Vitest, co-located with the code they cover. The rule tests import the real
modules and call them with a plain state object — the core is pure, so no browser is involved.
The flow tests play whole deals through the reducer with no timers at all. A render suite draws
every screen, panel and phase in **both languages** and fails on `undefined`, a leaked
translation key, or Finnish left in English output. CI runs lint, typecheck, format, tests and
build on every push, and deploys to GitHub Pages from `main`.

## What comes from tuppi

Rules verified against the Oulunsalo senior tuppi club's own rule sheet (Antti Auer,
9 September 2022) and [korttipeliopas.fi](https://korttipeliopas.fi/tuppi) — not from memory.

- Four players, two partnerships, full deck, 13 cards each
- **No trump suit.** You must follow the led suit (_maantuntopakko_); the highest card of the
  led suit takes the trick, aces high
- **The declaration** (_näyttö_): the player left of the dealer shows first, then clockwise.
  A red card means _rami_ (collect tricks), a black card means _nolo_ (avoid them). No face
  cards or aces may be shown. Rami is played if even one player shows it — nolo needs
  everyone's consent
- **Rami:** 7 tricks scores 4 points, each further trick another 4
- **Nolo:** the pair with fewer tricks wins; 6 tricks scores 4 points, each trick fewer
  another 4
- **Ryöstö** (the raid): if the declaring pair falls short of seven, the defenders score
  double
- **Sooli** (the solo): a defender may play alone. The soloist _chooses_ one card to pass to
  their partner and gets one back blind; the ace becomes the **lowest** card and the soloist
  always plays last. A trickless sooli scores 24 points; a single trick gives 24 to the
  declarers instead
- A match ends at 52 points — the losing pair has been put _tuppeen_, "in the sheath"

## What comes from Balatro

- Eight antes, each with a small, big and boss blind. The boss target is 2× and carries a
  rule change
- One blind = **four tuppi deals**, their scores added together (Balatro's four hands)
- Every scoring trick is evaluated as a poker hand: **Chips × Mult**
- In rami you score the tricks you **win**; in nolo and sooli, the ones you **dodge**
- Tuppi's own scoring _is_ the multiplier: rami 7 tricks = ×1, 9 tricks = ×3; nolo 6 tricks
  = ×1, 3 tricks = ×4; ryöstö doubles it; sooli is ×6
- A short rami or a collapsed nolo means a multiplier of 0 — the deal scores nothing, exactly
  as in tuppi. With four deals per blind, one mistake doesn't end the run
- A shop between deals: 23 jokers, 7 card enhancements, 5 one-shot tricks, 6 permanent
  vouchers
- Calculation order: card additions → joker additions → card multipliers → joker multipliers

## The side deck (_tuppipakka_)

Tuppi deals all 52 cards, so there is no draw pile to mutate — which leaves no room for
Balatro-style deckbuilding. So the deckbuilding lives in a **side deck** outside those 52:
cards bought in the shop persist for the whole run, and at the start of each deal you may
swap two of them into your hand. The swap happens **before the declaration**, so it also
decides whether rami is worth showing.

**A swap needs the same card: same suit, same rank.** A side-deck ace of spades upgrades the
ace of spades in your hand and nothing else. So the side deck never changes _which_ cards you
hold, only what they do — and a card is worth nothing in a deal where its twin went to
someone else. That makes each purchase a bet on the deal rather than a way to fix a bad hand:
a card fires in one deal in four, and five distinct cards give a 76% chance that at least one
of them lands.

Swaps are a rationed resource in the same way Balatro's discards are. Without a limit the
side deck would be a toolbox rather than a decision.

| Enhancement           | Effect                                                                   | Rule it bends                    |
| --------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| ◼ Kivikortti (stone)  | No suit and no rank: playable on any trick, can never win one. +50 chips | follow-suit **and** trick winner |
| ✦ Villi kortti (wild) | Counts as every suit                                                     | follow-suit                      |
| ▮ Teräskortti (steel) | ×1.5 mult on every trick for as long as it stays in your hand            | timing                           |
| ◇ Lasikortti (glass)  | ×2 chips, but a 1-in-4 chance of shattering permanently                  | risk                             |
| + Bonuskortti         | +40 chips                                                                | —                                |
| ! Multikortti         | +5 mult                                                                  | —                                |
| $ Kultakortti (gold)  | +$3 when its trick scores                                                | economy                          |

The stone card bends two rules at once: having no suit it ignores the follow-suit
obligation, and having no rank it cannot take a trick — making it a **guaranteed duck**.
Excellent in nolo, a dead card in rami.

## Parties and support

Every card also belongs to a **party**, and the emblem is printed in the card's bottom-left
corner — in your hand, on the felt and in the tuppipakka, a stone card included: it hides its
suit and rank outside the tuppipakka, but a party is not a suit and nothing can be followed with
it. The party is **not** a function of the suit: the 52 cards split over **13 parties, four
cards each, one card per suit**. That split is the only even one available — the party count has to divide both 52 and the 13
cards of a suit, and only 1 and 13 do — and it is what makes the emblem carry information:
knowing a card's suit or rank tells you nothing about its party.

The emblem abbreviates the party's name, so it is **localised** like every other player-facing
string: it lives in the catalogue as `party.<id>.g`, not as data in `content.ts`. A Finnish
player reads `KH` for _Kahvipuolue_ and an English player `CF` for _Coffee Party_ — an emblem
that abbreviated a word the player never sees would be a lookup rather than a mnemonic. All
thirteen are one or two letters in each language, distinct within it, and none of them is a
real Finnish party's abbreviation.

The mapping is rolled from the run's seed at the start of the run and then fixed. It is not
hardcoded globally, so the emblems cannot be memorised between runs, and it is not rerolled
between deals, so it stays readable within one. Each suit gets its own permutation of the 13
parties, which is why "all the aces are one party" is never the case.

The party lives on the card **type**, not on the individual card: `partyOf(g, c)` looks the
party up by suit and rank, so a shop offer, a tuppipakka twin and the hand card it swaps for
always show the same emblem, and `Card` gains no field. There is no fallback for a card the
map has missed: a default would misattribute support, so the lookup returns nothing and each
caller decides — the card prints no emblem, and the tally credits nobody.

**Every trick your own pair collects brings in support.** Each of the cards in it gives one
support to its own party — one per card, or two to one party if two of the cards share it.
The running total of all 13 parties sits at the bottom of the left rail for the whole run, in a
fixed order so it never reorders itself mid-deal.

Support is read as tricks _won_, not tricks that _score_: those differ, because in nolo and
sooli the game scores the tricks you dodge. A nolo deal therefore collects very little
support, and a collapsed one collects a lot. A sooli trick holds three cards, so it brings in
three — the rule is per card, not a flat four. In sooli your partner sits out, so the only
trick your side can collect is the one that breaks the sooli.

**Support is a counter and nothing else.** It does not touch chips, mult, money, the shop or
any tuppi rule, so no balance figure below changes. It is per run and resets with a new one; it
has no key of its own in `localStorage`, but it does ride along in the run's saved snapshot, so
a refresh does not lose it.

## Seeds

Every run has a seed, shown at the top of the left rail. The same seed and the same decisions
produce the same run: identical deals, bosses and shop stock. Click the seed to change it;
the end screens offer a rerun of the run you just played.

Any string works as a seed. Generated ones are 8 characters and avoid the confusable
`O/0/I/1`. All game randomness runs through a generator derived from the seed, which also
makes the balance simulations reproducible.

## Saved runs

Closing the tab no longer throws the run away. The whole state is saved to `localStorage` under
`tupatro-run-v1` and the run resumes where it left off: the same seed, ante, money, jokers,
tuppipakka, support and shop stock.

The snapshot is taken **at screen boundaries only** — the blind select, the end of a deal, the
cash-out and the shop — so a reload resumes at the last of those, never in the middle of a
trick. Reloading mid-deal therefore rewinds to that screen, and since the generator's state is
part of the snapshot, the deal comes out exactly the same. Game over and victory clear the save,
so the next visit starts a new run; so does entering a seed of your own.

A finished run still leaves a trace. The best ten are kept under a second key,
`tupatro-scores-v1`, which the run snapshot's clearing never touches: game over wipes
`tupatro-run-v1` and the board stands. A row holds the seed, the ante and blind the run reached,
the total of every blind score it banked at cash-out, and whether it was won — the blind a run
dies on banks nothing, so it counts nothing. The board is drawn on the game-over and victory
screens, sorted won runs first, then by ante, then by score, and the **seed is shown so a run
worth having is replayable**: type it into the seed dialog and the same deals come back. The same
board is one button away from anywhere else: the rail's SCORES button opens it while a deal is
running, and the blind select, the shop, the deal end and the cash-out each carry the same button,
because their overlay covers the rail. Opened mid-run it lists finished runs only, since the run
in progress has no result yet; closing it gives back whatever was underneath.

One wrinkle, deliberately left alone: the save format's version was **not** bumped when the
board shipped. A run saved before that resumes intact but with its running total at `0`, so it
under-reports itself once on the board — and only that once. Bumping the version instead would
have thrown every save in flight away, which is the worse of the two.

## Balance

The ante thresholds were measured, not guessed: over 1,500 simulated deals. Simulation runs
the real game headlessly — see `src/test/bot.ts`. With no jokers and mediocre play the median blind scores about 1,800 points, and
roughly 7% of blinds score nothing. `ANTES` is set so ante 1 almost always clears and ante 4
starts to demand a joker build.

Measured effect of the side deck (150 runs per row, ~510 blinds, no jokers bought):

| Side deck            | Median blind | Mean  | Change (median) | Deals with a swap available |
| -------------------- | ------------ | ----- | --------------- | --------------------------- |
| none                 | 1,444        | 1,836 | —               | —                           |
| 2 stone cards        | 1,492        | 1,904 | +3%             | 46%                         |
| 5 mixed enhancements | 1,563        | 2,013 | +8%             | 77%                         |

The same-card rule costs the side deck most of its power: measured against a side deck that
could replace _any_ card, a full mixed set fell from +49% to +8%. Two figures explain it. A
card only reaches the hand it was dealt to, so a single card fires in a quarter of deals, and
the measured 46% and 77% sit near `1 − (3/4)^n` for two and five distinct cards. And an
enhancement alone is a smaller edge than a better card was: swapping a seven for an ace
changed which tricks you could take.

Stone cards still add little (+3%) because they only pay off in nolo — but they are at least
all usable now. Every stone card the shop offered used to be the fixed **2♠**, which made a
second one dead weight: both queued for the one card in the deck. Rolling stone a suit and a
rank like every other enhancement doubled how often a two-stone side deck has a swap to make,
from 24% of deals to 46%, and the swaps actually taken from 342 to 719 over the same runs.
A stone card plays with no suit and no rank either way; the pair now only says which card it
upgrades, and the tuppipakka prints it in the card's top-left corner. The party emblem is not
behind that gate: it names no suit, so it cannot be mistaken for one the card could follow, and
it is read from the catalogue, so it abbreviates the party name in the language on screen.

The ante ladder needed no change: the side deck now sits at roughly one joker's worth of
score, and it still costs money that would otherwise buy jokers.

## Files

| Path                                   | What                                                      |
| -------------------------------------- | --------------------------------------------------------- |
| `src/game/`                            | Rules, scoring, AI, the store and the scheduler           |
| `src/components/`                      | React components: rail, table, hand, panels, screens      |
| `src/hooks/`                           | The store provider, the game clock, hand drag             |
| `src/i18n/`                            | The two catalogues and `t()`                              |
| `src/test/`                            | Render harness, card factories, the headless bot          |
| `index.html`, `src/index.css`          | Page shell and the stylesheet                             |
| `dist/`                                | Build output. Gitignored                                  |
| `CLAUDE.md`                            | Project conventions (loaded automatically by Claude Code) |
| `vite.config.ts`, `tsconfig*.json`     | Build and TypeScript config                               |
| `eslint.config.js`, `.prettierrc.json` | Lint and format rules                                     |
| `.claude/launch.json`                  | Claude Code preview server config                         |

## Licence

MIT, see [LICENSE](LICENSE).
