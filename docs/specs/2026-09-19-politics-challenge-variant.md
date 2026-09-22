---
id: 2026-09-19-politics-challenge-variant
title: Add Politiikka, an eighth alternate rule set — rami and nolo alternate deal by deal instead of being declared, and one named card shouts down every trick she is played into
kind: rule
status: superseded
source: GitHub issue #49 (the team's own chat, quoted verbatim in Finnish below). This is a **custom mode**, like Tuppi-Rummikub and Nami: the alternation, the absence of the declaration and the Sofia card are this game's own inventions and are not claimed to be tuppi. What the mode does _not_ change is cited and unchanged — the trick play (four players in two partnerships, thirteen cards each, no trump, _maantuntopakko_, the highest card of the led suit taking the trick, ace high) and the rami/nolo point table it banks come from the Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi>, already quoted in `src/game/points.ts`. Where this mode departs from those sources, the departure is stated under **Source** below and belongs in a code comment.
---

Superseded by [`2026-09-20-combine-politics-modes`](2026-09-20-combine-politics-modes.md), which merges this mode with Puoluepeli into one "politiikka" mode and reverses this spec's dealPoints scale and target; this file's rotation and Sofia rule stand.

# Add Politiikka, an eighth alternate rule set — rami and nolo alternate deal by deal instead of being declared, and one named card shouts down every trick she is played into

## What

Single player gains a seventh row: **Politiikka**, a politics-themed alternate rule set. The deal
is ordinary tuppi trick play, but **nobody declares anything**. The deal type is decided by a
fixed rotation instead: deal 1 is a **hallituspeli** — a rami, the government's game, where both
pairs want tricks — deal 2 an **oppositiopeli** — a nolo, where both pairs dodge them — and so on,
alternating for as long as the match lasts. There is no _näyttö_, no _ryöstö_ and no sooli,
because there is no declaration for any of them to hang off.

One card is special, and it is the mode's joke made mechanical: the **Sofia card** (♥Q) **wins
every trick she is played into**, whatever was led and whatever outranks her. She still has to
follow suit like any other card, and every card is played over thirteen tricks, so the side
holding her always takes exactly one extra trick — a free trick in a government deal and a
guaranteed blot in an opposition deal. Deciding _when_ to spend her is the mode's whole decision,
and it flips sign every deal.

A deal is worth tuppi's own point table — the same `dealPoints` Traditional Tuppi already banks —
and both pairs bank cumulatively, first to the mode's measured target taking the match. Nothing
about the roguelike shell comes with it: no ante, no blind, no money, no shop, no jokers, no
vouchers, no tuppipakka and no temput.

## Prior specs and documents

- **Extends `2026-09-07-race-to-target-mode`, `2026-09-08-traditional-tuppi-multiplayer-mode` and
  `2026-09-16-nami-game-mode` (all delivered), and contradicts none of them.** Politiikka is a
  sixth `MatchId` of the shape those three built: it reuses `raceDeal`, `raceBase`, `raceScores`,
  `target`, the `raceover` screen, `matchOver`, `raceWinner` and `matchModeOf`, so `GameState`
  gains no field and `SAVE_VERSION` stays `3`. The race's 12,000 and its chips × mult arithmetic,
  Traditional Tuppi's 52 and Nami's two tables are untouched — criteria pin all four.
- **Does not inherit Traditional Tuppi's reset rule (`2026-09-09-traditional-tuppi-score-reset`,
  delivered), and this is the sharpest trap in the whole spec.** That reset lives _inside_
  `endHand`'s `race || tuppi || tupatro` branch and is written as `d.challenge !== "race"`, so
  adding `"politiikka"` to that branch rather than giving it an arm of its own would silently
  hand this mode the reset as well. This is a scoping decision, not a reversal: the reset is
  tuppi's own "only one pair may be up", quoted from the sources for a mode where a pair
  _declares_ and can lose what it declared. Nobody declares here, so there is no lost lead to
  knock down.
- **Overlaps `2026-09-18-king-of-clubs-ikiliikkuja` (delivered) in shape only.** Sofia borrows its
  precedent — a named card whose face test lives in `cards.ts` so the rule and the portrait can
  never name different cards, with its effect gated on one challenge id — and none of its code:
  no draw, no `CONSUMABLES`, no `TUPATRO_DRAW`, and the ♣K stays Multiplayer Tupatro's alone. A
  criterion pins that the ♣K does nothing in a Politiikka deal.
- **Overlaps `2026-09-06-tuppi-rummikub-challenge` (delivered) in shape only.** Politiikka takes
  its precedent for a deal with no declarer — forced `mode`, elder hand leads — and none of its
  code: no laydown, no `laydown.ts`, no `laydown` phase, no `tupatro-challenge-rummikub-v1`.
- **Overlaps `2026-09-14-per-challenge-continue` and `2026-09-14-single-player-separate-from-multiplayer`
  (both delivered) and needs nothing from either.** The mode gets a saved slot for free through
  `challengeRunKey(id)`, is reached exactly like the other solo modes (`SinglePlayer.tsx`'s row,
  `startChallenge` with no `seats`, the `single.replaceAsk` confirmation, the Single player door's
  existing hang-up question), and `rehydrate` already rejects a `challenge` id not in `CHALLENGES`.
- **Overlaps `2026-09-08-webrtc-transport` (delivered) and takes nothing from it.** No new action,
  no `SCOPE` entry, no `hashState` field, no `parseMsg` clause, no `guestMay` clause;
  `NET_VERSION` stays **11**. The lobby does not offer Politiikka.
- **Nothing here is already delivered.** `ChallengeId` has seven members today, `MatchId` five;
  no mode in `src/game/` decides its deal type by rotation, and no card anywhere in the project
  overrides `currentWinner`.
- **The issue's "many weekly politics variants" is deliberately not built here.** That is a
  rotation/scheduling feature — which mode is offered when, and by what clock — and it is a spec
  of its own. This one delivers a single, permanently available mode.

## The idea, quoted

From GitHub issue #49, the team chat, in Finnish so nothing is lost in translation:

> "Rami ois hallituspeliä ja Nolo oppositiopeliä"

> "joka toinen peli ois ramia ja joka toinen noloa"

> "joo tehdään monta eri politiikkaversiota... se ois hyvä että niitä viikottaisia challengeja on
> paljon erilaisia"

> "Sofia-kortti osaa huutaa ja möykätä niin paljon että muut ei jaksa enää pelata"

The issue states plainly that it is a raw idea and names the two decisions a spec must settle:
whether rami/nolo become forced-alternating rather than declared (**yes — see the criteria**) and
what the Sofia card actually does (**she wins the trick she is played into — see the criteria and
the assumption that argues the alternatives down**).

## Acceptance criteria

- [ ] **One id, and the target is data.** `MatchId` in `src/game/types.ts` is
      `"race" | "tuppi" | "tupatro" | "nami" | "namihard" | "politiikka"`; `CHALLENGES` in
      `content.ts` gains one row — id `"politiikka"`, key `"challenge.politiikka"`, `deals:0`,
      `target:POLITIIKKA_TARGET` — whose glyph is checked against tofu the way `CLAUDE.md` asks;
      `POLITIIKKA_TARGET` lives in `constants.ts` with its measurement in the comment beside it;
      `matchModeOf` in `race.ts` gains the case, and `startChallenge` reads `row.target` and gains
      no id test.
- [ ] **`src/game/politics.ts` is the mode's own rule and nothing else.** It exports
      `politicsMode(dealNo: number): Mode` — the rotation, odd deal rami, even deal nolo — and
      `sofiaIn(trick): TrickPlay | null`, the one answer to "is the loud one in this trick". No
      wallet, no boss, no `base`, no React, no i18n; it is added to `PURE_CORE` in
      `invariants.test.ts` and to `CLAUDE.md`'s module table. `isSofia(c) = c.s === "H" && c.r === 12`
      lives in `cards.ts` beside `isKingOfClubs`/`isQueenOfClubs`, with the same comment saying it
      is a card-**type** question and not a uid comparison, and it is the single test both the rule
      and `PlayingCard` read. `src/game/politics.test.ts` pins the rotation for deals 1–10 and that
      exactly one card in `makeDeck()` answers `isSofia`.
- [ ] **A Politiikka deal declares nothing.** `startDeal` gains an arm of its own, spelled by id:
      it sets `d.mode = politicsMode(d.raceDeal)` **after** incrementing `raceDeal`, leaves
      `ramSeat` and `ramTeam` null, leads from the elder hand (`(dealer + 1) % 4`), resets
      `raceBase`, and goes straight to `beginPlay` — no `runDeclarations`, no swap phase, no
      temppu draw. A `reducer.test.ts` case drives two consecutive whole deals and asserts the
      first is `"rami"` and the second `"nolo"`, that the phase never reaches `declare`,
      `soolioffer`, `sooligive`, `sooliready` or `laydown`, that `sooli` and `sooliBust` stay
      false and `shows` stays all null, and that thirteen four-card tricks are played in each.
- [ ] **The Sofia card wins the trick she is played into, in this mode and nowhere else.**
      `currentWinner`'s `Pick` widens to include `"challenge"` and it returns `sofiaIn(g.trick)`
      before any rank comparison when `g.challenge === "politiikka"`; the strict `>` and the
      stone/wild handling below it are **byte-identical**. `rules.test.ts` asserts: in a Politiikka
      trick the ♥Q beats a card that would otherwise win (an ace of the led suit, led first, so the
      assertion is not passed by a card that would have lost anyway — the mutation lesson in
      `CLAUDE.md`); she wins when led and when played last; the same trick in `"tuppi"`, in
      `"race"` and with `challenge: null` is won by the ace instead; and she still cannot be played
      when `legalCards` refuses her, which is unchanged. A `reducer.test.ts` case plays a whole
      Politiikka deal and asserts the pair holding the ♥Q won the trick she was played into.
- [ ] **A trick scores nothing and the deal is worth tuppi's points, banked cumulatively.**
      `resolveTrick` gains a Politiikka arm beside the traditional one: no `scoreTrick`, nothing
      into `base` or `raceBase`, `d.pop` stays null, party support still tallied above the id
      branches, and one toast (`toast.sofia`) when `sofiaIn` is non-null, so the player is told why
      a queen beat an ace. `endHand` gains an arm of its own that banks `dealPoints(d)` into
      `raceScores` for **both** pairs, sets `handScore` to the run owner's pair's and touches
      neither `dealsLeft` nor `blindScore`. **It does not reset.** A `reducer.test.ts` case plays a
      deal the leading pair loses and asserts both totals kept their points, and a second case
      asserts `endHand`'s `d.challenge !== "race"` reset clause was not widened to cover this mode.
- [ ] **The match ends the way a race does.** `showHandResult`'s match branch gains the id, so it
      opens `raceover` when `matchOver` and `raceWinner` agree and `dealend` otherwise, never
      neither — the `handend` tick loop `schedule.ts` warns about — and sets `runScore` to the
      owner pair's total. A headless match through `drive.ts`'s `advance` settles, and a test
      asserts every deal awards a strictly positive amount to exactly one pair (with thirteen
      tricks one side always has seven or more in rami and six or fewer in nolo), which is this
      mode's termination proof.
- [ ] **The target is measured, not guessed.** `src/test/bot.ts`'s `playRace` accepts the new id
      (its `dealOf` branch answers `dealPoints` for it, and `"race"` stays the default so no
      existing call site or README recipe moves); at least **200 seeded matches** are played
      headlessly, every one finishing; median, mean, 90th percentile and maximum deal counts go in
      `README.md` beside the race's, the traditional match's and Nami's. The target that ships is
      the round number whose median lands between **8 and 20 deals** with the 90th percentile at
      **35 or fewer**; if no round number does, the closest ships and the miss is written into the
      README rather than the band being quietly widened. **100 is a starting point to measure away
      from, not a value to ship unmeasured.**
- [ ] **Its own board and its own saved slot, and no other key moves.** `MATCH_KEY` in
      `storage.ts` stays a `Record<MatchId, string>` and gains `tupatro-politiikka-v1`; the run
      slot comes free through `challengeRunKey("politiikka")`. A test asserts a finished Politiikka
      match files its row on its own key and that `tupatro-race-v1`, `tupatro-tuppi-v1`,
      `tupatro-nami-v1`, `tupatro-namihard-v1`, `tupatro-rps-v1` and
      `tupatro-challenge-rummikub-v1` are untouched by it. `SAVE_VERSION` stays `3`: no
      `GameState` field is added, `raceDeal` already carries the rotation and is already saved, and
      `rehydrate` accepts the id through its existing `CHALLENGES` check with no new positional
      read.
- [ ] **Nothing on the felt or in a screen claims a declaration happened.** `ModeBox` gains a
      Politiikka arm ahead of the ordinary declaration reading — it draws the deal's own label
      (government / opposition) and a note saying the rotation decided it, and it **never** calls
      `seatName(ramSeat ?? 0, …)`, which would name Seija as a declarer who does not exist.
      `DealEnd` routes the id to `MatchDealEnd deal={dealPointsOf}` while its `reset` boolean stays
      keyed to `"tuppi" | "tupatro"` alone. `MatchPlate`, `RaceOver`, `Rail`'s page choice and
      `GameContext`'s board write all reach the mode through `matchModeOf` and need no id test of
      their own. `PlayingCard` marks the ♥Q in this mode with a marker element of its own (a plain
      ASCII glyph, no new image asset, no chip-corner change), and **draws nothing extra for her in
      any other mode**. `Hint` is **not** changed: `hint.followWin` / `hint.followDodge` /
      `hint.lead` / `hint.leadLow` are already true here because `g.mode` is a real rami or nolo,
      and a `render.test.tsx` case pins that a Politiikka `play` phase draws exactly those lines.
- [ ] **The bots play the mode, and know they cannot beat her.** `chooseAI` gains one clause gated
      on the id: a trick that already contains the Sofia card cannot be won, so the "can I win
      this" filter is empty and the existing win/duck machinery takes over unchanged. It consumes
      **no randomness**, so a Politiikka deal replays identically from its seed, and being gated on
      the id it moves neither `seats.test.ts`'s pinned literals nor the 50-seed aggregate. `ai.ts`
      needs no declaration branch, because the mode never reaches `declare` or `soolioffer`.
- [ ] **Text and docs, in both languages.** Both catalogues carry `challenge.politiikka.n` / `.t`,
      the ModeBox label and note, `toast.sofia`, and a `rules.politiikkaTitle` + `rules.politiikka`
      section in `Rules.tsx` stating the rotation, the absence of the declaration, sooli and
      _ryöstö_, the Sofia card by name and rank, the point table, the target, and — in the same
      shape the Ikiliikkuja line already uses — that **neither source knows any of it**. Placeholder
      sets match both ways, every number goes through `fmt()`, emphasis renders through `<Rich>`.
      `render.test.tsx` sweeps a Politiikka rail, felt + hand, deal end and result screen in both
      languages, and its spelled-out solo id list grows to seven with `CHALLENGES` at eight.
      `README.md` gains a mode section and its measured figures; `CLAUDE.md` gains the module, the
      id, the board key and the reset trap.
- [ ] **Nothing else moves.** `NET_VERSION` stays **11** and `src/net/protocol.ts` is
      byte-identical; `LOBBY_MODES` in `Lobby.tsx` stays `["tupatro", "race", "tuppi"]`;
      `SOLO_MODES` in `SinglePlayer.tsx` keeps filtering `"tupatro"` alone; no new `Phase`, no new
      `Action`, no new `GameState` field, no new `setTimeout`, no new `Math.random`. Tests pin that
      a Traditional Tuppi, race, Nami, Tupatro and main-game deal each score exactly what they
      scored before, that the ♣K draws nothing in a Politiikka deal, and that `seats.test.ts`'s
      golden literals and 50-seed aggregate are unchanged.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The alternation is per _deal_ and applies to both pairs at once.** "joka toinen peli ois ramia
  ja joka toinen noloa" is read as: deal 1 rami, deal 2 nolo, deal 3 rami, keyed off `raceDeal`,
  which is already state and already saved, so a resumed match continues the rotation where it
  left off. The other available reading — that one pair is permanently the government and plays
  rami while the other plays nolo _in the same deal_ — is rejected because tuppi's point table
  scores one deal type at a time and two simultaneous ones would need an invented table this spec
  has no source for.
- **Odd deals are rami.** `raceDeal` is incremented to 1 for the first deal, so the match opens
  on a hallituspeli. Nothing in the issue says which comes first; the government is named first in
  the chat and that is the whole of the reason.
- **The declaration is removed outright, and with it sooli and _ryöstö_.** This **contradicts
  both sources**, which make the declaration a free clockwise choice and build _ryöstö_ and sooli
  on top of it. It is deliberate and is what the issue asks for; the mode is presented as this
  game's own throughout, beside Tuppi-Rummikub and Nami, and the rules panel says so. The
  `ryöstö` doubling is therefore unreachable here: `dealPoints` already treats a null `ramTeam` as
  "nobody declared it, so this is not a robbery", so **`points.ts` is not touched at all**.
- **The Sofia card is the ♥Q, and her effect is that she wins the trick.** The issue names neither
  a card nor a mechanic. ♥Q is chosen because the ♣K and ♣Q are already spoken for (Ikiliikkuja and
  Rock-Paper-Scissors' own trump table) and a queen suits the flavour. "She shouts so much the
  others cannot be bothered to play" is read as **she takes the trick**, because it is the only
  reading that keeps thirteen four-card tricks — and thirteen tricks are exactly what
  `dealPoints` needs to stay valid. Two alternatives were considered and rejected in writing:
  **voiding the trick** would leave twelve counted tricks, and then in rami neither pair reaches
  seven and in nolo both pairs are at or under six, so a deal would score for nobody or for
  everybody; **ending the deal early** would leave hands uneven and `trickNo >= 13` no longer the
  deal's end. A joker or a boss was rejected on mechanics, not taste: a match mode has no wallet,
  no shop and no boss blind, so neither exists to hang an effect on.
- **She is a rule, not a bonus, and that is the point.** Because every card is played, her side
  wins exactly one trick more than its cards would otherwise take — free in a government deal,
  a straight loss of a point step in an opposition deal. The mode's decision is when to spend her,
  and the sign of that decision flips every deal. This is asserted rather than argued: the test
  above pins the trick, and the measurement below is what says whether the mode is playable.
- **The point table is tuppi's own (`dealPoints`), banked cumulatively with no reset.** The
  alternative — the race's chips × mult — was rejected because a mode with no declaration, no
  jokers and no wallet has nothing for that arithmetic to read. The reset was rejected because it
  is tuppi's rule for a _declared_ game and because, stacked on a forced rotation, it makes a
  match drag: Traditional Tuppi's median is already 30 deals with it.
- **The target is measured, and 100 is not it.** 100 is the scale-derived starting point for the
  measurement, nothing more. If no round number lands in the band, the nearest ships and the
  README records the miss.
- **Single player only, and the lobby is untouched.** The issue frames this as a weekly _challenge_
  variant. Widening `MatchId` means `net.match` could in principle hold the id, but the picker is
  built from `LOBBY_MODES` and nothing else writes it, so no session can reach a Politiikka deal
  and `NET_VERSION` stays 11 — the same argument Nami shipped under. If the implementer finds a
  route that puts the id on the wire, the version bumps and the reason is written down; it is not
  left to a v11 peer, which would fall back to `CHALLENGES[0]` and desync on action one.
- **The bots get one clause and no strategy.** They will learn that a trick holding Sofia is lost,
  and nothing else: no sense of when to spend her, no reading of the rotation a deal ahead. Every
  measured figure is therefore a bot measuring the bot, in the sense `CLAUDE.md` warns about, and
  the README says so beside the figures. Teaching them to time her is a balance spec of its own.
- **Names: "Politiikka" in Finnish, "Politics" in English; the deals are "Hallituspeli" /
  "Oppositiopeli" and "Government deal" / "Opposition deal".** Neither is a tuppi term, so both
  translate. **The card is called Sofia and nothing more** — a first name only, no party, no
  surname and no real person named in any string, which is the same line the ♣K's "Väykkä" and the
  ♣Q's "Katri Ristiakka" already sit on. No new image asset is drawn for her; the marker is a text
  glyph.
- **The id string is `"politiikka"`**, Finnish like `"tuppi"`, and it is saved and hashed from the
  day it ships, so it is not renamed later for a label.
- **"Many politics versions" is one mode today.** The issue asks for a rotating set of weekly
  challenges. This delivers one mode, permanently available on the single-player screen. A second
  politics variant, and any rotation that decides which is offered this week, are separate specs —
  and the rotation is the one that needs a clock, which this project has exactly one of
  (`useGameLoop`) and does not use for calendars.

## Touch points

- `src/game/types.ts` — `MatchId` gains `"politiikka"`; `ChallengeId` follows for free.
- `src/game/constants.ts` — `POLITIIKKA_TARGET`, with the measurement in its comment.
- `src/game/content.ts` — one `CHALLENGES` row.
- `src/game/politics.ts` — **new**: `politicsMode(dealNo)` and `sofiaIn(trick)`, plus the comment
  recording the chosen readings (rotation parity, and why she takes the trick rather than voiding
  it).
- `src/game/cards.ts` — `isSofia`, beside `isKingOfClubs` and `isQueenOfClubs`.
- `src/game/rules.ts` — `currentWinner`: the `Pick` widens to `"trick" | "sooli" | "challenge"` and
  the Sofia early return goes in front of the loop, with the strict `>` untouched below it.
- `src/game/reducer.ts` — `startDeal`'s new arm, `resolveTrick`'s new arm (and `toast.sofia`),
  `endHand`'s new arm (**not** folded into the `!== "race"` reset branch), `showHandResult`'s match
  id list.
- `src/game/race.ts` — `matchModeOf` gains the case (exhaustive switch: it will not compile until
  it does).
- `src/game/ai.ts` — one id-gated clause: a trick holding Sofia cannot be won.
- `src/game/storage.ts` — `MATCH_KEY` gains `tupatro-politiikka-v1`.
- `src/components/table/ModeBox.tsx` — the mode's own label and note, ahead of the declaration
  reading.
- `src/components/screens/DealEnd.tsx` — the id routes to `dealPointsOf`; `reset` stays
  `"tuppi" | "tupatro"`.
- `src/components/PlayingCard.tsx` — the Sofia marker, gated on the mode.
- `src/index.css` — the marker's one rule (hand-formatted, Prettier-excluded).
- `src/components/screens/Rules.tsx` — the mode's section.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `challenge.politiikka.n` / `.t`, the ModeBox pair,
  `toast.sofia`, `rules.politiikkaTitle`, `rules.politiikka`.
- `src/test/bot.ts` — `playRace`'s `dealOf` branch accepts the id.
- `src/game/politics.test.ts` (**new**), `src/game/rules.test.ts`, `src/game/reducer.test.ts`,
  `src/game/scores.test.ts`, `src/test/render.test.tsx`, `src/test/invariants.test.ts` (`PURE_CORE`).
- `README.md` — the mode section and the measured figures; `CLAUDE.md` — the module table, the id
  list, the board key and the reset trap.

## Out of scope

- **The weekly rotation itself.** Which challenge is offered when, any clock or calendar, any
  "this week's challenge" surface. One permanently available mode ships.
- **Further politics variants.** The issue asks for several; this is one.
- **Multiplayer.** `LOBBY_MODES`, `SCOPE`, `hashState`, `parseMsg`, `guestMay`, the shared table
  and `NET_VERSION` are all untouched, and no session can reach the mode.
- **Any part of the roguelike shell in the mode** — money, shop, jokers, vouchers, tuppipakka, the
  swap phase, blinds, bosses, cash-out — and **temput**: no deal draw, and the ♣K's Ikiliikkuja
  draw stays Multiplayer Tupatro's alone.
- **A Sofia portrait image.** The ♣K and ♣Q have painted portraits; she gets a text marker, and an
  asset is a separate piece of work.
- **Bot strategy for Sofia**, and any bot sense of the rotation beyond the deal it is in.
- **Changing any delivered number**: the race's 12,000, Traditional Tuppi's 52 and its reset,
  Nami's two targets and tables, Multiplayer Tupatro's draw, and every main-game literal in
  `seats.test.ts` stay exactly as they are. `currentWinner` outside this mode is unchanged,
  including the strict `>`.
- **A drawn match.** `raceover` carries `winner: 0 | 1`; with one pair scoring every deal a draw
  cannot arise, and no draw state is added (Rock-Paper-Scissors keeps that distinction to itself).
- **A multi-human Politiikka save.** `soloBoard` still gates the run slot, exactly as it does for
  the other match modes.

## Source

- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** and
  **<https://korttipeliopas.fi/tuppi>** — what this mode keeps, unchanged: four players in two
  partnerships sitting across from each other, thirteen cards each, **no trump**, follow suit
  (_maantuntopakko_), the highest card of the led suit taking the trick, the ace high.
- **<https://korttipeliopas.fi/tuppi>, the declaration**: _"Pelaajat valitsevat, pelataanko ramia
  vai noloa"_ and _"Näyttäminen jatkuu myötäpäivään ja päättyy heti, kun joku näyttää ramia."_ —
  the declaration is a free clockwise choice beginning with _etukäsi_. **This mode contradicts
  that on purpose**: nobody chooses, and the deal type alternates. The chosen reading belongs in
  `politics.ts`'s own comment, in the rules panel and in the README, all three saying the mode is
  this game's own.
- **<https://korttipeliopas.fi/tuppi>, _ryöstö_**: _"Jos ramannut joukkue häviää ramin, tapahtuu
  ramin ryöstö. Ryöstetty rami on arvoltaan kaksinkertainen…"_ — unreachable here, because there
  is no declaring pair to lose a rami it declared. `dealPoints` already answers a null `ramTeam`
  with "not a robbery", so the source's rule is not contradicted so much as left with nothing to
  apply to.
- **<https://korttipeliopas.fi/tuppi>, sooli**: the soloist plays alone against the declaring team
  after a one-card exchange. Also unreachable: sooli is offered to a defender against a _declared_
  rami. Both match modes' both-defenders offer (`2026-09-09-both-defenders-sooli`) is untouched
  and simply never fires here.
- **<https://korttipeliopas.fi/tuppi>, the point table this mode banks**, quoted already in
  `src/game/points.ts` and unchanged by this spec: nolo — _"Kuudella kasalla joukkue saa neljä
  pistettä ja jokainen kasa vähemmän lisää pisteitä neljällä."_; rami — _"Seitsemästä kasasta saa
  neljä pistettä, sen jälkeen jokainen ylimääräinen kasa on neljän pisteen arvoinen."_
- **The Sofia card has no source at all.** Neither the club sheet nor korttipeliopas.fi gives any
  card an effect — in tuppi the ♥Q is an ordinary queen that follows suit, beats a jack and loses
  to a king. She is this game's own invention, exactly as Tuppi-Rummikub's laydown, Nami's point
  tables and Rock-Paper-Scissors' two clubs are, and `rules.ts`, the rules panel and the README
  must each say so where a reader would otherwise take her for tuppi.
