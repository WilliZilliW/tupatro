---
id: 2026-09-20-combine-politics-modes
title: Combine Politiikka and Puoluepeli into one politics mode — the government and its party-capture scoring, the forced rami/nolo rotation and the Sofia card in a single alternate rule set — and retire the second id outright
kind: rule
status: proposed
source: GitHub issues #49 (Politiikka) and #63 (Puoluepeli), and the repository owner's own instruction that there be **one** politics mode rather than two rows side by side. Everything the combined mode keeps from tuppi — four players in two partnerships, thirteen cards each, no trump, _maantuntopakko_, the highest card of the led suit taking the trick, ace high — comes from the Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022) and <https://korttipeliopas.fi/tuppi>. Everything else in this mode (the rotation, the government, the party-capture point scale and the Sofia card) has **no source at all** and is this game's own invention, exactly as both retired specs already say. The departures are restated under **Source** below and belong in code comments.
---

# Combine Politiikka and Puoluepeli into one politics mode, and retire the second id

## What

The single-player screen loses a row. The two politics modes that both merged on 19 September —
**Politiikka** (id `"politiikka"`, issue #49, PR #64) and **Puoluepeli** (id `"puoluepeli"`, issue
#63, PR #65) — become **one** alternate rule set, which is the union of what each held alone: the
forced hallituspeli/oppositiopeli rotation (both modes already had it, Puoluepeli by importing
Politiikka's `politicsMode`), a government of 3–5 of the thirteen existing `PARTIES` holding for a
four-deal term and derived from the seed (Puoluepeli's), party-capture scoring — a captured
government card pays in a hallituspeli, a captured opposition card costs in an oppositiopeli
(Puoluepeli's) — and the **Sofia card**, the ♥Q, who wins every trick she is played into
(Politiikka's).

The other mode is **removed**: its `ChallengeId`, its `CHALLENGES` row, its board key, its saved run
slot, its single-player row, its rules-panel section and its README section all go. This is a
deliberate removal of a mode that merged the day before, not an oversight, and the spec it shipped
under is marked `superseded` rather than deleted.

Two things change for the surviving mode as well, and neither is cosmetic: it banks **party points**
rather than tuppi's `dealPoints`, and its **target is re-measured from scratch**, because Sofia
changes which pair captures the cards in a trick and therefore feeds the party-capture scale
directly.

## Prior specs, and what this one reverses

Both prior specs are `status: proposed` in their front matter and both are **delivered on `main`**
(commits `b106309` and its predecessor, PRs #64 and #65). This spec supersedes both, and marks both
so. Neither file is deleted.

- **`2026-09-19-puoluepeli-party-mode` is retired outright.** Its id, row, board, slot, rules
  section and README section go; its _rules_ — the government, `termOf`/`governmentFor`/
  `puolueValue`/`puolueTrick`, `PUOLUE_TERM`, `GOV_MIN`/`GOV_MAX`, `GOV_POINT`/`OPP_POINT`, the
  four-deal term, the derived-not-stored government, `GovBox`, the emblem highlight — are what the
  surviving mode is made of, moved onto the surviving id. Its own criterion **"the ♥Q is an ordinary
  queen here"** is **reversed**: she is the surviving mode's own rule now, and a criterion below
  pins it.
- **`2026-09-19-politics-challenge-variant` keeps its id and loses its scale.** Its criteria
  **"a deal is worth tuppi's own point table (`dealPoints`), banked cumulatively"** and
  **"`POLITIIKKA_TARGET` is 100, measured over 200 seeded matches"** are **both reversed**: the
  surviving mode banks party points and its target is re-measured. Its rotation, its Sofia rule, its
  no-declaration `startDeal` arm and its refusal of Traditional Tuppi's lost-lead reset all stand
  unchanged. Its board key moves — see the criterion — because the rows on it were played on a scale
  the mode no longer uses.
- **Contradicts nothing else.** `2026-09-09-traditional-tuppi-score-reset` still owns the lost-lead
  reset, and the trap both prior specs named is unchanged and still live: the reset lives inside
  `endHand`'s branch written as `d.challenge !== "race"`, so the combined mode must stay **out** of
  it and bank in the Nami arm. `2026-09-03-party-emblems-and-support`'s `PARTIES`, `partyMap`,
  `partyOf` and `g.support` are reused untouched. `2026-09-16-four-suit-colors` and
  `2026-09-19-traditionally-coloured-match-cards` are untouched — `trad` stays exactly
  `g.challenge === "tuppi" || g.challenge === "race"`. `2026-09-18-king-of-clubs-ikiliikkuja`'s ♣K
  draw stays Multiplayer Tupatro's alone. `2026-09-08-webrtc-transport` is untouched: neither id
  was ever in `LOBBY_MODES`, so `NET_VERSION` stays **11**.
- **Nothing here is already delivered.** `MatchId` has seven members on `main` today and
  `CHALLENGES` eight rows; `currentWinner`'s Sofia arm is gated on `"politiikka"`, which is the mode
  that does **not** have a government, and `resolveTrick`'s party arm is gated on `"puoluepeli"`,
  which is the mode that does **not** have Sofia. No single id carries both.

## Which id survives, and why

**`"politiikka"` survives. `"puoluepeli"` is retired.**

This is a real choice and not a rename: an id is saved state, it is a board key, it is hashed on the
wire, and CLAUDE.md's own `"tupatro"` paragraph is this project's standing record of what it costs
when an id's string stops matching the mode's name — a `SAVE_VERSION` and a `NET_VERSION` for a
label, which is why that one was never fixed. The two arguments point opposite ways and were weighed:

- **For `"puoluepeli"`: the smaller diff.** The combined mode is mechanically Puoluepeli plus one
  early return in `currentWinner`, so keeping that id leaves `resolveTrick`, `endHand`, `GovBox`,
  `MatchPlate`, `DealEnd`, `Rail`, `PlayingCard`'s emblem highlight and `bot.ts` untouched and moves
  only the two Politiikka gates.
- **For `"politiikka"`: the name is right, and the name is what the id is read as forever.** The
  owner asked for _one politics mode_; "Puoluepeli" names the government half and says nothing about
  the rotation or about Sofia, while "Politiikka" is the umbrella the owner and issue #49 both used
  ("monta eri politiikkaversiota"). The diff is a one-time cost paid by the implementer this week;
  the name is paid by every reader afterwards.

**Neither board has history to protect** — both are one day old, and both boards are discarded by
this spec anyway (see the key criterion), so the usual "the id is saved state" argument has nothing
to weigh on this side of the scale today and will have plenty the moment anybody plays either mode.
That is exactly why the choice is made now rather than deferred. The name wins.

## Acceptance criteria

- [ ] **One id, one row, and the retired id is gone from the source.** `MatchId` in
      `src/game/types.ts` is `"race" | "tuppi" | "tupatro" | "nami" | "namihard" | "politiikka"`;
      `CHALLENGES` in `content.ts` has **seven** rows and no `"puoluepeli"` row; `matchModeOf` in
      `race.ts` loses the case (the exhaustive switch will not compile until it does);
      `MATCH_KEY` loses its entry (a `Record<MatchId, string>`, so an orphan is a compile error).
      A test greps `src/` and asserts the string `puoluepeli` appears nowhere in it — catalogues,
      tests and CSS included — and `render.test.tsx`'s two spelled-out solo id lists (~lines 1339
      and 1751) and `SinglePlayer`'s row count drop to six drawn rows with `SOLO_MODES` still
      filtering `"tupatro"` alone.
- [ ] **The surviving mode is the union, in one `startDeal` arm and one `resolveTrick` arm.**
      `startDeal`'s `"politiikka"` arm increments `raceDeal`, sets `d.mode = politicsMode(d.raceDeal)`,
      leaves `ramSeat`/`ramTeam` null, leads from the elder hand, resets `raceBase`, fires
      `toast.newGov` on a term rollover (`(d.raceDeal - 1) % PUOLUE_TERM === 0`, deal 1 included) and
      goes straight to `beginPlay` — no `runDeclarations`, no swap phase, no temppu draw.
      `resolveTrick`'s `"politiikka"` arm adds `puolueTrick(governmentFor(d.seed, termOf(d.raceDeal)), d.mode, cards.map((c) => partyOf(d, c)))`
      to `d.raceBase[teamOf(w.p)]`, fires `toast.sofia` when `sofiaIn(d.trick)` is non-null, leaves
      `d.pop` null and calls no `scoreTrick`. A `reducer.test.ts` case drives **five** consecutive
      whole deals and asserts: the modes are rami, nolo, rami, nolo, rami; `governmentFor` answers
      the same list for deals 1–4 and a redrawn one for deal 5; the phase never reaches `declare`,
      `soolioffer`, `sooligive`, `sooliready` or `laydown`; `sooli`/`sooliBust` stay false and `shows`
      stays all null; thirteen four-card tricks are played in each; and the pair holding the ♥Q won
      the trick she was played into.
- [ ] **Sofia is this mode's rule and only this mode's.** `currentWinner`'s early return stays gated
      on `g.challenge === "politiikka"` and the strict `>` and the stone/wild handling below it stay
      **byte-identical**. `rules.test.ts` asserts she beats a card that would otherwise have won (an
      ace of the led suit, led first — the mutation lesson in CLAUDE.md), that she wins led and
      played last, and that the identical trick in `"tuppi"`, `"race"`, `"nami"` and with
      `challenge: null` is won by the ace instead. **She is an ordinary card for capture scoring**:
      she carries whatever party `partyMap` gave her, is worth `puolueValue` like any other card,
      and gets no exemption and no bonus — a `puolue.test.ts` case pins that the ♥Q's value is read
      from her party alone.
- [ ] **The mode banks party points, never `dealPoints`, and never the lost-lead reset.** `endHand`
      folds the id into the **Nami arm** (`raceScores[t] += raceBase[t]`, `handScore =
raceBase[ownerTeam(d)]`, `dealsLeft` and `blindScore` untouched); the old `"politiikka"`
      `dealPoints` arm is deleted; the `d.challenge !== "race"` reset clause is **not** widened, and
      a test pins that a deal the leading pair loses leaves both totals standing. `src/game/points.ts`
      is byte-identical and `dealPoints` is no longer reachable from this mode at all: `MatchPlate`'s
      `isPoints`, `RaceOver`'s `isPoints`, `DealEnd`'s route (`raceBaseOf`, not `dealPointsOf`) and
      `bot.ts`'s `dealOf` each move the surviving id onto the `raceBase` side, and tests pin that
      Traditional Tuppi's and Multiplayer Tupatro's own numbers did not move with it.
- [ ] **The termination inequality is re-confirmed with Sofia in play, by a test and not by prose.**
      Every one of the 52 cards is still captured exactly once a deal — thirteen tricks × four cards,
      no sooli, and Sofia takes a trick rather than voiding one — so a deal's two-pair **sum** is a
      sum over the deck and is independent of who won each trick. A `reducer.test.ts` case plays
      whole combined-mode deals with the ♥Q's rule active and asserts `raceBase[0] + raceBase[1]`
      equals exactly `4k·GOV_POINT` in a hallituspeli and `−(52 − 4k)·OPP_POINT` in an oppositiopeli
      for that deal's own government size `k`, and that the trick Sofia won moved points **between**
      the pairs without changing that sum. `3·GOV_POINT > 10·OPP_POINT` therefore stands unchanged;
      `puolue.ts`'s termination comment gains one paragraph saying why Sofia cannot break it, and
      `puolue.test.ts`'s existing deck-sum cases for `k = 3, 4, 5` stay valid as written.
- [ ] **The target is re-measured, not inherited.** At least **200 seeded matches** under the
      combined rules, all four seats AI with **both** clauses live (a trick holding Sofia cannot be
      won; `wantsTricks` from `puolueTrick`), under a fresh seed prefix, played past every candidate
      with the trajectory technique (`raceScores` never resets here, so one simulation per seed
      answers every candidate), every match finishing. Median, mean, p90 and maximum deal counts for
      at least three candidate targets go in `README.md`. What ships is the round target whose
      **median lands between 8 and 20 deals with the p90 at 36 or fewer**; if no round number does,
      the closest ships and the miss is written into the README rather than the band being widened.
      `POLITIIKKA_TARGET` in `constants.ts` carries the new measurement in its comment and
      `PUOLUEPELI_TARGET` is **deleted**, so a stale reading is a compile error. The weights
      `(GOV_POINT, OPP_POINT)` are re-confirmed by the same run; if the band is missed they may move,
      and any pair that ships satisfies the inequality above.
- [ ] **Yesterday's two boards and two saved runs are unreachable, and no other key moves.**
      `MATCH_KEY.politiikka` becomes `"tupatro-politiikka-v2"` — its v1 rows were played on tuppi's
      point scale against a different target and must not be sorted against party-point rows — and
      the `puoluepeli` entry is deleted with the id. `challengeRunKey` returns
      `tupatro-run-politiikka-v2` for the surviving id and `tupatro-run-<id>-v1` for every other,
      through a small documented per-id record in `storage.ts`, so a run saved yesterday under either
      old mode is simply not found and its row's Continue never appears. `RACE_SCORES_VERSION` stays
      **1** (bumping it would discard the race's, Traditional Tuppi's, Multiplayer Tupatro's and both
      Nami boards for a change that touches none of them) and the other five match keys, the
      rummikub key and the RPS key are byte-identical. **`SAVE_VERSION` stays 3** and no `removeItem`
      call site is added — `invariants.test.ts`'s pinned list stays at two. A test asserts a saved
      payload carrying `challenge: "puoluepeli"` is rejected whole by `rehydrate`'s existing
      `CHALLENGES` check, and that a finished match files on `tupatro-politiikka-v2` with the six
      other boards untouched.
- [ ] **The two pure modules both survive, both stay in `PURE_CORE`, and the mode reads both.**
      `src/game/politics.ts` keeps `politicsMode` and `sofiaIn`; `src/game/puolue.ts` keeps `termOf`,
      `governmentFor`, `puolueValue` and `puolueTrick` and **drops its `politicsMode` re-export** —
      one function, one import path. Both files' header comments are rewritten to say they are the
      one politics mode's two arithmetics, the shape `points.ts`, `nami.ts` and `rps.ts` have.
      Neither imports React, the DOM, the reducer, a component or `i18n`; `invariants.test.ts`'s
      `PURE_CORE` list keeps both.
- [ ] **One mode on screen, with both of its markers.** `Rail` draws the three-page strip
      (`rp-challenge`, `rp-gov`, `rp-game`) for `"politiikka"` and every other challenge but
      Multiplayer Tupatro keeps its two pages; `PlayingCard` draws **both** the Sofia marker and the
      government-emblem highlight in this mode and nothing extra in any other; `GovBox` is unchanged;
      `ModeBox` has **one** politics arm, drawing the deal's own hallituspeli/oppositiopeli label and
      the note that points at `GovBox`, and never calls `seatName(ramSeat ?? 0, …)`; `DealEnd`'s
      `reset` boolean stays keyed to `"tuppi" | "tupatro"` alone; `Hint` is untouched. A negative
      running total still renders through `fmt()` on `MatchPlate`, `MatchDealEnd` and `RaceOver`.
      `render.test.tsx` sweeps the mode's rail, felt + hand, deal end and result screen in both
      languages, and its two politics fixtures (~lines 356 and 375) become one.
- [ ] **One block of text per catalogue, with no orphan keys.** `challenge.politiikka.n` / `.t` are
      rewritten to describe the union (rotation, government and term, party-capture scoring, Sofia);
      one deal-note key survives of `table.politicsNote` / `table.puolueNote`; `table.politicsGov`,
      `table.politicsOpp`, `toast.sofia`, `toast.newGov` and `gov.*` stay; `challenge.puoluepeli.*`,
      `rules.puoluepeliTitle` and `rules.puoluepeli` are deleted from **both** catalogues, and one
      `rules.politiikkaTitle` + `rules.politiikka` section in `Rules.tsx` states the rotation, the
      absence of declaration, sooli and _ryöstö_, the government and its four-deal term, both
      per-card values, the Sofia card by name and rank, the cumulative no-reset banking, the target,
      and — in the shape the existing lines use — that **neither source knows any of it**.
      Placeholder sets match both ways, every number goes through `fmt()`, emphasis renders through
      `<Rich>`, and `i18n.test.ts` is green.
- [ ] **The docs say one mode, and both prior specs say superseded.** `README.md` has **one**
      politics mode section and **one** balance section carrying the new measured table, and the
      mode-name list near its top and its run-slot list each lose a name. `CLAUDE.md`'s heading
      ("there are nine of them"), its module table rows for `politics.ts` and `puolue.ts`, its
      `MatchId` spelling, its two mode sections, the board key and the reset trap all read one mode.
      Both `docs/specs/2026-09-19-politics-challenge-variant.md` and
      `docs/specs/2026-09-19-puoluepeli-party-mode.md` get `status: superseded` and a one-line
      pointer to this spec directly under their front matter; **neither file is deleted** and neither
      body is rewritten.
- [ ] **Nothing else moves.** `NET_VERSION` stays **11** and `src/net/protocol.ts` is byte-identical;
      `LOBBY_MODES` stays `["tupatro", "race", "tuppi"]`; no new `Phase`, no new `Action`, no new
      `GameState` field, no new `setTimeout`, no new `Math.random`, no module-level `let`. Tests pin
      that a race, Traditional Tuppi, Multiplayer Tupatro, both Nami variants, Rock-Paper-Scissors,
      Tuppi-Rummikub and a main-game deal each score exactly what they scored before, and that
      `seats.test.ts`'s golden literals and its 50-seed aggregate are unchanged.

## Assumptions

The requirement was ambiguous in these ways, and this reading was chosen. **Nobody answered a
question during the run** — this section is the reviewer's only warning about what was guessed.

- **`"politiikka"` is the id that survives, and the argument is the name, not the diff.** The
  reasoning is written out under _Which id survives_ above. The consequence the reviewer should see:
  the implementer's diff is the **larger** of the two available, because every Puoluepeli gate,
  board key, catalogue key and README section moves onto the other id. If the reviewer would rather
  have the smaller diff, the whole of this spec holds with the two id strings swapped and the
  player-facing name still read as "Politiikka" — but an id whose string does not match the mode's
  name is exactly the wart CLAUDE.md records about `"tupatro"`, and this spec refuses to add a
  second one.
- **The surviving mode's point scale is Puoluepeli's, so Politiikka's own scale is retired with the
  row.** The requirement's union list names party-capture scoring and does not name `dealPoints`, so
  tuppi's point table leaves this mode entirely rather than being kept as a second scale or summed
  with the party points. This is the reversal of a delivered criterion and is called out above
  rather than folded in quietly.
- **Yesterday's boards and saved runs are discarded rather than migrated, and that loss is real.**
  A Politiikka row banked on tuppi's point table cannot be converted into party points, and a run in
  flight in either mode cannot be resumed into a scale it was not played on — so both boards and
  both run slots are made unreachable by their keys. Anybody with a match in progress in either mode
  loses it silently: the row's Continue simply does not appear. Both modes are one day old, which is
  why this is a footnote rather than a spec of its own.
- **The keys move, not `SAVE_VERSION` and not `RACE_SCORES_VERSION`.** A `SAVE_VERSION` bump would
  discard every in-flight run in **every** mode, the main roguelike's included, and a
  `RACE_SCORES_VERSION` bump would discard every match board, for a change that touches one mode.
  The per-mode key spelling costs five documented lines in `storage.ts` and discards exactly what is
  wrong. This is a deliberate departure from the project's usual "bump the version" instinct, and it
  is recorded here so it is reviewed rather than discovered.
- **Sofia cannot break the termination proof, and the spec still demands a test.** The inequality
  rests on a deal's two-pair **sum**, which is a sum over the whole deck and is blind to who won each
  trick; Sofia redistributes and never removes a card from the count, so `3·GOV_POINT >
10·OPP_POINT` is re-confirmed rather than re-derived. What she does change is the **pace** and the
  variance — she guarantees her side one trick, worth up to four government cards in a hallituspeli
  and a forced capture in an oppositiopeli — which is why the target is re-measured and why the
  re-confirmation is pinned in the reducer with her rule live rather than argued on paper.
- **`(GOV_POINT, OPP_POINT) = (4, 1)` is a starting point for the new measurement, not an inherited
  value.** They were measured without Sofia. The new run re-confirms them; if the band is missed
  they move, constrained by the inequality.
- **The mode is called "Politiikka" / "Politics" and "Puoluepeli" / "Party Politics" disappears as a
  player-facing name.** The surviving description strings are rewritten to describe the union, so no
  catalogue string is left describing half a mode.
- **The two pure modules stay two files.** `politics.ts` holds the rotation and Sofia, `puolue.ts`
  the government arithmetic — one arithmetic per file, the shape `points.ts` and `nami.ts` have.
  Merging them into one file named after the mode is defensible and was rejected only because it
  moves every import for no rule change.
- **The bots get no new strategy.** They keep the two clauses they already have — a trick holding
  Sofia cannot be won, and a trick is worth taking when its party value is positive — and learn
  nothing about _when_ to spend her, which government cards are still out, or the term ahead. Every
  measured figure is therefore a bot measuring the bot in the sense CLAUDE.md warns about, and the
  README says so beside the new table.
- **Single player only, still.** Neither id was ever in `LOBBY_MODES`, so no session can carry
  either, no peer can be handed the retired id, and `NET_VERSION` stays 11 with `protocol.ts`
  byte-identical. If the implementer finds a route that puts either id on the wire, the version
  bumps and the reason is written down.
- **Both GitHub issues are considered answered by the one combined mode**, and neither is reopened or
  re-scoped by this spec. Issue #49's "many weekly politics variants" stays what both prior specs
  called it: a separate rotation feature, not built here.

## Touch points

- `src/game/types.ts` — `MatchId` loses `"puoluepeli"`; `ChallengeId` follows for free.
- `src/game/constants.ts` — `PUOLUEPELI_TARGET` deleted; `POLITIIKKA_TARGET` re-measured, with the
  new measurement in its comment; `PUOLUE_TERM`, `GOV_MIN`, `GOV_MAX`, `GOV_POINT`, `OPP_POINT` kept
  with comments rewritten to name one mode.
- `src/game/content.ts` — the `"puoluepeli"` `CHALLENGES` row deleted; the `"politiikka"` row's
  `target` unchanged in shape.
- `src/game/politics.ts` — comments rewritten (one mode reads this and `puolue.ts`).
- `src/game/puolue.ts` — the `politicsMode` re-export dropped; the termination comment gains the
  Sofia paragraph; header comment rewritten.
- `src/game/reducer.ts` — `startDeal`'s two arms merged into one; `resolveTrick`'s two arms merged
  into one (party scoring **and** `toast.sofia`); `endHand`'s `"politiikka"` `dealPoints` arm deleted
  and the id folded into the Nami arm; `showHandResult`'s match id list loses one member.
- `src/game/rules.ts` — `currentWinner`'s gate unchanged in id, comment rewritten.
- `src/game/race.ts` — `matchModeOf` loses the `"puoluepeli"` case.
- `src/game/ai.ts` — both clauses now gate on `"politiikka"`; the Nami/party `wantsTricks` chain
  keeps its shape.
- `src/game/storage.ts` — `MATCH_KEY.politiikka` → `tupatro-politiikka-v2`, `puoluepeli` entry
  deleted; `challengeRunKey` gains the documented per-id slot version.
- `src/components/rail/Rail.tsx` — the three-page strip keys off `"politiikka"`.
- `src/components/rail/MatchPlate.tsx` — the surviving id moves from `isPoints` to the `raceBase`
  group.
- `src/components/rail/GovBox.tsx` — unchanged but for its comment.
- `src/components/table/ModeBox.tsx` — two politics arms merged into one.
- `src/components/screens/DealEnd.tsx` — one politics route, to `raceBaseOf`.
- `src/components/screens/RaceOver.tsx` — the surviving id leaves `isPoints`.
- `src/components/PlayingCard.tsx` — both markers gate on the surviving id.
- `src/components/screens/Rules.tsx` — two sections merged into one.
- `src/components/screens/SinglePlayer.tsx` — no code change; the row count falls out of `CHALLENGES`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — one politics block each; the retired keys deleted from both.
- `src/test/bot.ts` — `playRace`'s `dealOf` moves the surviving id onto `raceBase`.
- `src/game/politics.test.ts`, `src/game/puolue.test.ts`, `src/game/rules.test.ts`,
  `src/game/reducer.test.ts`, `src/game/scores.test.ts`, `src/game/save.test.ts`,
  `src/test/render.test.tsx`, `src/test/invariants.test.ts` — merged fixtures, the retired-id grep,
  the deck-sum-with-Sofia case and the board/slot key cases.
- `README.md` — one mode section, one balance section with the new table.
- `CLAUDE.md` — the heading count, the module table, the `MatchId` spelling, the merged mode section,
  the board key, the reset trap.
- `docs/specs/2026-09-19-politics-challenge-variant.md`,
  `docs/specs/2026-09-19-puoluepeli-party-mode.md` — `status: superseded` and a pointer line each.

## Out of scope

- **Multiplayer.** `LOBBY_MODES`, `SCOPE`, `hashState`, `parseMsg`, `guestMay`, the shared table and
  `NET_VERSION` are untouched, and no session can reach the mode.
- **Migrating yesterday's boards or saved runs** into the combined mode's scale, and any one-off
  upgrade path in `save.ts` — there is none, and the loss is named under Assumptions instead.
- **Any part of the roguelike shell in the mode** — money, shop, jokers, vouchers, tuppipakka, the
  swap phase, blinds, bosses, cash-out — and **temput**: no deal draw, and the ♣K's Ikiliikkuja draw
  stays Multiplayer Tupatro's alone.
- **Bot strategy**: no timing of Sofia, no card counting, no reading of the term ahead, and no new
  clause beyond the two that already exist.
- **Re-measuring any other mode's target or weights.** The race's 12,000, Traditional Tuppi's 52 and
  its reset, both Nami targets and tables, Multiplayer Tupatro's draw and every main-game literal in
  `seats.test.ts` stay exactly as they are.
- **Changing `g.support`, the thirteen parties, their emblems, `partyMap`, the four suit tokens or
  the `trad` two-colour test.** No party is added, renamed or re-emblemed and no suit is repainted.
- **A Sofia portrait image.** She keeps the text marker `2026-09-19-politics-challenge-variant`
  shipped.
- **A weekly rotation of politics variants**, any clock or "this week's challenge" surface, and any
  second politics mode. One permanently available mode ships.
- **Ending a match only at a term boundary**, a per-term result screen, an election animation, a
  government history, or a drawn match (`raceover` keeps `winner: 0 | 1`).
- **A multi-human politics save.** `soloBoard` still gates the run slot, exactly as for every other
  match mode.

## Source

- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** and
  **<https://korttipeliopas.fi/tuppi>** — what the combined mode keeps, unchanged: four players in
  two partnerships sitting across from each other, thirteen cards each, **no trump**, follow suit
  (_maantuntopakko_), the highest card of the led suit taking the trick, the ace high.
- **<https://korttipeliopas.fi/tuppi>, the declaration**: _"Pelaajat valitsevat, pelataanko ramia vai
  noloa"_ and _"Näyttäminen jatkuu myötäpäivään ja päättyy heti, kun joku näyttää ramia."_ — the
  declaration is a free clockwise choice beginning with _etukäsi_. **The combined mode contradicts
  that on purpose**, exactly as both retired modes did: nobody chooses, and the deal type alternates.
- **<https://korttipeliopas.fi/tuppi>, _ryöstö_ and sooli**: both hang off a declared rami, so both
  are unreachable here. `2026-09-09-both-defenders-sooli`'s offer is untouched and simply never
  fires; `points.ts` is not touched at all.
- **<https://korttipeliopas.fi/tuppi>, the point table**: _"Kuudella kasalla joukkue saa neljä
  pistettä…"_ / _"Seitsemästä kasasta saa neljä pistettä…"_ — tuppi scores a deal by its **trick
  count**. **The combined mode contradicts that too**, and more sharply than Politiikka did: a deal's
  worth here is the **parties of the cards captured**, and the trick count decides nothing but who
  holds them. Retiring Politiikka's `dealPoints` banking is therefore a move _away_ from the source,
  and is stated in the rules panel and the README as this game's own.
- **The government, the four-deal term, the two per-card values, the rotation and the Sofia card
  have no source at all.** They are the requirement's own inventions, from GitHub issues #49 and
  #63, and they belong in `politics.ts`'s and `puolue.ts`'s own comments as such — the way
  Tuppi-Rummikub's laydown, Nami's point tables and Rock-Paper-Scissors' two clubs are. Neither the
  club sheet nor korttipeliopas.fi gives the ♥Q, or any card, an effect: in tuppi she is an ordinary
  queen that follows suit, beats a jack and loses to a king.
