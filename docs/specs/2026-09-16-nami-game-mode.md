---
id: 2026-09-16-nami-game-mode
title: Add Nami, a fourth alternate rule set — ordinary tuppi tricks scored by the point value of the cards each pair captures
kind: rule
status: proposed
source: GitHub issue #7 (the requester's own house rules, quoted verbatim in Finnish below). This is a **custom mode**, like Tuppi-Rummikub: its scoring is not tuppi's and is not claimed to be. The trick play it does not change — four players in two partnerships, thirteen cards each, no trump, _maantuntopakko_, the highest card of the led suit taking the trick with the ace high — is the Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi>, both unchanged by this spec. A web search for published rules under the name "Nami" found none (only unrelated Finnish _tikki_ pages), so the issue is the only source and the game must not present the mode as traditional tuppi.
---

# Add Nami, a fourth alternate rule set — ordinary tuppi tricks scored by the point value of the cards each pair captures

## What

Single player gains a fourth and fifth row beside Tuppi-Rummikub, Tuppi Race and Traditional
Tuppi: **Nami**, in its two rule variants. The deal is ordinary tuppi trick play — thirteen
tricks, no trump, follow suit, ace high — but what a deal is worth is **the point value of the
individual cards the partnership captured in the tricks it won**, not a trick-count multiplier.
There is no declaration, no rami, no nolo, no _ryöstö_ and no sooli: there is nothing for them to
decide, because winning tricks is neither good nor bad in itself — winning the _right cards_ is.

Two point tables, one per variant, both quoted from the issue below: the **easy** one pays the
four court ranks and charges one for every other card, and the **hard** one makes A–9 a penalty
equal to the rank and 10–K a reward equal to the rank. A pair banks every deal's value, positive
or negative, and the first pair to reach the mode's target wins the match, exactly as the race and
the traditional match already end. Every number is computed and drawn by the game: each card shows
what it is worth in a Nami deal, the rail plate shows the deal running and both match totals, and
the deal-end and result screens show both pairs. The player decides which card to play and nothing
else.

## Prior specs and documents

- **Extends `2026-09-07-race-to-target-mode` and `2026-09-08-traditional-tuppi-multiplayer-mode`
  (both delivered), and contradicts neither.** Nami is a fourth and fifth `ChallengeId` of the
  _match_ shape those two built: it reuses `raceDeal`, `raceBase`, `raceScores`, `target`, the
  `raceover` screen, `matchOver` and `raceWinner`, so `GameState` gains no field and
  `SAVE_VERSION` stays `3`. The race's 12,000 and its chips × mult arithmetic, and Traditional
  Tuppi's 52 and its point table, are untouched — criteria pin both.
- **Does not inherit Traditional Tuppi's reset rule** (`2026-09-09-traditional-tuppi-score-reset`,
  delivered). That rule is tuppi's own "only one pair may be up", quoted from the sources for a
  mode that plays tuppi's point table. Nami plays neither, so it banks cumulatively like the race.
  This is a scoping decision, not a reversal: `endHand`'s `"tuppi"` arm is not touched.
- **Overlaps `2026-09-06-tuppi-rummikub-challenge` (delivered) in shape only.** Nami borrows its
  precedent — a challenge that suspends the declaration and scores a deal its own way — and none
  of its code: no laydown, no `laydown.ts`, no `laydown` phase, no `LAYDOWN_TURN_MS`, no
  `tupatro-challenge-rummikub-v1`.
- **Overlaps `2026-09-14-per-challenge-continue` (delivered) and needs nothing from it.** Each
  Nami variant gets a saved slot for free through `challengeRunKey(id)`; `resumable`,
  `readChallengeRun` and the single-player row's Continue already do the work, and `rehydrate`
  already rejects a `challenge` id that is not in `CHALLENGES`.
- **Overlaps `2026-09-14-single-player-separate-from-multiplayer` and
  `2026-09-16-confirm-hang-up-to-play-single` (both delivered).** The mode is reached exactly like
  the other three: `SinglePlayer.tsx`'s `CHALLENGES.map` row, `startChallenge` with no `seats`, the
  `single.replaceAsk` confirmation when a slot would be replaced, and the Single player door's
  existing hang-up question ahead of all of it. No new door and no change to that door.
- **Overlaps `2026-09-08-webrtc-transport` (delivered), and takes nothing from it.** No new action,
  no `SCOPE` entry, no `hashState` field, no `parseMsg` clause, no `guestMay` clause;
  `NET_VERSION` stays **8**. The lobby does not offer Nami, so no session can reach a Nami deal —
  see the assumption, which is the whole of the argument for not bumping.
- Nothing here is already delivered. `src/game/` today has no card-value table of any kind but
  `chipValue` (a chip count, not a signed score) and `pipValue` (the laydown's rank count), and
  `ChallengeId` has three members.

## The two point tables

Quoted verbatim from GitHub issue #7, in Finnish, so nothing is lost in translation:

> **Helpot säännöt:** Pistekortit: A = +4, K = +3, Q = +2, J = +1. Kaikki muut (2–10, myös
> kymppi): −1 kukin. Kun 13 tikkiä on pelattu, laske parisi keräämien korttien pisteet yhteen → se
> on jaon tulos eli tulos = pistekorttien summa − muiden korttien lukumäärä.

> **Vaikeat säännöt:** Miinus (vältä): A = −1, 2 = −2, 3 = −3, … 9 = −9. Plus (kerää): 10 = +10,
> J = +11, Q = +12, K = +13. Parin tulos = keräämiesi korttien arvot yhteen etumerkkeineen.

| rank              | easy | hard |
| ----------------- | ---- | ---- |
| A                 | +4   | −1   |
| K                 | +3   | +13  |
| Q                 | +2   | +12  |
| J                 | +1   | +11  |
| 10                | −1   | +10  |
| 9                 | −1   | −9   |
| 8                 | −1   | −8   |
| 7                 | −1   | −7   |
| 6                 | −1   | −6   |
| 5                 | −1   | −5   |
| 4                 | −1   | −4   |
| 3                 | −1   | −3   |
| 2                 | −1   | −2   |
| **the full deck** | +4   | +4   |

**Both tables sum to exactly +4 over the whole deck**, which is not decoration — it is the mode's
termination proof and the reason a target can be used at all. Easy: `4 × (4 + 3 + 2 + 1) = 40` and
`36 × (−1) = −36`. Hard, per suit: `−(1 + 2 + … + 9) = −45` and `10 + 11 + 12 + 13 = +46`, so `+1`
a suit. All fifty-two cards are captured in the thirteen tricks of every Nami deal — there is no
sooli to take a hand out of play and no trick of three — so after `n` deals the two pairs' totals
sum to exactly `4n`, the larger of them is therefore at least `2n`, and a target `T` is reached by
deal `⌈T / 2⌉` at the latest. A Nami match cannot fail to end, whatever the cards and whatever the
bots do.

A pair's total may be negative and may fall as well as rise. Nothing in `matchOver` or
`raceWinner` minds: both read `max(raceScores) >= target`.

**The value table and the rank order are two different questions.** The ace is worth +4 in easy
and **−1** in hard, and in both it is still the highest card and still takes the trick. That is
the whole point of the hard variant, and the rules panel says so.

## Acceptance criteria

- [ ] **Two ids, and the target is data.** `MatchId` in `src/game/types.ts` is
      `"race" | "tuppi" | "nami" | "namihard"`; `CHALLENGES` in `content.ts` gains two rows
      (`{id:"nami", key:"challenge.nami", g:…, deals:0, target:NAMI_TARGET}` and the hard twin) with
      glyphs already proven against tofu in this project; `NAMI_TARGET` and `NAMI_HARD_TARGET` live
      in `constants.ts` with their measurement in the comment. `startChallenge` reads `row.target`
      and gains no id test.
- [ ] **`src/game/nami.ts` is the value table and nothing else.** It exports `NamiVariant`
      (`"easy" | "hard"`), `namiValue(v, card)`, `namiTrick(v, cards)` and
      `NAMI_VARIANT: Record<"nami" | "namihard", NamiVariant>`. It reads a card's **rank alone** —
      no wallet, no boss, no `base`, no `GameState` — for the same reason `pipValue` does, and says
      in a comment why `chipValue` and `pipValue` are three different questions that must not be
      aliased. It is added to `PURE_CORE` in `invariants.test.ts` and to `CLAUDE.md`'s module table.
- [ ] **`src/game/nami.test.ts` pins both tables and the termination proof.** Every rank 2–14 in
      both variants against the quoted numbers; the whole 52-card deck summing to `+40 / −36`
      (easy) and `+184 / −180` (hard); and, for a deck split arbitrarily between two pairs, the two
      totals summing to exactly **4** in both variants — the identity the match's termination rests
      on.
- [ ] **A Nami deal is forced plain play.** `startDeal`'s Nami arm sets `mode` to `"rami"` (the
      engine's wants-tricks flag, with a comment saying it means nothing else here), leaves
      `ramSeat` and `ramTeam` null, leads from the elder hand, resets `raceBase`, increments
      `raceDeal` and goes straight to `beginPlay` — no `runDeclarations`, no swap. A
      `reducer.test.ts` case drives a whole Nami deal and asserts the phase never reaches
      `declare`, `soolioffer`, `sooligive`, `sooliready` or `laydown`, that `sooli` and `sooliBust`
      stay false and `shows` stays empty, and that thirteen tricks are played.
- [ ] **A trick is scored by the cards it captures, into `raceBase`.** `resolveTrick`'s Nami arm
      calls no `scoreTrick`, leaves `d.pop` null and `base`/`scored` untouched, still tallies party
      support above the id branches, and adds `namiTrick(variant, cards)` to
      `raceBase[teamOf(winner)]`. `endHand` banks both pairs' `raceBase` cumulatively into
      `raceScores`, sets `handScore` to the run owner's pair's, touches neither `dealsLeft` nor
      `blindScore`, and **does not** apply Traditional Tuppi's reset. A `reducer.test.ts` case
      plays a whole deal and asserts the two banked numbers sum to exactly `4` and equal an
      independent count over the captured cards.
- [ ] **The match ends the way a race does.** `showHandResult` opens `raceover` when `matchOver`
      and `raceWinner` agree and `dealend` otherwise, never neither — the `handend` tick loop
      `schedule.ts` warns about — and sets `runScore` to the owner pair's total. A headless match
      through `drive.ts`'s `advance` settles, and a test asserts a match started at a target of
      `T` is over by deal `⌈T / 2⌉` at the latest.
- [ ] **Both targets are measured, not guessed.** `src/test/bot.ts`'s `playRace` takes the two new
      mode ids (its `dealOf` becomes a per-mode branch, and `"race"` stays the default so no
      existing call site or README recipe moves); at least **200 seeded matches per variant** are
      played headlessly, every one of them finishing; the median, mean, 90th percentile and maximum
      deal counts go in `README.md` beside the race's and the traditional match's. The target
      chosen is the round number whose median lands between **8 and 20 deals** with the 90th
      percentile at **35 or fewer**; if no round number does, the closest one ships and the miss is
      written into the README rather than the band being quietly widened. `40` (easy) and `180`
      (hard) are starting points to measure away, not values to ship unmeasured.
- [ ] **No unknown match id is silently a race.** The `g.challenge === "tuppi" ? "tuppi" : "race"`
      ternary is gone from `MatchPlate.tsx`, `RaceOver.tsx` and `GameContext.tsx`, replaced by one
      exhaustive helper that answers `MatchId | null`; `MATCH_KEY` in `storage.ts` stays a
      `Record<MatchId, string>` and gains `tupatro-nami-v1` and `tupatro-namihard-v1`. A test
      asserts a finished Nami match files its row on its own key and that `tupatro-race-v1`,
      `tupatro-tuppi-v1` and `tupatro-challenge-rummikub-v1` are untouched by it.
- [ ] **The game does every sum; the player does none.** In a Nami deal `PlayingCard` prints the
      card's **signed Nami value** in the corner instead of its chip value (every other mode keeps
      chips); `MatchPlate` draws the deal running for the viewing pair — `raceBase[team]` — beside
      both match totals against the target and the trick count; `MatchDealEnd` and `RaceOver` show
      both pairs' deal values and both totals. Every number goes through `fmt()`, negatives
      included.
- [ ] **Nothing on the felt claims a declaration happened.** `ModeBox` in a Nami deal draws the
      mode's own label and note instead of `RAMI` and a declarer's name, and `Hint`'s play line is
      Nami's own — never `hint.followWin` / `hint.lead`, which tell the player to win a trick the
      mode may not want. `Rail.tsx` gives a Nami run the `MatchPlate`, not the `ChallengePlate`,
      and its page list stays correct for _any_ challenge rather than being narrowed to ids.
- [ ] **The bots play the mode, not rami.** `chooseAI` gains a Nami branch that computes
      "does this side want this trick" **per trick** — the value of the cards already in the trick
      under the deal's variant, and false when leading — and then reuses the existing win/duck
      machinery unchanged. It consumes **no randomness**, so a Nami deal is reproducible from its
      seed, and it is gated on the challenge id, so `seats.test.ts`'s pinned literals and the
      50-seed aggregate do not move.
- [ ] **Text, docs and the versions that do not change.** Both catalogues carry
      `challenge.nami.n` / `.t` and `challenge.namihard.n` / `.t`, a `rules.nami*` section stating
      both tables, the absence of the declaration and sooli, the target and that the ace still wins
      while it costs a point in the hard variant, and the ModeBox and Hint strings — matching
      placeholder sets both ways. `render.test.tsx` sweeps a Nami rail, felt + hand, deal end and
      result screen in both languages; `README.md` gains a mode section and its measured figures,
      and `CLAUDE.md` the module, the ids and the boards. `SAVE_VERSION` stays `3` with no
      `GameState` field added, `NET_VERSION` stays `8` with `src/net/protocol.ts` byte-identical,
      and `LOBBY_MODES` in `Lobby.tsx` stays `["race", "tuppi"]`.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **Both variants ship, as two challenge ids** (`"nami"` easy, `"namihard"` hard), not one mode
  with a switch. The variant _is_ the id, which is already on `GameState`, already saved and
  already hashed, so this costs no new state field, no `SAVE_VERSION` bump and no `hashState`
  change — a variant flag of its own would have cost all three. The price is two rows in the
  single-player list, two boards, two saved slots and two measured targets.
- **The declaration, sooli and _ryöstö_ are disabled.** Every one of them is a bet about the
  _count_ of tricks, and Nami scores the _contents_ of tricks; a rami "won" with seven tricks of
  rubbish is a loss here. This is the Tuppi-Rummikub precedent — a custom mode that suspends
  tuppi's usual scoring outright — and it is also what keeps every deal at thirteen four-card
  tricks, which is what the termination proof above needs. A Nami with a declaration is a different
  mode and is out of scope.
- **`d.mode` is set to `"rami"` in a Nami deal and means only "the engine's wants-tricks flag".**
  Nothing in Nami scores by trick count. It is set rather than left `null` so that every
  mode-reading path has a defined value, exactly as Tuppi-Rummikub does — and because it is a lie
  on the felt, `ModeBox` and `Hint` are required above to say something true instead.
- **The match shape is the race's: both pairs bank every deal, cumulatively, and the first to a
  positive target wins.** A fixed number of deals with the highest total winning was considered and
  rejected: the `raceover` screen carries `winner: 0 | 1`, so a draw would need a new state or a
  tie-break invented on the spot, and a run of deals with no way to be ahead reads worse than a
  race. Negative totals are allowed and drawn as they are.
- **Termination is proved rather than hoped for**, by the `sum = 4n` identity above. That is the
  answer to "what does a target mean on a scale that spans negative territory": the _leader's_
  total cannot stay below `2n`, whatever either pair does.
- **The targets are measured, and the numbers in this spec are not them.** 40 and 180 are the
  scale-derived starting points for the measurement, nothing more. If the measurement puts a
  variant outside the band, the README records it and the nearest round number ships — the band is
  not widened silently and a target is not chosen by feel.
- **The ace is high for trick-taking in both variants**, while being worth +4 in easy and −1 in
  hard. The issue gives values, not a rank order, and the mode is described as ordinary tuppi trick
  play, where the ace is highest. The sooli rule that makes the ace lowest does not apply, because
  there is no sooli.
- **Single player only.** The lobby is not touched and `LOBBY_MODES` stays `["race", "tuppi"]`.
  Widening `MatchId` means `net.match` could in principle hold a Nami id, but the picker is built
  from `LOBBY_MODES` and nothing else writes it.
- **`NET_VERSION` stays 8 because no session can reach a Nami deal.** `startChallenge` is a `flow`
  action, so a window holding a chair could in principle broadcast one — but the only Nami dispatch
  sites are the single-player screen (whose door hangs the session up first) and a Nami result
  screen's Play again (which exists only inside a Nami match). If the implementer finds a route
  that puts a Nami id on the wire, the version bumps and the reason is written down; it is not left
  to a v8 peer, which would fall back to `CHALLENGES[0]` and desync on action one.
- **The bots are heuristics, deliberately.** The per-trick rule above ignores the cards not yet
  played, its own hand's shape and the hard variant's 10-is-a-prize trap. It is better than playing
  rami in a mode with no rami, and it is what every measured figure measures — a bot measures the
  bot. Tuning it is a balance spec of its own.
- **The corner number on a card becomes the Nami value in a Nami deal.** `PlayingCard` is drawn by
  every mode, so this is gated on the id; Traditional Tuppi keeps printing chips that mean nothing
  there, which is a pre-existing wart this spec does not fix.
- **Names: "Nami (helpot säännöt)" / "Nami (vaikeat säännöt)", and "Nami (easy rules)" /
  "Nami (hard rules)".** No published card game called Nami was found, so the rules panel presents
  the mode as this game's own — beside Tuppi-Rummikub, not beside tuppi — and the README says the
  scoring is the requester's house rules and not tuppi's.

## Touch points

- `src/game/types.ts` — `MatchId`, and the `raceDeal` / `raceBase` / `raceScores` comments that
  today say "Inert unless `challenge` is a MatchId — `race` or `tuppi`"
- `src/game/constants.ts` — `NAMI_TARGET` and `NAMI_HARD_TARGET`, with the measurement in the
  comment the way `RACE_TARGET` carries its own
- `src/game/content.ts` — the two new `CHALLENGES` rows
- `src/game/nami.ts` — **new**: `NamiVariant`, `namiValue`, `namiTrick`, `NAMI_VARIANT`
- `src/game/nami.test.ts` — **new**: both tables, the deck sums, the `sum = 4` identity
- `src/game/reducer.ts` — `startDeal`, `resolveTrick`, `endTrick`, `endHand`, `showHandResult`
- `src/game/reducer.test.ts` — a whole Nami deal, both variants, the banked pair of numbers
- `src/game/ai.ts` — `chooseAI`'s per-trick Nami branch (and `AiState`'s `Pick`)
- `src/game/storage.ts` — `MATCH_KEY`'s two new entries
- `src/game/scores.ts` / `src/game/scores.test.ts` — `raceRowFor` reused; the boards stay apart
- `src/hooks/GameContext.tsx` — which board a `raceover` writes, without the `"race"` fallback
- `src/components/rail/MatchPlate.tsx`, `src/components/rail/Rail.tsx` — the plate and the page list
- `src/components/screens/DealEnd.tsx`, `src/components/screens/RaceOver.tsx` — the deal's value
  per pair, the mode's name, the replay ids
- `src/components/table/ModeBox.tsx`, `src/components/hand/Hint.tsx` — no declaration to report
- `src/components/PlayingCard.tsx` — the corner number in a Nami deal
- `src/components/screens/Rules.tsx` — the mode's own section
- `src/i18n/fi.ts`, `src/i18n/en.ts` — the rows, the rules list, the plate, ModeBox and Hint strings
- `src/test/bot.ts` — `playRace`'s mode branch, for the two measurements
- `src/test/render.test.tsx`, `src/test/invariants.test.ts` — the sweep and `PURE_CORE`
- `README.md`, `CLAUDE.md` — the mode, its tables, its boards and its measured figures

## Out of scope

- Any change to the main game's, the race's or Traditional Tuppi's arithmetic: `scoreTrick`,
  `finalScore`, `tuppiInfo`, `tuppiMult`, `dealScores`, `dealPoints` and the `"tuppi"` reset all
  stay exactly as they are.
- Nami in the lobby, over the wire, or on a shared table; any new `NetMsg`, `SCOPE` entry or
  `hashState` field; a `NET_VERSION` bump.
- A declaration, sooli, _ryöstö_ or nolo variant of Nami, and a `Mode` member of its own.
- A new phase, a new `Screen` kind, a second `setTimeout` call site, a per-turn time limit, or a
  score pop on the felt for a captured trick.
- Any roguelike shell in the mode: money, a shop, jokers, vouchers, consumables, the tuppipakka,
  the swap phase, bosses, enhancements or a cash-out.
- Fixing Tuppi-Rummikub's own `ModeBox` (which names a declarer that does not exist) or the chip
  number Traditional Tuppi prints on every card.
- Optimal Nami play, card counting, or any change to how `chooseAI` plays the other modes —
  including the deliberate 0.35 anti-sooli randomness.
- A third variant, a player-editable point table, or merging the two Nami boards into one.
- Changing `SAVE_VERSION`, `tupatro-scores-v1`, `tupatro-race-v1`, `tupatro-tuppi-v1` or
  `tupatro-challenge-rummikub-v1`, or resuming a challenge automatically at boot.

## Source

- **GitHub issue #7**, the requester's own rules, quoted verbatim above and again here because this
  is the only source the mode has:
  - _"Helpot säännöt: Pistekortit: A = +4, K = +3, Q = +2, J = +1. Kaikki muut (2–10, myös
    kymppi): −1 kukin. Kun 13 tikkiä on pelattu, laske parisi keräämien korttien pisteet yhteen →
    se on jaon tulos eli tulos = pistekorttien summa − muiden korttien lukumäärä."_
  - _"Vaikeat säännöt: Miinus (vältä): A = −1, 2 = −2, 3 = −3, … 9 = −9. Plus (kerää): 10 = +10,
    J = +11, Q = +12, K = +13. Parin tulos = keräämiesi korttien arvot yhteen etumerkkeineen."_
  - and the requirement that the game does the arithmetic, so the player only ever decides which
    card to play.
- **The chosen readings, and they belong in comments in `nami.ts` and the reducer's Nami arm:**
  - "Kaikki muut (2–10, myös kymppi)" is every rank the point list does not name, so in the easy
    variant exactly the ranks 2–10 are −1 each. The issue spells the ten out because it is the trap.
  - The hard variant's "A = −1" is a _value_, not a rank order: the ace is still the highest card
    and still takes the trick. Both variants are ordinary tuppi trick play in every other respect.
  - "Parin tulos" is the partnership's, so a captured card's value belongs to the winner's **pair**,
    not to the seat — `teamOf(winner)`, like every other score in this game.
  - The issue names no target and no match length. The match shape is taken from the two existing
    match modes and the number is measured, which is where rule 5 (balance is measured, never
    guessed) applies rather than rule 4.
- **What this mode does _not_ claim.** Rule 4 — "tuppi's rules are never invented" — is about
  tuppi, and Nami's scoring is not tuppi's, exactly as Tuppi-Rummikub's laydown is not. What must
  therefore stay true is that the game never calls this tuppi's scoring: the rules panel and the
  README present Nami as a custom mode with its own table, the way they already present
  Tuppi-Rummikub.
- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** and
  <https://korttipeliopas.fi/tuppi> for everything about the play this mode keeps and does not
  reimplement: four players in two partnerships, thirteen cards each, no trump suit,
  _maantuntopakko_, and the highest card of the led suit taking the trick with the ace high.
  `rules.ts`, `currentWinner`, `legalCards` and `schedule.ts` already do all of it, and this change
  touches none of it.

## For the implementer: the traps in this codebase this change walks into

1. **`d.challenge` may not sit in front of `)`, `?` or `&&` in the reducer.**
   `invariants.test.ts` greps for it, so `isMatchMode(d.challenge)` trips a guard that exists for a
   good reason. Spell the ids in `reducer.ts`:
   `d.challenge === "nami" || d.challenge === "namihard"`. The exhaustive helper the criteria ask
   for is for the components and `GameContext.tsx`, which are outside that grep — and `Rail.tsx`'s
   page list and `GameContext.tsx`'s no-write guard are correct for _any_ challenge and must not be
   narrowed to ids.
2. **`showHandResult` must always open a screen.** `nextTick`'s `handend` case returns a tick
   whenever `g.screen` is null and the phase deliberately stays `handend`, so a Nami arm that
   returns without setting `dealend` or `raceover` fires forever. `advance` in `drive.ts` throws
   `"advance: did not settle"`, which is how a headless test catches what React's dep-keyed effect
   hides.
3. **`endHand` must not conflate scales.** It already branches `dealPoints` vs `dealScores`; a
   third scale joins them, and a fall-through would bank a card-value number against a target of 52
   or a chip target of 12,000.
4. **Two boards, two scales, one row shape.** `RaceRow` fits every match mode, which is exactly how
   a board silently becomes a different board — a ±40 Nami match filed on `tupatro-race-v1` would
   be outranked by every chip-scale row there. `MATCH_KEY` is a `Record<MatchId, string>`, so the
   compiler asks for the new keys; the `=== "tuppi" ? "tuppi" : "race"` ternaries are what will not
   ask.
5. **A new `CHALLENGES` row is a compile error until both catalogues have `.n` and `.t`**, because
   `i18n.test.ts` iterates the table. Add the Finnish key first; `en.ts` then will not compile
   until it has it too.
6. **`chooseAI` must not consume randomness in the Nami branch.** `pick` and `rng.next()` advance
   `g.rngState`, which is hashed, saved and replayed; the umpimahka and sooli branches above are
   the only places a card choice may draw, and neither exists in a Nami deal.
7. **The render sweep's `SCREENS` fixture is keyed off `Screen["kind"]`.** Reusing `raceover` means
   nothing to add there — which is a reason not to invent a Nami result screen — but `npm test`
   transpiles without type-checking, so `npm run typecheck` and `npm run build` are the gate for
   the `MatchId` widening.
8. **The rail plate at 500 px, and the card's corner number on a phone.** jsdom lays nothing out; a
signed two-digit value in `.chip` is wider than the `+7` that slot was drawn for, and the hard
variant prints `+13` and `−9` on thirteen cards at once.
</content>

</invoke>
