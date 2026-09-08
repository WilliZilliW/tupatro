---
id: 2026-09-08-traditional-tuppi-multiplayer-mode
title: Add Traditional Tuppi as a second mode the lobby can start — tuppi's own point table, played to 52
kind: rule
status: proposed
source: <https://korttipeliopas.fi/tuppi> — "Kuudella kasalla joukkue saa neljä pistettä ja jokainen kasa vähemmän lisää pisteitä neljällä"; "Ramissa voittoon tarvitaan seitsemän kasaa. Seitsemästä kasasta saa neljä pistettä, sen jälkeen jokainen ylimääräinen kasa on neljän pisteen arvoinen"; "Ryöstetty rami on arvoltaan kaksinkertainen, eli jokainen kasa seitsemännestä alkaen on kahdeksan pisteen arvoinen"; "Jos soolaaja selviää tikeittä, pari saa 24 pistettä. Jos soolaaja ottaa yhdenkin tikin, ramaajat saavat 24 pistettä"; "Peli päättyy, kun toinen joukkueista pääsee 52 pisteeseen." Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) for the play itself, which this mode does not change. One place where this mode and the two existing ones deliberately disagree is named below.
---

# Add Traditional Tuppi as a second mode the lobby can start — tuppi's own point table, played to 52

## What

Multiplayer's lobby currently starts one thing, the **Tuppikilpa / Tuppi Race**: ordinary tuppi
scored by this game's chips × mult arithmetic to a measured 12,000. This adds a second mode the
same chairs can start, **Perinteinen tuppi / Traditional Tuppi**: the same thirteen tricks, the
same declaration, sooli and ryöstö, scored by **tuppi's own point table** — four points a trick
from the seventh in rami, four a trick under seven in nolo, a ryöstö worth double, 24 for a sooli —
played until a pair reaches **52 points** and the other is put _tuppeen_. It is the game the rules
panel's "What comes from tuppi" section already describes, playable at last.

The chair table gains a mode picker, and Start begins whichever of the two is chosen — across
browsers, at one screen, or against nothing but the game, exactly as the race does today. No chips,
no poker trick types, no score pop, no money, no shop, no jokers and no tuppipakka: a deal's whole
worth is its trick count. Nothing about the main game, the race or Tuppi-Rummikub changes.

## Prior specs and documents

- **Extends `2026-09-07-race-to-target-mode` (delivered), and completes one line of its Out of
  scope.** That spec parked "Tuppi's traditional point table (4 points a trick over six, 24 for a
  sooli, 52 to win)" and said "the mode's arithmetic is this game's own". This is that mode, built
  beside the race rather than instead of it: a third `ChallengeId` reusing `raceDeal`, `raceBase`,
  `raceScores`, `target`, the `raceover` screen, `matchOver` and `raceWinner`. The race's 12,000,
  its board key, its rules text and its arithmetic are untouched, and a criterion pins that.
- **Narrows, and does not reverse, that spec's busted-sooli decision.** It kept Tupatro's "a busted
  sooli scores nothing for anybody" and wrote that correcting it to the source's 24-to-the-declarers
  "is a scoring change and needs its own spec". This is that spec, **scoped to the new mode only**:
  `tuppiInfo` is not touched, so the main game and the race keep the multiplier of 0. The reviewer
  should see the consequence plainly — the same busted sooli scores nothing in a race and 24 to the
  declaring pair in a traditional match, deliberately, because one mode is playing tuppi's table and
  the other is not.
- **Extends `2026-09-08-race-starts-from-the-lobby` (delivered).** The lobby's chairs stay exactly
  what says who plays; what is added is _what_ they are playing. `net.start()` keeps its signature
  and stops hardcoding `id: "race"`.
- **Overlaps `2026-09-08-multiplayer-behind-one-door` and
  `2026-09-08-separate-multiplayer-connection-routes` (both delivered).** Neither route changes: a
  room and a code swap are indistinguishable above the door, `net.room` is still what the lobby
  branches on, and the mode is chosen on the chair table which is behind Host a game. No page of
  either route gains or loses a control except the picker.
- **Overlaps `2026-09-08-webrtc-transport` (delivered), and needs nothing from it.** The mode rides
  in the `id` field of a `startChallenge` the host already numbers and broadcasts. `SCOPE`,
  `hashState`, `parseMsg` and `guestMay` do not change — `hashState` already covers `challenge`,
  `raceDeal` and `raceScores`.
- **Overlaps `2026-09-06-tuppi-rummikub-challenge` (delivered).** Untouched: the laydown,
  `laydown.ts`, `LAYDOWN_TURN_MS`, the `laydown` phase, `tupatro-challenge-rummikub-v1` and the
  Challenges list, which still lists exactly one row.
- **Overlaps `2026-09-07-drop-dead-save-upgrade` (delivered).** `SAVE_VERSION` stays `3`: this adds
  no `GameState` field, and a match is never saved at all.
- **Updates `docs/multiplayer.md`.** "What is left to build" gets an entry for this mode. Stage 3b —
  a race with the roguelike economy — is untouched and still unbuilt; this is not it.
- Nothing here is already delivered. `src/game/` today contains no point table and no `"tuppi"`
  challenge id.

## The arithmetic, and why it is not a measurement

The target is **52**, and unlike the race's 12,000 it is **not** this game's number to choose:
korttipeliopas.fi says "Peli päättyy, kun toinen joukkueista pääsee 52 pisteeseen." Choosing another
number would be inventing scoring, which rule 4 forbids. What is measured is the **match length**
that falls out of it, and it is reported rather than tuned.

The table, per pair, from the source:

| Deal                                 | Points to                      | Value         |
| ------------------------------------ | ------------------------------ | ------------- |
| rami, declaring pair takes `w` ≥ 7   | the declaring pair             | `(w − 6) × 4` |
| ryöstö: the other pair takes `w` ≥ 7 | the defending pair             | `(w − 6) × 8` |
| nolo, a pair takes `w` ≤ 6           | that pair                      | `(7 − w) × 4` |
| sooli held (soloist takes none)      | the soloist's pair             | `24`          |
| sooli busted (soloist takes one)     | the declaring pair (`ramTeam`) | `24`          |

**This is exactly four times the existing tuppi multiplier**, which is the whole reason the race
could not use it: `tuppiInfo` returns `w − 6` in rami, `(w − 6) × 2` on a ryöstö, `7 − w` in nolo
and `6` in sooli. That identity is not a coincidence to rely on silently — it is an **assertion**
below, so the two scales cannot drift apart. Its one exception is the busted sooli, where this mode
follows the source and `tuppiInfo` does not.

One pair scores a deal and the other nothing, for the same reason the race's termination argument
gives: with thirteen tricks one side always holds at least seven, so in rami exactly one side is at
or past the floor and in nolo exactly one side is at six or fewer. The busted sooli, which scores
for nobody in a race, scores 24 here — so this mode has **no** deal that advances neither pair.

## Acceptance criteria

- [ ] **The id and the target are data.** `ChallengeId` is `"rummikub" | "race" | "tuppi"` with
      `MatchId = "race" | "tuppi"` beside it in `src/game/types.ts`; `Challenge` gains
      `target: number`; `CHALLENGES` in `content.ts` carries a third row
      (`{id:"tuppi", key:"challenge.tuppi", g:…, deals:0, target:TUPPI_TARGET}`) and a target on the
      other two (`0` and `RACE_TARGET`); `startChallenge` sets `g.target = row.target` with no id
      test left in it. `TUPPI_TARGET = 52` lives in `constants.ts` with the source sentence in its
      comment.
- [ ] **`src/game/points.ts` is the point table and nothing else.** It exports
      `dealPoints(g): [number, number]`, team-indexed, implementing every row of the table above,
      and it reads no wallet, no boss, no `base` and no `raceBase` — a `Pick` of `tricks`, `mode`,
      `ramTeam`, `sooli`, `sooliBust`, `sooliSeat` is its whole input. It is listed in `PURE_CORE`
      in `src/test/invariants.test.ts` and in `CLAUDE.md`'s module table.
- [ ] **`src/game/points.test.ts` pins the table and guards the drift.** Every trick count 0–13 for
      rami, for a ryöstö, and for nolo, plus both sooli outcomes, asserted against the source's
      numbers; and for every non-sooli case, on an empty-wallet, boss-less state,
      `dealPoints(g)[t] === 4 * tuppiMult(g, t, seatOfTeam(t))` for both teams. A comment says why
      the sooli case is excluded from that identity.
- [ ] **A traditional deal is played exactly as a race deal and scores no chips.** `startDeal`
      reaches `runDeclarations` for `"tuppi"` as it does for `"race"` (declaration, sooli, ryöstö,
      no swap); `resolveTrick` in `"tuppi"` calls no `scoreTrick`, adds nothing to `base` or
      `raceBase`, leaves `d.pop` null, still tallies party support, and ends at `trickend`. A
      `reducer.test.ts` case drives a whole deal and asserts `raceBase` is `[0, 0]`, `pop` is null,
      and `endHand` banked exactly `dealPoints`.
- [ ] **A match ends at 52 and always opens a screen.** `endHand` banks both pairs into
      `raceScores`; `showHandResult` in `"tuppi"` opens `raceover` when `matchOver` and `raceWinner`
      agree and `dealend` otherwise, never neither — the `handend` tick loop that `schedule.ts`
      warns about. `game/drive.ts`'s `advance` settling is what proves it.
- [ ] **The match length is measured, not guessed.** `src/test/bot.ts`'s `playRace` takes the mode
      id (defaulting to `"race"`, so no existing call site or README recipe moves), and at least 200
      seeded traditional matches are played headlessly with every seat deciding through the game's
      own `chooseAI`. Every match finishes; the median, mean and 10th–90th deal counts go in
      `README.md` beside the race's. If the pace reads long or short, that is recorded — **52 does
      not move**.
- [ ] **The lobby chooses the mode.** The chair table draws a picker over the two `MatchId`s, with
      the selected mode's name, description and best-match line (`nameOf`/`descOf` from its own
      `CHALLENGES` row). The choice lives on the net context (`match` / `setMatch`, default
      `"race"`) beside the chair plan — never on `GameState`, never in a save — and `net.start()`
      dispatches `{ type: "startChallenge", id: <chosen>, seed, seats }` with the value the picker
      shows. A render case clicks Traditional Tuppi and then Start and asserts the dispatched `id`.
- [ ] **No transport change.** `src/net/protocol.ts` is unchanged: `SCOPE`, `hashState`, `parseMsg`
      and `guestMay` byte-identical, no new action, no new message kind. A `session.test.ts` case
      shows a guest entering the traditional mode from the host's numbered `startChallenge` and
      hashing equal.
- [ ] **The board is a fifth key.** Traditional matches file the existing `RaceRow` shape under
      **`tupatro-tuppi-v1`**; `tupatro-race-v1` is written only by a race. `game/storage.ts` picks
      the key from the mode id, `GameContext.tsx` writes the board of `state.challenge` on a
      `raceover`, and a `scores.test.ts` case asserts a row written in one mode never appears on the
      other's board — the two scales are not comparable, which is the same trap the race's key
      already avoided.
- [ ] **Every race-shaped screen names the mode it is drawing.** The rail plate for a traditional
      match shows the mode's name, the deal number, both pairs' points against 52, the trick count
      and **this deal's points for the viewing pair** (there is no score pop to carry that); the
      deal-end screen shows the deal for both pairs, both totals out of 52 and the tricks; the
      result screen's heading names the mode and its Play again / Replay seed dispatch
      `id: g.challenge`, not a literal `"race"`; `Rail.tsx` gives a traditional match the match
      plate, not the rummikub plate; `Challenges.tsx` still lists exactly one row.
- [ ] **The sooli panel tells the truth in this mode.** In `"tuppi"` it says the deal is worth
      **24 points** if the sooli holds and **24 to the declarers** if it busts, and names the match
      target; it mentions no multiplier. The race's and the main game's sooli strings are unchanged.
- [ ] **Text and docs.** `challenge.tuppi.n` / `.t` and a `rules.tuppi*` mode section exist in both
      catalogues with matching placeholder sets (the i18n test covers the new `CHALLENGES` row
      automatically); the rules panel states the point table, the 52, and that a busted sooli pays
      the declarers here and nobody in the race; `render.test.tsx` sweeps a traditional rail,
      table + hand, sooli offer, deal end and result screen — the last from both pairs' seats — in
      both languages; `README.md`, `CLAUDE.md` and `docs/multiplayer.md` describe the mode.
      `SAVE_VERSION` stays `3` and `GameState` gains no field.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **"Traditional tuppi" is read as tuppi's own point table played to 52** — the game
  `rules.tuppi` in the catalogue already describes and the README's "What comes from tuppi" lists.
  It is **not** read as hosting the roguelike run across browsers (that capability stays parked and
  unreachable, `docs/multiplayer.md` stage 3b) and **not** as a rename of the existing race, which
  the README already calls "ordinary tuppi" but scores with chips × mult.
- **"to multiplayer" is read as the lobby behind Multiplayer → Host a game**, which is also how a
  solo race is started today. The mode is therefore **not** added to the Challenges list, and a
  one-human traditional match is started through the same two clicks a one-human race is.
- **It is a third `ChallengeId`, not a flag on the race.** That buys it a name, a description, a
  board, a rules section and a `CHALLENGES` row for free, and costs an explicit `"tuppi"` arm on
  every reducer branch that currently tests `"race"`. Reusing `raceDeal` / `raceBase` /
  `raceScores` / `target` / the `raceover` screen keeps `GameState`, the save version and the
  desync hash exactly where they are.
- **A busted sooli pays the declaring pair 24 in this mode and nobody in the other two.** The source
  is explicit and this mode exists to follow it; `tuppiInfo` is not touched, so no main-game or race
  number moves. The reviewer is being asked to accept two scoring answers to one situation, in two
  modes, on purpose.
- **Tricks score nothing while they are played.** No chips, no poker trick type, no `ScorePop`. The
  felt therefore has less per-trick feedback than a race does; the rail plate's running deal points
  are what replace it. That is a real UI consequence of the rule, not an oversight.
- **52 is not a balance number and is not measured into place.** The match length that falls out of
  it is measured and reported. If a traditional match turns out much longer or shorter than a race,
  the README says so and the target stands.
- **The chosen mode is the session's, like the chair plan** — held in the net context, read by
  `start()`, never on `GameState` and never in a save. A guest has no picker and learns the mode
  from the host's numbered action, which is the same route the seed and the seats take.
- **Names: "Perinteinen tuppi" / "Traditional Tuppi".** The mode's row glyph must be one already
  proven against tofu in this project (a suit, an arrow or a geometric shape); a new exotic glyph
  needs the canvas comparison CLAUDE.md describes.
- **Sooli is still offered to one human defender only**, which is the engine's existing behaviour.
  An all-AI traditional match therefore never sees a sooli, so the busted-sooli rule above is
  exercised by tests and by human play, not by the headless measurement. That is inherited, not
  decided here.
- **The race is left alone in every respect** — its 12,000, its board key, its rules text, its
  arithmetic and its plate rows. Only the files the two modes share change shape.
- **Hot seat has no curtain here either.** Whoever is at the screen sees the hand of whoever is to
  play, and the mode's rules text says so, exactly as the race's does.
- **The `lan` wart is not fixed and not widened.** The mode picker is drawn on the chair table only;
  if the implementer stores the choice as the LAN flag is stored, the value used on the click must
  be the value the picker shows.

## Touch points

- `src/game/types.ts` — `ChallengeId`, `MatchId`, `Challenge.target`, and the `raceDeal` /
  `raceBase` / `raceScores` comments that today say "Inert unless `challenge` is `"race"`"
- `src/game/constants.ts` — `TUPPI_TARGET = 52` with the source sentence
- `src/game/content.ts` — the third `CHALLENGES` row and `target` on all three
- `src/game/points.ts` — **new**: `dealPoints`, the whole of tuppi's table
- `src/game/points.test.ts` — **new**: the table, and the `4 × tuppiMult` identity
- `src/game/reducer.ts` — `startDeal`, `resolveTrick`, `endHand`, `showHandResult`, `startChallenge`
- `src/game/reducer.test.ts` — a whole traditional deal, no chips banked, both sooli outcomes
- `src/game/storage.ts` — the match board key per mode id (`tupatro-race-v1` unchanged)
- `src/game/scores.ts` / `src/game/scores.test.ts` — `raceRowFor` reused; the two boards stay apart
- `src/hooks/netContext.ts` — `match` / `setMatch` on `Net` and on the no-op default
- `src/hooks/useNetGame.ts` — `start()` sends the chosen mode instead of a literal `"race"`
- `src/hooks/GameContext.tsx` — which board a `raceover` writes
- `src/components/screens/Lobby.tsx` — the mode picker, and the best line per mode
- `src/components/screens/RaceOver.tsx` — mode name, `dealPoints` vs `dealScores`, replay ids, board
- `src/components/screens/DealEnd.tsx` — the match deal-end for both modes
- `src/components/screens/Challenges.tsx` — the list excludes every mode the lobby starts
- `src/components/rail/RacePlate.tsx`, `src/components/rail/Rail.tsx` — the plate for any match mode
- `src/components/panels/SooliOffer.tsx` — 24 / 24-to-the-declarers and the match target
- `src/components/screens/Rules.tsx`, `src/i18n/fi.ts`, `src/i18n/en.ts` — the mode's section and
  every new string
- `src/test/bot.ts`, `src/test/render.test.tsx`, `src/test/invariants.test.ts`, `README.md`,
  `CLAUDE.md`, `docs/multiplayer.md`

## Out of scope

- Any change to `tuppiInfo`, `tuppiMult`, `finalScore`, `scoreTrick` or `dealScores` — the main
  game's and the race's arithmetic, including their busted sooli of 0, stays exactly as it is.
- An economy in the traditional mode: money, a shop, jokers, vouchers, consumables, a tuppipakka, a
  swap phase or a cash-out formula. That is `docs/multiplayer.md`'s stage 3b.
- Bosses in the mode, and any change to the two pools, the ante ladder or the blind table.
- Tuppi-Rummikub, the laydown, `laydown.ts`, `chooseLaydown`, `LAYDOWN_TURN_MS` and its board.
- A new phase, a new `Screen` kind, a second `setTimeout` call site, or a per-turn time limit.
- Saving or resuming a match, and bumping `SAVE_VERSION`.
- Transport work: new message kinds, reconnect, an AFK timer, nicknames, a spectator, a per-window
  seat choice, or a curtain over a hot-seat hand.
- AI tuned for the new scale: `chooseAI`, `aiDeclare` and `sooliRisk` play a traditional deal
  exactly as they play a race deal, deliberate 0.35 anti-sooli randomness included.
- Adding the mode to the Challenges list, to New Game, or to any path a single-player run takes.
- A per-seat or per-pair board, merging any two boards, or changing `tupatro-scores-v1`,
  `tupatro-challenge-rummikub-v1` or `tupatro-race-v1`.

## Source

- **<https://korttipeliopas.fi/tuppi>**, checked for the point table this mode exists to implement,
  quoted verbatim:
  - nolo — _"Kuudella kasalla joukkue saa neljä pistettä ja jokainen kasa vähemmän lisää pisteitä
    neljällä."_
  - rami — _"Ramissa voittoon tarvitaan seitsemän kasaa. Seitsemästä kasasta saa neljä pistettä, sen
    jälkeen jokainen ylimääräinen kasa on neljän pisteen arvoinen."_
  - ryöstö — _"Jos ramannut joukkue häviää ramin, tapahtuu ramin ryöstö. Ryöstetty rami on arvoltaan
    kaksinkertainen, eli jokainen kasa seitsemännestä alkaen on kahdeksan pisteen arvoinen."_
  - sooli — _"Jos soolaaja selviää tikeittä, pari saa 24 pistettä. Jos soolaaja ottaa yhdenkin
    tikin, ramaajat saavat 24 pistettä."_
  - the end — _"Peli päättyy, kun toinen joukkueista pääsee 52 pisteeseen."_
- **The chosen reading, and it belongs in a comment at the top of `points.ts`:** "ramaajat" is the
  pair that declared the rami, which is `g.ramTeam`. A sooli is only ever offered to a defender
  against a declared rami, so in a busted sooli `ramTeam` is non-null and is the other pair from
  `teamOf(g.sooliSeat)`; should `ramTeam` ever be null the function falls back to the non-soloist's
  pair rather than scoring nobody.
- **This mode and the two existing ones disagree in one place, and the disagreement is
  deliberate.** `tuppiInfo` returns a multiplier of `0` to everybody on a busted sooli, so the main
  game and the race score it for nobody; the source gives the declarers 24 and this mode does too.
  `points.ts` says so in a comment, `race.ts`'s existing comment about the same rule stays as it is,
  and both the rules panel and the README state the difference so the game does not teach two things
  at once without saying which mode is which.
- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** for everything about the
  play that this mode keeps and does not reimplement: four players in two partnerships, thirteen
  cards each, `maantuntopakko` and no trump suit, the highest card of the led suit taking the trick
  with the ace high, the `näyttö` from the elder hand clockwise with rami beating nolo, and the
  defender's sooli with its card exchange, the ace lowest and the soloist playing last. `rules.ts`,
  the reducer and `schedule.ts` already do all of it and this change touches none of it.

## For the implementer: the traps in this codebase this change walks into

1. **Do not write a helper that puts `d.challenge` in front of a `)` or a `?`.**
   `invariants.test.ts` greps the reducer for `/\bd\.challenge\s*(\)|\?|&&)/` and fails on it, so
   `isMatchMode(d.challenge)` and `d.challenge ?? null` both trip a guard that exists for a good
   reason. Spell the ids: `d.challenge === "race" || d.challenge === "tuppi"`. The same test also
   asserts more than three `d.challenge === "` comparisons, so the count only goes up.
2. **`showHandResult` must always open a screen.** `nextTick`'s `handend` case returns a tick
   whenever `g.screen` is null and the phase deliberately stays `handend`; a `"tuppi"` arm that
   returns without setting `dealend` or `raceover` fires forever. `advance` in `drive.ts` throws
   `"advance: did not settle"`, which is how the headless test catches what React's dep-keyed effect
   hides.
3. **`resolveTrick`'s race arm scores each pair against `seatOfTeam(t)`, not the winner's seat.**
   The traditional arm scores nothing at all, so it sidesteps this — but do not "simplify" the
   race's arm while you are in there, and do not let the traditional arm fall through into it.
4. **Two boards, two scales, one row shape.** `RaceRow` fits both modes, which is exactly how a
   board silently becomes a different board: a 52-point match filed on `tupatro-race-v1` would
   outrank nothing and be outranked by everything. Separate keys, as `scores.test.ts` already pins
   for the race and the challenge.
5. **A new `CHALLENGES` row is a compile error until both catalogues have `.n` and `.t`**, because
   `i18n.test.ts` iterates the table. That is the mechanism working; add the Finnish key first.
6. **`Rail.tsx`'s page list is correct for _any_ challenge and must not be narrowed to an id** —
   only the plate inside the first page tests the id. `GameContext.tsx`'s no-write guard is the same
   shape and the same trap in reverse.
7. **The render sweep's `SCREENS` fixture is keyed off `Screen["kind"]`.** Reusing `raceover` means
   nothing to add there — which is a reason not to invent a `tuppiover` kind.
8. **`npm test` cannot see a missing screen kind or a layout break.** `npm run typecheck` and
   `npm run build` are the gate for the first; the lobby's picker at a 500 px window height, inside
   the sticky `.lobbyfoot` panel that spec measured, is the second.
