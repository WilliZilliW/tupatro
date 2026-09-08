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

A visit opens on the **start menu**, not on a table. It offers **Continue**, which is there only
when there is a run to go back to — at boot that means a save was found and loaded — **New game**,
which asks first whenever Continue is on offer and starts a run straight away when it is not, and
**Challenges**, a list of alternate rule sets — two of them so far,
[Tuppi-Rummikub](#the-challenges-tuppi-rummikub) and the [Tuppi Race](#the-challenges-tuppi-race).
Rules and SCORES open from the menu and close back to it, and the rail's New game button raises
the same menu rather than starting a run on the spot, so it is always possible to change your mind
and Continue.

**Every seat has a character, and the player sits in one of them.** The four chairs belong to
Seija, Raimo, Veikko and Sirpa, and in a single-player run you take Seija's: the game calls that
seat "You" and her name stays out of sight. Your partner sits across from you — tuppi's
partnerships are the two seats facing each other — so the seat you hold decides who you are
playing with, which hand a given seed deals you, and where the rotating deal puts you. The seat
rides along in the saved run, so a reload puts you back in the same chair.

Choosing a different chair is not something a single-player run asks you to do, and New game does
not stop to ask: the run starts on the click. The seat picker exists for the multiplayer mode,
where which chair you hold is the whole question, and it is reached from there rather than from
here.

## Developing it

```bash
npm install
npm run dev        # Vite dev server with HMR
npm run build      # tsc -b && vite build -> dist/
npm test           # vitest run — 1,051 tests
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

1,051 tests on Vitest, co-located with the code they cover. The rule tests import the real
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

- Ten antes, each with four blinds: small, big, small boss and big boss. The targets are
  ×1, ×1.5, ×2 and ×2.5 of the ante and the rewards $3–$6
- **Two bosses to an ante**, drawn from two disjoint pools — six mild ones for the small boss
  blind, six harsh ones for the big one — so an ante never shows the same boss twice. Neither
  boss blind can be skipped; winning the run is beating the ante-10 big boss
- One blind = **four tuppi deals**, their scores added together (Balatro's four hands) — three
  under the Rush boss (`kiire`), which takes one deal off the blind
- Every scoring trick is evaluated as a poker hand: **Chips × Mult**
- In rami you score the tricks you **win**; in nolo and sooli, the ones you **dodge**
- Tuppi's own scoring _is_ the multiplier: rami 7 tricks = ×1, 9 tricks = ×3; nolo 6 tricks
  = ×1, 3 tricks = ×4; ryöstö doubles it; sooli is ×6
- A short rami or a collapsed nolo means a multiplier of 0 — the deal scores nothing, exactly
  as in tuppi. With four deals per blind, one mistake doesn't end the run
- A shop between deals: 23 jokers, 7 card enhancements, 5 one-shot tricks, 6 permanent
  vouchers. An offer that does not fit a full storage is bought by picking what it replaces —
  the replaced item is destroyed and pays nothing back
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

Which card in your hand is replaced is therefore never a choice — the twin is unique. Whether
to spend the swap at all is, so a click on a tuppipakka card only selects it: the panel then
shows what the enhancement does, which card in your hand it would upgrade and, for a dimmed
card, why it cannot be taken. Swap performs the exchange, Cancel takes the selection back.

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
The running total of all 13 parties sits at the bottom of the left rail for the whole run — on a
phone, on the fourth of the rail's five swipeable pages — in a fixed order so it never reorders
itself mid-deal.

Support is read as tricks _won_, not tricks that _score_: those differ, because in nolo and
sooli the game scores the tricks you dodge. A nolo deal therefore collects very little
support, and a collapsed one collects a lot. A sooli trick holds three cards, so it brings in
three — the rule is per card, not a flat four. In sooli your partner sits out, so the only
trick your side can collect is the one that breaks the sooli.

**Support is a counter and nothing else.** It does not touch chips, mult, money, the shop or
any tuppi rule, so no balance figure below changes. It is per run and resets with a new one; it
has no key of its own in `localStorage`, but it does ride along in the run's saved snapshot, so
a refresh does not lose it.

## The challenges: Tuppi-Rummikub

The Challenges list holds one alternate rule set, and it is a standalone run with **none of the
roguelike shell**: no antes, no blinds, no targets, no shop, no money, no jokers, no vouchers, no
consumables and no tuppipakka. A challenge is **four deals**, and every one of them is a forced
rami — no declaration, no nolo, no sooli and no ryöstö.

The tricks score nothing. They exist to deal the hands for what comes after: when the thirteenth
trick is over, **each side's won cards become that side's hand**, and the two partnerships play a
laydown, Rummikub-style, turn about. The side that won the rami — the one with at least seven of
the thirteen tricks, and with thirteen exactly one side always has it — goes first.

- A **set** is 3 or 4 cards of one rank in different suits. A **run** is 3 or more cards of one
  suit with consecutive ranks.
- A run does not wrap through the ace. An ace is always 14, so Q-K-A is a run and A-2-3 is not —
  ranks are only ever 2 to 14, so there is nothing to wrap.
- A row already on the table takes **one new card per turn**. A row of entirely new cards may be
  three or more.
- The table may be rearranged freely, but nothing may be taken off it.
- A turn lasts **60 seconds**, drawn as a bar rather than counted down. Running out passes.
- A turn that places nothing is a pass, and **two passes in a row end the laydown**.
- The deal scores **the pips laid minus the cards still in hand**: an ace 14, the courts 11 to 13,
  everything else its number. It is not clamped, so a deal — and a run — may end below zero.

The four deals' scores add up to the run's, and it goes on the **challenge's own top-ten board**
under a key of its own, `tupatro-challenge-rummikub-v1`. Nothing about it is measured against the
main game's ante thresholds and its numbers are not comparable with them: a challenge run scores
in the hundreds where a main-game blind scores thousands.

Two more things worth knowing. Starting a challenge **parks the run you were in**, whole and
mid-deal if that is where you were, and the menu's Leave the challenge gives it back exactly;
nothing is written to `tupatro-run-v1` at any point during one, so the save on disk is the main
run's throughout. And a challenge is itself **never saved** — reloading the page during one loses
it and resumes the main run at its last snapshot.

The opponents play the laydown by the same rules with a deliberately simpler search: they extend
each row on the table by one card and then lay whatever fresh sets and runs the rest of the hand
affords, dearest first. They never split a combination and never merge two. That is a weaker
opponent, not a different rule set.

## The challenges: Tuppi Race

The second alternate rule set is **ordinary tuppi**, and that is the point of it: the declaration,
rami, nolo, sooli and _ryöstö_ are all there and thirteen tricks are played exactly as the main
game plays them. What is gone is the roguelike shell — no antes, no blinds, no blind targets, no
shop, no money, no jokers, no vouchers, no consumables and no tuppipakka, so no swap phase either.
Two partnerships play deal after deal until one pair's running total reaches **12,000**. That pair
wins the match and the other has been put _tuppeen_.

The shape is tuppi's own. korttipeliopas.fi: _"Peli päättyy, kun toinen joukkueista pääsee 52
pisteeseen. Silloin vastajoukkue on pantu tuppeen."_ A tuppi match is a race to a point total with
no fixed number of deals, and this is that.

- Every deal is scored by **exactly the arithmetic the main game uses**: the trick types,
  chips × mult, and the tuppi multiplier over the top.
- **One pair scores a deal and the other gets nothing.** That is not a new rule — it falls out of
  the existing functions. With thirteen tricks one side always holds at least seven, so in rami
  only one side clears the multiplier's floor and in nolo only one side is at six or fewer.
  Measured over 48,000 deals: never both, never neither.
- **A collapsed sooli scores for nobody.** This one knowingly departs from the source, which gives
  the declarers 24 points when the soloist takes a trick. Tupatro's multiplier is 0 on a busted
  sooli and the race keeps the main game's behaviour rather than changing its scoring; correcting
  it is a change of its own. The consequence is that a busted sooli advances the race by nothing.
- **Any seat may be a person or the game**, one to four people at one screen, chosen on the race's
  own row in the Challenges list. Humans are seated clockwise from the chair the run was in, so two
  people sit **across the table as opponents** rather than as partners — a race is a race between
  the pairs. The window follows whichever seat is to act.
- **A hot-seat match runs on the honour system.** There is no curtain: whoever is at the screen can
  see the hand of whoever is to play. The rules panel says so rather than implying otherwise.

**The 12,000 is this game's own measured number, not tuppi's.** Real tuppi plays to 52 points of
its own table — 4 a trick over six, 24 for a sooli — and this mode does not use it, because
Tupatro's deal score is chips × mult and its tuppi multiplier already _is_ that table (rami 7
tricks ×1, 9 ×3, a _ryöstö_ doubling, a sooli ×6). The two scales are not convertible, so the
target was measured instead. See [Balance](#the-race) below.

A race is a challenge in every mechanical sense, so everything the Tuppi-Rummikub section says
about parking still holds: starting one **parks the run you were in** whole and gives it back
exactly on Leave the challenge, nothing is written to `tupatro-run-v1` at any point during one, and
a race is itself **never saved** — reloading during one loses it and resumes the main run. Its
board is a **third key**, `tupatro-race-v1`, and it keeps won matches first, then the **fewest
deals**, then the higher score. A lost match files a row too, unlike a challenge's: the mode has an
opponent, so losing is a result.

## Seeds

Every run has a seed, shown at the top of the left rail — on a phone, on the game page the rail's
swipe ends on. The same seed and the same decisions produce the same run: identical deals, bosses and shop stock. Click the seed to change it;
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

A visit lands on the start menu, and **Continue** is what resumes the saved run — the boot already
loaded it into the store, so the click only lowers the menu. Nothing is written to
`tupatro-run-v1` while the menu is up: New game may still replace the run, so what is on disk
stays what was on disk until the player has chosen. The menu itself is never saved.

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

The save format carries a version, and **a run saved by an older version is discarded, not
migrated** — the next visit starts a new run instead. That has now happened twice. The first time
the state stopped counting tricks as "ours" and "theirs" and started counting them by partnership:
two fields went away, so an old snapshot describes a shape the game no longer has, and loading it
would report 0–0 for a deal already half played. The second time the money, the jokers, the
vouchers and the tuppipakka stopped being the run's and became a _seat's_, so seventeen fields
moved into a record of their own — a snapshot from before that carries a purse and an inventory
under names nothing reads any more, and a run resumed from it would start over at six dollars with
none of the jokers it had bought.

Both of those older saves are **discarded now**, so the rule above holds with no exception. Each
change did ship a temporary upgrade that carried the runs already in flight across — the money and
the jokers folded into the seat that was playing them, which is exactly the wallet those values
belonged to — but an upgrade like that buys a few days of grace, not a permanent home, and both
have since been deleted. Every run still saved by either older version is gone with them: that is
the loss the upgrades postponed rather than prevented. Only ever one such upgrade existed at a
time, so no chain of them ever formed, and none exists today.

Before that the version had deliberately _not_ been bumped three times over, because each of
those changes only ever _added_ a field and a missing field simply arrives at the value a fresh
run would give it. The most visible of the three: a run saved before the scoreboard shipped
resumes intact but with its running total at `0`, so it under-reports itself once on the board.
Throwing every save in flight away for that would have been the worse of the two.

## Balance

Measured, not guessed. Simulation runs the real game headlessly — see `src/test/bot.ts` — and the
figures below were re-measured over **600 seeded runs** (`SEED0`…`SEED599`) of `basicPolicy`, a bot
that plays mediocre tuppi and buys nothing at all: **1,999 blinds**. The whole section was
re-measured when Trick Ban (`temppukielto`) joined the harsh pool, because adding a row to a content
table changes what every seed draws — the earlier sample described a build that no longer exists.

| Figure                                                    | Measured              |
| --------------------------------------------------------- | --------------------- |
| Median blind score                                        | 1,436                 |
| Mean blind score                                          | 1,845                 |
| Blinds scoring nothing at all                             | 21%                   |
| Clear rate by blind (small / big / small boss / big boss) | 79% / 70% / 66% / 51% |

Per ante, and how far the bot gets:

| Ante          | 1     | 2   | 3   | 4   | 5–10        |
| ------------- | ----- | --- | --- | --- | ----------- |
| Blinds played | 1,682 | 289 | 24  | 4   | 0           |
| Cleared       | 72%   | 60% | 67% | 75% | not reached |

All 600 runs ended in game over, the furthest at ante 4, so **antes 5 to 10 are unmeasured**: a
bot that never buys a joker does not reach them. The two top thresholds, 16,000 and 25,000 at
antes 9 and 10, therefore stand as set rather than as measured — which is a fact about the bot,
not a claim that the top of the ladder is tuned. Measuring it needs a policy that shops. The
ante-3 and ante-4 rates read high for the same reason: only a run already going well arrives
there.

Mean blind score per boss, from the same runs. The samples are 38–79 blinds each, so read them as
a sanity check on the pools rather than as a ranking:

| Boss                        | Blind      | Blinds | Mean  | Cleared |
| --------------------------- | ---------- | ------ | ----- | ------- |
| Mean Multiplier (`kitsas`)  | small boss | 70     | 1,562 | 51%     |
| Forced Rami (`pakkorami`)   | small boss | 62     | 2,019 | 74%     |
| Forced Nolo (`pakkonolo`)   | small boss | 79     | 1,880 | 62%     |
| Spade Ban (`patakielto`)    | small boss | 60     | 1,728 | 68%     |
| Court Collapse (`kuvakato`) | small boss | 74     | 2,007 | 66%     |
| Taxman (`verokarhu`)        | small boss | 64     | 2,209 | 75%     |
| Red Ban (`punainen`)        | big boss   | 46     | 1,681 | 54%     |
| Handbrake (`kasijarru`)     | big boss   | 38     | 920   | 39%     |
| At Random (`umpimahka`)     | big boss   | 46     | 1,170 | 41%     |
| Rush (`kiire`)              | big boss   | 42     | 1,550 | 48%     |
| Grey Spell (`harmaus`)      | big boss   | 53     | 1,821 | 57%     |
| Trick Ban (`temppukielto`)  | big boss   | 44     | 1,688 | 61%     |

Taxman costs money rather than score, and Grey Spell costs a side deck this bot barely uses, so
both score high here; a player who has bought cards feels them where the bot does not.

**Trick Ban's row is not a measurement of Trick Ban.** `basicPolicy` buys nothing, so it never
holds a consumable, and a boss that stops consumables from firing takes nothing from it: the 1,688
above is the reshuffle a new content row causes and no more, which is why the boss reads as the
mildest of the harsh pool. Its real cost is **unmeasured**, and measuring it needs a policy that
shops — the same gap Grey Spell's row has.

**The two forcing bosses are the clearest case of a bot measuring the bot.** Both take the
declaration away, and `basicPolicy` declares by counting court cards — so what they remove from it
is nearly nothing, and both land at the easy end of the mild pool. A player who reads a hand and
picks the line loses more than the bot does, Forced Nolo especially: it hands rami to an opponent,
which is also what puts sooli on the table more often than any other blind.

### The challenge

Measured the same way, over **200 seeded runs** of `playChallenge` with `basicPolicy` — which
plays the trick phase as it plays any rami and lays out with `chooseLaydown`, the **same greedy
search the opponents use**. That is the caveat on every number here: a player who splits and
merges combinations scores more than this, so read the table as a floor rather than as par.

| Over 200 seeded runs | Median | Mean  | 10th–90th | Min | Max |
| -------------------- | ------ | ----- | --------- | --- | --- |
| Run (four deals)     | 634    | 637.6 | 484–790   | 340 | 958 |
| One deal (800 total) | 154    | 159.4 | —         | 0   | 416 |

**No run scored below zero, and no deal did either** — the bot always finds something to lay, and
the pips of a hand of 24 or 28 cards outweigh what is left over. A negative score is reachable
(nothing clamps it) but it takes a hand that cannot move, which the greedy search almost never
has.

### The race

**The target is measured, not chosen.** There is no ante ladder to inherit a number from, so it
came out of playing deals headlessly with no boss, no purchase and every wallet empty — the same
state a golden bot run already exercises.

**How to reproduce every number below.** Seeds `RACE0` … `RACE399`, one race each started with
`{ type: "startChallenge", id: "race", seed, humans: 1 }` and its `target` then raised out of
reach, so a seed yields a sequence of **60 deals** rather than stopping at the first winner; each
deal recorded as `dealScores(g)` on its `dealend` screen. Match lengths for a candidate target are
walked out of those sequences afterwards, which is why one pass answers every target at once. A
board with no human at all is not expressible — `nextTick` would stall at the first player-gated
phase — so sample A's one human seat is given a policy that asks `aiDeclare` / `chooseAI` for its
answer: all four seats decide with the game's own heuristics. The measurement is a throwaway
`src/test/tmp-balance.test.ts`, written, read and deleted, per CLAUDE.md.

Two samples, 400 seeds x 60 deals = **24,000 deals** each, of the scoring pair's deal score:

| Sample                                                          | Median | Mean  | 10th-90th | Min | Max    |
| --------------------------------------------------------------- | ------ | ----- | --------- | --- | ------ |
| **A** all four seats deciding with the game's own `chooseAI`    | 1,992  | 2,519 | 677-4,968 | 319 | 18,632 |
| **B** `basicPolicy` at the owner, `chooseAI` at the other three | 2,352  | 2,848 | 708-5,650 | 319 | 24,480 |

**The other pair scored 0 in all 48,000 deals of both samples.** No deal scored for both pairs and
none for neither. That is the mode's termination argument, and it is not luck — see the section
above for why. Its one exception is a busted sooli, which scores nothing for anybody, and neither
sample's policy ever takes a sooli.

Deals to a candidate target, walking each seed's deal sequence and stopping at the first pair at or
past it (400 matches per row, none unfinished inside the 60-deal sample):

| Target     | Sample | Median | Mean | 10th | 90th | Min | Max | <=2 deals | >=15 deals |
| ---------- | ------ | ------ | ---- | ---- | ---- | --- | --- | --------- | ---------- |
| **12,000** | A      | **7**  | 7.7  | 4    | 12   | 1   | 17  | 1.8%      | 1.0%       |
| 12,000     | B      | 6      | 6.4  | 3    | 10   | 1   | 16  | 3.5%      | 0.5%       |
| 15,000     | A      | 10     | 9.8  | 6    | 14   | 3   | 20  | 0.0%      | 6.3%       |
| 15,000     | B      | 8      | 7.9  | 4    | 12   | 1   | 18  | 1.0%      | 1.5%       |

**The reading: 12,000.** A deal costs roughly 50-60 seconds of clock at the scheduler's delays, so
a median match of seven deals is seven or eight minutes — the same order as a main-game blind
sequence and as a Tuppi-Rummikub run — and the 90th percentile of twelve deals keeps a long match
inside a quarter of an hour. 15,000 was measured and rejected: a median of ten deals with 6.3% of
matches running to fifteen or more is a long sit in a mode with no shop and no ante screen to break
it up. The rare one- or two-deal finish is accepted as a story rather than designed away; capping a
deal's contribution would be inventing scoring.

**Sample A is the honest pace figure, and B is the caveat.** `basicPolicy` is a handicap rather
than a par player: its pair won **14.0%** of matches at this target against three `chooseAI` seats,
while in sample A the two pairs are close to even (55.3% / 44.7% of 400 matches, which is a couple
of points outside the ±4.9% a sample that size carries — call it near-even rather than proven so).
A lopsided race reaches a target faster than a close one, so B's match lengths read short. A bot
measures the bot; the symmetric all-`chooseAI` sample is the one to compare against.

A third sample was taken because a sooli is the one deal that can score nothing for either pair.
With the policy accepting **every** sooli offer, over 400 matches **35.9%** of deals scored for
nobody — and every match still finished, at a median of **11 deals** and a maximum of **27**, with
a quarter of them running to fifteen deals or more. That is what makes the mode's termination safe
to rely on: even a policy that takes every sooli going gets there.

The side deck was measured on the earlier eight-ante ladder and nothing in the four-blind ante
touches it (150 runs per row, ~510 blinds, no jokers bought):

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
