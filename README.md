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

A visit opens on the **start menu**, not on a table. Its choices have three groups. The solo
roguelike first: **Continue**, shown when the game behind the menu is a roguelike with one human
seat — at boot that means a save was found and loaded — and **New game**, which starts a fresh
single-player roguelike at seat 0. New game asks for confirmation whenever a game is in progress,
including an offline challenge; Cancel preserves that game and its parked run. **While a session
is live, both are disabled**, an open room that has started no match included: hang up through
Multiplayer first. A started challenge, match or shared roguelike has **Back to challenge**,
**Back to match** or **Back to game** instead of Continue; these only lower the menu, never
abandon the game or restore its parked run.
Then the other ways to play: **Multiplayer**, the one
door to [playing with other people](#playing-with-other-people), which holds Host a game, Join a
game and Hang up, and where the two match modes start — the
[Tuppi Race](#the-challenges-tuppi-race) and
[Traditional Tuppi](#the-challenges-traditional-tuppi), with other
people in them or with nobody but the game — and **Challenges**, which holds
[Tuppi-Rummikub](#the-challenges-tuppi-rummikub). Then the two things you read rather than play:
Rules and SCORES, which open from the menu and close back to it. The rail's New game button raises
the same menu rather than starting a run on the spot, so it is always possible to change your mind
and return to the current game.

**Every seat has a character, and the player sits in one of them.** The four chairs belong to
Seija, Raimo, Veikko and Sirpa, and in a single-player run you take Seija's: the game calls that
seat "You" and her name stays out of sight. Your partner sits across from you — tuppi's
partnerships are the two seats facing each other — so the seat you hold decides who you are
playing with, which hand a given seed deals you, and where the rotating deal puts you. The seat
rides along in the saved run, so a reload puts you back in the same chair.

Choosing a different chair is not something a single-player run asks you to do, and New game does
not stop to ask: the run starts on the click. The chair is a question only when somebody else
might take one, so it is asked in the lobby and nowhere else.

## Playing with other people

**Multiplayer** on the menu is the one door to all of this: Host a game, Join a game, and Hang up
while a session is live, with a line saying whether this window is hosting or has joined.

**Host a game** sets the table and starts a match — the roguelike run is a game for one. You take a
chair and give each of the other three a person sitting **here** beside you, an **open** chair for
somebody joining from another browser, or the **game**. A picker beside the chairs says which of
the two modes Start begins: the **[Tuppi Race](#the-challenges-tuppi-race)**, ordinary tuppi scored
by this game's arithmetic to 12,000, or
**[Traditional Tuppi](#the-challenges-traditional-tuppi)**, the same deal on tuppi's own point
table to 52. A guest has no picker: the mode arrives with the host's own Start.

**A room is how you connect.** **Open a room** makes one code for the whole table: eight
characters you read out, which everybody else types into **Join a game**. The open chairs fill in
the order players arrive, so the code does not say whose chair it is — the room is a table, not an
invitation to a seat. The browsers are introduced over a public **Nostr relay** that is not ours,
and the code is the room's password as well as its name, so what the relay carries it cannot read.

**Other ways to connect** holds the second route, a **code swap**, and it is one level down on
both sides for a reason: it is the route with nobody on the network path at all. Every open chair
produces a code of its own, you get it to the other player however you like — copy it into a
message, or hold its QR code up to their phone, which opens the game with the code already in the
box — and they send their own code back for you to paste. Two codes per chair, moved by hand, and
no relay in the middle. **LAN only** lives here, with the code swap, because a room's signalling
crosses that public relay whatever the switch is set to.

**Start begins the match**, and it never waits for permission you did not ask for: an open chair
nobody connected is simply played by the game. So the same button seats four people at one screen,
four browsers, or any mixture — and with every chair left alone it is a solo race against three
AI opponents.

**A big screen can join as the shared table.** In a room it simply types the room code like
everybody else and says **Shared table** before it joins: it claims no chair, because a room sets a
chair aside for whoever says they want one. On the code swap the host builds it an invitation of
its own — tick **Invite a shared table too** before you build the invitations and you get one code
more, belonging to no chair. Either way the display draws the felt, the trick, the four chairs and
the running score, and nothing that belongs to one player — no hand, no decision panel, and no
button that would move the game. The players keep their phones and the board is on the wall. The
question is asked on both join pages, and a wide screen is offered the table by default.

The table has to be connected **before you click Start**: there is no reconnecting, so it cannot be
plugged in at deal five. It is one table per match, it is a peer like any other — it runs the same
game from the same deck and would raise the same warning if the peers drifted apart — and it holds
every hand exactly as every other device does, which is why it deliberately draws none of them.

Three things are worth knowing before you host.

- **There is no server.** The browsers talk straight to each other, and each of them runs the
  whole game from the same shuffled deck — which means **every machine holds every hand**, and
  anybody who opens the developer tools can read yours. Nothing can prevent that without a server
  or a great deal of cryptography, so the game says it plainly instead: play with people you know.
- **A code swap's code carries your public network address**, because that is how two browsers
  find each other across the internet. Ticking **LAN only** removes it, and then the game works
  only between machines on the same network. It stays ticked for the rest of the visit, a room
  opened afterwards included, so if a room is not filling, that is the first thing to look at.
- **A dropped connection ends the match**, and a networked game is never saved. Your single-player
  save is left exactly where it was and waits for you.

## Developing it

```bash
npm install
npm run dev        # Vite dev server with HMR
npm run build      # tsc -b && vite build -> dist/
npm test           # vitest run — 2,043 permanent tests in the last reported run
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

2,043 permanent tests passed in the last reported run, along with lint, typecheck, formatting
and build. Both-defender sooli UI passed browser checks in both locales at 1280×500 and
390×844. Tests use Vitest and are co-located with the code they cover. The rule tests
import the real modules and call them with a plain state object — the core is pure, so no browser
is involved.
The flow tests play whole deals through the reducer with no timers at all. A render suite draws
every screen, panel and phase in **both languages** and fails on `undefined`, a leaked
translation key, or Finnish left in English output. CI runs lint, typecheck, format, tests and
build on every push, and deploys to GitHub Pages from `main`.

## What comes from tuppi

Rules verified against the [Oulun seniorit club's own rule sheet](https://bin.yhdistysavain.fi/1578091/btMCw3K3EMDmpZGdlplu0_cKiM/Tuppi-s%C3%A4%C3%A4nn%C3%B6t.pdf)
(Antti Auer, 9 September 2022) and [korttipeliopas.fi](https://korttipeliopas.fi/tuppi) — not from memory.

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
- **Only one pair can hold match points.** If that pair loses a deal, both totals return to
  0–0. Neither pair banks points for that deal; the next deal starts a new rise.
- A match ends at 52 points — the losing pair has been put _tuppeen_, "in the sheath"

That whole table is playable as it stands: **[Traditional Tuppi](#the-challenges-traditional-tuppi)**
is this list and nothing else, scored to 52. The main game and the Tuppi Race take the same rules of
play and score them with Balatro's arithmetic instead, which is what the next section describes.

**Sooli offers in both match modes use a house rule.** Traditional Tuppi and Tuppi Race offer
both defenders a turn to decide: humans first, then bots; within either group, clockwise from
the dealer's left. First acceptance wins. Declining passes this offer to the next defender;
only when both decline does ordinary rami begin. The club sheet and korttipeliopas.fi permit
either defender to play alone but do not resolve competing claims, so this priority is not
presented as a traditional rule. Nolo and the declaring pair receive no offer.

A bot accepts only from its own hand: at most one card ranked 10–K, and at least one A, 2 or 3
in every suit it holds. Acceptance uses no randomness or other hands. It gives away its highest
sooli-ranked card (ace low); its partner's return remains private and random. This is a
conservative heuristic, not optimal play — most accepted bot soolis still bust in the measured
sample below. Only the active human gets decision controls; other seats see who is deciding,
not the exchanged cards. The mode box names the actual soloist. Hot seat still has no curtain.

**The main roguelike run is unchanged:** at most one human defender gets an offer, and bots
never take sooli there. Match builds now use network version **4**; old v3 tabs are rejected,
so everyone should refresh before connecting.

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

The Challenges list holds this one rule set — both match modes are started from the lobby instead,
because its chairs are what say who plays — and it is a standalone run with **none of the
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
mid-deal if that is where you were, and the result screen's **Back to your run** gives it back
exactly; nothing is written to `tupatro-run-v1` at any point during one, so the save on disk is the
main run's throughout. That button is the only way back, so a challenge **in progress** is played
out to its result screen or lost: reloading the page during one loses it and resumes the main run at
its last snapshot, and New game on the menu starts a fresh run over the parked one. And a challenge
is itself **never saved**.

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
  Match totals are cumulative for each pair; a loss does not erase its earlier score.
  A busted sooli is the exception: neither pair scores.
- **A collapsed sooli scores for nobody.** This one knowingly departs from the source, which gives
  the declarers 24 points when the soloist takes a trick. Tupatro's multiplier is 0 on a busted
  sooli and the race keeps the main game's behaviour rather than changing its scoring; correcting
  it is a change of its own. The consequence is that a busted sooli advances the race by nothing.
- **Any seat may be a person or the game**, chosen chair by chair in the lobby that Multiplayer's
  [Host a game](#playing-with-other-people) opens: a person at this screen, a person in another
  browser, or the game. One to four people, and because the table is named a chair at a time, two
  of them may sit **as partners** or **across the table as opponents**. The window follows
  whichever seat is to act.
- **A hot-seat match runs on the honour system.** There is no curtain: whoever is at the screen can
  see the hand of whoever is to play. The rules panel says so rather than implying otherwise.

**The 12,000 is this game's own measured number, not tuppi's.** Real tuppi plays to 52 points of
its own table — 4 a trick over six, 24 for a sooli — and this mode does not use it, because
Tupatro's deal score is chips × mult and its tuppi multiplier already _is_ that table (rami 7
tricks ×1, 9 ×3, a _ryöstö_ doubling, a sooli ×6). The two scales are not convertible, so the
target was measured instead. See [Balance](#the-race) below.

A race is a challenge in every mechanical sense, so everything the Tuppi-Rummikub section says
about parking still holds: starting one **parks the run you were in** whole and gives it back
exactly on the result screen's **Back to your run**, nothing is written to `tupatro-run-v1` at any
point during one, and a race is itself **never saved** — a match in progress is played out to its
result screen, and reloading during one loses it and resumes the main run. Its
board is a **third key**, `tupatro-race-v1`, and it keeps won matches first, then the **fewest
deals**, then the higher score. A lost match files a row too, unlike a challenge's: the mode has an
opponent, so losing is a result.

## The challenges: Traditional Tuppi

The third alternate rule set is the same thirteen tricks as the race — the declaration, rami, nolo,
sooli and _ryöstö_, none of the roguelike shell — scored by **tuppi's own point table** and played
to **52**. It is the game the rules panel's "What comes from tuppi" section has always described,
and the two match modes are started from the same lobby: **Multiplayer → Host a game**, where the
chairs say who plays and a picker beside them says which of the two they are playing.

The raw deal value, per pair, straight from korttipeliopas.fi. Banking it follows the match's
reset rule below; a deal's value is not always awarded:

| Deal                                   | Points to                       | Value         |
| -------------------------------------- | ------------------------------- | ------------- |
| rami, the declaring pair takes `w` ≥ 7 | the declaring pair              | `(w − 6) × 4` |
| _ryöstö_: the other pair takes `w` ≥ 7 | the defending pair              | `(w − 6) × 8` |
| nolo, a pair takes `w` ≤ 6             | that pair                       | `(7 − w) × 4` |
| sooli held, the soloist takes no trick | the soloist's pair              | `24`          |
| sooli busted, the soloist takes one    | the declaring pair (_ramaajat_) | `24`          |

_"Kuudella kasalla joukkue saa neljä pistettä ja jokainen kasa vähemmän lisää pisteitä neljällä."_ —
_"Ramissa voittoon tarvitaan seitsemän kasaa. Seitsemästä kasasta saa neljä pistettä, sen jälkeen
jokainen ylimääräinen kasa on neljän pisteen arvoinen."_ — _"Ryöstetty rami on arvoltaan
kaksinkertainen."_ — _"Jos soolaaja selviää tikeittä, pari saa 24 pistettä. Jos soolaaja ottaa
yhdenkin tikin, ramaajat saavat 24 pistettä."_ — _"Peli päättyy, kun toinen joukkueista pääsee 52
pisteeseen."_

- **The 52 is tuppi's number, not this game's.** Unlike the race's 12,000 it was neither measured
  nor chosen: choosing another figure would be inventing scoring. What was measured is the match
  length that falls out of it — see [Balance](#traditional-tuppi) below — and it is reported rather
  than tuned.
- **Away from sooli the table is exactly four times the tuppi multiplier** the main game already
  carries, which is the whole reason the race could not use it: the race's deal score is chips ×
  mult _times_ that multiplier, so the two scales are not convertible. `points.test.ts` asserts the
  identity for every trick count, so the two cannot drift apart.
- **A busted sooli pays the declaring pair 24 here and nobody in the other two modes.** This is the
  deal's value before the reset rule below: the main game and the race keep Tupatro's multiplier
  of 0, and this mode follows the source's point table.
- **Only one pair can hold match points.** From 0–0 a winning pair banks the deal's value; winning
  again adds to that total. If the pair currently up loses, **both totals reset to 0–0** and the
  winning pair banks nothing for that deal. For example, a pair leading 20–0 loses rami 6–7:
  the result is **0–0, not 20–8 or 0–8**. This applies to sooli and ryöstö too. The next deal
  starts a new rise. The deal-end screen explains a reset and shows zero awarded points.
  Keeping independent cumulative totals is the sources' optional faster variant, which this
  mode no longer uses; Tuppi Race is unchanged. Deals still run to thirteen tricks except on a
  busted sooli — stopping a lost lead early is a separate, unimplemented rule.
  Network version 3 introduced this reset; version 4 now also requires the shared match-sooli
  rules. Older builds cannot join; all players should refresh before connecting.
- **The tricks are worth nothing while they are played.** No chips, no poker trick types and no
  score pop on the felt, because there is no per-trick number for one to carry. The rail plate
  carries the deal's running points for the viewing pair instead.
- Everything the Tuppi Race section says about the chairs, the hot seat's honour system and parking
  holds here unchanged. Its board is a **fifth key**, `tupatro-tuppi-v1`, deliberately not the
  race's: one row shape over two scales, and a 52-point match filed on the race's board would be
  outranked by every chip-scale row there.

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

**The target remains 12,000; scoring remains cumulative, with zero for both pairs on a bust.**
The original target study is historical: two policies over `RACE0`…`RACE399`, 60 deals each
(48,000 total), with no accepted sooli, gave the AI-style policy a median of seven deals at
12,000 versus ten at 15,000. That supported choosing 12,000 then; it is not current pace or a
termination guarantee. The old accept-every-offer sample (median 11, maximum 27) is historical
too. Current measurements below include bot offers in both match modes.

**Final measurement, 9 September 2026, after canonical partner returns.** Each row is 400
seeds `TRAD0`…`TRAD399`, using `playRace(seed, policy, 1, 1000, mode)` with `mode` equal to
`"race"` or `"tuppi"`, one human and three AI seats. Percentiles use nearest rank. Policies:

- **A:** `basicPolicy`, with declaration from `aiDeclare` and
  `chooseCard: (g, p) => chooseAI(g, p, makeRng(g.rngState)).uid`; the human declines sooli.
- **B:** unchanged `basicPolicy`; the human declines sooli.
- **C:** `basicPolicy` accepting every human sooli offer.

Bots use the new conservative acceptance rule in all three. **A is not fully symmetric sooli
play:** the human always declines while bots may accept. Owner wins means the run owner's pair.

| Mode        | Policy | Total deals | Median | Mean    | p10–p90 | Min–max | ≥15 deals | Owner wins |
| ----------- | ------ | ----------- | ------ | ------- | ------- | ------- | --------- | ---------- |
| Race        | A      | 3,235       | 8      | 8.0875  | 5–12    | 1–16    | 1.25%     | 47.25%     |
| Race        | B      | 2,504       | 6      | 6.26    | 3–9     | 1–14    | 0%        | 11.5%      |
| Race        | C      | 4,292       | 10     | 10.73   | 4–17    | 1–29    | 22.25%    | 28%        |
| Traditional | A      | 15,706      | 30     | 39.265  | 7–81    | 3–284   | 75.5%     | 47.5%      |
| Traditional | B      | 6,035       | 11     | 15.0875 | 4–31    | 2–73    | 39.75%    | 2.25%      |
| Traditional | C      | 3,200       | 6.5    | 8       | 3–15    | 2–42    | 12%       | 1.5%       |

Bot decisions, excluding human offers and attempts:

| Mode        | Policy | Offers | Attempts | Held | Bust |
| ----------- | ------ | ------ | -------- | ---- | ---- |
| Race        | A      | 3,798  | 38       | 16   | 22   |
| Race        | B      | 3,207  | 31       | 17   | 14   |
| Race        | C      | 3,948  | 39       | 16   | 23   |
| Traditional | A      | 18,591 | 170      | 72   | 98   |
| Traditional | B      | 7,743  | 79       | 33   | 46   |
| Traditional | C      | 2,898  | 34       | 16   | 18   |

The heuristic accepts rarely and is not optimal: **98 of 170 accepted bot soolis busted** in
Traditional A (about 58%). All **2,400 matches / 34,972 deals** completed without stalls, with
an independent banking replay checking totals after every deal. This proves completion for
these seeds and policies, not a bound on every match or a human play-time estimate.

### Traditional Tuppi

**The target stays 52, with the same reset banking and 24/24 raw sooli outcomes.** A reset
awards neither pair points. The final samples above recorded **5,035 / 1,660 / 801 resets**
for A / B / C. Traditional A's median is **30 deals**, much longer than Race A's eight;
B and C are lopsided losses, not evidence that the rule itself became a quick match.

**Historical comparison, not current pace:** before this feature, baseline `4863da9` on the
same A seeds measured Race mean **8.0725**, median **8**, and Traditional mean **41.835**,
median **30.5**, maximum **225**. The final Traditional mean fell to 39.265, but its maximum
rose to **284**; do not claim the long tail disappeared. The still earlier eight-deal
Traditional median measured cumulative banking, not the current reset rule. Intermediate
measurements before the UID-canonical return are superseded and are not used here.

The main roguelike comparison is unchanged: **200 seeds `SEED0`…`SEED199`, 1,634 deals, mean
deal score 659.235618**, identical to the previous aggregate. Neither target nor scoring was
tuned for this feature. These are headless results; the [feature verification record](docs/specs/2026-09-09-both-defenders-sooli.md#implementation-and-verification-record)
separately documents final gates, mutations and browser checks.

### The side deck

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
| `src/net/`                             | The relay, the invitation codec and the QR encoder        |
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
