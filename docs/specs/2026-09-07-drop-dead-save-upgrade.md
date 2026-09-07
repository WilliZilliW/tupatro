---
id: 2026-09-07-drop-dead-save-upgrade
title: Delete the temporary v2 save upgrade and the unread lostBefore field
kind: scoring
status: proposed
source: Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022); <https://korttipeliopas.fi/tuppi> — neither knows of a save format, a migration or a scoring context, so no rule of play and no computed point moves here
---

# Delete the temporary v2 save upgrade and the unread lostBefore field

## What

Two pieces of dead weight the last two changes left behind are removed, and nothing a player sees
changes. `upgradeV2` in `src/game/save.ts` — the v2→v3 economy migration whose own comment sets its
window at "days, not versions" — is deleted along with its call in `rehydrate` and its behaviour
tests, so a `v: 2` payload is refused by the version gate exactly as a v1, v4 or v99 payload is.
`ScoreContext.lostBefore`, written in `scoreTrick` and read by nothing, is deleted with it.

The developer gains two things: the save path is back to one rule with no exception — an older save
is discarded, not migrated — and the scoring context holds no field a joker author could reach for
and find already computed for a reason nobody remembers. Every run still saved under version 2 is
lost for good; that is the cost the upgrade only deferred.

## Prior specs

- **Completes `2026-09-07-per-seat-economy`** (in `main`; front matter still says `proposed`, its
  code is shipped). That spec wrote `upgradeV2` and said so plainly: _"If the reviewer prefers the
  plain discard, delete `upgradeV2`, its call and its tests"_, and its own note fixes the window at
  days. This is that deletion, taken on the schedule that spec set. It **reverses nothing** in it:
  `SAVE_VERSION` stays `3`, `SavedRun`, `SavedEconomy`, `dehydrate` and every per-wallet rejection
  in `rehydrate` stay exactly as delivered.
- **Follows `2026-09-04-resume-a-run-after-a-refresh` (delivered)** back to its own rule, rather
  than contradicting it. That spec lists under Out of scope: _"Migrating saves across a
  `SAVE_VERSION` bump: an old save is discarded, not upgraded."_ The two upgrades since were both
  documented exceptions; after this there are none, and the delivered rule holds without a
  footnote.
- **Narrows one delivered criterion, without reversing it.**
  `2026-09-07-seat-absolute-game-state` requires that _"`ScoreContext` carries no us/them or seat-0
  field: `usBefore` / `themBefore` are replaced by team-indexed counts plus the team being
  scored"_. `lostBefore` was one of those team-indexed counts. Removing it leaves `wonBefore`,
  `scoredBefore`, `team`, `owner` and `partner`, which still satisfies that criterion in full — the
  criterion is about no us/them naming, and nothing here brings a name back. **This is not a
  reversal**: the count is still one expression away as `g.tricks[1 - team]` for any future joker
  that wants it.
- **Pays two items off `docs/multiplayer.md`'s debt list**: item 1 (delete `upgradeV2`, _"the only
  item here with a clock on it"_) and item 3 (`lostBefore` written and never read). That list must
  stop claiming them, or the next reader pays them twice.

## Acceptance criteria

- [ ] `src/game/save.ts` holds no migration: `upgradeV2`, the `ECON_LISTS` / `ECON_COUNTS` /
      `ECON_FIELDS` constants that only it used, and the two lines in `rehydrate` that called it are
      deleted. `rehydrate`'s first read of the payload is the `SavedRun` destructure, and
      `grep -n "upgradeV2\|ECON_FIELDS\|ECON_LISTS\|ECON_COUNTS" src/game/save.ts` finds nothing.
- [ ] `SAVE_VERSION` is still `3`, and `SavedRun`, `SavedEconomy`, `dehydrate`, `rehydrateEcon`,
      `rehydrateShop`, `mapIds` and `cardsOk` are unchanged in behaviour. The header comment's
      sentence naming `upgradeV2` as "a deliberate, temporary exception" and the tail of the
      `SAVE_VERSION` comment that promises the upgrade are rewritten to past tense: the history of
      why v1 and v2 were dropped stays, the standing rule reads as one migration at most and none
      today.
- [ ] `rehydrate(raw, 0)` returns `null` for a `v: 2` payload, whether or not it carries the
      seventeen flat economy fields, and it is the version gate that refuses it. In
      `src/game/save.test.ts` both version-gate cases list `2`: `it.each([0, 1, 2, 4, 99])` for
      "still rejects a version %i save" and for the flat-economy payload case, whose name is
      reworded to say it is rejected rather than "not upgraded".
- [ ] These four cases in `src/game/save.test.ts` are deleted, with the block comment that
      introduces them: "folds a version 2 save's economy into the owner's wallet", "leaves the other
      three wallets at newEconomy()", "falls back rather than folding an absent shop as undefined",
      "refuses a version 2 save whose economy is missing or malformed". No test names `upgradeV2`,
      and the `newEconomy` import goes with them if nothing else in the file calls it —
      `npm run lint` passes with no unused import.
- [ ] Every other case in `src/game/save.test.ts` is untouched and passes: the round trip, the
      unknown-id rejections that go through `walletOf`, the `economies`-length and bad-wallet
      rejections, "rejects a version 1 save outright", "a resumed run plays on identically", and the
      seats / tricks / sooliSeat round trip.
- [ ] `ScoreContext` in `src/game/types.ts` declares no `lostBefore`, the two-line comment above
      `wonBefore` is rewritten to describe the one count that remains, and `scoreTrick` in
      `src/game/scoring.ts` no longer writes `lostBefore: g.tricks[1 - team]`. Nothing else in the
      `ctx` literal moves, and `npm run typecheck` passes.
- [ ] `src/test/invariants.test.ts` gains one case that fails on `lostBefore` or `themBefore`
      appearing anywhere under `src/` (that file itself excepted, as the existing blocklist case is),
      with a comment recording why: the same unread count came back once already under a second
      name, and a scoring-context field no consumer reads is a trap for the next joker author. The
      existing five-name blocklist case is left alone. Mutation check: restoring the field in
      `types.ts` and `scoring.ts` makes this case fail, and only it.
- [ ] Not one point of score or byte of engine output moves. `src/game/seats.test.ts` passes with
      its pinned literals for the three named seeds and its fifty-seed aggregate, and its rotation
      test passes — the file is **not edited**. `git diff --stat` names no test file other than
      `src/game/save.test.ts` and `src/test/invariants.test.ts`, and no file under `src/components/`,
      `src/hooks/` or `src/i18n/`.
- [ ] `CLAUDE.md`'s Known-gaps `SAVE_VERSION` paragraph says the upgrade is **gone** and that a v2
      save is now discarded by the version gate rather than folded, keeps the record of why it
      existed and why exactly one migration exists at a time, and states the price paid (every run
      still saved under v2 is lost). It promises no live migration and names `upgradeV1` /
      `upgradeV2` only as history.
- [ ] `README.md`'s "Saved runs" section no longer tells the player a v2 save is carried across: the
      paragraph beginning "A run saved under version 2 is **carried across**…" is rewritten to say
      it is discarded too, so "a run saved by an older version is discarded, not migrated" now holds
      with no exception. The three deliberate non-bumps and the two bumps keep their explanation.
- [ ] `docs/multiplayer.md`'s "Debts, most urgent first" list no longer lists the two items this
      pays: `upgradeV2` and `lostBefore` are removed, the remaining items are renumbered, and the
      closing sentence "Items 1 and 3 are what is actually left" is rewritten to match what is
      actually left.
- [ ] All five gates pass: `npm run lint`, `npm run typecheck`,
      `npx prettier --check "**/*.{ts,tsx,json,md,html}"`, `npm test`, `npm run build`. The
      test-count lines in `CLAUDE.md` (two) and `README.md` (two) equal what `npm test` prints —
      expected **793** (794 today, minus the four deleted cases, plus the two version-gate cases
      that gain `2`, plus the one new invariant), with the run's own report as the authority.

## Assumptions

Nobody answered a question during this run. Each of these was decided here.

- **The "days, not versions" window has expired, and that is taken from the requirement rather than
  measured.** There is no telemetry, so how many runs are still on disk under v2 is unknown; the
  economy change shipped one commit ago on `main`. Every such run is lost with no warning to its
  player, which is precisely what the upgrade existed to postpone. If the reviewer wants one more
  release of grace, this whole change is a revert.
- **`SAVE_VERSION` stays `3`.** Deleting a migration is not a state-shape change, and bumping would
  additionally throw away every **v3** save in flight for nothing. The version gate already refuses
  v2 the moment the upgrade is gone.
- **"Its own test cases" is read as the four cases that assert upgrade _behaviour_.** "rejects a
  version 1 save outright" is kept: it refuses a payload whose shape genuinely differs, not just its
  version tag, and its comment carries the one-migration-at-a-time record.
- **The version-gate `it.each` lists gain `2` rather than the coverage simply disappearing.**
  Without that, nothing in the suite fails if an upgrade is reintroduced; the flat-economy payload
  case is the one that catches a blanket upgrade, because a v3 payload carries no flat fields for a
  loose upgrade to find.
- **One invariant case is added, which the requirement did not ask for.** The justification is
  history: this exact unread count already came back once, renamed from `themBefore` to
  `lostBefore`, so the deletion is enforced by name the way the project enforces its other replaced
  names.
- **`ScoreContext.team` is also written and read by nothing, and it is deliberately left in place.**
  CLAUDE.md documents it as part of the seat-absolute context (_"`ScoreContext` carries that team
  plus the two seats it is made of"_), unlike `lostBefore`, which nothing documents. Consequence: no
  general "no write-only field on `ScoreContext`" guard is written, because it would fail on `team`
  on the day it landed. The narrow name-based case above is what ships instead.
- **`README.md` and `docs/multiplayer.md` are edited too, though the requirement named only
  CLAUDE.md.** Both state in the present tense things this change removes — the README tells the
  player a v2 save survives, and the debt list tells a developer these two jobs are outstanding.
  Leaving either would teach something false.
- **The stale test-count lines in `README.md` are corrected in passing** (they read 716 against a
  real 794 today) because this change edits that file and moves the count again. That also settles
  `docs/multiplayer.md`'s debt item 4 on `main`; if the parked lobby branch later writes a different
  number, that is its own count to keep true.
- **`kind` is `scoring`, not `infra`.** The change is deletion and documentation, and no point is
  computed differently — but it edits `src/game/scoring.ts` and the `ScoreContext` type, and the
  requirement's hard constraint is that no score and no engine byte moves. Classifying it `scoring`
  runs the gates that can actually see that (the pinned goldens, `scoring.test.ts`,
  `reducer.test.ts`) instead of skipping them.

## Touch points

- `src/game/save.ts` — delete `upgradeV2`, `ECON_LISTS`, `ECON_COUNTS`, `ECON_FIELDS` and the `src`
  line plus its comment in `rehydrate` (currently around lines 220–280); rewrite the header
  comment's exception sentence and the `SAVE_VERSION` comment's closing paragraph. `SAVE_VERSION`
  itself unchanged at `3`.
- `src/game/save.test.ts` — delete the "version 2 upgrade" block comment, the `asV2` helper and the
  four behaviour cases; add `2` to both version-gate `it.each` lists and reword the flat-economy
  case's name; drop the `newEconomy` import if it becomes unused. `walletOf` stays — the id
  rejections use it.
- `src/game/types.ts` — `ScoreContext`: remove `lostBefore` (line 70) and rewrite the comment above
  `wonBefore` (lines 67–68).
- `src/game/scoring.ts` — `scoreTrick`'s `ctx` literal: remove `lostBefore: g.tricks[1 - team]`
  (line 117). `wonBefore: g.tricks[team]` and `scoredBefore: g.scored` stay, since `ylitikki`,
  `tuppisuu` and `vyory` read them.
- `src/test/invariants.test.ts` — one new `it` banning `lostBefore` / `themBefore` under `src/`,
  beside the existing "ports none of the four names main replaced" case, reusing its `ALL`,
  `stripComments`, `read` and `rel` helpers.
- `CLAUDE.md` — the Known-gaps `SAVE_VERSION` paragraph's `upgradeV1`/`upgradeV2` tail; the two
  "794 tests" lines (the Commands block and the Tests section).
- `README.md` — the "Saved runs" section's v2-upgrade paragraph; the two "716 tests" lines.
- `docs/multiplayer.md` — the "Debts, most urgent first" list: items 1 and 3 removed, the rest
  renumbered, the closing "Items 1 and 3 are what is actually left" sentence rewritten, and item 4
  dropped once the README count is true.

## Out of scope

- **Bumping `SAVE_VERSION`, or writing any migration for any version.** The point of this change is
  that no migration exists.
- **Changing `SavedRun`, `SavedEconomy`, `dehydrate` or any of `rehydrate`'s per-wallet
  rejections** — the unknown-id, malformed-side-deck-card and four-wallet checks delivered by
  `2026-09-07-per-seat-economy` stay exactly as they are.
- **Removing `ScoreContext.team`, `owner` or `partner`, or any other field a joker does not read
  today**, and any general dead-field guard. See Assumptions.
- **Touching what `wonBefore` or `scoredBefore` mean, the jokers that read them, the locked scoring
  order, chip values, the tuppi multiplier or any pinned golden.**
- **`docs/multiplayer.md`'s remaining debts** — `startChallenge` discarding the run's seating and
  `startDeal`'s swap gate reading the owner's wallet. They stay on the list, renumbered.
- **Any rule of play, the rules panel (`src/components/screens/Rules.tsx`) or the README's rules
  text.** Nothing about how tuppi is played changes.
- **Any i18n key.** No player-facing string is added, removed or reworded; `src/i18n/` is not
  edited.
- **Balance.** No number a measurement produced moves, so no headless measurement is required.

## Source

- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022).** Tuppi is scored by the
  tricks each partnership takes under its rami or nolo declaration, with the tuppi carrying the
  stake forward; the sheet knows nothing of a save file, a version gate or a scoring context. No
  rule is read or reinterpreted here, and no computed point changes — the acceptance criteria pin
  that as the pinned literals in `src/game/seats.test.ts` staying untouched.
- **<https://korttipeliopas.fi/tuppi>** agrees on the declaration and the trick count and likewise
  says nothing about either subject.
- **The chosen reading, for the code comment.** The count `lostBefore` carried — the opposing team's
  tricks before this one — remains derivable as `g.tricks[1 - team]`, so removing the field takes
  nothing away from a future joker. The new invariant's comment records that this is the second time
  the count has been deleted (`themBefore` was the first), which is why it is banned by name rather
  than merely removed.
