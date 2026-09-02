# Tupatro

**Tuppi × Balatro** — the Finnish trick-taking game *tuppi* wrapped in a roguelike
deckbuilder. No runtime dependencies; the whole game ships as one self-contained HTML file.

Playable in **Finnish and English** — the button next to the seed switches language, and the
browser's language is used on first load. Finnish is the original, and the tuppi terms (rami,
nolo, sooli, ryöstö) stay untranslated in both, because they are the names of the things.

## Playing it

The repo holds source only, so build it first:

```bash
npm run build      # writes dist/tupatro.html
```

Then open `dist/tupatro.html` in a browser. It is one self-contained file with no runtime
dependencies, and it carries `<meta charset="utf-8">` on its first line, so it works straight
from disk.

## Developing it

Source is ES modules under `src/`; the build concatenates them into the single file that gets
published. A published page cannot load external scripts, which is why the deliverable is one
file — but the source is not.

```bash
npm install        # eslint + prettier only; the game has no runtime deps
npm run build      # src/ -> dist/tupatro.html
npm test           # build, then 129 tests
npm run lint
npm run format
npm start          # serves dist/ on http://localhost:8732/tupatro.html
```

| Layer | Modules |
|---|---|
| Text | `locale/fi` `locale/en` `i18n` |
| Pure core (no DOM, state passed in) | `constants` `cards` `content` `rng` `rules` `scoring` `ai` |
| State | `state` |
| Controller | `flow` `shop` |
| View | `ui/dom` `ui/render` `ui/screens` |
| Boot | `main` |

## Tests

```bash
npm test
```

277 tests, no test framework. The rule tests import the real modules and call them with a
plain state object — the core is pure, so no browser or DOM stub is involved. A separate
suite asserts the build output's invariants (self-contained, one script block, seeded
randomness only). CI runs lint, format, build and tests on every push, and uploads the built
game as a workflow artifact.

## What comes from tuppi

Rules verified against the Oulunsalo senior tuppi club's own rule sheet (Antti Auer,
9 September 2022) and [korttipeliopas.fi](https://korttipeliopas.fi/tuppi) — not from memory.

- Four players, two partnerships, full deck, 13 cards each
- **No trump suit.** You must follow the led suit (*maantuntopakko*); the highest card of the
  led suit takes the trick, aces high
- **The declaration** (*näyttö*): the player left of the dealer shows first, then clockwise.
  A red card means *rami* (collect tricks), a black card means *nolo* (avoid them). No face
  cards or aces may be shown. Rami is played if even one player shows it — nolo needs
  everyone's consent
- **Rami:** 7 tricks scores 4 points, each further trick another 4
- **Nolo:** the pair with fewer tricks wins; 6 tricks scores 4 points, each trick fewer
  another 4
- **Ryöstö** (the raid): if the declaring pair falls short of seven, the defenders score
  double
- **Sooli** (the solo): a defender may play alone. The soloist *chooses* one card to pass to
  their partner and gets one back blind; the ace becomes the **lowest** card and the soloist
  always plays last. A trickless sooli scores 24 points; a single trick gives 24 to the
  declarers instead
- A match ends at 52 points — the losing pair has been put *tuppeen*, "in the sheath"

## What comes from Balatro

- Eight antes, each with a small, big and boss blind. The boss target is 2× and carries a
  rule change
- One blind = **four tuppi deals**, their scores added together (Balatro's four hands)
- Every scoring trick is evaluated as a poker hand: **Chips × Mult**
- In rami you score the tricks you **win**; in nolo and sooli, the ones you **dodge**
- Tuppi's own scoring *is* the multiplier: rami 7 tricks = ×1, 9 tricks = ×3; nolo 6 tricks
  = ×1, 3 tricks = ×4; ryöstö doubles it; sooli is ×6
- A short rami or a collapsed nolo means a multiplier of 0 — the deal scores nothing, exactly
  as in tuppi. With four deals per blind, one mistake doesn't end the run
- A shop between deals: 23 jokers, 7 card enhancements, 5 one-shot tricks, 6 permanent
  vouchers
- Calculation order: card additions → joker additions → card multipliers → joker multipliers

## The side deck (*tuppipakka*)

Tuppi deals all 52 cards, so there is no draw pile to mutate — which leaves no room for
Balatro-style deckbuilding. So the deckbuilding lives in a **side deck** outside those 52:
cards bought in the shop persist for the whole run, and at the start of each deal you may
swap two of them into your hand. The swap happens **before the declaration**, so it also
decides whether rami is worth showing.

Swaps are a rationed resource in the same way Balatro's discards are. Without a limit the
side deck would be a toolbox rather than a decision.

| Enhancement | Effect | Rule it bends |
|---|---|---|
| ◼ Kivikortti (stone) | No suit and no rank: playable on any trick, can never win one. +50 chips | follow-suit **and** trick winner |
| ✦ Villi kortti (wild) | Counts as every suit | follow-suit |
| ▮ Teräskortti (steel) | ×1.5 mult on every trick for as long as it stays in your hand | timing |
| ◇ Lasikortti (glass) | ×2 chips, but a 1-in-4 chance of shattering permanently | risk |
| + Bonuskortti | +40 chips | — |
| ! Multikortti | +5 mult | — |
| $ Kultakortti (gold) | +$3 when its trick scores | economy |

The stone card bends two rules at once: having no suit it ignores the follow-suit
obligation, and having no rank it cannot take a trick — making it a **guaranteed duck**.
Excellent in nolo, a dead card in rami.

## Seeds

Every run has a seed, shown at the top of the left rail. The same seed and the same decisions
produce the same run: identical deals, bosses and shop stock. Click the seed to change it;
the end screens offer a rerun of the run you just played.

Any string works as a seed. Generated ones are 8 characters and avoid the confusable
`O/0/I/1`. All game randomness runs through a generator derived from the seed, which also
makes the balance simulations reproducible.

## Balance

The ante thresholds were measured, not guessed: over 1,500 simulated deals run in the
browser. With no jokers and mediocre play the median blind scores about 1,800 points, and
roughly 7% of blinds score nothing. `ANTES` is set so ante 1 almost always clears and ante 4
starts to demand a joker build.

Measured effect of the side deck (sensible swap policy, 60 blinds per row):

| Side deck | Median | Change |
|---|---|---|
| none | 1,770 | — |
| 2 stone cards | 1,905 | +8% |
| 5 mixed enhancements | 2,634 | +49% |

A full mixed side deck is worth roughly +50%, about the same as a couple of jokers — and it
costs money that would otherwise buy jokers, which is why the ante ladder needed no change.
Stone cards alone add little (+8%) because they only pay off in nolo. Sooli success rises
from 14% to 20% with two of them.

## Files

| Path | What |
|---|---|
| `src/` | The game source: ES modules, `style.css`, `index.html` template |
| `build.js` | Concatenates `src/` into `dist/tupatro.html` and validates the result |
| `dist/` | Build output. Gitignored — the repo holds source only |
| `test/` | Rule, scoring, seed, translation and build-invariant tests |
| `CLAUDE.md` | Project conventions (loaded automatically by Claude Code) |
| `eslint.config.js`, `.prettierrc.json` | Lint and format rules |
| `serve.py` | Dev server that sets `charset=utf-8` |
| `.claude/launch.json` | Claude Code preview server config |

## Licence

MIT, see [LICENSE](LICENSE).
