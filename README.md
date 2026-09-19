# Tupatro

**Tuppi × Balatro** — the Finnish trick-taking game _tuppi_ wrapped in a roguelike
deckbuilder. React 19 + TypeScript, built with Vite and deployed as a static site.

**Tupatro is the roguelike**, and that is the whole point of the name: the game the antes, the
blinds, the shop, the jokers and the tuppipakka belong to, the one **Single player** opens and the
one the scoreboard records. Everything else here is an _alternate rule set_ — a mode that borrows
the deal and drops the shell — and each has a name of its own. One of them borrows this game's own
trick cards as well, and it is called **[Multiplayer Tupatro](#the-challenges-multiplayer-tupatro)**
rather than Tupatro, because it is the lobby's mode and not the roguelike.

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

A visit opens on the **start menu**, not on a table, and it asks one question: are you playing
alone? **Single player** is everything played against nobody but the game, and **Multiplayer**
opens the **lobby**, where a game with other people is configured. Those two doors, **Rules** and
the language button are the whole of the menu.

**Single player** asks before it opens while a session is live, rather than refusing: resuming a
run of your own would be walking out of a session you have not left, and every mode behind that
door builds a one-person table a guest cannot play, so clicking it raises a **hang up
multiplayer?** confirmation. Yes ends this window's session and opens the single-player screen
behind it; No leaves the session exactly as it was. Offline the door is one click, no question.
**Multiplayer** is never gated this way, because the lobby's footer is where Hang up is.

Behind Single player are four things, three of which start a game. **Continue** reaches the single-player roguelike wherever it
is — behind the menu, parked behind a challenge or match which it leaves to get there, or, failing
both, the run waiting on its own save if this window is not it. **New game** is the one destructive
click on the screen, so it confirms first whenever there is a run to lose, and Cancel returns to the
screen with that game and its parked run intact. Below them is the list of the alternate rule
sets that can be played alone — [Tuppi-Rummikub](#the-challenges-tuppi-rummikub), the
[Tuppi Race](#the-challenges-tuppi-race), [Traditional Tuppi](#the-challenges-traditional-tuppi),
**[Nami](#the-challenges-nami)**'s two variants and
[Rock-Paper-Scissors](#the-challenges-rock-paper-scissors) — each started against bots, each showing
its own best result. [Multiplayer Tupatro](#the-challenges-multiplayer-tupatro) is not among them:
no bot ever spends a trick card, so it is the lobby's mode alone. **Each of them also saves where it was left**, at the same deal boundaries the
roguelike already saves at: a row with a game waiting draws its own **Continue** beside **Play**,
with a line above the best result saying the deal it reached (or, for the five match modes, its
running score), and **Play** on such a row asks first, in place of its own buttons, because
starting over would lose it. A row with nothing saved draws Play alone, and it starts straight
away. The rail's Menu button raises the start menu rather than starting a run on the spot, so it is
always possible to change your mind and return to the current game.

**SCORES** is on that screen too, in the footer beside Back and apart from everything above it that
starts a game, because the board it opens is the single-player roguelike's own top ten and nothing
else writes to it. One consequence is deliberate: Single player asks to hang up first while a
session is live, so that board cannot be opened from the start menu during a session without
also ending it. It holds finished solo runs and
no session files a row on it, so there is nothing there for a session to want. Mid-run it is still
one click away from the game itself — the rail's own SCORES button, and the copy the blind select,
the shop, the deal end and the cash-out each carry, because their overlay covers the rail.

**Every seat has a character, and the player sits in one of them.** The four chairs belong to
Seija, Raimo, Veikko and Sirpa, and in a single-player run you take Seija's: the game calls that
seat "You" and her name stays out of sight. Your partner sits across from you — tuppi's
partnerships are the two seats facing each other — so the seat you hold decides who you are
playing with, which hand a given seed deals you, and where the rotating deal puts you. The seat
rides along in the saved run, so a reload puts you back in the same chair.

Choosing a different chair is a question only the lobby asks: everything started from Single player
puts you in the chair you already hold and gives the other three to the game.

## Playing with other people

**Multiplayer** on the menu is the door to all of this, because it is the door to the lobby: the
chairs, the mode, hosting, joining and **Hang up** while a session is live all live there. A
started game also has **Back to challenge**, **Back to match** or **Back to game** beside Hang up,
which only lowers the menu onto the game it names.

**The lobby is where a game with other people is configured.** You enter a short name, open a room,
and assign every connected player, including yourself, to one of the four chairs. Any chair left
empty is played by the game. A picker beside the chairs says which of the three match modes Start
begins: the **[Tuppi Race](#the-challenges-tuppi-race)**, ordinary tuppi scored by this game's
arithmetic to 12,000; **[Traditional Tuppi](#the-challenges-traditional-tuppi)**, the same deal on
tuppi's own point table to 52; or **[Multiplayer Tupatro](#the-challenges-multiplayer-tupatro)**, that same traditional
deal with one thing added — a one-shot trick card drawn for each seat every deal. The roguelike is
not among them: it is a game for one — only the run's owner has a wallet, and its result screens
are written to one player — so it lives behind Single player instead. A guest has no picker: the
mode arrives with the host's own Start.

**A room is how you connect.** **Open a room** makes one code for the whole table: eight
characters you read out, which everybody else types into the lobby's **Join a game** with a short
name. Players
arrive in a waiting-room list without a chair; the host places them before Start. The browsers are
introduced over a public **Nostr relay** that is not ours, and the code is the room's password as
well as its name, so what the relay carries it cannot read.

**Other ways to connect** holds the second route, a **code swap**, and it is one level down on
both sides for a reason: it is the route with nobody on the network path at all. Every open chair
produces a code of its own, you get it to the other player however you like — copy it into a
message, or hold its QR code up to their phone, which opens the game with the code already in the
box — and they send their own code back for you to paste. Two codes per chair, moved by hand, and
no relay in the middle. **LAN only** lives here, with the code swap, because a room's signalling
crosses that public relay whatever the switch is set to.

**Start begins the match** once every connected player has a chair. Empty chairs are simply played
by the game, so one to four browsers can play and every unfilled place becomes an AI opponent. The
room page says how many other people have actually connected, and a room holding nobody but you
says so rather than "Everyone is here.": starting alone is a choice you may make — the button says
**Start alone** — but nobody can join a match once it has begun, so it is a choice and not a
readiness state.

**A big screen can join as the shared table.** In a room it simply types the room code like
everybody else and says **Shared table** before it joins: it appears read-only and claims no chair.
On the code swap the display's invitation is built
every time, beside the chairs': **Start a code swap** hands you one code more, belonging to no
chair, and whether a screen turns up is answered by the screen rather than by anything you tick
first. Either way the display draws the felt, the trick, the four chairs and the running score, and
nothing that belongs to one player — no hand, no decision panel, and no button that would move the
game. The players keep their phones and the board is on the wall. The question is asked on both
join pages, and a wide screen is offered the table by default.

**Everybody — a player and the shared table alike — has to be connected before you click Start**,
and nobody _new_ can be let in afterwards: the host refuses any device that arrives once the first
numbered action has gone out, and tells it why. **A device that was already connected and drops can
come back, in a room.** The host keeps a bounded record of what it has already sent, and a device
whose link re-opens is handed exactly the block it missed and plays on from there — you may see the
banner say **Reconnecting…** for a moment while that happens. That is a returning device, not a new
one: a device that was never in the match still cannot join it once it has begun, and a dropped
link on the code swap is still the end, since that route has no way to hand a broken connection a
new invitation. What ships alongside it is the same honest pair as before: **the room's code stays
on screen while the game is played**, at the top of the window, so you can hand it to somebody for
the _next_ match, and a window that arrives too late is told the host refused it and why, rather
than being told the connection dropped.

It is one table per match, it is a peer like any other — it runs the same game from the same deck
and would raise the same warning if the peers drifted apart — and it holds every hand exactly as
every other device does, which is why it deliberately draws none of them.

**While a display is connected, your own device stops drawing the board.** The felt, the four
chairs and the trick are on the wall, so your phone keeps the part that is yours: the declaration
box, whatever the phase is asking you to decide, and your own hand with its sort tools and hint
line underneath. It is the physical table — everybody looks up at the shared cards and keeps their
own in their hands — and the rail is untouched, so the wallet, the shop and the match plate stay
exactly where they were. If you would rather have the board on your own screen too, the small bar
above the panel says so in one click, and the same button puts it away again. That choice belongs
to that one screen: it tells nobody else, it changes nothing in the game, and it is forgotten when
you reload.

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
  save is left exactly where it was and waits for you. **Back to your run** on the result screen
  hangs up in the same click, so it ends the match for everybody: the run waiting behind the match
  is each window's own, and there is no shared one to go back to. What the others are _told_
  depends on who left — if the host does, every screen says the connection dropped; if a player
  does, the others may simply find the match stopped, because nothing announces a departure.
  **Play again** and **Replay this seed** are what keep the table together.

## Developing it

```bash
npm install
npm run dev        # Vite dev server with HMR
npm run build      # tsc -b && vite build -> dist/
npm test           # vitest run — 2,538 permanent tests in the last reported run
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

2,749 permanent tests passed in the last reported run, along with lint, typecheck, formatting
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
  A heart or a diamond means _rami_ (collect tricks), a spade or a club means _nolo_ (avoid
  them). No face cards or aces may be shown. Rami is played if even one player shows it — nolo
  needs everyone's consent. The deck itself is drawn in four colours, one per suit — except in
  Traditional Tuppi and the Tuppi Race, dealt in the traditional two — so the declaration is
  spoken by suit rather than by colour
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
conservative heuristic, not optimal play — most accepted bot soolis still bust in the Traditional
measurement below (98 of 170), and half of them do in the main run's own sample (7 of 14). Only
the active human gets decision controls; other seats see who is deciding, not the exchanged
cards. The mode box names the actual soloist.

**The main roguelike run now offers sooli the same way.** Every defender of a declared rami gets
the house-priority turn described above, bots included, and a bot that holds a hand its
conservative acceptance rule approves plays alone against the declarers — the player can be
soloed against, and can pass the offer on to their own AI partner. Only the soloist's pair banks
a sooli in the main run too: a held one pays the ×6 multiplier and a busted one pays nobody,
whichever pair is soloing — a bot's sooli can therefore zero the run owner's deal. See the
[Balance](#balance) section for the measured cost. That rule change took the network version to
**7**, and the shared table's own message took it to **8** straight after; older tabs — v7 and
anything before it — are rejected, so everyone should refresh before connecting.

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
  = ×1, 3 tricks = ×4; ryöstö doubles it; sooli is ×6 — but only for the soloist's pair, and
  since a bot defender may solo, the other pair banks nothing from that deal either way
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

**Single player** on the menu lists this rule set beside the three match modes, and it is a
standalone run with **none of the roguelike shell**: no antes, no blinds, no targets, no shop, no money, no jokers, no vouchers, no
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
main run's throughout. That button is the only way back to the parked run specifically, and the
single-player screen's new-run button begins a fresh run over the parked one — after a
confirmation, which is where that confirmation now lives. **The challenge itself is saved too now**,
on a slot of its own, at the same deal boundaries the main run saves at — so leaving it any other
way (the single-player screen's own Back, or a reload) does not lose it: its row draws its own
**Continue**, at the deal it last reached. What still does not happen is booting straight back into
it — a reload always opens the start menu over the main run, exactly as before — so a challenge in
progress is one click away on its own row rather than resumed automatically.

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
- **Any seat may be a person or the game**, chosen chair by chair in the lobby that
  [Multiplayer](#playing-with-other-people) opens: a person in another browser or the game. One to
  four people, and because the table is named a chair at a time, two of them may sit **as partners**
  or **across the table as opponents**.

**The 12,000 is this game's own measured number, not tuppi's.** Real tuppi plays to 52 points of
its own table — 4 a trick over six, 24 for a sooli — and this mode does not use it, because
Tupatro's deal score is chips × mult and its tuppi multiplier already _is_ that table (rami 7
tricks ×1, 9 ×3, a _ryöstö_ doubling, a sooli ×6). The two scales are not convertible, so the
target was measured instead. See [Balance](#the-race) below.

A race is a challenge in every mechanical sense, so everything the Tuppi-Rummikub section says
about parking and saving still holds: starting one **parks the run you were in** whole and gives it
back exactly on the result screen's **Back to your run**, nothing is written to `tupatro-run-v1` at
any point during one, and a race now saves **its own** slot at the same deal boundaries — so a
reload no longer loses a match in progress, and its row on the single-player screen draws its own
**Continue** with the deal reached and both pairs' totals so far. Its result board is a **third
key**, `tupatro-race-v1`, and it keeps won matches first, then the **fewest
deals**, then the higher score. A lost match files a row too, unlike a challenge's: the mode has an
opponent, so losing is a result.

## The challenges: Traditional Tuppi

The third alternate rule set is the same thirteen tricks as the race — the declaration, rami, nolo,
sooli and _ryöstö_, none of the roguelike shell — scored by **tuppi's own point table** and played
to **52**. It is the game the rules panel's "What comes from tuppi" section has always described,
and it is started from either door: **Single player**, against three bots, or **Multiplayer**,
where the chairs say who plays and a picker beside them says which of the three match modes they are
playing.

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
- Everything the Tuppi Race section says about the chairs, parking and saving holds here
  unchanged — its own saved slot is `tupatro-run-tuppi-v1`. Its result board is a **fifth key**,
  `tupatro-tuppi-v1`, deliberately not the race's: one row shape over two scales, and a 52-point
  match filed on the race's board would be outranked by every chip-scale row there.

## The challenges: Multiplayer Tupatro

The fourth alternate rule set is Traditional Tuppi in every respect — the same deal, the same
declaration, sooli and _ryöstö_, the same point table, the same 52, the same lost-lead reset — with
one thing added: the roguelike's own **temput** (one-shot trick cards). Nothing else of the shell
comes with them: still no money, no shop, no jokers, no vouchers, no tuppipakka, no blinds and no
bosses. It is started the same two ways as the other match modes, and the mode picker on the
lobby's host page carries a third button for it.

**Neither tuppi source knows a one-shot item a player spends mid-deal.** The temput are this game's
own Balatro shell laid over a traditional deal, not part of tuppi, and the rules panel's own
Multiplayer Tupatro section says so in as many words — the "What comes from tuppi" section stays free of them.
Two of the five even break tuppi's own rules: _Kannanvaihto_ changes a declaration already made,
and _Tikkivarkaus_ hands a trick to a side that did not win it.

- **The supply is a draw, because there is no money to buy one with.** At the start of every deal
  each of the four seats draws one temppu, in seat order — always, whatever a box already holds. A
  `"human"` seat with room in its box (the existing cap of 2) keeps the draw; an AI seat's, or a
  full box's, is discarded. A second site draws the same way (below): playing the ♣K in a Multiplayer Tupatro
  deal. Both take the draw before testing whether to keep it, so a discarded draw costs the same
  randomness as a kept one — what does **not** hold any more is that a deal costs a _fixed_ amount
  of randomness, since whether the ♣K reaches a trick varies. What survives is the narrower, true
  claim: what a seat is _holding_ can never change what the _next_ deal deals.
- **Ikiliikkuja: the ♣K draws an extra temppu for whoever plays it.** "He leaves, but he always
  comes back with something." Neither source gives any card an effect — in tuppi the ♣K is an
  ordinary king, and it still wins or loses its trick exactly as one — so this changes no trick, no
  suit, no rank, no declaration and no score. The seat that plays it into a trick draws one more
  temppu by exactly the rule above: kept only for a `"human"` seat with room, discarded otherwise,
  and told to that seat alone (`toast.ikiliikkuja` / `toast.ikiliikkujaFull`) — nobody else's window
  draws either toast. `isKingOfClubs(c)` (suit and rank, not `uid`) is the one face test, shared with
  the portrait itself. Bots never spend a temppu but do trigger this draw when they play the ♣K,
  since the effect is about the card leaving the hand, not about a decision.
- **A temppu acts for the seat that spends it, in every mode now — Multiplayer Tupatro included.** This is the
  one delivered behaviour the feature changes outside the new mode: `useConsumable` used to act for
  the run owner always, the single-human shortcut the per-seat economy left in one place. A mode
  where four people can hold and spend temput cannot keep that shortcut, so _Kannanvaihto_'s
  declarer, _Vaihtokauppa_'s "worst card" and _Tikkivarkaus_'s theft are all the spender's own now.
  The main roguelike run is unaffected in practice — its one human still is the owner — except for
  the theft's target, which is a real correction: it used to pick the first trick card that was not
  the owner's, which in a sooli could be the soloist's own partner and so steal nothing that
  mattered. It now names the soloist by the table below.
- **The theft's target, read from what each side is trying to do rather than from a rule sheet,
  since no source knows the move:**

  | Mode  | The spender is | The trick goes to             |
  | ----- | -------------- | ----------------------------- |
  | rami  | anyone         | the spender's own side        |
  | nolo  | anyone         | the other side                |
  | sooli | a defender     | the soloist (busts the sooli) |
  | sooli | the soloist    | anyone else                   |

- **The peek and the theft are addressed, not broadcast.** `revealTo` and `stealFor` each carry the
  spending seat rather than a bare flag: the other hands turn face up only on the spender's own
  screen, and the toast that arms the theft (`toast.theftArmed`) is drawn only there too — telling
  the opponents "the next trick is stolen" would defeat the trick outright. A shared table sees and
  spends none of a Multiplayer Tupatro rail's box, exactly like the main game's wallet.
- **Bots never spend a temppu.** Teaching `chooseAI` to would need a new `auto` action, a
  `nextTick` arm, a `SCOPE` entry and a heuristic of its own — the obvious next spec, and the honest
  fix for what this means for balance: **a Multiplayer Tupatro match against bots is lopsided in the humans'
  favour by construction.** The measurement below reports how lopsided; the mode is built for four
  people.
- Everything the Traditional Tuppi section says about the chairs, parking, saving and the network
  version holds here too — its own saved slot is `tupatro-run-tupatro-v1`, its own result board is
  a **sixth key**, `tupatro-tupatro-v1`, and `NET_VERSION` moved to **9** for the mode itself: a v8
  peer's `parseMsg` does not validate challenge ids, so it would run _main-game_ rules against a
  numbered `startChallenge {id: "tupatro"}` rather than refusing it. `hashState`'s wallet line now
  also hashes each seat's consumable ids, so a box that diverges between two peers raises the
  banner instead of hiding behind `rngState`. **`NET_VERSION` moved again, to 10, for Ikiliikkuja**:
  a v9 peer's reducer draws nothing when the ♣K is played, so the first one played in a Multiplayer Tupatro
  match diverges `rngState` and one wallet's box on that peer alone — the wire shape is unchanged,
  the same case v3, v6, v7 and v9 itself already set.

## The challenges: Nami

The fifth and sixth alternate rule sets are the same ordinary tuppi trick play as the race and
Traditional Tuppi — thirteen tricks, no trump, follow suit, ace high — but **nothing else is
decided**: there is no declaration, no rami, no nolo, no sooli and no _ryöstö_, because winning a
trick is neither good nor bad here in itself. What a deal is worth is **the point value of the
cards each pair actually captured**, so winning the wrong tricks costs a pair points rather than
winning them.

**Nami is not one of tuppi's own rules.** It is a house rule from the project's own GitHub issue
#7, quoted verbatim below; a search turned up no published card game of that name, so the rules
panel and this README present it as this game's own custom mode, next to Tuppi-Rummikub, rather
than as anything from the Oulunsalo club sheet or korttipeliopas.fi.

Two point tables, one per variant, each ship as a separate row and a separate saved match:

| Rank              | Easy rules | Hard rules           |
| ----------------- | ---------- | -------------------- |
| A                 | +4         | −1                   |
| K                 | +3         | +13                  |
| Q                 | +2         | +12                  |
| J                 | +1         | +11                  |
| 10                | −1         | +10                  |
| 9 down to 2       | −1 each    | −(its own rank) each |
| **The full deck** | **+4**     | **+4**               |

> _"Helpot säännöt: Pistekortit: A = +4, K = +3, Q = +2, J = +1. Kaikki muut (2–10, myös kymppi):
> −1 kukin. Kun 13 tikkiä on pelattu, laske parisi keräämien korttien pisteet yhteen → se on jaon
> tulos eli tulos = pistekorttien summa − muiden korttien lukumäärä."_
>
> _"Vaikeat säännöt: Miinus (vältä): A = −1, 2 = −2, 3 = −3, … 9 = −9. Plus (kerää): 10 = +10, J =
> +11, Q = +12, K = +13. Parin tulos = keräämiesi korttien arvot yhteen etumerkkeineen."_

- **The ace's value and its place in the trick are different questions.** It is worth +4 in the
  easy table and **−1** in the hard one, and in both it is still the highest card and still wins
  the trick it is played to — the mode keeps ordinary tuppi's rank order throughout. There is no
  sooli to turn the ace low here.
- **The game does every sum.** A card shows its own signed Nami value in its corner in place of a
  chip count, the rail plate shows the running deal and both match totals, and the deal-end and
  result screens show both pairs' numbers. The only decision left to the player is which card to
  play.
- **Both point tables sum to exactly +4 over the whole deck**, which is the reason a target works
  at all on a scale that runs negative: every card in the deck is captured across a deal's thirteen
  tricks, so after `n` deals the two pairs' totals always sum to `4n` and the leader can never be
  below `2n`. A Nami match is always guaranteed to end.
- **Match totals bank cumulatively, like the race's, never Traditional Tuppi's "only one pair may
  be up" reset** — that rule is tuppi's own point table's, and Nami plays neither of tuppi's
  tables.
- **The targets are measured, not tuppi's and not guessed:** the easy variant plays to **40**, the
  hard one to **140**. See [Balance](#nami) below for the figures and for why the hard variant's
  target moved from its own starting guess.
- **Single player only.** Nami is not offered in the multiplayer lobby's mode picker, and hosting
  it or sharing it over a table is out of scope for this mode.

Everything the Tuppi Race and Traditional Tuppi sections say about parking, saving and the result
screen holds here too: starting a Nami match **parks the run you were in** and gives it back
exactly on **Back to your run**; each variant saves its own slot (`tupatro-run-nami-v1` /
`tupatro-run-namihard-v1`) at the same deal boundaries; and each variant's finished matches file on
a **board of its own** — `tupatro-nami-v1` and `tupatro-namihard-v1` — never the race's or the
traditional match's, because a ±40 or ±140 signed total has nothing to do with either scale.

## The challenges: Rock-Paper-Scissors

The seventh alternate rule set is not tuppi at all: no trick, no declaration, no wallet. It is a
card game all the same. Both players are dealt **three cards** from a **41-card deck** — every
heart, spade and diamond, plus the **♣K** and the **♣Q** and no other club — and over **exactly
three rounds** each reveals one card at a time.

- **A card's suit is the throw**: ♥ is paper, ♠ is rock, ♦ is scissors. Rank decides nothing at
  all; every heart is the same throw.
- **Two cards of the same suit tie the round.** A tie counts toward neither side and, unlike the
  physical game, is **not replayed** — a replay cannot fit inside a fixed three rounds.
- **The two clubs beat everything else.** The **♣K beats every other card** and the **♣Q beats
  every other card except the ♣K**. They are two named cards, not a suit the deal declares: tuppi
  has no such suit, and neither does this mode.
- **Whoever wins more of the three rounds wins the match**, and equal wins is a **drawn match** —
  the only draw state in this project. All three rounds are played even when the third cannot
  change the result, because each player is dealt exactly three cards and each round spends one.

**Neither tuppi source knows this mode**, and that is the finding rather than an oversight: the
Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) and korttipeliopas.fi both
describe a four-handed, no-trump trick-taking game built on the rami/nolo declaration. This mode
ships the way Tuppi-Rummikub's laydown and Nami's point tables do — as the game's own side mode,
named as such in the rules panel. **Only the three-way cycle has a source**: **Official WRPSA Rock
Paper Scissors Rules v1.0** (<https://wrpsa.com/rules>), which is where rock blunts scissors,
scissors cut paper and paper covers rock come from. The suit-to-throw mapping and the two clubs are
this game's own invention with no source at all, and WRPSA's own replayed tie and first-to-two
match are both overruled here.

- **Two players, not four.** You play the seat you own; the opponent is the seat to your left. The
  other two chairs sit out entirely with empty hands, and the remaining 35 cards are never dealt.
- **The opponent's card is committed blind.** It is drawn uniformly from the cards it still holds at
  the _start_ of the round — before you can act at all — so it can never be a reaction to your
  choice, even in principle. It is readable in devtools like every hand in this project already is;
  that is accepted, and it does not reach the felt until you have revealed too. The honest
  consequence: the opponent spends its ♣K in a random round, so holding yours back for a round that
  matters is an edge it never takes. A bot that saves its trump is the obvious next change.
- **`RPS_ROUNDS` is 3 and `RPS_HAND` is 3, the requirement's own numbers, not measured ones.** Both
  sides pick without reading the other's card, so there is no balance lever here to tune — see
  [Balance](#rock-paper-scissors) for what _is_ measured: that neither side has an edge, that the
  ♣K really does take every round it appears in, and that every match terminates.
- **Both clubs can land in one hand**, in which case that player holds both and one ordinary card.
  It is left as it falls rather than re-dealt.
- **No trick, no wallet, no shop, no jokers, no tuppipakka, no blinds** — and no enhanced card ever
  reaches the mode, since there is no shop or tuppipakka to introduce one. The shell is as absent
  here as it is in every other alternate rule set. The chip corner is hidden on every card too: a
  chip count means nothing in a mode that banks no scale.
- **Its own result screen and its own board**, `tupatro-rps-v1` — won, drawn or lost, and how the
  three rounds split, never merged with any other board. Rows filed under the earlier first-to-two
  rule are discarded rather than re-sorted under a rule they were never played by.
- **The mode is not resumable.** It reaches no screen at all before its result, and the run's own
  save is only ever written at a screen boundary — so a match abandoned through the menu is lost,
  the same seconds-long cost as any other in-progress state this project does not persist mid-step.
- **Single player only.** It is not offered in the multiplayer lobby, cannot reach the wire, and a
  shared table never sees it.

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

A visit lands on the start menu, and **Single player** then **Continue** is what resumes the saved
run — the boot already loaded it into the store, so the click only lowers the menu. Nothing is
written to `tupatro-run-v1` while the menu is up: a new run may still replace it, so what is on
disk stays what was on disk until the player has chosen. The menu itself is never saved.

Each of the six alternate rule sets now saves the same way, on a slot of its own
(`tupatro-run-rummikub-v1`, `tupatro-run-race-v1`, `tupatro-run-tuppi-v1`, `tupatro-run-tupatro-v1`,
`tupatro-run-nami-v1`, `tupatro-run-namihard-v1`) at the same screen boundaries. A row on the
single-player screen draws its own **Continue** whenever its slot — or the game this window is
already in — has something to resume, with a line above the best result saying where: the deal
reached for Tuppi-Rummikub, or the deal and both pairs' totals for a match. **Booting still only
ever resumes the main run**: a reload opens the start menu over it exactly as before, and a
challenge in progress waits on its own row rather than resuming itself. **Play** on a row with
something saved asks first, since starting over would lose it; a row with nothing saved starts
straight away. A two-human offline board saves and resumes nothing, on any of the seven keys — the
roguelike shell and every alternate rule set alike belong to one seat.

A finished run still leaves a trace. The best ten are kept under a second key,
`tupatro-scores-v1`, which the run snapshot's clearing never touches: game over wipes
`tupatro-run-v1` and the board stands. A row holds the seed, the ante and blind the run reached,
the total of every blind score it banked at cash-out, and whether it was won — the blind a run
dies on banks nothing, so it counts nothing. The board is drawn on the game-over and victory
screens, sorted won runs first, then by ante, then by score, and the **seed is shown so a run
worth having is replayable**: type it into the seed dialog and the same deals come back. The same
board is one button away from anywhere else: the rail's SCORES button opens it while a deal is
running, and the blind select, the shop, the deal end and the cash-out each carry the same button,
because their overlay covers the rail. Away from a game it is behind **Single player** on the start
menu, with the run it records. Opened mid-run it lists finished runs only, since the run
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

**The main roguelike run changed with `2026-09-16-ai-takes-sooli-when-sensible`: bot defenders
there may now solo too, and only the soloist's pair banks a sooli.** Re-measured over the same
**200 seeds `SEED0`…`SEED199`, `playRun(seed, basicPolicy)`**: **1,440 deals** (up from 1,434),
**mean deal score 763.928472** (up from 747.781729, **+2.16%**). Blind clear rate by ante: **69%
(359/522) at ante 1, 57% (46/81) at ante 2, 71% (5/7) at ante 3**; no run in the sample reached
ante 4, and all 200 runs ended in game over.

**Accepted bot soolis, both samples, because the two differ sharply.** `playRun` leaves the deal
that ends a run out of its deal list, so the 1,440 deals above are not the whole 200 runs: they
hold **8 accepted bot soolis, 2 of which busted**, while the 200 run-ending deals hold **6 more,
5 of them busted** — **14 accepted and 7 busted over the whole sample**, exactly half. Quote the
sample with the figure. `basicPolicy` never accepts a sooli itself, so all 14 are a bot's, and
the half that bust is the conservative heuristic behaving as the Traditional measurement above
already described it rather than anything new.

**Both figures above were re-measured, and the pair this paragraph first carried was wrong.** It
quoted a baseline of 1,634 deals at mean 659.235618 and claimed +15.9%; the actual tree at
`fbdf2b1`, the commit this change branched from, measures **1,434 deals at mean 747.781729**. The
stale baseline appears to predate several intervening changes and was never re-measured against
the commit it was being compared with. The real effect is **+6 deals and +2.16%**, which is the
scale a divergence of 14 soolis across the sample would be expected to produce — the original
paragraph's own hedge, that "14 soolis cannot move a mean this far on their own", was the tell
that the baseline rather than the change was at fault. The 10% clause in the spec's Assumptions
was therefore never tripped, and no constant in `ANTES`, `BLIND_REWARD` or `shouldSooli` was
tuned. **A "before" figure has to be measured in the tree it names**, on the same day, by the same
script as the "after" — quoting a number from an earlier README is how a change gets credited with
an effect it did not have. These are headless results; the
[feature verification record](docs/specs/2026-09-09-both-defenders-sooli.md#implementation-and-verification-record)
for the both-defenders spec documents that spec's own gates, mutations and browser checks, and
[2026-09-16-ai-takes-sooli-when-sensible.md](docs/specs/2026-09-16-ai-takes-sooli-when-sensible.md)
is this change's own spec.

### Multiplayer Tupatro

**The target stays 52, unchanged from Traditional Tuppi — this mode adds no new arithmetic, and
Ikiliikkuja does not move it either.** Re-measured 18 September 2026, in this tree, for
`2026-09-18-king-of-clubs-ikiliikkuja`: 200 seeds `TUPATRO0`…`TUPATRO199`, `humans: 4` (every seat
human, since bots never spend a temppu but do trigger the ♣K's draw), `playRace(seed, basicPolicy,
4, 2000, "tupatro")`, run twice on the identical seeds — once with the ♣K an ordinary king (the
_before_ row, this deal's own supply loop with the new draw site reverted) and once with
Ikiliikkuja live (the _after_ row) — plus the Traditional Tuppi baseline, unaffected by this
change and left at its 16 September figure. Every match in both Multiplayer Tupatro runs finished.

| Mode                    | Deals | Median | Mean   | p10–p90 | Min–max | Deals with a temppu spent |
| ----------------------- | ----- | ------ | ------ | ------- | ------- | ------------------------- |
| MP Tupatro — before ♣K  | 4,025 | 15     | 20.125 | 4–43    | 2–111   | 95.03% (3,825/4,025)      |
| MP Tupatro — after ♣K   | 4,015 | 14.5   | 20.075 | 4–45    | 2–97    | 99.03% (3,976/4,015)      |
| Traditional (unchanged) | 2,937 | 12     | 15.69  | 4–29    | 2–74    | n/a                       |

**The before row does not match the 16 September figure this table used to carry (3,825 deals,
94.77% spent), and the gap is the counting method, not the game.** That figure came from an
external script not kept in the tree; this one is a `describe`/`it` block written for this spec,
reverted and rerun on the identical code path to produce the before row, then restored to measure
the after row — see this file's Balance intro on re-measuring in the tree the claim is about
rather than trusting an old number. The comparison that matters is the two rows here, taken the
same way on the same day.

**Ikiliikkuja moves the pace only a little, and moves the spend rate more.** The median drops half
a deal and the mean two hundredths — noise at this sample size — while the maximum falls from 111
to 97: a fourth source of temput gives `basicPolicy`'s box one more way to refill after a
Kannanvaihto or Tikkivarkaus empties a slot, which is also why the share of deals spending one
climbs from 95.03% to 99.03%. **This measures the bot, not the mechanic** — see this file's
Balance intro on that point generally, and CLAUDE.md's note on the side deck specifically:
`basicPolicy.useTrick` is one stated rule (first legal, box full), not a considered choice of
_which_ temppu or _when_, and it does not decide whether to play the ♣K for its draw at all — a
thinking player's pace, and the ♣K's own value, could differ either way.

**A four-human Traditional Tuppi baseline is new here too**, and it is not the same figure as the
one-human, three-bot Traditional row in the previous section (median 30, mean 39.265): with every
seat human, `basicPolicy` never accepts a sooli and the game runs faster — median 12, mean 15.69,
on the identical 200 seeds. The two rows in this table are therefore comparable to each other and
to nothing above.

### Nami

Both variants' targets were measured the same way the race's and Traditional Tuppi's were: 200
seeded matches per variant, `NAMIM0`…`NAMIM199` (easy) and `NAMIHM0`…`NAMIHM199` (hard), all four
seats AI, walked with `chooseAI`'s Nami branch (see `game/ai.ts`) and no human offers to complicate
sooli — there is no sooli in this mode at all. Because `matchOver`/`raceWinner` only ever ask
`max(raceScores) >= target`, one simulation per seed answers every candidate target at once: each
seed was played to a target far past any candidate (100,000), and every round-number target's
crossing deal was read back off that one trajectory.

| Candidate target | Easy median | Easy mean | Easy p90 | Easy max | Hard median | Hard mean | Hard p90 | Hard max |
| ---------------- | ----------- | --------- | -------- | -------- | ----------- | --------- | -------- | -------- |
| 40               | 10          | 10.91     | 16       | 20       | 3           | 3.02      | 5        | 12       |
| 100              | 34          | 33.48     | 44       | 50       | 9           | 10.04     | 17       | 36       |
| 120              | 43          | 41.87     | 52       | 58       | 12          | 13.35     | 23       | 36       |
| 140              | 51.5        | 50.34     | 63       | 68       | 15          | 16.64     | 31       | 52       |
| 160              | 58          | 57.99     | 72       | 80       | 17          | 20.59     | 36       | 54       |
| 180              | 67          | 65.97     | 82       | 89       | 21          | 23.80     | 42       | 67       |

(The full candidate sweep tried 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160,
180, 200 and 220; every one of the 200 seeded matches finished at every candidate in both
variants, which is the `sum = 4n` termination proof holding in practice as well as in
`nami.test.ts`.)

**The spec's band is a median between 8 and 20 deals with a 90th percentile at 35 or fewer.** The
easy variant's own starting guess, **40**, already clears both (median 10, p90 16) and ships
unchanged. The hard variant's starting guess, **180**, does not: its median is 21, one deal past
the band's top. The next candidate down, 160, fixes the median (17) but not the 90th percentile
(36, one over the ceiling). **140** is the closest round number to the original guess that clears
both bars — median 15, p90 31 — so it ships in place of 180.

**A bot measures the bot, and Nami's is a deliberately simple one.** `chooseAI`'s Nami branch asks
only "is the trick on the table worth taking right now", under the deal's own point table, and
reuses the existing win/duck card-picking machinery with that answer — it does not look ahead to
cards not yet played, does not read its own hand's shape, and does not know the hard variant's
10-is-a-prize trap. It draws no random number, so a Nami deal replays identically from its seed.
Tuning the heuristic, or measuring a stronger one, is a balance change of its own.

### Rock-Paper-Scissors

`RPS_ROUNDS` (3) and `RPS_HAND` (3) are the requirement's own numbers, not measured ones — both
sides pick without reading the other's card, so there is no lever here for a policy to move. What
_is_ measured, headlessly through `drive.ts`'s `act`/`advance` and no browser, is what the mode
actually claims: that neither side has an edge, that the ♣K takes every round it is revealed in,
that the deal is a shuffle of the whole 41-card deck, and that every match terminates.

**600 seeded matches, `RPSMEAS0`…`RPSMEAS599`**, the player revealing a card drawn uniformly from
the cards it still holds (the choice does not matter to the opponent — see `reducer.test.ts`'s
determinism case, which plays one seed twice revealing in a different order each time and gets the
identical sequence of the opponent's own cards). Every one of the 600 settled, every one played
exactly three rounds, and every hand ended empty.

| Result | Matches | Share |
| ------ | ------- | ----- |
| Won    | 226     | 37.7% |
| Lost   | 212     | 35.3% |
| Drawn  | 162     | 27.0% |

**Neither side has an edge.** Of the 438 matches that were decided, the player took 226 — seven
above the even split of 219, against a 3σ binomial tolerance of 31.4. Ties are common enough to
make draws a real third of the board: **526 of the 1,800 rounds (29.2%) were tied**, which is what
three suits of thirteen in a deck of 41 produce.

**The deal is the whole deck, not a bag the clubs were left out of.** The 600 matches revealed 3,600
cards:

| Suit         | Count | Share | Share of the deck |
| ------------ | ----- | ----- | ----------------- |
| ♥ (paper)    | 1,117 | 31.0% | 13/41 = 31.7%     |
| ♠ (rock)     | 1,139 | 31.6% | 13/41 = 31.7%     |
| ♦ (scissors) | 1,164 | 32.3% | 13/41 = 31.7%     |
| ♣ (the two)  | 180   | 5.0%  | 2/41 = 4.9%       |

A club was dealt into one of the two hands in **169 of the 600 matches (28.2%)**, against the
hypergeometric expectation of 27.4% for six cards drawn from 41 holding two.

**The ♣K really is the top card.** Across the whole sweep it was revealed in **97** rounds and took
every one of them.

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
