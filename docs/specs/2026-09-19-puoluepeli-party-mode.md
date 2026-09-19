---
id: 2026-09-19-puoluepeli-party-mode
title: Add Puoluepeli, a ninth alternate rule set — a government of three to five of the existing parties holds for four deals, government cards are collected in the rami deals and opposition cards are penalised in the nolo deals
kind: rule
status: proposed
source: GitHub issue #63 (the team's own chat, quoted verbatim in Finnish below, and unfinished — it ends "ööö..."). This is a **custom mode**, like Tuppi-Rummikub, Nami and Politiikka: the government, the four-deal term, the forced rami/nolo rotation and the party-card point scale are this game's own inventions and are not claimed to be tuppi. What the mode does _not_ change is cited and unchanged — the trick play (four players in two partnerships, thirteen cards each, no trump, _maantuntopakko_, the highest card of the led suit taking the trick, ace high) comes from the Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi>. Where this mode departs from those sources, the departure is stated under **Source** below and belongs in a code comment.
---

# Add Puoluepeli, a party-politics match mode: a government of three to five parties, four deals to a term, government cards collected and opposition cards penalised

## What

Single player gains an eighth row: **Puoluepeli**, a party-politics match mode. At the start of the
match three to five of the game's **thirteen existing parties** are drawn into a **government**,
and that government holds for **four deals — the four-year term** — after which a fresh one is
drawn and play continues. Nobody declares anything: as in Politiikka, the deal type is a fixed
rotation, so a term is a **hallituspeli** (rami), an **oppositiopeli** (nolo), a hallituspeli and
an oppositiopeli.

What a deal is worth is the **parties of the cards a pair captured**, not the count of its tricks.
In a hallituspeli every captured card of a **government** party pays; in an oppositiopeli every
captured card of an **opposition** party costs. Both pairs bank cumulatively — totals can go
negative — and the first pair to a measured target takes the match, exactly the shape the race,
Traditional Tuppi, Nami and Politiikka already have. Nothing of the roguelike shell comes with it:
no ante, no blind, no money, no shop, no jokers, no vouchers, no tuppipakka and no temput.

The party emblem already printed in every card's bottom-left corner is what the player reads to
play this mode, and the four suit colours are untouched — a government card is marked by its
**emblem**, never by a repainted suit.

## Prior specs and documents

- **Extends `2026-09-07-race-to-target-mode`, `2026-09-08-traditional-tuppi-multiplayer-mode`,
  `2026-09-16-nami-game-mode` and `2026-09-19-politics-challenge-variant` (all delivered, the last
  merged as commit `20468ef`), and contradicts none of them.** Puoluepeli is a seventh `MatchId` of
  the shape those four built: it reuses `raceDeal`, `raceBase`, `raceScores`, `target`, the
  `raceover` screen, `matchOver`, `raceWinner` and `matchModeOf`, so `GameState` gains **no field**
  and `SAVE_VERSION` stays `3`. The race's 12,000, Traditional Tuppi's 52 and its reset, Nami's two
  tables and targets and Politiikka's 100 are untouched — criteria pin them.
- **Shares Politiikka's rotation rather than respelling it.** `politicsMode(dealNo)` in
  `src/game/politics.ts` already answers "odd deal rami, even deal nolo", which is exactly the
  issue's _"joka toinen kierros on rami ja joka toinen nolo"_. This spec **imports it**; it does
  not copy it, and it does not move it. Its comment is widened to say two modes now read it.
- **Does not inherit Traditional Tuppi's reset rule (`2026-09-09-traditional-tuppi-score-reset`,
  delivered), and that is the same trap Politiikka named.** The reset lives inside `endHand`'s
  `race || tuppi || tupatro` branch, written as `d.challenge !== "race"`, so putting this mode in
  that branch would silently hand it a reset it was never asked for. It banks in the **Nami arm**,
  cumulatively, and a criterion pins that.
- **Overlaps `2026-09-03-party-emblems-and-support` (delivered) and is the first thing to give the
  parties a rule.** That spec built `PARTIES` (thirteen), `partyMap` (rolled per run from the seed,
  one permutation per suit, so a party is exactly four cards, one per suit), `partyOf(g, card)` and
  the localised emblems. All four are reused unchanged. **`g.support` is deliberately not the
  scoring source** — see the assumption that argues it down; that spec's "support is a counter and
  nothing else" stands, unreversed.
- **Overlaps `2026-09-16-four-suit-colors` and `2026-09-19-traditionally-coloured-match-cards`
  (both delivered) and takes nothing from either.** The four suit tokens (`--suit-s` #20302A,
  `--suit-h` #C0392B, `--suit-d` #17569C, `--suit-c` #15683B) are unchanged, and `PlayingCard`'s
  `trad` two-colour test stays exactly `g.challenge === "tuppi" || g.challenge === "race"` — a
  criterion pins that it is **not** widened to this mode, or Puoluepeli's cards would lose two of
  the four colours the requirement asks it to use.
- **Overlaps `2026-09-19-politics-challenge-variant` in the Sofia card and takes none of it.** The
  ♥Q is an ordinary queen here, and the ♣K's Ikiliikkuja draw stays Multiplayer Tupatro's alone.
  Criteria pin both.
- **Overlaps `2026-09-14-per-challenge-continue` and
  `2026-09-14-single-player-separate-from-multiplayer` (both delivered) and needs nothing from
  either.** The mode gets its saved slot free through `challengeRunKey(id)`, is reached exactly
  like the other solo modes (`SinglePlayer.tsx`'s row from `SOLO_MODES`, `startChallenge` with no
  `seats`, the `single.replaceAsk` confirmation, the Single player door's hang-up question), and
  `rehydrate` already accepts an id present in `CHALLENGES`.
- **Overlaps `2026-09-08-webrtc-transport` (delivered) and takes nothing from it.** No new action,
  no `SCOPE` entry, no `hashState` field, no `parseMsg` clause, no `guestMay` clause;
  `NET_VERSION` stays **11**. The lobby does not offer Puoluepeli.
- **Nothing here is already delivered.** `ChallengeId` has eight members today and `MatchId` six;
  no mode reads a card's **party** for anything but the emblem and the run-long support counter,
  and nothing anywhere draws a government.

## The idea, quoted

From GitHub issue #63, the team chat, in Finnish so nothing is lost in translation. The issue is
raw and unfinished — it ends `ööö...`:

> - Pelin alussa valitaan satunnaisesti 3-5 puoluetta hallitukseen
> - Peliä pelataan neljä kierrosta (hallitus on voimassa neljä vuotta)
> - Joka toinen kierros on rami ja joka toinen nolo
> - Korteissa on 4 värisiä kortteja; musta, sininen, punainen ja oranssi
> - Rami kierroksilla pelaaja yrittää kerätä mahdollisimman paljon hallituspuolueiden kortteja.
> - Nolo kierroksilla oppositio korteista saa minus pisteitä

The repository owner has settled the two questions it leaves open, and they are requirements:

1. **A party is one of the thirteen existing `PARTIES`, not a suit.** The government is a random
   3–5 of them and a card's party is the seeded `partyMap` `partyOf(g, card)` already reads. The
   issue's "musta, sininen, punainen, oranssi" is its own loose description of the four colours the
   game has had since `2026-09-16-four-suit-colors` — black, red, blue and green. **No suit is
   repainted and no orange is added.**
2. **The match repeats the term.** Four deals, then a fresh government, on to a **measured point
   target** the way Politiikka, the race and Nami each have one. Both the four-year joke and the
   match-mode shape are kept.

## Acceptance criteria

- [ ] **One id, and the target is data.** `MatchId` in `src/game/types.ts` is
      `"race" | "tuppi" | "tupatro" | "nami" | "namihard" | "politiikka" | "puoluepeli"`;
      `CHALLENGES` in `content.ts` gains one row — id `"puoluepeli"`, key `"challenge.puoluepeli"`,
      `deals:0`, `target:PUOLUEPELI_TARGET` — whose glyph is checked against tofu the way
      `CLAUDE.md` asks (draw it to a canvas and compare pixels against U+E000; fall back to a
      letter if it fails). `matchModeOf` in `race.ts` gains the case — the switch will not compile
      until it does — and `startChallenge` reads `row.target` and gains no id test.
- [ ] **`src/game/puolue.ts` is the mode's own rule and nothing else**, and it is added to
      `PURE_CORE` in `invariants.test.ts` and to `CLAUDE.md`'s module table. It exports
      `termOf(dealNo): number` (`Math.ceil(dealNo / PUOLUE_TERM)`, so deals 1–4 are term 1),
      `governmentFor(seed, term): string[]` and `puolueValue(gov, mode, party) : number` /
      `puolueTrick(gov, mode, parties): number`. It takes **party ids, not cards and not
      `GameState`** — the caller does the `partyOf` lookup — so it reads no wallet, no boss, no
      `base`, exactly the shape `points.ts`, `nami.ts`, `rps.ts` and `politics.ts` have. It
      **imports `politicsMode` from `politics.ts` and defines no rotation of its own**, and
      `politics.ts`'s comment is widened to say two modes read it.
- [ ] **The government is derived from the seed and is on no state field.** `governmentFor` draws
      from `makeRng(seedHash(seed + ":gov:" + term))` — the same trick `rollParties` uses to leave
      `g.rngState` exactly where it found it — and returns between `GOV_MIN` (3) and `GOV_MAX` (5)
      **distinct** party ids, all of them in `PARTY_IDS`, in `PARTY_IDS` order so the plate never
      reorders itself. `src/game/puolue.test.ts` pins: the same seed and term give the same list;
      over the first 50 terms of a fixed seed at least two distinct governments and at least two
      distinct sizes appear; every returned id is a real party; and a whole Puoluepeli deal draws
      the same `rngState` as it would with the government drawn for a different term. **No field
      is added to `GameState`, so `SAVE_VERSION` stays `3`** and a resumed match keeps its
      government because `seed` and `raceDeal` are both already saved.
- [ ] **A Puoluepeli deal declares nothing and rotates like Politiikka's.** `startDeal` gains an
      arm of its own, spelled by id: it increments `raceDeal`, sets
      `d.mode = politicsMode(d.raceDeal)`, leaves `ramSeat` and `ramTeam` null, leads from the
      elder hand (`(dealer + 1) % 4`), resets `raceBase`, fires `toast.newGov` when the term rolls
      over (`(d.raceDeal - 1) % PUOLUE_TERM === 0`, deal 1 included) and goes straight to
      `beginPlay` — no `runDeclarations`, no swap phase, no temppu draw. A `reducer.test.ts` case
      drives **five** consecutive whole deals and asserts the modes are rami, nolo, rami, nolo,
      rami; that `governmentFor` answers the same list for deals 1–4 and a redrawn one for deal 5;
      that the phase never reaches `declare`, `soolioffer`, `sooligive`, `sooliready` or
      `laydown`; that `sooli` and `sooliBust` stay false and `shows` stays all null; and that
      thirteen four-card tricks are played in each.
- [ ] **A trick is worth the parties of its cards, and nothing else is scored.** `resolveTrick`
      gains an arm beside Nami's: `d.raceBase[teamOf(w.p)] += puolueTrick(gov, d.mode, cards.map((c) => partyOf(d, c)))`
      with `gov = governmentFor(d.seed, termOf(d.raceDeal))`, then `d.phase = "trickend"`. No
      `scoreTrick`, nothing into `base`, no tuppi multiplier, no money, `d.pop` stays null — there
      is no per-trick number in this scale for a score pop to carry. Party support is still tallied
      above the id branches, as every mode's is. **The scoring order in `scoreTrick` is untouched**
      and the mode never calls it. In a hallituspeli a government card is worth `+GOV_POINT` and an
      opposition card `0`; in an oppositiopeli an opposition card is worth `-OPP_POINT` and a
      government card `0`; a card the run's map does not know is worth `0` (`partyOf` has no
      fallback by design). `puolue.test.ts` pins all five cases.
- [ ] **The match provably ends, and the weights are what make it.** Every one of the 52 cards is
      captured exactly once a deal (thirteen tricks × four cards, and there is no sooli here), so
      with a government of `k` parties — `4k` cards, one per suit per party — the two pairs' deal
      values sum to exactly `4k·GOV_POINT` in a hallituspeli and `-(52-4k)·OPP_POINT` in an
      oppositiopeli, and a whole term (two of each) to `8k·GOV_POINT - 2(52-4k)·OPP_POINT`. That is
      strictly positive for every legal `k` **iff `3·GOV_POINT > 10·OPP_POINT`** (the worst case is
      `k = 3`), and the constants that ship must satisfy it. `puolue.test.ts` asserts both sums
      over the real deck for `k = 3, 4, 5` and the term's strict positivity, which is this mode's
      termination proof: the two totals' sum rises every term without bound and the leader is
      always at least half of it. **The naive reading of the issue — +1 a government card and −1 an
      opposition card — fails this test** (a `k = 3` term sums to −8) and must not ship; the
      failure is written into `puolue.ts`'s own comment.
- [ ] **Both pairs bank cumulatively, with no reset.** `endHand` folds the id into the **Nami arm**
      (`raceScores[t] += raceBase[t]`, `handScore = raceBase[ownerTeam(d)]`, `dealsLeft` and
      `blindScore` untouched), with the comment widened to say why: the lost-lead reset is tuppi's
      rule for a _declared_ game, and nobody declares here. A `reducer.test.ts` case plays a deal
      the leading pair loses and asserts both totals kept their points, and a second asserts the
      `d.challenge !== "race"` reset clause was not widened. `showHandResult`'s match id list gains
      the id, so it opens `raceover` when `matchOver` and `raceWinner` agree and `dealend`
      otherwise — never neither, which is the `handend` tick loop `schedule.ts` warns about — and
      sets `runScore` to the owner pair's total. A **negative** running total renders in both
      locales through `fmt()` on `MatchPlate`, `MatchDealEnd` and `RaceOver`, pinned by a render
      case.
- [ ] **The target and the two weights are measured, not guessed.** `src/test/bot.ts`'s `playRace`
      accepts the id (its `dealOf` branch answers `g.raceBase` for it, the existing default, so no
      call site or README recipe moves); at least **200 seeded matches** are played headlessly for
      each of at least **three** `(GOV_POINT, OPP_POINT)` candidate pairs satisfying the
      inequality above, every match finishing. Because `raceScores` never resets here, one
      simulation per seed answers every target candidate at once — the trajectory technique
      `POLITIIKKA_TARGET`'s comment already names. Median, mean, 90th percentile and maximum deal
      counts for the shipped pair go in `README.md` beside the race's, Traditional Tuppi's, Nami's
      and Politiikka's. What ships is the round target whose **median lands between 8 and 20 deals
      (two to five terms) with the 90th percentile at 36 or fewer (nine terms)**; if no round
      number does, the closest ships and the miss is written into the README rather than the band
      being quietly widened. `PUOLUE_TERM`, `GOV_MIN`, `GOV_MAX`, `GOV_POINT`, `OPP_POINT` and
      `PUOLUEPELI_TARGET` all live in `constants.ts`, each with its source or its measurement in
      the comment beside it.
- [ ] **The player can see the government while playing, and the four suit colours are untouched.**
      A new rail plate `src/components/rail/GovBox.tsx` lists the term's parties by localised
      emblem and name (`emblemOf`/`nameOf` over the `PARTIES` rows), with the term number and the
      deals left in it; `Rail.tsx` draws a three-page strip for `"puoluepeli"` — `rp-challenge`,
      `rp-gov`, `rp-game` — the same shape Multiplayer Tupatro's `rp-kit` already has, and every
      other challenge keeps its two. `PlayingCard` marks a **government party's emblem** with a
      class of its own in this mode only (one hand-formatted `src/index.css` rule, no new glyph and
      no image asset) and draws nothing extra for it in any other mode. **`trad` stays exactly
      `g.challenge === "tuppi" || g.challenge === "race"`**, `.card.s-S/H/D/C` and the four suit
      tokens are byte-identical, and no orange is added anywhere — pinned by a render case and by
      the existing `invariants.test.ts` CSS check.
- [ ] **Nothing on the felt claims a declaration happened.** `ModeBox` gains a Puoluepeli arm ahead
      of the ordinary declaration reading, reusing `table.politicsGov` / `table.politicsOpp` for
      the deal's own label and adding `table.puolueNote` for the note; it **never** calls
      `seatName(ramSeat ?? 0, …)`, which would name a declarer who does not exist. `DealEnd` routes
      the id to `<MatchDealEnd deal={raceBaseOf} />` while its `reset` boolean stays keyed to
      `"tuppi" | "tupatro"` alone. `MatchPlate`'s running deal line reads `g.raceBase[team]` for
      this mode (Nami's existing arm); `RaceOver`, `Rail`'s page choice and `GameContext`'s board
      write reach the mode through `matchModeOf` and need no id test of their own. `Hint` is **not**
      changed — `g.mode` is a real rami or nolo — and a `render.test.tsx` case pins that a
      Puoluepeli `play` phase draws exactly the existing four hint lines.
- [ ] **The bots play the mode, and they get one clause.** `chooseAI`'s `AiState` `Pick` widens to
      carry `"partyMap" | "seed" | "raceDeal"`, and an id-gated branch computes `wantsTricks` the
      way Nami's does: the value of the cards already on the table, under this deal's government
      and mode, is positive — false on a lead, which reuses the existing dodge-and-lead-low branch.
      It consumes **no randomness**, so a Puoluepeli deal replays identically from its seed, and
      being gated on the id it moves neither `seats.test.ts`'s pinned literals nor the 50-seed
      aggregate. `ai.ts` needs no declaration branch, because the mode never reaches `declare` or
      `soolioffer`.
- [ ] **Its own board, its own saved slot, its own text, and nothing else moves.** `MATCH_KEY` in
      `storage.ts` stays a `Record<MatchId, string>` and gains `tupatro-puoluepeli-v1`; the run
      slot comes free through `challengeRunKey("puoluepeli")`; a test asserts a finished match
      files on its own key and that the six other match and challenge boards are untouched. Both
      catalogues carry `challenge.puoluepeli.n` / `.t`, `table.puolueNote`, `toast.newGov`, the
      GovBox's labels and a `rules.puoluepeliTitle` + `rules.puoluepeli` section in `Rules.tsx`
      stating the government, the four-deal term, the rotation, the absence of declaration, sooli
      and _ryöstö_, both per-card values, the target, and — in the shape the Politiikka and
      Ikiliikkuja lines already use — that **neither source knows any of it**. Placeholder sets
      match both ways, every number goes through `fmt()`, emphasis renders through `<Rich>`;
      `render.test.tsx` sweeps a Puoluepeli rail, felt + hand, deal end and result screen in both
      languages, and its spelled-out solo id lists (~lines 1282 and 1698) grow to eight.
      `NET_VERSION` stays **11** and `src/net/protocol.ts` is byte-identical; `LOBBY_MODES` stays
      `["tupatro", "race", "tuppi"]`; `SOLO_MODES` keeps filtering `"tupatro"` alone, so the row
      appears in single player for free; no new `Phase`, no new `Action`, no new `GameState` field,
      no new `setTimeout`, no new `Math.random`. Tests pin that a Politiikka, Traditional Tuppi,
      race, Nami, Tupatro and main-game deal each score exactly what they scored before, that the
      ♥Q and the ♣K do nothing special in a Puoluepeli deal, and that `seats.test.ts`'s golden
      literals and 50-seed aggregate are unchanged.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **The issue's own point scale does not terminate, and this spec corrects it rather than shipping
  it.** Read literally — a government card worth +1 and an opposition card worth −1 — a term of two
  hallituspelit and two oppositiopelit sums to `8k − 2(52 − 4k)`, which is **−8 for a government of
  three**: the two pairs' totals drift downwards and a match against a positive target can never
  end. The weights are therefore separate constants constrained by `3·GOV_POINT > 10·OPP_POINT`
  (worst case `k = 3`), which makes every term strictly positive and the match provably finite.
  `(GOV_POINT, OPP_POINT) = (4, 1)` is the obvious first candidate and is a **starting point to
  measure away from, not a value to ship unmeasured**. If the reviewer would rather have the raw
  ±1 and a fixed match length instead of a target, that is a different mode from the one the owner
  settled in decision 2 and is a spec of its own.
- **In a hallituspeli only government cards score and in an oppositiopeli only opposition cards
  do.** The issue names one side per deal type and is silent about the other, and this is the
  literal reading: an opposition card in a government deal and a government card in an opposition
  deal are both worth zero. The consequence is worth seeing before it is reviewed — an
  oppositiopeli's best possible deal for a pair is **0**, never a gain, so a pair climbs only in
  the government deals and defends in the opposition ones.
- **`g.support` is not the scoring source, and the premise that it could be is half wrong.** It is
  tallied only for the **run owner's own team** (`if (teamOf(w.p) === ownTeam)` in `resolveTrick`),
  it is never reset between deals, and it is per run — so it cannot answer "what did each pair
  capture in this deal", which is the only question this mode asks. It is also not true that
  nothing reads it: `components/rail/SupportBox.tsx` draws all thirteen rows on the main-game
  rail's fourth page. What is true is the narrower claim its comment makes — nothing reads it back
  into a score — and this spec leaves that true. The tally goes on running in a Puoluepeli deal
  (it sits above the id branches) and nothing draws it, because a match rail has no support page.
  Making `support` per team, or drawing it in a match, is out of scope and named below.
- **The government is derived from the seed, not stored.** `governmentFor(seed, term)` with its own
  hash salt is the same device `rollParties` uses, and it buys: no `GameState` field, no
  `SAVE_VERSION` question, no `hashState` clause, nothing for `rehydrate` to validate, and a
  government that is identical on a resumed run because `seed` and `raceDeal` are both already
  saved. The alternative — a `gov: string[]` field written in `startDeal` — was rejected for the
  cost of all five, not because it would not work.
- **Odd deals are hallituspelit.** That is `politicsMode`'s existing parity, shared rather than
  respelled, so the match opens on a government deal and each term reads government, opposition,
  government, opposition. Nothing in the issue says which comes first; the government is named
  first, there and in Politiikka's own chat.
- **A term is four deals and a match may end in the middle of one.** The four-year joke is kept as
  the government's life, not as the match's length; stopping only at a term boundary would mean a
  pair that reached the target waiting up to three deals to be told, and a result screen that
  reported a total the player had already passed.
- **The declaration is removed outright, and with it sooli and _ryöstö_.** This **contradicts both
  sources**, which make the declaration a free clockwise choice and build _ryöstö_ and sooli on top
  of it. It is deliberate, it is what the issue asks for, and the mode is presented as this game's
  own throughout — rules panel and README both. `points.ts` is not touched at all: this mode does
  not play tuppi's point table.
- **The four suit colours are used as they are, and the issue's colour list is ignored as
  description.** The issue says "musta, sininen, punainen ja oranssi"; the game's four are black,
  red, blue and green, delivered by `2026-09-16-four-suit-colors`. No suit is repainted, no orange
  is added, and `PlayingCard`'s `trad` two-colour test is **not** widened to this mode — doing so
  would silently take two of the four colours away from the mode that asked for them.
- **Parties are the existing thirteen and the split is what makes the arithmetic clean.**
  `partyMap` gives each party exactly four cards, one per suit, so a government of `k` parties is
  exactly `4k` cards and `52 − 4k` are opposition. No party is added, renamed or re-emblemed, and
  none of them is a real organisation.
- **Single player only, and the lobby is untouched.** Widening `MatchId` means `net.match` could in
  principle hold the id, but the picker is built from `LOBBY_MODES` and nothing else writes it, so
  no session can reach a Puoluepeli deal and `NET_VERSION` stays 11 — the same argument Nami and
  Politiikka shipped under. If the implementer finds a route that puts the id on the wire, the
  version bumps and the reason is written down; it is not left to a v11 peer, which would fall back
  to `CHALLENGES[0]` and desync on action one.
- **Names, and the id: "Puoluepeli" in Finnish, "Party Politics" in English, id `"puoluepeli"`.**
  The id is Finnish like `"tuppi"` and `"politiikka"`, and it is saved and filed on a board from
  the day it ships, so it is not renamed later for a label. The deal labels reuse Politiikka's
  existing "Hallituspeli / Oppositiopeli" strings, which say the same thing in both modes; only the
  explanatory note is new.
- **The bots get one clause and no strategy, and the hint line is an approximation.** They learn
  that a trick worth a positive amount is worth taking and nothing else — in an oppositiopeli no
  trick is ever positive, so they duck every one, which is right but not subtle, and they never
  count the cards still out or plan a term ahead. `Hint` keeps saying "win tricks" in a
  hallituspeli and "dodge them" in an oppositiopeli, which is true of the deal type and silent
  about which cards matter; the GovBox is what says that. Every measured figure is a bot measuring
  the bot in the sense `CLAUDE.md` warns about, and the README says so beside the figures.

## Touch points

- `src/game/types.ts` — `MatchId` gains `"puoluepeli"`; `ChallengeId` follows for free.
- `src/game/constants.ts` — `PUOLUE_TERM`, `GOV_MIN`, `GOV_MAX`, `GOV_POINT`, `OPP_POINT`,
  `PUOLUEPELI_TARGET`, each with its source or its measurement in the comment beside it.
- `src/game/content.ts` — one `CHALLENGES` row.
- `src/game/puolue.ts` — **new**: `termOf`, `governmentFor`, `puolueValue`, `puolueTrick`, and the
  comment recording the chosen readings (why the raw ±1 does not terminate, why only one side
  scores per deal type, why the government is derived rather than stored).
- `src/game/politics.ts` — `politicsMode`'s comment widened; the function itself unmoved.
- `src/game/reducer.ts` — `startDeal`'s new arm (with `toast.newGov`), `resolveTrick`'s new arm,
  `endHand`'s Nami arm widened (**never** the `!== "race"` reset branch), `showHandResult`'s match
  id list.
- `src/game/race.ts` — `matchModeOf` gains the case (exhaustive switch: it will not compile until
  it does).
- `src/game/ai.ts` — `AiState`'s `Pick` widens; one id-gated `wantsTricks` clause.
- `src/game/storage.ts` — `MATCH_KEY` gains `tupatro-puoluepeli-v1`.
- `src/components/rail/GovBox.tsx` — **new**; `src/components/rail/Rail.tsx` — the three-page strip.
- `src/components/rail/MatchPlate.tsx` — the running deal line reads `raceBase` for this mode.
- `src/components/table/ModeBox.tsx` — the mode's own label and note, ahead of the declaration
  reading.
- `src/components/screens/DealEnd.tsx` — the id routes to `raceBaseOf`; `reset` stays
  `"tuppi" | "tupatro"`.
- `src/components/PlayingCard.tsx` — the government emblem marker, gated on the mode; `trad`
  untouched.
- `src/index.css` — the marker's and the GovBox's rules (hand-formatted, Prettier-excluded).
- `src/components/screens/Rules.tsx` — the mode's section.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `challenge.puoluepeli.n` / `.t`, `table.puolueNote`,
  `toast.newGov`, the GovBox's labels, `rules.puoluepeliTitle`, `rules.puoluepeli`.
- `src/test/bot.ts` — `playRace` accepts the id.
- `src/game/puolue.test.ts` (**new**), `src/game/reducer.test.ts`, `src/game/scores.test.ts`,
  `src/test/render.test.tsx`, `src/test/invariants.test.ts` (`PURE_CORE`).
- `README.md` — the mode section and the measured figures; `CLAUDE.md` — the module, the id, the
  board key and the reset trap.

## Out of scope

- **Multiplayer.** `LOBBY_MODES`, `SCOPE`, `hashState`, `parseMsg`, `guestMay`, the shared table
  and `NET_VERSION` are untouched, and no session can reach the mode.
- **Any part of the roguelike shell in the mode** — money, shop, jokers, vouchers, tuppipakka, the
  swap phase, blinds, bosses, cash-out — and **temput**: no deal draw, and the ♣K's Ikiliikkuja
  draw stays Multiplayer Tupatro's alone.
- **Changing `g.support`.** Its owner-team-only scope, its run-long life and `SupportBox`'s
  thirteen rows on the main-game rail all stay exactly as they are; no support plate is drawn in a
  match and no party counter is reset per deal.
- **Repainting anything.** The four suit tokens, `.card.s-*`, the `trad` two-colour test and the
  party emblems are untouched, and no orange is added.
- **Changing the parties themselves** — no new party, no renamed party, no re-emblemed party, no
  real organisation named, and no change to how `partyMap` is rolled.
- **Bot strategy beyond the one clause** — no card counting, no sense of the term ahead, no reading
  of which government cards are still out.
- **Politiikka's Sofia card and any interaction with it.** The ♥Q is an ordinary queen in a
  Puoluepeli deal, and Politiikka's own rules, target and board do not move.
- **A weekly rotation of politics variants**, and any clock or "this week's challenge" surface.
  One permanently available mode ships.
- **Ending a match only at a term boundary**, and any per-term result screen, government history or
  election animation.
- **A multi-human Puoluepeli save.** `soloBoard` still gates the run slot, exactly as it does for
  the other match modes.

## Source

- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** and
  **<https://korttipeliopas.fi/tuppi>** — what this mode keeps, unchanged: four players in two
  partnerships sitting across from each other, thirteen cards each, **no trump**, follow suit
  (_maantuntopakko_), the highest card of the led suit taking the trick, the ace high.
- **<https://korttipeliopas.fi/tuppi>, the declaration**: _"Pelaajat valitsevat, pelataanko ramia
  vai noloa"_ and _"Näyttäminen jatkuu myötäpäivään ja päättyy heti, kun joku näyttää ramia."_ —
  the declaration is a free clockwise choice beginning with _etukäsi_. **This mode contradicts that
  on purpose**: nobody chooses, and the deal type alternates, exactly as Politiikka's already does.
  The chosen reading belongs in `puolue.ts`'s comment, in the rules panel and in the README, all
  three saying the mode is this game's own.
- **<https://korttipeliopas.fi/tuppi>, _ryöstö_ and sooli**: both hang off a declared rami, so both
  are unreachable here — there is no declaring pair to lose a rami it declared, and sooli is only
  offered to a defender against one. `2026-09-09-both-defenders-sooli`'s offer is untouched and
  simply never fires. `points.ts` is not touched at all.
- **<https://korttipeliopas.fi/tuppi>, the point table**: _"Kuudella kasalla joukkue saa neljä
  pistettä…"_ / _"Seitsemästä kasasta saa neljä pistettä…"_ — tuppi scores a deal by its **trick
  count**. **This mode contradicts that too**: a deal's worth here is the **parties of the cards
  captured**, and the trick count decides nothing but who holds them. That is the same kind of
  departure Nami's point tables make, and it is stated in the same places.
- **The government, the four-deal term and the two per-card values have no source at all.** They
  are the requirement's own invention, from GitHub issue #63, written into `puolue.ts`'s own
  comment as such — the way Nami's tables, Rock-Paper-Scissors' two clubs and Politiikka's Sofia
  card are. Neither the club sheet nor korttipeliopas.fi gives a card any property beyond its suit
  and rank; the parties themselves are this game's own (`2026-09-03-party-emblems-and-support`) and
  were flavour until now.
