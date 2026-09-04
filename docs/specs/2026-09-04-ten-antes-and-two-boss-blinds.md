---
id: 2026-09-04-ten-antes-and-two-boss-blinds
title: Extend a run to ten antes and give every ante four blinds, with a small and a big boss
kind: rule
status: proposed
source: Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022); https://korttipeliopas.fi/tuppi — neither fixes a number of deals in a match, so the ante ladder is Balatro's structure and no tuppi rule is touched
---

# Extend a run to ten antes and give every ante four blinds, with a small and a big boss

## What

A run is ten antes instead of eight, and an ante is four blinds instead of three: small, big,
small boss, big boss. The two boss blinds draw from **different** pools — five mild bosses for
the small one, five harsh ones for the big one — so an ante always shows two different bosses,
and neither of them can be skipped. Five new bosses ship with the pools: `patakielto`,
`kuvakato` and `verokarhu` on the mild side, `kiire` and `harmaus` on the harsh side. Winning is
beating the ante-10 big boss.

## Acceptance criteria

- [ ] `src/game/constants.ts`: `ANTES` holds ten strictly increasing values, the last two
      `16000` and `25000`; `BLIND_MULT` is `[1, 1.5, 2, 2.5]`; `BLIND_REWARD` is `[3, 4, 5, 6]`;
      `BLIND_KEYS` and `BLIND_MARKS` hold four entries each, all four marks distinct. The length
      assertion in `src/game/rules.test.ts` (currently `toHaveLength(8)`) reads 10, and a test
      asserts the four tables are the same length as each other.
- [ ] An ante is four blinds. `createRun().beaten` is four `false`s; `nextBlind` walks
      `blindIdx` 0→1→2→3 and only from 3 increments `ante`, resets `blindIdx` to 0 and `beaten`
      to four `false`s. Tests in `src/game/reducer.test.ts` cover both steps and the rollover.
- [ ] Neither boss blind is skippable: `gameReducer(g, { type: "skipBlind" })` from
      `blindIdx: 2` and from `blindIdx: 3` returns a state with the same `blindIdx`, `money` and
      `beaten` (the existing `if (d.blindIdx >= 2) return` guard, pinned by a test), and
      `BlindSelect` renders the skip button only while `blindIdx < 2`.
- [ ] `src/game/content.ts` exports `SMALL_BOSSES` = `kitsas`, `pakkorami`, `patakielto`,
      `kuvakato`, `verokarhu` and `BIG_BOSSES` = `punainen`, `kasijarru`, `umpimahka`, `kiire`,
      `harmaus`; `BOSSES` stays exported as the concatenation of the two (ten rows, ids unique)
      so `save.ts`'s `byId` and `i18n.test.ts` keep one table to look in. A test asserts ten
      rows, unique ids, and that the two pools are disjoint.
- [ ] `startBlind` sets `boss` from `SMALL_BOSSES` at `blindIdx === 2`, from `BIG_BOSSES` at
      `blindIdx === 3` and `null` otherwise, and `target = Math.round(ANTES[ante - 1] *
BLIND_MULT[blindIdx])`. A seeded test plays one ante and asserts the two bosses differ and
      that the four targets are the ante value × 1 / 1.5 / 2 / 2.5.
- [ ] Victory is the ante-10 big boss: `nextBlind` from `{ ante: 10, blindIdx: 3 }` sets
      `screen: { kind: "victory" }` and `bestAnte` to at least 11; from `{ ante: 10, blindIdx:
2 }` it advances to `blindIdx: 3` and opens no victory screen. Tests cover both.
- [ ] The three mild bosses, each with a unit test: `patakielto` — `chipValue` of any spade is
      `0` and a stone card is unaffected (`50 + chipBonus`); `kuvakato` — `chipValue` of a J, Q
      or K is `5` before `bonus`/`chipBonus`, while an ace (11) and every pip card are unchanged;
      `verokarhu` — the `interest` on the `cashout` screen payload is `0` and `money` grows by
      `reward + bonus + spare` only.
- [ ] The two harsh bosses, each with a unit test: `kiire` — `startBlind` sets `dealsLeft` (and
      the new `blindDeals`) to `Math.max(1, deals - 1)`, so a blind is three deals; `harmaus` —
      after `startBlind` and a deal, `phase` is never `swap` and no card in `hands[0]` carries an
      `enh`, with a side deck that would otherwise have a swap available.
- [ ] Both catalogues carry `boss.<id>.n` and `boss.<id>.t` for all ten bosses and `blind.0`…
      `blind.3`; `src/i18n/i18n.test.ts` resolves every `BOSSES` row in both locales and finds no
      placeholder mismatch. `rules.balatro` says ten antes and four blinds — small, big, small
      boss, big boss — with the 1 / 1.5 / 2 / 2.5 targets and the $3–$6 rewards, and the two
      lists keep the same length in `fi.ts` and `en.ts`.
- [ ] No `8` denominator is left in `src/`: `rail.ante` reads `"{n}/{total}"` in both catalogues
      and `Rail.tsx` passes `ANTES.length`, and `Scoreboard.tsx`'s `` `${row.ante}/8` `` reads
      `ANTES.length` too. `BlindPlate` names both boss blinds distinctly (a `rail.boss` variant
      per index, not one shared label).
- [ ] The render sweep in `src/test/render.test.tsx` covers the new shape: the `BOARD` fixture
      uses `blindIdx: i % 4`, `BlindSelect` is swept at `blindIdx: 3` and draws four blind cards,
      and each of the five new bosses appears in at least one swept state, in both languages, with
      no `undefined`, leaked key or Finnish word in English output.
- [ ] `src/index.css` gains `.bm-3` and `.blinds` lays out four cards; the blind select is read at
      1280×800, 1280×500 and the 560 px phone breakpoint with all four cards and every button
      hit-testable, and the result is written into the PR description.
- [ ] Balance is re-measured, not guessed: `playRun`'s `maxBlinds` default becomes 40, and a
      seeded run of at least 200 runs with `basicPolicy` reports median and mean blind score, the
      share of blinds scoring zero, the clear rate per ante 1–10 and the mean blind score per boss
      id. The README's **Balance** section is replaced with those figures and the new ladder; the
      measurement script is deleted afterwards. `npm run lint`, `npm run typecheck`, `npx prettier
--check`, `npm test` and `npm run build` all pass, and the test count in `README.md` and
      `CLAUDE.md` matches the new total.

## Assumptions

Nobody answered a question during this run. Each line below is a reading that was chosen, not one
that was confirmed.

- **`kuvakato` halves the rank value, not the finished chip figure.** A J/Q/K is worth 10 chips
  before enhancements; under `kuvakato` it is worth 5, and `bonus` (+40) and `chipBonus` are added
  on top of the 5. The ace is worth 11 and is **not** a face card, so it is untouched — the
  requirement says "J/Q/K". A stone card returns `50 + chipBonus` before the rank is ever read, so
  it is untouched as well.
- **`patakielto` mirrors `punainen` exactly**, including the order: the spade's value is zeroed
  after `bonus` and `chipBonus` have been added, and a stone card is untouched because it plays
  with no suit. A spade `wild` card counts as every suit for following and for the winner, and is
  still a spade in `chipValue`, so it is zeroed.
- **`harmaus` is implemented by closing the swap, not by stripping `enh` in play.** The side deck
  is the only route by which an enhanced card reaches a hand, so `startBlind` under `harmaus`
  leaves `swapsLeft` at 0 and the `swap` phase never opens. This keeps `matchesSuit`, `isStone`,
  `currentWinner` and `evalTrick` state-free — threading `GameState` into them for one boss would
  be the larger change. Two consequences: a joker that reads `ctx.sideDeckEnh` still counts the
  side deck, and no swap is "spent", so nothing carries over.
- **`kiire` adds a `blindDeals` field to `GameState`** (set at `startBlind`, `Math.max(1, deals -
1)` under `kiire` and `deals` otherwise) rather than being recomputed in a component. The
  game-over line `over.allDealsPlayed` then reports the deals the blind actually allotted instead
  of the run-wide 4. `deals` stays the run-level allowance and nothing else writes it.
- **`verokarhu` removes interest at that blind's cash-out only.** A blind that is lost never
  reaches cash-out, so the boss costs nothing on a failed blind — its bite is on a blind you win
  with a full purse.
- **Vouchers stay one shop per ante.** `shopAfterBoss` becomes `d.blindIdx === 3`, so only the big
  boss's shop stocks vouchers. Making it `>= 2` would double voucher offers against a table of six.
- **The skip bonus and the interest cap are untouched** — $2 for a skip, $5 interest maximum — and
  the skip guard already reads `blindIdx >= 2`, which is exactly "neither boss can be skipped"
  under the new four-blind ante.
- **The two new targets 16000 and 25000 are taken from the requirement and are not retuned.** If
  the measurement shows ante 9 or 10 unreachable for `basicPolicy`, that is written into the
  README as a measured fact; the numbers stand and a follow-up spec retunes them.
- **`SAVE_VERSION` is not bumped**, following the precedent set when the scoreboard shipped. A run
  saved before this resumes intact, and its current ante gains a second boss blind: its `beaten`
  array is three long, and `beaten[3]` reads `undefined`, which is falsy and so draws as "not
  beaten". The resumed run gets a blind more, never fewer.
- **Scoreboard rows are not migrated.** A row written before this carries `blindIdx: 2` and will
  now be labelled "small boss" although the run died on the old single boss blind. One-off, on
  rows already on the board.
- **Blind names and the fourth mark.** `blind.2` becomes "Pieni pomo" / "Small boss" and `blind.3`
  "Iso pomo" / "Big boss"; `blind.0` and `blind.1` keep their text. `BLIND_MARKS` gains a fourth
  glyph, drawn from the geometric/dingbat set the project already uses and verified with the
  canvas-versus-U+E000 tofu check in `CLAUDE.md` before it is committed.
- **The five new boss names are invented game content, not tuppi terms.** They are Finnish data in
  `fi.ts` and get real English names in `en.ts` (unlike rami, nolo, sooli, which stay Finnish in
  both).

## Relation to the specs already delivered

- **Overlaps `2026-09-04-local-top-ten-scoreboard`, which pinned the board row as the seed,
  `{ante}/8`, `t(BLIND_KEYS[row.blindIdx])`, the score and the won/lost mark.** This spec does not
  reverse that design; it widens the denominator to `ANTES.length` (now 10) and the blind key
  range to 0–3. The row shape, its sort order, its idempotence and its storage key are unchanged
  and stay out of scope here.
- `2026-09-03-party-emblems-and-support` and `2026-09-04-view-the-scoreboard-any-time` each put
  "retuning `ANTES` or any balance figure" out of their own scope. That is a scope statement about
  those changes, not a decision that `ANTES` is fixed, so nothing is being reversed.
- No delivered spec states the number of antes or blinds as a rule, so nothing here contradicts
  one.

## Touch points

- `src/game/constants.ts` — `ANTES`, `BLIND_MULT`, `BLIND_REWARD`, `BLIND_KEYS`, `BLIND_MARKS`.
- `src/game/content.ts` — `SMALL_BOSSES`, `BIG_BOSSES`, `BOSSES` as their concatenation.
- `src/game/types.ts` — `blindDeals` on `GameState`.
- `src/game/state.ts` — `createRun`: `beaten` four long, `blindDeals`.
- `src/game/cards.ts` — `chipValue`: `patakielto` and `kuvakato`, beside the existing `punainen`.
- `src/game/reducer.ts` — `startBlind` (pool per index, target, `kiire`, `harmaus`), `nextBlind`
  (four blinds, ante 10, `bestAnte` 11), `cashOut` (`verokarhu`), `toShop` (`shopAfterBoss`).
- `src/components/screens/BlindSelect.tsx` — four blind cards, skip button under `blindIdx < 2`.
- `src/components/rail/BlindPlate.tsx` — a distinct label for each boss blind.
- `src/components/rail/Rail.tsx` — `rail.ante` gets `total` from `ANTES.length`.
- `src/components/screens/Scoreboard.tsx` — the ante denominator from `ANTES.length`.
- `src/components/screens/GameOver.tsx` — `over.allDealsPlayed` reads `blindDeals`.
- `src/index.css` — `.blinds` grid, `.bm-3`.
- `src/i18n/fi.ts`, `src/i18n/en.ts` — `blind.3`, five `boss.*` pairs, `rail.ante`,
  `rules.balatro`.
- `src/test/bot.ts` — `playRun`'s `maxBlinds` default 40.
- `src/game/rules.test.ts` — the `ANTES` length and the four-table check.
- `src/game/reducer.test.ts` — blind walk, ante rollover, unskippable bosses, victory, `kiire`,
  `harmaus`, `verokarhu`.
- `src/game/scoring.test.ts` — `patakielto` and `kuvakato` in `chipValue`.
- `src/test/render.test.tsx` — `BOARD` fixture, `BlindSelect` at `blindIdx: 3`, the new bosses.
- `README.md` — "What comes from Balatro", the **Balance** section, the test count.
- `CLAUDE.md` — the test count.

## Out of scope

- Tuppi's own rules: the declaration, the follow-suit obligation, the trick winner, the tuppi
  multiplier table, ryöstö and sooli are untouched.
- New jokers, consumables, vouchers or enhancements, and any change to the shop's prices, slot
  counts or reroll cost.
- Retuning `ANTES[0..7]`, the trick-type table, the interest cap or the skip bonus.
- Migrating saves or scoreboard rows, and any new scoreboard column.
- Guaranteeing a boss appears at most once in a run: the pools are disjoint within an ante, and a
  boss may repeat across antes.
- Joker drag-reordering, which would force the locked scoring order to be removed at the same
  time.
- Accessibility work and any new `g.phase`.
- Changing the deals-per-blind allowance for anything other than `kiire`.

## Source

- **Oulunsalo senior tuppi club rule sheet (Antti Auer, 9 September 2022)** and
  <https://korttipeliopas.fi/tuppi>: four players in two pairs, a full deck, 13 cards each; **no
  trump**; maantuntopakko; the highest card of the led suit takes the trick, aces high; the näyttö
  (red = rami, black = nolo); rami 7 tricks = 4 points and 4 a trick after; nolo 6 tricks = 4
  points and 4 for each trick fewer; ryöstö doubles the defenders' points; sooli is 24 points, and
  a single trick gives 24 to the declarers; a match ends when a pair reaches **52 points**.
- **Neither source fixes how many deals a match lasts.** korttipeliopas states only the 52-point
  end. The ante ladder, the blind multipliers and the boss blinds are therefore Balatro's
  structure laid over tuppi, and extending it from eight antes to ten contradicts nothing in the
  sources. The game already deviates by ending a run at an ante rather than at 52 points; this
  spec extends that existing deviation and does not add a new one.
- **The five new bosses bend the Balatro layer, not tuppi.** `patakielto` and `kuvakato` change
  the chip value of a card, `verokarhu` changes the cash-out economy, `kiire` changes how many
  deals a blind is worth, and `harmaus` closes the side deck — none of them touches who may play
  which card, who wins a trick, or how rami, nolo, ryöstö and sooli score. `pakkorami`, which does
  restrict the näyttö, is an existing boss and is only moved into the small pool; this spec does
  not widen that deviation.
- Chosen readings that belong in a code comment as well: `kuvakato` halves the **rank value**
  (10 → 5) before `bonus` and `chipBonus`, and leaves the ace alone; `patakielto` zeroes a spade
  after those additions, exactly as `punainen` zeroes a red card, and leaves a stone card alone
  because it plays with no suit; `harmaus` is enforced by never opening the `swap` phase, since
  the side deck is the only way an enhancement reaches a hand.
