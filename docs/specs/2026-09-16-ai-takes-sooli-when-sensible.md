---
id: 2026-09-16-ai-takes-sooli-when-sensible
title: Offer sooli to bot defenders in the main run too
kind: rule
status: delivered
source: https://korttipeliopas.fi/tuppi and the Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)
---

# Offer sooli to bot defenders in the main run too

## What

In the main roguelike run a bot never plays sooli, because `sooliCandidates` hands the offer to
one human defender and to nobody else. After this, every defender of a declared rami is offered
sooli in the main run exactly as in the two match modes — humans first, then bots, clockwise from
the dealer's left — and a bot that holds a hand its conservative acceptance rule approves plays
alone against the declarers. The player can therefore be soloed against, and can hand the offer on
to their own partner by passing it.

A second half comes with it, and it is the part that is easy to miss: the main run's sooli
arithmetic has only ever been asked about the soloist's own pair, because the soloist was always
the run owner. Once a bot may solo, the run owner can be a **declarer** in a sooli deal, and
`tuppiInfo` would then tell the owner's pair it must take no tricks and pay it a ×6 multiplier for
tricks the soloist dodged. The main run gets the rule the race already has: in a sooli only the
soloist's pair banks.

## Relation to delivered specs

- **Contradicts [`2026-09-09-both-defenders-sooli`](2026-09-09-both-defenders-sooli.md)**, whose
  delivered criterion reads "Main game retains its single human-defender offer, no bot sooli and
  seeded results." **This spec wins**, and the reversal is deliberate: that criterion was a scope
  boundary drawn round a match-mode feature, not a rule finding. The house tie-break it introduced
  (humans first, then clockwise from the dealer's left) is kept exactly and simply stops being
  match-only. Its seeded-results clause falls with it: the main run's pinned goldens move.
- **Overlaps [`2026-09-07-race-to-target-mode`](2026-09-07-race-to-target-mode.md)** on the
  soloist-pair-only banking rule, which `game/race.ts`'s `dealScores` already implements for the
  race. This spec does not touch the race; it gives the main run the same reading, in `tuppiInfo`
  and `resolveTrick`, and the race's numbers must come out unchanged.
- **Does not reopen** the busted-sooli deviation (Tupatro scores a collapsed sooli for nobody,
  where the source gives the declarers 24). That contradiction is already recorded in `race.ts`
  and the README; see Out of scope.

## Acceptance criteria

- [x] `sooliCandidates` in `src/game/rules.ts` returns the same sequential list in every mode that
      runs a declaration: both defenders, humans before bots, and within a group clockwise from the
      dealer's left. The `g.challenge !== "race" && g.challenge !== "tuppi"` branch and the
      `challenge` field of its `Pick` are gone. `sooli.test.ts`'s "preserves the single human offer
      in the main game" case is replaced by one asserting that with `challenge: null` and seats
      `["human","ai","ai","ai"]` both defenders appear in that order.
- [x] `declineSooli` in `src/game/reducer.ts` advances to the next candidate in every mode. A
      main-run deal whose two AI defenders both fail `shouldSooli` reaches `phase === "play"` with
      `sooliSeat === null`, `sooli === false` and `rngState` unchanged from before the offers.
- [x] A main-run deal whose AI defender passes `shouldSooli` runs offer → `sooligive` →
      `sooliready` → `play` through `nextTick` alone, ending with `sooli === true` and
      `seats[sooliSeat!] === "ai"`. No new phase, action, `GameState` field or `setTimeout` site
      is added: `useGameLoop` stays the only timer and `aiSooli` stays the only automatic action.
- [x] In a sooli only the soloist's pair banks in the main run. `tuppiInfo` takes `sooliSeat` in
      its `Pick` and returns `{ mult: 0, ok: false }` with a need key of its own for a team that
      is not `teamOf(sooliSeat)`; `resolveTrick`'s main-run branch adds nothing to `d.base` or
      `d.scored` and applies no `ctx.payout` for such a team. Driven directly in `reducer.test.ts`
      with the run owner on the declaring side.
- [x] `race.test.ts`, `points.test.ts` and `scoring.test.ts`'s existing expectations for the two
      match modes pass with no change to their asserted numbers: `dealScores` and `dealPoints`
      already restrict a sooli to the soloist's pair, and `raceBase` is fed by `scoreTrick`, which
      does not read `tuppiInfo`.
- [x] `cashOut`'s `$6` sooli bonus is paid only when `teamOf(sooliSeat) === ownerTeam(d)`. A
      `reducer.test.ts` case clears a blind whose last deal was an opponent's sooli and asserts the
      cash-out screen's `bonus` is `0`.
- [x] `sooliRisk` and `shouldSooli` in `src/game/ai.ts` read enhancements, which exist in the main
      run and in neither match mode: a `stone` card counts as neither a high card nor a suit's low
      guard (`currentWinner` never picks it and `legalCards` always lets it through), and a `wild`
      card counts as a high card when its rank is 10–13 and as a low guard in **every** suit the
      hand holds when its rank is 14, 2 or 3 (`matchesSuit` is true for every suit). Asserted in
      `sooli.test.ts` with hands that flip the verdict either way. Neither clause changes any match
      deal, whose decks carry no enhancements.
- [x] Measured headlessly and written into the README's balance section, replacing the current
      main-game figures: `SEED0`…`SEED199` through `playRun(seed, basicPolicy)` before and after,
      reporting deals played, mean deal score, accepted bot soolis, how many of them busted, and
      blind win rate by ante. The verification record states the change in plain numbers; no
      constant in `ANTES`, `BLIND_REWARD` or `shouldSooli` is tuned to flatten it.
- [x] `game/seats.test.ts`'s pinned literals and 50-seed aggregate are re-measured and re-pinned in
      the same change, with the spec's record naming the new offers as the cause. The rotation test
      — the same deal played from each of the four seats — still passes unchanged.
- [x] `NET_VERSION` in `src/net/protocol.ts` is bumped to **7** and the README's version line with
      it. No wire shape, `SCOPE` entry, `hashState` field or `guestMay` clause changes.
- [x] Both catalogues: the main run's `SooliOffer` draws `sooli.priority` and labels its decline
      button `btn.passSooli`, never `btn.playNormally` — passing no longer promises ordinary rami.
      `btn.playNormally` is deleted from `fi.ts` and `en.ts` once it has no call site. A new need
      key and a new `why.*` key say that the other pair played alone, with identical placeholder
      sets in both files, and `rules.tuppi`'s sooli line says either defender may play alone and
      that bots take it. README's "The main roguelike run is unchanged" paragraph is rewritten.
- [x] `render.test.tsx` renders, in both locales, a main-run state with an AI soloist against the
      owner's rami and one where the owner is the soloist's partner sitting out with an empty hand:
      no leaked catalogue key, no `undefined`, no `NaN`, no Finnish word in English output, and no
      string telling the viewing seat it is playing alone when it is not. Gates pass: `npm run
lint`, `npm run typecheck`, `npx prettier --check`, `npm test`, `npm run build`, plus a
      mutation check that reverting the candidate list and the soloist-pair banking each fail a
      test.

## Assumptions

Nobody answered a question during this run. Each line below was decided, not asked.

- **"Also" is read as the main roguelike run.** Both match modes already offer both defenders and
  let bots accept, so the only mode where a bot never soolis is the main run. Nothing in
  Traditional Tuppi or Tuppi Race changes behaviour.
- **One candidate rule for every mode, not a bot-only fallback.** The alternative — offer a bot
  only when the defending pair holds no human — would have kept the human's pass meaning "play it
  normally". It does not survive this change: in the main run a human defender who passes now hands
  the offer to their own AI partner, which is why the decline button's label changes.
- **"Makes sense" is the existing conservative `shouldSooli`, not a better one.** Its threshold is
  not retuned. The README's own measurement says it accepts about 1% of offers and that most
  accepted bot soolis bust; that stays true and is not treated as a defect here. What it does gain
  is the two enhancement clauses above, because the main run is the one mode with enhancements and
  a rule that mis-reads a stone card there is not "sensible" in any useful sense.
- **A bot's sooli can zero the player's deal.** With only the soloist's pair banking, a bot that
  solos against the run owner's rami leaves the owner's blind score untouched by that deal whether
  the sooli holds or busts. That is the source's own rule for a held sooli and Tupatro's existing
  deviation for a busted one — but the main run has never been able to reach it before, so it is a
  new experience for the player and a real balance cost. It is measured, not argued.
- **The pinned goldens will move, and that is the expected outcome, not a regression.** An accepted
  sooli draws a random return card, so every seed diverges from the first bot sooli onwards.
  `seats.test.ts` is re-measured and re-pinned; it must not be relaxed into a looser assertion.
- **`NET_VERSION` is bumped although no hosted mode's replay changes.** Match modes compute exactly
  the same deals, and the main run is only reachable inside a session through the rail's seed chip
  (`newRun` is a `flow` action — the known gap). The bump is the project's documented habit for a
  reducer rule change, and the cost is that every v6 tab must refresh. The argument against — one
  bump for a divergence only an unsupported route can reach — is recorded here rather than acted on.
- **The main run's sooli return draw keeps its unsorted pool.** `giveSooliCard` canonicalizes the
  partner's hand by uid in the match modes only. A hosted main run is an existing known gap, and
  offline the hand's order is part of the saved state, so replay stays deterministic.
- **The `$6` cash-out sooli bonus becomes the soloist pair's.** Today it is paid whenever
  `d.sooli`, which would hand the owner money for a sooli an opponent played.
- **Nolo, the declaring pair and Tuppi-Rummikub are untouched.** Rummikub runs no declaration, so
  `sooliCandidates` is never reached there; the two ids are not tested for truth anywhere new.
- **If the measured main-run mean moves by more than 10%, it is written down, not tuned away.**
  Changing `ANTES` or the acceptance threshold to restore the old figure is a balance spec of its
  own and would hide what this change actually cost.

## Touch points

- `src/game/rules.ts` — `sooliCandidates`: drop the main-game branch and the `challenge` field of
  its `Pick`; keep the house tie-break comment and extend it to say it now covers every mode.
- `src/game/reducer.ts` — `finishDeclare` (unchanged, but now reaches AI seats), `declineSooli`
  (advance in every mode), `resolveTrick`'s main-run scoring branch, `cashOut`'s `bonus`, and the
  `aiSooli` case, which already handles all three phases.
- `src/game/ai.ts` — `sooliRisk` and `shouldSooli`: the stone and wild clauses, with the engine
  facts (`currentWinner`, `legalCards`, `matchesSuit`) named in the comment.
- `src/game/scoring.ts` — `tuppiInfo`: `TuppiState` gains `sooliSeat`, and the sooli branch answers
  a non-soloist team with `mult: 0` and its own need key.
- `src/game/race.ts` — `dealScores` is read, not changed; its soloist-pair comment is the precedent
  the main run now follows and should point at it.
- `src/game/schedule.ts` — read to confirm `nextTick`'s three sooli cases need no change; they are
  already gated on `seats[sooliSeat] === "ai"` with no challenge test.
- `src/net/protocol.ts` — `NET_VERSION` 6 → 7.
- `src/components/panels/SooliOffer.tsx` — `match` stops gating `sooli.priority` and the decline
  label; the `points` gate for the traditional value lines stays.
- `src/components/screens/DealEnd.tsx` — the `why` line for a deal an opponent soloed.
- `src/components/rail/Slate.tsx` — the need line, which now renders the new key.
- `src/components/screens/CashOut.tsx` — the `cash.sooli` / `cash.sooliBonus` rows when the bonus
  is zero.
- `src/i18n/fi.ts` — new need and `why` keys, the `rules.tuppi` sooli line, `btn.playNormally`
  removed.
- `src/i18n/en.ts` — the same keys; it will not compile until they are present.
- `src/game/sooli.test.ts` — candidates in the main run, the ordered declines, the accepting bot,
  and the two enhancement clauses.
- `src/game/reducer.test.ts` — the owner as declarer in a sooli, the zero cash-out bonus.
- `src/game/scoring.test.ts` — `tuppiInfo` asked about both teams in a sooli.
- `src/game/seats.test.ts` — the re-pinned golden and aggregate.
- `src/test/render.test.tsx` — the two new main-run sooli states in both locales.
- `src/test/bot.ts` — read to confirm `playToScreen`'s sooli cases still hold: they act for
  `ownerSeat`, which is safe only because a main run has exactly one human seat.
- `README.md` and `CLAUDE.md` — the rule, the new banking reading, the network version and the
  replacement measurement.

## Implementation and verification record

Implemented and verified in the working tree; no commit or push made for this increment.

- **Final gates:** `npm run lint`, `npm run typecheck`, `npx prettier --check
"**/*.{ts,tsx,json,md,html}"`, `npm test` (**2,317 tests, 25 files, all passing**) and
  `npm run build`. The test count was 2,296 before this change; the 21 added are the main-run
  candidate list, the ordered declines, the accepting bot's whole deal, the two enhancement
  clauses, the owner-as-declarer banking, the zero cash-out bonus, `tuppiInfo` asked about both
  teams, and the render cases below.
- **The measurement, in plain numbers.** `SEED0`…`SEED199` through `playRun(seed, basicPolicy)`,
  before and after. **Corrected after delivery**: this line first quoted a baseline of 1,634 deals
  at mean 659.235618 and a rise of +15.9%. That baseline was not measured in the tree it names —
  `fbdf2b1`, the commit this change branched from, measures **1,434 deals at mean 747.781729**, and
  both it and the "after" figure have since been re-measured with the same script on the same day.
  Deals rose from **1,434 to 1,440**; the mean deal score rose from **747.781729 to 763.928472**,
  **+2.16%** — comfortably inside the 10% the Assumptions above say is written down rather than
  tuned away, so that clause was never tripped. Nothing in `ANTES`, `BLIND_REWARD` or
  `shouldSooli` was touched. Blind clear rate by ante after: **359/522 (69%) at ante 1, 46/81
  (57%) at ante 2, 5/7 (71%) at ante 3**; no run reached ante 4 and all 200 ended in game over.
  **Accepted bot soolis are reported for both samples, because they differ sharply**: **8
  accepted and 2 busted** in the 1,440 scored deals, **6 accepted and 5 busted** in the 200
  run-ending deals `playRun` omits from that list — **14 and 7 over the whole sample, exactly
  half busted**. `basicPolicy` declines every human offer, so all 14 are a bot's. The README
  carries the same two figures with their samples named; quoting the 8 alone reads as a quarter
  busting and is wrong.
- **The cause of the golden's move, since criterion 9 asks for it by name.** An accepted sooli
  draws a private return card from the run's own generator, so a seed diverges from its first
  accepted bot sooli onwards — a state the main run could not reach at all before. The 50-seed
  aggregate in `game/seats.test.ts` moved from `{ sum: 259990, gameover: 38, limit: 12 }` to
  `{ sum: 257032, gameover: 39, limit: 11 }` and was re-pinned as literals, not relaxed. The
  three named seeds happen to hit no accepted bot sooli and kept every literal they had. The
  rotation test — the same deal played from each of the four seats — passes unchanged.
- **Mutation checks**, each reverted before the final gates. Restoring `sooliCandidates`' old
  single-human main-game branch fails **206 tests**; dropping `resolveTrick`'s
  `teamOf(d.sooliSeat) === ownTeam` clause fails **1**; deleting `tuppiInfo`'s `need.sooliOther`
  branch fails **3**. The three result screens were probed together — `soloedByOther = false` in
  `DealEnd.tsx` and `GameOver.tsx` with `soloed = g.sooli` in `CashOut.tsx` — and fail **6**, two
  per screen, one per locale; before the render cases in this increment that same triple mutation
  passed the whole suite.
- **One catalogue line beyond criterion 11, and why it is not scope creep.** `rules.balatro`'s
  multiplier line said "a sooli is ×6" with no qualification, which was true while the run owner
  was always the soloist and is false the moment a bot solos against them. Both catalogues and
  the matching README bullet now say the ×6 belongs to the soloist's pair alone. The project's
  own rule — a `rule` or `scoring` change updates the rules panel and the README in the same
  change, or the game teaches the player something false — is what required it; no other string
  was touched.

- **No browser probe was run for this increment.** The panel it changes is `SooliOffer`, whose
  layout is untouched — one paragraph that used to be gated on the match modes now always draws,
  and one button label is replaced by a key already measured at 1280×500 and 390×844 by
  [`2026-09-09-both-defenders-sooli`](2026-09-09-both-defenders-sooli.md). The three result
  screens gained a sentence in an existing `.dek` and a heading swapped between two existing
  keys. Nothing here adds a control, a row or a scroll container, which is what the UI rules
  above ask a browser reading for. That is a stated limit, not a claim of coverage.

## Out of scope

- **Correcting the busted-sooli deviation.** The source gives the declarers 24 points when the
  soloist takes a trick; Tupatro gives nobody anything in the main run and the race. That stays,
  and correcting it is a `scoring` spec of its own — see `game/race.ts`'s header comment and
  [README](../../README.md#the-race).
- **Retuning `shouldSooli` toward optimal play.** The acceptance threshold and the highest-card
  discard are unchanged apart from the two enhancement clauses.
- **Canonicalizing the main run's sooli return draw by uid**, and the hosted main run generally.
- **Bots taking sooli in Tuppi-Rummikub.** It is forced rami with no declaration.
- **The main run's second-person result strings on a shared table** (`over.*`, `why.*`) — an
  existing known gap, widened by nothing here.
- **Ending a lost lead early and stopping näyttö at the first rami** — still the open findings from
  the both-defenders spec.
- **Multi-human main runs**, and `playToScreen`'s assumption that the offered seat is the owner's.
- **Compensating the balance cost** by moving `ANTES`, `BLIND_REWARD` or the blind targets.

## Source

- <https://korttipeliopas.fi/tuppi>: "Ramia vastaan puolustavan parin **toinen pelaaja** pelaa
  yksin ramaajia vastaan." The source names the chair, not the kind of player sitting in it —
  nothing in it restricts sooli to a human, so offering it to a bot defender is removing a Tupatro
  limitation rather than inventing a rule. It also gives the exchange ("Soolaaja antaa parilleen
  yhden kortin ja saa yhden kortin tilalle"), the order ("soolaaja pelaa aina viimeisenä tikkiin"),
  the ace ("Soolissa ässä on pienin kortti"), the sitting-out partner ("Soolaajan pari ei osallistu")
  and the scoring: "Jos soolaaja selviää tikeittä, pari saa 24 pistettä. Jos soolaaja ottaa
  yhdenkin tikin, ramaajat saavat 24 pistettä." The page also notes sooli is not universally known
  and is not used in tournaments.
- Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022): permits either defender to
  play alone, the declarer leads, one card is exchanged privately and the partner sits out. Neither
  source resolves two defenders both wanting sooli, which is why the sequential house tie-break
  from [`2026-09-09-both-defenders-sooli`](2026-09-09-both-defenders-sooli.md) is kept and extended
  rather than replaced.
- **Chosen readings, each to be written into a code comment.** (1) The house tie-break covers every
  mode that runs a declaration, not just the two match modes. (2) In a sooli only the soloist's
  pair banks: for a held sooli that is the source's own rule, and for a busted one it is Tupatro's
  existing deviation, carried into the main run rather than corrected here. (3) A stone card is
  neither a danger nor a guard to a soloist and a wild card is both in every suit — engine facts
  from `currentWinner`, `legalCards` and `matchesSuit`, not a reading of any rule source.
